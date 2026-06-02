import { useEffect, useState } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { useExpenses } from '@/hooks/useExpenses'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Expense } from '@/types'
import { clampMonthToAppStart, getCurrentMonthString } from '@/utils/format'
import { getCategoryColorForPalette, assignUniquePaletteColors } from '@/utils/categoryColors'
import { resolveExpenseBillCompetence } from '@/utils/creditCardBilling'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import TransactionCard from '@/components/TransactionCard'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'

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
    return `${baseLabel}: ${expense.credit_card.name} `
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
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string, isDefaultExpanded: boolean) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !(prev[id] !== undefined ? prev[id] : isDefaultExpanded),
    }))
  }
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses(currentMonth)
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { colorPalette } = usePaletteColors()
  
  const assignedCategories = assignUniquePaletteColors(categories, colorPalette)
  const categoryColorMap: Record<string, string> = {}
  categories.forEach((c, i) => {
    if (c && c.id) {
      categoryColorMap[c.id] = assignedCategories[i] || getCategoryColorForPalette(c.color, colorPalette)
    }
  })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()

  useEffect(() => {
    const isReady = !loading && !categoriesLoading && !incomeCategoriesLoading
    if (isReady && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [loading, categoriesLoading, incomeCategoriesLoading, categories.length, incomeCategories.length, navigate])

  useEffect(() => {
    const month = searchParams.get('month')
    if (month && month.length === 7) {
      setCurrentMonth(month)
    }
  }, [searchParams])

  const handleMonthChange = (month: string) => {
    if (month === currentMonth) return
    setCurrentMonth(month)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('month', month)
      return next
    })
  }

  const swipeHandlers = useSwipeMonth(currentMonth, handleMonthChange)

  const handleOpenModal = (expense?: Expense) => {
    setEditingExpense(expense || null)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingExpense(null)
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
      setIsModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, categories, currentMonth])

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

  const getCardDateAndCompetence = (expense: Expense) => {
    const competence =
      expense.bill_competence ??
      resolveExpenseBillCompetence(
        {
          date: expense.date,
          bill_competence: expense.bill_competence,
          credit_card_id: expense.credit_card_id ?? '',
        },
        (cardId) => {
          const card = creditCards.find((c) => c.id === cardId)
          return card?.closing_day
        },
      ) ??
      expense.date.substring(0, 7)
    
    const isSameMonth = !competence || competence === expense.date.substring(0, 7)
    const [, m, d] = expense.date.split('-')

    if (isSameMonth) {
      return {
        dateLabel: `${d}/${m}`,
        billCompetenceLabel: undefined
      }
    }

    const monthMap: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    }
    const m_comp = competence.split('-')[1]
    const monthName = monthMap[m_comp] || competence

    return {
      dateLabel: `${d}/${m}`,
      billCompetenceLabel: `Fatura de ${monthName}`
    }
  }

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <PageHeader
        title={PAGE_HEADERS.expenses.title}
        subtitle={PAGE_HEADERS.expenses.description}
        action={
          <PageHeaderActions>
            <PageHeaderActionButton
              intent="expense"
              icon={Plus}
              label="Adicionar"
              onClick={() => handleOpenModal()}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 animate-page-enter space-y-4 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />
        <div
          key={currentMonth}
          className="animate-month-change"
        >
          {loading && expenses.length === 0 ? (
            <Loader text="Carregando despesas..." className="py-12" />
          ) : expenses.length === 0 ? (
            <Card className="text-center py-10 space-y-3">
              <p className="text-secondary">Nenhuma despesa no mês selecionado.</p>
              <div className="flex justify-center">
                <Button 
                  onClick={() => handleOpenModal()}
                  className="bg-expense border-expense hover:bg-expense/90 text-white font-bold"
                >
                  Adicionar despesa
                </Button>
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              {installmentExpenses.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-secondary">Parceladas</p>
                  <div className="flex flex-wrap gap-3 lg:gap-4">
                    {installmentExpenses.map((expense, index) => {
                      const category = categories.find((c) => c.id === expense.category_id)
                      const categoryColor = category?.color
                        ? getCategoryColorForPalette(category.color, colorPalette)
                        : (expense.category?.id
                          ? (categoryColorMap[expense.category.id] || getCategoryColorForPalette(expense.category.color, colorPalette))
                          : 'var(--color-expense)')
                      const paymentLabel = getPaymentMethodLabel(expense)
                      const { dateLabel, billCompetenceLabel } = getCardDateAndCompetence(expense)
                      const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
                      const staggerClass = index < 5 ? staggerClasses[index] : ''

                      const isDefaultExpanded = false
                      const isExpanded = expandedIds[expense.id] !== undefined ? expandedIds[expense.id] : isDefaultExpanded

                      return (
                        <TransactionCard
                          key={expense.id}
                          title={expense.description || expense.category?.name || 'Despesa'}
                          subtitle={expense.category?.name || 'Sem categoria'}
                          amount={getWeightedReportAmount(expense.amount, expense.report_weight)}
                          originalAmount={expense.amount}
                          dateLabel={dateLabel}
                          categoryColor={categoryColor}
                          isOffline={expense.id.startsWith('offline-')}
                          onClick={() => handleOpenModal(expense)}
                          staggerClass={staggerClass}
                          installmentInfo={`${expense.installment_number || 1}/${expense.installment_total}`}
                          paymentLabel={paymentLabel}
                          paymentColor={getPaymentMethodColor(expense)}
                          billCompetenceLabel={billCompetenceLabel}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleExpand(expense.id, isDefaultExpanded)}
                          onEdit={() => handleOpenModal(expense)}
                          onDelete={async () => {
                            if (window.confirm('Deseja realmente excluir esta despesa?')) {
                              await deleteExpense(expense.id)
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}

              {monthExpenses.length > 0 && (
                <div className="space-y-3">
                  {installmentExpenses.length > 0 && (
                    <p className="text-xs font-medium uppercase tracking-wide text-secondary">Despesas do mês</p>
                  )}
                  <div className="flex flex-wrap gap-3 lg:gap-4">
                    {monthExpenses.map((expense, index) => {
                      const category = categories.find((c) => c.id === expense.category_id)
                      const categoryColor = category?.color
                        ? getCategoryColorForPalette(category.color, colorPalette)
                        : (expense.category?.id
                          ? (categoryColorMap[expense.category.id] || getCategoryColorForPalette(expense.category.color, colorPalette))
                          : 'var(--color-expense)')
                      const paymentLabel = getPaymentMethodLabel(expense)
                      const { dateLabel, billCompetenceLabel } = getCardDateAndCompetence(expense)
                      const staggerClasses = ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250']
                      const staggerClass = index < 5 ? staggerClasses[index] : ''

                      const isDefaultExpanded = false
                      const isExpanded = expandedIds[expense.id] !== undefined ? expandedIds[expense.id] : isDefaultExpanded

                      return (
                        <TransactionCard
                          key={expense.id}
                          title={expense.description || expense.category?.name || 'Despesa'}
                          subtitle={expense.category?.name || 'Sem categoria'}
                          amount={getWeightedReportAmount(expense.amount, expense.report_weight)}
                          originalAmount={expense.amount}
                          dateLabel={dateLabel}
                          categoryColor={categoryColor}
                          isOffline={expense.id.startsWith('offline-')}
                          onClick={() => handleOpenModal(expense)}
                          staggerClass={staggerClass}
                          paymentLabel={paymentLabel}
                          paymentColor={getPaymentMethodColor(expense)}
                          billCompetenceLabel={billCompetenceLabel}
                          isExpanded={isExpanded}
                          onToggleExpand={() => toggleExpand(expense.id, isDefaultExpanded)}
                          onEdit={() => handleOpenModal(expense)}
                          onDelete={async () => {
                            if (window.confirm('Deseja realmente excluir esta despesa?')) {
                              await deleteExpense(expense.id)
                            }
                          }}
                        />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <ExpenseFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        editingExpense={editingExpense}
        categories={categories}
        creditCards={creditCards}
        onCreate={createExpense}
        onUpdate={updateExpense}
        onDelete={deleteExpense}
      />
    </div>
  )
}
