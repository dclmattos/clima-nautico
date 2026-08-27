import React from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '@/contexts/PerfilContext'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { LoadingState } from '@/components/ui/LoadingState'
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
} from 'lucide-react'

export const ConfigPage: React.FC = () => {
  const navigate = useNavigate()
  const { perfil, perfis, setPerfil, deviceId, loading } = usePerfil()

  const getPerfilIcon = (nome: string) => {
    const n = nome.toLowerCase()
    if (n.includes('veleiro') || n.includes('vela')) return <Sailboat className="w-4 h-4" />
    if (n.includes('jet')) return <Zap className="w-4 h-4" />
    return <Ship className="w-4 h-4" />
  }

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col justify-between selection:bg-cyan-900 selection:text-cyan-100 pb-16 md:pb-6">
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
                Preferências da embarcação e limites de navegabilidade
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
            </>
          )}

          {/* Limites do Perfil Atual (Somente Leitura / Sliders desabilitados) */}
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
                  Estes limites determinam a penalização de score e janelas ideais. Futuramente será
                  possível calibrar valores customizados por perfil.
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
                UUID único utilizado para sincronizar e persistir seu perfil e preferências no
                PocketBase:
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
