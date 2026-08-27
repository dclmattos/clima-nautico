import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usePerfil } from '@/contexts/PerfilContext'
import { fetchBriefingComandante } from '@/services/previsaoService'
import { getStoredPreferences, setStoredPreferences } from '@/lib/preferencesStorage'
import {
  Compass,
  RefreshCw,
  Sparkles,
  Clock,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
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

interface BriefingCardProps {
  onBriefingUpdated?: (texto: string) => void
}

export const BriefingCard: React.FC<BriefingCardProps> = ({ onBriefingUpdated }) => {
  const { perfil, deviceId } = usePerfil()
  const { toast } = useToast()

  const [briefingData, setBriefingData] = useState<{ texto: string; gerado_em: string } | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Estado do Modal de Envio por E-mail
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)
  const [emailEnviadoSucesso, setEmailEnviadoSucesso] = useState(false)

  // Carrega briefing do cache do localStorage inicialmente
  useEffect(() => {
    const prefs = getStoredPreferences()
    if (prefs?.ultimo_briefing && prefs.ultimo_briefing.texto) {
      setBriefingData({
        texto: prefs.ultimo_briefing.texto,
        gerado_em: prefs.ultimo_briefing.timestamp || new Date().toISOString(),
      })
    } else {
      // Se não houver cache, dispara a geração inicial
      gerarNovoBriefing()
    }
  }, [perfil?.id])

  /**
   * Dispara nova geração de briefing com IA
   */
  const gerarNovoBriefing = async () => {
    if (!perfil?.id) return

    setLoading(true)
    setError(null)
    try {
      const res = await fetchBriefingComandante(perfil.id, deviceId)
      const nowIso = res.gerado_em || new Date().toISOString()
      setBriefingData({
        texto: res.texto,
        gerado_em: nowIso,
      })

      // Salva no localStorage como último briefing
      try {
        setStoredPreferences({
          ultimo_briefing: {
            texto: res.texto,
            timestamp: nowIso,
          },
        })
      } catch (saveStorageErr) {
        console.warn('Erro ao salvar briefing no localStorage:', saveStorageErr)
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

  // Formatação de data/hora do briefing
  const formatarHora = (isoDate: string) => {
    try {
      const d = new Date(isoDate)
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      })
    } catch {
      return isoDate
    }
  }

  // Envio do Briefing por E-mail
  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destinatarioEmail || !briefingData?.texto) return

    setEnviandoEmail(true)
    try {
      const { enviarBriefingEmail } = await import('@/services/previsaoService')
      await enviarBriefingEmail(destinatarioEmail, briefingData.texto)

      setEmailEnviadoSucesso(true)
      toast({
        title: 'Briefing enviado!',
        description: `E-mail enviado com sucesso para ${destinatarioEmail}`,
        duration: 4000,
      })

      setTimeout(() => {
        setIsEmailModalOpen(false)
        setEmailEnviadoSucesso(false)
        setDestinatarioEmail('')
      }, 1500)
    } catch (err: any) {
      toast({
        title: 'Erro no envio',
        description: err?.message || 'Não foi possível enviar o e-mail no momento.',
        variant: 'destructive',
      })
    } finally {
      setEnviandoEmail(false)
    }
  }

  return (
    <>
      <Card className="bg-gradient-to-br from-[#11161d] to-[#0c1219] border-cyan-900/40 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <CardHeader className="pb-3 border-b border-zinc-800/80 bg-[#0d1218]/50 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-cyan-950/80 border border-cyan-800/60 text-cyan-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                Briefing do Comandante
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-cyan-400" />
                  IA Náutica
                </span>
              </CardTitle>
              {briefingData?.gerado_em && (
                <p className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  Atualizado em {formatarHora(briefingData.gerado_em)}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEmailModalOpen(true)}
              disabled={loading || !briefingData?.texto}
              className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-300 text-xs gap-1.5 h-8 hidden sm:flex"
            >
              <Send className="w-3.5 h-3.5 text-cyan-400" />
              Enviar por E-mail
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={gerarNovoBriefing}
              disabled={loading}
              className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-300 text-xs gap-1.5 h-8"
              title="Gerar nova síntese com IA"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Regerar</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {loading && (
            <div className="py-6 flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
              <p className="text-xs">Sintetizando condições meteorológicas e janelas ideais...</p>
            </div>
          )}

          {error && !loading && (
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-red-300 text-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={gerarNovoBriefing}
                className="h-7 text-xs text-red-300 hover:text-white"
              >
                Tentar novamente
              </Button>
            </div>
          )}

          {!loading && !error && briefingData?.texto && (
            <div className="space-y-3">
              <div className="text-xs sm:text-sm text-zinc-200 leading-relaxed font-sans whitespace-pre-line bg-[#080d14]/60 p-4 rounded-xl border border-zinc-800/60 selection:bg-cyan-900">
                {briefingData.texto}
              </div>

              {/* Botão Mobile de Enviar por E-mail */}
              <div className="flex sm:hidden justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEmailModalOpen(true)}
                  className="w-full bg-[#161c24] border-zinc-700 text-zinc-300 text-xs gap-1.5 h-8"
                >
                  <Send className="w-3.5 h-3.5 text-cyan-400" />
                  Enviar Briefing por E-mail
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Enviar Briefing por E-mail */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0d131b] border-cyan-900/60 text-zinc-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-4 h-4 text-cyan-400" />
              Enviar Briefing Náutico
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Encaminhe a síntese de hoje para o comandante, tripulação ou marina.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarEmail} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="destinatario-email" className="text-xs font-medium text-zinc-300">
                E-mail do Destinatário
              </Label>
              <Input
                id="destinatario-email"
                type="email"
                required
                placeholder="comandante@marina.com.br"
                value={destinatarioEmail}
                onChange={(e) => setDestinatarioEmail(e.target.value)}
                disabled={enviandoEmail || emailEnviadoSucesso}
                className="bg-[#070b10] border-zinc-700 focus-visible:border-cyan-500 text-zinc-100 placeholder:text-zinc-500 text-xs h-9"
              />
            </div>

            {emailEnviadoSucesso && (
              <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>E-mail enviado com sucesso!</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEmailModalOpen(false)}
                disabled={enviandoEmail}
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={enviandoEmail || !destinatarioEmail || emailEnviadoSucesso}
                className="bg-cyan-800 hover:bg-cyan-700 text-white border border-cyan-600/50 text-xs gap-1.5 font-medium shadow-md"
              >
                {enviandoEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    Enviar agora
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default BriefingCard
