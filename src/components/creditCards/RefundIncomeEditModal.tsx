import { useEffect, useState } from 'react'
import Input from '@/components/Input'
import Select from '@/components/Select'
import CurrencyInput from '@/components/CurrencyInput'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import {
  APP_START_DATE,
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
    amount: number
    report_amount: number
    date: string
    income_category_id: string
    description: string
  } | null
  incomeCategories: { id: string; name: string }[]
  loading: boolean
}

type RefundIncomeFormState = {
  amount: number
  report_amount: number
  date: string
  income_category_id: string
  description: string
}

const DEFAULT_FORM = (): RefundIncomeFormState => ({
  amount: 0,
  report_amount: 0,
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

  const handleAmountChange = (nextAmount: number) => {
    setForm((prev) => {
      const shouldSyncReportAmount =
        prev.report_amount === 0 ||
        Math.abs(prev.report_amount - prev.amount) < 0.009

      return {
        ...prev,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : prev.report_amount,
      }
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const amountBase = form.amount
    if (Number.isNaN(amountBase) || amountBase <= 0) {
      alert('Informe o valor base do estorno.')
      return
    }

    const reportAmount = form.report_amount || amountBase

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
      <CurrencyInput
        label="Valor"
        value={form.amount}
        onChange={(_e, val) => handleAmountChange(val)}
        required
      />

      <CurrencyInput
        label="Valor no relatório (opcional)"
        value={form.report_amount}
        onChange={(_e, val) =>
          setForm((prev) => ({ ...prev, report_amount: val }))
        }
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
