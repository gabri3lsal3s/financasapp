import { useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X, TrendingDown } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import EmptyState from '@/components/EmptyState'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { formatCurrency, formatMoneyInput } from '@/utils/format'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
import { getStaggerClass } from '@/constants/animation'
import type { Category } from '@/types'

interface ExpenseCategoryGridProps {
  categories: Category[]
  expenseSpentByCategory: Map<string, number>
  expenseBaseByCategory: Map<string, number>
  expenseCategoryColorMap: Record<string, string>
  expenseLimitMap: Map<string, number | null>
  expensesKpis: { limitSum: number; spentSum: number; remaining: number; percentage: number }
  savingExpenseLimitIds: string[]
  editingCategoryId: string | null
  expenseLimitInputs: Record<string, string>
  averageIncome: number
  getCategoryPercentageSuggestion: (category: Category) => number
  onEditCategory: (category: Category) => void
  onDeleteCategory: (category: Category) => void
  onEditLimit: (categoryId: string) => void
  onSaveLimit: (categoryId: string) => Promise<void>
  onCancelEditLimit: () => void
  onSetLimitInput: (categoryId: string, value: string) => void
  onAddCategory: () => void
}

export default function ExpenseCategoryGrid(props: ExpenseCategoryGridProps) {
  const {
    categories,
    expenseSpentByCategory,
    expenseBaseByCategory,
    expenseCategoryColorMap,
    expenseLimitMap,
    expensesKpis,
    savingExpenseLimitIds,
    editingCategoryId,
    expenseLimitInputs,
    averageIncome,
    getCategoryPercentageSuggestion,
    onEditCategory,
    onDeleteCategory,
    onEditLimit,
    onSaveLimit,
    onCancelEditLimit,
    onSetLimitInput,
    onAddCategory,
  } = props

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      const limitA = expenseLimitMap.get(a.id)
      const limitB = expenseLimitMap.get(b.id)
      const spentA = expenseSpentByCategory.get(a.id) || 0
      const spentB = expenseSpentByCategory.get(b.id) || 0

      const hasLimitA = limitA !== null && limitA !== undefined
      const hasLimitB = limitB !== null && limitB !== undefined

      const exceededA = hasLimitA && spentA > (limitA || 0)
      const exceededB = hasLimitB && spentB > (limitB || 0)

      const exceededAmtA = exceededA ? spentA - (limitA || 0) : 0
      const exceededAmtB = exceededB ? spentB - (limitB || 0) : 0

      if (exceededA && !exceededB) return -1
      if (!exceededA && exceededB) return 1
      if (exceededA && exceededB) {
        return exceededAmtB - exceededAmtA
      }

      if (hasLimitA && !hasLimitB) return -1
      if (!hasLimitA && hasLimitB) return 1
      if (hasLimitA && hasLimitB) {
        const pctA = (limitA || 0) > 0 ? (spentA / (limitA || 1)) * 100 : 0
        const pctB = (limitB || 0) > 0 ? (spentB / (limitB || 1)) * 100 : 0
        if (Math.abs(pctA - pctB) > 0.01) return pctB - pctA
        return (limitB || 0) - (limitA || 0)
      }

      return spentB - spentA
    })
  }, [categories, expenseLimitMap, expenseSpentByCategory])

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* KPIs de Despesas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Limite Definido</span>
          <span className="text-base sm:text-lg font-extrabold font-mono text-primary mt-2">
            {formatCurrency(expensesKpis.limitSum)}
          </span>
        </Card>
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Total Gasto</span>
          <span className="text-base sm:text-lg font-extrabold font-mono text-primary mt-2">
            {formatCurrency(expensesKpis.spentSum)}
          </span>
        </Card>
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Disponível</span>
          <span className={`text-base sm:text-lg font-extrabold font-mono mt-2 ${expensesKpis.remaining >= 0 ? 'text-income' : 'text-expense'}`}>
            {formatCurrency(expensesKpis.remaining)}
          </span>
        </Card>
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Uso Geral</span>
            <span className="text-xs font-bold text-primary font-mono">{Math.round(expensesKpis.percentage)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary/15 mt-3 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500" 
              style={{ 
                width: `${Math.min(100, expensesKpis.percentage)}%`, 
                backgroundColor: expensesKpis.percentage > 100 ? 'var(--color-expense)' : expensesKpis.percentage >= 80 ? 'var(--color-warning)' : 'var(--color-income)' 
              }} 
            />
          </div>
        </Card>
      </div>

      {/* Lista de Categorias de Despesa */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-primary">Orçamentos e Progresso</h3>
          <span className="text-xs text-secondary">{categories.length} categorias</span>
        </div>

        {categories.length === 0 ? (
          <div className="pt-4">
            <EmptyState
              icon={<TrendingDown size={24} />}
              title="Nenhuma categoria de despesa"
              description="Crie seu primeiro orçamento para acompanhar seus gastos por categoria."
              action={{ label: 'Criar Orçamento', onClick: onAddCategory }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {sortedCategories.map((cat, index) => {
              const spent = expenseSpentByCategory.get(cat.id) || 0
              const limitAmount = expenseLimitMap.get(cat.id)
              const categoryColor = expenseCategoryColorMap[cat.id] || cat.color
              const hasLimit = limitAmount !== null && limitAmount !== undefined
              const exceeded = hasLimit && spent > (limitAmount || 0)
              const isSaving = savingExpenseLimitIds.includes(cat.id)
              const isEditing = editingCategoryId === cat.id

              const spentPct = hasLimit && limitAmount && limitAmount > 0 ? (spent / limitAmount) * 100 : 0

              let statusText = 'Sem limite'
              let badgeClass = 'text-secondary bg-secondary/10 border-glass'

              if (hasLimit) {
                if (exceeded) {
                  statusText = 'Excedido'
                  badgeClass = 'text-expense bg-expense/10 border-expense/25 font-bold'
                } else if (spentPct >= 80) {
                  statusText = 'Atenção'
                  badgeClass = 'text-warning bg-warning/10 border-warning/25 font-semibold'
                } else {
                  statusText = 'Sob controle'
                  badgeClass = 'text-income bg-income/10 border-income/25'
                }
              }

              return (
                <div
                  key={cat.id}
                  id={`item-${cat.id}`}
                  className={`group rounded-xl border p-4 bg-primary transition-all duration-300 flex flex-col justify-between gap-4 h-full animate-stagger-item ${
                    exceeded
                      ? 'border-expense/45 shadow-[0_0_12px_rgba(var(--color-expense-rgb),0.04)] bg-expense/5'
                      : 'border-glass surface-glass hover:border-glass-strong hover:scale-[1.005]'
                  } ${getStaggerClass(index)}`}
                >
                  <div className="space-y-3 flex-grow">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          style={{ color: categoryColor }}
                          className="flex items-center justify-center flex-shrink-0"
                        >
                          {getCategoryIcon(cat.name, 16, cat.color?.split('|')[1] || undefined)}
                        </span>
                        <p className="font-bold text-primary truncate text-sm">{cat.name}</p>
                        {cat.name !== 'Sem categoria' && (
                          <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity ml-1.5 flex-shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                onEditCategory(cat)
                              }}
                              className="p-1 h-auto w-auto text-secondary hover:text-primary transition-colors rounded hover:bg-secondary/10"
                              title="Editar nome"
                            >
                              <Pencil size={11} />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteCategory(cat)
                              }}
                              className="p-1 h-auto w-auto text-secondary hover:text-expense transition-colors rounded hover:bg-secondary/10"
                              title="Excluir categoria"
                            >
                              <Trash2 size={11} />
                            </Button>
                          </div>
                        )}
                      </div>
                      <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border ${badgeClass} flex-shrink-0`}>
                        {statusText}
                      </span>
                    </div>

                    <div className="space-y-2 pt-1">
                      <div className="flex justify-between items-end text-xs text-secondary">
                        <span>Gasto: <strong className="text-primary">{formatCurrency(spent)}</strong></span>
                        {hasLimit && (
                          <span className="font-mono text-[10px]">{Math.round(spentPct)}%</span>
                        )}
                      </div>
                      {(() => {
                        const base = expenseBaseByCategory.get(cat.id) || 0
                        if (base === spent) return null
                        return (
                          <p className="text-[9px] text-secondary/50 flex items-center gap-1">
                            <span>Valor base: {formatCurrency(base)}</span>
                            <InfoTooltip content={WEIGHT_TOOLTIPS.baseValueExpense} iconSize={8} />
                          </p>
                        )
                      })()}
                    </div>
                  </div>

                  <div className={`pt-3 border-t border-glass/30 flex ${isEditing ? 'flex-col items-stretch' : 'items-center justify-between'} gap-2 min-h-9 flex-shrink-0`}>
                    {isEditing ? (
                      <div className="space-y-1.5 w-full">
                        <div className="flex items-center gap-1.5 w-full">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={expenseLimitInputs[cat.id] || ''}
                            onChange={(event) => onSetLimitInput(cat.id, event.target.value)}
                            placeholder="Limite (ex: 500)"
                            className="w-full h-8 text-xs py-1"
                            autoFocus
                          />
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost-success"
                            onClick={async () => {
                              await onSaveLimit(cat.id)
                              onCancelEditLimit()
                            }}
                            disabled={isSaving}
                            className="h-8 w-8 p-0 flex items-center justify-center flex-shrink-0"
                          >
                          <Check size={14} />
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          onClick={onCancelEditLimit}
                          className="h-8 w-8 p-0 flex items-center justify-center flex-shrink-0 text-secondary"
                        >
                          <X size={14} />
                          </Button>
                        </div>
                        {averageIncome > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => {
                              const pct = getCategoryPercentageSuggestion(cat)
                              const calculated = Math.round((averageIncome * pct) / 1000) * 10
                              onSetLimitInput(cat.id, formatMoneyInput(calculated))
                            }}
                            className="h-auto p-0 text-[10px] text-left text-secondary hover:text-primary transition-colors flex items-center gap-1 mt-0.5 font-normal hover:bg-transparent"
                          >
                            <span>Sugerido:</span>
                            <span className="font-bold underline">
                              {formatCurrency(Math.round((averageIncome * getCategoryPercentageSuggestion(cat)) / 1000) * 10)}
                            </span>
                            <span>({getCategoryPercentageSuggestion(cat)}% da renda)</span>
                          </Button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-secondary truncate">
                          Limite: <span className="text-primary font-bold">{hasLimit ? formatCurrency(limitAmount) : 'Não definido'}</span>
                          {!hasLimit && averageIncome > 0 && (
                            <span className="text-[10px] text-secondary/70 block mt-0.5">
                              Sugestão: {formatCurrency(Math.round((averageIncome * getCategoryPercentageSuggestion(cat)) / 1000) * 10)}
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => onEditLimit(cat.id)}
                          className="h-7 px-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                        >
                          <Pencil size={10} />
                          <span>Definir</span>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}

            {categories.length < 15 && (
              <div
                onClick={onAddCategory}
                className="cursor-pointer flex flex-col items-center justify-center gap-2 p-4 bg-secondary/5 border border-dashed border-glass hover:border-glass-strong hover:bg-secondary/10 rounded-xl transition-all select-none animate-stagger-item h-full min-h-[140px] text-secondary hover:text-primary hover:scale-[1.002]"
              >
                <Plus size={20} className="text-secondary" />
                <span className="text-xs font-bold uppercase tracking-wider">Novo Orçamento</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
