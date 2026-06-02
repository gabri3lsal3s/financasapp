import type { PortfolioPeriodSnapshotRow, PortfolioShareDailyRow } from '@/types'
import { sumPortfolioTransactionsForMonth } from '@/utils/portfolioMonthlyFlow'
import type { PortfolioTransaction } from '@/types'

export function monthReturnFromShares(
  cotaFechamento: number,
  cotaFechamentoAnterior: number
): number {
  if (cotaFechamentoAnterior <= 0) return 0
  return Math.round((cotaFechamento / cotaFechamentoAnterior - 1) * 1000000) / 1000000
}

export function yearReturnFromShares(
  cotaFechamentoAno: number,
  cotaFechamentoAnoAnterior: number
): number {
  return monthReturnFromShares(cotaFechamentoAno, cotaFechamentoAnoAnterior)
}

export function buildMonthlyShareSeries(
  dailyRows: PortfolioShareDailyRow[]
): Record<string, number> {
  const monthly: Record<string, number> = {}
  const sorted = [...dailyRows].sort((a, b) => a.rate_date.localeCompare(b.rate_date))
  for (const row of sorted) {
    const monthKey = row.rate_date.slice(0, 7)
    monthly[monthKey] = row.share_value
  }
  return monthly
}

export interface PeriodSnapshotDraft {
  period_type: 'month' | 'year'
  period_key: string
  cota_abertura: number
  cota_fechamento: number
  somatorio_aportes: number
  somatorio_resgates: number
  dividendos_recebidos: number
  drawdown_maximo: number
  period_return: number
}

export function buildMonthEndSnapshot(
  portfolioId: string,
  monthKey: string,
  monthlyCotas: Record<string, number>,
  transactions: PortfolioTransaction[],
  dividendsTotal: number
): Omit<PortfolioPeriodSnapshotRow, 'id' | 'created_at'> {
  const prevMonth = previousMonthKey(monthKey)
  const cotaAbertura = monthlyCotas[prevMonth] ?? monthlyCotas[monthKey] ?? 1
  const cotaFechamento = monthlyCotas[monthKey] ?? cotaAbertura
  const flows = sumPortfolioTransactionsForMonth(transactions, monthKey)
  const aportes = flows > 0 ? flows : 0
  const resgates = flows < 0 ? Math.abs(flows) : 0

  return {
    portfolio_id: portfolioId,
    period_type: 'month',
    period_key: monthKey,
    cota_abertura: cotaAbertura,
    cota_fechamento: cotaFechamento,
    somatorio_aportes: Math.round(aportes * 100) / 100,
    somatorio_resgates: Math.round(resgates * 100) / 100,
    dividendos_recebidos: Math.round(dividendsTotal * 100) / 100,
    drawdown_maximo: 0,
    period_return: monthReturnFromShares(cotaFechamento, cotaAbertura),
  }
}

function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function heatmapFromSnapshots(
  snapshots: PortfolioPeriodSnapshotRow[]
): { years: string[]; grid: Record<string, Record<string, number | null>> } {
  const monthly = snapshots.filter((s) => s.period_type === 'month')
  const years = Array.from(new Set(monthly.map((s) => s.period_key.slice(0, 4)))).sort()
  const grid: Record<string, Record<string, number | null>> = {}

  for (const year of years) {
    grid[year] = {}
    for (let m = 1; m <= 12; m++) {
      const key = `${year}-${String(m).padStart(2, '0')}`
      const snap = monthly.find((s) => s.period_key === key)
      grid[year][String(m)] =
        snap?.period_return != null ? Math.round(snap.period_return * 10000) / 100 : null
    }
  }

  return { years, grid }
}
