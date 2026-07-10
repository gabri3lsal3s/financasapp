import Input from '@/components/Input'
import CurrencyInput from '@/components/CurrencyInput'
import { formatCurrency, formatDate } from '@/utils/format'
import ReconciliationCard from '@/components/reconciliation/ReconciliationCard'
import ReconciliationBadge from '@/components/reconciliation/ReconciliationBadge'
import ReconciliationAlert from '@/components/reconciliation/ReconciliationAlert'
import type { InstallmentAnalysis } from '@/utils/creditCardCsvReconciliation'

export interface ConflictDraft {
  key: string
  existingId: string
  officialId: string
  selected: boolean
  applied: boolean
  autoResolvedByInstallment: boolean
  date: string
  amount: string
  existingDescription: string
  officialDescription: string
  installmentLabel?: string
  isRefund: boolean
  installmentAnalysis?: InstallmentAnalysis | null
}

interface ConflictDraftCardProps {
  draft: ConflictDraft
  conflict: {
    official: {
      description?: string | null
      date: string
      amount: number
    }
    existing: {
      description?: string | null
      date: string
      amount: number
      base_amount?: number
    }
    suggestedUpdate: {
      date: string
      amount: number
    }
  }
  index: number
  onToggleSelect: () => void
  onUpdateDate: (date: string) => void
  onUpdateAmount: (amount: string) => void
}

export default function ConflictDraftCard({
  draft,
  conflict,
  index,
  onToggleSelect,
  onUpdateDate,
  onUpdateAmount,
}: ConflictDraftCardProps) {
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
            <ReconciliationBadge variant="conflict">
              Conflito
            </ReconciliationBadge>
            {draft.applied ? (
              <ReconciliationBadge variant="success">
                ✓ Ajuste aplicado
              </ReconciliationBadge>
            ) : draft.autoResolvedByInstallment ? (
              <ReconciliationBadge variant="official">
                Resolvido automático
              </ReconciliationBadge>
            ) : null}
          </div>
          <p className="text-sm font-semibold text-primary mt-1.5 break-words">
            {conflict.official.description || conflict.existing.description}
          </p>
          <p className="text-xs text-secondary mt-0.5 font-mono leading-relaxed">
            Sistema: {formatDate(conflict.existing.date)} ({formatCurrency(Number(conflict.existing.base_amount ?? conflict.existing.amount ?? 0))}) <br />
            Oficial: {formatDate(conflict.suggestedUpdate.date)} ({formatCurrency(Number(conflict.official.amount || 0))})
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-bold text-accent">
            {formatCurrency(Number(draft.amount || conflict.official.amount || 0))}
          </p>
          {!draft.applied && (
            <p className="text-[10px] text-secondary mt-1.5 font-medium">
              {draft.selected ? '✓ Selecionado' : 'Clique para selecionar'}
            </p>
          )}
        </div>
      </div>

      {draft.autoResolvedByInstallment && (
        <ReconciliationAlert variant="success" className="mt-1">
          Sequência de parcelas consistente entre os meses. Diferença de data no CSV oficial foi tratada automaticamente.
        </ReconciliationAlert>
      )}

      {draft.installmentAnalysis && !draft.autoResolvedByInstallment && (
        <ReconciliationAlert
          variant={draft.installmentAnalysis.status === 'consistent' ? 'success' : 'warning'}
          title={
            draft.installmentAnalysis.status === 'missing'
              ? 'Parcelamento parcialmente consistente'
              : undefined
          }
          className="mt-1"
        >
          <div className="space-y-1">
            {draft.installmentAnalysis.status === 'consistent' && (
              <p>
                Parcelamento consistente entre meses ({draft.installmentAnalysis.foundNumbers.join(', ')}/{draft.installmentLabel || 'n'}).
              </p>
            )}

            {draft.installmentAnalysis.status === 'missing' && (
              <p>
                Parcelas encontradas: {draft.installmentAnalysis.foundNumbers.join(', ') || 'nenhuma'} <br />
                Parcelas faltando: {draft.installmentAnalysis.missingNumbers.join(', ') || 'nenhuma'}
              </p>
            )}

            {draft.installmentAnalysis.status === 'inconclusive' && (
              <p>
                Não foi possível confirmar a sequência completa das parcelas entre faturas anteriores e posteriores.
              </p>
            )}

            {draft.installmentAnalysis.officialDateInconsistencyMessage && (
              <p className="mt-1 italic">
                {draft.installmentAnalysis.officialDateInconsistencyMessage}
              </p>
            )}
          </div>
        </ReconciliationAlert>
      )}

      {draft.selected && !draft.applied && (
        <div className="pt-3 border-t border-glass mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[11px] font-bold text-secondary uppercase tracking-wider font-mono">Ajustar sugestão de atualização:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              label="Data sugerida"
              type="date"
              value={draft.date}
              disabled={draft.applied}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                onUpdateDate(event.target.value)
              }}
            />

            <CurrencyInput
              label="Valor sugerido"
              value={Number(draft.amount || conflict.official.amount || 0)}
              disabled={draft.applied}
              onChange={(_e, val) => {
                onUpdateAmount(String(val))
              }}
            />
          </div>
        </div>
      )}
    </ReconciliationCard>
  )
}
