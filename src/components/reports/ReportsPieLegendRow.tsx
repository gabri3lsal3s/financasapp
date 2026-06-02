import Button from '@/components/Button'
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
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        if (item.categoryId && item.detailType) {
          onOpen(item)
        }
      }}
      className="w-full h-auto flex items-center justify-between gap-3 text-sm p-2.5"
      disabled={!item.categoryId || !item.detailType}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
        <span className="text-primary truncate">{item.name}</span>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-primary font-semibold">{formatCurrency(item.value)}</p>
        <p className="text-xs text-secondary">{pct}%</p>
      </div>
    </Button>
  )
}
