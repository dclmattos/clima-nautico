import pb from '@/lib/pocketbase/client'
import { PreferenciasStorage } from '@/types/nautico'

export const PREFS_STORAGE_KEY = 'clima_nautico_prefs_v1'

export const DEFAULT_PREFERENCIAS: PreferenciasStorage = {
  perfil_id: 'lancha',
  ponto_favorito_slug: 'angra',
  horario_briefing: '07:00',
  ultimo_briefing: null,
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
 * Inicialização com migração automática:
 * Se 'clima_nautico_prefs_v1' não existir no localStorage, tenta buscar uma vez o registro antigo
 * na collection 'preferencias' (se ainda acessível/migrável) pelo deviceId.
 * Se encontrar, migra os dados e salva na chave v1.
 * Se não encontrar ou falhar, grava os defaults.
 * NUNCA mais chama a collection 'preferencias' após essa chave existir.
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
