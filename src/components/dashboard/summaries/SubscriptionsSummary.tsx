import { useDashboardInsightsContext } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'

export default function SubscriptionsSummary() {
  const { insights } = useDashboardInsightsContext()
  const visible = insights.recurringExpenses.filter((s) => !s.isIgnored)

  if (visible.length === 0) {
    return <span className="text-xs text-secondary">Nenhuma</span>
  }

  const totalMonthly = visible.reduce((s, item) => s + item.monthlyAmount, 0)

  return (
    <div className="flex items-center gap-2 text-right">
      <span className="text-xs text-balance bg-balance/10 px-1.5 py-0.5 rounded-md font-bold">
        {visible.length}
      </span>
      <span className="text-xs font-bold text-primary font-mono">
        {formatCurrency(totalMonthly)}
        <span className="text-[10px] font-normal text-secondary/60">/mês</span>
      </span>
    </div>
  )
}
