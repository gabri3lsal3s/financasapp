import { APP_START_MONTH, formatMonth, getCurrentMonthString, addMonths, clampMonthToAppStart } from '@/utils/format'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import IconButton from '@/components/IconButton'
import Button from '@/components/Button'

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

  return (
    <div className={`mb-4 flex items-center justify-between ${className}`.trim()}>
      <div className="flex h-10 w-10 items-center justify-center">
        {canNavigatePrev ? (
          <IconButton
            size="sm"
            icon={<ChevronLeft size={18} className="text-primary" />}
            label="Mês anterior"
            onClick={() => onChange(prevMonth)}
          />
        ) : null}
      </div>

      <div className="flex flex-col items-center">
        <p className="text-base font-semibold text-primary sm:text-lg">{formatMonth(normalizedValue)}</p>
        <div className="flex h-8 items-center justify-center">
          {canReturnToCurrent ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(currentMonth)}
              className="h-auto px-2 py-0.5 text-xs text-secondary"
            >
              Voltar ao mês atual
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex h-10 w-10 items-center justify-center">
        {canNavigateNext ? (
          <IconButton
            size="sm"
            icon={<ChevronRight size={18} className="text-primary" />}
            label="Próximo mês"
            onClick={() => onChange(nextMonth)}
          />
        ) : null}
      </div>
    </div>
  )
}
