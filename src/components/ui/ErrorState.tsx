import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { AlertTriangle, RotateCw } from 'lucide-react'

export interface ErrorStateProps {
  message?: string
  title?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
  secondaryAction?: {
    label: string
    onClick: () => void
  }
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Ocorreu um erro ao carregar as informações meteorológicas.',
  title = 'Falha ao carregar dados',
  onRetry,
  retryLabel = 'Tentar de novo',
  className,
  secondaryAction,
}) => {
  return (
    <div
      className={cn(
        'w-full p-6 sm:p-8 rounded-xl bg-[#11161d] border border-red-950/60 flex flex-col items-center justify-center text-center space-y-4 shadow-lg',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-red-950/70 border border-red-800/60 flex items-center justify-center text-red-400">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <div className="space-y-1.5 max-w-md">
        <h3 className="text-base sm:text-lg font-bold text-white">{title}</h3>
        <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">{message}</p>
      </div>

      <div className="flex items-center gap-3 pt-1">
        {secondaryAction && (
          <Button
            variant="outline"
            size="sm"
            onClick={secondaryAction.onClick}
            className="bg-zinc-800 border-zinc-700 text-zinc-200 hover:text-white text-xs"
          >
            {secondaryAction.label}
          </Button>
        )}
        {onRetry && (
          <Button
            size="sm"
            onClick={onRetry}
            className="bg-cyan-900 hover:bg-cyan-800 text-cyan-100 gap-1.5 text-xs shadow"
          >
            <RotateCw className="w-3.5 h-3.5" />
            {retryLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
export default ErrorState
