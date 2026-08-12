import Button from '@/components/Button'
import ConflictDraftCard from '@/components/creditCards/ConflictDraftCard'
import { buildConflictKey } from '@/utils/csvReconciliationUi'
import type { ConflictDraft } from '@/utils/csvReconciliationUi'
import type { ReconciliationConflict } from '@/utils/creditCardCsvReconciliation'

interface CsvConflictsStepProps {
  conflicts: ReconciliationConflict[]
  drafts: ConflictDraft[]
  loading: boolean
  selectedCount: number
  onToggleSelect: (key: string) => void
  onUpdateDate: (key: string, date: string) => void
  onUpdateAmount: (key: string, amount: string) => void
  onApply: () => void
}

export default function CsvConflictsStep({
  conflicts,
  drafts,
  loading,
  selectedCount,
  onToggleSelect,
  onUpdateDate,
  onUpdateAmount,
  onApply,
}: CsvConflictsStepProps) {
  return (
    <div className="space-y-3 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-primary">
          Conflitos Identificados ({conflicts.length})
        </h4>
        <p className="text-xs text-secondary">
          Ajuste lançamentos no sistema que possuem divergências de data ou valor com a fatura oficial.
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-income/5 border border-income/20 rounded-xl p-6 text-center space-y-2">
          <span className="text-2xl text-income font-bold">✓</span>
          <h4 className="font-bold text-income text-sm">Nenhum conflito encontrado!</h4>
          <p className="text-xs text-secondary">
            Todos os lançamentos nesta fatura possuem datas e valores consistentes com o sistema.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {drafts.map((draft, index) => {
              const conflict = conflicts.find((item) =>
                buildConflictKey(String(item.existing.id || ''), String(item.official.id || '')) === draft.key,
              )
              if (!conflict) return null

              return (
                <ConflictDraftCard
                  key={draft.key}
                  draft={draft}
                  conflict={conflict}
                  index={index}
                  onToggleSelect={() => onToggleSelect(draft.key)}
                  onUpdateDate={(date) => onUpdateDate(draft.key, date)}
                  onUpdateAmount={(amount) => onUpdateAmount(draft.key, amount)}
                />
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={onApply}
              disabled={loading || selectedCount === 0}
            >
              {loading ? 'Aplicando...' : `Ajustar Conflitos Selecionados (${selectedCount})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
