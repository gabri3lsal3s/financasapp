import { describe, it, expect } from 'vitest'
import { valuatePortfolioSync } from '@/utils/portfolioValuationBatch'
import { calculatePositions } from '@/services/investmentEngine'
import type { PortfolioAssetDefinition, PortfolioTransaction, TargetAllocation } from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'

describe('portfolioValuationBatch', () => {
  const fixedIncomeDef: PortfolioAssetDefinition = {
    id: 'def1',
    portfolio_id: 'p1',
    ticker: 'CDB TESTE',
    pricing_mode: 'fixed_income',
    is_b3_linked: false,
    applied_amount: 10000,
    contract_rate: 0.12,
    indexer: 'cdi',
    indexer_percent: 100,
    maturity_date: '2027-12-31',
    manual_current_value: null,
    manual_value_updated_at: null,
    tax_exempt: false,
    is_treasury: false,
    application_date: '2025-01-15',
    created_at: '',
    updated_at: '',
    currency: 'BRL',
    valuation_mode: 'curve',
  }

  const buyTx: PortfolioTransaction = {
    id: 't1',
    portfolio_id: 'p1',
    ticker: 'CDB TESTE',
    operation_type: 'buy',
    quantity: 1,
    price: 10000,
    date: '2025-01-15',
    created_at: '',
  }

  const indexRates: Record<string, IndexRateMap> = {
    cdi: {
      '2025-01-15': 0.0004,
      '2026-06-02': 0.0004,
    },
  }

  it('valuatePortfolioSync valoriza RF quando índices são fornecidos', () => {
    const withRates = valuatePortfolioSync({
      transactions: [buyTx],
      targets: [] as TargetAllocation[],
      definitions: [fixedIncomeDef],
      cashBalance: 0,
      prices: {},
      indexRatesByIndexer: indexRates,
      vnaMap: {},
    })

    const withoutRates = valuatePortfolioSync({
      transactions: [buyTx],
      targets: [] as TargetAllocation[],
      definitions: [fixedIncomeDef],
      cashBalance: 0,
      prices: {},
      indexRatesByIndexer: {},
      vnaMap: {},
    })

    expect(withRates.totalValue).toBeGreaterThan(10000)
    expect(withoutRates.totalValue).toBeLessThan(withRates.totalValue)
  })

  it('valuatePortfolioSync com índices bate calculatePositions direto', () => {
    const definitions = [fixedIncomeDef]
    const viaBatch = valuatePortfolioSync({
      transactions: [buyTx],
      targets: [],
      definitions,
      cashBalance: 0,
      prices: {},
      indexRatesByIndexer: indexRates,
      vnaMap: {},
    })
    const direct = calculatePositions(
      [buyTx],
      [],
      {},
      0,
      definitions,
      indexRates,
      {},
    )
    expect(viaBatch.totalValue).toBe(direct.totalValue)
    expect(viaBatch.investedValue).toBe(direct.investedValue)
  })

  it('valuatePortfolioSync com e sem índices produz o mesmo total quando ambos recebem os mesmos inputs', () => {
    const a = valuatePortfolioSync({
      transactions: [buyTx],
      targets: [],
      definitions: [fixedIncomeDef],
      cashBalance: 500,
      prices: {},
      indexRatesByIndexer: indexRates,
      vnaMap: {},
    })

    const b = valuatePortfolioSync({
      transactions: [buyTx],
      targets: [],
      definitions: [fixedIncomeDef],
      cashBalance: 500,
      prices: {},
      indexRatesByIndexer: indexRates,
      vnaMap: {},
    })

    expect(a.totalValue).toBe(b.totalValue)
    expect(a.cashValue).toBe(b.cashValue)
  })
})
