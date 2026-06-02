import { describe, it, expect } from 'vitest'
import { computeDailyClose } from '@/services/returns/closePipeline'
import { calculateShareHistory } from '@/services/investmentEngine'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'

const cashDef: PortfolioAssetDefinition = {
  id: 'd1',
  portfolio_id: 'p1',
  ticker: 'CAIXA',
  pricing_mode: 'cash',
  is_b3_linked: false,
  applied_amount: null,
  contract_rate: null,
  indexer: 'none',
  indexer_percent: 100,
  maturity_date: null,
  manual_current_value: null,
  manual_value_updated_at: null,
  tax_exempt: false,
  is_treasury: false,
  application_date: '2026-01-01',
  created_at: '',
  updated_at: '',
  currency: 'BRL',
  valuation_mode: 'market',
}

describe('closePipeline', () => {
  it('computeDailyClose alinha cota com calculateShareHistory para carteira só caixa', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 1000,
        date: '2026-01-15',
        created_at: '',
      },
    ]

    const asOfDate = '2026-01-15'
    const close = computeDailyClose(
      {
        portfolioId: 'p1',
        transactions,
        definitions: [cashDef],
        targets: [],
        prices: {},
        cashBalance: 0,
        indexRatesByIndexer: {},
        asOfDate,
        vnaMap: {},
      },
      {},
    )

    const share = calculateShareHistory(transactions, {}, [cashDef], {})
    expect(close.shareValue).toBe(share.currentShareValue)
    expect(close.totalShares).toBe(share.totalShares)
    expect(close.grossPl).toBeGreaterThan(0)
  })
})
