import { useState, useMemo } from 'react'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts'
import { chartAnimProps } from '@/types/recharts'
import { PieTooltip } from './reportsChartShared'
import { formatCurrency } from '@/utils/format'

interface PieChartItem {
  name: string
  value: number
  color: string
  categoryId?: string
  [key: string]: string | number | boolean | undefined
}

interface CategoryPieChartProps {
  data: PieChartItem[]
  onClick?: (entry: PieChartItem) => void
  outerRadius?: number
  innerRadius?: number
}

export default function CategoryPieChart({ data, onClick, outerRadius = 90, innerRadius = 66 }: CategoryPieChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const totalValue = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0)
  }, [data])

  const activeItem = useMemo(() => {
    if (activeIndex !== null && data[activeIndex]) {
      return data[activeIndex]
    }
    return null
  }, [activeIndex, data])

  return (
    <div className="relative w-full h-[260px] flex items-center justify-center">
      <ResponsiveContainer width="100%" height="100%">
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
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            paddingAngle={data.length > 1 ? 3 : 0}
            {...animProps}
          >
            {data.map((entry, index) => (
              <Cell 
                key={`${entry.name}-${index}`} 
                fill={entry.color} 
                style={{
                  filter: activeIndex === index ? 'drop-shadow(0px 0px 6px rgba(var(--color-primary-rgb), 0.35))' : 'none',
                  transition: 'filter 0.2s ease, transform 0.2s ease',
                  cursor: 'pointer',
                  transform: activeIndex === index ? 'scale(1.03)' : 'scale(1)',
                  transformOrigin: '50% 50%',
                }}
              />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          
          {/* Rótulo central para o Donut */}
          <text 
            x="50%" 
            y="46%" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="currentColor"
            className="text-muted-foreground text-[10px] sm:text-[10.5px] font-black uppercase tracking-widest"
          >
            {activeItem ? activeItem.name : 'Total'}
          </text>
          <text 
            x="50%" 
            y="58%" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill="currentColor"
            className="text-foreground text-sm sm:text-base font-black font-mono"
          >
            {formatCurrency(activeItem ? activeItem.value : totalValue)}
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

