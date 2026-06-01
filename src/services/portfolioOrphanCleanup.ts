import { supabase } from '@/lib/supabase'

/**
 * Remove definições e metas de tickers que não possuem mais transações no livro-razão.
 * Usa consultas em lote (evita N+1 por ticker).
 */
export async function cleanupOrphanPortfolioTickers(
  portfolioId: string,
  tickersToCheck: string[]
): Promise<number> {
  const normalized = Array.from(
    new Set(
      tickersToCheck
        .map((t) => String(t || '').trim().toUpperCase())
        .filter(Boolean)
    )
  )

  if (normalized.length === 0) return 0

  const { data: remainingRows, error: remainingError } = await supabase
    .from('portfolio_transactions')
    .select('ticker')
    .eq('portfolio_id', portfolioId)
    .in('ticker', normalized)

  if (remainingError) throw remainingError

  const stillUsed = new Set(
    (remainingRows ?? []).map((row) => String(row.ticker || '').trim().toUpperCase())
  )
  const orphanTickers = normalized.filter((ticker) => !stillUsed.has(ticker))

  if (orphanTickers.length === 0) return 0

  const [defsResult, targetsResult] = await Promise.all([
    supabase
      .from('portfolio_asset_definitions')
      .delete()
      .eq('portfolio_id', portfolioId)
      .in('ticker', orphanTickers),
    supabase
      .from('target_allocations')
      .delete()
      .eq('portfolio_id', portfolioId)
      .in('ticker', orphanTickers),
  ])

  if (defsResult.error) throw defsResult.error
  if (targetsResult.error) throw targetsResult.error

  return orphanTickers.length
}
