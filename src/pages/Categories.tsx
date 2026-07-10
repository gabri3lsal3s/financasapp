import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingDown, TrendingUp, Sliders } from 'lucide-react'

import { usePageActions } from '@/hooks/usePageActions'
import { SkeletonCategories } from '@/components/Skeleton'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useSearchHighlight } from '@/utils/pageTitles'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useIncomeCategoryExpectations } from '@/hooks/useIncomeCategoryExpectations'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { assignUniquePaletteColors, getCategoryColorForPalette } from '@/utils/categoryColors'
import { addMonths, getCurrentMonthString, roundToDecimals } from '@/utils/format'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Category, IncomeCategory } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import ExpenseCategoryGrid from '@/components/categories/ExpenseCategoryGrid'
import IncomeCategoryGrid from '@/components/categories/IncomeCategoryGrid'
import CategoryFormModal from '@/components/categories/CategoryFormModal'
import CategoryDeleteConfirmModal from '@/components/categories/CategoryDeleteConfirmModal'
import LimitSuggestionsModal from '@/components/categories/LimitSuggestionsModal'
import { logger } from '@/utils/logger'

function detectSuggestionRuleFromName(name: string): string {
  const normalized = name.toLowerCase().trim()
  
  if (
    normalized.includes('morad') || 
    normalized.includes('casa') || 
    normalized.includes('aluguel') || 
    normalized.includes('condominio')
  ) {
    return 'moradia'
  }
  
  if (
    normalized.includes('aliment') || 
    normalized.includes('comer') || 
    normalized.includes('restaurante') || 
    normalized.includes('supermercado') || 
    normalized.includes('mercado')
  ) {
    return 'alimentacao'
  }
  
  if (
    normalized.includes('transp') || 
    normalized.includes('carro') || 
    normalized.includes('combustivel') || 
    normalized.includes('gasolina') || 
    normalized.includes('uber')
  ) {
    return 'transporte'
  }
  
  if (
    normalized.includes('saude') || 
    normalized.includes('medico') || 
    normalized.includes('remedio') || 
    normalized.includes('farmacia') || 
    normalized.includes('hospital')
  ) {
    return 'saude'
  }
  
  if (
    normalized.includes('educa') || 
    normalized.includes('escola') || 
    normalized.includes('faculdade') || 
    normalized.includes('curso')
  ) {
    return 'educacao'
  }
  
  if (
    normalized.includes('lazer') || 
    normalized.includes('cinema') || 
    normalized.includes('show') || 
    normalized.includes('festa') || 
    normalized.includes('bar') ||
    normalized.includes('netflix') ||
    normalized.includes('spotify') ||
    normalized.includes('academia')
  ) {
    return 'lazer'
  }
  
  if (
    normalized.includes('compra') || 
    normalized.includes('vestuario') || 
    normalized.includes('roupa') || 
    normalized.includes('shopping')
  ) {
    return 'compras'
  }
  
  return 'outros'
}

export default function Categories() {
  useSearchHighlight()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const { isOnline } = useNetworkStatus()

  useEffect(() => {
    const month = searchParams.get('month')
    if (month && month.length === 7) {
      setCurrentMonth(month)
    }
  }, [searchParams])

  const handleMonthChange = (month: string) => {
    if (month === currentMonth) return
    setCurrentMonth(month)
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('month', month)
      return next
    })
  }

  const swipeHandlers = useSwipeMonth(currentMonth, handleMonthChange)
  const [savingExpenseLimitIds, setSavingExpenseLimitIds] = useState<string[]>([])
  const [savingIncomeExpectationIds, setSavingIncomeExpectationIds] = useState<string[]>([])
  const [expenseLimitInputs, setExpenseLimitInputs] = useState<Record<string, number>>({})
  const [incomeExpectationInputs, setIncomeExpectationInputs] = useState<Record<string, number>>({})
  const { colorPalette } = usePaletteColors()
  
  // Dashboard & UX Refactoring states
  const [activeTab, setActiveTab] = useState<'expenses' | 'incomes'>('expenses')

  usePageActions([
    {
      icon: TrendingDown,
      label: 'Orçamentos',
      intent: activeTab === 'expenses' ? 'expense' : 'neutral',
      className: 'hidden lg:flex',
      onClick: () => {
        setActiveTab('expenses')
        setEditingCategoryId(null)
      },
      compactOnMobile: true,
    },
    {
      icon: TrendingUp,
      label: 'Metas',
      intent: activeTab === 'incomes' ? 'income' : 'neutral',
      className: 'hidden lg:flex',
      onClick: () => {
        setActiveTab('incomes')
        setEditingCategoryId(null)
      },
      compactOnMobile: true,
    },
    {
      icon: Sliders,
      label: 'Ajustar Sugestões',
      intent: 'neutral',
      show: activeTab === 'expenses',
      onClick: () => setIsSuggestionsModalOpen(true),
      compactOnMobile: true,
    },
  ])
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)

  const { 
    categories, 
    loading: loadingCategories, 
    createCategory, 
    updateCategory, 
    deleteCategory, 
    getCategoryUsageCount 
  } = useCategories()
  
  const { 
    incomeCategories, 
    loading: loadingIncomeCategories, 
    createIncomeCategory, 
    updateIncomeCategory, 
    deleteIncomeCategory, 
    getIncomeCategoryUsageCount 
  } = useIncomeCategories()

  // IDs para highlight de busca global

  const { user } = useAuth()

  // suggestions state
  const [suggestions, setSuggestions] = useState<Record<string, number>>({
    moradia: 25,
    alimentacao: 15,
    transporte: 10,
    saude: 5,
    educacao: 10,
    lazer: 10,
    compras: 5,
    outros: 10,
  })

  // Load user suggestions when user is loaded
  useEffect(() => {
    if (user?.id) {
      try {
        const userKey = `minhas-financas:limit-suggestions:${user.id}`
        const saved = localStorage.getItem(userKey)
        if (saved) {
          setSuggestions(JSON.parse(saved))
        } else {
          // Migração da chave legada
          const legacySaved = localStorage.getItem('minhas-financas:limit-suggestions')
          if (legacySaved) {
            setSuggestions(JSON.parse(legacySaved))
          }
        }
      } catch (e) {
        logger.error('Error loading limit suggestions from localStorage', e)
      }
    }
  }, [user?.id])

  const [isSuggestionsModalOpen, setIsSuggestionsModalOpen] = useState(false)

  const getCategoryPercentageSuggestion = (categoryOrName: Category | IncomeCategory | string): number => {
    let name = ''
    let suggestionRule = ''

    if (categoryOrName && typeof categoryOrName === 'object') {
      name = categoryOrName.name || ''
      const parts = categoryOrName.color ? categoryOrName.color.split('|') : []
      suggestionRule = parts[2] || ''
    } else {
      name = String(categoryOrName || '')
    }

    if (!suggestionRule) {
      suggestionRule = detectSuggestionRuleFromName(name)
    }

    return suggestions[suggestionRule] ?? suggestions.outros ?? 10
  }

  // Category Form Modals states
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | IncomeCategory | null>(null)

  // Delete Category Modals states
  const [isCategoryDeleteModalOpen, setIsCategoryDeleteModalOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | IncomeCategory | null>(null)
  const [deleteUsageCount, setDeleteUsageCount] = useState(0)

  const handleOpenCategoryModal = (category?: Category | IncomeCategory) => {
    setEditingCategory(category || null)
    setIsCategoryModalOpen(true)
  }

  const handleCloseCategoryModal = () => {
    setEditingCategory(null)
    setIsCategoryModalOpen(false)
  }

  const handleSuggestionsSubmit = (newSuggestions: Record<string, number>) => {
    const userKey = user?.id ? `minhas-financas:limit-suggestions:${user.id}` : 'minhas-financas:limit-suggestions'
    localStorage.setItem(userKey, JSON.stringify(newSuggestions))
    setSuggestions(newSuggestions)
    setIsSuggestionsModalOpen(false)
  }

  const handleCategorySubmit = async (name: string, combinedColor: string) => {
    if (activeTab === 'expenses') {
      if (editingCategory) {
        const { error } = await updateCategory(editingCategory.id, { name, color: combinedColor })
        if (!error) {
          handleCloseCategoryModal()
        } else {
          alert('Erro ao atualizar categoria: ' + error)
        }
      } else {
        const { error } = await createCategory({ name, color: combinedColor } as Omit<Category, 'id' | 'created_at'>)
        if (!error) {
          handleCloseCategoryModal()
        } else {
          alert('Erro ao criar categoria: ' + error)
        }
      }
    } else {
      if (editingCategory) {
        const { error } = await updateIncomeCategory(editingCategory.id, { name, color: combinedColor })
        if (!error) {
          handleCloseCategoryModal()
        } else {
          alert('Erro ao atualizar categoria: ' + error)
        }
      } else {
        const { error } = await createIncomeCategory({ name, color: combinedColor } as Omit<IncomeCategory, 'id' | 'created_at'>)
        if (!error) {
          handleCloseCategoryModal()
        } else {
          alert('Erro ao criar categoria: ' + error)
        }
      }
    }
  }

  const handleDeleteCategoryClick = async (category: Category | IncomeCategory) => {
    let usageCount = 0
    if (activeTab === 'expenses') {
      usageCount = await getCategoryUsageCount(category.id)
    } else {
      usageCount = await getIncomeCategoryUsageCount(category.id)
    }
    setCategoryToDelete(category)
    setDeleteUsageCount(usageCount)
    setIsCategoryDeleteModalOpen(true)
  }

  const handleConfirmDeleteCategory = async (targetCategoryId: string) => {
    if (!categoryToDelete) return

    if (activeTab === 'expenses') {
      const { error } = await deleteCategory(categoryToDelete.id, targetCategoryId || undefined)
      if (error) {
        alert('Erro ao excluir categoria: ' + error)
        return
      }
    } else {
      const { error } = await deleteIncomeCategory(categoryToDelete.id, targetCategoryId || undefined)
      if (error) {
        alert('Erro ao excluir categoria: ' + error)
        return
      }
    }

    setIsCategoryDeleteModalOpen(false)
    setCategoryToDelete(null)

    if (editingCategory?.id === categoryToDelete.id) {
      handleCloseCategoryModal()
    }
  }
  const { expenses, loading: loadingExpenses } = useExpenses(currentMonth)
  const { incomes, loading: loadingIncomes } = useIncomes(currentMonth)
  const { incomes: allIncomes, loading: loadingAllIncomes } = useIncomes()

  const averageIncome = useMemo(() => {
    if (!allIncomes || allIncomes.length === 0) return 0
    const monthlyTotals: Record<string, number> = {}
    allIncomes.forEach((inc) => {
      const monthStr = inc.date.substring(0, 7) // 'YYYY-MM'
      const amount = getWeightedReportAmount(inc.amount, inc.report_weight)
      monthlyTotals[monthStr] = (monthlyTotals[monthStr] || 0) + amount
    })
    const months = Object.keys(monthlyTotals)
    if (months.length === 0) return 0
    const totalSum = months.reduce((sum, m) => sum + monthlyTotals[m], 0)
    return totalSum / months.length
  }, [allIncomes])
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { limits: currentMonthLimits, loading: loadingLimits, setCategoryLimit } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthLimits, loading: loadingPreviousLimits } = useExpenseCategoryLimits(previousMonth)
  const { expectations: currentMonthExpectations, loading: loadingExpectations, setIncomeCategoryExpectation } = useIncomeCategoryExpectations(currentMonth)
  const { expectations: previousMonthExpectations, loading: loadingPreviousExpectations } = useIncomeCategoryExpectations(previousMonth)

  const expenseSpentByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    expenses.forEach((item) => {
      const amount = getWeightedReportAmount(item.amount, item.report_weight)
      totals.set(item.category_id, (totals.get(item.category_id) || 0) + amount)
    })
    return totals
  }, [expenses])

  const expenseBaseByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    expenses.forEach((item) => {
      totals.set(item.category_id, (totals.get(item.category_id) || 0) + item.amount)
    })
    return totals
  }, [expenses])

  const incomeByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    incomes.forEach((item) => {
      const amount = getWeightedReportAmount(item.amount, item.report_weight)
      totals.set(item.income_category_id, (totals.get(item.income_category_id) || 0) + amount)
    })
    return totals
  }, [incomes])

  const incomeBaseByCategory = useMemo(() => {
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

  // KPIs Consolidados (Orçamentos de Despesa)
  const expensesKpis = useMemo(() => {
    let limitSum = 0
    let spentSum = 0
    categories.forEach((category) => {
      const limit = expenseLimitMap.get(category.id)
      const spent = expenseSpentByCategory.get(category.id) || 0
      if (limit !== null && limit !== undefined) {
        limitSum += limit
        spentSum += spent
      }
    })
    const remaining = limitSum - spentSum
    const percentage = limitSum > 0 ? (spentSum / limitSum) * 100 : 0
    return { limitSum, spentSum, remaining, percentage }
  }, [categories, expenseLimitMap, expenseSpentByCategory])

  // KPIs Consolidados (Meta de Rendas)
  const incomesKpis = useMemo(() => {
    let expectationSum = 0
    let receivedSum = 0
    incomeCategories.forEach((category) => {
      const expectation = incomeExpectationMap.get(category.id)
      const received = incomeByCategory.get(category.id) || 0
      if (expectation !== null && expectation !== undefined) {
        expectationSum += expectation
        receivedSum += received
      }
    })
    const remaining = expectationSum - receivedSum
    const percentage = expectationSum > 0 ? (receivedSum / expectationSum) * 100 : 0
    return { expectationSum, receivedSum, remaining, percentage }
  }, [incomeCategories, incomeExpectationMap, incomeByCategory])

  // sortedCategories and sortedIncomeCategories removed — now handled inside ExpenseCategoryGrid and IncomeCategoryGrid components

  useEffect(() => {
    const nextInputs: Record<string, number> = {}
    categories.forEach((category) => {
      const limitAmount = expenseLimitMap.get(category.id)
      nextInputs[category.id] = limitAmount !== null && limitAmount !== undefined
        ? limitAmount
        : 0
    })
    setExpenseLimitInputs(nextInputs)
  }, [categories, expenseLimitMap])

  useEffect(() => {
    const nextInputs: Record<string, number> = {}
    incomeCategories.forEach((category) => {
      const expectedAmount = incomeExpectationMap.get(category.id)
      nextInputs[category.id] = expectedAmount !== null && expectedAmount !== undefined
        ? expectedAmount
        : 0
    })
    setIncomeExpectationInputs(nextInputs)
  }, [incomeCategories, incomeExpectationMap])

  const loadingData =
    loadingCategories ||
    loadingIncomeCategories ||
    loadingExpenses ||
    loadingIncomes ||
    loadingAllIncomes ||
    loadingLimits ||
    loadingPreviousLimits ||
    loadingExpectations ||
    loadingPreviousExpectations

  const saveExpenseLimit = async (categoryId: string) => {
    const rawValue = expenseLimitInputs[categoryId] ?? 0

    if (rawValue < 0) {
      alert('Informe um valor válido para o limite da categoria.')
      return
    }

    const amount = rawValue > 0 ? roundToDecimals(rawValue, 2) : null

    setSavingExpenseLimitIds((prev) => [...prev, categoryId])
    const { error } = await setCategoryLimit(categoryId, amount)

    if (error) {
      alert(`Erro ao salvar limite: ${error}`)
    }

    setSavingExpenseLimitIds((prev) => prev.filter((id) => id !== categoryId))
  }

  const saveIncomeExpectation = async (incomeCategoryId: string) => {
    const rawValue = incomeExpectationInputs[incomeCategoryId] ?? 0

    if (rawValue < 0) {
      alert('Informe um valor válido para a expectativa da categoria de renda.')
      return
    }

    const amount = rawValue > 0 ? roundToDecimals(rawValue, 2) : null

    setSavingIncomeExpectationIds((prev) => [...prev, incomeCategoryId])
    const { error } = await setIncomeCategoryExpectation(incomeCategoryId, amount)

    if (error) {
      alert(`Erro ao salvar expectativa: ${error}`)
    }

    setSavingIncomeExpectationIds((prev) => prev.filter((id) => id !== incomeCategoryId))
  }

  return (
    <div className="animate-page-enter min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <div className="p-4 lg:p-6 space-y-5 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={handleMonthChange} isOnline={isOnline} />

        {/* Inline Tabs selector on mobile only! */}
        <div className="lg:hidden w-full">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'expenses' | 'incomes')} className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-md mx-auto">
              <TabsTrigger value="expenses" className="text-xs font-bold gap-1.5">
                <TrendingDown size={14} className={activeTab === 'expenses' ? 'text-expense' : 'text-secondary'} />
                <span>Orçamentos</span>
              </TabsTrigger>
              <TabsTrigger value="incomes" className="text-xs font-bold gap-1.5">
                <TrendingUp size={14} className={activeTab === 'incomes' ? 'text-income' : 'text-secondary'} />
                <span>Metas</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>


        {loadingData ? (
          <SkeletonCategories />
        ) : (
          <MonthTransitionView month={currentMonth} className="space-y-4 lg:space-y-6 animate-fade-in">
            {activeTab === 'expenses' ? (
              <ExpenseCategoryGrid
                categories={categories}
                expenseSpentByCategory={expenseSpentByCategory}
                expenseBaseByCategory={expenseBaseByCategory}
                expenseCategoryColorMap={expenseCategoryColorMap}
                expenseLimitMap={expenseLimitMap}
                expensesKpis={expensesKpis}
                savingExpenseLimitIds={savingExpenseLimitIds}
                editingCategoryId={editingCategoryId}
                expenseLimitInputs={expenseLimitInputs}
                averageIncome={averageIncome}
                getCategoryPercentageSuggestion={getCategoryPercentageSuggestion}
                onEditCategory={handleOpenCategoryModal}
                onDeleteCategory={handleDeleteCategoryClick}
                onEditLimit={(id) => {
                  setEditingCategoryId(id)
                  const limitAmount = expenseLimitMap.get(id)
                  setExpenseLimitInputs(prev => ({
                    ...prev,
                    [id]: limitAmount ?? 0
                  }))
                }}
                onSaveLimit={saveExpenseLimit}
                onCancelEditLimit={() => setEditingCategoryId(null)}
                onSetLimitInput={(id, value: number) =>
                  setExpenseLimitInputs((prev) => ({ ...prev, [id]: value }))
                }
                onAddCategory={() => handleOpenCategoryModal()}
              />
            ) : (
              <IncomeCategoryGrid
                incomeCategories={incomeCategories}
                incomeByCategory={incomeByCategory}
                incomeBaseByCategory={incomeBaseByCategory}
                incomeCategoryColorMap={incomeCategoryColorMap}
                incomeExpectationMap={incomeExpectationMap}
                incomesKpis={incomesKpis}
                savingIncomeExpectationIds={savingIncomeExpectationIds}
                editingCategoryId={editingCategoryId}
                incomeExpectationInputs={incomeExpectationInputs}
                onEditCategory={handleOpenCategoryModal}
                onDeleteCategory={handleDeleteCategoryClick}
                onEditExpectation={(id) => {
                  setEditingCategoryId(id)
                  const expectationAmount = incomeExpectationMap.get(id)
                  setIncomeExpectationInputs(prev => ({
                    ...prev,
                    [id]: expectationAmount ?? 0
                  }))
                }}
                onSaveExpectation={saveIncomeExpectation}
                onCancelEditExpectation={() => setEditingCategoryId(null)}
                onSetExpectationInput={(id, value: number) =>
                  setIncomeExpectationInputs((prev) => ({ ...prev, [id]: value }))
                }
                onAddCategory={() => handleOpenCategoryModal()}
              />
            )}
          </MonthTransitionView>
        )}
      </div>

      <CategoryFormModal
        isOpen={isCategoryModalOpen}
        onClose={handleCloseCategoryModal}
        onSubmit={handleCategorySubmit}
        editingCategory={editingCategory}
        tabType={activeTab}
      />

      <CategoryDeleteConfirmModal
        isOpen={isCategoryDeleteModalOpen}
        onClose={() => setIsCategoryDeleteModalOpen(false)}
        onConfirm={handleConfirmDeleteCategory}
        categoryToDelete={categoryToDelete}
        usageCount={deleteUsageCount}
        categories={categories}
        incomeCategories={incomeCategories}
        tabType={activeTab}
      />

      <LimitSuggestionsModal
        isOpen={isSuggestionsModalOpen}
        onClose={() => setIsSuggestionsModalOpen(false)}
        onSubmit={handleSuggestionsSubmit}
        initialSuggestions={suggestions}
      />

    </div>
  )
}
