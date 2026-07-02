import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import Card from '@/components/Card'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { formatCurrency } from '@/utils/format'
import Button from '@/components/Button'
import { getCategoryIcon } from '@/utils/categoryIcons'
import {
  AlertTriangle, TrendingUp, Sparkles, PiggyBank,
  CheckCircle2, CreditCard, ArrowRight, ChevronRight,
} from 'lucide-react'
import type { StructuredInsights, SubscriptionInfo, SavingsChallenge, LimitSuggestion } from '@/services/insightsEngine'

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
/*  Section: Subscriptions                                             */
/* ------------------------------------------------------------------ */

function SubscriptionRow({ sub }: { sub: SubscriptionInfo }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-glass surface-glass-strong">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="w-7 h-7 rounded-lg bg-balance/10 text-balance flex items-center justify-center shrink-0">
          <CreditCard size={13} />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-primary truncate">{sub.description}</p>
          <p className="text-[9px] text-secondary">{sub.categoryName}</p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[11px] font-bold text-primary font-mono">{formatCurrency(sub.monthlyAmount)}</p>
        <p className="text-[8px] text-secondary/60">{formatCurrency(sub.annualAmount)}/ano</p>
      </div>
    </div>
  )
}

function SubscriptionsSection({ subscriptions, totalAnnual }: { subscriptions: SubscriptionInfo[]; totalAnnual: number }) {
  const navigate = useNavigate()

  if (subscriptions.length === 0) return null

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between border-b border-glass/40 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Assinaturas Detectadas
          </span>
          <span className="text-[8px] font-bold text-balance bg-balance/10 px-1.5 py-0.5 rounded-md">
            {subscriptions.length}
          </span>
        </div>
        <p className="text-[9px] text-secondary/70 font-mono">
          Total: <strong className="text-primary">{formatCurrency(totalAnnual)}</strong>/ano
        </p>
      </div>

      <div className="space-y-1.5">
        {subscriptions.slice(0, 4).map((sub) => (
          <SubscriptionRow key={`${sub.description}-${sub.monthlyAmount}`} sub={sub} />
        ))}
      </div>

      {subscriptions.length > 4 && (
        <p className="text-[9px] text-secondary/50 text-center">
          +{subscriptions.length - 4} outras assinaturas detectadas
        </p>
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
  const colors = {
    'fácil': 'bg-income/10 text-income',
    'médio': 'bg-warning/10 text-warning',
    'desafiador': 'bg-expense/10 text-expense',
  }
  const color = colors[difficulty as keyof typeof colors] || 'bg-secondary/10 text-secondary'

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
  const hasAnyInsight = insights.criticalAlert || insights.subscriptions.length > 0
    || insights.savingsChallenges.length > 0 || insights.limitSuggestions.length > 0

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

      {/* ── Subscriptions ── */}
      {insights.subscriptions.length > 0 && (
        <SubscriptionsSection
          subscriptions={insights.subscriptions}
          totalAnnual={insights.totalSubscriptionsAnnual}
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
