/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useReconciliationDrafts } from '@/hooks/useReconciliationDrafts'
import type { PortfolioOperationType, PortfolioTransaction } from '@/types'
import type { B3TransactionItem } from '@/utils/investmentExcelReconciliation'

// Mock priceService — isB3TickerPattern is a pure regex check
vi.mock('@/services/priceService', () => ({
  isB3TickerPattern: (ticker: string) => /^[A-Z]{4}[0-9]{1,2}$/i.test(String(ticker || '').trim()),
}))

function makeMissingDraft(overrides: Partial<ReturnType<typeof useReconciliationDrafts>['missingDrafts'][number]> = {}) {
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
    official: { id: 'b3-1', date: '2025-01-15', ticker: 'WEGE3', quantity: 10, price: 45.50 } as B3TransactionItem,
    indexer: 'none' as const,
    indexer_percent: '',
    contract_rate: '',
    maturity_date: '',
    ...overrides,
  }
}

function makeConflictDraft(overrides: Partial<ReturnType<typeof useReconciliationDrafts>['conflictDrafts'][number]> = {}) {
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
    official: { id: 'b3-1', date: '2025-01-15', ticker: 'WEGE3', quantity: 10, price: 45.50 } as B3TransactionItem,
    existing: { id: 'tx-1', ticker: 'WEGE3', date: '2025-01-15', quantity: 10, price: 45.00 } as PortfolioTransaction,
    ...overrides,
  }
}

describe('useReconciliationDrafts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('inicializa com arrays vazios e contagens zeradas', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      expect(result.current.missingDrafts).toEqual([])
      expect(result.current.conflictDrafts).toEqual([])
      expect(result.current.importedDrafts).toEqual([])
      expect(result.current.selectedMissingCount).toBe(0)
      expect(result.current.selectedConflictCount).toBe(0)
      expect(result.current.manualYieldRequiredAssets).toEqual([])
    })
  })

  describe('setting drafts via setters', () => {
    it('setMissingDrafts atualiza a lista', () => {
      const { result } = renderHook(() => useReconciliationDrafts())
      const draft = makeMissingDraft()

      act(() => { result.current.setMissingDrafts([draft]) })

      expect(result.current.missingDrafts).toHaveLength(1)
      expect(result.current.missingDrafts[0].ticker).toBe('WEGE3')
    })

    it('setConflictDrafts atualiza a lista', () => {
      const { result } = renderHook(() => useReconciliationDrafts())
      const conflict = makeConflictDraft()

      act(() => { result.current.setConflictDrafts([conflict]) })

      expect(result.current.conflictDrafts).toHaveLength(1)
      expect(result.current.conflictDrafts[0].key).toBe('tx-1::b3-1')
    })

    it('setImportedDrafts atualiza a lista', () => {
      const { result } = renderHook(() => useReconciliationDrafts())
      const draft = makeMissingDraft({ id: 'imported-1' })

      act(() => { result.current.setImportedDrafts([draft]) })

      expect(result.current.importedDrafts).toHaveLength(1)
      expect(result.current.importedDrafts[0].id).toBe('imported-1')
    })
  })

  describe('selectedMissingCount', () => {
    it('conta apenas drafts selecionados', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setMissingDrafts([
          makeMissingDraft({ id: '1', selected: true }),
          makeMissingDraft({ id: '2', selected: false }),
          makeMissingDraft({ id: '3', selected: true }),
        ])
      })

      expect(result.current.selectedMissingCount).toBe(2)
    })

    it('retorna 0 quando nenhum draft selecionado', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setMissingDrafts([
          makeMissingDraft({ id: '1', selected: false }),
          makeMissingDraft({ id: '2', selected: false }),
        ])
      })

      expect(result.current.selectedMissingCount).toBe(0)
    })
  })

  describe('selectedConflictCount', () => {
    it('conta conflitos selecionados e não aplicados', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setConflictDrafts([
          makeConflictDraft({ key: '1', selected: true, applied: false }),
          makeConflictDraft({ key: '2', selected: false, applied: false }),
          makeConflictDraft({ key: '3', selected: true, applied: true }),
          makeConflictDraft({ key: '4', selected: true, applied: false }),
        ])
      })

      expect(result.current.selectedConflictCount).toBe(2) // keys 1 and 4
    })

    it('retorna 0 quando nenhum conflito aplicável', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setConflictDrafts([
          makeConflictDraft({ key: '1', selected: false, applied: false }),
          makeConflictDraft({ key: '2', selected: true, applied: true }),
        ])
      })

      expect(result.current.selectedConflictCount).toBe(0)
    })
  })

  describe('manualYieldRequiredAssets', () => {
    it('filtra apenas drafts fixed_income, manual_value ou isTreasury', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setImportedDrafts([
          makeMissingDraft({ id: '1', ticker: 'WEGE3', pricing_mode: 'market', isTreasury: false }),
          makeMissingDraft({ id: '2', ticker: 'CDB-BANCO XP', pricing_mode: 'fixed_income', isTreasury: false }),
          makeMissingDraft({ id: '3', ticker: 'SELIC 26', pricing_mode: 'fixed_income', isTreasury: true }),
        ])
      })

      expect(result.current.manualYieldRequiredAssets).toHaveLength(2)
      expect(result.current.manualYieldRequiredAssets.map((a) => a.id)).toEqual(['2', '3'])
    })

    it('deduplica pelo ticker (maiúsculo + trim) mantendo o primeiro com indexador não-none', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setImportedDrafts([
          makeMissingDraft({
            id: '1',
            ticker: 'CDB-BANCO XP',
            pricing_mode: 'fixed_income',
            indexer: 'none',
            date: '2025-01-01',
          }),
          makeMissingDraft({
            id: '2',
            ticker: '  cdb-banco xp  ',
            pricing_mode: 'fixed_income',
            indexer: 'cdi',
            date: '2025-01-02',
          }),
        ])
      })

      // Deve manter apenas 1 (o que tem indexador CDI)
      expect(result.current.manualYieldRequiredAssets).toHaveLength(1)
      expect(result.current.manualYieldRequiredAssets[0].id).toBe('2')
    })

    it('ordena por data depois ticker', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setImportedDrafts([
          makeMissingDraft({ id: '1', ticker: 'CDB-BRADESCO', pricing_mode: 'fixed_income', date: '2025-02-01' }),
          makeMissingDraft({ id: '2', ticker: 'LCI-SANTANDER', pricing_mode: 'fixed_income', date: '2025-01-15' }),
        ])
      })

      expect(result.current.manualYieldRequiredAssets).toHaveLength(2)
      expect(result.current.manualYieldRequiredAssets[0].id).toBe('2') // data mais antiga primeiro
      expect(result.current.manualYieldRequiredAssets[1].id).toBe('1')
    })

    it('retorna array vazio se nenhum draft requer yield config', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setImportedDrafts([
          makeMissingDraft({ id: '1', ticker: 'WEGE3', pricing_mode: 'market', isTreasury: false }),
        ])
      })

      expect(result.current.manualYieldRequiredAssets).toEqual([])
    })
  })

  describe('updateMissingDraft', () => {
    it('atualiza campo específico pelo id', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => { result.current.setMissingDrafts([makeMissingDraft({ id: 'd-1', quantity: '10' })]) })

      act(() => { result.current.updateMissingDraft('d-1', 'quantity', '25') })

      expect(result.current.missingDrafts[0].quantity).toBe('25')
    })

    it('não modifica se id não encontrado', () => {
      const { result } = renderHook(() => useReconciliationDrafts())
      const draft = makeMissingDraft({ id: 'd-1' })

      act(() => { result.current.setMissingDrafts([draft]) })
      act(() => { result.current.updateMissingDraft('inexistente', 'quantity', '99') })

      expect(result.current.missingDrafts).toHaveLength(1)
      expect(result.current.missingDrafts[0].quantity).toBe('10')
    })

    it('atualiza isB3Linked e isTreasury ao mudar ticker', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => { result.current.setMissingDrafts([makeMissingDraft({ id: 'd-1', ticker: 'WEGE3' })]) })
      // Muda ticker para tesouro SELIC — o código também marca isB3Linked quando
      // o ticker casa com /^(IPCA|SELIC|PRE)\s+\d{2}$/ (tesouro também é B3)
      act(() => { result.current.updateMissingDraft('d-1', 'ticker', 'SELIC 26') })

      expect(result.current.missingDrafts[0].isTreasury).toBe(true)
      // SELIC 26 casa com /^(IPCA|SELIC|PRE)\s+\d{2}$/ → isB3Linked = true
      expect(result.current.missingDrafts[0].isB3Linked).toBe(true)

      // Ticker sem padrão algum — isB3Linked e isTreasury devem ser false
      act(() => { result.current.updateMissingDraft('d-1', 'ticker', 'BTC-USD') })
      expect(result.current.missingDrafts[0].isB3Linked).toBe(false)
      expect(result.current.missingDrafts[0].isTreasury).toBe(false)
    })

    it('sincroniza indexador para drafts com mesmo ticker', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setMissingDrafts([
          makeMissingDraft({ id: 'd-1', ticker: 'CDB-BANCO XP', indexer: 'none' }),
          makeMissingDraft({ id: 'd-2', ticker: 'CDB-BANCO XP', indexer: 'none' }),
        ])
      })

      act(() => { result.current.updateMissingDraft('d-1', 'indexer', 'cdi') })

      // Ambos os drafts com mesmo ticker devem ter indexer atualizado
      expect(result.current.missingDrafts[0].indexer).toBe('cdi')
      expect(result.current.missingDrafts[1].indexer).toBe('cdi')
    })

    it('não sincroniza quantity para outros drafts com mesmo ticker', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setMissingDrafts([
          makeMissingDraft({ id: 'd-1', ticker: 'WEGE3', quantity: '10' }),
          makeMissingDraft({ id: 'd-2', ticker: 'WEGE3', quantity: '20' }),
        ])
      })

      act(() => { result.current.updateMissingDraft('d-1', 'quantity', '99') })

      // Apenas o draft com id d-1 deve ter quantity alterada
      expect(result.current.missingDrafts[0].quantity).toBe('99')
      expect(result.current.missingDrafts[1].quantity).toBe('20')
    })
  })

  describe('updateImportedDraft', () => {
    it('atualiza draft importado por ticker (case insensitive + trim)', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setImportedDrafts([
          makeMissingDraft({ id: 'imp-1', ticker: 'CDB-BANCO XP', indexer: 'none' }),
        ])
      })

      act(() => { result.current.updateImportedDraft('imp-1', 'indexer', 'cdi') })

      expect(result.current.importedDrafts[0].indexer).toBe('cdi')
    })
  })

  describe('resetDraftState', () => {
    it('limpa todos os drafts', () => {
      const { result } = renderHook(() => useReconciliationDrafts())

      act(() => {
        result.current.setMissingDrafts([makeMissingDraft()])
        result.current.setConflictDrafts([makeConflictDraft()])
        result.current.setImportedDrafts([makeMissingDraft({ id: 'imp-1' })])
      })

      expect(result.current.missingDrafts).toHaveLength(1)
      expect(result.current.conflictDrafts).toHaveLength(1)
      expect(result.current.importedDrafts).toHaveLength(1)

      act(() => { result.current.resetDraftState() })

      expect(result.current.missingDrafts).toEqual([])
      expect(result.current.conflictDrafts).toEqual([])
      expect(result.current.importedDrafts).toEqual([])
    })
  })
})
