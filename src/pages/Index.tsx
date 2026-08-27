import { Ponto, PontoEstadoPrevisao, JanelaNavegacao } from '@/types/nautico'
import {
  fetchPontos,
  fetchPrevisaoPorPonto,
  fetchJanelas,
  buscarPrevisaoPorCoordenadas,
  buscarJanelasPorCoordenadas,
  getCurrentHourForecast,
  calculateSemaforo,
  getProximaJanela,
  PONTOS_DISPONIVEIS,
} from '@/services/previsaoService'
import { getPontosPersonalizados } from '@/lib/preferencesStorage'
import { PontoCard } from '@/components/PontoCard'
import { BriefingCard } from '@/components/BriefingCard'
import { usePerfil } from '@/contexts/PerfilContext'
import { Button } from '@/components/ui/button'
import { RefreshCw, MapPin } from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import React, { useState, useEffect, useCallback, useMemo } from 'react'

export const Index: React.FC = () => {
  const { perfil, deviceId } = usePerfil()
  const [pontosEstados, setPontosEstados] = useState<PontoEstadoPrevisao[]>([])
  const [loadingGeral, setLoadingGeral] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Ordem canônica dos 4 pontos fixos
  const SLUG_ORDER = ['angra', 'abraao', 'paraty', 'juatinga']

  /**
   * Carrega dados de previsão e janelas de um ponto específico
   */
  const carregarDadosPonto = useCallback(
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
    ): Promise<PontoEstadoPrevisao> => {
      const isCustom = !!customOpts?.isPersonalizado || (ponto.id && ponto.id.startsWith('custom-'))
      try {
        const [prevData, janelasData] = await Promise.all([
          fetchPrevisaoPorPonto(
            isCustom ? '' : ponto.slug || ponto.id,
            customOpts
              ? {
                  lat: customOpts.lat,
                  lon: customOpts.lon,
                  tipo: customOpts.tipo,
                  nome: customOpts.nome,
                }
              : undefined,
          ),
          fetchJanelas(
            isCustom ? '' : ponto.slug || ponto.id,
            perfilId,
            customOpts
              ? {
                  lat: customOpts.lat,
                  lon: customOpts.lon,
                  tipo: customOpts.tipo,
                  nome: customOpts.nome,
                }
              : undefined,
          ),
        ])

        const currentHour = prevData?.hourly ? getCurrentHourForecast(prevData.hourly) : null
        const semaforo = currentHour ? calculateSemaforo(currentHour) : null

        // Próxima janela de navegação encontrada
        const proxima = janelasData?.janelas ? getProximaJanela(janelasData.janelas) : null

        // Score atual baseado na hora mais próxima
        let scoreAtual = null
        if (janelasData?.hourly_scores && currentHour) {
          const matchedScore = janelasData.hourly_scores.find((s) => s.time === currentHour.time)
          if (matchedScore) {
            scoreAtual = matchedScore.score
          }
        }

        return {
          ponto,
          loading: false,
          error: null,
          data: prevData,
          currentHourData: currentHour,
          statusSemaforo: semaforo,
          janelasData: janelasData,
          loadingJanelas: false,
          currentScore: scoreAtual,
          proximaJanela: proxima,
          isPersonalizado: isCustom,
        }
      } catch (err: any) {
        console.error(`Erro ao carregar dados do ponto ${ponto.nome}:`, err)
        return {
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
          isPersonalizado: isCustom,
        }
      }
    },
    [],
  )

  /**
   * Inicializa ou recarrega a lista de pontos (fixos + personalizados)
   */
  const carregarTodosPontos = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) {
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

        // Ordena os pontos fixos canônicos
        const pontosFixosOrdenados = [...pontosFixos].sort((a, b) => {
          const idxA = SLUG_ORDER.indexOf(a.slug || a.nome.toLowerCase())
          const idxB = SLUG_ORDER.indexOf(b.slug || b.nome.toLowerCase())
          if (idxA !== -1 && idxB !== -1) return idxA - idxB
          if (idxA !== -1) return -1
          if (idxB !== -1) return 1
          return a.nome.localeCompare(b.nome)
        })

        // Pontos Personalizados do localStorage
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

        // Carrega em paralelo: fixos + personalizados
        const promessasFixos = pontosFixosOrdenados.map((p) => carregarDadosPonto(p, perfilId))
        const promessasCustom = pontosCustomFormatados.map(({ ponto, customOpts }) =>
          carregarDadosPonto(ponto, perfilId, customOpts),
        )

        const resultados = await Promise.all([...promessasFixos, ...promessasCustom])
        setPontosEstados(resultados)
      } catch (err: any) {
        console.error('Erro ao listar pontos:', err)
      } finally {
        setLoadingGeral(false)
        setRefreshing(false)
      }
    },
    [carregarDadosPonto, perfil?.id],
  )

  useEffect(() => {
    carregarTodosPontos()
  }, [carregarTodosPontos])

  /**
   * Tenta recarregar um ponto individual
   */
  const handleRetryPonto = async (pontoIdentifier: string) => {
    const estadoIdx = pontosEstados.findIndex(
      (e) => e.ponto.id === pontoIdentifier || e.ponto.slug === pontoIdentifier,
    )
    if (estadoIdx === -1) return

    const estadoAlvo = pontosEstados[estadoIdx]

    // Marca como loading
    setPontosEstados((prev) => {
      const clone = [...prev]
      clone[estadoIdx] = { ...estadoAlvo, loading: true, error: null }
      return clone
    })

    const perfilId = perfil?.id || 'lancha'
    const isCustom =
      !!estadoAlvo.isPersonalizado ||
      (estadoAlvo.ponto.id && estadoAlvo.ponto.id.startsWith('custom-'))

    const novoEstado = await carregarDadosPonto(
      estadoAlvo.ponto,
      perfilId,
      isCustom
        ? {
            lat: estadoAlvo.ponto.lat,
            lon: estadoAlvo.ponto.lon,
            tipo: estadoAlvo.ponto.tipo,
            nome: estadoAlvo.ponto.nome,
            isPersonalizado: true,
          }
        : undefined,
    )

    setPontosEstados((prev) => {
      const clone = [...prev]
      clone[estadoIdx] = novoEstado
      return clone
    })
  }

  // Divisão entre Fixos e Personalizados
  const pontosFixosEstados = useMemo(() => {
    return pontosEstados.filter((e) => !e.isPersonalizado && !e.ponto.id?.startsWith('custom-'))
  }, [pontosEstados])

  const pontosCustomEstados = useMemo(() => {
    return pontosEstados.filter((e) => e.isPersonalizado || e.ponto.id?.startsWith('custom-'))
  }, [pontosEstados])

  return (
    <div
      style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      className="space-y-6"
    >
      {/* Bloco 1: Briefing do Comandante (IA) */}
      <section aria-label="Briefing do Comandante">
        <BriefingCard />
      </section>

      {/* Bloco 2: Monitoramento dos Pontos */}
      <section aria-label="Condições dos Pontos" className="space-y-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">Condições dos Pontos</h2>
              <p className="text-xs text-zinc-400">
                Baía de Ilha Grande · Atualizado a cada 30 minutos
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => carregarTodosPontos(true)}
            disabled={refreshing || loadingGeral}
            className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-300 text-xs gap-1.5 h-8"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </Button>
        </div>

        {loadingGeral ? (
          <LoadingState variant="cards" count={4} />
        ) : (
          <div className="space-y-6">
            {/* Grid dos 4 Pontos Canônicos */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pontosFixosEstados.map((estado) => (
                <PontoCard
                  key={estado.ponto.slug || estado.ponto.id}
                  estado={estado}
                  onRetry={handleRetryPonto}
                />
              ))}
            </div>

            {/* Seção dos Pontos Personalizados se houver */}
            {pontosCustomEstados.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 border-b border-zinc-800/60 pb-2">
                  <span className="text-amber-400 text-sm">⭐</span>
                  <h3 className="text-sm font-bold text-zinc-200 tracking-tight uppercase tracking-wider">
                    Meus Pontos Personalizados ({pontosCustomEstados.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pontosCustomEstados.map((estado) => (
                    <PontoCard key={estado.ponto.id} estado={estado} onRetry={handleRetryPonto} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}

export default Index
