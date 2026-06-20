import { describe, it, expect } from 'vitest'
import { calculateShareHistory, calculatePerformanceMetrics } from '@/services/investmentEngine'
import type { PortfolioAssetDefinition, PortfolioTransaction, AssetPrice } from '@/types'

describe('investmentEngine - calculateShareHistory com Caixa', () => {
  const baseDefinition = (overrides: Partial<PortfolioAssetDefinition>): PortfolioAssetDefinition => ({
    id: '1',
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
    ...overrides,
  })

  it('mantém valor de cota R$ 1,00 constante para portfólio 100% de caixa', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 44.33,
        date: '2026-01-01',
        created_at: '',
      },
      {
        id: 't2',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 18.16,
        date: '2026-02-01',
        created_at: '',
      },
      {
        id: 't3',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 200.00,
        date: '2026-03-01',
        created_at: '',
      },
      {
        id: 't4',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 105.75,
        date: '2026-04-01',
        created_at: '',
      },
    ]

    const prices: Record<string, AssetPrice> = {}
    const definitions: PortfolioAssetDefinition[] = [baseDefinition({})]

    const result = calculateShareHistory(transactions, prices, definitions)

    // A cota deve ser rigorosamente 1.0000 no final
    expect(result.currentShareValue).toBe(1.0)
    // O número total de cotas em circulação deve ser o valor nominal total investido
    expect(result.totalShares).toBe(368.24)

    // Toda a evolução histórica da cota deve ser exatamente 1.0000
    result.shareHistory.forEach((hist) => {
      expect(hist.shareValue).toBe(1.0)
    })
  })

  it('calcula métricas de performance para carteira estável de caixa como zero', () => {
    const shareHistory = [
      { date: '2026-01-01', shareValue: 1.0 },
      { date: '2026-02-01', shareValue: 1.0 },
      { date: '2026-03-01', shareValue: 1.0 },
      { date: '2026-04-01', shareValue: 1.0 },
    ]

    const metrics = calculatePerformanceMetrics(shareHistory)

    expect(metrics.volatility_monthly).toBe(0)
    expect(metrics.return_monthly_avg).toBe(0)
    expect(metrics.sharpe_ratio).toBe(0)
    expect(metrics.beta_ibov).toBe(0)
    expect(metrics.beta_sp500).toBe(0)
    expect(metrics.data_source).toBe('share_history')
  })



  it('inclui caixa e ativo de mercado no valor final da cota', () => {
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
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 100,
        price: 30,
        date: '2026-02-01',
        created_at: '',
      },
    ]

    const prices: Record<string, AssetPrice> = {
      PETR4: {
        ticker: 'PETR4',
        current_price: 40,
        last_updated: '2026-03-01',
        quotation_status: 'live',
      },
    }

    const definitions: PortfolioAssetDefinition[] = [
      baseDefinition({ ticker: 'CAIXA' }),
      baseDefinition({ ticker: 'PETR4', pricing_mode: 'market', application_date: '2026-02-01' }),
    ]

    const result = calculateShareHistory(transactions, prices, definitions)

    // Aporte 1000 + compra PETR4 3000 (sem offset de caixa no teste) → 4000 cotas
    expect(result.totalShares).toBe(4000)
    // Valorização de PETR4 (30→40) eleva a cota para 1.25 (PL = 5000)
    expect(result.currentShareValue).toBeCloseTo(1.25, 4)
    expect(result.currentShareValue * result.totalShares).toBeCloseTo(5000, 0)
  })

  it('valora ativo do tesouro pela curva em calculateShareHistory mesmo se houver cotação a mercado cadastrada', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'TESOURO SELIC 2029',
        operation_type: 'buy',
        quantity: 10,
        price: 100,
        date: '2026-01-01',
        created_at: '',
      },
    ]

    const prices: Record<string, AssetPrice> = {
      'TESOURO SELIC 2029': {
        ticker: 'TESOURO SELIC 2029',
        current_price: 150,
        last_updated: '2026-01-02',
        quotation_status: 'live',
      },
    }

    const definitions: PortfolioAssetDefinition[] = [
      baseDefinition({
        ticker: 'TESOURO SELIC 2029',
        pricing_mode: 'market',
        is_treasury: true,
        contract_rate: 10,
        indexer: 'none',
      }),
    ]

    const result = calculateShareHistory(transactions, prices, definitions)

    expect(result.shareHistory.length).toBeGreaterThanOrEqual(2)
    expect(result.shareHistory[0].totalValue).toBe(1000)
  })

  it('separa corretamente saldo em caixa e ativos investidos no histórico e reflete dividendos na cota', () => {
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
      // Compra de PETR4 por 300 reais
      {
        id: 't2',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 10,
        price: 30,
        date: '2026-01-05',
        created_at: '',
      },
      // Offset da compra de PETR4: Vende 300 reais de CAIXA
      {
        id: 't2_offset',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 1,
        price: 300,
        date: '2026-01-05',
        created_at: '',
      },
      // Dividendos recebidos de PETR4: R$ 50
      {
        id: 't3',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'dividend',
        quantity: 10,
        price: 5,
        date: '2026-01-10',
        created_at: '',
      },
      // Offset do dividendo: Re-deposita/compra R$ 50 em CAIXA
      {
        id: 't3_offset',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 50,
        date: '2026-01-10',
        created_at: '',
      },
    ]

    const prices: Record<string, AssetPrice> = {
      PETR4: {
        ticker: 'PETR4',
        current_price: 30,
        last_updated: '2026-01-11',
        quotation_status: 'live',
        asset_class: 'Ações',
        sector: 'Petróleo',
      },
    }

    const definitions: PortfolioAssetDefinition[] = [
      baseDefinition({ ticker: 'CAIXA' }),
      baseDefinition({ ticker: 'PETR4', pricing_mode: 'market', application_date: '2026-01-05' }),
    ]

    const result = calculateShareHistory(transactions, prices, definitions)

    const pointJan05 = result.shareHistory.find(h => h.date === '2026-01-05')
    expect(pointJan05).toBeDefined()
    expect(pointJan05!.cashValue).toBe(700)
    expect(pointJan05!.investedValue).toBe(300)
    expect(pointJan05!.totalValue).toBe(1000)
    expect(pointJan05!.shareValue).toBe(1.0)
    expect(pointJan05!.classes).toBeDefined()
    expect(pointJan05!.classes!.Ações).toEqual({ totalValue: 300, yieldPct: 0 })
    expect(pointJan05!.sectors).toBeDefined()
    expect(pointJan05!.sectors!.Petróleo).toEqual({ totalValue: 300, yieldPct: 0 })

    const pointJan10 = result.shareHistory.find(h => h.date === '2026-01-10')
    expect(pointJan10).toBeDefined()
    expect(pointJan10!.cashValue).toBe(750)
    expect(pointJan10!.investedValue).toBe(300)
    expect(pointJan10!.totalValue).toBe(1050)
    expect(pointJan10!.shareValue).toBe(1.05)
    expect(pointJan10!.classes).toBeDefined()
    expect(pointJan10!.classes!.Ações).toEqual({ totalValue: 300, yieldPct: 16.67 })
    expect(pointJan10!.sectors).toBeDefined()
    expect(pointJan10!.sectors!.Petróleo).toEqual({ totalValue: 300, yieldPct: 16.67 })
  })

  it('utiliza cotações diárias corretas a partir de historicalPrices em vez de interpolação linear', () => {
    const transactions: PortfolioTransaction[] = [
      {
        id: 't1',
        portfolio_id: 'p1',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 30,
        date: '2026-01-01',
        created_at: '',
      },
    ]

    const prices: Record<string, AssetPrice> = {
      WEGE3: {
        ticker: 'WEGE3',
        current_price: 30,
        last_updated: '2026-01-10',
        quotation_status: 'live',
        asset_class: 'Ações',
        sector: 'Indústria',
      },
    }

    const definitions: PortfolioAssetDefinition[] = [
      baseDefinition({ ticker: 'WEGE3', pricing_mode: 'market', application_date: '2026-01-01' }),
    ]

    const historicalPrices = {
      WEGE3: {
        '2026-01-01': 30,
        '2026-01-05': 45,
        '2026-01-10': 30,
      },
    }

    const result = calculateShareHistory(transactions, prices, definitions, {}, historicalPrices)

    // Sem historicalPrices, no dia 05/01 o preço seria interpolado linearmente entre 30 e 30, resultando em 30.
    // Com historicalPrices, o preço no dia 05/01 deve ser 45.
    const pointJan05 = result.shareHistory.find(h => h.date === '2026-01-05')
    expect(pointJan05).toBeDefined()
    // 10 quotas a R$ 45 = R$ 450 (e sem caixa)
    expect(pointJan05!.investedValue).toBe(450)
    expect(pointJan05!.totalValue).toBe(450)

    const pointJan01 = result.shareHistory.find(h => h.date === '2026-01-01')
    expect(pointJan01!.investedValue).toBe(300)
  })

  it('calcula o capital investido acumulado (investedCapital) corretamente', () => {
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
      // Compra de PETR4 por 300 reais com offset do CAIXA
      {
        id: 't2',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 10,
        price: 30,
        date: '2026-01-05',
        created_at: '',
      },
      {
        id: 't2_offset',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 1,
        price: 300,
        date: '2026-01-05',
        created_at: '',
      },
      // Retirada externa de 200 reais de CAIXA
      {
        id: 't3',
        portfolio_id: 'p1',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 1,
        price: 200,
        date: '2026-01-10',
        created_at: '',
      },
    ]

    const prices: Record<string, AssetPrice> = {
      PETR4: {
        ticker: 'PETR4',
        current_price: 30,
        last_updated: '2026-01-11',
        quotation_status: 'live',
      },
    }

    const definitions: PortfolioAssetDefinition[] = [
      baseDefinition({ ticker: 'CAIXA' }),
      baseDefinition({ ticker: 'PETR4', pricing_mode: 'market', application_date: '2026-01-05' }),
    ]

    const result = calculateShareHistory(transactions, prices, definitions)

    const pointJan01 = result.shareHistory.find(h => h.date === '2026-01-01')
    expect(pointJan01).toBeDefined()
    expect(pointJan01!.investedCapital).toBe(1000)

    const pointJan05 = result.shareHistory.find(h => h.date === '2026-01-05')
    expect(pointJan05).toBeDefined()
    expect(pointJan05!.investedCapital).toBe(1000) // mantém constante pois foi apenas rebalanço interno

    const pointJan10 = result.shareHistory.find(h => h.date === '2026-01-10')
    expect(pointJan10).toBeDefined()
    expect(pointJan10!.investedCapital).toBe(800) // diminui devido à retirada externa de 200
  })
})


