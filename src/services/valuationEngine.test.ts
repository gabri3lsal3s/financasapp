import { describe, it, expect } from 'vitest'
import { calculatePortfolioValuation } from '@/services/valuationEngine'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'

const baseDefinition = (overrides: Partial<PortfolioAssetDefinition>): PortfolioAssetDefinition => ({
  id: '1',
  portfolio_id: 'p1',
  ticker: 'CDB1',
  pricing_mode: 'fixed_income',
  is_b3_linked: false,
  applied_amount: 10000,
  contract_rate: 12,
  indexer: 'none',
  indexer_percent: 100,
  maturity_date: null,
  manual_current_value: null,
  manual_value_updated_at: null,
  tax_exempt: false,
  is_treasury: false,
  application_date: '2025-01-01',
  created_at: '',
  updated_at: '',
  ...overrides,
})

describe('valuationEngine', () => {
  it('valora renda fixa pelo valor teórico, não por cotação', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CDB1',
        operation_type: 'buy',
        quantity: 1,
        price: 10000,
        date: '2025-01-01',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [baseDefinition({})],
      targets: [],
      prices: {},
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
      asOfDate: '2026-01-01',
    })

    expect(result.positions).toHaveLength(1)
    expect(result.positions[0].valuation_source).toBe('fixed_income')
    expect(result.positions[0].total_value).toBeGreaterThan(10000)
  })

  it('valora manual pelo valor atual cadastrado', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'IMOVEL',
        operation_type: 'buy',
        quantity: 1,
        price: 500000,
        date: '2024-06-01',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [
        baseDefinition({
          ticker: 'IMOVEL',
          pricing_mode: 'manual_value',
          applied_amount: 500000,
          manual_current_value: 620000,
        }),
      ],
      targets: [],
      prices: {},
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.positions[0].total_value).toBe(620000)
    expect(result.positions[0].gross_yield_pct).toBe(24)
  })

  it('indica mercado sem vínculo B3', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 40,
        date: '2025-01-01',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [
        baseDefinition({
          ticker: 'WEGE3',
          pricing_mode: 'market',
          is_b3_linked: false,
          applied_amount: null,
        }),
      ],
      targets: [],
      prices: { WEGE3: { ticker: 'WEGE3', current_price: 45, last_updated: new Date().toISOString() } },
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.positions[0].is_b3_linked).toBe(false)
    expect(result.positions[0].total_value).toBe(450)
  })

  it('inclui cash_balance no patrimônio total, mas não no investido', () => {
    const result = calculatePortfolioValuation({
      transactions: [],
      definitions: [],
      targets: [],
      prices: {},
      cashBalance: 1500,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.totalValue).toBe(1500)
    expect(result.investedValue).toBe(0)
    expect(result.cashValue).toBe(1500)
  })

  it('saldo em caixa não gera rentabilidade', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 5000,
        date: '2025-01-01',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [
        baseDefinition({
          ticker: 'CAIXA',
          pricing_mode: 'cash',
          applied_amount: null,
        }),
      ],
      targets: [],
      prices: {},
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.positions[0].valuation_source).toBe('cash')
    expect(result.positions[0].gross_yield_pct).toBe(0)
    expect(result.positions[0].net_yield_pct).toBe(0)
    expect(result.positions[0].total_value).toBe(5000)
  })

  it('saldo em caixa soma múltiplos aportes ignorando applied_amount obsoleto', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 103.59,
        date: '2026-01-01',
        created_at: '',
      },
      {
        id: 't2',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 15.86,
        date: '2026-02-01',
        created_at: '',
      },
      {
        id: 't3',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 100.68,
        date: '2026-03-01',
        created_at: '',
      },
      {
        id: 't4',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 103.78,
        date: '2026-04-01',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [
        baseDefinition({
          ticker: 'CAIXA',
          pricing_mode: 'cash',
          applied_amount: 103.59,
        }),
      ],
      targets: [],
      prices: {},
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.positions[0].total_value).toBe(323.91)
    expect(result.positions[0].cost_basis).toBe(323.91)
  })

  it('identifica SALDO EM CAIXA como cash por padrao mesmo sem definicao explicita', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'Saldo em caixa',
        operation_type: 'buy',
        quantity: 1,
        price: 368.24,
        date: '2026-05-24',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [],
      targets: [],
      prices: {},
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.positions[0].pricing_mode).toBe('cash')
    expect(result.positions[0].total_value).toBe(368.24)
  })

  it('saldo em caixa reduz com venda (retirada)', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 1000,
        date: '2026-01-01',
        created_at: '',
      },
      {
        id: 't2',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 500,
        date: '2026-02-01',
        created_at: '',
      },
      {
        id: 't3',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 1,
        price: 1000,
        date: '2026-03-01',
        created_at: '',
      },
    ]

    const result = calculatePortfolioValuation({
      transactions,
      definitions: [
        baseDefinition({
          ticker: 'CAIXA',
          pricing_mode: 'cash',
          applied_amount: 1000,
        }),
      ],
      targets: [],
      prices: {},
      cashBalance: 0,
      indexRatesByIndexer: { none: {}, cdi: {}, selic: {}, ipca: {} },
    })

    expect(result.positions[0].total_value).toBe(750)
  })
})
