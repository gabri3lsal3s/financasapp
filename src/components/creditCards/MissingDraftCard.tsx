import Input from '@/components/Input'
import CurrencyInput from '@/components/CurrencyInput'
import Select from '@/components/Select'
import { formatCurrency, formatDate, parseMoneyInput } from '@/utils/format'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationBadge from '@/components/reconciliation/ReconciliationBadge'
import ReconciliationAlert from '@/components/reconciliation/ReconciliationAlert'

export interface MissingDraft {
  id: string
  selected: boolean
  date: string
  amount: string
  description: string
  category_id: string
  learnedSuggestion: {
    enabled: boolean
    confidence?: number
  }
  possibleExistingMatch?: {
    id: string
    date: string
    amount: number
    description: string
    paymentMethod: string
    wrongDate: boolean
    wrongPaymentMethod: boolean
  } | null
  official: {
    isRefund: boolean
    amount: number
    date: string
    description: string
  }
}

interface CategoryOption {
  id: string
  name: string
}

interface MissingDraftCardProps {
  draft: MissingDraft
  categories: CategoryOption[]
  index: number
  onToggleSelect: () => void
  onUpdateDate: (date: string) => void
  onUpdateAmount: (amount: string) => void
  onUpdateDescription: (description: string) => void
  onUpdateCategory: (categoryId: string) => void
}

export default function MissingDraftCard({
  draft,
  categories,
  index,
  onToggleSelect,
  onUpdateDate,
  onUpdateAmount,
  onUpdateDescription,
  onUpdateCategory,
}: MissingDraftCardProps) {
  return (
    <ReconciliationCard
      selected={draft.selected}
      onClick={onToggleSelect}
      index={index}
      className="space-y-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ReconciliationBadge variant="missing">
              Faltando
            </ReconciliationBadge>
            {draft.learnedSuggestion.enabled && (
              <ReconciliationBadge
                variant="success"
                title={`Confiança: ${Math.round((draft.learnedSuggestion.confidence || 0) * 100)}%`}
              >
                Sugestão inteligente
              </ReconciliationBadge>
            )}
          </div>
          <p className="text-sm font-semibold text-primary mt-1.5 break-words">
            {draft.description}
          </p>
          <p className="text-xs text-secondary mt-0.5">
            {formatDate(draft.date)} • Categoria: {categories.find((c) => c.id === draft.category_id)?.name || 'Sem categoria'}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-primary">
            {draft.official.isRefund ? '-' : ''}
            {formatCurrency(parseMoneyInput(draft.amount) || 0)}
          </p>
          <p className="text-[10px] text-secondary mt-1.5 font-medium">
            {draft.selected ? '✓ Selecionado' : 'Clique para selecionar'}
          </p>
        </div>
      </div>

      {draft.official.isRefund && (
        <p className="text-[11px] text-secondary bg-primary/30 px-2 py-0.5 rounded w-fit mt-1 font-mono">
          Estorno: será incluído com valor negativo.
        </p>
      )}

      {draft.possibleExistingMatch && (
        <div onClick={(e) => e.stopPropagation()}>
          <ReconciliationAlert
            variant="warning"
            title="Possível lançamento duplicado"
            className="mt-1"
          >
            <div className="space-y-1">
              <p>
                Encontrado no sistema com outra data/forma de pagamento. Se selecionado, será corrigido automaticamente para corresponder ao CSV oficial.
              </p>
              <div className="text-[11px] text-secondary space-y-0.5 bg-primary/25 p-2 rounded mt-2 font-mono border border-glass">
                <p>Oficial: {formatDate(draft.official.date)} • {formatCurrency(Number(draft.official.amount || 0))} • {draft.official.description}</p>
                <p>Sistema: {formatDate(draft.possibleExistingMatch.date)} • {formatCurrency(Number(draft.possibleExistingMatch.amount || 0))} • {draft.possibleExistingMatch.description || 'Sem descrição'}</p>
              </div>
            </div>
          </ReconciliationAlert>
        </div>
      )}

      {draft.selected && (
        <div className="pt-3 border-t border-glass mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] font-bold text-secondary uppercase tracking-wider font-mono">
            Ajustar detalhes do lançamento:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              label="Data"
              type="date"
              value={draft.date}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onUpdateDate(event.target.value)}
            />

            <CurrencyInput
              label="Valor"
              value={parseMoneyInput(draft.amount) || 0}
              onChange={(_e, val) => onUpdateAmount(String(val))}
            />

            <Input
              label="Descrição"
              value={draft.description}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onUpdateDescription(event.target.value)}
            />

            <Select
              label="Categoria"
              value={draft.category_id}
              onChange={(event: { target: { value: string; name?: string } }) => onUpdateCategory(event.target.value)}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          </div>
        </div>
      )}
    </ReconciliationCard>
  )
}
