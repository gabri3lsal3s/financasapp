import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ModalActionFooter from '@/components/ModalActionFooter'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useExpenses } from '@/hooks/useExpenses'
import { useCategories } from '@/hooks/useCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Expense } from '@/types'
import { APP_START_DATE, clampMonthToAppStart, formatCurrency, formatDate, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import MonthSelector from '@/components/MonthSelector'
import CategoryBadge from '@/components/CategoryBadge'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'

const PAYMENT_METHOD_LABELS: Record<NonNullable<Expense['payment_method']>, string> = {
  other: 'Outros',
  cash: 'Dinheiro',
  debit: 'Débito',
  credit_card: 'Cartão',
  pix: 'PIX',
  transfer: 'Transferência',
}

const PAYMENT_METHOD_COLORS: Record<NonNullable<Expense['payment_method']>, string> = {
  other: 'var(--color-text-secondary)',
  cash: 'var(--color-text-secondary)',
  debit: 'var(--color-primary)',
  credit_card: 'var(--color-balance)',
  pix: 'var(--color-income)',
  transfer: 'var(--color-expense)',
}

const getPaymentMethodLabel = (expense: Expense) => {
  const method = expense.payment_method || 'other'
  const baseLabel = PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.other

  if (method === 'credit_card' && expense.credit_card?.name) {
    return `${baseLabel}: ${expense.credit_card.name}`
  }

  return baseLabel
}

const getPaymentMethodColor = (expense: Expense) => {
  const method = expense.payment_method || 'other'

  if (method === 'credit_card' && expense.credit_card?.color) {
    return expense.credit_card.color
  }

  return PAYMENT_METHOD_COLORS[method] || PAYMENT_METHOD_COLORS.other
}

export default function Expenses() {
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses(currentMonth)
  const { categories } = useCategories()
  const { creditCards } = useCreditCards()
  const { colorPalette } = usePaletteColors()
  const assignedCategories = assignUniquePaletteColors(categories, colorPalette)
  const categoryColorMap: Record<string, string> = {}
  categories.forEach((c, i) => {
    if (c && c.id) categoryColorMap[c.id] = assignedCategories[i] || getCategoryColorForPalette(c.color, colorPalette)
  })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    installment_total: '1',
    payment_method: 'other',
    credit_card_id: '',
    category_id: '',
    description: '',
  })
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()

  useEffect(() => {
    const month = searchParams.get('month')
    if (month && month.length === 7) {
      setCurrentMonth(month)
    }
  }, [searchParams])

  const handleMonthChange = (month: string) => {
    setCurrentMonth(month)
    setSearchParams({ month })
  }

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

  const handleOpenModal = (expense?: Expense) => {
    if (expense) {
      setEditingExpense(expense)
      setFormData({
        amount: formatMoneyInput(expense.amount),
        report_amount: formatMoneyInput(expense.amount * (expense.report_weight ?? 1)),
        date: expense.date,
        installment_total: String(expense.installment_total || 1),
        payment_method: expense.payment_method || 'other',
        credit_card_id: expense.credit_card_id || '',
        category_id: expense.category_id,
        description: expense.description || '',
      })
    } else {
      setEditingExpense(null)
      setFormData({
        amount: '',
        report_amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        installment_total: '1',
        payment_method: 'other',
        credit_card_id: '',
        category_id: categories[0]?.id || '',
        description: '',
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
    setFormData({
      amount: '',
      report_amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      installment_total: '1',
      payment_method: 'other',
      credit_card_id: '',
      category_id: categories[0]?.id || '',
      description: '',
    })
  }

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    const monthParam = searchParams.get('month')
    const isValidMonth = monthParam ? /^\d{4}-\d{2}$/.test(monthParam) : false

    if (isValidMonth && monthParam) {
      const clampedMonth = clampMonthToAppStart(monthParam)
      if (clampedMonth !== currentMonth) {
        setCurrentMonth(clampedMonth)
      }
    }

    if (quickAdd === '1') {
      setEditingExpense(null)
      setFormData({
        amount: '',
        report_amount: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        installment_total: '1',
        payment_method: 'other',
        credit_card_id: '',
        category_id: categories[0]?.id || '',
        description: '',
      })
      setIsModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, categories, currentMonth])


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.amount || !formData.category_id) return

    const amount = parseMoneyInput(formData.amount)
    if (isNaN(amount) || amount <= 0) {
      alert('Por favor, insira um valor válido maior que zero')
      return
    }

    const reportAmount = formData.report_amount ? parseMoneyInput(formData.report_amount) : amount
    if (isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount) {
      alert('O valor no relatório deve estar entre 0 e o valor da despesa')
      return
    }

    const reportWeight = amount > 0 ? Number((reportAmount / amount).toFixed(4)) : 1
    const installmentTotal = Math.max(1, Math.min(60, Number(formData.installment_total || '1')))

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
      credit_card_id: formData.payment_method === 'credit_card' ? formData.credit_card_id : null,
      category_id: formData.category_id,
      ...(formData.description && { description: formData.description }),
    }

    if (editingExpense) {
      const { error } = await updateExpense(editingExpense.id, expenseData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao atualizar despesa: ' + error)
      }
    } else {
      const { error } = await createExpense(expenseData)
      if (!error) {
        handleCloseModal()
      } else {
        alert('Erro ao criar despesa: ' + error)
      }
    }
  }

  const handleDeleteFromModal = async () => {
    if (!editingExpense) return
    if (!confirm('Tem certeza que deseja excluir esta despesa?')) return

    const { error } = await deleteExpense(editingExpense.id)
    if (error) {
      alert('Erro ao excluir despesa: ' + error)
      return
    }

    handleCloseModal()
  }

  const sortExpensesByDateDesc = (a: Expense, b: Expense) => {
    const dateDiff = b.date.localeCompare(a.date)
    if (dateDiff !== 0) return dateDiff
    return b.created_at.localeCompare(a.created_at)
  }

  const installmentExpenses = expenses
    .filter((expense) => Number(expense.installment_total || 1) > 1)
    .sort(sortExpensesByDateDesc)

  const monthExpenses = expenses
    .filter((expense) => Number(expense.installment_total || 1) <= 1)
    .sort(sortExpensesByDateDesc)

  const renderExpenseCard = (expense: Expense) => (
    <Card key={expense.id} className="py-3" onClick={() => handleOpenModal(expense)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="w-1 h-6 rounded-sm flex-shrink-0"
              style={{ backgroundColor: expense.category?.id ? (categoryColorMap[expense.category.id] || getCategoryColorForPalette(expense.category.color, colorPalette)) : 'var(--color-primary)' }}
            />
            <p className="font-medium text-primary truncate flex items-center gap-2">
              {expense.description || expense.category?.name || 'Despesa'}
              {expense.id.startsWith('offline-') && (
                <span title="Pendente de sincronização" className="flex-shrink-0 flex">
                  <RefreshCw size={12} className="text-accent animate-spin" />
                </span>
              )}
            </p>
          </div>
          <p className="text-sm text-secondary">
            {expense.category?.name} • {formatDate(expense.date)}
            {Number(expense.installment_total || 1) > 1 && (
              <> • Parcela {expense.installment_number || 1}/{expense.installment_total}</>
            )}
          </p>
          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
            <CategoryBadge
              label={expense.category?.name || 'Sem categoria'}
              color={expense.category?.id
                ? (categoryColorMap[expense.category.id] || getCategoryColorForPalette(expense.category.color, colorPalette))
                : 'var(--color-primary)'}
            />
            <CategoryBadge label={getPaymentMethodLabel(expense)} color={getPaymentMethodColor(expense)} />
          </div>
        </div>
        <div className="ml-2 flex-shrink-0 text-right">
          <p className="text-base sm:text-lg font-semibold text-primary">
            {formatCurrency(expense.amount)}
          </p>
          {Math.abs(expense.amount - (expense.amount * (expense.report_weight ?? 1))) > 0.009 && (
            <p className="text-xs text-secondary">
              {formatCurrency(expense.amount * (expense.report_weight ?? 1))}
            </p>
          )}
        </div>
      </div>
    </Card>
  )

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.expenses.title}
        subtitle={PAGE_HEADERS.expenses.description}
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenModal()}
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Adicionar</span>
          </Button>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />
        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : expenses.length === 0 ? (
          <Card className="text-center py-10 space-y-3">
            <p className="text-secondary">Nenhuma despesa no mês selecionado.</p>
            <div className="flex justify-center">
              <Button onClick={() => handleOpenModal()}>
                Adicionar despesa
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {installmentExpenses.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-wide text-secondary">Parceladas</p>
                {installmentExpenses.map(renderExpenseCard)}
              </div>
            )}

            {monthExpenses.length > 0 && (
              <div className="space-y-3">
                {installmentExpenses.length > 0 && (
                  <p className="text-xs uppercase tracking-wide text-secondary">Despesas do mês</p>
                )}
                {monthExpenses.map(renderExpenseCard)}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingExpense ? 'Editar despesa' : 'Adicionar despesa'}
      >
        <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-4">
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
            onChange={(e) => setFormData({ ...formData, report_amount: e.target.value })}
            onBlur={() => {
              if (!formData.report_amount) return
              const parsed = parseMoneyInput(formData.report_amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                setFormData({ ...formData, report_amount: formatMoneyInput(parsed) })
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
            onChange={(e) => setFormData({
              ...formData,
              payment_method: e.target.value,
              credit_card_id: e.target.value === 'credit_card' ? formData.credit_card_id : '',
            })}
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
            <Select
              label="Cartão"
              value={formData.credit_card_id}
              onChange={(e) => setFormData({ ...formData, credit_card_id: e.target.value })}
              options={[
                { value: '', label: 'Selecionar cartão' },
                ...creditCards
                  .filter((card) => card.is_active !== false || card.id === formData.credit_card_id)
                  .map((card) => ({ value: card.id, label: card.name })),
              ]}
              required
            />
          )}

          {!editingExpense && (
            <Input
              label="Parcelas"
              type="number"
              min="1"
              max="60"
              value={formData.installment_total}
              onChange={(e) => setFormData({ ...formData, installment_total: e.target.value })}
              placeholder="1"
            />
          )}

          {editingExpense && Number(editingExpense.installment_total || 1) > 1 && (
            <p className="text-xs text-secondary">
              Esta despesa pertence ao parcelamento {editingExpense.installment_number || 1}/{editingExpense.installment_total}. A edição afeta apenas esta parcela.
            </p>
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

          <ModalActionFooter
            onCancel={handleCloseModal}
            submitLabel={editingExpense ? 'Salvar alterações' : 'Salvar'}
            submitDisabled={!formData.category_id}
            deleteLabel={editingExpense ? 'Excluir despesa' : undefined}
            onDelete={editingExpense ? handleDeleteFromModal : undefined}
          />
        </form>
      </Modal>
    </div>
  )
}

