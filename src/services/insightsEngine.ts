import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import type { Expense } from '@/types'
import { isSubscriptionIgnored } from '@/utils/ignoredSubscriptions'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface CategoryExpenseSummary {
  category_name: string
  total: number
  baseTotal: number
}

export interface WeekdayExpense {
  dia: string
  Despesas: number
}

export interface IncomeCategorySummary {
  name: string
  total: number
}

export interface SpendingPaceInfo {
  overPct: number
  isOverBudget: boolean
}

export interface SpendingProjectionInfo {
  daysElapsed: number
  daysInMonth: number
  currentDay: number
  dailyBurnRate: number
  projectedEndOfMonthExpenses: number
  projectedSurplus: number
  onTrack: boolean
  mode: 'past' | 'current'
}

export type SubscriptionTier = 'essential' | 'discretionary' | 'can_cut'

export interface SubscriptionInfo {
  description: string
  categoryName: string
  monthlyAmount: number
  annualAmount: number
  monthsFound: number
  categoryId?: string
  /** Quão confiante a detecção é (0-1) */
  confidence: number
  /** Classificação inteligente */
  tier: SubscriptionTier
  /** Quanto economizaria por mês se cortasse (0 para essenciais) */
  savingsIfCut: number
  /** Razão para a classificação */
  tierReason: string
  /** Se o usuário já ignorou esta assinatura */
  isIgnored: boolean
}

export interface SavingsChallenge {
  id: string
  title: string
  description: string
  potentialSavings: number
  /** Economia projetada em 12 meses se mantiver o corte */
  annualProjectedSavings: number
  categoryName: string
  currentSpending: number
  reductionPercent: number
  difficulty: 'fácil' | 'médio' | 'desafiador'
  action: 'navigate' | 'set_limit'
  path?: string
}

export interface LimitSuggestion {
  categoryId: string
  categoryName: string
  currentSpent: number
  currentLimit: number
  suggestedLimit: number
  difference: number
  type: 'increase' | 'decrease'
  reason: string
}

/** Novo: Concentração de renda */
export interface IncomeConcentrationInfo {
  isConcentrated: boolean
  topSourceName: string
  topSourcePercentage: number
  topSourceAmount: number
}

/** Novo: Tendência vs mês anterior */
export interface ExpenseTrendInfo {
  percentageChange: number
  isIncrease: boolean
  absoluteChange: number
  isSignificant: boolean
}

/** Novo: Gastos de fim de semana */
export interface WeekendSpendingInfo {
  weekendAvg: number
  weekdayAvg: number
  ratio: number
  isHigherOnWeekends: boolean
}

/** Novo: Categoria destaque */
export interface TopCategoryInfo {
  name: string
  total: number
  percentageOfTotal: number
}

/** Novo: Status da poupança */
export interface SavingsStatusInfo {
  rate: number
  level: 'crítico' | 'baixo' | 'moderado' | 'saudável' | 'forte'
  label: string
  suggestion: string
}

/** Novo: Compromisso com investimentos */
export interface InvestmentCommitmentInfo {
  ratio: number
  isAdequate: boolean
  suggestion: string
}

export interface StructuredInsights {
  criticalAlert: {
    text: string
    iconId: string
    severity: 'danger' | 'warning' | 'success'
  } | null
  subscriptions: SubscriptionInfo[]
  /** Assinaturas não-essenciais que poderiam ser cortadas (subset de subscriptions) */
  cuttableSubscriptions: SubscriptionInfo[]
  /** Economia total se cortar todas as não-essenciais */
  totalCuttableSavingsMonthly: number
  savingsChallenges: SavingsChallenge[]
  limitSuggestions: LimitSuggestion[]
  totalSubscriptionsAnnual: number
  totalPotentialSavings: number
  /** Novos insights */
  incomeConcentration: IncomeConcentrationInfo | null
  expenseTrend: ExpenseTrendInfo | null
  weekendSpending: WeekendSpendingInfo | null
  topCategory: TopCategoryInfo | null
  savingsStatus: SavingsStatusInfo | null
  investmentCommitment: InvestmentCommitmentInfo | null
}

export interface AnalysisInput {
  currentMonth: string
  totalIncomes: number
  totalExpenses: number
  totalInvestments: number
  savingsRate: number
  categoryExpenseSummaries: CategoryExpenseSummary[]
  previousMonthExpenseTotal: number
  weekdayExpenseData: WeekdayExpense[]
  limitsExceededCount: number
  incomeByCategory: IncomeCategorySummary[]
  spendingPace: SpendingPaceInfo | null
  spendingProjection: SpendingProjectionInfo | null
  balance: number
  expenses: Expense[]
  previousMonthExpenses: Expense[]
  /**
   * Despesas de meses anteriores adicionais (mês -2, -3, etc.)
   * Usado para melhorar a detecção de assinaturas com mais histórico.
   */
  additionalPreviousMonthExpenses?: Expense[][]
  categories: { id: string; name: string }[]
  expensesWithLimit: { categoryId: string; spent: number; limit: number | null; name: string }[]
  expensesCount: number
  incomesCount: number
}

/* ------------------------------------------------------------------ */
/*  Subscription Detection                                            */
/* ------------------------------------------------------------------ */

/** Categorias consideradas essenciais — não sugerimos corte */
const ESSENTIAL_CATEGORIES = [
  'moradia', 'aluguel', 'condomínio', 'água', 'luz', 'energia', 'gás',
  'internet', 'telefone', 'plano de saúde', 'saúde', 'seguro', 'seguro de vida',
  'educação', 'escola', 'faculdade', 'mensalidade',
  'transporte público', 'ônibus', 'metrô', 'supermercado', 'mercado',
  'farmácia', 'remédio', 'medicamento',
]

/** Categorias discricionárias — podem ser reduzidas */
const DISCRETIONARY_CATEGORIES = [
  'streaming', 'netflix', 'spotify', 'prime', 'disney', 'hbo', 'apple tv',
  'aplicativos', 'app', 'icloud', 'google', 'drive',
  'academia', 'ginástica', 'esporte',
  'assinatura', 'membership', 'clube',
]

/** Categorias de alto potencial de corte — delivery, lazer, compras */
const CUTTABLE_CATEGORIES = [
  'delivery', 'ifood', 'uber eat', 'restaurante', 'alimentação fora',
  'lazer', 'entretenimento', 'cinema', 'shopping', 'compras',
  'café', 'cafeteria', 'sobremesa', 'sorvete',
  'bar', 'balada', 'happy hour',
  'uber', 'taxi', 'transporte por app',
  'games', 'jogos', 'passatempo',
  'presente', 'lembrança',
  'cabelo', 'estética', 'beleza',
  'pet', 'animal', 'veterinário',
  'livro', 'amazon', 'kindle',
]

/**
 * Classifica uma assinatura em tiers baseado na categoria e valor.
 */
function classifySubscription(categoryName: string, monthlyAmount: number): {
  tier: SubscriptionTier
  savingsIfCut: number
  tierReason: string
} {
  const cat = categoryName.toLowerCase()

  // Essencial: contas fixas, saúde, educação
  if (ESSENTIAL_CATEGORIES.some((e) => cat.includes(e))) {
    return {
      tier: 'essential',
      savingsIfCut: 0,
      tierReason: 'Gasto essencial — não recomendamos corte',
    }
  }

  // Discricionário: streaming, apps, academia
  if (DISCRETIONARY_CATEGORIES.some((d) => cat.includes(d))) {
    // Streaming abaixo de R$50 é discricionário barato
    if (monthlyAmount < 50) {
      return {
        tier: 'discretionary',
        savingsIfCut: monthlyAmount,
        tierReason: 'Assinatura opcional de baixo valor — avalie se realmente usa',
      }
    }
    return {
      tier: 'can_cut',
      savingsIfCut: monthlyAmount,
      tierReason: 'Assinatura opcional com custo significativo — considere cancelar',
    }
  }

  // Alto potencial de corte: delivery, lazer, compras
  if (CUTTABLE_CATEGORIES.some((c) => cat.includes(c))) {
    return {
      tier: 'can_cut',
      savingsIfCut: monthlyAmount,
      tierReason: 'Gasto não essencial com alto potencial de economia',
    }
  }

  // Categoria não classificada — assume discricionário
  // Se for valor alto (>R$100), sugere corte; senão, apenas discricionário
  if (monthlyAmount > 100) {
    return {
      tier: 'can_cut',
      savingsIfCut: monthlyAmount,
      tierReason: 'Gasto recorrente significativo em categoria não essencial',
    }
  }

  return {
    tier: 'discretionary',
    savingsIfCut: monthlyAmount * 0.5, // 50% pode ser reduzido
    tierReason: 'Gasto opcional — reduzir pode liberar orçamento',
  }
}

/**
 * Detecta assinaturas comparando despesas do mês atual com os anteriores.
 * Agrupa por descrição normalizada e valores aproximados.
 * 
 * Suporta múltiplos meses históricos (via additionalPreviousMonthExpenses)
 * para aumentar a confiança da detecção e precisão do monthsFound.
 */
function detectSubscriptions(
  currentExpenses: Expense[],
  previousExpenses: Expense[],
  additionalPreviousMonths?: Expense[][],
): SubscriptionInfo[] {
  const subscriptions: SubscriptionInfo[] = []
  const matchedKeys = new Set<string>()

  // Normaliza descrição para comparação
  const normalize = (desc: string) =>
    desc.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '').trim()

  // Filtra despesas parceladas — parcelas não são assinaturas
  const filterInstallments = (exps: Expense[]) =>
    exps.filter(e => !e.installment_group_id)

  // Monta lista de todos os meses históricos para análise
  const historicalMonths: Expense[][] = [filterInstallments(previousExpenses)]
  if (additionalPreviousMonths) {
    for (const monthExpenses of additionalPreviousMonths) {
      historicalMonths.push(filterInstallments(monthExpenses))
    }
  }

  const validCurrent = filterInstallments(currentExpenses)

  // Agrupa despesas atuais por descrição normalizada
  const currentGrouped = new Map<string, { desc: string; total: number; cat: string; catId?: string }[]>()
  for (const exp of validCurrent) {
    if (!exp.description) continue
    const key = normalize(exp.description)
    if (!currentGrouped.has(key)) currentGrouped.set(key, [])
    currentGrouped.get(key)!.push({
      desc: exp.description,
      total: exp.amount * (exp.report_weight ?? 1),
      cat: exp.category?.name || 'Sem categoria',
      catId: exp.category?.id || exp.category_id,
    })
  }

  // Para cada despesa do mês atual, verifica em quantos meses históricos ela aparece
  for (const [key, currentItems] of currentGrouped) {
    if (matchedKeys.has(key)) continue

    const currentTotal = currentItems.reduce((s, i) => s + i.total, 0)
    if (currentTotal <= 0) continue

    // Verifica em quantos meses históricos a despesa aparece com valor similar
    let monthsWithMatch = 0
    let totalHistoricalAmount = 0

    for (const monthExpenses of historicalMonths) {
      const grouped = new Map<string, { total: number }[]>()
      for (const exp of monthExpenses) {
        if (!exp.description) continue
        const k = normalize(exp.description)
        if (!grouped.has(k)) grouped.set(k, [])
        grouped.get(k)!.push({ total: exp.amount * (exp.report_weight ?? 1) })
      }

      const historicalItems = grouped.get(key)
      if (!historicalItems || historicalItems.length === 0) continue

      const historicalTotal = historicalItems.reduce((s, i) => s + i.total, 0)
      if (historicalTotal <= 0) continue

      // Verifica variação máxima de 30%
      const maxVal = Math.max(currentTotal, historicalTotal)
      const minVal = Math.min(currentTotal, historicalTotal)
      const ratio = maxVal / minVal

      if (ratio <= 1.3) {
        monthsWithMatch++
        totalHistoricalAmount += historicalTotal
      }
    }

    // Só considera assinatura se apareceu em pelo menos 1 mês histórico
    if (monthsWithMatch === 0) continue

    // total de meses = mês atual + meses históricos com match
    const totalMonthsFound = 1 + monthsWithMatch

    // Média ponderada entre mês atual e meses históricos
    const avgHistorical = monthsWithMatch > 0 ? totalHistoricalAmount / monthsWithMatch : 0
    const monthlyAmount = Math.round((currentTotal + avgHistorical) / 2 * 100) / 100

    // Confiança baseada em quantos meses a assinatura apareceu
    // e na consistência dos valores
    const totalRatio = Math.max(currentTotal, avgHistorical) / Math.max(Math.min(currentTotal, avgHistorical), 0.01)
    const variance = Math.max(0, totalRatio - 1)
    const monthsBonus = Math.min(1, (totalMonthsFound - 1) / 3) // +0 a +0.33 para 2-4 meses
    const confidence = Math.round(Math.max(0, Math.min(1, (1 - variance * 1.5) + monthsBonus * 0.3)) * 100) / 100

    // Classificação inteligente
    const classification = classifySubscription(currentItems[0].cat, monthlyAmount)

    // Verifica se usuário já ignorou
    const isIgnored = isSubscriptionIgnored(currentItems[0].desc)

    subscriptions.push({
      description: currentItems[0].desc,
      categoryName: currentItems[0].cat,
      monthlyAmount,
      annualAmount: Math.round(monthlyAmount * 12 * 100) / 100,
      monthsFound: totalMonthsFound,
      categoryId: currentItems[0].catId,
      confidence,
      tier: classification.tier,
      savingsIfCut: classification.savingsIfCut,
      tierReason: classification.tierReason,
      isIgnored,
    })
    matchedKeys.add(key)
  }

  // Ordena: não-ignorados primeiro, depois por valor mensal (maior primeiro)
  return subscriptions.sort((a, b) => {
    if (a.isIgnored !== b.isIgnored) return a.isIgnored ? 1 : -1
    return b.monthlyAmount - a.monthlyAmount
  })
}

/* ------------------------------------------------------------------ */
/*  Savings Challenges                                                 */
/* ------------------------------------------------------------------ */

const HIGH_SPEND_CATEGORIES = [
  'delivery', 'ifood', 'restaurante', 'uber eat', 'alimentação fora',
  'lazer', 'entretenimento', 'cinema', 'shopping', 'compras',
  'streaming', 'assinaturas', 'aplicativos',
  'cabelo', 'estética', 'beleza',
  'bar', 'balada', 'happy hour',
  'café', 'cafeteria', 'sobremesa', 'sorvete',
  'uber', 'taxi', 'transporte por app',
  'games', 'jogos', 'passatempo',
  'pet', 'animal', 'veterinário',
  'presente', 'lembrança',
  'livro', 'amazon', 'kindle',
]

/**
 * Gera desafios de economia baseados nos padrões de gasto do usuário.
 * Refinado: mais categorias, mínimo dinâmico baseado na renda.
 */
function generateSavingsChallenges(
  categoryExpenses: CategoryExpenseSummary[],
  totalExpenses: number,
  totalIncomes: number,
): SavingsChallenge[] {
  const challenges: SavingsChallenge[] = []

  // Limite mínimo dinâmico: 0.5% da renda ou R$20 (o que for maior)
  const minSavingsThreshold = totalIncomes > 0 ? Math.max(20, totalIncomes * 0.005) : 20

  // 1. Desafio por categoria de alto gasto
  for (const cat of categoryExpenses) {
    const catName = cat.category_name.toLowerCase()
    const isHighSpend = HIGH_SPEND_CATEGORIES.some(h => catName.includes(h))

    if (!isHighSpend || cat.total <= 0) continue

    const reductionPcts = [10, 20, 30]
    for (const pct of reductionPcts) {
      const savings = Math.round(cat.total * pct / 100 * 100) / 100
      if (savings < minSavingsThreshold) continue // Mínimo dinâmico

      const difficulty = pct <= 10 ? 'fácil' as const : pct <= 20 ? 'médio' as const : 'desafiador' as const

      const annualSavings = Math.round(savings * 12 * 100) / 100
      challenges.push({
        id: `challenge-${cat.category_name}-${pct}`,
        title: `Reduza ${pct}% em ${cat.category_name}`,
        description: `Cortar ${pct}% dos gastos com ${cat.category_name} economiza ${formatCurrency(savings)} por mês (${formatCurrency(annualSavings)}/ano).`,
        potentialSavings: savings,
        annualProjectedSavings: annualSavings,
        categoryName: cat.category_name,
        currentSpending: cat.total,
        reductionPercent: pct,
        difficulty,
        action: 'set_limit',
        path: '/categories',
      })
    }
  }

  // 2. Desafio de meta de poupança
  const nonEssentialTotal = categoryExpenses
    .filter(c => HIGH_SPEND_CATEGORIES.some(h => c.category_name.toLowerCase().includes(h)))
    .reduce((s, c) => s + c.total, 0)

  if (nonEssentialTotal > 0 && totalExpenses > 0) {
    const savings30 = Math.round(nonEssentialTotal * 0.3 * 100) / 100
    if (savings30 >= minSavingsThreshold) {
      const annualSavings30 = Math.round(savings30 * 12 * 100) / 100
      challenges.push({
        id: 'challenge-non-essential-30',
        title: 'Desafio 30% em não essenciais',
        description: `Reduza 30% dos gastos não essenciais (${formatCurrency(nonEssentialTotal)}) e economize ${formatCurrency(savings30)}/mês. Revise suas assinaturas, delivery e lazer.`,
        potentialSavings: savings30,
        annualProjectedSavings: annualSavings30,
        categoryName: 'Não essenciais',
        currentSpending: nonEssentialTotal,
        reductionPercent: 30,
        difficulty: 'médio',
        action: 'navigate',
        path: '/expenses',
      })
    }
  }

  return challenges.slice(0, 4) // Max 4 challenges
}

/* ------------------------------------------------------------------ */
/*  Limit Suggestions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Gera sugestões de ajuste de limites baseado nos gastos atuais.
 * Refinado: sugere CRIAR limite para categorias sem limite mas com gasto significativo.
 */
function generateLimitSuggestions(
  expensesWithLimit: { categoryId: string; spent: number; limit: number | null; name: string }[],
): LimitSuggestion[] {
  const suggestions: LimitSuggestion[] = []

  for (const item of expensesWithLimit) {
    if (!item.limit || item.limit <= 0) continue

    // Categorias estourando: sugere aumento
    if (item.spent > item.limit) {
      const excess = Math.round((item.spent - item.limit) * 100) / 100
      const increase = Math.max(excess, Math.round(item.limit * 0.15 * 100) / 100)

      suggestions.push({
        categoryId: item.categoryId,
        categoryName: item.name,
        currentSpent: item.spent,
        currentLimit: item.limit,
        suggestedLimit: Math.round((item.limit + increase) * 100) / 100,
        difference: increase,
        type: 'increase',
        reason: `Gastou ${formatCurrency(excess)} acima do limite de ${formatCurrency(item.limit)}. Sugerimos ${formatCurrency(Math.round((item.limit + increase) * 100) / 100)} para cobrir.`,
      })
    }

    // Categorias com sobra: sugere redução
    if (item.spent < item.limit * 0.5 && item.limit - item.spent > 50) {
      const surplus = Math.round((item.limit - item.spent) * 100) / 100
      const suggested = Math.round((item.spent + surplus * 0.3) * 100) / 100 // mantém 30% de margem

      suggestions.push({
        categoryId: item.categoryId,
        categoryName: item.name,
        currentSpent: item.spent,
        currentLimit: item.limit,
        suggestedLimit: Math.round(Math.max(suggested, item.spent * 1.2) * 100) / 100,
        difference: Math.round((item.limit - suggested) * 100) / 100,
        type: 'decrease',
        reason: `Usou apenas ${formatNumberWithTwoDecimalsBR((item.spent / item.limit) * 100)}% do limite de ${formatCurrency(item.limit)}. Pode reduzir para ${formatCurrency(Math.round(Math.max(suggested, item.spent * 1.2) * 100) / 100)} e realocar.`,
      })
    }
  }

  return suggestions.slice(0, 3) // Max 3 sugestões
}

/* ------------------------------------------------------------------ */
/*  Critical Alert                                                     */
/* ------------------------------------------------------------------ */

function getCriticalAlert(input: AnalysisInput): StructuredInsights['criticalAlert'] {
  const { limitsExceededCount, spendingPace, spendingProjection, totalIncomes, totalExpenses, savingsRate } = input

  // Highest priority: negative savings
  if (totalIncomes > 0 && savingsRate <= 0) {
    return {
      text: `Saldo negativo de ${formatNumberWithTwoDecimalsBR(Math.abs(savingsRate))}% — despesas superam receitas!`,
      iconId: 'alert-triangle-expense',
      severity: 'danger',
    }
  }

  // Spending pace alert
  if (spendingPace && spendingPace.isOverBudget && spendingPace.overPct > 5) {
    return {
      text: `Ritmo de gastos ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do esperado para o período`,
      iconId: 'alert-triangle-expense',
      severity: 'danger',
    }
  }

  // Limits exceeded
  if (limitsExceededCount > 0) {
    return {
      text: `${limitsExceededCount} ${limitsExceededCount === 1 ? 'categoria' : 'categorias'} com limite estourado`,
      iconId: 'alert-triangle-expense',
      severity: 'warning',
    }
  }

  // Burn rate high
  if (totalIncomes > 0) {
    const burnRate = (totalExpenses / totalIncomes) * 100
    if (burnRate > 85) {
      return {
        text: `${formatNumberWithTwoDecimalsBR(burnRate)}% da renda consumida por despesas — margem apertada`,
        iconId: 'trending-up-expense',
        severity: 'warning',
      }
    }
  }

  // End-of-month deficit projection
  if (spendingProjection && spendingProjection.currentDay >= 10 && !spendingProjection.onTrack) {
    return {
      text: `Déficit projetado de ${formatCurrency(Math.abs(spendingProjection.projectedSurplus))} no fim do mês`,
      iconId: 'trending-up-expense',
      severity: 'danger',
    }
  }

  // All good — positive feedback
  if (totalIncomes > 0 && savingsRate >= 20) {
    return {
      text: `Poupando ${formatNumberWithTwoDecimalsBR(savingsRate)}% da renda — excelente controle financeiro!`,
      iconId: 'check-circle-income',
      severity: 'success',
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/*  NEW: Income Concentration                                          */
/* ------------------------------------------------------------------ */

/**
 * Analisa se a renda está muito concentrada em uma única fonte.
 */
function getIncomeConcentration(
  incomeByCategory: IncomeCategorySummary[],
  totalIncomes: number,
): IncomeConcentrationInfo | null {
  if (incomeByCategory.length === 0 || totalIncomes <= 0) return null

  const topSource = incomeByCategory[0] // Já ordenado do maior para o menor
  const percentage = (topSource.total / totalIncomes) * 100

  if (percentage > 60) {
    return {
      isConcentrated: true,
      topSourceName: topSource.name,
      topSourcePercentage: Math.round(percentage * 100) / 100,
      topSourceAmount: topSource.total,
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/*  NEW: Expense Trend vs Previous Month                               */
/* ------------------------------------------------------------------ */

/**
 * Calcula a variação percentual dos gastos em relação ao mês anterior.
 */
function getExpenseTrend(
  totalExpenses: number,
  previousMonthExpenseTotal: number,
): ExpenseTrendInfo | null {
  if (totalExpenses <= 0 || previousMonthExpenseTotal <= 0) return null

  const change = totalExpenses - previousMonthExpenseTotal
  const percentageChange = (change / previousMonthExpenseTotal) * 100
  const isIncrease = change > 0
  const isSignificant = Math.abs(percentageChange) > 15

  return {
    percentageChange: Math.round(percentageChange * 100) / 100,
    isIncrease,
    absoluteChange: Math.round(Math.abs(change) * 100) / 100,
    isSignificant,
  }
}

/* ------------------------------------------------------------------ */
/*  NEW: Weekend Spending Analysis                                     */
/* ------------------------------------------------------------------ */

/**
 * Compara gastos de fim de semana vs dias úteis.
 */
function getWeekendSpending(
  weekdayExpenseData: WeekdayExpense[],
): WeekendSpendingInfo | null {
  if (weekdayExpenseData.length < 7) return null

  // Dias úteis: Seg-Sex (índices 0-4)
  // Fim de semana: Sáb-Dom (índices 5-6)
  const weekdays = weekdayExpenseData.slice(0, 5)
  const weekends = weekdayExpenseData.slice(5, 7)

  const weekdayAvg = weekdays.reduce((s, d) => s + d.Despesas, 0) / weekdays.length
  const weekendAvg = weekends.reduce((s, d) => s + d.Despesas, 0) / weekends.length

  if (weekdayAvg <= 0 && weekendAvg <= 0) return null

  const ratio = weekdayAvg > 0 ? weekendAvg / weekdayAvg : weekendAvg > 0 ? 99 : 1

  return {
    weekendAvg: Math.round(weekendAvg * 100) / 100,
    weekdayAvg: Math.round(weekdayAvg * 100) / 100,
    ratio: Math.round(ratio * 100) / 100,
    isHigherOnWeekends: ratio > 1.5,
  }
}

/* ------------------------------------------------------------------ */
/*  NEW: Top Category Highlight                                        */
/* ------------------------------------------------------------------ */

/**
 * Destaca a categoria com maior gasto e sua participação no total.
 */
function getTopCategory(
  categoryExpenseSummaries: CategoryExpenseSummary[],
  totalExpenses: number,
): TopCategoryInfo | null {
  if (categoryExpenseSummaries.length === 0 || totalExpenses <= 0) return null

  const top = categoryExpenseSummaries[0] // Já ordenado
  const percentage = (top.total / totalExpenses) * 100

  return {
    name: top.category_name,
    total: top.total,
    percentageOfTotal: Math.round(percentage * 100) / 100,
  }
}

/* ------------------------------------------------------------------ */
/*  NEW: Savings Status Classification                                 */
/* ------------------------------------------------------------------ */

/**
 * Classifica qualitativamente a taxa de poupança do usuário.
 */
function getSavingsStatus(savingsRate: number, totalIncomes: number): SavingsStatusInfo | null {
  if (totalIncomes <= 0) return null

  let level: SavingsStatusInfo['level']
  let label: string
  let suggestion: string

  if (savingsRate <= 0) {
    level = 'crítico'
    label = 'Crítico — gastando mais do que ganha'
    suggestion = 'Revise suas despesas fixas e busque cortar gastos não essenciais imediatamente.'
  } else if (savingsRate < 5) {
    level = 'baixo'
    label = 'Baixo — margem muito apertada'
    suggestion = 'Tente reduzir pequenas despesas diárias. Cada R$10 economizado faz diferença.'
  } else if (savingsRate < 15) {
    level = 'moderado'
    label = 'Moderado — boa margem, mas pode melhorar'
    suggestion = 'Aumente sua taxa para 20% definindo limites mais rigorosos em categorias não essenciais.'
  } else if (savingsRate < 25) {
    level = 'saudável'
    label = 'Saudável — ótimo controle financeiro'
    suggestion = 'Considere direcionar parte da poupança para investimentos de longo prazo.'
  } else {
    level = 'forte'
    label = 'Forte — excelente disciplina financeira'
    suggestion = 'Continue assim! Avalie se seus investimentos estão diversificados adequadamente.'
  }

  return { rate: savingsRate, level, label, suggestion }
}

/* ------------------------------------------------------------------ */
/*  NEW: Investment Commitment                                         */
/* ------------------------------------------------------------------ */

/**
 * Avalia o compromisso com investimentos baseado na % da renda investida.
 */
function getInvestmentCommitment(
  totalInvestments: number,
  totalIncomes: number,
): InvestmentCommitmentInfo | null {
  if (totalIncomes <= 0) return null

  const ratio = (totalInvestments / totalIncomes) * 100

  let suggestion: string
  let isAdequate: boolean

  if (ratio >= 15) {
    isAdequate = true
    suggestion = `Ótimo! ${formatNumberWithTwoDecimalsBR(ratio)}% da renda investida — mantenha este ritmo.`
  } else if (ratio >= 5) {
    isAdequate = true
    suggestion = `${formatNumberWithTwoDecimalsBR(ratio)}% investido. Tente chegar a pelo menos 15% para acelerar o crescimento patrimonial.`
  } else if (ratio > 0) {
    isAdequate = false
    suggestion = `Apenas ${formatNumberWithTwoDecimalsBR(ratio)}% da renda investida. A meta recomendada é de 15-20% para construir patrimônio sólido.`
  } else {
    isAdequate = false
    suggestion = 'Nenhum investimento registrado este mês. Considere aportar pelo menos 10% da renda para começar.'
  }

  return { ratio: Math.round(ratio * 100) / 100, isAdequate, suggestion }
}

/* ------------------------------------------------------------------ */
/*  Main Engine                                                        */
/* ------------------------------------------------------------------ */

/**
 * Gera todos os insights estruturados do dashboard.
 * Combina análise existente com 6 novos cards de insights financeiros.
 */
export function computeStructuredInsights(input: AnalysisInput): StructuredInsights {
  const {
    categoryExpenseSummaries,
    expenses,
    previousMonthExpenses,
    expensesWithLimit,
    incomeByCategory,
    weekdayExpenseData,
    totalIncomes,
    totalExpenses,
    totalInvestments,
    previousMonthExpenseTotal,
    savingsRate,
  } = input

  // 1. Critical alert
  const criticalAlert = getCriticalAlert(input)

  // 2. Subscriptions (com suporte a múltiplos meses históricos)
  const subscriptions = detectSubscriptions(
    expenses,
    previousMonthExpenses,
    input.additionalPreviousMonthExpenses,
  )
  const totalSubscriptionsAnnual = subscriptions.reduce((s, sub) => s + sub.annualAmount, 0)

  // 2b. Cuttable subscriptions (não-essenciais, não ignoradas)
  const cuttableSubscriptions = subscriptions.filter(
    (sub) => sub.tier !== 'essential' && !sub.isIgnored
  )
  const totalCuttableSavingsMonthly = Math.round(
    cuttableSubscriptions.reduce((s, sub) => s + sub.savingsIfCut, 0) * 100
  ) / 100

  // 3. Savings challenges
  const savingsChallenges = generateSavingsChallenges(categoryExpenseSummaries, totalExpenses, totalIncomes)

  // 4. Limit suggestions
  const limitSuggestions = generateLimitSuggestions(expensesWithLimit)

  // 5. Income concentration
  const incomeConcentration = getIncomeConcentration(incomeByCategory, totalIncomes)

  // 6. Expense trend vs last month
  const expenseTrend = getExpenseTrend(totalExpenses, previousMonthExpenseTotal)

  // 7. Weekend spending pattern
  const weekendSpending = getWeekendSpending(weekdayExpenseData)

  // 8. Top category highlight
  const topCategory = getTopCategory(categoryExpenseSummaries, totalExpenses)

  // 9. Savings status
  const savingsStatus = getSavingsStatus(savingsRate, totalIncomes)

  // 10. Investment commitment
  const investmentCommitment = getInvestmentCommitment(totalInvestments, totalIncomes)

  const totalPotentialSavings = savingsChallenges.reduce((s, c) => s + c.potentialSavings, 0)

  return {
    criticalAlert,
    subscriptions,
    cuttableSubscriptions,
    totalCuttableSavingsMonthly,
    savingsChallenges,
    limitSuggestions,
    totalSubscriptionsAnnual,
    totalPotentialSavings,
    incomeConcentration,
    expenseTrend,
    weekendSpending,
    topCategory,
    savingsStatus,
    investmentCommitment,
  }
}
