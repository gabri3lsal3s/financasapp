import { describe, it, expect } from 'vitest'
import { evaluateAssetPositionAtDate } from './assetValuationEngine'
import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'

describe('AssetValuationEngine', () => {
  const mockManualAssetDef: PortfolioAssetDefinition = {
    id: 'def-imovel',
    portfolio_id: 'port-1',
    ticker: 'IMOVEL_CENTRO',
    pricing_mode: 'manual_value',
    is_b3_linked: false,
    applied_amount: 200000,
    contract_rate: null,
    indexer: 'none',
    indexer_percent: 100,
    maturity_date: null,
    application_date: '2024-01-01',
    manual_current_value: 300000,
    manual_value_updated_at: '2026-06-01T00:00:00Z',
    tax_exempt: false,
    is_treasury: false,
    created_at: '',
    updated_at: ''
  }

  const mockTxs: PortfolioTransaction[] = [
    {
      id: 'tx-1',
      portfolio_id: 'port-1',
      ticker: 'IMOVEL_CENTRO',
      operation_type: 'buy',
      quantity: 1,
      price: 200000,
      date: '2024-01-01',
      created_at: ''
    }
  ]

  it('calculates interpolated profitability curve for manual assets between start date and update date', () => {
    // Avaliando em 2025-03-17 (data intermediária entre 2024-01-01 e 2026-06-01)
    const resPast = evaluateAssetPositionAtDate({
      ticker: 'IMOVEL_CENTRO',
      transactions: mockTxs,
      definition: mockManualAssetDef,
      asOfDate: '2025-03-17'
    })

    // Deve estar estritamente entre o custo inicial (200.000) e o valor final (300.000)
    expect(resPast.totalValue).toBeGreaterThan(200000)
    expect(resPast.totalValue).toBeLessThan(300000)
    expect(resPast.costBasis).toBe(200000)
  })

  it('uses intermediate historical balance records when priceMap is available', () => {
    const priceMap = {
      IMOVEL_CENTRO: {
        '2024-12-31': 220000,
        '2025-12-31': 260000,
      }
    }

    const resRecord1 = evaluateAssetPositionAtDate({
      ticker: 'IMOVEL_CENTRO',
      transactions: mockTxs,
      definition: mockManualAssetDef,
      asOfDate: '2024-12-31',
      priceMap
    })

    expect(resRecord1.totalValue).toBe(220000)

    const resRecord2 = evaluateAssetPositionAtDate({
      ticker: 'IMOVEL_CENTRO',
      transactions: mockTxs,
      definition: mockManualAssetDef,
      asOfDate: '2025-12-31',
      priceMap
    })

    expect(resRecord2.totalValue).toBe(260000)
  })

  it('uses updated manual_current_value on or after update date', () => {
    // Avaliando em 2026-06-05 (depois da data de atualização de 2026-06-01)
    const resCurrent = evaluateAssetPositionAtDate({
      ticker: 'IMOVEL_CENTRO',
      transactions: mockTxs,
      definition: mockManualAssetDef,
      asOfDate: '2026-06-05'
    })

    expect(resCurrent.totalValue).toBe(300000)
    expect(resCurrent.costBasis).toBe(200000)
  })


  it('evaluates fixed income asset correctly on curve', () => {
    const cdbDef: PortfolioAssetDefinition = {
      id: 'def-cdb',
      portfolio_id: 'port-1',
      ticker: 'CDB_BANCARIO',
      pricing_mode: 'fixed_income',
      is_b3_linked: false,
      applied_amount: 1000,
      contract_rate: 2, // 2% a.a. spread
      indexer: 'cdi',
      indexer_percent: 100,
      maturity_date: null,
      application_date: '2026-06-08',
      manual_current_value: null,
      manual_value_updated_at: null,
      tax_exempt: false,
      is_treasury: false,
      created_at: '',
      updated_at: ''
    }

    const cdbTxs: PortfolioTransaction[] = [
      {
        id: 'tx-cdb-1',
        portfolio_id: 'port-1',
        ticker: 'CDB_BANCARIO',
        operation_type: 'buy',
        quantity: 1,
        price: 1000,
        date: '2026-06-08',
        created_at: ''
      }
    ]

    const indexRates = {
      cdi: {
        '2026-06-08': 0.0004,
        '2026-06-09': 0.0004,
        '2026-06-10': 0.0004,
        '2026-06-11': 0.0004,
        '2026-06-12': 0.0004,
      }
    }

    const res = evaluateAssetPositionAtDate({
      ticker: 'CDB_BANCARIO',
      transactions: cdbTxs,
      definition: cdbDef,
      asOfDate: '2026-06-15',
      indexRates
    })

    expect(res.totalValue).toBeGreaterThan(1000)
    expect(res.costBasis).toBe(1000)
  })
})
