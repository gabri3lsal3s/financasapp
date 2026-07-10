import { useMemo } from 'react'
import { useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'

export default function CategoryBreakdownSummary() {
  const { expenseByCategory } = useDashboardBudget()

  const top3 = useMemo(() => {
    if (!expenseByCategory || expenseByCategory.length === 0) return null
    return expenseByCategory.slice(0, 3)
  }, [expenseByCategory])

  const total = useMemo(() => {
    if (!expenseByCategory) return 0
    return expenseByCategory.reduce((s, item) => s + item.value, 0)
  }, [expenseByCategory])

  if (!top3) {
    return <span className="text-xs text-secondary">Sem gastos</span>
  }

  return (
    <div className="flex items-center gap-2 text-right">
      {top3.map((item) => (
        <span key={item.name} className="text-xs text-secondary truncate max-w-[100px] hidden sm:inline">
          {item.name}
        </span>
      ))}
      <span className="text-xs font-bold text-primary font-mono">
        {formatCurrency(total)}
      </span>
    </div>
  )
}
