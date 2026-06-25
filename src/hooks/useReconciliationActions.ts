import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'
import { isB3TickerPattern, isTreasuryTicker, detectDefaultCurrency } from '@/services/priceService'
import {
  fetchPortfolioCashContext,
  reconcileCashOffsetOnTransactionSave,
  deleteCashOffsetTransactions,
  syncPortfolioCashAfterBatch,
  insertOffsetsBatch,
} from '@/services/cashOffsetService'
import {
  generateBatchCashOffsetTransactions,
  type CashOffsetTransaction,
} from '@/utils/cashBalanceApplication'
import type {
  PositionAdjustmentSuggestion,
  InvestmentReconciliationResult,
} from '@/utils/investmentExcelReconciliation'
import type { MissingDraft, ConflictDraft } from './useReconciliationDrafts'

type PortfolioTransactionInsert = Omit<PortfolioTransaction, 'created_at'>

function toLocalPortfolioTransaction(tx: PortfolioTransactionInsert): PortfolioTransaction {
  return { ...tx, created_at: new Date().toISOString() }
}

function toLocalAssetDefinition(
  payload: Partial<PortfolioAssetDefinition> & Pick<PortfolioAssetDefinition, 'portfolio_id' | 'ticker'>,
  existing?: PortfolioAssetDefinition,
): PortfolioAssetDefinition {
  return {
    id: existing?.id ?? '',
    created_at: existing?.created_at ?? new Date().toISOString(),
    manual_current_value: existing?.manual_current_value ?? null,
    manual_value_updated_at: existing?.manual_value_updated_at ?? null,
    tax_exempt: existing?.tax_exempt ?? false,
    pricing_mode: 'market',
    is_b3_linked: false,
    applied_amount: null,
    contract_rate: null,
    indexer: 'none',
    indexer_percent: 100,
    maturity_date: null,
    is_treasury: false,
    application_date: null,
    updated_at: new Date().toISOString(),
    ...existing,
    ...payload,
  }
}

interface UseReconciliationActionsOptions {
  portfolioId: string
  onSaved: () => void
  scrollToTop: () => void
  setConflictDrafts: React.Dispatch<React.SetStateAction<ConflictDraft[]>>
  setMissingDrafts: React.Dispatch<React.SetStateAction<MissingDraft[]>>
  setImportedDrafts: React.Dispatch<React.SetStateAction<MissingDraft[]>>
  setReconciliation: React.Dispatch<React.SetStateAction<InvestmentReconciliationResult | null>>
  reconciliation: InvestmentReconciliationResult | null
  conflictDrafts: ConflictDraft[]
  missingDrafts: MissingDraft[]
  importedDrafts: MissingDraft[]
  manualYieldRequiredAssets: MissingDraft[]
  positionAdjustments: PositionAdjustmentSuggestion[]
  goToNextStepAfter: (from: string, newlyImported?: MissingDraft[]) => void
}

export function useReconciliationActions(options: UseReconciliationActionsOptions) {
  const {
    portfolioId,
    onSaved,
    scrollToTop,
    setConflictDrafts,
    setMissingDrafts,
    setImportedDrafts,
    setReconciliation,
    reconciliation,
    conflictDrafts,
    missingDrafts,
    manualYieldRequiredAssets,
    positionAdjustments,
    goToNextStepAfter,
  } = options

  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null)
  // Note: selectedAdjustmentTickers is managed internally
  const [selectedAdjTickers, setSelectedAdjTickers] = useState<Set<string>>(new Set())

  // ── Apply selected conflicts ──
  const handleApplySelectedConflicts = useCallback(async () => {
    const activeConflicts = conflictDrafts.filter((c) => c.selected && !c.applied)
    if (activeConflicts.length === 0) return

    setLoading(true)
    setProgress({ current: 0, total: activeConflicts.length, label: 'Corrigindo divergências...' })
    scrollToTop()
    try {
      let appliedCount = 0
      for (const [index, draft] of activeConflicts.entries()) {
        setProgress({ current: index + 1, total: activeConflicts.length, label: `Corrigindo: ${draft.official.ticker}` })
        const qty = parseFloat(draft.quantity)
        const prc = parseFloat(draft.price)

        if (isNaN(qty) || qty <= 0 || isNaN(prc) || prc < 0) {
          toast.error(`Valores inválidos para a correção do ativo ${draft.official.ticker}`)
          continue
        }

        const { error } = await supabase
          .from('portfolio_transactions')
          .update({
            date: draft.date,
            quantity: qty,
            price: prc,
            operation_type: draft.operation_type,
          })
          .eq('id', draft.existingId)
          .eq('portfolio_id', portfolioId)

        if (error) throw error

        const pricingMode = isTreasuryTicker(draft.official.ticker)
          ? 'fixed_income'
          : isB3TickerPattern(draft.official.ticker)
            ? 'market'
            : 'fixed_income'

        const context = await fetchPortfolioCashContext(portfolioId)
        await reconcileCashOffsetOnTransactionSave({
          portfolioId,
          transactionId: draft.existingId,
          amount: qty * prc,
          date: draft.date,
          assetPricingMode: pricingMode,
          operationType: draft.operation_type,
          transactions: context.transactions,
          definitions: context.definitions,
        })

        setConflictDrafts((prev) =>
          prev.map((c) => (c.key === draft.key ? { ...c, applied: true, selected: false } : c)),
        )
        appliedCount++
      }

      setProgress({ current: activeConflicts.length, total: activeConflicts.length, label: 'Sincronizando saldo de caixa...' })
      await syncPortfolioCashAfterBatch(portfolioId)

      toast.success(`${appliedCount} divergências foram corrigidas no livro-razão!`)
      onSaved()

      goToNextStepAfter('corrections')
    } catch (err) {
      console.error(err)
      toast.error('Ocorreu um erro ao aplicar as correções no banco de dados.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [conflictDrafts, portfolioId, scrollToTop, manualYieldRequiredAssets, onSaved, setConflictDrafts, goToNextStepAfter])

  // ── Import selected missing ──
  const handleImportSelectedMissing = useCallback(async () => {
    const activeMissing = missingDrafts
      .filter((m) => m.selected)
      .sort((a, b) => {
        const dateDiff = a.date.localeCompare(b.date)
        if (dateDiff !== 0) return dateDiff
        const getPriority = (type: string): number => {
          const priorities: Record<string, number> = {
            split: 1,
            reverse_split: 1,
            buy: 2,
            subscription: 2,
            sell: 3,
            dividend: 4,
            jcp: 4,
            fii_yield: 4,
          }
          return priorities[type] ?? 99
        }
        return getPriority(a.operation_type) - getPriority(b.operation_type)
      })
    if (activeMissing.length === 0) return

    setLoading(true)
    setProgress({ current: 0, total: activeMissing.length, label: 'Iniciando importação em lote...' })
    scrollToTop()
    try {
      const context = await fetchPortfolioCashContext(portfolioId)
      const localTransactions: PortfolioTransaction[] = [...context.transactions]
      const localDefinitions: PortfolioAssetDefinition[] = [...context.definitions]

      const txsToInsert: PortfolioTransactionInsert[] = []
      const defsToUpsertMap = new Map<
        string,
        Partial<PortfolioAssetDefinition> & Pick<PortfolioAssetDefinition, 'portfolio_id' | 'ticker'>
      >()
      const offsetsToInsert: PortfolioTransactionInsert[] = []
      let importedCount = 0

      for (const [index, draft] of activeMissing.entries()) {
        setProgress({
          current: index + 1,
          total: activeMissing.length,
          label: `Processando item ${index + 1} de ${activeMissing.length}: ${draft.ticker}`,
        })

        const qty = parseFloat(draft.quantity)
        const prc = parseFloat(draft.price)
        const tickerUpper = draft.ticker.toUpperCase().trim()

        if (!tickerUpper) {
          toast.error(`Ticker em branco para o item de data ${draft.date}`)
          continue
        }
        if (isNaN(qty) || qty <= 0) {
          toast.error(`Quantidade inválida para o ativo ${tickerUpper}`)
          continue
        }
        if (isNaN(prc) || prc < 0) {
          toast.error(`Preço inválido para o ativo ${tickerUpper}`)
          continue
        }

        const txId = crypto.randomUUID()
        const newTx = {
          id: txId,
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          date: draft.date,
          quantity: qty,
          price: prc,
          operation_type: draft.operation_type,
          contract_rate:
            draft.pricing_mode === 'fixed_income' && draft.contract_rate ? parseFloat(draft.contract_rate) : null,
        }
        txsToInsert.push(newTx)
        localTransactions.push(toLocalPortfolioTransaction(newTx))

        const isFixedOrTreasury = draft.pricing_mode === 'fixed_income' || draft.isTreasury
        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: draft.pricing_mode,
          is_b3_linked: draft.pricing_mode === 'market' ? draft.isB3Linked : false,
          applied_amount: draft.pricing_mode !== 'market' ? prc * qty : null,
          application_date: draft.date,
          is_treasury: draft.isTreasury,
          indexer: isFixedOrTreasury ? draft.indexer || 'none' : 'none',
          indexer_percent:
            isFixedOrTreasury && (draft.indexer || 'none') !== 'none' ? parseFloat(draft.indexer_percent) || 100 : 100,
          contract_rate: isFixedOrTreasury && draft.contract_rate ? parseFloat(draft.contract_rate) || null : null,
          maturity_date: isFixedOrTreasury && draft.maturity_date ? draft.maturity_date : null,
          currency: detectDefaultCurrency(tickerUpper),
          updated_at: new Date().toISOString(),
        }

        const existingDefIndex = localDefinitions.findIndex((d) => d.ticker === tickerUpper)
        if (existingDefIndex >= 0) {
          localDefinitions[existingDefIndex] = toLocalAssetDefinition(defPayload, localDefinitions[existingDefIndex])
        } else {
          localDefinitions.push(toLocalAssetDefinition(defPayload))
        }
        defsToUpsertMap.set(tickerUpper, defPayload)

        const amount = qty * prc
        const batchOffsets = generateBatchCashOffsetTransactions({
          portfolioId,
          sourceTransactionId: txId,
          operationType: draft.operation_type,
          pricingMode: draft.pricing_mode,
          amount,
          date: draft.date,
          localTransactions,
          localDefinitions,
        })
        for (const offsetTx of batchOffsets) {
          offsetsToInsert.push(offsetTx)
          localTransactions.push(toLocalPortfolioTransaction(offsetTx))
        }
        importedCount++
      }

      if (txsToInsert.length === 0) throw new Error('Nenhum item válido para importação.')

      setProgress({ current: activeMissing.length, total: activeMissing.length, label: 'Salvando transações no banco...' })
      const { error: txError } = await supabase.from('portfolio_transactions').insert(txsToInsert)
      if (txError) throw txError

      setProgress({ current: activeMissing.length, total: activeMissing.length, label: 'Atualizando definições de ativos...' })
      const { error: defError } = await supabase
        .from('portfolio_asset_definitions')
        .upsert(Array.from(defsToUpsertMap.values()), { onConflict: 'portfolio_id,ticker' })
      if (defError) throw defError

      if (offsetsToInsert.length > 0) {
        setProgress({ current: activeMissing.length, total: activeMissing.length, label: 'Sincronizando offsets de caixa...' })
        await insertOffsetsBatch(offsetsToInsert)
      }

      setProgress({ current: activeMissing.length, total: activeMissing.length, label: 'Sincronizando saldo de caixa final...' })
      await syncPortfolioCashAfterBatch(portfolioId, localTransactions, localDefinitions)

      toast.success(`${importedCount} novos lançamentos importados com sucesso em lote!`)

      setImportedDrafts((prev) => [...prev, ...activeMissing])
      setMissingDrafts((prev) => prev.filter((d) => !d.selected))

      onSaved()

      goToNextStepAfter('corrections', activeMissing)
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erro ao efetuar a importação em lote.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [missingDrafts, portfolioId, scrollToTop, manualYieldRequiredAssets, goToNextStepAfter, onSaved, setImportedDrafts, setMissingDrafts])

  // ── Save asset yield ──
  const handleSaveAssetYield = useCallback(
    async (asset: MissingDraft) => {
      try {
        const { error } = await supabase
          .from('portfolio_asset_definitions')
          .update({
            indexer: asset.indexer,
            indexer_percent: asset.indexer !== 'none' ? parseFloat(asset.indexer_percent) || 100 : 100,
            contract_rate: asset.contract_rate ? parseFloat(asset.contract_rate) || null : null,
            maturity_date: asset.maturity_date || null,
            updated_at: new Date().toISOString(),
          })
          .eq('portfolio_id', portfolioId)
          .eq('ticker', asset.ticker.toUpperCase().trim())

        if (error) throw error
        toast.success(`Rentabilidade de ${asset.ticker} salva com sucesso!`)
        onSaved()
      } catch (err) {
        console.error(err)
        toast.error(`Erro ao salvar rentabilidade de ${asset.ticker}`)
      }
    },
    [portfolioId, onSaved],
  )

  // ── Apply position adjustments ──
  const handleApplyPositionAdjustments = useCallback(async () => {
    const active = positionAdjustments
      .filter((a) => selectedAdjTickers.has(a.ticker))
      .sort((a, b) => a.date.localeCompare(b.date))
    if (active.length === 0) return

    const invalid = active.filter((a) => a.price <= 0)
    if (invalid.length > 0) {
      toast.error(
        `Sem preço de referência para: ${invalid.map((a) => a.ticker).join(', ')}. Cadastre uma compra/venda antes do ajuste.`,
      )
      return
    }

    if (!confirm(`Criar ${active.length} lançamento(s) de ajuste para igualar o livro-razão à posição B3 oficial?`)) return

    setLoading(true)
    setProgress({ current: 0, total: active.length, label: 'Ajustando posições...' })
    scrollToTop()
    try {
      const context = await fetchPortfolioCashContext(portfolioId)
      const localTransactions: PortfolioTransaction[] = [...context.transactions]
      const localDefinitions: PortfolioAssetDefinition[] = [...context.definitions]
      const txsToInsert: Record<string, unknown>[] = []
      const offsetsToInsert: CashOffsetTransaction[] = []

      for (const [index, adj] of active.entries()) {
        setProgress({ current: index + 1, total: active.length, label: `Ajuste ${adj.ticker}` })
        const txId = crypto.randomUUID()
        const tickerUpper = adj.ticker.toUpperCase()
        const newTx = {
          id: txId,
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          date: adj.date,
          quantity: adj.quantity,
          price: adj.price,
          operation_type: adj.operation_type,
        }
        txsToInsert.push(newTx)
        localTransactions.push(newTx as PortfolioTransaction)

        const amount = adj.quantity * adj.price
        const batchOffsets = generateBatchCashOffsetTransactions({
          portfolioId,
          sourceTransactionId: txId,
          operationType: adj.operation_type,
          pricingMode: 'market',
          amount,
          date: adj.date,
          localTransactions,
          localDefinitions,
        })
        for (const offsetTx of batchOffsets) {
          offsetsToInsert.push(offsetTx)
        }
      }

      const { error: txError } = await supabase.from('portfolio_transactions').insert(txsToInsert)
      if (txError) throw txError
      if (offsetsToInsert.length > 0) {
        await insertOffsetsBatch(offsetsToInsert)
      }

      await syncPortfolioCashAfterBatch(portfolioId)

      toast.success(`${active.length} ajuste(s) aplicado(s) com base na posição B3.`)
      onSaved()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao aplicar ajustes de posição.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }, [positionAdjustments, selectedAdjTickers, portfolioId, scrollToTop, onSaved])

  // ── Delete ledger-only transaction ──
  const handleDeleteLedgerOnlyTransaction = useCallback(
    async (id: string) => {
      if (
        !confirm('Deseja realmente excluir esta transação do Livro-Razão? Ela sairá permanentemente do histórico do cliente.')
      )
        return

      try {
        await deleteCashOffsetTransactions(portfolioId, id)
        const { error } = await supabase
          .from('portfolio_transactions')
          .delete()
          .eq('id', id)
          .eq('portfolio_id', portfolioId)

        if (error) throw error

        await syncPortfolioCashAfterBatch(portfolioId)

        toast.success('Lançamento excluído com sucesso!')
        onSaved()

        if (reconciliation) {
          setReconciliation({
            ...reconciliation,
            existingOnly: reconciliation.existingOnly.filter((tx) => tx.id !== id),
          })
        }
      } catch (err) {
        toast.error('Erro ao excluir transação.')
      }
    },
    [portfolioId, onSaved, reconciliation, setReconciliation],
  )

  // ── Toggle adjustment selection ──
  const handleToggleAdjustment = useCallback((ticker: string) => {
    setSelectedAdjTickers((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }, [])

  const handleSelectAllAdjustments = useCallback(
    (selected: boolean) => {
      setSelectedAdjTickers(selected ? new Set(positionAdjustments.map((a) => a.ticker)) : new Set())
    },
    [positionAdjustments],
  )

  // ── Reset ──
  const resetActionsState = useCallback(() => {
    setLoading(false)
    setProgress(null)
    setSelectedAdjTickers(new Set())
  }, [])

  return {
    loading,
    setLoading,
    progress,
    setProgress,
    selectedAdjustmentTickers: selectedAdjTickers,
    setSelectedAdjTickers,
    handleApplySelectedConflicts,
    handleImportSelectedMissing,
    handleSaveAssetYield,
    handleApplyPositionAdjustments,
    handleDeleteLedgerOnlyTransaction,
    handleToggleAdjustment,
    handleSelectAllAdjustments,
    resetActionsState,
  }
}
