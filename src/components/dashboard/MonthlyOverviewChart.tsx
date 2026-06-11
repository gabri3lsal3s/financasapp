import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, Cell, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, formatChartAxisTick } from '@/components/reports/reportsChartShared'

interface OverviewItem {
  name: string
  value: number
  color: string
}

interface MonthlyOverviewChartProps {
  data: OverviewItem[]
}

export default function MonthlyOverviewChart({ data }: MonthlyOverviewChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.15} />
        <XAxis 
          dataKey="name" 
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
        <Bar dataKey="value" radius={[6, 6, 0, 0]} {...animProps}>
          {data.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
