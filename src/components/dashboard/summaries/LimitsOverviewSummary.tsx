import { useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { cn } from '@/lib/utils'

export default function LimitsOverviewSummary() {
  const { totalLimits, limitUsedPercentage, categoriesAttentionList } = useDashboardBudget()
  const limitsExceededCount = categoriesAttentionList?.filter((item) => item.isExceeded).length ?? 0
  const effectiveLimit = totalLimits > 0

  if (!effectiveLimit) {
    return <span className="text-xs text-secondary">Sem limites</span>
  }

  return (
    <div className="flex items-center gap-3 text-right">
      {limitsExceededCount > 0 && (
        <span className="text-xs font-bold text-expense bg-expense/10 px-2 py-0.5 rounded-full">
          {limitsExceededCount} excedido{limitsExceededCount > 1 ? 's' : ''}
        </span>
      )}
      <span className={cn(
        'text-xs font-bold font-mono',
        limitUsedPercentage >= 85 ? 'text-expense' : limitUsedPercentage >= 70 ? 'text-warning' : 'text-income',
      )}>
        {formatNumberWithTwoDecimalsBR(limitUsedPercentage)}%
      </span>
    </div>
  )
}
