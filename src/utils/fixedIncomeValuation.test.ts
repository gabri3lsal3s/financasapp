import { describe, it, expect } from 'vitest'
import { calculateFixedIncomeValue, calculateLotBasedFixedIncomeValue } from '@/utils/fixedIncomeValuation'
import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'

describe('fixedIncomeValuation', () => {
  it('calcula pré-fixado com base 365 dias corridos', () => {
    const value = calculateFixedIncomeValue({
      principal: 10000,
      contractRateAnnual: 12,
      indexer: 'none',
      indexerPercent: 100,
      applicationDate: '2025-01-01',
      asOfDate: '2026-01-01',
      indexRates: {},
    })

    expect(value).toBeGreaterThan(10000)
    expect(value).toBeLessThan(12000)
  })

  it('acumula pós-fixado com taxas diárias em dias úteis', () => {
    const indexRates: Record<string, number> = {
      '2025-01-02': 0.05,
      '2025-01-03': 0.05,
    }

    const value = calculateFixedIncomeValue({
      principal: 1000,
      contractRateAnnual: null,
      indexer: 'cdi',
      indexerPercent: 100,
      applicationDate: '2025-01-01',
      asOfDate: '2025-01-05',
      indexRates,
    })

    expect(value).toBeGreaterThan(1000)
  })

  describe('calculateLotBasedFixedIncomeValue', () => {
    it('calcula corretamente renda fixa por lotes individuais e aplica FIFO em vendas', () => {
      const definition: PortfolioAssetDefinition = {
        id: '1',
        portfolio_id: 'p1',
        ticker: 'SELIC 29',
        pricing_mode: 'fixed_income',
        is_b3_linked: false,
        applied_amount: null,
        contract_rate: 10,
        indexer: 'none',
        indexer_percent: 100,
        maturity_date: '2029-12-31',
        manual_current_value: null,
        manual_value_updated_at: null,
        tax_exempt: false,
        is_treasury: true,
        application_date: null,
        created_at: '',
        updated_at: '',
      }

      const transactions: PortfolioTransaction[] = [
        // Lote 1: Comprado em 2025-01-01 com taxa de 12% a.a. (10 unidades a R$100 cada = R$1000)
        {
          id: 't1',
          portfolio_id: 'p1',
          ticker: 'SELIC 29',
          operation_type: 'buy',
          quantity: 10,
          price: 100,
          date: '2025-01-01',
          contract_rate: 12,
          created_at: '',
        },
        // Lote 2: Comprado em 2025-06-01 com taxa de 8% a.a. (5 unidades a R$100 cada = R$500)
        {
          id: 't2',
          portfolio_id: 'p1',
          ticker: 'SELIC 29',
          operation_type: 'buy',
          quantity: 5,
          price: 100,
          date: '2025-06-01',
          contract_rate: 8,
          created_at: '',
        },
        // Venda: 4 unidades em 2025-08-01 (subtrai 4 unidades do Lote 1 via FIFO, restando 6 unidades no Lote 1 e 5 no Lote 2)
        {
          id: 't3',
          portfolio_id: 'p1',
          ticker: 'SELIC 29',
          operation_type: 'sell',
          quantity: 4,
          price: 110,
          date: '2025-08-01',
          created_at: '',
        }
      ]

      // Valorização em 2026-01-01
      // Lote 1 ativo: 6 unidades a R$100 = R$600 principal. Taxa = 12% a.a. por 365 dias -> 672
      // Lote 2 ativo: 5 unidades a R$100 = R$500 principal. Taxa = 8% a.a. por 214 dias (2025-06-01 a 2026-01-01) -> ~522.9
      // Total esperado ~ 1194.9
      const value = calculateLotBasedFixedIncomeValue({
        transactions,
        ticker: 'SELIC 29',
        definition,
        asOfDate: '2026-01-01',
        indexRates: {},
      })

      expect(value).toBeGreaterThan(1190)
      expect(value).toBeLessThan(1200)
    })
  })
})
