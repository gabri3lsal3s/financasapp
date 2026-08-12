import { useMemo } from 'react'
import { useDashboardFinances } from '@/contexts/dashboardDataContext'
import { AnimatedNumber } from '@/components/ui/animated-number'
import ComparisonSparkline from '@/components/ui/comparison-sparkline'
import { Eyebrow } from '@/components/ui/eyebrow'
import { accumulateSeries } from '@/utils/comparisonSparkline'
import { formatCurrency, formatPercentBR } from '@/utils/format'
import { cn } from '@/lib/utils'

/**
 * Hero do Dashboard: Saldo consolidado (contador animado) + sparkline
 * comparativo da curva de gastos acumulados (mês atual vs mês anterior)
 * com pílula de variação. Dados de `useDashboardFinances` — sem contratos alterados.
 */
export default function DashboardHero() {
  const {
    balance,
    totalExpenses,
    previousMonthExpenseTotal,
    dailyFlowData,
    previousMonthDailyExpenses,
  } = useDashboardFinances()

  const currentSpendingCurve = useMemo(() => {
    if (!dailyFlowData?.length) return []
    return accumulateSeries(dailyFlowData.map((d) => d.Despesas))
  }, [dailyFlowData])

  const previousSpendingCurve = useMemo(() => {
    if (!previousMonthDailyExpenses?.length) return []
    return accumulateSeries(previousMonthDailyExpenses.map((d) => d.Despesas))
  }, [previousMonthDailyExpenses])

  const spendingDelta =
    previousMonthExpenseTotal > 0
      ? ((totalExpenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100
      : null

  return (
    <div className="modal-panel-glass glass-refract border border-glass rounded-2xl p-5 sm:p-6 relative overflow-hidden animate-page-enter">
      {/* Glow ambiente obsidian (R11) */}
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-50"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--color-primary) 12%, transparent), transparent 70%)' }}
      />
      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Eyebrow>Saldo Consolidado</Eyebrow>
          <AnimatedNumber
            value={balance}
            format={(n) => formatCurrency(n)}
            className={cn(
              'mt-1.5 block text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight leading-tight',
              balance >= 0 ? 'text-income' : 'text-expense',
            )}
          />
        </div>
        {spendingDelta !== null && (
          <span
            className={cn(
              'px-2.5 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap',
              spendingDelta <= 0
                ? 'bg-income/10 text-income border-income/20'
                : 'bg-expense/10 text-expense border-expense/20',
            )}
          >
            {spendingDelta >= 0 ? '+' : ''}
            {formatPercentBR(spendingDelta, 1)} vs mês anterior
          </span>
        )}
      </div>

      {currentSpendingCurve.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Gastos acumulados no mês</Eyebrow>
          </div>
          <ComparisonSparkline
            data={currentSpendingCurve}
            compareData={previousSpendingCurve.length > 0 ? previousSpendingCurve : undefined}
            className="text-primary mt-2"
            ariaLabel="Gastos acumulados do mês atual comparados ao mês anterior"
          />
        </div>
      )}
    </div>
  )
}
