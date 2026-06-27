import React, { useEffect, useState } from 'react'
import { format, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ConfirmModal from '@/components/ConfirmModal'
import TransactionAmountFields from '@/components/TransactionAmountFields'
import TransactionDateField from '@/components/TransactionDateField'
import TransactionCategorySelect from '@/components/TransactionCategorySelect'
import TransactionDescriptionField from '@/components/TransactionDescriptionField'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Checkbox from '@/components/Checkbox'
import { useDebts } from '@/hooks/useDebts'
import { Expense, Category, CreditCard } from '@/types'
import {
  formatMoneyInput,
  parseMoneyInput,
  roundToDecimals,
} from '@/utils/format'
import { splitAmountIntoInstallments } from '@/utils/creditCardBilling'

interface ExpenseFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingExpense: Expense | null
  categories: Category[]
  creditCards: CreditCard[]
  onCreate: (
    expense: Omit<Expense, 'id' | 'created_at' | 'category'>
  ) => Promise<{ data: Expense | null; error: string | null; insertedExpenses?: Expense[] }>
  onUpdate: (
    id: string,
    updates: Partial<Expense>
  ) => Promise<{ data: Expense | null; error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
  defaultValues?: {
    amount?: number
    description?: string
    date?: string
  }
}

export default function ExpenseFormModal({
  isOpen,
  onClose,
  editingExpense,
  categories,
  creditCards,
  onCreate,
  onUpdate,
  onDelete,
  defaultValues,
}: ExpenseFormModalProps) {
  const { createDebt } = useDebts()
  const [formData, setFormData] = useState({
    amount: '',
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    installment_total: '1',
    payment_method: 'other',
    credit_card_id: '',
    category_id: '',
    description: '',
    bill_competence: '',
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [createLinkedDebt, setCreateLinkedDebt] = useState(false)
  const [linkedDebtAmount, setLinkedDebtAmount] = useState('')
  const [isDebtAmountEdited, setIsDebtAmountEdited] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleExpenseAmountChanged = (nextAmount: string) => {
    if (!isDebtAmountEdited) {
      setLinkedDebtAmount(nextAmount)
    }
  }

  useEffect(() => {
    if (isOpen) {
      if (editingExpense) {
        setFormData({
          amount: formatMoneyInput(editingExpense.amount),
          report_amount: formatMoneyInput(
            editingExpense.amount * (editingExpense.report_weight ?? 1)
          ),
          date: editingExpense.date,
          installment_total: String(editingExpense.installment_total || 1),
          payment_method: editingExpense.payment_method || 'other',
          credit_card_id: editingExpense.credit_card_id || '',
          category_id: editingExpense.category_id,
          description: editingExpense.description || '',
          bill_competence: editingExpense.bill_competence || '',
        })
        setCreateLinkedDebt(false)
        setLinkedDebtAmount('')
        setIsDebtAmountEdited(false)
      } else {
        setFormData({
          amount: defaultValues?.amount ? formatMoneyInput(defaultValues.amount) : '',
          report_amount: defaultValues?.amount ? formatMoneyInput(defaultValues.amount) : '',
          date: defaultValues?.date || format(new Date(), 'yyyy-MM-dd'),
          installment_total: '1',
          payment_method: 'other',
          credit_card_id: '',
          category_id: categories[0]?.id || '',
          description: defaultValues?.description || '',
          bill_competence: '',
        })
        setCreateLinkedDebt(false)
        setLinkedDebtAmount(defaultValues?.amount ? formatMoneyInput(defaultValues.amount) : '')
        setIsDebtAmountEdited(false)
      }
    }
  }, [isOpen, editingExpense, categories, defaultValues])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (saving) return
    if (!formData.amount || !formData.category_id) return

    const amount = parseMoneyInput(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = formData.report_amount
      ? parseMoneyInput(formData.report_amount)
      : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da despesa')
      return
    }

    const reportWeight =
      amount > 0 ? roundToDecimals(reportAmount / amount, 4) : 1
    const installmentTotal = Math.max(
      1,
      Math.min(60, Number(formData.installment_total || '1'))
    )

    if (!Number.isInteger(installmentTotal) || installmentTotal < 1) {
      alert('Informe um número válido de parcelas (mínimo 1).')
      return
    }

    if (formData.payment_method === 'credit_card' && !formData.credit_card_id) {
      alert('Selecione um cartão de crédito para compras no crédito.')
      return
    }

    let parsedDebtAmount = amount
    if (createLinkedDebt) {
      if (!linkedDebtAmount) {
        alert('Por favor, informe o valor da cobrança.')
        return
      }
      const parsedVal = parseMoneyInput(linkedDebtAmount)
      if (isNaN(parsedVal) || parsedVal <= 0) {
        alert('Por favor, insira um valor de cobrança válido maior que zero.')
        return
      }
      if (parsedVal > amount) {
        alert('O valor da cobrança não pode ser maior que o valor da despesa.')
        return
      }
      parsedDebtAmount = parsedVal
    }

    const expenseData: Omit<Expense, 'id' | 'created_at' | 'category'> = {
      amount,
      report_weight: reportWeight,
      date: formData.date,
      installment_total: installmentTotal,
      payment_method: formData.payment_method as Expense['payment_method'],
      credit_card_id:
        formData.payment_method === 'credit_card' ? formData.credit_card_id : null,
      category_id: formData.category_id,
      bill_competence: formData.bill_competence || null,
      ...(formData.description && { description: formData.description }),
    }

    setSaving(true)
    try {
      if (editingExpense) {
        const { error } = await onUpdate(editingExpense.id, expenseData)
        if (!error) {
          onClose()
        } else {
          alert('Erro ao atualizar despesa: ' + error)
        }
      } else {
        const { data, error, insertedExpenses } = await onCreate(expenseData)
        if (!error) {
          if (createLinkedDebt) {
            const categoryName = categories.find((c) => c.id === expenseData.category_id)?.name || 'Categoria'
            const expensesToLink = insertedExpenses && insertedExpenses.length > 0 ? insertedExpenses : (data ? [data] : [])

            const debtInstallments = installmentTotal > 1
              ? splitAmountIntoInstallments(parsedDebtAmount, installmentTotal)
              : [parsedDebtAmount]

            for (let i = 0; i < expensesToLink.length; i++) {
              const exp = expensesToLink[i]
              const debtAmount = debtInstallments[i] ?? exp.amount
              const installmentSuffix = exp.installment_total && exp.installment_total > 1
                ? ` (${exp.installment_number}/${exp.installment_total})`
                : ''
              const name = (expenseData.description || `Cobrança - ${categoryName}`) + installmentSuffix
              await createDebt({
                name,
                type: 'receivable',
                amount: debtAmount,
                due_date: exp.date,
                description: expenseData.description
                  ? `Cobrança integrada à despesa: ${expenseData.description}${installmentSuffix}`
                  : `Cobrança vinculada à despesa de ${categoryName}${installmentSuffix}`,
                status: 'pending',
                expense_id: exp.id && !exp.id.startsWith('offline-') ? exp.id : null,
              })
            }
          }
          onClose()
        } else {
          alert('Erro ao criar despesa: ' + error)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFromModal = () => {
    if (!editingExpense) return
    setShowDeleteConfirm(true)
  }

  const confirmDeleteExpense = async () => {
    if (!editingExpense) return

    const { error } = await onDelete(editingExpense.id)
    if (error) {
      alert('Erro ao excluir despesa: ' + error)
      return
    }

    setShowDeleteConfirm(false)
    onClose()
  }

  return (
    <>
    <ModalForm
      isOpen={isOpen}
      onClose={onClose}
      title={editingExpense ? 'Editar despesa' : 'Adicionar despesa'}
      onSubmit={handleSubmit}
      footer={(formId) => (
        <ModalFooter
          formId={formId}
          onCancel={onClose}
          submitLabel={editingExpense ? 'Salvar alterações' : 'Salvar'}
          submitDisabled={!formData.category_id || saving}
          deleteLabel={editingExpense ? 'Excluir despesa' : undefined}
          onDelete={editingExpense ? handleDeleteFromModal : undefined}
          loading={saving}
        />
      )}
    >
      <TransactionAmountFields
        amount={formData.amount}
        reportAmount={formData.report_amount}
        onSetAmounts={(next) =>
          setFormData((prev) => ({ ...prev, ...next }))
        }
        onAmountChanged={handleExpenseAmountChanged}
        onReportAmountBlur={(formatted) =>
          setFormData((prev) => ({ ...prev, report_amount: formatted }))
        }
      />

      <TransactionDateField
        value={formData.date}
        onChange={(val) => setFormData((prev) => ({ ...prev, date: val }))}
      />

      <Select
        label="Forma de pagamento"
        value={formData.payment_method}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            payment_method: e.target.value,
            credit_card_id: e.target.value === 'credit_card' ? prev.credit_card_id : '',
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

      {formData.payment_method === 'credit_card' && (
        <>
          <Select
            label="Cartão"
            value={formData.credit_card_id}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, credit_card_id: e.target.value }))
            }
            options={[
              { value: '', label: 'Selecionar cartão' },
              ...creditCards
                .filter(
                  (card) =>
                    card.is_active !== false || card.id === formData.credit_card_id
                )
                .map((card) => ({ value: card.id, label: card.name })),
            ]}
            required
          />

          {formData.credit_card_id && (
            <div className="space-y-2">
              <Select
                label="Fatura (opcional)"
                value={formData.bill_competence}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, bill_competence: e.target.value }))
                }
                options={[
                  { value: '', label: 'Cálculo automático' },
                  ...(() => {
                    const baseDate = formData.date
                      ? new Date(formData.date + 'T12:00:00')
                      : null
                    const options = []

                    if (baseDate && !isNaN(baseDate.getTime())) {
                      for (let i = -1; i <= 1; i++) {
                        const d = addMonths(baseDate, i)
                        const competence = format(d, 'yyyy-MM')
                        const monthName = format(d, 'MMMM', { locale: ptBR })
                        const label = `${
                          monthName.charAt(0).toUpperCase() + monthName.slice(1)
                        } (${format(d, 'MM')})`
                        options.push({ value: competence, label })
                      }
                    }
                    return options
                  })(),
                ]}
              />
            </div>
          )}
        </>
      )}

      {!editingExpense && (
        <Input
          label="Parcelas"
          type="number"
          min="1"
          max="60"
          value={formData.installment_total}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, installment_total: e.target.value }))
          }
          placeholder="1"
        />
      )}

      <TransactionCategorySelect
        value={formData.category_id}
        onChange={(val) => setFormData((prev) => ({ ...prev, category_id: val }))}
        options={categories.map((cat) => ({
          value: cat.id,
          label: cat.name,
        }))}
      />

      <TransactionDescriptionField
        value={formData.description}
        onChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}
        placeholder="Ex: Almoço, Uber..."
      />

      {!editingExpense && (
        <div className="pt-2 pb-2">
          <Checkbox
            label="Cadastrar cobrança?"
            description="Cria uma cobrança a receber vinculada a esta despesa"
            checked={createLinkedDebt}
            onChange={(e) => setCreateLinkedDebt(e.target.checked)}
          />
        </div>
      )}

      {!editingExpense && createLinkedDebt && (
        <div className="animate-surface-enter w-full pb-2">
          <Input
            label="Valor da cobrança (R$)"
            type="text"
            inputMode="decimal"
            value={linkedDebtAmount}
            onChange={(e) => {
              setLinkedDebtAmount(e.target.value)
              setIsDebtAmountEdited(true)
            }}
            onBlur={() => {
              const parsed = parseMoneyInput(linkedDebtAmount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                setLinkedDebtAmount(formatMoneyInput(parsed))
              }
            }}
            placeholder="0,00"
            required
          />
        </div>
      )}

      {editingExpense && Number(editingExpense.installment_total || 1) > 1 && (
        <p className="modal-intro modal-panel-glass p-3">
          Esta despesa pertence ao parcelamento{' '}
          {editingExpense.installment_number || 1}/{editingExpense.installment_total}.
          A edição afeta apenas esta parcela.
        </p>
      )}

    </ModalForm>

    <ConfirmModal
      isOpen={showDeleteConfirm}
      onClose={() => setShowDeleteConfirm(false)}
      title="Excluir despesa"
      confirmLabel="Excluir despesa"
      confirmVariant="danger"
      requireCheckbox={true}
      checkboxLabel="Estou ciente de que esta despesa será excluída permanentemente."
      onConfirm={() => void confirmDeleteExpense()}
    >
      <p className="text-sm text-primary">Tem certeza que deseja excluir esta despesa?</p>
    </ConfirmModal>
    </>
  )
}
