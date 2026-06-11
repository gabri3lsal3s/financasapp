import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, InteractiveChartLegend, formatChartAxisTick } from '@/components/reports/reportsChartShared'

interface DailyFlowData {
  day: string | number
  label?: string
  Rendas: number
  Despesas: number
  Investimentos: number
}

interface DailyFlowChartProps {
  data: DailyFlowData[]
  hiddenSeries: string[]
  onToggleSeries: (key: string) => void
  xAxisKey?: string
}

export default function DailyFlowChart({ data, hiddenSeries, onToggleSeries, xAxisKey = 'day' }: DailyFlowChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.15} />
        <XAxis 
          dataKey={xAxisKey} 
          stroke="var(--color-text-secondary)" 
          fontSize={12} 
          tick={{ fill: 'var(--color-text-secondary)' }} 
          minTickGap={14} 
        />
        <YAxis
          stroke="var(--color-text-secondary)"
          fontSize={12}
          tick={{ fill: 'var(--color-text-secondary)' }}
          tickFormatter={formatChartAxisTick}
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend 
          content={(props) => (
            <InteractiveChartLegend 
              payload={props.payload} 
              hiddenSeries={hiddenSeries} 
              onToggle={onToggleSeries} 
            />
          )} 
        />
        <Line 
          type="monotone" 
          dataKey="Rendas" 
          stroke="var(--color-income)" 
          strokeWidth={2} 
          dot={false} 
          hide={hiddenSeries.includes('Rendas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Despesas" 
          stroke="var(--color-expense)" 
          strokeWidth={2} 
          dot={false} 
          hide={hiddenSeries.includes('Despesas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Investimentos" 
          stroke="var(--color-balance)" 
          strokeWidth={2} 
          dot={false} 
          hide={hiddenSeries.includes('Investimentos')} 
          {...animProps} 
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
