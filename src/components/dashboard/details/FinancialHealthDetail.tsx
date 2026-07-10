import { useDashboardFinances, useDashboardBudget } from '@/contexts/DashboardDataContext'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
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
              <>Utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> de <strong className="text-primary">{formatCurrency(totalLimits)}</strong></>
            ) : totalIncomes > 0 ? (
              <>Utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> de <strong className="text-primary">{formatCurrency(totalIncomes)}</strong></>
            ) : null}
          </p>
        </div>
      )}

      {/* ── Spending Calcs ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-glass p-3 bg-secondary/5">
          <p className="text-[9px] text-secondary font-bold uppercase">Disponível/mês</p>
          <p className={cn(
            'text-sm font-extrabold font-mono mt-0.5',
            spendingCalcs.monthlyAvailable < 0 ? 'text-expense' : 'text-income',
          )}>
            {formatCurrency(spendingCalcs.monthlyAvailable)}
          </p>
        </div>
        <div className="rounded-xl border border-glass p-3 bg-secondary/5">
          <p className="text-[9px] text-secondary font-bold uppercase">Disponível/dia</p>
          <p className={cn(
            'text-sm font-extrabold font-mono mt-0.5',
            spendingCalcs.monthlyAvailable < 0 ? 'text-expense' : 'text-primary',
          )}>
            {formatCurrency(spendingCalcs.dailyAvailable)}
          </p>
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
            <span className={cn(
              'text-[10px] font-bold font-mono',
              spendingProjection.onTrack ? 'text-income' : 'text-expense',
            )}>
              {formatCurrency(spendingProjection.projectedSurplus)}
              <span className="text-[8px] font-normal text-secondary ml-1">
                {spendingProjection.onTrack ? 'superávit' : 'déficit'}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] text-secondary">
            <span>Ritmo: <strong className="text-primary">{formatCurrency(spendingProjection.dailyBurnRate)}</strong>/dia</span>
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
