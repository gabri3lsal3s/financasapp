import { useMemo } from 'react'
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts'
import { format as dateFormat } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'
import { chartAnimProps } from '@/types/recharts'
import { ChartTooltip, formatChartAxisTick } from './reportsChartShared'

interface DetailItem {
  id: string
  description: string
  date: string
  amount: number
}

interface CategoryDetailMiniChartProps {
  detailItems: DetailItem[]
  period: 'month' | 'year'
  selectedMonth: string
  selectedYear: number
  color?: string
}

export default function CategoryDetailMiniChart({
  detailItems,
  period,
  selectedMonth,
  selectedYear,
  color = 'var(--color-primary)'
}: CategoryDetailMiniChartProps) {
  const animProps = useMemo(() => chartAnimProps(), [])

  const chartData = useMemo(() => {
    if (period === 'month') {
      const [year, month] = selectedMonth.split('-').map(Number)
      if (!year || !month) return []

      const daysInMonth = new Date(year, month, 0).getDate()
      const dailyMap = Array.from({ length: daysInMonth }, (_, index) => ({
        label: String(index + 1).padStart(2, '0'),
        Valor: 0
      }))

      detailItems.forEach((item) => {
        // Garantindo parsing correto e seguro de data sem offset de fuso
        const parts = item.date.split('-').map(Number)
        if (parts.length === 3) {
          const day = parts[2]
          if (day >= 1 && day <= daysInMonth) {
            dailyMap[day - 1].Valor += item.amount
          }
        }
      })

      return dailyMap
    } else {
      const monthlyMap = Array.from({ length: 12 }, (_, index) => {
        const tempDate = new Date(selectedYear, index, 1)
        const name = dateFormat(tempDate, 'MMM', { locale: ptBR })
        return {
          label: name.charAt(0).toUpperCase() + name.slice(1),
          Valor: 0
        }
      })

      detailItems.forEach((item) => {
        const parts = item.date.split('-').map(Number)
        if (parts.length >= 2) {
          const monthIndex = parts[1] - 1
          if (monthIndex >= 0 && monthIndex < 12) {
            monthlyMap[monthIndex].Valor += item.amount
          }
        }
      })

      return monthlyMap
    }
  }, [detailItems, period, selectedMonth, selectedYear])

  const hasData = useMemo(() => chartData.some(d => d.Valor > 0), [chartData])

  if (!hasData || chartData.length === 0) {
    return null
  }

  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-secondary opacity-70">
        Distribuição temporal no {period === 'year' ? 'ano' : 'mês'}
      </p>
      <div className="rounded-xl border border-glass surface-glass p-2">
        <ResponsiveContainer width="100%" height={110}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" strokeOpacity={0.1} vertical={false} />
            <XAxis 
              dataKey="label" 
              stroke="var(--color-text-secondary)" 
              fontSize={8} 
              tickLine={false}
              axisLine={false}
              minTickGap={period === 'month' ? 10 : 4}
            />
            <YAxis
              stroke="var(--color-text-secondary)"
              fontSize={8}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatChartAxisTick}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar 
              dataKey="Valor" 
              fill={color} 
              radius={[3, 3, 0, 0]} 
              {...animProps} 
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
