import React, { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  fetchPontos,
  fetchPrevisaoPorPonto,
  fetchJanelas,
  PONTOS_DISPONIVEIS,
  calcularRotasNauticas,
} from '@/services/previsaoService'
import { getPontosPersonalizados } from '@/lib/preferencesStorage'
import { Ponto, PrevisaoPayload, JanelasPayload } from '@/types/nautico'
import { usePerfil } from '@/contexts/PerfilContext'
import { PontoDetalhe } from '@/components/PontoDetalhe'
import { LoadingState } from '@/components/ui/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, AlertTriangle, RefreshCw } from 'lucide-react'
import { TopBar } from '@/components/TopBar'

export const PontoDetalhePage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { perfil } = usePerfil()

  const [ponto, setPonto] = useState<Ponto | null>(null)
  const [previsao, setPrevisao] = useState<PrevisaoPayload | null>(null)
  const [janelasData, setJanelasData] = useState<JanelasPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [isPersonalizado, setIsPersonalizado] = useState(false)

  const carregarDados = useCallback(
    async (isManual = false) => {
      if (!slug) return

      if (isManual) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        let pontoEncontrado: Ponto | null = null
        let customOpts: { lat: number; lon: number; tipo: string; nome: string } | null = null
        const perfilId = perfil?.id || 'lancha'

        // 1. Verifica se é um ponto personalizado (slug começa com "custom-")
        if (slug.startsWith('custom-') || slug.startsWith('custom:')) {
          const rawCustomId = slug.startsWith('custom-') ? slug.replace('custom-', '') : slug
          const customPontos = getPontosPersonalizados()
          const cp = customPontos.find((p) => p.id === rawCustomId || `custom-${p.id}` === slug)

          if (cp) {
            pontoEncontrado = {
              id: `custom-${cp.id}`,
              nome: cp.nome,
              lat: cp.lat,
              lon: cp.lon,
              tipo: cp.tipo as any,
              slug: `custom-${cp.id}`,
              descricao: 'Ponto Personalizado',
            }
            customOpts = {
              lat: cp.lat,
              lon: cp.lon,
              tipo: cp.tipo,
              nome: cp.nome,
            }
            setIsPersonalizado(true)
          }
        }

        // 2. Se não for custom, busca nos pontos fixos (PocketBase ou fallback canônico)
        if (!pontoEncontrado) {
          try {
            const pontos = await fetchPontos()
            const lowerSlug = slug.toLowerCase()
            const match = pontos.find(
              (p) =>
                p.slug?.toLowerCase() === lowerSlug ||
                p.nome?.toLowerCase() === lowerSlug ||
                p.id === slug,
            )
            if (match) {
              pontoEncontrado = match
              setIsPersonalizado(false)
            }
          } catch {
            const lowerSlug = slug.toLowerCase()
            const fallback = PONTOS_DISPONIVEIS.find(
              (p) => p.slug === lowerSlug || p.nomeCurto.toLowerCase() === lowerSlug,
            )
            if (fallback) {
              pontoEncontrado = {
                id: fallback.slug,
                nome: fallback.nomeCurto,
                lat: fallback.lat,
                lon: fallback.lon,
                tipo: fallback.tipo as any,
                slug: fallback.slug,
                descricao: fallback.nomeCompleto,
              }
              setIsPersonalizado(false)
            }
          }
        }

        // Se ainda não encontrou, checa novamente no localStorage
        if (!pontoEncontrado) {
          const customPontos = getPontosPersonalizados()
          const cp = customPontos.find(
            (p) => p.id === slug || p.nome.toLowerCase() === slug.toLowerCase(),
          )
          if (cp) {
            pontoEncontrado = {
              id: `custom-${cp.id}`,
              nome: cp.nome,
              lat: cp.lat,
              lon: cp.lon,
              tipo: cp.tipo as any,
              slug: `custom-${cp.id}`,
              descricao: 'Ponto Personalizado',
            }
            customOpts = {
              lat: cp.lat,
              lon: cp.lon,
              tipo: cp.tipo,
              nome: cp.nome,
            }
            setIsPersonalizado(true)
          }
        }

        if (!pontoEncontrado) {
          throw new Error(`Ponto náutico "${slug}" não foi encontrado.`)
        }

        setPonto(pontoEncontrado)

        // Busca Previsão e Janelas
        const [prevPayload, janelasPayload] = await Promise.all([
          fetchPrevisaoPorPonto(
            customOpts ? '' : pontoEncontrado.slug || pontoEncontrado.id,
            customOpts || undefined,
          ),
          fetchJanelas(
            customOpts ? '' : pontoEncontrado.slug || pontoEncontrado.id,
            perfilId,
            customOpts || undefined,
          ),
        ])

        // Calcula rotas completas: 4 fixos + outros personalizados
        const todosDestinos: Array<{ slug: string; nome: string; lat: number; lon: number }> = [
          ...PONTOS_DISPONIVEIS.map((p) => ({
            slug: p.slug,
            nome: p.nomeCurto,
            lat: p.lat,
            lon: p.lon,
          })),
          ...getPontosPersonalizados().map((p) => ({
            slug: `custom-${p.id}`,
            nome: p.nome,
            lat: p.lat,
            lon: p.lon,
          })),
        ]

        const rotasCalculadas = calcularRotasNauticas(
          { lat: pontoEncontrado.lat, lon: pontoEncontrado.lon },
          todosDestinos,
        )

        prevPayload.rotas = rotasCalculadas

        setPrevisao(prevPayload)
        setJanelasData(janelasPayload)
      } catch (err: any) {
        console.error('Erro ao carregar detalhes do ponto:', err)
        setError(err?.message || 'Falha ao carregar os dados meteorológicos do ponto.')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [slug, perfil?.id],
  )

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  return (
    <div
      style={{
        paddingTop: 'calc(3.25rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="max-w-4xl mx-auto px-4 py-4 space-y-4"
    >
      <TopBar
        ultimaAtualizacao={new Date()}
        onRefresh={() => carregarDados(true)}
        isRefreshing={refreshing}
      />

      {/* Botão Superior de Voltar */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/')}
          className="text-zinc-400 hover:text-white gap-2 p-0 h-auto font-medium text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para todos os pontos</span>
        </Button>
      </div>

      {loading && <LoadingState variant="cards" count={3} />}

      {error && !loading && (
        <Card className="bg-[#11161d] border-red-950/40 text-zinc-100 p-6 text-center space-y-4">
          <CardContent className="space-y-4 p-0">
            <div className="w-12 h-12 rounded-full bg-red-950/50 border border-red-900/50 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Falha ao Carregar Ponto</h2>
              <p className="text-sm text-zinc-400 max-w-md mx-auto">{error}</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/')}
                className="bg-transparent border-zinc-700 text-zinc-300"
              >
                Voltar ao Início
              </Button>
              <Button
                size="sm"
                onClick={() => carregarDados()}
                className="bg-cyan-800 hover:bg-cyan-700 text-white gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tentar Novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {ponto && previsao && !loading && (
        <PontoDetalhe
          currentSlug={slug || ponto.slug || ponto.id}
          ponto={ponto}
          previsao={previsao}
          janelasData={janelasData}
          isPersonalizado={isPersonalizado}
          onRefresh={() => carregarDados(true)}
          isRefreshing={refreshing}
        />
      )}
    </div>
  )
}

export default PontoDetalhePage
