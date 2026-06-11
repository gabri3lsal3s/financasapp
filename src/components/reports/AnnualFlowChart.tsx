import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, InteractiveChartLegend, formatChartAxisTick } from './reportsChartShared'

interface AnnualFlowData {
  month: string
  Rendas: number
  Despesas: number
  Investimentos: number
}

interface AnnualFlowChartProps {
  data: AnnualFlowData[]
  hiddenSeries: string[]
  onToggleSeries: (key: string) => void
}

export default function AnnualFlowChart({ data, hiddenSeries, onToggleSeries }: AnnualFlowChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.15} />
        <XAxis 
          dataKey="month" 
          stroke="var(--color-text-secondary)" 
          fontSize={12} 
          tick={{ fill: 'var(--color-text-secondary)' }} 
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
          dot={{ r: 3 }} 
          hide={hiddenSeries.includes('Rendas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Despesas" 
          stroke="var(--color-expense)" 
          strokeWidth={2} 
          dot={{ r: 3 }} 
          hide={hiddenSeries.includes('Despesas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Investimentos" 
          stroke="var(--color-balance)" 
          strokeWidth={2} 
          dot={{ r: 3 }} 
          hide={hiddenSeries.includes('Investimentos')} 
          {...animProps} 
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
