import type { PortfolioShareDailyRow } from '@/types'

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
