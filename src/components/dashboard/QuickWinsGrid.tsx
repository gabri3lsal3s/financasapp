import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CreditCard, PiggyBank, SlidersHorizontal, ArrowDown, ArrowRightLeft,
  Sparkles, Coffee, Landmark, CheckCircle2,
} from 'lucide-react'
import Card from '@/components/Card'
import { cn } from '@/lib/utils'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { formatCurrency } from '@/utils/format'
import Button from '@/components/Button'
import type { OptimizationSuggestion, OptimizationSummary } from '@/services/optimizationSuggestionsEngine'
import { ignoreSubscription } from '@/utils/ignoredSubscriptions'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QuickWinsGridProps {
  optimizationSummary: OptimizationSummary
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
  onReallocate: (fromId: string, toId: string, amount: number) => Promise<void>
  onRefreshInsights: () => void
}

/* ------------------------------------------------------------------ */
/*  Ícone helper                                                       */
/* ------------------------------------------------------------------ */

const iconMap: Record<string, React.ReactNode> = {
  CreditCard: <CreditCard size={16} />,
  PiggyBank: <PiggyBank size={16} />,
  SlidersHorizontal: <SlidersHorizontal size={16} />,
  ArrowDown: <ArrowDown size={16} />,
  ArrowRightLeft: <ArrowRightLeft size={16} />,
  Coffee: <Coffee size={16} />,
  Landmark: <Landmark size={16} />,
  Sparkles: <Sparkles size={16} />,
}

function getIcon(name: string): React.ReactNode {
  return iconMap[name] || <Sparkles size={16} />
}

/* ------------------------------------------------------------------ */
/*  Badge helper                                                       */
/* ------------------------------------------------------------------ */

function SuggestionBadge({ text, variant }: { text: string; variant: string }) {
  const colorMap: Record<string, string> = {
    income: 'bg-income/10 text-income border-income/20',
    expense: 'bg-expense/10 text-expense border-expense/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    info: 'bg-balance/10 text-balance border-balance/20',
  }
  return (
    <span className={cn(
      'text-[8px] font-bold px-1.5 py-0.5 rounded-full border shrink-0',
      colorMap[variant] || 'bg-secondary/10 text-secondary border-secondary/20',
    )}>
      {text}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/*  Summary Banner                                                     */
/* ------------------------------------------------------------------ */

function SavingsSummaryBanner({ totalMonthly, totalAnnual }: { totalMonthly: number; totalAnnual: number }) {
  if (totalMonthly <= 0 && totalAnnual <= 0) return null
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-income/30 bg-gradient-to-r from-income/[0.03] to-income/[0.06]">
      <span className="w-9 h-9 rounded-xl bg-income/10 text-income flex items-center justify-center shrink-0">
        <PiggyBank size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <h4 className="text-[10px] font-bold text-primary">Potencial de Economia</h4>
        <p className="text-[9px] text-secondary leading-relaxed mt-0.5">
          {totalMonthly > 0 && (
            <span>Economia mensal: <strong className="text-income">{formatCurrency(totalMonthly)}</strong></span>
          )}
          {totalAnnual > 0 && (
            <span> — Projeção anual: <strong className="text-income">{formatCurrency(totalAnnual)}</strong></span>
          )}
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Action Button Handler                                              */
/* ------------------------------------------------------------------ */

function ActionButton({
  suggestion,
  onSetLimit,
  onReallocate,
  onRefreshInsights,
  onDone,
  isDoing,
}: {
  suggestion: OptimizationSuggestion
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
  onReallocate: (fromId: string, toId: string, amount: number) => Promise<void>
  onRefreshInsights: () => void
  onDone: () => void
  isDoing: boolean
}) {
  const navigate = useNavigate()

  const handleClick = useCallback(async () => {
    const act = suggestion.action

    switch (act.type) {
      case 'set_limit':
      case 'create_limit': {
        const res = await onSetLimit(act.categoryId, act.suggestedAmount)
        if (!res.error) {
          onDone()
          onRefreshInsights()
        }
        break
      }
      case 'reallocate': {
        await onReallocate(act.fromId, act.toId, act.amount)
        onDone()
        onRefreshInsights()
        break
      }
      case 'navigate': {
        navigate(act.path)
        break
      }
      case 'ignore_subscription': {
        ignoreSubscription(act.description)
        onDone()
        onRefreshInsights()
        break
      }
    }
  }, [suggestion, onSetLimit, onReallocate, onRefreshInsights, onDone, navigate])

  const label = suggestion.action.type === 'navigate'
    ? 'Ver'
    : suggestion.action.type === 'ignore_subscription'
      ? 'Ignorar'
      : 'Aplicar'

  return (
    <Button
      onClick={handleClick}
      disabled={isDoing}
      variant={suggestion.action.type === 'navigate' ? 'ghost' : 'primary'}
      size="xs"
      className="text-[8px] font-bold uppercase tracking-wider whitespace-nowrap"
    >
      {isDoing ? '...' : label}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/*  Suggestion Card                                                    */
/* ------------------------------------------------------------------ */

function SuggestionCard({
  suggestion,
  onSetLimit,
  onReallocate,
  onRefreshInsights,
}: {
  suggestion: OptimizationSuggestion
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
  onReallocate: (fromId: string, toId: string, amount: number) => Promise<void>
  onRefreshInsights: () => void
}) {
  const [done, setDone] = useState(false)
  const [doing, setDoing] = useState(false)

  const handleDone = useCallback(() => {
    setDoing(false)
    setDone(true)
    setTimeout(() => setDone(false), 2000)
  }, [])

  // Mapeamento de cor baseado no ícone
  const colorMap: Record<string, { border: string; icon: string }> = {
    CreditCard: { border: 'border-expense/20', icon: 'bg-expense/10 text-expense' },
    PiggyBank: { border: 'border-income/20', icon: 'bg-income/10 text-income' },
    SlidersHorizontal: { border: 'border-primary/20', icon: 'bg-primary/10 text-primary' },
    ArrowDown: { border: 'border-income/20', icon: 'bg-income/10 text-income' },
    ArrowRightLeft: { border: 'border-balance/20', icon: 'bg-balance/10 text-balance' },
    Coffee: { border: 'border-warning/20', icon: 'bg-warning/10 text-warning' },
    Landmark: { border: 'border-balance/20', icon: 'bg-balance/10 text-balance' },
  }
  const colors = colorMap[suggestion.icon] || { border: 'border-glass', icon: 'bg-secondary/10 text-secondary' }

  return (
    <div className={cn(
      'flex items-start gap-2.5 px-3 py-2.5 rounded-xl border transition-all duration-200',
      done ? 'border-income/40 bg-income/[0.04]' : 'border-glass surface-glass-strong hover:border-glass-strong',
      colors.border,
    )}>
      <span className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', colors.icon)}>
        {getIcon(suggestion.icon)}
      </span>

      <div className="min-w-0 flex-1 space-y-1">
        {/* Título + badge */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <h4 className="text-[10px] font-bold text-primary">{suggestion.title}</h4>
          {suggestion.badge && (
            <SuggestionBadge text={suggestion.badge.text} variant={suggestion.badge.variant} />
          )}
        </div>

        {/* Descrição */}
        <p className="text-[8px] text-secondary leading-relaxed">
          {suggestion.description}
        </p>

        {/* Economia projetada */}
        {(suggestion.monthlySavings > 0 || suggestion.annualProjectedSavings > 0) && (
          <div className="flex items-center gap-2 text-[7px] text-income/70">
            {suggestion.monthlySavings > 0 && (
              <span className="bg-income/[0.05] px-1.5 py-0.5 rounded-full">
                📅 {formatCurrency(suggestion.monthlySavings)}/mês
              </span>
            )}
            {suggestion.annualProjectedSavings > 0 && (
              <span className="bg-income/[0.05] px-1.5 py-0.5 rounded-full">
                🗓️ {formatCurrency(suggestion.annualProjectedSavings)}/ano
              </span>
            )}
          </div>
        )}

        {/* Botão de ação */}
        <div className="pt-1">
          {done ? (
            <span className="inline-flex items-center gap-1 text-[8px] font-bold text-income">
              <CheckCircle2 size={10} /> Aplicado
            </span>
          ) : (
            <ActionButton
              suggestion={suggestion}
              onSetLimit={onSetLimit}
              onReallocate={onReallocate}
              onRefreshInsights={onRefreshInsights}
              onDone={handleDone}
              isDoing={doing}
            />
          )}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function QuickWinsGrid({
  optimizationSummary,
  onSetLimit,
  onReallocate,
  onRefreshInsights,
}: QuickWinsGridProps) {
  const { suggestions, totalMonthlySavings, totalAnnualProjectedSavings, hasActionableSuggestions } = optimizationSummary

  // Só renderiza se houver sugestões acionáveis
  if (!hasActionableSuggestions || suggestions.length === 0) {
    // Retorna null para não ocupar espaço no Dashboard
    return null
  }

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, 'space-y-3')}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-glass/40 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles size={13} className="text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Ações de Otimização
          </span>
          {suggestions.length > 0 && (
            <span className="text-[8px] font-bold bg-primary/10 text-primary/60 px-1.5 py-0.5 rounded-md">
              {suggestions.length}
            </span>
          )}
        </div>
      </div>

      {/* ── Summary Banner ── */}
      <SavingsSummaryBanner
        totalMonthly={totalMonthlySavings}
        totalAnnual={totalAnnualProjectedSavings}
      />

      {/* ── Sugestões ── */}
      <div className="space-y-2">
        {suggestions.map((sug) => (
          <SuggestionCard
            key={sug.id}
            suggestion={sug}
            onSetLimit={onSetLimit}
            onReallocate={onReallocate}
            onRefreshInsights={onRefreshInsights}
          />
        ))}
      </div>
    </Card>
  )
}
