import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import MonthSelector from '@/components/MonthSelector'
import { PAGE_HEADERS } from '@/constants/pages'
import { useExpenses } from '@/hooks/useExpenses'
import { useIncomes } from '@/hooks/useIncomes'
import { useInvestments } from '@/hooks/useInvestments'
import { useCategories } from '@/hooks/useCategories'
import { useIncomeCategories } from '@/hooks/useIncomeCategories'
import { useCreditCards } from '@/hooks/useCreditCards'
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { APP_START_DATE, addMonths, formatCurrency, formatDate, formatMoneyInput, formatMonth, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, Plus, Sparkles } from 'lucide-react'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import AssistantConfirmationPanel from '@/components/AssistantConfirmationPanel'
import { useAssistantTurn } from '@/hooks/useAssistantTurn'
import { useAssistantOfflineQueueStatus } from '@/hooks/useAssistantOfflineQueueStatus'
import { useAppSettings } from '@/hooks/useAppSettings'
import { useVoiceAdapter } from '@/hooks/useVoiceAdapter'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getAssistantMonthlyInsights } from '@/services/assistantService'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

type QuickAddType = 'expense' | 'income' | 'investment'
const EXPENSE_LIMIT_WARNING_THRESHOLD = 85

export default function Dashboard() {
  const {
    monthlyInsightsEnabled,
    assistantConfirmationMode,
    assistantConfirmationPolicyMode,
    assistantLocale,
    assistantOfflineBehavior,
    assistantResponseDepth,
    assistantAutoSpeak,
    assistantSpeechRate,
    assistantSpeechPitch,
  } = useAppSettings()

  const {
    assistantLoading,
    assistantError,
    lastInterpretation,
    lastConfirmation,
    editableConfirmationText,
    setEditableConfirmationText,
    editableSlots,
    updateEditableSlots,
    interpretCommand,
    confirmLastInterpretation,
  } = useAssistantTurn('web-dashboard-device', {
    locale: assistantLocale,
    offlineBehavior: assistantOfflineBehavior,
    responseDepth: assistantResponseDepth,
  })
  const { pendingCount: assistantOfflinePendingCount, hasPending: hasAssistantOfflinePending } = useAssistantOfflineQueueStatus()

  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const {
    voiceSupport,
    voiceStatus,
    setVoiceStatus,
    voiceListening,
    voicePhase,
    lastHeardCommand,
    clearVoiceFeedback,
    captureSpeech,
    stopActiveListening,
    resolveVoiceConfirmation,
    stopSpeaking,
  } = useVoiceAdapter({
    locale: assistantLocale,
    networkErrorMessage: 'Falha de rede no reconhecimento de voz. Use o comando em texto e toque em Interpretar.',
    autoSpeakEnabled: assistantAutoSpeak,
    speechRate: assistantSpeechRate,
    speechPitch: assistantSpeechPitch,
  })
  const [quickAddType, setQuickAddType] = useState<QuickAddType>('expense')
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ id: string; name: string } | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    installment_total: '1',
    payment_method: 'other',
    credit_card_id: '',
    month: getCurrentMonthString(),
    category_id: '',
    income_category_id: '',
    description: '',
  })
  const [monthlyInsights, setMonthlyInsights] = useState<string[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  const handleAmountChange = (nextAmount: string) => {
    setFormData((prev) => {
      const prevAmount = parseMoneyInput(prev.amount)
      const prevReportAmount = parseMoneyInput(prev.report_amount)
      const shouldSyncReportAmount =
        !prev.report_amount ||
        (!Number.isNaN(prevAmount) &&
          !Number.isNaN(prevReportAmount) &&
          Math.abs(prevReportAmount - prevAmount) < 0.009)

      return {
        ...prev,
        amount: nextAmount,
        report_amount: shouldSyncReportAmount ? nextAmount : prev.report_amount,
      }
    })
  }
  const { colorPalette } = usePaletteColors()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { creditCards } = useCreditCards()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { investments, loading: investmentsLoading, refreshInvestments, createInvestment } = useInvestments(currentMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

  const expenseAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const incomeAmountForDashboard = (amount: number, reportWeight?: number | null) =>
    amount * (reportWeight ?? 1)

  const totalExpenses = expenses.reduce((sum, exp) => sum + expenseAmountForDashboard(exp.amount, exp.report_weight), 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + incomeAmountForDashboard(inc.amount, inc.report_weight), 0)
  const totalInvestments = investments.reduce((sum, inv) => sum + inv.amount, 0)
  const balance = totalIncomes - totalExpenses - totalInvestments
  const hasMonthlyData = expenses.length > 0 || incomes.length > 0 || investments.length > 0
  const loading =
    expensesLoading ||
    incomesLoading ||
    investmentsLoading ||
    expenseLimitsLoading ||
    previousExpenseLimitsLoading

  const monthlyOverviewData = useMemo(
    () => [
      { name: 'Rendas', value: totalIncomes, color: 'var(--color-income)' },
      { name: 'Despesas', value: totalExpenses, color: 'var(--color-expense)' },
      { name: 'Investimentos', value: totalInvestments, color: 'var(--color-balance)' },
    ],
    [totalExpenses, totalIncomes, totalInvestments]
  )

  const expenseByCategory = useMemo(() => {
    const map = new Map<string, { categoryId: string; name: string; color: string; value: number }>()

    expenses.forEach((expense) => {
      const name = expense.category?.name || 'Sem categoria'
      const categoryId = expense.category?.id || expense.category_id || ''
      const key = categoryId || name
      const color = getCategoryColorForPalette(expense.category?.color || 'var(--color-primary)', colorPalette)
      const current = map.get(key)

      if (current) {
        current.value += expenseAmountForDashboard(expense.amount, expense.report_weight)
      } else {
        map.set(key, { categoryId, name, color, value: expenseAmountForDashboard(expense.amount, expense.report_weight) })
      }
    })

    return Array.from(map.values()).sort((a, b) => b.value - a.value)
  }, [expenses, colorPalette])

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

  const expenseCategoriesPieData = useMemo(() => {
    if (expenseByCategory.length <= 5) return expenseByCategory

    const top = expenseByCategory.slice(0, 5)
    const othersValue = expenseByCategory.slice(5).reduce((sum, item) => sum + item.value, 0)

    return [...top, { categoryId: '', name: 'Outras', color: 'var(--color-text-secondary)', value: othersValue }]
  }, [expenseByCategory])

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

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 640px)')
    const updateViewport = () => setIsMobileViewport(mediaQuery.matches)

    updateViewport()
    mediaQuery.addEventListener('change', updateViewport)

    return () => {
      mediaQuery.removeEventListener('change', updateViewport)
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    if (!monthlyInsightsEnabled) {
      setMonthlyInsights([])
      setInsightsError(null)
      setInsightsLoading(false)
      return
    }

    if (!hasMonthlyData) {
      setMonthlyInsights([])
      setInsightsError(null)
      setInsightsLoading(false)
      return
    }

    const loadInsights = async () => {
      setInsightsLoading(true)
      setInsightsError(null)

      try {
        const result = await getAssistantMonthlyInsights(currentMonth)
        if (isCancelled) return

        const mergedInsights = [...result.highlights, ...result.recommendations]
          .map((item) => item.trim())
          .filter(Boolean)

        setMonthlyInsights(mergedInsights.slice(0, 3))
      } catch (error) {
        if (isCancelled) return
        setInsightsError(error instanceof Error ? error.message : 'Falha ao atualizar insights do mês.')
        setMonthlyInsights([])
      } finally {
        if (!isCancelled) {
          setInsightsLoading(false)
        }
      }
    }

    void loadInsights()

    return () => {
      isCancelled = true
    }
  }, [
    currentMonth,
    monthlyInsightsEnabled,
    hasMonthlyData,
    totalExpenses,
    totalIncomes,
    totalInvestments,
  ])

  const prioritizedExpenseCategoryItems = useMemo(() => {
    return expenseByCategory
      .map((item) => {
        const exceeded = expenseLimitAlerts.find((alert) => alert.categoryId === item.categoryId)
        if (exceeded) {
          return {
            ...item,
            alertPriority: 2,
            alertStatusLabel: 'Ultrapassou',
            alertStatusClass: 'text-secondary',
          }
        }

        const nearLimit = expenseAttentionCategories.find((alert) => alert.categoryId === item.categoryId)
        if (nearLimit) {
          return {
            ...item,
            alertPriority: 1,
            alertStatusLabel: nearLimit.level,
            alertStatusClass: 'text-secondary',
          }
        }

        return {
          ...item,
          alertPriority: 0,
          alertStatusLabel: '',
          alertStatusClass: 'text-secondary',
        }
      })
      .sort((a, b) => {
        if (b.alertPriority !== a.alertPriority) return b.alertPriority - a.alertPriority
        return b.value - a.value
      })
  }, [expenseByCategory, expenseLimitAlerts, expenseAttentionCategories])

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

    investments.forEach((investment) => {
      const investmentDay = 1
      if (investmentDay >= 1 && investmentDay <= daysInMonth) {
        series[investmentDay - 1].Investimentos += investment.amount
      }
    })

    return series
  }, [currentMonth, incomes, expenses, investments])

  const chartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number }>; label?: string }) => {
    if (!active || !payload || payload.length === 0) return null

    const isDayLabel = typeof label === 'string' && /^\d{1,2}$/.test(label)

    return (
      <div className="rounded-lg border border-primary bg-primary px-3 py-2 shadow-sm">
        {label && <p className="text-xs text-secondary mb-1">{isDayLabel ? `Dia ${label}` : label}</p>}
        <div className="space-y-1">
          {payload.map((entry, index) => (
            <p key={`${entry.name}-${index}`} className="text-sm text-primary">
              {entry.name}: {formatCurrency(Number(entry.value || 0))}
            </p>
          ))}
        </div>
      </div>
    )
  }

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

  const toggleDailyFlowSeries = (dataKey: string) => {
    setHiddenDailyFlowSeries((prev) =>
      prev.includes(dataKey) ? prev.filter((key) => key !== dataKey) : [...prev, dataKey]
    )
  }

  const renderInteractiveLegend = ({ payload }: { payload?: any[] }) => {
    if (!payload?.length) return null

    return (
      <div className="flex flex-wrap gap-2 pt-2">
        {payload.map((entry: any) => {
          const dataKey = String(entry.dataKey ?? entry.value ?? '')
          const isHidden = hiddenDailyFlowSeries.includes(dataKey)

          return (
            <button
              key={dataKey}
              type="button"
              onClick={() => toggleDailyFlowSeries(dataKey)}
              className={`px-2 py-1 rounded-md border border-primary text-xs flex items-center gap-2 motion-standard hover-lift-subtle press-subtle focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] ${
                isHidden ? 'opacity-50 bg-secondary text-secondary' : 'bg-primary text-primary'
              }`}
              aria-pressed={!isHidden}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-primary">{entry.value}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const interactiveRowButtonClasses =
    'w-full rounded-lg border border-primary bg-secondary text-primary p-2 -m-2 text-left motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'

  const insightNarrativeMoment = useMemo(() => {
    const now = new Date()
    const currentMonthKey = format(now, 'yyyy-MM')
    const isClosedMonth = currentMonth < currentMonthKey

    if (isClosedMonth) {
      return {
        isFinalized: true,
      }
    }

    if (currentMonth !== currentMonthKey) {
      return {
        isFinalized: false,
      }
    }

    const [year, month] = currentMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()
    const isLastDay = now.getDate() >= daysInMonth

    return {
      isFinalized: isLastDay,
    }
  }, [currentMonth])

  const monthlyInsightsNarrative = useMemo(() => {
    if (!monthlyInsights.length) return ''

    const normalized = monthlyInsights
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))

    if (normalized.length === 1) {
      const single = normalized[0].replace(/[.!?]+$/, '')
      return `${single}.`
    }

    const withoutTrailingDot = normalized.map((item) => item.replace(/[.!?]+$/, ''))
    const firstSentence = `${withoutTrailingDot[0]}.`

    const toClauseAfterConnector = (value: string) => {
      const text = value.trim()
      if (!text) return text

      const [firstChar, ...restChars] = text
      const rest = restChars.join('')
      return `${firstChar.toLowerCase()}${rest}`
    }

    const simplifyForMobile = (value: string) => {
      const compact = value
        .replace(/^Com base no andamento atual do mês,\s*/i, '')
        .replace(/^No mês analisado,\s*/i, '')
        .replace(/^vale revisar este ponto:\s*/i, '')
        .replace(/\s+até o momento$/i, '')
        .replace(/\s+até aqui$/i, '')
        .trim()

      const firstClause = compact.split(/[;:]/)[0]?.trim() || compact
      return firstClause || compact
    }

    if (isMobileViewport) {
      const firstMobileSentence = simplifyForMobile(withoutTrailingDot[0])

      if (withoutTrailingDot.length === 1) {
        return `${firstMobileSentence}.`
      }

      const secondMobileSentence = simplifyForMobile(withoutTrailingDot[1])
      return `${firstMobileSentence}. ${secondMobileSentence}.`
    }

    if (withoutTrailingDot.length === 2) {
      return insightNarrativeMoment.isFinalized
        ? `${firstSentence} Além disso, ${toClauseAfterConnector(withoutTrailingDot[1])}.`
        : `${firstSentence} Até aqui, ${toClauseAfterConnector(withoutTrailingDot[1])}.`
    }

    return insightNarrativeMoment.isFinalized
      ? `${firstSentence} ${withoutTrailingDot[1]}. ${withoutTrailingDot[2]}.`
      : `${firstSentence} ${withoutTrailingDot[1]}. Para os próximos dias, ${toClauseAfterConnector(withoutTrailingDot[2])}.`
  }, [monthlyInsights, insightNarrativeMoment.isFinalized, isMobileViewport])

  const shouldShowMonthlyInsights = monthlyInsightsEnabled && !insightsLoading && !insightsError && monthlyInsightsNarrative.length > 0

  const openQuickAdd = (type: QuickAddType) => {
    setQuickAddType(type)
    setFormData({
      amount: '',
      report_amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      installment_total: '1',
      payment_method: 'other',
      credit_card_id: '',
      month: currentMonth,
      category_id: categories[0]?.id || '',
      income_category_id: incomeCategories[0]?.id || '',
      description: '',
    })
    setIsQuickAddOpen(true)
  }

  const closeQuickAdd = () => {
    setIsQuickAddOpen(false)
  }

  const quickAddTitle = quickAddType === 'expense'
    ? 'Nova despesa'
    : quickAddType === 'income'
      ? 'Nova renda'
      : 'Novo investimento'

  const playAssistantBeep = (type: 'start' | 'end' | 'heard' | 'executed' = 'start') => {
    if (typeof window === 'undefined') return

    const AudioContextCtor = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!AudioContextCtor) return

    const context = new AudioContextCtor()
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = 'sine'
    const toneMap: Record<'start' | 'end' | 'heard' | 'executed', { start: number; end: number }> = {
      start: { start: 880, end: 1040 },
      end: { start: 520, end: 420 },
      heard: { start: 700, end: 760 },
      executed: { start: 980, end: 1180 },
    }

    const startFrequency = toneMap[type].start
    const endFrequency = toneMap[type].end
    oscillator.frequency.setValueAtTime(startFrequency, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, context.currentTime + 0.14)
    gain.gain.setValueAtTime(0.001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14)

    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.14)

    oscillator.onended = () => {
      context.close().catch(() => undefined)
    }
  }

  const openAssistant = () => {
    setIsAssistantOpen(true)
    clearVoiceFeedback()
    void handleVoiceInterpret()
  }

  const closeAssistant = () => {
    stopActiveListening()
    stopSpeaking()
    setIsAssistantOpen(false)
    clearVoiceFeedback()
  }

  const isExpenseIntent = lastInterpretation?.intent === 'add_expense'
  const touchConfirmationEnabled = assistantConfirmationMode !== 'voice' || isExpenseIntent
  const voiceConfirmationEnabled = assistantConfirmationMode !== 'touch' && !isExpenseIntent
  const actionColumnsClass = touchConfirmationEnabled && voiceConfirmationEnabled
    ? 'sm:grid-cols-3'
    : 'sm:grid-cols-2'

  const handleConfirmAssistant = async (confirmed: boolean) => {
    if (!isSupabaseConfigured) return
    const result = await confirmLastInterpretation({ confirmed })
    if (!result) return
    if (result.status === 'executed') {
      playAssistantBeep('executed')
    }
    closeAssistant()
  }

  const handleVoiceInterpret = async () => {
    if (!isSupabaseConfigured || assistantLoading) return

    if (voiceListening) {
      stopActiveListening()
      return
    }

    try {
      playAssistantBeep()
      const transcript = await captureSpeech('Fale seu comando')
      if (!transcript) return

      const result = await interpretCommand(transcript, {
        confirmationMode: assistantConfirmationPolicyMode,
      })
      if (!result) return
      if (!result.requiresConfirmation) {
        playAssistantBeep('executed')
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : 'Erro ao interpretar comando por voz.')
    }
  }

  const handleVoiceConfirm = async () => {
    if (!isSupabaseConfigured || assistantLoading || !lastInterpretation?.command.id) return
    if (!voiceConfirmationEnabled) {
      setVoiceStatus('Confirmação por voz está desativada nas suas configurações.')
      return
    }
    if (lastInterpretation.intent === 'add_expense') {
      setVoiceStatus('Para despesas, a confirmação é manual pelos botões Confirmar/Negar.')
      return
    }

    try {
      const transcript = await captureSpeech('Confirme por voz')
      if (!transcript) return

      const confirmed = resolveVoiceConfirmation(transcript)
      const result = await confirmLastInterpretation({
        confirmed,
        spokenText: transcript,
        includeEditable: false,
      })
      if (!result) return
      if (result.status === 'executed') {
        playAssistantBeep('executed')
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : 'Erro ao confirmar por voz.')
    }
  }

  const handleQuickAddSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const amount = parseMoneyInput(formData.amount)
    if (!amount || amount <= 0) {
      alert('Insira um valor válido maior que zero.')
      return
    }

    const reportAmount = formData.report_amount ? parseMoneyInput(formData.report_amount) : amount
    if (quickAddType !== 'investment' && (Number.isNaN(reportAmount) || reportAmount < 0 || reportAmount > amount)) {
      alert('O valor no relatório deve estar entre 0 e o valor total.')
      return
    }

    const reportWeight = amount > 0 ? Number((reportAmount / amount).toFixed(4)) : 1
    const rawInstallments = Number(formData.installment_total || '1')
    const installmentTotal = Math.max(1, Math.min(60, rawInstallments))

    if (quickAddType === 'expense' && (!Number.isInteger(rawInstallments) || rawInstallments < 1)) {
      alert('Informe um número válido de parcelas (mínimo 1).')
      return
    }

    if (quickAddType === 'expense' && formData.payment_method === 'credit_card' && !formData.credit_card_id) {
      alert('Selecione um cartão de crédito para compras no crédito.')
      return
    }

    if (quickAddType === 'expense') {
      if (!formData.category_id) {
        alert('Selecione uma categoria de despesa.')
        return
      }

      const { error } = await createExpense({
        amount,
        report_weight: reportWeight,
        date: formData.date,
        installment_total: installmentTotal,
        payment_method: formData.payment_method as 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other',
        credit_card_id: formData.payment_method === 'credit_card' ? formData.credit_card_id : null,
        category_id: formData.category_id,
        ...(formData.description && { description: formData.description }),
      })

      if (error) {
        alert(`Erro ao criar despesa: ${error}`)
        return
      }
    }

    if (quickAddType === 'income') {
      if (!formData.income_category_id) {
        alert('Selecione uma categoria de renda.')
        return
      }

      const { error } = await createIncome({
        amount,
        report_weight: reportWeight,
        date: formData.date,
        income_category_id: formData.income_category_id,
        ...(formData.description && { description: formData.description }),
      })

      if (error) {
        alert(`Erro ao criar renda: ${error}`)
        return
      }
    }

    if (quickAddType === 'investment') {
      const selectedDate = formData.date || format(new Date(), 'yyyy-MM-dd')
      const { error } = await createInvestment({
        amount,
        month: selectedDate.substring(0, 7),
        ...(formData.description && { description: formData.description }),
      })

      if (error) {
        alert(`Erro ao criar investimento: ${error}`)
        return
      }
    }

    closeQuickAdd()
    refreshExpenses()
    refreshIncomes()
    refreshInvestments()
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.dashboard.title}
        subtitle={PAGE_HEADERS.dashboard.description}
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={openAssistant}
              className="flex items-center gap-2"
              aria-label="Assistente"
              title="Assistente"
            >
              <Sparkles size={16} />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openQuickAdd('expense')}
              className="flex items-center gap-2"
              disabled={categories.length === 0 && incomeCategories.length === 0}
            >
              <Plus size={16} />
              Lançamento
            </Button>
          </div>
        }
      />
      
      <div className="p-4 lg:p-6">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />

        {shouldShowMonthlyInsights && (
          <Card className="mt-4 lg:mt-6">
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-primary">Insights personalizados do mês</h3>
              <p className="text-sm text-primary leading-relaxed">
                {monthlyInsightsNarrative}
              </p>
            </div>
          </Card>
        )}

        <div className={shouldShowMonthlyInsights ? 'mt-4 lg:mt-6' : 'mt-3 lg:mt-4'}>

        {loading ? (
          <div className="text-center py-8 text-secondary">Carregando...</div>
        ) : !hasMonthlyData ? (
          <Card>
            <div className="text-center py-8">
              <p className="text-base text-primary font-medium">Adicione o primeiro lançamento do mês.</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Rendas</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-income)' }}>
                      {formatCurrency(totalIncomes)}
                    </p>
                  </div>
                  <TrendingUp className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-income)' }} />
                </div>
              </Card>

              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Despesas</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-expense)' }}>
                      {formatCurrency(totalExpenses)}
                    </p>
                  </div>
                  <TrendingDown className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-expense)' }} />
                </div>
              </Card>

              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Investimentos</p>
                    <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-balance)' }}>
                      {formatCurrency(totalInvestments)}
                    </p>
                  </div>
                  <PiggyBank className="flex-shrink-0 ml-2" size={24} style={{ color: 'var(--color-balance)' }} />
                </div>
              </Card>

              <Card className="h-full">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-secondary">Saldo</p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{
                        color: balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)',
                      }}
                    >
                      {formatCurrency(balance)}
                    </p>
                  </div>
                </div>
              </Card>
            </div>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-stretch">
                <Card className="h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-primary mb-4">Panorama do mês</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={monthlyOverviewData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                      />
                      <Tooltip content={chartTooltip} />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                        {monthlyOverviewData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

                <Card className="h-full flex flex-col">
                  <h3 className="text-lg font-semibold text-primary mb-4">Fluxo diário (mês)</h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={dailyFlowData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                      <XAxis dataKey="day" stroke="var(--color-text-secondary)" fontSize={12} tick={{ fill: 'var(--color-text-secondary)' }} minTickGap={14} />
                      <YAxis
                        stroke="var(--color-text-secondary)"
                        fontSize={12}
                        tick={{ fill: 'var(--color-text-secondary)' }}
                        tickFormatter={(value) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(0)}k` : `R$ ${value}`)}
                      />
                      <Tooltip content={chartTooltip} />
                      <Legend content={renderInteractiveLegend} />
                      <Line type="monotone" dataKey="Rendas" stroke="var(--color-income)" strokeWidth={2} dot={false} hide={hiddenDailyFlowSeries.includes('Rendas')} />
                      <Line type="monotone" dataKey="Despesas" stroke="var(--color-expense)" strokeWidth={2} dot={false} hide={hiddenDailyFlowSeries.includes('Despesas')} />
                      <Line type="monotone" dataKey="Investimentos" stroke="var(--color-balance)" strokeWidth={2} dot={false} hide={hiddenDailyFlowSeries.includes('Investimentos')} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 items-stretch">
                <Card className="h-full flex flex-col">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-primary">Despesas por categoria</h3>
                    <p className="text-xs text-secondary">Gráfico por porcentagem e lista priorizada por alertas de limite.</p>
                  </div>
                  {expenseCategoriesPieData.length === 0 ? (
                    <p className="text-sm text-secondary">Sem despesas no mês selecionado.</p>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={expenseCategoriesPieData}
                            dataKey="value"
                            nameKey="name"
                            outerRadius={86}
                            labelLine={false}
                            label={false}
                            onClick={(entry: { categoryId?: string; name?: string }) => {
                              if (entry?.categoryId && entry?.name) {
                                openExpenseCategoryDetails(entry.categoryId, entry.name)
                              }
                            }}
                          >
                            {expenseCategoriesPieData.map((entry) => (
                              <Cell key={entry.name} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip content={chartTooltip} />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="space-y-2 mt-3">
                        {prioritizedExpenseCategoryItems.map((item) => {
                          const percentage = totalExpenses > 0 ? (item.value / totalExpenses) * 100 : 0
                          return (
                            <button
                              key={item.name}
                              type="button"
                              onClick={() => openExpenseCategoryDetails(item.categoryId, item.name)}
                              className={`${interactiveRowButtonClasses} p-2.5`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                                  <span className="text-primary truncate">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {item.alertPriority > 0 && (
                                    <span className={`text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary ${item.alertStatusClass}`}>
                                      {item.alertStatusLabel}
                                    </span>
                                  )}
                                  <span className="text-xs px-2 py-0.5 rounded-full border border-primary bg-secondary text-secondary">
                                    {percentage.toFixed(1)}%
                                  </span>
                                </div>
                              </div>

                              <div className="w-full h-1.5 rounded-full bg-secondary mt-2">
                                <div className="h-2 rounded-full" style={{ width: `${Math.min(percentage, 100)}%`, backgroundColor: item.color }} />
                              </div>

                              <p className="text-[11px] text-secondary mt-1.5 truncate">Total: {formatCurrency(item.value)}</p>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </Card>
              </div>
            </div>
          </>
        )}
        </div>
      </div>

      <Modal isOpen={isQuickAddOpen} onClose={closeQuickAdd} title={quickAddTitle}>
        <form onSubmit={handleQuickAddSubmit} className="w-full max-w-md mx-auto space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">Tipo de lançamento</label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                size="sm"
                variant={quickAddType === 'expense' ? 'primary' : 'outline'}
                onClick={() => setQuickAddType('expense')}
                disabled={categories.length === 0}
              >
                Despesa
              </Button>
              <Button
                type="button"
                size="sm"
                variant={quickAddType === 'income' ? 'primary' : 'outline'}
                onClick={() => setQuickAddType('income')}
                disabled={incomeCategories.length === 0}
              >
                Renda
              </Button>
              <Button
                type="button"
                size="sm"
                variant={quickAddType === 'investment' ? 'primary' : 'outline'}
                onClick={() => setQuickAddType('investment')}
              >
                Invest.
              </Button>
            </div>
          </div>
          <Input
            label="Valor"
            type="text"
            inputMode="decimal"
            value={formData.amount}
            onChange={(event) => handleAmountChange(event.target.value)}
            onBlur={() => {
              const parsed = parseMoneyInput(formData.amount)
              if (!Number.isNaN(parsed) && parsed >= 0) {
                handleAmountChange(formatMoneyInput(parsed))
              }
            }}
            placeholder="0,00"
            required
          />

          {quickAddType !== 'investment' && (
            <Input
              label="Valor no relatório (opcional)"
              type="text"
              inputMode="decimal"
              value={formData.report_amount}
              onChange={(event) => setFormData((prev) => ({ ...prev, report_amount: event.target.value }))}
              onBlur={() => {
                if (!formData.report_amount) return
                const parsed = parseMoneyInput(formData.report_amount)
                if (!Number.isNaN(parsed) && parsed >= 0) {
                  setFormData((prev) => ({ ...prev, report_amount: formatMoneyInput(parsed) }))
                }
              }}
              placeholder="Se vazio, usa o valor total"
            />
          )}

          <Input
            label="Data"
            type="date"
            value={formData.date}
            onChange={(event) => setFormData((prev) => ({ ...prev, date: event.target.value }))}
            min={APP_START_DATE}
            required
          />

          {quickAddType === 'expense' && (
            <Input
              label="Parcelas"
              type="number"
              min="1"
              max="60"
              value={formData.installment_total}
              onChange={(event) => setFormData((prev) => ({ ...prev, installment_total: event.target.value }))}
              placeholder="1"
            />
          )}

          {quickAddType === 'expense' && (
            <Select
              label="Forma de pagamento"
              value={formData.payment_method}
              onChange={(event) => setFormData((prev) => ({
                ...prev,
                payment_method: event.target.value,
                credit_card_id: event.target.value === 'credit_card' ? prev.credit_card_id : '',
              }))}
              options={[
                { value: 'other', label: 'Outros' },
                { value: 'cash', label: 'Dinheiro' },
                { value: 'debit', label: 'Débito' },
                { value: 'credit_card', label: 'Cartão de crédito' },
                { value: 'pix', label: 'PIX' },
                { value: 'transfer', label: 'Transferência' },
              ]}
            />
          )}

          {quickAddType === 'expense' && formData.payment_method === 'credit_card' && (
            <Select
              label="Cartão"
              value={formData.credit_card_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, credit_card_id: event.target.value }))}
              options={[
                { value: '', label: 'Selecionar cartão' },
                ...creditCards
                  .filter((card) => card.is_active !== false || card.id === formData.credit_card_id)
                  .map((card) => ({ value: card.id, label: card.name })),
              ]}
              required
            />
          )}

          {quickAddType === 'expense' && (
            <Select
              label="Categoria"
              value={formData.category_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, category_id: event.target.value }))}
              options={categories.map((category) => ({ value: category.id, label: category.name }))}
              required
            />
          )}

          {quickAddType === 'income' && (
            <Select
              label="Categoria de renda"
              value={formData.income_category_id}
              onChange={(event) => setFormData((prev) => ({ ...prev, income_category_id: event.target.value }))}
              options={incomeCategories.map((category) => ({ value: category.id, label: category.name }))}
              required
            />
          )}

          <Input
            label="Descrição (opcional)"
            value={formData.description}
            onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Ex: mercado, salário, reserva..."
          />

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" fullWidth onClick={closeQuickAdd}>
              Cancelar
            </Button>
            <Button type="submit" fullWidth>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedExpenseCategory)}
        onClose={() => setSelectedExpenseCategory(null)}
        title={selectedExpenseCategory ? `Detalhamento: ${selectedExpenseCategory.name}` : 'Detalhamento'}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Comparação mensal</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-lg border border-primary bg-secondary p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(currentMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.currentTotal ?? 0)}</p>
              </div>
              <div className="rounded-lg border border-primary bg-secondary p-3">
                <p className="text-xs text-secondary">Total em {formatMonth(previousMonth)}</p>
                <p className="text-lg font-semibold text-primary">{formatCurrency(selectedExpenseCategoryDetails?.previousTotal ?? 0)}</p>
              </div>
            </div>
          </div>

          {selectedExpenseCategoryLimitDetails && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-secondary">Metas do mês</p>
              <div className="rounded-lg border border-primary bg-secondary p-3">
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

          <p className="text-xs font-medium uppercase tracking-wide text-secondary">Lançamentos do mês</p>

          {selectedExpenseCategoryDetails && selectedExpenseCategoryDetails.currentItems.length > 0 ? (
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {selectedExpenseCategoryDetails.currentItems.map((item) => {
                const reportAmount = expenseAmountForDashboard(item.amount, item.report_weight)
                const showOriginal = Math.abs(reportAmount - item.amount) > 0.009

                return (
                  <div key={item.id} className="rounded-lg border border-primary bg-primary p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{item.description || item.category?.name || 'Despesa'}</p>
                        <p className="text-xs text-secondary mt-0.5">{formatDate(item.date)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-primary">{formatCurrency(reportAmount)}</p>
                        {showOriginal && <p className="text-xs text-secondary">Total: {formatCurrency(item.amount)}</p>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-secondary">Sem lançamentos dessa categoria no mês selecionado.</p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isAssistantOpen}
        onClose={closeAssistant}
        title="Assistente"
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-primary bg-secondary p-3 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-secondary">Status de escuta</p>
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full ${voicePhase === 'listening' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-text-secondary)]'}`} />
              <p className="text-sm text-primary">
                {voicePhase === 'listening' ? 'Escutando...' : voicePhase === 'stopped' ? 'Parou de escutar' : 'Pronto para iniciar'}
              </p>
            </div>
            {lastHeardCommand && (
              <p className="text-sm text-primary">
                <strong>Comando ouvido:</strong> {lastHeardCommand}
              </p>
            )}
          </div>

          <Button
            onClick={handleVoiceInterpret}
              disabled={assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition}
            variant="outline"
            fullWidth
          >
              {voiceListening ? 'Parar Escuta' : 'Falar Comando'}
          </Button>

          {lastInterpretation?.requiresConfirmation && (
            <AssistantConfirmationPanel
              intent={lastInterpretation.intent}
              editableConfirmationText={editableConfirmationText}
              onEditableConfirmationTextChange={setEditableConfirmationText}
              editableSlots={editableSlots}
              categories={categories.map((category) => ({ id: category.id, name: category.name }))}
              incomeCategories={incomeCategories.map((category) => ({ id: category.id, name: category.name }))}
              disabled={assistantLoading || !isSupabaseConfigured}
              fallbackMonth={currentMonth}
              onUpdateSlots={updateEditableSlots}
              touchConfirmationEnabled={touchConfirmationEnabled}
              voiceConfirmationEnabled={voiceConfirmationEnabled}
              actionColumnsClass={actionColumnsClass}
              onConfirm={() => handleConfirmAssistant(true)}
              onDeny={() => handleConfirmAssistant(false)}
              onVoiceConfirm={handleVoiceConfirm}
              voiceConfirmDisabled={assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition || voiceListening}
              voiceListening={voiceListening}
              isExpenseIntent={isExpenseIntent}
              containerClassName="space-y-3 rounded-lg border border-primary bg-secondary p-3"
            />
          )}

          {voiceStatus && <p className="text-xs text-secondary">{voiceStatus}</p>}
          {hasAssistantOfflinePending && (
            <p className="text-xs text-secondary">
              {assistantOfflinePendingCount === 1
                ? '1 comando do assistente pendente de sincronização.'
                : `${assistantOfflinePendingCount} comandos do assistente pendentes de sincronização.`}
            </p>
          )}
          {assistantError && <p className="text-xs text-[var(--color-danger)]">{assistantError}</p>}
          {lastConfirmation && <p className="text-sm text-primary">{lastConfirmation.message}</p>}
        </div>
      </Modal>
    </div>
  )
}

