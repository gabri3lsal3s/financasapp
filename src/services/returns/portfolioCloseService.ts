import { supabase } from '@/lib/supabase'
import {
  computeDailyClose,
  persistDailyClose,
  runDailyClose,
  type DailyCloseInput,
  type DailyCloseResult,
} from '@/services/returns/closePipeline'
import { buildMonthEndSnapshot } from '@/services/returns/periodReturns'
import { sumDividendsForPortfolio } from '@/services/returns/lotValuation'
import type { PortfolioShareDailyRow } from '@/types'

export type { DailyCloseInput, DailyCloseResult }
export { computeDailyClose, runDailyClose, persistDailyClose }

export async function executeAndPersistDailyClose(
  input: DailyCloseInput
): Promise<DailyCloseResult> {
  const result = await runDailyClose(input)
  await persistDailyClose(result)
  return result
}

export async function runMonthEndSnapshots(
  portfolioId: string,
  monthKey: string,
  transactions: DailyCloseInput['transactions']
): Promise<void> {
  const { data: dailyRows } = await supabase
    .from('portfolio_share_daily')
    .select('portfolio_id, rate_date, share_value, gross_pl, net_pl, total_shares')
    .eq('portfolio_id', portfolioId)
    .order('rate_date', { ascending: true })

  const monthlyCotas: Record<string, number> = {}
  for (const row of (dailyRows ?? []) as PortfolioShareDailyRow[]) {
    const mk = row.rate_date.slice(0, 7)
    monthlyCotas[mk] = Number(row.share_value)
  }

  const monthTxs = transactions.filter((t) => t.date?.startsWith(monthKey))
  const dividends = sumDividendsForPortfolio(monthTxs)

  const draft = buildMonthEndSnapshot(
    portfolioId,
    monthKey,
    monthlyCotas,
    transactions,
    dividends
  )

  await supabase.from('portfolio_period_snapshots').upsert(
    {
      portfolio_id: draft.portfolio_id,
      period_type: draft.period_type,
      period_key: draft.period_key,
      cota_abertura: draft.cota_abertura,
      cota_fechamento: draft.cota_fechamento,
      somatorio_aportes: draft.somatorio_aportes,
      somatorio_resgates: draft.somatorio_resgates,
      dividendos_recebidos: draft.dividendos_recebidos,
      drawdown_maximo: draft.drawdown_maximo,
      period_return: draft.period_return,
    },
    { onConflict: 'portfolio_id,period_type,period_key' }
  )
}
