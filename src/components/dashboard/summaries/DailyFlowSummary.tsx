import { useMemo } from 'react'
import { useDashboardFinances } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'

export default function DailyFlowSummary() {
  const { dailyFlowData } = useDashboardFinances()

  const totals = useMemo(() => {
    if (!dailyFlowData || dailyFlowData.length === 0) {
      return { Rendas: 0, Despesas: 0, Investimentos: 0 }
    }
    return dailyFlowData.reduce(
      (acc, day) => ({
        Rendas: acc.Rendas + day.Rendas,
        Despesas: acc.Despesas + day.Despesas,
        Investimentos: acc.Investimentos + day.Investimentos,
      }),
      { Rendas: 0, Despesas: 0, Investimentos: 0 },
    )
  }, [dailyFlowData])

  return (
    <div className="flex items-center gap-1.5 sm:gap-3 text-right">
      <span className="text-[10px] sm:text-xs font-bold text-income font-mono">
        {formatCurrency(totals.Rendas)}
      </span>
      <span className="text-[10px] sm:text-xs font-bold text-expense font-mono">
        {formatCurrency(totals.Despesas)}
      </span>
      <span className="text-[10px] sm:text-xs font-bold text-balance font-mono hidden sm:inline">
        {formatCurrency(totals.Investimentos)}
      </span>
    </div>
  )
}
