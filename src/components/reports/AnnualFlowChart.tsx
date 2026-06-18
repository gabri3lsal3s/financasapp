import { useMemo } from 'react'
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, InteractiveChartLegend, formatChartAxisTick } from './reportsChartShared'

interface AnnualFlowData {
  month: string
  Rendas: number
  Despesas: number
  Investimentos: number
  'Rendas (Ano Ant.)'?: number
  'Despesas (Ano Ant.)'?: number
  'Investimentos (Ano Ant.)'?: number
  [key: string]: string | number | boolean | undefined
}

interface AnnualFlowChartProps {
  data: AnnualFlowData[]
  hiddenSeries: string[]
  onToggleSeries: (key: string) => void
}

export default function AnnualFlowChart({ data, hiddenSeries, onToggleSeries }: AnnualFlowChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  const hasPrevData = useMemo(() => {
    return data.some(d => d['Rendas (Ano Ant.)'] !== undefined)
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={0}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.1} />
        <XAxis 
          dataKey="month" 
          stroke="var(--color-text-secondary)" 
          fontSize={12} 
          tick={{ fill: 'var(--color-text-secondary)' }} 
          minTickGap={30}
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
          dot={{ r: 4, strokeWidth: 1 }} 
          activeDot={{ r: 6 }}
          hide={hiddenSeries.includes('Rendas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Despesas" 
          stroke="var(--color-expense)" 
          strokeWidth={2.5} 
          dot={{ r: 4, strokeWidth: 1 }} 
          activeDot={{ r: 6 }}
          hide={hiddenSeries.includes('Despesas')} 
          {...animProps} 
        />
        <Line 
          type="monotone" 
          dataKey="Investimentos" 
          stroke="var(--color-balance)" 
          strokeWidth={2.5} 
          dot={{ r: 4, strokeWidth: 1 }} 
          activeDot={{ r: 6 }}
          hide={hiddenSeries.includes('Investimentos')} 
          {...animProps} 
        />

        {/* Linhas tracejadas de comparação com o ano anterior */}
        {hasPrevData && (
          <Line 
            type="monotone" 
            dataKey="Rendas (Ano Ant.)" 
            name="Rendas (Ano Ant.)"
            stroke="var(--color-income)" 
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            dot={false}
            opacity={0.4}
            hide={hiddenSeries.includes('Rendas (Ano Ant.)') || hiddenSeries.includes('Rendas')} 
            isAnimationActive={false} 
          />
        )}
        {hasPrevData && (
          <Line 
            type="monotone" 
            dataKey="Despesas (Ano Ant.)" 
            name="Despesas (Ano Ant.)"
            stroke="var(--color-expense)" 
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            dot={false}
            opacity={0.4}
            hide={hiddenSeries.includes('Despesas (Ano Ant.)') || hiddenSeries.includes('Despesas')} 
            isAnimationActive={false} 
          />
        )}
        {hasPrevData && (
          <Line 
            type="monotone" 
            dataKey="Investimentos (Ano Ant.)" 
            name="Investimentos (Ano Ant.)"
            stroke="var(--color-balance)" 
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            dot={false}
            opacity={0.4}
            hide={hiddenSeries.includes('Investimentos (Ano Ant.)') || hiddenSeries.includes('Investimentos')} 
            isAnimationActive={false} 
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  )
}

