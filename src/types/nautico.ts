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
  beaufort?: number
  precipitation: number | null
  visibility: number | null
  temperature_2m?: number | null
  surface_pressure?: number | null
  cloud_cover?: number | null
  uv_index?: number | null
  wave_height: number | null
  wave_period: number | null
  douglas_grau?: number
  sea_level_height_msl: number | null
  sea_surface_temperature?: number | null
  swell_wave_direction?: number | null
  swell_wave_period?: number | null
  wind_wave_height?: number | null
  ocean_current_velocity?: number | null
  ocean_current_direction?: number | null
}

export interface ResumoDiaItem {
  dataIso: string // YYYY-MM-DD
  nomeDia: string // Hoje, Seg, Ter, Qua, Qui, Sex, Sáb
  dataExibicao: string // DD/MM
  isHoje: boolean
  ventoMax: number | null
  ventoMaxBeaufort?: number
  ondaMax: number | null
  ondaMaxDouglas?: number
  chuvaTotal: number
}

export interface LuaInfo {
  fase: number // 0 a 1
  iluminacao_porcentagem: number
  nome_fase: string
  icone: string
}

export interface AstronomiaInfo {
  nascer_do_sol: string | null // ISO
  por_do_sol: string | null // ISO
  duracao_luz_segundos: number | null
  crepusculo_nautico_matutino: string | null // ISO
  crepusculo_nautico_vespertino: string | null // ISO
  lua: LuaInfo
}

export interface PressaoTendenciaInfo {
  atual_hpa: number | null
  delta_3h_hpa: number
  direcao: 'subindo' | 'estável' | 'descendo'
  queda_severa: boolean // queda >= 3 hPa/3h
}

export interface MarAtualInfo {
  temperatura_agua: number | null
  swell_direcao: number | null
  swell_periodo: number | null
  onda_vento_altura: number | null
  corrente_velocidade: number | null
  corrente_direcao: number | null
  douglas_grau: number
  douglas_descricao: string
  beaufort: number
}

export interface RotaPontoInfo {
  ponto_slug: string
  ponto_nome: string
  lat: number
  lon: number
  distancia_nm: number
  rumo_graus: number
  direcao_cardinal: string
}

export interface DailyPrevisaoItem {
  date: string
  sunrise: string | null
  sunset: string | null
  daylight_duration: number | null
}

export interface PrevisaoPayload {
  ponto_id: string
  ponto_nome: string
  ponto_tipo: TipoPonto
  lat: number
  lon: number
  timezone: string
  hourly: PrevisaoHoraItem[]
  daily?: DailyPrevisaoItem[]
  astronomia?: AstronomiaInfo
  pressao_tendencia?: PressaoTendenciaInfo
  mar_atual?: MarAtualInfo
  rotas?: RotaPontoInfo[]
}

export interface UltimoBriefingStorage {
  texto: string
  timestamp: string
}

export interface PreferenciasStorage {
  perfil_id: string
  ponto_favorito_slug: string
  horario_briefing: string
  ultimo_briefing: UltimoBriefingStorage | null
}

export interface PreferenciasUsuario {
  id?: string
  dispositivo_uuid?: string
  perfil_id?: string
  ponto_favorito_id?: string
  ponto_favorito_slug?: string
  horario_briefing?: string
  ultimo_briefing?: string | null
  criado_em?: string
  created?: string
  updated?: string
}

export interface BriefingResponse {
  texto: string
  gerado_em: string
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
  temperature_2m?: number | null
  surface_pressure?: number | null
  cloud_cover?: number | null
  uv_index?: number | null
  wave_height: number | null
  wave_period: number | null
  sea_level_height_msl: number | null
  sea_surface_temperature?: number | null
  swell_wave_direction?: number | null
  swell_wave_period?: number | null
  wind_wave_height?: number | null
  ocean_current_velocity?: number | null
  ocean_current_direction?: number | null
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
