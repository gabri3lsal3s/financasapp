import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingDown, TrendingUp, ArrowRight } from 'lucide-react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import { PAGE_HEADERS } from '@/constants/pages'
import MonthSelector from '@/components/MonthSelector'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useIncomeCategoryExpectations } from '@/hooks/useIncomeCategoryExpectations'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { assignUniquePaletteColors, getCategoryColorForPalette } from '@/utils/categoryColors'
import { addMonths, formatCurrency, formatMoneyInput, getCurrentMonthString, parseMoneyInput } from '@/utils/format'

export default function CategoriesHome() {
  const navigate = useNavigate()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [savingExpenseLimitIds, setSavingExpenseLimitIds] = useState<string[]>([])
  const [savingIncomeExpectationIds, setSavingIncomeExpectationIds] = useState<string[]>([])
  const [expenseLimitInputs, setExpenseLimitInputs] = useState<Record<string, string>>({})
  const [incomeExpectationInputs, setIncomeExpectationInputs] = useState<Record<string, string>>({})
  const { colorPalette } = usePaletteColors()

  const { categories, loading: loadingCategories } = useCategories()
  const { incomeCategories, loading: loadingIncomeCategories } = useIncomeCategories()
  const { expenses, loading: loadingExpenses } = useExpenses(currentMonth)
  const { incomes, loading: loadingIncomes } = useIncomes(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { limits: currentMonthLimits, loading: loadingLimits, setCategoryLimit } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthLimits, loading: loadingPreviousLimits } = useExpenseCategoryLimits(previousMonth)
  const { expectations: currentMonthExpectations, loading: loadingExpectations, setIncomeCategoryExpectation } = useIncomeCategoryExpectations(currentMonth)
  const { expectations: previousMonthExpectations, loading: loadingPreviousExpectations } = useIncomeCategoryExpectations(previousMonth)

  const expenseSpentByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    expenses.forEach((item) => {
      totals.set(item.category_id, (totals.get(item.category_id) || 0) + item.amount)
    })
    return totals
  }, [expenses])

  const incomeByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    incomes.forEach((item) => {
      totals.set(item.income_category_id, (totals.get(item.income_category_id) || 0) + item.amount)
    })
    return totals
  }, [incomes])

  const expenseCategoryColorMap = useMemo(() => {
    const assignedColors = assignUniquePaletteColors(categories, colorPalette)
    const map: Record<string, string> = {}

    categories.forEach((category, index) => {
      map[category.id] = assignedColors[index] || getCategoryColorForPalette(category.color, colorPalette)
    })

    return map
  }, [categories, colorPalette])

  const incomeCategoryColorMap = useMemo(() => {
    const assignedColors = assignUniquePaletteColors(incomeCategories, colorPalette)
    const map: Record<string, string> = {}

    incomeCategories.forEach((category, index) => {
      map[category.id] = assignedColors[index] || getCategoryColorForPalette(category.color, colorPalette)
    })

    return map
  }, [incomeCategories, colorPalette])

  const currentMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    currentMonthLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [currentMonthLimits])

  const previousMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [previousMonthLimits])

  const expenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()

    categories.forEach((category) => {
      const currentValue = currentMonthExpenseLimitMap.get(category.id)
      if (currentValue !== undefined) {
        map.set(category.id, currentValue)
        return
      }

      const previousValue = previousMonthExpenseLimitMap.get(category.id)
      if (previousValue !== undefined) {
        map.set(category.id, previousValue)
      }
    })

    return map
  }, [categories, currentMonthExpenseLimitMap, previousMonthExpenseLimitMap])

  const currentMonthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    currentMonthExpectations.forEach((item) => map.set(item.income_category_id, item.expectation_amount))
    return map
  }, [currentMonthExpectations])

  const previousMonthIncomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthExpectations.forEach((item) => map.set(item.income_category_id, item.expectation_amount))
    return map
  }, [previousMonthExpectations])

  const incomeExpectationMap = useMemo(() => {
    const map = new Map<string, number | null>()

    incomeCategories.forEach((category) => {
      const currentValue = currentMonthIncomeExpectationMap.get(category.id)
      if (currentValue !== undefined) {
        map.set(category.id, currentValue)
        return
      }

      const previousValue = previousMonthIncomeExpectationMap.get(category.id)
      if (previousValue !== undefined) {
        map.set(category.id, previousValue)
      }
    })

    return map
  }, [incomeCategories, currentMonthIncomeExpectationMap, previousMonthIncomeExpectationMap])

  useEffect(() => {
    const nextInputs: Record<string, string> = {}
    categories.forEach((category) => {
      const limitAmount = expenseLimitMap.get(category.id)
      nextInputs[category.id] = limitAmount !== null && limitAmount !== undefined
        ? formatMoneyInput(limitAmount)
        : ''
    })
    setExpenseLimitInputs(nextInputs)
  }, [categories, expenseLimitMap])

  useEffect(() => {
    const nextInputs: Record<string, string> = {}
    incomeCategories.forEach((category) => {
      const expectedAmount = incomeExpectationMap.get(category.id)
      nextInputs[category.id] = expectedAmount !== null && expectedAmount !== undefined
        ? formatMoneyInput(expectedAmount)
        : ''
    })
    setIncomeExpectationInputs(nextInputs)
  }, [incomeCategories, incomeExpectationMap])

  const loadingData =
    loadingCategories ||
    loadingIncomeCategories ||
    loadingExpenses ||
    loadingIncomes ||
    loadingLimits ||
    loadingPreviousLimits ||
    loadingExpectations ||
    loadingPreviousExpectations

  const saveExpenseLimit = async (categoryId: string) => {
    const rawValue = (expenseLimitInputs[categoryId] || '').trim()
    const parsed = rawValue ? parseMoneyInput(rawValue) : Number.NaN

    if (rawValue && (Number.isNaN(parsed) || parsed < 0)) {
      alert('Informe um valor válido para o limite da categoria.')
      return
    }

    const amount = rawValue ? Number(parsed.toFixed(2)) : null

    setSavingExpenseLimitIds((prev) => [...prev, categoryId])
    const { error } = await setCategoryLimit(categoryId, amount)

    if (error) {
      alert(`Erro ao salvar limite: ${error}`)
    } else {
      setExpenseLimitInputs((prev) => ({
        ...prev,
        [categoryId]: amount === null ? '' : formatMoneyInput(amount),
      }))
    }

    setSavingExpenseLimitIds((prev) => prev.filter((id) => id !== categoryId))
  }

  const saveIncomeExpectation = async (incomeCategoryId: string) => {
    const rawValue = (incomeExpectationInputs[incomeCategoryId] || '').trim()
    const parsed = rawValue ? parseMoneyInput(rawValue) : Number.NaN

    if (rawValue && (Number.isNaN(parsed) || parsed < 0)) {
      alert('Informe um valor válido para a expectativa da categoria de renda.')
      return
    }

    const amount = rawValue ? Number(parsed.toFixed(2)) : null

    setSavingIncomeExpectationIds((prev) => [...prev, incomeCategoryId])
    const { error } = await setIncomeCategoryExpectation(incomeCategoryId, amount)

    if (error) {
      alert(`Erro ao salvar expectativa: ${error}`)
    } else {
      setIncomeExpectationInputs((prev) => ({
        ...prev,
        [incomeCategoryId]: amount === null ? '' : formatMoneyInput(amount),
      }))
    }

    setSavingIncomeExpectationIds((prev) => prev.filter((id) => id !== incomeCategoryId))
  }

  return (
    <div>
      <PageHeader title={PAGE_HEADERS.categories.title} subtitle={PAGE_HEADERS.categories.description} />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
          <Card className="h-full" onClick={() => navigate('/expense-categories')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown size={18} className="text-expense" />
                  <h3 className="text-base font-semibold text-primary">Categorias de despesas</h3>
                </div>
                <p className="text-sm text-secondary">Gerencie os nomes e organização das categorias.</p>
              </div>
              <ArrowRight size={18} className="text-secondary flex-shrink-0" />
            </div>
          </Card>

          <Card className="h-full" onClick={() => navigate('/income-categories')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp size={18} className="text-income" />
                  <h3 className="text-base font-semibold text-primary">Categorias de rendas</h3>
                </div>
                <p className="text-sm text-secondary">Gerencie as categorias das suas fontes de entrada.</p>
              </div>
              <ArrowRight size={18} className="text-secondary flex-shrink-0" />
            </div>
          </Card>
        </div>

        {loadingData ? (
          <Card>
            <p className="text-sm text-secondary">Carregando dados das categorias...</p>
          </Card>
        ) : (
          <>
            <Card>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Limites por mês (despesas)</h3>
                  <p className="text-sm text-secondary">Defina valores por categoria com campos de inserção.</p>
                </div>

                {categories.length === 0 ? (
                  <p className="text-sm text-secondary">Nenhuma categoria de despesa cadastrada.</p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {categories.map((category) => {
                      const spent = expenseSpentByCategory.get(category.id) || 0
                      const limitAmount = expenseLimitMap.get(category.id)
                      const categoryColor = expenseCategoryColorMap[category.id] || category.color
                      const hasLimit = limitAmount !== null && limitAmount !== undefined
                      const exceeded = hasLimit && spent > (limitAmount || 0)
                      const isSaving = savingExpenseLimitIds.includes(category.id)

                      return (
                        <div key={category.id} className="rounded-lg border border-primary p-2.5 bg-primary space-y-2 h-full">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full border border-primary flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                              <p className="font-medium text-primary truncate">{category.name}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border border-primary ${
                              !hasLimit
                                ? 'text-secondary bg-secondary'
                                : exceeded
                                  ? 'text-expense bg-secondary'
                                  : 'text-income bg-secondary'
                            }`}>
                              {!hasLimit ? 'Sem limite' : exceeded ? 'Ultrapassou' : 'Dentro do limite'}
                            </span>
                          </div>

                          <p className="text-sm text-secondary">
                            Gasto: <span className="text-primary font-medium">{formatCurrency(spent)}</span>
                            {' • '}
                            Limite: <span className="text-primary font-medium">{hasLimit ? formatCurrency(limitAmount || 0) : 'Não definido'}</span>
                          </p>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={expenseLimitInputs[category.id] || ''}
                              onChange={(event) =>
                                setExpenseLimitInputs((prev) => ({
                                  ...prev,
                                  [category.id]: event.target.value,
                                }))
                              }
                              placeholder="Ex: 1200,00"
                              className="w-full sm:max-w-[220px] px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => saveExpenseLimit(category.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Salvando...' : 'Salvar'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              <div className="space-y-3">
                <div>
                  <h3 className="text-lg font-semibold text-primary">Expectativas por mês (rendas)</h3>
                  <p className="text-sm text-secondary">Defina valores por categoria com campos de inserção.</p>
                </div>

                {incomeCategories.length === 0 ? (
                  <p className="text-sm text-secondary">Nenhuma categoria de renda cadastrada.</p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                    {incomeCategories.map((category) => {
                      const received = incomeByCategory.get(category.id) || 0
                      const expectationAmount = incomeExpectationMap.get(category.id)
                      const categoryColor = incomeCategoryColorMap[category.id] || category.color
                      const hasExpectation = expectationAmount !== null && expectationAmount !== undefined
                      const exceeded = hasExpectation && received > (expectationAmount || 0)
                      const isSaving = savingIncomeExpectationIds.includes(category.id)

                      return (
                        <div key={category.id} className="rounded-lg border border-primary p-2.5 bg-primary space-y-2 h-full">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-full border border-primary flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                              <p className="font-medium text-primary truncate">{category.name}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full border border-primary ${
                              !hasExpectation
                                ? 'text-secondary bg-secondary'
                                : exceeded
                                  ? 'text-income bg-secondary'
                                  : 'text-secondary bg-secondary'
                            }`}>
                              {!hasExpectation ? 'Sem expectativa' : exceeded ? 'Superou expectativa' : 'Acompanhar'}
                            </span>
                          </div>

                          <p className="text-sm text-secondary">
                            Recebido: <span className="text-primary font-medium">{formatCurrency(received)}</span>
                            {' • '}
                            Expectativa: <span className="text-primary font-medium">{hasExpectation ? formatCurrency(expectationAmount || 0) : 'Não definida'}</span>
                          </p>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={incomeExpectationInputs[category.id] || ''}
                              onChange={(event) =>
                                setIncomeExpectationInputs((prev) => ({
                                  ...prev,
                                  [category.id]: event.target.value,
                                }))
                              }
                              placeholder="Ex: 2000,00"
                              className="w-full sm:max-w-[220px] px-3 py-2 border border-primary rounded-lg bg-primary text-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => saveIncomeExpectation(category.id)}
                              disabled={isSaving}
                            >
                              {isSaving ? 'Salvando...' : 'Salvar'}
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
