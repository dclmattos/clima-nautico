import React from 'react'
import { useNavigate } from 'react-router-dom'
import { usePerfil } from '@/contexts/PerfilContext'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

interface TopBarProps {
  ultimaAtualizacao?: Date | string | null
  onRefresh?: () => void
  isRefreshing?: boolean
}

export const TopBar: React.FC<TopBarProps> = ({
  ultimaAtualizacao,
  onRefresh,
  isRefreshing = false,
}) => {
  const navigate = useNavigate()
  const { perfil } = usePerfil()

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
  const perfilNome = perfil?.nome
    ? perfil.nome.charAt(0).toUpperCase() + perfil.nome.slice(1)
    : 'Lancha'

  return (
    <header
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
      className="fixed top-0 left-0 right-0 z-50 w-full bg-[#0a0e14]/95 backdrop-blur-md border-b border-white/[0.06] shadow-sm transition-all"
    >
      <div className="max-w-4xl mx-auto px-4 h-12 flex items-center justify-between">
        {/* À esquerda: Logo / Título */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 focus:outline-none group text-left"
          title="Ir para o início"
        >
          <span className="font-sans font-semibold text-sm sm:text-base text-cyan-400 group-hover:text-cyan-300 transition-colors tracking-tight">
            Clima Náutico
          </span>
        </button>

        {/* À direita: Perfil + Atualizado HH:MM + Botão Refresh */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Chip do Perfil Ativo */}
          <Badge
            variant="outline"
            onClick={() => navigate('/config')}
            className="cursor-pointer bg-[#141b24] hover:bg-cyan-950/60 border-zinc-700/70 hover:border-cyan-600 text-zinc-300 hover:text-cyan-200 text-[11px] font-medium px-2 py-0.5 transition-all shadow-sm flex items-center gap-1"
            title="Alterar perfil de navegação"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
            <span>{perfilNome}</span>
          </Badge>

          {/* Texto de Atualização */}
          <span className="text-[11px] text-zinc-400 whitespace-nowrap">
            Atualizado <span className="font-mono text-zinc-300">{horaFormatada}</span>
          </span>

          {/* Botão de Atualizar */}
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 w-7 text-zinc-400 hover:text-cyan-300 hover:bg-cyan-950/40 rounded-lg transition-colors"
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
