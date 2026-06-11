import { useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { PieTooltip } from './reportsChartShared'

interface PieChartItem {
  name: string
  value: number
  color: string
  categoryId?: string
  [key: string]: any
}

interface CategoryPieChartProps {
  data: PieChartItem[]
  onClick?: (entry: any) => void
  outerRadius?: number
  innerRadius?: number
}

export default function CategoryPieChart({ data, onClick, outerRadius = 100, innerRadius = 0 }: CategoryPieChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={outerRadius}
          innerRadius={innerRadius}
          labelLine={false}
          label={false}
          fill="var(--color-primary)"
          onClick={onClick}
          paddingAngle={innerRadius > 0 ? 3 : 0}
          {...animProps}
        >
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<PieTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  )
}
