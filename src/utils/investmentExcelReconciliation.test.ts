import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'fs'
import * as XLSX from 'xlsx'
import {
  parseB3Product,
  mapB3OperationType,
  parseB3Date,
  parseNumericValue,
  scoreInvestmentMatch,
  reconcileInvestmentTransactions,
  classifyB3Movement,
  classifyB3Item,
  deduplicateB3Items,
  parseB3Excel,
  computePositionsFromB3Items,
  parseB3PositionExcel,
  buildPositionValidation,
  suggestPositionAdjustments,
  isB3PositionWorkbook,
  isB3SubscriptionRightsTicker,
  type B3TransactionItem,
} from './investmentExcelReconciliation'
import type { PortfolioTransaction } from '@/types'

const baseItem = (overrides: Partial<B3TransactionItem>): B3TransactionItem => ({
  id: '1',
  date: '2026-05-20',
  direction: 'Credito',
  operation_type: 'buy',
  raw_operation_type: 'Compra',
  movement_category: 'trade',
  ticker: 'EGIE3',
  product_name: 'ENGIE',
  institution: 'BTG',
  quantity: 10,
  price: 40,
  total_value: 400,
  ...overrides,
})

describe('B3 Investment Reconciliation Utilities', () => {
  describe('classifyB3Movement', () => {
    it('classifica negociação, provento e ignorados', () => {
      expect(classifyB3Movement('Transferência - Liquidação')).toBe('trade')
      expect(classifyB3Movement('Dividendo')).toBe('income')
      expect(classifyB3Movement('Juros Sobre Capital Próprio')).toBe('income')
      expect(classifyB3Movement('Rendimento')).toBe('income')
      expect(classifyB3Movement('Transferência')).toBe('ignore')
      expect(classifyB3Movement('Transferência sem financeiro')).toBe('ignore')
      expect(classifyB3Movement('Empréstimo')).toBe('ignore')
      expect(classifyB3Movement('Cessão de Direitos')).toBe('ignore')
      expect(classifyB3Movement('Direito de Subscrição')).toBe('ignore')
      expect(classifyB3Movement('Direitos de Subscrição - Não Exercido')).toBe('ignore')
      
      // Renda Fixa e Tesouro
      expect(classifyB3Movement('Aplicação')).toBe('trade')
      expect(classifyB3Movement('Resgate')).toBe('trade')
      expect(classifyB3Movement('Vencimento')).toBe('trade')
      expect(classifyB3Movement('Pagamento de Juros')).toBe('income')
      expect(classifyB3Movement('Amortização')).toBe('income')
    })

    it('identifica ticker temporário de direito FII (XXXX12)', () => {
      expect(isB3SubscriptionRightsTicker('MXRF12')).toBe(true)
      expect(isB3SubscriptionRightsTicker('MXRF11')).toBe(false)
    })
  })

  describe('parseB3Product', () => {
    it('should split product into ticker and name when hyphen is present', () => {
      const { ticker, name } = parseB3Product('EGIE3 - ENGIE BRASIL ENERGIA S.A.')
      expect(ticker).toBe('EGIE3')
      expect(name).toBe('ENGIE BRASIL ENERGIA S.A.')
    })

    it('should split CDB and keep bank name as ticker and code as name', () => {
      const { ticker, name } = parseB3Product('CDB - CDBA2375JUX - BANCO XP S/A')
      expect(ticker).toBe('CDB - BANCO XP S/A')
      expect(name).toBe('CDBA2375JUX')
    })

    it('should split LCI and keep bank name as ticker and code as name, protecting BTG Pactual from corporate mapping', () => {
      const { ticker, name } = parseB3Product('LCI - 24F02320359 - BANCO BTG PACTUAL S/A - 29/12/2025')
      expect(ticker).toBe('LCI - BANCO BTG PACTUAL S/A')
      expect(name).toBe('24F02320359')
    })

    it('should format Direct Treasury tickers without prefix', () => {
      const { ticker: t1, name: n1 } = parseB3Product('TESOURO SELIC 2029 - Tesouro Selic 2029')
      expect(t1).toBe('SELIC 29')
      expect(n1).toBe('Tesouro Selic 2029')

      const { ticker: t2 } = parseB3Product('TESOURO IPCA+ 2035')
      expect(t2).toBe('IPCA 35')
    })
  })

  describe('mapB3OperationType', () => {
    it('should map Compra/Venda to buy/sell', () => {
      expect(mapB3OperationType('Compra')).toBe('buy')
      expect(mapB3OperationType('VENDA DE ATIVOS')).toBe('sell')
    })

    it('should map income types separately', () => {
      expect(mapB3OperationType('Dividendo')).toBe('dividend')
      expect(mapB3OperationType('Juros Sobre Capital Próprio')).toBe('jcp')
      expect(mapB3OperationType('Rendimento')).toBe('fii_yield')
    })

    it('should map COMPRA / VENDA by direction', () => {
      expect(mapB3OperationType('COMPRA / VENDA', 'Debito')).toBe('sell')
      expect(mapB3OperationType('COMPRA / VENDA', 'Credito')).toBe('buy')
    })

    it('should map Transferência - Liquidação by direction', () => {
      expect(mapB3OperationType('Transferência - Liquidação', 'Debito')).toBe('sell')
      expect(mapB3OperationType('Transferência - Liquidação', 'Credito', 532.3)).toBe('buy')
    })

    it('should map Subscrição, Desdobro e Grupamento', () => {
      expect(mapB3OperationType('Subscrição')).toBe('subscription')
      expect(mapB3OperationType('Desdobro')).toBe('split')
      expect(mapB3OperationType('Grupamento')).toBe('reverse_split')
    })

    it('should map Renda Fixa operations', () => {
      expect(mapB3OperationType('Aplicação')).toBe('buy')
      expect(mapB3OperationType('Resgate')).toBe('sell')
      expect(mapB3OperationType('Vencimento')).toBe('sell')
      expect(mapB3OperationType('Pagamento de Juros')).toBe('dividend')
    })
  })

  describe('parseNumericValue', () => {
    it('preserva decimal americano simples', () => {
      expect(parseNumericValue('532.3')).toBe(532.3)
    })

    it('interpreta formato brasileiro', () => {
      expect(parseNumericValue('1.234,56')).toBe(1234.56)
    })
  })

  describe('deduplicateB3Items', () => {
    it('remove par espelhado de Transferência sem alterar posição', () => {
      const items: B3TransactionItem[] = [
        baseItem({
          id: 'a',
          raw_operation_type: 'Transferência',
          direction: 'Credito',
          operation_type: 'buy',
          total_value: 0,
        }),
        baseItem({
          id: 'b',
          raw_operation_type: 'Transferência',
          direction: 'Debito',
          operation_type: 'sell',
          total_value: 0,
        }),
        baseItem({
          id: 'c',
          raw_operation_type: 'Transferência - Liquidação',
          operation_type: 'buy',
          total_value: 400,
        }),
      ]
      const { items: result, stats } = deduplicateB3Items(items)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('c')
      expect(stats.ignoredInternal).toBe(2)
    })

    it('prefere liquidação sobre compra explícita no mesmo grupo', () => {
      const items: B3TransactionItem[] = [
        baseItem({
          id: 'liq',
          raw_operation_type: 'Transferência - Liquidação',
          operation_type: 'buy',
        }),
        baseItem({
          id: 'compra',
          raw_operation_type: 'Compra',
          operation_type: 'buy',
        }),
      ]
      const { items: result, stats } = deduplicateB3Items(items)
      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('liq')
      expect(stats.dedupedTrades).toBe(1)
    })
  })

  describe('parseB3Date', () => {
    it('should parse DD/MM/YYYY date strings', () => {
      expect(parseB3Date('20/05/2026')).toBe('2026-05-20')
    })

    it('should parse Excel serial numbers', () => {
      expect(parseB3Date('46158')).toBe('2026-05-16')
    })
  })

  describe('scoreInvestmentMatch', () => {
    it('should return 0 for different tickers', () => {
      const official = baseItem({ id: '1', operation_type: 'buy' })
      const existing: PortfolioTransaction = {
        id: 'a',
        portfolio_id: 'p1',
        ticker: 'PETR4',
        operation_type: 'buy',
        quantity: 10,
        price: 40,
        date: '2026-05-20',
        created_at: '',
      }
      expect(scoreInvestmentMatch(official, existing)).toBe(0)
    })

    it('should match jcp with legacy dividend at reduced score', () => {
      const official = baseItem({
        operation_type: 'jcp',
        raw_operation_type: 'Juros Sobre Capital Próprio',
        price: 0.5,
        total_value: 5,
      })
      const existing: PortfolioTransaction = {
        id: 'a',
        portfolio_id: 'p1',
        ticker: 'EGIE3',
        operation_type: 'dividend',
        quantity: 10,
        price: 0.5,
        date: '2026-05-20',
        created_at: '',
      }
      const score = scoreInvestmentMatch(official, existing)
      expect(score).toBeGreaterThan(0.85)
      expect(score).toBeLessThan(1)
    })

    it('should match CDBs by keyword matching for Renda Fixa', () => {
      const official = baseItem({
        id: '1',
        ticker: 'CDB - BANCO MASTER - POS',
        product_name: 'CDB BANCO MASTER',
        operation_type: 'buy',
        quantity: 1,
        price: 1000,
        total_value: 1000,
      })
      const existing: PortfolioTransaction = {
        id: 'a',
        portfolio_id: 'p1',
        ticker: 'CDB BANCO MASTER 120% CDI',
        operation_type: 'buy',
        quantity: 1,
        price: 1000,
        date: '2026-05-20',
        created_at: '',
      }
      const score = scoreInvestmentMatch(official, existing)
      expect(score).toBeGreaterThan(0.9)
    })
  })

  describe('reconcileInvestmentTransactions', () => {
    it('should group transactions into matched, conflicts, and missing correctly', () => {
      const officialItems: B3TransactionItem[] = [
        baseItem({ id: '1', operation_type: 'buy' }),
        baseItem({
          id: '2',
          ticker: 'KLBN4',
          product_name: 'KLABIN',
          quantity: 100,
          price: 4.5,
          total_value: 450,
          operation_type: 'buy',
        }),
        baseItem({
          id: '3',
          operation_type: 'dividend',
          raw_operation_type: 'Dividendo',
          price: 0.5,
          total_value: 5,
        }),
      ]

      const existingTransactions: PortfolioTransaction[] = [
        {
          id: 'a',
          portfolio_id: 'p1',
          ticker: 'EGIE3',
          operation_type: 'buy',
          quantity: 10,
          price: 40,
          date: '2026-05-20',
          created_at: '',
        },
        {
          id: 'b',
          portfolio_id: 'p1',
          ticker: 'KLBN4',
          operation_type: 'buy',
          quantity: 100,
          price: 4.4,
          date: '2026-05-20',
          created_at: '',
        },
      ]

      const result = reconcileInvestmentTransactions(officialItems, existingTransactions)

      expect(result.matched).toHaveLength(1)
      expect(result.conflicts).toHaveLength(1)
      expect(result.missing).toHaveLength(1)
      expect(result.missing[0].operation_type).toBe('dividend')
    })

    it('should not steal matching transactions from other months', () => {
      const officialItems: B3TransactionItem[] = [
        baseItem({
          id: 'official-may',
          date: '2026-05-15',
          operation_type: 'fii_yield',
          raw_operation_type: 'Rendimento',
          quantity: 100,
          price: 0.1,
          total_value: 10,
          ticker: 'MXRF11',
        }),
        baseItem({
          id: 'official-april',
          date: '2026-04-15',
          operation_type: 'fii_yield',
          raw_operation_type: 'Rendimento',
          quantity: 100,
          price: 0.1,
          total_value: 10,
          ticker: 'MXRF11',
        }),
      ]

      const existingTransactions: PortfolioTransaction[] = [
        {
          id: 'existing-april',
          portfolio_id: 'p1',
          ticker: 'MXRF11',
          operation_type: 'fii_yield',
          quantity: 100,
          price: 0.1,
          date: '2026-04-15',
          created_at: '',
        },
      ]

      const result = reconcileInvestmentTransactions(officialItems, existingTransactions)

      expect(result.matched).toHaveLength(1)
      expect(result.matched[0].official.id).toBe('official-april')
      expect(result.missing).toHaveLength(1)
      expect(result.missing[0].id).toBe('official-may')
    })
  })

  describe('parseB3Excel — posições do extrato de referência', () => {
    const samplePath = 'movimentacao-2026-05-27-00-50-50.xlsx'

    it('calcula cotas BBAS3, GGRC11, BCFF11 e ALZM11 conforme custódia', () => {
      if (!existsSync(samplePath)) return

      const fileBuffer = readFileSync(samplePath)
      const { items } = parseB3Excel(
        fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
      )

      const equityItems = items.filter((item) => {
        if (isB3SubscriptionRightsTicker(item.ticker)) return false
        const category = classifyB3Item(item.ticker, item.product_name)
        return category === 'equityB3'
      })

      const positions = computePositionsFromB3Items(equityItems)

      // Regressão do bug de desdobro (multiplicar em vez de somar)
      const legacyMultiply = (ticker: string) => {
        let q = 0
        const rows = equityItems
          .filter((i) => i.ticker === ticker)
          .sort((a, b) => a.date.localeCompare(b.date))
        for (const row of rows) {
          if (row.operation_type === 'buy' || row.operation_type === 'subscription') q += row.quantity
          else if (row.operation_type === 'sell') q = Math.max(0, q - row.quantity)
          else if (row.operation_type === 'split') q *= row.quantity
          else if (row.operation_type === 'reverse_split') q = Math.max(0, q - row.quantity)
        }
        return q
      }

      expect(legacyMultiply('BBAS3')).toBeGreaterThan(positions.BBAS3 ?? 0)
      expect(legacyMultiply('GGRC11')).toBeGreaterThan(positions.GGRC11 ?? 0)

      const custodyChecks: Record<string, number> = {
        GGRC11: 55,
        HGLG11: 5,
        LVBI11: 5,
        NEWL11: 2,
        RZTR11: 8,
        TGAR11: 4,
        VISC11: 5,
        XPML11: 5,
        BBAS3: 30,
        KLBN4: 146,
        SAPR4: 102,
      }
      for (const [ticker, expected] of Object.entries(custodyChecks)) {
        const actual = positions[ticker] ?? 0
        expect(Math.abs(actual - expected), `${ticker} expected ${expected} got ${actual}`).toBeLessThan(
          1.5
        )
      }
    })
  })

  describe('parseB3PositionExcel', () => {
    const positionFixture = 'posicao-2026-06-01-13-29-37.xlsx'

    it('detecta planilha de posição vs movimentação', () => {
      if (!existsSync(positionFixture)) return
      const movFixture = 'movimentacao-2026-05-27-00-50-50.xlsx'
      const posBuf = readFileSync(positionFixture).buffer
      expect(isB3PositionWorkbook(posBuf)).toBe(true)
      if (existsSync(movFixture)) {
        const movBuf = readFileSync(movFixture).buffer
        expect(isB3PositionWorkbook(movBuf)).toBe(false)
      }
    })

    it('extrai cotas de ações, FIIs e ETF do relatório de posição', () => {
      if (!existsSync(positionFixture)) return
      const buf = readFileSync(positionFixture).buffer
      const parsed = parseB3PositionExcel(buf)
      expect(parsed.equity.BBAS3).toBe(30)
      expect(parsed.equity.GGRC11).toBe(55)
      expect(parsed.equity.AUVP11).toBe(1)
      expect(parsed.equity.WEGE3).toBe(7)
      expect(parsed.treasury['BRSTNCNTB7T1'] ?? Object.keys(parsed.treasury).length).toBeGreaterThan(0)
    })

    it('buildPositionValidation marca divergência entre fontes', () => {
      const result = buildPositionValidation(
        { BBAS3: 30, WEGE3: 7 },
        { BBAS3: 30, WEGE3: 5 },
        { BBAS3: 28, WEGE3: 7 }
      )
      expect(result.allOk).toBe(false)
      expect(result.rows.find((r) => r.ticker === 'WEGE3')?.status).toBe('movements_official')
      expect(result.rows.find((r) => r.ticker === 'BBAS3')?.status).toBe('system_official')
      expect(result.rows.find((r) => r.ticker === 'WEGE3')?.manualAction).toBeTruthy()
    })

    it('suggestPositionAdjustments propõe compra/venda para alinhar ao oficial', () => {
      const validation = buildPositionValidation({ BBAS3: 30 }, { BBAS3: 30 }, { BBAS3: 25 })
      const suggestions = suggestPositionAdjustments(validation, [], [])
      expect(suggestions).toHaveLength(1)
      expect(suggestions[0]?.ticker).toBe('BBAS3')
      expect(suggestions[0]?.operation_type).toBe('buy')
      expect(suggestions[0]?.quantity).toBe(5)
    })

    it('suggestPositionAdjustments propõe ajustes para Renda Fixa privada', () => {
      const validation = buildPositionValidation(
        { 'CDB - BANCO MASTER': 1000, 'PETR4': 100 },
        { 'CDB - BANCO MASTER': 1000, 'PETR4': 100 },
        { 'CDB - BANCO MASTER': 800, 'PETR4': 80 }
      )
      const suggestions = suggestPositionAdjustments(validation, [], [])
      expect(suggestions).toHaveLength(2)
      expect(suggestions[0]?.ticker).toBe('CDB - BANCO MASTER')
      expect(suggestions[1]?.ticker).toBe('PETR4')
    })
  })

  describe('parseB3Excel - tratamento de Renda Fixa zerada', () => {
    it('ignora movimentações de renda fixa zeradas', () => {
      const headers = ['Data', 'Movimentação', 'Produto', 'Instituição', 'Quantidade', 'Preço unitário', 'Valor da Operação', 'Entrada/Saída']
      const rows = [
        headers,
        // Transação de Renda Fixa válida
        ['20/05/2026', 'Aplicação', 'CDB - CDB12300ZTB - BANCO MASTER', 'BTG', '3500', '1.00', '3500.00', 'Credito'],
        // Transação de Renda Fixa zerada (preço e total zerados)
        ['20/05/2026', 'Aplicação', 'CDB - CDB12300ZTB - BANCO MASTER', 'BTG', '3500', '0.00', '0.00', 'Credito'],
        // Outra transação zerada (valor total zerado)
        ['20/05/2026', 'Aplicação', 'CDB - CDB12300ZTB - BANCO MASTER', 'BTG', '3500', '1.00', '0.00', 'Credito'],
        // Transação de Renda Variável válida (para garantir que outras continuam funcionando)
        ['20/05/2026', 'Compra', 'WEGE3', 'BTG', '10', '40.00', '400.00', 'Credito']
      ]
      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Movimentações')
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
      
      const { items } = parseB3Excel(buffer)
      expect(items).toHaveLength(2) // Apenas a Renda Fixa de 3500 e o WEGE3 de 10
      expect(items[0].ticker).toBe('CDB - BANCO MASTER')
      expect(items[0].price).toBe(1)
      expect(items[1].ticker).toBe('WEGE3')
    })
  })
})
