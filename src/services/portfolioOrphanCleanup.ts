import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

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

  // Batch check remaining tickers to avoid URI size issues
  const stillUsed = new Set<string>()
  const batchSize = 100
  for (let i = 0; i < normalized.length; i += batchSize) {
    const batch = normalized.slice(i, i + batchSize)
    const { data: remainingRows, error: remainingError } = await supabase
      .from('portfolio_transactions')
      .select('ticker')
      .eq('portfolio_id', portfolioId)
      .in('ticker', batch)

    if (remainingError) throw remainingError

    if (remainingRows) {
      for (const row of remainingRows) {
        if (row.ticker) {
          stillUsed.add(String(row.ticker).trim().toUpperCase())
        }
      }
    }
  }

  const orphanTickers = normalized.filter((ticker) => !stillUsed.has(ticker))

  if (orphanTickers.length === 0) return 0

  // Batch delete orphan tickers definitions and target allocations
  for (let i = 0; i < orphanTickers.length; i += batchSize) {
    const batch = orphanTickers.slice(i, i + batchSize)
    const [defsResult, targetsResult] = await Promise.all([
      supabase
        .from('portfolio_asset_definitions')
        .delete()
        .eq('portfolio_id', portfolioId)
        .in('ticker', batch),
      supabase
        .from('target_allocations')
        .delete()
        .eq('portfolio_id', portfolioId)
        .in('ticker', batch),
    ])

    if (defsResult.error) throw defsResult.error
    if (targetsResult.error) throw targetsResult.error
  }

  // Clean up unused tickers' prices globally if not used by any other transactions in the database
  for (const ticker of orphanTickers) {
    try {
      const { data: remainingGlobal, error: globalErr } = await supabase
        .from('portfolio_transactions')
        .select('id')
        .eq('ticker', ticker)
        .limit(1)

      if (!globalErr && (!remainingGlobal || remainingGlobal.length === 0)) {
        await Promise.all([
          supabase.from('asset_price_daily').delete().eq('ticker', ticker),
          supabase.from('asset_prices').delete().eq('ticker', ticker)
        ])
        logger.debug(`[cleanupOrphan] Deleted global prices and daily history for unused ticker: ${ticker}`)
      }
    } catch (err) {
      console.warn(`[cleanupOrphan] Error checking or deleting global prices for ticker ${ticker}:`, err)
    }
  }

  return orphanTickers.length
}
