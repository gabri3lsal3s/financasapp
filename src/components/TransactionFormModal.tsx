/**
 * TransactionFormModal — fusão DRY de ExpenseFormModal + IncomeFormModal.
 *
 * Esqueleto compartilhado (valor/report, data, descrição, report weight,
 * fluxo de exclusão e submit) + ramos específicos por tipo via união
 * discriminada (`type: 'expense' | 'income'`). Comportamento idêntico aos
 * dois modais originais — as páginas passam os mesmos handlers.
 */
import React, { useEffect, useState } from 'react'
import { format, addMonths } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/Modal'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import ConfirmModal from '@/components/ConfirmModal'
import TransactionDateField from '@/components/TransactionDateField'
import TransactionCategorySelect from '@/components/TransactionCategorySelect'
import TransactionDescriptionField from '@/components/TransactionDescriptionField'
import NumberInput from '@/components/NumberInput'
import Select from '@/components/Select'
import Checkbox from '@/components/Checkbox'
import CurrencyInput from '@/components/CurrencyInput'
import TransactionCurrencyFields from '@/components/TransactionCurrencyFields'
import Button from '@/components/Button'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useDebts } from '@/hooks/useDebts'
import type {
  Expense,
  Income,
  Category,
  IncomeCategory,
  CreditCard,
} from '@/types'
import { roundToDecimals, todayISO, formatCurrency, formatDate } from '@/utils/format'
import { splitAmountIntoInstallments } from '@/utils/creditCardBilling'
import { logger } from '@/utils/logger'

const REFUND_INCOME_CATEGORY_NAME = 'Estorno'
const LEGACY_REFUND_INCOME_CATEGORY_NAME = 'Extorno'
const REFUND_NOTE_PREFIX = '[REFUND]'

/** Arrays vazios estáveis (referências fixas para deps de hooks). */
const NO_CATEGORIES: Category[] = []
const NO_INCOME_CATEGORIES: IncomeCategory[] = []
const NO_CREDIT_CARDS: CreditCard[] = []

/* ------------------------------------------------------------------ */
/*  Props — união discriminada (expense | income)                     */
/* ------------------------------------------------------------------ */

interface TransactionFormBaseProps {
  isOpen: boolean
  onClose: () => void
  type: 'expense' | 'income'
  onDelete: (id: string) => Promise<{ error: string | null }>
}

export interface TransactionExpenseFormProps extends TransactionFormBaseProps {
  type: 'expense'
  editingExpense: Expense | null
  categories: Category[]
  creditCards: CreditCard[]
  onCreate: (
    expense: Omit<Expense, 'id' | 'created_at' | 'category'>,
  ) => Promise<{
    data: Expense | null
    error: string | null
    insertedExpenses?: Expense[]
  }>
  onUpdate: (
    id: string,
    updates: Partial<Expense>,
  ) => Promise<{ data: Expense | null; error: string | null }>
  defaultValues?: {
    amount?: number
    description?: string
    date?: string
  }
}

export interface TransactionIncomeFormProps extends TransactionFormBaseProps {
  type: 'income'
  editingIncome: Income | null
  incomeCategories: IncomeCategory[]
  onCreate: (
    income: Omit<Income, 'id' | 'created_at' | 'income_category'>,
  ) => Promise<{ data: Income | null; error: string | null }>
  onUpdate: (
    id: string,
    updates: Partial<Income>,
  ) => Promise<{ data: Income | null; error: string | null }>
}

export type TransactionFormModalProps =
  | TransactionExpenseFormProps
  | TransactionIncomeFormProps

/* ------------------------------------------------------------------ */
/*  Helpers puros                                                     */
/* ------------------------------------------------------------------ */

function isRefundIncome(income: Income, categories: IncomeCategory[]): boolean {
  const category = categories.find((c) => c.id === income.income_category_id)
  const categoryName = String(category?.name || '').trim()
  return [REFUND_INCOME_CATEGORY_NAME, LEGACY_REFUND_INCOME_CATEGORY_NAME].includes(
    categoryName,
  )
}

/* ------------------------------------------------------------------ */
/*  Componente                                                        */
/* ------------------------------------------------------------------ */

export default function TransactionFormModal(props: TransactionFormModalProps) {
  const navigate = useNavigate()
  const { createDebt } = useDebts()

  // ── Estado (todos declarados incondicionalmente — regras dos hooks) ──
  const [formData, setFormData] = useState({
    amount: 0,
    report_amount: null as number | null,
    date: todayISO(),
    description: '',
    // expense
    installment_total: '1',
    payment_method: 'other',
    credit_card_id: '',
    category_id: '',
    bill_competence: '',
    // income
    income_category_id: '',
    type: 'other',
  })
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // expense
  const [createLinkedDebt, setCreateLinkedDebt] = useState(false)
  const [linkedDebtAmount, setLinkedDebtAmount] = useState(0)
  const [isDebtAmountEdited, setIsDebtAmountEdited] = useState(false)
  // income
  const [refundOriginLoading, setRefundOriginLoading] = useState(false)
  const [refundOrigin, setRefundOrigin] = useState<{
    cardId: string
    cardName: string
    competence: string
  } | null>(null)

  const isExpense = props.type === 'expense'
  const editingExpense = isExpense ? props.editingExpense : null
  const editingIncome = isExpense ? null : props.editingIncome
  const categories = isExpense ? props.categories : NO_CATEGORIES
  const incomeCategories = isExpense ? NO_INCOME_CATEGORIES : props.incomeCategories
  const creditCards = isExpense ? props.creditCards : NO_CREDIT_CARDS
  const defaultValues = isExpense ? props.defaultValues : undefined

  const handleExpenseAmountChanged = (nextAmount: number) => {
    if (!isDebtAmountEdited) {
      setLinkedDebtAmount(nextAmount)
    }
  }

  // Sincronizar dados ao abrir
  useEffect(() => {
    if (!props.isOpen) return

    const loadRefundOrigin = async (incomeId: string) => {
      try {
        setRefundOriginLoading(true)
        setRefundOrigin(null)

        const likePattern = `${REFUND_NOTE_PREFIX}%\\"incomeId\\":\\"${String(incomeId)}\\"%`

        const { data: paymentRow, error: paymentError } = await supabase
          .from('credit_card_bill_payments')
          .select('credit_card_id, bill_competence, payment_date')
          .like('note', likePattern)
          .order('payment_date', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (paymentError || !paymentRow?.credit_card_id) {
          return
        }

        const { data: cardRow } = await supabase
          .from('credit_cards')
          .select('name')
          .eq('id', String(paymentRow.credit_card_id))
          .maybeSingle()

        setRefundOrigin({
          cardId: String(paymentRow.credit_card_id),
          cardName: String(cardRow?.name || 'Cartão'),
          competence: String(paymentRow.bill_competence || ''),
        })
      } catch (e) {
        logger.error('Erro ao buscar origem do estorno:', e)
      } finally {
        setRefundOriginLoading(false)
      }
    }

    if (props.type === 'expense') {
      if (editingExpense) {
        const rw = editingExpense.report_weight
        const initialReportAmount =
          rw !== undefined && rw !== null
            ? rw === 1
              ? null
              : roundToDecimals(editingExpense.amount * rw, 2)
            : null

        setFormData({
          amount: editingExpense.amount,
          report_amount: initialReportAmount,
          date: editingExpense.date,
          installment_total: String(editingExpense.installment_total || 1),
          payment_method: editingExpense.payment_method || 'other',
          credit_card_id: editingExpense.credit_card_id || '',
          category_id: editingExpense.category_id,
          description: editingExpense.description || '',
          bill_competence: editingExpense.bill_competence || '',
          income_category_id: '',
          type: 'other',
        })
        setCreateLinkedDebt(false)
        setLinkedDebtAmount(0)
        setIsDebtAmountEdited(false)
        setRefundOrigin(null)
        setRefundOriginLoading(false)
      } else {
        setFormData({
          amount: defaultValues?.amount ?? 0,
          report_amount: null,
          date: defaultValues?.date || todayISO(),
          installment_total: '1',
          payment_method: 'other',
          credit_card_id: '',
          category_id: categories[0]?.id || '',
          description: defaultValues?.description || '',
          bill_competence: '',
          income_category_id: '',
          type: 'other',
        })
        setCreateLinkedDebt(false)
        setLinkedDebtAmount(defaultValues?.amount ?? 0)
        setIsDebtAmountEdited(false)
        setRefundOrigin(null)
        setRefundOriginLoading(false)
      }
    } else if (props.type === 'income') {
      if (editingIncome) {
        const rw = editingIncome.report_weight
        const initialReportAmount =
          rw !== undefined && rw !== null
            ? rw === 1
              ? null
              : roundToDecimals(editingIncome.amount * rw, 2)
            : null

        setFormData({
          amount: editingIncome.amount,
          report_amount: initialReportAmount,
          date: editingIncome.date,
          income_category_id: editingIncome.income_category_id,
          description: editingIncome.description || '',
          type: editingIncome.type || 'other',
          installment_total: '1',
          payment_method: 'other',
          credit_card_id: '',
          category_id: '',
          bill_competence: '',
        })

        if (isRefundIncome(editingIncome, incomeCategories)) {
          void loadRefundOrigin(editingIncome.id)
        } else {
          setRefundOrigin(null)
          setRefundOriginLoading(false)
        }
      } else {
        setFormData({
          amount: 0,
          report_amount: null,
          date: todayISO(),
          income_category_id: incomeCategories[0]?.id || '',
          description: '',
          type: 'other',
          installment_total: '1',
          payment_method: 'other',
          credit_card_id: '',
          category_id: '',
          bill_competence: '',
        })
        setRefundOrigin(null)
        setRefundOriginLoading(false)
      }
    }
  }, [props.isOpen, props.type, editingExpense, editingIncome, categories, incomeCategories, defaultValues])

  const incomeCategoriesForManualCreation = incomeCategories.filter(
    (category) =>
      String(category.name || '')
        .trim()
        .toLowerCase() !== REFUND_INCOME_CATEGORY_NAME.toLowerCase(),
  )

  /* ── Submit ── */

  const submitExpense = async () => {
    if (props.type !== 'expense') return
    const { editingExpense: editing, categories: cats, onCreate, onUpdate, onClose } = props

    if (!formData.amount || !formData.category_id) return

    const amount = formData.amount
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount =
      formData.report_amount !== null && formData.report_amount !== undefined
        ? formData.report_amount
        : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da despesa')
      return
    }

    const reportWeight = amount > 0 ? roundToDecimals(reportAmount / amount, 4) : 1
    const installmentTotal = Math.max(1, Math.min(60, Number(formData.installment_total || '1')))

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
      if (isNaN(linkedDebtAmount) || linkedDebtAmount <= 0) {
        alert('Por favor, insira um valor de cobrança válido maior que zero.')
        return
      }
      if (linkedDebtAmount > amount) {
        alert('O valor da cobrança não pode ser maior que o valor da despesa.')
        return
      }
      parsedDebtAmount = linkedDebtAmount
    }

    const expenseData: Omit<Expense, 'id' | 'created_at' | 'category'> = {
      amount,
      report_weight: reportWeight,
      date: formData.date,
      installment_total: installmentTotal,
      payment_method: formData.payment_method as Expense['payment_method'],
      credit_card_id: formData.payment_method === 'credit_card' ? formData.credit_card_id : null,
      category_id: formData.category_id,
      bill_competence: formData.bill_competence || null,
      ...(formData.description && { description: formData.description }),
    }

    if (editing) {
      const { error } = await onUpdate(editing.id, expenseData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao atualizar despesa: ' + error)
      }
    } else {
      const { data, error, insertedExpenses } = await onCreate(expenseData)
      if (!error) {
        if (createLinkedDebt) {
          const categoryName =
            cats.find((c) => c.id === expenseData.category_id)?.name || 'Categoria'
          const expensesToLink =
            insertedExpenses && insertedExpenses.length > 0
              ? insertedExpenses
              : data
                ? [data]
                : []

          const debtInstallments =
            installmentTotal > 1
              ? splitAmountIntoInstallments(parsedDebtAmount, installmentTotal)
              : [parsedDebtAmount]

          for (let i = 0; i < expensesToLink.length; i++) {
            const exp = expensesToLink[i]
            const debtAmount = debtInstallments[i] ?? exp.amount
            const installmentSuffix =
              exp.installment_total && exp.installment_total > 1
                ? ` (${exp.installment_number}/${exp.installment_total})`
                : ''
            const name =
              (expenseData.description || `Cobrança - ${categoryName}`) + installmentSuffix
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
  }

  const submitIncome = async () => {
    if (props.type !== 'income') return
    const { editingIncome: editing, incomeCategories: cats, onCreate, onUpdate, onClose } = props

    if (editing && isRefundIncome(editing, cats)) {
      alert('Estornos devem ser editados pela tela de Cartões.')
      return
    }

    if (!formData.amount || !formData.income_category_id) {
      alert('Por favor, preencha todos os campos obrigatórios')
      return
    }

    if (!editing) {
      const selectedCategory = cats.find(
        (category) => category.id === formData.income_category_id,
      )
      const selectedCategoryName = String(selectedCategory?.name || '').trim()
      if (
        [REFUND_INCOME_CATEGORY_NAME, LEGACY_REFUND_INCOME_CATEGORY_NAME].includes(
          selectedCategoryName,
        )
      ) {
        alert('A categoria Estorno é reservada para lançamentos automáticos de estorno no cartão.')
        return
      }
    }

    const amount = formData.amount
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount =
      formData.report_amount !== null && formData.report_amount !== undefined
        ? formData.report_amount
        : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da renda')
      return
    }

    const reportWeight = amount > 0 ? roundToDecimals(reportAmount / amount, 4) : 1

    const incomeData: Omit<Income, 'id' | 'created_at' | 'income_category'> = {
      amount,
      report_weight: reportWeight,
      date: formData.date,
      income_category_id: formData.income_category_id,
      type: formData.type as Income['type'],
      ...(formData.description && { description: formData.description }),
    }

    if (editing) {
      const { error } = await onUpdate(editing.id, incomeData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao atualizar renda: ' + error)
      }
    } else {
      const { error } = await onCreate(incomeData)
      if (!error) {
        onClose()
      } else {
        alert('Erro ao criar renda: ' + error)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    try {
      if (isExpense) {
        await submitExpense()
      } else {
        await submitIncome()
      }
    } finally {
      setSaving(false)
    }
  }

  /* ── Exclusão ── */

  const handleDeleteFromModal = () => {
    if (props.type === 'expense') {
      if (props.editingExpense) setShowDeleteConfirm(true)
    } else if (props.editingIncome) {
      if (isRefundIncome(props.editingIncome, props.incomeCategories)) {
        alert('Estornos devem ser excluídos pela tela de Cartões.')
        return
      }
      setShowDeleteConfirm(true)
    }
  }

  const confirmDelete = async () => {
    if (props.type === 'expense' && props.editingExpense) {
      const { error } = await props.onDelete(props.editingExpense.id)
      if (error) {
        alert('Erro ao excluir despesa: ' + error)
        return
      }
    } else if (props.type === 'income' && props.editingIncome) {
      const { error } = await props.onDelete(props.editingIncome.id)
      if (error) {
        alert('Erro ao excluir renda: ' + error)
        return
      }
    } else {
      return
    }

    setShowDeleteConfirm(false)
    props.onClose()
  }

  const title = isExpense
    ? editingExpense
      ? 'Editar despesa'
      : 'Adicionar despesa'
    : editingIncome
      ? 'Editar renda'
      : 'Adicionar renda'

  const noun = isExpense ? 'despesa' : 'renda'

  /* ── Estorno: modal somente-visualização (income) ── */
  const showRefund =
    props.type === 'income' && !!editingIncome && isRefundIncome(editingIncome, incomeCategories)

  if (showRefund && editingIncome) {
    const income = editingIncome
    return (
      <Modal isOpen={props.isOpen} onClose={props.onClose} title="Estorno (somente visualização)">
        <div className="modal-form-stack w-full">
          <div className="modal-panel-glass space-y-2 p-3">
            <p className="text-xs text-secondary">Valor</p>
            <p className="text-base font-semibold text-primary">{formatCurrency(income.amount)}</p>
            <p className="text-xs text-secondary">Data: {formatDate(income.date)}</p>
            <p className="text-xs text-secondary">
              Categoria: {income.income_category?.name || REFUND_INCOME_CATEGORY_NAME}
            </p>
            <p className="text-xs text-secondary">
              Descrição: {income.description || 'Estorno de compra'}
            </p>
          </div>

          <div className="modal-panel-glass space-y-2 p-3">
            {refundOriginLoading ? (
              <div className="flex items-center gap-2 text-sm text-secondary">
                <Loader2 size={16} className="animate-spin" />
                <span>Carregando origem do estorno...</span>
              </div>
            ) : refundOrigin ? (
              <>
                <p className="text-sm text-primary">
                  Este estorno foi criado no cartão <strong>{refundOrigin.cardName}</strong> na
                  fatura <strong>{refundOrigin.competence}</strong>.
                </p>
                <Button
                  type="button"
                  fullWidth
                  onClick={() => {
                    navigate(
                      `/contas?month=${encodeURIComponent(refundOrigin.competence)}&card=${encodeURIComponent(refundOrigin.cardId)}`,
                    )
                    props.onClose()
                  }}
                >
                  Ir para fatura no cartão
                </Button>
              </>
            ) : (
              <p className="text-sm text-secondary">
                Não foi possível identificar a fatura/cartão de origem deste estorno.
              </p>
            )}
          </div>
        </div>
      </Modal>
    )
  }

  return (
    <>
      <ModalForm
        isOpen={props.isOpen}
        onClose={props.onClose}
        title={title}
        onSubmit={handleSubmit}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={props.onClose}
            submitLabel={isExpense ? (editingExpense ? 'Salvar alterações' : 'Salvar') : editingIncome ? 'Salvar alterações' : 'Salvar'}
            submitDisabled={isExpense ? !formData.category_id || saving : saving}
            deleteLabel={isExpense ? (editingExpense ? 'Excluir despesa' : undefined) : editingIncome ? 'Excluir renda' : undefined}
            onDelete={editingExpense || editingIncome ? handleDeleteFromModal : undefined}
            loading={saving}
          />
        )}
      >
        <TransactionCurrencyFields
          amount={formData.amount}
          reportAmount={formData.report_amount}
          onSetAmounts={(next) => setFormData((prev) => ({ ...prev, ...next }))}
          onAmountChanged={isExpense ? handleExpenseAmountChanged : undefined}
        />

        <TransactionDateField
          value={formData.date}
          onChange={(val) => setFormData((prev) => ({ ...prev, date: val }))}
        />

        {isExpense ? (
          <>
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
                        (card) => card.is_active !== false || card.id === formData.credit_card_id,
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
                              const label = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} (${format(d, 'MM')})`
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
              <NumberInput
                label="Parcelas"
                min={1}
                max={60}
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
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
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
                <CurrencyInput
                  label="Valor da cobrança"
                  value={linkedDebtAmount}
                  onChange={(_e, val) => {
                    setLinkedDebtAmount(val ?? 0)
                    setIsDebtAmountEdited(true)
                  }}
                  required
                />
              </div>
            )}

            {editingExpense && Number(editingExpense.installment_total || 1) > 1 && (
              <p className="modal-intro modal-panel-glass p-3">
                Esta despesa pertence ao parcelamento{' '}
                {editingExpense.installment_number || 1}/{editingExpense.installment_total}. A
                edição afeta apenas esta parcela.
              </p>
            )}
          </>
        ) : (
          <>
            <TransactionCategorySelect
              label="Categoria de Renda"
              value={formData.income_category_id}
              onChange={(val) => setFormData((prev) => ({ ...prev, income_category_id: val }))}
              options={(editingIncome
                ? incomeCategories
                : incomeCategoriesForManualCreation
              ).map((cat) => ({ value: cat.id, label: cat.name }))}
            />

            <Select
              label="Forma de recebimento"
              value={formData.type}
              onChange={(e) => setFormData((prev) => ({ ...prev, type: e.target.value }))}
              options={[
                { value: 'other', label: 'Outros' },
                { value: 'cash', label: 'Dinheiro' },
                { value: 'pix', label: 'PIX' },
                { value: 'transfer', label: 'Transferência' },
              ]}
            />

            {!editingIncome && (
              <p className="text-xs text-secondary">
                A categoria Estorno é criada/gerenciada automaticamente pela tela de cartões.
              </p>
            )}

            <TransactionDescriptionField
              value={formData.description}
              onChange={(val) => setFormData((prev) => ({ ...prev, description: val }))}
              placeholder="Ex: Salário mensal, Projeto X..."
            />
          </>
        )}
      </ModalForm>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Excluir ${noun}`}
        confirmLabel={`Excluir ${noun}`}
        confirmVariant="danger"
        requireCheckbox={true}
        checkboxLabel={`Estou ciente de que esta ${noun} será excluída permanentemente.`}
        onConfirm={() => void confirmDelete()}
      >
        <p className="text-sm text-primary">Tem certeza que deseja excluir esta {noun}?</p>
      </ConfirmModal>
    </>
  )
}
