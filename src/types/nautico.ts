export type TipoPonto = 'abrigado' | 'semi' | 'aberto'

export interface Ponto {
  id: string
  nome: string
  lat: number
  lon: number
  tipo: TipoPonto
  created?: string
  updated?: string
}

export interface PerfilNavegacao {
  id: string
  nome: string
  vento_max_kt: number
  rajada_max_kt: number
  onda_max_m: number
  periodo_min_s: number | null
  chuva_max_mm_h: number
}

export interface PrevisaoHoraItem {
  time: string // ISO / YYYY-MM-DDTHH:00
  wind_speed_10m: number | null
  wind_direction_10m: number | null
  wind_gusts_10m: number | null
  precipitation: number | null
  visibility: number | null
  wave_height: number | null
  wave_period: number | null
  sea_level_height_msl: number | null
}

export interface PrevisaoPayload {
  ponto_id: string
  ponto_nome: string
  ponto_tipo: TipoPonto
  lat: number
  lon: number
  timezone: string
  hourly: PrevisaoHoraItem[]
}

export interface PontoEstadoPrevisao {
  ponto: Ponto
  loading: boolean
  error: string | null
  data: PrevisaoPayload | null
  currentHourData: PrevisaoHoraItem | null
  statusSemaforo: 'verde' | 'amarelo' | 'vermelho' | null
}
