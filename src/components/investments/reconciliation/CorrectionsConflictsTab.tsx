import Button from '@/components/Button'
import B3ReconciliationGuidance from '@/components/investments/B3ReconciliationGuidance'
import InvestmentConflictCard from '@/components/investments/InvestmentConflictCard'
import type { ConflictDraft } from '@/hooks/useReconciliationState'

interface CorrectionsConflictsTabProps {
  conflictDrafts: ConflictDraft[]
  loading: boolean
  selectedConflictCount: number
  onApplySelectedConflicts: () => void
  onToggleConflict: (key: string) => void
}

export default function CorrectionsConflictsTab({
  conflictDrafts,
  loading,
  selectedConflictCount,
  onApplySelectedConflicts,
  onToggleConflict,
}: CorrectionsConflictsTabProps) {
  const activeConflicts = conflictDrafts.filter((c) => !c.applied)
  const totalActive = activeConflicts.length

  return (
    <div className="space-y-3 animate-page-enter">
      <B3ReconciliationGuidance title="Divergências — o que fazer" variant="warning">
        Marque os itens em que o livro-razão deve ser atualizado para coincidir com o extrato B3. Se a diferença for
        intencional (ex.: ajuste manual documentado), desmarque e trate depois nos alertas ou na posição final.
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
            {selectedConflictCount} de {totalActive} selecionados
          </span>
          <Button
            variant="warning-solid"
            size="sm"
            disabled={loading || selectedConflictCount === 0}
            onClick={onApplySelectedConflicts}
            className="font-bold shrink-0"
          >
            {loading ? 'Aplicando...' : 'Aplicar Selecionados'}
          </Button>
        </div>
      </div>

      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
        {activeConflicts.map((draft) => (
          <InvestmentConflictCard
            key={draft.key}
            draft={draft}
            onToggleSelect={() => onToggleConflict(draft.key)}
          />
        ))}
      </div>
    </div>
  )
}
