/* eslint-disable @typescript-eslint/no-explicit-any */
/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReconciliationFiles } from '@/hooks/useReconciliationFiles'
import type { PortfolioTransaction } from '@/types'

// ── Mocks ──

vi.mock('@/utils/investmentExcelReconciliation', () => ({
  parseB3Excel: vi.fn(),
  parseB3PositionExcel: vi.fn(),
  buildPositionValidation: vi.fn().mockReturnValue({
    rows: [],
    mismatchCount: 0,
    allOk: true,
  }),
  suggestPositionAdjustments: vi.fn().mockReturnValue([]),
  isB3PositionWorkbook: vi.fn().mockReturnValue(false),
  reconcileInvestmentTransactions: vi.fn().mockReturnValue({
    matched: [],
    conflicts: [],
    missing: [],
    existingOnly: [],
  }),
  classifyB3Item: vi.fn().mockImplementation((ticker: string) => {
    const t = ticker.toUpperCase()
    if (['CDB', 'LCI', 'LCA', 'CRI', 'CRA'].some((p) => t.startsWith(p))) return 'fixedIncome'
    if (t.includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(t)) return 'treasury'
    if (/^[A-Z]{4}[0-9]{1,2}$/.test(t)) return 'equityB3'
    return 'other'
  }),
  isB3SubscriptionRightsTicker: vi.fn().mockReturnValue(false),
  computePositionsFromB3Items: vi.fn().mockReturnValue({}),
}))

vi.mock('@/utils/portfolioLedger', () => ({
  computeTickerQuantity: vi.fn().mockImplementation(
    (transactions: PortfolioTransaction[], ticker: string) => {
      return transactions
        .filter((tx) => tx.ticker.toUpperCase() === ticker.toUpperCase())
        .reduce((sum, tx) => sum + tx.quantity, 0)
    },
  ),
}))

vi.mock('@/services/priceService', () => ({
  isB3TickerPattern: (ticker: string) => /^[A-Z]{4}[0-9]{1,2}$/i.test(String(ticker || '').trim()),
}))

vi.mock('@/utils/assetClassifier', () => ({
  isCashTicker: (ticker: string) => {
    const t = ticker.toUpperCase()
    return ['CAIXA', 'SALDO EM CAIXA', 'RESERVA'].includes(t)
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

// ── Helpers ──

function makeTransaction(overrides: Partial<PortfolioTransaction> = {}): PortfolioTransaction {
  return {
    id: 'tx-1',
    portfolio_id: 'p1',
    ticker: 'WEGE3',
    operation_type: 'buy',
    quantity: 10,
    price: 45.50,
    date: '2025-01-15',
    created_at: '',
    ...overrides,
  }
}

describe('useReconciliationFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('inicializa com valores padrão', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      expect(result.current.fileName).toBe('')
      expect(result.current.parseStatus).toBe('')
      expect(result.current.positionFileName).toBe('')
      expect(result.current.positionParseStatus).toBe('')
      expect(result.current.reconciliation).toBeNull()
      expect(result.current.parsedEquityItems).toEqual([])
      expect(result.current.detectedManualAssets).toEqual([])
      expect(result.current.dragActive).toBe(false)
      expect(result.current.positionDragActive).toBe(false)
      expect(result.current.officialPosition).toBeNull()
      expect(result.current.positionValidation).toBeNull()
      expect(result.current.positionAdjustments).toEqual([])
      expect(result.current.positionPreviewRows).toEqual([])
    })
  })

  describe('existingSystemTickers', () => {
    it('lista tickers únicos de transações não-caixa, ordenados', () => {
      const txs = [
        makeTransaction({ id: '1', ticker: 'PETR4' }),
        makeTransaction({ id: '2', ticker: 'WEGE3' }),
        makeTransaction({ id: '3', ticker: 'CAIXA' }),           // cash → excluded
        makeTransaction({ id: '4', ticker: 'wege3' }),            // same as #2 (case insensitive)
        makeTransaction({ id: '5', ticker: 'MXRF11' }),
      ]

      const { result } = renderHook(() => useReconciliationFiles(txs))

      expect(result.current.existingSystemTickers).toEqual(['MXRF11', 'PETR4', 'WEGE3'])
    })

    it('retorna array vazio quando só há caixa', () => {
      const txs = [
        makeTransaction({ id: '1', ticker: 'CAIXA' }),
        makeTransaction({ id: '2', ticker: 'SALDO EM CAIXA' }),
      ]

      const { result } = renderHook(() => useReconciliationFiles(txs))

      expect(result.current.existingSystemTickers).toEqual([])
    })
  })

  describe('systemPositions', () => {
    it('agrupa quantidades por ticker B3, excluindo caixa e RF', () => {
      const txs = [
        makeTransaction({ id: '1', ticker: 'WEGE3', quantity: 10 }),
        makeTransaction({ id: '2', ticker: 'WEGE3', quantity: 5 }),   // +5 = 15
        makeTransaction({ id: '3', ticker: 'PETR4', quantity: 20 }),
        makeTransaction({ id: '4', ticker: 'CAIXA', quantity: 1000 }), // cash → excluded
      ]

      const { result } = renderHook(() => useReconciliationFiles(txs))

      expect(result.current.systemPositions).toEqual({
        WEGE3: 15,
        PETR4: 20,
      })
    })

    it('exclui transações com cash_offset_source_id do conjunto de tickers, mas computeTickerQuantity soma todos', () => {
      const txs = [
        makeTransaction({ id: '1', ticker: 'WEGE3', quantity: 10 }),
        // transaction #2 has cash_offset_source_id — excluída do SET de tickers,
        // mas computeTickerQuantity soma todas as transações do mesmo ticker
        makeTransaction({ id: '2', ticker: 'WEGE3', quantity: 5, cash_offset_source_id: 'tx-1' }),
      ]

      const { result } = renderHook(() => useReconciliationFiles(txs))

      // systemPositions filtra cash_offset_source_id APENAS na construção do Set de tickers.
      // computeTickerQuantity soma tudo, então o resultado inclui ambas transações.
      // A transação #1 (sem cash_offset_source_id) garante que WEGE3 está no set.
      expect(result.current.systemPositions).toEqual({ WEGE3: 15 })
    })

    it('ignora tickers com quantidade <= 0.000001', () => {
      const txs = [
        makeTransaction({ id: '1', ticker: 'WEGE3', quantity: 0.0000001 }),
      ]

      const { result } = renderHook(() => useReconciliationFiles(txs))

      expect(result.current.systemPositions).toEqual({})
    })
  })

  describe('nonB3SystemPositions', () => {
    it('captura tickers não-B3 (fora do padrão B3)', () => {
      const txs = [
        makeTransaction({ id: '1', ticker: 'WEGE3' }),       // B3 → excluded from nonB3
        makeTransaction({ id: '2', ticker: 'BTC-USD' }),      // non-B3
        makeTransaction({ id: '3', ticker: 'APPLE' }),        // non-B3
      ]

      const { result } = renderHook(() => useReconciliationFiles(txs))

      // Object.keys segue ordem de inserção no objeto: BTC-USD primeiro, APPLE depois
      expect(Object.keys(result.current.nonB3SystemPositions)).toEqual(['BTC-USD', 'APPLE'])
    })
  })

  describe('b3ParsedPositions', () => {
    it('delega para computePositionsFromB3Items', async () => {
      const { computePositionsFromB3Items } = await import('@/utils/investmentExcelReconciliation')
      const { result } = renderHook(() => useReconciliationFiles([]))

      act(() => {
        result.current.setParsedEquityItems([{ id: 'b3-1' }] as any)
      })

      expect(computePositionsFromB3Items).toHaveBeenCalledWith([{ id: 'b3-1' }])
    })
  })

  describe('positionPreviewRows', () => {
    it('mescla posições B3 e do sistema', async () => {
      const { computePositionsFromB3Items } = await import('@/utils/investmentExcelReconciliation')
      vi.mocked(computePositionsFromB3Items).mockReturnValue({ WEGE3: 15, MXRF11: 100 })

      const txs = [makeTransaction({ id: '1', ticker: 'WEGE3', quantity: 15 })]
      const { result } = renderHook(() => useReconciliationFiles(txs))

      act(() => {
        result.current.setParsedEquityItems([{ id: 'b3-1' }] as any)
      })

      expect(result.current.positionPreviewRows).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ ticker: 'MXRF11', b3: 100, system: 0 }),
          expect.objectContaining({ ticker: 'WEGE3', b3: 15, system: 15 }),
        ]),
      )
    })
  })

  describe('detectedManualPositionAssets', () => {
    it('extrai ativos de renda fixa e tesouro da posição oficial', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      act(() => {
        result.current.setOfficialPosition({
          equity: {},
          fixedIncome: { 'CDB - BANCO XP': 2 },
          treasury: { 'SELIC 26': 5 },
          other: {},
        } as any)
      })

      expect(result.current.detectedManualPositionAssets).toEqual([
        { ticker: 'CDB - BANCO XP', quantity: 2, type: 'fixed_income' },
        { ticker: 'SELIC 26', quantity: 5, type: 'treasury' },
      ])
    })

    it('retorna array vazio quando officialPosition é null', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      expect(result.current.detectedManualPositionAssets).toEqual([])
    })
  })

  describe('setters', () => {
    it('setFileName atualiza o nome do arquivo', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      act(() => { result.current.setFileName('extrato.xlsx') })

      expect(result.current.fileName).toBe('extrato.xlsx')
    })

    it('setDragActive e setPositionDragActive alternam estado', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      act(() => { result.current.setDragActive(true) })
      expect(result.current.dragActive).toBe(true)

      act(() => { result.current.setPositionDragActive(true) })
      expect(result.current.positionDragActive).toBe(true)
    })

    it('setReconciliation atualiza o resultado', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))
      const mockReconciliation = { matched: [], conflicts: [], missing: [], existingOnly: [] }

      act(() => { result.current.setReconciliation(mockReconciliation as any) })

      expect(result.current.reconciliation).toEqual(mockReconciliation)
    })
  })

  describe('recomputePositionValidation', () => {
    it('chama buildPositionValidation e atualiza positionValidation', async () => {
      const { buildPositionValidation } = await import('@/utils/investmentExcelReconciliation')
      const mockValidation = { rows: [], mismatchCount: 0, allOk: true }
      vi.mocked(buildPositionValidation).mockReturnValue(mockValidation as any)

      const { result } = renderHook(() => useReconciliationFiles([]))

      act(() => {
        result.current.recomputePositionValidation(
          { equity: { WEGE3: 100 }, fixedIncome: {}, treasury: {}, other: {} } as any,
          { WEGE3: 90 },
          { WEGE3: 90 },
        )
      })

      expect(buildPositionValidation).toHaveBeenCalledWith(
        { WEGE3: 100 },
        { WEGE3: 90 },
        { WEGE3: 90 },
      )
      expect(result.current.positionValidation).toEqual(mockValidation)
    })
  })

  describe('positionAdjustments', () => {
    it('delega para suggestPositionAdjustments quando há positionValidation', async () => {
      const { suggestPositionAdjustments, buildPositionValidation } = await import('@/utils/investmentExcelReconciliation')
      const mockValidation = { rows: [{ ticker: 'WEGE3', status: 'mismatch' }], mismatchCount: 1, allOk: false }
      vi.mocked(buildPositionValidation).mockReturnValue(mockValidation as any)
      vi.mocked(suggestPositionAdjustments).mockReturnValue([
        { ticker: 'WEGE3', date: '2025-01-20', quantity: 10, price: 50, operation_type: 'buy' },
      ] as any)

      const { result } = renderHook(() => useReconciliationFiles([]))

      act(() => {
        result.current.recomputePositionValidation(
          { equity: { WEGE3: 100 }, fixedIncome: {}, treasury: {}, other: {} } as any,
          { WEGE3: 90 },
          { WEGE3: 90 },
        )
      })

      expect(result.current.positionAdjustments).toHaveLength(1)
      expect(result.current.positionAdjustments[0].ticker).toBe('WEGE3')
    })

    it('retorna array vazio quando positionValidation é null', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      expect(result.current.positionAdjustments).toEqual([])
    })
  })

  describe('resetFileState', () => {
    it('limpa todos os estados', () => {
      const { result } = renderHook(() => useReconciliationFiles([]))

      // Popula estado
      act(() => {
        result.current.setFileName('extrato.xlsx')
        result.current.setParseStatus('ok')
        result.current.setPositionFileName('posicao.xlsx')
        result.current.setPositionParseStatus('ok')
        result.current.setReconciliation({ matched: [], conflicts: [], missing: [], existingOnly: [] } as any)
        result.current.setParsedEquityItems([{ id: 'b3-1' }] as any)
        result.current.setDetectedManualAssets([{ ticker: 'CDB', type: 'fixed_income', product_name: 'CDB' }])
        result.current.setDragActive(true)
        result.current.setPositionDragActive(true)
        result.current.setOfficialPosition({ equity: {}, fixedIncome: {}, treasury: {}, other: {} } as any)
      })

      act(() => { result.current.resetFileState() })

      expect(result.current.fileName).toBe('')
      expect(result.current.parseStatus).toBe('')
      expect(result.current.positionFileName).toBe('')
      expect(result.current.positionParseStatus).toBe('')
      expect(result.current.reconciliation).toBeNull()
      expect(result.current.parsedEquityItems).toEqual([])
      expect(result.current.detectedManualAssets).toEqual([])
      expect(result.current.dragActive).toBe(false)
      expect(result.current.positionDragActive).toBe(false)
      expect(result.current.officialPosition).toBeNull()
      expect(result.current.positionValidation).toBeNull()
    })
  })
})
