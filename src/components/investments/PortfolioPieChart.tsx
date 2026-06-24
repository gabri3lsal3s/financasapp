import { useMemo, useState } from 'react'
import Card from '@/components/Card'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface PieSlice {
  name: string
  value: number
  percentage: number
  color: string
}

interface PortfolioPieChartProps {
  title: string
  subtitle?: string
  data: PieSlice[]
  innerRadius?: number
  outerRadius?: number
  valueLabel?: string
  onSliceClick?: (sliceName: string) => void
}

// Paleta de cores harmonizada com o design system
const PIE_COLORS = [
  'var(--color-primary)',
  'var(--color-income)',
  'var(--color-balance)',
  'var(--color-expense)',
  'var(--color-income-strong)',
  'var(--color-primary-strong)',
  'var(--color-text-secondary)',
  'var(--color-text-secondary)',
  'var(--chart-glass-3)',
  'var(--chart-glass-0)',
  'var(--chart-glass-1)',
  'var(--chart-glass-2)',
]

const DEFAULT_INNER_RADIUS = 55
const DEFAULT_OUTER_RADIUS = 90

export default function PortfolioPieChart({
  title,
  subtitle,
  data,
  innerRadius = DEFAULT_INNER_RADIUS,
  outerRadius = DEFAULT_OUTER_RADIUS,
  valueLabel = 'Valor',
  onSliceClick,
}: PortfolioPieChartProps) {
  const [showPercent, setShowPercent] = useState(false)

  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])
  const displayData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        displayValue: showPercent
          ? formatPercentBR(d.percentage, 1)
          : formatCurrency(d.value),
      })),
    [data, showPercent]
  )

  // Ordenar do maior para o menor
  const sortedData = useMemo(
    () => [...displayData].sort((a, b) => b.value - a.value),
    [displayData]
  )

  if (data.length === 0) return null

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 space-y-4 text-left">
      <div className="border-b border-glass/40 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-black text-primary uppercase tracking-wider">{title}</h4>
            {subtitle && (
              <p className="text-[10px] text-secondary font-medium mt-0.5">{subtitle}</p>
            )}
          </div>
          {/* Toggle valor/percentual */}
          <button
            type="button"
            onClick={() => setShowPercent((prev) => !prev)}
            className="shrink-0 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg bg-glass/10 hover:bg-glass/20 text-secondary hover:text-primary transition-all border border-glass/30"
            title={showPercent ? 'Mostrar valores em R$' : 'Mostrar percentuais'}
          >
            {showPercent ? 'R$' : '%'}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Gráfico */}
        <div className="w-48 h-48 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={sortedData}
                cx="50%"
                cy="50%"
                innerRadius={innerRadius}
                outerRadius={outerRadius}
                dataKey="value"
                paddingAngle={2}
                cornerRadius={4}
                onClick={(entry) => {
                  if (onSliceClick && entry?.name) {
                    onSliceClick(entry.name as string)
                  }
                }}
                style={{ cursor: onSliceClick ? 'pointer' : 'default' }}
              >
                {sortedData.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const item = payload[0].payload as PieSlice
                    return (
                      <div className="bg-glass/95 border border-glass rounded-2xl p-3 shadow-lg backdrop-blur-md min-w-[140px] space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-[10px] font-black text-primary uppercase tracking-wider">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-[10px]">
                          <span className="text-secondary font-bold">Percentual:</span>
                          <span className="text-primary font-black font-mono">
                            {formatPercentBR(item.percentage, 1)}
                          </span>
                        </div>
                        <div className="flex justify-between gap-4 text-[10px]">
                          <span className="text-secondary font-bold">{valueLabel}:</span>
                          <span className="text-primary font-black font-mono">
                            {formatCurrency(item.value)}
                          </span>
                        </div>
                      </div>
                    )
                  }
                  return null
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legenda */}
        <div className="flex-1 space-y-2 w-full min-w-0">
          {sortedData.map((item, index) => (
            <button
              key={item.name}
              type="button"
              onClick={() => onSliceClick?.(item.name)}
              className={`flex items-center justify-between gap-2 text-xs w-full text-left ${
                onSliceClick ? 'hover:bg-glass/10 cursor-pointer' : ''
              } px-2 py-1 rounded-lg transition-colors`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color || PIE_COLORS[index % PIE_COLORS.length] }}
                />
                <span className="font-bold text-primary truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="font-mono text-secondary font-medium">
                  {formatPercentBR(item.percentage, 1)}
                </span>
                <span className="font-mono text-primary font-black text-right w-20">
                  {formatCurrency(item.value)}
                </span>
              </div>
            </button>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between gap-2 text-xs border-t border-glass/30 pt-2 mt-2 px-2">
            <span className="font-black text-secondary uppercase tracking-wider">Total</span>
            <span className="font-mono font-black text-primary">
              {showPercent ? '100%' : formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  )
}
