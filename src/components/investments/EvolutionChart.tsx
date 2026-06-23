import { useState, useMemo } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import InfoTooltip from '@/components/InfoTooltip'
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
    return shareHistory.map((h) => {
      const grossPL = Number(h.gross_pl)
      const investedPL = Number(h.gross_pl) - Number(h.net_pl)
      const yieldPercent = (Number(h.share_value) - 1.0) * 100
      const fullDate = h.rate_date

      return {
        date: `${fullDate.slice(8, 10)}/${fullDate.slice(5, 7)}/${fullDate.slice(0, 4)}`,
        fullDate,
        grossPL,
        investedPL,
        yieldPercent,
        value: chartMode === 'equity' ? grossPL : yieldPercent
      }
    })
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
          <div className="flex items-center gap-1.5">
            <h4 className="text-sm font-black text-primary uppercase tracking-wider">Evolução Histórica</h4>
            <InfoTooltip
              content="A rentabilidade (cota) é calculada pelo método TWR (Time Weighted Return), medindo o retorno da carteira investida de forma isolada, desconsiderando entradas e saídas de saldo em caixa da corretora. O valor inicial da cota é base 1.00 (0.00%)."
              placement="left"
            />
          </div>
          <p className="text-[10px] text-secondary font-medium flex items-center flex-wrap gap-x-3 gap-y-1">
            <span>Histórico diário de fechamentos da carteira</span>
            {chartMode === 'equity' && (
              <span className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 h-0.5 bg-[var(--color-primary)] rounded" />
                  <span className="text-[9px] font-semibold text-secondary uppercase tracking-wider">Bruto</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-5 border-t-2 border-dashed border-[var(--color-text-secondary)] h-0" />
                  <span className="text-[9px] font-semibold text-secondary uppercase tracking-wider">Investido</span>
                </span>
              </span>
            )}
          </p>
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
        <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
            <XAxis
              dataKey="fullDate"
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: 700 }}
              tickFormatter={(value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`}
              dy={10}
              minTickGap={24}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 9, fontWeight: 700 }}
              tickFormatter={(v) => chartMode === 'equity' ? formatChartYAxisCurrency(v) : `${v >= 0 ? '+' : ''}${formatNumberBR(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`}
              domain={['auto', 'auto']}
              padding={{ top: 20, bottom: 20 }}
              dx={-5}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div className="bg-glass/95 border border-glass rounded-2xl p-3 shadow-lg flex flex-col gap-1.5 backdrop-blur-md min-w-[160px]">
                      <span className="text-[9px] uppercase font-black text-secondary">{data.fullDate}</span>
                      {chartMode === 'equity' ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)]" />
                              <span className="text-[10px] font-bold text-secondary">Bruto:</span>
                            </div>
                            <span className="text-xs font-black text-primary font-mono">
                              {formatCurrency(data.grossPL)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full border border-dashed border-[var(--color-text-secondary)] bg-transparent" />
                              <span className="text-[10px] font-bold text-secondary">Investido:</span>
                            </div>
                            <span className="text-xs font-black text-secondary font-mono">
                              {formatCurrency(data.investedPL)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs font-black text-primary font-mono">
                          Rentabilidade: {data.yieldPercent >= 0 ? '+' : ''}{formatNumberBR(data.yieldPercent, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                        </span>
                      )}
                    </div>
                  )
                }
                return null
              }}
            />
            {chartMode === 'equity' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="grossPL"
                  stroke="var(--color-primary)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                  activeDot={{ r: 5, stroke: 'var(--color-primary)', strokeWidth: 2, fill: 'var(--color-bg-primary)' }}
                />
                <Area
                  type="monotone"
                  dataKey="investedPL"
                  stroke="var(--color-text-secondary)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                  activeDot={{ r: 4, stroke: 'var(--color-text-secondary)', strokeWidth: 1.5, fill: 'var(--color-bg-primary)' }}
                />
              </>
            ) : (
              <Area
                type="monotone"
                dataKey="yieldPercent"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorValue)"
                activeDot={{ r: 5, stroke: 'var(--color-primary)', strokeWidth: 2, fill: 'var(--color-bg-primary)' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
