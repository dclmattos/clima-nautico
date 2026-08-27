import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { usePerfil } from '@/contexts/PerfilContext'
import {
  fetchPontos,
  fetchCalculoTravessia,
  enviarBriefingEmail,
  PONTOS_DISPONIVEIS,
  getWindDirectionLabel,
} from '@/services/previsaoService'
import { getPontosPersonalizados } from '@/lib/preferencesStorage'
import { Ponto, TravessiaResultado, TravessiaAmostra } from '@/types/nautico'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Navigation,
  Compass,
  Clock,
  Fuel,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowLeftRight,
  Sparkles,
  Share2,
  Copy,
  Mail,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Waves,
  Wind,
  Sunset,
  RefreshCw,
} from 'lucide-react'
import { TopBar } from '@/components/TopBar'

// Pega a próxima hora cheia formatada para o input datetime-local no fuso America/Sao_Paulo: YYYY-MM-DDTHH:00
function getProximaHoraCheiaIso(): string {
  const agora = new Date()
  // Usa Intl para obter o horário em America/Sao_Paulo
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  // Format parts para decompor com precisão
  const parts = dtf.formatToParts(agora)
  const map: Record<string, string> = {}
  parts.forEach((p) => {
    map[p.type] = p.value
  })

  let y = parseInt(map.year || '2026', 10)
  let m = parseInt(map.month || '1', 10) - 1
  let day = parseInt(map.day || '1', 10)
  let h = parseInt(map.hour || '0', 10)

  // Avança 1 hora
  h += 1
  const d = new Date(Date.UTC(y, m, day, h, 0, 0))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:00`
}

// Converte o valor do input datetime-local (ex: "2026-08-27T08:00") em ISO com offset -03:00 (America/Sao_Paulo)
function toSaoPauloIsoWithOffset(datetimeLocalVal: string): string {
  if (!datetimeLocalVal) return ''
  const trimmed = datetimeLocalVal.trim()
  if (trimmed.includes('+') || (trimmed.includes('-') && trimmed.lastIndexOf('-') > 7)) {
    return trimmed
  }
  // Se tem segundos YYYY-MM-DDTHH:MM:SS
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}-03:00`
  }
  // Se tem minutos YYYY-MM-DDTHH:MM
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00-03:00`
  }
  return `${trimmed}-03:00`
}

const formatadorHoraCurtaSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const formatadorDataHoraCompletaSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatarHoraCurta(isoString?: string | null): string {
  if (!isoString) return '--:--'
  try {
    let s = String(isoString).trim()
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      s += '-03:00'
    }
    const d = new Date(s)
    if (isNaN(d.getTime())) return isoString.slice(11, 16) || '--:--'
    return formatadorHoraCurtaSP.format(d)
  } catch {
    return isoString.slice(11, 16) || '--:--'
  }
}

function formatarDataHoraCompleta(isoString?: string | null): string {
  if (!isoString) return '--'
  try {
    let s = String(isoString).trim()
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      s += '-03:00'
    }
    const d = new Date(s)
    if (isNaN(d.getTime())) return isoString
    return formatadorDataHoraCompletaSP.format(d)
  } catch {
    return isoString
  }
}

function formatarDuracao(horasDecimais: number): string {
  const totalMin = Math.round(horasDecimais * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}min`
  if (m === 0) return `${h}h`
  return `${h}h ${String(m).padStart(2, '0')}min`
}

export default function TravessiaPage() {
  const { perfil, deviceId } = usePerfil()
  const { toast } = useToast()

  // Lista de pontos disponíveis (fixos + custom)
  const [pontosFixos, setPontosFixos] = useState<Ponto[]>([])
  const [pontosCustom, setPontosCustom] = useState<
    Array<{ id: string; nome: string; lat: number; lon: number; tipo: string }>
  >([])

  // Formulário
  const [origem, setOrigem] = useState<string>('angra')
  const [destino, setDestino] = useState<string>('abraao')
  const [horaSaida, setHoraSaida] = useState<string>(getProximaHoraCheiaIso())
  const [velocidadeNos, setVelocidadeNos] = useState<string>('')
  const [consumoLh, setConsumoLh] = useState<string>('')

  // Velocidade padrão baseada no perfil
  const velocidadePadrao = useMemo(() => {
    const p = (perfil?.nome || '').toLowerCase()
    if (p === 'veleiro') return 6
    if (p === 'jet' || p === 'jetski' || p === 'jet-ski') return 25
    return 18 // lancha
  }, [perfil?.nome])

  // Estados de cálculo e resultados
  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState<TravessiaResultado | null>(null)

  // Estado do Modal de E-mail para compartilhamento
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [destinatarioEmail, setDestinatarioEmail] = useState('')
  const [enviandoEmail, setEnviandoEmail] = useState(false)

  // Carrega pontos ao montar
  useEffect(() => {
    async function carregarPontos() {
      try {
        const fixos = await fetchPontos()
        setPontosFixos(fixos)
      } catch {
        setPontosFixos(
          PONTOS_DISPONIVEIS.map((p) => ({
            id: p.slug,
            nome: p.nomeCurto,
            lat: p.lat,
            lon: p.lon,
            tipo: p.tipo as any,
            slug: p.slug,
          })),
        )
      }

      try {
        const custom = getPontosPersonalizados()
        setPontosCustom(custom)
      } catch (err) {
        console.error('Erro ao ler pontos customizados:', err)
      }
    }
    carregarPontos()
  }, [])

  // Mapeamento dos nomes canônicos completos para os 4 pontos fixos
  const NOMES_PONTOS_FIXOS: Record<string, string> = {
    angra: 'Angra dos Reis',
    abraao: 'Abraão (Ilha Grande)',
    paraty: 'Paraty',
    juatinga: 'Juatinga',
  }

  // Lista unificada para os dropdowns de seleção
  const listaOpcoesPontos = useMemo(() => {
    const lista: Array<{ value: string; label: string; group: string }> = []

    // 1. Os 4 pontos fixos
    const slugsFixos = ['angra', 'abraao', 'paraty', 'juatinga']
    slugsFixos.forEach((slug) => {
      lista.push({
        value: slug,
        label: NOMES_PONTOS_FIXOS[slug] || slug,
        group: 'Pontos Canônicos',
      })
    })

    // Adiciona outros pontos fixos do backend se houver e não estiverem entre os 4
    pontosFixos.forEach((pf) => {
      const val = pf.slug || pf.id
      if (!slugsFixos.includes(val)) {
        lista.push({
          value: val,
          label: pf.nome,
          group: 'Pontos Canônicos',
        })
      }
    })

    // 2. Pontos personalizados salvos no localStorage
    pontosCustom.forEach((pc) => {
      lista.push({
        value: pc.id,
        label: `⭐ ${pc.nome}`,
        group: 'Meus Pontos',
      })
    })

    return lista
  }, [pontosFixos, pontosCustom])

  const handleOrigemChange = (novoValor: string) => {
    setOrigem(novoValor)
    if (destino === novoValor) {
      setDestino('')
    }
  }

  const handleDestinoChange = (novoValor: string) => {
    setDestino(novoValor)
    if (origem === novoValor) {
      setOrigem('')
    }
  }

  // Dispara o cálculo da travessia
  const handleCalcular = useCallback(
    async (horaParaCalcular?: string) => {
      if (!origem || !destino) {
        toast({
          title: 'Pontos incompletos',
          description: 'Selecione a origem e o destino da travessia.',
          variant: 'destructive',
        })
        return
      }

      if (origem === destino) {
        toast({
          title: 'Origem e destino iguais',
          description: 'Escolha pontos diferentes para planejar a travessia.',
          variant: 'destructive',
        })
        return
      }

      setCalculando(true)

      const rawHora = horaParaCalcular || horaSaida || getProximaHoraCheiaIso()
      const targetHoraComOffset = toSaoPauloIsoWithOffset(rawHora)
      const velNumber = velocidadeNos ? parseFloat(velocidadeNos) : velocidadePadrao
      const consumoNumber = consumoLh ? parseFloat(consumoLh) : undefined

      try {
        const res = await fetchCalculoTravessia({
          origem,
          destino,
          hora_saida: targetHoraComOffset,
          velocidade_nos: velNumber,
          perfil_id: perfil?.id || 'lancha',
          consumo_lh: consumoNumber,
          dispositivo_uuid: deviceId,
        })

        setResultado(res)
      } catch (err: any) {
        console.error('Erro ao calcular travessia:', err)
        const msg = err?.message || ''
        if (msg.toLowerCase().includes('em terra')) {
          toast({
            title: 'Posição em terra',
            description: 'Esta posição parece estar em terra — ajuste para o mar.',
            variant: 'destructive',
          })
        } else {
          toast({
            title: 'Erro no cálculo',
            description:
              'Não foi possível calcular a travessia. Verifique os pontos e tente novamente.',
            variant: 'destructive',
          })
        }
      } finally {
        setCalculando(false)
      }
    },
    [
      origem,
      destino,
      horaSaida,
      velocidadeNos,
      velocidadePadrao,
      consumoLh,
      perfil?.id,
      deviceId,
      toast,
    ],
  )

  // Aplica a melhor alternativa recomendada
  const handleUsarAlternativa = () => {
    if (!resultado?.melhor_alternativa) return
    const novaHora = resultado.melhor_alternativa.hora_saida.slice(0, 16)
    setHoraSaida(novaHora)
    handleCalcular(resultado.melhor_alternativa.hora_saida)
  }

  // Inverter origem e destino
  const handleInverter = () => {
    const aux = origem
    setOrigem(destino)
    setDestino(aux)
  }

  // Monta texto de resumo da travessia para compartilhamento
  const getTextoCompartilhamento = () => {
    if (!resultado) return ''
    const oNome = resultado.origem?.nome || 'Origem'
    const dNome = resultado.destino?.nome || 'Destino'
    const vereditoEmoji =
      resultado.veredito === 'verde' ? '🟢' : resultado.veredito === 'amarelo' ? '🟡' : '🔴'
    const vereditoTexto = resultado.veredito.toUpperCase()

    let txt = `⛵ *Clima Náutico — Plano de Travessia*\n`
    txt += `📍 *${oNome}* ➔ *${dNome}*\n`
    txt += `📏 Distância: ${resultado.distancia_nm} NM | Rumo: ${resultado.rumo_verdadeiro}° (${getWindDirectionLabel(resultado.rumo_verdadeiro)})\n`
    txt += `⏱️ Duração: ${formatarDuracao(resultado.duracao_horas)} | ETA: ${formatarHoraCurta(resultado.eta)}h\n`
    txt += `${vereditoEmoji} Veredito: *${vereditoTexto}*\n`

    if (resultado.combustivel_litros) {
      txt += `⛽ Combustível: ${resultado.combustivel_litros} L (c/ reserva 20%: ${resultado.combustivel_com_reserva} L)\n`
    }
    if (resultado.aviso) {
      txt += `⚠️ Atenção: ${resultado.aviso}\n`
    }
    if (resultado.melhor_alternativa) {
      txt += `💡 Melhor saída: ${formatarHoraCurta(resultado.melhor_alternativa.hora_saida)}h (${resultado.melhor_alternativa.veredito.toUpperCase()})\n`
    }
    txt += `\nGerado no Clima Náutico · Baía de Ilha Grande`
    return txt
  }

  // Compartilhar via WhatsApp
  const handleShareWhatsApp = () => {
    const texto = getTextoCompartilhamento()
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`
    window.open(url, '_blank')
  }

  // Copiar para a área de transferência
  const handleCopiarTexto = async () => {
    const texto = getTextoCompartilhamento()
    try {
      await navigator.clipboard.writeText(texto)
      toast({
        title: 'Copiado para a área de transferência!',
        description: 'Resumo da travessia pronto para colar.',
      })
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível acessar a área de transferência.',
        variant: 'destructive',
      })
    }
  }

  // Compartilhar Nativo (Web Share API)
  const handleShareNativo = async () => {
    const texto = getTextoCompartilhamento()
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Travessia ${resultado?.origem?.nome} -> ${resultado?.destino?.nome}`,
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

  // Envio por E-mail
  const handleEnviarEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!destinatarioEmail || !resultado) return

    setEnviandoEmail(true)
    try {
      const texto = getTextoCompartilhamento()
      await enviarBriefingEmail(
        destinatarioEmail,
        texto,
        `Travessia ${resultado.origem?.nome} ➔ ${resultado.destino?.nome}`,
      )
      toast({
        title: 'Plano enviado por e-mail!',
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

  // Render do ícone de direção relativa
  const renderIconeDirecaoRelativa = (dir: string) => {
    if (dir === 'proa') {
      return (
        <span className="flex items-center gap-1 text-red-400 font-medium">
          <ArrowUp className="w-3.5 h-3.5 rotate-180" /> Proa
        </span>
      )
    }
    if (dir === 'popa') {
      return (
        <span className="flex items-center gap-1 text-emerald-400 font-medium">
          <ArrowDown className="w-3.5 h-3.5 rotate-180" /> Popa
        </span>
      )
    }
    return (
      <span className="flex items-center gap-1 text-amber-400 font-medium">
        <ArrowLeftRight className="w-3.5 h-3.5" /> Través
      </span>
    )
  }

  return (
    <div
      style={{
        paddingTop: 'calc(3.25rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
      }}
      className="max-w-4xl mx-auto px-4 py-4 space-y-6 text-zinc-100"
    >
      <TopBar
        ultimaAtualizacao={new Date()}
        onRefresh={() => handleCalcular()}
        isRefreshing={calculando}
      />

      {/* Cabeçalho */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-800/60 text-cyan-400 shadow-md">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Planejador de Travessia
            </h1>
            <p className="text-xs text-zinc-400">
              Análise meteorológica multi-ponto e cálculo de rota na Baía de Ilha Grande
            </p>
          </div>
        </div>
      </div>

      {/* Formulário de Configuração da Travessia */}
      <Card className="bg-[#0f141d] border-zinc-800 shadow-xl overflow-hidden">
        <CardHeader className="bg-[#121822] border-b border-zinc-800/70 py-3 px-4">
          <CardTitle className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Compass className="w-4 h-4 text-cyan-400" />
            Parâmetros do Percurso
          </CardTitle>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-4 items-center">
            {/* Origem */}
            <div className="sm:col-span-5 space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Ponto de Origem</Label>
              <Select value={origem} onValueChange={handleOrigemChange}>
                <SelectTrigger className="bg-[#090d13] border-zinc-700 text-zinc-100 h-9 text-xs">
                  <SelectValue placeholder="Selecione a origem" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d131b] border-zinc-700 text-zinc-200">
                  {listaOpcoesPontos.map((pt) => (
                    <SelectItem
                      key={`origem-${pt.value}`}
                      value={pt.value}
                      disabled={pt.value === destino}
                      className="text-xs"
                    >
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Botão Trocar Origem/Destino */}
            <div className="sm:col-span-2 flex justify-center pt-2 sm:pt-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleInverter}
                className="h-8 w-8 rounded-full bg-[#161c24] border-zinc-700 text-cyan-400 hover:text-white hover:border-cyan-500"
                title="Inverter origem e destino"
              >
                <ArrowRight className="w-4 h-4 rotate-90 sm:rotate-0" />
              </Button>
            </div>

            {/* Destino */}
            <div className="sm:col-span-5 space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">Ponto de Destino</Label>
              <Select value={destino} onValueChange={handleDestinoChange}>
                <SelectTrigger className="bg-[#090d13] border-zinc-700 text-zinc-100 h-9 text-xs">
                  <SelectValue placeholder="Selecione o destino" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d131b] border-zinc-700 text-zinc-200">
                  {listaOpcoesPontos.map((pt) => (
                    <SelectItem
                      key={`dest-${pt.value}`}
                      value={pt.value}
                      disabled={pt.value === origem}
                      className="text-xs"
                    >
                      {pt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-1">
            {/* Data e Hora de Saída */}
            <div className="space-y-1.5">
              <Label
                htmlFor="hora-saida"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5"
              >
                <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                Data/Hora de Saída
              </Label>
              <Input
                id="hora-saida"
                type="datetime-local"
                value={horaSaida}
                onChange={(e) => setHoraSaida(e.target.value)}
                className="bg-[#090d13] border-zinc-700 text-zinc-100 h-9 text-xs [color-scheme:dark]"
              />
            </div>

            {/* Velocidade de Cruzeiro */}
            <div className="space-y-1.5">
              <Label
                htmlFor="velocidade-nos"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5"
              >
                <Wind className="w-3.5 h-3.5 text-zinc-400" />
                Velocidade (nós)
              </Label>
              <Input
                id="velocidade-nos"
                type="number"
                min="1"
                max="80"
                step="0.5"
                placeholder={`Padrão ${velocidadePadrao} kt (${perfil?.nome || 'perfil'})`}
                value={velocidadeNos}
                onChange={(e) => setVelocidadeNos(e.target.value)}
                className="bg-[#090d13] border-zinc-700 text-zinc-100 h-9 text-xs placeholder:text-zinc-500"
              />
            </div>

            {/* Consumo de Combustível */}
            <div className="space-y-1.5">
              <Label
                htmlFor="consumo-lh"
                className="text-xs font-medium text-zinc-300 flex items-center gap-1.5"
              >
                <Fuel className="w-3.5 h-3.5 text-zinc-400" />
                Consumo (L/hora){' '}
                <span className="text-[10px] text-zinc-500 font-normal">(opcional)</span>
              </Label>
              <Input
                id="consumo-lh"
                type="number"
                min="0"
                step="0.5"
                placeholder="Opcional"
                value={consumoLh}
                onChange={(e) => setConsumoLh(e.target.value)}
                className="bg-[#090d13] border-zinc-700 text-zinc-100 h-9 text-xs placeholder:text-zinc-500"
              />
            </div>
          </div>

          {/* Botão de Ação */}
          <div className="pt-2 flex justify-end">
            <Button
              onClick={() => handleCalcular()}
              disabled={calculando}
              className="w-full sm:w-auto bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-zinc-950 font-bold text-xs h-10 px-6 gap-2 shadow-lg shadow-cyan-950/50"
            >
              {calculando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  Calculando travessia...
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 text-zinc-950" />
                  Calcular Travessia
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* RESULTADO DO CÁLCULO */}
      {resultado && (
        <div className="space-y-5 animate-in fade-in-50 duration-300">
          {/* Card Principal de Veredito */}
          <Card
            className={`border shadow-2xl relative overflow-hidden ${
              resultado.veredito === 'verde'
                ? 'bg-gradient-to-br from-[#0c1a14] to-[#0a110e] border-emerald-900/60'
                : resultado.veredito === 'amarelo'
                  ? 'bg-gradient-to-br from-[#1a170a] to-[#121007] border-amber-900/60'
                  : 'bg-gradient-to-br from-[#1c0c0e] to-[#14080a] border-red-900/60'
            }`}
          >
            <CardContent className="p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                {/* Veredito Grande */}
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0 border"
                    style={{
                      backgroundColor:
                        resultado.veredito === 'verde'
                          ? 'rgba(34, 197, 94, 0.15)'
                          : resultado.veredito === 'amarelo'
                            ? 'rgba(234, 179, 8, 0.15)'
                            : 'rgba(239, 68, 68, 0.15)',
                      borderColor:
                        resultado.veredito === 'verde'
                          ? '#22c55e'
                          : resultado.veredito === 'amarelo'
                            ? '#eab308'
                            : '#ef4444',
                    }}
                  >
                    {resultado.veredito === 'verde' ? (
                      <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    ) : resultado.veredito === 'amarelo' ? (
                      <AlertTriangle className="w-8 h-8 text-amber-400" />
                    ) : (
                      <XCircle className="w-8 h-8 text-red-400" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
                        Veredito {resultado.veredito}
                      </h2>
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase font-bold px-2 py-0.5 border"
                        style={{
                          color: resultado.veredito_cor,
                          borderColor: resultado.veredito_cor,
                        }}
                      >
                        {resultado.veredito === 'verde'
                          ? 'Condições Ideais'
                          : resultado.veredito === 'amarelo'
                            ? 'Atenção Requerida'
                            : 'Navegação Crítica'}
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-300 mt-1">
                      {resultado.origem.nome} ➔ {resultado.destino.nome}
                    </p>
                  </div>
                </div>

                {/* Botões de Ação: Compartilhar */}
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  {/* Dropdown Compartilhar */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="bg-[#141b25] border-zinc-700 text-zinc-200 hover:text-white hover:border-zinc-500 text-xs gap-1.5 h-8"
                      >
                        <Share2 className="w-3.5 h-3.5 text-cyan-400" />
                        Compartilhar
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="bg-[#0e141d] border-zinc-800 text-zinc-200"
                    >
                      <DropdownMenuItem
                        onClick={handleShareWhatsApp}
                        className="gap-2 text-xs cursor-pointer hover:bg-zinc-800"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-400" />
                        WhatsApp
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleShareNativo}
                        className="gap-2 text-xs cursor-pointer hover:bg-zinc-800"
                      >
                        <Share2 className="w-4 h-4 text-cyan-400" />
                        Compartilhar no dispositivo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={handleCopiarTexto}
                        className="gap-2 text-xs cursor-pointer hover:bg-zinc-800"
                      >
                        <Copy className="w-4 h-4 text-zinc-400" />
                        Copiar resumo
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setIsEmailModalOpen(true)}
                        className="gap-2 text-xs cursor-pointer hover:bg-zinc-800"
                      >
                        <Mail className="w-4 h-4 text-amber-400" />
                        Enviar por e-mail
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Linha com Métricas Náuticas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-zinc-800/80 text-xs">
                <div className="bg-[#090d13]/60 p-2.5 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[11px]">Distância & Rumo</span>
                  <span className="font-bold text-white text-sm">
                    {resultado.distancia_nm} NM{' '}
                    <span className="text-zinc-400 font-normal text-xs">
                      · {resultado.rumo_verdadeiro}° (
                      {getWindDirectionLabel(resultado.rumo_verdadeiro)})
                    </span>
                  </span>
                </div>

                <div className="bg-[#090d13]/60 p-2.5 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[11px]">Duração Estimada</span>
                  <span className="font-bold text-white text-sm">
                    {formatarDuracao(resultado.duracao_horas)}
                  </span>
                </div>

                <div className="bg-[#090d13]/60 p-2.5 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[11px]">ETA (Chegada)</span>
                  <span className="font-bold text-white text-sm">
                    {formatarHoraCurta(resultado.eta)}h{' '}
                    <span className="text-zinc-400 font-normal text-[10px]">
                      ({formatarDataHoraCompleta(resultado.eta)})
                    </span>
                  </span>
                </div>

                <div className="bg-[#090d13]/60 p-2.5 rounded-lg border border-zinc-800/60">
                  <span className="text-zinc-400 block text-[11px]">Combustível</span>
                  <span className="font-bold text-white text-sm">
                    {resultado.combustivel_litros !== null
                      ? `${resultado.combustivel_litros} L`
                      : '--'}
                    {resultado.combustivel_com_reserva !== null && (
                      <span className="text-zinc-400 font-normal text-[10px] block">
                        + reserva (20%): {resultado.combustivel_com_reserva} L
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* Banner de Aviso Especial (Chegada Noturna / Rebaixamento) */}
              {resultado.aviso && (
                <div className="p-3 rounded-lg bg-amber-950/40 border border-amber-700/60 text-amber-200 text-xs flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <span className="font-bold uppercase tracking-wider text-[10px] bg-amber-900/60 px-1.5 py-0.5 rounded mr-1.5">
                      Atenção
                    </span>
                    {resultado.aviso === 'chegada noturna'
                      ? 'Chegada prevista após o pôr do sol no destino — planeje navegação noturna ou antecipe a saída.'
                      : resultado.aviso}
                  </div>
                </div>
              )}

              {/* Informação de Hora Limite para Chegada Diurna */}
              {resultado.hora_limite_saida && (
                <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                  <Sunset className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Hora limite de saída para chegada diurna com luz natural:{' '}
                    <strong className="text-zinc-200">
                      {formatarHoraCurta(resultado.hora_limite_saida)}h
                    </strong>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* BLOCO MELHOR ALTERNATIVA */}
          {resultado.melhor_alternativa ? (
            <Card className="bg-gradient-to-r from-[#0d1722] to-[#08101a] border-cyan-600/60 shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-300">
                      Janela Alternativa Recomendada
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[10px] uppercase font-bold px-1.5 py-0"
                      style={{
                        color: resultado.melhor_alternativa.veredito_cor,
                        borderColor: resultado.melhor_alternativa.veredito_cor,
                      }}
                    >
                      {resultado.melhor_alternativa.veredito}
                    </Badge>
                  </div>
                  <p className="text-xs text-zinc-300">
                    Saída às{' '}
                    <strong className="text-white text-sm">
                      {formatarHoraCurta(resultado.melhor_alternativa.hora_saida)}h
                    </strong>{' '}
                    (ETA {formatarHoraCurta(resultado.melhor_alternativa.eta)}h) · Score mínimo:{' '}
                    <strong className="text-emerald-400">
                      {resultado.melhor_alternativa.score_minimo}/100
                    </strong>
                    {resultado.melhor_alternativa.fator_limitante && (
                      <span className="text-zinc-400">
                        {' '}
                        · Condição: {resultado.melhor_alternativa.fator_limitante}
                      </span>
                    )}
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={handleUsarAlternativa}
                  disabled={calculando}
                  className="bg-cyan-700 hover:bg-cyan-600 text-white text-xs font-bold h-9 px-4 shrink-0 shadow-md"
                >
                  Usar esta saída
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="p-3 rounded-lg bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
              <span>Nenhuma saída melhor nas próximas 24 h</span>
            </div>
          )}

          {/* LINHA DO TEMPO DAS 3 AMOSTRAS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-zinc-200 tracking-tight flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Condições ao Longo do Percurso (3 Amostras)
              </h3>
              <span className="text-[11px] text-zinc-400">Origem ➔ Ponto Médio ➔ Destino</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {resultado.amostras.map((amostra: TravessiaAmostra, idx: number) => {
                const tituloAmostra =
                  amostra.tipo === 'origem'
                    ? '1. Saída (Origem)'
                    : amostra.tipo === 'meio'
                      ? '2. Ponto Médio'
                      : '3. Chegada (Destino)'

                return (
                  <Card
                    key={`amostra-${idx}`}
                    className="bg-[#0d121a] border-zinc-800 hover:border-zinc-700 transition-colors shadow-md"
                  >
                    <CardHeader className="py-2.5 px-3.5 bg-[#101622] border-b border-zinc-800/80 flex flex-row items-center justify-between">
                      <div>
                        <span className="text-[11px] uppercase font-bold text-zinc-400 block tracking-wider">
                          {tituloAmostra}
                        </span>
                        <CardTitle className="text-xs font-bold text-white truncate max-w-[150px]">
                          {amostra.ponto_nome ||
                            (amostra.tipo === 'meio' ? 'Meio do Percurso' : '')}
                        </CardTitle>
                      </div>

                      {/* Score Circular */}
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shadow-inner shrink-0"
                        style={{
                          backgroundColor:
                            amostra.score >= 70
                              ? 'rgba(34, 197, 94, 0.2)'
                              : amostra.score >= 50
                                ? 'rgba(234, 179, 8, 0.2)'
                                : 'rgba(239, 68, 68, 0.2)',
                          borderColor:
                            amostra.score >= 70
                              ? '#22c55e'
                              : amostra.score >= 50
                                ? '#eab308'
                                : '#ef4444',
                          color:
                            amostra.score >= 70
                              ? '#4ade80'
                              : amostra.score >= 50
                                ? '#fde047'
                                : '#f87171',
                        }}
                      >
                        {amostra.score}
                      </div>
                    </CardHeader>

                    <CardContent className="p-3.5 space-y-3 text-xs">
                      {/* Horário */}
                      <div className="flex items-center justify-between text-zinc-300 pb-2 border-b border-zinc-800/60">
                        <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3 text-zinc-500" /> Horário
                        </span>
                        <span className="font-semibold text-white">
                          {formatarHoraCurta(amostra.horario)}h{' '}
                          <span className="text-zinc-500 font-normal text-[10px]">
                            ({formatarDataHoraCompleta(amostra.horario)})
                          </span>
                        </span>
                      </div>

                      {/* Vento e Direção Relativa */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-zinc-300">
                          <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
                            <Wind className="w-3 h-3 text-cyan-400" /> Vento
                          </span>
                          <span className="font-bold text-white">
                            {amostra.vento_nos} kt{' '}
                            <span className="text-zinc-400 font-normal text-[11px]">
                              ({getWindDirectionLabel(amostra.direcao_vento)})
                            </span>
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-zinc-500">Direção Relativa</span>
                          {renderIconeDirecaoRelativa(amostra.direcao_relativa)}
                        </div>

                        {amostra.rajada_nos > amostra.vento_nos + 4 && (
                          <div className="flex justify-end pt-0.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-amber-950/40 text-amber-300 border-amber-800/50 py-0"
                            >
                              Rajada {amostra.rajada_nos} kt
                            </Badge>
                          </div>
                        )}
                      </div>

                      {/* Ondulação e Período */}
                      <div className="flex items-center justify-between text-zinc-300 pt-1 border-t border-zinc-800/60">
                        <span className="text-zinc-400 flex items-center gap-1 text-[11px]">
                          <Waves className="w-3 h-3 text-blue-400" /> Onda
                        </span>
                        <span className="font-semibold text-white">
                          {amostra.altura_onda_m.toFixed(1)} m{' '}
                          <span className="text-zinc-500 text-[10px] font-normal">
                            · {amostra.periodo_onda_s}s
                          </span>
                        </span>
                      </div>

                      {/* Chuva */}
                      {amostra.chuva_mmh > 0 && (
                        <div className="flex items-center justify-between text-zinc-400 text-[11px]">
                          <span>Chuva</span>
                          <span className="text-blue-300">{amostra.chuva_mmh} mm/h</span>
                        </div>
                      )}

                      {/* Badge de Rebaixamento se houver */}
                      {amostra.rebaixada && amostra.motivo_rebaixamento && (
                        <div className="pt-1.5">
                          <div className="p-1.5 rounded bg-red-950/30 border border-red-800/40 text-red-300 text-[10px] leading-tight flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>{amostra.motivo_rebaixamento}</span>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL ENVIAR POR E-MAIL */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-md bg-[#0d131b] border-zinc-800 text-zinc-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              Enviar Plano de Travessia
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Encaminhe o resumo com rota, ETA e condições para a tripulação ou marina.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleEnviarEmail} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="dest-email" className="text-xs font-medium text-zinc-300">
                E-mail de Destino
              </Label>
              <Input
                id="dest-email"
                type="email"
                required
                placeholder="tripulacao@marina.com.br"
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
