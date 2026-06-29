import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Input from '@/components/Input'
import NumberInput from '@/components/NumberInput'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import type { BillPaymentDisplayItem } from '@/utils/creditCardBilling'

interface BillPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (amount: number, date: string, note: string) => Promise<void>
  onDelete?: () => Promise<void>
  currentMonth: string
  editingPayment: BillPaymentDisplayItem | null
  loading: boolean
}

export default function BillPaymentModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  currentMonth,
  editingPayment,
  loading,
}: BillPaymentModalProps) {
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (editingPayment) {
        setPaymentAmount(String(Math.abs(editingPayment.amount) || ''))
        setPaymentDate(editingPayment.payment_date || format(new Date(), 'yyyy-MM-dd'))
        setPaymentNote(editingPayment.note || '')
      } else {
        setPaymentAmount('')
        setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
        setPaymentNote('')
      }
    }
  }, [isOpen, editingPayment])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const parsedAmount = Number(paymentAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      alert('Informe um valor de pagamento maior que zero.')
      return
    }

    await onSubmit(parsedAmount, paymentDate, paymentNote.trim())
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={editingPayment ? 'Editar pagamento' : `Registrar pagamento (${currentMonth})`}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingPayment ? 'Salvar pagamento' : 'Confirmar pagamento'}
          submitDisabled={loading}
          onDelete={editingPayment ? onDelete : undefined}
          deleteLabel="Excluir pagamento"
        />
      )}
    >
      <NumberInput
        label="Valor pago"
        min={0.01}
        step={0.01}
        value={paymentAmount}
        onChange={(event) => setPaymentAmount(event.target.value)}
        required
        hideSpinButtons
      />

      <Input
        label="Data do pagamento"
        type="date"
        value={paymentDate}
        onChange={(event) => setPaymentDate(event.target.value)}
        required
      />

      <Input
        label="Observação (opcional)"
        value={paymentNote}
        onChange={(event) => setPaymentNote(event.target.value)}
        placeholder="Observações adicionais..."
      />
    </ModalForm>
  )
}
