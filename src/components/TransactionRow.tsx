import InfoTooltip from '@/components/InfoTooltip'
import { formatCurrency, formatDate } from '@/utils/format'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'

interface TransactionRowProps {
  description: string
  date: string
  amount: number
  originalAmount?: number
  onClick?: () => void
}

/**
 * Linha de transação reutilizável para listas e modais.
 *
 * Exibe descrição, data, valor ponderado e valor original (riscado com tooltip).
 * Substitui o padrão repetido em CategoryDetailModal, Dashboard e outros locais.
 */
export default function TransactionRow({
  description,
  date,
  amount,
  originalAmount,
  onClick,
}: TransactionRowProps) {
  const showOriginalAmount =
    originalAmount !== undefined && Math.abs(originalAmount - amount) > 0.009

  const content = (
    <div
      className="rounded-xl border border-glass surface-glass-strong p-3.5 transition-all flex items-center justify-between gap-3 hover:scale-[1.005] hover:border-glass-strong"
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      <div className="min-w-0">
        <p className="text-xs font-semibold text-primary truncate font-sans">
          {description}
        </p>
        <p className="text-[9px] font-mono text-secondary mt-1">
          {formatDate(date)}
        </p>
      </div>
      <div className="text-right flex flex-col items-end gap-0.5">
        {showOriginalAmount && (
          <p className="flex items-center gap-1">
            <span
              className="text-[9px] line-through"
              style={{ color: 'var(--ds-color-text-secondary)', opacity: 0.65 }}
            >
              {formatCurrency(originalAmount)}
            </span>
            <InfoTooltip
              content={WEIGHT_TOOLTIPS.baseValueDetail}
              iconSize={7}
            />
          </p>
        )}
        <p className="text-xs font-bold text-primary font-mono whitespace-nowrap">
          {formatCurrency(amount)}
        </p>
      </div>
    </div>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left focus:outline-none"
      >
        {content}
      </button>
    )
  }

  return content
}
