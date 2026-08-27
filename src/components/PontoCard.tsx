import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PontoEstadoPrevisao } from '@/types/nautico'
import {
  formatPontoNome,
  formatTipoPonto,
  getWindDirectionLabel,
  formatarJanelaBadge,
} from '@/services/previsaoService'
import {
  Navigation2,
  Wind,
  Waves,
  CloudRain,
  Compass,
  AlertTriangle,
  RotateCw,
  Clock,
  Gauge,
  ChevronRight,
  CalendarCheck,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface PontoCardProps {
  estado: PontoEstadoPrevisao
  onRetry: (pontoId: string) => void
}

export const PontoCard: React.FC<PontoCardProps> = ({ estado, onRetry }) => {
  const navigate = useNavigate()
  const {
    ponto,
    loading,
    error,
    currentHourData,
    statusSemaforo,
    currentScore,
    proximaJanela,
    loadingJanelas,
  } = estado
  const nomeExibicao = formatPontoNome(ponto.nome)
  const tipoFormatado = formatTipoPonto(ponto.tipo)

  // Badge visual por tipo de ancoradouro/ponto
  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'abrigado':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/60 hover:bg-blue-950'
      case 'semi':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60 hover:bg-indigo-950'
      case 'aberto':
        return 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-800'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  // Semáforo com as cores: Verde (#10b981), Amarelo (#f59e0b), Vermelho (#ef4444)
  const getSemaforoStyle = (status: 'verde' | 'amarelo' | 'vermelho' | null) => {
    switch (status) {
      case 'verde':
        return {
          bg: 'bg-[#10b981]',
          glow: 'shadow-[0_0_12px_rgba(16,185,129,0.55)]',
          border: 'border-[#10b981]/60',
          text: 'text-[#10b981]',
          label: 'Favorável',
        }
      case 'amarelo':
        return {
          bg: 'bg-[#f59e0b]',
          glow: 'shadow-[0_0_12px_rgba(245,158,11,0.55)]',
          border: 'border-[#f59e0b]/60',
          text: 'text-[#f59e0b]',
          label: 'Atenção',
        }
      case 'vermelho':
        return {
          bg: 'bg-[#ef4444]',
          glow: 'shadow-[0_0_12px_rgba(239,68,68,0.55)]',
          border: 'border-[#ef4444]/60',
          text: 'text-[#ef4444]',
          label: 'Severo',
        }
      default:
        return {
          bg: 'bg-zinc-600',
          glow: '',
          border: 'border-zinc-500',
          text: 'text-zinc-400',
          label: '--',
        }
    }
  }

  // Estilo e anel de progresso SVG do Score 0-100
  const getScoreVisual = (score: number | null | undefined) => {
    if (score === null || score === undefined) {
      return {
        color: '#71717a', // zinc-500
        textColor: 'text-zinc-400',
        strokeColor: '#52525b',
        bgPill: 'bg-zinc-900 border-zinc-800',
        label: '--',
      }
    }
    if (score >= 70) {
      return {
        color: '#10b981', // green-500
        textColor: 'text-emerald-400',
        strokeColor: '#10b981',
        bgPill: 'bg-emerald-950/40 border-emerald-800/60',
        label: `${score}`,
      }
    }
    if (score >= 40) {
      return {
        color: '#f59e0b', // amber-500
        textColor: 'text-amber-400',
        strokeColor: '#f59e0b',
        bgPill: 'bg-amber-950/40 border-amber-800/60',
        label: `${score}`,
      }
    }
    return {
      color: '#ef4444', // red-500
      textColor: 'text-red-400',
      strokeColor: '#ef4444',
      bgPill: 'bg-red-950/40 border-red-800/60',
      label: `${score}`,
    }
  }

  const semaforoInfo = getSemaforoStyle(statusSemaforo)
  const scoreInfo = getScoreVisual(currentScore)

  // Circunferência do anel circular SVG
  const radius = 16
  const strokeWidth = 3.5
  const circumference = 2 * Math.PI * radius
  const normalizedScore =
    currentScore !== null && currentScore !== undefined
      ? Math.max(0, Math.min(100, currentScore))
      : 0
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference

  // Formatação do horário do dado
  const horaRegistro = currentHourData?.time
    ? new Date(currentHourData.time).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  // Estado de Carregamento (Skeleton)
  if (loading) {
    return (
      <Card className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100 animate-pulse overflow-hidden">
        <CardHeader className="pb-3 border-b border-zinc-800/80">
          <div className="flex items-center justify-between gap-2">
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-zinc-800 rounded w-3/4"></div>
              <div className="h-4 bg-zinc-800/60 rounded w-1/3"></div>
            </div>
            <div className="w-10 h-10 rounded-full bg-zinc-800"></div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="h-16 bg-zinc-800/50 rounded-lg p-3"></div>
            <div className="h-16 bg-zinc-800/50 rounded-lg p-3"></div>
            <div className="h-16 bg-zinc-800/50 rounded-lg p-3"></div>
            <div className="h-16 bg-zinc-800/50 rounded-lg p-3"></div>
            <div className="h-16 bg-zinc-800/50 rounded-lg p-3"></div>
            <div className="h-16 bg-zinc-800/50 rounded-lg p-3"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Estado de Erro
  if (error || !currentHourData) {
    return (
      <Card className="bg-[#11161d] border-red-950/60 shadow-md text-zinc-100 overflow-hidden flex flex-col justify-between">
        <CardHeader className="pb-2 border-b border-zinc-800/80">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                {nomeExibicao}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={getTipoBadgeColor(ponto.tipo)}>
                  {tipoFormatado}
                </Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 pb-6 flex-1 flex flex-col items-center justify-center text-center space-y-3">
          <div className="w-10 h-10 rounded-full bg-red-950/50 border border-red-800/50 flex items-center justify-center text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-zinc-200">Não foi possível carregar</p>
            <p className="text-xs text-zinc-400 max-w-[240px] line-clamp-2">
              {error || 'Dados meteorológicos indisponíveis no momento.'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onRetry(ponto.id)}
            className="mt-2 bg-zinc-800/80 border-zinc-700 text-zinc-100 hover:bg-zinc-700 hover:text-white text-xs gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Tentar de novo
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Valores atuais
  const windSpeed =
    currentHourData.wind_speed_10m !== null
      ? Math.round(currentHourData.wind_speed_10m * 10) / 10
      : null
  const windDirDeg = currentHourData.wind_direction_10m ?? 0
  const windDirLabel = getWindDirectionLabel(currentHourData.wind_direction_10m)
  const windGust =
    currentHourData.wind_gusts_10m !== null
      ? Math.round(currentHourData.wind_gusts_10m * 10) / 10
      : null
  const waveHeight =
    currentHourData.wave_height !== null
      ? (Math.round(currentHourData.wave_height * 100) / 100).toFixed(2)
      : null
  const wavePeriod =
    currentHourData.wave_period !== null
      ? (Math.round(currentHourData.wave_period * 10) / 10).toFixed(1)
      : null
  const seaLevel =
    currentHourData.sea_level_height_msl !== null
      ? (Math.round(currentHourData.sea_level_height_msl * 100) / 100).toFixed(2)
      : null
  const precip =
    currentHourData.precipitation !== null
      ? (Math.round(currentHourData.precipitation * 10) / 10).toFixed(1)
      : '0.0'

  const arrowRotation = windDirDeg

  const handleClickCard = () => {
    const slugDestino = ponto.slug || ponto.nome?.toLowerCase() || ponto.id
    navigate(`/ponto/${slugDestino}`)
  }

  return (
    <Card
      onClick={handleClickCard}
      className="bg-[#11161d] border-zinc-800/90 shadow-lg text-zinc-100 overflow-hidden hover:border-cyan-700/70 hover:shadow-cyan-950/20 hover:scale-[1.01] transition-all cursor-pointer group flex flex-col justify-between"
    >
      <div>
        {/* Header com Nome, Tipo, Semáforo e Score Circular */}
        <CardHeader className="pb-3 border-b border-zinc-800/70 bg-[#0d1218]/60">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 group-hover:text-cyan-300 transition-colors">
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
                    <Clock className="w-3 h-3 text-zinc-400" />
                    {horaRegistro}
                  </span>
                )}
              </div>
            </div>

            {/* Lado Direito: Semáforo + Score Numérico Circular */}
            <div className="flex items-center gap-3 shrink-0">
              {/* Score Circular 0-100 */}
              <div
                className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full border border-zinc-800"
                title={`Score de navegabilidade: ${currentScore !== null && currentScore !== undefined ? currentScore : '--'}/100`}
              >
                <div className="relative w-8 h-8 flex items-center justify-center">
                  <svg className="w-8 h-8 transform -rotate-90">
                    <circle
                      cx="16"
                      cy="16"
                      r={radius}
                      stroke="currentColor"
                      strokeWidth={strokeWidth}
                      className="text-zinc-800"
                      fill="transparent"
                    />
                    <circle
                      cx="16"
                      cy="16"
                      r={radius}
                      stroke={scoreInfo.strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                      className="transition-all duration-700 ease-out"
                    />
                  </svg>
                  <span className={`absolute text-[11px] font-black ${scoreInfo.textColor}`}>
                    {currentScore !== null && currentScore !== undefined ? currentScore : '--'}
                  </span>
                </div>
                <div className="flex flex-col pr-0.5">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold leading-none">
                    Score
                  </span>
                  <span className="text-[10px] text-zinc-400 leading-tight">/100</span>
                </div>
              </div>

              {/* Semáforo de Condição */}
              <div
                className="hidden sm:flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-full border border-zinc-800"
                title={`Condição: ${semaforoInfo.label}`}
              >
                <span
                  className={`w-3 h-3 rounded-full inline-block ${semaforoInfo.bg} ${semaforoInfo.glow}`}
                  aria-label={`Semáforo ${semaforoInfo.label}`}
                />
                <span
                  className={`text-xs font-semibold uppercase tracking-wider ${semaforoInfo.text}`}
                >
                  {semaforoInfo.label}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>

        {/* Grid de Métricas Principais */}
        <CardContent className="pt-3 pb-3 space-y-2.5">
          {/* Bloco 1: Vento e Rajada */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Card Vento */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Wind className="w-3.5 h-3.5 text-sky-400" />
                  Vento
                </span>
                <span className="text-[10px] text-zinc-400 font-mono flex items-center gap-0.5">
                  <Compass className="w-3 h-3" />
                  {windDirLabel}
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white tracking-tight">
                    {windSpeed !== null ? windSpeed : '--'}
                  </span>
                  <span className="text-xs font-semibold text-zinc-400">kt</span>
                </div>

                {/* Seta de Direção do Vento */}
                <div
                  className="w-7 h-7 rounded-full bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-300"
                  title={`Direção do vento: ${windDirDeg}° (${windDirLabel})`}
                >
                  <Navigation2
                    className="w-4 h-4 transform transition-transform duration-500"
                    style={{ transform: `rotate(${arrowRotation}deg)` }}
                  />
                </div>
              </div>
            </div>

            {/* Card Rajada */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  Rajada
                </span>
                <span className="text-[10px] text-zinc-400">máx</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-black text-white tracking-tight">
                  {windGust !== null ? windGust : '--'}
                </span>
                <span className="text-xs font-semibold text-zinc-400">kt</span>
              </div>
            </div>
          </div>

          {/* Bloco 2: Onda e Período */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Card Onda */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="flex items-center text-zinc-400 text-xs font-medium gap-1">
                <Waves className="w-3.5 h-3.5 text-cyan-400" />
                <span>Onda</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-white tracking-tight">
                  {waveHeight !== null ? waveHeight : '--'}
                </span>
                <span className="text-xs font-semibold text-zinc-400">m</span>
              </div>
            </div>

            {/* Card Período */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="flex items-center text-zinc-400 text-xs font-medium gap-1">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span>Período</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-white tracking-tight">
                  {wavePeriod !== null ? wavePeriod : '--'}
                </span>
                <span className="text-xs font-semibold text-zinc-400">s</span>
              </div>
            </div>
          </div>

          {/* Bloco 3: Maré (MSL) e Chuva */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Card Maré */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-zinc-400 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Waves className="w-3.5 h-3.5 text-blue-400" />
                  Maré (MSL)
                </span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-white tracking-tight">
                  {seaLevel !== null ? (Number(seaLevel) > 0 ? `+${seaLevel}` : seaLevel) : '--'}
                </span>
                <span className="text-xs font-semibold text-zinc-400">m</span>
              </div>
            </div>

            {/* Card Chuva */}
            <div className="bg-[#161c24] border border-zinc-800/80 rounded-lg p-2.5 flex flex-col justify-between">
              <div className="flex items-center text-zinc-400 text-xs font-medium gap-1">
                <CloudRain className="w-3.5 h-3.5 text-indigo-400" />
                <span>Chuva</span>
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-xl font-bold text-white tracking-tight">{precip}</span>
                <span className="text-xs font-semibold text-zinc-400">mm</span>
              </div>
            </div>
          </div>
        </CardContent>
      </div>

      {/* Badge de Próxima Janela Ideal */}
      <div className="px-4 pb-3 pt-1 border-t border-zinc-800/60 bg-[#0d1218]/40">
        {loadingJanelas ? (
          <div className="h-5 bg-zinc-800/50 rounded animate-pulse w-48"></div>
        ) : proximaJanela ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
              <CalendarCheck className="w-3.5 h-3.5 text-emerald-400" />
              Próxima janela:
            </span>
            <Badge
              variant="outline"
              className="bg-emerald-950/60 text-emerald-300 border-emerald-700/60 font-semibold px-2 py-0.5 text-[11px]"
            >
              {formatarJanelaBadge(proximaJanela.inicio, proximaJanela.fim)} (
              {proximaJanela.score_medio} pts)
            </Badge>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5 text-zinc-500" />
              Próxima janela:
            </span>
            <span className="text-[11px] text-zinc-500 italic">
              Sem janelas ideais nos próximos 3 dias
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}
