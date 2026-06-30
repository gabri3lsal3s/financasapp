import { useMemo, useState, useCallback } from 'react'
import { isB3TickerPattern } from '@/services/priceService'
import type { PortfolioOperationType, PortfolioPricingMode, PortfolioAssetIndexer } from '@/types'
import type { B3TransactionItem } from '@/utils/investmentExcelReconciliation'
import type { PortfolioTransaction } from '@/types'

export interface MissingDraft {
  id: string
  selected: boolean
  ticker: string
  date: string
  operation_type: PortfolioOperationType
  quantity: string
  price: string
  pricing_mode: PortfolioPricingMode
  isB3Linked: boolean
  isTreasury: boolean
  product_name: string
  official: B3TransactionItem
  indexer: PortfolioAssetIndexer
  indexer_percent: string
  contract_rate: string
  maturity_date: string
}

export interface ConflictDraft {
  key: string
  existingId: string
  officialId: string
  selected: boolean
  applied: boolean
  date: string
  quantity: string
  price: string
  operation_type: PortfolioOperationType
  official: B3TransactionItem
  existing: PortfolioTransaction
}

export function useReconciliationDrafts() {
  const [missingDrafts, setMissingDrafts] = useState<MissingDraft[]>([])
  const [conflictDrafts, setConflictDrafts] = useState<ConflictDraft[]>([])
  const [importedDrafts, setImportedDrafts] = useState<MissingDraft[]>([])

  // ── Derived from importedDrafts ──
  const manualYieldRequiredAssets = useMemo(() => {
    const list = importedDrafts.filter(
      (draft) =>
        draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value' || draft.isTreasury,
    )
    const uniqueMap = new Map<string, MissingDraft>()
    for (const draft of list) {
      const tickerUpper = draft.ticker.toUpperCase().trim()
      if (!uniqueMap.has(tickerUpper)) {
        uniqueMap.set(tickerUpper, draft)
      } else {
        const existing = uniqueMap.get(tickerUpper)
        if (existing && existing.indexer === 'none' && draft.indexer !== 'none') {
          uniqueMap.set(tickerUpper, draft)
        }
      }
    }
    return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker))
  }, [importedDrafts])

  // ── Selected counts ──
  const selectedMissingCount = useMemo(
    () => missingDrafts.filter((draft) => draft.selected).length,
    [missingDrafts],
  )

  const selectedConflictCount = useMemo(
    () => conflictDrafts.filter((draft) => draft.selected && !draft.applied).length,
    [conflictDrafts],
  )

  // ── Update handlers ──
  const updateMissingDraft = useCallback(
    <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => {
      setMissingDrafts((prev) => {
        const targetDraft = prev.find((d) => d.id === id)
        if (!targetDraft) return prev
        const tickerUpper = targetDraft.ticker.toUpperCase().trim()
        return prev.map((draft) => {
          if (draft.id === id) {
            const next = { ...draft, [key]: value }
            if (key === 'ticker') {
              const tick = String(value).toUpperCase()
              next.isB3Linked = isB3TickerPattern(tick) || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(tick)
              next.isTreasury = tick.includes('TESOURO') || /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(tick)
            }
            return next
          }
          if (
            draft.ticker.toUpperCase().trim() === tickerUpper &&
            ['indexer', 'indexer_percent', 'contract_rate', 'maturity_date'].includes(key as string)
          ) {
            return { ...draft, [key]: value }
          }
          return draft
        })
      })
    },
    [],
  )

  const updateImportedDraft = useCallback(
    <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => {
      setImportedDrafts((prev) => {
        const targetDraft = prev.find((d) => d.id === id)
        if (!targetDraft) return prev
        const tickerUpper = targetDraft.ticker.toUpperCase().trim()
        return prev.map((draft) =>
          draft.ticker.toUpperCase().trim() === tickerUpper ? { ...draft, [key]: value } : draft,
        )
      })
    },
    [],
  )

  // ── Wizard counts (needs reconciliation from files — computed externally) ──
  // This is now computed in the composer hook

  // ── Reset ──
  const resetDraftState = useCallback(() => {
    setMissingDrafts([])
    setConflictDrafts([])
    setImportedDrafts([])
  }, [])

  return {
    // State
    missingDrafts,
    setMissingDrafts,
    conflictDrafts,
    setConflictDrafts,
    importedDrafts,
    setImportedDrafts,

    // Derived
    manualYieldRequiredAssets,
    selectedMissingCount,
    selectedConflictCount,

    // Handlers
    updateMissingDraft,
    updateImportedDraft,

    // Reset
    resetDraftState,
  }
}
