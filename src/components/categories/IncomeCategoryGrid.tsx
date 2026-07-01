import { useMemo } from 'react'
import { Plus, Pencil, Trash2, Check, X, TrendingUp } from 'lucide-react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import EmptyState from '@/components/EmptyState'
import { getCategoryIcon } from '@/utils/categoryIcons'
import { formatCurrency } from '@/utils/format'
import InfoTooltip from '@/components/InfoTooltip'
import { WEIGHT_TOOLTIPS } from '@/constants/tooltips'
import { getStaggerClass } from '@/constants/animation'
import type { IncomeCategory } from '@/types'

interface IncomeCategoryGridProps {
  incomeCategories: IncomeCategory[]
  incomeByCategory: Map<string, number>
  incomeBaseByCategory: Map<string, number>
  incomeCategoryColorMap: Record<string, string>
  incomeExpectationMap: Map<string, number | null>
  incomesKpis: { expectationSum: number; receivedSum: number; remaining: number; percentage: number }
  savingIncomeExpectationIds: string[]
  editingCategoryId: string | null
  incomeExpectationInputs: Record<string, string>
  onEditCategory: (category: IncomeCategory) => void
  onDeleteCategory: (category: IncomeCategory) => void
  onEditExpectation: (categoryId: string) => void
  onSaveExpectation: (incomeCategoryId: string) => Promise<void>
  onCancelEditExpectation: () => void
  onSetExpectationInput: (categoryId: string, value: string) => void
  onAddCategory: () => void
}

export default function IncomeCategoryGrid(props: IncomeCategoryGridProps) {
  const {
    incomeCategories,
    incomeByCategory,
    incomeBaseByCategory,
    incomeCategoryColorMap,
    incomeExpectationMap,
    incomesKpis,
    savingIncomeExpectationIds,
    editingCategoryId,
    incomeExpectationInputs,
    onEditCategory,
    onDeleteCategory,
    onEditExpectation,
    onSaveExpectation,
    onCancelEditExpectation,
    onSetExpectationInput,
    onAddCategory,
  } = props

  const sortedIncomeCategories = useMemo(() => {
    return [...incomeCategories].sort((a, b) => {
      const expectationA = incomeExpectationMap.get(a.id)
      const expectationB = incomeExpectationMap.get(b.id)
      const receivedA = incomeByCategory.get(a.id) || 0
      const receivedB = incomeByCategory.get(b.id) || 0

      const hasExpectationA = expectationA !== null && expectationA !== undefined
      const hasExpectationB = expectationB !== null && expectationB !== undefined

      const reachedA = hasExpectationA && receivedA >= (expectationA || 0)
      const reachedB = hasExpectationB && receivedB >= (expectationB || 0)

      const deficitA = hasExpectationA && !reachedA ? (expectationA || 0) - receivedA : 0
      const deficitB = hasExpectationB && !reachedB ? (expectationB || 0) - receivedB : 0

      if (deficitA > 0 && deficitB === 0) return -1
      if (deficitA === 0 && deficitB > 0) return 1
      if (deficitA > 0 && deficitB > 0) {
        return deficitB - deficitA
      }

      if (hasExpectationA && !hasExpectationB) return -1
      if (!hasExpectationA && hasExpectationB) return 1
      if (hasExpectationA && hasExpectationB) {
        return (expectationB || 0) - (expectationA || 0)
      }

      return receivedB - receivedA
    })
  }, [incomeCategories, incomeExpectationMap, incomeByCategory])

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* KPIs de Rendas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 items-stretch">
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Expectativa Total</span>
          <span className="text-base sm:text-lg font-extrabold font-mono text-primary mt-2">
            {formatCurrency(incomesKpis.expectationSum)}
          </span>
        </Card>
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Total Recebido</span>
          <span className="text-base sm:text-lg font-extrabold font-mono text-primary mt-2">
            {formatCurrency(incomesKpis.receivedSum)}
          </span>
        </Card>
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Meta Restante</span>
          <span className={`text-base sm:text-lg font-extrabold font-mono mt-2 ${incomesKpis.remaining <= 0 ? 'text-income' : 'text-warning'}`}>
            {formatCurrency(Math.max(0, incomesKpis.remaining))}
          </span>
        </Card>
        <Card className="p-4 border border-glass surface-glass flex flex-col justify-between shadow-sm hover:shadow-md">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">Meta Atingida</span>
            <span className="text-xs font-bold text-primary font-mono">{Math.round(incomesKpis.percentage)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-secondary/15 mt-3 overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500" 
              style={{ 
                width: `${Math.min(100, incomesKpis.percentage)}%`, 
                backgroundColor: 'var(--color-income)' 
              }} 
            />
          </div>
        </Card>
      </div>

      {/* Lista de Categorias de Renda */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-primary">Metas e Progresso</h3>
          <span className="text-xs text-secondary">{incomeCategories.length} categorias</span>
        </div>

        {incomeCategories.length === 0 ? (
          <div className="pt-4">
            <EmptyState
              icon={<TrendingUp size={24} />}
              title="Nenhuma categoria de renda"
              description="Crie sua primeira meta de renda para definir expectativas e acompanhar recebimentos."
              action={{ label: 'Criar Meta', onClick: onAddCategory }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {sortedIncomeCategories.map((cat, index) => {
              const received = incomeByCategory.get(cat.id) || 0
              const expectationAmount = incomeExpectationMap.get(cat.id)
              const categoryColor = incomeCategoryColorMap[cat.id] || cat.color
              const hasExpectation = expectationAmount !== null && expectationAmount !== undefined
              const exceeded = hasExpectation && received >= (expectationAmount || 0)
              const isSaving = savingIncomeExpectationIds.includes(cat.id)
              const isEditing = editingCategoryId === cat.id

              const receivedPct = hasExpectation && expectationAmount && expectationAmount > 0 ? (received / expectationAmount) * 100 : 0

              let statusText = 'Sem expectativa'
              let badgeClass = 'text-secondary bg-secondary/10 border-glass'

              if (hasExpectation) {
                if (exceeded) {
                  statusText = 'Alcançada'
                  badgeClass = 'text-income bg-income/10 border-income/25 font-bold'
                } else {
                  statusText = 'Em progresso'
                  badgeClass = 'text-secondary bg-secondary/10 border-glass font-medium'
                }
              }

              return (
                <div
                  key={cat.id}
                  id={`item-${cat.id}`}
                  className={`group rounded-xl border p-4 bg-primary transition-all duration-300 flex flex-col justify-between gap-4 h-full animate-stagger-item ${
                    exceeded
                      ? 'border-income/45 shadow-[0_0_12px_rgba(var(--color-income-rgb),0.04)] bg-income/5'
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
                        <span>Recebido: <strong className="text-primary">{formatCurrency(received)}</strong></span>
                        {hasExpectation && (
                          <span className="font-mono text-[10px]">{Math.round(receivedPct)}%</span>
                        )}
                      </div>
                      {(() => {
                        const base = incomeBaseByCategory.get(cat.id) || 0
                        if (base === received) return null
                        return (
                          <p className="text-[9px] text-secondary/50 flex items-center gap-1">
                            <span>Valor base: {formatCurrency(base)}</span>
                            <InfoTooltip content={WEIGHT_TOOLTIPS.baseValueIncome} iconSize={8} />
                          </p>
                        )
                      })()}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-glass/30 flex items-center justify-between gap-2 h-9 flex-shrink-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={incomeExpectationInputs[cat.id] || ''}
                          onChange={(event) => onSetExpectationInput(cat.id, event.target.value)}
                          placeholder="Meta (ex: 2000)"
                          className="w-full h-8 text-xs py-1"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost-success"
                          onClick={async () => {
                            await onSaveExpectation(cat.id)
                            onCancelEditExpectation()
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
                          onClick={onCancelEditExpectation}
                          className="h-8 w-8 p-0 flex items-center justify-center flex-shrink-0 text-secondary"
                        >
                          <X size={14} />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="text-xs text-secondary truncate">
                          Expectativa: <span className="text-primary font-bold">{hasExpectation ? formatCurrency(expectationAmount) : 'Não definida'}</span>
                        </div>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          onClick={() => onEditExpectation(cat.id)}
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

            {incomeCategories.length < 15 && (
              <div
                onClick={onAddCategory}
                className="cursor-pointer flex flex-col items-center justify-center gap-2 p-4 bg-secondary/5 border border-dashed border-glass hover:border-glass-strong hover:bg-secondary/10 rounded-xl transition-all select-none animate-stagger-item h-full min-h-[140px] text-secondary hover:text-primary hover:scale-[1.002]"
              >
                <Plus size={20} className="text-secondary" />
                <span className="text-xs font-bold uppercase tracking-wider">Nova Meta</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
