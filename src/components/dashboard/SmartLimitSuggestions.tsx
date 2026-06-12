import { useState, useMemo, useEffect } from 'react'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import { Sparkles, ArrowRightLeft, Check, AlertCircle } from 'lucide-react'

interface Category {
  id: string
  name: string
  color?: string
}

interface Expense {
  category_id: string
  amount: number
  report_weight?: number | null
}

interface Limit {
  category_id: string
  limit_amount: number | null
}

interface SmartLimitSuggestionsProps {
  currentMonth: string
  previousMonth: string
  categories: Category[]
  currentMonthExpenses: Expense[]
  previousMonthExpenses: Expense[]
  currentMonthLimits: Limit[]
  previousMonthIncomeTotal: number
  onSetLimit: (categoryId: string, amount: number | null) => Promise<{ data: unknown; error: string | null }>
  onRefreshLimits: () => void
}

export default function SmartLimitSuggestions({
  currentMonth,
  categories,
  currentMonthExpenses,
  previousMonthExpenses,
  currentMonthLimits,
  previousMonthIncomeTotal,
  onSetLimit,
  onRefreshLimits,
}: SmartLimitSuggestionsProps) {
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({})
  const [isSavingMap, setIsSavingMap] = useState<Record<string, boolean>>({})
  const [isReallocating, setIsReallocating] = useState(false)

  // Map limits
  const currentLimitsMap = useMemo(() => {
    const map = new Map<string, number>()
    currentMonthLimits.forEach((l) => {
      if (l.limit_amount !== null && l.limit_amount !== undefined) {
        map.set(l.category_id, l.limit_amount)
      }
    })
    return map
  }, [currentMonthLimits])

  // Map expenses
  const spentMap = useMemo(() => {
    const map = new Map<string, number>()
    currentMonthExpenses.forEach((e) => {
      const weight = e.report_weight ?? 1
      map.set(e.category_id, (map.get(e.category_id) || 0) + e.amount * weight)
    })
    return map
  }, [currentMonthExpenses])

  // Map previous month expenses
  const prevSpentMap = useMemo(() => {
    const map = new Map<string, number>()
    previousMonthExpenses.forEach((e) => {
      const weight = e.report_weight ?? 1
      map.set(e.category_id, (map.get(e.category_id) || 0) + e.amount * weight)
    })
    return map
  }, [previousMonthExpenses])

  // 1. Categories without limits
  const categoriesWithoutLimits = useMemo(() => {
    return categories
      .filter((cat) => !currentLimitsMap.has(cat.id))
      .map((cat) => {
        const prevSpent = prevSpentMap.get(cat.id) || 0
        const currentSpent = spentMap.get(cat.id) || 0

        // Default suggestion percentage
        let defaultPercent = 10
        if (previousMonthIncomeTotal > 0) {
          if (prevSpent > 0) {
            defaultPercent = Math.max(1, Math.round((prevSpent / previousMonthIncomeTotal) * 100))
          } else {
            defaultPercent = Math.max(1, Math.round(100 / (categories.length || 1)))
          }
        }

        return {
          ...cat,
          prevSpent,
          currentSpent,
          defaultPercent,
        }
      })
  }, [categories, currentLimitsMap, prevSpentMap, spentMap, previousMonthIncomeTotal])

  // Set default percent inputs when list changes
  useEffect(() => {
    const nextInputs: Record<string, string> = { ...percentInputs }
    categoriesWithoutLimits.forEach((item) => {
      if (nextInputs[item.id] === undefined) {
        nextInputs[item.id] = String(item.defaultPercent)
      }
    })
    setPercentInputs(nextInputs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesWithoutLimits])

  // 2. Reallocation Recommendation Logic
  const reallocationRecommendation = useMemo(() => {
    const exceededList: Array<{ id: string; name: string; exceeded: number; limit: number }> = []
    const surplusList: Array<{ id: string; name: string; surplus: number; limit: number }> = []

    categories.forEach((cat) => {
      const limit = currentLimitsMap.get(cat.id)
      const spent = spentMap.get(cat.id) || 0
      if (limit !== undefined && limit > 0) {
        if (spent > limit) {
          exceededList.push({ id: cat.id, name: cat.name, exceeded: spent - limit, limit })
        } else if (limit > spent) {
          surplusList.push({ id: cat.id, name: cat.name, surplus: limit - spent, limit })
        }
      }
    })

    if (exceededList.length === 0 || surplusList.length === 0) {
      return null
    }

    // Sort to find biggest exceeded and biggest surplus
    exceededList.sort((a, b) => b.exceeded - a.exceeded)
    surplusList.sort((a, b) => b.surplus - a.surplus)

    const targetTo = exceededList[0]
    const targetFrom = surplusList[0]

    // We can transfer the minimum of the exceeded amount and the surplus
    let amountToTransfer = Math.min(targetTo.exceeded, targetFrom.surplus)
    // Round to nearest 10 for cleaner numbers
    amountToTransfer = Math.max(10, Math.round(amountToTransfer / 10) * 10)

    if (amountToTransfer < 10) return null

    return {
      fromId: targetFrom.id,
      fromName: targetFrom.name,
      fromCurrentLimit: targetFrom.limit,
      toId: targetTo.id,
      toName: targetTo.name,
      toCurrentLimit: targetTo.limit,
      exceededAmount: targetTo.exceeded,
      transferAmount: amountToTransfer,
    }
  }, [categories, currentLimitsMap, spentMap])

  // Callbacks
  const handleSaveLimit = async (categoryId: string) => {
    const rawPct = percentInputs[categoryId] || '10'
    const pct = parseFloat(rawPct)
    if (Number.isNaN(pct) || pct <= 0 || pct > 100) {
      alert('Informe um percentual válido entre 1% e 100%.')
      return
    }

    const calculatedLimit = (previousMonthIncomeTotal * pct) / 100
    const roundedLimit = Math.round(calculatedLimit / 10) * 10 // Round to nearest 10

    setIsSavingMap((prev) => ({ ...prev, [categoryId]: true }))
    const { error } = await onSetLimit(categoryId, roundedLimit)
    setIsSavingMap((prev) => ({ ...prev, [categoryId]: false }))

    if (error) {
      alert(`Erro ao salvar limite: ${error}`)
    } else {
      onRefreshLimits()
    }
  }

  const handleReallocate = async () => {
    if (!reallocationRecommendation) return

    setIsReallocating(true)
    const { fromId, fromCurrentLimit, toId, toCurrentLimit, transferAmount } = reallocationRecommendation

    const fromNewLimit = Math.max(0, fromCurrentLimit - transferAmount)
    const toNewLimit = toCurrentLimit + transferAmount

    // Call updates
    const res1 = await onSetLimit(fromId, fromNewLimit)
    if (res1.error) {
      alert(`Erro ao atualizar limite de origem: ${res1.error}`)
      setIsReallocating(false)
      return
    }

    const res2 = await onSetLimit(toId, toNewLimit)
    if (res2.error) {
      alert(`Erro ao atualizar limite de destino: ${res2.error}`)
      setIsReallocating(false)
      return
    }

    setIsReallocating(false)
    onRefreshLimits()
  }

  const hasSuggestions = categoriesWithoutLimits.length > 0 || reallocationRecommendation !== null

  const isPastMonth = useMemo(() => {
    const today = new Date()
    const systemMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    return currentMonth < systemMonthStr
  }, [currentMonth])

  if (isPastMonth || !hasSuggestions) {
    return null
  }

  return (
    <Card className="h-full relative overflow-hidden flex flex-col p-5 border border-glass surface-glass transition-all hover:border-glass-strong hover:shadow-md">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-primary" size={20} />
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
          Sugestões de Limites
        </h3>
      </div>

      {!hasSuggestions ? (
        <div className="flex-1 flex flex-col justify-center items-center py-6 text-center">
          <Check className="text-income mb-2" size={24} />
          <p className="text-xs font-semibold text-primary">Orçamento Totalmente Configurado</p>
          <p className="text-[11px] text-secondary mt-1 max-w-[240px]">
            Todas as suas categorias já possuem limites definidos e não há desvios para otimização hoje.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {/* Reallocation Advice first */}
            {reallocationRecommendation && (
              <div className="rounded-xl border border-glass p-3 bg-secondary/5 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <ArrowRightLeft className="text-primary" size={14} />
                  <span>Ajuste de Orçamento Recomendado</span>
                </div>
                <p className="text-[11px] text-secondary leading-relaxed">
                  Você excedeu o limite de <span className="font-bold text-primary">{reallocationRecommendation.toName}</span> em {formatCurrency(reallocationRecommendation.exceededAmount)}. Sugerimos mover parte do limite de <span className="font-bold text-primary">{reallocationRecommendation.fromName}</span>.
                </p>
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-glass/30">
                  <div className="text-[10px] text-secondary">
                    Transferir: <span className="font-mono font-bold text-primary">{formatCurrency(reallocationRecommendation.transferAmount)}</span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReallocate}
                    disabled={isReallocating}
                  >
                    {isReallocating ? 'Remanejando...' : 'Aplicar Ajuste'}
                  </Button>
                </div>
              </div>
            )}

            {/* Missing Limits */}
            {categoriesWithoutLimits.length > 0 && (
              <div className="space-y-2.5">
                <p className="text-[11px] font-bold text-secondary uppercase tracking-wider">Definir novos limites (% da renda)</p>
                {categoriesWithoutLimits.slice(0, 3).map((item) => {
                  const currentPctText = percentInputs[item.id] || '10'
                  const currentPct = parseFloat(currentPctText) || 0
                  const calculatedVal = (previousMonthIncomeTotal * currentPct) / 100
                  const isSaving = isSavingMap[item.id] || false

                  return (
                    <div key={item.id} className="rounded-xl border border-glass p-3 bg-secondary/5 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-primary truncate">{item.name}</span>
                        <span className="text-[10px] text-secondary">
                          Gasto este mês: {formatCurrency(item.currentSpent)}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Input
                            type="text"
                            inputMode="decimal"
                            value={currentPctText}
                            onChange={(e) =>
                              setPercentInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="w-full pr-7 text-xs"
                            placeholder="10"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-secondary pointer-events-none">
                            %
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost-success"
                          size="sm"
                          onClick={() => handleSaveLimit(item.id)}
                          disabled={isSaving}
                        >
                          <Check size={16} />
                        </Button>
                      </div>

                      <p className="text-[10px] text-secondary">
                        Sugerido: <span className="font-bold text-primary">{formatCurrency(calculatedVal)}</span> ({formatNumberBR(currentPct)}% de {formatCurrency(previousMonthIncomeTotal || 0)})
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 border border-glass bg-secondary/5 flex gap-2.5 items-start">
            <AlertCircle className="text-primary shrink-0 mt-0.5" size={15} />
            <div className="text-[10px] text-secondary leading-relaxed">
              As sugestões utilizam a renda líquida do mês anterior ({formatCurrency(previousMonthIncomeTotal)}). Ajuste as porcentagens conforme suas metas de poupança.
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
