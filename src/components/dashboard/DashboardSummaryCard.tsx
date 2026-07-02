import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { Calendar } from 'lucide-react'
import {
  CARD_BASE,
  CARD_PADDING_LARGE,
} from '@/constants/layout'

export interface ReallocationData {
  fromName: string
  toName: string
}

interface DashboardSummaryCardProps {
  totalIncomes: number
  totalExpenses: number
  totalLimits: number
  limitUsedPercentage: number
  progressColor: string
  reallocationRecommendation: ReallocationData | null
  isReallocating: boolean
  handleReallocate: () => void
}

export default function DashboardSummaryCard({
  totalIncomes,
  totalExpenses,
  totalLimits,
  limitUsedPercentage,
  progressColor,
  reallocationRecommendation,
  isReallocating,
  handleReallocate,
}: DashboardSummaryCardProps) {
  const getDaysRemaining = () => {
    const today = new Date()
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const remaining = daysInMonth - today.getDate() + 1
    return `${remaining} ${remaining === 1 ? 'dia' : 'dias'} para o fim do mês.`
  }

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, "relative overflow-hidden")}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass/40 pb-3.5 mb-4">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
            Resumo do Mês
          </h3>
          <p className="text-[10px] text-secondary mt-0.5">
            Acompanhamento de despesas contra a receita total e o limite de orçamento
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-income shrink-0" />
            <span className="text-secondary font-sans">Receita:</span>
            <strong className="text-primary font-mono">{formatCurrency(totalIncomes)}</strong>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-expense shrink-0" />
            <span className="text-secondary font-sans">Despesa:</span>
            <strong className="text-primary font-mono">{formatCurrency(totalExpenses)}</strong>
          </div>
          {totalLimits > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary/30 shrink-0" />
              <span className="text-secondary font-sans">Limite:</span>
              <strong className="text-primary font-mono">{formatCurrency(totalLimits)}</strong>
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Barra de progresso grossa */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-secondary">
            <span id="budget-usage-label">Uso do Orçamento</span>
            <span className={cn(
              "font-mono font-bold",
              limitUsedPercentage >= 85 ? "text-expense" : limitUsedPercentage >= 70 ? "text-warning" : "text-income"
            )}>
              {formatNumberWithTwoDecimalsBR(limitUsedPercentage)}%
            </span>
          </div>

          <div
            role="progressbar"
            aria-valuenow={Math.round(limitUsedPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${formatNumberWithTwoDecimalsBR(limitUsedPercentage)}% do orçamento utilizado`}
            aria-labelledby="budget-usage-label"
            className="w-full h-4 rounded-full bg-secondary/10 overflow-hidden relative border border-glass/25"
          >
            <div
              className={cn("h-full transition-all duration-500 rounded-full", progressColor)}
              style={{ width: `${limitUsedPercentage}%` }}
            />
          </div>
        </div>

        {/* Mensagem descritiva e reajuste rápido */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 text-[10px] text-secondary font-medium">
          <div>
            {totalLimits > 0 ? (
              <span>
                Você utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> do seu limite global de <strong className="text-primary">{formatCurrency(totalLimits)}</strong>.
              </span>
            ) : totalIncomes > 0 ? (
              <span>
                Você utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> da sua receita total de <strong className="text-primary">{formatCurrency(totalIncomes)}</strong>.
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Calendar size={11} className="text-secondary" />
                Faltam {getDaysRemaining()}
              </span>
            )}
          </div>

          {reallocationRecommendation && (
            <div className="flex items-center gap-2 border border-glass surface-glass-strong px-2.5 py-1 rounded-xl text-[10px]">
              <span className="truncate max-w-[220px]">
                Sugestão: Ajustar limite de <strong className="text-primary">{reallocationRecommendation.fromName}</strong> para cobrir <strong className="text-primary">{reallocationRecommendation.toName}</strong>.
              </span>
              <Button
                onClick={handleReallocate}
                disabled={isReallocating}
                variant="ghost"
                size="xs"
                className="uppercase tracking-wider border-l border-glass/30 pl-2 shrink-0"
              >
                {isReallocating ? 'Remanejando...' : 'Aplicar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
