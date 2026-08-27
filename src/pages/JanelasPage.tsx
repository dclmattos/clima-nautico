import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ponto, JanelasPayload, JanelaNavegacao } from '@/types/nautico'
import {
  fetchPontos,
  fetchJanelas,
  formatPontoNome,
  formatTipoPonto,
  formatarJanelaBadge,
  PONTOS_DISPONIVEIS,
} from '@/services/previsaoService'
import { usePerfil } from '@/contexts/PerfilContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Anchor,
  Compass,
  CalendarRange,
  RotateCw,
  Clock,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Sparkles,
  Ship,
  Sailboat,
  Zap,
} from 'lucide-react'

interface PontoJanelasEstado {
  ponto: Ponto
  loading: boolean
  error: string | null
  data: JanelasPayload | null
}

export const JanelasPage: React.FC = () => {
  const navigate = useNavigate()
  const { perfil, perfis, setPerfil } = usePerfil()
  const [pontosEstados, setPontosEstados] = useState<Record<string, PontoJanelasEstado>>({})
  const [pontosList, setPontosList] = useState<Ponto[]>([])
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true)
  const [isRefreshingAll, setIsRefreshingAll] = useState<boolean>(false)

  // Carrega janelas de um ponto específico
  const carregarJanelasPonto = useCallback(async (ponto: Ponto, perfilId: string) => {
    setPontosEstados((prev) => ({
      ...prev,
      [ponto.id]: {
        ponto,
        loading: true,
        error: null,
        data: prev[ponto.id]?.data || null,
      },
    }))

    try {
      const data = await fetchJanelas(ponto.id, perfilId)
      setPontosEstados((prev) => ({
        ...prev,
        [ponto.id]: {
          ponto,
          loading: false,
          error: null,
          data,
        },
      }))
    } catch (err: any) {
      console.error(`Erro ao buscar janelas de ${ponto.nome}:`, err)
      setPontosEstados((prev) => ({
        ...prev,
        [ponto.id]: {
          ponto,
          loading: false,
          error: err?.message || 'Falha ao buscar janelas ideais',
          data: null,
        },
      }))
    }
  }, [])

  // Carrega todos os pontos e janelas
  const carregarTodos = useCallback(async () => {
    try {
      let pontos: Ponto[] = []
      try {
        pontos = await fetchPontos()
      } catch (err) {
        console.warn('Fallback para pontos padrão:', err)
      }

      if (!pontos || pontos.length === 0) {
        pontos = [
          {
            id: 'angra',
            slug: 'angra',
            nome: 'angra',
            lat: -23.005,
            lon: -44.318,
            tipo: 'abrigado',
          },
          { id: 'abraao', slug: 'abraao', nome: 'abraao', lat: -23.14, lon: -44.168, tipo: 'semi' },
          {
            id: 'paraty',
            slug: 'paraty',
            nome: 'paraty',
            lat: -23.22,
            lon: -44.7,
            tipo: 'abrigado',
          },
          {
            id: 'juatinga',
            slug: 'juatinga',
            nome: 'juatinga',
            lat: -23.3,
            lon: -44.5,
            tipo: 'aberto',
          },
        ]
      }

      setPontosList(pontos)
      const initialMap: Record<string, PontoJanelasEstado> = {}
      pontos.forEach((p) => {
        initialMap[p.id] = {
          ponto: p,
          loading: true,
          error: null,
          data: null,
        }
      })
      setPontosEstados(initialMap)
      setLoadingInitial(false)

      const activePerfilId = perfil?.id || 'lancha'
      await Promise.all(pontos.map((p) => carregarJanelasPonto(p, activePerfilId)))
    } catch (err) {
      setLoadingInitial(false)
    }
  }, [carregarJanelasPonto, perfil?.id])

  useEffect(() => {
    carregarTodos()
  }, [carregarTodos])

  // Recarrega quando o perfil muda
  useEffect(() => {
    if (pontosList.length > 0 && perfil?.id) {
      pontosList.forEach((p) => carregarJanelasPonto(p, perfil.id))
    }
  }, [perfil?.id, carregarJanelasPonto, pontosList])

  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    const activePerfilId = perfil?.id || 'lancha'
    await Promise.all(pontosList.map((p) => carregarJanelasPonto(p, activePerfilId)))
    setIsRefreshingAll(false)
  }

  const getTipoBadgeColor = (tipo: string) => {
    switch (tipo) {
      case 'abrigado':
        return 'bg-blue-950/70 text-blue-300 border-blue-800/60'
      case 'semi':
        return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60'
      case 'aberto':
        return 'bg-slate-800 text-slate-300 border-slate-700'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getScoreVisual = (score: number) => {
    if (score >= 85) {
      return {
        bg: 'bg-emerald-950/60',
        text: 'text-emerald-400',
        border: 'border-emerald-700/60',
        badge: 'Excelente',
      }
    }
    if (score >= 70) {
      return {
        bg: 'bg-teal-950/60',
        text: 'text-teal-400',
        border: 'border-teal-700/60',
        badge: 'Boa',
      }
    }
    return {
      bg: 'bg-amber-950/60',
      text: 'text-amber-400',
      border: 'border-amber-700/60',
      badge: 'Marginal',
    }
  }

  const getPerfilIcon = (nome: string) => {
    const n = nome.toLowerCase()
    if (n.includes('veleiro') || n.includes('vela')) return <Sailboat className="w-3.5 h-3.5" />
    if (n.includes('jet')) return <Zap className="w-3.5 h-3.5" />
    return <Ship className="w-3.5 h-3.5" />
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100 pb-16 md:pb-6">
      <div className="w-full max-w-5xl mx-auto px-4 py-4 sm:py-6 flex-1 flex flex-col">
        {/* Header da Página */}
        <header className="mb-6 space-y-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                  <CalendarRange className="w-4 h-4" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Janelas Ideais de Navegação
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Previsão de 72h (3 dias) com score ≥ 70 para {perfil?.nome || 'sua embarcação'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshingAll || loadingInitial}
              className="bg-[#121820] border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs gap-1.5 shrink-0"
              title="Atualizar janelas"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>

          {/* Seletor Segmentado de Perfil */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-[#11161d] p-2 rounded-xl border border-zinc-800/80">
            <div className="flex items-center gap-2 px-1">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                Perfil de Embarcação:
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-[#0a0e14] p-1 rounded-lg border border-zinc-800/90 overflow-x-auto">
              {(perfis.length > 0
                ? perfis
                : [
                    { id: 'lancha', nome: 'lancha' },
                    { id: 'veleiro', nome: 'veleiro' },
                    { id: 'jet', nome: 'jet' },
                  ]
              ).map((p) => {
                const isSelected =
                  perfil?.id === p.id || perfil?.nome?.toLowerCase() === p.nome?.toLowerCase()
                const label = p.nome.charAt(0).toUpperCase() + p.nome.slice(1)

                return (
                  <button
                    key={p.id}
                    onClick={() => setPerfil(p.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/80 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60 border border-transparent'
                    }`}
                  >
                    {getPerfilIcon(p.nome)}
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </header>

        {/* Lista Organizada por Ponto */}
        <main className="space-y-6 flex-1">
          {pontosList.map((ponto) => {
            const estado = pontosEstados[ponto.id] || {
              ponto,
              loading: true,
              error: null,
              data: null,
            }
            const nomeExibicao = formatPontoNome(ponto.nome)
            const tipoFormatado = formatTipoPonto(ponto.tipo)
            const janelas = estado.data?.janelas || []

            return (
              <Card
                key={ponto.id}
                className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100 overflow-hidden"
              >
                {/* Header do Ponto */}
                <CardHeader className="pb-3 border-b border-zinc-800/80 bg-[#0d1218]/80">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <CardTitle className="text-base sm:text-lg font-bold text-white">
                        {nomeExibicao}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`text-xs px-2 py-0.5 border ${getTipoBadgeColor(ponto.tipo)}`}
                      >
                        {tipoFormatado}
                      </Badge>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const slugDestino = ponto.slug || ponto.nome?.toLowerCase() || ponto.id
                        navigate(`/ponto/${slugDestino}`)
                      }}
                      className="text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-950/40 gap-1 p-1 sm:px-2.5"
                    >
                      <span>Ver detalhes</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-5">
                  {/* Skeleton Loading */}
                  {estado.loading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 animate-pulse">
                      <div className="h-24 bg-zinc-800/50 rounded-lg p-3"></div>
                      <div className="h-24 bg-zinc-800/50 rounded-lg p-3"></div>
                    </div>
                  )}

                  {/* Erro */}
                  {!estado.loading && estado.error && (
                    <div className="p-4 rounded-lg bg-red-950/30 border border-red-900/50 text-red-300 text-xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                        <span>{estado.error}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => carregarJanelasPonto(ponto, perfil?.id || 'lancha')}
                        className="bg-red-900/40 border-red-800 text-xs gap-1"
                      >
                        <RotateCw className="w-3 h-3" />
                        Tentar de novo
                      </Button>
                    </div>
                  )}

                  {/* Sem Janelas */}
                  {!estado.loading && !estado.error && janelas.length === 0 && (
                    <div className="py-6 px-4 rounded-lg bg-[#0a0e14] border border-dashed border-zinc-800 text-center flex flex-col items-center justify-center">
                      <ShieldAlert className="w-6 h-6 text-zinc-500 mb-2" />
                      <p className="text-sm font-semibold text-zinc-400">
                        Sem janelas ideais nos próximos 3 dias
                      </p>
                      <p className="text-xs text-zinc-500 mt-1 max-w-sm">
                        As condições meteorológicas ficam abaixo do limiar de segurança (score &lt;
                        70) para o perfil {perfil?.nome}.
                      </p>
                    </div>
                  )}

                  {/* Lista de Janelas Ideais */}
                  {!estado.loading && !estado.error && janelas.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {janelas.map((j, idx) => {
                        const scoreStyle = getScoreVisual(j.score_medio)
                        const horarioTexto = formatarJanelaBadge(j.inicio, j.fim)

                        return (
                          <div
                            key={idx}
                            className="bg-[#161c24] border border-zinc-800/90 rounded-xl p-3.5 flex flex-col justify-between gap-3 hover:border-emerald-700/50 transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-sm">
                                  <Sparkles className="w-4 h-4 text-emerald-400" />
                                  <span>{horarioTexto}</span>
                                </div>
                                <div className="flex items-center gap-1 text-xs text-zinc-400 mt-1">
                                  <Clock className="w-3 h-3 text-zinc-500" />
                                  <span>Duração: {j.duracao_horas} horas consecutivas</span>
                                </div>
                              </div>

                              {/* Score Médio */}
                              <div
                                className={`px-2.5 py-1 rounded-lg border flex flex-col items-center justify-center shrink-0 ${scoreStyle.bg} ${scoreStyle.border}`}
                              >
                                <span className={`text-sm font-black ${scoreStyle.text}`}>
                                  {j.score_medio}
                                </span>
                                <span className="text-[9px] uppercase tracking-wider text-zinc-400 font-bold">
                                  Score
                                </span>
                              </div>
                            </div>

                            {/* Fator limitante / Atenção */}
                            <div className="pt-2 border-t border-zinc-800/80 text-[11px] flex items-center justify-between text-zinc-400">
                              <span className="text-zinc-500">Ponto de atenção:</span>
                              {j.fator_limitante ? (
                                <span className="font-medium text-amber-300">
                                  {j.fator_limitante_desc || j.fator_limitante}
                                </span>
                              ) : (
                                <span className="font-medium text-emerald-300">
                                  Condições ideais
                                </span>
                              )}
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
        </main>
      </div>

      {/* Rodapé Oficial */}
      <footer className="w-full border-t border-zinc-800/80 bg-[#070a0f] py-4 px-4 text-center mt-6">
        <p className="text-xs text-zinc-400 font-normal tracking-wide">
          Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN
        </p>
      </footer>
    </div>
  )
}

export default JanelasPage
