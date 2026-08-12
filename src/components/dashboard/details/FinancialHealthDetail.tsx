import { useDashboardFinances, useDashboardBudget } from '@/contexts/dashboardDataContext'
import AmountText from '@/components/ui/amount-text'
import { formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { cn } from '@/lib/utils'
import { AlertTriangle, Check, Calendar } from 'lucide-react'

export default function FinancialHealthDetail() {
  const { totalIncomes, totalExpenses } = useDashboardFinances()
  const { spendingCalcs, spendingProjection, totalLimits, limitUsedPercentage, progressColor } = useDashboardBudget()
  const effectiveLimit = totalLimits > 0 ? totalLimits : totalIncomes

  return (
    <div className="space-y-4">
      {/* ── Budget Usage Bar ── */}
      {effectiveLimit > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-secondary">
            <span>Uso do Orçamento</span>
            <span className={cn(
              'font-mono font-bold',
              limitUsedPercentage >= 85 ? 'text-expense' : limitUsedPercentage >= 70 ? 'text-warning' : 'text-income',
            )}>
              {formatNumberWithTwoDecimalsBR(limitUsedPercentage)}%
            </span>
          </div>
          <div className="w-full h-3 rounded-full bg-secondary/10 overflow-hidden border border-glass/25">
            <div
              className={cn('h-full transition-all duration-500 rounded-full', progressColor)}
              style={{ width: `${Math.min(100, limitUsedPercentage)}%` }}
            />
          </div>
          <p className="text-[10px] text-secondary font-medium">
            {totalLimits > 0 ? (
              <>Utilizou <AmountText value={totalExpenses} size="xs" /> de <AmountText value={totalLimits} size="xs" /></>
            ) : totalIncomes > 0 ? (
              <>Utilizou <AmountText value={totalExpenses} size="xs" /> de <AmountText value={totalIncomes} size="xs" /></>
            ) : null}
          </p>
        </div>
      )}

      {/* ── Spending Calcs ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-glass p-3 bg-secondary/5">
          <p className="text-[9px] text-secondary font-bold uppercase">Disponível/mês</p>
          <AmountText
            value={spendingCalcs.monthlyAvailable}
            size="sm"
            weight="extrabold"
            tone={spendingCalcs.monthlyAvailable < 0 ? 'expense' : 'income'}
            className="mt-0.5 block"
          />
        </div>
        <div className="rounded-xl border border-glass p-3 bg-secondary/5">
          <p className="text-[9px] text-secondary font-bold uppercase">Disponível/dia</p>
          <AmountText
            value={spendingCalcs.dailyAvailable}
            size="sm"
            weight="extrabold"
            tone={spendingCalcs.monthlyAvailable < 0 ? 'expense' : 'default'}
            className="mt-0.5 block"
          />
        </div>
      </div>

      {/* ── Projection ── */}
      {spendingProjection && (
        <div className="pt-2 border-t border-glass/30 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-bold uppercase text-secondary flex items-center gap-1">
              <Calendar size={11} />
              Projeção
            </span>
            <span className="flex items-center">
              <AmountText
                value={spendingProjection.projectedSurplus}
                size="xs"
                weight="bold"
                tone={spendingProjection.onTrack ? 'income' : 'expense'}
              />
              <span className="text-[8px] font-normal text-secondary ml-1">
                {spendingProjection.onTrack ? 'superávit' : 'déficit'}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-secondary">
            <span>Ritmo: <AmountText value={spendingProjection.dailyBurnRate} size="xs" />/dia</span>
            <span>
              {spendingProjection.onTrack
                ? <span className="text-income flex items-center gap-1"><Check size={10} /> No rumo</span>
                : <span className="text-expense flex items-center gap-1"><AlertTriangle size={10} /> Atenção</span>}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
