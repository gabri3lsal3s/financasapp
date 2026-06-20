import { useMemo, useRef, useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
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
import InvestmentConflictCard from '@/components/investments/InvestmentConflictCard'
import AssetYieldConfigCard from '@/components/investments/AssetYieldConfigCard'
import SuspiciousInvestmentCard from '@/components/investments/SuspiciousInvestmentCard'
import { computeTickerQuantity } from '@/utils/portfolioLedger'
import {
  isPortfolioIncomeType,
  PORTFOLIO_OPERATION_OPTIONS,
} from '@/utils/portfolioOperations'
import { isB3TickerPattern, detectDefaultCurrency, isTreasuryTicker } from '@/services/priceService'
import { formatQuantityBR } from '@/utils/format'

type PortfolioTransactionInsert = Omit<PortfolioTransaction, 'created_at'>

function toLocalPortfolioTransaction(tx: PortfolioTransactionInsert): PortfolioTransaction {
  return { ...tx, created_at: new Date().toISOString() }
}

function toLocalAssetDefinition(
  payload: Partial<PortfolioAssetDefinition> & Pick<PortfolioAssetDefinition, 'portfolio_id' | 'ticker'>,
  existing?: PortfolioAssetDefinition
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
  const [detectedManualAssets, setDetectedManualAssets] = useState<Array<{
    ticker: string
    product_name: string
    type: 'fixed_income' | 'treasury'
  }>>([])
  
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
      setDetectedManualAssets([])
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
      // Ativos B3 constam na custódia B3 (exclusivo renda variável)
      const category = classifyB3Item(upper)
      const isB3 = isB3TickerPattern(upper)
      if (!isB3 || category === 'fixedIncome' || category === 'treasury') continue
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

  const detectedManualPositionAssets = useMemo(() => {
    if (!officialPosition) return []
    const list: Array<{ ticker: string; quantity: number; type: 'fixed_income' | 'treasury' }> = []
    
    Object.entries(officialPosition.fixedIncome).forEach(([ticker, qty]) => {
      list.push({ ticker, quantity: qty, type: 'fixed_income' })
    })
    
    Object.entries(officialPosition.treasury).forEach(([ticker, qty]) => {
      list.push({ ticker, quantity: qty, type: 'treasury' })
    })
    
    return list
  }, [officialPosition])

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

      // ── Filtrar ativos de Renda Fixa e Tesouro Direto para inserção manual ──
      let subscriptionRightsCount = 0
      let fixedIncomeCount = 0
      let treasuryCount = 0
      const manualAssetsList: Array<{ ticker: string; product_name: string; type: 'fixed_income' | 'treasury' }> = []
      const seenManualTickers = new Set<string>()

      const parsedItems = allParsedItems.filter((item) => {
        if (isB3SubscriptionRightsTicker(item.ticker)) {
          subscriptionRightsCount++
          return false
        }
        const category = classifyB3Item(item.ticker, item.product_name)
        if (category === 'fixedIncome') {
          fixedIncomeCount++
          if (!seenManualTickers.has(item.ticker)) {
            seenManualTickers.add(item.ticker)
            manualAssetsList.push({
              ticker: item.ticker,
              product_name: item.product_name,
              type: 'fixed_income',
            })
          }
          return false
        }
        if (category === 'treasury') {
          treasuryCount++
          if (!seenManualTickers.has(item.ticker)) {
            seenManualTickers.add(item.ticker)
            manualAssetsList.push({
              ticker: item.ticker,
              product_name: item.product_name,
              type: 'treasury',
            })
          }
          return false
        }
        return true
      })

      setDetectedManualAssets(manualAssetsList)
      setExcludedCount({
        fixedIncome: fixedIncomeCount,
        treasury: treasuryCount,
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
            pricingMode = 'fixed_income'
            isTreasury = true
            isB3Linked = false
          } else if (category === 'fixedIncome') {
            pricingMode = 'fixed_income'
            isB3Linked = false
          } else {
            pricingMode = isB3 ? 'market' : 'fixed_income'
          }

          let indexer: PortfolioAssetIndexer = 'none'
          let indexerPercent = ''
          const contractRate = ''
          
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

          let maturityDate = item.maturity_date || ''
          if (!maturityDate) {
            const year4Match = combined.match(/\b(202[4-9]|203[0-9]|204[0-9]|205[0-9])\b/)
            if (year4Match) {
              maturityDate = `${year4Match[1]}-12-31`
            } else {
              const year2Match = combined.match(/\b(2[4-9]|3[0-9]|4[0-9]|5[0-9])\b/)
              if (year2Match) {
                maturityDate = `20${year2Match[1]}-12-31`
              }
            }
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar o arquivo Excel. Verifique se o formato está correto.'
      setParseStatus(message)
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
        const pricingMode = isTreasuryTicker(draft.official.ticker)
          ? 'fixed_income'
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

      const txsToInsert: PortfolioTransactionInsert[] = []
      const defsToUpsertMap = new Map<string, Partial<PortfolioAssetDefinition> & Pick<PortfolioAssetDefinition, 'portfolio_id' | 'ticker'>>()
      const offsetsToInsert: PortfolioTransactionInsert[] = []
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
          contract_rate: draft.pricing_mode === 'fixed_income' && draft.contract_rate ? parseFloat(draft.contract_rate) : null,
        }
        txsToInsert.push(newTx)
        localTransactions.push(toLocalPortfolioTransaction(newTx))

        // 2. Preparar payload de definição de ativo com suporte a Renda Fixa e Tesouro Direto
        const isFixedOrTreasury = draft.pricing_mode === 'fixed_income' || draft.isTreasury
        const defPayload = {
          portfolio_id: portfolioId,
          ticker: tickerUpper,
          pricing_mode: draft.pricing_mode,
          is_b3_linked: draft.pricing_mode === 'market' ? draft.isB3Linked : false,
          applied_amount: draft.pricing_mode !== 'market' ? prc * qty : null,
          application_date: draft.date,
          is_treasury: draft.isTreasury,
          indexer: isFixedOrTreasury ? (draft.indexer || 'none') : 'none',
          indexer_percent: isFixedOrTreasury && (draft.indexer || 'none') !== 'none' ? (parseFloat(draft.indexer_percent) || 100) : 100,
          contract_rate: isFixedOrTreasury && draft.contract_rate ? (parseFloat(draft.contract_rate) || null) : null,
          maturity_date: isFixedOrTreasury && draft.maturity_date ? draft.maturity_date : null,
          currency: detectDefaultCurrency(tickerUpper),
          updated_at: new Date().toISOString(),
        }
        
        // Atualizar no contexto local para que as próximas iterações leiam a definição correta
        const existingDefIndex = localDefinitions.findIndex(d => d.ticker === tickerUpper)
        if (existingDefIndex >= 0) {
          localDefinitions[existingDefIndex] = toLocalAssetDefinition(defPayload, localDefinitions[existingDefIndex])
        } else {
          localDefinitions.push(toLocalAssetDefinition(defPayload))
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
                  localTransactions.push(toLocalPortfolioTransaction(offsetTx))
                })
              }
            }
          } else if (draft.operation_type === 'sell' || isPortfolioIncomeType(draft.operation_type)) {
            if (amount > 0) {
              const cashTicker = getPreferredCashTicker(localTransactions, localDefinitions)
              const offsetTx: PortfolioTransactionInsert = {
                id: crypto.randomUUID(),
                portfolio_id: portfolioId,
                ticker: cashTicker,
                operation_type: 'buy',
                quantity: 1,
                price: amount,
                date: draft.date,
                cash_offset_source_id: txId,
              }
              offsetsToInsert.push(offsetTx)
              localTransactions.push(toLocalPortfolioTransaction(offsetTx))
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
          contract_rate: asset.contract_rate ? (parseFloat(asset.contract_rate) || null) : null,
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
      const localTransactions: PortfolioTransaction[] = [...context.transactions]
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
      size="2xl"
    >
      <div className="modal-form-stack w-full text-left">
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
          <div className="modal-panel-glass space-y-2.5 p-4 animate-pulse-slow border-balance/25">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-balance flex items-center gap-1.5">
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
                className="h-full bg-balance rounded-full transition-all duration-300"
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
                      <span className="text-balance font-bold">Modo posição</span>
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
          <div className="modal-form-stack w-full text-left animate-page-enter">
            <div className="flex items-center gap-3">
              <div className="modal-panel-glass flex h-10 w-10 shrink-0 items-center justify-center text-balance">
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
                className={cn(
                  'modal-upload-zone group',
                  dragActive && 'modal-upload-zone--active-balance',
                  !dragActive && fileName && 'modal-upload-zone--ready-balance'
                )}
              >
                <div
                  className={cn(
                    'modal-upload-zone__icon',
                    fileName && 'modal-upload-zone__icon--balance'
                  )}
                >
                  <Upload size={24} className={dragActive ? 'animate-bounce' : ''} />
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-black text-primary uppercase tracking-wider">
                    {fileName ? (
                      <span className="text-balance font-mono text-[11px] block truncate max-w-[200px]" title={fileName}>{fileName}</span>
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
                  <span className="modal-chip modal-chip--success">
                    <Check size={10} aria-hidden /> Pronto
                  </span>
                ) : (
                  <span className="modal-chip">Padrão oficial B3 (.xlsx)</span>
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
                className={cn(
                  'modal-upload-zone group',
                  positionDragActive && 'modal-upload-zone--active-income',
                  !positionDragActive && positionFileName && 'modal-upload-zone--ready-income'
                )}
              >
                <div
                  className={cn(
                    'modal-upload-zone__icon',
                    positionFileName && 'modal-upload-zone__icon--income'
                  )}
                >
                  <Upload size={24} className={positionDragActive ? 'animate-bounce' : ''} />
                </div>
                
                <div className="space-y-1">
                  <p className="text-xs font-black text-primary uppercase tracking-wider">
                    {positionFileName ? (
                      <span className="text-income font-mono text-[11px] block truncate max-w-[200px]" title={positionFileName}>{positionFileName}</span>
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
                  <span className="modal-chip modal-chip--success">
                    <Check size={10} aria-hidden /> Pronto
                  </span>
                ) : (
                  <span className="modal-chip">Opcional no início (.xlsx)</span>
                )}
              </div>
            </div>

            {/* Parsing error message */}
            {(parseStatus || positionParseStatus) && (
              <div className="modal-panel-glass flex items-start gap-2.5 p-3 text-[11px] text-warning">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {parseStatus && <p>{parseStatus}</p>}
                  {positionParseStatus && <p>{positionParseStatus}</p>}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="modal-section-divider flex justify-end gap-3 border-t pt-2">
              {positionFileName && !fileName && (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => {
                    setPositionOnlyMode(true)
                    setCurrentStep('position')
                  }}
                  className="font-bold gap-1.5 animate-pulse-slow"
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
                  className="font-bold gap-1.5 hover:scale-102 transition-all duration-300"
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b modal-section-divider pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-income/10 flex items-center justify-center text-income shrink-0">
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
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center modal-panel-glass p-4">
                {/* SVG Progress Ring Gauge */}
                <div className="md:col-span-4 flex flex-col items-center justify-center py-2 border-b md:border-b-0 md:border-r modal-section-divider">
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
                        className="stroke-income fill-none transition-all duration-1000 ease-out"
                        strokeWidth="8"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute text-center">
                      <p className="text-2xl font-black font-mono tracking-tighter text-income tabular-nums">
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
                      <span className="text-income font-semibold">Conciliação perfeita encontrada! Todos os lançamentos da B3 já estão catalogados e corretos no livro-razão.</span>
                    ) : matchRate >= 80 ? (
                      <span>Sua carteira está altamente integrada com o sistema. Há apenas algumas <strong className="text-warning">{conflictDrafts.filter(c => !c.applied).length} divergências</strong> e <strong className="text-expense">{missingDrafts.length} transações faltantes</strong> a regularizar.</span>
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
                <div className="modal-panel-glass w-full p-4 space-y-3">
                  <p className="text-xs font-black text-primary flex items-center gap-1.5 uppercase tracking-tight">
                    <Layers size={14} className="text-balance" />
                    Auditoria Preliminar de Cotas de Custódia
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {positionPreviewRows.map((row) => {
                      const delta = row.b3 - row.system
                      const diff = Math.abs(delta) > 0.0001
                      return (
                        <div
                          key={row.ticker}
                          className={`p-3 rounded-2xl border transition-all duration-300 ${
                            diff 
                              ? 'bg-warning/5 border-warning/20 hover:bg-warning/10' 
                              : 'bg-primary/5 border-border/40 hover:bg-primary/10'
                          }`}
                        >
                          <div className="flex justify-between items-center border-b border-border/10 pb-1.5 mb-2">
                            <span className="font-black text-primary font-mono text-sm">{row.ticker}</span>
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                              diff ? 'bg-warning/10 text-warning' : 'bg-income/10 text-income'
                            }`}>
                              {diff ? 'Ajustar' : 'Sincronizado'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                            <div>
                              <span className="text-secondary/70 uppercase text-[8px] block font-bold">Extrato B3</span>
                              <span className="text-primary font-bold">{formatQuantityBR(row.b3)}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-secondary/70 uppercase text-[8px] block font-bold">Sistema</span>
                              <span className="text-primary font-bold">{formatQuantityBR(row.system)}</span>
                            </div>
                            {diff && (
                              <div className="col-span-2 border-t border-border/5 pt-1.5 mt-1 flex justify-between items-center">
                                <span className="text-secondary/70 uppercase text-[8px] font-bold">Desvio (Δ)</span>
                                <span className={`font-black ${delta > 0 ? 'text-income' : 'text-expense'}`}>
                                  {delta > 0 ? '+' : ''}{formatQuantityBR(delta)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Renda Fixa / Tesouro Manual Alert */}
              {detectedManualAssets.length > 0 && (
                <div className="w-full bg-warning/5 border border-warning/20 rounded-2xl p-4 text-left flex gap-3 items-start animate-page-enter">
                  <AlertCircle size={18} className="text-warning shrink-0 mt-0.5" />
                  <div className="space-y-2 w-full">
                    <p className="text-xs font-bold text-warning uppercase tracking-tight">
                      Atenção: Ativos de Renda Fixa e Tesouro Direto Detectados
                    </p>
                    <p className="text-[10px] text-secondary leading-relaxed">
                      O aplicativo não importa ativos de renda fixa ou Tesouro Direto automaticamente. 
                      Os seguintes ativos foram identificados no extrato e <strong>devem ser adicionados manualmente</strong> no Livro-Razão para manter sua carteira atualizada:
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {detectedManualAssets.map((asset) => (
                        <div key={asset.ticker} className="bg-primary/5 border border-border/40 rounded-xl p-2 flex flex-col justify-center">
                          <span className="text-[10px] font-bold text-primary font-mono">{asset.ticker}</span>
                          {asset.product_name && (
                            <span className="text-[9px] text-secondary truncate" title={asset.product_name}>
                              {asset.product_name}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Banner: itens excluídos da conciliação */}
              {(excludedCount.ignoredByMovement > 0 ||
                excludedCount.subscriptionRights > 0 ||
                excludedCount.dedupe.ignoredInternal > 0 ||
                excludedCount.dedupe.ignoredCorporate > 0 ||
                excludedCount.dedupe.dedupedTrades > 0) && (
                <div className="w-full bg-warning/5 border border-warning/20 rounded-2xl p-4 text-left flex gap-3 items-start">
                  <AlertCircle size={16} className="text-warning shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-warning">Linhas desconsideradas do parser B3</p>
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
            <div className="modal-toolbar gap-3">
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
                className="font-bold"
              >
                {manualYieldRequiredAssets.length > 0 ? 'Avançar para Rentabilidade →' : 'Validar posição B3 →'}
              </Button>
            </div>

            <div className="modal-tab-bar">
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
                        ? 'bg-primary text-primary-foreground border-none scale-[1.02]'
                        : 'text-secondary hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                        isActive ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-primary/10 text-secondary'
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
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left bg-warning/5 p-4 sm:p-5 rounded-2xl border border-warning/20 shadow-sm mb-1.5">
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
                  variant="warning-solid"
                  size="sm"
                  disabled={loading || selectedConflictCount === 0}
                  onClick={handleApplySelectedConflicts}
                  className="font-bold shrink-0"
                >
                  {loading ? 'Aplicando...' : `Aplicar Selecionados`}
                </Button>
              </div>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {conflictDrafts.filter(c => !c.applied).map((draft) => (
                <InvestmentConflictCard
                  key={draft.key}
                  draft={draft}
                  onToggleSelect={() => {
                    setConflictDrafts((prev) =>
                      prev.map((c) => (c.key === draft.key ? { ...c, selected: !c.selected } : c))
                    )
                  }}
                />
              ))}
            </div>

          </div>
            )}

            {correctionsTab === 'missing' && (
          <div className="space-y-3">
            <B3ReconciliationGuidance title="Faltantes — revisão antes de importar" variant="info">
              Confira tipo de operação (compra, venda, desdobro como <strong>cotas creditadas</strong>, grupamento como cancelamento de cotas).
              Desmarque linhas que você registrará manualmente depois.
            </B3ReconciliationGuidance>
            <div className="modal-panel-glass flex flex-col md:flex-row md:items-center justify-between gap-4 text-left p-4 sm:p-5 mb-1.5">
              <div>
                <h5 className="text-xs font-black text-primary uppercase tracking-tight">Lançamentos Faltantes no Livro-Razão</h5>
                <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                  Movimentações presentes na B3 que ainda não foram inseridas no sistema. <span className="text-warning font-bold">Você pode editar os campos antes de importar!</span>
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
                  className="font-bold shrink-0"
                >
                  {loading ? 'Importando...' : `Importar Selecionados`}
                </Button>
              </div>
            </div>

            {/* Customization grid / cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[380px] overflow-y-auto pr-1">
              {missingDrafts.map((draft) => {
                const isBuy = draft.operation_type === 'buy' || draft.operation_type === 'subscription'
                const isSell = draft.operation_type === 'sell'
                const isIncome = isPortfolioIncomeType(draft.operation_type)
                const total = Number(draft.quantity) * Number(draft.price)
                
                return (
                  <div
                    key={draft.id}
                    className={`p-4 rounded-3xl border transition-all duration-300 text-left flex flex-col justify-between gap-3 ${
                      draft.selected 
                        ? 'bg-glass/5 border-balance/40 shadow-sm' 
                        : 'bg-glass/5 border-border/20 opacity-70'
                    }`}
                  >
                    {/* Header: Import Checkbox, Ticker and Operation Badge */}
                    <div className="flex items-center justify-between border-b border-border/10 pb-2.5">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4.5 w-4.5 cursor-pointer rounded border-glass text-balance focus:ring-balance/20 focus:ring-offset-0 focus:outline-none"
                          checked={draft.selected}
                          onChange={(e) => updateMissingDraft(draft.id, 'selected', e.target.checked)}
                        />
                        <div className="relative flex items-center gap-1.5 w-24">
                          <input
                            type="text"
                            value={draft.ticker}
                            onChange={(e) => updateMissingDraft(draft.id, 'ticker', e.target.value)}
                            className="modal-input-compact w-full text-primary px-2 py-1 uppercase text-xs font-black font-mono focus:border-balance focus:ring-2 focus:ring-balance/15 focus:outline-none transition-all duration-300 shadow-sm"
                          />
                          {existingSystemTickers.length > 0 && (
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  updateMissingDraft(draft.id, 'ticker', e.target.value)
                                }
                              }}
                              className="modal-input-compact w-7 px-0 text-xs text-center cursor-pointer border-none bg-transparent"
                              title="Vincular a um ativo existente"
                            >
                              <option value="">🔗</option>
                              {existingSystemTickers.map((t) => (
                                <option key={t} value={t} className="bg-background text-primary">
                                  {t}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                      
                      <select
                        value={draft.operation_type}
                        onChange={(e) =>
                          updateMissingDraft(draft.id, 'operation_type', e.target.value as PortfolioOperationType)
                        }
                        className={`text-[10px] font-black uppercase py-1 px-2.5 rounded-lg focus:outline-none border border-transparent shadow-sm cursor-pointer ${
                          isBuy
                            ? 'text-balance bg-balance/10'
                            : isSell
                              ? 'text-expense bg-expense/10'
                              : isIncome
                                ? 'text-income bg-income/10'
                                : 'text-secondary bg-glass/10'
                        }`}
                      >
                        {OPERATION_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value} className="bg-background text-primary">
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Content parameters */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                      <div>
                        <span className="text-secondary/70 uppercase text-[8px] block font-bold">Data</span>
                        <input
                          type="date"
                          value={draft.date}
                          onChange={(e) => updateMissingDraft(draft.id, 'date', e.target.value)}
                          className="modal-input-compact w-full text-primary px-1.5 py-0.5 text-[10px] font-mono focus:border-balance focus:ring-2 focus:ring-balance/15 focus:outline-none"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-secondary/70 uppercase text-[8px] block font-bold">Mov. Oficial B3</span>
                        <span className="text-secondary font-bold block truncate max-w-[140px] font-sans" title={draft.official.raw_operation_type}>
                          {draft.official.raw_operation_type}
                        </span>
                      </div>
                      <div>
                        <span className="text-secondary/70 uppercase text-[8px] block font-bold">Qtd</span>
                        <input
                          type="number"
                          step="any"
                          value={draft.quantity}
                          onChange={(e) => updateMissingDraft(draft.id, 'quantity', e.target.value)}
                          className="modal-input-compact w-full text-primary px-1.5 py-0.5 text-[10px] font-mono focus:border-balance focus:ring-2 focus:ring-balance/15 focus:outline-none font-black"
                        />
                      </div>
                      <div className="text-right">
                        <span className="text-secondary/70 uppercase text-[8px] block font-bold">Preço Unitário</span>
                        <input
                          type="number"
                          step="any"
                          value={draft.price}
                          onChange={(e) => updateMissingDraft(draft.id, 'price', e.target.value)}
                          className="modal-input-compact w-full text-primary px-1.5 py-0.5 text-[10px] font-mono focus:border-balance focus:ring-2 focus:ring-balance/15 focus:outline-none text-right font-black"
                        />
                      </div>
                    </div>

                    {/* Total & Pricing Mode row */}
                    <div className="flex justify-between items-center border-t border-border/10 pt-2.5 mt-1">
                      <div>
                        <span className="text-secondary/70 uppercase text-[8px] block font-bold">Total Estimado</span>
                        <span className="text-xs font-black text-primary font-mono">{formatCurrency(total)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-secondary/70 uppercase text-[8px] block font-bold">Tipo de Ativo</span>
                        <select
                          value={draft.pricing_mode}
                          onChange={(e) =>
                            updateMissingDraft(draft.id, 'pricing_mode', e.target.value as PortfolioPricingMode)
                          }
                          className="modal-input-compact text-[10px] font-bold text-primary focus:border-balance focus:ring-2 focus:ring-balance/15 focus:outline-none cursor-pointer bg-transparent text-right"
                        >
                          {PORTFOLIO_PRICING_MODE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value} className="bg-background text-primary">
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
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
                  <SuspiciousInvestmentCard
                    key={tx.id}
                    tx={tx}
                    onDelete={() => handleDeleteLedgerOnlyTransaction(tx.id)}
                  />
                ))
              )}
            </div>

          </div>
            )}

          </div>
        )}

        {currentStep === 'yield_config' && (
          <div className="space-y-4 animate-page-enter">
            <div className="modal-toolbar gap-3">
              <Button variant="outline" size="sm" onClick={() => setCurrentStep('corrections')} className="font-bold">
                ← Voltar
              </Button>
              <Button variant="primary" size="sm" onClick={() => setCurrentStep('position')} className="font-bold">
                Avançar para Custódia B3 →
              </Button>
            </div>

            <B3ReconciliationGuidance title="Rentabilidade dos Novos Aportes" variant="info">
              Configure as taxas contratadas (ex: % do CDI ou taxa pré-fixada a.a.) e datas de vencimento para cada aporte de Renda Fixa importado. Isso garante a precisão do cálculo de rendimento.
            </B3ReconciliationGuidance>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {manualYieldRequiredAssets.map((asset) => (
                <AssetYieldConfigCard
                  key={asset.id}
                  asset={asset}
                  onOpenAssetConfig={onOpenAssetConfig}
                  onUpdateIndexer={(indexer) => updateImportedDraft(asset.id, 'indexer', indexer)}
                  onUpdateIndexerPercent={(val) => updateImportedDraft(asset.id, 'indexer_percent', val)}
                  onUpdateContractRate={(val) => updateImportedDraft(asset.id, 'contract_rate', val)}
                  onUpdateMaturityDate={(val) => updateImportedDraft(asset.id, 'maturity_date', val)}
                  onSave={() => handleSaveAssetYield(asset)}
                />
              ))}
            </div>

          </div>
        )}

        {currentStep === 'position' && (reconciliation || positionOnlyMode) && (
          <div className="space-y-3 animate-page-enter">
            <div className="modal-toolbar gap-3">
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
                className="font-bold"
              >
                {positionOnlyMode ? 'Concluir Validação ✓' : 'Avançar para Conclusão →'}
              </Button>
            </div>

            {/* Banner: ativos fora do padrão B3 cadastrados no livro-razão */}
            {Object.keys(nonB3SystemPositions).length > 0 && (
              <div className="flex gap-3 items-start bg-balance/8 border border-balance/25 rounded-2xl px-3.5 py-3 text-left">
                <div className="w-7 h-7 rounded-lg bg-balance/15 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle size={14} className="text-balance" />
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
                          className="inline-flex items-center gap-1 bg-balance/10 border border-balance/20 rounded-lg px-2 py-0.5 text-[10px] font-mono"
                        >
                          <span className="font-bold text-balance">{ticker}</span>
                          <span className="text-secondary">{formatQuantityBR(qty)} un</span>
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <ShieldCheck size={18} className="text-income" />
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
              detectedManualPositionAssets={detectedManualPositionAssets}
            />
          </div>
        )}

        {/* STEP 5: Review */}
        {currentStep === 'review' && reconciliation && (
          <div className="space-y-5 text-center animate-page-enter max-w-xl mx-auto py-4 text-left">
            <div className="modal-toolbar flex-wrap gap-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('position')} className="font-bold">
                  ← Revisar Custódia B3
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentStep('upload')} className="font-bold">
                  🔄 Outro Extrato
                </Button>
              </div>
              <Button variant="success" size="sm" onClick={onClose} className="font-bold">
                ✓ Concluir Conciliação
              </Button>
            </div>
            {/* Animated Celebration Gauge */}
            <div className="flex flex-col items-center justify-center text-center space-y-3">
              <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-income to-income/80 text-white flex items-center justify-center shadow-lg shadow-income/20 animate-scale-fade-in scale-105">
                <Check size={32} className="animate-pulse" />
                <span className="absolute -inset-2 rounded-full border border-income/20 animate-ping opacity-60" style={{ animationDuration: '3s' }} />
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
            <div className="modal-panel-glass relative overflow-hidden rounded-3xl p-5 space-y-4 group">
              <h5 className="font-black text-xs text-primary uppercase tracking-widest border-b modal-section-divider pb-2 flex items-center justify-between">
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
                  <span className="font-bold text-income">
                    {reconciliation.matched.length + conflictDrafts.filter(c => c.applied).length}
                  </span>
                </div>
                {positionValidation && (
                  <div className="flex justify-between border-t modal-section-divider pt-2.5">
                    <span className="text-secondary/70 uppercase text-[10px]">Auditoria de Custódia:</span>
                    <span
                      className={`font-black flex items-center gap-1 uppercase text-[10px] ${
                        positionValidation.allOk ? 'text-income' : 'text-warning'
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
                <div className="flex justify-between border-t border-balance/15 pt-3 font-sans font-black text-[13px] text-primary mt-3">
                   <span>Auditoria Geral:</span>
                   <span
                     className={`flex items-center gap-1 uppercase tracking-tight ${
                       positionValidation?.allOk !== false ? 'text-income' : 'text-warning'
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
