import { useState, useCallback } from 'react'
import { useDashboardInsightsContext } from '@/contexts/DashboardDataContext'
import { formatCurrency } from '@/utils/format'
import { cn } from '@/lib/utils'
import { ignoreSubscription, restoreSubscription } from '@/utils/ignoredSubscriptions'
import {
  CreditCard, RefreshCw, TrendingUp, X, Eye, EyeOff, ChevronRight,
} from 'lucide-react'
import type { RecurringExpenseInfo } from '@/services/insightsEngine'

/* ── Expense Row ── */
function ExpenseRow({
  item, onDismiss, onRestore, showDismiss = true,
}: {
  item: RecurringExpenseInfo
  onDismiss?: (desc: string) => void
  onRestore?: (desc: string) => void
  showDismiss?: boolean
}) {
  const levelConfig = {
    subscription: { icon: CreditCard, label: 'Assinatura', color: 'bg-balance/10 text-balance' },
    recurring: { icon: RefreshCw, label: 'Recorrente', color: 'bg-warning/10 text-warning' },
    similar: { icon: TrendingUp, label: 'Padrão', color: 'bg-secondary/10 text-secondary' },
  }
  const LevelIcon = levelConfig[item.recurrenceType].icon
  const levelStyle = levelConfig[item.recurrenceType]

  const confidenceDots = item.confidence >= 0.9 ? 3 : item.confidence >= 0.6 ? 2 : 1
  const confidenceColors = ['bg-expense/30', 'bg-warning/50', 'bg-income']

  return (
    <div className={cn(
      'flex items-center justify-between gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-xl border border-glass',
      item.isIgnored && 'opacity-40',
    )}>
      <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
        <span className={cn('w-6 sm:w-7 h-6 sm:h-7 rounded-lg flex items-center justify-center shrink-0', levelStyle.color)}>
          <LevelIcon size={11} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] sm:text-[11px] font-bold text-primary truncate">{item.description}</p>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
            <span className="text-[7px] sm:text-[8px] text-secondary/70 truncate max-w-[80px] sm:max-w-none">{item.categoryName}</span>
            <span className="flex items-center gap-[2px] shrink-0">
              {[0, 1, 2].map((i) => (
                <span key={i} className={cn('w-[4px] sm:w-[5px] h-[4px] sm:h-[5px] rounded-full', i < confidenceDots ? confidenceColors[i] : 'bg-glass/30')} />
              ))}
            </span>
            {item.monthsFound > 1 && <span className="text-[7px] sm:text-[8px] text-secondary/50">{item.monthsFound} meses</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        <div className="text-right">
          <p className="text-[10px] sm:text-[11px] font-bold text-primary font-mono">{formatCurrency(item.monthlyAmount)}</p>
          <p className="text-[7px] sm:text-[8px] text-secondary/60 hidden sm:block">{formatCurrency(item.annualAmount)}/ano</p>
        </div>
        {showDismiss && !item.isIgnored && (
          <button onClick={() => onDismiss?.(item.description)} className="w-5 sm:w-6 h-5 sm:h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-secondary shrink-0" title="Ignorar">
            <X size={10} />
          </button>
        )}
        {item.isIgnored && onRestore && (
          <button onClick={() => onRestore(item.description)} className="w-5 sm:w-6 h-5 sm:h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-income shrink-0" title="Restaurar">
            <Eye size={10} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main ── */
export default function SubscriptionsDetail() {
  const { insights } = useDashboardInsightsContext()
  const [showIgnored, setShowIgnored] = useState(false)
  const [, forceUpdate] = useState(0)
  const refresh = useCallback(() => forceUpdate((n) => n + 1), [])

  const visibleItems = insights.recurringExpenses.filter((s) => !s.isIgnored)
  const ignoredItems = insights.recurringExpenses.filter((s) => s.isIgnored)

  if (visibleItems.length === 0) {
    return <p className="text-[10px] text-secondary text-center py-4">Nenhuma despesa recorrente identificada.</p>
  }

  const totalMonthly = visibleItems.reduce((s, sub) => s + sub.monthlyAmount, 0)
  const totalAnnual = visibleItems.reduce((s, sub) => s + sub.annualAmount, 0)
  const cuttableMonthly = visibleItems.filter(s => s.tier === 'can_cut').reduce((s, sub) => s + sub.savingsIfCut, 0)

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[10px] font-bold text-primary">{formatCurrency(totalMonthly)}<span className="text-[8px] font-normal text-secondary/60">/mês</span></span>
        <span className="text-[9px] text-secondary/60">{formatCurrency(totalAnnual)}/ano</span>
        {cuttableMonthly > 0 && (
          <span className="text-[8px] font-bold text-income bg-income/10 px-1.5 py-0.5 rounded-md whitespace-nowrap">Cortável: {formatCurrency(cuttableMonthly)}/mês</span>
        )}
      </div>

      <div className="space-y-1.5">
        {visibleItems.map((item) => (
          <ExpenseRow key={`${item.description}-${item.monthlyAmount}`} item={item}
            onDismiss={(desc) => { ignoreSubscription(desc); refresh() }} />
        ))}
      </div>

      {ignoredItems.length > 0 && (
        <div className="space-y-1">
          <button onClick={() => setShowIgnored(!showIgnored)} className="flex items-center gap-2 text-[9px] font-bold uppercase text-secondary/50 hover:text-secondary py-1">
            <EyeOff size={11} />{ignoredItems.length} ignorada{ignoredItems.length > 1 ? 's' : ''}
            <ChevronRight size={11} className={cn('transition-transform', showIgnored && 'rotate-90')} />
          </button>
          {showIgnored && ignoredItems.map((item) => (
            <ExpenseRow key={`ignored-${item.description}`} item={item} showDismiss={false}
              onRestore={(desc) => { restoreSubscription(desc); refresh() }} />
          ))}
        </div>
      )}
    </div>
  )
}
