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

  it('prioriza retornos de snapshots mensais quando disponíveis', () => {
    const shareHistory = [{ date: '2026-01-01', shareValue: 1.0 }]
    const snapshots = [
      {
        id: '1',
        portfolio_id: 'p1',
        period_type: 'month' as const,
        period_key: '2026-01',
        cota_abertura: 1,
        cota_fechamento: 1.02,
        somatorio_aportes: 0,
        somatorio_resgates: 0,
        dividendos_recebidos: 0,
        drawdown_maximo: 0,
        period_return: 0.02,
        created_at: '',
      },
      {
        id: '2',
        portfolio_id: 'p1',
        period_type: 'month' as const,
        period_key: '2026-02',
        cota_abertura: 1.02,
        cota_fechamento: 1.05,
        somatorio_aportes: 0,
        somatorio_resgates: 0,
        dividendos_recebidos: 0,
        drawdown_maximo: 0,
        period_return: 0.0294,
        created_at: '',
      },
    ]

    const metrics = calculatePerformanceMetrics(shareHistory, snapshots)
    expect(metrics.data_source).toBe('snapshots')
    expect(metrics.return_monthly_avg).toBeGreaterThan(0)
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

    // Aporte 1000 + fluxo líquido na compra PETR4 (caixa insuficiente) → 4000 cotas
    expect(result.totalShares).toBe(4000)
    // Valorização de PETR4 (30→40) eleva a cota; PL inclui caixa residual + ativos
    expect(result.currentShareValue).toBeGreaterThan(1)
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

    expect(result.shareHistory).toHaveLength(1)
    expect(result.shareHistory[0].totalValue).toBe(1000)
  })
})
