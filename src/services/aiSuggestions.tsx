import { formatCurrency, formatNumberWithTwoDecimalsBR, formatMonth } from '@/utils/format'
import { AlertTriangle, TrendingDown, TrendingUp, Sparkles, Calendar, PiggyBank, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

export interface AiSuggestion {
  id: string
  text: string
  tip: string
  query: string
  icon: ReactNode
}

export interface AiSuggestionsInput {
  currentMonth: string
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  savingsRate: number
  categoryExpenseSummaries: { category_name: string; total: number; baseTotal: number }[]
  previousMonthExpenseTotal: number
  weekdayExpenseData: { dia: string; Despesas: number }[]
  limitsExceededCount: number
  incomeByCategory: { name: string; total: number }[]
  spendingPace: { overPct: number; isOverBudget: boolean } | null
  spendingProjection: {
    currentDay: number
    dailyBurnRate: number
    projectedSurplus: number
    onTrack: boolean
  } | null
}

/**
 * Gera sugestões inteligentes de IA baseadas exclusivamente em dados financeiros reais (não-LLM).
 * Cada sugestão tem texto, dica, query para a IA e ícone.
 * Prioriza as mais críticas primeiro (limites estourados, ritmo de gastos, taxa de consumo).
 */
export function generateAiSuggestions(input: AiSuggestionsInput): AiSuggestion[] {
  const {
    currentMonth,
    totalIncomes,
    totalExpenses,
    totalInvestments,
    savingsRate,
    categoryExpenseSummaries,
    previousMonthExpenseTotal,
    weekdayExpenseData,
    limitsExceededCount,
    incomeByCategory,
    spendingPace,
    spendingProjection,
  } = input

  const list: AiSuggestion[] = []

  // 1. Limits Exceeded (warning more critical)
  if (limitsExceededCount > 0) {
    list.push({
      id: 'limits-exceeded',
      text: `Limite estourado em ${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'}.`,
      tip: `Reduza gastos nas demais categorias imediatamente para equilibrar o orçamento.`,
      query: `Quais estratégias posso usar para conter gastos nas ${limitsExceededCount} categorias onde estourei o limite de orçamento?`,
      icon: <AlertTriangle size={14} className="text-expense" />,
    })
  }

  // 2. Savings Rate Insight
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

  // 3. Expense Variation (comparação com mês anterior)
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

  // 4. Top Category (maior custo)
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

  // 5. Peak Weekday (dia da semana com mais gastos)
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

  // 7. Income Concentration
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

  // 8. Spending Pace (ritmo de gastos no meio do mês)
  if (spendingPace && spendingPace.isOverBudget && spendingPace.overPct > 5) {
    list.push({
      id: 'spending-pace',
      text: `Ritmo de gastos ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do esperado para esta altura do mês.`,
      tip: `Ajuste o ritmo nos próximos dias para não estourar o orçamento mensal.`,
      query: `Meus gastos estão ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do ritmo esperado para esta altura do mês. Quais categorias devo priorizar para cortar?`,
      icon: <AlertTriangle size={14} className="text-expense" />,
    })
  }

  // 9. Projected End-of-Month
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

  // 10. Expense-to-Income Ratio (taxa de consumo)
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
    'limits-exceeded': 100,
    'spending-pace': 95,
    'burn-rate': 90,
    'expense-variance': 70,
    'income-concentration': 60,
    'investment-ratio': 50,
    'top-category': 40,
    'peak-weekday': 30,
  }

  list.sort((a, b) => {
    // Savings-rate with negative balance gets highest priority
    const aIsNeg = a.id === 'savings-rate' && a.text.includes('negativo')
    const bIsNeg = b.id === 'savings-rate' && b.text.includes('negativo')
    if (aIsNeg && !bIsNeg) return -1
    if (!aIsNeg && bIsNeg) return 1

    // High burn-rate gets priority
    const aIsHighBurn = a.id === 'burn-rate' && a.text.includes('consumida')
    const bIsHighBurn = b.id === 'burn-rate' && b.text.includes('consumida')
    if (aIsHighBurn && !bIsHighBurn) return -1
    if (!aIsHighBurn && bIsHighBurn) return 1

    const pa = priorityOrder[a.id] ?? 50
    const pb = priorityOrder[b.id] ?? 50
    return pb - pa
  })

  // Limit to at most 6 insights of highest priority
  return list.slice(0, 6)
}
