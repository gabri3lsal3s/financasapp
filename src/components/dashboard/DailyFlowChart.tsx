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
  'Rendas (Mês Ant.)'?: number
  'Despesas (Mês Ant.)'?: number
  'Investimentos (Mês Ant.)'?: number
  [key: string]: string | number | boolean | undefined
}

interface DailyFlowChartProps {
  data: DailyFlowData[]
  hiddenSeries: string[]
  onToggleSeries: (key: string) => void
  xAxisKey?: string
}

export default function DailyFlowChart({ data, hiddenSeries, onToggleSeries, xAxisKey = 'day' }: DailyFlowChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  const hasPrevData = useMemo(() => {
    return data.some(d => d['Rendas (Mês Ant.)'] !== undefined)
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.1} />
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
        
        {/* Linhas principais */}
        <Line 
          type="monotone" 
          dataKey="Rendas" 
          stroke="var(--color-income)" 
          strokeWidth={2.5} 
          dot={false} 
          activeDot={{ r: 5 }}
          hide={hiddenSeries.includes('Rendas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Despesas" 
          stroke="var(--color-expense)" 
          strokeWidth={2.5} 
          dot={false} 
          activeDot={{ r: 5 }}
          hide={hiddenSeries.includes('Despesas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Investimentos" 
          stroke="var(--color-balance)" 
          strokeWidth={2.5} 
          dot={false} 
          activeDot={{ r: 5 }}
          hide={hiddenSeries.includes('Investimentos')} 
          {...animProps} 
        />

        {/* Linhas tracejadas de comparação com o mês anterior */}
        {hasPrevData && (
          <Line 
            type="monotone" 
            dataKey="Rendas (Mês Ant.)" 
            name="Rendas (Mês Ant.)"
            stroke="var(--color-income)" 
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            dot={false}
            opacity={0.4}
            hide={hiddenSeries.includes('Rendas (Mês Ant.)') || hiddenSeries.includes('Rendas')} 
            {...animProps} 
          />
        )}
        {hasPrevData && (
          <Line 
            type="monotone" 
            dataKey="Despesas (Mês Ant.)" 
            name="Despesas (Mês Ant.)"
            stroke="var(--color-expense)" 
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            dot={false}
            opacity={0.4}
            hide={hiddenSeries.includes('Despesas (Mês Ant.)') || hiddenSeries.includes('Despesas')} 
            {...animProps} 
          />
        )}
        {hasPrevData && (
          <Line 
            type="monotone" 
            dataKey="Investimentos (Mês Ant.)" 
            name="Investimentos (Mês Ant.)"
            stroke="var(--color-balance)" 
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            dot={false}
            opacity={0.4}
            hide={hiddenSeries.includes('Investimentos (Mês Ant.)') || hiddenSeries.includes('Investimentos')} 
            {...animProps} 
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

