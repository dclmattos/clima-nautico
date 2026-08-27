import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Anchor,
  RotateCw,
  Share2,
  Sparkles,
  AlertCircle,
  Copy,
  Mail,
  Smartphone,
  MessageCircle,
  Loader2,
  Check,
} from 'lucide-react'
import { fetchBriefingComandante, enviarBriefingEmail } from '@/services/previsaoService'
import { LoadingState } from '@/components/ui/LoadingState'
import { useToast } from '@/hooks/use-toast'

export interface BriefingCardProps {
  perfilId: string
  deviceId: string
  ultimoBriefingInicial?: string
  updatedAtInicial?: string
  onBriefingUpdated?: (texto: string) => void
}

export const BriefingCard: React.FC<BriefingCardProps> = ({
  perfilId,
  deviceId,
  ultimoBriefingInicial,
  updatedAtInicial,
  onBriefingUpdated,
}) => {
  const { toast } = useToast()
  const [briefingTexto, setBriefingTexto] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [dataBriefing, setDataBriefing] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  // Estados do Modal de Envio por E-mail
  const [emailModalOpen, setEmailModalOpen] = useState<boolean>(false)
  const [emailDestinatario, setEmailDestinatario] = useState<string>('')
  const [emailEnviando, setEmailEnviando] = useState<boolean>(false)
  const [emailErro, setEmailErro] = useState<string | null>(null)

  // Suporte a Web Share API nativo (navigator.share)
  const [hasNativeShare, setHasNativeShare] = useState<boolean>(false)

  useEffect(() => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      setHasNativeShare(true)
    } else {
      setHasNativeShare(false)
    }
  }, [])

  // Ao carregar se já existir ultimoBriefingInicial nas preferências, inicializar
  useEffect(() => {
    if (ultimoBriefingInicial && !briefingTexto && !loading) {
      setBriefingTexto(ultimoBriefingInicial)
      if (updatedAtInicial) {
        try {
          const d = new Date(updatedAtInicial)
          const hh = String(d.getHours()).padStart(2, '0')
          const mm = String(d.getMinutes()).padStart(2, '0')
          setTimestamp(`Gerado às ${hh}:${mm}`)
          setDataBriefing(d.toLocaleDateString('pt-BR'))
        } catch {
          setTimestamp('Briefing salvo')
          setDataBriefing(new Date().toLocaleDateString('pt-BR'))
        }
      } else {
        setDataBriefing(new Date().toLocaleDateString('pt-BR'))
      }
    }
  }, [ultimoBriefingInicial, updatedAtInicial, briefingTexto, loading])

  const gerarBriefing = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchBriefingComandante(perfilId, deviceId)
      setBriefingTexto(res.texto)

      try {
        const d = new Date(res.gerado_em || new Date().toISOString())
        const hh = String(d.getHours()).padStart(2, '0')
        const mm = String(d.getMinutes()).padStart(2, '0')
        setTimestamp(`Gerado às ${hh}:${mm}`)
        setDataBriefing(d.toLocaleDateString('pt-BR'))
      } catch {
        const now = new Date()
        setTimestamp(
          `Gerado às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        )
        setDataBriefing(now.toLocaleDateString('pt-BR'))
      }

      if (onBriefingUpdated) {
        onBriefingUpdated(res.texto)
      }
    } catch (err: any) {
      console.error('Erro ao gerar briefing:', err)
      setError(err?.message || 'Não foi possível gerar o briefing')
    } finally {
      setLoading(false)
    }
  }

  const formatShareText = () => {
    if (!briefingTexto) return ''
    return `⚓ *Clima Náutico — Briefing do Comandante*\n\n${briefingTexto}\n\n🌊 Baía de Ilha Grande`
  }

  // 1. Web Share nativo
  const handleNativeShare = async () => {
    if (!briefingTexto) return
    const texto = formatShareText()
    const dataRef = dataBriefing || new Date().toLocaleDateString('pt-BR')
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Briefing náutico — ${dataRef}`,
          text: texto,
        })
      }
    } catch (err: any) {
      // Se o usuário cancelou o share sheet, ignoramos
      if (err?.name !== 'AbortError') {
        console.warn('Erro no navigator.share:', err)
      }
    }
  }

  // 2. Copiar texto
  const handleCopiarTexto = async () => {
    if (!briefingTexto) return
    const texto = formatShareText()
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(texto)
      } else {
        // Fallback antigo caso clipboard API falhe
        const textarea = document.createElement('textarea')
        textarea.value = texto
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      toast({
        title: 'Texto copiado!',
        description: 'O briefing foi copiado para a área de transferência.',
        duration: 2000,
      })
    } catch (err) {
      console.error('Erro ao copiar texto:', err)
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível copiar o texto automaticamente.',
        variant: 'destructive',
        duration: 2000,
      })
    }
  }

  // 3. Envio por e-mail
  const handleAbrirEmailModal = () => {
    setEmailErro(null)
    setEmailModalOpen(true)
  }

  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!briefingTexto) return

    const emailTrimmed = emailDestinatario.trim()
    if (!emailTrimmed) {
      setEmailErro('Informe o e-mail do destinatário.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(emailTrimmed)) {
      setEmailErro('Por favor, insira um e-mail válido.')
      return
    }

    setEmailEnviando(true)
    setEmailErro(null)

    try {
      const dataRef = dataBriefing || new Date().toLocaleDateString('pt-BR')
      await enviarBriefingEmail(emailTrimmed, briefingTexto, dataRef)

      setEmailModalOpen(false)
      setEmailDestinatario('')
      toast({
        title: 'Briefing enviado!',
        description: `O briefing foi enviado com sucesso para ${emailTrimmed}.`,
        duration: 3000,
      })
    } catch (err: any) {
      console.error('Erro ao enviar e-mail:', err)
      setEmailErro(err?.message || 'Falha ao enviar e-mail. Tente novamente.')
    } finally {
      setEmailEnviando(false)
    }
  }

  // 4. Compartilhar via WhatsApp (wa.me)
  const handleShareWhatsApp = () => {
    if (!briefingTexto) return
    const texto = formatShareText()
    const url = `https://wa.me/?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank', 'noopener')
  }

  return (
    <Card className="w-full bg-gradient-to-br from-[#0e1622] via-[#0f1724] to-[#0c1219] border-cyan-900/50 shadow-lg text-zinc-100 overflow-hidden relative">
      <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl pointer-events-none" />

      <CardHeader className="pb-3 border-b border-zinc-800/80 bg-[#0d131b]/60 flex flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-300 shadow-sm">
            <Anchor className="w-4 h-4" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-1.5">
              <span>Briefing do Comandante</span>
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            </CardTitle>
            <p className="text-[11px] text-zinc-400 font-medium">
              Análise tática instantânea com Inteligência Artificial
            </p>
          </div>
        </div>

        {timestamp && !loading && briefingTexto && (
          <span className="text-[11px] text-zinc-400 bg-zinc-900/80 border border-zinc-800 px-2.5 py-1 rounded-md font-mono shrink-0">
            {timestamp}
          </span>
        )}
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        {/* Loading */}
        {loading && <LoadingState variant="briefing" text="Comandante avaliando condições..." />}

        {/* Erro */}
        {!loading && error && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <Button
              size="sm"
              onClick={gerarBriefing}
              className="bg-red-900/60 hover:bg-red-900 border border-red-700 text-white text-xs gap-1.5 self-start sm:self-auto shrink-0"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Tentar de novo
            </Button>
          </div>
        )}

        {/* Estado Inicial (Sem briefing ainda) */}
        {!loading && !error && !briefingTexto && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-2">
            <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-lg">
              Obtenha um parecer rápido sobre a melhor rota, pontos críticos a evitar e avisos de
              frente fria para o seu tipo de embarcação.
            </p>
            <Button
              onClick={gerarBriefing}
              className="bg-cyan-900 hover:bg-cyan-800 text-cyan-100 border border-cyan-600/50 gap-2 text-xs font-semibold shadow-md shrink-0 w-full sm:w-auto"
            >
              <Anchor className="w-4 h-4" />
              Gerar briefing
            </Button>
          </div>
        )}

        {/* Sucesso (Exibe Briefing em até 5 linhas) */}
        {!loading && !error && briefingTexto && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-[#090d13] border border-cyan-950/80 shadow-inner">
              <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed whitespace-pre-line font-normal">
                {briefingTexto}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={gerarBriefing}
                disabled={loading}
                className="bg-[#121820] border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs gap-1.5"
              >
                <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar briefing
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-cyan-900/90 hover:bg-cyan-800 text-cyan-100 border border-cyan-600/60 text-xs gap-1.5 shadow"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    Compartilhar
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-[#0c1219] border border-cyan-900/70 text-zinc-200 shadow-xl rounded-xl p-1.5"
                >
                  {/* Opção 1: Web Share Nativo (celulares/dispositivos com suporte) */}
                  {hasNativeShare && (
                    <DropdownMenuItem
                      onClick={handleNativeShare}
                      className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:text-white hover:bg-cyan-950/60 rounded-lg cursor-pointer transition-colors"
                    >
                      <Smartphone className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>Compartilhar no dispositivo</span>
                    </DropdownMenuItem>
                  )}

                  {/* Opção 2: Copiar texto com Toast */}
                  <DropdownMenuItem
                    onClick={handleCopiarTexto}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:text-white hover:bg-cyan-950/60 rounded-lg cursor-pointer transition-colors"
                  >
                    <Copy className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Copiar texto</span>
                  </DropdownMenuItem>

                  {/* Opção 3: Enviar por e-mail */}
                  <DropdownMenuItem
                    onClick={handleAbrirEmailModal}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-zinc-200 hover:text-white hover:bg-cyan-950/60 rounded-lg cursor-pointer transition-colors"
                  >
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>Enviar por e-mail</span>
                  </DropdownMenuItem>

                  {/* Opção 4: WhatsApp — sempre visível */}
                  <DropdownMenuItem
                    onClick={handleShareWhatsApp}
                    className="flex items-center gap-2.5 px-3 py-2 text-xs text-emerald-300 hover:text-emerald-100 hover:bg-emerald-950/50 rounded-lg cursor-pointer transition-colors"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>WhatsApp</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal / Dialog de Envio de E-mail */}
      <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0d131b] border-cyan-900/60 text-zinc-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              Enviar briefing por e-mail
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              O relatório do briefing náutico de {dataBriefing || 'hoje'} será enviado para o
              destinatário.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarEmail} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="destinatario-email" className="text-xs font-medium text-zinc-300">
                E-mail do destinatário
              </Label>
              <Input
                id="destinatario-email"
                type="email"
                placeholder="exemplo@marina.com.br"
                value={emailDestinatario}
                onChange={(e) => {
                  setEmailDestinatario(e.target.value)
                  if (emailErro) setEmailErro(null)
                }}
                disabled={emailEnviando}
                className="bg-[#070b10] border-zinc-700/80 focus-visible:border-cyan-500 text-zinc-100 placeholder:text-zinc-500 text-xs h-9"
                autoFocus
              />
              {emailErro && (
                <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  {emailErro}
                </p>
              )}
            </div>

            <div className="p-3 bg-[#06090e] rounded-lg border border-zinc-800/80 text-[11px] text-zinc-400 space-y-1">
              <p className="font-semibold text-zinc-300">
                Assunto: Briefing náutico — {dataBriefing || new Date().toLocaleDateString('pt-BR')}
              </p>
              <p className="line-clamp-2 text-zinc-500 italic">
                {briefingTexto ? `"${briefingTexto.slice(0, 110)}..."` : ''}
              </p>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEmailModalOpen(false)}
                disabled={emailEnviando}
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={emailEnviando}
                className="bg-cyan-800 hover:bg-cyan-700 text-white border border-cyan-600/50 text-xs gap-1.5 font-medium shadow-md"
              >
                {emailEnviando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-3.5 h-3.5" />
                    Enviar
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export default BriefingCard
