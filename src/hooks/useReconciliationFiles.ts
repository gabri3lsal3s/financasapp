import { useMemo, useRef, useState, useCallback } from 'react'
// Note: toast is imported but only used in processPositionFileBuffer and processPositionFileBuffer
import toast from 'react-hot-toast'
import type { PortfolioTransaction, PortfolioPricingMode, PortfolioAssetIndexer } from '@/types'
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
import { computeTickerQuantity } from '@/utils/portfolioLedger'
import { isB3TickerPattern } from '@/services/priceService'
import { isCashTicker } from '@/utils/assetClassifier'
import type { MissingDraft, ConflictDraft } from './useReconciliationDrafts'
import { logger } from '@/utils/logger'

export interface FileParseResult {
  reconciliation: InvestmentReconciliationResult
  parsedItems: B3TransactionItem[]
  missingDraftsData: MissingDraft[]
  conflictDraftsData: ConflictDraft[]
  detectedManualAssets: Array<{ ticker: string; product_name: string; type: 'fixed_income' | 'treasury' }>
  excludedCount: {
    fixedIncome: number
    treasury: number
    ignoredByMovement: number
    subscriptionRights: number
    dedupe: B3ParseDedupeStats
  }
}

export function useReconciliationFiles(existingTransactions: PortfolioTransaction[]) {
  // ── File state ──
  const [fileName, setFileName] = useState('')
  const [parseStatus, setParseStatus] = useState('')
  const [positionFileName, setPositionFileName] = useState('')
  const [positionParseStatus, setPositionParseStatus] = useState('')

  // ── Reconciliation state ──
  const [reconciliation, setReconciliation] = useState<InvestmentReconciliationResult | null>(null)
  const [parsedEquityItems, setParsedEquityItems] = useState<B3TransactionItem[]>([])
  const [detectedManualAssets, setDetectedManualAssets] = useState<
    Array<{ ticker: string; product_name: string; type: 'fixed_income' | 'treasury' }>
  >([])
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

  // ── Drag state ──
  const [dragActive, setDragActive] = useState(false)
  const [positionDragActive, setPositionDragActive] = useState(false)

  // ── Position state ──
  const [officialPosition, setOfficialPosition] = useState<B3PositionParseResult | null>(null)
  const [positionValidation, setPositionValidation] = useState<PositionValidationResult | null>(null)

  // ── Refs ──
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const positionFileInputRef = useRef<HTMLInputElement | null>(null)

  // ── Derived: existing system tickers ──
  const existingSystemTickers = useMemo(() => {
    const tickers = new Set<string>()
    existingTransactions.forEach((tx) => {
      if (!isCashTicker(tx.ticker)) {
        tickers.add(tx.ticker.toUpperCase())
      }
    })
    return Array.from(tickers).sort()
  }, [existingTransactions])

  // ── Derived: B3 parsed positions ──
  const b3ParsedPositions = useMemo(
    () => computePositionsFromB3Items(parsedEquityItems),
    [parsedEquityItems],
  )

  // ── Derived: system positions (B3 equity only) ──
  const systemPositions = useMemo(() => {
    const tickers = new Set<string>()
    for (const tx of existingTransactions) {
      if (isCashTicker(tx.ticker) || tx.cash_offset_source_id) continue
      const upper = tx.ticker.toUpperCase()
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

  // ── Derived: non-B3 system positions ──
  const nonB3SystemPositions = useMemo(() => {
    const tickers = new Set<string>()
    for (const tx of existingTransactions) {
      if (isCashTicker(tx.ticker) || tx.cash_offset_source_id) continue
      const upper = tx.ticker.toUpperCase()
      const category = classifyB3Item(upper)
      const isB3 = isB3TickerPattern(upper) || category === 'fixedIncome' || category === 'treasury'
      if (isB3) continue
      tickers.add(upper)
    }
    const map: Record<string, number> = {}
    for (const ticker of tickers) {
      const qty = computeTickerQuantity(existingTransactions, ticker)
      if (qty > 0.000_001) map[ticker] = qty
    }
    return map
  }, [existingTransactions])

  // ── Derived: manual position assets (from B3 position file) ──
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

  // ── Derived: position preview rows ──
  const positionPreviewRows = useMemo(() => {
    const allTickers = new Set([...Object.keys(b3ParsedPositions), ...Object.keys(systemPositions)])
    return Array.from(allTickers)
      .sort()
      .map((ticker) => ({
        ticker,
        b3: b3ParsedPositions[ticker] ?? 0,
        system: systemPositions[ticker] ?? 0,
      }))
      .filter((row) => row.b3 > 0 || row.system > 0)
  }, [b3ParsedPositions, systemPositions])

  // ── Derived: position adjustments ──
  const positionAdjustments = useMemo((): PositionAdjustmentSuggestion[] => {
    if (!positionValidation) return []
    return suggestPositionAdjustments(positionValidation, existingTransactions, parsedEquityItems)
  }, [positionValidation, existingTransactions, parsedEquityItems])

  // ── Position validation recompute ──
  const recomputePositionValidation = useCallback(
    (official: B3PositionParseResult, movements: Record<string, number>, system: Record<string, number>) => {
      const combinedOfficial = { ...official.equity }
      const validation = buildPositionValidation(combinedOfficial, movements, system)
      setPositionValidation(validation)
      return validation
    },
    [],
  )

  // ── Process position file buffer ──
  const processPositionFileBuffer = useCallback(
    async (buffer: ArrayBuffer, name: string) => {
      setPositionParseStatus('Lendo relatório de posição...')
      try {
        if (!isB3PositionWorkbook(buffer)) {
          setPositionFileName('')
          setPositionParseStatus(
            'Este arquivo parece ser de movimentação, não de posição. No menu Investimentos → Posição atual, selecione a opção "Exportar Posição (.xlsx)" para gerar o relatório correto.',
          )
          return null
        }
        const parsed = parseB3PositionExcel(buffer)
        const totalKeys =
          Object.keys(parsed.equity).length +
          Object.keys(parsed.treasury).length +
          Object.keys(parsed.fixedIncome).length
        if (totalKeys === 0) {
          setPositionFileName('')
          setPositionParseStatus(
            'Nenhum ativo de Renda Variável, Tesouro ou Renda Fixa encontrado na planilha de posição. Verifique se as abas contêm as colunas "Código de Negociação", "Produto" e "Quantidade".',
          )
          return null
        }
        setPositionFileName(name)
        setOfficialPosition(parsed)
        recomputePositionValidation(parsed, b3ParsedPositions, systemPositions)
        setPositionParseStatus('')
        toast.success('Posição oficial carregada — validação atualizada.')
        return parsed
      } catch (err: unknown) {
        setPositionFileName('')
        logger.error(err)
        const message = err instanceof Error ? err.message : 'Erro ao ler o relatório de posição.'
        setPositionParseStatus(
          `Erro ao processar o arquivo: ${message}. Verifique se é um arquivo .xlsx válido exportado da B3.`,
        )
        return null
      }
    },
    [b3ParsedPositions, systemPositions, recomputePositionValidation],
  )

  // ── Recompute on officialPosition / positions change ──
  const handleOfficialPositionChange = useCallback(
    (position: B3PositionParseResult | null) => {
      if (!position) return
      recomputePositionValidation(position, b3ParsedPositions, systemPositions)
    },
    [b3ParsedPositions, systemPositions, recomputePositionValidation],
  )

  // ── Parse movement file buffer (returns structured data) ──
  const processMovementFileBuffer = useCallback(
    async (buffer: ArrayBuffer): Promise<FileParseResult | null> => {
      const parseResult = parseB3Excel(buffer)
      const allParsedItems = parseResult.items
      if (allParsedItems.length === 0) return null

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
            manualAssetsList.push({ ticker: item.ticker, product_name: item.product_name, type: 'fixed_income' })
          }
          return false
        }
        if (category === 'treasury') {
          treasuryCount++
          if (!seenManualTickers.has(item.ticker)) {
            seenManualTickers.add(item.ticker)
            manualAssetsList.push({ ticker: item.ticker, product_name: item.product_name, type: 'treasury' })
          }
          return false
        }
        return true
      })

      if (parsedItems.length === 0) return null

      const result = reconcileInvestmentTransactions(parsedItems, existingTransactions)

      const excludedCountData = {
        fixedIncome: fixedIncomeCount,
        treasury: treasuryCount,
        ignoredByMovement: parseResult.ignoredByMovement,
        subscriptionRights: subscriptionRightsCount,
        dedupe: parseResult.dedupe,
      }

      const missingDraftsData = result.missing.map((item) => {
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
          isB3Linked,
          isTreasury,
          product_name: item.product_name,
          official: item,
          indexer,
          indexer_percent: indexerPercent,
          contract_rate: contractRate,
          maturity_date: maturityDate,
        }
      })

      const conflictDraftsData = result.conflicts.map((conflict) => ({
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

      return {
        reconciliation: result,
        parsedItems,
        missingDraftsData,
        conflictDraftsData,
        detectedManualAssets: manualAssetsList,
        excludedCount: excludedCountData,
      }
    },
    [existingTransactions],
  )

  // ── Reset ──
  const resetFileState = useCallback(() => {
    setFileName('')
    setParseStatus('')
    setPositionFileName('')
    setPositionParseStatus('')
    setReconciliation(null)
    setParsedEquityItems([])
    setDetectedManualAssets([])
    setExcludedCount({
      fixedIncome: 0,
      treasury: 0,
      ignoredByMovement: 0,
      subscriptionRights: 0,
      dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 },
    })
    setDragActive(false)
    setPositionDragActive(false)
    setOfficialPosition(null)
    setPositionValidation(null)
  }, [])

  return {
    // State
    fileName,
    setFileName,
    parseStatus,
    setParseStatus,
    positionFileName,
    setPositionFileName,
    positionParseStatus,
    setPositionParseStatus,
    reconciliation,
    setReconciliation,
    parsedEquityItems,
    setParsedEquityItems,
    detectedManualAssets,
    setDetectedManualAssets,
    excludedCount,
    setExcludedCount,
    dragActive,
    setDragActive,
    positionDragActive,
    setPositionDragActive,
    officialPosition,
    setOfficialPosition,
    positionValidation,
    setPositionValidation,

    // Refs
    fileInputRef,
    positionFileInputRef,

    // Derived
    existingSystemTickers,
    b3ParsedPositions,
    systemPositions,
    nonB3SystemPositions,
    detectedManualPositionAssets,
    positionPreviewRows,
    positionAdjustments,

    // Handlers
    processPositionFileBuffer,
    processMovementFileBuffer,
    recomputePositionValidation,
    handleOfficialPositionChange,

    // Reset
    resetFileState,
  }
}
