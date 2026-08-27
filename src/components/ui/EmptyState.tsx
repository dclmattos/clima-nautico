import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

export interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'w-full py-8 px-5 rounded-xl bg-[#11161d] border border-dashed border-zinc-800 text-center flex flex-col items-center justify-center space-y-3',
        className,
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
          {icon}
        </div>
      )}
      <div className="space-y-1 max-w-md">
        <h3 className="text-sm sm:text-base font-bold text-zinc-200">{title}</h3>
        {description && (
          <p className="text-xs sm:text-sm text-zinc-400 font-normal leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button
          onClick={onAction}
          variant="outline"
          size="sm"
          className="bg-zinc-800 border-zinc-700 text-zinc-100 hover:bg-zinc-700 text-xs mt-1"
        >
          {actionLabel}
        </Button>
      )}
    </div>
  )
}
export default EmptyState
