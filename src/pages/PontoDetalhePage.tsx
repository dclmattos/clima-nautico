import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PrevisaoPayload } from '@/types/nautico'
import { fetchPrevisaoPorPonto, PONTOS_DISPONIVEIS } from '@/services/previsaoService'
import { PontoDetalhe } from '@/components/PontoDetalhe'
import { Button } from '@/components/ui/button'
import { Anchor, AlertTriangle, ArrowLeft, RotateCw } from 'lucide-react'

export const PontoDetalhePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [previsaoData, setPrevisaoData] = useState<PrevisaoPayload | null>(null)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Normalização do slug
  const activeSlug = slug?.toLowerCase() || 'angra'

  // Validar se o slug é um dos pontos conhecidos
  const isValidSlug = PONTOS_DISPONIVEIS.some((p) => p.slug === activeSlug)

  const carregarDadosPonto = useCallback(async (pontoSlug: string, isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true)
    } else {
      setLoading(true)
    }
    setError(null)

    try {
      const data = await fetchPrevisaoPorPonto(pontoSlug)
      setPrevisaoData(data)
    } catch (err: any) {
      console.error(`Erro ao buscar dados do ponto ${pontoSlug}:`, err)
      setError(err?.message || 'Falha ao obter os dados meteorológicos do ponto.')
      setPrevisaoData(null)
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    if (activeSlug) {
      carregarDadosPonto(activeSlug)
    }
  }, [activeSlug, carregarDadosPonto])

  // Se for slug inválido
  if (!isValidSlug && !loading) {
    return (
      <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between">
        <div className="w-full max-w-5xl mx-auto px-4 py-8 flex-1 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-full bg-amber-950/50 border border-amber-800/60 flex items-center justify-center text-amber-400 mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Ponto não encontrado</h2>
          <p className="text-zinc-400 text-sm max-w-md mb-6">
            O ponto de navegação especificado &ldquo;{slug}&rdquo; não existe ou não está mapeado.
          </p>
          <Button
            onClick={() => navigate('/')}
            className="bg-cyan-900 hover:bg-cyan-800 text-cyan-100 gap-2 text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para a página inicial
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100">
      <div className="w-full max-w-5xl mx-auto px-4 py-5 sm:py-8 flex-1 flex flex-col">
        {/* Header Superior Global */}
        <header className="mb-6 flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => navigate('/')}
            title="Voltar ao início"
          >
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300 group-hover:border-cyan-500 transition-colors">
              <Anchor className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white group-hover:text-cyan-200 transition-colors">
                Clima Náutico
              </h1>
              <p className="text-[11px] sm:text-xs text-zinc-400 font-medium">
                Baía de Ilha Grande · Detalhe do Ponto
              </p>
            </div>
          </div>
        </header>

        {/* Estado: Carregando (Skeleton) */}
        {loading && (
          <div className="space-y-6 animate-pulse">
            {/* Top Bar Skeleton */}
            <div className="h-28 bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-3">
              <div className="h-4 bg-zinc-800 rounded w-24"></div>
              <div className="h-7 bg-zinc-800 rounded w-1/3"></div>
            </div>

            {/* Grafico 1 Skeleton */}
            <div className="h-[340px] bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="h-5 bg-zinc-800 rounded w-1/4"></div>
              <div className="h-56 bg-zinc-800/40 rounded-lg"></div>
            </div>

            {/* Grafico 2 Skeleton */}
            <div className="h-[240px] bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="h-5 bg-zinc-800 rounded w-1/4"></div>
              <div className="h-36 bg-zinc-800/40 rounded-lg"></div>
            </div>

            {/* Tabela Skeleton */}
            <div className="h-[250px] bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-4">
              <div className="h-5 bg-zinc-800 rounded w-1/4"></div>
              <div className="h-40 bg-zinc-800/40 rounded-lg"></div>
            </div>
          </div>
        )}

        {/* Estado: Erro */}
        {!loading && error && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#11161d] border border-red-950/60 rounded-xl shadow-lg my-auto">
            <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-800/60 flex items-center justify-center text-red-400 mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Erro ao carregar dados</h2>
            <p className="text-zinc-400 text-sm max-w-md mb-6">{error}</p>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                className="bg-zinc-800 border-zinc-700 text-zinc-200"
              >
                Voltar aos pontos
              </Button>
              <Button
                size="sm"
                onClick={() => carregarDadosPonto(activeSlug)}
                className="bg-cyan-900 hover:bg-cyan-800 text-cyan-100 gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Tentar de novo
              </Button>
            </div>
          </div>
        )}

        {/* Estado: Vazio */}
        {!loading &&
          !error &&
          (!previsaoData || !previsaoData.hourly || previsaoData.hourly.length === 0) && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#11161d] border border-zinc-800 rounded-xl my-auto">
              <p className="text-zinc-300 font-semibold mb-2">Nenhuma previsão encontrada</p>
              <p className="text-zinc-400 text-sm mb-4">
                Não há dados horários disponíveis para este ponto no momento.
              </p>
              <Button
                onClick={() => carregarDadosPonto(activeSlug)}
                variant="outline"
                size="sm"
                className="bg-zinc-800 border-zinc-700 text-zinc-100 gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Tentar de novo
              </Button>
            </div>
          )}

        {/* Estado: Sucesso */}
        {!loading && !error && previsaoData && (
          <PontoDetalhe
            currentSlug={activeSlug}
            previsao={previsaoData}
            onRefresh={() => carregarDadosPonto(activeSlug, true)}
            isRefreshing={isRefreshing}
          />
        )}
      </div>

      {/* Rodapé Oficial Clima Náutico */}
      <footer className="w-full border-t border-zinc-800/80 bg-[#070a0f] py-4 px-4 text-center mt-8">
        <p className="text-xs text-zinc-400 font-normal tracking-wide">
          Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN
        </p>
      </footer>
    </div>
  )
}

export default PontoDetalhePage
