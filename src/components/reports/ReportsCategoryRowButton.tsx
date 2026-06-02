import Button from '@/components/Button'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'

interface ReportsCategoryRowButtonProps {
  categoryId: string
  categoryName: string
  total: number
  color: string
  totalBase: number
  staggerClass?: string
  onOpen: (categoryId: string, categoryName: string) => void
}

export default function ReportsCategoryRowButton({
  categoryId,
  categoryName,
  total,
  color,
  totalBase,
  staggerClass = '',
  onOpen,
}: ReportsCategoryRowButtonProps) {
  const pct = totalBase > 0 ? (total / totalBase) * 100 : 0

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => onOpen(categoryId, categoryName)}
      className={`w-full h-auto text-left flex-col items-stretch p-2.5 animate-stagger-item ${staggerClass}`}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
          <span className="text-primary truncate">{categoryName}</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-primary font-semibold flex-shrink-0">
          {formatCurrency(total)}
        </span>
      </div>

      <div className="w-full h-1.5 rounded-full bg-secondary mt-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>

      <p className="text-[11px] text-secondary mt-1.5 w-full">{formatNumberWithTwoDecimalsBR(pct)}% do total</p>
    </Button>
  )
}
