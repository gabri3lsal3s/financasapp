import { APP_START_MONTH, formatMonth, getCurrentMonthString, addMonths, clampMonthToAppStart } from '@/utils/format'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface MonthSelectorProps {
  value: string
  onChange: (month: string) => void
  isOnline?: boolean
  className?: string
}

export default function MonthSelector({ value, onChange, isOnline = true, className = '' }: MonthSelectorProps) {
  const normalizedValue = clampMonthToAppStart(value)
  const currentMonth = getCurrentMonthString()
  const isCurrentMonth = normalizedValue === currentMonth
  const isAtMinimumMonth = normalizedValue <= APP_START_MONTH

  const prevMonth = addMonths(normalizedValue, -1)
  const nextMonth = addMonths(normalizedValue, 1)

  // Desafio offline: restringir navegação a [Atual-1, Atual, Atual+1]
  const isWithinOfflineWindow = (month: string) => {
    const diff = (new Date(month + '-01').getTime() - new Date(currentMonth + '-01').getTime()) / (1000 * 60 * 60 * 24 * 30)
    return Math.abs(Math.round(diff)) <= 1
  }

  const canNavigatePrev = isOnline ? !isAtMinimumMonth : (!isAtMinimumMonth && isWithinOfflineWindow(prevMonth))
  const canNavigateNext = isOnline ? true : isWithinOfflineWindow(nextMonth)
  const canReturnToCurrent = isOnline ? !isCurrentMonth : (isWithinOfflineWindow(currentMonth) && !isCurrentMonth)

  const navButtonClasses = 'p-2 rounded-full border border-primary text-secondary motion-standard hover-lift-subtle press-subtle hover:text-primary hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'
  const textButtonClasses = 'text-xs text-secondary mt-1 motion-standard hover-lift-subtle press-subtle hover:text-primary hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] rounded-md px-2 py-0.5'

  return (
    <div className={`flex items-center justify-between mb-4 ${className}`.trim()}>
      <div className="w-10 h-10 flex items-center justify-center">
        {canNavigatePrev && (
          <button
            type="button"
            onClick={() => onChange(prevMonth)}
            className={`${navButtonClasses} animate-scale-fade-in`}
            aria-label="Mês anterior"
          >
            <ChevronLeft size={20} className="text-accent-primary" />
          </button>
        )}
      </div>

      <div className="flex flex-col items-center">
        <h2 className="text-lg font-semibold text-primary">{formatMonth(normalizedValue)}</h2>
        <div className="h-6 flex items-center justify-center">
          {canReturnToCurrent && (
            <button
              type="button"
              onClick={() => onChange(currentMonth)}
              className={`${textButtonClasses} animate-scale-fade-in`}
            >
              Voltar ao mês atual
            </button>
          )}
        </div>
      </div>

      <div className="w-10 h-10 flex items-center justify-center">
        {canNavigateNext && (
          <button
            type="button"
            onClick={() => onChange(nextMonth)}
            className={`${navButtonClasses} animate-scale-fade-in`}
            aria-label="Próximo mês"
          >
            <ChevronRight size={20} className="text-accent-primary" />
          </button>
        )}
      </div>
    </div>
  )
}
