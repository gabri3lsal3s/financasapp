import { useMemo } from 'react'
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, formatChartAxisTick } from './reportsChartShared'

interface CumulativeBalanceData {
  month: string
  SaldoAcumulado: number
}

interface CumulativeBalanceChartProps {
  data: CumulativeBalanceData[]
}

export default function CumulativeBalanceChart({ data }: CumulativeBalanceChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="cumulativeBalanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
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
        <Area 
          type="monotone" 
          dataKey="SaldoAcumulado" 
          stroke="var(--color-primary)" 
          fill="url(#cumulativeBalanceGrad)" 
          strokeWidth={2} 
          {...animProps}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
