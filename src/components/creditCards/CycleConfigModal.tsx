import { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Button from '@/components/Button'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'

interface CycleConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (closingDay: number, dueDay: number) => Promise<void>
  onReset: () => Promise<void>
  currentMonth: string
  initialClosingDay: number
  initialDueDay: number
  loading: boolean
}

export default function CycleConfigModal({
  isOpen,
  onClose,
  onSubmit,
  onReset,
  currentMonth,
  initialClosingDay,
  initialDueDay,
  loading,
}: CycleConfigModalProps) {
  const [closingDay, setClosingDay] = useState('')
  const [dueDay, setDueDay] = useState('')

  useEffect(() => {
    if (isOpen) {
      setClosingDay(String(initialClosingDay))
      setDueDay(String(initialDueDay))
    }
  }, [isOpen, initialClosingDay, initialDueDay])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const closingNum = Number(closingDay)
    const dueNum = Number(dueDay)

    if (!Number.isFinite(closingNum) || closingNum < 1 || closingNum > 31) {
      alert('O dia de fechamento deve estar entre 1 e 31.')
      return
    }
    if (!Number.isFinite(dueNum) || dueNum < 1 || dueNum > 31) {
      alert('O dia de vencimento deve estar entre 1 e 31.')
      return
    }

    await onSubmit(closingNum, dueNum)
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={`Ajustar fechamento e vencimento (${currentMonth})`}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Salvar ajuste"
          submitDisabled={loading}
        />
      )}
    >
      <div className="modal-field-row">
        <Input
          label="Fechamento do mês"
          type="number"
          min="1"
          max="31"
          value={closingDay}
          onChange={(event) => setClosingDay(event.target.value)}
          required
        />
        <Input
          label="Vencimento do mês"
          type="number"
          min="1"
          max="31"
          value={dueDay}
          onChange={(event) => setDueDay(event.target.value)}
          required
        />
      </div>

      <p className="modal-intro">
        Este ajuste vale apenas para a competência {currentMonth}.
      </p>

      <Button
        type="button"
        variant="outline"
        fullWidth
        onClick={onReset}
        disabled={loading}
      >
        Usar padrão do cartão neste mês
      </Button>
    </ModalForm>
  )
}
