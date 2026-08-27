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
  const { inicializarPreferencias } = await import('@/lib/preferencesStorage')
  const prefs = await inicializarPreferencias(deviceId)
  return {
    dispositivo_uuid: deviceId,
    perfil_id: prefs.perfil_id,
    ponto_favorito_id: prefs.ponto_favorito_slug,
    ponto_favorito_slug: prefs.ponto_favorito_slug,
    horario_briefing: prefs.horario_briefing,
    ultimo_briefing: prefs.ultimo_briefing?.texto,
    updated: prefs.ultimo_briefing?.timestamp,
  }
}

export async function salvarPreferenciasDispositivo(
  deviceId: string,
  perfilId: string,
  pontoFavoritoId?: string,
): Promise<PreferenciasUsuario> {
  const { setStoredPreferences } = await import('@/lib/preferencesStorage')
  const updated = setStoredPreferences({
    perfil_id: perfilId,
    ...(pontoFavoritoId ? { ponto_favorito_slug: pontoFavoritoId } : {}),
  })
  return {
    dispositivo_uuid: deviceId,
    perfil_id: updated.perfil_id,
    ponto_favorito_id: updated.ponto_favorito_slug,
    ponto_favorito_slug: updated.ponto_favorito_slug,
    horario_briefing: updated.horario_briefing,
    ultimo_briefing: updated.ultimo_briefing?.texto,
    updated: updated.ultimo_briefing?.timestamp,
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

export async function enviarBriefingEmail(
  destinatario: string,
  briefing: string,
  data?: string,
): Promise<{ success: boolean; message: string }> {
  const backendUrl = pb.baseUrl || ''
  const url = `${backendUrl}/backend/v1/enviar-briefing`

  const dataFormatada = data || new Date().toLocaleDateString('pt-BR')

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      destinatario,
      briefing,
      data: dataFormatada,
    }),
  })

  if (!res.ok) {
    let errorDetail = 'Falha ao enviar e-mail'
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

  const result: { success: boolean; message: string } = await res.json()
  return result
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
 * Converte nós de vento para escala Beaufort (0-12)
 * 0-1kt=0, 1-3kt=1, 4-6kt=2, 7-10kt=3, 11-16kt=4, 17-21kt=5, 22-27kt=6, 28-33kt=7, 34-40kt=8, 41-47kt=9, 48-55kt=10, 56-63kt=11, 64+kt=12
 */
export function getBeaufortScale(windKt: number | null | undefined): number {
  if (windKt === null || windKt === undefined || isNaN(windKt)) return 0
  const w = Number(windKt)
  if (w < 1) return 0
  if (w <= 3) return 1
  if (w <= 6) return 2
  if (w <= 10) return 3
  if (w <= 16) return 4
  if (w <= 21) return 5
  if (w <= 27) return 6
  if (w <= 33) return 7
  if (w <= 40) return 8
  if (w <= 47) return 9
  if (w <= 55) return 10
  if (w <= 63) return 11
  return 12
}

/**
 * Converte metros de onda para escala Douglas (0-9)
 * 0m=0, 0-0.1m=1, 0.1-0.5m=2, 0.5-1.25m=3, 1.25-2.5m=4, 2.5-4m=5, 4-6m=6, 6-9m=7, 9-14m=8, 14+m=9
 */
export function getDouglasScale(waveM: number | null | undefined): {
  grau: number
  descricao: string
} {
  if (waveM === null || waveM === undefined || isNaN(waveM))
    return { grau: 0, descricao: 'Calmo (espelhado)' }
  const h = Number(waveM)
  if (h === 0) return { grau: 0, descricao: 'Calmo (espelhado)' }
  if (h <= 0.1) return { grau: 1, descricao: 'Calmo (ondulado)' }
  if (h <= 0.5) return { grau: 2, descricao: 'Cavado suave' }
  if (h <= 1.25) return { grau: 3, descricao: 'Levemente cavado' }
  if (h <= 2.5) return { grau: 4, descricao: 'Moderado' }
  if (h <= 4.0) return { grau: 5, descricao: 'Grosso' }
  if (h <= 6.0) return { grau: 6, descricao: 'Muito grosso' }
  if (h <= 9.0) return { grau: 7, descricao: 'Alto' }
  if (h <= 14.0) return { grau: 8, descricao: 'Muito alto' }
  return { grau: 9, descricao: 'Fenomenal' }
}

/**
 * Formata coordenadas em graus e minutos decimais: 23°00.30'S 044°19.08'W
 */
export function formatCoordinatesDMM(lat: number, lon: number): string {
  const latHemi = lat >= 0 ? 'N' : 'S'
  const lonHemi = lon >= 0 ? 'E' : 'W'

  const absLat = Math.abs(lat)
  const latDeg = Math.floor(absLat)
  const latMin = (absLat - latDeg) * 60
  const latMinStr = latMin.toFixed(2).padStart(5, '0')
  const latDegStr = String(latDeg).padStart(2, '0')

  const absLon = Math.abs(lon)
  const lonDeg = Math.floor(absLon)
  const lonMin = (absLon - lonDeg) * 60
  const lonMinStr = lonMin.toFixed(2).padStart(5, '0')
  const lonDegStr = String(lonDeg).padStart(3, '0')

  return `${latDegStr}°${latMinStr}'${latHemi} ${lonDegStr}°${lonMinStr}'${lonHemi}`
}

/**
 * Formata duração em segundos para string legível: "11h 45min"
 */
export function formatDaylightDuration(seconds: number | null | undefined): string {
  if (!seconds || isNaN(seconds)) return '--'
  const totalMin = Math.round(seconds / 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h}h ${String(m).padStart(2, '0')}min`
}

/**
 * Formata string ISO para HH:MM
 */
export function formatTimeHHMM(isoString: string | null | undefined): string {
  if (!isoString) return '--:--'
  try {
    const d = new Date(isoString)
    return d.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
  } catch {
    return isoString.slice(11, 16) || '--:--'
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
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16
  return dirs[index]
}

/**
 * Lista dos 4 pontos canônicos de navegação
 */
export const PONTOS_DISPONIVEIS: Array<{
  slug: string
  nomeCurto: string
  nomeCompleto: string
  lat: number
  lon: number
  tipo: 'abrigado' | 'semi' | 'aberto'
}> = [
  {
    slug: 'angra',
    nomeCurto: 'Angra dos Reis',
    nomeCompleto: 'Angra dos Reis',
    lat: -23.0067,
    lon: -44.318,
    tipo: 'abrigado',
  },
  {
    slug: 'abraao',
    nomeCurto: 'Abraão',
    nomeCompleto: 'Vila do Abraão (Ilha Grande)',
    lat: -23.1415,
    lon: -44.1676,
    tipo: 'semi',
  },
  {
    slug: 'paraty',
    nomeCurto: 'Paraty',
    nomeCompleto: 'Paraty',
    lat: -23.2178,
    lon: -44.7131,
    tipo: 'abrigado',
  },
  {
    slug: 'juatinga',
    nomeCurto: 'Juatinga',
    nomeCompleto: 'Ponta da Juatinga',
    lat: -23.2833,
    lon: -44.5833,
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
      ventoMaxBeaufort: maxVento !== null ? getBeaufortScale(maxVento) : 0,
      ondaMax: maxOnda !== null ? Math.round(maxOnda * 100) / 100 : null,
      ondaMaxDouglas: maxOnda !== null ? getDouglasScale(maxOnda).grau : 0,
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
