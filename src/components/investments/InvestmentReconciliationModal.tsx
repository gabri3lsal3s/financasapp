import { useMemo, useRef, useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { supabase } from '@/lib/supabase'
import type { PortfolioOperationType, PortfolioTransaction, PortfolioPricingMode, PortfolioAssetDefinition } from '@/types'
import {
  parseB3Excel,
  parseB3PositionExcel,
  buildPositionValidation,
  suggestPositionAdjustments,
  isB3PositionWorkbook,
  reconcileInvestmentTransactions,
  classifyB3Item,
  isB3SubscriptionRightsTicker,
  computePositionsFromB3Items,
  type B3ParseDedupeStats,
  type B3PositionParseResult,
  type B3TransactionItem,
  type InvestmentReconciliationResult,
  type PositionValidationResult,
  type PositionAdjustmentSuggestion,
} from '@/utils/investmentExcelReconciliation'
import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import B3ReconciliationStepper from '@/components/investments/B3ReconciliationStepper'
import B3ReconciliationKpiGrid from '@/components/investments/B3ReconciliationKpiGrid'
import B3PositionValidationPanel from '@/components/investments/B3PositionValidationPanel'
import { computeTickerQuantity } from '@/utils/portfolioLedger'
import {
  isPortfolioIncomeType,
  PORTFOLIO_OPERATION_OPTIONS,
  portfolioOperationLabel,
} from '@/utils/portfolioOperations'
import { isB3TickerPattern } from '@/services/priceService'
import { formatCurrency } from '@/utils/format'
import {
  fetchPortfolioCashContext,
  reconcileCashOffsetOnTransactionSave,
  deleteCashOffsetTransactions,
} from '@/services/cashOffsetService'
import {
  calculateLedgerCashBalance,
  shouldApplyCashOffset,
  computeCashOffsetPreview,
  getPreferredCashTicker,
} from '@/utils/cashBalanceApplication'
import { PORTFOLIO_PRICING_MODE_OPTIONS } from '@/constants/portfolioPricingMode'
import { Upload, FileCheck, ArrowRight, Layers, Check, AlertCircle, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

interface InvestmentReconciliationModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  existingTransactions: PortfolioTransaction[]
  onSaved: () => void
  onOpenAssetConfig: (ticker: string) => void
}

interface MissingDraft {
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
}

interface ConflictDraft {
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

const OPERATION_OPTIONS = PORTFOLIO_OPERATION_OPTIONS

type ReconciliationStep = 'upload' | 'summary' | 'corrections' | 'position' | 'review'
type CorrectionsTab = 'conflicts' | 'missing' | 'suspicious'

const WIZARD_STEPS: Array<{ id: ReconciliationStep; label: string; countKey?: string }> = [
  { id: 'summary', label: 'Resumo' },
  { id: 'corrections', label: 'Correções' },
  { id: 'position', label: 'Posição' },
  { id: 'review', label: 'Fim' },
]

export default function InvestmentReconciliationModal({
  isOpen,
  onClose,
  portfolioId,
  existingTransactions,
  onSaved,
  onOpenAssetConfig,
}: InvestmentReconciliationModalProps) {
  const [fileName, setFileName] = useState('')
  const [parseStatus, setParseStatus] = useState('')
  const [reconciliation, setReconciliation] = useState<InvestmentReconciliationResult | null>(null)
  const [parsedEquityItems, setParsedEquityItems] = useState<B3TransactionItem[]>([])
  
  const [missingDrafts, setMissingDrafts] = useState<MissingDraft[]>([])
  const [conflictDrafts, setConflictDrafts] = useState<ConflictDraft[]>([])
  const [importedDrafts, setImportedDrafts] = useState<MissingDraft[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null)
  const [excludedCount, setExcludedCount] = useState<{
    fixedIncome: number
    treasury: number
    ignoredByMovement: number
    subscriptionRights: number
    dedupe: B3ParseDedupeStats
  }>({
    fixedIncome: 0,
    treasury: 0,
    ignoredByMovement: 0,
    subscriptionRights: 0,
    dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 },
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const positionFileInputRef = useRef<HTMLInputElement | null>(null)

  const [currentStep, setCurrentStep] = useState<ReconciliationStep>('upload')
  const [dragActive, setDragActive] = useState(false)
  const [positionDragActive, setPositionDragActive] = useState(false)
  const [positionFileName, setPositionFileName] = useState('')
  const [positionParseStatus, setPositionParseStatus] = useState('')
  const [officialPosition, setOfficialPosition] = useState<B3PositionParseResult | null>(null)
  const [positionValidation, setPositionValidation] = useState<PositionValidationResult | null>(null)
  const [acknowledgePositionGaps, setAcknowledgePositionGaps] = useState(false)
  const [correctionsTab, setCorrectionsTab] = useState<CorrectionsTab>('conflicts')
  const [selectedAdjustmentTickers, setSelectedAdjustmentTickers] = useState<Set<string>>(new Set())
  const modalTopRef = useRef<HTMLDivElement | null>(null)

  const scrollToTop = () => {
    const container = modalTopRef.current?.closest('.overflow-y-auto')
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      modalTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Rola para o topo do modal ao trocar de etapa ou quando o modal é aberto
  useEffect(() => {
    if (isOpen) {
      scrollToTop()
    }
  }, [currentStep, isOpen])

  const manualYieldRequiredAssets = useMemo(() => {
    return importedDrafts.filter(draft => 
      draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value'
    )
  }, [importedDrafts])

  // Reset local states on open
  useEffect(() => {
    if (isOpen) {
      setFileName('')
      setParseStatus('')
      setReconciliation(null)
      setParsedEquityItems([])
      setMissingDrafts([])
      setConflictDrafts([])
      setImportedDrafts([])
      setCurrentStep('upload')
      setProgress(null)
      setExcludedCount({
        fixedIncome: 0,
        treasury: 0,
        ignoredByMovement: 0,
        subscriptionRights: 0,
        dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 },
      })
      setPositionFileName('')
      setPositionParseStatus('')
      setOfficialPosition(null)
      setPositionValidation(null)
      setAcknowledgePositionGaps(false)
      setCorrectionsTab('conflicts')
      setSelectedAdjustmentTickers(new Set())
    }
  }, [isOpen])

  const wizardCounts = useMemo(
    () => ({
      conflicts: conflictDrafts.filter((c) => !c.applied).length,
      missing: missingDrafts.length,
      suspicious: reconciliation?.existingOnly.length ?? 0,
      corrections:
        conflictDrafts.filter((c) => !c.applied).length +
        missingDrafts.length +
        (reconciliation?.existingOnly.length ?? 0),
    }),
    [conflictDrafts, missingDrafts, reconciliation]
  )

  const positionAdjustments = useMemo((): PositionAdjustmentSuggestion[] => {
    if (!positionValidation) return []
    return suggestPositionAdjustments(
      positionValidation,
      existingTransactions,
      parsedEquityItems
    )
  }, [positionValidation, existingTransactions, parsedEquityItems])

  useEffect(() => {
    if (positionAdjustments.length > 0) {
      setSelectedAdjustmentTickers(new Set(positionAdjustments.map((a) => a.ticker)))
    }
  }, [positionAdjustments])

  const ledgerOnlyMismatches = useMemo(
    () =>
      positionValidation?.rows.filter(
        (r) => r.status !== 'ok' && r.status !== 'movements_official'
      ).length ?? 0,
    [positionValidation]
  )

  const goToNextStepAfter = (from: ReconciliationStep) => {
    if (!reconciliation) return
    const order: ReconciliationStep[] = ['summary', 'corrections', 'position', 'review']
    const startIdx = order.indexOf(from) + 1
    for (let i = startIdx; i < order.length; i += 1) {
      const step = order[i]
      if (step === 'corrections' && wizardCounts.corrections > 0) {
        if (wizardCounts.conflicts > 0) setCorrectionsTab('conflicts')
        else if (wizardCounts.missing > 0) setCorrectionsTab('missing')
        else setCorrectionsTab('suspicious')
        setCurrentStep('corrections')
        return
      }
      if (step === 'position') {
        setCurrentStep('position')
        return
      }
      if (step === 'review') {
        setCurrentStep('review')
        return
      }
    }
    setCurrentStep('review')
  }

  const stepperItems = useMemo(
    () =>
      WIZARD_STEPS.map((s) => ({
        id: s.id,
        label: s.label,
        badge:
          s.id === 'corrections'
            ? wizardCounts.corrections
            : s.id === 'position' && positionValidation && !positionValidation.allOk
              ? ledgerOnlyMismatches || positionValidation.mismatchCount
              : undefined,
      })),
    [wizardCounts.corrections, positionValidation, ledgerOnlyMismatches]
  )

  const selectedMissingCount = useMemo(
    () => missingDrafts.filter((draft) => draft.selected).length,
    [missingDrafts]
  )

  const selectedConflictCount = useMemo(
    () => conflictDrafts.filter((draft) => draft.selected && !draft.applied).length,
    [conflictDrafts]
  )

  const b3ParsedPositions = useMemo(
    () => computePositionsFromB3Items(parsedEquityItems),
    [parsedEquityItems]
  )

  const systemPositions = useMemo(() => {
    const tickers = new Set<string>()
    for (const tx of existingTransactions) {
      if (
        tx.ticker === 'SALDO_INV' ||
        tx.ticker === 'CAIXA' ||
        tx.ticker === 'SALDO EM CAIXA' ||
        tx.ticker === 'SALDO_EM_CAIXA' ||
        tx.cash_offset_source_id
      ) {
        continue
      }
      tickers.add(tx.ticker.toUpperCase())
    }
    const map: Record<string, number> = {}
    for (const ticker of tickers) {
      const qty = computeTickerQuantity(existingTransactions, ticker)
      if (qty > 0.000_001) map[ticker] = qty
    }
    return map
  }, [existingTransactions])

  const positionPreviewRows = useMemo(() => {
    const allTickers = new Set([
      ...Object.keys(b3ParsedPositions),
      ...Object.keys(systemPositions),
    ])
    return Array.from(allTickers)
      .sort()
      .map((ticker) => ({
        ticker,
        b3: b3ParsedPositions[ticker] ?? 0,
        system: systemPositions[ticker] ?? 0,
      }))
      .filter((row) => row.b3 > 0 || row.system > 0)
  }, [b3ParsedPositions, systemPositions])

  const recomputePositionValidation = (
    official: B3PositionParseResult,
    movements: Record<string, number>,
    system: Record<string, number>
  ) => {
    const validation = buildPositionValidation(official.equity, movements, system)
    setPositionValidation(validation)
    setAcknowledgePositionGaps(false)
    return validation
  }

  const processPositionFileBuffer = async (buffer: ArrayBuffer, name: string) => {
    setPositionFileName(name)
    setPositionParseStatus('Lendo relatório de posição...')
    try {
      if (!isB3PositionWorkbook(buffer)) {
        setPositionParseStatus(
          'Este arquivo parece ser de movimentação, não de posição. Exporte em Investimentos → Posição atual (.xlsx).'
        )
        return
      }
      const parsed = parseB3PositionExcel(buffer)
      if (Object.keys(parsed.equity).length === 0) {
        setPositionParseStatus('Nenhuma cota de renda variável encontrada na planilha de posição.')
        return
      }
      setOfficialPosition(parsed)
      recomputePositionValidation(parsed, b3ParsedPositions, systemPositions)
      setPositionParseStatus('')
      toast.success('Posição oficial carregada — validação atualizada.')
    } catch (err: unknown) {
      console.error(err)
      setPositionParseStatus(
        err instanceof Error ? err.message : 'Erro ao ler o relatório de posição.'
      )
    }
  }

  useEffect(() => {
    if (!officialPosition) return
    recomputePositionValidation(officialPosition, b3ParsedPositions, systemPositions)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recalcula quando livro-razão ou movimentações mudam
  }, [officialPosition, b3ParsedPositions, systemPositions])

  // Process a loaded array buffer (from drop or input file)
  const processFileBuffer = async (buffer: ArrayBuffer, name: string) => {
    setFileName(name)
    setParseStatus('Lendo e interpretando planilha...')
    try {
      if (isB3PositionWorkbook(buffer)) {
        setParseStatus(
          'Este arquivo é de posição atual. Na primeira etapa envie o extrato de movimentação; a posição será solicitada na validação final.'
        )
        return
      }
      const parseResult = parseB3Excel(buffer)
      const allParsedItems = parseResult.items

      if (allParsedItems.length === 0) {
        setParseStatus('O arquivo enviado não contém lançamentos reconhecíveis ou está vazio.')
        return
      }

      // ── Filtrar apenas renda variável B3 ──
      let fixedIncomeCount = 0
      let treasuryCount = 0
      let subscriptionRightsCount = 0
      const parsedItems = allParsedItems.filter((item) => {
        if (isB3SubscriptionRightsTicker(item.ticker)) {
          subscriptionRightsCount++
          return false
        }
        const category = classifyB3Item(item.ticker, item.product_name)
        if (category === 'treasury') {
          treasuryCount++
          return false
        }
        if (category === 'fixedIncome') {
          fixedIncomeCount++
          return false
        }
        return true
      })
      setExcludedCount({
        fixedIncome: fixedIncomeCount,
        treasury: treasuryCount,
        ignoredByMovement: parseResult.ignoredByMovement,
        subscriptionRights: subscriptionRightsCount,
        dedupe: parseResult.dedupe,
      })

      if (parsedItems.length === 0) {
        setParseStatus('O arquivo contém apenas ativos de renda fixa/Tesouro Direto, que não são conciliados automaticamente. Importe-os manualmente pelo livro-razão.')
        return
      }

      setParseStatus('Analisando correspondências no livro-razão...')
      const result = reconcileInvestmentTransactions(parsedItems, existingTransactions)

      setReconciliation(result)
      setParsedEquityItems(parsedItems)

      // Initialize editable missing drafts — somente renda variável B3
      setMissingDrafts(
        result.missing.map((item) => {
          const isB3 = isB3TickerPattern(item.ticker)
          // CORREÇÃO: Tesouro nunca deve ser 'market' (sem cotação Yahoo Finance)
          // Mas como já filtramos acima, esse fallback é segurança extra
          const pricingMode: PortfolioPricingMode = isB3 ? 'market' : 'fixed_income'
          return {
            id: item.id,
            selected: true,
            ticker: item.ticker,
            date: item.date,
            operation_type: item.operation_type,
            quantity: String(item.quantity),
            price: String(item.price),
            pricing_mode: pricingMode,
            isB3Linked: isB3,
            isTreasury: false, // Tesouro filtrado antes de chegar aqui
            product_name: item.product_name,
            official: item,
          }
        })
      )

      // Initialize conflict drafts
      setConflictDrafts(
        result.conflicts.map((conflict) => ({
          key: `${conflict.existing.id}::${conflict.official.id}`,
          existingId: conflict.existing.id,
          officialId: conflict.official.id,
          selected: true,
          applied: !conflict.suggestedUpdate.needsUpdate,
          date: conflict.suggestedUpdate.date,
          quantity: String(conflict.suggestedUpdate.quantity),
          price: String(conflict.suggestedUpdate.price),
          operation_type: conflict.suggestedUpdate.operation_type,
          official: conflict.official,
          existing: conflict.existing,
        }))
      )

      setParseStatus('')
      setCurrentStep('summary')
    } catch (err: any) {
      console.error(err)
      setParseStatus(err.message || 'Erro ao carregar o arquivo Excel. Verifique se o formato está correto.')
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    await processFileBuffer(buffer, file.name)
  }

  // Drag & drop logic
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (file.name.endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        await processFileBuffer(buffer, file.name)
      } else {
        toast.error('Por favor, envie apenas arquivos em formato Excel (.xlsx)')
      }
    }
  }

  // Missing draft handlers for inline customization
  const updateMissingDraft = <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => {
    setMissingDrafts((prev) =>
      prev.map((draft) => {
        if (draft.id !== id) return draft
        const next = { ...draft, [key]: value }
        
        // Auto toggles if ticker changes
        if (key === 'ticker') {
          const tick = String(value).toUpperCase()
          next.isB3Linked = isB3TickerPattern(tick)
          next.isTreasury = tick.includes('TESOURO')
        }
        
        return next
      })
    )
  }

  // Apply conflicts to DB
  const handleApplySelectedConflicts = async () => {
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

        // Automatically sync cash offsets for this transaction
        const pricingMode = draft.official.ticker.toUpperCase().includes('TESOURO')
          ? 'market'
          : isB3TickerPattern(draft.official.ticker) ? 'market' : 'fixed_income'

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

        // Mark as applied in local state
        setConflictDrafts((prev) =>
          prev.map((c) => (c.key === draft.key ? { ...c, applied: true, selected: false } : c))
        )
        appliedCount++
      }

      setProgress({ current: activeConflicts.length, total: activeConflicts.length, label: 'Sincronizando saldo de caixa...' })
      // Sync total cash balance
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)
      await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

      toast.success(`${appliedCount} divergências foram corrigidas no livro-razão!`)
      
      // Update our parent portfolio view
      onSaved()
      
      goToNextStepAfter('corrections')
    } catch (err) {
      console.error(err)
      toast.error('Ocorreu um erro ao aplicar as correções no banco de dados.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  // Bulk import missing items into DB (fully customized)
  const handleImportSelectedMissing = async () => {
    const activeMissing = missingDrafts.filter((m) => m.selected)
    if (activeMissing.length === 0) return

    setLoading(true)
    setProgress({ current: 0, total: activeMissing.length, label: 'Iniciando importação em lote...' })
    scrollToTop()
    try {
      // 1. Carregar contexto de caixa inicial
      const context = await fetchPortfolioCashContext(portfolioId)
      const localTransactions: PortfolioTransaction[] = [...context.transactions]
      const localDefinitions: PortfolioAssetDefinition[] = [...context.definitions]

      const txsToInsert: any[] = []
      const defsToUpsertMap = new Map<string, any>()
      const offsetsToInsert: any[] = []
      let importedCount = 0

      for (const [index, draft] of activeMissing.entries()) {
        setProgress({ current: index + 1, total: activeMissing.length, label: `Processando item ${index + 1} de ${activeMissing.length}: ${draft.ticker}` })
        
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

        // Gerar UUID client-side para vincular com offsets
        const txId = crypto.randomUUID()

        // 1. Criar payload da transação B3
        const newTx = {
          id: txId,
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          date: draft.date,
          quantity: qty,
          price: prc,
          operation_type: draft.operation_type,
        }
        txsToInsert.push(newTx)
        localTransactions.push(newTx as any)

        // 2. Preparar payload de definição de ativo
        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: draft.pricing_mode,
          is_b3_linked: draft.pricing_mode === 'market' ? draft.isB3Linked : false,
          applied_amount: draft.pricing_mode !== 'market' ? prc * qty : null,
          application_date: draft.date,
          is_treasury: draft.pricing_mode === 'market' ? draft.isTreasury : false,
          updated_at: new Date().toISOString(),
        }
        
        // Atualizar no contexto local para que as próximas iterações leiam a definição correta
        const existingDefIndex = localDefinitions.findIndex(d => d.ticker === tickerUpper)
        if (existingDefIndex >= 0) {
          localDefinitions[existingDefIndex] = { ...localDefinitions[existingDefIndex], ...defPayload }
        } else {
          localDefinitions.push(defPayload as any)
        }
        defsToUpsertMap.set(tickerUpper, defPayload)

        // 3. Simular offsets de caixa em memória para evitar requisições de rede
        const amount = qty * prc
        if (draft.pricing_mode !== 'cash') {
          if (draft.operation_type === 'buy' || draft.operation_type === 'subscription') {
            if (shouldApplyCashOffset(draft.operation_type, draft.pricing_mode)) {
              const plan = computeCashOffsetPreview(
                amount,
                draft.operation_type,
                draft.pricing_mode,
                localTransactions,
                localDefinitions
              )
              
              if (plan.sellTransactions.length > 0) {
                plan.sellTransactions.forEach(sell => {
                  const offsetTx = {
                    id: crypto.randomUUID(),
                    portfolio_id: portfolioId,
                    ticker: sell.ticker,
                    operation_type: 'sell' as const,
                    quantity: sell.quantity,
                    price: sell.price,
                    date: draft.date,
                    cash_offset_source_id: txId,
                  }
                  offsetsToInsert.push(offsetTx)
                  localTransactions.push(offsetTx as any)
                })
              }
            }
          } else if (draft.operation_type === 'sell' || isPortfolioIncomeType(draft.operation_type)) {
            if (amount > 0) {
              const cashTicker = getPreferredCashTicker(localTransactions, localDefinitions)
              const offsetTx = {
                id: crypto.randomUUID(),
                portfolio_id: portfolioId,
                ticker: cashTicker,
                operation_type: 'buy' as const,
                quantity: 1,
                price: amount,
                date: draft.date,
                cash_offset_source_id: txId,
              }
              offsetsToInsert.push(offsetTx)
              localTransactions.push(offsetTx as any)
            }
          }
        }

        importedCount++
      }

      if (txsToInsert.length === 0) {
        throw new Error('Nenhum item válido para importação.')
      }

      // 4. Efetuar gravações no Supabase em lote real (apenas 3 a 4 roundtrips de rede no total!)
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
        const { error: offsetError } = await supabase.from('portfolio_transactions').insert(offsetsToInsert)
        if (offsetError) throw offsetError
      }

      setProgress({ current: activeMissing.length, total: activeMissing.length, label: 'Sincronizando saldo de caixa final...' })
      const finalLedgerCash = calculateLedgerCashBalance(localTransactions, localDefinitions)
      const { error: updatePortError } = await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)
      if (updatePortError) throw updatePortError

      toast.success(`${importedCount} novos lançamentos importados com sucesso em lote!`)
      
      // Remove successfully imported rows from drafts list
      setImportedDrafts((prev) => [...prev, ...activeMissing])
      setMissingDrafts((prev) => prev.filter((d) => !d.selected))
      
      // Update parent list
      onSaved()

      goToNextStepAfter('corrections')
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erro ao efetuar a importação em lote.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleApplyPositionAdjustments = async () => {
    const active = positionAdjustments.filter((a) => selectedAdjustmentTickers.has(a.ticker))
    if (active.length === 0) return

    const invalid = active.filter((a) => a.price <= 0)
    if (invalid.length > 0) {
      toast.error(
        `Sem preço de referência para: ${invalid.map((a) => a.ticker).join(', ')}. Cadastre uma compra/venda antes do ajuste.`
      )
      return
    }

    if (
      !confirm(
        `Criar ${active.length} lançamento(s) de ajuste para igualar o livro-razão à posição B3 oficial?`
      )
    ) {
      return
    }

    setLoading(true)
    setProgress({ current: 0, total: active.length, label: 'Ajustando posições...' })
    scrollToTop()
    try {
      const context = await fetchPortfolioCashContext(portfolioId)
      let localTransactions: PortfolioTransaction[] = [...context.transactions]
      const localDefinitions: PortfolioAssetDefinition[] = [...context.definitions]
      const txsToInsert: Record<string, unknown>[] = []
      const offsetsToInsert: Record<string, unknown>[] = []

      for (const [index, adj] of active.entries()) {
        setProgress({
          current: index + 1,
          total: active.length,
          label: `Ajuste ${adj.ticker}`,
        })
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
        if (adj.operation_type === 'buy' && shouldApplyCashOffset('buy', 'market')) {
          const plan = computeCashOffsetPreview(
            amount,
            'buy',
            'market',
            localTransactions,
            localDefinitions
          )
          plan.sellTransactions.forEach((sell) => {
            offsetsToInsert.push({
              id: crypto.randomUUID(),
              portfolio_id: portfolioId,
              ticker: sell.ticker,
              operation_type: 'sell',
              quantity: sell.quantity,
              price: sell.price,
              date: adj.date,
              cash_offset_source_id: txId,
            })
          })
        } else if (adj.operation_type === 'sell' && amount > 0) {
          const cashTicker = getPreferredCashTicker(localTransactions, localDefinitions)
          offsetsToInsert.push({
            id: crypto.randomUUID(),
            portfolio_id: portfolioId,
            ticker: cashTicker,
            operation_type: 'buy',
            quantity: 1,
            price: amount,
            date: adj.date,
            cash_offset_source_id: txId,
          })
        }
      }

      const { error: txError } = await supabase.from('portfolio_transactions').insert(txsToInsert)
      if (txError) throw txError
      if (offsetsToInsert.length > 0) {
        const { error: offsetError } = await supabase.from('portfolio_transactions').insert(offsetsToInsert)
        if (offsetError) throw offsetError
      }

      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(
        updatedContext.transactions,
        updatedContext.definitions
      )
      await supabase.from('portfolios').update({ cash_balance: finalLedgerCash }).eq('id', portfolioId)

      toast.success(`${active.length} ajuste(s) aplicado(s) com base na posição B3.`)
      onSaved()
      setAcknowledgePositionGaps(false)
    } catch (err) {
      console.error(err)
      toast.error('Erro ao aplicar ajustes de posição.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  // Handle deletion of suspicious ledger-only transaction
  const handleDeleteLedgerOnlyTransaction = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta transação do Livro-Razão? Ela sairá permanentemente do histórico do cliente.')) return
    
    try {
      await deleteCashOffsetTransactions(portfolioId, id)
      const { error } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', id)
        .eq('portfolio_id', portfolioId)

      if (error) throw error

      // Sync total cash balance
      const updatedContext = await fetchPortfolioCashContext(portfolioId)
      const finalLedgerCash = calculateLedgerCashBalance(updatedContext.transactions, updatedContext.definitions)
      await supabase
        .from('portfolios')
        .update({ cash_balance: finalLedgerCash })
        .eq('id', portfolioId)

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
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conciliação B3 — Movimentação e Posição"
      maxWidth="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Invisible anchor for scrolling to top */}
        <div ref={modalTopRef} />
        
        {/* ── Progress Overlay ── */}
        {loading && progress && (
          <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/25 p-4 space-y-2.5 animate-pulse-slow">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-indigo-400 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3V4a10 10 0 100 20v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
                </svg>
                {progress.label}
              </span>
              <span className="text-secondary tabular-nums">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                style={{ width: progress.total > 0 ? `${Math.round((progress.current / progress.total) * 100)}%` : '0%' }}
              />
            </div>
            <p className="text-[10px] text-secondary text-right tabular-nums">
              {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}% concluído
            </p>
          </div>
        )}

        {reconciliation && currentStep !== 'upload' && (
          <B3ReconciliationStepper
            steps={stepperItems}
            currentStepId={currentStep}
            onStepClick={(id) => setCurrentStep(id as ReconciliationStep)}
            footer={
              fileName ? (
                <p className="text-[10px] text-secondary truncate" title={fileName}>
                  Movimentação: <span className="font-mono text-primary">{fileName}</span>
                  {positionFileName && (
                    <>
                      {' · '}
                      Posição: <span className="font-mono text-primary">{positionFileName}</span>
                    </>
                  )}
                </p>
              ) : null
            }
          />
        )}

        {/* STEP 1: Upload */}
        {currentStep === 'upload' && (
          <div className="space-y-3">
            <p className="text-xs text-secondary text-left">
              Envie o extrato <strong className="text-primary">movimentacao-*.xlsx</strong>. O arquivo{' '}
              <strong className="text-primary">posicao-*.xlsx</strong> será pedido na etapa de validação, com correção automática de cotas.
            </p>

            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors ${
                dragActive
                  ? 'border-indigo-500 bg-indigo-500/5 scale-[1.01]'
                  : 'border-primary/30 bg-primary/20 hover:border-indigo-500/50 hover:bg-indigo-500/5'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                <Upload size={24} />
              </div>
              <div>
                <p className="text-xs font-bold text-primary">Arraste e solte o arquivo da B3 aqui</p>
                <p className="text-[10px] text-secondary mt-1">ou clique para procurar no computador</p>
              </div>
              <span className="text-[9px] font-mono text-secondary/60 bg-secondary/50 px-2 py-0.5 rounded border border-border/30">
                Suporta formato B3 oficial (.xlsx)
              </span>
            </div>

            {parseStatus && (
              <p className="text-[11px] text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 text-left">
                {parseStatus}
              </p>
            )}
          </div>
        )}

        {/* STEP 2: Summary / Diagnostic */}
        {currentStep === 'summary' && reconciliation && (
          <div className="space-y-4 animate-page-enter text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                <FileCheck size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-primary">Diagnóstico do extrato</h4>
                <p className="text-[11px] text-secondary">Cruzamento com o livro-razão concluído.</p>
              </div>
            </div>

            <B3ReconciliationKpiGrid
              items={[
                {
                  label: 'OK',
                  value: reconciliation.matched.length,
                  hint: 'Idênticos ao extrato',
                  tone: 'ok',
                },
                {
                  label: 'Divergentes',
                  value: conflictDrafts.filter((c) => !c.applied).length,
                  hint: 'Corrigir na etapa seguinte',
                  tone: 'warn',
                },
                {
                  label: 'Faltando',
                  value: missingDrafts.length,
                  hint: 'Importar no sistema',
                  tone: 'error',
                },
                {
                  label: 'Alertas',
                  value: reconciliation.existingOnly.length,
                  hint: 'Só no livro-razão',
                  tone: 'muted',
                },
              ]}
            />

            {positionPreviewRows.length > 0 && (
              <div className="w-full rounded-xl border border-border/40 bg-card/40 p-3 space-y-2">
                <p className="text-xs font-bold text-primary flex items-center gap-1.5">
                  <Layers size={14} className="text-indigo-500" />
                  Prévia de cotas (movimentação vs sistema)
                </p>
                <div className="overflow-x-auto rounded-xl border border-border/40">
                  <table className="w-full text-[11px] font-mono">
                    <thead>
                      <tr className="bg-secondary/50 text-secondary uppercase text-[9px] tracking-wider">
                        <th className="text-left px-3 py-2">Ticker</th>
                        <th className="text-right px-3 py-2">Extrato B3</th>
                        <th className="text-right px-3 py-2">Sistema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionPreviewRows.map((row) => {
                        const diff = Math.abs(row.b3 - row.system) > 0.0001
                        return (
                          <tr
                            key={row.ticker}
                            className={diff ? 'bg-amber-500/5' : ''}
                          >
                            <td className="px-3 py-1.5 font-bold text-primary">{row.ticker}</td>
                            <td className="px-3 py-1.5 text-right">{row.b3.toLocaleString('pt-BR')}</td>
                            <td className={`px-3 py-1.5 text-right ${diff ? 'text-amber-600 font-bold' : ''}`}>
                              {row.system.toLocaleString('pt-BR')}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Banner: itens excluídos da conciliação */}
            {(excludedCount.fixedIncome > 0 ||
              excludedCount.treasury > 0 ||
              excludedCount.ignoredByMovement > 0 ||
              excludedCount.subscriptionRights > 0 ||
              excludedCount.dedupe.ignoredInternal > 0 ||
              excludedCount.dedupe.ignoredCorporate > 0 ||
              excludedCount.dedupe.dedupedTrades > 0) && (
              <div className="max-w-2xl mx-auto w-full bg-amber-500/8 border border-amber-500/25 rounded-2xl p-3.5 text-left flex gap-3 items-start">
                <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-amber-400">Linhas filtradas do extrato B3</p>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    A conciliação automática considera apenas <strong>negociações, proventos e eventos corporativos</strong> de renda variável.
                    {excludedCount.ignoredByMovement > 0 && (
                      <span>
                        {' '}
                        <strong>{excludedCount.ignoredByMovement}</strong> linha
                        {excludedCount.ignoredByMovement > 1 ? 's' : ''} ignorada
                        {excludedCount.ignoredByMovement > 1 ? 's' : ''} no parse (transferências internas, empréstimos, etc.)
                      </span>
                    )}
                    {excludedCount.dedupe.ignoredInternal > 0 && (
                      <span>
                        {' '}
                        <strong>{excludedCount.dedupe.ignoredInternal}</strong> espelho
                        {excludedCount.dedupe.ignoredInternal > 1 ? 's' : ''} de transferência Crédito/Débito removido
                        {excludedCount.dedupe.ignoredInternal > 2 ? 's' : ''}.
                      </span>
                    )}
                    {excludedCount.dedupe.ignoredCorporate > 0 && (
                      <span>
                        {' '}
                        <strong>{excludedCount.dedupe.ignoredCorporate}</strong> cessão
                        {excludedCount.dedupe.ignoredCorporate > 1 ? 'ões' : 'ão'} de direitos removida
                        {excludedCount.dedupe.ignoredCorporate > 1 ? 's' : ''}.
                      </span>
                    )}
                    {excludedCount.dedupe.dedupedTrades > 0 && (
                      <span>
                        {' '}
                        <strong>{excludedCount.dedupe.dedupedTrades}</strong> compra/venda redundante
                        {excludedCount.dedupe.dedupedTrades > 1 ? 's' : ''} (já coberta pela liquidação).
                      </span>
                    )}
                    {excludedCount.subscriptionRights > 0 && (
                      <span>
                        {' '}
                        <strong>{excludedCount.subscriptionRights}</strong> direito
                        {excludedCount.subscriptionRights > 1 ? 's' : ''} de subscrição (ticker temporário, ex. MXRF12).
                      </span>
                    )}
                    {excludedCount.treasury > 0 && (
                      <span>
                        {' '}
                        <strong>{excludedCount.treasury}</strong> Tesouro Direto
                      </span>
                    )}
                    {excludedCount.fixedIncome > 0 && (
                      <span>
                        {excludedCount.treasury > 0 ? ' e ' : ' '}
                        <strong>{excludedCount.fixedIncome}</strong> renda fixa (CDB/LCI/LCA)
                      </span>
                    )}
                    {(excludedCount.treasury > 0 || excludedCount.fixedIncome > 0) &&
                      ' não entram na conciliação RV — cadastre no Livro-Razão manualmente.'}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <Button type="button" variant="primary" onClick={() => goToNextStepAfter('summary')} className="font-bold">
                {wizardCounts.corrections > 0 ? 'Corrigir pendências' : 'Validar posição B3'}
              </Button>
            </div>
          </div>
        )}

        {/* Correções unificadas */}
        {currentStep === 'corrections' && reconciliation && (
          <div className="space-y-3 animate-page-enter">
            <div className="flex gap-1 p-1 rounded-xl bg-primary/10 border border-border/40">
              {(
                [
                  { id: 'conflicts' as const, label: 'Divergentes', count: wizardCounts.conflicts },
                  { id: 'missing' as const, label: 'Faltando', count: wizardCounts.missing },
                  { id: 'suspicious' as const, label: 'Alertas', count: wizardCounts.suspicious },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCorrectionsTab(tab.id)}
                  className={`flex-1 min-w-0 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                    correctionsTab === tab.id
                      ? 'bg-primary text-secondary shadow-sm'
                      : 'text-secondary hover:text-primary'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1 opacity-80">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {correctionsTab === 'conflicts' && (
          <div className="space-y-3">
          <div className="space-y-4 animate-page-enter">
            <B3ReconciliationGuidance title="Divergências — o que fazer" variant="warning">
              Marque os itens em que o livro-razão deve ser atualizado para coincidir com o extrato B3. Se a diferença for intencional
              (ex.: ajuste manual documentado), desmarque e trate depois nos alertas ou na posição final.
            </B3ReconciliationGuidance>
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-sm font-black text-primary uppercase tracking-tight">Lançamentos Divergentes</h5>
                <p className="text-[10px] text-secondary">
                  Lançamentos encontrados com valores ou datas que não batem com o extrato oficial B3.
                </p>
              </div>
              <span className="text-xs text-secondary font-bold">
                {selectedConflictCount} selecionados de {conflictDrafts.filter(c => !c.applied).length}
              </span>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {conflictDrafts.filter(c => !c.applied).map((draft) => {
                const isPriceDiff = Math.abs(draft.existing.price - draft.official.price) > 0.0001
                const isQtyDiff = Math.abs(draft.existing.quantity - draft.official.quantity) > 0.0001
                const isDateDiff = draft.existing.date !== draft.official.date
                const isOpDiff = draft.existing.operation_type !== draft.official.operation_type

                return (
                  <div
                    key={draft.key}
                    className="p-3.5 bg-secondary/30 border border-primary rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-left"
                  >
                    <div className="md:col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-primary bg-primary text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:outline-none cursor-pointer"
                        checked={draft.selected}
                        onChange={(e) =>
                          setConflictDrafts((prev) =>
                            prev.map((c) => (c.key === draft.key ? { ...c, selected: e.target.checked } : c))
                          )
                        }
                      />
                    </div>

                    {/* Livro-Razão (Atual) */}
                    <div className="md:col-span-5 bg-card border border-border/40 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-primary font-bold">{draft.existing.ticker}</strong>
                        <span className="px-1.5 py-0.2 bg-red-500/10 text-red-500 rounded text-[9px] uppercase font-bold">
                          Livro-Razão
                        </span>
                      </div>
                      <p className="text-[9px] text-secondary">
                        Tipo:{' '}
                        <span className={`font-bold ${isOpDiff ? 'text-amber-500' : 'text-primary'}`}>
                          {portfolioOperationLabel(draft.existing.operation_type)}
                        </span>
                      </p>
                      <div className="grid grid-cols-3 gap-1.5 text-secondary font-mono text-[10px]">
                        <div>
                          <span>Data</span>
                          <span className={`block font-bold text-primary ${isDateDiff ? 'text-amber-500' : ''}`}>{draft.existing.date}</span>
                        </div>
                        <div>
                          <span>Qtd</span>
                          <span className={`block font-bold text-primary ${isQtyDiff ? 'text-amber-500' : ''}`}>
                            {draft.existing.quantity} un
                          </span>
                        </div>
                        <div>
                          <span>Preço</span>
                          <span className={`block font-bold text-primary ${isPriceDiff ? 'text-amber-500' : ''}`}>
                            {formatCurrency(draft.existing.price)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex items-center justify-center text-secondary">
                      <ArrowRight size={18} />
                    </div>

                    {/* B3 (Sugerido) */}
                    <div className="md:col-span-5 bg-indigo-500/5 border border-indigo-500/20 p-2.5 rounded-xl text-xs space-y-1">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-primary font-bold">{draft.official.ticker}</strong>
                        <span className="px-1.5 py-0.2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded text-[9px] uppercase font-bold">
                          B3 Oficial
                        </span>
                      </div>
                      <p className="text-[9px] text-secondary truncate" title={draft.official.raw_operation_type}>
                        Mov. B3: <span className="font-bold text-primary">{draft.official.raw_operation_type}</span>
                      </p>
                      <p className="text-[9px] text-secondary">
                        Tipo:{' '}
                        <span className={`font-bold ${isOpDiff ? 'text-indigo-500' : 'text-primary'}`}>
                          {portfolioOperationLabel(draft.official.operation_type)}
                        </span>
                      </p>
                      <div className="grid grid-cols-3 gap-1.5 text-secondary font-mono text-[10px]">
                        <div>
                          <span>Data</span>
                          <span className={`block font-bold text-primary ${isDateDiff ? 'text-indigo-500 font-extrabold' : ''}`}>{draft.official.date}</span>
                        </div>
                        <div>
                          <span>Qtd</span>
                          <span className={`block font-bold text-primary ${isQtyDiff ? 'text-indigo-500 font-extrabold' : ''}`}>
                            {draft.official.quantity} un
                          </span>
                        </div>
                        <div>
                          <span>Preço</span>
                          <span className={`block font-bold text-primary ${isPriceDiff ? 'text-indigo-500 font-extrabold' : ''}`}>
                            {formatCurrency(draft.official.price)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button
                variant="primary"
                size="sm"
                disabled={loading || selectedConflictCount === 0}
                onClick={handleApplySelectedConflicts}
                className="font-bold"
              >
                {loading ? 'Aplicando...' : `Aplicar ${selectedConflictCount}`}
              </Button>
            </div>
          </div>
            )}

            {correctionsTab === 'missing' && (
          <div className="space-y-3">
            <B3ReconciliationGuidance title="Faltantes — revisão antes de importar" variant="info">
              Confira tipo de operação (compra, venda, desdobro como <strong>cotas creditadas</strong>, grupamento como cancelamento de cotas).
              Desmarque linhas que você registrará manualmente depois.
            </B3ReconciliationGuidance>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
              <div>
                <h5 className="text-sm font-black text-primary uppercase tracking-tight">Lançamentos Faltantes no Livro-Razão</h5>
                <p className="text-[10px] text-secondary">
                  Movimentações presentes na B3 que ainda não foram inseridas no sistema. <span className="text-amber-500 font-bold">Você pode editar os campos antes de importar caso falte algum dado ou queira personalizar!</span>
                </p>
              </div>
              <span className="text-xs text-secondary font-bold shrink-0">
                {selectedMissingCount} de {missingDrafts.length} selecionados
              </span>
            </div>

            {/* Customization grid / table */}
            <div className="overflow-x-auto border border-primary rounded-2xl bg-secondary/5">
              <table className="w-full border-collapse text-left text-xs min-w-[980px]">
                <thead>
                  <tr className="bg-secondary border-b border-primary text-[10px] font-bold text-secondary uppercase tracking-wider">
                    <th className="p-3 text-center w-12">Importar</th>
                    <th className="p-3 w-28">Ticker</th>
                    <th className="p-3 w-36">Mov. B3</th>
                    <th className="p-3 w-32">Operação</th>
                    <th className="p-3 w-32">Data</th>
                    <th className="p-3 w-24 text-right">Qtd</th>
                    <th className="p-3 w-32 text-right">Preço Un.</th>
                    <th className="p-3 w-40 text-left">Tipo de Ativo (Definição)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary font-mono">
                  {missingDrafts.map((draft) => (
                    <tr
                      key={draft.id}
                      className={`hover:bg-secondary/40 transition-colors ${
                        draft.selected ? 'bg-indigo-500/5' : 'opacity-70'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-primary bg-primary text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0 focus:outline-none cursor-pointer"
                          checked={draft.selected}
                          onChange={(e) => updateMissingDraft(draft.id, 'selected', e.target.checked)}
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={draft.ticker}
                          onChange={(e) => updateMissingDraft(draft.id, 'ticker', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 uppercase text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3">
                        <span
                          className="block text-[10px] text-secondary truncate max-w-[140px] font-sans"
                          title={draft.official.raw_operation_type}
                        >
                          {draft.official.raw_operation_type}
                        </span>
                      </td>
                      <td className="p-3">
                        <select
                          value={draft.operation_type}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'operation_type', e.target.value as PortfolioOperationType)
                          }
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-1.5 py-1 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                        >
                          {OPERATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3">
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) => updateMissingDraft(draft.id, 'date', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={draft.quantity}
                          onChange={(e) => updateMissingDraft(draft.id, 'quantity', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 text-right text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="any"
                          value={draft.price}
                          onChange={(e) => updateMissingDraft(draft.id, 'price', e.target.value)}
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-2 py-1 text-right text-xs font-bold font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                        />
                      </td>
                      <td className="p-3 text-left">
                        <select
                          value={draft.pricing_mode}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'pricing_mode', e.target.value as PortfolioPricingMode)
                          }
                          className="w-full bg-primary text-primary border border-primary rounded-lg px-1.5 py-1 text-xs font-bold focus:ring-1 focus:ring-indigo-500 focus:outline-none font-sans"
                        >
                          {PORTFOLIO_PRICING_MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                variant="primary"
                size="sm"
                disabled={loading || selectedMissingCount === 0}
                onClick={handleImportSelectedMissing}
                className="font-bold"
              >
                {loading ? 'Importando...' : `Importar ${selectedMissingCount}`}
              </Button>
            </div>
          </div>
            )}

            {correctionsTab === 'suspicious' && (
          <div className="space-y-3">
            <B3ReconciliationGuidance title="Correção manual necessária" variant="warning">
              Cada item abaixo existe no livro-razão mas não foi encontrado no extrato de movimentação. Exclua duplicatas ou corrija o ticker/data.
              Se o lançamento for legítimo fora do período do extrato, pode ignorar e seguir — a etapa de posição detectará saldo fantasma.
            </B3ReconciliationGuidance>
            <div className="text-left">
              <h5 className="text-sm font-black text-primary uppercase tracking-tight">Lançamentos Exclusivos do Livro-Razão</h5>
              <p className="text-[10px] text-secondary">
                Estes lançamentos existem apenas no sistema no período analisado, mas não constam no extrato B3 enviado. Podem ser duplicatas ou inserções manuais incorretas.
              </p>
            </div>

            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 text-left">
              {reconciliation.existingOnly.length === 0 ? (
                <p className="text-xs text-secondary italic py-6 text-center">Nenhum alerta pendente.</p>
              ) : (
                reconciliation.existingOnly.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-center justify-between text-xs transition-all hover:bg-red-500/10"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-primary font-bold font-mono">{tx.ticker}</strong>
                        <span className="px-1.5 py-0.2 bg-red-500/10 text-red-500 rounded text-[9px] uppercase font-bold">
                          Exclusivo do Sistema
                        </span>
                      </div>
                      <div className="text-[10px] text-secondary mt-1 font-mono">
                        <span>Data: <strong>{tx.date}</strong></span>
                        <span className="mx-2">•</span>
                        <span>Qtd: <strong>{tx.quantity}</strong></span>
                        <span className="mx-2">•</span>
                        <span>Preço: <strong>{formatCurrency(tx.price)}</strong></span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteLedgerOnlyTransaction(tx.id)}
                      className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-white px-3 font-semibold text-xs py-1"
                    >
                      Excluir Lançamento
                    </Button>
                  </div>
                ))
              )}
            </div>

          </div>
            )}

            <div className="flex justify-between items-center pt-2 border-t border-border/30">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('summary')}>
                Voltar
              </Button>
              <Button variant="primary" size="sm" onClick={() => setCurrentStep('position')} className="font-bold">
                Validar posição B3
              </Button>
            </div>
          </div>
        )}

        {currentStep === 'position' && reconciliation && (
          <div className="space-y-3 animate-page-enter">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" />
              <h5 className="text-sm font-black text-primary">Posição oficial B3</h5>
            </div>

            <B3PositionValidationPanel
              positionFileName={positionFileName}
              positionParseStatus={positionParseStatus}
              positionDragActive={positionDragActive}
              positionValidation={positionValidation}
              adjustments={positionAdjustments}
              selectedAdjustmentTickers={selectedAdjustmentTickers}
              onToggleAdjustment={(ticker) => {
                setSelectedAdjustmentTickers((prev) => {
                  const next = new Set(prev)
                  if (next.has(ticker)) next.delete(ticker)
                  else next.add(ticker)
                  return next
                })
              }}
              onSelectAllAdjustments={(selected) => {
                setSelectedAdjustmentTickers(
                  selected ? new Set(positionAdjustments.map((a) => a.ticker)) : new Set()
                )
              }}
              onPositionFileInputRef={(el) => {
                positionFileInputRef.current = el
              }}
              onPositionDragEnter={(e) => {
                e.preventDefault()
                setPositionDragActive(true)
              }}
              onPositionDragOver={(e) => e.preventDefault()}
              onPositionDragLeave={(e) => {
                e.preventDefault()
                setPositionDragActive(false)
              }}
              onPositionDrop={async (e) => {
                e.preventDefault()
                setPositionDragActive(false)
                const file = e.dataTransfer.files?.[0]
                if (file?.name.endsWith('.xlsx')) {
                  await processPositionFileBuffer(await file.arrayBuffer(), file.name)
                } else {
                  toast.error('Envie um arquivo .xlsx de posição.')
                }
              }}
              onPositionFileChange={async (file) => {
                await processPositionFileBuffer(await file.arrayBuffer(), file.name)
              }}
              onApplyAdjustments={handleApplyPositionAdjustments}
              applyingAdjustments={loading}
              showNonEquityNote={
                !!officialPosition &&
                (Object.keys(officialPosition.treasury).length > 0 ||
                  Object.keys(officialPosition.fixedIncome).length > 0)
              }
            />

            {positionValidation && !positionValidation.allOk && ledgerOnlyMismatches === 0 && (
              <label className="flex items-start gap-2 text-[11px] text-secondary cursor-pointer px-1">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-primary"
                  checked={acknowledgePositionGaps}
                  onChange={(e) => setAcknowledgePositionGaps(e.target.checked)}
                />
                <span>Só há divergência no extrato de movimentação; o livro-razão já confere com a B3.</span>
              </label>
            )}

            <div className="flex justify-between items-center pt-1">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('corrections')}>
                Voltar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!positionValidation || (!positionValidation.allOk && !acknowledgePositionGaps)}
                onClick={() => setCurrentStep('review')}
                className="font-bold"
              >
                Concluir
              </Button>
            </div>
          </div>
        )}

        {/* STEP 6: Review */}
        {currentStep === 'review' && reconciliation && (
          <div className="space-y-5 text-center animate-page-enter">
            <div className="w-14 h-14 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto shadow-sm">
              <Layers size={26} />
            </div>

            <div className="space-y-1">
              <h4 className="text-base font-black text-primary uppercase tracking-tight">Revisão Final da Conciliação</h4>
              <p className="text-xs text-secondary max-w-sm mx-auto leading-relaxed">
                {positionValidation?.allOk
                  ? 'Movimentações e posição oficial B3 estão alinhadas com o livro-razão.'
                  : acknowledgePositionGaps
                    ? 'Conciliação encerrada com pendências de posição — revise os tickers indicados no livro-razão.'
                    : 'Processo de auditoria concluído.'}
              </p>
            </div>

            <div className="bg-secondary/40 border border-primary p-4 rounded-3xl max-w-md mx-auto space-y-3 font-sans text-left">
              <h5 className="font-extrabold text-xs text-primary uppercase tracking-wider mb-2">Resumo Geral do Portfólio</h5>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-secondary">Total de Itens Analisados:</span>
                  <span className="font-bold text-primary">
                    {reconciliation.matched.length + reconciliation.conflicts.length + reconciliation.missing.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary">Itens Conciliados / OK:</span>
                  <span className="font-bold text-emerald-500">
                    {reconciliation.matched.length + conflictDrafts.filter(c => c.applied).length}
                  </span>
                </div>
                {positionValidation && (
                  <div className="flex justify-between">
                    <span className="text-secondary">Validação de posição:</span>
                    <span
                      className={`font-bold flex items-center gap-1 ${
                        positionValidation.allOk ? 'text-emerald-500' : 'text-amber-500'
                      }`}
                    >
                      {positionValidation.allOk ? (
                        <>
                          <Check size={14} /> Integrada
                        </>
                      ) : (
                        <>
                          <AlertCircle size={14} /> {positionValidation.mismatchCount} pendência(s)
                        </>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-primary/10 pt-2 font-sans font-black text-sm text-primary mt-3">
                   <span>Status Geral:</span>
                   <span
                     className={`flex items-center gap-1 ${
                       positionValidation?.allOk !== false ? 'text-emerald-500' : 'text-amber-500'
                     }`}
                   >
                     {positionValidation?.allOk !== false ? (
                       <>
                         <Check size={16} /> Sincronizado
                       </>
                     ) : (
                       <>
                         <AlertCircle size={16} /> Com ressalvas
                       </>
                     )}
                   </span>
                 </div>
               </div>
             </div>

             {manualYieldRequiredAssets.length > 0 && (
               <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-3xl max-w-md mx-auto text-left space-y-3">
                 <div className="flex items-start gap-2.5">
                   <AlertCircle size={18} className="text-amber-500 shrink-0 mt-0.5" />
                   <div>
                     <h6 className="font-extrabold text-xs text-primary uppercase tracking-wider">Configuração de Rentabilidade Requerida</h6>
                     <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                       Identificamos ativos de Renda Fixa ou de valor manual recém-importados. Configure a taxa acordada (ex: % do CDI) ou o valor manual atualizado:
                     </p>
                   </div>
                 </div>
                 <div className="space-y-2 pt-1">
                   {manualYieldRequiredAssets.map((asset) => (
                     <div key={asset.ticker} className="flex items-center justify-between bg-primary p-2.5 rounded-xl border border-primary/40 text-xs">
                       <div className="overflow-hidden mr-2">
                         <strong className="text-primary font-mono block truncate max-w-[200px]" title={asset.ticker}>
                           {asset.ticker}
                         </strong>
                         <span className="text-[10px] text-secondary block font-sans">
                           {asset.pricing_mode === 'fixed_income' ? 'Renda Fixa' : 'Valor Manual'}
                         </span>
                       </div>
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => onOpenAssetConfig(asset.ticker)}
                         className="flex items-center gap-1 border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 py-1 px-2.5 font-bold text-[10px] shrink-0"
                       >
                         Configurar
                       </Button>
                     </div>
                   ))}
                 </div>
               </div>
             )}

             <div className="flex gap-3 justify-center pt-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('position')}>
                Revisar Posição
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('upload')}>
                Conciliar Outro Extrato
              </Button>
              <Button variant="primary" onClick={onClose} className="font-bold">
                Concluir Auditoria
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  )
}
