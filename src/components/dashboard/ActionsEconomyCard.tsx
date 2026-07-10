import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { formatCurrency } from '@/utils/format'
import Button from '@/components/Button'
import {
  AlertTriangle, TrendingUp, Sparkles, PiggyBank,
  CheckCircle2, CreditCard, ChevronRight, X, Eye, EyeOff,
  ArrowRightLeft, Coffee, Landmark, Calendar, RefreshCw,
} from 'lucide-react'
import { ignoreSubscription, restoreSubscription } from '@/utils/ignoredSubscriptions'
import type { StructuredInsights, RecurringExpenseInfo } from '@/services/insightsEngine'
import type { OptimizationSuggestion, OptimizationSummary } from '@/services/insightsEngine'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ActionsEconomyCardProps {
  insights: StructuredInsights
  optimizationSummary: OptimizationSummary
  onReallocate: (fromId: string, toId: string, amount: number) => Promise<void>
  onRefreshInsights: () => void
}

/* ------------------------------------------------------------------ */
/*  Critical Alert                                                     */
/* ------------------------------------------------------------------ */

function AlertSection({ alert }: { alert: NonNullable<StructuredInsights['criticalAlert']> }) {
  const borderMap = {
    danger: 'border-expense/30 bg-expense/[0.03]',
    warning: 'border-warning/30 bg-warning/[0.03]',
    success: 'border-income/30 bg-income/[0.03]',
  }

  const iconMap = {
    danger: <AlertTriangle size={16} className="text-expense shrink-0" />,
    warning: <TrendingUp size={16} className="text-warning shrink-0" />,
    success: <CheckCircle2 size={16} className="text-income shrink-0" />,
  }

  return (
    <div className={cn('flex items-start gap-3 px-3.5 py-2.5 rounded-xl border', borderMap[alert.severity])}>
      {iconMap[alert.severity]}
      <p className={cn(
        'text-[11px] font-bold leading-snug',
        alert.severity === 'danger' && 'text-expense',
        alert.severity === 'warning' && 'text-warning',
        alert.severity === 'success' && 'text-income',
      )}>
        {alert.text}
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Recurring Expense Row — unificada (subscription / recurring / similar) */
/* ------------------------------------------------------------------ */

function ExpenseRow({
  item,
  onDismiss,
  onRestore,
  showDismiss = true,
}: {
  item: RecurringExpenseInfo
  onDismiss?: (description: string) => void
  onRestore?: (description: string) => void
  showDismiss?: boolean
}) {
  const tierLabels: Record<string, string> = { essential: 'Essencial', discretionary: 'Opcional', can_cut: 'Cortável' }
  const tierColors: Record<string, string> = { essential: 'border-primary/20 bg-primary/[0.02]', discretionary: 'border-glass surface-glass-strong', can_cut: 'border-expense/20 bg-expense/[0.02]' }
  const tierBadge: Record<string, string> = { essential: 'text-primary bg-primary/10', discretionary: 'text-secondary bg-secondary/10', can_cut: 'text-expense bg-expense/10' }

  /* Badge e ícone por nível de recorrência */
  const levelConfig = {
    subscription: { icon: CreditCard, label: 'Assinatura', color: 'bg-balance/10 text-balance' },
    recurring: { icon: RefreshCw, label: 'Recorrente', color: 'bg-warning/10 text-warning' },
    similar: { icon: TrendingUp, label: 'Padrão', color: 'bg-secondary/10 text-secondary' },
  }
  const LevelIcon = levelConfig[item.recurrenceType].icon
  const levelStyle = levelConfig[item.recurrenceType]

  /* Indicador visual de confiança (bolinhas) */
  const confidenceDots =
    item.confidence >= 0.9 ? 3 :
    item.confidence >= 0.6 ? 2 : 1
  const confidenceColors = ['bg-expense/30', 'bg-warning/50', 'bg-income']

  return (
    <div className={cn(
      'flex items-center justify-between gap-2 px-3 py-2 rounded-xl border',
      tierColors[item.tier] || 'border-glass surface-glass-strong',
      item.isIgnored && 'opacity-40',
    )}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Ícone por nível */}
        <span className={cn(
          'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
          levelStyle.color,
        )}>
          <LevelIcon size={13} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-[11px] font-bold text-primary truncate">{item.description}</p>
            {/* Badge de nível */}
            <span className="text-[7px] font-bold px-1 py-0.5 rounded uppercase shrink-0 bg-secondary/10 text-secondary/60">
              {levelStyle.label}
            </span>
            {/* Badge de tier (Essencial/Opcional/Cortável) */}
            {(item.tier === 'essential' || item.tier === 'can_cut') && (
              <span className={cn('text-[7px] font-bold px-1 py-0.5 rounded-full uppercase shrink-0', tierBadge[item.tier])}>
                {tierLabels[item.tier]}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-[9px] text-secondary/70">{item.categoryName}</p>
            <span className="text-[7px] text-secondary/40">·</span>
            <span className="text-[8px] text-secondary/50 flex items-center gap-1">
              {/* Bolinhas de confiança */}
              <span className="flex items-center gap-[2px]">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'w-[5px] h-[5px] rounded-full transition-colors',
                      i < confidenceDots ? confidenceColors[i] : 'bg-glass/30',
                    )}
                  />
                ))}
              </span>
              {item.monthsFound > 1 && (
                <span>{item.monthsFound} meses</span>
              )}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-[11px] font-bold text-primary font-mono">{formatCurrency(item.monthlyAmount)}</p>
          <p className="text-[8px] text-secondary/60">{formatCurrency(item.annualAmount)}/ano</p>
        </div>
        {showDismiss && item.tier !== 'essential' && !item.isIgnored && (
          <button onClick={() => onDismiss?.(item.description)} className="w-6 h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-secondary transition-colors shrink-0" title="Ignorar">
            <X size={12} />
          </button>
        )}
        {item.isIgnored && onRestore && (
          <button onClick={() => onRestore(item.description)} className="w-6 h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-income transition-colors shrink-0" title="Restaurar">
            <Eye size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Recurring Expenses Section — unificada (todos os 3 níveis)        */
/* ------------------------------------------------------------------ */

function RecurringExpensesSection({
  items,
}: {
  items: RecurringExpenseInfo[]
}) {
  const [showIgnored, setShowIgnored] = useState(false)
  const [, forceUpdate] = useState(0)
  const refresh = useCallback(() => forceUpdate((n) => n + 1), [])

  const visibleItems = items.filter((s) => !s.isIgnored)
  const ignoredItems = items.filter((s) => s.isIgnored)

  if (visibleItems.length === 0) return null

  /* Total geral mensal e anual de despesas recorrentes */
  const totalMonthly = visibleItems.reduce((s, sub) => s + sub.monthlyAmount, 0)
  const totalAnnual = visibleItems.reduce((s, sub) => s + sub.annualAmount, 0)

  /* Economia possível cortando itens marcados como can_cut */
  const cuttableMonthly = visibleItems
    .filter(s => s.tier === 'can_cut')
    .reduce((s, sub) => s + sub.savingsIfCut, 0)

  /* Quantos com alta confiança */
  const highConfCount = visibleItems.filter((s) => s.confidence >= 0.7).length

  /* Resumo por nível */
  const subCount = visibleItems.filter(s => s.recurrenceType === 'subscription').length
  const recCount = visibleItems.filter(s => s.recurrenceType === 'recurring').length
  const simCount = visibleItems.filter(s => s.recurrenceType === 'similar').length

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between border-b border-glass/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Despesas Recorrentes</span>
          <span className="text-[8px] font-bold text-balance bg-balance/10 px-1.5 py-0.5 rounded-md">{visibleItems.length}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold font-mono text-primary">
            {formatCurrency(totalMonthly)}<span className="text-[7px] font-normal text-secondary/60">/mês</span>
          </span>
          {cuttableMonthly > 0 && (
            <span className="text-[8px] font-bold text-income bg-income/10 px-1.5 py-0.5 rounded-md">
              Cortável: {formatCurrency(cuttableMonthly)}/mês
            </span>
          )}
        </div>
      </div>

      {/* Mini-summary: total anual + confiança + resumo por nível */}
      <div className="flex items-center gap-3 px-0.5 text-[8px] text-secondary/50 flex-wrap">
        <span>{formatCurrency(totalAnnual)}/ano</span>
        {subCount > 0 && <span className="text-balance/70">{subCount} assinatura{subCount > 1 ? 's' : ''}</span>}
        {recCount > 0 && <span className="text-warning/70">{recCount} recorrente{recCount > 1 ? 's' : ''}</span>}
        {simCount > 0 && <span className="text-secondary/50">{simCount} padrão{simCount > 1 ? 'ões' : ''}</span>}
        {highConfCount > 0 && highConfCount < visibleItems.length && (
          <span>{highConfCount} de {visibleItems.length} com alta confiança</span>
        )}
        {highConfCount === visibleItems.length && visibleItems.length > 1 && (
          <span className="text-income/60">Todas com alta confiança</span>
        )}
      </div>

      <div className="space-y-1.5">
        {visibleItems.slice(0, 6).map((item) => (
          <ExpenseRow
            key={`${item.description}-${item.monthlyAmount}-${item.recurrenceType}`}
            item={item}
            onDismiss={(desc) => { ignoreSubscription(desc); refresh() }}
          />
        ))}
      </div>

      {visibleItems.length > 6 && (
        <p className="text-[9px] text-secondary/50 text-center">+{visibleItems.length - 6} outras despesas recorrentes</p>
      )}

      {ignoredItems.length > 0 && (
        <div className="space-y-1">
          <button onClick={() => setShowIgnored(!showIgnored)} className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-secondary/50 hover:text-secondary transition-colors py-1">
            <EyeOff size={11} />
            {ignoredItems.length} ignorada{ignoredItems.length > 1 ? 's' : ''}
            <ChevronRight size={11} className={cn('transition-transform', showIgnored && 'rotate-90')} />
          </button>
          {showIgnored && ignoredItems.map((item) => (
            <ExpenseRow key={`ignored-${item.description}-${item.monthlyAmount}`} item={item} onRestore={(desc) => { restoreSubscription(desc); refresh() }} showDismiss={false} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Optimization Suggestion Card                                       */
/* ------------------------------------------------------------------ */

const iconMap: Record<string, React.ReactNode> = {
  ArrowRightLeft: <ArrowRightLeft size={14} />,
  Coffee: <Coffee size={14} />,
  Landmark: <Landmark size={14} />,
  PiggyBank: <PiggyBank size={14} />,
  Sparkles: <Sparkles size={14} />,
}

function SuggestionActionButton({
  suggestion,
  onReallocate,
  onRefreshInsights,
  onDone,
  isDoing,
}: {
  suggestion: OptimizationSuggestion
  onReallocate: (fromId: string, toId: string, amount: number) => Promise<void>
  onRefreshInsights: () => void
  onDone: () => void
  isDoing: boolean
}) {
  const navigate = useNavigate()

  const handleClick = useCallback(async () => {
    const act = suggestion.action
    switch (act.type) {
      case 'reallocate':
        await onReallocate(act.fromId, act.toId, act.amount)
        onDone()
        onRefreshInsights()
        break
      case 'navigate':
        navigate(act.path)
        break
    }
  }, [suggestion, onReallocate, onDone, onRefreshInsights, navigate])

  const label = suggestion.action.type === 'navigate' ? 'Ver' : 'Aplicar'

  return (
    <Button onClick={handleClick} disabled={isDoing} variant={suggestion.action.type === 'navigate' ? 'ghost' : 'primary'} size="xs" className="text-[8px] font-bold uppercase tracking-wider whitespace-nowrap">
      {isDoing ? '...' : label}
    </Button>
  )
}

function SuggestionCard({
  suggestion,
  onReallocate,
  onRefreshInsights,
}: {
  suggestion: OptimizationSuggestion
  onReallocate: (fromId: string, toId: string, amount: number) => Promise<void>
  onRefreshInsights: () => void
}) {
  const [done, setDone] = useState(false)
  const [doing, setDoing] = useState(false)

  const handleDone = useCallback(() => { setDoing(false); setDone(true); setTimeout(() => setDone(false), 2000) }, [])

  const colorMap: Record<string, { border: string; icon: string }> = {
    ArrowRightLeft: { border: 'border-balance/20', icon: 'bg-balance/10 text-balance' },
    Coffee: { border: 'border-warning/20', icon: 'bg-warning/10 text-warning' },
    PiggyBank: { border: 'border-income/20', icon: 'bg-income/10 text-income' },
    Landmark: { border: 'border-balance/20', icon: 'bg-balance/10 text-balance' },
  }
  const colors = colorMap[suggestion.icon] || { border: 'border-glass', icon: 'bg-secondary/10 text-secondary' }

  return (
    <div className={cn(
      'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200',
      done ? 'border-income/40 bg-income/[0.04]' : 'border-glass surface-glass-strong hover:border-glass-strong',
      colors.border,
    )}>
      <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', colors.icon)}>
        {iconMap[suggestion.icon] || <Sparkles size={14} />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <h4 className="text-[10px] font-bold text-primary">{suggestion.title}</h4>
        <p className="text-[8px] text-secondary leading-relaxed">{suggestion.description}</p>
        {(suggestion.monthlySavings > 0 || suggestion.annualProjectedSavings > 0) && (
          <div className="flex items-center gap-2 text-[7px] text-income/70">
            {suggestion.monthlySavings > 0 && <span className="bg-income/[0.05] px-1.5 py-0.5 rounded-full flex items-center gap-1"><Calendar size={10} />{formatCurrency(suggestion.monthlySavings)}/mês</span>}
            {suggestion.annualProjectedSavings > 0 && <span className="bg-income/[0.05] px-1.5 py-0.5 rounded-full flex items-center gap-1"><Calendar size={10} />{formatCurrency(suggestion.annualProjectedSavings)}/ano</span>}
          </div>
        )}
        <div className="pt-1">
          {done ? (
            <span className="inline-flex items-center gap-1 text-[8px] font-bold text-income"><CheckCircle2 size={10} /> Aplicado</span>
          ) : (
            <SuggestionActionButton suggestion={suggestion} onReallocate={onReallocate} onRefreshInsights={onRefreshInsights} onDone={handleDone} isDoing={doing} />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyState() {
  return (
    <div className="py-6 text-center space-y-2">
      <Sparkles size={24} className="text-secondary/40 mx-auto" />
      <p className="text-[11px] font-bold text-secondary">Nenhuma ação disponível</p>
      <p className="text-[9px] text-secondary/60 max-w-[260px] mx-auto">
        Continue registrando seus gastos para receber sugestões inteligentes.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function ActionsEconomyCard({
  insights,
  optimizationSummary,
  onReallocate,
  onRefreshInsights,
}: ActionsEconomyCardProps) {
  const hasAlert = !!insights.criticalAlert
  const hasRecurring = insights.recurringExpenses.some((s) => !s.isIgnored)
  const hasActions = optimizationSummary.hasActionableSuggestions && optimizationSummary.suggestions.length > 0

  if (!hasAlert && !hasRecurring && !hasActions) {
    return (
      <Card className={cn(CARD_BASE, CARD_PADDING_LARGE)}>
        <div className="flex items-center gap-2 border-b border-glass/40 pb-2.5 mb-3">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Ações e Economia</span>
        </div>
        <EmptyState />
      </Card>
    )
  }

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, 'space-y-3 relative overflow-hidden')}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-glass/40 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Ações e Economia</span>
        </div>
        {optimizationSummary.totalMonthlySavings > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-income bg-income/10 px-2 py-1 rounded-lg">
            <PiggyBank size={11} />
            Economia: {formatCurrency(optimizationSummary.totalMonthlySavings)}/mês
          </div>
        )}
      </div>

      {/* ── Alert ── */}
      {hasAlert && <AlertSection alert={insights.criticalAlert!} />}

      {/* ── Quick Wins (ações com 1 clique) ── */}
      {hasActions && (
        <div className="space-y-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-secondary/70 px-0.5">Sugestões</span>
          {optimizationSummary.suggestions.slice(0, 4).map((sug) => (
            <SuggestionCard
              key={sug.id}
              suggestion={sug}
              onReallocate={onReallocate}
              onRefreshInsights={onRefreshInsights}
            />
          ))}
        </div>
      )}

      {/* ── Despesas Recorrentes (unificada: subscription / recurring / similar) ── */}
      {hasRecurring && (
        <RecurringExpensesSection
          items={insights.recurringExpenses}
        />
      )}
    </Card>
  )
}
