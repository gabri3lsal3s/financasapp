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
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    glow: 'group-hover:shadow-emerald-500/5',
  },
  warn: {
    text: 'text-amber-500',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20 hover:border-amber-500/40',
    glow: 'group-hover:shadow-amber-500/5',
  },
  error: {
    text: 'text-red-500',
    bg: 'bg-red-500/5',
    border: 'border-red-500/20 hover:border-red-500/40',
    glow: 'group-hover:shadow-red-500/5',
  },
  muted: {
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/5',
    border: 'border-indigo-500/20 hover:border-indigo-500/40',
    glow: 'group-hover:shadow-indigo-500/5',
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

