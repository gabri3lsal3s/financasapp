import Card from '@/components/Card'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { LineChart as LineIcon } from 'lucide-react'

interface ShareHistoryItem {
  date: string
  shareValue: number
}

interface WeeklyVariationChartProps {
  shareHistory: ShareHistoryItem[]
}

export default function WeeklyVariationChart({ shareHistory }: WeeklyVariationChartProps) {
  // Mostra as últimas 20 datas históricas para melhor espaçamento do gráfico
  const chartData = shareHistory.slice(-20)

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

  // Encontra menor valor da cota para ajustar o YAxis e dar melhor zoom dinâmico
  const minVal = Math.min(...chartData.map(d => d.shareValue), 0.9)
  const maxVal = Math.max(...chartData.map(d => d.shareValue), 1.1)
  const yDomain = [Math.floor(minVal * 95) / 100, Math.ceil(maxVal * 105) / 100]

  return (
    <Card className="p-5 flex flex-col justify-between shadow-sm border border-border/40 text-left h-full">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <LineIcon size={16} className="text-indigo-500" />
        Evolução do Valor da Cota (Rentabilidade Histórica)
      </h3>

      <div className="h-64 w-full">
        {chartData.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-secondary italic">
            Sem dados históricos de cotas disponíveis.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorCota" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #334155)" opacity={0.15} />
              <XAxis
                dataKey="date"
                stroke="var(--color-text-secondary, #94a3b8)"
                fontSize={10}
                tickFormatter={formatDateLabel}
                tickLine={false}
              />
              <YAxis
                stroke="var(--color-text-secondary, #94a3b8)"
                fontSize={10}
                domain={yDomain}
                tickFormatter={(value) => `R$ ${value.toFixed(2)}`}
                tickLine={false}
              />
              <Tooltip
                labelFormatter={(label) => `Data: ${formatDateLabel(label)}`}
                formatter={(value: any) => [`R$ ${Number(value).toFixed(4)}`, 'Valor da Cota']}
                contentStyle={{
                  backgroundColor: 'var(--color-bg-card, #1e293b)',
                  borderColor: 'var(--color-border, #334155)',
                  borderRadius: '12px',
                  color: 'var(--color-text-primary, #f8fafc)'
                }}
              />
              <Area
                type="monotone"
                dataKey="shareValue"
                stroke="#6366f1"
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
