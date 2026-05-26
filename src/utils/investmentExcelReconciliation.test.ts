import { describe, it, expect } from 'vitest'
import {
  parseB3Product,
  mapB3OperationType,
  parseB3Date,
  scoreInvestmentMatch,
  reconcileInvestmentTransactions,
  type B3TransactionItem,
} from './investmentExcelReconciliation'
import type { PortfolioTransaction } from '@/types'

describe('B3 Investment Reconciliation Utilities', () => {
  describe('parseB3Product', () => {
    it('should split product into ticker and name when hyphen is present', () => {
      const { ticker, name } = parseB3Product('EGIE3 - ENGIE BRASIL ENERGIA S.A.')
      expect(ticker).toBe('EGIE3')
      expect(name).toBe('ENGIE BRASIL ENERGIA S.A.')
    })

    it('should return full string for both ticker and name if hyphen is absent', () => {
      const { ticker, name } = parseB3Product('Tesouro Selic 2031')
      expect(ticker).toBe('TESOURO SELIC 2031')
      expect(name).toBe('Tesouro Selic 2031')
    })

    it('should split CDB and keep unique identifier as ticker', () => {
      const { ticker, name } = parseB3Product('CDB - CDBA2375JUX - BANCO XP S/A')
      expect(ticker).toBe('CDB - CDBA2375JUX')
      expect(name).toBe('BANCO XP S/A')
    })
  })

  describe('mapB3OperationType', () => {
    it('should map Compra/Venda to buy/sell', () => {
      expect(mapB3OperationType('Compra')).toBe('buy')
      expect(mapB3OperationType('VENDA DE ATIVOS')).toBe('sell')
    })

    it('should map Dividendo/Juros/Rendimento to dividend', () => {
      expect(mapB3OperationType('Dividendo')).toBe('dividend')
      expect(mapB3OperationType('Juros Sobre Capital Próprio')).toBe('dividend')
      expect(mapB3OperationType('Rendimento')).toBe('dividend')
    })

    it('should map Subscrição to subscription', () => {
      expect(mapB3OperationType('Subscrição')).toBe('subscription')
    })

    it('should map Desdobro to split', () => {
      expect(mapB3OperationType('Desdobro')).toBe('split')
    })

    it('should map generic Transferencia - Liquidacao to sell if direction is Debito and buy if direction is Credito', () => {
      expect(mapB3OperationType('Transferência - Liquidação', 'Debito')).toBe('sell')
      expect(mapB3OperationType('Transferência - Liquidação', 'Credito')).toBe('buy')
    })
  })

  describe('parseB3Date', () => {
    it('should parse DD/MM/YYYY date strings', () => {
      expect(parseB3Date('20/05/2026')).toBe('2026-05-20')
    })

    it('should parse YYYY-MM-DD date strings', () => {
      expect(parseB3Date('2026-05-20')).toBe('2026-05-20')
    })

    it('should parse Excel serial numbers', () => {
      // 46158 is 2026-05-16 in Excel serial date format (offset by 25569 days since 1899-12-30)
      expect(parseB3Date('46158')).toBe('2026-05-16')
    })
  })

  describe('scoreInvestmentMatch', () => {
    it('should return 0 for different tickers', () => {
      const official: B3TransactionItem = {
        id: '1', date: '2026-05-20', direction: 'Credito', operation_type: 'buy',
        raw_operation_type: 'Compra', ticker: 'EGIE3', product_name: 'ENGIE',
        institution: 'BTG', quantity: 10, price: 40, total_value: 400
      }
      const existing: PortfolioTransaction = {
        id: 'a', portfolio_id: 'p1', ticker: 'PETR4', operation_type: 'buy',
        quantity: 10, price: 40, date: '2026-05-20', created_at: ''
      }
      expect(scoreInvestmentMatch(official, existing)).toBe(0)
    })

    it('should return 1 for exact match', () => {
      const official: B3TransactionItem = {
        id: '1', date: '2026-05-20', direction: 'Credito', operation_type: 'buy',
        raw_operation_type: 'Compra', ticker: 'EGIE3', product_name: 'ENGIE',
        institution: 'BTG', quantity: 10, price: 40, total_value: 400
      }
      const existing: PortfolioTransaction = {
        id: 'a', portfolio_id: 'p1', ticker: 'EGIE3', operation_type: 'buy',
        quantity: 10, price: 40, date: '2026-05-20', created_at: ''
      }
      expect(scoreInvestmentMatch(official, existing)).toBe(1.0)
    })

    it('should calculate partial scores for different dates or values', () => {
      const official: B3TransactionItem = {
        id: '1', date: '2026-05-20', direction: 'Credito', operation_type: 'buy',
        raw_operation_type: 'Compra', ticker: 'EGIE3', product_name: 'ENGIE',
        institution: 'BTG', quantity: 10, price: 40, total_value: 400
      }
      const existing: PortfolioTransaction = {
        id: 'a', portfolio_id: 'p1', ticker: 'EGIE3', operation_type: 'buy',
        quantity: 10, price: 40, date: '2026-05-18', created_at: '' // diff 2 days
      }
      const score = scoreInvestmentMatch(official, existing)
      expect(score).toBeGreaterThan(0.5)
      expect(score).toBeLessThan(1.0)
    })
  })

  describe('reconcileInvestmentTransactions', () => {
    it('should group transactions into matched, conflicts, and missing correctly', () => {
      const officialItems: B3TransactionItem[] = [
        {
          id: '1', date: '2026-05-20', direction: 'Credito', operation_type: 'buy',
          raw_operation_type: 'Compra', ticker: 'EGIE3', product_name: 'ENGIE',
          institution: 'BTG', quantity: 10, price: 40, total_value: 400
        },
        {
          id: '2', date: '2026-05-20', direction: 'Credito', operation_type: 'buy',
          raw_operation_type: 'Compra', ticker: 'KLBN4', product_name: 'KLABIN',
          institution: 'BTG', quantity: 100, price: 4.5, total_value: 450
        },
        {
          id: '3', date: '2026-05-20', direction: 'Credito', operation_type: 'dividend',
          raw_operation_type: 'Dividendo', ticker: 'EGIE3', product_name: 'ENGIE',
          institution: 'BTG', quantity: 10, price: 0.5, total_value: 5
        }
      ]

      const existingTransactions: PortfolioTransaction[] = [
        {
          id: 'a', portfolio_id: 'p1', ticker: 'EGIE3', operation_type: 'buy',
          quantity: 10, price: 40, date: '2026-05-20', created_at: '' // exact match for 1
        },
        {
          id: 'b', portfolio_id: 'p1', ticker: 'KLBN4', operation_type: 'buy',
          quantity: 100, price: 4.4, date: '2026-05-20', created_at: '' // conflict in price for 2
        }
      ]

      const result = reconcileInvestmentTransactions(officialItems, existingTransactions)

      expect(result.matched).toHaveLength(1)
      expect(result.matched[0].official.ticker).toBe('EGIE3')

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].official.ticker).toBe('KLBN4')
      expect(result.conflicts[0].suggestedUpdate.needsUpdate).toBe(true)

      expect(result.missing).toHaveLength(1)
      expect(result.missing[0].ticker).toBe('EGIE3')
      expect(result.missing[0].operation_type).toBe('dividend')
    })

    it('should not steal matching transactions from other months or periods', () => {
      // Cenário de proventos mensais com o mesmo valor mas datas distintas:
      // O banco tem o provento de abril (15/04).
      // O extrato da B3 tem o provento de abril (15/04) e o provento de maio (15/05).
      // A transação de maio está "missing" no banco.
      // O sistema deve conciliar perfeitamente a de abril e reportar a de maio como "missing",
      // em vez de associar a de maio (mais recente) com o registro de abril (conflito) e deixar a de abril como "missing".
      
      const officialItems: B3TransactionItem[] = [
        {
          id: 'official-may', date: '2026-05-15', direction: 'Credito', operation_type: 'dividend',
          raw_operation_type: 'Rendimento', ticker: 'MXRF11', product_name: 'MXRF11 FII',
          institution: 'BTG', quantity: 100, price: 0.1, total_value: 10
        },
        {
          id: 'official-april', date: '2026-04-15', direction: 'Credito', operation_type: 'dividend',
          raw_operation_type: 'Rendimento', ticker: 'MXRF11', product_name: 'MXRF11 FII',
          institution: 'BTG', quantity: 100, price: 0.1, total_value: 10
        }
      ]

      const existingTransactions: PortfolioTransaction[] = [
        {
          id: 'existing-april', portfolio_id: 'p1', ticker: 'MXRF11', operation_type: 'dividend',
          quantity: 100, price: 0.1, date: '2026-04-15', created_at: ''
        }
      ]

      const result = reconcileInvestmentTransactions(officialItems, existingTransactions)

      // Deve casar o provento de abril de forma exata
      expect(result.matched).toHaveLength(1)
      expect(result.matched[0].official.id).toBe('official-april')
      expect(result.matched[0].existing.id).toBe('existing-april')

      // O provento de maio deve ser dado como faltando (missing)
      expect(result.missing).toHaveLength(1)
      expect(result.missing[0].id).toBe('official-may')

      // Não deve haver conflitos de data incorretos sugeridos (ex: mover a data de abril para maio)
      expect(result.conflicts).toHaveLength(0)
    })

    it('should respect strict date difference limits (max 10 days for dividends and 15 days for assets)', () => {
      const officialItems: B3TransactionItem[] = [
        {
          id: 'official-asset', date: '2026-05-20', direction: 'Credito', operation_type: 'buy',
          raw_operation_type: 'Compra', ticker: 'PETR4', product_name: 'PETROBRAS',
          institution: 'BTG', quantity: 100, price: 30, total_value: 3000
        },
        {
          id: 'official-div', date: '2026-05-20', direction: 'Credito', operation_type: 'dividend',
          raw_operation_type: 'Dividendo', ticker: 'PETR4', product_name: 'PETROBRAS',
          institution: 'BTG', quantity: 100, price: 1, total_value: 100
        }
      ]

      const existingTransactions: PortfolioTransaction[] = [
        {
          id: 'existing-asset', portfolio_id: 'p1', ticker: 'PETR4', operation_type: 'buy',
          quantity: 100, price: 30, date: '2026-05-04', created_at: '' // diff 16 days (> 15)
        },
        {
          id: 'existing-div', portfolio_id: 'p1', ticker: 'PETR4', operation_type: 'dividend',
          quantity: 100, price: 1, date: '2026-05-09', created_at: '' // diff 11 days (> 10)
        }
      ]

      const result = reconcileInvestmentTransactions(officialItems, existingTransactions)

      // Nenhuma das transações deve conciliar automaticamente por conta das restrições estritas de data
      expect(result.matched).toHaveLength(0)
      expect(result.conflicts).toHaveLength(0)
      expect(result.missing).toHaveLength(2)
    })
  })
})
