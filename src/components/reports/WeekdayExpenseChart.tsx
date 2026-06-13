import { useMemo } from 'react'
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar, Tooltip, Legend } from 'recharts'
import { ChartTooltip, InteractiveChartLegend } from './reportsChartShared'

interface WeekdayData {
  dia: string
  Despesas: number
  'Despesas (Mês Ant.)'?: number
}

interface WeekdayExpenseChartProps {
  data: WeekdayData[]
}

export default function WeekdayExpenseChart({ data }: WeekdayExpenseChartProps) {
  const hasPrevData = useMemo(() => {
    return data.some(d => d['Despesas (Mês Ant.)'] !== undefined)
  }, [data])

  return (
    <ResponsiveContainer width="100%" height={300} minWidth={0} minHeight={0}>
      <RadarChart data={data}>
        <PolarGrid stroke="var(--color-border)" strokeOpacity={0.15} />
        <PolarAngleAxis 
          dataKey="dia" 
          tick={{ fill: 'var(--color-text-secondary)', fontSize: 12 }} 
        />
        <Tooltip content={<ChartTooltip />} />
        <Legend 
          content={(props) => (
            <InteractiveChartLegend 
              payload={props.payload} 
              hiddenSeries={[]} 
              onToggle={() => {}} 
            />
          )} 
        />
        <Radar
          name="Despesas"
          dataKey="Despesas"
          stroke="var(--color-expense)"
          fill="var(--color-expense)"
          fillOpacity={0.15}
          strokeWidth={2}
          isAnimationActive={false}
        />
        {hasPrevData && (
          <Radar
            name="Despesas (Mês Ant.)"
            dataKey="Despesas (Mês Ant.)"
            stroke="var(--color-expense)"
            fill="var(--color-expense)"
            fillOpacity={0.05}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            opacity={0.5}
            isAnimationActive={false}
          />
        )}
      </RadarChart>
    </ResponsiveContainer>
  )
}

