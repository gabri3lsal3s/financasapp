import Card from '@/components/Card'
import { BarChart3 } from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import { formatCurrency } from '@/utils/format'
import type { PortfolioPeriodSnapshotRow } from '@/types'

interface OrganicVsContributionsChartProps {
  snapshots: PortfolioPeriodSnapshotRow[]
}

export default function OrganicVsContributionsChart({ snapshots }: OrganicVsContributionsChartProps) {
  const monthly = snapshots
    .filter((s) => s.period_type === 'month')
    .sort((a, b) => a.period_key.localeCompare(b.period_key))
    .slice(-12)

  const chartData = monthly.map((s) => {
    const netFlows = Number(s.somatorio_aportes) - Number(s.somatorio_resgates)
    const organic =
      (Number(s.cota_fechamento) - Number(s.cota_abertura)) * Number(s.cota_abertura) > 0
        ? Math.max(
            0,
            (s.cota_fechamento / s.cota_abertura - 1) * (netFlows + 10000) - netFlows
          )
        : 0
    return {
      month: s.period_key.slice(5, 7) + '/' + s.period_key.slice(2, 4),
      aportesLiquidos: Math.round(netFlows * 100) / 100,
      rendimentoMercado: Math.round(organic * 100) / 100,
    }
  })

  return (
    <Card className="p-5 border border-border/40 text-left h-full flex flex-col">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <BarChart3 size={16} />
        Poupança vs. rendimento do mercado
      </h3>
      {chartData.length === 0 ? (
        <p className="text-xs text-secondary italic flex-1 flex items-center">
          Sem snapshots mensais ainda.
        </p>
      ) : (
        <div className="h-56 w-full flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={10} />
              <YAxis fontSize={10} tickFormatter={(v) => formatCurrency(Number(v))} width={72} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Legend />
              <Bar
                dataKey="aportesLiquidos"
                name="Dinheiro novo (líquido)"
                stackId="a"
                fill="var(--color-primary)"
              />
              <Bar
                dataKey="rendimentoMercado"
                name="Rendimento (estimado)"
                stackId="a"
                fill="var(--color-income)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  )
}
