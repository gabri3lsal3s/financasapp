import { useState, useMemo, useCallback, useEffect, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { askGemini } from '@/services/geminiService'
import { formatNumberWithTwoDecimalsBR, formatCurrency, formatMonth } from '@/utils/format'
import { logger } from '@/utils/logger'
import type { Expense, Income, CreditCard, Category, IncomeCategory } from '@/types'
import { AlertTriangle, TrendingDown, TrendingUp, Sparkles, Calendar, PiggyBank, CheckCircle2 } from 'lucide-react'

export interface DynamicSuggestion {
  id: string
  text: string
  tip: string
  query: string
  icon: ReactNode
}

interface AiContext {
  balance: number
  totalIncome: number
  totalExpense: number
  totalInvestment: number
  spentToday: number
  cardInvoice: number
  expenses: Array<{
    id: string
    title: string
    category: string
    amount: number
    date: string
    group: string
  }>
  incomes: Array<{
    id: string
    title: string
    category: string
    amount: number
    date: string
  }>
}

export interface PinnedAnalysis {
  text: string
  chartData?: any[]
  queryText: string
  dataHash: string
}

interface UseDashboardAIOptions {
  currentMonth: string
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  balance: number
  savingsRate: number
  creditCards: CreditCard[]
  expenses: Expense[]
  incomes: Income[]
  categories: Category[]
  incomeCategories: IncomeCategory[]
  expenseByCategory: { name: string; value: number; categoryId: string }[]
  incomeByCategory: { name: string; total: number }[]
  weekdayExpenseData: { dia: string; Despesas: number }[]
  limitsExceededCount: number
  spendingProjection: { projectedSurplus: number; dailyBurnRate: number; currentDay: number; onTrack: boolean } | null
  spendingPace: { overPct: number; isOverBudget: boolean } | null
  previousMonthExpenseTotal: number
  dynamicSuggestions: DynamicSuggestion[]
  createExpense: (data: any) => Promise<{ data: any; error: string | null }>
  createIncome: (data: any) => Promise<{ data: any; error: string | null }>
  refreshExpenses: () => Promise<void>
  refreshIncomes: () => Promise<void>
}

interface UseDashboardAIReturn {
  chatInput: string
  setChatInput: React.Dispatch<React.SetStateAction<string>>
  activeQueryText: string
  activeReportText: string
  activeChartData: any[] | undefined
  isAiTyping: boolean
  pinnedAnalysis: PinnedAnalysis | null
  hasNewDataForPinned: boolean
  currentHash: string
  isUpdatingPinned: boolean
  dynamicAiSuggestions: DynamicSuggestion[]
  handleSendChat: (e?: React.FormEvent, customText?: string) => Promise<void>
  handlePin: () => Promise<void>
  handleUnpin: () => Promise<void>
  handleUpdatePinnedAnalysis: () => Promise<void>
}

export function useDashboardAI(options: UseDashboardAIOptions): UseDashboardAIReturn {
  const {
    currentMonth,
    totalIncomes,
    totalExpenses,
    totalInvestments,
    balance,
    creditCards,
    expenses,
    incomes,
    categories,
    incomeCategories,
    expenseByCategory,
    weekdayExpenseData,
    limitsExceededCount,
    spendingProjection,
    spendingPace,
    previousMonthExpenseTotal,
    createExpense,
    createIncome,
    refreshExpenses,
    refreshIncomes,
  } = options

  const [chatInput, setChatInput] = useState('')
  const [activeQueryText, setActiveQueryText] = useState('')
  const [activeReportText, setActiveReportText] = useState(
    'Selecione uma das sugestões abaixo ou digite sua pergunta para que a Inteligência Artificial possa analisar seus dados consolidados e fornecer insights de economia imediata.',
  )
  const [activeChartData, setActiveChartData] = useState<any[] | undefined>(undefined)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [pinnedAnalysis, setPinnedAnalysis] = useState<PinnedAnalysis | null>(null)
  const [isUpdatingPinned, setIsUpdatingPinned] = useState(false)

  const currentHash = useMemo(() => {
    const expHash = `${expenses.length}_${formatNumberWithTwoDecimalsBR(totalExpenses)}`
    const incHash = `${incomes.length}_${formatNumberWithTwoDecimalsBR(totalIncomes)}`
    return `exp:${expHash}|inc:${incHash}`
  }, [expenses, totalExpenses, incomes, totalIncomes])

  const hasNewDataForPinned = useMemo(() => {
    return pinnedAnalysis ? pinnedAnalysis.dataHash !== currentHash : false
  }, [pinnedAnalysis, currentHash])

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
        const analysis = data.pinned_analysis as PinnedAnalysis
        setPinnedAnalysis(analysis)
        setActiveReportText(analysis.text)
        setActiveChartData(analysis.chartData)
        setActiveQueryText(analysis.queryText)
      }
    } catch (err) {
      logger.error('Erro ao carregar análise fixada:', err)
    }
  }, [])

  useEffect(() => {
    loadPinnedAnalysis()
  }, [loadPinnedAnalysis])

  const handlePin = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const newPinned: PinnedAnalysis = {
        text: activeReportText,
        chartData: activeChartData,
        queryText: activeQueryText || 'Relatório Consolidado',
        dataHash: currentHash,
      }

      const { error } = await supabase
        .from('pinned_ai_analyses')
        .upsert({
          user_id: user.id,
          pinned_analysis: newPinned,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      setPinnedAnalysis(newPinned)
    } catch (err) {
      logger.error('Erro ao fixar análise:', err)
    }
  }, [activeReportText, activeChartData, activeQueryText, currentHash])

  const handleUnpin = useCallback(async () => {
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
  }, [])

  const handleUpdatePinnedAnalysis = useCallback(async () => {
    if (!pinnedAnalysis) return
    setIsUpdatingPinned(true)
    try {
      const query = pinnedAnalysis.queryText || 'Acompanhamento diário'
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      const financialsContext: AiContext = {
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
          group: e.payment_method === 'credit_card' ? 'Cartão de Crédito' : 'Outros',
        })),
        incomes: incomes.map(i => ({
          id: i.id,
          title: i.description || '',
          category: i.income_category?.name || 'Outros',
          amount: i.amount,
          date: i.date,
        })),
      }

      const result = await askGemini(
        [{ sender: 'user', text: query }],
        financialsContext,
      )

      const updatedPinned: PinnedAnalysis = {
        text: result.text,
        chartData: result.chartData,
        queryText: query,
        dataHash: currentHash,
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase
          .from('pinned_ai_analyses')
          .upsert({
            user_id: user.id,
            pinned_analysis: updatedPinned,
            updated_at: new Date().toISOString(),
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
  }, [pinnedAnalysis, balance, totalIncomes, totalExpenses, totalInvestments, expenses, incomes, creditCards, currentHash, activeQueryText, activeReportText, activeChartData])

  const handleSendChat = useCallback(async (e?: React.FormEvent, customText?: string) => {
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

    const isExpense =
      lower.includes('despesa') || lower.includes('gastei') || lower.includes('gastou') ||
      lower.includes('gasto') || lower.includes('paguei') || lower.includes('pagou') ||
      lower.includes('compra') || lower.includes('comprei')
    const isIncome =
      lower.includes('receita') || lower.includes('recebi') || lower.includes('ganhei') ||
      lower.includes('renda') || lower.includes('entrada') || lower.includes('salário') ||
      lower.includes('salario') || lower.includes('pix')

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

      // Infer category from keywords
      if (parsedTitle.toLowerCase().includes('cafe') || parsedTitle.toLowerCase().includes('almoço') ||
          parsedTitle.toLowerCase().includes('comida') || parsedTitle.toLowerCase().includes('refrigerante') ||
          parsedTitle.toLowerCase().includes('pizza')) {
        parsedCategory = 'Supermercado'
      } else if (parsedTitle.toLowerCase().includes('carro') || parsedTitle.toLowerCase().includes('gasolina') ||
                 parsedTitle.toLowerCase().includes('uber') || parsedTitle.toLowerCase().includes('taxi') ||
                 parsedTitle.toLowerCase().includes('transporte')) {
        parsedCategory = 'Transporte'
      } else if (parsedTitle.toLowerCase().includes('cinema') || parsedTitle.toLowerCase().includes('role') ||
                 parsedTitle.toLowerCase().includes('festa') || parsedTitle.toLowerCase().includes('lazer')) {
        parsedCategory = 'Lazer'
      } else if (parsedTitle.toLowerCase().includes('salario') || parsedTitle.toLowerCase().includes('pagamento') ||
                 parsedTitle.toLowerCase().includes('reembolso')) {
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
          const matchedCategory = categories.find(
            c => c.name.toLowerCase() === parsedCategory.toLowerCase() ||
                 parsedTitle.toLowerCase().includes(c.name.toLowerCase()),
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
            report_weight: 1,
          })

          if (!res.error) {
            refreshExpenses()
          }
        } else {
          let income_category_id = ''
          const matchedIncomeCategory = incomeCategories.find(
            c => c.name.toLowerCase() === parsedCategory.toLowerCase() ||
                 parsedTitle.toLowerCase().includes(c.name.toLowerCase()),
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
            report_weight: 1,
          })

          if (!res.error) {
            refreshIncomes()
          }
        }

        setTimeout(() => {
          setActiveReportText(
            `🎯 **Entendido!** Adicionei com sucesso esta ${parsedType === 'despesa' ? 'despesa' : 'receita'} ao seu aplicativo:\n\n• **Item:** ${parsedTitle}\n• **Valor:** R$ ${formatCurrency(parsedAmount)}\n• **Categoria:** ${parsedCategory}\n\nSeu saldo, limites e gráficos foram atualizados na tela em tempo real!`,
          )
          setActiveChartData(undefined)
          setIsAiTyping(false)
        }, 750)
      } catch (err) {
        logger.error('Erro ao adicionar transação via IA:', err)
        setIsAiTyping(false)
      }
      return
    }

    // Send to Gemini AI
    try {
      const today = new Date()
      const todayStr = today.toISOString().slice(0, 10)

      const financialsContext: AiContext = {
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
          group: e.payment_method === 'credit_card' ? 'Cartão de Crédito' : 'Outros',
        })),
        incomes: incomes.map(i => ({
          id: i.id,
          title: i.description || '',
          category: i.income_category?.name || 'Outros',
          amount: i.amount,
          date: i.date,
        })),
      }

      const result = await askGemini(
        [{ sender: 'user', text: textToSend }],
        financialsContext,
      )

      setActiveReportText(result.text)
      setActiveChartData(result.chartData)
    } catch (err) {
      logger.error('Erro ao consultar o assistente Gemini:', err)
      setActiveReportText('Ocorreu um erro ao processar a resposta. Por favor, tente novamente mais tarde.')
    } finally {
      setIsAiTyping(false)
    }
  }, [chatInput, currentMonth, expenses, incomes, categories, incomeCategories, balance, totalIncomes, totalExpenses, totalInvestments, creditCards, createExpense, createIncome, refreshExpenses, refreshIncomes])

  // Build dynamic suggestions
  const dynamicAiSuggestions = useMemo((): DynamicSuggestion[] => {
    const savingsRateVal = totalIncomes > 0 ? ((totalIncomes - totalExpenses - totalInvestments) / totalIncomes) * 100 : 0
    const list: DynamicSuggestion[] = []

    // 1. Limits Exceeded
    if (limitsExceededCount > 0) {
      list.push({
        id: 'limits-exceeded',
        text: `Limite estourado em ${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'}.`,
        tip: `Reduza gastos nas demais categorias imediatamente para equilibrar o orçamento.`,
        query: `Quais estratégias posso usar para conter gastos nas ${limitsExceededCount} categorias onde estourei o limite de orçamento?`,
        icon: <AlertTriangle size={14} className="text-expense" />,
      })
    }

    // 2. Savings Rate
    if (totalIncomes > 0) {
      if (savingsRateVal >= 20) {
        list.push({
          id: 'savings-rate',
          text: `Poupou ${formatNumberWithTwoDecimalsBR(savingsRateVal)}% da renda em ${formatMonth(currentMonth)} (meta: 20%).`,
          tip: `Excelente! Direcione este excedente poupado para investimentos e acelere seus planos.`,
          query: `Como posso otimizar meus investimentos considerando que poupei ${formatNumberWithTwoDecimalsBR(savingsRateVal)}% da minha renda este mês?`,
          icon: <TrendingDown size={14} className="text-income" />,
        })
      } else if (savingsRateVal > 0 && savingsRateVal < 20) {
        list.push({
          id: 'savings-rate',
          text: `Poupança em ${formatNumberWithTwoDecimalsBR(savingsRateVal)}% da renda (abaixo da meta de 20%).`,
          tip: `Corte pequenos gastos supérfluos para tentar atingir a meta recomendada.`,
          query: `Como posso aumentar minha taxa de poupança atual de ${formatNumberWithTwoDecimalsBR(savingsRateVal)}% para a meta saudável de 20%?`,
          icon: <TrendingUp size={14} className="text-primary" />,
        })
      } else if (savingsRateVal <= 0) {
        list.push({
          id: 'savings-rate',
          text: `Saldo líquido negativo em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRateVal))}% este mês.`,
          tip: `Alerta: Suas despesas superaram a renda. Evite qualquer compra supérflua de imediato.`,
          query: `Quais ações imediatas devo tomar porque minhas despesas superaram minhas receitas em ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRateVal))}% este mês?`,
          icon: <AlertTriangle size={14} className="text-expense" />,
        })
      }
    }

    // 3. Expense Variation
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

    // 4. Top Category
    if (expenseByCategory.length > 0 && totalExpenses > 0) {
      const sorted = [...expenseByCategory].sort((a, b) => b.value - a.value)
      const topCat = sorted[0]
      const topPct = (topCat.value / totalExpenses) * 100
      if (topPct > 15) {
        list.push({
          id: 'top-category',
          text: `"${topCat.name}" foi seu maior custo (${formatCurrency(topCat.value)} - ${formatNumberWithTwoDecimalsBR(topPct)}%).`,
          tip: `Defina um limite específico para esta categoria para reduzir o impacto no total.`,
          query: `Como posso economizar e cortar gastos na minha maior categoria de despesas: ${topCat.name}, onde gastei ${formatCurrency(topCat.value)}?`,
          icon: <Sparkles size={14} className="text-primary" />,
        })
      }
    }

    // 5. Peak Weekday
    if (weekdayExpenseData && weekdayExpenseData.length > 0) {
      const sortedDays = [...weekdayExpenseData].sort((a, b) => b.Despesas - a.Despesas)
      const peakDay = sortedDays[0]
      if (peakDay && peakDay.Despesas > 0) {
        const fullDayNames: Record<string, string> = {
          Seg: 'Segunda-feira', Ter: 'Terça-feira', Qua: 'Quarta-feira',
          Qui: 'Quinta-feira', Sex: 'Sexta-feira', Sáb: 'Sábado', Dom: 'Domingo',
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

    // 6. Investment Ratio
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

    // 7. Spending Pace Alert
    if (spendingPace && spendingPace.isOverBudget && spendingPace.overPct > 5) {
      list.push({
        id: 'spending-pace',
        text: `Ritmo de gastos ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do esperado para esta altura do mês.`,
        tip: `Ajuste o ritmo nos próximos dias para não estourar o orçamento mensal.`,
        query: `Meus gastos estão ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do ritmo esperado para esta altura do mês. Quais categorias devo priorizar para cortar?`,
        icon: <AlertTriangle size={14} className="text-expense" />,
      })
    }

    // 8. Projection Alert
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

    // 9. Burn Rate
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

    // Priority ordering
    const priorityOrder: Record<string, number> = {
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
      // Negative savings rate = higher priority
      const aIsNeg = a.id === 'savings-rate' && a.text.includes('negativo')
      const bIsNeg = b.id === 'savings-rate' && b.text.includes('negativo')
      if (aIsNeg && !bIsNeg) return -1
      if (!aIsNeg && bIsNeg) return 1
      // High burn rate = higher priority
      const aIsHighBurn = a.id === 'burn-rate' && a.text.includes('consumida')
      const bIsHighBurn = b.id === 'burn-rate' && b.text.includes('consumida')
      if (aIsHighBurn && !bIsHighBurn) return -1
      if (!aIsHighBurn && bIsHighBurn) return 1
      const pa = priorityOrder[a.id] ?? 50
      const pb = priorityOrder[b.id] ?? 50
      return pb - pa
    })

    return list.slice(0, 6)
  }, [
    currentMonth, totalIncomes, totalExpenses, totalInvestments,
    limitsExceededCount, expenseByCategory, weekdayExpenseData,
    spendingProjection, spendingPace, previousMonthExpenseTotal,
  ])

  return {
    chatInput,
    setChatInput,
    activeQueryText,
    activeReportText,
    activeChartData,
    isAiTyping,
    pinnedAnalysis,
    hasNewDataForPinned,
    currentHash,
    isUpdatingPinned,
    dynamicAiSuggestions,
    handleSendChat,
    handlePin,
    handleUnpin,
    handleUpdatePinnedAnalysis,
  }
}
