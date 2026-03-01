import { useEffect, useMemo, useRef, useState } from 'react'
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
import { useExpenseCategoryLimits } from '@/hooks/useExpenseCategoryLimits'
import { usePaletteColors } from '@/hooks/usePaletteColors'
import { getCategoryColorForPalette } from '@/utils/categoryColors'
import { addMonths, formatCurrency, formatDate, formatMoneyInput, formatMonth, getCurrentMonthString, parseMoneyInput } from '@/utils/format'
import { TrendingUp, TrendingDown, PiggyBank, Plus, Sparkles } from 'lucide-react'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import Select from '@/components/Select'
import { useAssistant } from '@/hooks/useAssistant'
import { useAppSettings } from '@/hooks/useAppSettings'
import { isSupabaseConfigured } from '@/lib/supabase'
import { getAssistantMonthlyInsights } from '@/services/assistantService'
import type { AssistantResolvedCategory, AssistantSlots } from '@/types'
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
    loading: assistantLoading,
    error: assistantError,
    lastInterpretation,
    lastConfirmation,
    ensureSession,
    interpret,
    confirm,
  } = useAssistant('web-dashboard-device')

  const [currentMonth, setCurrentMonth] = useState(getCurrentMonthString)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [isAssistantOpen, setIsAssistantOpen] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('')
  const [voiceListening, setVoiceListening] = useState(false)
  const [voicePhase, setVoicePhase] = useState<'idle' | 'listening' | 'stopped'>('idle')
  const [lastHeardCommand, setLastHeardCommand] = useState('')
  const [editableConfirmationText, setEditableConfirmationText] = useState('')
  const [editableSlots, setEditableSlots] = useState<AssistantSlots | null>(null)
  const activeRecognitionRef = useRef<any | null>(null)
  const [quickAddType, setQuickAddType] = useState<QuickAddType>('expense')
  const [hiddenDailyFlowSeries, setHiddenDailyFlowSeries] = useState<string[]>([])
  const [selectedExpenseCategory, setSelectedExpenseCategory] = useState<{ id: string; name: string } | null>(null)
  const [formData, setFormData] = useState({
    amount: '',
    report_amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    month: getCurrentMonthString(),
    category_id: '',
    income_category_id: '',
    description: '',
  })
  const [monthlyInsights, setMonthlyInsights] = useState<string[]>([])
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insightsError, setInsightsError] = useState<string | null>(null)

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
  const { monthlyInsightsEnabled } = useAppSettings()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()
  const { expenses, loading: expensesLoading, refreshExpenses, createExpense } = useExpenses(currentMonth)
  const previousMonth = useMemo(() => addMonths(currentMonth, -1), [currentMonth])
  const { expenses: previousMonthExpenses } = useExpenses(previousMonth)
  const { incomes, loading: incomesLoading, refreshIncomes, createIncome } = useIncomes(currentMonth)
  const { investments, loading: investmentsLoading, refreshInvestments, createInvestment } = useInvestments(currentMonth)
  const { limits: currentMonthExpenseLimits, loading: expenseLimitsLoading } = useExpenseCategoryLimits(currentMonth)
  const { limits: previousMonthExpenseLimits, loading: previousExpenseLimitsLoading } = useExpenseCategoryLimits(previousMonth)

  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount * (exp.report_weight ?? 1)), 0)
  const totalIncomes = incomes.reduce((sum, inc) => sum + (inc.amount * (inc.report_weight ?? 1)), 0)
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
        current.value += expense.amount * (expense.report_weight ?? 1)
      } else {
        map.set(key, { categoryId, name, color, value: expense.amount * (expense.report_weight ?? 1) })
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

        setMonthlyInsights(mergedInsights.slice(0, 4))
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
      if (day >= 1 && day <= daysInMonth) series[day - 1].Rendas += income.amount * (income.report_weight ?? 1)
    })

    expenses.forEach((expense) => {
      const day = new Date(`${expense.date}T00:00:00`).getDate()
      if (day >= 1 && day <= daysInMonth) series[day - 1].Despesas += expense.amount * (expense.report_weight ?? 1)
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

    const currentTotal = currentItems.reduce((sum, item) => sum + item.amount * (item.report_weight ?? 1), 0)
    const previousTotal = previousItems.reduce((sum, item) => sum + item.amount * (item.report_weight ?? 1), 0)

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
              className={`px-2 py-1 rounded-md border border-primary text-xs flex items-center gap-2 motion-standard hover-lift-subtle press-subtle ${
                isHidden ? 'opacity-50 bg-secondary' : 'bg-primary'
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
    'w-full rounded-lg p-2 -m-2 text-left motion-standard hover-lift-subtle press-subtle hover:bg-tertiary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]'

  const monthlyInsightsNarrative = useMemo(() => {
    if (!monthlyInsights.length) return ''

    const normalized = monthlyInsights
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))

    if (normalized.length === 1) {
      const single = normalized[0].replace(/[.!?]+$/, '')
      return `Resumo do seu mês: ${single.toLowerCase()}.`
    }

    const lowerFirst = (value: string) => {
      if (!value) return value
      const firstChar = value.charAt(0)
      if (firstChar.toUpperCase() !== firstChar) return value
      if (!/[A-ZÀ-Ú]/.test(firstChar)) return value
      return `${firstChar.toLowerCase()}${value.slice(1)}`
    }

    const withoutTrailingDot = normalized.map((item) => item.replace(/[.!?]+$/, ''))
    const firstSentence = `Resumo do seu mês: ${lowerFirst(withoutTrailingDot[0])}.`

    if (withoutTrailingDot.length === 2) {
      return `${firstSentence} E, olhando para o restante do cenário, ${lowerFirst(withoutTrailingDot[1])}.`
    }

    const middleConnectors = [
      'Além disso,',
      'Também vale destacar que',
      'Quando olhamos com calma,',
      'Outro ponto importante é que',
    ]

    const closingConnectors = [
      'Com isso em mente,',
      'Para os próximos dias,',
      'Na prática,',
      'Fechando o panorama,',
    ]

    const middleSentences = withoutTrailingDot.slice(1, -1).map((sentence, index) => {
      const connector = middleConnectors[index % middleConnectors.length]
      return `${connector} ${lowerFirst(sentence)}.`
    })

    const lastSentence = withoutTrailingDot[withoutTrailingDot.length - 1]
    const closingConnector = closingConnectors[(withoutTrailingDot.length - 1) % closingConnectors.length]

    return [
      firstSentence,
      ...middleSentences,
      `${closingConnector} ${lowerFirst(lastSentence)}.`,
    ].join(' ')
  }, [monthlyInsights])

  const openQuickAdd = (type: QuickAddType) => {
    setQuickAddType(type)
    setFormData({
      amount: '',
      report_amount: '',
      date: format(new Date(), 'yyyy-MM-dd'),
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

  const voiceSupport = useMemo(() => {
    if (typeof window === 'undefined') {
      return { recognition: false }
    }

    const hasRecognition = Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)

    return {
      recognition: hasRecognition,
    }
  }, [])

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
    setVoiceStatus('')
    setVoicePhase('idle')
    void handleVoiceInterpret()
  }

  const closeAssistant = () => {
    if (activeRecognitionRef.current) {
      activeRecognitionRef.current.stop()
    }
    setIsAssistantOpen(false)
    setVoiceListening(false)
    setVoicePhase('idle')
  }

  const stopActiveListening = () => {
    if (!activeRecognitionRef.current) return
    setVoiceStatus('Finalizando escuta...')
    activeRecognitionRef.current.stop()
  }

  useEffect(() => {
    if (!lastInterpretation) return
    setEditableConfirmationText(lastInterpretation.confirmationText)
    setEditableSlots(JSON.parse(JSON.stringify(lastInterpretation.slots || {})) as AssistantSlots)
  }, [lastInterpretation])

  const updateEditableSlots = (updater: (previous: AssistantSlots) => AssistantSlots) => {
    setEditableSlots((previous) => {
      const base = previous || {}
      return updater(base)
    })
  }

  const setSlotCategory = (categoryId: string, transactionType: 'expense' | 'income') => {
    const sourceList = transactionType === 'expense' ? categories : incomeCategories
    const selected = sourceList.find((item) => item.id === categoryId)
    if (!selected) return

    const categoryPayload: AssistantResolvedCategory = {
      id: selected.id,
      name: selected.name,
      confidence: 0.99,
      source: 'name_match',
    }

    updateEditableSlots((previous) => ({ ...previous, category: categoryPayload }))
  }

  const setItemCategory = (index: number, categoryId: string, transactionType: 'expense' | 'income') => {
    const sourceList = transactionType === 'expense' ? categories : incomeCategories
    const selected = sourceList.find((item) => item.id === categoryId)
    if (!selected) return

    const categoryPayload: AssistantResolvedCategory = {
      id: selected.id,
      name: selected.name,
      confidence: 0.99,
      source: 'name_match',
    }

    updateEditableSlots((previous) => ({
      ...previous,
      items: (previous.items || []).map((item, itemIndex) => (
        itemIndex === index
          ? { ...item, category: categoryPayload }
          : item
      )),
    }))
  }

  const resolveVoiceConfirmation = (spokenText: string) => {
    const normalized = spokenText.trim().toLowerCase()
    if (!normalized) return true

    if (
      normalized.includes('não')
      || normalized.includes('nao')
      || normalized.includes('cancelar')
      || normalized.includes('negar')
    ) {
      return false
    }

    return true
  }

  const getSpeechRecognitionErrorMessage = (errorCode?: string) => {
    const code = (errorCode || '').toLowerCase()

    if (code === 'network') {
      return 'Falha de rede no reconhecimento de voz. Use o comando em texto e toque em Interpretar.'
    }

    if (code === 'not-allowed' || code === 'service-not-allowed') {
      return 'Permissão de microfone negada. Libere o microfone nas permissões do navegador.'
    }

    if (code === 'no-speech') {
      return 'Nenhuma fala detectada. Fale novamente após tocar no botão.'
    }

    if (code === 'audio-capture') {
      return 'Não foi possível acessar o microfone. Verifique se outro app está usando o áudio.'
    }

    return 'Erro ao capturar voz. Use o modo de texto como alternativa.'
  }

  const captureSpeech = async (prompt?: string): Promise<string> => {
    if (!voiceSupport.recognition) {
      throw new Error('Reconhecimento de voz não suportado neste navegador/dispositivo.')
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
      throw new Error('Reconhecimento de voz requer contexto seguro (HTTPS ou localhost).')
    }

    return new Promise((resolve, reject) => {
      const RecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      const recognition = new RecognitionCtor()
      let isSettled = false
      let hasHeardSpeech = false
      let transcriptBuffer = ''
      let silenceTimer: ReturnType<typeof setTimeout> | null = null
      let initialSpeechTimer: ReturnType<typeof setTimeout> | null = null

      const scheduleSilenceStop = (delayMs: number) => {
        if (silenceTimer) clearTimeout(silenceTimer)
        silenceTimer = setTimeout(() => {
          if (!isSettled) {
            recognition.stop()
          }
        }, delayMs)
      }

      recognition.lang = 'pt-BR'
      recognition.interimResults = true
      recognition.maxAlternatives = 1
      recognition.continuous = false

      setVoiceStatus(prompt || 'Ouvindo...')
      setVoiceListening(true)
      setVoicePhase('listening')
      activeRecognitionRef.current = recognition
      initialSpeechTimer = setTimeout(() => {
        if (!isSettled) {
          setVoiceStatus('Não detectei sua voz ainda. Tente falar mais próximo ao microfone.')
          recognition.stop()
        }
      }, 7000)

      recognition.onspeechstart = () => {
        hasHeardSpeech = true
        if (initialSpeechTimer) {
          clearTimeout(initialSpeechTimer)
          initialSpeechTimer = null
        }
      }

      recognition.onresult = (event: any) => {
        const chunks: string[] = []

        for (let index = 0; index < (event.results?.length || 0); index += 1) {
          const result = event.results[index]
          const chunk = result?.[0]?.transcript?.trim()
          if (chunk) chunks.push(chunk)
        }

        const mergedTranscript = chunks.join(' ').replace(/\s+/g, ' ').trim()

        if (mergedTranscript) {
          hasHeardSpeech = true
          if (initialSpeechTimer) {
            clearTimeout(initialSpeechTimer)
            initialSpeechTimer = null
          }
          transcriptBuffer = mergedTranscript
          setVoiceStatus(`Escutando: ${transcriptBuffer}`)
          scheduleSilenceStop(2500)
        }
      }

      recognition.onspeechend = () => {
        if (!isSettled && hasHeardSpeech) {
          scheduleSilenceStop(1200)
        }
      }

      recognition.onerror = (event: any) => {
        if (isSettled) return
        isSettled = true
        if (silenceTimer) clearTimeout(silenceTimer)
        if (initialSpeechTimer) clearTimeout(initialSpeechTimer)
        setVoiceListening(false)
        setVoicePhase('stopped')
        activeRecognitionRef.current = null

        if (event?.error === 'no-speech') {
          const transcript = transcriptBuffer.trim()
          setLastHeardCommand(transcript)
          if (transcript) {
            playAssistantBeep('heard')
            setVoiceStatus(`Reconhecido: ${transcript}`)
            resolve(transcript)
            return
          }

          setVoiceStatus('Nenhuma fala detectada. Tente novamente falando logo após tocar no botão.')
          resolve('')
          return
        }

        const errorMessage = getSpeechRecognitionErrorMessage(event?.error)
        setVoiceStatus(errorMessage)
        reject(new Error(errorMessage))
      }

      recognition.onend = () => {
        if (isSettled) return
        isSettled = true
        if (silenceTimer) clearTimeout(silenceTimer)
        if (initialSpeechTimer) clearTimeout(initialSpeechTimer)
        setVoiceListening(false)
        setVoicePhase('stopped')
        activeRecognitionRef.current = null
        playAssistantBeep('end')

        const transcript = transcriptBuffer.trim()
        setLastHeardCommand(transcript)

        if (transcript) {
          playAssistantBeep('heard')
          setVoiceStatus(`Reconhecido: ${transcript}`)
          resolve(transcript)
          return
        }

        setVoiceStatus('Nenhuma fala reconhecida.')
        resolve('')
      }

      recognition.start()
    })
  }

  const handleConfirmAssistant = async (confirmed: boolean) => {
    if (!lastInterpretation?.command.id || !isSupabaseConfigured) return
    const spokenText = editableConfirmationText.trim() || undefined
    const editedDescription = editableSlots?.description?.trim() || undefined
    const result = await confirm(lastInterpretation.command.id, confirmed, spokenText, editedDescription, editableSlots || undefined)
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

      await ensureSession()
      const result = await interpret(transcript)
      if (!result.requiresConfirmation) {
        playAssistantBeep('executed')
      }
    } catch (error) {
      setVoiceStatus(error instanceof Error ? error.message : 'Erro ao interpretar comando por voz.')
    }
  }

  const handleVoiceConfirm = async () => {
    if (!isSupabaseConfigured || assistantLoading || !lastInterpretation?.command.id) return
    if (lastInterpretation.intent === 'add_expense') {
      setVoiceStatus('Para despesas, a confirmação é manual pelos botões Confirmar/Negar.')
      return
    }

    try {
      const transcript = await captureSpeech('Confirme por voz')
      if (!transcript) return

      const confirmed = resolveVoiceConfirmation(transcript)
      const result = await confirm(lastInterpretation.command.id, confirmed, transcript)
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

    if (quickAddType === 'expense') {
      if (!formData.category_id) {
        alert('Selecione uma categoria de despesa.')
        return
      }

      const { error } = await createExpense({
        amount,
        report_weight: reportWeight,
        date: formData.date,
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
      
      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6">
        <MonthSelector value={currentMonth} onChange={setCurrentMonth} />

        <Card>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-primary">Insights personalizados do mês</h3>
            {!monthlyInsightsEnabled ? (
              <p className="text-sm text-secondary">Insights desativados. Ative em Configurações do App para receber análises contextuais do mês.</p>
            ) : insightsLoading ? (
              <p className="text-sm text-secondary">Analisando movimentações do mês...</p>
            ) : insightsError ? (
              <p className="text-sm text-secondary">Não foi possível atualizar insights agora. Tente novamente após novos lançamentos.</p>
            ) : monthlyInsights.length === 0 ? (
              <p className="text-sm text-secondary">Ainda não há contexto suficiente para gerar insights inteligentes neste mês.</p>
            ) : (
              <p className="text-sm text-primary leading-relaxed">
                {monthlyInsightsNarrative}
              </p>
            )}
          </div>
        </Card>

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
          </>
        )}
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
            required
          />

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
                const reportAmount = item.amount * (item.report_weight ?? 1)
                const showOriginal = Math.abs(reportAmount - item.amount) > 0.009

                return (
                  <div key={item.id} className="rounded-lg border border-primary bg-primary p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">{item.description || 'Sem descrição'}</p>
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
            <div className="space-y-3 rounded-lg border border-primary bg-secondary p-3">
              <div className="rounded-lg border border-primary bg-primary p-3 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-secondary">Campos editáveis antes do lançamento</p>

                <Input
                  label="Resumo da confirmação"
                  value={editableConfirmationText}
                  onChange={(event) => setEditableConfirmationText(event.target.value)}
                  disabled={assistantLoading || !isSupabaseConfigured}
                />

                {(editableSlots?.items?.length || 0) > 0 ? (
                  <div className="space-y-3">
                    {(editableSlots?.items || []).map((item, index) => {
                      const transactionType = item.transactionType || 'expense'
                      const reportAmount = item.amount > 0 && Number.isFinite(item.report_weight)
                        ? item.amount * Number(item.report_weight)
                        : item.amount

                      return (
                        <div key={`assistant-item-${index}`} className="rounded-md border border-primary bg-tertiary p-3 space-y-2">
                          <p className="text-xs font-medium text-secondary">Lançamento {index + 1}</p>

                          <Select
                            label="Tipo"
                            value={transactionType}
                            onChange={(event) => {
                              const nextType = event.target.value as 'expense' | 'income' | 'investment'
                              updateEditableSlots((previous) => ({
                                ...previous,
                                items: (previous.items || []).map((currentItem, itemIndex) => (
                                  itemIndex === index
                                    ? { ...currentItem, transactionType: nextType }
                                    : currentItem
                                )),
                              }))
                            }}
                            options={[
                              { value: 'expense', label: 'Despesa' },
                              { value: 'income', label: 'Renda' },
                              { value: 'investment', label: 'Investimento' },
                            ]}
                            disabled={assistantLoading || !isSupabaseConfigured}
                          />

                          <Input
                            label="Descrição"
                            value={item.description || ''}
                            onChange={(event) => {
                              const value = event.target.value
                              updateEditableSlots((previous) => ({
                                ...previous,
                                items: (previous.items || []).map((currentItem, itemIndex) => (
                                  itemIndex === index
                                    ? { ...currentItem, description: value }
                                    : currentItem
                                )),
                              }))
                            }}
                            disabled={assistantLoading || !isSupabaseConfigured}
                          />

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Input
                              label="Valor"
                              type="text"
                              inputMode="decimal"
                              value={formatMoneyInput(Number(item.amount || 0))}
                              onChange={(event) => {
                                const parsed = parseMoneyInput(event.target.value)
                                if (Number.isNaN(parsed)) return
                                updateEditableSlots((previous) => ({
                                  ...previous,
                                  items: (previous.items || []).map((currentItem, itemIndex) => (
                                    itemIndex === index
                                      ? { ...currentItem, amount: parsed }
                                      : currentItem
                                  )),
                                }))
                              }}
                              disabled={assistantLoading || !isSupabaseConfigured}
                            />

                            {transactionType !== 'investment' && (
                              <Input
                                label="Valor no relatório"
                                type="text"
                                inputMode="decimal"
                                value={formatMoneyInput(Number(reportAmount || 0))}
                                onChange={(event) => {
                                  const parsed = parseMoneyInput(event.target.value)
                                  if (Number.isNaN(parsed) || !item.amount || item.amount <= 0) return
                                  const reportWeight = Math.min(1, Math.max(0, Number((parsed / item.amount).toFixed(4))))
                                  updateEditableSlots((previous) => ({
                                    ...previous,
                                    items: (previous.items || []).map((currentItem, itemIndex) => (
                                      itemIndex === index
                                        ? { ...currentItem, report_weight: reportWeight }
                                        : currentItem
                                    )),
                                  }))
                                }}
                                disabled={assistantLoading || !isSupabaseConfigured}
                              />
                            )}
                          </div>

                          {transactionType === 'expense' && (
                            <Select
                              label="Categoria"
                              value={item.category?.id || ''}
                              onChange={(event) => setItemCategory(index, event.target.value, 'expense')}
                              options={[{ value: '', label: 'Selecionar categoria' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
                              disabled={assistantLoading || !isSupabaseConfigured}
                            />
                          )}

                          {transactionType === 'income' && (
                            <Select
                              label="Categoria de renda"
                              value={item.category?.id || ''}
                              onChange={(event) => setItemCategory(index, event.target.value, 'income')}
                              options={[{ value: '', label: 'Selecionar categoria' }, ...incomeCategories.map((category) => ({ value: category.id, label: category.name }))]}
                              disabled={assistantLoading || !isSupabaseConfigured}
                            />
                          )}

                          {transactionType === 'investment' ? (
                            <Input
                              label="Mês"
                              type="month"
                              value={item.month || editableSlots?.month || ''}
                              onChange={(event) => {
                                const value = event.target.value
                                updateEditableSlots((previous) => ({
                                  ...previous,
                                  items: (previous.items || []).map((currentItem, itemIndex) => (
                                    itemIndex === index
                                      ? { ...currentItem, month: value }
                                      : currentItem
                                  )),
                                }))
                              }}
                              disabled={assistantLoading || !isSupabaseConfigured}
                            />
                          ) : (
                            <Input
                              label="Data"
                              type="date"
                              value={item.date || editableSlots?.date || ''}
                              onChange={(event) => {
                                const value = event.target.value
                                updateEditableSlots((previous) => ({
                                  ...previous,
                                  items: (previous.items || []).map((currentItem, itemIndex) => (
                                    itemIndex === index
                                      ? { ...currentItem, date: value }
                                      : currentItem
                                  )),
                                }))
                              }}
                              disabled={assistantLoading || !isSupabaseConfigured}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <>
                    <Input
                      label="Descrição"
                      value={editableSlots?.description || ''}
                      onChange={(event) => updateEditableSlots((previous) => ({ ...previous, description: event.target.value }))}
                      disabled={assistantLoading || !isSupabaseConfigured}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        label="Valor"
                        type="text"
                        inputMode="decimal"
                        value={formatMoneyInput(Number(editableSlots?.amount || 0))}
                        onChange={(event) => {
                          const parsed = parseMoneyInput(event.target.value)
                          if (Number.isNaN(parsed)) return
                          updateEditableSlots((previous) => ({ ...previous, amount: parsed }))
                        }}
                        disabled={assistantLoading || !isSupabaseConfigured}
                      />

                      {lastInterpretation.intent === 'add_investment' ? (
                        <Input
                          label="Mês"
                          type="month"
                          value={editableSlots?.month || ''}
                          onChange={(event) => updateEditableSlots((previous) => ({ ...previous, month: event.target.value }))}
                          disabled={assistantLoading || !isSupabaseConfigured}
                        />
                      ) : (
                        <Input
                          label="Data"
                          type="date"
                          value={editableSlots?.date || ''}
                          onChange={(event) => updateEditableSlots((previous) => ({ ...previous, date: event.target.value }))}
                          disabled={assistantLoading || !isSupabaseConfigured}
                        />
                      )}
                    </div>

                    {lastInterpretation.intent === 'add_expense' && (
                      <Select
                        label="Categoria"
                        value={editableSlots?.category?.id || ''}
                        onChange={(event) => setSlotCategory(event.target.value, 'expense')}
                        options={[{ value: '', label: 'Selecionar categoria' }, ...categories.map((category) => ({ value: category.id, label: category.name }))]}
                        disabled={assistantLoading || !isSupabaseConfigured}
                      />
                    )}

                    {lastInterpretation.intent === 'add_income' && (
                      <Select
                        label="Categoria de renda"
                        value={editableSlots?.category?.id || ''}
                        onChange={(event) => setSlotCategory(event.target.value, 'income')}
                        options={[{ value: '', label: 'Selecionar categoria' }, ...incomeCategories.map((category) => ({ value: category.id, label: category.name }))]}
                        disabled={assistantLoading || !isSupabaseConfigured}
                      />
                    )}
                  </>
                )}
              </div>

              <div className={`grid grid-cols-1 gap-2 ${lastInterpretation.intent === 'add_expense' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                <Button
                  onClick={() => handleConfirmAssistant(true)}
                  disabled={assistantLoading || !isSupabaseConfigured}
                  fullWidth
                >
                  Confirmar
                </Button>
                <Button
                  onClick={() => handleConfirmAssistant(false)}
                  disabled={assistantLoading || !isSupabaseConfigured}
                  variant="outline"
                  fullWidth
                >
                  Negar
                </Button>
                {lastInterpretation.intent !== 'add_expense' && (
                  <Button
                    onClick={handleVoiceConfirm}
                    disabled={assistantLoading || !isSupabaseConfigured || !voiceSupport.recognition || voiceListening}
                    variant="outline"
                    fullWidth
                  >
                    {voiceListening ? 'Ouvindo...' : 'Confirmar por Voz'}
                  </Button>
                )}
              </div>

              {lastInterpretation.intent === 'add_expense' && (
                <p className="text-xs text-secondary">Para despesas, a confirmação é feita manualmente pelos botões acima.</p>
              )}
            </div>
          )}

          {voiceStatus && <p className="text-xs text-secondary">{voiceStatus}</p>}
          {assistantError && <p className="text-xs text-[var(--color-danger)]">{assistantError}</p>}
          {lastConfirmation && <p className="text-sm text-primary">{lastConfirmation.message}</p>}
        </div>
      </Modal>
    </div>
  )
}

