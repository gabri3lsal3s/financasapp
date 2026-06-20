import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { formatCurrency, formatNumberBR, formatChartYAxisCurrency } from '@/utils/format'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

interface ShareHistoryItem {
  rate_date: string
  share_value: number
  gross_pl: number
  net_pl: number
  total_shares: number
}

interface EvolutionChartProps {
  shareHistory: ShareHistoryItem[]
}

export default function EvolutionChart({ shareHistory }: EvolutionChartProps) {
  const [chartMode, setChartMode] = useState<'equity' | 'share'>('equity')

  const chartData = useMemo(() => {
    return shareHistory.map((h) => ({
      date: h.rate_date.split('-').reverse().slice(0, 2).join('/'), // format DD/MM or MM/YYYY
      fullDate: h.rate_date,
      value: chartMode === 'equity' ? Number(h.gross_pl) : Number(h.share_value)
    }))
  }, [shareHistory, chartMode])

  if (shareHistory.length === 0) {
    return (
      <Card className="border border-glass bg-glass/5 rounded-3xl p-8 text-center text-xs font-semibold text-secondary min-h-[300px] flex flex-col justify-center items-center">
        Sem dados históricos suficientes para gerar o gráfico de evolução patrimonial.
        Os dados serão acumulados automaticamente após o processamento diário do backend.
      </Card>
    )
  }

  return (
    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h4 className="text-sm font-black text-primary uppercase tracking-wider">Evolução Histórica</h4>
          <p className="text-[10px] text-secondary font-medium">Histórico diário de fechamentos da carteira</p>
        </div>
        <div className="flex gap-2 bg-glass/10 p-1 rounded-xl self-start">
          <Button
            type="button"
            variant={chartMode === 'equity' ? 'balance' : 'link'}
            onClick={() => setChartMode('equity')}
            className="text-[10px] h-8 px-3 rounded-lg font-black uppercase tracking-wider transition-all"
          >
            Patrimônio
          </Button>
          <Button
            type="button"
            variant={chartMode === 'share' ? 'balance' : 'link'}
            onClick={() => setChartMode('share')}
            className="text-[10px] h-8 px-3 rounded-lg font-black uppercase tracking-wider transition-all"
          >
            Rentabilidade (Cota)
          </Button>
        </div>
      </div>

      <div className="h-[280px] w-full pr-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: 700 }}
              dy={10}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: 700 }}
              tickFormatter={(v) => chartMode === 'equity' ? formatChartYAxisCurrency(v) : formatNumberBR(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              domain={['auto', 'auto']}
              padding={{ top: 20, bottom: 20 }}
              dx={-5}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-glass/95 border border-glass rounded-2xl p-3 shadow-lg flex flex-col gap-1 backdrop-blur-md">
                      <span className="text-[9px] uppercase font-black text-secondary">{data.fullDate}</span>
                      <span className="text-xs font-black text-primary font-mono">
                        {chartMode === 'equity' ? formatCurrency(data.value) : `Cota: ${formatNumberBR(data.value, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`}
                      </span>
                    </div>
                  )
                }
                return null
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-primary)"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorValue)"
              activeDot={{ r: 5, stroke: 'var(--color-primary)', strokeWidth: 2, fill: 'var(--color-bg-primary)' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
