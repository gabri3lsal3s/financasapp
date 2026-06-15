import { useEffect, useState } from 'react'
import ConfirmModal from '@/components/ConfirmModal'
import Select from '@/components/Select'
import type { CreditCard } from '@/types'

interface DeleteCardConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (migrationTargetCardId: string | null) => Promise<void>
  editingCard: CreditCard | null
  creditCards: CreditCard[]
  isDeleting: boolean
  hasExpensesLinked: boolean
}

export default function DeleteCardConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  editingCard,
  creditCards,
  isDeleting,
  hasExpensesLinked,
}: DeleteCardConfirmModalProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const [migrationTargetCardId, setMigrationTargetCardId] = useState('')

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setMigrationTargetCardId('')
    }
  }, [isOpen])

  const handleConfirm = async () => {
    if (step === 1 && hasExpensesLinked) {
      setStep(2)
      return
    }

    // On step 2 or if there are no linked expenses, confirm deletion
    const migrationId = step === 2 ? (migrationTargetCardId || null) : null
    await onConfirm(migrationId)
  }

  const otherCards = creditCards.filter(
    (c) => c.id !== editingCard?.id && c.is_active !== false
  )

  const showStep2 = step === 2 && hasExpensesLinked

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      title={!showStep2 ? 'Excluir cartão' : 'Migrar despesas'}
      confirmLabel={
        isDeleting
          ? 'Processando...'
          : !showStep2 && hasExpensesLinked
          ? 'Próximo'
          : 'Confirmar Exclusão'
      }
      confirmVariant={showStep2 || !hasExpensesLinked ? 'danger' : 'primary'}
      loading={isDeleting}
      onConfirm={handleConfirm}
    >
      {!showStep2 ? (
        <>
          <p className="text-sm text-primary">
            Deseja realmente excluir o cartão <strong>{editingCard?.name}</strong>?
          </p>
          <div className="modal-alert modal-alert--danger text-xs leading-relaxed">
            <p className="mb-1 font-semibold">Aviso:</p>
            <p>
              Esta ação é irreversível e removerá permanentemente o histórico de
              faturas e pagamentos deste cartão.
            </p>
          </div>
        </>
      ) : (
        <>
          <p className="modal-intro text-sm">
            Existem despesas vinculadas a este cartão. O que deseja fazer?
          </p>
          <Select
            label="Migrar despesas para:"
            value={migrationTargetCardId}
            onChange={(e) => setMigrationTargetCardId(e.target.value)}
            options={[
              { value: '', label: "Apenas desvincular (método 'Outro')" },
              ...otherCards.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {migrationTargetCardId === '' && (
            <p className="text-xs italic text-secondary mt-1">
              * As despesas se tornarão avulsas e não pertencerão a nenhuma fatura.
            </p>
          )}
        </>
      )}
    </ConfirmModal>
  )
}
