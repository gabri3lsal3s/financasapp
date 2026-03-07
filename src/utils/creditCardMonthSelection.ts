const MONTH_REGEX = /^\d{4}-\d{2}$/

export const shiftMonth = (month: string, delta: number): string => {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(year, (monthNumber || 1) - 1, 1)
  date.setMonth(date.getMonth() + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export const hasExplicitCreditCardsDeepLink = (
  searchParams: URLSearchParams,
  currentMonth: string,
): boolean => {
  if (searchParams.get('card')) return true

  const month = searchParams.get('month')
  if (!month || !MONTH_REGEX.test(month)) return false

  return month !== currentMonth
}

type ResolveInitialMonthOptions = {
  currentMonth: string
  appStartMonth: string
  hasPendingForMonth: (month: string) => Promise<boolean>
}

export const resolveInitialCreditCardsMonth = async ({
  currentMonth,
  appStartMonth,
  hasPendingForMonth,
}: ResolveInitialMonthOptions): Promise<string> => {
  if (await hasPendingForMonth(currentMonth)) {
    return currentMonth
  }

  let pendingPastMonth = shiftMonth(currentMonth, -1)
  while (pendingPastMonth >= appStartMonth) {
    if (await hasPendingForMonth(pendingPastMonth)) {
      return pendingPastMonth
    }

    pendingPastMonth = shiftMonth(pendingPastMonth, -1)
  }

  const nextMonth = shiftMonth(currentMonth, 1)
  if (await hasPendingForMonth(nextMonth)) {
    return nextMonth
  }

  return currentMonth
}
