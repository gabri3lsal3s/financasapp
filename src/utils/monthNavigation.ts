export type MonthShiftDirection = 'forward' | 'backward' | 'none'

/** YYYY-MM (ou "live"): compara competências para animação de navegação temporal. */
export function getMonthShiftDirection(from: string, to: string): MonthShiftDirection {
  if (from === to || from === 'live' || to === 'live') return 'none'
  if (from.length !== 7 || to.length !== 7) return 'none'
  return to > from ? 'forward' : 'backward'
}

export function monthShiftAnimationClass(direction: MonthShiftDirection): string {
  if (direction === 'forward') return 'animate-month-shift-forward'
  if (direction === 'backward') return 'animate-month-shift-backward'
  return 'animate-month-shift-neutral'
}

export function monthLabelAnimationClass(direction: MonthShiftDirection): string {
  if (direction === 'forward') return 'animate-month-label-forward'
  if (direction === 'backward') return 'animate-month-label-backward'
  return ''
}
