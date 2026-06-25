import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TrendingDown, TrendingUp, Check, Pencil, X, Plus, Trash2, Sliders } from 'lucide-react'
import ScrollToTop from '@/components/ScrollToTop'
import { getCategoryIcon } from '@/utils/categoryIcons'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import MonthSelector from '@/components/MonthSelector'
import MonthTransitionView from '@/components/MonthTransitionView'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { useIncomeCategoryExpectations } from '@/hooks/useIncomeCategoryExpectations'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { assignUniquePaletteColors, getCategoryColorForPalette } from '@/utils/categoryColors'
import { addMonths, formatCurrency, formatMoneyInput, getCurrentMonthString, parseMoneyInput, roundToDecimals } from '@/utils/format'
import { useSwipeMonth } from '@/hooks/useSwipeMonth'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Category, IncomeCategory } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import CategoryFormModal from '@/components/categories/CategoryFormModal'
import CategoryDeleteConfirmModal from '@/components/categories/CategoryDeleteConfirmModal'
import LimitSuggestionsModal from '@/components/categories/LimitSuggestionsModal'

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
  const [expenseLimitInputs, setExpenseLimitInputs] = useState<Record<string, string>>({})
  const [incomeExpectationInputs, setIncomeExpectationInputs] = useState<Record<string, string>>({})
  const { colorPalette } = usePaletteColors()
  
  // Dashboard & UX Refactoring states
  const [activeTab, setActiveTab] = useState<'expenses' | 'incomes'>('expenses')
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
        console.error('Error loading limit suggestions from localStorage', e)
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

      // 1. Exceeded categories first (by absolute exceeded amount descending)
      if (exceededA && !exceededB) return -1
      if (!exceededA && exceededB) return 1
      if (exceededA && exceededB) {
        return exceededAmtB - exceededAmtA
      }

      // 2. Categories with limits next (by percentage spent descending)
      if (hasLimitA && !hasLimitB) return -1
      if (!hasLimitA && hasLimitB) return 1
      if (hasLimitA && hasLimitB) {
        const pctA = (limitA || 0) > 0 ? (spentA / (limitA || 1)) * 100 : 0
        const pctB = (limitB || 0) > 0 ? (spentB / (limitB || 1)) * 100 : 0
        
        if (Math.abs(pctA - pctB) > 0.01) {
          return pctB - pctA
        }
        // If percentages are similar, sort by limit amount descending
        return (limitB || 0) - (limitA || 0)
      }

      // 3. Categories without limits last (by spent amount descending)
      return spentB - spentA
    })
  }, [categories, expenseLimitMap, expenseSpentByCategory])

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

      // 1. Unreached expectations first (furthest to reach descending by deficit amount: expectation - received)
      if (deficitA > 0 && deficitB === 0) return -1
      if (deficitA === 0 && deficitB > 0) return 1
      if (deficitA > 0 && deficitB > 0) {
        return deficitB - deficitA
      }

      // 2. Reached or with expectations next (by expectation amount descending)
      if (hasExpectationA && !hasExpectationB) return -1
      if (!hasExpectationA && hasExpectationB) return 1
      if (hasExpectationA && hasExpectationB) {
        return (expectationB || 0) - (expectationA || 0)
      }

      // 3. Without expectations last (by received amount descending)
      return receivedB - receivedA
    })
  }, [incomeCategories, incomeExpectationMap, incomeByCategory])

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
    loadingAllIncomes ||
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

    const amount = rawValue ? roundToDecimals(parsed, 2) : null

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

    const amount = rawValue ? roundToDecimals(parsed, 2) : null

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
    <div className="animate-page-enter min-h-[calc(100vh-12rem)] flex flex-col" {...swipeHandlers}>
      <PageHeader
        title={PAGE_HEADERS.categories.title}
        subtitle={PAGE_HEADERS.categories.description}
        action={
          <PageHeaderActions>
            <PageHeaderActionButton
              className="hidden lg:flex"
              intent={activeTab === 'expenses' ? 'expense' : 'neutral'}
              icon={TrendingDown}
              label="Orçamentos"
              onClick={() => {
                setActiveTab('expenses')
                setEditingCategoryId(null)
              }}
            />
            <PageHeaderActionButton
              className="hidden lg:flex"
              intent={activeTab === 'incomes' ? 'income' : 'neutral'}
              icon={TrendingUp}
              label="Metas"
              onClick={() => {
                setActiveTab('incomes')
                setEditingCategoryId(null)
              }}
            />

            {activeTab === 'expenses' && (
              <PageHeaderActionButton
                intent="neutral"
                icon={Sliders}
                label="Ajustar Sugestões"
                onClick={() => setIsSuggestionsModalOpen(true)}
              />
            )}
          </PageHeaderActions>
        }
      />

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
          <Loader text="Carregando dados das categorias..." className="py-12" />
        ) : (
          <MonthTransitionView month={currentMonth} className="space-y-4 lg:space-y-6 animate-fade-in">
            {activeTab === 'expenses' ? (
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
                    <Card className="p-6 text-center text-secondary border border-glass surface-glass">
                      Nenhuma categoria de despesa cadastrada.
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {sortedCategories.map((category, index) => {
                        const spent = expenseSpentByCategory.get(category.id) || 0
                        const limitAmount = expenseLimitMap.get(category.id)
                        const [colorPart, iconPart] = category.color ? category.color.split('|') : []
                        const categoryColor = expenseCategoryColorMap[category.id] || colorPart || category.color
                        const categoryIconName = iconPart || undefined
                        const hasLimit = limitAmount !== null && limitAmount !== undefined
                        const exceeded = hasLimit && spent > (limitAmount || 0)
                        const isSaving = savingExpenseLimitIds.includes(category.id)
                        const isEditing = editingCategoryId === category.id

                        const spentPct = hasLimit && limitAmount > 0 ? (spent / limitAmount) * 100 : 0
                        
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
                            key={category.id}
                            className={`group rounded-xl border p-4 bg-primary transition-all duration-300 flex flex-col justify-between gap-4 h-full animate-stagger-item ${
                              exceeded 
                                ? 'border-expense/45 shadow-[0_0_12px_rgba(var(--color-expense-rgb),0.04)] bg-expense/5' 
                                : 'border-glass surface-glass hover:border-glass-strong hover:scale-[1.005]'
                            } ${index < 6 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300'][index] : ''}`}
                          >
                            <div className="space-y-3 flex-grow">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span 
                                    style={{ color: categoryColor }}
                                    className="flex items-center justify-center flex-shrink-0"
                                  >
                                    {getCategoryIcon(category.name, 16, categoryIconName)}
                                  </span>
                                  <p className="font-bold text-primary truncate text-sm">{category.name}</p>
                                  {category.name !== 'Sem categoria' && (
                                    <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity ml-1.5 flex-shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleOpenCategoryModal(category)
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
                                          handleDeleteCategoryClick(category)
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
                                  const base = expenseBaseByCategory.get(category.id) || 0
                                  if (base === spent) return null
                                  return (
                                    <p className="text-[9px] text-secondary/50">
                                      base {formatCurrency(base)}
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
                                      value={expenseLimitInputs[category.id] || ''}
                                      onChange={(event) =>
                                        setExpenseLimitInputs((prev) => ({
                                          ...prev,
                                          [category.id]: event.target.value,
                                        }))
                                      }
                                      placeholder="Limite (ex: 500)"
                                      className="w-full h-8 text-xs py-1"
                                      autoFocus
                                    />
                                    <Button
                                      type="button"
                                      size="xs"
                                      variant="ghost-success"
                                      onClick={async () => {
                                        await saveExpenseLimit(category.id)
                                        setEditingCategoryId(null)
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
                                      onClick={() => setEditingCategoryId(null)}
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
                                        const pct = getCategoryPercentageSuggestion(category)
                                        const calculated = Math.round((averageIncome * pct) / 1000) * 10 // round to nearest 10
                                        setExpenseLimitInputs((prev) => ({
                                          ...prev,
                                          [category.id]: formatMoneyInput(calculated),
                                        }))
                                      }}
                                      className="h-auto p-0 text-[10px] text-left text-secondary hover:text-primary transition-colors flex items-center gap-1 mt-0.5 font-normal hover:bg-transparent"
                                    >
                                      <span>Sugerido:</span>
                                      <span className="font-bold underline">
                                        {formatCurrency(Math.round((averageIncome * getCategoryPercentageSuggestion(category)) / 1000) * 10)}
                                      </span>
                                      <span>({getCategoryPercentageSuggestion(category)}% da renda)</span>
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <>
                                  <div className="text-xs text-secondary truncate">
                                    Limite: <span className="text-primary font-bold">{hasLimit ? formatCurrency(limitAmount) : 'Não definido'}</span>
                                    {!hasLimit && averageIncome > 0 && (
                                      <span className="text-[10px] text-secondary/70 block mt-0.5">
                                        Sugestão: {formatCurrency(Math.round((averageIncome * getCategoryPercentageSuggestion(category)) / 1000) * 10)}
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="outline"
                                    onClick={() => {
                                      setEditingCategoryId(category.id)
                                      setExpenseLimitInputs(prev => ({
                                        ...prev,
                                        [category.id]: hasLimit ? formatMoneyInput(limitAmount) : ''
                                      }))
                                    }}
                                    className="h-7 px-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                  >
                                    <Pencil size={10} />
                                    <span>Definir</span>
                                  </Button>
                                </>
                              )}      </div>
      <ScrollToTop />
    </div>
  )
})}

                      {categories.length < 15 && (
                        <div 
                          onClick={() => handleOpenCategoryModal()}
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
            ) : (
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
                        className="h-full rounded-full transition-all duration-500 animate-pulse-slow" 
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
                    <Card className="p-6 text-center text-secondary border border-glass surface-glass">
                      Nenhuma categoria de renda cadastrada.
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {sortedIncomeCategories.map((category, index) => {
                        const received = incomeByCategory.get(category.id) || 0
                        const expectationAmount = incomeExpectationMap.get(category.id)
                        const [colorPart, iconPart] = category.color ? category.color.split('|') : []
                        const categoryColor = incomeCategoryColorMap[category.id] || colorPart || category.color
                        const categoryIconName = iconPart || undefined
                        const hasExpectation = expectationAmount !== null && expectationAmount !== undefined
                        const exceeded = hasExpectation && received >= (expectationAmount || 0)
                        const isSaving = savingIncomeExpectationIds.includes(category.id)
                        const isEditing = editingCategoryId === category.id

                        const receivedPct = hasExpectation && expectationAmount > 0 ? (received / expectationAmount) * 100 : 0
                        
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
                            key={category.id}
                            className={`group rounded-xl border p-4 bg-primary transition-all duration-300 flex flex-col justify-between gap-4 h-full animate-stagger-item ${
                              exceeded 
                                ? 'border-income/45 shadow-[0_0_12px_rgba(var(--color-income-rgb),0.04)] bg-income/5' 
                                : 'border-glass surface-glass hover:border-glass-strong hover:scale-[1.005]'
                            } ${index < 6 ? ['delay-50', 'delay-100', 'delay-150', 'delay-200', 'delay-250', 'delay-300'][index] : ''}`}
                          >
                            <div className="space-y-3 flex-grow">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span 
                                    style={{ color: categoryColor }}
                                    className="flex items-center justify-center flex-shrink-0"
                                  >
                                    {getCategoryIcon(category.name, 16, categoryIconName)}
                                  </span>
                                  <p className="font-bold text-primary truncate text-sm">{category.name}</p>
                                  {category.name !== 'Sem categoria' && (
                                    <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 opacity-100 transition-opacity ml-1.5 flex-shrink-0">
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="xs"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleOpenCategoryModal(category)
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
                                          handleDeleteCategoryClick(category)
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
                                  const base = incomeBaseByCategory.get(category.id) || 0
                                  if (base === received) return null
                                  return (
                                    <p className="text-[9px] text-secondary/50">
                                      base {formatCurrency(base)}
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
                                    value={incomeExpectationInputs[category.id] || ''}
                                    onChange={(event) =>
                                      setIncomeExpectationInputs((prev) => ({
                                        ...prev,
                                        [category.id]: event.target.value,
                                      }))
                                    }
                                    placeholder="Meta (ex: 2000)"
                                    className="w-full h-8 text-xs py-1"
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    size="xs"
                                    variant="ghost-success"
                                    onClick={async () => {
                                      await saveIncomeExpectation(category.id)
                                      setEditingCategoryId(null)
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
                                    onClick={() => setEditingCategoryId(null)}
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
                                    onClick={() => {
                                      setEditingCategoryId(category.id)
                                      setIncomeExpectationInputs(prev => ({
                                        ...prev,
                                        [category.id]: hasExpectation ? formatMoneyInput(expectationAmount) : ''
                                      }))
                                    }}
                                    className="h-7 px-2.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider"
                                  >
                                    <Pencil size={10} />
                                    <span>Definir</span>
                                  </Button>
                                </>
                              )}      </div>
      <ScrollToTop />
    </div>
  )
})}

                      {incomeCategories.length < 15 && (
                        <div 
                          onClick={() => handleOpenCategoryModal()}
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
