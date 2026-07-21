import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Input from '@/components/Input'
import CurrencyInput from '@/components/CurrencyInput'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'

interface RefundModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (amount: number, date: string, description: string) => Promise<void>
  currentMonth: string
  loading: boolean
}

export default function RefundModal({
  isOpen,
  onClose,
  onSubmit,
  currentMonth,
  loading,
}: RefundModalProps) {
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundDate, setRefundDate] = useState('')
  const [refundDescription, setRefundDescription] = useState('')

  useEffect(() => {
    if (isOpen) {
      setRefundAmount(0)
      setRefundDate(format(new Date(), 'yyyy-MM-dd'))
      setRefundDescription('')
    }
  }, [isOpen])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (Number.isNaN(refundAmount) || refundAmount <= 0) {
      alert('Informe um valor de estorno válido.')
      return
    }

    await onSubmit(refundAmount, refundDate, refundDescription.trim())
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={`Registrar estorno (${currentMonth})`}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Confirmar estorno"
          submitDisabled={loading}
        />
      )}
    >
      <CurrencyInput
        label="Valor do estorno"
        value={refundAmount}
        onChange={(_e, val) => setRefundAmount(val ?? 0)}
        required
      />

      <Input
        label="Data"
        type="date"
        value={refundDate}
        onChange={(event) => setRefundDate(event.target.value)}
        required
      />

      <Input
        label="Descrição (opcional)"
        value={refundDescription}
        onChange={(event) => setRefundDescription(event.target.value)}
        placeholder="Ex: Estorno compra loja X"
      />

      <p className="modal-intro">
        Categoria padrão: Estorno • Valor no relatório: igual ao valor do estorno.
      </p>
    </ModalForm>
  )
}
