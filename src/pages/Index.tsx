import React, { useEffect, useState, useCallback } from 'react'
import { Ponto, PontoEstadoPrevisao } from '@/types/nautico'
import {
  fetchPontos,
  fetchPrevisaoPorPonto,
  getCurrentHourForecast,
  calculateSemaforo,
} from '@/services/previsaoService'
import { PontoCard } from '@/components/PontoCard'
import { Button } from '@/components/ui/button'
import { RotateCw, Anchor, Compass } from 'lucide-react'

const Index: React.FC = () => {
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
    const interval = setInterval(updateClock, 30000) // a cada 30s
    return () => clearInterval(interval)
  }, [updateClock])

  // Carrega previsão para um ponto específico
  const loadPrevisaoParaPonto = useCallback(async (ponto: Ponto) => {
    setPontosEstados((prev) => ({
      ...prev,
      [ponto.id]: {
        ponto,
        loading: true,
        error: null,
        data: prev[ponto.id]?.data || null,
        currentHourData: prev[ponto.id]?.currentHourData || null,
        statusSemaforo: prev[ponto.id]?.statusSemaforo || null,
      },
    }))

    try {
      const data = await fetchPrevisaoPorPonto(ponto.id)
      const currentHour = getCurrentHourForecast(data.hourly)
      const semaforo = calculateSemaforo(currentHour)

      setPontosEstados((prev) => ({
        ...prev,
        [ponto.id]: {
          ponto,
          loading: false,
          error: null,
          data,
          currentHourData: currentHour,
          statusSemaforo: semaforo,
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
        },
      }))
    }
  }, [])

  // Carrega todos os pontos e suas previsões em paralelo
  const carregarTodosPontos = useCallback(async () => {
    setGeneralError(null)
    try {
      let pontos: Ponto[] = []
      try {
        pontos = await fetchPontos()
      } catch (err: any) {
        // Se a busca falhar no PB, fallback com as coordenadas padrão dos 4 pontos fixos
        console.warn('Fallback para pontos padrão:', err)
      }

      // Se pontos vazios (ou ainda não retornaram), usar fallback seguro dos 4 pontos
      if (!pontos || pontos.length === 0) {
        pontos = [
          { id: 'angra', nome: 'angra', lat: -23.005, lon: -44.318, tipo: 'abrigado' },
          { id: 'abraao', nome: 'abraao', lat: -23.14, lon: -44.168, tipo: 'semi' },
          { id: 'paraty', nome: 'paraty', lat: -23.22, lon: -44.7, tipo: 'abrigado' },
          { id: 'juatinga', nome: 'juatinga', lat: -23.3, lon: -44.5, tipo: 'aberto' },
        ]
      }

      setPontosList(pontos)

      // Inicia estados de loading para cada ponto
      const initialMap: Record<string, PontoEstadoPrevisao> = {}
      pontos.forEach((p) => {
        initialMap[p.id] = {
          ponto: p,
          loading: true,
          error: null,
          data: null,
          currentHourData: null,
          statusSemaforo: null,
        }
      })
      setPontosEstados(initialMap)
      setLoadingInitial(false)

      // Chama a API de previsão para cada um dos 4 pontos em paralelo
      await Promise.all(pontos.map((p) => loadPrevisaoParaPonto(p)))
    } catch (err: any) {
      setGeneralError('Não foi possível inicializar os pontos de navegação.')
      setLoadingInitial(false)
    }
  }, [loadPrevisaoParaPonto])

  useEffect(() => {
    carregarTodosPontos()
  }, [carregarTodosPontos])

  // Atualizar tudo manualmente
  const handleRefreshAll = async () => {
    setIsRefreshingAll(true)
    updateClock()
    await Promise.all(pontosList.map((p) => loadPrevisaoParaPonto(p)))
    setIsRefreshingAll(false)
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100">
      {/* Container Principal Mobile-First */}
      <div className="w-full max-w-5xl mx-auto px-4 py-5 sm:py-8 flex-1 flex flex-col">
        {/* Topo do App */}
        <header className="mb-6 flex items-start justify-between gap-4 border-b border-zinc-800/80 pb-4">
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
        </header>

        {/* Mensagem de Erro Geral */}
        {generalError && (
          <div className="mb-6 p-4 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200 text-sm flex items-center justify-between">
            <span>{generalError}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={carregarTodosPontos}
              className="bg-red-900/60 border-red-800 text-xs"
            >
              Recarregar
            </Button>
          </div>
        )}

        {/* Grid de 4 Cards (1 por ponto) */}
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
                onRetry={() => loadPrevisaoParaPonto(ponto)}
              />
            )
          })}
        </main>
      </div>

      {/* Rodapé Oficial conforme especificação */}
      <footer className="w-full border-t border-zinc-800/80 bg-[#070a0f] py-4 px-4 text-center mt-8">
        <p className="text-xs text-zinc-400 font-normal tracking-wide">
          Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN
        </p>
      </footer>
    </div>
  )
}

export default Index
