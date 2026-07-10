import { useMemo } from 'react'
import { useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { useOpenCategoryDetail } from '@/components/dashboard/DashboardWidgetGrid'

export default function CategoryBreakdownDetail() {
  const { expenseByCategory } = useDashboardBudget()
  const openCategoryDetail = useOpenCategoryDetail()

  const total = useMemo(() => {
    if (!expenseByCategory) return 0
    return expenseByCategory.reduce((s, item) => s + item.value, 0)
  }, [expenseByCategory])

  if (!expenseByCategory || expenseByCategory.length === 0) {
    return <p className="text-[10px] text-secondary text-center py-4">Nenhum gasto registrado neste mês.</p>
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="w-full h-4 bg-secondary/15 rounded-full overflow-hidden flex border border-glass">
        {expenseByCategory.slice(0, 8).map((item) => {
          const widthPercent = total > 0 ? (item.value / total) * 100 : 0
          if (widthPercent < 1) return null
          return (
            <div
              key={item.name}
              style={{ width: `${widthPercent}%`, backgroundColor: item.color }}
              className="h-full transition-all duration-500"
              title={`${item.name}: ${formatCurrency(item.value)}`}
            />
          )
        })}
      </div>

      {/* Lista */}
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {expenseByCategory.map((item) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0
          return (
            <button
              key={item.name}
              type="button"
              onClick={() => openCategoryDetail?.({
                categoryId: item.categoryId,
                categoryName: item.name,
                color: item.color,
                type: 'expense',
              })}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/10 transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/30"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="flex items-center gap-1 text-[10px] text-primary truncate">
                  {getCategoryIcon(item.name, 12, item.iconName)}
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[9px] text-secondary/60 w-8 text-right font-mono">{formatNumberWithTwoDecimalsBR(pct)}%</span>
                <span className="text-[10px] font-bold text-primary font-mono w-20 text-right">{formatCurrency(item.value)}</span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Total */}
      <div className="flex items-center justify-between border-t border-glass/30 pt-2 px-1">
        <span className="text-[10px] font-bold text-secondary">Total</span>
        <span className="text-sm font-extrabold text-primary font-mono">{formatCurrency(total)}</span>
      </div>
    </div>
  )
}
