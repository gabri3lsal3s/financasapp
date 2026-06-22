import { describe, it, expect } from 'vitest'
import { detectDefaultCurrency, getAssetMetadata, computePositions } from './portfolioCalculations'
import type { PortfolioTransaction, PortfolioAssetDefinition, AssetPrice } from '@/types'

describe('detectDefaultCurrency', () => {
  it('detects BRL correctly', () => {
    expect(detectDefaultCurrency('WEGE3')).toBe('BRL')
    expect(detectDefaultCurrency('MXRF11')).toBe('BRL')
    expect(detectDefaultCurrency('BTC')).toBe('BRL')
    expect(detectDefaultCurrency('CDI')).toBe('BRL')
  })

  it('detects USD correctly', () => {
    expect(detectDefaultCurrency('AAPL')).toBe('USD')
    expect(detectDefaultCurrency('VOO')).toBe('USD')
  })
})

describe('getAssetMetadata', () => {
  it('categorizes assets correctly', () => {
    expect(getAssetMetadata('BTC').asset_class).toBe('Criptoativos')
    expect(getAssetMetadata('MXRF11').asset_class).toBe('Fundos Imobiliários')
    expect(getAssetMetadata('VOO').asset_class).toBe('ETFs')
    expect(getAssetMetadata('AAPL').asset_class).toBe('Ações Internacionais')
    expect(getAssetMetadata('WEGE3').asset_class).toBe('Ações Nacionais')
    expect(getAssetMetadata('CDB_CDI').asset_class).toBe('Renda Fixa')
  })
})

describe('computePositions', () => {
  const mockDefinitions: PortfolioAssetDefinition[] = [
    {
      id: 'def-wege',
      portfolio_id: 'port-1',
      ticker: 'WEGE3',
      pricing_mode: 'market',
      is_b3_linked: true,
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
      created_at: '',
      updated_at: ''
    }
  ]

  const mockPrices: Record<string, AssetPrice> = {
    WEGE3: {
      ticker: 'WEGE3',
      current_price: 40.00,
      last_updated: '',
      asset_class: 'Ações Nacionais',
      sector: 'Bens Industriais'
    }
  }

  it('calculates position from transactions correctly', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 'tx-1',
        portfolio_id: 'port-1',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 35.00,
        date: '2026-06-01',
        created_at: ''
      },
      {
        id: 'tx-2',
        portfolio_id: 'port-1',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 37.00,
        date: '2026-06-02',
        created_at: ''
      }
    ]

    const result = computePositions(transactions, mockDefinitions, mockPrices, 1000)
    
    expect(result.positions.length).toBe(1)
    const pos = result.positions[0]
    expect(pos.ticker).toBe('WEGE3')
    expect(pos.quantity).toBe(20)
    expect(pos.average_price).toBe(36.00) // (10*35 + 10*37) / 20 = 36.00
    expect(pos.total_value).toBe(800.00) // 20 * 40.00
    expect(pos.cost_basis).toBe(720.00) // 20 * 36.00
    expect(result.investedValue).toBe(800.00)
    expect(result.cashValue).toBe(1000)
    expect(result.totalValue).toBe(1800.00)
  })

  it('handles sell and splits correctly', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 'tx-1',
        portfolio_id: 'port-1',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 30.00,
        date: '2026-06-01',
        created_at: ''
      },
      {
        id: 'tx-2',
        portfolio_id: 'port-1',
        ticker: 'WEGE3',
        operation_type: 'split',
        quantity: 10, // recebeu mais 10 desdobradas
        price: 0,
        date: '2026-06-02',
        created_at: ''
      },
      {
        id: 'tx-3',
        portfolio_id: 'port-1',
        ticker: 'WEGE3',
        operation_type: 'sell',
        quantity: 5,
        price: 25.00,
        date: '2026-06-03',
        created_at: ''
      }
    ]

    const result = computePositions(transactions, mockDefinitions, mockPrices, 500)
    
    expect(result.positions.length).toBe(1)
    const pos = result.positions[0]
    expect(pos.ticker).toBe('WEGE3')
    expect(pos.quantity).toBe(15) // 10 + 10 - 5 = 15
    expect(pos.average_price).toBe(15.00) // custo total 300 / 20 unidades antes de venda = 15.00 de custo médio
    expect(pos.total_value).toBe(600.00) // 15 * 40.00
  })

  it('correctly handles custom cash assets and avoids double counting in cashValue and totalValue', () => {
    const cashDefinitions: PortfolioAssetDefinition[] = [
      ...mockDefinitions,
      {
        id: 'def-xp-cash',
        portfolio_id: 'port-1',
        ticker: 'XP_CAIXA',
        pricing_mode: 'cash',
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
        created_at: '',
        updated_at: ''
      }
    ]

    const transactions: PortfolioTransaction[] = [
      {
        id: 'tx-1',
        portfolio_id: 'port-1',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 35.00,
        date: '2026-06-01',
        created_at: ''
      },
      {
        id: 'tx-2',
        portfolio_id: 'port-1',
        ticker: 'XP_CAIXA',
        operation_type: 'buy',
        quantity: 500,
        price: 1.00,
        date: '2026-06-01',
        created_at: ''
      }
    ]

    const result = computePositions(transactions, cashDefinitions, mockPrices, 700)

    const xpCashPos = result.positions.find(p => p.ticker === 'XP_CAIXA')
    expect(xpCashPos).toBeDefined()
    expect(xpCashPos?.pricing_mode).toBe('cash')
    expect(xpCashPos?.asset_class).toBe('Saldo em Caixa')
    expect(xpCashPos?.total_value).toBe(500)

    expect(result.investedValue).toBe(400.00)
    expect(result.cashValue).toBe(700)
    expect(result.totalValue).toBe(1100.00)
  })
})
