import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PrevisaoPayload } from '@/types/nautico'
import {
  PONTOS_DISPONIVEIS,
  formatTipoPonto,
  getNext48HoursForecast,
  getWindDirectionLabel,
  aggregate7DaysForecast,
  getBeaufortScale,
  getDouglasScale,
  formatTimeHHMM,
  formatDaylightDuration,
  formatCoordinatesDMM,
} from '@/services/previsaoService'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Wind,
  Waves,
  CloudRain,
  Navigation2,
  Calendar,
  Table as TableIcon,
  Activity,
  ArrowLeft,
  RotateCw,
  Compass,
  Sunrise,
  Sunset,
  Sun,
  Moon,
  Route,
  Droplets,
  Thermometer,
  Shield,
  Clock,
  ArrowUpRight,
} from 'lucide-react'

interface PontoDetalheProps {
  currentSlug: string
  previsao: PrevisaoPayload
  onRefresh?: () => void
  isRefreshing?: boolean
}

export const PontoDetalhe: React.FC<PontoDetalheProps> = ({
  currentSlug,
  previsao,
  onRefresh,
  isRefreshing = false,
}) => {
  const navigate = useNavigate()

  // Ponto atual metadados
  const pontoConfig = useMemo(() => {
    return (
      PONTOS_DISPONIVEIS.find((p) => p.slug === currentSlug) || {
        slug: currentSlug,
        nomeCurto: previsao.ponto_nome || currentSlug,
        nomeCompleto: previsao.ponto_nome || currentSlug,
        lat: previsao.lat || -23.0,
        lon: previsao.lon || -44.0,
        tipo: previsao.ponto_tipo || 'abrigado',
      }
    )
  }, [currentSlug, previsao])

  // Filtragem e preparação de 48 horas a partir de agora
  const { items: forecast48h } = useMemo(() => {
    return getNext48HoursForecast(previsao.hourly || [])
  }, [previsao.hourly])

  // Dados para gráficos de 48h (com Beaufort Fx)
  const chartData48h = useMemo(() => {
    return forecast48h.map((item, idx) => {
      const date = new Date(item.time)
      const horaStr = date.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const diaStr = `${date.getDate()}/${date.getMonth() + 1}`
      const bft =
        item.beaufort !== undefined ? item.beaufort : getBeaufortScale(item.wind_speed_10m)

      return {
        id: idx,
        time: item.time,
        displayLabel: `${horaStr}`,
        fullLabel: `${diaStr} ${horaStr}`,
        wind_speed: item.wind_speed_10m !== null ? Math.round(item.wind_speed_10m * 10) / 10 : null,
        wind_gusts: item.wind_gusts_10m !== null ? Math.round(item.wind_gusts_10m * 10) / 10 : null,
        beaufort: bft,
        wave_height: item.wave_height !== null ? Math.round(item.wave_height * 100) / 100 : null,
        sea_level:
          item.sea_level_height_msl !== null
            ? Math.round(item.sea_level_height_msl * 100) / 100
            : null,
        wind_dir: item.wind_direction_10m,
        precipitation: item.precipitation !== null ? Math.round(item.precipitation * 10) / 10 : 0,
      }
    })
  }, [forecast48h])

  // Resumo dos 7 dias
  const resumo7Dias = useMemo(() => {
    return aggregate7DaysForecast(previsao.hourly || [])
  }, [previsao.hourly])

  // Cor do badge por tipo
  const getTipoBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case 'abrigado':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/70'
      case 'semi':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-800/70'
      case 'aberto':
        return 'bg-slate-800 text-slate-300 border-slate-700'
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700'
    }
  }

  // Mudança de ponto
  const handlePontoChange = (newSlug: string) => {
    if (newSlug !== currentSlug) {
      navigate(`/ponto/${newSlug}`)
    }
  }

  // Dados astronômicos
  const astronomia = previsao.astronomia
  const sunriseStr = formatTimeHHMM(astronomia?.nascer_do_sol)
  const sunsetStr = formatTimeHHMM(astronomia?.por_do_sol)
  const durationStr = formatDaylightDuration(astronomia?.duracao_luz_segundos)
  const crepMatutinoStr = formatTimeHHMM(astronomia?.crepusculo_nautico_matutino)
  const crepVespertinoStr = formatTimeHHMM(astronomia?.crepusculo_nautico_vespertino)
  const moonInfo = astronomia?.lua || {
    fase: 0,
    iluminacao_porcentagem: 0,
    nome_fase: 'Lua Nova',
    icone: '🌑',
  }

  // Dados de Mar
  const mar = previsao.mar_atual
  const currentHourItem = forecast48h[0] || null
  const swellDir = mar?.swell_direcao ?? currentHourItem?.swell_wave_direction ?? null
  const swellPeriod = mar?.swell_periodo ?? currentHourItem?.swell_wave_period ?? null
  const windWaveH = mar?.onda_vento_altura ?? currentHourItem?.wind_wave_height ?? null
  const currentVel = mar?.corrente_velocidade ?? currentHourItem?.ocean_current_velocity ?? null
  const currentDir = mar?.corrente_direcao ?? currentHourItem?.ocean_current_direction ?? null
  const tempAgua = mar?.temperatura_agua ?? currentHourItem?.sea_surface_temperature ?? null

  const waveH = currentHourItem?.wave_height ?? null
  const douglasCalc = mar?.douglas_descricao
    ? { grau: mar.douglas_grau, descricao: mar.douglas_descricao }
    : getDouglasScale(waveH)

  // Rotas para os outros 3 pontos
  const rotas = previsao.rotas || []

  return (
    <div className="space-y-6 sm:space-y-8 pb-10">
      {/* 1. SELETOR DE PONTO NO TOPO & CABEÇALHO */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg">
        {/* Barra superior de navegação / Voltar */}
        <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-zinc-800/80">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/')}
            className="text-zinc-400 hover:text-white hover:bg-zinc-800/60 text-xs sm:text-sm -ml-2 gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Todos os pontos</span>
          </Button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="bg-[#161c24] border-zinc-700 text-zinc-300 hover:text-white text-xs gap-1.5 h-8"
              title="Atualizar dados deste ponto"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          )}
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Informações do Ponto Selecionado */}
          <div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {pontoConfig.nomeCompleto}
              </h2>
              <Badge
                variant="outline"
                className={`text-xs px-2.5 py-0.5 font-medium border ${getTipoBadgeStyle(
                  pontoConfig.tipo,
                )}`}
              >
                {formatTipoPonto(pontoConfig.tipo)}
              </Badge>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center gap-1.5 font-mono">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>{formatCoordinatesDMM(previsao.lat, previsao.lon)}</span>
            </p>
          </div>

          {/* Seletor: Dropdown no Mobile, Tabs no Desktop */}
          <div className="w-full md:w-auto shrink-0">
            {/* Desktop Tabs */}
            <div className="hidden sm:block">
              <Tabs value={currentSlug} onValueChange={handlePontoChange}>
                <TabsList className="bg-[#0a0e14] border border-zinc-800 p-1">
                  {PONTOS_DISPONIVEIS.map((p) => (
                    <TabsTrigger
                      key={p.slug}
                      value={p.slug}
                      className="text-xs px-3 py-1.5 data-[state=active]:bg-cyan-950 data-[state=active]:text-cyan-300 data-[state=active]:border data-[state=active]:border-cyan-700/60"
                    >
                      {p.nomeCurto}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Mobile Dropdown Select */}
            <div className="sm:hidden w-full">
              <Select value={currentSlug} onValueChange={handlePontoChange}>
                <SelectTrigger className="w-full bg-[#161c24] border-zinc-700 text-zinc-200">
                  <SelectValue placeholder="Selecione um ponto" />
                </SelectTrigger>
                <SelectContent className="bg-[#161c24] border-zinc-700 text-zinc-200">
                  {PONTOS_DISPONIVEIS.map((p) => (
                    <SelectItem
                      key={p.slug}
                      value={p.slug}
                      className="focus:bg-zinc-800 focus:text-white"
                    >
                      {p.nomeCurto} ({formatTipoPonto(p.tipo)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </section>

      {/* 2. GRÁFICO DE LINHA — VENTO, RAJADA E ONDA (48 HORAS) */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-sky-950/60 border border-sky-800/50 flex items-center justify-center text-sky-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Vento, Rajada e Altura de Onda (48h)
              </h3>
              <p className="text-xs text-zinc-400">
                Eixo esquerdo: Vento e Rajada (kt) · Eixo direito: Onda (m)
              </p>
            </div>
          </div>
        </div>

        {chartData48h.length > 0 ? (
          <div className="w-full h-[280px] sm:h-[340px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData48h} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#272f3d" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={25}
                />
                {/* Eixo Y Esquerdo: Nós (kt) */}
                <YAxis
                  yAxisId="left"
                  stroke="#60a5fa"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit=" kt"
                  domain={[0, 'dataMax + 4']}
                />
                {/* Eixo Y Direito: Metros de Onda (m) */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#34d399"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit=" m"
                  domain={[0, 'dataMax + 0.5']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const currentItem = chartData48h.find((d) => d.displayLabel === label)
                      const windVal = payload.find((p) => p.dataKey === 'wind_speed')?.value
                      const bftVal = currentItem?.beaufort ?? getBeaufortScale(Number(windVal))

                      return (
                        <div className="bg-[#0f141c] border border-zinc-700/80 rounded-lg p-3 shadow-xl text-xs space-y-1.5 min-w-[170px]">
                          <p className="font-semibold text-zinc-300 pb-1 border-b border-zinc-800">
                            {currentItem?.fullLabel || label}
                          </p>
                          <div className="flex items-center justify-between text-[#60a5fa]">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-2.5 h-0.5 bg-[#60a5fa] inline-block" />
                              Vento:
                            </span>
                            <span className="font-bold">
                              {windVal ?? '--'} kt (F{bftVal})
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[#818cf8]">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-2.5 h-0.5 border-t border-dashed border-[#818cf8] inline-block" />
                              Rajada:
                            </span>
                            <span className="font-bold">
                              {payload.find((p) => p.dataKey === 'wind_gusts')?.value ?? '--'} kt
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[#34d399]">
                            <span className="flex items-center gap-1.5 font-medium">
                              <span className="w-2.5 h-0.5 bg-[#34d399] inline-block" />
                              Onda:
                            </span>
                            <span className="font-bold">
                              {payload.find((p) => p.dataKey === 'wave_height')?.value ?? '--'} m
                            </span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }}
                  formatter={(value) => {
                    if (value === 'wind_speed')
                      return <span className="text-zinc-300">Vento (kt / Beaufort)</span>
                    if (value === 'wind_gusts')
                      return <span className="text-zinc-300">Rajada (kt)</span>
                    if (value === 'wave_height')
                      return <span className="text-zinc-300">Altura da Onda (m)</span>
                    return value
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_speed"
                  name="wind_speed"
                  stroke="#60a5fa"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#60a5fa', strokeWidth: 2, fill: '#0a0e14' }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="wind_gusts"
                  name="wind_gusts"
                  stroke="#818cf8"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                  activeDot={{ r: 4, stroke: '#818cf8', strokeWidth: 2, fill: '#0a0e14' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="wave_height"
                  name="wave_height"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4, stroke: '#34d399', strokeWidth: 2, fill: '#0a0e14' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-zinc-500 text-sm">
            Sem dados horários suficientes para exibir o gráfico de vento e ondas.
          </div>
        )}
      </section>

      {/* 3. GRÁFICO DE ÁREA — MARÉ (SEA_LEVEL_HEIGHT_MSL) */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-zinc-800/70">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
              <Waves className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Variação de Maré — 48h
              </h3>
              <p className="text-xs text-zinc-400">
                Nível do mar relativo ao nível médio (MSL) em metros
              </p>
            </div>
          </div>
        </div>

        {chartData48h.length > 0 ? (
          <div className="w-full h-[200px] sm:h-[240px] pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData48h} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorMare" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#272f3d" vertical={false} />
                <XAxis
                  dataKey="displayLabel"
                  stroke="#71717a"
                  fontSize={11}
                  tickLine={false}
                  minTickGap={25}
                />
                <YAxis
                  stroke="#38bdf8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  unit=" m"
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const val = payload[0].value
                      const currentItem = chartData48h.find((d) => d.displayLabel === label)
                      return (
                        <div className="bg-[#0f141c] border border-zinc-700/80 rounded-lg p-2.5 shadow-xl text-xs space-y-1 min-w-[150px]">
                          <p className="font-semibold text-zinc-300 pb-1 border-b border-zinc-800">
                            {currentItem?.fullLabel || label}
                          </p>
                          <div className="flex items-center justify-between text-[#38bdf8]">
                            <span className="font-medium">Nível Maré:</span>
                            <span className="font-bold font-mono">
                              {val !== null && val !== undefined
                                ? `${Number(val) > 0 ? `+${val}` : val} m`
                                : '--'}
                            </span>
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="sea_level"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorMare)"
                  activeDot={{ r: 4, stroke: '#38bdf8', strokeWidth: 2, fill: '#0a0e14' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-36 flex items-center justify-center text-zinc-500 text-sm">
            Sem dados de maré disponíveis para exibição.
          </div>
        )}
      </section>

      {/* 4. TABELA HORÁRIA COM SCROLL (MAX-HEIGHT ~400PX, STICKY HEADER, ZEBRA) */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/70">
          <div className="w-7 h-7 rounded-lg bg-teal-950/60 border border-teal-800/50 flex items-center justify-center text-teal-400">
            <TableIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Previsão Horária Detalhada (48h)
            </h3>
            <p className="text-xs text-zinc-400">
              Tabela de dados hora a hora com escala Beaufort, direção cardinal e destaque da hora
              atual
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-zinc-800/80 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-[#161c24] text-zinc-300 uppercase tracking-wider font-semibold sticky top-0 z-10 border-b border-zinc-800">
                <tr>
                  <th className="py-2.5 px-3 whitespace-nowrap">Hora</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Vento (kt / Bft)</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-center">Direção</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Rajada</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Onda</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Período</th>
                  <th className="py-2.5 px-3 whitespace-nowrap text-right">Chuva</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {forecast48h.map((horaItem, index) => {
                  const date = new Date(horaItem.time)
                  const horaStr = date.toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  const diaStr = `${date.getDate()}/${date.getMonth() + 1}`
                  const isFirstHour = index === 0
                  const dirCardinal = getWindDirectionLabel(horaItem.wind_direction_10m)
                  const deg = horaItem.wind_direction_10m ?? 0
                  const bft =
                    horaItem.beaufort !== undefined
                      ? horaItem.beaufort
                      : getBeaufortScale(horaItem.wind_speed_10m)

                  return (
                    <tr
                      key={horaItem.time}
                      className={`transition-colors ${
                        isFirstHour
                          ? 'bg-cyan-950/40 text-cyan-100 font-semibold border-l-2 border-l-cyan-400'
                          : index % 2 === 0
                            ? 'bg-[#11161d] hover:bg-zinc-800/40'
                            : 'bg-[#141a22] hover:bg-zinc-800/40'
                      }`}
                    >
                      {/* Hora */}
                      <td className="py-2 px-3 whitespace-nowrap font-mono text-zinc-300">
                        <span className="text-zinc-500 mr-1 text-[10px]">{diaStr}</span>
                        <span>{horaStr}</span>
                        {isFirstHour && (
                          <span className="ml-1.5 inline-block text-[9px] uppercase px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-700/60">
                            Agora
                          </span>
                        )}
                      </td>

                      {/* Vento (kt / Beaufort) */}
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[#60a5fa]">
                        {horaItem.wind_speed_10m !== null ? (
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span>
                              {(Math.round(horaItem.wind_speed_10m * 10) / 10).toFixed(1)} kt
                            </span>
                            <span className="text-[10px] px-1 py-0 rounded bg-sky-950 text-sky-300 border border-sky-800/50 font-bold">
                              F{bft}
                            </span>
                          </span>
                        ) : (
                          '--'
                        )}
                      </td>

                      {/* Direção */}
                      <td className="py-2 px-3 whitespace-nowrap text-center">
                        <div className="inline-flex items-center gap-1 text-zinc-300 font-medium">
                          <Navigation2
                            className="w-3 h-3 text-sky-400 inline-block transform"
                            style={{ transform: `rotate(${deg}deg)` }}
                          />
                          <span className="font-mono text-[11px]">{dirCardinal}</span>
                        </div>
                      </td>

                      {/* Rajada (kt) */}
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[#818cf8]">
                        {horaItem.wind_gusts_10m !== null
                          ? `${(Math.round(horaItem.wind_gusts_10m * 10) / 10).toFixed(1)} kt`
                          : '--'}
                      </td>

                      {/* Onda (m) */}
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-[#34d399]">
                        {horaItem.wave_height !== null
                          ? `${(Math.round(horaItem.wave_height * 100) / 100).toFixed(2)} m`
                          : '--'}
                      </td>

                      {/* Período (s) */}
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-zinc-400">
                        {horaItem.wave_period !== null
                          ? `${(Math.round(horaItem.wave_period * 10) / 10).toFixed(1)} s`
                          : '--'}
                      </td>

                      {/* Chuva (mm) */}
                      <td className="py-2 px-3 whitespace-nowrap text-right font-mono text-indigo-300">
                        {horaItem.precipitation !== null
                          ? `${(Math.round(horaItem.precipitation * 10) / 10).toFixed(1)} mm`
                          : '0.0 mm'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 5. CARDS DIÁRIOS (7 DIAS) COM BEAUFORT */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/70">
          <div className="w-7 h-7 rounded-lg bg-indigo-950/60 border border-indigo-800/50 flex items-center justify-center text-indigo-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Previsão Diária (Próximos 7 Dias)
            </h3>
            <p className="text-xs text-zinc-400">
              Vento máx com Beaufort, onda máx e precipitação acumulada
            </p>
          </div>
        </div>

        {/* Linha horizontal com scroll suave */}
        <div className="flex items-stretch gap-3 overflow-x-auto pb-2 pt-1 scrollbar-thin">
          {resumo7Dias.map((dia) => {
            const bftDia =
              dia.ventoMaxBeaufort !== undefined
                ? dia.ventoMaxBeaufort
                : getBeaufortScale(dia.ventoMax)

            return (
              <div
                key={dia.dataIso}
                className={`min-w-[145px] flex-1 sm:min-w-[150px] rounded-xl p-3.5 flex flex-col justify-between transition-all ${
                  dia.isHoje
                    ? 'bg-cyan-950/30 border-2 border-cyan-600/70 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                    : 'bg-[#161c24] border border-zinc-800/90 hover:border-zinc-700'
                }`}
              >
                {/* Header do Card */}
                <div className="border-b border-zinc-800/80 pb-2 mb-2 flex items-center justify-between">
                  <div>
                    <span
                      className={`text-sm font-bold block ${
                        dia.isHoje ? 'text-cyan-300' : 'text-zinc-100'
                      }`}
                    >
                      {dia.nomeDia}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-mono">{dia.dataExibicao}</span>
                  </div>
                  {dia.isHoje && (
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                  )}
                </div>

                {/* Métricas */}
                <div className="space-y-2 text-xs">
                  {/* Vento máx com Beaufort */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <Wind className="w-3 h-3 text-[#60a5fa]" />
                      Vento máx
                    </span>
                    <span className="font-bold text-zinc-200 font-mono inline-flex items-center gap-1">
                      <span>{dia.ventoMax !== null ? `${dia.ventoMax} kt` : '--'}</span>
                      {dia.ventoMax !== null && (
                        <span className="text-[9px] px-1 py-0 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800/50">
                          F{bftDia}
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Onda máx */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <Waves className="w-3 h-3 text-[#34d399]" />
                      Onda máx
                    </span>
                    <span className="font-bold text-zinc-200 font-mono">
                      {dia.ondaMax !== null ? `${dia.ondaMax} m` : '--'}
                    </span>
                  </div>

                  {/* Chuva total */}
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-400 text-[11px] flex items-center gap-1">
                      <CloudRain className="w-3 h-3 text-indigo-400" />
                      Chuva
                    </span>
                    <span className="font-bold text-zinc-200 font-mono">
                      {dia.chuvaTotal > 0 ? `${dia.chuvaTotal} mm` : '0 mm'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 6. BLOCO ASTRONOMIA */}
      {/* ========================================================================= */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/70">
          <div className="w-7 h-7 rounded-lg bg-amber-950/60 border border-amber-800/50 flex items-center justify-center text-amber-400">
            <Sun className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Astronomia & Iluminação
            </h3>
            <p className="text-xs text-zinc-400">
              Ciclo solar diurno, crepúsculo náutico (sol 12° abaixo do horizonte) e fases da lua
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Card Sol e Luz do Dia */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                Sol & Duração do Dia
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Sunrise className="w-3.5 h-3.5 text-amber-400" />
                  Nascer do Sol
                </span>
                <span className="font-mono font-bold text-zinc-100">{sunriseStr}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Sunset className="w-3.5 h-3.5 text-orange-400" />
                  Pôr do Sol
                </span>
                <span className="font-mono font-bold text-zinc-100">{sunsetStr}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/70">
                <span className="text-zinc-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  Luz do Dia
                </span>
                <span className="font-mono font-semibold text-amber-300">{durationStr}</span>
              </div>
            </div>
          </div>

          {/* Card Crepúsculo Náutico */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
              <span className="flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-sky-400" />
                Crepúsculo Náutico
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Horizonte visível</span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Matutino (alvorecer):</span>
                <span className="font-mono font-bold text-sky-300">{crepMatutinoStr}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Vespertino (anoitecer):</span>
                <span className="font-mono font-bold text-sky-300">{crepVespertinoStr}</span>
              </div>
              <p className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/70 leading-tight">
                Período em que o horizonte marinho e estrelas de referência são visíveis a olho nu.
              </p>
            </div>
          </div>

          {/* Card Lua */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-3 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between text-xs font-semibold text-purple-300">
              <span className="flex items-center gap-1.5">
                <Moon className="w-4 h-4 text-purple-400" />
                Fase da Lua
              </span>
              <span className="text-xl" role="img" aria-label={moonInfo.nome_fase}>
                {moonInfo.icone}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Fase Atual:</span>
                <span className="font-bold text-zinc-100">{moonInfo.nome_fase}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Iluminação:</span>
                <span className="font-mono font-bold text-purple-300">
                  {moonInfo.iluminacao_porcentagem}%
                </span>
              </div>
              {/* Barra de progresso de iluminação */}
              <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-purple-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${moonInfo.iluminacao_porcentagem}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 7. BLOCO MAR & DINÂMICA OCEÂNICA */}
      {/* ========================================================================= */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/70">
          <div className="w-7 h-7 rounded-lg bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400">
            <Waves className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Condições do Mar & Ondulação
            </h3>
            <p className="text-xs text-zinc-400">
              Estado de mar na Escala Douglas, swell de fundo, ondas de vento e corrente marinha
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Card Estado Douglas */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-cyan-300">
              <span className="flex items-center gap-1.5">
                <Waves className="w-4 h-4 text-cyan-400" />
                Escala Douglas
              </span>
              <Badge
                variant="outline"
                className="bg-cyan-950 border-cyan-700/60 text-cyan-300 text-[10px] font-bold"
              >
                Grau {douglasCalc.grau}
              </Badge>
            </div>
            <div className="mt-1">
              <p className="text-sm font-bold text-white">
                Douglas {douglasCalc.grau} — {douglasCalc.descricao}
              </p>
              <p className="text-[11px] text-zinc-400 mt-1">
                Altura atual:{' '}
                <span className="text-zinc-200 font-mono font-semibold">
                  {waveH !== null ? `${waveH} m` : '--'}
                </span>
              </p>
            </div>
          </div>

          {/* Card Swell (Ondulação de Fundo) */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-teal-300">
              <span className="flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-teal-400" />
                Swell (Vaga Primária)
              </span>
              {swellDir !== null && (
                <span className="text-[10px] text-zinc-400 font-mono">
                  {getWindDirectionLabel(swellDir)} ({Math.round(swellDir)}°)
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Direção do Swell:</span>
                <span className="font-bold text-zinc-100 flex items-center gap-1">
                  {swellDir !== null ? (
                    <>
                      <Navigation2
                        className="w-3 h-3 text-teal-400 inline transform"
                        style={{ transform: `rotate(${swellDir}deg)` }}
                      />
                      <span>
                        {Math.round(swellDir)}° ({getWindDirectionLabel(swellDir)})
                      </span>
                    </>
                  ) : (
                    '--'
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Período do Swell:</span>
                <span className="font-mono font-bold text-teal-300">
                  {swellPeriod !== null ? `${swellPeriod.toFixed(1)} s` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Card Onda de Vento & Temperatura da Água */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
              <span className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-blue-400" />
                Onda de Vento & Temp.
              </span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Onda de Vento:</span>
                <span className="font-mono font-bold text-zinc-100">
                  {windWaveH !== null ? `${windWaveH.toFixed(2)} m` : '--'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-cyan-400" />
                  Temperatura da Água:
                </span>
                <span className="font-mono font-bold text-cyan-300">
                  {tempAgua !== null ? `${tempAgua.toFixed(1)}°C` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Card Corrente Oceânica */}
          <div className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 space-y-2.5 sm:col-span-2 lg:col-span-3">
            <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
              <span className="flex items-center gap-1.5">
                <Compass className="w-4 h-4 text-indigo-400" />
                Corrente Marinha
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
              <div className="flex items-center justify-between bg-[#11161d] p-2.5 rounded-lg border border-zinc-800/60">
                <span className="text-zinc-400">Velocidade da Corrente:</span>
                <span className="font-mono font-bold text-indigo-300">
                  {currentVel !== null ? `${currentVel.toFixed(2)} m/s` : '--'}
                  {currentVel !== null && (
                    <span className="text-zinc-400 text-[10px] font-normal ml-1">
                      (~{(currentVel * 1.94384).toFixed(1)} kt)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#11161d] p-2.5 rounded-lg border border-zinc-800/60">
                <span className="text-zinc-400">Direção da Corrente:</span>
                <span className="font-bold text-zinc-100 flex items-center gap-1">
                  {currentDir !== null ? (
                    <>
                      <Navigation2
                        className="w-3 h-3 text-indigo-400 inline transform"
                        style={{ transform: `rotate(${currentDir}deg)` }}
                      />
                      <span>
                        {Math.round(currentDir)}° ({getWindDirectionLabel(currentDir)})
                      </span>
                    </>
                  ) : (
                    '--'
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 8. BLOCO ROTAS NA BAÍA DE ILHA GRANDE */}
      {/* ========================================================================= */}
      <section className="bg-[#11161d] border border-zinc-800/90 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800/70">
          <div className="w-7 h-7 rounded-lg bg-emerald-950/60 border border-emerald-800/50 flex items-center justify-center text-emerald-400">
            <Route className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Rotas & Navegação na Baía
            </h3>
            <p className="text-xs text-zinc-400">
              Distância ortodrômica em milhas náuticas (NM) e rumo verdadeiro (°V) a partir de{' '}
              {pontoConfig.nomeCurto}
            </p>
          </div>
        </div>

        {rotas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {rotas.map((r) => (
              <div
                key={r.ponto_slug}
                onClick={() => navigate(`/ponto/${r.ponto_slug}`)}
                className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-cyan-700/70 hover:shadow-cyan-950/20 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-1">
                      <span>{r.ponto_nome}</span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                    </h4>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {formatCoordinatesDMM(r.lat, r.lon)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-emerald-950/80 border-emerald-700/60 text-emerald-300 text-xs font-bold font-mono px-2 py-0.5"
                  >
                    {r.distancia_nm.toFixed(1)} NM
                  </Badge>
                </div>

                <div className="pt-2 border-t border-zinc-800/70 flex items-center justify-between text-xs">
                  <span className="text-zinc-400">Rumo Verdadeiro:</span>
                  <div className="flex items-center gap-1.5 font-bold text-zinc-200">
                    <Navigation2
                      className="w-3.5 h-3.5 text-cyan-400 inline transform"
                      style={{ transform: `rotate(${r.rumo_graus}deg)` }}
                    />
                    <span className="font-mono">
                      {r.rumo_graus}° ({r.direcao_cardinal})
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-center text-xs text-zinc-500">
            Nenhuma rota calculada para este ponto.
          </div>
        )}
      </section>
    </div>
  )
}
