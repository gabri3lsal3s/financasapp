import { useMemo } from 'react'
import { formatCurrency, formatMonth } from '@/utils/format'
import Modal from '@/components/Modal'
import CategoryDetailMiniChart from '@/components/reports/CategoryDetailMiniChart'
import TransactionRow from '@/components/TransactionRow'
import type { Expense } from '@/types'
import type { ColorPalette } from '@/utils/categoryColors'

interface CategoryDetailExpense {
  id: string
  description: string
  date: string
  amount: number
}

interface CategoryDetailData {
  currentItems: Expense[]
  currentTotal: number
  previousTotal: number
}

interface LimitDetailData {
  limitAmount: number
  currentTotal: number
  exceededAmount: number
  remainingAmount: number
  isExceeded: boolean
}

interface DashboardCategoryDetailModalProps {
  isOpen: boolean
  onClose: () => void
  category: { id: string; name: string } | null
  details: CategoryDetailData | null
  limitDetails: LimitDetailData | null
  miniChartItems: CategoryDetailExpense[]
  currentMonth: string
  previousMonth: string
  expenses: Expense[]
  expenseAmountForDashboard: (amount: number, reportWeight?: number | null) => number
  colorPalette: ColorPalette
  getCategoryColorForPalette: (color: string, palette: ColorPalette) => string
}

export default function DashboardCategoryDetailModal({
  isOpen,
  onClose,
  category,
  details,
  limitDetails,
  miniChartItems,
  currentMonth,
  previousMonth,
  expenses,
  expenseAmountForDashboard,
  colorPalette,
  getCategoryColorForPalette,
}: DashboardCategoryDetailModalProps) {
  const categoryColor = useMemo(() => {
    if (!category) return 'var(--color-primary)'
    const found = expenses.find(
      (e) => (e.category?.id || e.category_id || '') === category.id
    )
    return getCategoryColorForPalette(
      found?.category?.color || 'var(--color-primary)',
      colorPalette
    )
  }, [category, expenses, colorPalette, getCategoryColorForPalette])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? `Detalhamento: ${category.name}` : 'Detalhamento'}
      size="lg"
    >
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação mensal</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-xl border border-glass surface-glass p-3">
              <p className="text-xs text-secondary">Total em {formatMonth(currentMonth)}</p>
              <p className="text-lg font-semibold text-primary">{formatCurrency(details?.currentTotal ?? 0)}</p>
            </div>
            <div className="rounded-xl border border-glass surface-glass p-3">
              <p className="text-xs text-secondary">Total em {formatMonth(previousMonth)}</p>
              <p className="text-lg font-semibold text-primary">{formatCurrency(details?.previousTotal ?? 0)}</p>
            </div>
          </div>
        </div>

        {limitDetails && (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do mês</p>
            <div className="rounded-xl border border-glass surface-glass p-3">
              <p className="text-sm text-primary">Limite: {formatCurrency(limitDetails.limitAmount)}</p>
              <p className="text-sm text-primary">Gasto: {formatCurrency(limitDetails.currentTotal)}</p>
              <p className={`text-sm font-medium ${limitDetails.isExceeded ? 'text-expense' : 'text-income'}`}>
                {limitDetails.isExceeded
                  ? `Excesso: ${formatCurrency(limitDetails.exceededAmount)}`
                  : `Restante: ${formatCurrency(limitDetails.remainingAmount)}`}
              </p>
            </div>
          </div>
        )}

        {category && (
          <CategoryDetailMiniChart
            detailItems={miniChartItems}
            period="month"
            selectedMonth={currentMonth}
            selectedYear={new Date(currentMonth).getFullYear()}
            color={categoryColor}
          />
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do mês</p>

        {details && details.currentItems.length > 0 ? (
          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {details.currentItems.map((item) => {
              const reportAmount = expenseAmountForDashboard(item.amount, item.report_weight)
              return (
                <TransactionRow
                  key={item.id}
                  description={item.description || item.category?.name || 'Despesa'}
                  date={item.date}
                  amount={reportAmount}
                  originalAmount={item.amount}
                />
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-secondary">Sem lançamentos dessa categoria no mês selecionado.</p>
        )}
      </div>
    </Modal>
  )
}
