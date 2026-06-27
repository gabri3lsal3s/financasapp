import RowButton from '@/components/RowButton'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'

export interface ExpenseCategoryRowItem {
  name: string
  categoryId: string
  value: number
  color: string
  alertPriority: number
  alertStatusClass: string
  alertStatusLabel: string
}

interface ExpenseCategoryRowButtonProps {
  item: ExpenseCategoryRowItem
  totalExpenses: number
  staggerClass?: string
  onOpen: (categoryId: string, name: string) => void
}

export default function ExpenseCategoryRowButton({
  item,
  totalExpenses,
  staggerClass = '',
  onOpen,
}: ExpenseCategoryRowButtonProps) {
  const percentage = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0

  return (
    <RowButton
      onClick={() => onOpen(item.categoryId, item.name)}
      className={`p-3 md:p-4 ${staggerClass}`}
    >
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-primary truncate">{item.name}</span>
        </div>
        <div className="flex items-center justify-end gap-2.5 flex-shrink-0">
          {item.alertPriority > 0 && (
            <span className={`text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary ${item.alertStatusClass}`}>
              {item.alertStatusLabel}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-secondary">
            {formatNumberWithTwoDecimalsBR(percentage)}%
          </span>
        </div>
      </div>

      <div className="w-full h-1.5 rounded-full bg-secondary mt-3">
        <div
          className="h-1.5 rounded-full"
          style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: item.color }}
        />
      </div>

      <p className="text-xs text-secondary mt-2 text-center sm:text-left truncate w-full">
        Total: {formatCurrency(item.value)}
      </p>
    </RowButton>
  )
}
