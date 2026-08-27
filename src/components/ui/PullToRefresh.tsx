import React, { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: React.ReactNode
  disabled?: boolean
  className?: string
  pullDistance?: number
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  onRefresh,
  children,
  disabled = false,
  className,
  pullDistance = 65,
}) => {
  const [pullY, setPullY] = useState<number>(0)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef<number>(0)
  const isPullingRef = useRef<boolean>(false)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    const scrollElem = document.documentElement || document.body
    if (scrollElem.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY
      isPullingRef.current = true
    } else {
      isPullingRef.current = false
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPullingRef.current || disabled || isRefreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current

    const scrollElem = document.documentElement || document.body
    if (diff > 0 && scrollElem.scrollTop <= 0) {
      // Aplicar resistência logarítmica
      const damp = Math.min(diff * 0.45, pullDistance * 1.4)
      setPullY(damp)
    } else {
      setPullY(0)
    }
  }

  const handleTouchEnd = useCallback(async () => {
    if (!isPullingRef.current || disabled || isRefreshing) return
    isPullingRef.current = false

    if (pullY >= pullDistance) {
      setIsRefreshing(true)
      setPullY(pullDistance)
      try {
        await onRefresh()
      } catch (err) {
        console.error('Erro durante pull-to-refresh:', err)
      } finally {
        setIsRefreshing(false)
        setPullY(0)
      }
    } else {
      setPullY(0)
    }
  }, [disabled, isRefreshing, onRefresh, pullDistance, pullY])

  useEffect(() => {
    if (!isRefreshing && pullY === 0) {
      isPullingRef.current = false
    }
  }, [isRefreshing, pullY])

  const progress = Math.min(pullY / pullDistance, 1)

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn('relative min-h-full flex flex-col', className)}
    >
      {/* Indicador de Pull to Refresh */}
      <div
        style={{
          height: `${pullY}px`,
          opacity: pullY > 5 ? 1 : 0,
        }}
        className="w-full overflow-hidden transition-all duration-150 flex items-center justify-center pointer-events-none"
      >
        <div className="flex items-center gap-2 py-2 px-3 rounded-full bg-[#11161d] border border-cyan-900/60 shadow-lg text-cyan-400 text-xs font-semibold">
          <RotateCw
            className={cn('w-4 h-4 text-cyan-400 transition-transform', {
              'animate-spin': isRefreshing,
            })}
            style={{
              transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            }}
          />
          <span className="text-zinc-300">
            {isRefreshing
              ? 'Atualizando dados náuticos...'
              : pullY >= pullDistance
                ? 'Solte para atualizar'
                : 'Puxe para atualizar'}
          </span>
        </div>
      </div>

      {children}
    </div>
  )
}
export default PullToRefresh
