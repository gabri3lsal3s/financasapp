import { formatCurrency, formatNumberBR } from '@/utils/format'

export interface ReportsPieLegendItem {
  name: string
  value: number
  color: string
  categoryId?: string
  detailType?: 'expense' | 'income' | 'payment_method' | 'credit_card'
  detailPeriod?: 'month' | 'year'
}

interface ReportsPieLegendRowProps {
  item: ReportsPieLegendItem
  total: number
  onOpen: (item: ReportsPieLegendItem) => void
}

export default function ReportsPieLegendRow({ item, total, onOpen }: ReportsPieLegendRowProps) {
  const pct =
    total > 0
      ? formatNumberBR((item.value / total) * 100, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
      : formatNumberBR(0, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

  return (
    <button
      type="button"
      onClick={() => {
        if (item.categoryId && item.detailType) {
          onOpen(item)
        }
      }}
      className="w-full flex items-center justify-between gap-3 text-sm py-2 px-2.5 rounded-xl border border-transparent hover:border-glass hover:bg-glass-strong transition-all duration-200 group text-left focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]/20"
      disabled={!item.categoryId || !item.detailType}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span 
          className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-110" 
          style={{ 
            backgroundColor: item.color,
            boxShadow: `0 0 6px ${item.color}40`
          }} 
        />
        <span className="text-primary font-medium truncate group-hover:text-primary-strong transition-colors">{item.name}</span>
      </div>
      <div className="text-right flex-shrink-0 flex items-center gap-2.5">
        <span className="text-primary font-bold font-mono text-xs">{formatCurrency(item.value)}</span>
        <span className="text-[10px] font-bold text-secondary font-mono bg-muted/40 dark:bg-white/10 px-1.5 py-0.5 rounded-md">{pct}%</span>
      </div>
    </button>
  )
}
