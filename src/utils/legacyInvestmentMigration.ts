import type { SupabaseClient } from '@supabase/supabase-js'
import type { PortfolioTransaction } from '@/types'

export interface LegacyInvestmentRow {
  id: string
  month: string
  amount: number
  ticker?: string | null
  quantity?: number | null
  price?: number | null
  created_at: string
  transaction_id?: string | null
}

export function legacyInvestmentDate(inv: LegacyInvestmentRow): string {
  return inv.month ? `${inv.month}-01` : new Date(inv.created_at).toISOString().split('T')[0]
}

export function isLegacyAssetInvestment(inv: LegacyInvestmentRow): boolean {
  return !!(
    inv.ticker &&
    inv.quantity != null &&
    inv.price != null &&
    Number(inv.quantity) > 0 &&
    Number(inv.price) > 0
  )
}

/** Evita duplicar transação quando o investimento legado perdeu o vínculo (ON DELETE SET NULL). */
export function findMatchingLegacyTransaction(
  inv: LegacyInvestmentRow,
  existingTransactions: PortfolioTransaction[]
): PortfolioTransaction | undefined {
  const dateStr = legacyInvestmentDate(inv)
  const hasAsset = isLegacyAssetInvestment(inv)

  if (hasAsset) {
    const tickerUpper = String(inv.ticker).toUpperCase().trim()
    return existingTransactions.find(
      (tx) =>
        tx.ticker === tickerUpper &&
        tx.date === dateStr &&
        Math.abs(Number(tx.quantity) - Number(inv.quantity!)) < 0.000001 &&
        Math.abs(Number(tx.price) - Number(inv.price!)) < 0.0001
    )
  }

  return existingTransactions.find(
    (tx) =>
      tx.ticker === 'SALDO_INV' &&
      tx.date === dateStr &&
      Number(tx.quantity) === 1 &&
      Math.abs(Number(tx.price) - Number(inv.amount)) < 0.01
  )
}

export function buildLegacyTransactionPayload(
  inv: LegacyInvestmentRow,
  portfolioId: string,
  txId: string
): Omit<PortfolioTransaction, 'created_at'> {
  const dateStr = legacyInvestmentDate(inv)
  const hasAsset = isLegacyAssetInvestment(inv)

  return {
    id: txId,
    portfolio_id: portfolioId,
    ticker: hasAsset ? String(inv.ticker).toUpperCase().trim() : 'SALDO_INV',
    operation_type: 'buy',
    quantity: hasAsset ? Number(inv.quantity) : 1,
    price: hasAsset ? Number(inv.price) : Number(inv.amount),
    date: dateStr,
  }
}

/**
 * Remove investimentos legados antes de excluir a transação.
 * Necessário porque `investments.transaction_id` usa ON DELETE SET NULL e a migração recriaria SALDO_INV.
 */
export async function deleteLegacyInvestmentsForTransaction(
  supabase: SupabaseClient,
  userId: string,
  tx: Pick<PortfolioTransaction, 'id' | 'ticker' | 'date' | 'price'>
): Promise<void> {
  const { error: linkedError } = await supabase
    .from('investments')
    .delete()
    .eq('transaction_id', tx.id)

  if (linkedError) throw linkedError

  if (tx.ticker !== 'SALDO_INV') return

  const monthStr = tx.date.slice(0, 7)
  const { error: orphanError } = await supabase
    .from('investments')
    .delete()
    .eq('user_id', userId)
    .eq('month', monthStr)
    .is('ticker', null)
    .eq('amount', Number(tx.price))

  if (orphanError) throw orphanError
}
