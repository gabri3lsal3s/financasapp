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

  // Agrupa despesas atuais por descrição normalizada
  const currentGrouped = new Map<string, { desc: string; total: number; cat: string; catId?: string }[]>()
  for (const exp of currentExpenses) {
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
  for (const exp of previousExpenses) {
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
]

/**
 * Gera desafios de economia baseados nos padrões de gasto do usuário.
 */
function generateSavingsChallenges(
  categoryExpenses: CategoryExpenseSummary[],
  totalExpenses: number,
): SavingsChallenge[] {
  const challenges: SavingsChallenge[] = []

  // 1. Desafio por categoria de alto gasto
  for (const cat of categoryExpenses) {
    const catName = cat.category_name.toLowerCase()
    const isHighSpend = HIGH_SPEND_CATEGORIES.some(h => catName.includes(h))

    if (!isHighSpend || cat.total <= 0) continue

    const reductionPcts = [10, 20]
    for (const pct of reductionPcts) {
      const savings = Math.round(cat.total * pct / 100 * 100) / 100
      if (savings < 20) continue // Ignora valores muito baixos

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
    if (savings30 >= 50) {
      challenges.push({
        id: 'challenge-non-essential-30',
        title: 'Desafio 30% em não essenciais',
        description: `Reduza 30% dos gastos não essenciais (${formatCurrency(nonEssentialTotal)}) e economize ${formatCurrency(savings30)}/mês. Revira suas assinaturas, delivery e lazer.`,
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

  // 3. Se há projeção de déficit, sugere desafio de corte
  // (feito externamente via spendingProjection)

  return challenges.slice(0, 4) // Max 4 challenges
}

/* ------------------------------------------------------------------ */
/*  Limit Suggestions                                                  */
/* ------------------------------------------------------------------ */

/**
 * Gera sugestões de ajuste de limites baseado nos gastos atuais.
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
        reason: `Gastou ${formatCurrency(excess)} acima do limite. Considere aumentar o limite ou reduzir gastos.`,
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
        reason: `Usou apenas ${formatNumberWithTwoDecimalsBR((item.spent / item.limit) * 100)}% do limite. Pode reduzir e realocar para outras categorias.`,
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
      text: `Ritmo de gastos ${formatNumberWithTwoDecimalsBR(spendingPace.overPct)}% acima do esperado`,
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
        text: `${formatNumberWithTwoDecimalsBR(burnRate)}% da renda consumida por despesas`,
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

  // All good
  if (totalIncomes > 0 && savingsRate >= 20) {
    return {
      text: `Poupando ${formatNumberWithTwoDecimalsBR(savingsRate)}% da renda — excelente controle!`,
      iconId: 'check-circle-income',
      severity: 'success',
    }
  }

  return null
}

/* ------------------------------------------------------------------ */
/*  Main Engine                                                        */
/* ------------------------------------------------------------------ */

/**
 * Gera todos os insights estruturados do dashboard.
 * Substitui `generateDynamicSuggestions` + `buildLocalAnalysis`.
 */
export function computeStructuredInsights(input: AnalysisInput): StructuredInsights {
  const {
    categoryExpenseSummaries,
    expenses,
    previousMonthExpenses,
    expensesWithLimit,
  } = input

  // 1. Critical alert
  const criticalAlert = getCriticalAlert(input)

  // 2. Subscriptions
  const subscriptions = detectSubscriptions(expenses, previousMonthExpenses)
  const totalSubscriptionsAnnual = subscriptions.reduce((s, sub) => s + sub.annualAmount, 0)

  // 3. Savings challenges
  const savingsChallenges = generateSavingsChallenges(categoryExpenseSummaries, input.totalExpenses)

  // 4. Limit suggestions
  const limitSuggestions = generateLimitSuggestions(expensesWithLimit)

  const totalPotentialSavings = savingsChallenges.reduce((s, c) => s + c.potentialSavings, 0)

  return {
    criticalAlert,
    subscriptions,
    savingsChallenges,
    limitSuggestions,
    totalSubscriptionsAnnual,
    totalPotentialSavings,
  }
}
