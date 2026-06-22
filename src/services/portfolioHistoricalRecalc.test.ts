import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runClientSideHistoricalRecalculation } from './portfolioHistoricalRecalc'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockImplementation(() => Promise.resolve({ data: [], error: null })),
  }))
  return {
    supabase: {
      from: mockFrom,
    },
  }
})

vi.mock('@/services/priceService', () => ({
  fetchWithCorsProxy: vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ chart: { result: [] } }),
  }),
}))

describe('runClientSideHistoricalRecalculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('completa sem transacoes limpando tabelas', async () => {
    const fromSpy = vi.spyOn(supabase, 'from')

    await runClientSideHistoricalRecalculation('mock-portfolio-id')

    expect(fromSpy).toHaveBeenCalledWith('portfolio_transactions')
    expect(fromSpy).toHaveBeenCalledWith('portfolio_share_daily')
    expect(fromSpy).toHaveBeenCalledWith('portfolio_period_snapshots')
    expect(fromSpy).toHaveBeenCalledWith('portfolios')
  })

  it('calcula cotas corretamente para compras e proventos com offset de caixa', async () => {
    const testTxs = [
      {
        id: 'tx-0',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 1000.0,
        date: '2026-06-01',
        cash_offset_source_id: null
      },
      {
        id: 'tx-1',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 10,
        price: 40.0,
        date: '2026-06-02',
        cash_offset_source_id: null
      },
      {
        id: 'tx-2',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 0.4,
        price: 1000.0,
        date: '2026-06-02',
        cash_offset_source_id: 'tx-1'
      },
      {
        id: 'tx-3',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'PETR4',
        operation_type: 'dividend',
        quantity: 10,
        price: 5.0,
        date: '2026-06-03',
        cash_offset_source_id: null
      },
      {
        id: 'tx-4',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 50.0,
        date: '2026-06-03',
        cash_offset_source_id: 'tx-3'
      }
    ]

    const testDefs = [
      {
        ticker: 'CAIXA',
        pricing_mode: 'cash'
      },
      {
        ticker: 'PETR4',
        pricing_mode: 'market'
      }
    ]

    const upsertedRows: any[] = []
    const mockUpsert = vi.fn().mockImplementation((chunk) => {
      upsertedRows.push(...chunk)
      return Promise.resolve({ error: null })
    })

    const mockFrom = vi.fn().mockImplementation((table) => {
      let data: any[] = []
      if (table === 'portfolio_transactions') {
        data = testTxs
      } else if (table === 'portfolio_asset_definitions') {
        data = testDefs
      } else if (table === 'asset_prices') {
        data = [{ ticker: 'PETR4', current_price: 40.0 }, { ticker: 'CAIXA', current_price: 1.0 }]
      } else if (table === 'asset_price_daily') {
        data = [
          { ticker: 'PETR4', price_date: '2026-06-01', close_price: 40.0 },
          { ticker: 'PETR4', price_date: '2026-06-02', close_price: 40.0 },
          { ticker: 'PETR4', price_date: '2026-06-03', close_price: 35.0 },
        ]
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => Promise.resolve({ data, error: null })),
        delete: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: table === 'portfolio_share_daily' ? mockUpsert : vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockImplementation(() => Promise.resolve({ data, error: null })),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      }
    })

    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any)

    await runClientSideHistoricalRecalculation('mock-portfolio-id')

    const day1 = upsertedRows.find(r => r.rate_date === '2026-06-01')
    const day2 = upsertedRows.find(r => r.rate_date === '2026-06-02')
    const day3 = upsertedRows.find(r => r.rate_date === '2026-06-03')

    expect(day1).toBeDefined()
    expect(day2).toBeDefined()
    expect(day3).toBeDefined()

    expect(day1.share_value).toBeCloseTo(1.0, 4)
    expect(day1.total_shares).toBeCloseTo(1000.0, 4)
    expect(day1.net_pl).toBeCloseTo(0.0, 4)

    expect(day2.share_value).toBeCloseTo(1.0, 4)
    expect(day2.total_shares).toBeCloseTo(1000.0, 4)
    expect(day2.net_pl).toBeCloseTo(0.0, 4)

    expect(day3.share_value).toBeCloseTo(1.0, 4)
    expect(day3.total_shares).toBeCloseTo(1000.0, 4)
    expect(day3.net_pl).toBeCloseTo(-50.0, 4)
  })

  it('reproduz a simulacao do screenshot para depuração de cota', async () => {
    const testTxs = [
      {
        id: 'tx-dep',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CAIXA',
        operation_type: 'buy',
        quantity: 1,
        price: 500.0,
        date: '2026-06-22',
        cash_offset_source_id: null
      },
      {
        id: 'tx-buy-wege',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 1,
        price: 50.0,
        date: '2026-06-22',
        cash_offset_source_id: null
      },
      {
        id: 'tx-offset-buy-wege',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CAIXA',
        operation_type: 'sell',
        quantity: 1,
        price: 50.0,
        date: '2026-06-22',
        cash_offset_source_id: 'tx-buy-wege'
      },
      {
        id: 'tx-div-wege',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'WEGE3',
        operation_type: 'dividend',
        quantity: 1,
        price: 50.0,
        date: '2026-06-22',
        cash_offset_source_id: null
      }
    ]

    const testDefs = [
      { ticker: 'CAIXA', pricing_mode: 'cash' },
      { ticker: 'WEGE3', pricing_mode: 'market' }
    ]

    const upsertedRows: any[] = []
    const mockUpsert = vi.fn().mockImplementation((chunk) => {
      upsertedRows.push(...chunk)
      return Promise.resolve({ error: null })
    })

    const mockFrom = vi.fn().mockImplementation((table) => {
      let data: any[] = []
      if (table === 'portfolio_transactions') {
        data = testTxs
      } else if (table === 'portfolio_asset_definitions') {
        data = testDefs
      } else if (table === 'asset_prices') {
        data = [{ ticker: 'WEGE3', current_price: 19.66 }, { ticker: 'CAIXA', current_price: 1.0 }]
      } else if (table === 'asset_price_daily') {
        data = [
          { ticker: 'WEGE3', price_date: '2026-06-22', close_price: 19.66 }
        ]
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockImplementation(() => Promise.resolve({ data, error: null })),
        delete: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        upsert: table === 'portfolio_share_daily' ? mockUpsert : vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockImplementation(() => Promise.resolve({ data, error: null })),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
      }
    })

    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any)

    await runClientSideHistoricalRecalculation('mock-portfolio-id')

    console.log('--- UPSERTED DAILY ROWS IN TEST ---', upsertedRows)
    expect(upsertedRows.length).toBe(1)
    const day = upsertedRows[0]
    expect(day.rate_date).toBe('2026-06-22')
    // Esperamos cota = 469.66 / 500 = 0.93932 (retorno -6.07%)
    expect(day.share_value).toBeCloseTo(0.93932, 4)
  })
})
