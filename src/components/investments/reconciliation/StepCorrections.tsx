import type { InvestmentReconciliationResult } from '@/utils/investmentExcelReconciliation'
import type { ConflictDraft, MissingDraft, CorrectionsTab } from '@/hooks/useReconciliationState'
import CorrectionsConflictsTab from './CorrectionsConflictsTab'
import CorrectionsMissingTab from './CorrectionsMissingTab'
import CorrectionsSuspiciousTab from './CorrectionsSuspiciousTab'

interface StepCorrectionsProps {
  reconciliation: InvestmentReconciliationResult
  conflictDrafts: ConflictDraft[]
  missingDrafts: MissingDraft[]
  correctionsTab: CorrectionsTab
  onSetCorrectionsTab: (tab: CorrectionsTab) => void
  wizardCounts: { conflicts: number; missing: number; suspicious: number; corrections: number }
  loading: boolean
  selectedConflictCount: number
  selectedMissingCount: number
  existingSystemTickers: string[]
  onUpdateMissingDraft: <K extends keyof MissingDraft>(id: string, key: K, value: MissingDraft[K]) => void
  onApplySelectedConflicts: () => void
  onImportSelectedMissing: () => void
  onDeleteLedgerOnlyTransaction: (id: string) => void
  onToggleConflict: (key: string) => void
}

export default function StepCorrections({
  reconciliation,
  conflictDrafts,
  missingDrafts,
  correctionsTab,
  onSetCorrectionsTab,
  wizardCounts,
  loading,
  selectedConflictCount,
  selectedMissingCount,
  existingSystemTickers,
  onUpdateMissingDraft,
  onApplySelectedConflicts,
  onImportSelectedMissing,
  onDeleteLedgerOnlyTransaction,
  onToggleConflict,
}: StepCorrectionsProps) {
  const tabs = [
    { id: 'conflicts' as CorrectionsTab, label: 'Divergentes', count: wizardCounts.conflicts },
    { id: 'missing' as CorrectionsTab, label: 'Faltando', count: wizardCounts.missing },
    { id: 'suspicious' as CorrectionsTab, label: 'Alertas', count: wizardCounts.suspicious },
  ].filter((tab) => tab.count > 0)

  if (tabs.length === 0) return null

  return (
    <div className="space-y-3 animate-page-enter">
      {/* Tab Bar */}
      <div className="modal-tab-bar">
        {tabs.map((tab) => {
          const isActive = correctionsTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSetCorrectionsTab(tab.id)}
              className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-[11px] font-black transition-all duration-300 ${
                isActive
                  ? 'bg-[var(--ds-color-accent-primary)] text-[var(--ds-color-button-text)] border-none scale-[1.02]'
                  : 'text-secondary hover:text-primary hover:bg-[var(--ds-color-accent-primary)]/5'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    isActive
                      ? 'bg-[var(--ds-color-button-text)]/20 text-[var(--ds-color-button-text)]'
                      : 'bg-[var(--ds-color-accent-primary)]/10 text-secondary'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {correctionsTab === 'conflicts' && (
        <CorrectionsConflictsTab
          conflictDrafts={conflictDrafts}
          loading={loading}
          selectedConflictCount={selectedConflictCount}
          onApplySelectedConflicts={onApplySelectedConflicts}
          onToggleConflict={onToggleConflict}
        />
      )}

      {correctionsTab === 'missing' && (
        <CorrectionsMissingTab
          missingDrafts={missingDrafts}
          loading={loading}
          selectedMissingCount={selectedMissingCount}
          existingSystemTickers={existingSystemTickers}
          onUpdateMissingDraft={onUpdateMissingDraft}
          onImportSelectedMissing={onImportSelectedMissing}
        />
      )}

      {correctionsTab === 'suspicious' && (
        <CorrectionsSuspiciousTab
          existingOnly={reconciliation.existingOnly}
          onDelete={onDeleteLedgerOnlyTransaction}
        />
      )}
    </div>
  )
}
