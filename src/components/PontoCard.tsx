import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PontoEstadoPrevisao } from '@/types/nautico'
import {
  formatPontoNome,
  formatTipoPonto,
  formatDaylightDuration,
  formatTimeHHMM,
  formatCoordinatesDMM,
  formatarJanelaBadge,
  getWeatherCondition,
} from '@/services/previsaoService'
import {
  Wind,
  Compass,
  Waves,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronRight,
  Sun,
  Sunset,
  Thermometer,
  Gauge,
  Copy,
  Check,
  Droplets,
} from 'lucide-react'
import { SkyConditionIcon } from '@/components/SkyConditionIcon'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

interface PontoCardProps {
  estado: PontoEstadoPrevisao
  onRetry: (pontoId: string) => void
}

export const PontoCard: React.FC<PontoCardProps> = ({ estado, onRetry }) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const {
    ponto,
    loading,
    error,
    data,
    currentHourData,
    statusSemaforo,
    currentScore,
    proximaJanela,
    loadingJanelas,
    isPersonalizado,
  } = estado

  const isCustom =
    isPersonalizado ||
    (ponto as any).isPersonalizado ||
    (ponto.id && ponto.id.startsWith('custom-'))

  const nomeExibicao = isCustom ? ponto.nome : formatPontoNome(ponto.nome)
  const tipoFormatado = formatTipoPonto(ponto.tipo)

  // Badge visual por tipo de ancoradouro/ponto
  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'abrigado':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/60'
      case 'semi':
      case 'semi-abrigado':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60'
      case 'aberto':
      case 'mar aberto':
        return 'bg-slate-800 text-slate-300 border-slate-700'
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700'
    }
  }

  // Cor e texto do semáforo
  const getSemaforoStyle = () => {
    switch (statusSemaforo) {
      case 'verde':
        return {
          bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
          dot: 'bg-emerald-400',
          label: 'Favorável',
          textColor: 'text-emerald-400',
        }
      case 'amarelo':
        return {
          bg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
          dot: 'bg-amber-400',
          label: 'Atenção',
          textColor: 'text-amber-400',
        }
      case 'vermelho':
        return {
          bg: 'bg-red-500/10 border-red-500/30 text-red-400',
          dot: 'bg-red-400',
          label: 'Crítico',
          textColor: 'text-red-400',
        }
      default:
        return {
          bg: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400',
          dot: 'bg-zinc-500',
          label: 'Sem dados',
          textColor: 'text-zinc-400',
        }
    }
  }

  // Cor do anel de score circular (verde ≥ 70, amarelo 50-69, vermelho < 50)
  const getScoreColorClass = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'text-zinc-500'
    if (score >= 70) return 'text-emerald-400'
    if (score >= 50) return 'text-amber-400'
    return 'text-red-400'
  }

  const getScoreStrokeColor = (score: number | null | undefined) => {
    if (score === null || score === undefined) return '#71717a'
    if (score >= 70) return '#34d399'
    if (score >= 50) return '#fbbf24'
    return '#f87171'
  }

  // Direção do vento para texto e rotação
  const getWindDirectionLabel = (deg: number | null | undefined) => {
    if (deg === null || deg === undefined) return '--'
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const idx = Math.round((deg % 360) / 45) % 8
    return dirs[idx]
  }

  // Formatação de hora do registro
  const horaRegistro = currentHourData?.time
    ? new Date(currentHourData.time).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Seta de tendência de pressão
  const renderTendenciaPressao = () => {
    const pressao = data?.pressao_tendencia
    if (!pressao || pressao.atual_hpa === null) return null

    let seta = '→'
    let cor = 'text-zinc-400'

    if (pressao.direcao === 'subindo') {
      seta = '↑'
      cor = 'text-emerald-400'
    } else if (pressao.direcao === 'descendo') {
      seta = '↓'
      cor = pressao.queda_severa ? 'text-red-400 font-bold animate-pulse' : 'text-amber-400'
    }

    return (
      <span className={`inline-flex items-center gap-1 font-mono text-xs ${cor}`}>
        <Gauge className="w-3.5 h-3.5 text-zinc-400" />
        {pressao.atual_hpa} hPa {seta}
      </span>
    )
  }

  // Dados astronômicos e mar
  const astro = data?.astronomia
  const marAtual = data?.mar_atual
  const coordsDMM = formatCoordinatesDMM(ponto.lat, ponto.lon)

  const handleCopyCoords = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (navigator.clipboard) {
      navigator.clipboard.writeText(coordsDMM)
      setCopied(true)
      toast({
        title: 'Coordenadas copiadas!',
        description: `${nomeExibicao}: ${coordsDMM}`,
        duration: 2000,
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Estado de carregamento inicial
  if (loading) {
    return (
      <Card className="bg-[#11161d] border-zinc-800 shadow-md animate-pulse">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="h-5 w-32 bg-zinc-800 rounded"></div>
              <div className="h-3 w-20 bg-zinc-850 rounded"></div>
            </div>
            <div className="w-12 h-12 rounded-full bg-zinc-800"></div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <div className="h-12 bg-zinc-850 rounded-lg"></div>
            <div className="h-12 bg-zinc-850 rounded-lg"></div>
            <div className="h-12 bg-zinc-850 rounded-lg"></div>
          </div>
          <div className="h-8 bg-zinc-850 rounded"></div>
        </CardContent>
      </Card>
    )
  }

  // Estado de erro no carregamento
  if (error || !data) {
    return (
      <Card className="bg-[#11161d] border-red-950/40 shadow-md">
        <CardHeader className="pb-2 border-b border-zinc-800/80">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
                {isCustom && <span className="text-amber-400">⭐</span>}
                {nomeExibicao}
              </CardTitle>
              <Badge
                variant="outline"
                className={`text-xs mt-1 border ${getTipoBadgeColor(ponto.tipo)}`}
              >
                {tipoFormatado}
              </Badge>
            </div>
            <Badge variant="destructive" className="bg-red-950 text-red-300 border-red-800 text-xs">
              Indisponível
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-2.5 text-xs text-red-400 bg-red-950/20 p-2.5 rounded-lg border border-red-900/30">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              {error || 'Não foi possível carregar a previsão deste ponto.'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetry(ponto.id || ponto.slug || '')}
            className="w-full bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/30 text-zinc-300 text-xs gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  const semaforo = getSemaforoStyle()

  // Valores atuais extraídos com segurança
  const ventoSpeed =
    currentHourData?.wind_speed_10m !== null && currentHourData?.wind_speed_10m !== undefined
      ? Math.round(currentHourData.wind_speed_10m)
      : null
  const ventoDir = currentHourData?.wind_direction_10m
  const ventoDirLabel = getWindDirectionLabel(ventoDir)
  const rajada =
    currentHourData?.wind_gusts_10m !== null && currentHourData?.wind_gusts_10m !== undefined
      ? Math.round(currentHourData.wind_gusts_10m)
      : null
  const beaufort = currentHourData?.beaufort ?? 0

  const ondaAltura =
    currentHourData?.wave_height !== null && currentHourData?.wave_height !== undefined
      ? currentHourData.wave_height.toFixed(1)
      : null
  const ondaPeriodo =
    currentHourData?.wave_period !== null && currentHourData?.wave_period !== undefined
      ? Math.round(currentHourData.wave_period)
      : null

  const mareMsl =
    currentHourData?.sea_level_height_msl !== null &&
    currentHourData?.sea_level_height_msl !== undefined
      ? (currentHourData.sea_level_height_msl >= 0 ? '+' : '') +
        currentHourData.sea_level_height_msl.toFixed(2)
      : null

  const chuvaMm =
    currentHourData?.precipitation !== null && currentHourData?.precipitation !== undefined
      ? currentHourData.precipitation.toFixed(1)
      : null

  const tempAr =
    currentHourData?.temperature_2m !== null && currentHourData?.temperature_2m !== undefined
      ? Math.round(currentHourData.temperature_2m)
      : null
  const tempAgua =
    marAtual?.temperatura_agua !== null && marAtual?.temperatura_agua !== undefined
      ? Math.round(marAtual.temperatura_agua)
      : null

  const scoreVal = currentScore !== undefined ? currentScore : null
  const scoreOffset = scoreVal !== null ? 100 - scoreVal : 100

  // Condição do céu
  const weatherCode =
    currentHourData?.weather_code !== undefined && currentHourData?.weather_code !== null
      ? currentHourData.weather_code
      : data?.weather_code !== undefined && data?.weather_code !== null
        ? data.weather_code
        : null
  const skyCondition = getWeatherCondition(weatherCode)

  const handleCardClick = () => {
    let slugDestino = ponto.slug || ponto.nome?.toLowerCase() || ponto.id
    if (isCustom) {
      slugDestino =
        ponto.slug || (ponto.id && ponto.id.startsWith('custom-') ? ponto.id : `custom-${ponto.id}`)
    }
    navigate(`/ponto/${slugDestino}`)
  }

  return (
    <Card
      onClick={handleCardClick}
      className="bg-[#11161d] border-zinc-800/90 hover:border-cyan-500/60 shadow-lg hover:shadow-cyan-950/30 transition-all duration-200 cursor-pointer text-zinc-100 flex flex-col justify-between group overflow-hidden"
    >
      <div>
        {/* Cabeçalho do Card */}
        <CardHeader className="pb-3 border-b border-zinc-800/70 bg-[#0d1218]/60">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 group-hover:text-cyan-300 transition-colors">
                {isCustom && (
                  <span title="Ponto personalizado" className="text-amber-400 text-sm">
                    ⭐
                  </span>
                )}
                {nomeExibicao}
                <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={`text-xs px-2 py-0.5 font-medium border ${getTipoBadgeColor(ponto.tipo)}`}
                >
                  {tipoFormatado}
                </Badge>
                {horaRegistro && (
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {horaRegistro}
                  </span>
                )}
              </div>
            </div>

            {/* Canto superior direito: Indicador de Condição do Céu + Score Circular */}
            <div className="flex items-center gap-3">
              {/* Indicador de Condição do Céu */}
              <div className="flex items-center gap-1 text-xs">
                <SkyConditionIcon iconName={skyCondition.iconName} className="w-4 h-4 shrink-0" />
                <span className={skyCondition.labelColor}>{skyCondition.label}</span>
              </div>

              {/* Score Circular */}
              <div className="flex flex-col items-center">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <svg className="w-12 h-12 -rotate-90 transform" viewBox="0 0 36 36">
                    <path
                      className="text-zinc-800"
                      strokeWidth="3"
                      stroke="currentColor"
                      fill="none"
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    />
                    {scoreVal !== null && (
                      <path
                        strokeDasharray="100, 100"
                        strokeDashoffset={scoreOffset}
                        strokeWidth="3"
                        strokeLinecap="round"
                        stroke={getScoreStrokeColor(scoreVal)}
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-xs font-black ${getScoreColorClass(scoreVal)}`}>
                      {scoreVal !== null ? scoreVal : '--'}
                    </span>
                    <span className="text-[8px] text-zinc-400 -mt-0.5">pts</span>
                  </div>
                </div>
                <span className="text-[9px] text-zinc-400 font-medium mt-0.5">Score</span>
              </div>
            </div>
          </div>
        </CardHeader>
        {/* Corpo com Grid de Condições */}
        <CardContent className="p-4 space-y-3.5">
          {/* Métricas Principais (Vento, Onda, Maré/Chuva) */}
          <div className="grid grid-cols-3 gap-2">
            {/* Vento */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                <Wind className="w-3.5 h-3.5 text-sky-400" />
                Vento
              </span>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-white font-mono">
                    {ventoSpeed !== null ? ventoSpeed : '--'}
                  </span>
                  <span className="text-xs text-zinc-400">kt</span>
                </div>
                {rajada !== null && (
                  <p className="text-[10px] text-amber-400 font-medium">raj: {rajada} kt</p>
                )}
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60">
                <span className="flex items-center gap-1">
                  <Compass
                    className="w-3 h-3 text-sky-400"
                    style={{ transform: `rotate(${ventoDir ?? 0}deg)` }}
                  />
                  {ventoDirLabel}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 border-zinc-700 bg-zinc-800 text-zinc-300"
                >
                  F{beaufort}
                </Badge>
              </div>
            </div>

            {/* Onda */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                <Waves className="w-3.5 h-3.5 text-cyan-400" />
                Onda
              </span>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-black text-white font-mono">
                    {ondaAltura !== null ? ondaAltura : '--'}
                  </span>
                  <span className="text-xs text-zinc-400">m</span>
                </div>
                {ondaPeriodo !== null && (
                  <p className="text-[10px] text-cyan-300 font-medium">per: {ondaPeriodo}s</p>
                )}
              </div>
              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 flex items-center justify-between">
                <span>Douglas</span>
                <span className="font-mono text-zinc-300">G{marAtual?.douglas_grau ?? 0}</span>
              </div>
            </div>

            {/* Maré e Chuva */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-xl p-2.5 flex flex-col justify-between">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1 font-medium">
                <Droplets className="w-3.5 h-3.5 text-indigo-400" />
                Maré / Chuva
              </span>
              <div className="my-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-bold text-white font-mono">
                    {mareMsl !== null ? `${mareMsl}m` : '--'}
                  </span>
                </div>
                <p className="text-[10px] text-indigo-300 font-medium">
                  {chuvaMm !== null ? `${chuvaMm} mm/h` : '0 mm/h'}
                </p>
              </div>
              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-800/60 flex items-center justify-between">
                <span>Semáforo</span>
                <span className={`font-semibold ${semaforo.textColor}`}>{semaforo.label}</span>
              </div>
            </div>
          </div>

          {/* Próxima Janela de Navegação */}
          <div className="bg-[#131922] border border-cyan-900/40 rounded-xl p-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                  Próxima Janela
                </span>
                <p className="text-xs font-semibold text-white">
                  {loadingJanelas ? (
                    <span className="text-zinc-400 animate-pulse">Calculando janelas...</span>
                  ) : proximaJanela ? (
                    formatarJanelaBadge(proximaJanela.inicio, proximaJanela.fim)
                  ) : (
                    <span className="text-zinc-400">Sem janela nas próximas 72h</span>
                  )}
                </p>
              </div>
            </div>
            {proximaJanela && (
              <Badge className="bg-cyan-950 text-cyan-300 border-cyan-800 text-[10px] font-mono px-2 py-0.5 shrink-0">
                Score {proximaJanela.score_medio}
              </Badge>
            )}
          </div>

          {/* Linha Discreta: Sol, Temperatura, Pressão e Coordenadas */}
          <div className="space-y-1.5 pt-1 text-[11px] text-zinc-400">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              {astro?.nascer_do_sol && astro?.por_do_sol && (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-amber-300">
                    <Sun className="w-3 h-3" />
                    {formatTimeHHMM(astro.nascer_do_sol)}
                  </span>
                  <span className="flex items-center gap-1 text-orange-400">
                    <Sunset className="w-3 h-3" />
                    {formatTimeHHMM(astro.por_do_sol)}
                  </span>
                </div>
              )}

              {(tempAr !== null || tempAgua !== null) && (
                <div className="flex items-center gap-2 text-zinc-300">
                  {tempAr !== null && (
                    <span className="flex items-center gap-1" title="Temperatura do Ar">
                      <Thermometer className="w-3 h-3 text-rose-400" />
                      {tempAr}°C ar
                    </span>
                  )}
                  {tempAgua !== null && (
                    <span className="text-cyan-300 font-medium" title="Temperatura da Água">
                      • {tempAgua}°C mar
                    </span>
                  )}
                </div>
              )}

              {renderTendenciaPressao()}
            </div>

            {/* Coordenadas DMM com Botão Copiar */}
            <div className="flex items-center justify-between border-t border-zinc-800/50 pt-1.5">
              <span className="text-[10px] font-mono text-zinc-500 truncate select-all">
                {coordsDMM}
              </span>
              <button
                type="button"
                onClick={handleCopyCoords}
                className="p-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 transition-colors shrink-0"
                title="Copiar coordenadas DMM"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}
