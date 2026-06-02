import { useMemo, useRef, useState, useEffect } from 'react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { supabase } from '@/lib/supabase'
import type { PortfolioOperationType, PortfolioTransaction, PortfolioPricingMode, PortfolioAssetDefinition, PortfolioAssetIndexer } from '@/types'
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
import { isB3TickerPattern, detectDefaultCurrency } from '@/services/priceService'
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
  // Novos campos editáveis para Renda Fixa
  indexer: PortfolioAssetIndexer
  indexer_percent: string
  contract_rate: string
  maturity_date: string
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

type ReconciliationStep = 'upload' | 'summary' | 'corrections' | 'yield_config' | 'position' | 'review'
type CorrectionsTab = 'conflicts' | 'missing' | 'suspicious'

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
  const [positionOnlyMode, setPositionOnlyMode] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [positionDragActive, setPositionDragActive] = useState(false)
  const [positionFileName, setPositionFileName] = useState('')
  const [positionParseStatus, setPositionParseStatus] = useState('')
  const [officialPosition, setOfficialPosition] = useState<B3PositionParseResult | null>(null)
  const [positionValidation, setPositionValidation] = useState<PositionValidationResult | null>(null)
  // Removed unused state
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
    const list = importedDrafts.filter(draft => 
      draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value' || draft.isTreasury
    )
    
    // Group by unique ticker to avoid duplicate cards in the Step 3 UI
    const uniqueMap = new Map<string, typeof list[0]>()
    for (const draft of list) {
      const tickerUpper = draft.ticker.toUpperCase().trim()
      if (!uniqueMap.has(tickerUpper)) {
        uniqueMap.set(tickerUpper, draft)
      } else {
        const existing = uniqueMap.get(tickerUpper)!
        // Keep the one with indexer/maturity configured if any
        if (existing.indexer === 'none' && draft.indexer !== 'none') {
          uniqueMap.set(tickerUpper, draft)
        }
      }
    }
    
    return Array.from(uniqueMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date) || a.ticker.localeCompare(b.ticker)
    )
  }, [importedDrafts])


  const existingSystemTickers = useMemo(() => {
    const tickers = new Set<string>()
    existingTransactions.forEach((tx) => {
      if (
        tx.ticker !== 'SALDO_INV' &&
        tx.ticker !== 'CAIXA' &&
        tx.ticker !== 'SALDO EM CAIXA' &&
        tx.ticker !== 'SALDO_EM_CAIXA'
      ) {
        tickers.add(tx.ticker.toUpperCase())
      }
    })
    return Array.from(tickers).sort()
  }, [existingTransactions])

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
      setPositionOnlyMode(false)
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

  const goToNextStepAfter = (from: ReconciliationStep, newlyImported?: MissingDraft[]) => {
    if (!reconciliation) return
    const order: ReconciliationStep[] = ['summary', 'corrections', 'yield_config', 'position', 'review']
    
    // Check if yield configuration is required using already imported drafts plus any newly imported ones
    const allYieldDrafts = [...importedDrafts, ...(newlyImported || [])]
    const activeYieldRequired = allYieldDrafts.filter((draft) => 
      draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value' || draft.isTreasury
    )

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
      if (step === 'yield_config' && activeYieldRequired.length > 0) {
        setCurrentStep('yield_config')
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

  const wizardSteps = useMemo(() => {
    const steps = [
      { id: 'summary' as ReconciliationStep, label: 'Resumo' },
      { id: 'corrections' as ReconciliationStep, label: 'Correções' },
    ]
    if (manualYieldRequiredAssets.length > 0) {
      steps.push({ id: 'yield_config' as ReconciliationStep, label: 'Rentabilidade' })
    }
    steps.push({ id: 'position' as ReconciliationStep, label: 'Posição' })
    steps.push({ id: 'review' as ReconciliationStep, label: 'Fim' })
    return steps
  }, [manualYieldRequiredAssets])

  const stepperItems = useMemo(
    () =>
      wizardSteps.map((s) => ({
        id: s.id,
        label: s.label,
        badge:
          s.id === 'corrections'
            ? wizardCounts.corrections
            : s.id === 'position' && positionValidation && !positionValidation.allOk
              ? ledgerOnlyMismatches || positionValidation.mismatchCount
              : s.id === 'yield_config'
                ? manualYieldRequiredAssets.length
                : undefined,
      })),
    [wizardSteps, wizardCounts.corrections, positionValidation, ledgerOnlyMismatches, manualYieldRequiredAssets]
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
      const upper = tx.ticker.toUpperCase()
      // Ativos B3, renda fixa ou tesouro direto constam na custódia B3
      const category = classifyB3Item(upper)
      const isB3 = isB3TickerPattern(upper) || category === 'fixedIncome' || category === 'treasury'
      if (!isB3) continue
      tickers.add(upper)
    }
    const map: Record<string, number> = {}
    for (const ticker of tickers) {
      const qty = computeTickerQuantity(existingTransactions, ticker)
      if (qty > 0.000_001) map[ticker] = qty
    }
    return map
  }, [existingTransactions])

  /** Tickers com posição positiva no livro-razão que não são padrão B3 (internacionais, cripto, etc.) */
  const nonB3SystemPositions = useMemo(() => {
    const cashTickers = new Set(['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'])
    const tickers = new Set<string>()
    for (const tx of existingTransactions) {
      if (cashTickers.has(tx.ticker) || tx.cash_offset_source_id) continue
      const upper = tx.ticker.toUpperCase()
      
      const category = classifyB3Item(upper)
      const isB3 = isB3TickerPattern(upper) || category === 'fixedIncome' || category === 'treasury'
      if (isB3) continue // já coberto pela validação de posição
      tickers.add(upper)
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
    const combinedOfficial = {
      ...official.equity,
      ...official.treasury,
      ...official.fixedIncome,
    }
    const validation = buildPositionValidation(combinedOfficial, movements, system)
    setPositionValidation(validation)
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
      const totalKeys = Object.keys(parsed.equity).length + Object.keys(parsed.treasury).length + Object.keys(parsed.fixedIncome).length
      if (totalKeys === 0) {
        setPositionParseStatus('Nenhum ativo de Renda Variável, Tesouro ou Renda Fixa encontrado na planilha de posição.')
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
        // Arquivo de posição carregado direto no upload — entrar em modo somente-posição
        setParseStatus('')
        setPositionOnlyMode(true)
        await processPositionFileBuffer(buffer, name)
        setCurrentStep('position')
        return
      }
      const parseResult = parseB3Excel(buffer)
      const allParsedItems = parseResult.items

      if (allParsedItems.length === 0) {
        setParseStatus('O arquivo enviado não contém lançamentos reconhecíveis ou está vazio.')
        return
      }

      // ── Contar categorias e manter ativos de Renda Fixa e Tesouro Direto ──
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
        }
        if (category === 'fixedIncome') {
          fixedIncomeCount++
        }
        return true
      })
      setExcludedCount({
        fixedIncome: 0,
        treasury: 0,
        ignoredByMovement: parseResult.ignoredByMovement,
        subscriptionRights: subscriptionRightsCount,
        dedupe: parseResult.dedupe,
      })

      if (parsedItems.length === 0) {
        setParseStatus('O arquivo enviado não contém lançamentos reconhecíveis ou está vazio.')
        return
      }

      setParseStatus('Analisando correspondências no livro-razão...')
      const result = reconcileInvestmentTransactions(parsedItems, existingTransactions)

      setReconciliation(result)
      setParsedEquityItems(parsedItems)

      // Initialize editable missing drafts — incluindo Renda Fixa e Tesouro Direto
      setMissingDrafts(
        result.missing.map((item) => {
          const category = classifyB3Item(item.ticker, item.product_name)
          const isB3 = isB3TickerPattern(item.ticker)
          
          let pricingMode: PortfolioPricingMode = 'market'
          let isTreasury = false
          let isB3Linked = isB3
          
          if (category === 'treasury') {
            pricingMode = 'market'
            isTreasury = true
            isB3Linked = true
          } else if (category === 'fixedIncome') {
            pricingMode = 'fixed_income'
            isB3Linked = false
          } else {
            pricingMode = isB3 ? 'market' : 'fixed_income'
          }

          let indexer: PortfolioAssetIndexer = 'none'
          let indexerPercent = ''
          let contractRate = ''
          
          const tUpper = item.ticker.toUpperCase()
          const nameUpper = (item.product_name || '').toUpperCase()
          const combined = tUpper + ' ' + nameUpper

          if (category === 'fixedIncome' || category === 'treasury') {
            if (combined.includes('CDI')) {
              indexer = 'cdi'
              indexerPercent = '100'
            } else if (combined.includes('SELIC')) {
              indexer = 'selic'
              indexerPercent = '100'
            } else if (combined.includes('IPCA')) {
              indexer = 'ipca'
              indexerPercent = '100'
            }
          }

          let maturityDate = ''
          const yearMatch = combined.match(/\b(202[6-9]|203[0-9]|204[0-9])\b/)
          if (yearMatch) {
            maturityDate = `${yearMatch[1]}-12-31`
          }

          return {
            id: item.id,
            selected: true,
            ticker: item.ticker,
            date: item.date,
            operation_type: item.operation_type,
            quantity: String(item.quantity),
            price: String(item.price),
            pricing_mode: pricingMode,
            isB3Linked: isB3Linked,
            isTreasury: isTreasury,
            product_name: item.product_name,
            official: item,
            indexer,
            indexer_percent: indexerPercent,
            contract_rate: contractRate,
            maturity_date: maturityDate,
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
  }

  const updateImportedDraft = <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => {
    setImportedDrafts((prev) => {
      const targetDraft = prev.find(d => d.id === id)
      if (!targetDraft) return prev
      const tickerUpper = targetDraft.ticker.toUpperCase().trim()
      return prev.map((draft) => 
        draft.ticker.toUpperCase().trim() === tickerUpper ? { ...draft, [key]: value } : draft
      )
    })
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
      
      if (manualYieldRequiredAssets.length > 0) {
        setCurrentStep('yield_config')
      } else {
        goToNextStepAfter('corrections')
      }
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

        // 2. Preparar payload de definição de ativo com suporte a Renda Fixa e Tesouro Direto
        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: draft.pricing_mode,
          is_b3_linked: draft.pricing_mode === 'market' ? draft.isB3Linked : false,
          applied_amount: draft.pricing_mode !== 'market' ? prc * qty : null,
          application_date: draft.date,
          is_treasury: draft.pricing_mode === 'market' ? draft.isTreasury : false,
          indexer: draft.pricing_mode === 'fixed_income' ? (draft.indexer || 'none') : 'none',
          indexer_percent: draft.pricing_mode === 'fixed_income' && (draft.indexer || 'none') !== 'none' ? (parseFloat(draft.indexer_percent) || 100) : 100,
          contract_rate: draft.pricing_mode === 'fixed_income' ? (parseFloat(draft.contract_rate) || null) : null,
          maturity_date: draft.pricing_mode === 'fixed_income' && draft.maturity_date ? draft.maturity_date : null,
          currency: detectDefaultCurrency(tickerUpper),
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

      const hasYieldAssets = activeMissing.some((draft) => 
        draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value' || draft.isTreasury
      )
      if (hasYieldAssets || manualYieldRequiredAssets.length > 0) {
        setCurrentStep('yield_config')
      } else {
        goToNextStepAfter('corrections', activeMissing)
      }
    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erro ao efetuar a importação em lote.')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleSaveAssetYield = async (asset: MissingDraft) => {
    try {
      const { error } = await supabase
        .from('portfolio_asset_definitions')
        .update({
          indexer: asset.indexer,
          indexer_percent: asset.indexer !== 'none' ? (parseFloat(asset.indexer_percent) || 100) : 100,
          contract_rate: asset.indexer === 'none' ? (parseFloat(asset.contract_rate) || null) : null,
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
        
        {/* Hidden inputs always available in the DOM */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          id="b3-position-file-input-step1"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (file) {
              await processPositionFileBuffer(await file.arrayBuffer(), file.name)
            }
          }}
        />
        
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

        {(reconciliation || positionOnlyMode) && currentStep !== 'upload' && (
          <B3ReconciliationStepper
            steps={
              positionOnlyMode
                ? [{ id: 'position', label: 'Posição' }]
                : stepperItems
            }
            currentStepId={currentStep}
            onStepClick={(id) => setCurrentStep(id as ReconciliationStep)}
            footer={
              positionFileName ? (
                <p className="text-[10px] text-secondary truncate" title={positionFileName}>
                  {positionOnlyMode ? (
                    <>
                      <span className="text-indigo-500 font-bold">Modo posição</span>
                      {' · '}
                    </>
                  ) : (
                    fileName ? <>
                      Movimentação: <span className="font-mono text-primary">{fileName}</span>
                      {' · '}
                    </> : null
                  )}
                  Posição: <span className="font-mono text-primary">{positionFileName}</span>
                </p>
              ) : null
            }
          />
        )}

        {/* STEP 1: Dual Upload Center */}
        {currentStep === 'upload' && (
          <div className="space-y-4 text-left animate-page-enter">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500 shrink-0">
                <Upload size={20} className="animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-black text-primary uppercase tracking-tight">Centro de Auditoria e Custódia B3</h4>
                <p className="text-[11px] text-secondary">Envie os relatórios oficiais da B3 para iniciar a auditoria eletrônica.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card A: Movimentações */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative overflow-hidden border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer backdrop-blur-md transition-all duration-300 ${
                  dragActive
                    ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01] shadow-lg shadow-indigo-500/5'
                    : fileName
                      ? 'border-indigo-500/30 bg-indigo-500/[0.02] hover:border-indigo-500/50 hover:bg-indigo-500/5'
                      : 'border-primary/30 bg-primary/20 hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]'
                } group`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  fileName ? 'bg-indigo-500/15 text-indigo-500' : 'bg-primary/30 text-secondary'
                } group-hover:scale-105`}>
                  <Upload size={24} className={dragActive ? 'animate-bounce' : ''} />
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-black text-primary uppercase tracking-wider">
                    {fileName ? (
                      <span className="text-indigo-500 font-mono text-[11px] block truncate max-w-[200px]" title={fileName}>{fileName}</span>
                    ) : (
                      '1. Extrato de Movimentações'
                    )}
                  </p>
                  <p className="text-[10px] text-secondary leading-relaxed px-4">
                    {fileName 
                      ? 'Movimentações carregadas com sucesso!' 
                      : 'Obrigatório. Arquivo movimentacao-*.xlsx contendo aportes, retiradas e proventos.'}
                  </p>
                </div>

                {fileName ? (
                  <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1">
                    <Check size={10} /> Pronto
                  </div>
                ) : (
                  <span className="text-[8.5px] font-mono text-secondary/60 bg-secondary/50 px-2 py-0.5 rounded border border-border/30 mt-1">
                    Padrão oficial B3 (.xlsx)
                  </span>
                )}
              </div>

              {/* Card B: Posição */}
              <div
                onDragEnter={(e) => {
                  e.preventDefault()
                  setPositionDragActive(true)
                }}
                onDragOver={(e) => {
                  e.preventDefault()
                  setPositionDragActive(true)
                }}
                onDragLeave={(e) => {
                  e.preventDefault()
                  setPositionDragActive(false)
                }}
                onDrop={async (e) => {
                  e.preventDefault()
                  setPositionDragActive(false)
                  const file = e.dataTransfer.files?.[0]
                  if (file?.name.endsWith('.xlsx')) {
                    const buffer = await file.arrayBuffer()
                    await processPositionFileBuffer(buffer, file.name)
                  } else {
                    toast.error('Envie um arquivo .xlsx de posição.')
                  }
                }}
                onClick={() => document.getElementById('b3-position-file-input-step1')?.click()}
                className={`relative overflow-hidden border border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 cursor-pointer backdrop-blur-md transition-all duration-300 ${
                  positionDragActive
                    ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01] shadow-lg shadow-emerald-500/5'
                    : positionFileName
                      ? 'border-emerald-500/30 bg-emerald-500/[0.02] hover:border-emerald-500/50 hover:bg-emerald-500/5'
                      : 'border-primary/30 bg-primary/20 hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]'
                } group`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  positionFileName ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/30 text-secondary'
                } group-hover:scale-105`}>
                  <Upload size={24} className={positionDragActive ? 'animate-bounce' : ''} />
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-black text-primary uppercase tracking-wider">
                    {positionFileName ? (
                      <span className="text-emerald-500 font-mono text-[11px] block truncate max-w-[200px]" title={positionFileName}>{positionFileName}</span>
                    ) : (
                      '2. Posição de Custódia'
                    )}
                  </p>
                  <p className="text-[10px] text-secondary leading-relaxed px-4">
                    {positionFileName 
                      ? 'Posições de custódia carregadas com sucesso!' 
                      : 'Recomendado. Arquivo posicao-*.xlsx para cruzar cotas finais e ajustar delta.'}
                  </p>
                </div>

                {positionFileName ? (
                  <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase px-2 py-0.5 rounded-full mt-1">
                    <Check size={10} /> Pronto
                  </div>
                ) : (
                  <span className="text-[8.5px] font-mono text-secondary/60 bg-secondary/50 px-2 py-0.5 rounded border border-border/30 mt-1">
                    Opcional no início (.xlsx)
                  </span>
                )}
              </div>
            </div>

            {/* Parsing error message */}
            {(parseStatus || positionParseStatus) && (
              <div className="p-3 bg-amber-500/5 border border-amber-500/15 rounded-2xl text-[11px] text-amber-500 flex items-start gap-2.5">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {parseStatus && <p>{parseStatus}</p>}
                  {positionParseStatus && <p>{positionParseStatus}</p>}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex justify-end gap-3 pt-2 border-t border-border/20">
              {positionFileName && !fileName && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setPositionOnlyMode(true)
                    setCurrentStep('position')
                  }}
                  className="font-bold gap-1.5 shadow-md shadow-indigo-500/15 animate-pulse-slow"
                >
                  Continuar Apenas com Posição <ArrowRight size={14} />
                </Button>
              )}
              {fileName && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setCurrentStep('summary')
                  }}
                  className="font-bold gap-1.5 shadow-lg shadow-indigo-500/20 hover:scale-102 transition-all duration-300"
                >
                  {positionFileName ? 'Iniciar Auditoria Completa' : 'Iniciar Auditoria de Movimentações'} <ArrowRight size={14} />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Summary / Diagnostic */}
        {currentStep === 'summary' && reconciliation && (() => {
          const totalItems = reconciliation.matched.length + conflictDrafts.filter((c) => !c.applied).length + missingDrafts.length
          const matchRate = totalItems > 0 ? Math.round((reconciliation.matched.length / totalItems) * 100) : 100
          
          const radius = 45
          const circumference = 2 * Math.PI * radius
          const strokeDashoffset = circumference - (matchRate / 100) * circumference

          return (
            <div className="space-y-4 animate-page-enter text-left">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
                    <FileCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-primary uppercase tracking-tight">Diagnóstico Eletrônico</h4>
                    <p className="text-[11px] text-secondary">cruzamento de lançamentos e históricos finalizado.</p>
                  </div>
                </div>
                <Button type="button" variant="primary" onClick={() => goToNextStepAfter('summary')} className="font-bold shrink-0 self-end sm:self-auto">
                  {wizardCounts.corrections > 0 ? 'Corrigir pendências →' : 'Validar posição B3 →'}
                </Button>
              </div>

              {/* Glassmorphic Match Rate Panel */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-card/40 border border-border/40 rounded-2xl p-4 backdrop-blur-md">
                {/* SVG Progress Ring Gauge */}
                <div className="md:col-span-4 flex flex-col items-center justify-center py-2 border-b md:border-b-0 md:border-r border-border/30">
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                      {/* Gray track circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        className="stroke-border/20 fill-none"
                        strokeWidth="8"
                      />
                      {/* Active green/blue gradient circle */}
                      <circle
                        cx="60"
                        cy="60"
                        r={radius}
                        className="stroke-emerald-500 fill-none transition-all duration-1000 ease-out"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <p className="text-2xl font-black font-mono tracking-tighter text-emerald-500 tabular-nums">
                        {matchRate}%
                      </p>
                      <p className="text-[8px] font-black uppercase text-secondary/60 tracking-wider">
                        Alinhados
                      </p>
                    </div>
                  </div>
                </div>

                {/* Text analysis */}
                <div className="md:col-span-8 space-y-1.5 px-2">
                  <h5 className="text-xs font-black text-primary uppercase tracking-tight">Nível de Coincidência da Carteira</h5>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    {matchRate === 100 ? (
                      <span className="text-emerald-500 font-semibold">Conciliação perfeita encontrada! Todos os lançamentos da B3 já estão catalogados e corretos no livro-razão.</span>
                    ) : matchRate >= 80 ? (
                      <span>Sua carteira está altamente integrada com o sistema. Há apenas algumas <strong className="text-amber-500">{conflictDrafts.filter(c => !c.applied).length} divergências</strong> e <strong className="text-red-500">{missingDrafts.length} transações faltantes</strong> a regularizar.</span>
                    ) : (
                      <span>Auditoria iniciada. Detectamos desvios significativos no histórico. Recomendamos aplicar as correções e importações recomendadas para restabelecer a precisão da carteira.</span>
                    )}
                  </p>
                  <p className="text-[10px] text-secondary/70">
                    O sistema processou <strong className="text-primary font-bold">{totalItems} transações</strong> no extrato de negociações da B3.
                  </p>
                </div>
              </div>

              <B3ReconciliationKpiGrid
                items={[
                  {
                    label: 'OK',
                    value: reconciliation.matched.length,
                    hint: 'Lançamentos em perfeita conformidade',
                    tone: 'ok',
                  },
                  {
                    label: 'Divergentes',
                    value: conflictDrafts.filter((c) => !c.applied).length,
                    hint: 'Corrigir no passo seguinte',
                    tone: 'warn',
                  },
                  {
                    label: 'Faltando',
                    value: missingDrafts.length,
                    hint: 'Importar no sistema em lote',
                    tone: 'error',
                  },
                  {
                    label: 'Alertas',
                    value: reconciliation.existingOnly.length,
                    hint: 'Existentes apenas no livro-razão',
                    tone: 'muted',
                  },
                ]}
              />

              {positionPreviewRows.length > 0 && (
                <div className="w-full rounded-2xl border border-border/40 bg-card/20 p-4 backdrop-blur-md space-y-3">
                  <p className="text-xs font-black text-primary flex items-center gap-1.5 uppercase tracking-tight">
                    <Layers size={14} className="text-indigo-500" />
                    Auditoria Preliminar de Cotas de Custódia
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-border/40 bg-card/10">
                    <table className="w-full text-[11px] font-mono border-collapse">
                      <thead>
                        <tr className="bg-secondary/40 text-secondary uppercase text-[9px] tracking-wider border-b border-border/30">
                          <th className="text-left px-4 py-2.5 font-extrabold">Ticker</th>
                          <th className="text-right px-4 py-2.5 font-extrabold">Extrato B3</th>
                          <th className="text-right px-4 py-2.5 font-extrabold">Sistema (Livro-Razão)</th>
                          <th className="text-right px-4 py-2.5 font-extrabold">delta ($\Delta$)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {positionPreviewRows.map((row) => {
                          const delta = row.b3 - row.system
                          const diff = Math.abs(delta) > 0.0001
                          return (
                            <tr
                              key={row.ticker}
                              className={`transition-colors duration-150 ${
                                diff ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.05]' : 'hover:bg-primary/5'
                              }`}
                            >
                              <td className="px-4 py-2 font-bold text-primary text-xs">{row.ticker}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{row.b3.toLocaleString('pt-BR')}</td>
                              <td className="px-4 py-2 text-right tabular-nums">{row.system.toLocaleString('pt-BR')}</td>
                              <td className={`px-4 py-2 text-right font-black tabular-nums ${
                                diff ? (delta > 0 ? 'text-emerald-500' : 'text-red-500') : 'text-secondary/60'
                              }`}>
                                {diff ? `${delta > 0 ? '+' : ''}${delta.toLocaleString('pt-BR')}` : '—'}
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
                <div className="w-full bg-amber-500/[0.03] border border-amber-500/20 rounded-2xl p-4 text-left flex gap-3 items-start">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-amber-500">Linhas desconsideradas do parser B3</p>
                    <p className="text-[10px] text-secondary leading-relaxed">
                      A conciliação automatizada considera apenas <strong>negociações, proventos e eventos corporativos</strong> de renda variável.
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

            </div>
          )
        })()}

        {/* Correções unificadas */}
        {currentStep === 'corrections' && reconciliation && (
          <div className="space-y-3 animate-page-enter">
            <div className="flex justify-between items-center bg-secondary/10 border border-border/30 p-2.5 rounded-2xl gap-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('summary')} className="font-bold">
                ← Voltar
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  if (manualYieldRequiredAssets.length > 0) {
                    setCurrentStep('yield_config')
                  } else {
                    goToNextStepAfter('corrections')
                  }
                }}
                className="font-bold shadow-md shadow-indigo-500/10"
              >
                {manualYieldRequiredAssets.length > 0 ? 'Avançar para Rentabilidade →' : 'Validar posição B3 →'}
              </Button>
            </div>

            <div className="flex gap-1.5 p-1 rounded-2xl bg-card/40 border border-border/30 backdrop-blur-md">
              {(
                [
                  { id: 'conflicts' as const, label: 'Divergentes', count: wizardCounts.conflicts },
                  { id: 'missing' as const, label: 'Faltando', count: wizardCounts.missing },
                  { id: 'suspicious' as const, label: 'Alertas', count: wizardCounts.suspicious },
                ] as const
              ).map((tab) => {
                const isActive = correctionsTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setCorrectionsTab(tab.id)}
                    className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-[11px] font-black transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-500 to-sky-500 text-white shadow-md shadow-indigo-500/10 border-none scale-[1.02]'
                        : 'text-secondary hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                        isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-secondary'
                      }`}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {correctionsTab === 'conflicts' && (
          <div className="space-y-3 animate-page-enter">
            <B3ReconciliationGuidance title="Divergências — o que fazer" variant="warning">
              Marque os itens em que o livro-razão deve ser atualizado para coincidir com o extrato B3. Se a diferença for intencional
              (ex.: ajuste manual documentado), desmarque e trate depois nos alertas ou na posição final.
            </B3ReconciliationGuidance>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left bg-amber-500/[0.03] p-4.5 rounded-2xl border border-amber-500/20 shadow-sm mb-1.5">
              <div>
                <h5 className="text-xs font-black text-primary uppercase tracking-tight">Lançamentos Divergentes</h5>
                <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                  Lançamentos encontrados com valores ou datas que não batem com o extrato oficial B3.
                </p>
              </div>
              <div className="flex items-center gap-3.5 shrink-0 self-end md:self-auto">
                <span className="text-xs text-secondary font-bold font-mono">
                  {selectedConflictCount} de {conflictDrafts.filter(c => !c.applied).length} selecionados
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={loading || selectedConflictCount === 0}
                  onClick={handleApplySelectedConflicts}
                  className="font-bold shadow-md shadow-amber-500/10 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {loading ? 'Aplicando...' : `Aplicar Selecionados`}
                </Button>
              </div>
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

          </div>
            )}

            {correctionsTab === 'missing' && (
          <div className="space-y-3">
            <B3ReconciliationGuidance title="Faltantes — revisão antes de importar" variant="info">
              Confira tipo de operação (compra, venda, desdobro como <strong>cotas creditadas</strong>, grupamento como cancelamento de cotas).
              Desmarque linhas que você registrará manualmente depois.
            </B3ReconciliationGuidance>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left bg-secondary/20 p-4.5 rounded-2xl border border-border/40 shadow-sm mb-1.5">
              <div>
                <h5 className="text-xs font-black text-primary uppercase tracking-tight">Lançamentos Faltantes no Livro-Razão</h5>
                <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                  Movimentações presentes na B3 que ainda não foram inseridas no sistema. <span className="text-amber-500 font-bold">Você pode editar os campos antes de importar!</span>
                </p>
              </div>
              <div className="flex items-center gap-3.5 shrink-0 self-end md:self-auto">
                <span className="text-xs text-secondary font-bold">
                  {selectedMissingCount} de {missingDrafts.length} selecionados
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={loading || selectedMissingCount === 0}
                  onClick={handleImportSelectedMissing}
                  className="font-bold shadow-md shadow-indigo-500/10 shrink-0"
                >
                  {loading ? 'Importando...' : `Importar Selecionados`}
                </Button>
              </div>
            </div>

            {/* Customization grid / table */}
            <div className="overflow-x-auto border border-border/40 rounded-2xl bg-card/20 backdrop-blur-md shadow-sm">
              <table className="w-full border-collapse text-left text-xs min-w-[980px]">
                <thead>
                  <tr className="bg-secondary/40 border-b border-border/30 text-[9px] font-extrabold text-secondary uppercase tracking-wider">
                    <th className="p-3.5 text-center w-12">Importar</th>
                    <th className="p-3.5 w-28">Ticker</th>
                    <th className="p-3.5 w-36">Mov. B3</th>
                    <th className="p-3.5 w-32">Operação</th>
                    <th className="p-3.5 w-32">Data</th>
                    <th className="p-3.5 w-24 text-right">Qtd</th>
                    <th className="p-3.5 w-32 text-right">Preço Un.</th>
                    <th className="p-3.5 w-40 text-left">Tipo de Ativo (Definição)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20 font-mono">
                  {missingDrafts.map((draft) => (
                    <tr
                      key={draft.id}
                      className={`hover:bg-secondary/40 transition-colors ${
                        draft.selected ? 'bg-indigo-500/5' : 'opacity-70'
                      }`}
                    >
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border bg-card text-indigo-500 focus:ring-indigo-500/20 focus:ring-offset-0 focus:outline-none cursor-pointer"
                          checked={draft.selected}
                          onChange={(e) => updateMissingDraft(draft.id, 'selected', e.target.checked)}
                        />
                      </td>
                      <td className="p-2.5">
                        <div className="relative flex items-center gap-1.5">
                          <input
                            type="text"
                            value={draft.ticker}
                            onChange={(e) => updateMissingDraft(draft.id, 'ticker', e.target.value)}
                            className="w-full h-8 bg-card/60 text-primary border border-border/50 rounded-xl px-2.5 uppercase text-[11px] font-black font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all duration-300 shadow-sm"
                          />
                          {existingSystemTickers.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateMissingDraft(draft.id, 'ticker', e.target.value)
                                }
                              }}
                              className="w-9 h-8 bg-card/60 text-secondary border border-border/50 rounded-xl px-1 text-xs focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none cursor-pointer transition-all duration-300 hover:bg-card shadow-sm text-center"
                              title="Vincular a um ativo existente na carteira"
                            >
                              <option value="">🔗</option>
                              {existingSystemTickers.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </td>
                      <td className="p-2.5">
                        <span
                          className="block text-[10px] text-secondary truncate max-w-[140px] font-sans"
                          title={draft.official.raw_operation_type}
                        >
                          {draft.official.raw_operation_type}
                        </span>
                      </td>
                      <td className="p-2.5">
                        <select
                          value={draft.operation_type}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'operation_type', e.target.value as PortfolioOperationType)
                          }
                          className="w-full h-8 bg-card/60 text-primary border border-border/50 rounded-xl px-2.5 text-[11px] font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all duration-300 shadow-sm cursor-pointer font-sans"
                        >
                          {OPERATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2.5">
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) => updateMissingDraft(draft.id, 'date', e.target.value)}
                          className="w-full h-8 bg-card/60 text-primary border border-border/50 rounded-xl px-2.5 text-[11px] font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all duration-300 shadow-sm"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={draft.quantity}
                          onChange={(e) => updateMissingDraft(draft.id, 'quantity', e.target.value)}
                          className="w-full h-8 bg-card/60 text-primary border border-border/50 rounded-xl px-2.5 text-right text-[11px] font-black font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all duration-300 shadow-sm"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          step="any"
                          value={draft.price}
                          onChange={(e) => updateMissingDraft(draft.id, 'price', e.target.value)}
                          className="w-full h-8 bg-card/60 text-primary border border-border/50 rounded-xl px-2.5 text-right text-[11px] font-black font-mono focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all duration-300 shadow-sm"
                        />
                      </td>
                      <td className="p-2.5 text-left">
                        <select
                          value={draft.pricing_mode}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'pricing_mode', e.target.value as PortfolioPricingMode)
                          }
                          className="w-full h-8 bg-card/60 text-primary border border-border/50 rounded-xl px-2.5 text-[11px] font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 focus:outline-none transition-all duration-300 shadow-sm cursor-pointer font-sans"
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

          </div>
        )}

        {currentStep === 'yield_config' && (
          <div className="space-y-4 animate-page-enter">
            <div className="flex justify-between items-center bg-secondary/10 border border-border/30 p-2.5 rounded-2xl gap-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('corrections')} className="font-bold">
                ← Voltar
              </Button>
              <Button variant="primary" size="sm" onClick={() => setCurrentStep('position')} className="font-bold shadow-md shadow-indigo-500/15">
                Avançar para Custódia B3 →
              </Button>
            </div>

            <B3ReconciliationGuidance title="Rentabilidade dos Novos Aportes" variant="info">
              Configure as taxas contratadas (ex: % do CDI ou taxa pré-fixada a.a.) e datas de vencimento para cada aporte de Renda Fixa importado. Isso garante a precisão do cálculo de rendimento.
            </B3ReconciliationGuidance>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {manualYieldRequiredAssets.map((asset) => {
                const isFixed = asset.pricing_mode === 'fixed_income' || asset.isTreasury
                return (
                  <div 
                    key={asset.id} 
                    className="bg-card/65 p-4 rounded-2xl border border-border/40 space-y-3 text-left hover:border-indigo-500/20 transition-all duration-200 shadow-sm"
                  >
                    <div className="flex items-center justify-between border-b border-border/20 pb-2">
                      <div className="flex items-center gap-3">
                        <div>
                          <strong className="text-primary font-mono font-black text-sm block">
                            {asset.ticker}
                          </strong>
                          <span className="text-[9px] text-secondary font-bold uppercase tracking-wider mt-0.5 block">
                            {asset.isTreasury ? '🏛️ Tesouro Direto' : isFixed ? '💰 Renda Fixa' : '📝 Valor Manual'}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-lg text-[9px] uppercase font-bold font-mono">
                          Aporte: {asset.date}
                        </span>
                        <span className="px-2 py-0.5 bg-secondary text-secondary rounded-lg text-[9px] font-bold font-mono">
                          Qtd: {asset.quantity} • {formatCurrency(parseFloat(asset.price))}
                        </span>
                      </div>

                      {!isFixed && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => onOpenAssetConfig(asset.ticker)}
                          className="flex items-center gap-1 border-indigo-500/25 text-indigo-400 hover:bg-indigo-500/10 py-1.5 px-3 font-bold text-[10px] shrink-0"
                        >
                          Configurar Ativo
                        </Button>
                      )}
                    </div>

                    {isFixed && (
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5 text-[11px] pt-1">
                        <div>
                          <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Indexador</label>
                          <select
                            value={asset.indexer}
                            onChange={(e) => updateImportedDraft(asset.id, 'indexer', e.target.value as PortfolioAssetIndexer)}
                            className="w-full h-8 bg-card border border-border/50 rounded-xl px-2.5 font-semibold text-[11px] focus:border-indigo-500 focus:outline-none cursor-pointer shadow-sm text-primary"
                          >
                            <option value="none">Pré-fixado (taxa contratada)</option>
                            <option value="cdi">CDI</option>
                            <option value="selic">SELIC</option>
                            <option value="ipca">IPCA</option>
                          </select>
                        </div>

                        {asset.indexer !== 'none' ? (
                          <div className="animate-page-enter">
                            <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">% do Indexador</label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                step="0.01"
                                value={asset.indexer_percent}
                                onChange={(e) => updateImportedDraft(asset.id, 'indexer_percent', e.target.value)}
                                placeholder="100"
                                className="w-full h-8 bg-card border border-border/50 rounded-xl pl-2.5 pr-6 font-semibold text-[11px] focus:border-indigo-500 focus:outline-none shadow-sm text-primary"
                              />
                              <span className="absolute right-2.5 text-secondary font-bold text-[10px]">%</span>
                            </div>
                          </div>
                        ) : (
                          <div className="animate-page-enter">
                            <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Taxa Contratada</label>
                            <div className="relative flex items-center">
                              <input
                                type="number"
                                step="0.01"
                                value={asset.contract_rate}
                                onChange={(e) => updateImportedDraft(asset.id, 'contract_rate', e.target.value)}
                                placeholder="Ex: 12.5"
                                className="w-full h-8 bg-card border border-border/50 rounded-xl pl-2.5 pr-10 font-semibold text-[11px] focus:border-indigo-500 focus:outline-none shadow-sm text-primary"
                              />
                              <span className="absolute right-2.5 text-secondary font-bold text-[10px]">% a.a.</span>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="text-secondary font-bold block mb-1 text-[9.5px] uppercase tracking-wider">Vencimento</label>
                          <input
                            type="date"
                            value={asset.maturity_date}
                            onChange={(e) => updateImportedDraft(asset.id, 'maturity_date', e.target.value)}
                            className="w-full h-8 bg-card border border-border/50 rounded-xl px-2.5 font-semibold text-[11px] focus:border-indigo-500 focus:outline-none shadow-sm text-primary"
                          />
                        </div>

                        <div className="flex items-end">
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleSaveAssetYield(asset)}
                            className="w-full h-8 flex items-center justify-center gap-1 font-bold text-[11px] shadow-sm shadow-indigo-500/10"
                          >
                            💾 Salvar Rentabilidade
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

          </div>
        )}

        {currentStep === 'position' && (reconciliation || positionOnlyMode) && (
          <div className="space-y-3 animate-page-enter">
            <div className="flex justify-between items-center bg-secondary/10 border border-border/30 p-2.5 rounded-2xl gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => positionOnlyMode ? setCurrentStep('upload') : setCurrentStep('corrections')}
                className="font-bold"
              >
                ← Voltar
              </Button>
              <Button
                variant="primary"
                size="sm"
                disabled={!positionValidation}
                onClick={() => positionOnlyMode ? onClose() : setCurrentStep('review')}
                className="font-bold shadow-md shadow-indigo-500/15"
              >
                {positionOnlyMode ? 'Concluir Validação ✓' : 'Avançar para Conclusão →'}
              </Button>
            </div>

            {/* Banner: ativos fora do padrão B3 cadastrados no livro-razão */}
            {Object.keys(nonB3SystemPositions).length > 0 && (
              <div className="flex gap-3 items-start bg-indigo-500/8 border border-indigo-500/25 rounded-2xl px-3.5 py-3 text-left">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/15 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle size={14} className="text-indigo-500" />
                </div>
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs font-bold text-primary">
                    {Object.keys(nonB3SystemPositions).length} ativo{Object.keys(nonB3SystemPositions).length > 1 ? 's' : ''} internacional/cripto não constam na custódia B3
                  </p>
                  <p className="text-[10px] text-secondary leading-relaxed">
                    Os ativos abaixo estão cadastrados no livro-razão mas não aparecem no arquivo de posição B3, pois são negociados em bolsas estrangeiras ou fora da B3. Verifique manualmente se as quantidades estão corretas.
                  </p>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {Object.entries(nonB3SystemPositions)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([ticker, qty]) => (
                        <span
                          key={ticker}
                          className="inline-flex items-center gap-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-2 py-0.5 text-[10px] font-mono"
                        >
                          <span className="font-bold text-indigo-600">{ticker}</span>
                          <span className="text-secondary">{qty % 1 === 0 ? qty : qty.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} un</span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
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
              positionOnlyMode={positionOnlyMode}
              showNonEquityNote={
                !!officialPosition &&
                (Object.keys(officialPosition.treasury).length > 0 ||
                  Object.keys(officialPosition.fixedIncome).length > 0)
              }
            />
          </div>
        )}

        {/* STEP 5: Review */}
        {currentStep === 'review' && reconciliation && (
          <div className="space-y-5 text-center animate-page-enter max-w-xl mx-auto py-4 text-left">
            <div className="flex flex-wrap gap-3 justify-between items-center bg-secondary/10 border border-border/30 p-2.5 rounded-2xl">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('position')} className="font-bold">
                  ← Revisar Custódia B3
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('upload')} className="font-bold">
                  🔄 Outro Extrato
                </Button>
              </div>
              <Button variant="primary" size="sm" onClick={onClose} className="font-bold shadow-md shadow-emerald-500/15 bg-emerald-600 hover:bg-emerald-700 text-white">
                ✓ Concluir Conciliação
              </Button>
            </div>
            {/* Animated Celebration Gauge */}
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-scale-fade-in scale-105">
                <Check size={32} className="animate-pulse" />
                <span className="absolute -inset-2 rounded-full border border-emerald-500/20 animate-ping opacity-60" style={{ animationDuration: '3s' }} />
              </div>

              <div className="space-y-1">
                <h4 className="text-base font-black text-primary uppercase tracking-tight">Conciliação Concluída!</h4>
                <p className="text-xs text-secondary max-w-xs mx-auto leading-relaxed">
                  {positionValidation?.allOk
                    ? 'Excelente! Seu Livro-Razão está 100% auditado e sincronizado com os dados oficiais da B3.'
                    : 'Processo de auditoria contábil finalizado com sucesso.'}
                </p>
              </div>
            </div>

            {/* Financial Receipt Summary */}
            <div className="relative overflow-hidden bg-card/40 border border-border/40 rounded-3xl p-5 backdrop-blur-md space-y-4 shadow-sm group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-500/5 to-transparent rounded-full -z-10" />
              
              <h5 className="font-black text-xs text-primary uppercase tracking-widest border-b border-border/20 pb-2 flex items-center justify-between">
                <span>Relatório Consolidado de Auditoria</span>
                <span className="text-[9px] font-mono text-secondary/60">Hash: {crypto.randomUUID().slice(0, 8).toUpperCase()}</span>
              </h5>
              
              <div className="space-y-2.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-secondary/70 uppercase text-[10px]">Total de Lançamentos Analisados:</span>
                  <span className="font-bold text-primary">
                    {reconciliation.matched.length + reconciliation.conflicts.length + reconciliation.missing.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-secondary/70 uppercase text-[10px]">Lançamentos Conciliados (OK):</span>
                  <span className="font-bold text-emerald-500">
                    {reconciliation.matched.length + conflictDrafts.filter(c => c.applied).length}
                  </span>
                </div>
                {positionValidation && (
                  <div className="flex justify-between border-t border-border/20 pt-2.5">
                    <span className="text-secondary/70 uppercase text-[10px]">Auditoria de Custódia:</span>
                    <span
                      className={`font-black flex items-center gap-1 uppercase text-[10px] ${
                        positionValidation.allOk ? 'text-emerald-500' : 'text-amber-500'
                      }`}
                    >
                      {positionValidation.allOk ? (
                        <>
                          <Check size={13} /> Sem Divergências
                        </>
                      ) : (
                        <>
                          <AlertCircle size={13} /> {positionValidation.mismatchCount} Diferença(s)
                        </>
                      )}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t border-indigo-500/15 pt-3 font-sans font-black text-[13px] text-primary mt-3">
                   <span>Auditoria Geral:</span>
                   <span
                     className={`flex items-center gap-1 uppercase tracking-tight ${
                       positionValidation?.allOk !== false ? 'text-emerald-500' : 'text-amber-500'
                     }`}
                   >
                     {positionValidation?.allOk !== false ? 'Totalmente Sincronizado' : 'Concluído com Ressalvas'}
                   </span>
                 </div>
               </div>
            </div>



          </div>
        )}

      </div>
    </Modal>
  )
}
