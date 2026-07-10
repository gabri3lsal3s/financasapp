import { useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'

export default function CategoryBreakdownSummary() {
  const { expenseByCategory } = useDashboardBudget()

  if (!expenseByCategory || expenseByCategory.length === 0) {
    return <span className="text-xs text-secondary">Sem gastos</span>
  }

  const total = expenseByCategory.reduce((s, item) => s + item.value, 0)

  return (
    <div className="flex items-center text-right">
      <span className="text-[10px] sm:text-xs font-bold text-primary font-mono">
        {formatCurrency(total)}
      </span>
    </div>
  )
}
