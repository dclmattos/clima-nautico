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
} from '@/services/previsaoService'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Wind,
  Compass,
  Waves,
  Clock,
  CloudRain,
  Sun,
  Sunset,
  Thermometer,
  Gauge,
  Copy,
  Check,
  Eye,
  Calendar,
  Navigation,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Minus,
  RefreshCw,
  Droplets,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudLightning,
  CloudOff,
} from 'lucide-react'
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

  const { items: forecast48h } = useMemo(() => {
    return getNext48HoursForecast(previsao.hourly || [])
  }, [previsao.hourly])

  const diasResumo = useMemo(() => {
    return aggregate7DaysForecast(previsao.hourly || [], previsao.daily || [])
  }, [previsao.hourly, previsao.daily])

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

  const renderSkyIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'Sun':
        return <Sun className={className} />
      case 'CloudSun':
        return <CloudSun className={className} />
      case 'Cloud':
        return <Cloud className={className} />
      case 'CloudFog':
        return <CloudFog className={className} />
      case 'CloudDrizzle':
        return <CloudDrizzle className={className} />
      case 'CloudRain':
        return <CloudRain className={className} />
      case 'CloudLightning':
        return <CloudLightning className={className} />
      default:
        return <CloudOff className={className} />
    }
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
                <div className={`flex items-center gap-1 text-xs ${currentSkyCondition.color}`}>
                  {renderSkyIcon(currentSkyCondition.iconName, 'w-4 h-4 shrink-0')}
                  <span>{currentSkyCondition.label}</span>
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
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#0f141c] text-zinc-400 font-semibold border-b border-zinc-800">
                    <tr>
                      <th className="p-3">Horário</th>
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
                    {forecast48h.map((item, idx) => {
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

                      return (
                        <tr
                          key={idx}
                          className="hover:bg-[#1c2430] transition-colors text-zinc-200"
                        >
                          <td className="p-3 font-sans font-medium text-white whitespace-nowrap">
                            {formatHoraTabela(item.time)}
                          </td>
                          <td className="p-3 font-sans whitespace-nowrap">
                            <span className={`inline-flex items-center gap-1 text-xs ${sky.color}`}>
                              {renderSkyIcon(sky.iconName, 'w-4 h-4 shrink-0')}
                              <span>{sky.label}</span>
                            </span>
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
                          <td className="p-3 text-cyan-300 font-bold">{onda}</td>
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
            </TabsContent>

            {/* ABA 2: RESUMO 7 DIAS */}
            <TabsContent value="7dias" className="space-y-3 m-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {diasResumo.map((dia, idx) => {
                  const sky = getWeatherCondition(dia.weatherCode)
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                        dia.isHoje
                          ? 'bg-cyan-950/40 border-cyan-700/60 shadow-md'
                          : 'bg-[#161c24] border-zinc-800'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                        <span className="font-bold text-sm text-white flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                          {dia.nomeDia}
                        </span>
                        <span className="text-xs font-mono text-zinc-400">{dia.dataExibicao}</span>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Sun className="w-3 h-3 text-amber-400" /> Céu
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 font-medium ${sky.color}`}
                          >
                            {renderSkyIcon(sky.iconName, 'w-3.5 h-3.5 shrink-0')}
                            <span>{sky.label}</span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Wind className="w-3 h-3 text-sky-400" /> Vento Máx
                          </span>
                          <span className="font-mono font-bold text-white">
                            {dia.ventoMax !== null
                              ? `${dia.ventoMax} kt (F${dia.ventoMaxBeaufort})`
                              : '--'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <Waves className="w-3 h-3 text-cyan-400" /> Onda Máx
                          </span>
                          <span className="font-mono font-bold text-cyan-300">
                            {dia.ondaMax !== null
                              ? `${dia.ondaMax} m (G${dia.ondaMaxDouglas})`
                              : '--'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400 flex items-center gap-1">
                            <CloudRain className="w-3 h-3 text-indigo-400" /> Chuva Total
                          </span>
                          <span className="font-mono text-zinc-300">{dia.chuvaTotal} mm</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
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
