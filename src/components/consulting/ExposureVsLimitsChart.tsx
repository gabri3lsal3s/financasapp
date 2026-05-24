import Card from '@/components/Card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { AssetPosition } from '@/services/investmentEngine'

interface ExposureVsLimitsChartProps {
  positions: AssetPosition[]
}

export default function ExposureVsLimitsChart({ positions }: ExposureVsLimitsChartProps) {
  // Ordena por maior desvio absoluto
  const sortedData = [...positions]
    .map(pos => {
      const deviation = Math.abs(pos.current_percentage - pos.target_percentage)
      return {
        ...pos,
        deviation
      }
    })
    .sort((a, b) => b.deviation - a.deviation)
    // Mostra no máximo as 10 principais para não sobrecarregar visualmente
    .slice(0, 10)

  // Custom tick para o YAxis destacar tickers com desvio > 5% em vermelho
  const CustomYAxisTick = (props: any) => {
    const { x, y, payload } = props
    const ticker = payload.value
    const item = sortedData.find(d => d.ticker === ticker)
    const isHighDeviation = item ? item.deviation > 5 : false

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={-10}
          y={4}
          textAnchor="end"
          fill={isHighDeviation ? '#ef4444' : 'var(--color-text-secondary, #94a3b8)'}
          fontSize={12}
          fontWeight={isHighDeviation ? 'bold' : 'normal'}
          className="font-mono font-semibold"
        >
          {ticker}
        </text>
      </g>
    )
  }

  return (
    <Card className="p-5 flex flex-col justify-between shadow-sm border border-border/40 text-left h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-base text-primary flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-500" />
          Exposição Real vs Meta por Ativo (Top 10 Desvios)
        </h3>
        <span className="text-[10px] uppercase font-extrabold tracking-wider bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-md font-sans">
          Destacado em vermelho se desvio &gt; 5%
        </span>
      </div>

      <div className="h-80 w-full">
        {sortedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-secondary italic">
            Nenhuma posição disponível para exibir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={sortedData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #334155)" opacity={0.2} horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 'dataMax + 5']}
                stroke="var(--color-text-secondary, #94a3b8)"
                fontSize={11}
                tickFormatter={(value) => `${value}%`}
              />
              <YAxis
                dataKey="ticker"
                type="category"
                stroke="var(--color-text-secondary, #94a3b8)"
                fontSize={12}
                tick={<CustomYAxisTick />}
                width={80}
              />
              <Tooltip
                formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}%`, name]}
                contentStyle={{
                  backgroundColor: 'var(--color-bg-card, #1e293b)',
                  borderColor: 'var(--color-border, #334155)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary, #f8fafc)'
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                fontSize={11}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="current_percentage" name="Exposição Real (%)" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="target_percentage" name="Meta Alocação (%)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
