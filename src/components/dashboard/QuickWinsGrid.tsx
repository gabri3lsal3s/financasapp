import { useState, useCallback } from 'react'
import { CheckCircle2, SlidersHorizontal, ArrowRightLeft, ArrowDown, Sparkles, X } from 'lucide-react'
import Card from '@/components/Card'
import { cn } from '@/lib/utils'
import { CARD_BASE, CARD_PADDING_LARGE } from '@/constants/layout'
import { formatCurrency } from '@/utils/format'
import Button from '@/components/Button'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface QuickCategoryInfo {
  id: string
  name: string
  spent: number
  limit: number | null
}

export interface LimitSuggestionInfo {
  categoryId: string
  categoryName: string
  currentLimit: number
  suggestedLimit: number
  difference: number
  type: 'increase' | 'decrease'
}

export interface QuickWinsGridProps {
  categories: QuickCategoryInfo[]
  reallocationRecommendation: {
    fromName: string
    toName: string
    transferAmount: number
  } | null
  limitSuggestions: LimitSuggestionInfo[]
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
  onReallocate: () => void
  isReallocating: boolean
}

/* ------------------------------------------------------------------ */
/*  Action Panel Wrapper                                               */
/* ------------------------------------------------------------------ */

function ActionPanel({
  icon,
  title,
  subtitle,
  colorClass,
  iconBgClass,
  children,
  isExpanded,
  onToggle,
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  colorClass: string
  iconBgClass: string
  children: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200 overflow-hidden',
      isExpanded ? 'border-primary/30 shadow-sm' : 'border-glass surface-glass-strong',
      colorClass,
    )}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-3 p-3 text-left cursor-pointer',
          'transition-colors duration-150',
          'hover:bg-secondary/5',
        )}
      >
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', iconBgClass)}>
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-[11px] font-bold text-primary">{title}</h4>
          <p className="text-[9px] text-secondary mt-0.5">{subtitle}</p>
        </div>
        <div className={cn(
          'w-5 h-5 rounded-full flex items-center justify-center transition-transform duration-200 shrink-0',
          isExpanded ? 'bg-primary/10 text-primary rotate-45' : 'bg-secondary/10 text-secondary',
        )}>
          <X size={11} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-glass/40 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Action 1: Ajustar Limite Manual                                   */
/* ------------------------------------------------------------------ */

function AdjustLimitAction({
  categories,
  onSetLimit,
}: {
  categories: QuickCategoryInfo[]
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
}) {
  const [selectedId, setSelectedId] = useState('')
  const [newLimit, setNewLimit] = useState('')
  const [applying, setApplying] = useState(false)
  const [done, setDone] = useState(false)

  const selected = categories.find(c => c.id === selectedId)

  const handleApply = useCallback(async () => {
    if (!selectedId || !newLimit) return
    const amount = parseFloat(newLimit.replace(',', '.'))
    if (isNaN(amount) || amount < 0) return

    setApplying(true)
    const res = await onSetLimit(selectedId, amount)
    setApplying(false)

    if (!res.error) {
      setDone(true)
      setTimeout(() => {
        setDone(false)
        setSelectedId('')
        setNewLimit('')
      }, 1500)
    }
  }, [selectedId, newLimit, onSetLimit])

  return (
    <div className="space-y-2">
      {/* Select categoria */}
      <div>
        <label className="text-[8px] font-bold uppercase tracking-wider text-secondary mb-1 block">
          Categoria
        </label>
        <select
          value={selectedId}
          onChange={(e) => {
            setSelectedId(e.target.value)
            setNewLimit('')
            setDone(false)
          }}
          className="w-full text-[11px] rounded-lg border border-glass bg-transparent text-primary px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors"
        >
          <option value="">Selecione...</option>
          {categories
            .filter(c => c.limit !== null && c.limit > 0)
            .map(c => (
              <option key={c.id} value={c.id}>
                {c.name} — limite atual: {formatCurrency(c.limit || 0)}
              </option>
            ))}
        </select>
      </div>

      {selected && (
        <div className="flex items-center gap-2 text-[9px] text-secondary">
          <span>Gasto atual: <strong className="text-primary">{formatCurrency(selected.spent)}</strong></span>
          <span>Limite: <strong className={selected.spent > (selected.limit || 0) ? 'text-expense' : 'text-income'}>
            {formatCurrency(selected.limit || 0)}
          </strong></span>
        </div>
      )}

      {/* Input novo limite */}
      {selectedId && (
        <div>
          <label className="text-[8px] font-bold uppercase tracking-wider text-secondary mb-1 block">
            Novo limite mensal
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.01"
              min="0"
              value={newLimit}
              onChange={(e) => { setNewLimit(e.target.value); setDone(false) }}
              placeholder={String(selected?.limit || 0)}
              className="flex-1 text-[11px] rounded-lg border border-glass bg-transparent text-primary px-2.5 py-1.5 outline-none focus:border-primary/50 transition-colors [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {done ? (
              <span className="flex items-center gap-1 text-[9px] font-bold text-income whitespace-nowrap">
                <CheckCircle2 size={12} /> Aplicado
              </span>
            ) : (
              <Button
                onClick={handleApply}
                disabled={applying || !newLimit}
                variant="primary"
                size="xs"
                className="whitespace-nowrap"
              >
                {applying ? 'Aplicando...' : 'Aplicar'}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Action 2: Remanejamento Inteligente                                */
/* ------------------------------------------------------------------ */

function ReallocationAction({
  recommendation,
  onReallocate,
  isReallocating,
}: {
  recommendation: NonNullable<QuickWinsGridProps['reallocationRecommendation']>
  onReallocate: () => void
  isReallocating: boolean
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-[9px] text-secondary">
        <div className="flex-1 rounded-lg border border-glass surface-glass-strong p-2 text-center">
          <p className="text-[8px] text-secondary uppercase font-bold tracking-wider">Origem</p>
          <p className="text-[10px] font-bold text-primary mt-0.5">{recommendation.fromName}</p>
          <p className="text-[9px] text-income font-mono">-{formatCurrency(recommendation.transferAmount)}</p>
        </div>
        <ArrowRightLeft size={14} className="text-secondary/50 shrink-0" />
        <div className="flex-1 rounded-lg border border-glass surface-glass-strong p-2 text-center">
          <p className="text-[8px] text-secondary uppercase font-bold tracking-wider">Destino</p>
          <p className="text-[10px] font-bold text-primary mt-0.5">{recommendation.toName}</p>
          <p className="text-[9px] text-expense font-mono">+{formatCurrency(recommendation.transferAmount)}</p>
        </div>
      </div>

      <Button
        onClick={onReallocate}
        disabled={isReallocating}
        variant="primary"
        size="xs"
        className="w-full text-[9px] font-bold uppercase tracking-wider"
      >
        {isReallocating ? 'Remanejando...' : `Remanejar R$ ${formatCurrency(recommendation.transferAmount)}`}
      </Button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Action 3: Redução Rápida (-10% / -20%)                            */
/* ------------------------------------------------------------------ */

function QuickReductionAction({
  categories,
  onSetLimit,
}: {
  categories: QuickCategoryInfo[]
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
}) {
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const nonEssentialCategories = categories.filter(c =>
    c.limit !== null && c.limit > 0 && c.spent > 20
  )

  const handleReduce = useCallback(async (cat: QuickCategoryInfo, pct: number) => {
    if (!cat.limit || cat.limit <= 0) return
    setApplyingId(cat.id)
    const newLimit = Math.round(cat.limit * (1 - pct / 100) * 100) / 100
    const res = await onSetLimit(cat.id, Math.max(newLimit, 10))
    setApplyingId(null)

    if (!res.error) {
      setDoneId(cat.id)
      setTimeout(() => setDoneId(null), 1500)
    }
  }, [onSetLimit])

  if (nonEssentialCategories.length === 0) {
    return (
      <p className="text-[9px] text-secondary/60 text-center py-2">
        Nenhuma categoria com limite para reduzir. Defina limites primeiro.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {nonEssentialCategories.slice(0, 3).map((cat) => {
        const limitReduction10 = Math.round((cat.limit || 0) * 0.1 * 100) / 100
        const limitReduction20 = Math.round((cat.limit || 0) * 0.2 * 100) / 100

        return (
          <div
            key={cat.id}
            className={cn(
              'flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border border-glass surface-glass-strong',
              doneId === cat.id && 'border-income/50 bg-income/[0.03]',
            )}
          >
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold text-primary truncate">{cat.name}</p>
              <p className="text-[8px] text-secondary">
                Limite: {formatCurrency(cat.limit || 0)} — Gasto: {formatCurrency(cat.spent)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {doneId === cat.id ? (
                <span className="text-[8px] font-bold text-income flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> Feito
                </span>
              ) : (
                <>
                  <Button
                    onClick={() => handleReduce(cat, 10)}
                    disabled={applyingId === cat.id}
                    variant="ghost"
                    size="xs"
                    className="text-[8px] font-bold border border-glass"
                  >
                    -10%<br /><span className="text-income">{formatCurrency(limitReduction10)}</span>
                  </Button>
                  <Button
                    onClick={() => handleReduce(cat, 20)}
                    disabled={applyingId === cat.id}
                    variant="ghost"
                    size="xs"
                    className="text-[8px] font-bold border border-glass"
                  >
                    -20%<br /><span className="text-income">{formatCurrency(limitReduction20)}</span>
                  </Button>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Action 4: Aplicar Sugestão do Motor                                */
/* ------------------------------------------------------------------ */

function ApplySuggestionAction({
  suggestions,
  onSetLimit,
}: {
  suggestions: LimitSuggestionInfo[]
  onSetLimit: (categoryId: string, amount: number) => Promise<{ error: string | null }>
}) {
  const [applyingId, setApplyingId] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  const handleApply = useCallback(async (s: LimitSuggestionInfo) => {
    setApplyingId(s.categoryId)
    const res = await onSetLimit(s.categoryId, s.suggestedLimit)
    setApplyingId(null)
    if (!res.error) {
      setDoneId(s.categoryId)
      setTimeout(() => setDoneId(null), 2000)
    }
  }, [onSetLimit])

  if (suggestions.length === 0) return null

  // Mostra apenas a sugestão mais relevante
  const top = suggestions[0]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-lg border border-glass surface-glass-strong">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-primary">{top.categoryName}</span>
            <span className={cn(
              'text-[8px] font-bold px-1 py-0.5 rounded',
              top.type === 'increase' ? 'bg-expense/10 text-expense' : 'bg-income/10 text-income',
            )}>
              {top.type === 'increase' ? '↑ Aumentar' : '↓ Reduzir'}
            </span>
          </div>
          <p className="text-[8px] text-secondary mt-0.5">
            {formatCurrency(top.currentLimit)} → {formatCurrency(top.suggestedLimit)}
            {' '}({top.type === 'increase' ? '+' : '-'}{formatCurrency(top.difference)})
          </p>
        </div>
        {doneId === top.categoryId ? (
          <span className="text-[8px] font-bold text-income flex items-center gap-0.5 shrink-0">
            <CheckCircle2 size={10} /> Aplicado
          </span>
        ) : (
          <Button
            onClick={() => handleApply(top)}
            disabled={applyingId === top.categoryId}
            variant="primary"
            size="xs"
            className="whitespace-nowrap"
          >
            {applyingId === top.categoryId ? '...' : 'Aplicar'}
          </Button>
        )}
      </div>

      {suggestions.length > 1 && (
        <p className="text-[8px] text-secondary/50 text-center">
          +{suggestions.length - 1} outra{suggestions.length > 2 ? 's' : ''} sugestão
        </p>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function QuickWinsGrid({
  categories,
  reallocationRecommendation,
  limitSuggestions,
  onSetLimit,
  onReallocate,
  isReallocating,
}: QuickWinsGridProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const toggle = (id: string) => {
    setExpandedId(prev => prev === id ? null : id)
  }

  return (
    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, 'space-y-2.5')}>
      <div className="flex items-center gap-2 border-b border-glass/40 pb-2.5">
        <Sparkles size={13} className="text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
          Ações de Otimização
        </span>
      </div>

      {/* Grid de 2 colunas no desktop, 1 no mobile com auto-fill para evitar grid gap quando faltam itens */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {/* Action 1: Ajustar Limite Manual */}
        <ActionPanel
          icon={<SlidersHorizontal size={16} />}
          title="Ajustar Limite Manual"
          subtitle="Defina um novo valor de limite para qualquer categoria"
          colorClass="hover:border-primary/20"
          iconBgClass="bg-primary/10 text-primary"
          isExpanded={expandedId === 'adjust'}
          onToggle={() => toggle('adjust')}
        >
          <AdjustLimitAction categories={categories} onSetLimit={onSetLimit} />
        </ActionPanel>

        {/* Action 2: Remanejamento Inteligente */}
        <ActionPanel
          icon={<ArrowRightLeft size={16} />}
          title="Remanejamento Inteligente"
          subtitle={
            reallocationRecommendation
              ? `De ${reallocationRecommendation.fromName} para ${reallocationRecommendation.toName}`
              : 'Nenhum remanejamento disponível no momento'
          }
          colorClass="hover:border-balance/20"
          iconBgClass="bg-balance/10 text-balance"
          isExpanded={expandedId === 'reallocate'}
          onToggle={() => toggle('reallocate')}
        >
          {reallocationRecommendation ? (
            <ReallocationAction
              recommendation={reallocationRecommendation}
              onReallocate={onReallocate}
              isReallocating={isReallocating}
            />
          ) : (
            <p className="text-[9px] text-secondary/60 text-center py-2">
              Categorias com saldo disponível para remanejamento serão exibidas aqui.
            </p>
          )}
        </ActionPanel>

        {/* Action 3: Redução Rápida */}
        <ActionPanel
          icon={<ArrowDown size={16} />}
          title="Redução Rápida"
          subtitle="Reduza limites de categorias em 10% ou 20% com um clique"
          colorClass="hover:border-income/20"
          iconBgClass="bg-income/10 text-income"
          isExpanded={expandedId === 'reduce'}
          onToggle={() => toggle('reduce')}
        >
          <QuickReductionAction categories={categories} onSetLimit={onSetLimit} />
        </ActionPanel>

        {/* Action 4: Aplicar Sugestão do Motor */}
        {limitSuggestions.length > 0 && (
          <ActionPanel
            icon={<Sparkles size={16} />}
            title="Sugestão do Motor"
            subtitle={
              limitSuggestions[0]
                ? `${limitSuggestions[0].categoryName}: ${formatCurrency(limitSuggestions[0].currentLimit)} → ${formatCurrency(limitSuggestions[0].suggestedLimit)}`
                : 'Nenhuma sugestão disponível'
            }
            colorClass="hover:border-warning/20"
            iconBgClass="bg-warning/10 text-warning"
            isExpanded={expandedId === 'suggestion'}
            onToggle={() => toggle('suggestion')}
          >
            <ApplySuggestionAction suggestions={limitSuggestions} onSetLimit={onSetLimit} />
          </ActionPanel>
        )}
      </div>
    </Card>
  )
}
