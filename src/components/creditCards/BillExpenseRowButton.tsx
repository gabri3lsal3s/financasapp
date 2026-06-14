import Button from '@/components/Button'
import { Check } from 'lucide-react'
import type { BillExpenseItem } from '@/utils/creditCardBilling'
import { formatCurrency, formatDate, roundToDecimals } from '@/utils/format'

interface BillExpenseRowButtonProps {
  item: BillExpenseItem
  creditCardsWeightsEnabled: boolean
  onOpen: (item: BillExpenseItem) => void
}

export default function BillExpenseRowButton({
  item,
  creditCardsWeightsEnabled,
  onOpen,
}: BillExpenseRowButtonProps) {
  const isRefund = item.amount < 0
  const installmentLabel =
    Number(item.installment_total || 1) > 1
      ? `Parcela ${item.installment_number || 1}/${item.installment_total}`
      : ''

  const baseAmount = Number(item.base_amount ?? item.amount ?? 0)
  const weightedAmount = roundToDecimals(baseAmount * Number(item.report_weight ?? 1), 2)
  const hasDifference = Math.abs(weightedAmount - baseAmount) > 0.009

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => onOpen(item)}
      className="w-full h-auto text-left flex-col items-stretch p-2.5"
    >
      <div className="flex items-start justify-between gap-3 w-full">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs sm:text-sm font-semibold text-primary truncate">
              {item.description || (isRefund ? 'Estorno' : item.category_name || 'Despesa')}
            </p>
            {item.competence_source === 'manual' && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-[8px] sm:text-[9px] text-primary font-medium flex items-center gap-0.5 shrink-0" title="Definido manualmente">
                <Check size={8} /> Fatura fixa
              </span>
            )}
          </div>
          <p className="text-[10px] sm:text-xs text-secondary mt-0.5">
            {formatDate(item.date)}
            {installmentLabel ? ` • ${installmentLabel}` : ''}
            {isRefund ? ' • Estorno' : ''}
          </p>
        </div>

        <div className="flex flex-col items-end shrink-0 text-right">
          <p className={`text-xs sm:text-sm font-bold ${baseAmount < 0 ? 'text-income' : 'text-primary'} font-mono`}>
            {formatCurrency(item.amount)}
          </p>
          {hasDifference && (
            <p className="text-[9px] sm:text-xs text-secondary">
              {creditCardsWeightsEnabled
                ? `Sem pesos: ${formatCurrency(baseAmount)}`
                : `Com pesos: ${formatCurrency(weightedAmount)}`}
            </p>
          )}
        </div>
      </div>
    </Button>
  )
}
