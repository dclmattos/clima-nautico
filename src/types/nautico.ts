export type TipoPonto = 'abrigado' | 'semi' | 'aberto'

export interface Ponto {
  id: string
  slug?: string
  nome: string
  lat: number
  lon: number
  tipo: TipoPonto
  descricao_abrigo?: string
  descricao?: string
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
  created?: string
  updated?: string
}

export interface PrevisaoHoraItem {
  time: string
  wind_speed_10m: number | null
  wind_direction_10m: number | null
  wind_gusts_10m: number | null
  beaufort: number
  precipitation: number | null
  precipitation_probability?: number | null
  visibility: number | null
  temperature_2m: number | null
  surface_pressure: number | null
  cloud_cover: number | null
  uv_index: number | null
  weather_code?: number | null
  wave_height_bruto?: number | null
  wave_height: number | null
  wave_ajustado?: boolean
  fator_abrigo?: number
  wave_period: number | null
  douglas_grau: number
  sea_level_height_msl: number | null
  sea_surface_temperature: number | null
  swell_wave_height_bruto?: number | null
  swell_wave_height?: number | null
  swell_wave_direction: number | null
  swell_wave_period: number | null
  wind_wave_height: number | null
  ocean_current_velocity: number | null
  ocean_current_direction: number | null
}

export interface ResumoDiaItem {
  dataIso: string
  nomeDia: string
  dataExibicao: string
  isHoje: boolean
  ventoMax: number | null
  ventoMaxBeaufort: number
  rajadaMax?: number | null
  ondaMax: number | null
  ondaMaxDouglas: number
  chuvaTotal: number
  probabilidadeChuvaMax?: number | null
  visibilidadeMin?: number | null
  temperaturaMax?: number | null
  temperaturaMin?: number | null
  weatherCode?: number | null
}

export interface AstronomiaPayload {
  nascer_do_sol: string | null
  por_do_sol: string | null
  duracao_luz_segundos: number | null
  crepusculo_nautico_matutino: string | null
  crepusculo_nautico_vespertino: string | null
  lua: {
    fase: number
    iluminacao_porcentagem: number
    nome_fase: string
    icone: string
  }
}

export interface PressaoTendenciaPayload {
  atual_hpa: number | null
  delta_3h_hpa: number
  direcao: 'subindo' | 'descendo' | 'estável'
  queda_severa: boolean
}

export interface MarAtualPayload {
  temperatura_agua: number | null
  swell_direcao: number | null
  swell_periodo: number | null
  swell_wave_height_bruto?: number | null
  swell_wave_height?: number | null
  wave_height_bruto?: number | null
  wave_height?: number | null
  wave_ajustado?: boolean
  fator_abrigo?: number
  onda_vento_altura: number | null
  corrente_velocidade: number | null
  corrente_direcao: number | null
  douglas_grau: number
  douglas_descricao: string
  beaufort: number
}

export interface RotaPonto {
  ponto_slug: string
  ponto_nome: string
  lat: number
  lon: number
  distancia_nm: number
  rumo_graus: number
  direcao_cardinal: string
}

export type DirecaoRelativaVento = 'proa' | 'través' | 'popa'

export interface TravessiaAmostra {
  tipo: 'origem' | 'meio' | 'destino'
  ponto_nome?: string
  horario: string
  vento_nos: number
  rajada_nos: number
  direcao_vento: number
  direcao_relativa: DirecaoRelativaVento
  altura_onda_m: number
  periodo_onda_s: number
  score: number
  chuva_mmh: number
  rebaixada?: boolean
  motivo_rebaixamento?: string | null
  fator_limitante?: string | null
}

export interface TravessiaAlertaItem {
  tipo: string
  tipoDesc?: string
  trecho: string
  valor: number | null
  unidade?: string
}

export interface TravessiaAlertaConsolidado {
  tipo: string
  tipoDesc?: string
  unidade?: string
  maxValor: number | null
  trechos: string[]
  trechoMax: string
}

export interface TravessiaAlternativa {
  hora_saida: string
  eta: string
  veredito: 'verde' | 'amarelo' | 'vermelho'
  veredito_cor: string
  score_minimo: number
  fator_limitante: string
  aviso?: string | null
  alertas?: TravessiaAlertaItem[]
  alertas_consolidados?: TravessiaAlertaConsolidado[]
}

export interface TravessiaPontoInfo {
  slug: string
  nome: string
  lat: number
  lon: number
  tipo?: TipoPonto
}

export interface TravessiaResultado {
  origem: TravessiaPontoInfo
  destino: TravessiaPontoInfo
  distancia_nm: number
  rumo_verdadeiro: number
  duracao_horas: number
  hora_saida?: string
  eta: string
  velocidade_nos?: number
  veredito: 'verde' | 'amarelo' | 'vermelho'
  veredito_cor: string
  aviso: string | null
  alertas?: TravessiaAlertaItem[]
  alertas_consolidados?: TravessiaAlertaConsolidado[]
  amostras: TravessiaAmostra[]
  combustivel_litros: number | null
  combustivel_com_reserva: number | null
  melhor_alternativa: TravessiaAlternativa | null
  hora_limite_saida: string | null
}

export interface ResumoDiaResultado {
  melhor: {
    ponto_nome: string
    slug: string
    score_medio: number
    janela_inicio: string | null
    janela_fim: string | null
  } | null
  evitar: {
    ponto_nome: string
    slug: string
    score_medio: number
    fator_limitante: string | null
  } | null
  frente_fria: string
  atualizado_em: string
}

export interface TravessiaParams {
  origem: string
  destino: string
  hora_saida: string
  velocidade_nos?: number
  perfil_id?: string
  consumo_lh?: number
  dispositivo_uuid?: string
}

export interface PrevisaoPayload {
  ponto_id: string
  ponto_nome: string
  ponto_tipo: string
  lat: number
  lon: number
  timezone: string
  weather_code?: number | null
  hourly: PrevisaoHoraItem[]
  daily: Array<{
    date: string
    sunrise: string | null
    sunset: string | null
    daylight_duration: number | null
    temperature_2m_max?: number | null
    temperature_2m_min?: number | null
    precipitation_probability_max?: number | null
  }>
  astronomia: AstronomiaPayload
  pressao_tendencia: PressaoTendenciaPayload
  mar_atual: MarAtualPayload
  rotas: RotaPonto[]
}

export interface DiaSol {
  date: string
  nascer_sol: string | null
  por_sol: string | null
}

export interface HourlyScore {
  time: string
  score: number
  fator_limitante: string | null
  fator_limitante_desc: string | null
  wind_speed_10m: number | null
  wind_direction_10m: number | null
  wind_gusts_10m: number | null
  precipitation: number | null
  visibility: number | null
  temperature_2m: number | null
  surface_pressure: number | null
  cloud_cover: number | null
  uv_index: number | null
  wave_height_bruto?: number | null
  wave_height: number | null
  wave_ajustado?: boolean
  fator_abrigo?: number
  wave_period: number | null
  sea_level_height_msl: number | null
  sea_surface_temperature: number | null
  swell_wave_height_bruto?: number | null
  swell_wave_height?: number | null
  swell_wave_direction: number | null
  swell_wave_period: number | null
  wind_wave_height: number | null
  ocean_current_velocity: number | null
  ocean_current_direction: number | null
}

export interface JanelaNavegacao {
  inicio: string
  fim: string
  duracao_horas: number
  score_medio: number
  fator_limitante: string | null
  fator_limitante_desc: string | null
  melhor_janela?: boolean
}

export interface JanelasPayload {
  ponto_id: string
  ponto_nome: string
  ponto_tipo: string
  perfil_id: string
  perfil_nome: string
  dias_sol?: DiaSol[]
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
  isPersonalizado?: boolean
}

export type TipoPontoPersonalizado = 'abrigado' | 'semi-abrigado' | 'mar aberto'

export interface PontoPersonalizado {
  id: string
  nome: string
  lat: number
  lon: number
  tipo: TipoPontoPersonalizado
  criado_em: string
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
  pontos_personalizados?: PontoPersonalizado[]
}

export interface PreferenciasUsuario {
  dispositivo_uuid: string
  perfil_id: string
  ponto_favorito_id?: string
  ponto_favorito_slug?: string
  horario_briefing?: string
  ultimo_briefing?: string
  updated?: string
}
