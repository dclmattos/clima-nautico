import React from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '@/contexts/PerfilContext'
import { Button } from '@/components/ui/button'
import { Ship, Sailboat, Zap, Settings, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  ultimaAtualizacao?: Date | string | null
  onRefresh?: () => void
  isRefreshing?: boolean
}

interface PerfilOption {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const PERFIS_OPTIONS: PerfilOption[] = [
  { id: 'lancha', label: 'Lancha', icon: Ship },
  { id: 'veleiro', label: 'Veleiro', icon: Sailboat },
  { id: 'jet', label: 'Jet', icon: Zap },
]

export const TopBar: React.FC<TopBarProps> = ({
  ultimaAtualizacao,
  onRefresh,
  isRefreshing = false,
}) => {
  const navigate = useNavigate()
  const { perfil, setPerfil } = usePerfil()

  const formatHoraAtualizacao = (data?: Date | string | null) => {
    if (!data) {
      const now = new Date()
      return now.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    }
    try {
      const d = typeof data === 'string' ? new Date(data) : data
      if (isNaN(d.getTime())) {
        return new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      }
      return d.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    } catch {
      return '--:--'
    }
  }

  const horaFormatada = formatHoraAtualizacao(ultimaAtualizacao)
  const perfilAtivoId = (perfil?.nome || 'lancha').toLowerCase()

  return (
    <header
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      className="fixed top-0 left-0 right-0 z-50 w-full bg-[#0a0e14]/95 backdrop-blur-md border-b border-white/[0.06] shadow-sm transition-all"
    >
      <div className="max-w-4xl mx-auto px-3 sm:px-4 h-12 flex items-center justify-between gap-2">
        {/* À esquerda: Logo / Título */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 focus:outline-none group text-left shrink-0"
          title="Ir para o início"
        >
          <span className="font-sans font-semibold text-sm sm:text-base text-cyan-400 group-hover:text-cyan-300 transition-colors tracking-tight">
            Clima Náutico
          </span>
        </button>

        {/* À direita: Seletor Segmentado de Perfil + Ícone Engrenagem + Atualizado/Refresh */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Seletor Segmentado dos 3 Perfis */}
          <div
            role="radiogroup"
            aria-label="Perfil de navegação"
            className="flex items-center bg-[#101620] p-0.5 rounded-lg border border-zinc-800 shadow-inner"
          >
            {PERFIS_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isSelected = perfilAtivoId === opt.id

              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setPerfil(opt.id)}
                  title={`Perfil ${opt.label}`}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all duration-150 select-none',
                    isSelected
                      ? 'bg-[#0891b2] text-white font-semibold shadow-sm'
                      : 'bg-transparent text-gray-400',
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className={isSelected ? 'inline' : 'hidden sm:inline'}>{opt.label}</span>
                </button>
              )
            })}
          </div>

          {/* Botão Ícone de Configurações */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/config')}
            className="h-7 w-7 text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg transition-colors shrink-0"
            title="Configurações e Limites"
          >
            <Settings className="w-3.5 h-3.5" />
          </Button>

          {/* Texto de Atualização (escondido em telas muito pequenas para não quebrar layout) */}
          <span className="text-[11px] text-zinc-400 whitespace-nowrap hidden md:inline">
            Atualizado <span className="font-mono text-zinc-300">{horaFormatada}</span>
          </span>

          {/* Botão de Atualizar */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 w-7 text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg transition-colors shrink-0"
              title="Atualizar dados agora"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`}
              />
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopBar
