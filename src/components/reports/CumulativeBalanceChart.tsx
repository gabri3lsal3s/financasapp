import { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, formatChartAxisTick } from './reportsChartShared'

interface CumulativeBalanceData {
  month: string
  SaldoAcumulado: number
  'Saldo Acumulado (Ano Ant.)'?: number
  [key: string]: string | number | boolean | undefined
}

interface CumulativeBalanceChartProps {
  data: CumulativeBalanceData[]
}

export default function CumulativeBalanceChart({ data }: CumulativeBalanceChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  const hasPrevData = useMemo(() => {
    return data.some(d => d['Saldo Acumulado (Ano Ant.)'] !== undefined)
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={280} minWidth={0} minHeight={0}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="cumulativeBalanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.1} />
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
        
        {/* Linha principal com preenchimento */}
        <Area 
          type="monotone" 
          dataKey="SaldoAcumulado" 
          name="Saldo Acumulado"
          stroke="var(--color-primary)" 
          fill="url(#cumulativeBalanceGrad)" 
          strokeWidth={2.5} 
          {...animProps}
        />

        {/* Linha tracejada comparativa do ano anterior */}
        {hasPrevData && (
          <Area 
            type="monotone" 
            dataKey="Saldo Acumulado (Ano Ant.)" 
            name="Saldo Acumulado (Ano Ant.)"
            stroke="var(--color-primary)" 
            fill="transparent"
            strokeWidth={1.5} 
            strokeDasharray="4 4"
            opacity={0.4}
            isAnimationActive={false}
          />
        )}
      </AreaChart>
    </ResponsiveContainer>
  )
}

