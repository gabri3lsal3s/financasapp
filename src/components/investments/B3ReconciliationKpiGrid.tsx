interface KpiItem {
  label: string
  value: number
  hint: string
  tone: 'ok' | 'warn' | 'error' | 'muted'
}

interface B3ReconciliationKpiGridProps {
  items: KpiItem[]
}

const toneStyles: Record<KpiItem['tone'], { text: string; bg: string; border: string; glow: string }> = {
  ok: {
    text: 'text-income',
    bg: 'bg-income/5',
    border: 'border-income/20 hover:border-income/40',
    glow: 'group-hover:shadow-income/5',
  },
  warn: {
    text: 'text-warning',
    bg: 'bg-warning/5',
    border: 'border-warning/20 hover:border-warning/40',
    glow: 'group-hover:shadow-warning/5',
  },
  error: {
    text: 'text-expense',
    bg: 'bg-expense/5',
    border: 'border-expense/20 hover:border-expense/40',
    glow: 'group-hover:shadow-expense/5',
  },
  muted: {
    text: 'text-balance',
    bg: 'bg-balance/5',
    border: 'border-balance/20 hover:border-balance/40',
    glow: 'group-hover:shadow-balance/5',
  },
}

const staggerDelayClasses = [
  'delay-50',
  'delay-100',
  'delay-150',
  'delay-200',
]

export default function B3ReconciliationKpiGrid({ items }: B3ReconciliationKpiGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((item, index) => {
        const styles = toneStyles[item.tone]
        const delayClass = staggerDelayClasses[index % 4]
        return (
          <div
            key={item.label}
            className={`rounded-2xl border ${styles.border} ${styles.bg} px-4 py-3.5 text-left backdrop-blur-md transition-all duration-300 hover-lift-subtle hover:shadow-lg ${styles.glow} group animate-stagger-item ${delayClass}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-secondary/70">
                {item.label}
              </p>
              <span className={`w-1.5 h-1.5 rounded-full ${styles.text.replace('text-', 'bg-')} animate-pulse`} />
            </div>
            
            <p className={`text-2xl font-mono font-black tracking-tight tabular-nums mt-1 transition-all duration-300 group-hover:scale-105 origin-left ${styles.text}`}>
              {item.value}
            </p>
            
            <p className="text-[10px] text-secondary/80 mt-1 leading-snug font-medium">
              {item.hint}
            </p>
          </div>
        )
      })}
    </div>
  )
}

