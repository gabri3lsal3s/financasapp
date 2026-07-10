import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import Input from '@/components/Input'
import CurrencyInput from '@/components/CurrencyInput'
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
  const [paymentAmount, setPaymentAmount] = useState(0)
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentNote, setPaymentNote] = useState('')

  useEffect(() => {
    if (isOpen) {
      if (editingPayment) {
        setPaymentAmount(Math.abs(editingPayment.amount) || 0)
        setPaymentDate(editingPayment.payment_date || format(new Date(), 'yyyy-MM-dd'))
        setPaymentNote(editingPayment.note || '')
      } else {
        setPaymentAmount(0)
        setPaymentDate(format(new Date(), 'yyyy-MM-dd'))
        setPaymentNote('')
      }
    }
  }, [isOpen, editingPayment])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      alert('Informe um valor de pagamento maior que zero.')
      return
    }

    await onSubmit(paymentAmount, paymentDate, paymentNote.trim())
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
      <CurrencyInput
        label="Valor pago"
        value={paymentAmount}
        onChange={(_e, val) => setPaymentAmount(val)}
        required
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
