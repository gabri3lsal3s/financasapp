import { formatCurrency, formatNumberBR } from '@/utils/format'
import type { ChartTooltipEntry } from '@/types/recharts'
import Button from '@/components/Button'
import type { Payload } from 'recharts/types/component/DefaultLegendContent'

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
  formatValue = formatCurrency,
}: {
  active?: boolean
  payload?: ChartTooltipEntry[]
  formatValue?: (n: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="surface-glass-strong border border-glass p-3 rounded-xl glass-shadow-tooltip">
      {payload.map((entry, i) => (
        <p key={i} style={{ color: entry.color }} className="text-sm font-medium">
          {entry.name}: {formatValue(Number(entry.value))}
        </p>
      ))}
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
  const point = payload[0].payload as { name?: string; value?: number } | undefined
  if (!point) return null

  return (
    <div className="surface-glass-strong border border-glass p-3 rounded-xl glass-shadow-tooltip">
      <p className="text-sm font-medium text-primary">{point.name}</p>
      <p className="text-sm text-secondary">{formatCurrency(Number(point.value ?? 0))}</p>
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

