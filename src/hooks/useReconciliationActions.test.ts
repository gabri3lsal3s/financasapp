/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReconciliationActions } from '@/hooks/useReconciliationActions'
import type { PortfolioOperationType, PortfolioTransaction, PortfolioAssetDefinition } from '@/types'
import type { MissingDraft, ConflictDraft } from '@/hooks/useReconciliationDrafts'
import type { PositionAdjustmentSuggestion, InvestmentReconciliationResult } from '@/utils/investmentExcelReconciliation'

// ── Mocks com vi.hoisted() para evitar ReferenceError de hoisting ──

const { mockFrom, mockInsert, mockUpsert, mockDelete, mockUpdate } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockInsert: vi.fn(),
  mockUpsert: vi.fn(),
  mockDelete: vi.fn(),
  mockUpdate: vi.fn(),
}))

// Query builder factory — todas as chamadas retornam o builder (chain) e .then() resolve
// Os mocks hoisted são usados como wrappers para tracking: cada método chama o mock correspondente
// e retorna o builder para encadeamento.
const buildQueryBuilder = (data: any = null) => {
  const qb = {
    select: vi.fn().mockReturnThis(),
    insert: (...args: any[]) => { mockInsert(...args); return qb },
    upsert: (...args: any[]) => { mockUpsert(...args); return qb },
    update: (...args: any[]) => { mockUpdate(...args); return qb },
    delete: (...args: any[]) => { mockDelete(...args); return qb },
    eq: (...args: any[]) => { mockUpdate(...args); return qb },
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    then: (onfulfilled: (val: any) => any) =>
      Promise.resolve({ data, error: null }).then(onfulfilled),
  }
  return qb
}

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Mock services ──
const mockFetchPortfolioCashContext = vi.fn()
const mockReconcileCashOffsetOnTransactionSave = vi.fn()
const mockDeleteCashOffsetTransactions = vi.fn()

vi.mock('@/services/cashOffsetService', () => ({
  fetchPortfolioCashContext: (...args: any[]) => mockFetchPortfolioCashContext(...args),
  reconcileCashOffsetOnTransactionSave: (...args: any[]) => mockReconcileCashOffsetOnTransactionSave(...args),
  deleteCashOffsetTransactions: (...args: any[]) => mockDeleteCashOffsetTransactions(...args),
  syncPortfolioCashAfterBatch: vi.fn().mockResolvedValue(undefined),
  insertOffsetsBatch: vi.fn().mockResolvedValue(undefined),
}))

const mockCalculateLedgerCashBalance = vi.fn()
const mockGenerateBatchCashOffsetTransactions = vi.fn()

vi.mock('@/utils/cashBalanceApplication', () => ({
  calculateLedgerCashBalance: (...args: any[]) => mockCalculateLedgerCashBalance(...args),
  generateBatchCashOffsetTransactions: (...args: any[]) => mockGenerateBatchCashOffsetTransactions(...args),
}))

vi.mock('@/services/priceService', () => ({
  isB3TickerPattern: (t: string) => /^[A-Z]{4}[0-9]{1,2}$/i.test(String(t || '').trim()),
  isTreasuryTicker: (t: string) =>
    String(t || '').toUpperCase().includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(String(t || '').trim()),
  detectDefaultCurrency: () => 'BRL',
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

// ── Helpers ──

const PORTFOLIO_ID = 'portfolio-123'
const noop = () => {}
const defaultScrollToTop = vi.fn()

function makeMissingDraft(overrides: Partial<MissingDraft> = {}): MissingDraft {
  return {
    id: 'draft-1',
    selected: true,
    ticker: 'WEGE3',
    date: '2025-01-15',
    operation_type: 'buy' as PortfolioOperationType,
    quantity: '10',
    price: '45.50',
    pricing_mode: 'market' as const,
    isB3Linked: true,
    isTreasury: false,
    product_name: 'WEG ON',
    official: { id: 'b3-1', date: '2025-01-15', ticker: 'WEGE3', quantity: 10, price: 45.50 } as any,
    indexer: 'none' as const,
    indexer_percent: '',
    contract_rate: '',
    maturity_date: '',
    ...overrides,
  }
}

function makeConflictDraft(overrides: Partial<ConflictDraft> = {}): ConflictDraft {
  return {
    key: 'tx-1::b3-1',
    existingId: 'tx-1',
    officialId: 'b3-1',
    selected: true,
    applied: false,
    date: '2025-01-15',
    quantity: '10',
    price: '45.50',
    operation_type: 'buy' as PortfolioOperationType,
    official: { id: 'b3-1', date: '2025-01-15', ticker: 'WEGE3', quantity: 10, price: 45.50 } as any,
    existing: { id: 'tx-1', ticker: 'WEGE3', date: '2025-01-15', quantity: 10, price: 45.00 } as any,
    ...overrides,
  }
}

function makeAdjustmentSuggestion(overrides: Partial<PositionAdjustmentSuggestion> = {}): PositionAdjustmentSuggestion {
  return {
    ticker: 'WEGE3',
    date: '2025-01-20',
    quantity: 10,
    price: 50,
    operation_type: 'buy' as PortfolioOperationType,
    ...overrides,
  }
}

function defaultOptions(overrides: Partial<Parameters<typeof useReconciliationActions>[0]> = {}) {
  return {
    portfolioId: PORTFOLIO_ID,
    onSaved: noop,
    scrollToTop: defaultScrollToTop,
    setConflictDrafts: vi.fn(),
    setMissingDrafts: vi.fn(),
    setImportedDrafts: vi.fn(),
    setReconciliation: vi.fn(),
    reconciliation: null,
    conflictDrafts: [],
    missingDrafts: [],
    importedDrafts: [],
    manualYieldRequiredAssets: [],
    positionAdjustments: [],
    goToNextStepAfter: vi.fn(),
    ...overrides,
  }
}

describe('useReconciliationActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchPortfolioCashContext.mockResolvedValue({ transactions: [], definitions: [] })
    mockReconcileCashOffsetOnTransactionSave.mockResolvedValue(undefined)
    mockDeleteCashOffsetTransactions.mockResolvedValue(undefined)
    mockCalculateLedgerCashBalance.mockReturnValue(0)
    mockGenerateBatchCashOffsetTransactions.mockReturnValue([])
    // Mock supabase query builder
    mockFrom.mockImplementation(() => buildQueryBuilder())
    mockDelete.mockClear()
    mockUpdate.mockClear()
  })

  describe('initial state', () => {
    it('inicializa com loading false e progress null', () => {
      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      expect(result.current.loading).toBe(false)
      expect(result.current.progress).toBeNull()
      expect(result.current.selectedAdjustmentTickers).toBeInstanceOf(Set)
      expect(result.current.selectedAdjustmentTickers.size).toBe(0)
    })
  })

  describe('handleToggleAdjustment', () => {
    it('adiciona ticker ao conjunto', () => {
      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      act(() => { result.current.handleToggleAdjustment('WEGE3') })

      expect(result.current.selectedAdjustmentTickers.has('WEGE3')).toBe(true)
      expect(result.current.selectedAdjustmentTickers.size).toBe(1)
    })

    it('remove ticker já existente', () => {
      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      act(() => { result.current.handleToggleAdjustment('WEGE3') })
      act(() => { result.current.handleToggleAdjustment('WEGE3') })

      expect(result.current.selectedAdjustmentTickers.has('WEGE3')).toBe(false)
      expect(result.current.selectedAdjustmentTickers.size).toBe(0)
    })

    it('mantém outros tickers ao alternar', () => {
      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      act(() => { result.current.handleToggleAdjustment('WEGE3') })
      act(() => { result.current.handleToggleAdjustment('PETR4') })
      act(() => { result.current.handleToggleAdjustment('WEGE3') })

      expect(result.current.selectedAdjustmentTickers.has('WEGE3')).toBe(false)
      expect(result.current.selectedAdjustmentTickers.has('PETR4')).toBe(true)
    })
  })

  describe('handleSelectAllAdjustments', () => {
    it('seleciona todos os ajustes disponíveis', () => {
      const adjustments = [
        makeAdjustmentSuggestion({ ticker: 'WEGE3' }),
        makeAdjustmentSuggestion({ ticker: 'PETR4' }),
      ]

      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({ positionAdjustments: adjustments })),
      )

      act(() => { result.current.handleSelectAllAdjustments(true) })

      expect(result.current.selectedAdjustmentTickers.has('WEGE3')).toBe(true)
      expect(result.current.selectedAdjustmentTickers.has('PETR4')).toBe(true)
      expect(result.current.selectedAdjustmentTickers.size).toBe(2)
    })

    it('limpa seleção quando false', () => {
      const adjustments = [makeAdjustmentSuggestion({ ticker: 'WEGE3' })]

      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({ positionAdjustments: adjustments })),
      )

      act(() => { result.current.handleSelectAllAdjustments(true) })
      act(() => { result.current.handleSelectAllAdjustments(false) })

      expect(result.current.selectedAdjustmentTickers.size).toBe(0)
    })
  })

  describe('handleApplySelectedConflicts', () => {
    it('não faz nada quando não há conflitos selecionados', async () => {
      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      await act(async () => { await result.current.handleApplySelectedConflicts() })

      expect(mockFrom).not.toHaveBeenCalled()
    })

    it('aplica conflitos e atualiza estado', async () => {
      const conflictDrafts = [makeConflictDraft({ selected: true, applied: false })]
      const setConflictDrafts = vi.fn()
      const goToNextStepAfter = vi.fn()
      const onSaved = vi.fn()

      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({
          conflictDrafts,
          setConflictDrafts,
          goToNextStepAfter,
          onSaved,
        })),
      )

      await act(async () => { await result.current.handleApplySelectedConflicts() })

      // Deve ter chamado supabase update para a transação
      expect(mockFrom).toHaveBeenCalledWith('portfolio_transactions')
      expect(mockUpdate).toHaveBeenCalled()
      // Deve ter chamado o setter de conflitos e navegação
      expect(setConflictDrafts).toHaveBeenCalled()
      expect(goToNextStepAfter).toHaveBeenCalledWith('corrections')
      expect(onSaved).toHaveBeenCalled()
    })
  })

  describe('handleImportSelectedMissing', () => {
    it('não faz nada quando não há missing selecionados', async () => {
      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({ missingDrafts: [] })),
      )

      await act(async () => { await result.current.handleImportSelectedMissing() })

      expect(mockInsert).not.toHaveBeenCalled()
    })

    it('importa drafts selecionados em lote', async () => {
      const missingDrafts = [
        makeMissingDraft({ id: 'm1', selected: true, ticker: 'WEGE3', quantity: '10', price: '45.50' }),
      ]
      const setImportedDrafts = vi.fn()
      const setMissingDrafts = vi.fn()
      const goToNextStepAfter = vi.fn()
      const onSaved = vi.fn()

      mockFetchPortfolioCashContext.mockResolvedValue({ transactions: [], definitions: [] })
      mockCalculateLedgerCashBalance.mockReturnValue(500)

      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({
          missingDrafts,
          setImportedDrafts,
          setMissingDrafts,
          goToNextStepAfter,
          onSaved,
        })),
      )

      await act(async () => { await result.current.handleImportSelectedMissing() })

      expect(mockInsert).toHaveBeenCalled()
      expect(setImportedDrafts).toHaveBeenCalled()
      expect(setMissingDrafts).toHaveBeenCalled()
      expect(goToNextStepAfter).toHaveBeenCalledWith('corrections', missingDrafts)
    })
  })

  describe('handleSaveAssetYield', () => {
    it('chama supabase update com dados do indexador', async () => {
      const onSaved = vi.fn()
      const asset = makeMissingDraft({
        ticker: 'CDB-BANCO XP',
        indexer: 'cdi',
        indexer_percent: '100',
        contract_rate: '',
        maturity_date: '2027-12-31',
      })

      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({ onSaved })),
      )

      await act(async () => { await result.current.handleSaveAssetYield(asset) })

      expect(mockFrom).toHaveBeenCalledWith('portfolio_asset_definitions')
      expect(mockUpdate).toHaveBeenCalledWith({
        indexer: 'cdi',
        indexer_percent: 100,
        contract_rate: null,
        maturity_date: '2027-12-31',
        updated_at: expect.any(String),
      })
      expect(onSaved).toHaveBeenCalled()
    })
  })

  describe('handleDeleteLedgerOnlyTransaction', () => {
    it('não faz nada se usuário cancela', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false)

      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      await act(async () => { await result.current.handleDeleteLedgerOnlyTransaction('tx-1') })

      expect(mockDelete).not.toHaveBeenCalled()
    })

    it('deleta transação e atualiza saldo', async () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      mockCalculateLedgerCashBalance.mockReturnValue(0)
      mockFetchPortfolioCashContext.mockResolvedValue({ transactions: [], definitions: [] })

      const onSaved = vi.fn()
      const setReconciliation = vi.fn()
      const reconciliation = {
        matched: [],
        conflicts: [],
        missing: [],
        existingOnly: [{ id: 'tx-1' } as PortfolioTransaction],
      } as InvestmentReconciliationResult

      const { result } = renderHook(() =>
        useReconciliationActions(defaultOptions({ onSaved, reconciliation, setReconciliation })),
      )

      await act(async () => { await result.current.handleDeleteLedgerOnlyTransaction('tx-1') })

      expect(mockDelete).toHaveBeenCalled()
      expect(mockDeleteCashOffsetTransactions).toHaveBeenCalledWith(PORTFOLIO_ID, 'tx-1')
      expect(onSaved).toHaveBeenCalled()
    })
  })

  describe('resetActionsState', () => {
    it('limpa loading, progress e seleção', () => {
      const { result } = renderHook(() => useReconciliationActions(defaultOptions()))

      act(() => { result.current.handleToggleAdjustment('WEGE3') })
      expect(result.current.selectedAdjustmentTickers.size).toBe(1)

      act(() => { result.current.resetActionsState() })

      expect(result.current.loading).toBe(false)
      expect(result.current.progress).toBeNull()
      expect(result.current.selectedAdjustmentTickers.size).toBe(0)
    })
  })
})
