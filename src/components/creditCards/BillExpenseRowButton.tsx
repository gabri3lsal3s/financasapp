import RowButton from '@/components/RowButton'
import { Check } from 'lucide-react'
import InfoTooltip from '@/components/InfoTooltip'
import type { BillExpenseItem } from '@/utils/creditCardBilling'
import { formatCurrency, formatDate, roundToDecimals } from '@/utils/format'

interface BillExpenseRowButtonProps {
  item: BillExpenseItem
  onOpen: (item: BillExpenseItem) => void
}

export default function BillExpenseRowButton({
  item,
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
    <RowButton onClick={() => onOpen(item)}>
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
            {formatCurrency(baseAmount)}
          </p>
          {hasDifference && (
            <p className="text-[9px] sm:text-[10px] text-secondary flex items-center gap-1 justify-end">
              <span>Relatório: {formatCurrency(weightedAmount)}</span>
              <InfoTooltip
                content="Valor que esta despesa representa nos relatórios mensais. Pode ser diferente do valor real quando o lançamento tem impacto parcial (ex: conta dividida com outra pessoa)."
                iconSize={10}
              />
            </p>
          )}
        </div>
      </div>
    </RowButton>
  )
}
