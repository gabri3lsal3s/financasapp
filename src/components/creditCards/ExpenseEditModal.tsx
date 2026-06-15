import { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Select from '@/components/Select'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import type { CreditCard } from '@/types'
import {
  APP_START_DATE,
  formatMoneyInput,
  parseMoneyInput,
  roundToDecimals,
} from '@/utils/format'
import type { BillExpenseItem } from '@/utils/creditCardBilling'

interface ExpenseEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: {
    amount: number
    reportAmount: number
    date: string
    paymentMethod: string
    creditCardId: string
    categoryId: string
    description: string
  }) => Promise<void>
  onDelete: () => Promise<void>
  expenseItem: BillExpenseItem | null
  categories: { id: string; name: string }[]
  creditCards: CreditCard[]
  loading: boolean
}

type ExpenseFormState = {
  amount: string
  report_amount: string
  date: string
  installment_total: string
  payment_method: string
  credit_card_id: string
  category_id: string
  description: string
}

const DEFAULT_EXPENSE_FORM = (): ExpenseFormState => ({
  amount: '',
  report_amount: '',
  date: '',
  installment_total: '1',
  payment_method: 'other',
  credit_card_id: '',
  category_id: '',
  description: '',
})

export default function ExpenseEditModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  expenseItem,
  categories,
  creditCards,
  loading,
}: ExpenseEditModalProps) {
  const [form, setForm] = useState<ExpenseFormState>(DEFAULT_EXPENSE_FORM())

  useEffect(() => {
    if (isOpen && expenseItem) {
      setForm({
        amount: formatMoneyInput(Math.abs(expenseItem.amount)),
        report_amount:
          expenseItem.report_weight !== undefined &&
          expenseItem.report_weight !== null
            ? formatMoneyInput(
                roundToDecimals(Math.abs(expenseItem.amount) * expenseItem.report_weight, 2)
              )
            : '',
        date: expenseItem.date,
        installment_total: '1',
        payment_method: expenseItem.payment_method || 'credit_card',
        credit_card_id: expenseItem.credit_card_id || '',
        category_id: expenseItem.category_id || '',
        description: expenseItem.description || '',
      })
    }
  }, [isOpen, expenseItem])

  const handleAmountChange = (nextAmount: string) => {
    setForm((prev) => {
      const prevAmount = parseMoneyInput(prev.amount)
      const prevReportAmount = parseMoneyInput(prev.report_amount)
      const shouldSyncReportAmount =
        !prev.report_amount ||
        (!Number.isNaN(prevAmount) &&
          !Number.isNaN(prevReportAmount) &&
          Math.abs(prevReportAmount - prevAmount) < 0.009)

      return {
        ...prev,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : prev.report_amount,
      }
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const amountBase = parseMoneyInput(form.amount)
    if (Number.isNaN(amountBase) || amountBase <= 0) {
      alert('Informe o valor base da despesa.')
      return
    }

    const reportAmount = form.report_amount
      ? parseMoneyInput(form.report_amount)
      : amountBase

    if (
      Number.isNaN(reportAmount) ||
      reportAmount < 0 ||
      reportAmount > amountBase
    ) {
      alert('O valor no relatório deve estar entre 0 e o valor da despesa')
      return
    }

    if (form.payment_method === 'credit_card' && !form.credit_card_id) {
      alert('Selecione um cartão de crédito para compras no crédito.')
      return
    }

    await onSubmit({
      amount: amountBase,
      reportAmount,
      date: form.date,
      paymentMethod: form.payment_method,
      creditCardId: form.credit_card_id,
      categoryId: form.category_id,
      description: form.description.trim(),
    })
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Editar despesa"
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Salvar alterações"
          submitDisabled={!form.category_id || loading}
          deleteLabel="Excluir despesa"
          onDelete={onDelete}
        />
      )}
    >
      <Input
        label="Valor"
        type="text"
        inputMode="decimal"
        value={form.amount}
        onChange={(event) => handleAmountChange(event.target.value)}
        onBlur={() => {
          const parsed = parseMoneyInput(form.amount)
          if (!Number.isNaN(parsed) && parsed >= 0) {
            handleAmountChange(formatMoneyInput(parsed))
          }
        }}
        placeholder="0,00"
        required
      />

      <Input
        label="Valor no relatório (opcional)"
        type="text"
        inputMode="decimal"
        value={form.report_amount}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, report_amount: event.target.value }))
        }
        onBlur={() => {
          if (!form.report_amount) return
          const parsed = parseMoneyInput(form.report_amount)
          if (!Number.isNaN(parsed) && parsed >= 0) {
            setForm((prev) => ({
              ...prev,
              report_amount: formatMoneyInput(parsed),
            }))
          }
        }}
        placeholder="Se vazio, usa o valor total"
      />

      <Input
        label="Data"
        type="date"
        value={form.date}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, date: event.target.value }))
        }
        min={APP_START_DATE}
        required
      />

      <Select
        label="Forma de pagamento"
        value={form.payment_method}
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            payment_method: event.target.value,
            credit_card_id:
              event.target.value === 'credit_card' ? prev.credit_card_id : '',
          }))
        }
        options={[
          { value: 'other', label: 'Outros' },
          { value: 'cash', label: 'Dinheiro' },
          { value: 'debit', label: 'Débito' },
          { value: 'credit_card', label: 'Cartão de crédito' },
          { value: 'pix', label: 'PIX' },
          { value: 'transfer', label: 'Transferência' },
        ]}
      />

      {form.payment_method === 'credit_card' && (
        <Select
          label="Cartão"
          value={form.credit_card_id}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, credit_card_id: event.target.value }))
          }
          options={[
            { value: '', label: 'Selecionar cartão' },
            ...creditCards
              .filter(
                (card) =>
                  card.is_active !== false || card.id === form.credit_card_id
              )
              .map((card) => ({ value: card.id, label: card.name })),
          ]}
          required
        />
      )}

      {expenseItem && Number(expenseItem.installment_total || 1) > 1 && (
        <p className="modal-intro">
          Esta despesa pertence ao parcelamento{' '}
          {expenseItem.installment_number || 1}/{expenseItem.installment_total}. A
          edição afeta apenas esta parcela.
        </p>
      )}

      <Select
        label="Categoria"
        value={form.category_id}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, category_id: event.target.value }))
        }
        options={categories.map((category) => ({
          value: category.id,
          label: category.name,
        }))}
      />

      <Input
        label="Descrição (opcional)"
        value={form.description}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, description: event.target.value }))
        }
        placeholder="Ex: Almoço, Uber..."
      />
    </ModalForm>
  )
}
