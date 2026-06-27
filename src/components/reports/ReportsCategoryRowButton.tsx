import RowButton from '@/components/RowButton'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { AlertTriangle } from 'lucide-react'
import { getCategoryIcon } from '@/utils/categoryIcons'

interface ReportsCategoryRowButtonProps {
  categoryId: string
  categoryName: string
  total: number
  /** Valor original sem aplicação de peso de relatório */
  totalBase?: number
  color: string
  totalGrand: number
  staggerClass?: string
  targetAmount?: number | null
  isExpense?: boolean
  iconName?: string
  onOpen: (categoryId: string, categoryName: string) => void
}

export default function ReportsCategoryRowButton({
  categoryId,
  categoryName,
  total,
  color,
  totalGrand,
  staggerClass = '',
  targetAmount,
  isExpense = true,
  iconName,
  onOpen,
}: ReportsCategoryRowButtonProps) {
  const sharePct = totalGrand > 0 ? (total / totalGrand) * 100 : 0
  const icon = getCategoryIcon(categoryName, 14, iconName)

  // Cálculos de orçamento / meta
  const hasTarget = targetAmount !== undefined && targetAmount !== null && targetAmount > 0
  const targetPct = hasTarget ? (total / targetAmount!) * 100 : 0
  const targetExceeded = isExpense ? total > targetAmount! : false

  // Cor do indicador do orçamento
  const targetColorClass = isExpense 
    ? (targetPct > 100 ? 'text-expense font-bold' : targetPct > 80 ? 'text-warning font-semibold' : 'text-secondary')
    : (targetPct >= 100 ? 'text-income font-bold' : 'text-secondary')

  return (
    <RowButton
      onClick={() => onOpen(categoryId, categoryName)}
      animated
      className={`transition-all hover:scale-[1.005] hover:border-glass-strong surface-glass ${staggerClass}`}
    >
      {/* Linha 1: Categoria + Ícone (Esquerda) e Valor (Direita) */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2 min-w-0">
          <span 
            style={{ color: color }}
            className="flex items-center justify-center flex-shrink-0"
          >
            {icon}
          </span>
          <span className="text-xs font-semibold text-primary truncate">{categoryName}</span>
        </div>

        <span className="text-xs font-bold text-primary font-mono shrink-0 flex flex-col items-end">
          <span>{formatCurrency(total)}</span>
        </span>
      </div>

      {/* Linha 2: Detalhamento de Percentuais e Limites */}
      <div className="text-[9px] text-secondary font-medium mt-1 truncate">
        {formatNumberWithTwoDecimalsBR(sharePct)}% do total
        {hasTarget && (
          <>
            {' • '}
            <span className={targetColorClass}>
              {formatNumberWithTwoDecimalsBR(targetPct)}% {isExpense ? 'limite' : 'meta'}
            </span>
            {targetExceeded && (
              <AlertTriangle size={10} className="inline-block text-expense ml-0.5 align-text-top" />
            )}
          </>
        )}
      </div>

      {/* Linha 3: Barra de distribuição principal */}
      <div className="w-full h-1 rounded-full bg-secondary/20 mt-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${sharePct}%`, backgroundColor: color }} />
      </div>
    </RowButton>
  )
}

