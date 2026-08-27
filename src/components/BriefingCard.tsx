import React, { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Anchor, RotateCw, Share2, Sparkles, AlertCircle } from 'lucide-react'
import { fetchBriefingComandante } from '@/services/previsaoService'
import { LoadingState } from '@/components/ui/LoadingState'

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
  const [briefingTexto, setBriefingTexto] = useState<string | null>(null)
  const [timestamp, setTimestamp] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

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
        } catch {
          setTimestamp('Briefing salvo')
        }
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
      } catch {
        const now = new Date()
        setTimestamp(
          `Gerado às ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        )
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

  const handleShareWhatsApp = () => {
    if (!briefingTexto) return
    const textoCompartilhar = `⚓ *Clima Náutico — Briefing do Comandante*\n\n${briefingTexto}\n\n🌊 Baía de Ilha Grande`
    const url = `https://wa.me/?text=${encodeURIComponent(textoCompartilhar)}`
    window.open(url, '_blank')
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

              <Button
                size="sm"
                onClick={handleShareWhatsApp}
                className="bg-emerald-900/80 hover:bg-emerald-800 text-emerald-100 border border-emerald-700/60 text-xs gap-1.5 shadow"
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartilhar no WhatsApp
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default BriefingCard
