import Card from '@/components/Card'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { AssetPosition } from '@/services/investmentEngine'
import { formatNumberBR } from '@/utils/format'

interface ExposureVsLimitsChartProps {
  positions: AssetPosition[]
}

type CustomXAxisTickProps = {
  x?: number
  y?: number
  payload?: { value: string }
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

  // Custom tick para o XAxis destacar tickers com desvio > 5% em vermelho
  const CustomXAxisTick = (props: CustomXAxisTickProps) => {
    const { x = 0, y = 0, payload } = props
    const ticker = payload?.value ?? ''
    const item = sortedData.find(d => d.ticker === ticker)
    const isHighDeviation = item ? item.deviation > 5 : false

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={15}
          textAnchor="middle"
          fill={isHighDeviation ? 'var(--color-expense)' : 'var(--color-text-secondary, rgb(148, 163, 184))'}
          fontSize={11}
          fontWeight={isHighDeviation ? 'bold' : 'normal'}
          className="font-mono font-semibold"
        >
          {ticker}
        </text>
      </g>
    )
  }

  return (
    <Card className="p-5 flex flex-col justify-between text-left h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <h3 className="font-bold text-base text-primary flex items-center gap-2">
          <BarChart3 size={16} className="text-balance" />
          Exposição Real vs Meta por Ativo (Top 10 Desvios)
        </h3>
        <span className="text-[10px] uppercase font-extrabold tracking-wider bg-expense/10 text-expense border border-expense/20 px-2 py-0.5 rounded-md font-sans">
          Destacado se desvio &gt; 5%
        </span>
      </div>

      <div className="h-80 w-full">
        {sortedData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-secondary italic">
            Nenhuma posição disponível para exibir.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
            <BarChart
              data={sortedData}
              layout="horizontal"
              margin={{ top: 10, right: 10, left: -20, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, rgb(51, 65, 85))" opacity={0.2} vertical={false} />
              <XAxis
                dataKey="ticker"
                stroke="var(--color-text-secondary, rgb(148, 163, 184))"
                fontSize={11}
                tick={<CustomXAxisTick />}
                interval={0}
                tickLine={false}
              />
              <YAxis
                type="number"
                domain={[0, 'dataMax + 5']}
                stroke="var(--color-text-secondary, rgb(148, 163, 184))"
                fontSize={11}
                tickFormatter={(value) => `${value}%`}
                tickLine={false}
              />
              <Tooltip
                formatter={(value: number | string, name: string) => [`${formatNumberBR(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, name]}
                contentStyle={{
                  backgroundColor: 'var(--color-bg-secondary, rgb(30, 41, 59))',
                  borderColor: 'var(--color-border, rgb(51, 65, 85))',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary, rgb(248, 250, 252))'
                }}
              />
              <Legend
                verticalAlign="top"
                height={36}
                fontSize={11}
                wrapperStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="current_percentage" name="Exposição Real (%)" fill="var(--color-balance)" radius={[4, 4, 0, 0]} barSize={14} />
              <Bar dataKey="target_percentage" name="Meta Alocação (%)" fill="var(--color-income)" radius={[4, 4, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
