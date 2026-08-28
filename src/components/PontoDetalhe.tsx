import React, { useMemo, useState } from 'react'
import {
  PrevisaoPayload,
  PrevisaoHoraItem,
  ResumoDiaItem,
  Ponto,
  JanelasPayload,
} from '@/types/nautico'
import {
  formatPontoNome,
  formatTipoPonto,
  formatCoordinatesDMM,
  formatTimeHHMM,
  formatDaylightDuration,
  getBeaufortScale,
  getDouglasScale,
  getNext48HoursForecast,
  getCurrentHourForecast,
  aggregate7DaysForecast,
  PONTOS_DISPONIVEIS,
  getWeatherCondition,
  calcularScoreNavegacao,
  ScoreNavegacaoResult,
} from '@/services/previsaoService'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Wind,
  Compass,
  Waves,
  Clock,
  Sun,
  Sunset,
  Thermometer,
  Gauge,
  Copy,
  Check,
  Calendar,
  Navigation,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ShieldAlert,
} from 'lucide-react'
import { SkyConditionIcon } from '@/components/SkyConditionIcon'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'

interface PontoDetalheProps {
  currentSlug: string
  previsao: PrevisaoPayload
  onRefresh?: () => void
  isRefreshing?: boolean
  ponto?: Ponto
  janelasData?: JanelasPayload | null
  isPersonalizado?: boolean
}

export const PontoDetalhe: React.FC<PontoDetalheProps> = ({
  currentSlug,
  previsao,
  onRefresh,
  isRefreshing = false,
  ponto,
  janelasData,
  isPersonalizado = false,
}) => {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'48h' | '7dias'>('48h')
  const [sort48hScore, setSort48hScore] = useState<'none' | 'asc' | 'desc'>('none')
  const [sort7diasScore, setSort7diasScore] = useState<'none' | 'asc' | 'desc'>('none')

  const isCustom =
    isPersonalizado ||
    currentSlug.startsWith('custom-') ||
    (ponto && ponto.id.startsWith('custom-'))

  const pontoConfig = useMemo(() => {
    if (ponto) {
      const nomePontoFormatado = isCustom ? ponto.nome : formatPontoNome(ponto.nome)
      return {
        slug: currentSlug,
        nomeCurto: nomePontoFormatado,
        nomeCompleto: nomePontoFormatado,
        lat: ponto.lat,
        lon: ponto.lon,
        tipo: ponto.tipo,
      }
    }
    const canonico = PONTOS_DISPONIVEIS.find((p) => p.slug === currentSlug)
    if (canonico) {
      return {
        slug: currentSlug,
        nomeCurto: canonico.nomeCurto,
        nomeCompleto: canonico.nomeCompleto,
        lat: canonico.lat,
        lon: canonico.lon,
        tipo: canonico.tipo,
      }
    }
    const nomeBase = previsao.ponto_nome || currentSlug
    const nomeFormatado = isCustom ? nomeBase : formatPontoNome(nomeBase)
    return {
      slug: currentSlug,
      nomeCurto: nomeFormatado,
      nomeCompleto: nomeFormatado,
      lat: previsao.lat || -23.0,
      lon: previsao.lon || -44.0,
      tipo: (previsao.ponto_tipo as any) || 'abrigado',
    }
  }, [currentSlug, previsao, ponto, isCustom])

  const currentHourData = useMemo(() => {
    return previsao.hourly ? getCurrentHourForecast(previsao.hourly) : null
  }, [previsao.hourly])

  const currentSkyCondition = useMemo(() => {
    const weatherCode =
      currentHourData?.weather_code !== undefined && currentHourData?.weather_code !== null
        ? currentHourData.weather_code
        : previsao.weather_code !== undefined && previsao.weather_code !== null
          ? previsao.weather_code
          : null
    return getWeatherCondition(weatherCode)
  }, [currentHourData, previsao.weather_code])

  const { items: rawForecast48h } = useMemo(() => {
    return getNext48HoursForecast(previsao.hourly || [])
  }, [previsao.hourly])

  const forecast48hWithScore = useMemo(() => {
    return rawForecast48h.map((item, originalIndex) => {
      const scoreResult = calcularScoreNavegacao({
        windSpeed: item.wind_speed_10m,
        windGust: item.wind_gusts_10m,
        waveHeight: item.wave_height,
        precipitationProbability: item.precipitation_probability,
        precipitationMm: item.precipitation,
        weatherCode: item.weather_code,
        visibilityMeters: item.visibility,
      })
      return {
        item,
        scoreResult,
        originalIndex,
      }
    })
  }, [rawForecast48h])

  const sortedForecast48h = useMemo(() => {
    if (sort48hScore === 'none') return forecast48hWithScore
    const copy = [...forecast48hWithScore]
    copy.sort((a, b) => {
      const sA = a.scoreResult.score ?? -1
      const sB = b.scoreResult.score ?? -1
      if (sort48hScore === 'asc') {
        return sA - sB || a.originalIndex - b.originalIndex
      }
      return sB - sA || a.originalIndex - b.originalIndex
    })
    return copy
  }, [forecast48hWithScore, sort48hScore])

  const rawDiasResumo = useMemo(() => {
    return aggregate7DaysForecast(previsao.hourly || [], previsao.daily || [])
  }, [previsao.hourly, previsao.daily])

  const diasResumoWithScore = useMemo(() => {
    return rawDiasResumo.map((dia, originalIndex) => {
      const scoreResult = calcularScoreNavegacao({
        windSpeed: dia.ventoMax,
        windGust: dia.rajadaMax,
        waveHeight: dia.ondaMax,
        precipitationProbability: dia.probabilidadeChuvaMax,
        precipitationMm: dia.chuvaTotal,
        weatherCode: dia.weatherCode,
        visibilityMeters: dia.visibilidadeMin,
      })
      return {
        dia,
        scoreResult,
        originalIndex,
      }
    })
  }, [rawDiasResumo])

  const sortedDiasResumo = useMemo(() => {
    if (sort7diasScore === 'none') return diasResumoWithScore
    const copy = [...diasResumoWithScore]
    copy.sort((a, b) => {
      const sA = a.scoreResult.score ?? -1
      const sB = b.scoreResult.score ?? -1
      if (sort7diasScore === 'asc') {
        return sA - sB || a.originalIndex - b.originalIndex
      }
      return sB - sA || a.originalIndex - b.originalIndex
    })
    return copy
  }, [diasResumoWithScore, sort7diasScore])

  const astro = previsao.astronomia
  const marAtual = previsao.mar_atual
  const pressao = previsao.pressao_tendencia
  const rotas = previsao.rotas || []

  const coordsDMM = formatCoordinatesDMM(previsao.lat, previsao.lon)

  const handleCopyCoords = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(coordsDMM)
      setCopied(true)
      toast({
        title: 'Coordenadas copiadas!',
        description: `${pontoConfig.nomeCompleto}: ${coordsDMM}`,
        duration: 2000,
      })
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const getTipoBadgeStyle = (tipo: string) => {
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

  const getWindDirectionLabel = (deg: number | null | undefined) => {
    if (deg === null || deg === undefined) return '--'
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const idx = Math.round((deg % 360) / 45) % 8
    return dirs[idx]
  }

  const formatHoraTabela = (timeIso: string) => {
    try {
      const d = new Date(timeIso)
      const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
      const dia = dias[d.getDay()]
      const h = String(d.getHours()).padStart(2, '0') + 'h'
      return `${dia} ${h}`
    } catch {
      return timeIso.slice(11, 16)
    }
  }

  return (
    <div className="space-y-6 text-zinc-100">
      {/* Cabeçalho do Ponto Detalhe */}
      <Card className="bg-[#11161d] border-zinc-800 shadow-xl overflow-hidden">
        <CardHeader className="p-4 sm:p-6 pb-4 border-b border-zinc-800/80 bg-gradient-to-r from-[#11161d] via-[#141b24] to-[#11161d]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                  {isCustom && <span className="text-amber-400 text-2xl">⭐</span>}
                  {pontoConfig.nomeCompleto}
                </h1>
                <Badge
                  variant="outline"
                  className={`text-xs px-2.5 py-0.5 font-medium border ${getTipoBadgeStyle(
                    pontoConfig.tipo,
                  )}`}
                >
                  {formatTipoPonto(pontoConfig.tipo)}
                </Badge>
                <div className="flex items-center gap-1 text-xs">
                  <SkyConditionIcon
                    iconName={currentSkyCondition.iconName}
                    className="w-4 h-4 shrink-0"
                  />
                  <span className={currentSkyCondition.labelColor}>
                    {currentSkyCondition.label}
                  </span>
                </div>
              </div>

              {/* Coordenadas DMM */}
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                <Compass className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="select-all">{coordsDMM}</span>
                <button
                  type="button"
                  onClick={handleCopyCoords}
                  className="p-1 rounded text-zinc-400 hover:text-cyan-300 hover:bg-zinc-800 transition-colors"
                  title="Copiar coordenadas DMM"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* Ações / Atualizar */}
            {onRefresh && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-300 text-xs gap-1.5 self-start md:self-auto h-8"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
                />
                <span>Atualizar Previsão</span>
              </Button>
            )}
          </div>
        </CardHeader>

        {/* Visão Rápida em Tempo Real */}
        <CardContent className="p-4 sm:p-6 space-y-6">
          {/* Grid de Métricas Atuais (Pressão, Mar, Astronomia) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pressão Barométrica */}
            <div className="p-3.5 rounded-xl bg-[#161c24] border border-zinc-800 flex flex-col justify-between">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <Gauge className="w-4 h-4 text-cyan-400" />
                Pressão Barométrica
              </span>
              <div className="my-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white font-mono">
                    {pressao?.atual_hpa ?? '--'}
                  </span>
                  <span className="text-xs text-zinc-400 font-medium">hPa</span>
                </div>
                <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-1">
                  Tendência:
                  {pressao?.direcao === 'subindo' && (
                    <span className="text-emerald-400 font-semibold flex items-center">
                      <TrendingUp className="w-3.5 h-3.5 mr-0.5" /> +{pressao.delta_3h_hpa} hPa (3h)
                    </span>
                  )}
                  {pressao?.direcao === 'descendo' && (
                    <span
                      className={`font-semibold flex items-center ${
                        pressao.queda_severa ? 'text-red-400 animate-pulse' : 'text-amber-400'
                      }`}
                    >
                      <TrendingDown className="w-3.5 h-3.5 mr-0.5" /> {pressao.delta_3h_hpa} hPa
                      (3h)
                    </span>
                  )}
                  {pressao?.direcao === 'estável' && (
                    <span className="text-zinc-300 flex items-center">
                      <Minus className="w-3.5 h-3.5 mr-0.5" /> Estável
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Condição do Mar */}
            <div className="p-3.5 rounded-xl bg-[#161c24] border border-zinc-800 flex flex-col justify-between">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <Waves className="w-4 h-4 text-cyan-400" />
                Condição do Mar (Douglas)
              </span>
              <div className="my-2">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-black text-white font-mono">
                    Grau {marAtual?.douglas_grau ?? 0}
                  </span>
                </div>
                <p className="text-xs text-cyan-300 font-medium truncate">
                  {marAtual?.douglas_descricao || 'Calmo'}
                </p>
              </div>
              <div className="text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between">
                <span>Temp. da Água</span>
                <span className="font-mono font-bold text-white">
                  {marAtual?.temperatura_agua ? `${Math.round(marAtual.temperatura_agua)}°C` : '--'}
                </span>
              </div>
            </div>

            {/* Astronomia & Lua */}
            <div className="p-3.5 rounded-xl bg-[#161c24] border border-zinc-800 flex flex-col justify-between">
              <span className="text-xs text-zinc-400 flex items-center gap-1.5 font-medium">
                <Sun className="w-4 h-4 text-amber-400" />
                Sol & Lua
              </span>
              <div className="my-1 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Nascer / Pôr</span>
                  <span className="font-mono text-white">
                    {formatTimeHHMM(astro?.nascer_do_sol)} / {formatTimeHHMM(astro?.por_do_sol)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Luz Solar</span>
                  <span className="font-mono text-zinc-200">
                    {formatDaylightDuration(astro?.duracao_luz_segundos)}
                  </span>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-800/80 flex items-center justify-between">
                <span>Fase Lunar</span>
                <span className="text-zinc-200 font-medium flex items-center gap-1">
                  <span>{astro?.lua?.icone}</span>
                  {astro?.lua?.nome_fase} ({astro?.lua?.iluminacao_porcentagem}%)
                </span>
              </div>
            </div>
          </div>

          {/* Abas: Previsão 48 Horas x 7 Dias */}
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as any)}
            className="w-full space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <TabsList className="bg-[#161c24] border border-zinc-800">
                <TabsTrigger
                  value="48h"
                  className="data-[state=active]:bg-cyan-900/80 data-[state=active]:text-white text-xs"
                >
                  Horário (Próximas 48h)
                </TabsTrigger>
                <TabsTrigger
                  value="7dias"
                  className="data-[state=active]:bg-cyan-900/80 data-[state=active]:text-white text-xs"
                >
                  Resumo Diário (7 Dias)
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ABA 1: TABELA 48 HORAS */}
            <TabsContent value="48h" className="space-y-3 m-0">
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#161c24]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0f141c] text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-3 sticky left-0 z-10 bg-[#0f141c] shadow-[1px_0_0_0_rgba(39,39,42,0.8)]">
                        Horário
                      </th>
                      <th
                        className="p-3 sticky left-[90px] sm:left-[105px] z-10 bg-[#0f141c] shadow-[1px_0_0_0_rgba(39,39,42,0.8)] cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => {
                          setSort48hScore((prev) => {
                            if (prev === 'none') return 'desc'
                            if (prev === 'desc') return 'asc'
                            return 'none'
                          })
                        }}
                        title="Clique para ordenar por Score"
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Score</span>
                          {sort48hScore === 'desc' && (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          {sort48hScore === 'asc' && (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          {sort48hScore === 'none' && (
                            <ArrowUpDown className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                          )}
                        </div>
                      </th>
                      <th className="p-3">Céu</th>
                      <th className="p-3">Vento (kt)</th>
                      <th className="p-3">Rajada (kt)</th>
                      <th className="p-3">Direção</th>
                      <th className="p-3">Onda (m)</th>
                      <th className="p-3">Período (s)</th>
                      <th className="p-3">Maré (m)</th>
                      <th className="p-3">Chuva (mm/h)</th>
                      <th className="p-3">Temp (°C)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {sortedForecast48h.map(({ item, scoreResult }, idx) => {
                      const sky = getWeatherCondition(item.weather_code)
                      const vento =
                        item.wind_speed_10m !== null ? Math.round(item.wind_speed_10m) : '--'
                      const raj =
                        item.wind_gusts_10m !== null ? Math.round(item.wind_gusts_10m) : '--'
                      const dirLabel = getWindDirectionLabel(item.wind_direction_10m)
                      const onda = item.wave_height !== null ? item.wave_height.toFixed(1) : '--'
                      const per = item.wave_period !== null ? Math.round(item.wave_period) : '--'
                      const mare =
                        item.sea_level_height_msl !== null
                          ? (item.sea_level_height_msl >= 0 ? '+' : '') +
                            item.sea_level_height_msl.toFixed(2)
                          : '--'
                      const chuva =
                        item.precipitation !== null ? item.precipitation.toFixed(1) : '0.0'
                      const temp =
                        item.temperature_2m !== null ? Math.round(item.temperature_2m) : '--'

                      const isAjustado = !!item.wave_ajustado
                      const ondaBruta =
                        item.wave_height_bruto !== null && item.wave_height_bruto !== undefined
                          ? item.wave_height_bruto.toFixed(1)
                          : onda
                      const fatorTxt = item.fator_abrigo ? `×${item.fator_abrigo}` : '×0,4'
                      const tooltipOnda = isAjustado
                        ? `Onda ajustada pelo fator de abrigo (${fatorTxt}). Valor bruto original: ${ondaBruta} m`
                        : `Onda em mar aberto: ${onda} m`

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-[#1c2430] transition-colors text-zinc-200 group"
                        >
                          <td className="p-3 font-sans font-medium text-white whitespace-nowrap sticky left-0 z-10 bg-[#161c24] group-hover:bg-[#1c2430] shadow-[1px_0_0_0_rgba(39,39,42,0.8)]">
                            {formatHoraTabela(item.time)}
                          </td>
                          <td className="p-3 font-sans whitespace-nowrap sticky left-[90px] sm:left-[105px] z-10 bg-[#161c24] group-hover:bg-[#1c2430] shadow-[1px_0_0_0_rgba(39,39,42,0.8)]">
                            {scoreResult.hasData && scoreResult.score !== null ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-sans text-xs font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95 ${scoreResult.badgeColor}`}
                                  >
                                    <span>{scoreResult.score.toFixed(1)}</span>
                                    <span className="text-[10px] font-normal opacity-90">
                                      {scoreResult.faixa}
                                    </span>
                                    <Info className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="top"
                                  align="start"
                                  className="w-72 p-3 bg-[#11161d] border-zinc-700 text-zinc-100 text-xs shadow-2xl z-50 rounded-xl"
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                                      <span className="font-bold text-white flex items-center gap-1.5">
                                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                                        Como calculamos
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${scoreResult.badgeColor}`}
                                      >
                                        {scoreResult.score.toFixed(1)} · {scoreResult.faixa}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-tight">
                                      Base de 10 pontos com penalidades pelo pior valor do período:
                                    </p>
                                    <div className="space-y-1 pt-1 font-mono text-[11px]">
                                      {scoreResult.fatores.map((f, fIdx) => (
                                        <div
                                          key={fIdx}
                                          className={`flex items-start justify-between p-1 rounded ${
                                            f.penalidade < 0 || f.cap !== undefined
                                              ? 'bg-zinc-800/60 text-zinc-200'
                                              : 'text-zinc-400'
                                          }`}
                                        >
                                          <span className="font-sans pr-2 leading-tight">
                                            {f.descricao}
                                          </span>
                                        </div>
                                      ))}
                                      {scoreResult.fatores.length === 0 && (
                                        <div className="text-emerald-400 font-sans text-xs">
                                          Condições ideais: nenhuma penalidade aplicada.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-zinc-500 font-mono">—</span>
                            )}
                          </td>
                          <td className="p-3 font-sans whitespace-nowrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="inline-flex items-center justify-center cursor-help focus:outline-none"
                                  tabIndex={0}
                                  role="img"
                                  aria-label={sky.label}
                                  title={sky.label}
                                >
                                  <SkyConditionIcon
                                    iconName={sky.iconName}
                                    className="w-5 h-5 shrink-0"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-[#11161d] border-zinc-700 text-zinc-100 text-xs px-2.5 py-1 shadow-lg font-medium"
                              >
                                {sky.label}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-3 font-bold text-sky-300">{vento}</td>
                          <td className="p-3 text-amber-400">{raj}</td>
                          <td className="p-3 font-sans flex items-center gap-1 text-zinc-300">
                            <Compass
                              className="w-3 h-3 text-sky-400 shrink-0"
                              style={{ transform: `rotate(${item.wind_direction_10m ?? 0}deg)` }}
                            />
                            {dirLabel}
                          </td>
                          <td className="p-3 text-cyan-300 font-bold" title={tooltipOnda}>
                            <span className="inline-flex items-center gap-1">
                              <span>{onda}</span>
                              {isAjustado && (
                                <span
                                  className="text-[10px] text-zinc-500 font-normal font-sans"
                                  title={tooltipOnda}
                                  aria-label={tooltipOnda}
                                >
                                  ajust.
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="p-3 text-zinc-400">{per}</td>
                          <td className="p-3 text-indigo-300">{mare}</td>
                          <td className="p-3 text-zinc-400">{chuva}</td>
                          <td className="p-3 text-zinc-300">{temp}°</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 rounded-lg bg-[#141a22] border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  O score é um indicativo automático e não substitui os avisos de mau tempo da
                  Marinha (CHM) e a avaliação do comandante.
                </span>
              </div>
            </TabsContent>

            {/* ABA 2: RESUMO 7 DIAS */}
            <TabsContent value="7dias" className="space-y-3 m-0">
              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-[#161c24]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#0f141c] text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-3 sticky left-0 z-10 bg-[#0f141c] shadow-[1px_0_0_0_rgba(39,39,42,0.8)]">
                        Data / Dia
                      </th>
                      <th
                        className="p-3 sticky left-[110px] sm:left-[130px] z-10 bg-[#0f141c] shadow-[1px_0_0_0_rgba(39,39,42,0.8)] cursor-pointer select-none hover:text-white transition-colors"
                        onClick={() => {
                          setSort7diasScore((prev) => {
                            if (prev === 'none') return 'desc'
                            if (prev === 'desc') return 'asc'
                            return 'none'
                          })
                        }}
                        title="Clique para ordenar por Score"
                      >
                        <div className="inline-flex items-center gap-1">
                          <span>Score</span>
                          {sort7diasScore === 'desc' && (
                            <ArrowDown className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          {sort7diasScore === 'asc' && (
                            <ArrowUp className="w-3.5 h-3.5 text-cyan-400" />
                          )}
                          {sort7diasScore === 'none' && (
                            <ArrowUpDown className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                          )}
                        </div>
                      </th>
                      <th className="p-3">Céu</th>
                      <th className="p-3">Temp</th>
                      <th className="p-3">Vento Máx</th>
                      <th className="p-3">Onda Máx</th>
                      <th className="p-3">Chuva Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono">
                    {sortedDiasResumo.map(({ dia, scoreResult }, idx) => {
                      const sky = getWeatherCondition(dia.weatherCode)
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-[#1c2430] transition-colors text-zinc-200 group ${
                            dia.isHoje ? 'bg-cyan-950/25' : ''
                          }`}
                        >
                          <td
                            className={`p-3 font-sans font-medium text-white whitespace-nowrap sticky left-0 z-10 bg-[#161c24] group-hover:bg-[#1c2430] shadow-[1px_0_0_0_rgba(39,39,42,0.8)] ${dia.isHoje ? 'bg-[#142330]' : ''}`}
                          >
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className={dia.isHoje ? 'text-cyan-300 font-bold' : ''}>
                                {dia.nomeDia}
                              </span>
                              <span className="text-zinc-400 font-mono text-[11px]">
                                ({dia.dataExibicao})
                              </span>
                            </span>
                          </td>
                          <td
                            className={`p-3 font-sans whitespace-nowrap sticky left-[110px] sm:left-[130px] z-10 bg-[#161c24] group-hover:bg-[#1c2430] shadow-[1px_0_0_0_rgba(39,39,42,0.8)] ${dia.isHoje ? 'bg-[#142330]' : ''}`}
                          >
                            {scoreResult.hasData && scoreResult.score !== null ? (
                              <Popover>
                                <PopoverTrigger asChild>
                                  <button
                                    type="button"
                                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-sans text-xs font-semibold cursor-pointer transition-transform hover:scale-105 active:scale-95 ${scoreResult.badgeColor}`}
                                  >
                                    <span>{scoreResult.score.toFixed(1)}</span>
                                    <span className="text-[10px] font-normal opacity-90">
                                      {scoreResult.faixa}
                                    </span>
                                    <Info className="w-2.5 h-2.5 opacity-70 ml-0.5" />
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent
                                  side="top"
                                  align="start"
                                  className="w-72 p-3 bg-[#11161d] border-zinc-700 text-zinc-100 text-xs shadow-2xl z-50 rounded-xl"
                                >
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
                                      <span className="font-bold text-white flex items-center gap-1.5">
                                        <Compass className="w-3.5 h-3.5 text-cyan-400" />
                                        Como calculamos
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] px-1.5 py-0 ${scoreResult.badgeColor}`}
                                      >
                                        {scoreResult.score.toFixed(1)} · {scoreResult.faixa}
                                      </Badge>
                                    </div>
                                    <p className="text-[11px] text-zinc-400 leading-tight">
                                      Base de 10 pontos com penalidades pelo pior valor do dia:
                                    </p>
                                    <div className="space-y-1 pt-1 font-mono text-[11px]">
                                      {scoreResult.fatores.map((f, fIdx) => (
                                        <div
                                          key={fIdx}
                                          className={`flex items-start justify-between p-1 rounded ${
                                            f.penalidade < 0 || f.cap !== undefined
                                              ? 'bg-zinc-800/60 text-zinc-200'
                                              : 'text-zinc-400'
                                          }`}
                                        >
                                          <span className="font-sans pr-2 leading-tight">
                                            {f.descricao}
                                          </span>
                                        </div>
                                      ))}
                                      {scoreResult.fatores.length === 0 && (
                                        <div className="text-emerald-400 font-sans text-xs">
                                          Condições ideais: nenhuma penalidade aplicada.
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </PopoverContent>
                              </Popover>
                            ) : (
                              <span className="text-zinc-500 font-mono">—</span>
                            )}
                          </td>
                          <td className="p-3 font-sans whitespace-nowrap">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="inline-flex items-center justify-center cursor-help focus:outline-none"
                                  tabIndex={0}
                                  role="img"
                                  aria-label={sky.label}
                                  title={sky.label}
                                >
                                  <SkyConditionIcon
                                    iconName={sky.iconName}
                                    className="w-5 h-5 shrink-0"
                                  />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent
                                side="top"
                                className="bg-[#11161d] border-zinc-700 text-zinc-100 text-xs px-2.5 py-1 shadow-lg font-medium"
                              >
                                {sky.label}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="p-3 whitespace-nowrap font-mono">
                            {dia.temperaturaMax !== null && dia.temperaturaMax !== undefined ? (
                              <span>
                                <span className="font-bold text-white">{dia.temperaturaMax}°</span>
                                <span className="text-zinc-500 mx-1">/</span>
                                <span className="text-zinc-400">
                                  {dia.temperaturaMin !== null && dia.temperaturaMin !== undefined
                                    ? `${dia.temperaturaMin}°`
                                    : '--'}
                                </span>
                              </span>
                            ) : (
                              <span className="text-zinc-500">--</span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-bold text-sky-300">
                              {dia.ventoMax !== null ? `${dia.ventoMax} kt` : '--'}
                            </span>
                            {dia.ventoMax !== null && (
                              <span className="text-zinc-400 text-[11px] ml-1">
                                (F{dia.ventoMaxBeaufort})
                              </span>
                            )}
                          </td>
                          <td className="p-3 whitespace-nowrap">
                            <span className="font-bold text-cyan-300">
                              {dia.ondaMax !== null ? `${dia.ondaMax} m` : '--'}
                            </span>
                            {dia.ondaMax !== null && (
                              <span className="text-zinc-400 text-[11px] ml-1">
                                (G{dia.ondaMaxDouglas})
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-zinc-400 whitespace-nowrap">
                            {dia.chuvaTotal} mm
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="p-3 rounded-lg bg-[#141a22] border border-zinc-800/80 text-[11px] text-zinc-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  O score é um indicativo automático e não substitui os avisos de mau tempo da
                  Marinha (CHM) e a avaliação do comandante.
                </span>
              </div>
            </TabsContent>
          </Tabs>

          {/* Bloco de Rotas e Navegação Estimada */}
          {rotas.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-zinc-800">
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Rotas & Rumos Náuticos a partir deste ponto
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {rotas.map((r, idx) => (
                  <div
                    key={idx}
                    onClick={() => navigate(`/ponto/${r.ponto_slug}`)}
                    className="p-3 rounded-xl bg-[#161c24] border border-zinc-800 hover:border-cyan-600 hover:bg-[#1a232e] transition-colors cursor-pointer flex items-center justify-between gap-2 group"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-cyan-300 truncate">
                        {r.ponto_nome}
                      </p>
                      <div className="text-[11px] font-mono text-zinc-400 flex items-center gap-2">
                        <span className="text-cyan-300 font-semibold">{r.distancia_nm} NM</span>
                        <span>•</span>
                        <span>
                          Rumo {r.rumo_graus}° ({r.direcao_cardinal})
                        </span>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PontoDetalhe
