import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import Button from '@/components/Button'
import { getCategoryIcon } from '@/utils/categoryIcons'
import {
  AlertTriangle, TrendingUp, Sparkles, PiggyBank,
  CheckCircle2, CreditCard, ArrowRight, ChevronRight,
  BarChart3, Activity, Coffee, Landmark, X, Eye, EyeOff,
} from 'lucide-react'
import { ignoreSubscription, restoreSubscription } from '@/utils/ignoredSubscriptions'
import type {
  StructuredInsights, SubscriptionInfo, SavingsChallenge, LimitSuggestion,
  IncomeConcentrationInfo, ExpenseTrendInfo, WeekendSpendingInfo,
  TopCategoryInfo, SavingsStatusInfo, InvestmentCommitmentInfo,
} from '@/services/insightsEngine'

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface InsightsCardProps {
  insights: StructuredInsights
}

/* ------------------------------------------------------------------ */
/*  Section: Critical Alert                                            */
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
    <div className={cn(
      'flex items-start gap-3 px-3.5 py-2.5 rounded-xl border',
      borderMap[alert.severity],
    )}>
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
/*  Section: Economia Potencial (assinaturas cortáveis)                */
/* ------------------------------------------------------------------ */

function CuttableSubscriptionsBanner({ count, totalSavings }: { count: number; totalSavings: number }) {
  if (count === 0 || totalSavings <= 0) return null

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-income/30 bg-income/[0.03]">
      <span className="w-8 h-8 rounded-lg bg-income/10 text-income flex items-center justify-center shrink-0">
        <PiggyBank size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Economia Potencial em Assinaturas</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          {count} {count === 1 ? 'assinatura pode' : 'assinaturas podem'} ser revisadas para
          economizar até <strong className="text-income">{formatCurrency(totalSavings)}/mês</strong>
          {' '}({formatCurrency(totalSavings * 12)}/ano).
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Subscription Row with Dismiss                                       */
/* ------------------------------------------------------------------ */

function SubscriptionRow({ 
  sub, 
  onDismiss, 
  onRestore,
  showDismiss = true,
}: { 
  sub: SubscriptionInfo
  onDismiss?: (description: string) => void
  onRestore?: (description: string) => void
  showDismiss?: boolean
}) {
  const tierColors: Record<string, string> = {
    essential: 'border-primary/20 bg-primary/[0.02]',
    discretionary: 'border-glass surface-glass-strong',
    can_cut: 'border-expense/20 bg-expense/[0.02]',
  }

  const tierLabels: Record<string, string> = {
    essential: 'Essencial',
    discretionary: 'Opcional',
    can_cut: 'Cortável',
  }

  const tierLabelColors: Record<string, string> = {
    essential: 'text-primary bg-primary/10',
    discretionary: 'text-secondary bg-secondary/10',
    can_cut: 'text-expense bg-expense/10',
  }

  return (
    <div className={cn(
      'flex items-center justify-between gap-2 px-3 py-2 rounded-xl border',
      tierColors[sub.tier] || 'border-glass surface-glass-strong',
      sub.isIgnored && 'opacity-40',
    )}>
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="w-7 h-7 rounded-lg bg-balance/10 text-balance flex items-center justify-center shrink-0">
          <CreditCard size={13} />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-bold text-primary truncate">{sub.description}</p>
            <span className={cn(
              'text-[7px] font-bold px-1 py-0.5 rounded-full uppercase shrink-0',
              tierLabelColors[sub.tier] || 'text-secondary bg-secondary/10',
            )}>
              {tierLabels[sub.tier]}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[9px] text-secondary">{sub.categoryName}</p>
            {sub.confidence > 0.7 && (
              <span className="text-[7px] text-income/60">✓ alta confiança</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-[11px] font-bold text-primary font-mono">{formatCurrency(sub.monthlyAmount)}</p>
          <p className="text-[8px] text-secondary/60">{formatCurrency(sub.annualAmount)}/ano</p>
        </div>

        {showDismiss && sub.tier !== 'essential' && !sub.isIgnored && (
          <button
            onClick={() => onDismiss?.(sub.description)}
            className="w-6 h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-secondary transition-colors shrink-0"
            title="Ignorar esta assinatura"
          >
            <X size={12} />
          </button>
        )}

        {sub.isIgnored && onRestore && (
          <button
            onClick={() => onRestore(sub.description)}
            className="w-6 h-6 rounded-lg hover:bg-secondary/10 flex items-center justify-center text-secondary/40 hover:text-income transition-colors shrink-0"
            title="Restaurar assinatura"
          >
            <Eye size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Subscriptions (main)                                      */
/* ------------------------------------------------------------------ */

function SubscriptionsSection({ 
  subscriptions, 
  totalAnnual,
  cuttableSubscriptions,
  totalCuttableSavingsMonthly,
}: { 
  subscriptions: SubscriptionInfo[]
  totalAnnual: number
  cuttableSubscriptions: SubscriptionInfo[]
  totalCuttableSavingsMonthly: number
}) {
  const navigate = useNavigate()
  const [showIgnored, setShowIgnored] = useState(false)

  // Força re-render ao ignorar/restaurar
  const [, forceUpdate] = useState(0)
  const refresh = useCallback(() => forceUpdate((n) => n + 1), [])

  if (subscriptions.length === 0) return null

  // Separa entre visíveis e ignoradas
  const visibleSubs = subscriptions.filter((s) => !s.isIgnored)
  const ignoredSubs = subscriptions.filter((s) => s.isIgnored)

  const handleDismiss = (description: string) => {
    ignoreSubscription(description)
    refresh()
  }

  const handleRestore = (description: string) => {
    restoreSubscription(description)
    refresh()
  }

  return (
    <div className="space-y-2.5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-glass/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Assinaturas e Gastos Recorrentes
          </span>
          <span className="text-[8px] font-bold text-balance bg-balance/10 px-1.5 py-0.5 rounded-md">
            {visibleSubs.length}
          </span>
        </div>
        <p className="text-[9px] text-secondary/70 font-mono">
          Total: <strong className="text-primary">{formatCurrency(totalAnnual)}</strong>/ano
        </p>
      </div>

      {/* ── Economia potencial banner ── */}
      <CuttableSubscriptionsBanner
        count={cuttableSubscriptions.length}
        totalSavings={totalCuttableSavingsMonthly}
      />

      {/* ── Lista de assinaturas visíveis ── */}
      <div className="space-y-1.5">
        {visibleSubs.slice(0, 6).map((sub) => (
          <SubscriptionRow
            key={`${sub.description}-${sub.monthlyAmount}`}
            sub={sub}
            onDismiss={handleDismiss}
          />
        ))}
      </div>

      {visibleSubs.length > 6 && (
        <p className="text-[9px] text-secondary/50 text-center">
          +{visibleSubs.length - 6} outras assinaturas detectadas
        </p>
      )}

      {/* ── Assinaturas ignoradas (recolhidas) ── */}
      {ignoredSubs.length > 0 && (
        <div className="space-y-1.5">
          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className="flex items-center gap-2 w-full text-left text-[9px] font-bold uppercase tracking-wider text-secondary/50 hover:text-secondary transition-colors py-1"
          >
            <EyeOff size={11} />
            {ignoredSubs.length} {ignoredSubs.length === 1 ? 'assinatura ignorada' : 'assinaturas ignoradas'}
            <ChevronRight size={11} className={cn(
              'transition-transform',
              showIgnored && 'rotate-90',
            )} />
          </button>

          {showIgnored && (
            <div className="space-y-1">
              {ignoredSubs.map((sub) => (
                <SubscriptionRow
                  key={`ignored-${sub.description}-${sub.monthlyAmount}`}
                  sub={sub}
                  onRestore={handleRestore}
                  showDismiss={false}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        onClick={() => navigate('/expenses')}
        variant="ghost"
        size="xs"
        className="w-full text-[9px] font-bold uppercase tracking-wider border border-dashed border-glass/50"
      >
        Revisar despesas recorrentes
        <ChevronRight size={12} />
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Savings Challenges                                        */
/* ------------------------------------------------------------------ */

function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const colors: Record<string, string> = {
    'fácil': 'bg-income/10 text-income',
    'médio': 'bg-warning/10 text-warning',
    'desafiador': 'bg-expense/10 text-expense',
  }
  const color = colors[difficulty] || 'bg-secondary/10 text-secondary'

  return (
    <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase', color)}>
      {difficulty}
    </span>
  )
}

function SavingsChallengesSection({ challenges, totalSavings }: { challenges: SavingsChallenge[]; totalSavings: number }) {
  const navigate = useNavigate()

  if (challenges.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-glass/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Desafios de Economia
          </span>
        </div>
        <p className="text-[9px] text-income font-mono">
          Potencial: <strong className="text-income">{formatCurrency(totalSavings)}</strong>/mês
        </p>
      </div>

      <div className="space-y-2">
        {challenges.slice(0, 3).map((challenge) => (
          <div
            key={challenge.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-xl border border-glass surface-glass-strong',
              'transition-all duration-200',
            )}
          >
            <span className="w-8 h-8 rounded-lg bg-income/10 text-income flex items-center justify-center shrink-0">
              <PiggyBank size={15} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-[11px] font-bold text-primary">{challenge.title}</h4>
                <DifficultyBadge difficulty={challenge.difficulty} />
              </div>
              <p className="text-[9px] text-secondary leading-relaxed">
                {challenge.description}
              </p>

              {/* Mini barra de progresso */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-income"
                    style={{ width: `${Math.min(100, (challenge.reductionPercent / 30) * 100)}%` }}
                  />
                </div>
                <span className="text-[8px] font-bold text-income font-mono shrink-0">
                  {formatCurrency(challenge.potentialSavings)}
                </span>
              </div>

              {/* Projeção anual */}
              {challenge.annualProjectedSavings > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="text-[7px] text-income/70 bg-income/[0.05] px-1.5 py-0.5 rounded-full">
                    🗓️ {formatCurrency(challenge.annualProjectedSavings)}/ano
                  </span>
                  <span className="text-[7px] text-secondary/50">
                    (12× {formatCurrency(challenge.potentialSavings)})
                  </span>
                </div>
              )}

              <Button
                onClick={() => {
                  if (challenge.action === 'navigate' && challenge.path) {
                    navigate(challenge.path)
                  } else {
                    navigate('/categories')
                  }
                }}
                variant="ghost"
                size="xs"
                className="mt-2 text-[8px] font-bold uppercase tracking-wider"
              >
                {challenge.action === 'set_limit' ? 'Definir limite' : 'Ver gastos'}
                <ArrowRight size={10} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Section: Limit Suggestions                                         */
/* ------------------------------------------------------------------ */

function getCategoryIconElement(name: string): React.ReactNode {
  return getCategoryIcon(name, 14)
}

function LimitSuggestionsSection({ suggestions }: { suggestions: LimitSuggestion[] }) {
  const navigate = useNavigate()

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-glass/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Ajustes de Limites
          </span>
          <span className="text-[8px] font-bold text-primary/60 bg-primary/10 px-1.5 py-0.5 rounded-md">
            {suggestions.length}
          </span>
        </div>
      </div>

      <div className="space-y-1.5">
        {suggestions.map((s) => (
          <div
            key={s.categoryId}
            className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-glass surface-glass-strong"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className={cn(
                'w-7 h-7 rounded-lg flex items-center justify-center shrink-0',
                s.type === 'increase' ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income',
              )}>
                {getCategoryIconElement(s.categoryName)}
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-primary truncate">{s.categoryName}</p>
                <p className="text-[8px] text-secondary">{s.reason}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={cn(
                'text-[11px] font-bold font-mono',
                s.type === 'increase' ? 'text-expense' : 'text-income',
              )}>
                {s.type === 'increase' ? '+' : '-'}{formatCurrency(Math.abs(s.difference))}
              </p>
              <p className="text-[8px] text-secondary/60">
                {formatCurrency(s.currentLimit)} → {formatCurrency(s.suggestedLimit)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Button
        onClick={() => navigate('/categories')}
        variant="ghost"
        size="xs"
        className="w-full text-[9px] font-bold uppercase tracking-wider border border-dashed border-glass/50"
      >
        Ajustar limites
        <ChevronRight size={12} />
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NEW: Income Concentration                                          */
/* ------------------------------------------------------------------ */

function IncomeConcentrationSection({ info }: { info: IncomeConcentrationInfo }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-expense/30 bg-expense/[0.03]">
      <span className="w-8 h-8 rounded-lg bg-expense/10 text-expense flex items-center justify-center shrink-0">
        <BarChart3 size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Concentração de Renda</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          <strong className="text-expense">{formatNumberWithTwoDecimalsBR(info.topSourcePercentage)}%</strong> da sua renda
          vem de <strong className="text-primary">{info.topSourceName}</strong>
          {' '}({formatCurrency(info.topSourceAmount)}). Considere diversificar para reduzir riscos.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NEW: Expense Trend vs Previous Month                                */
/* ------------------------------------------------------------------ */

function ExpenseTrendSection({ info }: { info: ExpenseTrendInfo }) {
  const isIncrease = info.isIncrease && info.isSignificant
  const isDecrease = !info.isIncrease && info.isSignificant

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border',
      isIncrease ? 'border-expense/30 bg-expense/[0.03]' :
        isDecrease ? 'border-income/30 bg-income/[0.03]' :
        'border-glass surface-glass-strong',
    )}>
      <span className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        isIncrease ? 'bg-expense/10 text-expense' :
          isDecrease ? 'bg-income/10 text-income' :
          'bg-secondary/10 text-secondary',
      )}>
        <Activity size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Gastos vs Mês Passado</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          {info.isIncrease ? (
            <>
              Gastos <strong className="text-expense">aumentaram {formatNumberWithTwoDecimalsBR(info.percentageChange)}%</strong>
              {' '}({formatCurrency(info.absoluteChange)}) em relação ao mês anterior.
              {info.isSignificant && ' Fique atento a este crescimento.'}
            </>
          ) : (
            <>
              Gastos <strong className="text-income">reduziram {formatNumberWithTwoDecimalsBR(Math.abs(info.percentageChange))}%</strong>
              {' '}({formatCurrency(info.absoluteChange)}) em relação ao mês anterior. Bom trabalho!
            </>
          )}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NEW: Weekend Spending                                              */
/* ------------------------------------------------------------------ */

function WeekendSpendingSection({ info }: { info: WeekendSpendingInfo }) {
  if (!info.isHigherOnWeekends) return null

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-warning/30 bg-warning/[0.03]">
      <span className="w-8 h-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
        <Coffee size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Gastos de Fim de Semana</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          Fim de semana gasta em média <strong className="text-warning">{formatCurrency(info.weekendAvg)}</strong>/dia
          {' '}vs <strong className="text-primary">{formatCurrency(info.weekdayAvg)}</strong>/dia em dias úteis
          {' '}({formatNumberWithTwoDecimalsBR(info.ratio)}x mais). Que tal planejar programas mais econômicos?
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NEW: Top Category Highlight                                        */
/* ------------------------------------------------------------------ */

function TopCategorySection({ info }: { info: TopCategoryInfo }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl border border-glass surface-glass-strong">
      <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {getCategoryIcon(info.name, 15)}
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Categoria Destaque</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          <strong className="text-primary">{info.name}</strong> é sua maior categoria de gasto,
          representando <strong className="text-expense">{formatNumberWithTwoDecimalsBR(info.percentageOfTotal)}%</strong>
          {' '}do total ({formatCurrency(info.total)}). Revise se este nível de gasto está alinhado com suas prioridades.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NEW: Savings Status                                                */
/* ------------------------------------------------------------------ */

function SavingsStatusSection({ info }: { info: SavingsStatusInfo }) {
  const colorMap: Record<string, string> = {
    crítico: 'border-expense/30 bg-expense/[0.03] text-expense',
    baixo: 'border-warning/30 bg-warning/[0.03] text-warning',
    moderado: 'border-primary/30 bg-primary/[0.03] text-primary',
    saudável: 'border-income/30 bg-income/[0.03] text-income',
    forte: 'border-income/40 bg-income/[0.05] text-income',
  }
  const iconColorMap: Record<string, string> = {
    crítico: 'bg-expense/10 text-expense',
    baixo: 'bg-warning/10 text-warning',
    moderado: 'bg-primary/10 text-primary',
    saudável: 'bg-income/10 text-income',
    forte: 'bg-income/10 text-income',
  }

  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border',
      colorMap[info.level] || 'border-glass surface-glass-strong',
    )}>
      <span className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        iconColorMap[info.level] || 'bg-secondary/10 text-secondary',
      )}>
        <PiggyBank size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Status da Poupança</h4>
        <p className={cn(
          'text-[9px] font-bold mt-0.5',
          colorMap[info.level]?.split(' ')[2] || 'text-secondary',
        )}>
          {info.label} ({formatNumberWithTwoDecimalsBR(info.rate)}%)
        </p>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          {info.suggestion}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  NEW: Investment Commitment                                         */
/* ------------------------------------------------------------------ */

function InvestmentCommitmentSection({ info }: { info: InvestmentCommitmentInfo }) {
  return (
    <div className={cn(
      'flex items-start gap-3 p-3 rounded-xl border',
      info.isAdequate ? 'border-income/30 bg-income/[0.03]' : 'border-warning/30 bg-warning/[0.03]',
    )}>
      <span className={cn(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        info.isAdequate ? 'bg-income/10 text-income' : 'bg-warning/10 text-warning',
      )}>
        <Landmark size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[11px] font-bold text-primary">Compromisso com Investimentos</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          {info.suggestion}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Empty State                                                        */
/* ------------------------------------------------------------------ */

function EmptyInsightsState() {
  return (
    <div className="py-6 text-center space-y-2">
      <Sparkles size={24} className="text-secondary/40 mx-auto" />
      <p className="text-[11px] font-bold text-secondary">Nenhum insight disponível</p>
      <p className="text-[9px] text-secondary/60 max-w-[260px] mx-auto">
        Adicione receitas e despesas nos próximos meses para receber análises inteligentes.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function InsightsCard({ insights }: InsightsCardProps) {
  const hasAnyInsight = insights.criticalAlert
    || insights.subscriptions.length > 0
    || insights.savingsChallenges.length > 0
    || insights.limitSuggestions.length > 0
    || insights.incomeConcentration
    || insights.expenseTrend
    || insights.weekendSpending
    || insights.topCategory
    || insights.savingsStatus
    || insights.investmentCommitment

  if (!hasAnyInsight) {
    return (
      <Card className={cn(CARD_BASE, CARD_PADDING_LARGE)}>
        <div className="flex items-center gap-2 border-b border-glass/40 pb-2.5 mb-3">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Centro de Economia
          </span>
        </div>
        <EmptyInsightsState />
      </Card>
    )
  }

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, 'space-y-4 relative overflow-hidden')}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-glass/40 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Centro de Economia
          </span>
        </div>

        {insights.totalPotentialSavings > 0 && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-income bg-income/10 px-2 py-1 rounded-lg">
            <PiggyBank size={11} />
            Economia potencial: {formatCurrency(insights.totalPotentialSavings)}/mês
          </div>
        )}
      </div>

      {/* ── Critical Alert ── */}
      {insights.criticalAlert && (
        <AlertSection alert={insights.criticalAlert} />
      )}

      {/* ── Grid de insights compactos (novos cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Top Category */}
        {insights.topCategory && (
          <TopCategorySection info={insights.topCategory} />
        )}

        {/* Income Concentration */}
        {insights.incomeConcentration && (
          <IncomeConcentrationSection info={insights.incomeConcentration} />
        )}

        {/* Expense Trend */}
        {insights.expenseTrend && (
          <ExpenseTrendSection info={insights.expenseTrend} />
        )}

        {/* Weekend Spending */}
        {insights.weekendSpending && (
          <WeekendSpendingSection info={insights.weekendSpending} />
        )}

        {/* Savings Status */}
        {insights.savingsStatus && (
          <SavingsStatusSection info={insights.savingsStatus} />
        )}

        {/* Investment Commitment */}
        {insights.investmentCommitment && (
          <InvestmentCommitmentSection info={insights.investmentCommitment} />
        )}
      </div>

      {/* ── Subscriptions ── */}
      {insights.subscriptions.length > 0 && (
        <SubscriptionsSection
          subscriptions={insights.subscriptions}
          totalAnnual={insights.totalSubscriptionsAnnual}
          cuttableSubscriptions={insights.cuttableSubscriptions}
          totalCuttableSavingsMonthly={insights.totalCuttableSavingsMonthly}
        />
      )}

      {/* ── Savings Challenges ── */}
      {insights.savingsChallenges.length > 0 && (
        <SavingsChallengesSection
          challenges={insights.savingsChallenges}
          totalSavings={insights.totalPotentialSavings}
        />
      )}

      {/* ── Limit Suggestions ── */}
      {insights.limitSuggestions.length > 0 && (
        <LimitSuggestionsSection suggestions={insights.limitSuggestions} />
      )}
    </Card>
  )
}
