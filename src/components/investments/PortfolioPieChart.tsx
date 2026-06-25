import { useMemo } from 'react'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface PieSlice {
  name: string
  value: number
  percentage: number
  color: string
}

interface PortfolioPieChartProps {
  /** Título do card — se omitido, o header não é renderizado (útil para uso em cards unificados) */
  title?: string
  subtitle?: string
  data: PieSlice[]
  innerRadius?: number
  outerRadius?: number
  valueLabel?: string
  onSliceClick?: (sliceName: string) => void
}

const DEFAULT_INNER_RADIUS = 65
const DEFAULT_OUTER_RADIUS = 105

export default function PortfolioPieChart({
  title,
  subtitle,
  data,
  innerRadius = DEFAULT_INNER_RADIUS,
  outerRadius = DEFAULT_OUTER_RADIUS,
  valueLabel = 'Valor',
  onSliceClick,
}: PortfolioPieChartProps) {
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data])

  // Ordenar do maior para o menor
  const sortedData = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data])

  if (data.length === 0) return null

  const hasHeader = !!title

  return (
    <div className="space-y-3">
      {/* Header opcional — renderizado apenas quando title é fornecido */}
      {hasHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h4 className="text-sm font-black text-primary uppercase tracking-wider">{title}</h4>
            {subtitle && (
              <p className="text-[10px] text-secondary font-medium mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-col items-center gap-4">
        {/* Gráfico — responsivo, ocupa largura total */}
        <div className="w-full max-w-[300px] aspect-square">
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
                {sortedData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
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
        <div className="w-full space-y-1.5">
          {sortedData.map((item) => (
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
                  style={{ backgroundColor: item.color }}
                />
                <span className="font-bold text-primary truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-secondary font-medium text-[11px]">
                  {formatPercentBR(item.percentage, 1)}
                </span>
                <span className="font-mono text-primary font-black text-right text-[11px] w-20 hidden xs:inline-block">
                  {formatCurrency(item.value)}
                </span>
              </div>
            </button>
          ))}

          {/* Total */}
          <div className="flex items-center justify-between gap-2 text-xs border-t border-glass/30 pt-2 mt-1 px-2">
            <span className="font-black text-secondary uppercase tracking-wider text-[10px]">Total</span>
            <span className="font-mono font-black text-primary text-[11px]">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
