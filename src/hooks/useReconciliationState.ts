import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import toast from 'react-hot-toast'
import type { PortfolioTransaction } from '@/types'
import { isB3PositionWorkbook } from '@/utils/investmentExcelReconciliation'
import { useReconciliationFiles } from './useReconciliationFiles'
import { useReconciliationDrafts, type MissingDraft, type ConflictDraft } from './useReconciliationDrafts'
import { useReconciliationActions } from './useReconciliationActions'

// ── Tipos exportados ──

export type ReconciliationStep = 'upload' | 'summary' | 'corrections' | 'yield_config' | 'position' | 'review'
export type CorrectionsTab = 'conflicts' | 'missing' | 'suspicious'

export type { MissingDraft, ConflictDraft }

// ── Hook Composer ──

export function useReconciliationState(
  portfolioId: string,
  existingTransactions: PortfolioTransaction[],
  onSaved: () => void,
) {
  // ── Sub-hooks ──
  const files = useReconciliationFiles(existingTransactions)
  const drafts = useReconciliationDrafts()

  // ── Navigation state ──
  const [currentStep, setCurrentStep] = useState<ReconciliationStep>('upload')
  const [positionOnlyMode, setPositionOnlyMode] = useState(false)
  const [correctionsTab, setCorrectionsTab] = useState<CorrectionsTab>('conflicts')

  // ── Modal ref & scroll ──
  const modalTopRef = useRef<HTMLDivElement | null>(null)

  const scrollToTop = useCallback(() => {
    const container = modalTopRef.current?.closest('.overflow-y-auto')
    if (container) {
      container.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      modalTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  // ── Derived: wizard counts ──
  const wizardCounts = useMemo(
    () => ({
      conflicts: drafts.conflictDrafts.filter((c) => !c.applied).length,
      missing: drafts.missingDrafts.length,
      suspicious: files.reconciliation?.existingOnly.length ?? 0,
      corrections:
        drafts.conflictDrafts.filter((c) => !c.applied).length +
        drafts.missingDrafts.length +
        (files.reconciliation?.existingOnly.length ?? 0),
    }),
    [drafts.conflictDrafts, drafts.missingDrafts, files.reconciliation],
  )

  // ── Derived: wizard steps & stepper ──
  const wizardSteps = useMemo(() => {
    const steps = [
      { id: 'summary' as ReconciliationStep, label: 'Resumo' },
      { id: 'corrections' as ReconciliationStep, label: 'Correções' },
    ]
    if (drafts.manualYieldRequiredAssets.length > 0) {
      steps.push({ id: 'yield_config' as ReconciliationStep, label: 'Rentabilidade' })
    }
    steps.push({ id: 'position' as ReconciliationStep, label: 'Posição' })
    steps.push({ id: 'review' as ReconciliationStep, label: 'Fim' })
    return steps
  }, [drafts.manualYieldRequiredAssets])

  const ledgerOnlyMismatches = useMemo(
    () =>
      files.positionValidation?.rows.filter(
        (r) => r.status !== 'ok' && r.status !== 'movements_official',
      ).length ?? 0,
    [files.positionValidation],
  )

  const stepperItems = useMemo(
    () =>
      wizardSteps.map((s) => ({
        id: s.id,
        label: s.label,
        badge:
          s.id === 'corrections'
            ? wizardCounts.corrections
            : s.id === 'position' && files.positionValidation && !files.positionValidation.allOk
              ? ledgerOnlyMismatches || files.positionValidation.mismatchCount
              : s.id === 'yield_config'
                ? drafts.manualYieldRequiredAssets.length
                : undefined,
      })),
    [wizardSteps, wizardCounts.corrections, files.positionValidation, ledgerOnlyMismatches, drafts.manualYieldRequiredAssets],
  )

  // ── Navigation: goToNextStepAfter (defined before actions hook) ──
  const goToNextStepAfter = useCallback(
    (from: ReconciliationStep, newlyImported?: MissingDraft[]) => {
      if (!files.reconciliation) return
      const order: ReconciliationStep[] = ['summary', 'corrections', 'yield_config', 'position', 'review']

      const allYieldDrafts = [...drafts.importedDrafts, ...(newlyImported || [])]
      const activeYieldRequired = allYieldDrafts.filter(
        (draft) => draft.pricing_mode === 'fixed_income' || draft.pricing_mode === 'manual_value' || draft.isTreasury,
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
    },
    [files.reconciliation, drafts.importedDrafts, wizardCounts],
  )

  // ── Actions hook ──
  const actions = useReconciliationActions({
    portfolioId,
    onSaved,
    scrollToTop,
    setConflictDrafts: drafts.setConflictDrafts,
    setMissingDrafts: drafts.setMissingDrafts,
    setImportedDrafts: drafts.setImportedDrafts,
    setReconciliation: files.setReconciliation,
    reconciliation: files.reconciliation,
    conflictDrafts: drafts.conflictDrafts,
    missingDrafts: drafts.missingDrafts,
    importedDrafts: drafts.importedDrafts,
    manualYieldRequiredAssets: drafts.manualYieldRequiredAssets,
    positionAdjustments: files.positionAdjustments,
    goToNextStepAfter: goToNextStepAfter as (from: string, newlyImported?: MissingDraft[]) => void,
  })

  // ── Process file buffer (orchestrates files + drafts + navigation) ──
  const processFileBuffer = useCallback(
    async (buffer: ArrayBuffer, name: string) => {
      files.setParseStatus('Lendo e interpretando planilha...')
      try {
        if (isB3PositionWorkbook(buffer)) {
          files.setFileName('')
          files.setParseStatus(
            'Este é um arquivo de posição de custódia. A conciliação de posição é feita separadamente — use a área "2. Posição de Custódia" ao lado para carregá-lo, ou inicie uma conciliação apenas de posição.',
          )
          return
        }

        const result = await files.processMovementFileBuffer(buffer)
        if (!result) {
          files.setFileName('')
          files.setParseStatus('O arquivo enviado não contém lançamentos reconhecíveis ou está vazio.')
          return
        }

        files.setFileName(name)
        files.setDetectedManualAssets(result.detectedManualAssets)
        files.setExcludedCount(result.excludedCount)
        files.setReconciliation(result.reconciliation)
        files.setParsedEquityItems(result.parsedItems)
        drafts.setMissingDrafts(result.missingDraftsData)
        drafts.setConflictDrafts(result.conflictDraftsData)

        files.setParseStatus('')
        setCurrentStep('summary')
      } catch (err: unknown) {
        files.setFileName('')
        const message =
          err instanceof Error ? err.message : 'Erro ao carregar o arquivo Excel. Verifique se o formato está correto.'
        files.setParseStatus(message)
      }
    },
    [files, drafts],
  )

  // ── File upload wrapper ──
  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) return
      const buffer = await file.arrayBuffer()
      await processFileBuffer(buffer, file.name)
      event.target.value = ''
    },
    [processFileBuffer],
  )

  // ── Drag & Drop wrappers ──
  const handleDrag = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.type === 'dragenter' || e.type === 'dragover') {
        files.setDragActive(true)
      } else if (e.type === 'dragleave') {
        files.setDragActive(false)
      }
    },
    [files],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      files.setDragActive(false)
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        const file = e.dataTransfer.files[0]
        if (file.name.toLowerCase().endsWith('.xlsx')) {
          const buffer = await file.arrayBuffer()
          await processFileBuffer(buffer, file.name)
        } else {
          toast.error('Por favor, envie apenas arquivos em formato Excel (.xlsx)')
        }
      }
    },
    [files, processFileBuffer],
  )

  const handlePositionDrag = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.type === 'dragenter' || e.type === 'dragover') {
        files.setPositionDragActive(true)
      } else if (e.type === 'dragleave') {
        files.setPositionDragActive(false)
      }
    },
    [files],
  )

  const handlePositionDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      files.setPositionDragActive(false)
      const file = e.dataTransfer.files?.[0]
      if (file?.name.toLowerCase().endsWith('.xlsx')) {
        const buffer = await file.arrayBuffer()
        await files.processPositionFileBuffer(buffer, file.name)
      } else {
        toast.error('Envie um arquivo .xlsx de posição.')
      }
    },
    [files],
  )

  const handlePositionFileChange = useCallback(
    async (file: File) => {
      await files.processPositionFileBuffer(await file.arrayBuffer(), file.name)
    },
    [files],
  )

  // ── Effects ──

  // Recompute position validation on relevant changes
  useEffect(() => {
    if (!files.officialPosition) return
    files.recomputePositionValidation(files.officialPosition, files.b3ParsedPositions, files.systemPositions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.officialPosition, files.b3ParsedPositions, files.systemPositions])

  // Auto-scroll on step change
  useEffect(() => {
    scrollToTop()
  }, [currentStep, scrollToTop])

  // Auto-switch corrections tab when current tab becomes empty
  useEffect(() => {
    if (currentStep === 'corrections') {
      if (correctionsTab === 'conflicts' && wizardCounts.conflicts === 0) {
        if (wizardCounts.missing > 0) setCorrectionsTab('missing')
        else if (wizardCounts.suspicious > 0) setCorrectionsTab('suspicious')
      } else if (correctionsTab === 'missing' && wizardCounts.missing === 0) {
        if (wizardCounts.conflicts > 0) setCorrectionsTab('conflicts')
        else if (wizardCounts.suspicious > 0) setCorrectionsTab('suspicious')
      } else if (correctionsTab === 'suspicious' && wizardCounts.suspicious === 0) {
        if (wizardCounts.conflicts > 0) setCorrectionsTab('conflicts')
        else if (wizardCounts.missing > 0) setCorrectionsTab('missing')
      }
    }
  }, [currentStep, correctionsTab, wizardCounts])

  // Auto-select all available position adjustments
  useEffect(() => {
    if (files.positionAdjustments.length > 0) {
      actions.setSelectedAdjTickers(new Set(files.positionAdjustments.map((a) => a.ticker)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.positionAdjustments])

  // ── Handlers ──
  const handleStepClick = useCallback((stepId: string) => {
    setCurrentStep(stepId as ReconciliationStep)
  }, [])

  const handleNewStatement = useCallback(() => {
    files.resetFileState()
    drafts.resetDraftState()
    actions.resetActionsState()
    setPositionOnlyMode(false)
    setCurrentStep('upload')
  }, [files, drafts, actions])

  const resetAllState = useCallback(() => {
    files.resetFileState()
    drafts.resetDraftState()
    actions.resetActionsState()
    setCurrentStep('upload')
    setPositionOnlyMode(false)
    setCorrectionsTab('conflicts')
  }, [files, drafts, actions])

  // ── Return unified interface ──
  return {
    // File state
    fileName: files.fileName,
    parseStatus: files.parseStatus,
    positionFileName: files.positionFileName,
    positionParseStatus: files.positionParseStatus,
    reconciliation: files.reconciliation,
    detectedManualAssets: files.detectedManualAssets,
    excludedCount: files.excludedCount,
    dragActive: files.dragActive,
    positionDragActive: files.positionDragActive,
    officialPosition: files.officialPosition,
    positionValidation: files.positionValidation,
    positionPreviewRows: files.positionPreviewRows,
    positionAdjustments: files.positionAdjustments,
    existingSystemTickers: files.existingSystemTickers,
    nonB3SystemPositions: files.nonB3SystemPositions,
    detectedManualPositionAssets: files.detectedManualPositionAssets,

    // Draft state
    missingDrafts: drafts.missingDrafts,
    conflictDrafts: drafts.conflictDrafts,
    importedDrafts: drafts.importedDrafts,
    manualYieldRequiredAssets: drafts.manualYieldRequiredAssets,
    selectedMissingCount: drafts.selectedMissingCount,
    selectedConflictCount: drafts.selectedConflictCount,

    // Actions state
    loading: actions.loading,
    progress: actions.progress,
    selectedAdjustmentTickers: actions.selectedAdjustmentTickers,

    // Navigation state
    currentStep,
    setCurrentStep,
    positionOnlyMode,
    setPositionOnlyMode,
    correctionsTab,
    setCorrectionsTab,

    // Computed values
    wizardCounts,
    wizardSteps,
    stepperItems,

    // Refs
    fileInputRef: files.fileInputRef,
    positionFileInputRef: files.positionFileInputRef,
    modalTopRef,

    // Setters (exposed for adapters)
    setConflictDrafts: drafts.setConflictDrafts,
    setMissingDrafts: drafts.setMissingDrafts,
    setDragActive: files.setDragActive,
    setPositionDragActive: files.setPositionDragActive,
    setParseStatus: files.setParseStatus,
    setPositionParseStatus: files.setPositionParseStatus,

    // Handlers
    handleFileUpload,
    handleDrag,
    handleDrop,
    handlePositionDrag,
    handlePositionDrop,
    handlePositionFileChange,
    processPositionFileBuffer: files.processPositionFileBuffer,
    handleStepClick,
    updateMissingDraft: drafts.updateMissingDraft,
    updateImportedDraft: drafts.updateImportedDraft,
    handleApplySelectedConflicts: actions.handleApplySelectedConflicts,
    handleImportSelectedMissing: actions.handleImportSelectedMissing,
    handleSaveAssetYield: actions.handleSaveAssetYield,
    handleApplyPositionAdjustments: actions.handleApplyPositionAdjustments,
    handleDeleteLedgerOnlyTransaction: actions.handleDeleteLedgerOnlyTransaction,
    handleNewStatement,
    handleToggleAdjustment: actions.handleToggleAdjustment,
    handleSelectAllAdjustments: actions.handleSelectAllAdjustments,
    goToNextStepAfter: goToNextStepAfter,
    scrollToTop,
    resetAllState,
  }
}
