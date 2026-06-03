import { formatCurrency } from '@/utils/format'
import type { ChartTooltipEntry } from '@/types/recharts'

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
