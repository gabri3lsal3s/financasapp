import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { AlertTriangle, Check, Calendar } from 'lucide-react'
import type { SpendingCalcs } from '@/hooks/useSpendingCalculations'
import type { SpendingProjection } from '@/hooks/useSpendingProjection'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface FinancialHealthCardProps {
  spendingCalcs: SpendingCalcs
  projection: SpendingProjection | null
  totalIncomes: number
  totalExpenses: number
  totalLimits: number
  limitUsedPercentage: number
  progressColor: string
  balance: number
  savingsRate: number
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function FinancialHealthCard({
  spendingCalcs,
  projection,
  totalIncomes,
  totalExpenses,
  totalLimits,
  limitUsedPercentage,
  progressColor,
  balance,
  savingsRate,
}: FinancialHealthCardProps) {
  const isPositive = balance >= 0
  const effectiveLimit = totalLimits > 0 ? totalLimits : totalIncomes

  return (
    <Card
      className={cn(
        CARD_BASE,
        CARD_PADDING_LARGE,
        'relative overflow-hidden transition-all duration-300',
        !isPositive && 'border-expense/30 bg-expense/[0.04]',
      )}
    >
      {/* ── Top Row: Balance + Status ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-4 border-b border-glass/30">
        <div className="space-y-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Saldo do Mês
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <h2
              className={cn(
                'text-3xl font-extrabold font-mono tracking-tight leading-none',
                isPositive ? 'text-income' : 'text-expense',
              )}
            >
              {formatCurrency(balance)}
            </h2>
            {totalIncomes > 0 && (
              <span
                className={cn(
                  'text-[10px] font-bold font-mono',
                  isPositive ? 'text-income/70' : 'text-expense/70',
                )}
              >
                ({formatNumberWithTwoDecimalsBR(savingsRate)}%)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 sm:border-l border-glass/30 sm:pl-6">
          {/* Daily suggested */}
          <div className="space-y-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Diário
            </span>
            <p className="text-lg font-bold font-mono leading-none text-primary">
              {formatCurrency(spendingCalcs.dailyAvailable)}
              <span className="text-[9px] font-normal text-secondary ml-0.5">/dia</span>
            </p>
          </div>

          {/* Status badge */}
          <div>
            {isPositive ? (
              <span className="text-[10px] font-bold text-income bg-income/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                <Check size={11} />
                {savingsRate >= 20 ? 'Excelente' : savingsRate >= 10 ? 'Saudável' : 'Ok'}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-expense bg-expense/10 px-2.5 py-1 rounded-full flex items-center gap-1">
                <AlertTriangle size={11} />
                Negativo
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Budget Usage Bar ── */}
      {effectiveLimit > 0 && (
        <div className="space-y-1.5 mb-4">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-secondary">
            <span id="budget-usage-label">Uso do Orçamento</span>
            <span
              className={cn(
                'font-mono font-bold',
                limitUsedPercentage >= 85 ? 'text-expense' : limitUsedPercentage >= 70 ? 'text-warning' : 'text-income',
              )}
            >
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
            className="w-full h-3 rounded-full bg-secondary/10 overflow-hidden relative border border-glass/25"
          >
            <div
              className={cn('h-full transition-all duration-500 rounded-full', progressColor)}
              style={{ width: `${Math.min(100, limitUsedPercentage)}%` }}
            />
          </div>

          <p className="text-[10px] text-secondary font-medium">
            {totalLimits > 0 ? (
              <>
                Utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> do seu limite de{' '}
                <strong className="text-primary">{formatCurrency(totalLimits)}</strong>
              </>
            ) : totalIncomes > 0 ? (
              <>
                Utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> da sua receita de{' '}
                <strong className="text-primary">{formatCurrency(totalIncomes)}</strong>
              </>
            ) : null}
          </p>
        </div>
      )}

      {/* ── Projection (optional) ── */}
      {projection && (
        <div className="pt-3 border-t border-glass/30 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
                <Calendar size={11} />
                Projeção de Fim do Mês
              </span>
              <h3
                className={cn(
                  'text-xl font-extrabold font-mono tracking-tight leading-none mt-0.5',
                  projection.onTrack ? 'text-income' : 'text-expense',
                )}
              >
                {formatCurrency(projection.projectedSurplus)}
                <span className="text-[10px] font-normal text-secondary ml-1">
                  {projection.onTrack ? 'de superávit' : 'de déficit'}
                </span>
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 sm:border-l border-glass/30 sm:pl-5">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-secondary">Ritmo:</span>
                <span className="text-xs font-bold font-mono text-primary">
                  {formatCurrency(projection.dailyBurnRate)}<span className="text-[8px] font-normal text-secondary">/dia</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold text-secondary">Proj.:</span>
                <span className="text-xs font-bold font-mono text-primary">
                  {formatCurrency(projection.projectedEndOfMonthExpenses)}
                </span>
              </div>
              <div>
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full',
                  projection.onTrack
                    ? 'text-income bg-income/10'
                    : 'text-expense bg-expense/10',
                )}>
                  {projection.onTrack ? <><Check size={10} /> No rumo</> : <><AlertTriangle size={10} /> Atenção</>}
                </span>
              </div>
            </div>
          </div>

          {/* Mini projection thermometer */}
          {totalIncomes > 0 && (
            <div>
              <div className="flex items-center justify-between text-[9px] font-medium text-secondary mb-1">
                <span>Projetado vs Receita</span>
                <span
                  className={cn(
                    'font-bold font-mono',
                    (projection.projectedEndOfMonthExpenses / totalIncomes) * 100 >= 85
                      ? 'text-expense'
                      : 'text-primary',
                  )}
                >
                  {formatNumberWithTwoDecimalsBR(
                    (projection.projectedEndOfMonthExpenses / totalIncomes) * 100,
                  )}
                  %
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-secondary/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    (projection.projectedEndOfMonthExpenses / totalIncomes) * 100 >= 85
                      ? 'bg-expense'
                      : (projection.projectedEndOfMonthExpenses / totalIncomes) * 100 >= 70
                        ? 'bg-warning'
                        : 'bg-income',
                  )}
                  style={{
                    width: `${Math.min(100, (projection.projectedEndOfMonthExpenses / totalIncomes) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[9px] text-secondary mt-1 leading-relaxed">
                {projection.onTrack
                  ? `Mantendo o ritmo de ${formatCurrency(projection.dailyBurnRate)}/dia, você termina com superávit.`
                  : `No ritmo atual, pode terminar com déficit de ${formatCurrency(Math.abs(projection.projectedSurplus))}. Reveja os gastos.`}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
