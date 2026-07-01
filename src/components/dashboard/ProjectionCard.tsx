import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { Calendar, AlertTriangle, Check } from 'lucide-react'
import type { SpendingProjection } from '@/hooks/useDashboardData'

interface ProjectionCardProps {
  projection: SpendingProjection
  totalIncomes: number
}

export default function ProjectionCard({ projection, totalIncomes }: ProjectionCardProps) {
  return (
    <Card
      className={cn(
        CARD_BASE,
        CARD_PADDING_LARGE,
        'relative overflow-hidden transition-all duration-300',
        !projection.onTrack && 'border-expense/20 bg-expense/[0.02]',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary flex items-center gap-1.5">
            <Calendar size={12} />
            Projeção para o Fim do Mês
          </span>
          <h2
            className={cn(
              'text-2xl font-extrabold font-mono tracking-tight leading-none mt-1.5',
              projection.onTrack ? 'text-income' : 'text-expense',
            )}
          >
            {formatCurrency(projection.projectedSurplus)}
            <span className="text-xs font-normal text-secondary ml-1.5">
              {projection.onTrack ? 'de superávit' : 'de déficit'}
            </span>
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4 sm:border-l border-glass/30 sm:pl-6">
          <div className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-secondary">
              Ritmo Diário
            </span>
            <p className="text-sm font-bold font-mono leading-none text-primary">
              {formatCurrency(projection.dailyBurnRate)}
              <span className="text-[9px] font-normal text-secondary ml-0.5">/dia</span>
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-secondary">
              Projetado
            </span>
            <p className="text-sm font-bold font-mono leading-none text-primary">
              {formatCurrency(projection.projectedEndOfMonthExpenses)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-secondary">
              Dia
            </span>
            <p className="text-sm font-bold font-mono leading-none text-primary">
              {projection.currentDay}
              <span className="text-[9px] font-normal text-secondary ml-0.5">/{projection.daysInMonth}</span>
            </p>
          </div>

          <div>
            {projection.onTrack ? (
              <span className="text-[9px] font-bold text-income bg-income/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check size={10} />
                No rumo
              </span>
            ) : (
              <span className="text-[9px] font-bold text-expense bg-expense/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <AlertTriangle size={10} />
                Atenção
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mini termômetro projetivo */}
      {totalIncomes > 0 && (
        <div className="mt-4 pt-3 border-t border-glass/30">
          <div className="flex items-center justify-between text-[9px] font-medium text-secondary mb-1.5">
            <span>Orçamento utilizado (projetado)</span>
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
          <p className="text-[9px] text-secondary mt-1.5 leading-relaxed">
            {projection.onTrack
              ? `Se mantiver o ritmo atual de ${formatCurrency(projection.dailyBurnRate)}/dia, você terminará o mês com saldo positivo de ${formatCurrency(projection.projectedSurplus)}.`
              : `No ritmo atual de ${formatCurrency(projection.dailyBurnRate)}/dia, você pode terminar o mês com déficit de ${formatCurrency(Math.abs(projection.projectedSurplus))}. Reveja os gastos nas categorias com maior peso.`}
          </p>
        </div>
      )}
    </Card>
  )
}
