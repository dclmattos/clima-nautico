import pb from '@/lib/pocketbase/client'
import { getPontosPersonalizados } from '@/lib/preferencesStorage'
import {
  Ponto,
  PerfilNavegacao,
  PrevisaoPayload,
  PrevisaoHoraItem,
  ResumoDiaItem,
  JanelasPayload,
  PreferenciasUsuario,
  PontoPersonalizado,
  TipoPonto,
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

/**
 * Normaliza tipo de ponto personalizado para o tipo do backend (abrigado/semi/aberto)
 */
export function normalizarTipoParaBackend(tipo: string): TipoPonto {
  const t = tipo.toLowerCase().trim()
  if (t === 'semi' || t === 'semi-abrigado') return 'semi'
  if (t === 'aberto' || t === 'mar aberto' || t === 'mar-aberto') return 'aberto'
  return 'abrigado'
}

/**
 * Busca previsão de um ponto fixo ou personalizado
 */
export async function fetchPrevisaoPorPonto(
  pontoId: string,
  customCoords?: { lat: number; lon: number; tipo: string; nome?: string },
): Promise<PrevisaoPayload> {
  const backendUrl = pb.baseUrl || ''
  let url = ''

  if (customCoords) {
    const tipoNorm = normalizarTipoParaBackend(customCoords.tipo)
    url = `${backendUrl}/backend/v1/previsao?lat=${encodeURIComponent(
      customCoords.lat,
    )}&lon=${encodeURIComponent(customCoords.lon)}&tipo=${encodeURIComponent(tipoNorm)}&nome=${encodeURIComponent(
      customCoords.nome || '',
    )}`
  } else {
    url = `${backendUrl}/backend/v1/previsao?ponto_id=${encodeURIComponent(pontoId)}`
  }

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
  if (data?.hourly && Array.isArray(data.hourly)) {
    const missingCount = data.hourly.filter(
      (h) => h.weather_code === null || h.weather_code === undefined,
    ).length
    if (missingCount > 0) {
      console.warn(
        `[previsaoService] ${missingCount} itens de hourly possuem weather_code ausente/nulo para o ponto:`,
        pontoId || customCoords?.nome || 'coordenadas',
      )
    }
  }
  return data
}

/**
 * Busca janelas ideais de navegação para um ponto fixo ou personalizado
 */
export async function fetchJanelas(
  pontoId: string,
  perfilId: string,
  customCoords?: { lat: number; lon: number; tipo: string; nome?: string },
): Promise<JanelasPayload> {
  const backendUrl = pb.baseUrl || ''
  let url = ''

  if (customCoords) {
    const tipoNorm = normalizarTipoParaBackend(customCoords.tipo)
    url = `${backendUrl}/backend/v1/janelas?lat=${encodeURIComponent(
      customCoords.lat,
    )}&lon=${encodeURIComponent(customCoords.lon)}&tipo=${encodeURIComponent(
      tipoNorm,
    )}&perfil_id=${encodeURIComponent(perfilId)}&nome=${encodeURIComponent(customCoords.nome || '')}`
  } else {
    url = `${backendUrl}/backend/v1/janelas?ponto_id=${encodeURIComponent(
      pontoId,
    )}&perfil_id=${encodeURIComponent(perfilId)}`
  }

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

/**
 * Busca previsão usando coordenadas geográficas diretamente
 */
export async function buscarPrevisaoPorCoordenadas(
  lat: number,
  lon: number,
  tipo: string = 'abrigado',
  nome: string = 'Ponto Personalizado',
): Promise<PrevisaoPayload> {
  return fetchPrevisaoPorPonto('', {
    lat,
    lon,
    tipo,
    nome,
  })
}

/**
 * Busca janelas ideais de navegação usando coordenadas geográficas diretamente
 */
export async function buscarJanelasPorCoordenadas(
  lat: number,
  lon: number,
  tipo: string = 'abrigado',
  perfilId: string = 'lancha',
  nome: string = 'Ponto Personalizado',
): Promise<JanelasPayload> {
  return fetchJanelas('', perfilId, {
    lat,
    lon,
    tipo,
    nome,
  })
}

export async function fetchBriefingComandante(
  perfilId: string,
  dispositivoUuid?: string,
  pontosPersonalizados?: Array<{ lat: number; lon: number; tipo: string; nome: string }>,
): Promise<{ texto: string; gerado_em: string }> {
  const backendUrl = pb.baseUrl || ''
  let url = `${backendUrl}/backend/v1/briefing?perfil_id=${encodeURIComponent(perfilId)}`
  if (dispositivoUuid) {
    url += `&dispositivo_uuid=${encodeURIComponent(dispositivoUuid)}`
  }
  if (pontosPersonalizados && pontosPersonalizados.length > 0) {
    url += `&pontos_custom=${encodeURIComponent(JSON.stringify(pontosPersonalizados))}`
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
 * Consulta cálculo e previsão para travessia entre dois pontos
 */
export async function fetchCalculoTravessia(
  params: import('@/types/nautico').TravessiaParams,
): Promise<import('@/types/nautico').TravessiaResultado> {
  const backendUrl = pb.baseUrl || ''
  const queryParams = new URLSearchParams()

  // Se a origem for personalizada
  if (params.origemCustom) {
    queryParams.set('origem_lat', String(params.origemCustom.lat))
    queryParams.set('origem_lon', String(params.origemCustom.lon))
    queryParams.set(
      'origem_tipo',
      normalizarTipoParaBackend(params.origemCustom.tipo || 'abrigado'),
    )
    if (params.origemCustom.nome) {
      queryParams.set('origem_nome', params.origemCustom.nome)
    }
    queryParams.set(
      'origem',
      params.origem ||
        `custom:${params.origemCustom.lat.toFixed(3)}:${params.origemCustom.lon.toFixed(3)}`,
    )
  } else {
    queryParams.set('origem', params.origem)
  }

  // Se o destino for personalizado
  if (params.destinoCustom) {
    queryParams.set('destino_lat', String(params.destinoCustom.lat))
    queryParams.set('destino_lon', String(params.destinoCustom.lon))
    queryParams.set(
      'destino_tipo',
      normalizarTipoParaBackend(params.destinoCustom.tipo || 'abrigado'),
    )
    if (params.destinoCustom.nome) {
      queryParams.set('destino_nome', params.destinoCustom.nome)
    }
    queryParams.set(
      'destino',
      params.destino ||
        `custom:${params.destinoCustom.lat.toFixed(3)}:${params.destinoCustom.lon.toFixed(3)}`,
    )
  } else {
    queryParams.set('destino', params.destino)
  }

  queryParams.set('hora_saida', params.hora_saida)
  if (params.velocidade_nos) {
    queryParams.set('velocidade_nos', String(params.velocidade_nos))
  }
  if (params.perfil_id) {
    queryParams.set('perfil_id', params.perfil_id)
  }
  if (params.consumo_lh !== undefined && params.consumo_lh !== null && params.consumo_lh > 0) {
    queryParams.set('consumo_lh', String(params.consumo_lh))
  }
  if (params.dispositivo_uuid) {
    queryParams.set('dispositivo_uuid', params.dispositivo_uuid)
  }

  const url = `${backendUrl}/backend/v1/travessia?${queryParams.toString()}`

  const res = await fetch(url, {
    headers: {
      ...(params.dispositivo_uuid ? { 'X-Device-Id': params.dispositivo_uuid } : {}),
    },
  })

  if (!res.ok) {
    let errorDetail = 'Não foi possível calcular a travessia'
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

  const data: import('@/types/nautico').TravessiaResultado = await res.json()
  return data
}

/**
 * Solicita resumo consolidado do dia
 */
export async function fetchResumoDia(
  perfilId: string,
  dispositivoUuid?: string,
  pontosPersonalizados?: Array<{
    id: string
    nome: string
    lat: number
    lon: number
    tipo: string
  }>,
): Promise<import('@/types/nautico').ResumoDiaResultado> {
  const backendUrl = pb.baseUrl || ''
  const queryParams = new URLSearchParams()
  queryParams.set('perfil_id', perfilId)
  if (dispositivoUuid) {
    queryParams.set('dispositivo_uuid', dispositivoUuid)
  }
  if (pontosPersonalizados && pontosPersonalizados.length > 0) {
    queryParams.set('pontos_personalizados', JSON.stringify(pontosPersonalizados))
  }

  const url = `${backendUrl}/backend/v1/resumo-dia?${queryParams.toString()}`
  const res = await fetch(url)
  if (!res.ok) {
    let errorDetail = 'Falha ao obter resumo do dia'
    try {
      const errJson = await res.json()
      if (errJson?.erro || errJson?.error) {
        errorDetail = errJson.erro || errJson.error
      }
    } catch {
      errorDetail = `Erro no servidor (${res.status})`
    }
    throw new Error(errorDetail)
  }

  const data: import('@/types/nautico').ResumoDiaResultado = await res.json()
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
 * Helper interno para validar latitude e longitude
 */
function isValidLatLng(lat: number, lon: number): boolean {
  return !isNaN(lat) && !isNaN(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
}

/**
 * Parser de graus, minutos e segundos (DMS ou DMM) para decimal
 */
function parseDmsOrDmmToken(
  degStr: string,
  minStr?: string,
  secStr?: string,
  hemiStr?: string,
): number | null {
  const deg = parseFloat(degStr)
  if (isNaN(deg)) return null
  const min = minStr ? parseFloat(minStr) : 0
  const sec = secStr ? parseFloat(secStr) : 0

  let dec = deg + min / 60 + sec / 3600
  if (hemiStr) {
    const h = hemiStr.toUpperCase()
    if (h === 'S' || h === 'W' || h === 'O') {
      dec = -Math.abs(dec)
    } else if (h === 'N' || h === 'E' || h === 'L') {
      dec = Math.abs(dec)
    }
  }
  return dec
}

/**
 * Parser tolerante de coordenadas
 * Suporta:
 * - Decimal: `-23.0083, -44.3183`, `-23.0083 -44.3183`, `(-23.0083, -44.3183)`
 * - Graus-minutos: `23°00.50'S 044°19.10'W`, `23 00.50 S 044 19.10 W`
 * - Graus-minutos-segundos: `23°00'30"S 044°19'06"W`, `23°00'30.0"S+44°19'06.0"W`
 * - Separadores: vírgula, ponto e vírgula ou espaço entre lat e lon
 * - Parênteses e aspas limpas
 * - Hemisfério por letra (N/S, E/W/O) ou por sinal (- para S ou W)
 * - Links do Google Maps: https://www.google.com/maps/place/... ou ?q=-23.0083,-44.3183 ou @-23.0083,-44.3183
 */
export function parseCoordinatesInput(input: string): { lat: number; lon: number } | null {
  if (!input) return null
  let raw = decodeURIComponent(input.trim())

  // Se for ou contiver um link do Google Maps / Apple Maps / OpenStreetMap
  if (
    raw.includes('maps.google') ||
    raw.includes('google.com/maps') ||
    raw.includes('goo.gl/maps') ||
    raw.includes('maps.app.goo.gl') ||
    raw.includes('openstreetmap.org')
  ) {
    // 1. Tenta extrair `@-23.0083,-44.3183`
    const atMatch = raw.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    if (atMatch) {
      const lat = parseFloat(atMatch[1])
      const lon = parseFloat(atMatch[2])
      if (isValidLatLng(lat, lon)) return { lat, lon }
    }

    // 2. Tenta extrair `q=-23.0083,-44.3183` ou `query=-23.0083,-44.3183` ou `ll=-23.0083,-44.3183`
    const qMatch = raw.match(/[?&](?:q|query|ll|center|loc)=(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/i)
    if (qMatch) {
      const lat = parseFloat(qMatch[1])
      const lon = parseFloat(qMatch[2])
      if (isValidLatLng(lat, lon)) return { lat, lon }
    }

    // 3. Tenta extrair /place/ com DMS ou Decimal: `/place/23%C2%B000'30.0%22S+44%C2%B019'06.0%22W` ou `/place/-23.0083,-44.3183`
    const placeMatch = raw.match(/\/place\/([^/@?]+)/)
    if (placeMatch) {
      const placeStr = placeMatch[1].replace(/\+/g, ' ')
      const parsedPlace = parseCoordinatesInput(placeStr)
      if (parsedPlace) return parsedPlace
    }
  }

  // Remove parênteses externos, aspas (simples ou duplas normais ou tipográficas) e colchetes
  let clean = raw
    .replace(/[()[\]{}]/g, ' ')
    .replace(/[“”"″]/g, '"')
    .replace(/[‘’'′]/g, "'")
    .replace(/\+/g, ' ')
    .trim()

  // 1. Decimal com ou sem sinal, com ou sem hemisfério
  // Ex: -23.0083, -44.3183 | -23.0083 -44.3183 | 23.0083 S, 44.3183 W | -23.0083; -44.3183
  const decimalWithHemiRegex =
    /^(-?\d{1,2}(?:\.\d+)?)\s*([NSns])?[,;\s]+(-?\d{1,3}(?:\.\d+)?)\s*([EWewOo])?$/
  const decHemiMatch = clean.match(decimalWithHemiRegex)
  if (decHemiMatch) {
    let lat = parseFloat(decHemiMatch[1])
    const latH = decHemiMatch[2]?.toUpperCase()
    let lon = parseFloat(decHemiMatch[3])
    const lonH = decHemiMatch[4]?.toUpperCase()

    if (latH === 'S') lat = -Math.abs(lat)
    else if (latH === 'N') lat = Math.abs(lat)

    if (lonH === 'W' || lonH === 'O') lon = -Math.abs(lon)
    else if (lonH === 'E' || lonH === 'L') lon = Math.abs(lon)

    if (isValidLatLng(lat, lon)) return { lat, lon }
  }

  // 2. Graus, Minutos e Segundos (DMS): ex: 23°00'30"S 044°19'06"W ou 23 00 30 S 44 19 06 W
  // Lat: (\d{1,2})[°\s]+(\d{1,2})['\s]+(\d+(?:\.\d+)?)["\s]*([NSns])
  // Lon: (\d{1,3})[°\s]+(\d{1,2})['\s]+(\d+(?:\.\d+)?)["\s]*([EWewOo])
  const dmsRegex =
    /(\d{1,2})[°\s]+(\d{1,2})['\s]+(\d+(?:\.\d+)?)["\s]*([NSns])[,;\s]+(\d{1,3})[°\s]+(\d{1,2})['\s]+(\d+(?:\.\d+)?)["\s]*([EWewOo])/i
  const dmsMatch = clean.match(dmsRegex)
  if (dmsMatch) {
    const lat = parseDmsOrDmmToken(dmsMatch[1], dmsMatch[2], dmsMatch[3], dmsMatch[4])
    const lon = parseDmsOrDmmToken(dmsMatch[5], dmsMatch[6], dmsMatch[7], dmsMatch[8])
    if (lat !== null && lon !== null && isValidLatLng(lat, lon)) {
      return { lat, lon }
    }
  }

  // 3. Graus e Minutos Decimais (DMM): ex: 23°00.50'S 044°19.10'W ou 23 00.50 S 044 19.10 W
  const dmmRegex =
    /(\d{1,2})[°\s]+(\d+(?:\.\d+)?)[′'\s]*([NSns])[,;\s]+(\d{1,3})[°\s]+(\d+(?:\.\d+)?)[′'\s]*([EWewOo])/i
  const dmmMatch = clean.match(dmmRegex)
  if (dmmMatch) {
    const lat = parseDmsOrDmmToken(dmmMatch[1], dmmMatch[2], undefined, dmmMatch[3])
    const lon = parseDmsOrDmmToken(dmmMatch[4], dmmMatch[5], undefined, dmmMatch[6])
    if (lat !== null && lon !== null && isValidLatLng(lat, lon)) {
      return { lat, lon }
    }
  }

  // 4. Formato com hemisfério no início: S 23°00'30" W 044°19'06" ou S 23 00.50 W 44 19.10
  const hemiFirstRegex =
    /([NSns])\s*(\d{1,2})[°\s]+(\d+(?:\.\d+)?)(?:['\s]+(\d+(?:\.\d+)?)["\s]*)?[,;\s]+([EWewOo])\s*(\d{1,3})[°\s]+(\d+(?:\.\d+)?)(?:['\s]+(\d+(?:\.\d+)?)["\s]*)?/i
  const hfMatch = clean.match(hemiFirstRegex)
  if (hfMatch) {
    const lat = parseDmsOrDmmToken(hfMatch[2], hfMatch[3], hfMatch[4], hfMatch[1])
    const lon = parseDmsOrDmmToken(hfMatch[6], hfMatch[7], hfMatch[8], hfMatch[5])
    if (lat !== null && lon !== null && isValidLatLng(lat, lon)) {
      return { lat, lon }
    }
  }

  // 5. Busca genérica de pares numéricos com ou sem separador
  const anyPairRegex = /(-?\d{1,2}(?:\.\d+)?)[^\d-]+(-?\d{1,3}(?:\.\d+)?)/
  const anyPairMatch = clean.match(anyPairRegex)
  if (anyPairMatch) {
    const lat = parseFloat(anyPairMatch[1])
    const lon = parseFloat(anyPairMatch[2])
    if (isValidLatLng(lat, lon)) {
      return { lat, lon }
    }
  }

  return null
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

  const now = new Date()
  const nowYear = now.getFullYear()
  const nowMonth = String(now.getMonth() + 1).padStart(2, '0')
  const nowDate = String(now.getDate()).padStart(2, '0')
  const nowHours = String(now.getHours()).padStart(2, '0')
  const targetPrefix = `${nowYear}-${nowMonth}-${nowDate}T${nowHours}:00`

  const exact = hourly.find((item) => item.time.startsWith(targetPrefix))
  if (exact) return exact

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
export function getFatorAbrigo(tipo?: string): number {
  const t = (tipo || '').trim().toLowerCase()
  if (t === 'abrigado') return 0.4
  if (t === 'semi' || t === 'semi-abrigado' || t === 'semi_abrigado') return 0.7
  return 1.0 // mar_aberto
}

/**
 * Semáforo derivado EXCLUSIVAMENTE do score:
 * verde ≥ 70, amarelo 50–69, vermelho < 50
 */
export function calculateSemaforo(
  score: number | null | undefined,
): 'verde' | 'amarelo' | 'vermelho' {
  if (score === null || score === undefined) return 'verde'
  if (score >= 70) return 'verde'
  if (score >= 50) return 'amarelo'
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

  const items = hourly.slice(startIndex, startIndex + 48)

  return {
    items,
    currentHourIndex: 0,
  }
}

/**
 * Agrupa os dados horários em 7 dias diários (hoje + 6 dias)
 * Opcionalmente aceita a lista diária para cálculo exato de nascer e pôr do sol
 */
export function aggregate7DaysForecast(
  hourly: PrevisaoHoraItem[],
  daily?: Array<{
    date: string
    sunrise: string | null
    sunset: string | null
    daylight_duration?: number | null
    temperature_2m_max?: number | null
    temperature_2m_min?: number | null
    precipitation_probability_max?: number | null
  }>,
): ResumoDiaItem[] {
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

  const sunMap: Record<
    string,
    {
      sunrise: number | null
      sunset: number | null
      tempMax: number | null
      tempMin: number | null
      precipProbMax: number | null
    }
  > = {}
  if (daily && daily.length > 0) {
    for (const d of daily) {
      sunMap[d.date] = {
        sunrise: d.sunrise ? new Date(d.sunrise).getTime() : null,
        sunset: d.sunset ? new Date(d.sunset).getTime() : null,
        tempMax:
          d.temperature_2m_max !== undefined && d.temperature_2m_max !== null
            ? d.temperature_2m_max
            : null,
        tempMin:
          d.temperature_2m_min !== undefined && d.temperature_2m_min !== null
            ? d.temperature_2m_min
            : null,
        precipProbMax:
          d.precipitation_probability_max !== undefined && d.precipitation_probability_max !== null
            ? d.precipitation_probability_max
            : null,
      }
    }
  }

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

  let validDates = sortedDates.filter((d) => d >= todayKey)
  if (validDates.length === 0) {
    validDates = sortedDates
  }

  const targetDates = validDates.slice(0, 7)

  return targetDates.map((dateStr, idx) => {
    const items = grupos[dateStr] || []
    const isHoje = idx === 0 || dateStr === todayKey

    const [year, month, day] = dateStr.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const nomeDia = isHoje ? 'Hoje' : diasSemanaMap[dateObj.getDay()] || ''
    const dataExibicao = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`

    let maxVento: number | null = null
    let maxRajada: number | null = null
    let maxOnda: number | null = null
    let totalChuva = 0
    let maxPrecipProb: number | null = null
    let minVisibilidade: number | null = null
    let maxTempHourly: number | null = null
    let minTempHourly: number | null = null

    // Determina o período diurno para o dia
    const daySun = sunMap[dateStr]
    const isDaylight = (timeStr: string) => {
      try {
        const itemTime = new Date(timeStr).getTime()
        if (daySun && daySun.sunrise && daySun.sunset) {
          return (
            itemTime >= daySun.sunrise - 30 * 60 * 1000 &&
            itemTime <= daySun.sunset + 30 * 60 * 1000
          )
        }
        const hour = new Date(timeStr).getHours()
        return hour >= 6 && hour < 18
      } catch {
        const h = parseInt(timeStr.slice(11, 13), 10)
        return h >= 6 && h < 18
      }
    }

    const diurnoItems: PrevisaoHoraItem[] = []
    let temTempestadeNoDia = false

    for (const it of items) {
      if (it.wind_speed_10m !== null) {
        if (maxVento === null || it.wind_speed_10m > maxVento) {
          maxVento = it.wind_speed_10m
        }
      }
      if (it.wind_gusts_10m !== null && it.wind_gusts_10m !== undefined) {
        if (maxRajada === null || it.wind_gusts_10m > maxRajada) {
          maxRajada = it.wind_gusts_10m
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
      if (it.precipitation_probability !== null && it.precipitation_probability !== undefined) {
        if (maxPrecipProb === null || it.precipitation_probability > maxPrecipProb) {
          maxPrecipProb = it.precipitation_probability
        }
      }
      if (it.visibility !== null && it.visibility !== undefined) {
        if (minVisibilidade === null || it.visibility < minVisibilidade) {
          minVisibilidade = it.visibility
        }
      }
      if (it.temperature_2m !== null && it.temperature_2m !== undefined) {
        if (maxTempHourly === null || it.temperature_2m > maxTempHourly) {
          maxTempHourly = it.temperature_2m
        }
        if (minTempHourly === null || it.temperature_2m < minTempHourly) {
          minTempHourly = it.temperature_2m
        }
      }

      if (it.weather_code !== null && it.weather_code !== undefined) {
        const c = Math.round(it.weather_code)
        if (c >= 95 && c <= 99) {
          temTempestadeNoDia = true
        }
      }

      if (isDaylight(it.time)) {
        diurnoItems.push(it)
      }
    }

    // Calcula weather_code predominante diurno com prioridade para tempestade (95-99)
    let weatherCodePredominante: number | null = null
    if (temTempestadeNoDia) {
      const stormItem = items.find(
        (it) =>
          it.weather_code !== null &&
          it.weather_code !== undefined &&
          Math.round(it.weather_code) >= 95 &&
          Math.round(it.weather_code) <= 99,
      )
      weatherCodePredominante = stormItem?.weather_code ?? 95
    } else {
      const targetItems = diurnoItems.length > 0 ? diurnoItems : items
      const freq: Record<number, number> = {}
      for (const it of targetItems) {
        if (it.weather_code !== null && it.weather_code !== undefined) {
          const c = Math.round(it.weather_code)
          freq[c] = (freq[c] || 0) + 1
        }
      }

      let maxCount = 0
      let mostFreqCode: number | null = null
      for (const codeStr of Object.keys(freq)) {
        const codeNum = Number(codeStr)
        if (freq[codeNum] > maxCount) {
          maxCount = freq[codeNum]
          mostFreqCode = codeNum
        }
      }
      weatherCodePredominante = mostFreqCode
    }

    const finalTempMax =
      daySun?.tempMax !== null && daySun?.tempMax !== undefined ? daySun.tempMax : maxTempHourly
    const finalTempMin =
      daySun?.tempMin !== null && daySun?.tempMin !== undefined ? daySun.tempMin : minTempHourly
    const finalPrecipProbMax =
      daySun?.precipProbMax !== null && daySun?.precipProbMax !== undefined
        ? daySun.precipProbMax
        : maxPrecipProb

    return {
      dataIso: dateStr,
      nomeDia,
      dataExibicao,
      isHoje,
      ventoMax: maxVento !== null ? Math.round(maxVento * 10) / 10 : null,
      ventoMaxBeaufort: maxVento !== null ? getBeaufortScale(maxVento) : 0,
      rajadaMax: maxRajada !== null ? Math.round(maxRajada * 10) / 10 : null,
      ondaMax: maxOnda !== null ? Math.round(maxOnda * 100) / 100 : null,
      ondaMaxDouglas: maxOnda !== null ? getDouglasScale(maxOnda).grau : 0,
      chuvaTotal: Math.round(totalChuva * 10) / 10,
      probabilidadeChuvaMax:
        finalPrecipProbMax !== null && finalPrecipProbMax !== undefined
          ? Math.round(finalPrecipProbMax)
          : null,
      visibilidadeMin: minVisibilidade !== null ? Math.round(minVisibilidade) : null,
      temperaturaMax:
        finalTempMax !== null && finalTempMax !== undefined ? Math.round(finalTempMax) : null,
      temperaturaMin:
        finalTempMin !== null && finalTempMin !== undefined ? Math.round(finalTempMin) : null,
      weatherCode: weatherCodePredominante,
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
    'semi-abrigado': 'Semi-abrigado',
    aberto: 'Mar aberto',
    'mar aberto': 'Mar aberto',
  }
  return map[tipo.toLowerCase()] || tipo
}

/**
 * Mapeamento de código WMO (0-99) para ícone Lucide, rótulo e classe de cor
 */
export function getWeatherCondition(code: number | null | undefined): {
  iconName:
    | 'Sun'
    | 'CloudSun'
    | 'Cloud'
    | 'CloudFog'
    | 'CloudDrizzle'
    | 'CloudRain'
    | 'CloudSnow'
    | 'CloudLightning'
    | 'CloudOff'
  label: string
  labelColor: string
  isStorm: boolean
} {
  if (code === null || code === undefined || isNaN(code)) {
    return {
      iconName: 'Cloud',
      label: 'Nublado',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }

  const c = Math.round(code)

  if (c === 0 || c === 1) {
    return {
      iconName: 'Sun',
      label: 'Sol',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c === 2) {
    return {
      iconName: 'CloudSun',
      label: 'Parcial',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c === 3) {
    return {
      iconName: 'Cloud',
      label: 'Nublado',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c >= 45 && c <= 48) {
    return {
      iconName: 'CloudFog',
      label: 'Névoa',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c >= 51 && c <= 67) {
    return {
      iconName: 'CloudDrizzle',
      label: 'Chuva',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c >= 71 && c <= 77) {
    return {
      iconName: 'CloudSnow',
      label: 'Neve',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c >= 80 && c <= 82) {
    return {
      iconName: 'CloudRain',
      label: 'Pancadas de chuva',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c >= 85 && c <= 86) {
    return {
      iconName: 'CloudSnow',
      label: 'Pancadas de neve',
      labelColor: 'text-zinc-400',
      isStorm: false,
    }
  }
  if (c >= 95 && c <= 99) {
    return {
      iconName: 'CloudLightning',
      label: 'Tempestade',
      labelColor: 'text-[#A78BFA]',
      isStorm: true,
    }
  }

  return {
    iconName: 'Cloud',
    label: 'Nublado',
    labelColor: 'text-zinc-400',
    isStorm: false,
  }
}

/**
 * Calcula rotas (distância e rumo verdadeiro) entre uma origem e uma lista de destinos
 */
export function calcularRotasNauticas(
  origem: { lat: number; lon: number },
  destinos: Array<{ slug: string; nome: string; lat: number; lon: number }>,
) {
  const rad = Math.PI / 180.0
  const deg = 180.0 / Math.PI
  const rotas = []

  for (const d of destinos) {
    const dLat = (d.lat - origem.lat) * rad
    const dLon = (d.lon - origem.lon) * rad
    const lat1 = origem.lat * rad
    const lat2 = d.lat * rad

    const aH =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const cVal = 2 * Math.atan2(Math.sqrt(aH), Math.sqrt(1 - aH))
    const distKm = 6371 * cVal
    const distNm = distKm * 0.539957

    if (distNm < 0.2) continue

    const yB = Math.sin(dLon) * Math.cos(lat2)
    const xB = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
    let bearingDeg = deg * Math.atan2(yB, xB)
    bearingDeg = ((bearingDeg % 360) + 360) % 360

    rotas.push({
      ponto_slug: d.slug,
      ponto_nome: d.nome,
      lat: d.lat,
      lon: d.lon,
      distancia_nm: Math.round(distNm * 10) / 10,
      rumo_graus: Math.round(bearingDeg),
      direcao_cardinal: getWindDirectionLabel(bearingDeg),
    })
  }

  return rotas
}

/**
 * Monta lista de todos os destinos possíveis para cálculo de rotas
 * (os 4 pontos fixos canônicos + os pontos personalizados do usuário, exceto o ponto atual)
 */
export function obterTodosDestinosParaRotas(
  currentSlugOrId: string,
): Array<{ slug: string; nome: string; lat: number; lon: number }> {
  const destinos: Array<{ slug: string; nome: string; lat: number; lon: number }> = []

  // 1. Adiciona os 4 fixos
  for (const pf of PONTOS_DISPONIVEIS) {
    if (pf.slug !== currentSlugOrId) {
      destinos.push({
        slug: pf.slug,
        nome: pf.nomeCurto,
        lat: pf.lat,
        lon: pf.lon,
      })
    }
  }

  // 2. Adiciona os pontos personalizados do localStorage
  try {
    const customList = getPontosPersonalizados()
    for (const cp of customList) {
      const customSlug = `custom-${cp.id}`
      if (customSlug !== currentSlugOrId && cp.id !== currentSlugOrId) {
        destinos.push({
          slug: customSlug,
          nome: cp.nome,
          lat: cp.lat,
          lon: cp.lon,
        })
      }
    }
  } catch {
    // fallback
  }

  return destinos
}

export interface FactorItem {
  fator: string
  penalidade: number
  descricao: string
  cap?: number
}

export interface ScoreNavegacaoResult {
  score: number | null
  faixa: 'Excelente' | 'Bom' | 'Atenção' | 'Desfavorável' | null
  badgeColor: string
  fatores: FactorItem[]
  hasData: boolean
}

export interface ScoreInputData {
  windSpeed: number | null | undefined
  windGust?: number | null | undefined
  waveHeight?: number | null | undefined
  precipitationProbability?: number | null | undefined
  precipitationMm?: number | null | undefined
  weatherCode?: number | null | undefined
  visibilityMeters?: number | null | undefined
}

/**
 * Calcula o Score de Navegação (0 a 10) determinístico com lista transparente de fatores
 */
export function calcularScoreNavegacao(data: ScoreInputData): ScoreNavegacaoResult {
  const hasVento = data.windSpeed !== null && data.windSpeed !== undefined && !isNaN(data.windSpeed)
  const hasOnda =
    data.waveHeight !== null && data.waveHeight !== undefined && !isNaN(data.waveHeight)
  const hasChuvaProb =
    data.precipitationProbability !== null &&
    data.precipitationProbability !== undefined &&
    !isNaN(data.precipitationProbability)
  const hasChuvaMm =
    data.precipitationMm !== null &&
    data.precipitationMm !== undefined &&
    !isNaN(data.precipitationMm)
  const hasCode =
    data.weatherCode !== null && data.weatherCode !== undefined && !isNaN(data.weatherCode)

  // Se não temos nem vento nem onda nem código meteorológico básico, tratamos como dados indisponíveis
  if (!hasVento && !hasOnda && !hasCode) {
    return {
      score: null,
      faixa: null,
      badgeColor: '',
      fatores: [],
      hasData: false,
    }
  }

  let baseScore = 10.0
  let maxCap: number | null = null
  const fatores: FactorItem[] = []

  // 1. Vento sustentado (nós)
  // ≤8: 0 · 9–12: −1 · 13–16: −2 · 17–21: −4 · 22–27: −6 · >27: score máximo 1
  if (hasVento) {
    const v = Number(data.windSpeed)
    const vRound = Math.round(v)
    if (vRound > 27) {
      if (maxCap === null || maxCap > 1) maxCap = 1
      fatores.push({
        fator: 'Vento sustentado',
        penalidade: 0,
        cap: 1,
        descricao: `Vento ${vRound} kt: limite máx. 1.0 (vento extremo)`,
      })
    } else if (vRound >= 22) {
      baseScore -= 6
      fatores.push({
        fator: 'Vento sustentado',
        penalidade: -6,
        descricao: `Vento ${vRound} kt: −6`,
      })
    } else if (vRound >= 17) {
      baseScore -= 4
      fatores.push({
        fator: 'Vento sustentado',
        penalidade: -4,
        descricao: `Vento ${vRound} kt: −4`,
      })
    } else if (vRound >= 13) {
      baseScore -= 2
      fatores.push({
        fator: 'Vento sustentado',
        penalidade: -2,
        descricao: `Vento ${vRound} kt: −2`,
      })
    } else if (vRound >= 9) {
      baseScore -= 1
      fatores.push({
        fator: 'Vento sustentado',
        penalidade: -1,
        descricao: `Vento ${vRound} kt: −1`,
      })
    } else {
      fatores.push({
        fator: 'Vento sustentado',
        penalidade: 0,
        descricao: `Vento brando (${vRound} kt): sem penalidade`,
      })
    }
  }

  // 2. Rajadas (nós)
  // rajada − vento ≥ 10 nós: −1 adicional · rajada > 30: score máximo 2
  if (data.windGust !== null && data.windGust !== undefined && !isNaN(data.windGust)) {
    const g = Number(data.windGust)
    const gRound = Math.round(g)
    const v = hasVento ? Number(data.windSpeed) : 0
    const diff = g - v

    if (gRound > 30) {
      if (maxCap === null || maxCap > 2) maxCap = 2
      fatores.push({
        fator: 'Rajada',
        penalidade: 0,
        cap: 2,
        descricao: `Rajada ${gRound} kt: limite máx. 2.0 (rajada severa)`,
      })
    }

    if (diff >= 9.9) {
      baseScore -= 1
      fatores.push({
        fator: 'Variação de rajada',
        penalidade: -1,
        descricao: `Rajada (+${Math.round(diff)} kt acima do vento): −1`,
      })
    }
  }

  // 3. Onda / altura significativa (m), se disponível
  // ≤0,5: 0 · 0,6–1,0: −1 · 1,1–1,5: −2 · 1,6–2,0: −4 · >2,0: score máximo 2
  if (hasOnda) {
    const o = Number(data.waveHeight)
    const oFixed = o.toFixed(1)
    if (o > 2.05) {
      if (maxCap === null || maxCap > 2) maxCap = 2
      fatores.push({
        fator: 'Ondulação',
        penalidade: 0,
        cap: 2,
        descricao: `Onda ${oFixed} m: limite máx. 2.0 (mar agitado)`,
      })
    } else if (o >= 1.55) {
      baseScore -= 4
      fatores.push({
        fator: 'Ondulação',
        penalidade: -4,
        descricao: `Onda ${oFixed} m: −4`,
      })
    } else if (o >= 1.05) {
      baseScore -= 2
      fatores.push({
        fator: 'Ondulação',
        penalidade: -2,
        descricao: `Onda ${oFixed} m: −2`,
      })
    } else if (o >= 0.55) {
      baseScore -= 1
      fatores.push({
        fator: 'Ondulação',
        penalidade: -1,
        descricao: `Onda ${oFixed} m: −1`,
      })
    } else {
      fatores.push({
        fator: 'Ondulação',
        penalidade: 0,
        descricao: `Onda ${oFixed} m: sem penalidade`,
      })
    }
  }

  // 4. Probabilidade de chuva (%)
  // 40–60: −1 · 61–80: −2 · >80: −3
  let probVal: number | null = null
  if (hasChuvaProb) {
    probVal = Number(data.precipitationProbability)
  } else if (hasChuvaMm) {
    // Estimativa de probabilidade a partir da precipitação horária em mm se a probabilidade não estiver no payload
    const mm = Number(data.precipitationMm)
    if (mm > 5.0) probVal = 85
    else if (mm > 1.5) probVal = 70
    else if (mm > 0.1) probVal = 50
    else probVal = 0
  }

  if (probVal !== null) {
    const pRound = Math.round(probVal)
    if (pRound > 80) {
      baseScore -= 3
      fatores.push({
        fator: 'Chuva',
        penalidade: -3,
        descricao: `Probabilidade de chuva ${pRound}%: −3`,
      })
    } else if (pRound >= 61) {
      baseScore -= 2
      fatores.push({
        fator: 'Chuva',
        penalidade: -2,
        descricao: `Probabilidade de chuva ${pRound}%: −2`,
      })
    } else if (pRound >= 40) {
      baseScore -= 1
      fatores.push({
        fator: 'Chuva',
        penalidade: -1,
        descricao: `Probabilidade de chuva ${pRound}%: −1`,
      })
    }
  }

  // 5. Condição severa (código de trovoada/tempestade): score máximo 1
  // WMO 95, 96, 99 (tempestade / trovoada)
  if (hasCode) {
    const c = Math.round(Number(data.weatherCode))
    if (c >= 95 && c <= 99) {
      if (maxCap === null || maxCap > 1) maxCap = 1
      fatores.push({
        fator: 'Condição severa',
        penalidade: 0,
        cap: 1,
        descricao: 'Tempestade / Trovoada (WMO 95-99): limite máx. 1.0',
      })
    }
  }

  // 6. Visibilidade (se disponível) < 2 km (2000m): −2
  if (
    data.visibilityMeters !== null &&
    data.visibilityMeters !== undefined &&
    !isNaN(data.visibilityMeters)
  ) {
    const vis = Number(data.visibilityMeters)
    if (vis < 2000) {
      baseScore -= 2
      const visKm = (vis / 1000).toFixed(1)
      fatores.push({
        fator: 'Visibilidade reduzida',
        penalidade: -2,
        descricao: `Visibilidade ${visKm} km (<2 km): −2`,
      })
    }
  }

  let finalScore = baseScore
  if (maxCap !== null && finalScore > maxCap) {
    finalScore = maxCap
  }

  // Limita ao intervalo 0 a 10 e arredonda a 1 casa decimal
  if (finalScore < 0) finalScore = 0
  if (finalScore > 10) finalScore = 10
  finalScore = Math.round(finalScore * 10) / 10

  // Faixas:
  // 8,0–10 · "Excelente" — verde-mar
  // 6,0–7,9 · "Bom" — azul
  // 4,0–5,9 · "Atenção" — âmbar
  // 0–3,9 · "Desfavorável" — vermelho
  let faixa: 'Excelente' | 'Bom' | 'Atenção' | 'Desfavorável' = 'Desfavorável'
  let badgeColor = 'bg-rose-700 text-white border-rose-600'

  if (finalScore >= 7.95) {
    faixa = 'Excelente'
    badgeColor = 'bg-emerald-700 text-white border-emerald-600 shadow-sm'
  } else if (finalScore >= 5.95) {
    faixa = 'Bom'
    badgeColor = 'bg-sky-700 text-white border-sky-600 shadow-sm'
  } else if (finalScore >= 3.95) {
    faixa = 'Atenção'
    badgeColor = 'bg-amber-400 text-zinc-950 border-amber-300 font-bold shadow-sm'
  } else {
    faixa = 'Desfavorável'
    badgeColor = 'bg-rose-700 text-white border-rose-600 shadow-sm'
  }

  return {
    score: finalScore,
    faixa,
    badgeColor,
    fatores,
    hasData: true,
  }
}
