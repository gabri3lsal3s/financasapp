import { useDashboardFinances } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'

export default function HealthSummary() {
  const { balance } = useDashboardFinances()
  const isPositive = balance >= 0

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="text-right">
        <p className={cn(
          'text-xs sm:text-sm font-extrabold font-mono leading-none',
          isPositive ? 'text-income' : 'text-expense',
        )}>
          {formatCurrency(balance)}
        </p>

      </div>

    </div>
  )
}
