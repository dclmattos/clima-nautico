import pb from '@/lib/pocketbase/client'
import {
  Ponto,
  PerfilNavegacao,
  PrevisaoPayload,
  PrevisaoHoraItem,
  ResumoDiaItem,
  JanelasPayload,
  PreferenciasUsuario,
} from '@/types/nautico'

export async function fetchPerfis(): Promise<PerfilNavegacao[]> {
  try {
    const records = await pb.collection('perfis_navegacao').getFullList<PerfilNavegacao>({
      sort: 'created',
    })
    return records
  } catch (err: any) {
    console.error('Erro ao buscar perfis_navegacao do PocketBase:', err)
    return [
      {
        id: 'lancha',
        nome: 'lancha',
        vento_max_kt: 15,
        rajada_max_kt: 22,
        onda_max_m: 1.0,
        periodo_min_s: null,
        chuva_max_mm_h: 4,
      },
      {
        id: 'veleiro',
        nome: 'veleiro',
        vento_max_kt: 22,
        rajada_max_kt: 28,
        onda_max_m: 1.5,
        periodo_min_s: 6,
        chuva_max_mm_h: 6,
      },
      {
        id: 'jet',
        nome: 'jet',
        vento_max_kt: 12,
        rajada_max_kt: 18,
        onda_max_m: 0.6,
        periodo_min_s: null,
        chuva_max_mm_h: 2,
      },
    ]
  }
}

export async function fetchPreferenciasPorDispositivo(
  deviceId: string,
): Promise<PreferenciasUsuario | null> {
  try {
    const record = await pb
      .collection('preferencias')
      .getFirstListItem<PreferenciasUsuario>(`dispositivo_uuid="${deviceId}"`)
    return record
  } catch {
    return null
  }
}

export async function salvarPreferenciasDispositivo(
  deviceId: string,
  perfilId: string,
  pontoFavoritoId?: string,
): Promise<PreferenciasUsuario> {
  try {
    const existing = await fetchPreferenciasPorDispositivo(deviceId)
    if (existing && existing.id) {
      const updated = await pb.collection('preferencias').update<PreferenciasUsuario>(existing.id, {
        perfil_id: perfilId,
        ...(pontoFavoritoId ? { ponto_favorito_id: pontoFavoritoId } : {}),
      })
      return updated
    } else {
      const created = await pb.collection('preferencias').create<PreferenciasUsuario>({
        dispositivo_uuid: deviceId,
        perfil_id: perfilId,
        ...(pontoFavoritoId ? { ponto_favorito_id: pontoFavoritoId } : {}),
        criado_em: new Date().toISOString(),
      })
      return created
    }
  } catch (err: any) {
    console.warn('Falha ao salvar preferencias no PocketBase, mantendo em memória/local:', err)
    return {
      dispositivo_uuid: deviceId,
      perfil_id: perfilId,
      ponto_favorito_id: pontoFavoritoId,
    }
  }
}

export async function fetchPontos(): Promise<Ponto[]> {
  try {
    const records = await pb.collection('pontos').getFullList<Ponto>({
      sort: 'created',
    })
    return records
  } catch (err: any) {
    console.error('Erro ao buscar pontos do PocketBase:', err)
    throw new Error(err?.message || 'Falha ao carregar lista de pontos')
  }
}

export async function fetchPrevisaoPorPonto(pontoId: string): Promise<PrevisaoPayload> {
  const backendUrl = pb.baseUrl || ''
  const url = `${backendUrl}/backend/v1/previsao?ponto_id=${encodeURIComponent(pontoId)}`

  const res = await fetch(url)
  if (!res.ok) {
    let errorDetail = 'Falha ao obter previsão'
    try {
      const errJson = await res.json()
      if (errJson?.error) {
        errorDetail = errJson.error
      }
    } catch {
      errorDetail = `Erro no servidor (${res.status})`
    }
    throw new Error(errorDetail)
  }

  const data: PrevisaoPayload = await res.json()
  return data
}

export async function fetchJanelas(pontoId: string, perfilId: string): Promise<JanelasPayload> {
  const backendUrl = pb.baseUrl || ''
  const url = `${backendUrl}/backend/v1/janelas?ponto_id=${encodeURIComponent(
    pontoId,
  )}&perfil_id=${encodeURIComponent(perfilId)}`

  const res = await fetch(url)
  if (!res.ok) {
    let errorDetail = 'Falha ao obter janelas de navegação'
    try {
      const errJson = await res.json()
      if (errJson?.error) {
        errorDetail = errJson.error
      }
    } catch {
      errorDetail = `Erro no servidor (${res.status})`
    }
    throw new Error(errorDetail)
  }

  const data: JanelasPayload = await res.json()
  return data
}

export async function fetchBriefingComandante(
  perfilId: string,
  dispositivoUuid?: string,
): Promise<{ texto: string; gerado_em: string }> {
  const backendUrl = pb.baseUrl || ''
  let url = `${backendUrl}/backend/v1/briefing?perfil_id=${encodeURIComponent(perfilId)}`
  if (dispositivoUuid) {
    url += `&dispositivo_uuid=${encodeURIComponent(dispositivoUuid)}`
  }

  const res = await fetch(url)
  if (!res.ok) {
    let errorDetail = 'Não foi possível gerar o briefing'
    try {
      const errJson = await res.json()
      if (errJson?.error) {
        errorDetail = errJson.error
      }
    } catch {
      errorDetail = `Erro no servidor (${res.status})`
    }
    throw new Error(errorDetail)
  }

  const data: { texto: string; gerado_em: string } = await res.json()
  return data
}

/**
 * Encontra a próxima janela disponível (no futuro ou em andamento)
 */
export function getProximaJanela(
  janelas: JanelasPayload['janelas'],
): JanelasPayload['janelas'][0] | null {
  if (!janelas || janelas.length === 0) return null
  const now = new Date()
  const nowTime = now.getTime()

  // Encontra a primeira janela cujo término é após agora
  for (const j of janelas) {
    const fimDate = new Date(j.fim).getTime()
    if (fimDate >= nowTime - 3600000) {
      return j
    }
  }
  return janelas[0] || null
}

/**
 * Formata exibição da janela: "Sáb 09h – 14h"
 */
export function formatarJanelaBadge(inicioIso: string, fimIso: string): string {
  try {
    const inicio = new Date(inicioIso)
    const fim = new Date(fimIso)

    const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const diaSemana = dias[inicio.getDay()]
    const horaInicio = String(inicio.getHours()).padStart(2, '0') + 'h'
    const horaFim = String(fim.getHours()).padStart(2, '0') + 'h'

    return `${diaSemana} ${horaInicio}–${horaFim}`
  } catch {
    return `${inicioIso.slice(11, 16)}–${fimIso.slice(11, 16)}`
  }
}

/**
 * Encontra o item de previsão da hora atual mais próximo
 */
export function getCurrentHourForecast(hourly: PrevisaoHoraItem[]): PrevisaoHoraItem | null {
  if (!hourly || hourly.length === 0) return null

  // Obter hora atual local (UTC-3 / America/Sao_Paulo)
  const now = new Date()

  // Format local YYYY-MM-DDTHH
  const nowYear = now.getFullYear()
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0')
  const nowDate = String(now.getDate()).padStart(2, '0')
  const nowHours = String(now.getHours()).padStart(2, '0')
  const targetPrefix = `${nowYear}-${nowMonth}-${nowDate}T${nowHours}:00`

  // Busca exata pela hora
  const exact = hourly.find((item) => item.time.startsWith(targetPrefix))
  if (exact) return exact

  // Se não encontrou exato (ex: virada de dia ou fuso), encontra a hora com menor diferença temporal absoluta
  const nowMs = now.getTime()
  let closestItem: PrevisaoHoraItem = hourly[0]
  let minDiff = Infinity

  for (const item of hourly) {
    const itemDate = new Date(item.time)
    const diff = Math.abs(itemDate.getTime() - nowMs)
    if (diff < minDiff) {
      minDiff = diff
      closestItem = item
    }
  }

  return closestItem
}

/**
 * Semáforo simplificado:
 * verde se vento ≤ 10kt e onda ≤ 0.5m
 * amarelo se vento ≤ 20kt e onda ≤ 1.5m
 * vermelho se acima
 */
export function calculateSemaforo(
  current: PrevisaoHoraItem | null,
): 'verde' | 'amarelo' | 'vermelho' {
  if (!current) return 'verde'

  const vento = current.wind_speed_10m ?? 0
  const onda = current.wave_height ?? 0

  if (vento <= 10 && onda <= 0.5) {
    return 'verde'
  }
  if (vento <= 20 && onda <= 1.5) {
    return 'amarelo'
  }
  return 'vermelho'
}

/**
 * Converte graus de direção em rótulo cardinal (N, NE, E, SE, S, SW, W, NW)
 */
export function getWindDirectionLabel(degrees: number | null | undefined): string {
  if (degrees === null || degrees === undefined) return '--'
  const dirs = [
    'N',
    'NNE',
    'NE',
    'ENE',
    'E',
    'ESE',
    'SE',
    'SSE',
    'S',
    'SSW',
    'SW',
    'WSW',
    'W',
    'WNW',
    'NW',
    'NNW',
  ]
  const index = Math.round((degrees % 360) / 22.5) % 16
  return dirs[index]
}

/**
 * Lista dos 4 pontos canônicos de navegação
 */
export const PONTOS_DISPONIVEIS: Array<{
  slug: string
  nomeCurto: string
  nomeCompleto: string
  tipo: 'abrigado' | 'semi' | 'aberto'
}> = [
  {
    slug: 'angra',
    nomeCurto: 'Angra dos Reis',
    nomeCompleto: 'Angra dos Reis',
    tipo: 'abrigado',
  },
  {
    slug: 'abraao',
    nomeCurto: 'Abraão',
    nomeCompleto: 'Vila do Abraão (Ilha Grande)',
    tipo: 'semi',
  },
  {
    slug: 'paraty',
    nomeCurto: 'Paraty',
    nomeCompleto: 'Paraty',
    tipo: 'abrigado',
  },
  {
    slug: 'juatinga',
    nomeCurto: 'Juatinga',
    nomeCompleto: 'Ponta da Juatinga',
    tipo: 'aberto',
  },
]

/**
 * Formata nome de exibição do ponto
 */
export function formatPontoNome(nome: string): string {
  const map: Record<string, string> = {
    angra: 'Angra dos Reis',
    abraao: 'Abraão',
    paraty: 'Paraty',
    juatinga: 'Juatinga',
  }
  return map[nome.toLowerCase()] || nome.charAt(0).toUpperCase() + nome.slice(1)
}

/**
 * Retorna os dados das próximas 48 horas a partir da hora atual mais próxima
 */
export function getNext48HoursForecast(hourly: PrevisaoHoraItem[]): {
  items: PrevisaoHoraItem[]
  currentHourIndex: number
} {
  if (!hourly || hourly.length === 0) {
    return { items: [], currentHourIndex: -1 }
  }

  const current = getCurrentHourForecast(hourly)
  let startIndex = 0

  if (current) {
    const idx = hourly.findIndex((item) => item.time === current.time)
    if (idx !== -1) {
      startIndex = idx
    }
  }

  // Pegamos até 48 horas a partir do startIndex
  const items = hourly.slice(startIndex, startIndex + 48)

  return {
    items,
    currentHourIndex: 0, // Como começa na hora atual, o índice 0 é a hora atual
  }
}

/**
 * Agrupa os dados horários em 7 dias diários (hoje + 6 dias)
 */
export function aggregate7DaysForecast(hourly: PrevisaoHoraItem[]): ResumoDiaItem[] {
  if (!hourly || hourly.length === 0) return []

  const diasSemanaMap: Record<number, string> = {
    0: 'Dom',
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sáb',
  }

  // Agrupar por data (YYYY-MM-DD)
  const grupos: Record<string, PrevisaoHoraItem[]> = {}
  for (const item of hourly) {
    const dateKey = item.time.slice(0, 10)
    if (!grupos[dateKey]) {
      grupos[dateKey] = []
    }
    grupos[dateKey].push(item)
  }

  const sortedDates = Object.keys(grupos).sort()
  const now = new Date()
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  // Encontra ou filtra a partir de hoje (ou primeiras datas se hoje for anterior)
  let validDates = sortedDates.filter((d) => d >= todayKey)
  if (validDates.length === 0) {
    validDates = sortedDates
  }

  // Pega no máximo 7 dias
  const targetDates = validDates.slice(0, 7)

  return targetDates.map((dateStr, idx) => {
    const items = grupos[dateStr] || []
    const isHoje = idx === 0 || dateStr === todayKey

    // Criar objeto Date para obter dia da semana e formatar
    const [year, month, day] = dateStr.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const nomeDia = isHoje ? 'Hoje' : diasSemanaMap[dateObj.getDay()] || ''
    const dataExibicao = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`

    let maxVento: number | null = null
    let maxOnda: number | null = null
    let totalChuva = 0

    for (const it of items) {
      if (it.wind_speed_10m !== null) {
        if (maxVento === null || it.wind_speed_10m > maxVento) {
          maxVento = it.wind_speed_10m
        }
      }
      if (it.wave_height !== null) {
        if (maxOnda === null || it.wave_height > maxOnda) {
          maxOnda = it.wave_height
        }
      }
      if (it.precipitation !== null && it.precipitation > 0) {
        totalChuva += it.precipitation
      }
    }

    return {
      dataIso: dateStr,
      nomeDia,
      dataExibicao,
      isHoje,
      ventoMax: maxVento !== null ? Math.round(maxVento * 10) / 10 : null,
      ondaMax: maxOnda !== null ? Math.round(maxOnda * 100) / 100 : null,
      chuvaTotal: Math.round(totalChuva * 10) / 10,
    }
  })
}

/**
 * Formata badge do tipo
 */
export function formatTipoPonto(tipo: string): string {
  const map: Record<string, string> = {
    abrigado: 'Abrigado',
    semi: 'Semi-abrigado',
    aberto: 'Aberto',
  }
  return map[tipo] || tipo
}
