import Button from '@/components/Button'
import MissingDraftCard from '@/components/creditCards/MissingDraftCard'
import type { CategoryOption, MissingDraft } from '@/utils/csvReconciliationUi'

interface CsvMissingStepProps {
  drafts: MissingDraft[]
  categories: CategoryOption[]
  loading: boolean
  selectedCount: number
  onToggleSelect: (id: string) => void
  onUpdateDate: (id: string, date: string) => void
  onUpdateAmount: (id: string, amount: string) => void
  onUpdateDescription: (id: string, description: string) => void
  onUpdateCategory: (id: string, categoryId: string) => void
  onApply: () => void
}

export default function CsvMissingStep({
  drafts,
  categories,
  loading,
  selectedCount,
  onToggleSelect,
  onUpdateDate,
  onUpdateAmount,
  onUpdateDescription,
  onUpdateCategory,
  onApply,
}: CsvMissingStepProps) {
  return (
    <div className="space-y-3 animate-page-enter">
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-primary">
          Despesas Faltantes no Sistema ({drafts.length})
        </h4>
        <p className="text-xs text-secondary">
          Insira no sistema os lançamentos da fatura oficial que ainda não constam nos seus registros.
        </p>
      </div>

      {drafts.length === 0 ? (
        <div className="bg-income/5 border border-income/20 rounded-xl p-6 text-center space-y-2">
          <span className="text-2xl text-income font-bold">✓</span>
          <h4 className="font-bold text-income text-sm">Nenhuma despesa faltando!</h4>
          <p className="text-xs text-secondary">
            Todas as despesas da fatura oficial já constam no sistema.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-[380px] overflow-y-auto space-y-2 pr-1 scrollbar-thin">
            {drafts.map((draft, index) => (
              <MissingDraftCard
                key={draft.id}
                draft={draft}
                categories={categories}
                index={index}
                onToggleSelect={() => onToggleSelect(draft.id)}
                onUpdateDate={(date) => onUpdateDate(draft.id, date)}
                onUpdateAmount={(amount) => onUpdateAmount(draft.id, amount)}
                onUpdateDescription={(description) => onUpdateDescription(draft.id, description)}
                onUpdateCategory={(categoryId) => onUpdateCategory(draft.id, categoryId)}
              />
            ))}
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
              {loading ? 'Aplicando...' : `Adicionar Itens Selecionados (${selectedCount})`}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
