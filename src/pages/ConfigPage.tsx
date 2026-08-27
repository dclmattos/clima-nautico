import React, { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '@/contexts/PerfilContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LoadingState } from '@/components/ui/LoadingState'
import { useToast } from '@/hooks/use-toast'
import {
  PREFS_STORAGE_KEY,
  MAX_PONTOS_PERSONALIZADOS,
  getStoredPreferences,
  setStoredPreferences,
  getPontosPersonalizados,
  addPontoPersonalizado,
  updatePontoPersonalizado,
  deletePontoPersonalizado,
} from '@/lib/preferencesStorage'
import { PreferenciasStorage, PontoPersonalizado, TipoPontoPersonalizado } from '@/types/nautico'
import {
  parseCoordinatesInput,
  formatCoordinatesDMM,
  fetchPrevisaoPorPonto,
} from '@/services/previsaoService'
import { SeletorMapaLeaflet } from '@/components/SeletorMapaLeaflet'
import {
  Settings,
  ArrowLeft,
  Smartphone,
  Sliders,
  Wind,
  Waves,
  CloudRain,
  Clock,
  Gauge,
  Info,
  Ship,
  Sailboat,
  Zap,
  Download,
  Upload,
  MapPin,
  Plus,
  Pencil,
  Trash2,
  Navigation,
  Loader2,
  AlertCircle,
  Compass,
  Copy,
  Check,
} from 'lucide-react'

export const ConfigPage: React.FC = () => {
  const navigate = useNavigate()
  const { perfil, perfis, setPerfil, deviceId, loading, reload } = usePerfil()
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Meus Pontos Personalizados
  const [pontosCustom, setPontosCustom] = useState<PontoPersonalizado[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPonto, setEditingPonto] = useState<PontoPersonalizado | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Form states
  const [formNome, setFormNome] = useState('')
  const [formCoordsStr, setFormCoordsStr] = useState('')
  const [formTipo, setFormTipo] = useState<TipoPontoPersonalizado>('abrigado')
  const [formLat, setFormLat] = useState<number | null>(null)
  const [formLon, setFormLon] = useState<number | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [savingPonto, setSavingPonto] = useState(false)
  const [formErro, setFormErro] = useState<string | null>(null)
  const [isTerraError, setIsTerraError] = useState(false)
  const [copiedFormat, setCopiedFormat] = useState<'decimal' | 'dmm' | null>(null)

  const reloadPontos = () => {
    setPontosCustom(getPontosPersonalizados())
  }

  useEffect(() => {
    reloadPontos()
  }, [])

  const handleOpenAddModal = () => {
    if (pontosCustom.length >= MAX_PONTOS_PERSONALIZADOS) {
      toast({
        title: 'Limite atingido',
        description: `Máximo de ${MAX_PONTOS_PERSONALIZADOS} pontos atingido.`,
        variant: 'destructive',
      })
      return
    }
    setEditingPonto(null)
    setFormNome('')
    setFormCoordsStr('')
    setFormLat(null)
    setFormLon(null)
    setFormTipo('abrigado')
    setFormErro(null)
    setIsTerraError(false)
    setModalOpen(true)
  }

  const handleOpenEditModal = (p: PontoPersonalizado) => {
    setEditingPonto(p)
    setFormNome(p.nome)
    setFormCoordsStr(`${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}`)
    setFormLat(p.lat)
    setFormLon(p.lon)
    setFormTipo(p.tipo)
    setFormErro(null)
    setIsTerraError(false)
    setModalOpen(true)
  }

  const handleMapPositionChange = (lat: number, lon: number) => {
    setFormLat(lat)
    setFormLon(lon)
    setFormCoordsStr(`${lat.toFixed(4)}, ${lon.toFixed(4)}`)
    setIsTerraError(false)
    if (formErro) setFormErro(null)
  }

  const handleManualCoordsChange = (val: string) => {
    setFormCoordsStr(val)
    setIsTerraError(false)
    if (formErro) setFormErro(null)

    if (!val.trim()) {
      return
    }

    const parsed = parseCoordinatesInput(val)
    if (parsed) {
      setFormLat(parsed.lat)
      setFormLon(parsed.lon)
    }
  }

  const handleCopyCoords = async (text: string, format: 'decimal' | 'dmm') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedFormat(format)
      setTimeout(() => setCopiedFormat(null), 2000)
      toast({
        title: 'Copiado!',
        description: `Coordenadas (${format.toUpperCase()}) copiadas com sucesso.`,
      })
    } catch {
      toast({
        title: 'Erro ao copiar',
        description: 'Não foi possível acessar a área de transferência.',
        variant: 'destructive',
      })
    }
  }

  const handleUsarLocalizacaoAtual = () => {
    if (!navigator.geolocation) {
      toast({
        title: 'Não suportado',
        description: 'Seu navegador não suporta geolocalização.',
        variant: 'destructive',
      })
      return
    }

    setGeoLoading(true)
    setFormErro(null)
    setIsTerraError(false)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        setFormLat(lat)
        setFormLon(lon)
        setFormCoordsStr(`${lat.toFixed(4)}, ${lon.toFixed(4)}`)
        setGeoLoading(false)
        toast({
          title: 'Localização obtida!',
          description: `${lat.toFixed(4)}, ${lon.toFixed(4)}`,
        })
      },
      (err) => {
        setGeoLoading(false)
        console.warn('Erro ao obter geolocalização:', err)
        toast({
          title: 'Localização indisponível',
          description:
            'Não foi possível obter sua posição. Digite as coordenadas manualmente ou use o mapa.',
          variant: 'destructive',
        })
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  const handleSalvarPonto = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormErro(null)
    setIsTerraError(false)

    const nomeTrimmed = formNome.trim()
    if (!nomeTrimmed) {
      setFormErro('O nome do ponto é obrigatório.')
      return
    }

    // Parse de coordenadas se digitado ou sincronizado
    let lat = formLat
    let lon = formLon

    if (formCoordsStr.trim()) {
      const parsed = parseCoordinatesInput(formCoordsStr)
      if (parsed) {
        lat = parsed.lat
        lon = parsed.lon
      } else if (lat === null || lon === null) {
        setFormErro('Coordenadas não reconhecidas')
        return
      }
    }

    if (lat === null || lon === null) {
      setFormErro('Por favor, toque no mapa ou informe as coordenadas do ponto.')
      return
    }

    setSavingPonto(true)

    // Validação na API do backend: testar se a posição está no mar ou em terra
    try {
      await fetchPrevisaoPorPonto('', {
        lat,
        lon,
        tipo: formTipo,
        nome: nomeTrimmed,
      })
    } catch (apiErr: any) {
      setSavingPonto(false)
      const msg = (apiErr?.message || '').toLowerCase()
      if (msg.includes('terra') || msg.includes('ajuste para o mar')) {
        setIsTerraError(true)
        toast({
          title: 'Coordenada em terra',
          description: 'Esta posição parece estar em terra — ajuste para o mar',
          variant: 'destructive',
          duration: 4500,
        })
        setFormErro('Esta posição parece estar em terra — ajuste para o mar')
        return
      }
      console.warn('Aviso na validação de API:', apiErr)
    }

    if (editingPonto) {
      const res = updatePontoPersonalizado(editingPonto.id, {
        nome: nomeTrimmed,
        lat,
        lon,
        tipo: formTipo,
      })
      if (!res.success) {
        setSavingPonto(false)
        setFormErro(res.error || 'Erro ao atualizar ponto.')
        return
      }
      toast({
        title: 'Ponto atualizado!',
        description: `O ponto "${nomeTrimmed}" foi alterado com sucesso.`,
      })
    } else {
      const res = addPontoPersonalizado({
        nome: nomeTrimmed,
        lat,
        lon,
        tipo: formTipo,
      })
      if (!res.success) {
        setSavingPonto(false)
        setFormErro(res.error || 'Erro ao salvar ponto.')
        return
      }
      toast({
        title: 'Ponto adicionado!',
        description: `O ponto "${nomeTrimmed}" foi salvo em Meus pontos.`,
      })
    }

    setSavingPonto(false)
    setModalOpen(false)
    reloadPontos()
  }

  const handleDeletePonto = (id: string) => {
    const success = deletePontoPersonalizado(id)
    if (success) {
      toast({
        title: 'Ponto excluído',
        description: 'Ponto personalizado removido com sucesso.',
      })
      reloadPontos()
    }
    setConfirmDeleteId(null)
  }

  const handleExportarPreferencias = () => {
    try {
      const prefs = getStoredPreferences()
      const dataStr = JSON.stringify(prefs || {}, null, 2)
      const blob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'clima-nautico-prefs.json'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast({
        title: 'Preferências exportadas!',
        description: 'Arquivo clima-nautico-prefs.json baixado com sucesso.',
        duration: 3000,
      })
    } catch (err: any) {
      console.error('Erro ao exportar preferências:', err)
      toast({
        title: 'Erro ao exportar',
        description: 'Não foi possível gerar o arquivo de preferências.',
        variant: 'destructive',
        duration: 3000,
      })
    }
  }

  const handleImportarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)

        if (!parsed || typeof parsed !== 'object') {
          throw new Error('Formato de arquivo inválido')
        }

        if (typeof parsed.perfil_id !== 'string') {
          throw new Error('Campo "perfil_id" ausente ou inválido')
        }

        const validPrefs: PreferenciasStorage = {
          perfil_id: parsed.perfil_id,
          ponto_favorito_slug:
            typeof parsed.ponto_favorito_slug === 'string' ? parsed.ponto_favorito_slug : 'angra',
          horario_briefing:
            typeof parsed.horario_briefing === 'string' ? parsed.horario_briefing : '07:00',
          ultimo_briefing:
            parsed.ultimo_briefing && typeof parsed.ultimo_briefing === 'object'
              ? {
                  texto: String(parsed.ultimo_briefing.texto || ''),
                  timestamp: String(parsed.ultimo_briefing.timestamp || new Date().toISOString()),
                }
              : null,
          pontos_personalizados: Array.isArray(parsed.pontos_personalizados)
            ? parsed.pontos_personalizados
            : [],
        }

        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(validPrefs))
        setStoredPreferences(validPrefs)
        reloadPontos()

        if (reload) {
          await reload()
        }

        toast({
          title: 'Preferências importadas!',
          description: 'Suas preferências e pontos foram restaurados com sucesso.',
          duration: 3000,
        })
      } catch (err: any) {
        console.error('Erro ao importar JSON:', err)
        toast({
          title: 'Falha ao importar',
          description:
            err?.message || 'Arquivo JSON inválido. Verifique o conteúdo do arquivo selecionado.',
          variant: 'destructive',
          duration: 4000,
        })
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }

    reader.onerror = () => {
      toast({
        title: 'Erro na leitura do arquivo',
        description: 'Não foi possível ler o arquivo selecionado.',
        variant: 'destructive',
        duration: 3000,
      })
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }

    reader.readAsText(file)
  }

  const getPerfilIcon = (nome: string) => {
    const n = nome.toLowerCase()
    if (n.includes('veleiro') || n.includes('vela')) return <Sailboat className="w-4 h-4" />
    if (n.includes('jet')) return <Zap className="w-4 h-4" />
    return <Ship className="w-4 h-4" />
  }

  const getTipoBadgeClass = (tipo: string) => {
    if (tipo === 'abrigado') return 'bg-blue-950/70 text-blue-300 border-blue-800/60'
    if (tipo === 'semi' || tipo === 'semi-abrigado')
      return 'bg-indigo-950/70 text-indigo-300 border-indigo-800/60'
    return 'bg-slate-800 text-slate-300 border-slate-700'
  }

  const formatTipoLabel = (tipo: string) => {
    if (tipo === 'abrigado') return 'Abrigado'
    if (tipo === 'semi' || tipo === 'semi-abrigado') return 'Semi-abrigado'
    return 'Mar aberto'
  }

  return (
    <div
      style={{ paddingBottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
      className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100"
    >
      <div className="w-full max-w-3xl mx-auto px-4 py-4 sm:py-6 flex-1 flex flex-col">
        {/* Header da Página */}
        <header className="mb-6 flex items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="text-zinc-400 hover:text-white p-2 h-auto"
              title="Voltar ao início"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-700/60 flex items-center justify-center text-cyan-300">
                  <Settings className="w-4 h-4" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Configurações
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-zinc-400 mt-1">
                Preferências da embarcação, ancoradouros e limites de navegabilidade
              </p>
            </div>
          </div>
        </header>

        <main className="space-y-6 flex-1">
          {loading && <LoadingState variant="cards" count={2} />}

          {!loading && (
            <>
              {/* Card de Seleção de Perfil */}
              <Card className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100">
                <CardHeader className="pb-3 border-b border-zinc-800/80">
                  <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                    <Ship className="w-4 h-4 text-cyan-400" />
                    Perfil Ativo de Navegação
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-4">
                  <p className="text-xs sm:text-sm text-zinc-400">
                    Selecione o tipo de embarcação para calcular o score e as janelas ideais:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {perfis.map((p) => {
                      const isSelected =
                        perfil?.id === p.id || perfil?.nome?.toLowerCase() === p.nome?.toLowerCase()
                      const label = p.nome.charAt(0).toUpperCase() + p.nome.slice(1)

                      return (
                        <div
                          key={p.id}
                          onClick={() => setPerfil(p.id)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between gap-2 ${
                            isSelected
                              ? 'bg-cyan-950/60 border-cyan-600 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                              : 'bg-[#161c24] border-zinc-800 hover:border-zinc-700 hover:bg-[#1c242e]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className={`p-2 rounded-lg ${
                                  isSelected
                                    ? 'bg-cyan-900/60 text-cyan-300'
                                    : 'bg-zinc-800 text-zinc-400'
                                }`}
                              >
                                {getPerfilIcon(p.nome)}
                              </div>
                              <span className="font-bold text-sm text-white">{label}</span>
                            </div>
                            {isSelected && (
                              <Badge className="bg-cyan-600 hover:bg-cyan-600 text-white text-[10px] uppercase">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-400 space-y-0.5">
                            <p>Vento máx: {p.vento_max_kt} kt</p>
                            <p>Onda máx: {p.onda_max_m} m</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* SEÇÃO: MEUS PONTOS PERSONALIZADOS */}
              <Card className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100">
                <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    <div>
                      <CardTitle className="text-base font-bold text-white">
                        Meus Pontos Personalizados
                      </CardTitle>
                      <p className="text-xs text-zinc-400 mt-0.5">
                        Cadastre até {MAX_PONTOS_PERSONALIZADOS} locais, ilhas ou ancoradouros
                        favoritos ({pontosCustom.length}/{MAX_PONTOS_PERSONALIZADOS})
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={handleOpenAddModal}
                    disabled={pontosCustom.length >= MAX_PONTOS_PERSONALIZADOS}
                    className="bg-cyan-900 hover:bg-cyan-800 text-cyan-100 border border-cyan-600/50 text-xs gap-1.5 font-medium shrink-0 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {pontosCustom.length >= MAX_PONTOS_PERSONALIZADOS
                      ? 'Máximo de 10 pontos atingido'
                      : 'Adicionar ponto'}
                  </Button>
                </CardHeader>
                <CardContent className="p-4 sm:p-5 space-y-3">
                  {pontosCustom.length === 0 ? (
                    <div className="p-6 text-center rounded-xl bg-[#161c24] border border-dashed border-zinc-800 space-y-2">
                      <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400 mx-auto">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-semibold text-zinc-200">
                        Nenhum ponto personalizado cadastrado
                      </p>
                      <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                        Adicione praias, poitas ou enseadas na Baía de Ilha Grande para acompanhar a
                        previsão, ondas e janelas ideais dedicadas.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {pontosCustom.map((p) => (
                        <div
                          key={p.id}
                          className="p-3 rounded-xl bg-[#161c24] border border-zinc-800 flex items-center justify-between gap-3 hover:border-zinc-700 transition-colors"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white truncate flex items-center gap-1.5">
                                <span className="text-amber-400">⭐</span>
                                {p.nome}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-2 py-0 border ${getTipoBadgeClass(
                                  p.tipo,
                                )}`}
                              >
                                {formatTipoLabel(p.tipo)}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-400 font-mono flex items-center gap-1">
                              <Compass className="w-3 h-3 text-zinc-500 shrink-0" />
                              <span>{formatCoordinatesDMM(p.lat, p.lon)}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEditModal(p)}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/40"
                              title="Editar ponto"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDeleteId(p.id)}
                              className="h-8 w-8 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-950/40"
                              title="Excluir ponto"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* Limites do Perfil Atual (Somente Leitura) */}
          <Card className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100">
            <CardHeader className="pb-3 border-b border-zinc-800/80 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                Limites do Perfil ({perfil?.nome?.toUpperCase() || 'LANCHA'})
              </CardTitle>
              <Badge variant="outline" className="text-[10px] text-zinc-400 border-zinc-700">
                Somente Leitura
              </Badge>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-5">
              <div className="p-3 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-cyan-300 text-xs flex items-start gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Estes limites determinam a penalização de score e janelas ideais para pontos fixos
                  e personalizados.
                </span>
              </div>

              {/* Vento Máximo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Wind className="w-4 h-4 text-sky-400" />
                    Vento Máximo Permitido
                  </span>
                  <span className="font-mono font-bold text-white bg-zinc-800/80 px-2.5 py-0.5 rounded">
                    {perfil?.vento_max_kt ?? 15} kt
                  </span>
                </div>
                <Slider
                  disabled
                  value={[perfil?.vento_max_kt ?? 15]}
                  max={40}
                  step={1}
                  className="opacity-70 cursor-not-allowed"
                />
              </div>

              {/* Rajada Máxima */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Gauge className="w-4 h-4 text-amber-400" />
                    Rajada Máxima
                  </span>
                  <span className="font-mono font-bold text-white bg-zinc-800/80 px-2.5 py-0.5 rounded">
                    {perfil?.rajada_max_kt ?? 22} kt
                  </span>
                </div>
                <Slider
                  disabled
                  value={[perfil?.rajada_max_kt ?? 22]}
                  max={50}
                  step={1}
                  className="opacity-70 cursor-not-allowed"
                />
              </div>

              {/* Onda Máxima */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Waves className="w-4 h-4 text-cyan-400" />
                    Altura Máxima de Onda
                  </span>
                  <span className="font-mono font-bold text-white bg-zinc-800/80 px-2.5 py-0.5 rounded">
                    {perfil?.onda_max_m ?? 1.0} m
                  </span>
                </div>
                <Slider
                  disabled
                  value={[perfil?.onda_max_m ?? 1.0]}
                  max={3.5}
                  step={0.1}
                  className="opacity-70 cursor-not-allowed"
                />
              </div>

              {/* Período Mínimo */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <Clock className="w-4 h-4 text-teal-400" />
                    Período Mínimo de Onda
                  </span>
                  <span className="font-mono font-bold text-white bg-zinc-800/80 px-2.5 py-0.5 rounded">
                    {perfil?.periodo_min_s ? `${perfil.periodo_min_s} s` : 'Sem restrição'}
                  </span>
                </div>
                <Slider
                  disabled
                  value={[perfil?.periodo_min_s ?? 0]}
                  max={15}
                  step={1}
                  className="opacity-70 cursor-not-allowed"
                />
              </div>

              {/* Chuva Máxima */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="flex items-center gap-1.5 text-zinc-300 font-medium">
                    <CloudRain className="w-4 h-4 text-indigo-400" />
                    Chuva Máxima
                  </span>
                  <span className="font-mono font-bold text-white bg-zinc-800/80 px-2.5 py-0.5 rounded">
                    {perfil?.chuva_max_mm_h ?? 4} mm/h
                  </span>
                </div>
                <Slider
                  disabled
                  value={[perfil?.chuva_max_mm_h ?? 4]}
                  max={20}
                  step={0.5}
                  className="opacity-70 cursor-not-allowed"
                />
              </div>
            </CardContent>
          </Card>

          {/* Exportar e Importar Preferências */}
          <Card className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400" />
                Backup de Preferências & Meus Pontos
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Exporte suas configurações locais e seus pontos personalizados para um arquivo JSON
                ou importe dados salvos de outro navegador/dispositivo:
              </p>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <Button
                  onClick={handleExportarPreferencias}
                  variant="outline"
                  size="sm"
                  className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-200 hover:text-cyan-200 text-xs gap-2 flex-1 sm:flex-initial"
                >
                  <Download className="w-4 h-4 text-cyan-400" />
                  Exportar preferências
                </Button>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".json,application/json"
                  className="hidden"
                />

                <Button
                  onClick={handleImportarClick}
                  variant="outline"
                  size="sm"
                  className="bg-[#161c24] border-zinc-700 hover:border-cyan-600 hover:bg-cyan-950/40 text-zinc-200 hover:text-cyan-200 text-xs gap-2 flex-1 sm:flex-initial"
                >
                  <Upload className="w-4 h-4 text-cyan-400" />
                  Importar preferências
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Identificação do Dispositivo */}
          <Card className="bg-[#11161d] border-zinc-800 shadow-md text-zinc-100">
            <CardHeader className="pb-3 border-b border-zinc-800/80">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-zinc-400" />
                Identificador do Dispositivo
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 space-y-2">
              <p className="text-xs text-zinc-400">
                UUID único do seu dispositivo armazenado localmente:
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={deviceId || 'Carregando...'}
                  className="bg-[#0a0e14] border-zinc-800 font-mono text-xs text-zinc-300 select-all"
                />
              </div>
            </CardContent>
          </Card>
        </main>
      </div>

      {/* MODAL ADICIONAR / EDITAR PONTO */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0d131b] border-cyan-900/60 text-zinc-100 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-cyan-400" />
              {editingPonto ? 'Editar ponto personalizado' : 'Adicionar ponto personalizado'}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Posicione no mapa ou cole coordenadas de qualquer formato para monitorar vento e
              ondas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSalvarPonto} className="space-y-4 pt-1">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label htmlFor="ponto-nome" className="text-xs font-medium text-zinc-300">
                Nome do ponto <span className="text-red-400">*</span>
              </Label>
              <Input
                id="ponto-nome"
                placeholder="Ex: Praia do Dentista, Enseada de Sítio Forte..."
                value={formNome}
                onChange={(e) => {
                  setFormNome(e.target.value)
                  if (formErro) setFormErro(null)
                }}
                disabled={savingPonto}
                className="bg-[#070b10] border-zinc-700/80 focus-visible:border-cyan-500 text-zinc-100 placeholder:text-zinc-500 text-xs h-9"
                autoFocus
              />
            </div>

            {/* SELETOR NO MAPA (LEAFLET + OSM + OPENSEAMAP) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-cyan-400" />
                  Posição no Mapa (Baía de Ilha Grande)
                </Label>
                <span className="text-[11px] text-zinc-400">
                  Toque para marcar · Arraste para ajustar
                </span>
              </div>

              <SeletorMapaLeaflet
                lat={formLat}
                lon={formLon}
                onChange={handleMapPositionChange}
                pontosExistentes={pontosCustom}
                pontoEditandoId={editingPonto?.id}
                isTerraError={isTerraError}
                onMinhaLocalizacao={handleUsarLocalizacaoAtual}
                geoLoading={geoLoading}
              />
            </div>

            {/* COORDENADAS EM TEMPO REAL (DOIS FORMATOS COM BOTÃO COPIAR) */}
            {formLat !== null && formLon !== null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#090e15] border border-zinc-800">
                {/* Formato Decimal */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#111722] border border-zinc-800/80">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      Decimal
                    </span>
                    <span className="font-mono text-xs text-cyan-300 truncate block">
                      {formLat.toFixed(4)}, {formLon.toFixed(4)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      handleCopyCoords(`${formLat.toFixed(4)}, ${formLon.toFixed(4)}`, 'decimal')
                    }
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/50 shrink-0"
                    title="Copiar formato decimal"
                  >
                    {copiedFormat === 'decimal' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>

                {/* Formato Graus/Minutos (DMM) */}
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#111722] border border-zinc-800/80">
                  <div className="min-w-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-wider">
                      Graus/Minutos (DMM)
                    </span>
                    <span className="font-mono text-xs text-indigo-300 truncate block">
                      {formatCoordinatesDMM(formLat, formLon)}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyCoords(formatCoordinatesDMM(formLat, formLon), 'dmm')}
                    className="h-7 w-7 p-0 text-zinc-400 hover:text-indigo-300 hover:bg-indigo-950/50 shrink-0"
                    title="Copiar formato graus e minutos"
                  >
                    {copiedFormat === 'dmm' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Campo de Texto Editável Sincronizado nos Dois Sentidos (Entrada Manual / Colar Links) */}
            <div className="space-y-1.5">
              <Label htmlFor="ponto-coords" className="text-xs font-medium text-zinc-300">
                Entrada manual / Colar coordenadas ou link do Google Maps
              </Label>
              <Input
                id="ponto-coords"
                placeholder="Ex: -23.0083, -44.3183 ou 23°00.50'S 044°19.10'W ou link do Maps"
                value={formCoordsStr}
                onChange={(e) => handleManualCoordsChange(e.target.value)}
                disabled={savingPonto}
                className="bg-[#070b10] border-zinc-700/80 focus-visible:border-cyan-500 text-zinc-100 placeholder:text-zinc-500 text-xs h-9 font-mono"
              />
              <p className="text-[10px] text-zinc-400">
                Aceita Decimal, Graus-Minutos (DMM), Graus-Minutos-Segundos (DMS) e links do Google
                Maps.
              </p>
            </div>

            {/* Tipo de Ancoradouro */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-300">
                Tipo de ancoradouro <span className="text-red-400">*</span>
              </Label>
              <Select
                value={formTipo}
                onValueChange={(val) => setFormTipo(val as TipoPontoPersonalizado)}
                disabled={savingPonto}
              >
                <SelectTrigger className="bg-[#070b10] border-zinc-700/80 text-zinc-100 text-xs h-9">
                  <SelectValue placeholder="Selecione a proteção" />
                </SelectTrigger>
                <SelectContent className="bg-[#0d131b] border-zinc-700 text-zinc-100 text-xs">
                  <SelectItem value="abrigado">Abrigado</SelectItem>
                  <SelectItem value="semi-abrigado">Semi-abrigado</SelectItem>
                  <SelectItem value="mar aberto">Mar aberto</SelectItem>
                </SelectContent>
              </Select>

              {/* Explicação contextual da opção selecionada */}
              <div className="p-2.5 rounded-lg bg-[#070b10] border border-zinc-800 text-[11px] text-zinc-400 leading-relaxed">
                {formTipo === 'abrigado' && (
                  <p className="text-blue-300">
                    <span className="font-semibold text-white">Abrigado:</span> Protegido de vento e
                    ondulação por terra ou ilhas em todas as direções (sem dedução no score).
                  </p>
                )}
                {formTipo === 'semi-abrigado' && (
                  <p className="text-indigo-300">
                    <span className="font-semibold text-white">Semi-abrigado:</span> Parcialmente
                    protegido; pode receber ondulação de uma ou mais direções (-10 pts no score).
                  </p>
                )}
                {formTipo === 'mar aberto' && (
                  <p className="text-amber-300">
                    <span className="font-semibold text-white">Mar aberto:</span> Totalmente exposto
                    a vento e ondulação vindos de alto-mar (-20 pts no score).
                  </p>
                )}
              </div>
            </div>

            {/* Mensagem de Erro do Formulário */}
            {formErro && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{formErro}</span>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
                disabled={savingPonto}
                className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingPonto}
                className="bg-cyan-800 hover:bg-cyan-700 text-white border border-cyan-600/50 text-xs gap-1.5 font-medium shadow-md"
              >
                {savingPonto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Validando posição...
                  </>
                ) : (
                  'Salvar ponto'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => !open && setConfirmDeleteId(null)}>
        <DialogContent className="sm:max-w-md bg-[#0d131b] border-red-900/60 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Trash2 className="w-4 h-4 text-red-400" />
              Excluir ponto personalizado
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              Tem certeza que deseja remover este ponto de navegação? Os dados salvos localmente
              serão excluídos.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmDeleteId(null)}
              className="bg-transparent border-zinc-700 text-zinc-300 hover:bg-zinc-800 text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => confirmDeleteId && handleDeletePonto(confirmDeleteId)}
              className="bg-red-800 hover:bg-red-700 text-white border border-red-600/50 text-xs gap-1.5"
            >
              Sim, excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rodapé Oficial */}
      <footer className="w-full border-t border-zinc-800/80 bg-[#070a0f] py-4 px-4 text-center mt-6">
        <p className="text-xs text-zinc-400 font-normal tracking-wide">
          Dados: Open-Meteo · maré modelada, não substitui a Tábua da DHN
        </p>
      </footer>
    </div>
  )
}

export default ConfigPage
