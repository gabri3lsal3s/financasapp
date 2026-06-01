interface KpiItem {
  label: string
  value: number
  hint: string
  tone: 'ok' | 'warn' | 'error' | 'muted'
}

interface B3ReconciliationKpiGridProps {
  items: KpiItem[]
}

const toneClass: Record<KpiItem['tone'], string> = {
  ok: 'text-emerald-500',
  warn: 'text-amber-500',
  error: 'text-red-500',
  muted: 'text-secondary',
}

export default function B3ReconciliationKpiGrid({ items }: B3ReconciliationKpiGridProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-border/40 bg-card/60 px-3 py-2.5 text-left"
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-secondary">{item.label}</p>
          <p className={`text-xl font-mono font-black tabular-nums mt-0.5 ${toneClass[item.tone]}`}>
            {item.value}
          </p>
          <p className="text-[9px] text-secondary/80 mt-0.5 leading-snug">{item.hint}</p>
        </div>
      ))}
    </div>
  )
}
