import React, { useEffect, useState } from 'react'
import { format, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ConfirmModal from '@/components/ConfirmModal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { Expense, Category, CreditCard } from '@/types'
import {
  APP_START_DATE,
  formatMoneyInput,
  parseMoneyInput,
  roundToDecimals,
} from '@/utils/format'

interface ExpenseFormModalProps {
  isOpen: boolean
  onClose: () => void
  editingExpense: Expense | null
  categories: Category[]
  creditCards: CreditCard[]
  onCreate: (
    expense: Omit<Expense, 'id' | 'created_at' | 'category'>
  ) => Promise<{ data: Expense | null; error: string | null }>
  onUpdate: (
    id: string,
    updates: Partial<Expense>
  ) => Promise<{ data: Expense | null; error: string | null }>
  onDelete: (id: string) => Promise<{ error: string | null }>
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
}: ExpenseFormModalProps) {
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
      } else {
        setFormData({
          amount: '',
          report_amount: '',
          date: format(new Date(), 'yyyy-MM-dd'),
          installment_total: '1',
          payment_method: 'other',
          credit_card_id: '',
          category_id: categories[0]?.id || '',
          description: '',
          bill_competence: '',
        })
      }
    }
  }, [isOpen, editingExpense, categories])

  const handleAmountChange = (nextAmount: string) => {
    setFormData((prev) => {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

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

    if (editingExpense) {
      const { error } = await onUpdate(editingExpense.id, expenseData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao atualizar despesa: ' + error)
      }
    } else {
      const { error } = await onCreate(expenseData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao criar despesa: ' + error)
      }
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
          submitDisabled={!formData.category_id}
          deleteLabel={editingExpense ? 'Excluir despesa' : undefined}
          onDelete={editingExpense ? handleDeleteFromModal : undefined}
        />
      )}
    >
        <Input
          label="Valor"
          type="text"
          inputMode="decimal"
          value={formData.amount}
          onChange={(e) => handleAmountChange(e.target.value)}
          onBlur={() => {
            const parsed = parseMoneyInput(formData.amount)
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
          value={formData.report_amount}
          onChange={(e) =>
            setFormData({ ...formData, report_amount: e.target.value })
          }
          onBlur={() => {
            if (!formData.report_amount) return
            const parsed = parseMoneyInput(formData.report_amount)
            if (!Number.isNaN(parsed) && parsed >= 0) {
              setFormData({
                ...formData,
                report_amount: formatMoneyInput(parsed),
              })
            }
          }}
          placeholder="Se vazio, usa o valor total"
        />

        <Input
          label="Data"
          type="date"
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          min={APP_START_DATE}
          required
        />

        <Select
          label="Forma de pagamento"
          value={formData.payment_method}
          onChange={(e) =>
            setFormData({
              ...formData,
              payment_method: e.target.value,
              credit_card_id: e.target.value === 'credit_card' ? formData.credit_card_id : '',
            })
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
                setFormData({ ...formData, credit_card_id: e.target.value })
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
                    setFormData({ ...formData, bill_competence: e.target.value })
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
              setFormData({ ...formData, installment_total: e.target.value })
            }
            placeholder="1"
          />
        )}

        <Select
          label="Categoria"
          value={formData.category_id}
          onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
          options={categories.map((cat) => ({
            value: cat.id,
            label: cat.name,
          }))}
          required
        />

        <Input
          label="Descrição (opcional)"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          placeholder="Ex: Almoço, Uber..."
        />

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
      onConfirm={() => void confirmDeleteExpense()}
    >
      <p className="text-sm text-primary">Tem certeza que deseja excluir esta despesa?</p>
    </ConfirmModal>
    </>
  )
}
