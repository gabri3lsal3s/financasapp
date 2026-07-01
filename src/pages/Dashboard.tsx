import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePageActions } from '@/hooks/usePageActions'
import Card from '@/components/Card'
import { SkeletonDashboard } from '@/components/Skeleton'
import { useNavigate } from 'react-router-dom'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { formatCurrency, formatMonth, formatNumberWithTwoDecimalsBR, getCurrentMonthString } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, Plus, Sparkles, Send, Pin, RefreshCw, Bot, Calendar, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  CARD_PADDING,
  CARD_PADDING_LARGE,
  CARD_PADDING_XL,
  CARD_BASE,
  PAGE_ENTER_ANIMATION,
  CONTENT_PADDING,
} from '@/constants/layout'
import { motion, AnimatePresence } from 'framer-motion'
import { askGemini } from '@/services/geminiService'
import { BeautifulMarkdown } from '@/components/dashboard/BeautifulMarkdown'
import { InteractiveAIChart } from '@/components/dashboard/InteractiveAIChart'
import Button from '@/components/Button'
import BudgetHeroCard from '@/components/dashboard/BudgetHeroCard'
import ProjectionCard from '@/components/dashboard/ProjectionCard'
import QuickLaunchOption from '@/components/dashboard/QuickLaunchOption'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { supabase } from '@/lib/supabase'
import { portfolioInvestmentByDay, sumPortfolioTransactionsForMonth } from '@/utils/portfolioMonthlyFlow'
import { useDashboardPortfolio } from '@/hooks/useDashboardPortfolio'
import ExpenseFormModal from '@/components/ExpenseFormModal'
import IncomeFormModal from '@/components/IncomeFormModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import DailyFlowChart from '@/components/dashboard/DailyFlowChart'
import CategoryDetailMiniChart from '@/components/reports/CategoryDetailMiniChart'
import LimitsControl from '@/components/dashboard/LimitsControl'
import TransactionRow from '@/components/TransactionRow'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { addMonths } from '@/utils/format'
import { logger } from '@/utils/logger'
const EXPENSE_LIMIT_WARNING_THRESHOLD = 85

export default function Dashboard() {
  const currentMonth = getCurrentMonthString()
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isExpenseOpen, setIsExpenseOpen] = useState(false)
  const [isIncomeOpen, setIsIncomeOpen] = useState(false)
  const [isInvestmentOpen, setIsInvestmentOpen] = useState(false)
  const { isOnline } = useNetworkStatus()
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ id: string; name: string } | null>(null)

  // Portfolio data via extracted hook
  const {
    portfolioId,
    portfolioTransactions,
    loadPortfolioTransactions,
  } = useDashboardPortfolio()



  const { colorPalette } = usePaletteColors()
  const { categories, loading: categoriesLoading } = useCategories()
  const { incomeCategories, loading: incomeCategoriesLoading } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading, setCategoryLimit, refreshLimits } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

  const expenseAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const incomeAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const totalExpenses = expenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0)

  const portfolioMonthFlow = useMemo(
    () => sumPortfolioTransactionsForMonth(portfolioTransactions, currentMonth),
    [portfolioTransactions, currentMonth]
  )

  const totalInvestments = useMemo(() => {
    return portfolioMonthFlow
  }, [portfolioMonthFlow])

  const balance = totalIncomes - totalExpenses - totalInvestments
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0
  const hasMonthlyData =
    expenses.length > 0 ||
    incomes.length > 0 ||
    portfolioMonthFlow !== 0
  const loading =
    expensesLoading ||
    incomesLoading ||
    expenseLimitsLoading ||
    previousExpenseLimitsLoading

  // Previous month totals for trend badges
  const previousMonthExpenseTotal = useMemo(
    () => previousMonthExpenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0),
    [previousMonthExpenses]
  )
  const navigate = useNavigate()

  // AI Copilot States
  const [chatInput, setChatInput] = useState('')
  const [activeQueryText, setActiveQueryText] = useState('')
  const [activeReportText, setActiveReportText] = useState('Selecione uma das sugestões abaixo ou digite sua pergunta para que a Inteligência Artificial possa analisar seus dados consolidados e fornecer insights de economia imediata.')
  const [activeChartData, setActiveChartData] = useState<any[] | undefined>(undefined)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [pinnedAnalysis, setPinnedAnalysis] = useState<any>(null)
  const [isUpdatingPinned, setIsUpdatingPinned] = useState(false)

  // Compute data hash for pinning persistence comparison
  const currentHash = useMemo(() => {
    const expHash = `${expenses.length}_${formatNumberWithTwoDecimalsBR(totalExpenses)}`
    const incHash = `${incomes.length}_${formatNumberWithTwoDecimalsBR(totalIncomes)}`
    return `exp:${expHash}|inc:${incHash}`
  }, [expenses, totalExpenses, incomes, totalIncomes])

  const hasNewDataForPinned = useMemo(() => {
    return pinnedAnalysis && pinnedAnalysis.dataHash !== currentHash
  }, [pinnedAnalysis, currentHash])

  // Gasto Disponível integrated calculations
  const spendingCalcs = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const currentDay = today.getDate()

    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [selYear, selMonth] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(selYear, selMonth, 0).getDate()

    const monthlyAvailable = totalIncomes - totalInvestments - totalExpenses

    if (isPast) {
      return {
        mode: 'past' as const,
        title: 'Gasto Disponível (Mês Encerrado)',
        monthlyAvailable,
        dailyAvailable: 0,
        daysInMonth,
        remainingDays: 0,
      }
    }

    if (isFuture) {
      const totalProjected = totalIncomes - totalInvestments
      const dailyAvailable = daysInMonth > 0 ? Math.max(0, totalProjected / daysInMonth) : 0
      return {
        mode: 'future' as const,
        title: 'Gasto Disponível Projetado',
        monthlyAvailable: totalProjected,
        dailyAvailable,
        daysInMonth,
        remainingDays: daysInMonth,
      }
    }

    const remainingDays = daysInMonth - currentDay + 1
    const dailyAvailable = remainingDays > 0 ? Math.max(0, monthlyAvailable / remainingDays) : 0

    return {
      mode: 'current' as const,
      title: 'Gasto Disponível',
      currentDay,
      daysInMonth,
      remainingDays,
      monthlyAvailable,
      dailyAvailable
    }
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])

  // Smart Limits integrated calculations
  const currentLimitsMap = useMemo(() => {
    const map = new Map<string, number>()
    currentMonthExpenseLimits.forEach((l) => {
      if (l.limit_amount !== null && l.limit_amount !== undefined) {
        map.set(l.category_id, l.limit_amount)
      }
    })
    return map
  }, [currentMonthExpenseLimits])

  const spentMap = useMemo(() => {
    const map = new Map<string, number>()
    expenses.forEach((e) => {
      const weight = e.report_weight ?? 1
      map.set(e.category_id, (map.get(e.category_id) || 0) + e.amount * weight)
    })
    return map
  }, [expenses])

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

    exceededList.sort((a, b) => b.exceeded - a.exceeded)
    surplusList.sort((a, b) => b.surplus - a.surplus)

    const targetTo = exceededList[0]
    const targetFrom = surplusList[0]

    let amountToTransfer = Math.min(targetTo.exceeded, targetFrom.surplus)
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

  const [isReallocating, setIsReallocating] = useState(false)

  const handleReallocate = async () => {
    if (!reallocationRecommendation) return

    setIsReallocating(true)
    const { fromId, fromCurrentLimit, toId, toCurrentLimit, transferAmount } = reallocationRecommendation

    const fromNewLimit = Math.max(0, fromCurrentLimit - transferAmount)
    const toNewLimit = toCurrentLimit + transferAmount

    const res1 = await setCategoryLimit(fromId, fromNewLimit)
    if (res1.error) {
      alert(`Erro ao atualizar limite de origem: ${res1.error}`)
      setIsReallocating(false)
      return
    }

    const res2 = await setCategoryLimit(toId, toNewLimit)
    if (res2.error) {
      alert(`Erro ao atualizar limite de destino: ${res2.error}`)
      setIsReallocating(false)
      return
    }

    setIsReallocating(false)
    refreshLimits()
  }

  // Load pinned analysis from Supabase
  const loadPinnedAnalysis = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('pinned_ai_analyses')
        .select('pinned_analysis')
        .eq('user_id', user.id)
        .maybeSingle()

      if (error) throw error
      if (data?.pinned_analysis) {
        setPinnedAnalysis(data.pinned_analysis)
        // Default active report to pinned if it exists
        setActiveReportText(data.pinned_analysis.text)
        setActiveChartData(data.pinned_analysis.chartData)
        setActiveQueryText(data.pinned_analysis.queryText)
      }
    } catch (err) {
      logger.error('Erro ao carregar análise fixada:', err)
    }
  }, [])

  useEffect(() => {
    loadPinnedAnalysis()
  }, [loadPinnedAnalysis])

  // Save pinned analysis to Supabase
  const handlePin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const newPinned = {
        text: activeReportText,
        chartData: activeChartData,
        queryText: activeQueryText || 'Relatório Consolidado',
        dataHash: currentHash
      }

      const { error } = await supabase
        .from('pinned_ai_analyses')
        .upsert({
          user_id: user.id,
          pinned_analysis: newPinned,
          updated_at: new Date().toISOString()
        })

      if (error) throw error
      setPinnedAnalysis(newPinned)
    } catch (err) {
      logger.error('Erro ao fixar análise:', err)
    }
  }

  // Delete/unpin analysis from Supabase
  const handleUnpin = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('pinned_ai_analyses')
        .delete()
        .eq('user_id', user.id)

      if (error) throw error
      setPinnedAnalysis(null)
    } catch (err) {
      logger.error('Erro ao desafixar análise:', err)
    }
  }

  // Update pinned analysis when transaction counts/amounts change
  const handleUpdatePinnedAnalysis = async () => {
    if (!pinnedAnalysis) return
    setIsUpdatingPinned(true)
    try {
      const query = pinnedAnalysis.queryText || 'Acompanhamento diário'
      
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      const financialsContext = {
        balance,
        totalIncome: totalIncomes,
        totalExpense: totalExpenses,
        totalInvestment: totalInvestments,
        spentToday: expenses
          .filter(e => e.date === todayStr)
          .reduce((sum, e) => sum + e.amount * (e.report_weight ?? 1), 0),
        cardInvoice: creditCards.reduce((sum, card) => sum + (card.limit_total || 0), 0),
        expenses: expenses.map(e => ({
          id: e.id,
          title: e.description || '',
          category: e.category?.name || 'Outros',
          amount: e.amount,
          date: e.date,
          group: e.payment_method === 'credit_card' ? 'Cartão de Crédito' : 'Outros'
        })),
        incomes: incomes.map(i => ({
          id: i.id,
          title: i.description || '',
          category: i.income_category?.name || 'Outros',
          amount: i.amount,
          date: i.date
        }))
      }

      const result = await askGemini(
        [{ sender: 'user', text: query }],
        financialsContext
      )

      const updatedPinned = {
        text: result.text,
        chartData: result.chartData,
        queryText: query,
        dataHash: currentHash
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('pinned_ai_analyses')
          .upsert({
            user_id: user.id,
            pinned_analysis: updatedPinned,
            updated_at: new Date().toISOString()
          })
      }

      setPinnedAnalysis(updatedPinned)
      if (activeQueryText === query) {
        setActiveReportText(result.text)
        setActiveChartData(result.chartData)
      }
    } catch (err) {
      logger.error('Erro ao atualizar análise fixada:', err)
    } finally {
      setIsUpdatingPinned(false)
    }
  }

  // Main chat submit handler with natural language command parser
  const handleSendChat = async (e?: React.FormEvent, customText?: string) => {
    if (e) e.preventDefault()
    const textToSend = customText || chatInput
    if (!textToSend.trim()) return

    setChatInput('')
    setIsAiTyping(true)
    setActiveQueryText(textToSend)

    const lower = textToSend.toLowerCase()
    
    // Natural Language Transaction Parser
    let parsedAmount = 0
    let parsedTitle = ''
    let parsedType: 'despesa' | 'receita' | null = null
    let parsedCategory = 'Outros'

    const isExpense = lower.includes('despesa') || lower.includes('gastei') || lower.includes('gastou') || lower.includes('gasto') || lower.includes('paguei') || lower.includes('pagou') || lower.includes('compra') || lower.includes('comprei')
    const isIncome = lower.includes('receita') || lower.includes('recebi') || lower.includes('ganhei') || lower.includes('renda') || lower.includes('entrada') || lower.includes('salário') || lower.includes('salario') || lower.includes('pix')

    if (isExpense || isIncome) {
      parsedType = isExpense ? 'despesa' : 'receita'
      
      const rxAmount = /(?:r\$\s*)?(\d+(?:[.,]\d{2})?)/i
      const amountMatch = lower.match(rxAmount)
      if (amountMatch) {
        const rawAmount = amountMatch[1].replace(',', '.')
        parsedAmount = parseFloat(rawAmount)
      }
      
      const rxDesc = /(?:com|de|em|para)\s+([a-zA-Z0-9\sãáàâéêíóôúç]{3,20})/i
      const descMatch = lower.match(rxDesc)
      if (descMatch) {
        parsedTitle = descMatch[1].trim()
        parsedTitle = parsedTitle.charAt(0).toUpperCase() + parsedTitle.slice(1)
      } else {
        parsedTitle = isExpense ? 'Gasto IA' : 'Receita IA'
      }

      if (parsedTitle.toLowerCase().includes('cafe') || parsedTitle.toLowerCase().includes('almoço') || parsedTitle.toLowerCase().includes('comida') || parsedTitle.toLowerCase().includes('refrigerante') || parsedTitle.toLowerCase().includes('pizza')) {
        parsedCategory = 'Supermercado'
      } else if (parsedTitle.toLowerCase().includes('carro') || parsedTitle.toLowerCase().includes('gasolina') || parsedTitle.toLowerCase().includes('uber') || parsedTitle.toLowerCase().includes('taxi') || parsedTitle.toLowerCase().includes('transporte')) {
        parsedCategory = 'Transporte'
      } else if (parsedTitle.toLowerCase().includes('cinema') || parsedTitle.toLowerCase().includes('role') || parsedTitle.toLowerCase().includes('festa') || parsedTitle.toLowerCase().includes('lazer')) {
        parsedCategory = 'Lazer'
      } else if (parsedTitle.toLowerCase().includes('salario') || parsedTitle.toLowerCase().includes('pagamento') || parsedTitle.toLowerCase().includes('reembolso')) {
        parsedCategory = 'Reembolso'
      } else if (parsedTitle.toLowerCase().includes('monitoria')) {
        parsedCategory = 'Monitoria'
      }
    }

    if (parsedType && parsedAmount > 0) {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)
      const selectedMonthPrefix = currentMonth
      let dateToUse = todayStr
      if (!todayStr.startsWith(selectedMonthPrefix)) {
        dateToUse = `${selectedMonthPrefix}-01`
      }

      try {
        if (parsedType === 'despesa') {
          let category_id = ''
          const matchedCategory = categories.find(c =>
            c.name.toLowerCase() === parsedCategory.toLowerCase() ||
            parsedTitle.toLowerCase().includes(c.name.toLowerCase())
          )
          if (matchedCategory) {
            category_id = matchedCategory.id
            parsedCategory = matchedCategory.name
          } else {
            const defaultCategory = categories.find(c => c.name.toLowerCase().includes('outr')) || categories[0]
            category_id = defaultCategory?.id || ''
            parsedCategory = defaultCategory?.name || 'Outros'
          }

          const res = await createExpense({
            amount: parsedAmount,
            description: parsedTitle,
            category_id,
            date: dateToUse,
            payment_method: 'cash',
            installment_total: 1,
            report_weight: 1
          })

          if (!res.error) {
            refreshExpenses()
          }
        } else {
          let income_category_id = ''
          const matchedIncomeCategory = incomeCategories.find(c =>
            c.name.toLowerCase() === parsedCategory.toLowerCase() ||
            parsedTitle.toLowerCase().includes(c.name.toLowerCase())
          )
          if (matchedIncomeCategory) {
            income_category_id = matchedIncomeCategory.id
            parsedCategory = matchedIncomeCategory.name
          } else {
            const defaultIncomeCategory = incomeCategories.find(c => c.name.toLowerCase().includes('outr')) || incomeCategories[0]
            income_category_id = defaultIncomeCategory?.id || ''
            parsedCategory = defaultIncomeCategory?.name || 'Outros'
          }

          const res = await createIncome({
            amount: parsedAmount,
            description: parsedTitle,
            income_category_id,
            date: dateToUse,
            type: 'cash',
            report_weight: 1
          })

          if (!res.error) {
            refreshIncomes()
          }
        }

        setTimeout(() => {
          setActiveReportText(`🎯 **Entendido!** Adicionei com sucesso esta ${parsedType === 'despesa' ? 'despesa' : 'receita'} ao seu aplicativo:\n\n• **Item:** ${parsedTitle}\n• **Valor:** R$ ${formatCurrency(parsedAmount)}\n• **Categoria:** ${parsedCategory}\n\nSeu saldo, limites e gráficos foram atualizados na tela em tempo real!`)
          setActiveChartData(undefined)
          setIsAiTyping(false)
        }, 750)
      } catch (err) {
        logger.error('Erro ao adicionar transação via IA:', err)
        setIsAiTyping(false)
      }
      return
    }

    try {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      const financialsContext = {
        balance,
        totalIncome: totalIncomes,
        totalExpense: totalExpenses,
        totalInvestment: totalInvestments,
        spentToday: expenses
          .filter(e => e.date === todayStr)
          .reduce((sum, e) => sum + e.amount * (e.report_weight ?? 1), 0),
        cardInvoice: creditCards.reduce((sum, card) => sum + (card.limit_total || 0), 0),
        expenses: expenses.map(e => ({
          id: e.id,
          title: e.description || '',
          category: e.category?.name || 'Outros',
          amount: e.amount,
          date: e.date,
          group: e.payment_method === 'credit_card' ? 'Cartão de Crédito' : 'Outros'
        })),
        incomes: incomes.map(i => ({
          id: i.id,
          title: i.description || '',
          category: i.income_category?.name || 'Outros',
          amount: i.amount,
          date: i.date
        }))
      }

      const result = await askGemini(
        [{ sender: 'user', text: textToSend }],
        financialsContext
      )

      setActiveReportText(result.text)
      setActiveChartData(result.chartData)
    } catch (err) {
      logger.error('Erro ao consultar o assistente Gemini:', err)
      setActiveReportText('Ocorreu um erro ao processar a resposta. Por favor, tente novamente mais tarde.')
    } finally {
      setIsAiTyping(false)
    }
  }


  useEffect(() => {
    const isReady = !expensesLoading && !incomesLoading && !categoriesLoading && !incomeCategoriesLoading
    if (isReady && categories.length === 0 && incomeCategories.length === 0) {
      navigate('/onboarding', { replace: true })
    }
  }, [expensesLoading, incomesLoading, categoriesLoading, incomeCategoriesLoading, categories.length, incomeCategories.length, navigate])

  // monthlyOverviewData removed because pizza chart was removed

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; name: string; color: string; iconName?: string; value: number; baseValue: number }>()

    expenses.forEach((expense) => {
      const name = expense.category?.name || 'Sem categoria'
      const categoryId = expense.category?.id || expense.category_id || ''
      const key = categoryId || name
      const category = categories.find((c) => c.id === categoryId)
      const rawColor = category?.color || expense.category?.color || 'var(--color-primary)'
      const [_, iconName] = rawColor.split('|')
      const color = getCategoryColorForPalette(rawColor, colorPalette)
      const current = map.get(key)

      if (current) {
        current.value += expenseAmountForDashboard(expense.amount, expense.report_weight)
        current.baseValue += expense.amount
      } else {
        map.set(key, { categoryId, name, color, iconName, value: expenseAmountForDashboard(expense.amount, expense.report_weight), baseValue: expense.amount })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [expenses, categories, colorPalette])

  /* ── Projeção de Fim do Mês ── */
  const spendingProjection = useMemo(() => {
    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonthNum = today.getMonth() + 1
    const systemMonthStr = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`
    const isPast = currentMonth < systemMonthStr
    const isFuture = currentMonth > systemMonthStr

    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    if (daysInMonth <= 0) return null

    // For past months: show actual results (projection = what happened)
    if (isPast) {
      return {
        daysElapsed: daysInMonth,
        daysInMonth,
        currentDay: daysInMonth,
        dailyBurnRate: daysInMonth > 0 ? totalExpenses / daysInMonth : 0,
        projectedEndOfMonthExpenses: totalExpenses,
        projectedSurplus: totalIncomes - totalInvestments - totalExpenses,
        onTrack: (totalIncomes - totalInvestments - totalExpenses) >= 0,
        mode: 'past' as const,
      }
    }

    // For future months: projection not applicable (no data yet)
    if (isFuture) return null

    // Current month: project based on pace so far
    const currentDay = today.getDate()
    if (currentDay < 3) return null // Only meaningful after a few days

    const daysElapsed = Math.min(currentDay, daysInMonth)
    const dailyBurnRate = daysElapsed > 0 ? totalExpenses / daysElapsed : 0
    const projectedEndOfMonthExpenses = dailyBurnRate * daysInMonth
    const projectedSurplus = totalIncomes - totalInvestments - projectedEndOfMonthExpenses
    const onTrack = projectedSurplus >= 0

    return {
      daysElapsed,
      daysInMonth,
      currentDay,
      dailyBurnRate,
      projectedEndOfMonthExpenses,
      projectedSurplus,
      onTrack,
      mode: 'current' as const,
    }
  }, [currentMonth, totalExpenses, totalIncomes, totalInvestments])

  const currentMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    currentMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [currentMonthExpenseLimits])

  const previousMonthExpenseLimitMap = useMemo(() => {
    const map = new Map<string, number | null>()
    previousMonthExpenseLimits.forEach((item) => map.set(item.category_id, item.limit_amount))
    return map
  }, [previousMonthExpenseLimits])

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

  const expenseLimitAlerts = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined

        if (!hasLimit) return null

        const exceededAmount = item.value - (limitAmount || 0)
        if (exceededAmount <= 0) return null

        const exceededPercentage = (limitAmount || 0) > 0 ? (exceededAmount / (limitAmount || 1)) * 100 : 100
        const usagePercentage = (limitAmount || 0) > 0 ? (item.value / (limitAmount || 1)) * 100 : 100

        return {
          ...item,
          limitAmount: limitAmount || 0,
          exceededAmount,
          exceededPercentage,
          usagePercentage,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.exceededAmount - a.exceededAmount)
  }, [expenseByCategory, expenseLimitMap])

  // expenseCategoriesPieData removed because pizza chart was removed

  const expenseAttentionCategories = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const limitAmount = item.categoryId ? expenseLimitMap.get(item.categoryId) : undefined
        const hasLimit = limitAmount !== null && limitAmount !== undefined

        if (!hasLimit || (limitAmount || 0) <= 0) return null

        const usagePercentage = (item.value / (limitAmount || 1)) * 100
        const isNearLimit = usagePercentage >= EXPENSE_LIMIT_WARNING_THRESHOLD && usagePercentage < 100

        if (!isNearLimit) return null

        const level = usagePercentage >= 95 ? 'Crítica' : usagePercentage >= 90 ? 'Alta' : 'Média'

        return {
          ...item,
          level,
          usagePercentage,
          limitAmount: limitAmount || 0,
          remainingAmount: (limitAmount || 0) - item.value,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseByCategory, expenseLimitMap])

  const limitsExceededCount = useMemo(() => expenseLimitAlerts.length, [expenseLimitAlerts])

  // Category summaries for FinancialInsights
  const categoryExpenseSummaries = useMemo(() =>
    expenseByCategory.map(item => ({ category_name: item.name, total: item.value, baseTotal: item.baseValue })),
    [expenseByCategory]
  )

  // Income by category for concentration analysis
  const incomeByCategory = useMemo(() => {
    const map = new Map<string, number>()
    incomes.forEach((inc) => {
      const name = inc.income_category?.name || 'Outros'
      const amount = incomeAmountForDashboard(inc.amount, inc.report_weight)
      map.set(name, (map.get(name) || 0) + amount)
    })
    return Array.from(map.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
  }, [incomes])

  // Mid-month spending pace check — compares expenses so far to income-based benchmark
  const spendingPace = useMemo(() => {
    if (totalIncomes <= 0 || totalExpenses <= 0) return null

    const today = new Date()
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const currentDay = today.getDate()

    if (currentDay <= 7) return null // Only meaningful after first week

    const monthFraction = currentDay / daysInMonth
    if (monthFraction < 0.3) return null // Need at least 30% of month elapsed

    // Benchmark: if income were spread evenly across the month,
    // how much should have been spent by now to stay on track?
    const fairShare = (totalIncomes - totalInvestments) * monthFraction
    if (fairShare <= 0) return null

    if (totalExpenses > fairShare) {
      const overPct = ((totalExpenses - fairShare) / fairShare) * 100
      return { overPct, isOverBudget: true }
    }

    return null
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments])

  // Weekday expense data for FinancialInsights
  const weekdayExpenseData = useMemo(() => {
    const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
    const totals = labels.map((label) => ({ dia: label, Despesas: 0 }))

    expenses.forEach((expense) => {
      if (!expense.date?.startsWith(currentMonth)) return
      const localDate = new Date(`${expense.date}T00:00:00`)
      if (Number.isNaN(localDate.getTime())) return
      const dayOfWeek = localDate.getDay()
      const mondayFirstIndex = (dayOfWeek + 6) % 7
      totals[mondayFirstIndex].Despesas += expenseAmountForDashboard(expense.amount, expense.report_weight)
    })

    return totals
  }, [expenses, currentMonth])

  // Dynamic Insights to be used as AI suggestions
  const dynamicAiSuggestions = useMemo(() => {
    const list: Array<{
      id: string
      text: string
      tip: string
      query: string
      icon: React.ReactNode
    }> = []

    // 1. Limits Exceeded (Most critical warning)
    if (limitsExceededCount > 0) {
      list.push({
        id: 'limits-exceeded',
        text: `Limite estourado em ${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'}.`,
        tip: `Reduza gastos nas demais categorias imediatamente para equilibrar o orçamento.`,
        query: `Quais estratégias posso usar para conter gastos nas ${limitsExceededCount} categorias onde estourei o limite de orçamento?`,
        icon: <AlertTriangle size={14} className="text-expense" />,
      })
    }

    // 2. Savings Rate Insight (Overall financial performance)
    if (totalIncomes > 0) {
      if (savingsRate >= 20) {
        list.push({
          id: 'savings-rate',
          text: `Poupou ${formatNumberWithTwoDecimalsBR(savingsRate)}% da renda em ${formatMonth(currentMonth)} (meta: 20%).`,
          tip: `Excelente! Direcione este excedente poupado para investimentos e acelere seus planos.`,
          query: `Como posso otimizar meus investimentos considerando que poupei ${formatNumberWithTwoDecimalsBR(savingsRate)}% da minha renda este mês?`,
          icon: <TrendingDown size={14} className="text-income" />,
        })
      } else if (savingsRate > 0 && savingsRate < 20) {
        list.push({
          id: 'savings-rate',
          text: `Poupança em ${formatNumberWithTwoDecimalsBR(savingsRate)}% da renda (abaixo da meta de 20%).`,
          tip: `Corte pequenos gastos supérfluos para tentar atingir a meta recomendada.`,
          query: `Como posso aumentar minha taxa de poupança atual de ${formatNumberWithTwoDecimalsBR(savingsRate)}% para a meta saudável de 20%?`,
          icon: <TrendingUp size={14} className="text-primary" />,
        })
      } else if (savingsRate <= 0) {
        list.push({
          id: 'savings-rate',
          text: `Saldo líquido negativo em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% este mês.`,
          tip: `Alerta: Suas despesas superaram a renda. Evite qualquer compra supérflua de imediato.`,
          query: `Quais ações imediatas devo tomar porque minhas despesas superaram minhas receitas em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% este mês?`,
          icon: <AlertTriangle size={14} className="text-expense" />,
        })
      }
    }

    // 3. Expense Variation (Comparison to previous month)
    if (previousMonthExpenseTotal > 0 && totalExpenses > 0) {
      const diffPct = ((totalExpenses - previousMonthExpenseTotal) / previousMonthExpenseTotal) * 100
      if (diffPct < -5) {
        list.push({
          id: 'expense-variance',
          text: `Despesas caíram ${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}% comparado ao mês anterior.`,
          tip: `Bom trabalho! Continue mantendo esse ritmo disciplinado para poupar mais.`,
          query: `Analise a redução de despesas de ${formatNumberWithTwoDecimalsBR(Math.abs(diffPct))}% que tive em relação ao mês anterior e como manter essa tendência.`,
          icon: <TrendingDown size={14} className="text-income" />,
        })
      } else if (diffPct > 5) {
        list.push({
          id: 'expense-variance',
          text: `Despesas subiram ${formatNumberWithTwoDecimalsBR(diffPct)}% comparado ao mês anterior.`,
          tip: `Atenção: Modere o consumo diário nas semanas restantes para conter essa alta.`,
          query: `Quais fatores e categorias causaram o aumento de ${formatNumberWithTwoDecimalsBR(diffPct)}% nas minhas despesas em comparação com o mês anterior?`,
          icon: <TrendingUp size={14} className="text-expense" />,
        })
      }
    }

    // 4. Top Category (Main cost driver)
    if (categoryExpenseSummaries.length > 0 && totalExpenses > 0) {
      const sorted = [...categoryExpenseSummaries].sort((a, b) => b.total - a.total)
      const topCat = sorted[0]
      const topPct = (topCat.total / totalExpenses) * 100
      if (topPct > 15) {
        list.push({
          id: 'top-category',
          text: `"${topCat.category_name}" foi seu maior custo (${formatCurrency(topCat.total)} - ${formatNumberWithTwoDecimalsBR(topPct)}%).`,
          tip: `Defina um limite específico para esta categoria para reduzir o impacto no total.`,
          query: `Como posso economizar e cortar gastos na minha maior categoria de despesas: ${topCat.category_name}, onde gastei ${formatCurrency(topCat.total)}?`,
          icon: <Sparkles size={14} className="text-primary" />,
        })
      }
    }

    // 5. Peak Weekday (Day concentration)
    if (weekdayExpenseData && weekdayExpenseData.length > 0) {
      const sortedDays = [...weekdayExpenseData].sort((a, b) => b.Despesas - a.Despesas)
      const peakDay = sortedDays[0]
      if (peakDay && peakDay.Despesas > 0) {
        const fullDayNames: Record<string, string> = {
          Seg: 'Segunda-feira',
          Ter: 'Terça-feira',
          Qua: 'Quarta-feira',
          Qui: 'Quinta-feira',
          Sex: 'Sexta-feira',
          Sáb: 'Sábado',
          Dom: 'Domingo',
        }
        list.push({
          id: 'peak-weekday',
          text: `Pico de gastos na(o) ${fullDayNames[peakDay.dia] || peakDay.dia} (${formatCurrency(peakDay.Despesas)}).`,
          tip: `Evite compras impulsivas concentradas nesse dia da semana. Planeje os gastos.`,
          query: `Como posso controlar melhor as compras por impulso ou despesas recorrentes concentradas no dia: ${fullDayNames[peakDay.dia] || peakDay.dia}?`,
          icon: <Calendar size={14} className="text-primary" />,
        })
      }
    }

    // 6. Investment Ratio (what % of income went to investments)
    if (totalIncomes > 0 && totalInvestments > 0) {
      const investPct = (totalInvestments / totalIncomes) * 100
      if (investPct >= 15) {
        list.push({
          id: 'investment-ratio',
          text: `Aportou ${formatNumberWithTwoDecimalsBR(investPct)}% da renda em investimentos.`,
          tip: `Continue nesse ritmo para acelerar a construção do seu patrimônio líquido.`,
          query: `Como posso otimizar a alocação dos meus ${formatCurrency(totalInvestments)} em investimentos para maximizar retornos ajustados ao risco?`,
          icon: <PiggyBank size={14} className="text-balance" />,
        })
      } else if (investPct > 0 && investPct < 15) {
        list.push({
          id: 'investment-ratio',
          text: `Apenas ${formatNumberWithTwoDecimalsBR(investPct)}% da renda foi investida.`,
          tip: `Tente aumentar para ao menos 15% — reveja assinaturas e gastos recorrentes.`,
          query: `Quais despesas posso cortar para aumentar minha taxa de investimento de ${formatNumberWithTwoDecimalsBR(investPct)}% para pelo menos 15%?`,
          icon: <PiggyBank size={14} className="text-primary" />,
        })
      }
    }

    // 8. Income Concentration (main income source)
    if (incomeByCategory.length > 0 && totalIncomes > 0) {
      const topIncome = incomeByCategory[0]
      const topPct = (topIncome.total / totalIncomes) * 100
      if (topPct > 50) {
        list.push({
          id: 'income-concentration',
          text: `${topIncome.name} representa ${formatNumberWithTwoDecimalsBR(topPct)}% da sua renda.`,
          tip: `Dependência alta de uma única fonte. Considere diversificar para reduzir riscos.`,
          query: `Minha renda está muito concentrada em ${topIncome.name} (${formatNumberWithTwoDecimalsBR(topPct)}% do total). Como posso diversificar minhas fontes de receita?`,
          icon: <TrendingUp size={14} className="text-warning" />,
        })
      }
    }

    // 9. Spending Pace (mid-month trajectory check)
    if (spendingPace && spendingPace.isOverBudget && spendingPace.overPct > 5) {
      list.push({
        id: 'spending-pace',
        text: `Ritmo de gastos ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do esperado para esta altura do mês.`,
        tip: `Ajuste o ritmo nos próximos dias para não estourar o orçamento mensal.`,
        query: `Meus gastos estão ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do ritmo esperado para esta altura do mês. Quais categorias devo priorizar para cortar?`,
        icon: <AlertTriangle size={14} className="text-expense" />,
      })
    }

    // 7. Projected End-of-Month Alert
    if (spendingProjection && spendingProjection.currentDay >= 10) {
      if (!spendingProjection.onTrack) {
        list.push({
          id: 'end-of-month-projection',
          text: `Projeção de déficit de ${formatCurrency(Math.abs(spendingProjection.projectedSurplus))} no fim do mês.`,
          tip: `Seu ritmo atual de ${formatCurrency(spendingProjection.dailyBurnRate)}/dia excede o orçamento. Corte gastos descartáveis agora para evitar o vermelho.`,
          query: `Minhas despesas projetam um déficit de ${formatCurrency(Math.abs(spendingProjection.projectedSurplus))} para o fim do mês. Quais categorias devo cortar imediatamente para equilibrar as contas?`,
          icon: <AlertTriangle size={14} className="text-expense" />,
        })
      } else if (spendingProjection.projectedSurplus > 0 && spendingProjection.projectedSurplus < totalIncomes * 0.05) {
        list.push({
          id: 'end-of-month-projection',
          text: `Margem apertada: projeção de superávit de apenas ${formatCurrency(spendingProjection.projectedSurplus)}.`,
          tip: `Pequenos cortes agora podem transformar este aperto em uma folga confortável para investir.`,
          query: `Meu saldo projetado para o fim do mês é de apenas ${formatCurrency(spendingProjection.projectedSurplus)}. Que pequenos cortes posso fazer nas despesas diárias para melhorar essa margem?`,
          icon: <TrendingUp size={14} className="text-warning" />,
        })
      } else if (spendingProjection.projectedSurplus >= totalIncomes * 0.15) {
        list.push({
          id: 'end-of-month-projection',
          text: `Folga de ${formatCurrency(spendingProjection.projectedSurplus)} projetada. Ótimo ritmo!`,
          tip: `Com essa folga, você pode direcionar ${formatCurrency(spendingProjection.projectedSurplus * 0.5)} para investimentos e ainda manter ${formatCurrency(spendingProjection.projectedSurplus * 0.5)} de reserva.`,
          query: `Tenho uma folga projetada de ${formatCurrency(spendingProjection.projectedSurplus)} para o fim do mês. Como alocar esse excedente entre investimentos e reserva de emergência?`,
          icon: <CheckCircle2 size={14} className="text-income" />,
        })
      }
    }

    // 8. Expense-to-Income Ratio (overall burn rate)
    if (totalIncomes > 0) {
      const burnRate = (totalExpenses / totalIncomes) * 100
      if (burnRate > 85) {
        list.push({
          id: 'burn-rate',
          text: `${formatNumberWithTwoDecimalsBR(burnRate)}% da renda consumida por despesas.`,
          tip: `Alerta vermelho: sobra muito pouco para investir. Corte gastos supérfluos agora.`,
          query: `Quais são as despesas não-essenciais que mais impactam minha taxa de consumo de ${formatNumberWithTwoDecimalsBR(burnRate)}% e como reduzi-las?`,
          icon: <AlertTriangle size={14} className="text-expense" />,
        })
      } else if (burnRate <= 50) {
        list.push({
          id: 'burn-rate',
          text: `Apenas ${formatNumberWithTwoDecimalsBR(burnRate)}% da renda vai para despesas.`,
          tip: `Excelente controle! Considere aumentar seus aportes mensais.`,
          query: `Com uma taxa de despesas de apenas ${formatNumberWithTwoDecimalsBR(burnRate)}%, como posso melhor alocar o excedente entre reserva de emergência e investimentos?`,
          icon: <CheckCircle2 size={14} className="text-income" />,
        })
      }
    }

    // Priority ordering: most critical first
    const priorityOrder: Record<string, number> = {
      'savings-rate': 0,  // will be overridden by specific sub-type
      'limits-exceeded': 90,
      'spending-pace': 85,
      'burn-rate': 80,
      'expense-variance': 70,
      'income-concentration': 60,
      'investment-ratio': 50,
      'top-category': 40,
      'peak-weekday': 30,
    }

    list.sort((a, b) => {
      // For savings-rate, check if it's the negative variant (higher priority)
      const aIsNeg = a.id === 'savings-rate' && a.text.includes('negativo')
      const bIsNeg = b.id === 'savings-rate' && b.text.includes('negativo')
      if (aIsNeg && !bIsNeg) return -1
      if (!aIsNeg && bIsNeg) return 1

      // For burn-rate, check if it's the high variant (higher priority)
      const aIsHighBurn = a.id === 'burn-rate' && a.text.includes('consumida')
      const bIsHighBurn = b.id === 'burn-rate' && b.text.includes('consumida')
      if (aIsHighBurn && !bIsHighBurn) return -1
      if (!aIsHighBurn && bIsHighBurn) return 1

      const pa = priorityOrder[a.id] ?? 50
      const pb = priorityOrder[b.id] ?? 50
      return pb - pa // higher number = higher priority
    })

    // Limit to at most 6 insights of highest priority
    return list.slice(0, 6)
  }, [currentMonth, totalIncomes, totalExpenses, totalInvestments, savingsRate, categoryExpenseSummaries, previousMonthExpenseTotal, weekdayExpenseData, limitsExceededCount, incomeByCategory, spendingPace, spendingProjection])

  const categoriesAttentionList = useMemo(() => {
    const list: Array<{
      categoryId: string
      name: string
      color: string
      iconName?: string
      value: number
      baseValue: number
      limitAmount: number
      usagePercentage: number
      isExceeded: boolean
      exceededAmount?: number
      remainingAmount?: number
      statusLabel: string
      alertStatusClass: string
    }> = []

    expenseLimitAlerts.forEach((alert) => {
      list.push({
        categoryId: alert.categoryId || '',
        name: alert.name,
        color: alert.color,
        iconName: alert.iconName,
        value: alert.value,
        baseValue: alert.baseValue,
        limitAmount: alert.limitAmount,
        usagePercentage: alert.usagePercentage,
        isExceeded: true,
        exceededAmount: alert.exceededAmount,
        statusLabel: 'Excedido',
        alertStatusClass: 'text-expense font-bold bg-expense/10 px-2 py-0.5 rounded-full'
      })
    })

    expenseAttentionCategories.forEach((alert) => {
      list.push({
        categoryId: alert.categoryId || '',
        name: alert.name,
        color: alert.color,
        iconName: alert.iconName,
        value: alert.value,
        baseValue: alert.baseValue,
        limitAmount: alert.limitAmount,
        usagePercentage: alert.usagePercentage,
        isExceeded: false,
        remainingAmount: alert.remainingAmount,
        statusLabel: alert.level === 'Crítica' ? 'Crítico (95%+)' : alert.level === 'Alta' ? 'Alerta (90%+)' : 'Atenção (85%+)',
        alertStatusClass: 'text-secondary font-bold bg-secondary/10 px-2 py-0.5 rounded-full'
      })
    })

    return list.sort((a, b) => b.usagePercentage - a.usagePercentage)
  }, [expenseLimitAlerts, expenseAttentionCategories])

  const dailyFlowData = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const series = Array.from({ length: daysInMonth }, (_, index) => ({
      day: String(index + 1).padStart(2, '0'),
      Rendas: 0,
      Despesas: 0,
      Investimentos: 0,
    }))

    incomes.forEach((income) => {
      const day = new Date(`${income.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) series[day - 1].Rendas += incomeAmountForDashboard(income.amount, income.report_weight)
    })

    expenses.forEach((expense) => {
      const day = new Date(`${expense.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) series[day - 1].Despesas += expenseAmountForDashboard(expense.amount, expense.report_weight)
    })

    const portfolioByDay = portfolioInvestmentByDay(portfolioTransactions, currentMonth, daysInMonth)
    portfolioByDay.forEach((value, index) => {
      series[index].Investimentos += value
    })

    return series
  }, [currentMonth, incomes, expenses, portfolioTransactions])

  const openExpenseCategoryDetails = (categoryId: string, categoryName: string) => {
    if (!categoryId) return
    setSelectedExpenseCategory({ id: categoryId, name: categoryName })
  }

  const selectedExpenseCategoryDetails = useMemo(() => {
    if (!selectedExpenseCategory) return null

    const currentItems = expenses.filter((expense) => (expense.category?.id || expense.category_id || '') === selectedExpenseCategory.id)
    const previousItems = previousMonthExpenses.filter((expense) => (expense.category?.id || expense.category_id || '') === selectedExpenseCategory.id)

    const currentTotal = currentItems.reduce((sum, item) => sum + expenseAmountForDashboard(item.amount, item.report_weight), 0)
    const previousTotal = previousItems.reduce((sum, item) => sum + expenseAmountForDashboard(item.amount, item.report_weight), 0)

    return {
      currentItems,
      currentTotal,
      previousTotal,
    }
  }, [selectedExpenseCategory, expenses, previousMonthExpenses])

  const selectedExpenseCategoryLimitDetails = useMemo(() => {
    if (!selectedExpenseCategory || !selectedExpenseCategoryDetails) return null

    const rawLimit = expenseLimitMap.get(selectedExpenseCategory.id)
    const hasLimit = rawLimit !== null && rawLimit !== undefined

    if (!hasLimit) return null

    const limitAmount = rawLimit || 0
    const currentTotal = selectedExpenseCategoryDetails.currentTotal
    const exceededAmount = Math.max(currentTotal - limitAmount, 0)
    const remainingAmount = Math.max(limitAmount - currentTotal, 0)

    return {
      limitAmount,
      currentTotal,
      exceededAmount,
      remainingAmount,
      isExceeded: currentTotal > limitAmount,
    }
  }, [selectedExpenseCategory, selectedExpenseCategoryDetails, expenseLimitMap])

  const miniChartItems = useMemo(() => {
    if (!selectedExpenseCategoryDetails) return []
    return selectedExpenseCategoryDetails.currentItems.map((item) => ({
      id: item.id,
      description: item.description || item.category?.name || 'Despesa',
      date: item.date,
      amount: expenseAmountForDashboard(item.amount, item.report_weight),
    }))
  }, [selectedExpenseCategoryDetails])

  const toggleDailyFlowSeries = (dataKey: string) => {
    setHiddenDailyFlowSeries((prev) =>
      prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey]
    )
  }

  const isAnyModalOpen = isSelectorOpen || isExpenseOpen || isIncomeOpen || isInvestmentOpen

  usePageActions(
    [
      {
        icon: Plus,
        label: 'Lançamento',
        intent: 'primary',
        actionRole: 'launch',
        compactOnMobile: false,
        onClick: () => setIsSelectorOpen(true),
        disabled: categories.length === 0 && incomeCategories.length === 0,
      },
    ],
    isAnyModalOpen
  )

  useEffect(() => {
    const onDataChanged = () => {
      if (isOnline) {
        void loadPortfolioTransactions()
      }
    }

    if (isOnline) {
      void loadPortfolioTransactions()
    }

    window.addEventListener('local-data-changed', onDataChanged)
    return () => window.removeEventListener('local-data-changed', onDataChanged)
  }, [isOnline, loadPortfolioTransactions])


  const totalLimits = useMemo(() => {
    return currentMonthExpenseLimits.reduce((sum, limit) => sum + (limit.limit_amount || 0), 0)
  }, [currentMonthExpenseLimits])

  const limitUsedPercentage = useMemo(() => {
    if (totalLimits <= 0) return 0
    return Math.min(100, (totalExpenses / totalLimits) * 100)
  }, [totalExpenses, totalLimits])

  const progressColor = useMemo(() => {
    if (limitUsedPercentage >= 85) return 'bg-expense'
    if (limitUsedPercentage >= 70) return 'bg-warning'
    return 'bg-income'
  }, [limitUsedPercentage])

  return (
    <div className="min-h-[calc(100vh-12rem)] flex flex-col">
      <div className={cn(CONTENT_PADDING, PAGE_ENTER_ANIMATION)}>
          <div>

            {loading ? (
              <div className="animate-fade-in">
                <SkeletonDashboard />
              </div>
            ) : (
              <>
                {/* O banner de alertas estático foi removido para usar o modo flutuante/discreto */}
                {null}
                {!hasMonthlyData ? (
              <Card className={cn(CARD_BASE, CARD_PADDING_XL, "text-center flex flex-col items-center max-w-lg mx-auto transition-all duration-300 hover:border-glass-strong")}>
                
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-5 shadow-inner">
                  <PiggyBank size={32} className="text-primary" />
                </div>
                
                <h3 className="text-lg font-extrabold text-primary tracking-tight">Mês sem movimentações</h3>
                <p className="text-xs text-secondary mt-2 max-w-sm leading-relaxed">
                  Não encontramos lançamentos de receitas, despesas ou investimentos para o mês selecionado. Que tal começar a organizar suas finanças agora?
                </p>
                
                <Button 
                  variant="primary" 
                  size="md" 
                  className="mt-6 flex items-center gap-2 cursor-pointer"
                  onClick={() => setIsSelectorOpen(true)}
                >
                  <Plus size={16} />
                  Adicionar lançamento
                </Button>
              </Card>
            ) : (
              <div className="space-y-5">

                {/* ── SEÇÃO 2: Card Herói - Gasto Disponível ── */}
                <BudgetHeroCard spendingCalcs={spendingCalcs} />

                {/* ── SEÇÃO: Projeção de Fim do Mês ── */}
                {spendingProjection && (
                  <ProjectionCard projection={spendingProjection} totalIncomes={totalIncomes} />
                )}

                {/* ── SEÇÃO 3: Resumo do Mês (Termômetro) ── */}
                <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, "relative overflow-hidden")}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-glass/40 pb-3.5 mb-4">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-primary">
                        Resumo do Mês
                      </h3>
                      <p className="text-[10px] text-secondary mt-0.5">
                        Acompanhamento de despesas contra a receita total e o limite de orçamento
                      </p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-[11px] font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-income shrink-0" />
                        <span className="text-secondary font-sans">Receita:</span>
                        <strong className="text-primary font-mono">{formatCurrency(totalIncomes)}</strong>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-expense shrink-0" />
                        <span className="text-secondary font-sans">Despesa:</span>
                        <strong className="text-primary font-mono">{formatCurrency(totalExpenses)}</strong>
                      </div>
                      {totalLimits > 0 && (
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-secondary/30 shrink-0" />
                          <span className="text-secondary font-sans">Limite:</span>
                          <strong className="text-primary font-mono">{formatCurrency(totalLimits)}</strong>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Barra de progresso grossa */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase text-secondary">
                        <span id="budget-usage-label">Uso do Orçamento</span>
                        <span className={cn(
                          "font-mono font-bold",
                          limitUsedPercentage >= 85 ? "text-expense" : limitUsedPercentage >= 70 ? "text-warning" : "text-income"
                        )}>
                          {formatNumberWithTwoDecimalsBR(limitUsedPercentage)}%
                        </span>
                      </div>
                      
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(limitUsedPercentage)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`${formatNumberWithTwoDecimalsBR(limitUsedPercentage)}% do orçamento utilizado`}
                        aria-labelledby="budget-usage-label"
                        className="w-full h-4 rounded-full bg-secondary/10 overflow-hidden relative border border-glass/25"
                      >
                        <div 
                          className={cn("h-full transition-all duration-500 rounded-full", progressColor)}
                          style={{ width: `${limitUsedPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Mensagem descritiva e reajuste rápido */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2.5 text-[10px] text-secondary font-medium">
                      <div>
                        {totalLimits > 0 ? (
                          <span>
                            Você utilizou <strong className="text-primary">{formatCurrency(totalExpenses)}</strong> do seu limite global de <strong className="text-primary">{formatCurrency(totalLimits)}</strong>.
                          </span>
                        ) : (
                          <span>
                            Defina limites por categoria para acompanhar o uso do seu orçamento mensal.
                          </span>
                        )}
                      </div>

                      {reallocationRecommendation && (
                        <div className="flex items-center gap-2 border border-glass surface-glass-strong px-2.5 py-1 rounded-xl text-[10px]">
                          <span className="truncate max-w-[220px]">
                            Sugestão: Ajustar limite de <strong className="text-primary">{reallocationRecommendation.fromName}</strong> para cobrir <strong className="text-primary">{reallocationRecommendation.toName}</strong>.
                          </span>
                          <button
                            onClick={handleReallocate}
                            disabled={isReallocating}
                            className="text-primary font-bold hover:underline cursor-pointer uppercase tracking-wider text-[9px] border-l border-glass/30 pl-2 shrink-0 bg-transparent"
                          >
                            {isReallocating ? 'Remanejando...' : 'Aplicar'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Layout Principal: Fluxo → Limites → Copiloto → Ações → Fixadas */}
                <div className="space-y-5">
                  
                  {/* ── SEÇÃO: Gráfico de Fluxo Diário (Padrões Visuais) ── */}
                  <Card className={cn(CARD_BASE, CARD_PADDING, "transition-all duration-300")}>
                    <div className="mb-4 border-b border-glass/40 pb-3 flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                          Fluxo Diário
                        </h3>
                        <p className="text-[10px] text-secondary mt-0.5">
                          Entradas, saídas e investimentos por dia em {formatMonth(currentMonth)}
                        </p>
                      </div>
                    </div>

                    <div className="w-full mt-2">
                      <DailyFlowChart
                        data={dailyFlowData}
                        hiddenSeries={hiddenDailyFlowSeries}
                        onToggleSeries={toggleDailyFlowSeries}
                      />
                    </div>
                  </Card>

                  {/* ── SEÇÃO: Controle de Limites (Riscos e Alertas) ── */}
                  <div className={categoriesAttentionList.length === 0 ? 'hidden' : 'block'}>
                    <LimitsControl
                      categoriesAttentionList={categoriesAttentionList}
                      onCategoryClick={openExpenseCategoryDetails}
                    />
                  </div>

                  {/* ── SEÇÃO: Copiloto de IA com Carrossel de Insights ── */}
                  <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, "space-y-4 relative overflow-hidden")}>
                    {/* Header com indicador dinâmico */}
                    <div className="flex items-center justify-between border-b border-glass/40 pb-2.5">
                      <div className="flex items-center gap-2">
                        <Bot size={16} className="text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                          {activeQueryText ? `Análise: "${activeQueryText}"` : 'Copiloto de IA'}
                        </span>
                      </div>

                      {activeQueryText && (
                        <div className="flex items-center gap-2">
                          {pinnedAnalysis && pinnedAnalysis.queryText === activeQueryText && hasNewDataForPinned && (
                            <button
                              onClick={handleUpdatePinnedAnalysis}
                              disabled={isUpdatingPinned}
                              className="px-2.5 py-1 rounded-lg hover:bg-secondary/10 transition-all cursor-pointer flex items-center gap-1 border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wider"
                              title="Novos lançamentos detectados! Toque para atualizar a análise."
                            >
                              <RefreshCw className={`w-2.5 h-2.5 ${isUpdatingPinned ? 'animate-spin' : ''}`} />
                              <span>Atualizar</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const isPinned = pinnedAnalysis && pinnedAnalysis.queryText === activeQueryText
                              if (isPinned) {
                                void handleUnpin()
                              } else {
                                void handlePin()
                              }
                            }}
                            className="p-1 rounded-lg text-secondary hover:text-primary hover:bg-secondary/10 transition-all cursor-pointer"
                            title={pinnedAnalysis && pinnedAnalysis.queryText === activeQueryText ? "Desafixar esta análise" : "Fixar esta análise"}
                          >
                            <Pin className={`w-3.5 h-3.5 ${pinnedAnalysis && pinnedAnalysis.queryText === activeQueryText ? 'text-primary fill-primary/10' : ''}`} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Carrossel de Insights Proativos */}
                    {dynamicAiSuggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-0.5">
                          {dynamicAiSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.id}
                              type="button"
                              onClick={() => handleSendChat(undefined, suggestion.query)}
                              disabled={isAiTyping}
                              className="shrink-0 w-64 border border-glass surface-glass-strong p-3.5 rounded-xl flex flex-col justify-between transition-all cursor-pointer text-left hover:border-primary/30 hover:bg-secondary/5 disabled:opacity-50 disabled:cursor-default text-start"
                            >
                              <div>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div className="p-1 rounded-lg bg-secondary/10 text-primary">
                                    {suggestion.icon}
                                  </div>
                                  <span className="text-[9px] font-bold uppercase tracking-wider text-secondary">
                                    Insight
                                  </span>
                                </div>
                                <h4 className="text-xs font-bold text-primary leading-snug mb-1">
                                  {suggestion.text}
                                </h4>
                                <p className="text-[10px] text-secondary leading-normal">
                                  {suggestion.tip}
                                </p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Caixa de Entrada Integrada */}                    <form 
                      onSubmit={(e) => handleSendChat(e)}
                      className="flex items-center gap-2 bg-secondary/5 border border-glass rounded-xl pl-3 pr-1 py-1 transition-all"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Pergunte ao Copiloto ou digite uma despesa/receita..."
                        className="flex-1 bg-transparent text-xs text-primary placeholder-muted outline-none min-w-0 font-medium font-sans"
                      />
                      <button
                        type="submit"
                        disabled={isAiTyping}
                        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground flex items-center justify-center gap-1.5 shrink-0 active:scale-95 hover:bg-primary-hover disabled:opacity-50 transition-all cursor-pointer text-xs font-bold uppercase tracking-wider"
                      >
                        <span>Perguntar</span>
                        <Send className="w-2.5 h-2.5" />
                      </button>
                    </form>

                    {/* Workspace de Conversação (Resposta da IA) */}
                    {activeQueryText && (
                      <div className="pt-3 border-t border-glass/40">
                        <AnimatePresence mode="wait">
                          {isAiTyping ? (
                            <motion.div
                              key="ai-loading"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="space-y-2.5 py-1.5 animate-pulse"
                            >
                              <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                                <span>Analisando lançamentos com IA...</span>
                              </div>
                              <div className="h-2.5 bg-secondary/15 rounded w-full" />
                              <div className="h-2.5 bg-secondary/15 rounded w-11/12" />
                              <div className="h-2.5 bg-secondary/15 rounded w-4/5" />
                            </motion.div>
                          ) : (
                            <motion.div
                              key="ai-content"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="space-y-4"
                            >
                              <BeautifulMarkdown text={activeReportText} />
                              
                              {activeChartData && activeChartData.length > 0 && (
                                <div className="pt-2 border-t border-glass/40">
                                  <InteractiveAIChart 
                                    chartData={activeChartData} 
                                    onBarClick={(item) => {
                                      setChatInput(`Como economizar nos gastos de ${item.name}?`)
                                    }}
                                  />
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </Card>

                  {/* ── SEÇÃO: SmartLimitSuggestions (cards contextuais) ── */}
                  {/* Placeholder para novos cards contextuais que aparecem conforme o mês avança */}
                  {/* Sugestões detalhadas na documentação docs/NEXT_STEPS.md */}

                  {/* Pinned AI Analysis (Dashed border) shown separately when not active query */}
                  {pinnedAnalysis && pinnedAnalysis.queryText !== activeQueryText && (
                    <Card className={cn(CARD_BASE, CARD_PADDING_LARGE, "space-y-4 relative overflow-hidden transition-all hover:border-glass-strong border-dashed")}>
                      <div className="flex items-center justify-between border-b border-glass/40 pb-2">
                        <div className="flex items-center gap-1.5">
                          <Pin className="w-3 h-3 text-primary fill-primary/10 rotate-45" />
                          <span className="text-xs font-bold uppercase tracking-wide text-primary">
                            Análise Fixada
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setActiveReportText(pinnedAnalysis.text)
                              setActiveChartData(pinnedAnalysis.chartData)
                              setActiveQueryText(pinnedAnalysis.queryText)
                            }}
                            className="px-2.5 py-1 rounded-lg hover:bg-secondary/10 transition-all cursor-pointer border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wider"
                          >
                            Abrir
                          </button>
                          {hasNewDataForPinned && (
                            <button
                              onClick={handleUpdatePinnedAnalysis}
                              disabled={isUpdatingPinned}
                              className="px-2.5 py-1 rounded-lg hover:bg-secondary/10 transition-all cursor-pointer flex items-center gap-1 border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wider"
                            >
                              <RefreshCw className={`w-2 h-2 ${isUpdatingPinned ? 'animate-spin' : ''}`} />
                              <span>Atualizar</span>
                            </button>
                          )}
                          <button
                            onClick={handleUnpin}
                            className="p-1 text-secondary hover:text-primary rounded-lg hover:bg-secondary/10 transition-all cursor-pointer"
                          >
                            <Pin className="w-3 h-3 fill-primary/10 text-primary" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <BeautifulMarkdown text={pinnedAnalysis.text} />
                        
                        {pinnedAnalysis.chartData && pinnedAnalysis.chartData.length > 0 && (
                          <div className="pt-2 border-t border-glass/40">
                            <InteractiveAIChart 
                              chartData={pinnedAnalysis.chartData} 
                              onBarClick={(item) => {
                                setChatInput(`Como economizar nos gastos de ${item.name}?`)
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </Card>
                  )}

                </div>

              </div>
            )}
              </>
            )}
          </div>
      </div>

      {/* ── Selector Modal para Novo Lançamento ── */}
      <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Novo lançamento">
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de lançamento que deseja adicionar:</ModalIntro>
          <ModalChoiceGrid>
            <QuickLaunchOption
              label="Renda"
              icon={<TrendingUp size={24} />}
              borderHoverClass="hover:border-income"
              iconWrapClass="bg-income/10 text-income"
              onClick={() => {
                setIsSelectorOpen(false)
                setIsIncomeOpen(true)
              }}
            />
            <QuickLaunchOption
              label="Despesa"
              icon={<TrendingDown size={24} />}
              borderHoverClass="hover:border-expense"
              iconWrapClass="bg-expense/10 text-expense"
              onClick={() => {
                setIsSelectorOpen(false)
                setIsExpenseOpen(true)
              }}
            />
            <QuickLaunchOption
              label="Investimento"
              icon={<PiggyBank size={24} />}
              borderHoverClass="hover:border-balance"
              iconWrapClass="bg-balance/10 text-balance"
              onClick={() => {
                setIsSelectorOpen(false)
                if (isOnline && !portfolioId) {
                  void loadPortfolioTransactions()
                }
                setIsInvestmentOpen(true)
              }}
            />
          </ModalChoiceGrid>
        </div>
      </Modal>

      <ExpenseFormModal
        isOpen={isExpenseOpen}
        onClose={() => setIsExpenseOpen(false)}
        editingExpense={null}
        categories={categories}
        creditCards={creditCards}
        onCreate={async (data) => {
          const res = await createExpense(data)
          if (!res.error) {
            refreshExpenses()
          }
          return res
        }}
        onUpdate={async () => ({ data: null, error: 'Não aplicável' })}
        onDelete={async () => ({ error: 'Não aplicável' })}
      />

      <IncomeFormModal
        isOpen={isIncomeOpen}
        onClose={() => setIsIncomeOpen(false)}
        editingIncome={null}
        incomeCategories={incomeCategories}
        onCreate={async (data) => {
          const res = await createIncome(data)
          if (!res.error) {
            refreshIncomes()
          }
          return res
        }}
        onUpdate={async () => ({ data: null, error: 'Não aplicável' })}
        onDelete={async () => ({ error: 'Não aplicável' })}
      />

      <PortfolioTransactionFormModal
        isOpen={isInvestmentOpen}
        onClose={() => setIsInvestmentOpen(false)}
        portfolioId={portfolioId}
        editingTransaction={null}
        onSaved={() => {
          void loadPortfolioTransactions()
        }}
      />

      {/* ── Modal de detalhamento de categoria ── */}
      <Modal
        isOpen={Boolean(selectedExpenseCategory)}
        onClose={() => setSelectedExpenseCategory(null)}
        title={selectedExpenseCategory ? `Detalhamento: ${selectedExpenseCategory.name}` : 'Detalhamento'}
        size="lg"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação mensal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-glass surface-glass p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(currentMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.currentTotal ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-glass surface-glass p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(previousMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.previousTotal ?? 0)}</p>
              </div>
            </div>
          </div>

          {selectedExpenseCategoryLimitDetails && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do mês</p>
              <div className="rounded-xl border border-glass surface-glass p-3">
                <p className="text-sm text-primary">Limite: {formatCurrency(selectedExpenseCategoryLimitDetails.limitAmount)}</p>
                <p className="text-sm text-primary">Gasto: {formatCurrency(selectedExpenseCategoryLimitDetails.currentTotal)}</p>
                <p className={`text-sm font-medium ${selectedExpenseCategoryLimitDetails.isExceeded ? 'text-expense' : 'text-income'}`}>
                  {selectedExpenseCategoryLimitDetails.isExceeded
                    ? `Excesso: ${formatCurrency(selectedExpenseCategoryLimitDetails.exceededAmount)}`
                    : `Restante: ${formatCurrency(selectedExpenseCategoryLimitDetails.remainingAmount)}`}
                </p>
              </div>
            </div>
          )}

          {selectedExpenseCategory && (
            <CategoryDetailMiniChart
              detailItems={miniChartItems}
              period="month"
              selectedMonth={currentMonth}
              selectedYear={new Date(currentMonth).getFullYear()}
              color={getCategoryColorForPalette(
                expenses.find(e => (e.category?.id || e.category_id || '') === selectedExpenseCategory.id)?.category?.color || 'var(--color-primary)',
                colorPalette
              )}
            />
          )}

          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do mês</p>

          {selectedExpenseCategoryDetails && selectedExpenseCategoryDetails.currentItems.length > 0 ? (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {selectedExpenseCategoryDetails.currentItems.map((item) => {
                const reportAmount = expenseAmountForDashboard(item.amount, item.report_weight)

                return (
                  <TransactionRow
                    key={item.id}
                    description={item.description || item.category?.name || 'Despesa'}
                    date={item.date}
                    amount={reportAmount}
                    originalAmount={item.amount}
                  />
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-secondary">Sem lançamentos dessa categoria no mês selecionado.</p>
          )}
        </div>
      </Modal>

    </div>
    )
  }
