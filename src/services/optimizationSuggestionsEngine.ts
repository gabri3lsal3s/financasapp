/**
 * Motor de Sugestões de Otimização
 *
 * Combina dados do insightsEngine + budgetLimits + assinaturas para gerar
 * ações contextuais úteis para o usuário gerenciar suas economias
 * no mês atual e projeções anuais.
 */

import { formatCurrency } from '@/utils/format'
import type {
  StructuredInsights,
} from './insightsEngine'

/* ------------------------------------------------------------------ */
/*  Tipos de Sugestão                                                  */
/* ------------------------------------------------------------------ */

export type SuggestionAction =
  | { type: 'set_limit'; categoryId: string; suggestedAmount: number }
  | { type: 'reallocate'; fromId: string; toId: string; amount: number }
  | { type: 'navigate'; path: string }
  | { type: 'ignore_subscription'; description: string }
  | { type: 'create_limit'; categoryId: string; suggestedAmount: number }

export interface OptimizationSuggestion {
  id: string
  /** Qual categoria/setor a ação se refere */
  categoryName: string
  /** Título curto da ação */
  title: string
  /** Descrição com valores mensais */
  description: string
  /** Economia mensal estimada */
  monthlySavings: number
  /** Economia anual projetada */
  annualProjectedSavings: number
  /** Prioridade (maior = mais importante) */
  priority: number
  /** Ícone Lucide para exibir */
  icon: string
  /** Ação a ser executada */
  action: SuggestionAction
  /** Badge de categoria */
  badge?: {
    text: string
    variant: 'income' | 'expense' | 'warning' | 'info'
  }
}

export interface OptimizationSummary {
  /** Total de economia mensal possível */
  totalMonthlySavings: number
  /** Total de economia anual projetada */
  totalAnnualProjectedSavings: number
  /** Sugestões ordenadas por prioridade */
  suggestions: OptimizationSuggestion[]
  /** Se há alguma ação útil */
  hasActionableSuggestions: boolean
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

export interface OptimizationInput {
  insights: StructuredInsights
  categoriesWithLimit: {
    categoryId: string
    name: string
    spent: number
    limit: number | null
  }[]
  reallocationRecommendation: {
    fromId: string
    fromName: string
    toId: string
    toName: string
    transferAmount: number
  } | null
  totalIncomes: number
  totalExpenses: number
}

/* ------------------------------------------------------------------ */
/*  Engine                                                             */
/* ------------------------------------------------------------------ */

/**
 * Gera sugestões de otimização contextuais combinando insights + limites + assinaturas.
 * Cada sugestão inclui economia mensal e projeção anual.
 * Ordena por prioridade (criticidade) e remove ações sem economia real.
 */
export function generateOptimizationSuggestions(
  input: OptimizationInput,
): OptimizationSummary {
  const suggestions: OptimizationSuggestion[] = []
  const { insights, categoriesWithLimit, reallocationRecommendation, totalIncomes, totalExpenses } = input

  /* ── 1. Assinaturas cortáveis ── */
  for (const sub of insights.cuttableSubscriptions) {
    if (sub.savingsIfCut <= 0) continue
    suggestions.push({
      id: `cut-sub-${normalizeKey(sub.description)}`,
      categoryName: sub.description,
      title: `Cancele ${sub.description}`,
      description: `Economize ${formatCurrency(sub.savingsIfCut)}/mês cancelando ${sub.description}. ${sub.tierReason}.`,
      monthlySavings: sub.savingsIfCut,
      annualProjectedSavings: Math.round(sub.savingsIfCut * 12 * 100) / 100,
      priority: 90 - sub.monthlyAmount, // Mais caro primeiro
      icon: 'CreditCard',
      action: { type: 'ignore_subscription', description: sub.description },
      badge: sub.monthlyAmount > 50
        ? { text: `${formatCurrency(sub.monthlyAmount)}/mês`, variant: 'expense' }
        : { text: `${formatCurrency(sub.savingsIfCut)}/mês`, variant: 'warning' },
    })
  }

  /* ── 2. Desafios de economia (top 1) ── */
  if (insights.savingsChallenges.length > 0) {
    const topChallenge = insights.savingsChallenges[0]
    suggestions.push({
      id: `challenge-${topChallenge.id}`,
      categoryName: topChallenge.categoryName,
      title: topChallenge.title,
      description: `${topChallenge.description.split('.')[0]}.`,
      monthlySavings: topChallenge.potentialSavings,
      annualProjectedSavings: topChallenge.annualProjectedSavings,
      priority: 80,
      icon: 'PiggyBank',
      action: topChallenge.action === 'navigate'
        ? { type: 'navigate', path: topChallenge.path || '/expenses' }
        : { type: 'navigate', path: '/categories' },
      badge: { text: topChallenge.difficulty, variant: 'warning' },
    })
  }

  /* ── 3. Sugestão de aumento de limite (categorias estourando) ── */
  const exceededCategories = categoriesWithLimit.filter(c => c.limit !== null && c.limit > 0 && c.spent > c.limit)
  for (const cat of exceededCategories.slice(0, 2)) {
    const excess = Math.round((cat.spent - (cat.limit || 0)) * 100) / 100
    const suggestedIncrease = Math.max(excess, Math.round((cat.limit || 0) * 0.15 * 100) / 100)
    const newLimit = Math.round(((cat.limit || 0) + suggestedIncrease) * 100) / 100

    suggestions.push({
      id: `increase-limit-${cat.categoryId}`,
      categoryName: cat.name,
      title: `Ajuste limite de ${cat.name}`,
      description: `Gastou ${formatCurrency(excess)} acima do limite. Ajuste para ${formatCurrency(newLimit)} e mantenha o orçamento realista.`,
      monthlySavings: 0, // Não é economia, é realinhamento
      annualProjectedSavings: 0,
      priority: 70,
      icon: 'SlidersHorizontal',
      action: { type: 'set_limit', categoryId: cat.categoryId, suggestedAmount: newLimit },
      badge: { text: `+${formatCurrency(suggestedIncrease)}`, variant: 'expense' },
    })
  }

  /* ── 4. Sugestão de redução de limite (categorias com sobra) ── */
  const surplusCategories = categoriesWithLimit.filter(c =>
    c.limit !== null && c.limit > 0 && c.spent < c.limit * 0.5 && (c.limit || 0) - c.spent > 50
  )
  for (const cat of surplusCategories.slice(0, 2)) {
    const savings = Math.round(((cat.limit || 0) - cat.spent) * 0.5 * 100) / 100
    if (savings < 20) continue

    suggestions.push({
      id: `reduce-limit-${cat.categoryId}`,
      categoryName: cat.name,
      title: `Reduza limite de ${cat.name}`,
      description: `Usa apenas ${Math.round((cat.spent / (cat.limit || 1)) * 100)}% do limite. Reduza e libere ${formatCurrency(savings)}/mês para outras categorias.`,
      monthlySavings: savings,
      annualProjectedSavings: Math.round(savings * 12 * 100) / 100,
      priority: 60,
      icon: 'ArrowDown',
      action: { type: 'set_limit', categoryId: cat.categoryId, suggestedAmount: Math.round((cat.limit || 0) * 0.7 * 100) / 100 },
      badge: { text: `${formatCurrency(savings)}/mês`, variant: 'income' },
    })
  }

  /* ── 5. Remanejamento inteligente ── */
  if (reallocationRecommendation && reallocationRecommendation.transferAmount >= 10) {
    suggestions.push({
      id: 'reallocate-budget',
      categoryName: `${reallocationRecommendation.fromName} → ${reallocationRecommendation.toName}`,
      title: 'Remanejar orçamento',
      description: `Transfira ${formatCurrency(reallocationRecommendation.transferAmount)} de "${reallocationRecommendation.fromName}" para "${reallocationRecommendation.toName}" sem alterar o total.`,
      monthlySavings: 0,
      annualProjectedSavings: 0,
      priority: 50,
      icon: 'ArrowRightLeft',
      action: { type: 'reallocate', fromId: reallocationRecommendation.fromId, toId: reallocationRecommendation.toId, amount: reallocationRecommendation.transferAmount },
      badge: { text: formatCurrency(reallocationRecommendation.transferAmount), variant: 'info' },
    })
  }

  /* ── 6. Gastos de fim de semana elevados ── */
  if (insights.weekendSpending && insights.weekendSpending.isHigherOnWeekends) {
    const potentialSave = Math.round(insights.weekendSpending.weekendAvg * 0.2 * 100) / 100
    if (potentialSave > 20) {
      suggestions.push({
        id: 'reduce-weekend',
        categoryName: 'Fim de Semana',
        title: 'Reduza gastos de fim de semana',
        description: `Gasta ${Math.round(insights.weekendSpending.ratio * 100)}% a mais nos fins de semana. Reduzir 20% economiza ${formatCurrency(potentialSave)}/mês.`,
        monthlySavings: potentialSave,
        annualProjectedSavings: Math.round(potentialSave * 12 * 100) / 100,
        priority: 40,
        icon: 'Coffee',
        action: { type: 'navigate', path: '/expenses' },
        badge: { text: `${formatCurrency(potentialSave)}/mês`, variant: 'warning' },
      })
    }
  }

  /* ── 7. Status da poupança (se for crítico ou baixo) ── */
  if (insights.savingsStatus && (insights.savingsStatus.level === 'crítico' || insights.savingsStatus.level === 'baixo')) {
    // Calcula quanto precisa economizar para sair do vermelho
    const deficit = totalExpenses - totalIncomes
    const targetSave = deficit > 0 ? deficit + Math.round(totalIncomes * 0.05 * 100) / 100 : Math.round(totalIncomes * 0.05 * 100) / 100

    if (targetSave > 0) {
      suggestions.push({
        id: 'savings-goal',
        categoryName: 'Poupança',
        title: `Meta: economizar ${formatCurrency(targetSave)}/mês`,
        description: `${insights.savingsStatus.suggestion} Meta mínima: ${formatCurrency(targetSave)}/mês (${formatCurrency(targetSave * 12)}/ano).`,
        monthlySavings: targetSave,
        annualProjectedSavings: Math.round(targetSave * 12 * 100) / 100,
        priority: 100, // Highest priority
        icon: 'PiggyBank',
        action: { type: 'navigate', path: '/categories' },
        badge: { text: insights.savingsStatus.level, variant: 'expense' },
      })
    }
  }

  /* ── 8. Compromisso com investimentos baixo ── */
  if (insights.investmentCommitment && !insights.investmentCommitment.isAdequate) {
    const targetInvestment = Math.round(totalIncomes * 0.1 * 100) / 100 // 10% da renda
    suggestions.push({
      id: 'investment-goal',
      categoryName: 'Investimentos',
      title: 'Aumente seus investimentos',
      description: `${insights.investmentCommitment.suggestion} Meta: ${formatCurrency(targetInvestment)}/mês (${formatCurrency(targetInvestment * 12)}/ano).`,
      monthlySavings: targetInvestment,
      annualProjectedSavings: Math.round(targetInvestment * 12 * 100) / 100,
      priority: 30,
      icon: 'Landmark',
      action: { type: 'navigate', path: '/investments' },
      badge: { text: `${formatCurrency(targetInvestment)}/mês`, variant: 'info' },
    })
  }

  /* ── Ordena por prioridade (maior primeiro) e limpa duplicatas ── */
  const unique = new Map<string, OptimizationSuggestion>()
  for (const s of suggestions) {
    const key = s.id
    if (!unique.has(key) || s.priority > (unique.get(key)?.priority ?? 0)) {
      unique.set(key, s)
    }
  }

  const sorted = Array.from(unique.values())
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 8) // Max 8 suggestions

  const totalMonthly = Math.round(sorted.reduce((s, sug) => s + sug.monthlySavings, 0) * 100) / 100
  const totalAnnual = Math.round(sorted.reduce((s, sug) => s + sug.annualProjectedSavings, 0) * 100) / 100

  return {
    totalMonthlySavings: totalMonthly,
    totalAnnualProjectedSavings: totalAnnual,
    suggestions: sorted,
    hasActionableSuggestions: sorted.some(s => s.monthlySavings > 0 || s.annualProjectedSavings > 0 || s.action.type !== 'navigate'),
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function normalizeKey(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}
