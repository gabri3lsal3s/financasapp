import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runClientSideHistoricalRecalculation } from './portfolioHistoricalRecalc'
import { supabase } from '@/lib/supabase'

vi.mock('@/lib/supabase', () => {
  const mockFrom = vi.fn().mockImplementation(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (onfulfilled: any) => Promise.resolve({ data: [], error: null }).then(onfulfilled)
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

function createMockQueryChain(data: any, mockUpsert?: any) {
  const result = { data, error: null }
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: mockUpsert || vi.fn().mockImplementation(() => Promise.resolve({ error: null })),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (onfulfilled: any) => Promise.resolve(result).then(onfulfilled)
  }
}

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

      return createMockQueryChain(data, table === 'portfolio_share_daily' ? mockUpsert : null)
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

      return createMockQueryChain(data, table === 'portfolio_share_daily' ? mockUpsert : null)
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

  it('calcula desdobramentos de acoes (splits) retroativamente mantendo cota estavel', async () => {
    const testTxs = [
      {
        id: 'tx-buy',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 50.0,
        date: '2026-06-01',
        cash_offset_source_id: null
      },
      {
        id: 'tx-split',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'WEGE3',
        operation_type: 'split',
        quantity: 90,
        price: 0,
        date: '2026-06-03',
        cash_offset_source_id: null
      }
    ]

    const testDefs = [
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
        data = [{ ticker: 'WEGE3', current_price: 5.0 }]
      } else if (table === 'asset_price_daily') {
        // Yahoo Finance fornece precos historicos ja ajustados para o split (5.0 em todos os dias)
        data = [
          { ticker: 'WEGE3', price_date: '2026-06-01', close_price: 5.0 },
          { ticker: 'WEGE3', price_date: '2026-06-02', close_price: 5.0 },
          { ticker: 'WEGE3', price_date: '2026-06-03', close_price: 5.0 }
        ]
      }

      return createMockQueryChain(data, table === 'portfolio_share_daily' ? mockUpsert : null)
    })

    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any)

    await runClientSideHistoricalRecalculation('mock-portfolio-id')

    const day1 = upsertedRows.find(r => r.rate_date === '2026-06-01')
    const day2 = upsertedRows.find(r => r.rate_date === '2026-06-02')
    const day3 = upsertedRows.find(r => r.rate_date === '2026-06-03')

    expect(day1).toBeDefined()
    expect(day2).toBeDefined()
    expect(day3).toBeDefined()

    // Sem ajuste de split, a cota cairia para 0.1 no dia 1 e subiria para 1.0 no dia 3.
    // Com o ajuste de split retroativo, a cota deve se manter estavel em 1.0 em todos os dias!
    expect(day1.share_value).toBeCloseTo(1.0, 4)
    expect(day2.share_value).toBeCloseTo(1.0, 4)
    expect(day3.share_value).toBeCloseTo(1.0, 4)
  })

  it('calcula renda fixa por lote sem acumular juros retroativos', async () => {
    const testTxs = [
      {
        id: 'tx-buy-rf-1',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CDB-1',
        operation_type: 'buy',
        quantity: 1,
        price: 1000.0,
        date: '2026-06-01',
        cash_offset_source_id: null
      },
      {
        id: 'tx-buy-rf-2',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'CDB-1',
        operation_type: 'buy',
        quantity: 1,
        price: 1000.0,
        date: '2026-06-03',
        cash_offset_source_id: null
      }
    ]

    const testDefs = [
      {
        ticker: 'CDB-1',
        pricing_mode: 'fixed_income',
        indexer: 'none',
        contract_rate: 10.0 // 10% a.a. pré
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
      }

      return createMockQueryChain(data, table === 'portfolio_share_daily' ? mockUpsert : null)
    })

    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any)

    await runClientSideHistoricalRecalculation('mock-portfolio-id')

    const day1 = upsertedRows.find(r => r.rate_date === '2026-06-01')
    const day2 = upsertedRows.find(r => r.rate_date === '2026-06-02')
    const day3 = upsertedRows.find(r => r.rate_date === '2026-06-03')

    expect(day1).toBeDefined()
    expect(day2).toBeDefined()
    expect(day3).toBeDefined()

    // No dia 1, a cota deve ser 1.0 (apenas CDB-1 de $1000 rendendo 0 dias de juros no fim do dia)
    expect(day1.share_value).toBeCloseTo(1.0, 4)

    // No dia 3, o lote 2 de $1000 foi adicionado hoje. Ele não deve render juros retroativos.
    // Lote 1 rendeu 2 dias de juros. Lote 2 rendeu 0 dias de juros.
    // Preço diário da taxa pré-fixada: Math.pow(1 + 0.1, 1/252) - 1 = 0.000378
    // Lote 1 no dia 3 (diffDays = 2): 1000 * Math.pow(1 + dailyRate, 2 * 5 / 7)
    // Se estivesse errado e os juros acumulassem retroativamente no lote 2, o valor total seria muito maior.
    // Vamos garantir que a cota do dia 3 é muito próxima de 1.0 (apenas o juro do lote 1 diluído no total)
    // Cota deve ser ligeiramente maior que 1.0, mas menor que se o lote 2 tivesse rendido juros desde o dia 1.
    expect(day3.share_value).toBeGreaterThan(1.0)
    expect(day3.share_value).toBeLessThan(1.002) // juros do lote 1 são baixos
  })

  it('calcula desdobramentos isolados por ticker sem afetar outros ativos', async () => {
    const testTxs = [
      {
        id: 'tx-buy-wege',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'WEGE3',
        operation_type: 'buy',
        quantity: 10,
        price: 50.0,
        date: '2026-06-01',
        cash_offset_source_id: null
      },
      {
        id: 'tx-buy-petr',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 10,
        price: 30.0,
        date: '2026-06-01',
        cash_offset_source_id: null
      },
      {
        id: 'tx-split-wege',
        portfolio_id: 'mock-portfolio-id',
        ticker: 'WEGE3',
        operation_type: 'split',
        quantity: 90, // split 1:10 (adiciona 90 cotas)
        price: 0,
        date: '2026-06-03',
        cash_offset_source_id: null
      }
    ]

    const testDefs = [
      { ticker: 'WEGE3', pricing_mode: 'market' },
      { ticker: 'PETR4', pricing_mode: 'market' }
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
        data = [{ ticker: 'WEGE3', current_price: 5.0 }, { ticker: 'PETR4', current_price: 30.0 }]
      } else if (table === 'asset_price_daily') {
        data = [
          { ticker: 'WEGE3', price_date: '2026-06-01', close_price: 5.0 },
          { ticker: 'WEGE3', price_date: '2026-06-02', close_price: 5.0 },
          { ticker: 'WEGE3', price_date: '2026-06-03', close_price: 5.0 },
          { ticker: 'PETR4', price_date: '2026-06-01', close_price: 30.0 },
          { ticker: 'PETR4', price_date: '2026-06-02', close_price: 30.0 },
          { ticker: 'PETR4', price_date: '2026-06-03', close_price: 30.0 }
        ]
      }

      return createMockQueryChain(data, table === 'portfolio_share_daily' ? mockUpsert : null)
    })

    vi.spyOn(supabase, 'from').mockImplementation(mockFrom as any)

    await runClientSideHistoricalRecalculation('mock-portfolio-id')

    const day1 = upsertedRows.find(r => r.rate_date === '2026-06-01')
    const day2 = upsertedRows.find(r => r.rate_date === '2026-06-02')
    const day3 = upsertedRows.find(r => r.rate_date === '2026-06-03')

    expect(day1).toBeDefined()
    expect(day2).toBeDefined()
    expect(day3).toBeDefined()

    // O split de WEGE3 não deve afetar a quantidade de PETR4!
    // Se o split afetasse PETR4 retroativamente (bug do multiplicador global),
    // a quantidade de PETR4 seria multiplicada por 10 no dia 1 e 2,
    // inflando o PL diário de PETR4 de R$ 300 para R$ 3000, fazendo a cota distorcer.
    // Com a correção por ticker:
    // PETR4 se mantém em 10 cotas a R$ 30 (total R$ 300).
    // WEGE3 no dia 1 e 2 (antes do split) tem sua quantidade ajustada para 100 cotas a R$ 5 (total R$ 500).
    // Total dia 1: R$ 800.
    // Total dia 3: R$ 800.
    // A cota deve se manter estável em 1.0!
    expect(day1.share_value).toBeCloseTo(1.0, 4)
    expect(day2.share_value).toBeCloseTo(1.0, 4)
    expect(day3.share_value).toBeCloseTo(1.0, 4)
  })
})
