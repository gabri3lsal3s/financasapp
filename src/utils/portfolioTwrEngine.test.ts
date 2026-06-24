import { describe, it, expect } from 'vitest'
import {
  iterateDateRange,
  adjustTransactionsForSplits,
  calculateSnapshotValuation,
  computeDailyShareHistory,
  needsHistoricalBackfill,
} from './portfolioTwrEngine'
import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function tx(
  overrides: Partial<PortfolioTransaction> &
    Pick<PortfolioTransaction, 'ticker' | 'operation_type' | 'quantity' | 'date'>
): PortfolioTransaction {
  return {
    id: 'test-id',
    portfolio_id: 'port-1',
    price: 0,
    created_at: '',
    ...overrides,
  }
}

function def(overrides: Partial<PortfolioAssetDefinition> & Pick<PortfolioAssetDefinition, 'ticker'>): PortfolioAssetDefinition {
  return {
    id: 'def-id',
    portfolio_id: 'port-1',
    pricing_mode: 'market',
    is_b3_linked: false,
    applied_amount: null,
    contract_rate: null,
    indexer: 'none',
    indexer_percent: 100,
    maturity_date: null,
    application_date: null,
    manual_current_value: null,
    manual_value_updated_at: null,
    tax_exempt: false,
    is_treasury: false,
    currency: 'BRL',
    created_at: '',
    updated_at: '',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// iterateDateRange
// ---------------------------------------------------------------------------
describe('iterateDateRange', () => {
  it('returns inclusive range of dates', () => {
    const dates = iterateDateRange('2026-06-01', '2026-06-03')
    expect(dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
  })

  it('returns single date when start equals end', () => {
    expect(iterateDateRange('2026-06-01', '2026-06-01')).toEqual(['2026-06-01'])
  })

  it('crosses month boundaries correctly', () => {
    const dates = iterateDateRange('2026-01-31', '2026-02-02')
    expect(dates).toHaveLength(3)
    expect(dates[0]).toBe('2026-01-31')
    expect(dates[1]).toBe('2026-02-01')
    expect(dates[2]).toBe('2026-02-02')
  })
})

// ---------------------------------------------------------------------------
// adjustTransactionsForSplits
// ---------------------------------------------------------------------------
describe('adjustTransactionsForSplits', () => {
  it('returns same transactions when no splits exist', () => {
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 50 }),
      tx({ date: '2026-06-02', ticker: 'WEGE3', operation_type: 'sell', quantity: 5, price: 55 }),
    ]
    const adjusted = adjustTransactionsForSplits(txs)
    expect(adjusted).toHaveLength(2)
    expect(adjusted[0].quantity).toBe(10)
    expect(adjusted[0].price).toBe(50)
    expect(adjusted[1].quantity).toBe(5)
    expect(adjusted[1].price).toBe(55)
  })

  it('adjusts quantities and prices retroactively for a split 1:10', () => {
    // Split 1:10 where we had 10 shares at 50 = 500 invested
    // After split: we have 100 shares (10 + 90 added), price should be 5
    // Note: adjustTransactionsForSplits REMOVES the split/reverse_split events
    // and only adjusts the regular transactions retroactively.
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 50 }),
      tx({ date: '2026-06-03', ticker: 'WEGE3', operation_type: 'split', quantity: 90, price: 0 }),
    ]
    const adjusted = adjustTransactionsForSplits(txs)
    // Only the buy survives (split is consumed in the adjustment)
    expect(adjusted).toHaveLength(1)
    // Buy before split: quantity multiplied by 10 (100), price divided by 10 (5)
    expect(adjusted[0].quantity).toBeCloseTo(100, 4)
    expect(adjusted[0].price).toBeCloseTo(5, 4)
    // Principal preserved: 100 * 5 = 500 ✓
  })

  it('adjusts retroactively for reverse split', () => {
    // Had 100 shares at 30 = 3000 invested
    // Reverse split: cancel 90 shares, leaving 10
    // Note: adjustTransactionsForSplits REMOVES the split/reverse_split events.
    const txs = [
      tx({ date: '2026-06-01', ticker: 'PETR4', operation_type: 'buy', quantity: 100, price: 30 }),
      tx({ date: '2026-06-03', ticker: 'PETR4', operation_type: 'reverse_split', quantity: 90, price: 0 }),
    ]
    const adjusted = adjustTransactionsForSplits(txs)
    // Only the buy survives (reverse_split is consumed)
    expect(adjusted).toHaveLength(1)
    // qtyMultiplier = (100 - 90) / 100 = 0.1
    // buy quantity = 100 * 0.1 = 10
    // buy price = 30 / 0.1 = 300
    expect(adjusted[0].quantity).toBeCloseTo(10, 4)
    expect(adjusted[0].price).toBeCloseTo(300, 4)
    // Principal preserved: 10 * 300 = 3000 ✓
  })

  it('handles multiple splits correctly', () => {
    // Split 1:10 (add 90), then split 1:2 (add 100 more)
    // Starting with 10 shares
    // After first split: 100 shares
    // After second split: 200 shares
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 100 }),
      tx({ date: '2026-06-03', ticker: 'WEGE3', operation_type: 'split', quantity: 90, price: 0 }),
      tx({ date: '2026-06-10', ticker: 'WEGE3', operation_type: 'split', quantity: 100, price: 0 }),
    ]
    const adjusted = adjustTransactionsForSplits(txs)
    const buyTx = adjusted.find(t => t.operation_type === 'buy')
    expect(buyTx).toBeDefined()
    // qtyMultiplier = (10+90)/10 * (100+100)/100 = 10 * 2 = 20
    // buy quantity = 10 * 20 = 200
    // buy price = 100 / 20 = 5
    expect(buyTx!.quantity).toBeCloseTo(200, 4)
    expect(buyTx!.price).toBeCloseTo(5, 4)
    // Principal preserved: 200 * 5 = 1000 ✓
  })

  it('does not affect other tickers when a split occurs', () => {
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 50 }),
      tx({ date: '2026-06-01', ticker: 'PETR4', operation_type: 'buy', quantity: 20, price: 30 }),
      tx({ date: '2026-06-03', ticker: 'WEGE3', operation_type: 'split', quantity: 90, price: 0 }),
    ]
    const adjusted = adjustTransactionsForSplits(txs)
    const petrTx = adjusted.find(t => t.ticker === 'PETR4')
    const wegeTx = adjusted.find(t => t.ticker === 'WEGE3' && t.operation_type === 'buy')
    // PETR4 should be unaffected
    expect(petrTx?.quantity).toBe(20)
    expect(petrTx?.price).toBe(30)
    // WEGE3 should be adjusted
    expect(wegeTx?.quantity).toBeCloseTo(100, 4)
    expect(wegeTx?.price).toBeCloseTo(5, 4)
  })

  it('handles split followed by sell correctly', () => {
    // Split 1:10 happens on June 3, sell on June 5.
    // adjustTransactionsForSplits processes in REVERSE chronological order.
    // The sell (after split) is processed FIRST with multiplier = 1.0 → NOT adjusted.
    // The split is processed next → multiplies multiplier by 10.
    // The buy (before split) is processed LAST → adjusted by multiplier 10.
    // The split event itself is REMOVED from output.
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 50 }),
      tx({ date: '2026-06-03', ticker: 'WEGE3', operation_type: 'split', quantity: 90, price: 0 }),
      tx({ date: '2026-06-05', ticker: 'WEGE3', operation_type: 'sell', quantity: 50, price: 6 }),
    ]
    const adjusted = adjustTransactionsForSplits(txs)
    // Split is consumed: buy + sell remain
    expect(adjusted).toHaveLength(2)
    const buyTx = adjusted.find(t => t.operation_type === 'buy')
    const sellTx = adjusted.find(t => t.operation_type === 'sell')
    // Buy (before split): adjusted by multiplier
    expect(buyTx!.quantity).toBeCloseTo(100, 4)
    expect(buyTx!.price).toBeCloseTo(5, 4)
    // Sell (after split): NOT adjusted because multiplier was 1.0 when processed
    expect(sellTx!.quantity).toBeCloseTo(50, 4)
    expect(sellTx!.price).toBeCloseTo(6, 4)
    // Proceeds: 50 * 6 = 300 ✓
  })
})

// ---------------------------------------------------------------------------
// calculateSnapshotValuation
// ---------------------------------------------------------------------------
describe('calculateSnapshotValuation', () => {
  it('values market asset with historical prices', () => {
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 40 }),
    ]
    const defs = [def({ ticker: 'WEGE3', pricing_mode: 'market' })]
    const priceMap = { WEGE3: { '2026-06-01': 40, '2026-06-02': 45 } }
    const pricesToday = { WEGE3: 50 }

    const result = calculateSnapshotValuation(txs, defs, priceMap, pricesToday, {}, {}, '2026-06-01')
    expect(result.investedValue).toBeCloseTo(400, 4) // 10 * 40
    expect(result.cashValue).toBe(0)
    expect(result.totalValue).toBeCloseTo(400, 4)
    expect(result.investedCostBasis).toBeCloseTo(400, 4)
  })

  it('uses fallback to last known price when exact date missing', () => {
    const txs = [
      tx({ date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 40 }),
    ]
    const defs = [def({ ticker: 'WEGE3', pricing_mode: 'market' })]
    // Only have price for June 1, asking for June 5 should use that (last known before)
    const priceMap = { WEGE3: { '2026-06-01': 40 } }
    const pricesToday = { WEGE3: 50 }

    const result = calculateSnapshotValuation(txs, defs, priceMap, pricesToday, {}, {}, '2026-06-05')
    expect(result.investedValue).toBeCloseTo(400, 4) // 10 * 40 (uses June 1 price)
  })
})

// ---------------------------------------------------------------------------
// computeDailyShareHistory
// ---------------------------------------------------------------------------
describe('computeDailyShareHistory', () => {
  it('maintains stable share value when only cash is deposited and no price change', () => {
    const txs = [
      tx({ id: 'tx-cash', date: '2026-06-01', ticker: 'CAIXA', operation_type: 'buy', quantity: 1, price: 1000 }),
    ]
    const defs = [def({ ticker: 'CAIXA', pricing_mode: 'cash' })]

    const result = computeDailyShareHistory({
      portfolioId: 'port-1',
      transactions: txs,
      definitions: defs,
      priceMap: {},
      pricesToday: {},
      indexRates: {},
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    })

    expect(result.dailyRows).toHaveLength(3)
    // Share value should be 1.0 every day (no investment, just cash)
    for (const row of result.dailyRows) {
      expect(row.share_value).toBeCloseTo(1.0, 4)
    }
    expect(result.totalShares).toBeCloseTo(1000, 4)
  })

  it('tracks share value change when asset price changes', () => {
    const txs = [
      tx({ id: 'tx-cash', date: '2026-06-01', ticker: 'CAIXA', operation_type: 'buy', quantity: 1, price: 1000 }),
      tx({ id: 'tx-buy', date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 50 }),
      tx({ id: 'tx-cash-sell', date: '2026-06-01', ticker: 'CAIXA', operation_type: 'sell', quantity: 0.5, price: 1000 }),
    ]
    const defs = [
      def({ ticker: 'CAIXA', pricing_mode: 'cash' }),
      def({ ticker: 'WEGE3', pricing_mode: 'market' }),
    ]
    const priceMap = {
      WEGE3: {
        '2026-06-01': 50,
        '2026-06-02': 50,
        '2026-06-03': 55,
      },
    }
    const pricesToday = { WEGE3: 55 }

    const result = computeDailyShareHistory({
      portfolioId: 'port-1',
      transactions: txs,
      definitions: defs,
      priceMap,
      pricesToday,
      indexRates: {},
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    })

    expect(result.dailyRows).toHaveLength(3)

    // Day 1: 500 cash + (10*50=500) = 1000 total → share = 1.0
    expect(result.dailyRows[0].share_value).toBeCloseTo(1.0, 4)
    // Day 2: still 500 cash + 500 = 1000 → share = 1.0
    expect(result.dailyRows[1].share_value).toBeCloseTo(1.0, 4)
    // Day 3: 500 cash + (10*55=550) = 1050 → share = 1050/1000 = 1.05
    expect(result.dailyRows[2].share_value).toBeCloseTo(1.05, 4)
  })

  it('generates monthly period snapshots with accumulated cash flows', () => {
    const txs = [
      tx({ id: 'tx-cash', date: '2026-06-01', ticker: 'CAIXA', operation_type: 'buy', quantity: 1, price: 1000 }),
      tx({ id: 'tx-buy', date: '2026-06-01', ticker: 'CAIXA', operation_type: 'buy', quantity: 1, price: 500 }),
    ]
    const defs = [def({ ticker: 'CAIXA', pricing_mode: 'cash' })]

    const result = computeDailyShareHistory({
      portfolioId: 'port-1',
      transactions: txs,
      definitions: defs,
      priceMap: {},
      pricesToday: {},
      indexRates: {},
      startDate: '2026-06-01',
      endDate: '2026-06-30',
    })

    // Should have one snapshot for June
    expect(result.periodSnapshots).toHaveLength(1)
    const snapshot = result.periodSnapshots[0]
    expect(snapshot.period_key).toBe('2026-06')
    // somatorio_aportes = 1000 + 500 = 1500
    expect(snapshot.somatorio_aportes).toBeCloseTo(1500, 4)
    expect(snapshot.somatorio_resgates).toBe(0)
  })

  it('handles split without distorting share value', () => {
    const txs = [
      tx({ id: 'tx-buy', date: '2026-06-01', ticker: 'WEGE3', operation_type: 'buy', quantity: 10, price: 50 }),
      tx({ id: 'tx-split', date: '2026-06-03', ticker: 'WEGE3', operation_type: 'split', quantity: 90, price: 0 }),
    ]
    const defs = [def({ ticker: 'WEGE3', pricing_mode: 'market' })]

    // Price is split-adjusted (already 5.0 even before the split date)
    // because Yahoo Finance provides split-adjusted historical prices
    const priceMap = {
      WEGE3: {
        '2026-06-01': 5.0,
        '2026-06-02': 5.0,
        '2026-06-03': 5.0,
      },
    }
    const pricesToday = { WEGE3: 5.0 }

    const result = computeDailyShareHistory({
      portfolioId: 'port-1',
      transactions: txs,
      definitions: defs,
      priceMap,
      pricesToday,
      indexRates: {},
      startDate: '2026-06-01',
      endDate: '2026-06-03',
    })

    // With split adjustment, share value should be stable at 1.0
    for (const row of result.dailyRows) {
      expect(row.share_value).toBeCloseTo(1.0, 4)
    }
  })
})

// ---------------------------------------------------------------------------
// needsHistoricalBackfill
// ---------------------------------------------------------------------------
describe('needsHistoricalBackfill', () => {
  it('returns true when share history is empty', () => {
    expect(needsHistoricalBackfill([], '2026-06-01', '2026-06-30')).toBe(true)
  })

  it('returns true when only one day stored', () => {
    expect(needsHistoricalBackfill(
      [{ rate_date: '2026-06-30' }],
      '2026-06-01',
      '2026-06-30'
    )).toBe(true)
  })

  it('returns false when history covers most days', () => {
    const history = iterateDateRange('2026-06-01', '2026-06-28').map(d => ({ rate_date: d }))
    expect(needsHistoricalBackfill(history, '2026-06-01', '2026-06-30')).toBe(false)
  })

  it('returns true when first stored date is after first transaction', () => {
    const history = [
      { rate_date: '2026-06-10' },
      { rate_date: '2026-06-11' },
    ]
    expect(needsHistoricalBackfill(history, '2026-06-01', '2026-06-30')).toBe(true)
  })
})
