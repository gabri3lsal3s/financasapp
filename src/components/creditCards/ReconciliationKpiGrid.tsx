import { cn } from '@/lib/utils'

interface KpiItem {
  label: string
  value: number
  tone: 'income' | 'expense' | 'warning'
}

interface ReconciliationKpiGridProps {
  items: KpiItem[]
}

const toneStyles = {
  income: {
    text: 'text-income',
    bg: 'bg-income/5',
    border: 'border-income/20 hover:border-income/40',
    glow: 'group-hover:shadow-income/5',
  },
  warning: {
    text: 'text-warning',
    bg: 'bg-warning/5',
    border: 'border-warning/20 hover:border-warning/40',
    glow: 'group-hover:shadow-warning/5',
  },
  expense: {
    text: 'text-expense',
    bg: 'bg-expense/5',
    border: 'border-expense/20 hover:border-expense/40',
    glow: 'group-hover:shadow-expense/5',
  },
}

export default function ReconciliationKpiGrid({ items }: ReconciliationKpiGridProps) {
  return (
    <div className="grid grid-cols-3 gap-3 max-w-md mx-auto pt-2">
      {items.map((item) => {
        const styles = toneStyles[item.tone]
        return (
          <div
            key={item.label}
            className={cn(
              'modal-panel-glass p-3 rounded-xl text-left border transition-all duration-300 hover:shadow-md group',
              styles.border,
              styles.bg,
              styles.glow
            )}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-secondary font-bold uppercase tracking-wider">
                {item.label}
              </p>
              <span className={cn('w-1.5 h-1.5 rounded-full animate-pulse', styles.bg.replace('bg-', 'bg-').split(' ')[0].replace('/5', ''))} />
            </div>
            <p className={cn('text-lg font-bold mt-1 transition-all duration-300 group-hover:scale-105 origin-left', styles.text)}>
              {item.value}
            </p>
          </div>
        )
      })}
    </div>
  )
}
