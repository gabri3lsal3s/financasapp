import Card from '@/components/Card'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'
import { formatNumberBR } from '@/utils/format'

interface ShareHistoryItem {
  date: string
  shareValue: number
}

interface WeeklyVariationChartProps {
  shareHistory: ShareHistoryItem[]
}

export default function WeeklyVariationChart({ shareHistory }: WeeklyVariationChartProps) {
  // Mostra as últimas 20 datas históricas convertendo valor da cota para rentabilidade em %
  const chartData = shareHistory.slice(-20).map(d => ({
    date: d.date,
    yieldPct: Math.round((d.shareValue - 1) * 10000) / 100
  }))

  // Formatação de data amigável (ex: de "2025-05-15" para "15/05")
  const formatDateLabel = (dateStr: string) => {
    try {
      const [, month, day] = dateStr.split('-')
      if (day && month) {
        return `${day}/${month}`
      }
      return dateStr
    } catch {
      return dateStr
    }
  }

  // Encontra menor e maior valor de rendimento para ajustar o YAxis
  const minVal = Math.min(...chartData.map(d => d.yieldPct), -2)
  const maxVal = Math.max(...chartData.map(d => d.yieldPct), 2)
  const yDomain = [Math.floor(minVal - 1), Math.ceil(maxVal + 1)]

  return (
    <Card className="p-5 flex flex-col justify-between text-left h-full">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <LineIcon size={16} className="accent-primary" />
        Evolução da Rentabilidade Total dos Ativos
      </h3>

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-secondary italic">
            Sem dados históricos de rentabilidade disponíveis.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCota" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                fontSize={10}
                tickFormatter={formatDateLabel}
                tickLine={false}
              />
              <YAxis
                fontSize={10}
                domain={yDomain}
                tickFormatter={(value) => `${formatNumberBR(value, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => `Data: ${formatDateLabel(label)}`}
                formatter={(value: number | string) => [`${formatNumberBR(Number(value), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, 'Rentabilidade Total']}
              />
              <Area
                type="monotone"
                dataKey="yieldPct"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorCota)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}
