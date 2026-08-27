import { Ponto, PontoEstadoPrevisao, ResumoDiaResultado } from '@/types/nautico'
import {
  fetchPontos,
  fetchPrevisaoPorPonto,
  fetchJanelas,
  fetchResumoDia,
  enviarBriefingEmail,
  getCurrentHourForecast,
  calculateSemaforo,
  getProximaJanela,
  formatarJanelaBadge,
  formatPontoNome,
  PONTOS_DISPONIVEIS,
} from '@/services/previsaoService'
import { getPontosPersonalizados } from '@/lib/preferencesStorage'
import { PontoCard } from '@/components/PontoCard'
import { TopBar } from '@/components/TopBar'
import { usePerfil } from '@/contexts/PerfilContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import {
  RefreshCw,
  MapPin,
  Star,
  AlertTriangle,
  Sun,
  CloudSun,
  Share2,
  Copy,
  MessageCircle,
  Mail,
  Loader2,
} from 'lucide-react'
import { LoadingState } from '@/components/ui/LoadingState'
import React, { useState, useEffect, useCallback, useMemo } from 'react'

export const Index: React.FC = () => {
  const { perfil, deviceId } = usePerfil()
  const { toast } = useToast()
  const [pontosEstados, setPontosEstados] = useState<PontoEstadoPrevisao[]>([])
  const [loadingGeral, setLoadingGeral] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [resumoDia, setResumoDia] = useState<ResumoDiaResultado | null>(null)
  const [loadingResumo, setLoadingResumo] = useState(true)

  // Modal de E-mail para compartilhamento
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)

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

        // Carrega resumo do dia em paralelo
        setLoadingResumo(true)
        const customPointsPayload = customPontosStorage.map((cp) => ({
          id: cp.id,
          nome: cp.nome,
          lat: cp.lat,
          lon: cp.lon,
          tipo: cp.tipo,
        }))

        fetchResumoDia(perfilId, deviceId, customPointsPayload)
          .then((res) => {
            setResumoDia(res)
          })
          .catch((err) => {
            console.warn('Resumo do dia indisponível ou 503:', err?.message || err)
            setResumoDia(null)
          })
          .finally(() => {
            setLoadingResumo(false)
          })

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
    [carregarDadosPonto, perfil?.id, deviceId],
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

  // Formata hora no formato "8h–15h"
  const formatIntervaloHoras = (inicioIso?: string | null, fimIso?: string | null) => {
    if (!inicioIso || !fimIso) return ''
    try {
      const hIni = new Date(inicioIso).getHours()
      const hFim = new Date(fimIso).getHours()
      return `${hIni}h–${hFim}h`
    } catch {
      return ''
    }
  }

  // Monta texto estruturado de compartilhamento (Resumo do Dia + Janelas dos Próximos 3 Dias)
  const getTextoCompartilhamento = useCallback(() => {
    const dataHoje = new Date().toLocaleDateString('pt-BR')
    const perfilNome = perfil?.nome?.toUpperCase() || 'LANCHA'
    let txt = `⛵ *Clima Náutico — ${dataHoje}*\nPerfil: ${perfilNome}\n\n`

    if (resumoDia) {
      txt += `📋 *Resumo do Dia:*\n`
      if (resumoDia.melhor) {
        const intervalo = formatIntervaloHoras(
          resumoDia.melhor.janela_inicio,
          resumoDia.melhor.janela_fim,
        )
        txt += `⭐ Melhor: ${resumoDia.melhor.ponto_nome}${intervalo ? ` ${intervalo}` : ''} (${resumoDia.melhor.score_medio})\n`
      }
      if (resumoDia.evitar) {
        txt += `⚠️ Evitar: ${resumoDia.evitar.ponto_nome} (${resumoDia.evitar.fator_limitante || 'score baixo'})\n`
      }
      if (resumoDia.frente_fria) {
        txt += `☀️ ${resumoDia.frente_fria}\n`
      }
      txt += `\n`
    }

    // Lista de Janelas dos próximos 3 dias por ponto
    txt += `🗓️ *Janelas Ideais (Score ≥ 70) — Próximos 3 dias:*\n`
    let temJanelas = false

    pontosEstados.forEach((pe) => {
      const janelas = pe.janelasData?.janelas || []
      if (janelas.length > 0) {
        temJanelas = true
        const isCustom = pe.isPersonalizado || pe.ponto.id?.startsWith('custom-')
        const nomePonto = isCustom ? pe.ponto.nome : formatPontoNome(pe.ponto.nome) || pe.ponto.nome
        txt += `📍 *${nomePonto}*:\n`
        janelas.slice(0, 3).forEach((j) => {
          const badge = formatarJanelaBadge(j.inicio, j.fim)
          txt += `  • ${badge} (${j.score_medio} pts${j.fator_limitante ? ` · ${j.fator_limitante}` : ''})\n`
        })
      }
    })

    if (!temJanelas) {
      txt += `Nenhuma janela contínua de 3h diurnas com score ≥ 70 detectada.\n`
    }

    txt += `\nGerado no Clima Náutico · Baía de Ilha Grande`
    return txt
  }, [perfil?.nome, resumoDia, pontosEstados])

  // Compartilhar WhatsApp
  const handleShareWhatsApp = () => {
    const texto = getTextoCompartilhamento()
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  // Copiar Texto
  const handleCopiarTexto = async () => {
    const texto = getTextoCompartilhamento()
    try {
      await navigator.clipboard.writeText(texto)
      toast({
        title: 'Copiado para a área de transferência!',
        description: 'Resumo e janelas prontos para colar.',
      })
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível acessar a área de transferência.',
        variant: 'destructive',
      })
    }
  }

  // Web Share API
  const handleShareNativo = async () => {
    const texto = getTextoCompartilhamento()
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Clima Náutico — Resumo e Janelas',
          text: texto,
        })
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          handleCopiarTexto()
        }
      }
    } else {
      handleCopiarTexto()
    }
  }

  // Enviar por E-mail
  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destinatarioEmail) return

    setEnviandoEmail(true)
    try {
      const texto = getTextoCompartilhamento()
      await enviarBriefingEmail(destinatarioEmail, texto)
      toast({
        title: 'Briefing enviado por e-mail!',
        description: `Enviado com sucesso para ${destinatarioEmail}`,
      })
      setIsEmailModalOpen(false)
      setDestinatarioEmail('')
    } catch (err: any) {
      toast({
        title: 'Falha no envio',
        description: err?.message || 'Não foi possível enviar o e-mail no momento.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoEmail(false)
    }
  }

  return (
    <div
      style={{
        paddingTop: 'calc(3.25rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="max-w-4xl mx-auto px-4 py-4 space-y-5 text-zinc-100"
    >
      <TopBar
        ultimaAtualizacao={resumoDia?.atualizado_em || new Date()}
        onRefresh={() => carregarTodosPontos(true)}
        isRefreshing={refreshing}
      />

      {/* Resumo do Dia (Inline Compacto) */}
      {loadingResumo ? (
        <div className="h-9 rounded-xl bg-zinc-900/60 border border-zinc-800/80 animate-pulse flex items-center px-4">
          <div className="h-3.5 bg-zinc-800 rounded w-3/4"></div>
        </div>
      ) : resumoDia ? (
        <section
          aria-label="Resumo do dia"
          className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-[#0e1622] via-[#0d141e] to-[#0a0f16] border border-cyan-900/40 shadow-sm text-xs sm:text-sm text-zinc-300"
        >
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap overflow-x-auto scrollbar-none leading-relaxed">
            {/* Melhor Ponto */}
            {resumoDia.melhor && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                <span>
                  <strong className="text-white">Melhor:</strong> {resumoDia.melhor.ponto_nome}
                  {formatIntervaloHoras(
                    resumoDia.melhor.janela_inicio,
                    resumoDia.melhor.janela_fim,
                  ) && (
                    <span className="text-cyan-300 font-mono font-semibold ml-1">
                      {formatIntervaloHoras(
                        resumoDia.melhor.janela_inicio,
                        resumoDia.melhor.janela_fim,
                      )}
                    </span>
                  )}
                  <span className="text-emerald-400 font-mono font-bold ml-1">
                    ({resumoDia.melhor.score_medio})
                  </span>
                </span>
              </div>
            )}

            {/* Separador */}
            {resumoDia.melhor && resumoDia.evitar && (
              <span className="text-zinc-600 hidden sm:inline">·</span>
            )}

            {/* Ponto a Evitar */}
            {resumoDia.evitar && (
              <div className="flex items-center gap-1.5 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>
                  <strong className="text-white">Evitar:</strong> {resumoDia.evitar.ponto_nome}
                  {resumoDia.evitar.fator_limitante && (
                    <span className="text-zinc-400 ml-1">({resumoDia.evitar.fator_limitante})</span>
                  )}
                </span>
              </div>
            )}

            {/* Separador */}
            {resumoDia.evitar && resumoDia.frente_fria && (
              <span className="text-zinc-600 hidden sm:inline">·</span>
            )}

            {/* Alerta Frente Fria */}
            {resumoDia.frente_fria && (
              <div className="flex items-center gap-1.5 shrink-0">
                {resumoDia.frente_fria.toLowerCase().includes('sem frente fria') ? (
                  <Sun className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                ) : (
                  <CloudSun className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                )}
                <span
                  className={
                    resumoDia.frente_fria.toLowerCase().includes('sem frente fria')
                      ? 'text-zinc-300'
                      : 'text-sky-300 font-semibold'
                  }
                >
                  {resumoDia.frente_fria}
                </span>
              </div>
            )}
          </div>
        </section>
      ) : null}

      {/* Monitoramento dos Pontos */}
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

      {/* Botão Flutuante Compartilhar no canto inferior direito */}
      <div
        style={{
          bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))',
        }}
        className="fixed right-4 z-40"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              className="h-12 w-12 rounded-full bg-gradient-to-tr from-cyan-600 to-cyan-400 hover:from-cyan-500 hover:to-cyan-300 text-zinc-950 font-bold shadow-[0_4px_20px_rgba(6,182,212,0.4)] border border-cyan-300/40 flex items-center justify-center p-0 transition-all hover:scale-105 active:scale-95"
              title="Compartilhar resumo e janelas"
            >
              <Share2 className="w-5 h-5 text-zinc-950" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            side="top"
            className="bg-[#0e141d] border-zinc-800 text-zinc-200 mb-2 shadow-2xl min-w-[200px]"
          >
            <DropdownMenuItem
              onClick={handleShareWhatsApp}
              className="gap-2.5 text-xs cursor-pointer hover:bg-zinc-800 py-2"
            >
              <MessageCircle className="w-4 h-4 text-emerald-400" />
              WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleShareNativo}
              className="gap-2.5 text-xs cursor-pointer hover:bg-zinc-800 py-2"
            >
              <Share2 className="w-4 h-4 text-cyan-400" />
              Compartilhar no dispositivo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleCopiarTexto}
              className="gap-2.5 text-xs cursor-pointer hover:bg-zinc-800 py-2"
            >
              <Copy className="w-4 h-4 text-zinc-400" />
              Copiar resumo
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setIsEmailModalOpen(true)}
              className="gap-2.5 text-xs cursor-pointer hover:bg-zinc-800 py-2"
            >
              <Mail className="w-4 h-4 text-amber-400" />
              Enviar por e-mail
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Modal Enviar por E-mail */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0d131b] border-zinc-800 text-zinc-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              Enviar Resumo por E-mail
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Encaminhe o resumo das condições e janelas ideais dos próximos 3 dias.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarEmail} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="email-dest" className="text-xs font-medium text-zinc-300">
                E-mail do Destinatário
              </Label>
              <Input
                id="email-dest"
                type="email"
                required
                placeholder="comandante@marina.com.br"
                value={destinatarioEmail}
                onChange={(e) => setDestinatarioEmail(e.target.value)}
                disabled={enviandoEmail}
                className="bg-[#070b10] border-zinc-700 focus-visible:border-cyan-500 text-zinc-100 placeholder:text-zinc-500 text-xs h-9"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={enviandoEmail}
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={enviandoEmail || !destinatarioEmail}
                className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs gap-1.5 font-medium shadow-md"
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    Enviar agora
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Index
