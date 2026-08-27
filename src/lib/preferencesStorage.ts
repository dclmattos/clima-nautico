import pb from '@/lib/pocketbase/client'
import { PreferenciasStorage, PontoPersonalizado } from '@/types/nautico'

export const PREFS_STORAGE_KEY = 'clima_nautico_prefs_v1'
export const MAX_PONTOS_PERSONALIZADOS = 10

export const DEFAULT_PREFERENCIAS: PreferenciasStorage = {
  perfil_id: 'lancha',
  ponto_favorito_slug: 'angra',
  horario_briefing: '07:00',
  ultimo_briefing: null,
  pontos_personalizados: [],
}

/**
 * Normaliza array de pontos personalizados
 */
function sanitizePontosPersonalizados(raw: any): PontoPersonalizado[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const tipo =
        item.tipo === 'semi-abrigado' || item.tipo === 'semi'
          ? 'semi-abrigado'
          : item.tipo === 'mar aberto' || item.tipo === 'aberto'
            ? 'mar aberto'
            : 'abrigado'

      return {
        id: String(
          item.id ||
            (typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `ponto-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`),
        ),
        nome: String(item.nome || 'Ponto Personalizado'),
        lat: Number(item.lat) || 0,
        lon: Number(item.lon) || 0,
        tipo: tipo as PontoPersonalizado['tipo'],
        criado_em: String(item.criado_em || new Date().toISOString()),
      }
    })
    .slice(0, MAX_PONTOS_PERSONALIZADOS)
}

/**
 * Lê as preferências salvas no localStorage (chave 'clima_nautico_prefs_v1')
 */
export function getStoredPreferences(): PreferenciasStorage | null {
  if (typeof window === 'undefined') {
    return null
  }
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      return {
        perfil_id:
          typeof parsed.perfil_id === 'string' ? parsed.perfil_id : DEFAULT_PREFERENCIAS.perfil_id,
        ponto_favorito_slug:
          typeof parsed.ponto_favorito_slug === 'string'
            ? parsed.ponto_favorito_slug
            : DEFAULT_PREFERENCIAS.ponto_favorito_slug,
        horario_briefing:
          typeof parsed.horario_briefing === 'string'
            ? parsed.horario_briefing
            : DEFAULT_PREFERENCIAS.horario_briefing,
        ultimo_briefing:
          parsed.ultimo_briefing && typeof parsed.ultimo_briefing === 'object'
            ? {
                texto: String(parsed.ultimo_briefing.texto || ''),
                timestamp: String(parsed.ultimo_briefing.timestamp || ''),
              }
            : typeof parsed.ultimo_briefing === 'string'
              ? { texto: parsed.ultimo_briefing, timestamp: new Date().toISOString() }
              : null,
        pontos_personalizados: sanitizePontosPersonalizados(parsed.pontos_personalizados),
      }
    }
    return null
  } catch (err) {
    console.warn('Erro ao ler preferências do localStorage:', err)
    return null
  }
}

/**
 * Salva ou atualiza as preferências no localStorage
 */
export function setStoredPreferences(prefs: Partial<PreferenciasStorage>): PreferenciasStorage {
  const current = getStoredPreferences() || DEFAULT_PREFERENCIAS
  const updated: PreferenciasStorage = {
    ...current,
    ...prefs,
    ultimo_briefing:
      prefs.ultimo_briefing !== undefined ? prefs.ultimo_briefing : current.ultimo_briefing,
    pontos_personalizados:
      prefs.pontos_personalizados !== undefined
        ? sanitizePontosPersonalizados(prefs.pontos_personalizados)
        : current.pontos_personalizados || [],
  }

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(updated))
    } catch (err) {
      console.warn('Erro ao salvar preferências no localStorage:', err)
    }
  }

  return updated
}

/**
 * Funções CRUD para Pontos Personalizados
 */

export function getPontosPersonalizados(): PontoPersonalizado[] {
  const prefs = getStoredPreferences()
  return prefs?.pontos_personalizados || []
}

export function addPontoPersonalizado(
  ponto: Omit<PontoPersonalizado, 'id' | 'criado_em'> & { id?: string; criado_em?: string },
): { success: boolean; ponto?: PontoPersonalizado; error?: string } {
  const currentPontos = getPontosPersonalizados()
  if (currentPontos.length >= MAX_PONTOS_PERSONALIZADOS) {
    return { success: false, error: `Máximo de ${MAX_PONTOS_PERSONALIZADOS} pontos atingido` }
  }

  const newId =
    ponto.id ||
    (typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `custom-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`)

  const novoPonto: PontoPersonalizado = {
    id: newId,
    nome: ponto.nome.trim(),
    lat: Number(ponto.lat),
    lon: Number(ponto.lon),
    tipo: ponto.tipo,
    criado_em: ponto.criado_em || new Date().toISOString(),
  }

  const updatedList = [...currentPontos, novoPonto]
  setStoredPreferences({ pontos_personalizados: updatedList })
  return { success: true, ponto: novoPonto }
}

export function updatePontoPersonalizado(
  id: string,
  dados: Partial<Omit<PontoPersonalizado, 'id' | 'criado_em'>>,
): { success: boolean; ponto?: PontoPersonalizado; error?: string } {
  const currentPontos = getPontosPersonalizados()
  const index = currentPontos.findIndex((p) => p.id === id)
  if (index === -1) {
    return { success: false, error: 'Ponto não encontrado' }
  }

  const updated: PontoPersonalizado = {
    ...currentPontos[index],
    ...(dados.nome !== undefined ? { nome: dados.nome.trim() } : {}),
    ...(dados.lat !== undefined ? { lat: Number(dados.lat) } : {}),
    ...(dados.lon !== undefined ? { lon: Number(dados.lon) } : {}),
    ...(dados.tipo !== undefined ? { tipo: dados.tipo } : {}),
  }

  const updatedList = [...currentPontos]
  updatedList[index] = updated
  setStoredPreferences({ pontos_personalizados: updatedList })
  return { success: true, ponto: updated }
}

export function deletePontoPersonalizado(id: string): boolean {
  const currentPontos = getPontosPersonalizados()
  const filtered = currentPontos.filter((p) => p.id !== id)
  if (filtered.length === currentPontos.length) {
    return false
  }
  setStoredPreferences({ pontos_personalizados: filtered })
  return true
}

/**
 * Inicialização com migração automática
 */
export async function inicializarPreferencias(deviceId: string): Promise<PreferenciasStorage> {
  const existing = getStoredPreferences()
  if (existing) {
    return existing
  }

  // Primeira execução no dispositivo: tenta migrar registro antigo do PocketBase se disponível
  try {
    const record = await pb.collection('preferencias').getFirstListItem<{
      perfil_id?: string
      ponto_favorito_id?: string
      horario_briefing?: string
      ultimo_briefing?: string
      created?: string
      updated?: string
    }>(`dispositivo_uuid="${deviceId}"`)

    if (record) {
      const migrated: PreferenciasStorage = {
        perfil_id: record.perfil_id || DEFAULT_PREFERENCIAS.perfil_id,
        ponto_favorito_slug: record.ponto_favorito_id || DEFAULT_PREFERENCIAS.ponto_favorito_slug,
        horario_briefing: record.horario_briefing || DEFAULT_PREFERENCIAS.horario_briefing,
        ultimo_briefing: record.ultimo_briefing
          ? {
              texto: record.ultimo_briefing,
              timestamp: record.updated || record.created || new Date().toISOString(),
            }
          : null,
        pontos_personalizados: [],
      }
      setStoredPreferences(migrated)
      return migrated
    }
  } catch {
    // Collection bloqueada ou registro não encontrado — comportamento esperado
  }

  // Fallback padrão se não houver migração
  return setStoredPreferences(DEFAULT_PREFERENCIAS)
}
