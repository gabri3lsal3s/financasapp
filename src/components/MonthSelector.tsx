import { formatMonth, getCurrentMonthString, addMonths } from '@/utils/format'
import { ArrowLeft, ArrowRight } from 'lucide-react'

interface MonthSelectorProps {
  value: string
  onChange: (month: string) => void
  className?: string
}

export default function MonthSelector({ value, onChange, className = '' }: MonthSelectorProps) {
  const currentMonth = getCurrentMonthString()
  const isCurrentMonth = value === currentMonth
  const navButtonClasses = 'p-2 rounded-full motion-standard hover-lift-subtle press-subtle hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'
  const textButtonClasses = 'text-xs text-accent-primary mt-1 motion-standard hover-lift-subtle press-subtle hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] rounded-md px-1'

  return (
    <div className={`flex items-center justify-between mb-4 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, -1))}
        className={navButtonClasses}
        aria-label="Mês anterior"
      >
        <ArrowLeft size={20} className="text-accent-primary" />
      </button>
      <div className="flex flex-col items-center">
        <h2 className="text-lg font-semibold text-primary">{formatMonth(value)}</h2>
        {!isCurrentMonth && (
          <button
            type="button"
            onClick={() => onChange(currentMonth)}
            className={textButtonClasses}
          >
            Voltar ao mês atual
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, 1))}
        className={navButtonClasses}
        aria-label="Próximo mês"
      >
        <ArrowRight size={20} className="text-accent-primary" />
      </button>
    </div>
  )
}
