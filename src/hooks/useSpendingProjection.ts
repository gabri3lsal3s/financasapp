import { useMemo } from 'react'

export interface SpendingProjection {
  daysElapsed: number
  daysInMonth: number
  currentDay: number
  dailyBurnRate: number
  projectedEndOfMonthExpenses: number
  projectedSurplus: number
  onTrack: boolean
  mode: 'past' | 'current'
}

export function useSpendingProjection(
  currentMonth: string,
  totalExpenses: number,
  totalIncomes: number,
  totalInvestments: number,
): SpendingProjection | null {
  return useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    if (daysInMonth <= 0) return null

    // For past months: show actual results
    if (isPast) {
      return {
        daysElapsed: daysInMonth,
        daysInMonth,
        currentDay: daysInMonth,
        dailyBurnRate: daysInMonth > 0 ? totalExpenses / daysInMonth : 0,
        projectedEndOfMonthExpenses: totalExpenses,
        projectedSurplus: totalIncomes - totalInvestments - totalExpenses,
        onTrack: (totalIncomes - totalInvestments - totalExpenses) >= 0,
        mode: 'past' as const,
      }
    }

    // For future months: not applicable
    if (isFuture) return null

    // Current month: project based on pace so far
    const currentDay = today.getDate()
    if (currentDay < 3) return null

    const daysElapsed = Math.min(currentDay, daysInMonth)
    const dailyBurnRate = daysElapsed > 0 ? totalExpenses / daysElapsed : 0
    const projectedEndOfMonthExpenses = dailyBurnRate * daysInMonth
    const projectedSurplus = totalIncomes - totalInvestments - projectedEndOfMonthExpenses
    const onTrack = projectedSurplus >= 0

    return {
      daysElapsed,
      daysInMonth,
      currentDay,
      dailyBurnRate,
      projectedEndOfMonthExpenses,
      projectedSurplus,
      onTrack,
      mode: 'current' as const,
    }
  }, [currentMonth, totalExpenses, totalIncomes, totalInvestments])
}
