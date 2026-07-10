import { useDashboardFinances } from '@/contexts/DashboardDataContext'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { cn } from '@/lib/utils'

export default function HealthSummary() {
  const { balance, savingsRate, totalIncomes } = useDashboardFinances()
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
        {totalIncomes > 0 && (
          <span className={cn(
            'text-[10px] sm:text-xs font-bold font-mono',
            isPositive ? 'text-income/70' : 'text-expense/70',
          )}>
            {formatNumberWithTwoDecimalsBR(savingsRate)}%
          </span>
        )}
      </div>
      <span className={cn(
        'text-[9px] sm:text-xs font-bold px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap',
        isPositive
          ? 'text-income bg-income/10'
          : 'text-expense bg-expense/10',
      )}>
        {isPositive
          ? savingsRate >= 20 ? 'Excelente' : savingsRate >= 10 ? 'Saudável' : 'Ok'
          : 'Negativo'}
      </span>
    </div>
  )
}
