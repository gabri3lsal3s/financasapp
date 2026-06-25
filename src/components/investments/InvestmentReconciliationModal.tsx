import { useCallback, useEffect } from 'react'
import Modal from '@/components/Modal'
import B3ReconciliationStepper from '@/components/investments/B3ReconciliationStepper'
import {
  useReconciliationState,
  type ReconciliationStep,
} from '@/hooks/useReconciliationState'
import StepUpload from './reconciliation/StepUpload'
import StepSummary from './reconciliation/StepSummary'
import StepCorrections from './reconciliation/StepCorrections'
import StepYieldConfig from './reconciliation/StepYieldConfig'
import StepPosition from './reconciliation/StepPosition'
import StepReview from './reconciliation/StepReview'
import ReconciliationFooter from './reconciliation/ReconciliationFooter'
import type { PortfolioTransaction } from '@/types'
import { Loader2 } from 'lucide-react'

interface InvestmentReconciliationModalProps {
  isOpen: boolean
  onClose: () => void
  portfolioId: string
  existingTransactions: PortfolioTransaction[]
  onSaved: () => void
  onOpenAssetConfig: (ticker: string) => void
}

export default function InvestmentReconciliationModal({
  isOpen,
  onClose,
  portfolioId,
  existingTransactions,
  onSaved,
  onOpenAssetConfig,
}: InvestmentReconciliationModalProps) {
  const {
    // Estado
    fileName,
    parseStatus,
    positionFileName,
    positionParseStatus,
    reconciliation,
    detectedManualAssets,
    excludedCount,
    missingDrafts,
    conflictDrafts,
    loading,
    progress,
    currentStep,
    positionOnlyMode,
    dragActive,
    positionDragActive,
    positionValidation,
    selectedAdjustmentTickers,
    correctionsTab,
    positionAdjustments,
    positionPreviewRows,
    existingSystemTickers,
    manualYieldRequiredAssets,
    wizardCounts,
    selectedMissingCount,
    selectedConflictCount,
    nonB3SystemPositions,
    detectedManualPositionAssets,
    stepperItems,

    // Refs
    fileInputRef,
    positionFileInputRef,
    modalTopRef,

    // Setters
    setCurrentStep,
    setCorrectionsTab,
    setConflictDrafts,
    setPositionDragActive,
    setPositionOnlyMode,

    // Handlers
    handleFileUpload,
    handleDrag,
    handleDrop,
    handlePositionDrop,
    handlePositionFileChange,
    handleStepClick,
    updateMissingDraft,
    updateImportedDraft,
    handleApplySelectedConflicts,
    handleImportSelectedMissing,
    handleSaveAssetYield,
    handleApplyPositionAdjustments,
    handleDeleteLedgerOnlyTransaction,
    handleNewStatement,
    handleToggleAdjustment,
    handleSelectAllAdjustments,
    processPositionFileBuffer,
    goToNextStepAfter,
    resetAllState,
  } = useReconciliationState(portfolioId, existingTransactions, onSaved)

  // ── Adapters ──

  const handleGoBack = useCallback(() => {
    if (currentStep === 'corrections') setCurrentStep('summary')
    else if (currentStep === 'yield_config') setCurrentStep('corrections')
    else if (currentStep === 'position')
      setCurrentStep(positionOnlyMode ? 'upload' : 'corrections')
    else if (currentStep === 'review') setCurrentStep('position')
  }, [currentStep, positionOnlyMode, setCurrentStep])

  const handlePositionDragStart = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPositionDragActive(true)
    },
    [setPositionDragActive],
  )

  const handlePositionDragEnd = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setPositionDragActive(false)
    },
    [setPositionDragActive],
  )

  const handlePositionFileClick = useCallback(() => {
    document.getElementById('b3-position-file-input')?.click()
  }, [])

  const handlePositionFileChangeEvent = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        await processPositionFileBuffer(await file.arrayBuffer(), file.name)
      }
    },
    [processPositionFileBuffer],
  )

  const handleStartSummary = useCallback(
    () => setCurrentStep('summary'),
    [setCurrentStep],
  )

  const handleStartPositionOnly = useCallback(() => {
    setPositionOnlyMode(true)
    setCurrentStep('position')
  }, [setPositionOnlyMode, setCurrentStep])

  const handleToggleConflict = useCallback(
    (key: string) => {
      setConflictDrafts((prev) =>
        prev.map((c) =>
          c.key === key ? { ...c, selected: !c.selected } : c,
        ),
      )
    },
    [setConflictDrafts],
  )

  // ── Reset state on modal open (somente quando isOpen muda para true) ──
  useEffect(() => {
    if (isOpen) {
      resetAllState()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // ── Render ──

  const showStepper =
    (reconciliation || positionOnlyMode) && currentStep !== 'upload'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conciliação B3 — Movimentação e Posição"
      size="2xl"
      footer={
        <ReconciliationFooter
          currentStep={currentStep}
          loading={loading}
          fileName={fileName}
          positionFileName={positionFileName}
          reconciliation={reconciliation}
          wizardCorrectionsCount={wizardCounts.corrections}
          manualYieldAssetsCount={manualYieldRequiredAssets.length}
          positionOnlyMode={positionOnlyMode}
          positionValidation={positionValidation}
          onClose={onClose}
          onStartSummary={handleStartSummary}
          onStartPositionOnly={handleStartPositionOnly}
          onGoToStep={handleStepClick}
          onGoToNextAfter={goToNextStepAfter}
          onNewStatement={handleNewStatement}
          onGoBack={handleGoBack}
        />
      }
    >
      <div className="modal-form-stack w-full text-left">
        {/* Scroll anchor */}
        <div ref={modalTopRef} />

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx"
          onChange={handleFileUpload}
          className="hidden"
        />
        <input
          id="b3-position-file-input"
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handlePositionFileChangeEvent}
        />

        {/* ── Progress Overlay ── */}
        {loading && progress && (
          <div className="modal-panel-glass space-y-2.5 p-4 animate-pulse-slow border-balance/25">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-balance flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin text-balance" />
                {progress.label}
              </span>
              <span className="text-secondary tabular-nums">
                {progress.current} / {progress.total}
              </span>
            </div>
            <div className="w-full h-2 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-balance rounded-full transition-all duration-300"
                style={{
                  width:
                    progress.total > 0
                      ? `${Math.round((progress.current / progress.total) * 100)}%`
                      : '0%',
                }}
              />
            </div>
            <p className="text-[10px] text-secondary text-right tabular-nums">
              {progress.total > 0
                ? Math.round((progress.current / progress.total) * 100)
                : 0}
              % concluído
            </p>
          </div>
        )}

        {/* ── Stepper ── */}
        {showStepper && (
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
                <p
                  className="text-[10px] text-secondary truncate"
                  title={positionFileName}
                >
                  {positionOnlyMode ? (
                    <>
                      <span className="text-balance font-bold">
                        Modo posição
                      </span>
                      {' · '}
                    </>
                  ) : fileName ? (
                    <>
                      Movimentação:{' '}
                      <span className="font-mono text-primary">
                        {fileName}
                      </span>
                      {' · '}
                    </>
                  ) : null}
                  Posição:{' '}
                  <span className="font-mono text-primary">
                    {positionFileName}
                  </span>
                </p>
              ) : null
            }
          />
        )}

        {/* Step: Upload */}
        {currentStep === 'upload' && (
          <StepUpload
            fileName={fileName}
            positionFileName={positionFileName}
            parseStatus={parseStatus}
            positionParseStatus={positionParseStatus}
            dragActive={dragActive}
            positionDragActive={positionDragActive}
            fileInputRef={fileInputRef}
            onDrag={handleDrag}
            onDrop={handleDrop}
            onPositionDragStart={handlePositionDragStart}
            onPositionDragEnd={handlePositionDragEnd}
            onPositionDrop={handlePositionDrop}
            onPositionFileClick={handlePositionFileClick}
          />
        )}

        {/* Step: Summary */}
        {currentStep === 'summary' && reconciliation && (
          <StepSummary
            reconciliation={reconciliation}
            conflictDrafts={conflictDrafts}
            missingDrafts={missingDrafts}
            positionPreviewRows={positionPreviewRows}
            detectedManualAssets={detectedManualAssets}
            excludedCount={excludedCount}
          />
        )}

        {/* Step: Corrections */}
        {currentStep === 'corrections' && reconciliation && (
          <StepCorrections
            reconciliation={reconciliation}
            conflictDrafts={conflictDrafts}
            missingDrafts={missingDrafts}
            correctionsTab={correctionsTab}
            onSetCorrectionsTab={setCorrectionsTab}
            wizardCounts={wizardCounts}
            loading={loading}
            selectedConflictCount={selectedConflictCount}
            selectedMissingCount={selectedMissingCount}
            existingSystemTickers={existingSystemTickers}
            onUpdateMissingDraft={updateMissingDraft}
            onApplySelectedConflicts={handleApplySelectedConflicts}
            onImportSelectedMissing={handleImportSelectedMissing}
            onDeleteLedgerOnlyTransaction={handleDeleteLedgerOnlyTransaction}
            onToggleConflict={handleToggleConflict}
          />
        )}

        {/* Step: Yield Config */}
        {currentStep === 'yield_config' && (
          <StepYieldConfig
            manualYieldRequiredAssets={manualYieldRequiredAssets}
            onOpenAssetConfig={onOpenAssetConfig}
            onUpdateImportedDraft={updateImportedDraft}
            onSaveAssetYield={handleSaveAssetYield}
          />
        )}

        {/* Step: Position */}
        {currentStep === 'position' &&
          (reconciliation || positionOnlyMode) && (
            <StepPosition
              positionFileName={positionFileName}
              positionParseStatus={positionParseStatus}
              positionDragActive={positionDragActive}
              positionValidation={positionValidation}
              positionAdjustments={positionAdjustments}
              selectedAdjustmentTickers={selectedAdjustmentTickers}
              nonB3SystemPositions={nonB3SystemPositions}
              detectedManualPositionAssets={detectedManualPositionAssets}
              positionOnlyMode={positionOnlyMode}
              loading={loading}
              onToggleAdjustment={handleToggleAdjustment}
              onSelectAllAdjustments={handleSelectAllAdjustments}
              onApplyAdjustments={handleApplyPositionAdjustments}
              onPositionFileChange={handlePositionFileChange}
              onPositionDrop={handlePositionDrop}
              onPositionDragEnter={handlePositionDragStart}
              onPositionDragOver={handlePositionDragStart}
              onPositionDragLeave={handlePositionDragEnd}
              onPositionFileInputRef={(el) => {
                positionFileInputRef.current = el
              }}
            />
          )}

        {/* Step: Review */}
        {currentStep === 'review' && reconciliation && (
          <StepReview
            reconciliation={reconciliation}
            conflictDrafts={conflictDrafts}
            positionValidation={positionValidation}
          />
        )}
      </div>
    </Modal>
  )
}
