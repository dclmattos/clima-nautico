import React, { useEffect, useState, useCallback } from 'react'
import { Ponto, PontoEstadoPrevisao } from '@/types/nautico'
import {
  fetchPontos,
  fetchPrevisaoPorPonto,
  fetchJanelas,
  getCurrentHourForecast,
  calculateSemaforo,
  getProximaJanela,
} from '@/services/previsaoService'
import { PontoCard } from '@/components/PontoCard'
import { BriefingCard } from '@/components/BriefingCard'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/LoadingState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { usePerfil } from '@/contexts/PerfilContext'
import { RotateCw, Anchor, Compass, Ship, Sailboat, Zap } from 'lucide-react'

const Index: React.FC = () => {
  const { perfil, perfis, setPerfil, deviceId, preferencias } = usePerfil()
  const [pontosEstados, setPontosEstados] = useState<Record<string, PontoEstadoPrevisao>>({})
  const [pontosList, setPontosList] = useState<Ponto[]>([])
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true)
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('')
  const [isRefreshingAll, setIsRefreshingAll] = useState<boolean>(false)

  // Atualiza relógio
  const updateClock = useCallback(() => {
    const now = new Date()
    const formatted = now.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    setCurrentTimeStr(formatted)
  }, [])

  useEffect(() => {
    updateClock()
    const interval = setInterval(updateClock, 30000)
    return () => clearInterval(interval)
  }, [updateClock])

  // Carrega previsão e janelas para um ponto específico
  const loadDadosPonto = useCallback(async (ponto: Ponto, perfilId: string) => {
    setPontosEstados((prev) => ({
      ...prev,
      [ponto.id]: {
        ponto,
        loading: prev[ponto.id]?.data ? false : true,
        error: null,
        data: prev[ponto.id]?.data || null,
        currentHourData: prev[ponto.id]?.currentHourData || null,
        statusSemaforo: prev[ponto.id]?.statusSemaforo || null,
        janelasData: prev[ponto.id]?.janelasData || null,
        loadingJanelas: true,
        currentScore: prev[ponto.id]?.currentScore ?? null,
        proximaJanela: prev[ponto.id]?.proximaJanela ?? null,
      },
    }))

    try {
      // 1. Busca previsão básica do ponto
      const data = await fetchPrevisaoPorPonto(ponto.id)
      const currentHour = getCurrentHourForecast(data.hourly)
      const semaforo = calculateSemaforo(currentHour)

      // 2. Busca janelas e scores com base no perfil atual
      let janelasData = null
      let currentScore = null
      let proximaJanela = null

      try {
        janelasData = await fetchJanelas(ponto.id, perfilId)
        if (janelasData && janelasData.hourly_scores && janelasData.hourly_scores.length > 0) {
          // Acha o score da hora atual
          const currentScoreObj = getCurrentHourForecast(
            janelasData.hourly_scores as unknown as import('@/types/nautico').PrevisaoHoraItem[],
          ) as unknown as import('@/types/nautico').HourlyScore | null
          currentScore = currentScoreObj?.score ?? null
        }
        if (janelasData && janelasData.janelas) {
          proximaJanela = getProximaJanela(janelasData.janelas)
        }
      } catch (jErr) {
        console.warn(`Erro ao carregar janelas para ${ponto.nome}:`, jErr)
      }

      setPontosEstados((prev) => ({
        ...prev,
        [ponto.id]: {
          ponto,
          loading: false,
          error: null,
          data,
          currentHourData: currentHour,
          statusSemaforo: semaforo,
          janelasData,
          loadingJanelas: false,
          currentScore,
          proximaJanela,
        },
      }))
    } catch (err: any) {
      console.error(`Erro ao carregar previsão para ${ponto.nome}:`, err)
      setPontosEstados((prev) => ({
        ...prev,
        [ponto.id]: {
          ponto,
          loading: false,
          error: err?.message || 'Falha ao obter dados meteorológicos',
          data: null,
          currentHourData: null,
          statusSemaforo: null,
          janelasData: null,
          loadingJanelas: false,
          currentScore: null,
          proximaJanela: null,
        },
      }))
    }
  }, [])

  // Carrega todos os pontos e suas previsões
  const carregarTodosPontos = useCallback(async () => {
    setGeneralError(null)
    try {
      let pontos: Ponto[] = []
      try {
        pontos = await fetchPontos()
      } catch (err: any) {
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

      const initialMap: Record<string, PontoEstadoPrevisao> = {}
      pontos.forEach((p) => {
        initialMap[p.id] = {
          ponto: p,
          loading: true,
          error: null,
          data: null,
          currentHourData: null,
          statusSemaforo: null,
          janelasData: null,
          loadingJanelas: true,
          currentScore: null,
          proximaJanela: null,
        }
      })
      setPontosEstados(initialMap)
      setLoadingInitial(false)

      const activePerfilId = perfil?.id || 'lancha'
      await Promise.all(pontos.map((p) => loadDadosPonto(p, activePerfilId)))
    } catch (err: any) {
      setGeneralError('Não foi possível inicializar os pontos de navegação.')
      setLoadingInitial(false)
    }
  }, [loadDadosPonto, perfil?.id])

  // Recarrega quando o perfil mudar
  useEffect(() => {
    if (pontosList.length > 0 && perfil?.id) {
      pontosList.forEach((p) => loadDadosPonto(p, perfil.id))
    }
  }, [perfil?.id, loadDadosPonto, pontosList])

  useEffect(() => {
    carregarTodosPontos()
  }, [carregarTodosPontos])

  // Atualizar tudo manualmente
  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    updateClock()
    const activePerfilId = perfil?.id || 'lancha'
    await Promise.all(pontosList.map((p) => loadDadosPonto(p, activePerfilId)))
    setIsRefreshingAll(false)
  }

  const getPerfilIcon = (nome: string) => {
    const n = nome.toLowerCase()
    if (n.includes('veleiro') || n.includes('vela')) {
      return <Sailboat className="w-3.5 h-3.5" />
    }
    if (n.includes('jet')) {
      return <Zap className="w-3.5 h-3.5" />
    }
    return <Ship className="w-3.5 h-3.5" />
  }

  return (
    <PullToRefresh
      onRefresh={handleRefreshAll}
      className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100 pb-16 md:pb-6"
    >
      {/* Container Principal */}
      <div className="w-full max-w-5xl mx-auto px-4 py-4 sm:py-6 flex-1 flex flex-col space-y-5">
        {/* Topo do App com Header e Seletor de Perfil */}
        <header className="space-y-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                  <Anchor className="w-4 h-4" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Clima Náutico
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1 flex items-center gap-1.5 font-medium">
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                Baía de Ilha Grande · {currentTimeStr || '--:--'}
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={isRefreshingAll || loadingInitial}
              className="bg-[#121820] border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs gap-1.5 shrink-0"
              title="Atualizar dados de todos os pontos"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshingAll ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Atualizar</span>
            </Button>
          </div>

          {/* Seletor Segmentado de Perfil de Navegação */}
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

        {/* 1. Briefing do Comandante (acima dos cards) */}
        <section>
          <BriefingCard
            perfilId={perfil?.id || 'lancha'}
            deviceId={deviceId}
            ultimoBriefingInicial={preferencias?.ultimo_briefing}
            updatedAtInicial={preferencias?.updated || preferencias?.created}
          />
        </section>

        {/* Mensagem de Erro Geral */}
        {generalError && (
          <ErrorState
            title="Erro de Conexão"
            message={generalError}
            onRetry={carregarTodosPontos}
          />
        )}

        {/* Loading Inicial */}
        {loadingInitial && !generalError && <LoadingState variant="cards" count={4} />}

        {/* Grid de 4 Cards (1 por ponto) */}
        {!loadingInitial && (
          <main className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {pontosList.map((ponto) => {
              const estado = pontosEstados[ponto.id] || {
                ponto,
                loading: true,
                error: null,
                data: null,
                currentHourData: null,
                statusSemaforo: null,
              }

              return (
                <PontoCard
                  key={ponto.id}
                  estado={estado}
                  onRetry={() => loadDadosPonto(ponto, perfil?.id || 'lancha')}
                />
              )
            })}
          </main>
        )}
      </div>

      {/* Rodapé Oficial */}
      <footer className="w-full border-t border-zinc-800/80 bg-[#070a0f] py-4 px-4 text-center mt-6">
        <p className="text-xs text-zinc-400 font-normal tracking-wide">
          Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN
        </p>
      </footer>
    </PullToRefresh>
  )
}

export default Index
