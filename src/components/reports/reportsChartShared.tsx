/* eslint-disable react-refresh/only-export-components */
import { useMemo } from 'react'
import { formatCurrency, formatNumberBR } from '@/utils/format'

import type { ChartTooltipEntry } from '@/types/recharts'
import Button from '@/components/Button'
import type { Payload } from 'recharts/types/component/DefaultLegendContent'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'


export function formatChartAxisTick(value: number): string {
  const numericValue = Number.isFinite(value) ? value : 0
  if (numericValue >= 1000) {
    return `R$ ${formatNumberBR(numericValue / 1000, { maximumFractionDigits: 0 })}k`
  }
  return `R$ ${formatNumberBR(numericValue, { maximumFractionDigits: 0 })}`
}

export function ChartTooltip({
  active,
  payload,
  label,
  formatValue = formatCurrency,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
  label?: string | number
  formatValue?: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface-glass-strong border border-glass p-2.5 rounded-xl shadow-lg glass-shadow-tooltip backdrop-blur-md min-w-[150px] flex flex-col gap-1">
      {label && (
        <p className="text-[10px] font-semibold text-secondary uppercase tracking-wider border-b border-glass pb-1 mb-1">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="text-secondary truncate">{entry.name}</span>
            </div>
            <span className="font-semibold text-primary font-mono whitespace-nowrap">
              {formatValue(Number(entry.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function PieTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
}) {
  if (!active || !payload?.[0]) return null
  const point = payload[0].payload as { name?: string; value?: number; color?: string } | undefined
  if (!point) return null

  return (
    <div className="surface-glass-strong border border-glass p-2.5 rounded-xl shadow-lg glass-shadow-tooltip backdrop-blur-md min-w-[130px] flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: point.color || payload[0].color || 'var(--color-primary)' }} />
        <span className="truncate">{point.name}</span>
      </div>
      <p className="text-xs font-mono font-bold text-primary mt-1">
        {formatCurrency(Number(point.value ?? 0))}
      </p>
    </div>
  )
}

interface InteractiveChartLegendProps {
  payload?: Payload[]
  hiddenSeries: string[]
  onToggle: (dataKey: string) => void
}

export function InteractiveChartLegend({ payload, hiddenSeries, onToggle }: InteractiveChartLegendProps) {
  if (!payload?.length) return null

  return (
    <div className="flex flex-wrap gap-2 pt-2 justify-center">
      {payload.map((entry) => {
        const dataKey = String(entry.dataKey ?? entry.value ?? '')
        const isHidden = hiddenSeries.includes(dataKey)

        return (
          <Button
            key={dataKey}
            type="button"
            variant={isHidden ? 'outline' : 'secondary'}
            size="sm"
            onClick={() => onToggle(dataKey)}
            className={`px-2 py-1 text-xs flex items-center gap-2 ${isHidden ? 'opacity-50' : ''}`}
            aria-pressed={!isHidden}
          >
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span>{entry.value}</span>
          </Button>
        )
      })}
    </div>
  )
}

interface SparklineProps {
  data: number[]
  color: string
  height?: number
  width?: number | string
}

export function Sparkline({ data, color, height = 32, width = '100%' }: SparklineProps) {
  const chartData = useMemo(() => {
    // Se não houver dados, criar array padrão zerado
    if (!data || data.length === 0) {
      return Array.from({ length: 10 }, (_, idx) => ({ idx, value: 0 }))
    }
    return data.map((val, idx) => ({ idx, value: val }))
  }, [data])

  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={1.5}
          fill={`url(#sparkGrad-${color.replace(/[^a-zA-Z0-9]/g, '')})`}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}


