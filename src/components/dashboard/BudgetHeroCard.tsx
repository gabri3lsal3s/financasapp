import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { formatCurrency } from '@/utils/format'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { AlertTriangle, Check } from 'lucide-react'
import type { SpendingCalcs } from '@/hooks/useDashboardData'

interface BudgetHeroCardProps {
  spendingCalcs: SpendingCalcs
}

export default function BudgetHeroCard({ spendingCalcs }: BudgetHeroCardProps) {
  return (
    <Card
      className={cn(
        CARD_BASE,
        CARD_PADDING_LARGE,
        'relative overflow-hidden transition-all duration-300',
        spendingCalcs.monthlyAvailable < 0 && 'border-expense/30 bg-expense/[0.04]',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Diário Sugerido
          </span>
          <h2
            className={cn(
              'text-3xl font-extrabold font-mono tracking-tight leading-none mt-1',
              spendingCalcs.monthlyAvailable < 0 ? 'text-expense' : 'text-primary',
            )}
          >
            {formatCurrency(spendingCalcs.dailyAvailable)}
            <span className="text-xs font-normal text-secondary ml-1">/ dia</span>
          </h2>
        </div>

        <div className="flex items-center gap-6 sm:border-l border-glass/30 sm:pl-6">
          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Mensal Livre
            </span>
            <p
              className={cn(
                'text-lg font-bold font-mono leading-none',
                spendingCalcs.monthlyAvailable < 0 ? 'text-expense' : 'text-income',
              )}
            >
              {formatCurrency(spendingCalcs.monthlyAvailable)}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-secondary">
              Status
            </span>
            <div className="flex items-center gap-1">
              {spendingCalcs.monthlyAvailable < 0 ? (
                <span className="text-[10px] font-bold text-expense bg-expense/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <AlertTriangle size={10} />
                  Orçamento ultrapassado
                </span>
              ) : (
                <span className="text-[10px] font-bold text-income bg-income/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Check size={10} />
                  Sob controle
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
