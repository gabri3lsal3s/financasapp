import Card from '@/components/Card'
import { Grid3x3 } from 'lucide-react'
import { formatNumberBR, formatSignedPercentBR } from '@/utils/format'
import type { PortfolioPeriodSnapshotRow } from '@/types'
import { heatmapFromSnapshots } from '@/services/returns/periodReturns'

interface ReturnHeatmapProps {
  snapshots: PortfolioPeriodSnapshotRow[]
}

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function cellTone(pct: number | null): string {
  if (pct == null) return 'bg-muted/20 text-secondary'
  if (pct >= 2) return 'bg-emerald-500/25 text-emerald-600'
  if (pct > 0) return 'bg-emerald-500/10 text-emerald-600'
  if (pct <= -2) return 'bg-expense/20 text-expense'
  if (pct < 0) return 'bg-expense/10 text-expense'
  return 'bg-muted/30 text-secondary'
}

export default function ReturnHeatmap({ snapshots }: ReturnHeatmapProps) {
  const { years, grid } = heatmapFromSnapshots(snapshots)

  if (years.length === 0) {
    return (
      <Card className="p-5 border border-border/40 text-left">
        <h3 className="font-bold text-base text-primary mb-2 flex items-center gap-2">
          <Grid3x3 size={16} />
          Matriz de rentabilidade
        </h3>
        <p className="text-xs text-secondary leading-relaxed">
          Ainda não há fechamentos mensais registrados para esta carteira. O assessor pode gerar
          snapshots em Investimentos (fechamento de mês); após isso, os retornos aparecem aqui.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-5 border border-border/40 text-left overflow-x-auto">
      <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
        <Grid3x3 size={16} />
        Matriz de rentabilidade (TWR mensal)
      </h3>
      <table className="w-full text-xs border-collapse min-w-[320px]">
        <thead>
          <tr>
            <th className="p-1 text-left text-secondary font-semibold">Ano</th>
            {MONTH_LABELS.map((m) => (
              <th key={m} className="p-1 text-center text-secondary font-semibold">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year}>
              <td className="p-1 font-mono font-bold text-primary">{year}</td>
              {Array.from({ length: 12 }, (_, i) => {
                const m = String(i + 1)
                const pct = grid[year]?.[m] ?? null
                return (
                  <td key={m} className="p-0.5">
                    <div
                      className={`rounded px-1 py-1.5 text-center font-mono font-semibold ${cellTone(pct)}`}
                      title={pct != null ? formatSignedPercentBR(pct / 100) : '—'}
                    >
                      {pct != null
                        ? `${pct >= 0 ? '+' : ''}${formatNumberBR(pct, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
                        : '—'}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
