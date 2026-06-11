import { useMemo } from 'react'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, Legend } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip } from './reportsChartShared'

interface WeekdayData {
  dia: string
  Despesas: number
}

interface WeekdayExpenseChartProps {
  data: WeekdayData[]
}

export default function WeekdayExpenseChart({ data }: WeekdayExpenseChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--color-border)" strokeOpacity={0.15} />
        <PolarAngleAxis 
          dataKey="dia" 
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend />
        <Radar
          name="Despesas"
          dataKey="Despesas"
          stroke="var(--color-expense)"
          fill="var(--color-expense)"
          fillOpacity={0.15}
          strokeWidth={2}
          {...animProps}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
