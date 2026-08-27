import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { PrevisaoPayload } from '@/types/nautico'
import { fetchPrevisaoPorPonto, PONTOS_DISPONIVEIS } from '@/services/previsaoService'
import { PontoDetalhe } from '@/components/PontoDetalhe'
import { Button } from '@/components/ui/button'
import { LoadingState } from '@/components/ui/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { Anchor, AlertTriangle, ArrowLeft, RotateCw, Compass } from 'lucide-react'

export const PontoDetalhePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [previsaoData, setPrevisaoData] = useState<PrevisaoPayload | null>(null)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)

  // Normalização do slug
  const activeSlug = slug?.toLowerCase().trim() || 'angra'

  // Validar se o slug é um dos pontos conhecidos
  const isValidSlug = PONTOS_DISPONIVEIS.some(
    (p) => p.slug === activeSlug || p.nomeCurto.toLowerCase() === activeSlug,
  )

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
      <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between p-4">
        <div className="w-full max-w-md mx-auto my-auto">
          <EmptyState
            icon={<Compass className="w-6 h-6 text-amber-400" />}
            title="Ponto não encontrado"
            description={`O ponto de navegação "${slug}" não existe ou não está mapeado.`}
            actionLabel="Voltar para a página inicial"
            onAction={() => navigate('/')}
          />
        </div>
      </div>
    )
  }

  return (
    <PullToRefresh
      onRefresh={() => carregarDadosPonto(activeSlug, true)}
      className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100"
    >
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
        {loading && <LoadingState variant="detail" />}

        {/* Estado: Erro */}
        {!loading && error && (
          <div className="my-auto">
            <ErrorState
              title="Erro ao carregar dados"
              message={error}
              onRetry={() => carregarDadosPonto(activeSlug)}
              secondaryAction={{
                label: 'Voltar aos pontos',
                onClick: () => navigate('/'),
              }}
            />
          </div>
        )}

        {/* Estado: Vazio */}
        {!loading &&
          !error &&
          (!previsaoData || !previsaoData.hourly || previsaoData.hourly.length === 0) && (
            <div className="my-auto">
              <EmptyState
                icon={<Compass className="w-6 h-6 text-zinc-400" />}
                title="Nenhuma previsão encontrada"
                description="Não há dados horários disponíveis para este ponto no momento."
                actionLabel="Tentar de novo"
                onAction={() => carregarDadosPonto(activeSlug)}
              />
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
    </PullToRefresh>
  )
}

export default PontoDetalhePage
