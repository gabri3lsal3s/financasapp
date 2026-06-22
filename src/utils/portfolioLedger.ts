import type { PortfolioTransaction } from '@/types'
import { isPortfolioIncomeType, sortTransactionsStably } from '@/utils/portfolioOperations'

export interface PositionLedgerEntry {
  quantity: number
  totalCost: number
  accumulatedDividends: number
}

export type PositionLedgerMap = Record<string, PositionLedgerEntry>

function emptyEntry(): PositionLedgerEntry {
  return { quantity: 0, totalCost: 0, accumulatedDividends: 0 }
}

function ensureTicker(map: PositionLedgerMap, ticker: string): PositionLedgerEntry {
  const key = ticker.toUpperCase().trim()
  if (!map[key]) {
    map[key] = emptyEntry()
  }
  return map[key]
}

/**
 * Aplica uma transação ao ledger de posição.
 * Desdobro (split): quantity = cotas creditadas (soma).
 * Grupamento (reverse_split): quantity = cotas canceladas (subtrai).
 */
export function applyPortfolioTransaction(
  pos: PositionLedgerEntry,
  tx: Pick<PortfolioTransaction, 'operation_type' | 'quantity' | 'price'>,
  isCash?: boolean
): void {
  const qty = Number(tx.quantity)
  const price = Number(tx.price)

  if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
    if (isCash) {
      pos.totalCost += qty * price
      pos.quantity = pos.totalCost
    } else {
      pos.quantity += qty
      pos.totalCost += qty * price
    }
    return
  }

  if (tx.operation_type === 'sell') {
    if (isCash) {
      pos.totalCost = Math.max(0, pos.totalCost - qty * price)
      pos.quantity = pos.totalCost
    } else if (pos.quantity > 0) {
      const avg = pos.totalCost / pos.quantity
      pos.quantity = Math.max(0, pos.quantity - qty)
      pos.totalCost = pos.quantity * avg
    }
    return
  }

  if (isPortfolioIncomeType(tx.operation_type)) {
    pos.accumulatedDividends += qty * price
    return
  }

  if (tx.operation_type === 'split') {
    if (!isCash) pos.quantity += qty
    return
  }

  if (tx.operation_type === 'reverse_split') {
    if (!isCash) pos.quantity = Math.max(0, pos.quantity - qty)
    return
  }
}

export function buildPortfolioLedger(
  transactions: PortfolioTransaction[],
  cashTickers?: Set<string>
): PositionLedgerMap {
  const map: PositionLedgerMap = {}
  const sorted = sortTransactionsStably(transactions)

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase().trim()
    const pos = ensureTicker(map, ticker)
    const isCash = ['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(ticker) || cashTickers?.has(ticker)
    applyPortfolioTransaction(pos, tx, isCash)
  }

  return map
}

/** Ledger simplificado (sem proventos/custo) para preview de caixa. */
export interface SimplePositionLedgerEntry {
  quantity: number
  totalCost: number
}

export function buildSimplePositionLedger(
  transactions: PortfolioTransaction[],
  cashTickers?: Set<string>
): Record<string, SimplePositionLedgerEntry> {
  const map: Record<string, SimplePositionLedgerEntry> = {}
  const sorted = sortTransactionsStably(transactions)

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase().trim()
    if (!map[ticker]) {
      map[ticker] = { quantity: 0, totalCost: 0 }
    }
    const pos = map[ticker]
    const qty = Number(tx.quantity)
    const price = Number(tx.price)
    const isCash = ['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(ticker) || cashTickers?.has(ticker)

    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      if (isCash) {
        pos.totalCost += qty * price
        pos.quantity = pos.totalCost
      } else {
        pos.quantity += qty
        pos.totalCost += qty * price
      }
    } else if (tx.operation_type === 'sell') {
      if (isCash) {
        pos.totalCost = Math.max(0, pos.totalCost - qty * price)
        pos.quantity = pos.totalCost
      } else if (pos.quantity > 0) {
        const avg = pos.totalCost / pos.quantity
        pos.quantity = Math.max(0, pos.quantity - qty)
        pos.totalCost = pos.quantity * avg
      }
    } else if (isPortfolioIncomeType(tx.operation_type)) {
      // Proventos não alteram o custo de aquisição do ativo
    } else if (tx.operation_type === 'split') {
      if (!isCash) pos.quantity += qty
    } else if (tx.operation_type === 'reverse_split') {
      if (!isCash) pos.quantity = Math.max(0, pos.quantity - qty)
    }
  }

  return map
}

/** Quantidade final de um ticker a partir de transações ordenadas. */
export function computeTickerQuantity(
  transactions: PortfolioTransaction[],
  ticker: string
): number {
  const upper = ticker.toUpperCase().trim()
  const filtered = transactions.filter((t) => t.ticker.toUpperCase().trim() === upper)
  const ledger = buildPortfolioLedger(filtered)
  return ledger[upper]?.quantity ?? 0
}
