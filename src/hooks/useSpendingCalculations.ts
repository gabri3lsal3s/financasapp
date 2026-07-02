import { useMemo } from 'react'

export interface SpendingCalcs {
  mode: 'past' | 'future' | 'current'
  title: string
  monthlyAvailable: number
  dailyAvailable: number
  daysInMonth: number
  remainingDays: number
  currentDay?: number
}

export function useSpendingCalculations(
  currentMonth: string,
  totalIncomes: number,
  totalExpenses: number,
  totalInvestments: number,
): SpendingCalcs {
  return useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const currentDay = today.getDate()

    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [selYear, selMonth] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(selYear, selMonth, 0).getDate()

    const monthlyAvailable = totalIncomes - totalInvestments - totalExpenses

    if (isPast) {
      return {
        mode: 'past' as const,
        title: 'Gasto Disponível (Mês Encerrado)',
        monthlyAvailable,
        dailyAvailable: 0,
        daysInMonth,
        remainingDays: 0,
      }
    }

    if (isFuture) {
      const totalProjected = totalIncomes - totalInvestments
      const dailyAvailable = daysInMonth > 0 ? Math.max(0, totalProjected / daysInMonth) : 0
      return {
        mode: 'future' as const,
        title: 'Gasto Disponível Projetado',
        monthlyAvailable: totalProjected,
        dailyAvailable,
        daysInMonth,
        remainingDays: daysInMonth,
      }
    }

    const remainingDays = daysInMonth - currentDay + 1
    const dailyAvailable = remainingDays > 0 ? Math.max(0, monthlyAvailable / remainingDays) : 0

    return {
      mode: 'current' as const,
      title: 'Gasto Disponível',
      currentDay,
      daysInMonth,
      remainingDays,
      monthlyAvailable,
      dailyAvailable,
    }
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])
}
