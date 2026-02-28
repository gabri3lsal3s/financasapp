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

  return (
    <div className={`flex items-center justify-between mb-4 ${className}`.trim()}>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, -1))}
        className="p-2 hover:bg-secondary rounded-full transition-colors active:bg-tertiary"
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
            className="text-xs text-accent-primary hover:opacity-80 mt-1"
          >
            Voltar ao mês atual
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(addMonths(value, 1))}
        className="p-2 hover:bg-secondary rounded-full transition-colors active:bg-tertiary"
        aria-label="Próximo mês"
      >
        <ArrowRight size={20} className="text-accent-primary" />
      </button>
    </div>
  )
}
