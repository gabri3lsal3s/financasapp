import { formatCurrency, formatNumberWithTwoDecimalsBR } from '@/utils/format'
import type { Expense } from '@/types'

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

export interface SubscriptionInfo {
  description: string
  categoryName: string
  monthlyAmount: number
  annualAmount: number
  monthsFound: number
  categoryId?: string
}

export interface SavingsChallenge {
  id: string
  title: string
  description: string
  potentialSavings: number
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
  categories: { id: string; name: string }[]
  expensesWithLimit: { categoryId: string; spent: number; limit: number | null; name: string }[]
  expensesCount: number
  incomesCount: number
}

/* ------------------------------------------------------------------ */
/*  Subscription Detection                                            */
/* ------------------------------------------------------------------ */

/**
 * Detecta assinaturas comparando despesas do mês atual com o anterior.
 * Agrupa por descrição normalizada e valores aproximados.
 * Refinado: filtra parcelas (installment_group_id) para não falsificar detecção.
 */
function detectSubscriptions(
  currentExpenses: Expense[],
  previousExpenses: Expense[],
): SubscriptionInfo[] {
  const subscriptions: SubscriptionInfo[] = []
  const matchedKeys = new Set<string>()

  // Normaliza descrição para comparação
  const normalize = (desc: string) =>
    desc.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '').trim()

  // Filtra despesas parceladas — parcelas não são assinaturas
  const filterInstallments = (exps: Expense[]) =>
    exps.filter(e => !e.installment_group_id)

  const validCurrent = filterInstallments(currentExpenses)
  const validPrevious = filterInstallments(previousExpenses)

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

  // Agrupa despesas anteriores por descrição normalizada
  const prevGrouped = new Map<string, { desc: string; total: number }[]>()
  for (const exp of validPrevious) {
    if (!exp.description) continue
    const key = normalize(exp.description)
    if (!prevGrouped.has(key)) prevGrouped.set(key, [])
    prevGrouped.get(key)!.push({
      desc: exp.description,
      total: exp.amount * (exp.report_weight ?? 1),
    })
  }

  // Compara: mesma descrição aparece em ambos os meses com valor similar
  for (const [key, currentItems] of currentGrouped) {
    if (matchedKeys.has(key)) continue
    const prevItems = prevGrouped.get(key)
    if (!prevItems || prevItems.length === 0) continue

    // Soma valores de cada mês
    const currentTotal = currentItems.reduce((s, i) => s + i.total, 0)
    const prevTotal = prevItems.reduce((s, i) => s + i.total, 0)

    if (currentTotal <= 0 || prevTotal <= 0) continue

    // Verifica se os valores são próximos (variação máxima de 30%)
    const ratio = Math.max(currentTotal, prevTotal) / Math.min(currentTotal, prevTotal)
    if (ratio <= 1.3) {
      const monthsFound = 2 // atual + anterior
      subscriptions.push({
        description: currentItems[0].desc,
        categoryName: currentItems[0].cat,
        monthlyAmount: Math.round((currentTotal + prevTotal) / 2 * 100) / 100,
        annualAmount: Math.round(Math.round((currentTotal + prevTotal) / 2 * 100) / 100 * 12 * 100) / 100,
        monthsFound,
        categoryId: currentItems[0].catId,
      })
      matchedKeys.add(key)
    }
  }

  // Ordena por valor mensal (maior primeiro)
  return subscriptions.sort((a, b) => b.monthlyAmount - a.monthlyAmount)
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

      challenges.push({
        id: `challenge-${cat.category_name}-${pct}`,
        title: `Reduza ${pct}% em ${cat.category_name}`,
        description: `Cortar ${pct}% dos gastos com ${cat.category_name} economiza ${formatCurrency(savings)} por mês (${formatCurrency(savings * 12)}/ano).`,
        potentialSavings: savings,
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
      challenges.push({
        id: 'challenge-non-essential-30',
        title: 'Desafio 30% em não essenciais',
        description: `Reduza 30% dos gastos não essenciais (${formatCurrency(nonEssentialTotal)}) e economize ${formatCurrency(savings30)}/mês. Revise suas assinaturas, delivery e lazer.`,
        potentialSavings: savings30,
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

  // 2. Subscriptions
  const subscriptions = detectSubscriptions(expenses, previousMonthExpenses)
  const totalSubscriptionsAnnual = subscriptions.reduce((s, sub) => s + sub.annualAmount, 0)

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
