import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Input from '@/components/Input'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import { formatMoneyInput, parseMoneyInput } from '@/utils/format'

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
  const [refundAmount, setRefundAmount] = useState('')
  const [refundDate, setRefundDate] = useState('')
  const [refundDescription, setRefundDescription] = useState('')

  useEffect(() => {
    if (isOpen) {
      setRefundAmount('')
      setRefundDate(format(new Date(), 'yyyy-MM-dd'))
      setRefundDescription('')
    }
  }, [isOpen])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const baseVal = parseMoneyInput(refundAmount)
    if (Number.isNaN(baseVal) || baseVal <= 0) {
      alert('Informe um valor de estorno válido.')
      return
    }

    await onSubmit(baseVal, refundDate, refundDescription.trim())
  }

  const handleBlurAmount = () => {
    const parsed = parseMoneyInput(refundAmount)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      setRefundAmount(formatMoneyInput(parsed))
    }
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
      <Input
        label="Valor do estorno"
        type="text"
        inputMode="decimal"
        value={refundAmount}
        onChange={(event) => setRefundAmount(event.target.value)}
        onBlur={handleBlurAmount}
        placeholder="0,00"
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
