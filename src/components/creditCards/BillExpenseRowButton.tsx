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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between w-full">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-primary truncate">
              {item.description || (isRefund ? 'Estorno' : item.category_name || 'Despesa')}
            </p>
            {item.competence_source === 'manual' && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-[9px] text-primary font-medium flex items-center gap-0.5" title="Definido manualmente">
                <Check size={8} /> Fatura fixa
              </span>
            )}
          </div>
          <p className="text-xs text-secondary mt-0.5">
            {formatDate(item.date)}
            {installmentLabel ? ` • ${installmentLabel}` : ''}
            {isRefund ? ' • Estorno' : ''}
          </p>
        </div>

        <div className="flex flex-col gap-1.5 sm:items-end">
          <p className={`text-sm font-semibold ${baseAmount < 0 ? 'text-income' : 'text-primary'}`}>
            {formatCurrency(item.amount)}
          </p>
          {hasDifference && (
            <p className="text-xs text-secondary">
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
