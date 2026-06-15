import { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Select from '@/components/Select'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import {
  APP_START_DATE,
  formatMoneyInput,
  parseMoneyInput,
} from '@/utils/format'

interface RefundIncomeEditModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: {
    amount: number
    reportAmount: number
    date: string
    incomeCategoryId: string
    description: string
  }) => Promise<void>
  onDelete: () => Promise<void>
  initialData: {
    amount: string
    report_amount: string
    date: string
    income_category_id: string
    description: string
  } | null
  incomeCategories: { id: string; name: string }[]
  loading: boolean
}

type RefundIncomeFormState = {
  amount: string
  report_amount: string
  date: string
  income_category_id: string
  description: string
}

const DEFAULT_FORM = (): RefundIncomeFormState => ({
  amount: '',
  report_amount: '',
  date: '',
  income_category_id: '',
  description: '',
})

export default function RefundIncomeEditModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialData,
  incomeCategories,
  loading,
}: RefundIncomeEditModalProps) {
  const [form, setForm] = useState<RefundIncomeFormState>(DEFAULT_FORM())

  useEffect(() => {
    if (isOpen && initialData) {
      setForm({
        amount: initialData.amount,
        report_amount: initialData.report_amount,
        date: initialData.date,
        income_category_id: initialData.income_category_id,
        description: initialData.description,
      })
    }
  }, [isOpen, initialData])

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
      alert('Informe o valor base do estorno.')
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
      alert('O valor no relatório deve estar entre 0 e o valor do estorno.')
      return
    }

    await onSubmit({
      amount: amountBase,
      reportAmount,
      date: form.date,
      incomeCategoryId: form.income_category_id,
      description: form.description.trim(),
    })
  }

  return (
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title="Editar estorno (renda)"
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel="Salvar alterações"
          submitDisabled={loading}
          deleteLabel="Excluir estorno"
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
        label="Categoria de Renda"
        value={form.income_category_id}
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            income_category_id: event.target.value,
          }))
        }
        options={incomeCategories.map((category) => ({
          value: category.id,
          label: category.name,
        }))}
        required
      />

      <Input
        label="Descrição (opcional)"
        value={form.description}
        onChange={(event) =>
          setForm((prev) => ({ ...prev, description: event.target.value }))
        }
        placeholder="Ex: Estorno compra loja X"
      />
    </ModalForm>
  )
}
