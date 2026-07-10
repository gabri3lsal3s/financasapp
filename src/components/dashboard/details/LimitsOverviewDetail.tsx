import { useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { cn } from '@/lib/utils'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { useOpenCategoryDetail } from '@/components/dashboard/DashboardWidgetGrid'

export default function LimitsOverviewDetail() {
  const { limitUsedPercentage, categoriesAttentionList } = useDashboardBudget()
  const openCategoryDetail = useOpenCategoryDetail()

  if (!categoriesAttentionList || categoriesAttentionList.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-[10px] text-secondary">
          Tudo dentro do orçamento! 🎉
        </p>
      </div>
    )
  }

  // Usa o maior gasto como escala para a stacked bar proporcional
  const maxValue = Math.max(
    ...categoriesAttentionList.map((item) => item.value),
    1,
  )

  return (
    <div className="space-y-3">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-secondary">
        <span>Uso do Orçamento</span>
        <span className={cn('font-mono', limitUsedPercentage >= 85 ? 'text-expense' : 'text-primary')}>
          {formatNumberWithTwoDecimalsBR(limitUsedPercentage)}%
        </span>
      </div>

      {/* Stacked bar */}
      <div className="relative w-full h-4 bg-secondary/15 rounded-full overflow-hidden flex border border-glass">
        {categoriesAttentionList.map((item) => {
          const widthPercent = (item.value / maxValue) * 100
          if (widthPercent <= 0) return null
          return (
            <div
              key={item.categoryId}
              style={{ width: `${widthPercent}%`, backgroundColor: item.color }}
              className="h-full transition-all duration-500"
              title={`${item.name}: ${formatCurrency(item.value)}`}
            />
          )
        })}
      </div>

      {/* Lista de categorias */}
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {categoriesAttentionList.map((item) => (
          <button
            key={item.categoryId}
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
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
              <span className="flex items-center gap-1 text-[10px] text-primary truncate">
                {getCategoryIcon(item.name, 12, item.iconName)}
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              <span className={cn(
                'hidden sm:inline-block text-[8px] font-bold px-1.5 py-0.5 rounded-full',
                item.isExceeded ? 'text-expense bg-expense/10' : 'text-warning bg-warning/10',
              )}>
                {item.statusLabel}
              </span>
              <span className="text-[9px] font-mono text-secondary/60 w-8 sm:w-10 text-right">{formatNumberWithTwoDecimalsBR(item.usagePercentage)}%</span>
              <span className="text-[10px] font-bold text-primary font-mono w-14 sm:w-16 text-right">{formatCurrency(item.value)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
