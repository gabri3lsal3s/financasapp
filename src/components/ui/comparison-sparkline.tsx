/**
 * Sparkline comparativo duplo (DRY): curva atual (linha sólida) × curva do
 * período anterior (linha pontilhada), com fallback para linha única quando
 * não há histórico. SVG puro (sem biblioteca), stroke via tokens CSS.
 */
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { buildSparklinePath } from '@/utils/comparisonSparkline'

interface ComparisonSparklineProps {
  /** Série atual (mês vigente). */
  data: number[]
  /** Série anterior opcional (mês anterior). */
  compareData?: number[]
  width?: number
  height?: number
  strokeWidth?: number
  className?: string
  ariaLabel?: string
}

export default function ComparisonSparkline({
  data,
  compareData,
  width = 240,
  height = 48,
  strokeWidth = 1.5,
  className,
  ariaLabel,
}: ComparisonSparklineProps) {
  const gradientId = useId().replace(/:/g, '')
  const current = Array.isArray(data) ? data.filter((v) => Number.isFinite(v)) : []
  const previous = Array.isArray(compareData) ? compareData.filter((v) => Number.isFinite(v)) : []

  if (current.length === 0) return null

  const allValues = [...previous, ...current]
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const baseMin = min < 0 ? min : 0

  const currentPath = buildSparklinePath(current, width, height, baseMin, max)
  const previousPath =
    previous.length > 0 ? buildSparklinePath(previous, width, height, baseMin, max) : null

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      role="img"
      aria-label={ariaLabel ?? 'Evolução do período atual comparada ao período anterior'}
      className={cn('block overflow-visible', className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Área sob a curva atual */}
      <path d={`${currentPath} L ${width},${height} L 0,${height} Z`} fill={`url(#${gradientId})`} />

      {previousPath && (
        <path
          d={previousPath}
          fill="none"
          stroke="var(--ds-color-text-secondary)"
          strokeOpacity="0.5"
          strokeWidth={strokeWidth}
          strokeDasharray="4 4"
        />
      )}

      <path
        d={currentPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ponto de pulso fluorescente no último valor (Fase 8) */}
      {(() => {
        const lastVal = current[current.length - 1]
        const range = max - baseMin || 1
        const lastX = width
        const lastY = height - ((lastVal - baseMin) / range) * (height - 8) - 4
        return (
          <g transform={`translate(${lastX}, ${lastY})`} pointerEvents="none">
            <circle r="4.5" fill="currentColor" className="animate-ping opacity-75" />
            <circle r="3" fill="currentColor" className="drop-shadow-[0_0_6px_currentColor]" />
          </g>
        )
      })()}
    </svg>
  )
}
