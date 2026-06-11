import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, InteractiveChartLegend, formatChartAxisTick } from './reportsChartShared'

interface MonthCompositionData {
  month: string
  Rendas: number
  Despesas: number
  Investimentos: number
}

interface MonthCompositionChartProps {
  data: MonthCompositionData[]
  hiddenSeries: string[]
  onToggleSeries: (key: string) => void
}

export default function MonthCompositionChart({ data, hiddenSeries, onToggleSeries }: MonthCompositionChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
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
        <Bar 
          dataKey="Rendas" 
          fill="var(--color-income)" 
          radius={[4, 4, 0, 0]} 
          hide={hiddenSeries.includes('Rendas')} 
          {...animProps}
        />
        <Bar 
          dataKey="Despesas" 
          fill="var(--color-expense)" 
          radius={[4, 4, 0, 0]} 
          hide={hiddenSeries.includes('Despesas')} 
          {...animProps}
        />
        <Bar 
          dataKey="Investimentos" 
          fill="var(--color-balance)" 
          radius={[4, 4, 0, 0]} 
          hide={hiddenSeries.includes('Investimentos')} 
          {...animProps}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
