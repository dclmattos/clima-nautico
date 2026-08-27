export type TipoPonto = 'abrigado' | 'semi' | 'aberto'

export interface Ponto {
  id: string
  slug?: string
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

export interface ResumoDiaItem {
  dataIso: string // YYYY-MM-DD
  nomeDia: string // Hoje, Seg, Ter, Qua, Qui, Sex, Sáb
  dataExibicao: string // DD/MM
  isHoje: boolean
  ventoMax: number | null
  ondaMax: number | null
  chuvaTotal: number
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

export interface PreferenciasUsuario {
  id?: string
  dispositivo_uuid?: string
  perfil_id?: string
  ponto_favorito_id?: string
  horario_briefing?: string
  criado_em?: string
  created?: string
  updated?: string
}

export interface HourlyScore {
  time: string
  score: number
  fator_limitante: 'vento' | 'rajada' | 'onda' | 'período' | 'chuva' | 'exposição' | null
  fator_limitante_desc?: string | null
  wind_speed_10m: number | null
  wind_direction_10m: number | null
  wind_gusts_10m: number | null
  precipitation: number | null
  visibility: number | null
  wave_height: number | null
  wave_period: number | null
  sea_level_height_msl: number | null
}

export interface JanelaNavegacao {
  inicio: string // ISO timestamp
  fim: string // ISO timestamp
  duracao_horas: number
  score_medio: number
  fator_limitante: 'vento' | 'rajada' | 'onda' | 'período' | 'chuva' | 'exposição' | null
  fator_limitante_desc?: string | null
}

export interface JanelasPayload {
  ponto_id: string
  ponto_nome: string
  ponto_tipo: TipoPonto
  perfil_id: string
  perfil_nome: string
  hourly_scores: HourlyScore[]
  janelas: JanelaNavegacao[]
}

export interface PontoEstadoPrevisao {
  ponto: Ponto
  loading: boolean
  error: string | null
  data: PrevisaoPayload | null
  currentHourData: PrevisaoHoraItem | null
  statusSemaforo: 'verde' | 'amarelo' | 'vermelho' | null
  janelasData?: JanelasPayload | null
  loadingJanelas?: boolean
  currentScore?: number | null
  proximaJanela?: JanelaNavegacao | null
}
