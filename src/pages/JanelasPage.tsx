import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '@/contexts/PerfilContext'
import {
  fetchPontos,
  fetchJanelas,
  formatTipoPonto,
  formatPontoNome,
  getProximaJanela,
  PONTOS_DISPONIVEIS,
} from '@/services/previsaoService'
import { getPontosPersonalizados } from '@/lib/preferencesStorage'
import { Ponto, JanelasPayload, JanelaNavegacao } from '@/types/nautico'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/LoadingState'
import {
  Compass,
  Clock,
  RefreshCw,
  Info,
  Calendar,
  AlertTriangle,
  ChevronRight,
  Sun,
  MapPin,
  Flame,
} from 'lucide-react'

interface PontoComJanelas {
  ponto: Ponto
  janelasPayload: JanelasPayload | null
  loading: boolean
  error: string | null
  proximaJanela: JanelaNavegacao | null
  isPersonalizado?: boolean
}

export const JanelasPage: React.FC = () => {
  const navigate = useNavigate()
  const { perfil } = usePerfil()

  const [pontosJanelas, setPontosJanelas] = useState<PontoComJanelas[]>([])
  const [loadingGeral, setLoadingGeral] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPontoId, setSelectedPontoId] = useState<string>('todos')

  const SLUG_ORDER = ['angra', 'abraao', 'paraty', 'juatinga']

  /**
   * Carrega janelas de um ponto (fixo ou custom)
   */
  const carregarJanelasPonto = useCallback(
    async (
      ponto: Ponto,
      perfilId: string,
      customOpts?: {
        lat: number
        lon: number
        tipo: string
        nome?: string
        isPersonalizado?: boolean
      },
    ): Promise<PontoComJanelas> => {
      const isCustom = !!customOpts?.isPersonalizado || (ponto.id && ponto.id.startsWith('custom-'))
      try {
        const payload = isCustom
          ? await fetchJanelas(
              '',
              perfilId,
              customOpts
                ? {
                    lat: customOpts.lat,
                    lon: customOpts.lon,
                    tipo: customOpts.tipo,
                    nome: customOpts.nome,
                  }
                : undefined,
            )
          : await fetchJanelas(ponto.slug || ponto.id, perfilId)

        const proxima = payload.janelas ? getProximaJanela(payload.janelas) : null
        return {
          ponto,
          janelasPayload: payload,
          loading: false,
          error: null,
          proximaJanela: proxima,
          isPersonalizado: isCustom,
        }
      } catch (err: any) {
        console.error(`Erro ao carregar janelas para o ponto ${ponto.nome}:`, err)
        return {
          ponto,
          janelasPayload: null,
          loading: false,
          error: err?.message || 'Falha ao obter janelas deste ponto',
          proximaJanela: null,
          isPersonalizado: isCustom,
        }
      }
    },
    [],
  )

  /**
   * Carrega todos os pontos com suas janelas
   */
  const carregarTodasJanelas = useCallback(
    async (isManual = false) => {
      if (isManual) {
        setRefreshing(true)
      } else {
        setLoadingGeral(true)
      }

      try {
        let pontosFixos: Ponto[] = []
        try {
          pontosFixos = await fetchPontos()
        } catch {
          pontosFixos = PONTOS_DISPONIVEIS.map((p) => ({
            id: p.slug,
            nome: p.nomeCurto,
            lat: p.lat,
            lon: p.lon,
            tipo: p.tipo as any,
            slug: p.slug,
            descricao_abrigo: p.nomeCompleto,
          }))
        }

        const pontosFixosOrdenados = [...pontosFixos].sort((a, b) => {
          const idxA = SLUG_ORDER.indexOf(a.slug || a.nome.toLowerCase())
          const idxB = SLUG_ORDER.indexOf(b.slug || b.nome.toLowerCase())
          if (idxA !== -1 && idxB !== -1) return idxA - idxB
          if (idxA !== -1) return -1
          if (idxB !== -1) return 1
          return a.nome.localeCompare(b.nome)
        })

        // Pontos Personalizados
        const customPontosStorage = getPontosPersonalizados()
        const pontosCustomFormatados: Array<{
          ponto: Ponto
          customOpts: {
            lat: number
            lon: number
            tipo: string
            nome: string
            isPersonalizado: boolean
          }
        }> = customPontosStorage.map((cp) => ({
          ponto: {
            id: `custom-${cp.id}`,
            nome: cp.nome,
            lat: cp.lat,
            lon: cp.lon,
            tipo: cp.tipo as any,
            slug: `custom-${cp.id}`,
            descricao_abrigo: 'Ponto Personalizado',
          },
          customOpts: {
            lat: cp.lat,
            lon: cp.lon,
            tipo: cp.tipo,
            nome: cp.nome,
            isPersonalizado: true,
          },
        }))

        const perfilId = perfil?.id || 'lancha'

        const promessasFixos = pontosFixosOrdenados.map((p) => carregarJanelasPonto(p, perfilId))
        const promessasCustom = pontosCustomFormatados.map(({ ponto, customOpts }) =>
          carregarJanelasPonto(ponto, perfilId, customOpts),
        )

        const resultados = await Promise.all([...promessasFixos, ...promessasCustom])
        setPontosJanelas(resultados)
      } catch (err: any) {
        console.error('Erro ao buscar janelas dos pontos:', err)
      } finally {
        setLoadingGeral(false)
        setRefreshing(false)
      }
    },
    [carregarJanelasPonto, perfil?.id],
  )

  useEffect(() => {
    carregarTodasJanelas()
  }, [carregarTodasJanelas])

  // Formatação de data e período para janela
  const formatJanelaExtensa = (inicioIso: string, fimIso: string) => {
    try {
      const inicio = new Date(inicioIso)
      const fim = new Date(fimIso)

      const diasSemana = [
        'Domingo',
        'Segunda-feira',
        'Terça-feira',
        'Quarta-feira',
        'Quinta-feira',
        'Sexta-feira',
        'Sábado',
      ]
      const diaNome = diasSemana[inicio.getDay()]
      const diaNum = String(inicio.getDate()).padStart(2, '0')
      const mesNum = String(inicio.getMonth() + 1).padStart(2, '0')

      const horaIni = String(inicio.getHours()).padStart(2, '0') + ':00'
      const horaFim = String(fim.getHours()).padStart(2, '0') + ':00'

      return {
        dataTitulo: `${diaNome}, ${diaNum}/${mesNum}`,
        horario: `${horaIni} às ${horaFim}`,
      }
    } catch {
      return {
        dataTitulo: inicioIso.slice(0, 10),
        horario: `${inicioIso.slice(11, 16)} às ${fimIso.slice(11, 16)}`,
      }
    }
  }

  // Cor do score
  const getScoreColor = (score: number) => {
    if (score >= 85) return 'text-emerald-400 bg-emerald-950/60 border-emerald-700'
    if (score >= 70) return 'text-teal-400 bg-teal-950/60 border-teal-700'
    if (score >= 50) return 'text-amber-400 bg-amber-950/60 border-amber-700'
    return 'text-red-400 bg-red-950/60 border-red-700'
  }

  // Filtragem por ponto selecionado
  const pontosExibidos =
    selectedPontoId === 'todos'
      ? pontosJanelas
      : pontosJanelas.filter(
          (pj) =>
            pj.ponto.id === selectedPontoId ||
            pj.ponto.slug === selectedPontoId ||
            pj.ponto.nome.toLowerCase() === selectedPontoId.toLowerCase(),
        )

  return (
    <div className="space-y-6 pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-6 h-6 text-cyan-400" />
            <h1 className="text-2xl font-black text-white tracking-tight">Janelas de Navegação</h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Previsão detalhada de períodos ideais diurnos (≥70 pts) para{' '}
            <span className="text-cyan-300 font-semibold uppercase">
              {perfil?.nome || 'LANCHA'}
            </span>{' '}
            nas próximas 72 horas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarTodasJanelas(true)}
            disabled={refreshing || loadingGeral}
            className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-300 text-xs gap-1.5 h-9"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
            />
            <span>Recalcular Janelas</span>
          </Button>
        </div>
      </div>

      {/* Seletor Rápido de Ponto (Filtro) */}
      {!loadingGeral && pontosJanelas.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Button
            variant={selectedPontoId === 'todos' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedPontoId('todos')}
            className={`text-xs h-8 px-3 rounded-full shrink-0 font-medium ${
              selectedPontoId === 'todos'
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white border-none'
                : 'bg-[#11161d] border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            Todos os Pontos ({pontosJanelas.length})
          </Button>
          {pontosJanelas.map((pj) => {
            const isSel =
              selectedPontoId === pj.ponto.id ||
              selectedPontoId === pj.ponto.slug ||
              selectedPontoId === pj.ponto.nome
            const isCustom = pj.isPersonalizado || pj.ponto.id.startsWith('custom-')
            const nomeFormatado = isCustom ? pj.ponto.nome : formatPontoNome(pj.ponto.nome)
            const countJanelas = pj.janelasPayload?.janelas?.length ?? 0

            return (
              <Button
                key={pj.ponto.id || pj.ponto.slug}
                variant={isSel ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedPontoId(pj.ponto.slug || pj.ponto.id)}
                className={`text-xs h-8 px-3 rounded-full shrink-0 font-medium gap-1.5 ${
                  isSel
                    ? 'bg-cyan-700 hover:bg-cyan-600 text-white border-none'
                    : 'bg-[#11161d] border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {isCustom && <span className="text-amber-400 text-xs">⭐</span>}
                {nomeFormatado}
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    countJanelas > 0
                      ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/80'
                      : 'bg-zinc-800 text-zinc-500'
                  }`}
                >
                  {countJanelas}
                </span>
              </Button>
            )
          })}
        </div>
      )}

      {/* Card Informativo sobre Critérios */}
      <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-cyan-200 text-xs flex items-start gap-2.5">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
        <div className="space-y-0.5 leading-relaxed">
          <p className="font-semibold text-white">Como funcionam as janelas ideais?</p>
          <p className="text-zinc-300">
            Uma janela é considerada ideal quando atinge <strong>score ≥ 70</strong> de forma
            contínua por no mínimo <strong>3 horas diurnas</strong> (entre nascer e pôr do sol),
            respeitando vento, rajadas, ondas e chuva para o perfil{' '}
            <span className="uppercase text-cyan-300 font-mono">{perfil?.nome}</span>.
          </p>
        </div>
      </div>

      {/* Lista de Janelas por Ponto */}
      {loadingGeral ? (
        <LoadingState variant="cards" count={3} />
      ) : (
        <div className="space-y-6">
          {pontosExibidos.map((pj) => {
            const isCustom = pj.isPersonalizado || pj.ponto.id.startsWith('custom-')
            const nomeExibicao = isCustom ? pj.ponto.nome : formatPontoNome(pj.ponto.nome)
            const tipoFormatado = formatTipoPonto(pj.ponto.tipo)
            const janelas = pj.janelasPayload?.janelas || []
            const slugDestino = isCustom
              ? pj.ponto.id.startsWith('custom-')
                ? pj.ponto.id
                : `custom-${pj.ponto.id}`
              : pj.ponto.slug || pj.ponto.nome.toLowerCase()

            return (
              <Card
                key={pj.ponto.id || pj.ponto.slug}
                className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100 overflow-hidden"
              >
                {/* Header do Ponto */}
                <CardHeader className="pb-3 border-b border-zinc-800/80 bg-[#0d1218]/80 flex flex-row items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                        {isCustom && <span className="text-amber-400">⭐</span>}
                        <MapPin className="w-4 h-4 text-cyan-400" />
                        {nomeExibicao}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="text-[10px] px-2 py-0 border-zinc-700 bg-zinc-800/80 text-zinc-300"
                      >
                        {tipoFormatado}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400">
                      {janelas.length > 0
                        ? `${janelas.length} ${
                            janelas.length === 1
                              ? 'janela ideal detectada'
                              : 'janelas ideais detectadas'
                          }`
                        : 'Nenhuma janela contínua de 3h diurna com score ≥ 70'}
                    </p>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/ponto/${slugDestino}`)}
                    className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 text-xs gap-1 h-8"
                  >
                    Ver Ponto
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>

                <CardContent className="p-4 sm:p-5 space-y-4">
                  {/* Tratamento de Erro */}
                  {pj.error && (
                    <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{pj.error}</span>
                    </div>
                  )}

                  {/* Sem Janelas Encontradas */}
                  {!pj.error && janelas.length === 0 && (
                    <div className="p-5 rounded-xl bg-[#161c24] border border-zinc-800/80 text-center space-y-2">
                      <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                      <p className="text-sm font-semibold text-zinc-300">
                        Condições desfavoráveis para o perfil {perfil?.nome}
                      </p>
                      <p className="text-xs text-zinc-400 max-w-md mx-auto">
                        O vento, as ondas ou as rajadas previstas para as próximas 72 horas excedem
                        os limites seguros de navegação contínua neste ponto.
                      </p>
                    </div>
                  )}

                  {/* Lista de Janelas Válidas */}
                  {!pj.error && janelas.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {janelas.map((j, idx) => {
                        const { dataTitulo, horario } = formatJanelaExtensa(j.inicio, j.fim)
                        const isMelhor =
                          idx === 0 ||
                          j.score_medio === Math.max(...janelas.map((item) => item.score_medio))

                        return (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 relative transition-all ${
                              isMelhor
                                ? 'bg-gradient-to-br from-[#16212e] to-[#121922] border-cyan-700/60 shadow-[0_0_15px_rgba(6,182,212,0.1)]'
                                : 'bg-[#161c24] border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            {isMelhor && (
                              <div className="absolute top-2.5 right-2.5 flex items-center gap-1">
                                <Badge className="bg-cyan-900 text-cyan-200 border-cyan-700 text-[9px] uppercase px-1.5 py-0 flex items-center gap-1 font-bold">
                                  <Flame className="w-3 h-3 text-amber-400" />
                                  Melhor Janela
                                </Badge>
                              </div>
                            )}

                            {/* Informações da Janela */}
                            <div className="space-y-2">
                              <div className="space-y-0.5 pr-14">
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                                  {dataTitulo}
                                </span>
                                <p className="text-sm font-black text-cyan-300 font-mono flex items-center gap-1.5">
                                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                                  {horario}
                                </p>
                              </div>

                              <div className="flex items-center gap-2 pt-1 border-t border-zinc-800/80">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-zinc-400">Duração</span>
                                  <p className="text-xs font-bold text-white font-mono">
                                    {j.duracao_horas} horas
                                  </p>
                                </div>
                                <div className="h-6 w-px bg-zinc-800 mx-1"></div>
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-zinc-400">Fator Principal</span>
                                  <p className="text-xs font-semibold text-zinc-300 capitalize truncate max-w-[120px]">
                                    {j.fator_limitante || 'Nenhum'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Score Médio da Janela */}
                            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                              <span className="text-[11px] text-zinc-400 font-medium">
                                Score Médio
                              </span>
                              <Badge
                                variant="outline"
                                className={`font-mono font-black text-xs px-2.5 py-0.5 border ${getScoreColor(
                                  j.score_medio,
                                )}`}
                              >
                                {j.score_medio} pts
                              </Badge>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default JanelasPage
