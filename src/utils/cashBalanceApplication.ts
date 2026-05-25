import type { PortfolioAssetDefinition, PortfolioTransaction, PortfolioPricingMode } from '@/types'

interface PositionLedger {
  quantity: number
  totalCost: number
}

export interface CashBalanceSlot {
  ticker: string
  balance: number
  quantity: number
  averageUnit: number
}

export interface CashOffsetPlan {
  cashUsed: number
  netContribution: number
  sellTransactions: Array<{ ticker: string; quantity: number; price: number }>
}

const LEGACY_CASH_TICKERS = new Set(['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'])

export function resolvePricingMode(
  ticker: string,
  definitions: PortfolioAssetDefinition[]
): PortfolioPricingMode {
  const upper = ticker.toUpperCase().trim()
  if (LEGACY_CASH_TICKERS.has(upper)) return 'cash'
  const found = definitions.find((d) => d.ticker.toUpperCase().trim() === upper)
  if (found) return found.pricing_mode
  return 'market'
}

function buildPositionLedger(
  transactions: PortfolioTransaction[]
): Record<string, PositionLedger> {
  const map: Record<string, PositionLedger> = {}
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sorted) {
    const ticker = tx.ticker.toUpperCase().trim()
    if (!map[ticker]) {
      map[ticker] = { quantity: 0, totalCost: 0 }
    }
    const pos = map[ticker]
    const qty = Number(tx.quantity)
    const price = Number(tx.price)

    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      pos.quantity += qty
      pos.totalCost += qty * price
    } else if (tx.operation_type === 'sell') {
      if (pos.quantity > 0) {
        const avg = pos.totalCost / pos.quantity
        pos.quantity = Math.max(0, pos.quantity - qty)
        pos.totalCost = pos.quantity * avg
      }
    } else if (tx.operation_type === 'dividend') {
      pos.totalCost = Math.max(0, pos.totalCost - qty * price)
    } else if (tx.operation_type === 'split') {
      pos.quantity *= qty
    }
  }

  return map
}

/** Lista saldos disponíveis em ativos com pricing_mode cash. */
export function listAvailableCashBalances(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[]
): CashBalanceSlot[] {
  const ledger = buildPositionLedger(transactions)
  const tickers = new Set<string>([
    ...Object.keys(ledger),
    ...definitions.filter((d) => d.pricing_mode === 'cash').map((d) => d.ticker.toUpperCase()),
    ...Array.from(LEGACY_CASH_TICKERS),
  ])

  const slots: CashBalanceSlot[] = []

  for (const ticker of tickers) {
    if (resolvePricingMode(ticker, definitions) !== 'cash') continue
    
    const pos = ledger[ticker.trim()] ?? ledger[ticker] ?? { quantity: 0, totalCost: 0 }
    const def = definitions.find((d) => d.ticker.toUpperCase().trim() === ticker.trim())

    // Resolve o saldo do caixa exatamente como no valuationEngine
    let balance = 0
    if (def && def.applied_amount != null) {
      balance = Number(def.applied_amount)
    } else if (def && def.manual_current_value != null) {
      balance = Number(def.manual_current_value)
    } else {
      balance = pos.totalCost
    }

    if (balance <= 0) continue

    const qty = pos.quantity > 0 ? pos.quantity : 1
    const averageUnit = balance / qty

    slots.push({
      ticker,
      balance: Math.round(balance * 100) / 100,
      quantity: qty,
      averageUnit: Math.round(averageUnit * 10000) / 10000,
    })
  }

  return slots.sort((a, b) => a.ticker.localeCompare(b.ticker))
}

/** Distribui o uso de caixa entre tickers (ordem alfabética) e gera vendas proporcionais. */
export function planCashOffsetForPurchase(
  purchaseAmount: number,
  cashSlots: CashBalanceSlot[]
): CashOffsetPlan {
  if (purchaseAmount <= 0 || cashSlots.length === 0) {
    return { cashUsed: 0, netContribution: purchaseAmount, sellTransactions: [] }
  }

  let remaining = purchaseAmount
  let cashUsed = 0
  const sellTransactions: CashOffsetPlan['sellTransactions'] = []

  for (const slot of cashSlots) {
    if (remaining <= 0) break
    if (slot.balance <= 0) continue

    const useAmount = Math.min(remaining, slot.balance)
    const sellQty = slot.averageUnit > 0 ? useAmount / slot.averageUnit : 0
    if (sellQty <= 0) continue

    sellTransactions.push({
      ticker: slot.ticker,
      quantity: Math.round(sellQty * 1000000) / 1000000,
      price: slot.averageUnit,
    })

    cashUsed += useAmount
    remaining -= useAmount
  }

  cashUsed = Math.round(cashUsed * 100) / 100

  return {
    cashUsed,
    netContribution: Math.round((purchaseAmount - cashUsed) * 100) / 100,
    sellTransactions,
  }
}

export function shouldApplyCashOffset(
  operationType: PortfolioTransaction['operation_type'],
  assetPricingMode: PortfolioPricingMode
): boolean {
  return (
    (operationType === 'buy' || operationType === 'subscription') &&
    assetPricingMode !== 'cash'
  )
}

/** Remove vendas de caixa geradas automaticamente para recalcular saldo disponível. */
export function excludeCashOffsetSells(
  transactions: PortfolioTransaction[],
  sourceBuyId?: string | null
): PortfolioTransaction[] {
  if (!sourceBuyId) return transactions
  return transactions.filter((tx) => tx.cash_offset_source_id !== sourceBuyId)
}

export function computeCashOffsetPreview(
  purchaseAmount: number,
  operationType: PortfolioTransaction['operation_type'],
  assetPricingMode: PortfolioPricingMode,
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[]
): CashOffsetPlan & { availableCash: number } {
  if (!shouldApplyCashOffset(operationType, assetPricingMode)) {
    return {
      availableCash: 0,
      cashUsed: 0,
      netContribution: purchaseAmount,
      sellTransactions: [],
    }
  }

  const slots = listAvailableCashBalances(transactions, definitions)
  const availableCash = Math.round(slots.reduce((sum, s) => sum + s.balance, 0) * 100) / 100
  const plan = planCashOffsetForPurchase(purchaseAmount, slots)

  return { ...plan, availableCash }
}

export function getPreferredCashTicker(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[]
): string {
  const cashDef = definitions.find((d) => d.pricing_mode === 'cash')
  if (cashDef) return cashDef.ticker.toUpperCase()

  const cashTx = [...transactions]
    .reverse()
    .find((tx) => tx.ticker === 'CAIXA' || tx.ticker === 'SALDO_INV' || tx.ticker === 'SALDO EM CAIXA' || tx.ticker === 'SALDO_EM_CAIXA')
  if (cashTx) return cashTx.ticker.toUpperCase()

  return 'CAIXA'
}

export function calculateLedgerCashBalance(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[]
): number {
  const slots = listAvailableCashBalances(transactions, definitions)
  return slots.reduce((sum, s) => sum + s.balance, 0)
}

