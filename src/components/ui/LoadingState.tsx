import React from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

export interface LoadingStateProps {
  variant?: 'cards' | 'list' | 'detail' | 'briefing'
  count?: number
  className?: string
  text?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'cards',
  count = 2,
  className,
  text,
}) => {
  return (
    <div className={cn('w-full space-y-4 animate-pulse', className)}>
      {text && (
        <div className="flex items-center gap-2 text-xs text-zinc-400 font-medium mb-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
          <span>{text}</span>
        </div>
      )}

      {variant === 'briefing' && (
        <div className="p-4 rounded-xl bg-[#11161d] border border-cyan-900/40 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-36 bg-zinc-800" />
            <Skeleton className="h-4 w-20 bg-zinc-800" />
          </div>
          <Skeleton className="h-3.5 w-full bg-zinc-800/80" />
          <Skeleton className="h-3.5 w-5/6 bg-zinc-800/80" />
          <Skeleton className="h-3.5 w-4/6 bg-zinc-800/80" />
        </div>
      )}

      {variant === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="p-5 rounded-xl bg-[#11161d] border border-zinc-800 space-y-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32 bg-zinc-800" />
                <Skeleton className="h-6 w-16 rounded-full bg-zinc-800" />
              </div>
              <div className="grid grid-cols-3 gap-2 py-2">
                <Skeleton className="h-12 bg-zinc-800/60 rounded-lg" />
                <Skeleton className="h-12 bg-zinc-800/60 rounded-lg" />
                <Skeleton className="h-12 bg-zinc-800/60 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-full bg-zinc-800/40 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {variant === 'list' && (
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-[#11161d] border border-zinc-800 flex items-center justify-between gap-3"
            >
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-40 bg-zinc-800" />
                <Skeleton className="h-3 w-28 bg-zinc-800/60" />
              </div>
              <Skeleton className="h-8 w-16 rounded-lg bg-zinc-800" />
            </div>
          ))}
        </div>
      )}

      {variant === 'detail' && (
        <div className="space-y-6">
          <div className="h-28 bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-3">
            <Skeleton className="h-4 w-24 bg-zinc-800" />
            <Skeleton className="h-7 w-1/3 bg-zinc-800" />
          </div>
          <div className="h-[320px] bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-4">
            <Skeleton className="h-5 w-1/4 bg-zinc-800" />
            <Skeleton className="h-56 w-full bg-zinc-800/40 rounded-lg" />
          </div>
          <div className="h-[220px] bg-[#11161d] border border-zinc-800 rounded-xl p-5 space-y-4">
            <Skeleton className="h-5 w-1/4 bg-zinc-800" />
            <Skeleton className="h-36 w-full bg-zinc-800/40 rounded-lg" />
          </div>
        </div>
      )}
    </div>
  )
}
export default LoadingState
