import { describe, it, expect } from 'vitest'
import { buildLotsFromTransactions, valueLot } from '@/services/returns/lotValuation'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'

const marketDef = (ticker: string): PortfolioAssetDefinition => ({
  id: 'd1',
  portfolio_id: 'p1',
  ticker,
  pricing_mode: 'market',
  is_b3_linked: true,
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
})

describe('lotValuation', () => {
  it('buildLotsFromTransactions aplica venda parcial FIFO', () => {
    const txs: PortfolioTransaction[] = [
      {
        id: 'b1',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 100,
        price: 30,
        date: '2026-01-10',
        created_at: '',
      },
      {
        id: 's1',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'sell',
        quantity: 40,
        price: 35,
        date: '2026-02-01',
        created_at: '',
      },
    ]

    const lots = buildLotsFromTransactions(txs, [marketDef('PETR4')])
    expect(lots).toHaveLength(1)
    expect(lots[0]?.quantity).toBe(60)
    expect(lots[0]?.principal).toBeCloseTo(1800, 0)
  })

  it('valueLot usa cotação de mercado', () => {
    const txs: PortfolioTransaction[] = [
      {
        id: 'b1',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 10,
        price: 30,
        date: '2026-01-10',
        created_at: '',
      },
    ]
    const lots = buildLotsFromTransactions(txs, [marketDef('PETR4')])
    const valued = valueLot(
      lots[0],
      '2026-06-01',
      { PETR4: { ticker: 'PETR4', current_price: 40, last_updated: '2026-06-01', quotation_status: 'live' } },
      {},
      {},
      () => 50,
    )
    expect(valued.grossValue).toBe(400)
    expect(valued.grossGain).toBe(100)
  })
})
