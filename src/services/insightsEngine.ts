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

/* ------------------------------------------------------------------ */
/*  NEW: Recurring Expense Detection Types                             */
/* ------------------------------------------------------------------ */

export type RecurrenceType = 'subscription' | 'recurring' | 'similar'

/**
 * Despesa recorrente identificada pelo detector inteligente com classificação por sinais.
 * Usa 3 sinais (nome do serviço, valor exato, categoria) para classificar em 3 níveis:
 * - subscription: assinatura verdadeira identificada por nome conhecido, valor exato e/ou
 *   categoria de assinatura. Confiança 0.55-0.95+ conforme quantidade de sinais.
 * - recurring: gasto que se repete mensalmente (mesma descrição, valor varia até 50%).
 *   Confiança 0.40-0.55.
 * - similar: mesma categoria com total mensal similar (descrições diferentes).
 *   Confiança 0.10-0.50.
 */
export interface RecurringExpenseInfo {
  description: string
  categoryName: string
  categoryId?: string
  monthlyAmount: number
  annualAmount: number
  monthsFound: number
  confidence: number
  recurrenceType: RecurrenceType
  /** Se o valor é fixo (ex: Netflix R$55,90) ou variável (ex: supermercado) */
  nature: 'fixed' | 'variable'
  /** Se o usuário já ignorou esta despesa */
  isIgnored: boolean
  /** Percentual da renda comprometido */
  incomePercentage: number
  /** Classificação inteligente (essencial / discricionário / cortável) */
  tier: SubscriptionTier
  /** Quanto economizaria por mês se cortasse (0 para essenciais) */
  savingsIfCut: number
  /** Razão para a classificação */
  tierReason: string
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
  /** Despesas recorrentes detectadas com classificação inteligente (3 níveis) */
  recurringExpenses: RecurringExpenseInfo[]
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
 * Categorias inerentemente agregadoras — somam gastos variáveis.
 * Excluídas da detecção por categoria (Passo 3) porque seus totais
 * mensais similares são coincidência, não recorrência real.
 */
const AGGREGATE_CATEGORIES = [
  'supermercado', 'mercado',
  'combustível', 'gasolina', 'posto',
  'farmácia', 'remédio', 'medicamento', 'drogaria',
  'transporte público', 'ônibus', 'metrô',
  'presente', 'lembrança',
  'cabelo', 'estética', 'beleza', 'salão',
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

/** Nomes de serviços de assinatura conhecidos — usados para boost por nome */
const KNOWN_SUBSCRIPTION_NAMES = [
  // Streaming
  'netflix', 'spotify', 'prime video', 'amazon prime', 'primevideo', 'amazonprime',
  'disney+', 'disney plus', 'disneyplus',  'hbo max', 'hbomax',
  'apple tv', 'appletv', 'apple tv+', 'apple music', 'apple one', 'icloud',
  'youtube premium', 'youtube music', 'youtubepremium', 'youtubemusic',
  'google one', 'google drive', 'google workspace', 'googleplay',
  'microsoft 365', 'office 365', 'onedrive', 'microsoft365',
  'paramount+', 'paramountplus', 'star+', 'starplus', 'lionsgate+',
  'globoplay', 'telecine', 'looke', 'now online', 'claro tv+', 'netshoes',
  'deezer', 'tidal', 'amazon music',
  // Aplicativos / SaaS
  'dropbox', 'notion', 'figma', 'adobe', 'canva', 'miro', 'slack',
  'medium', 'substack', 'newsletter', 'pocket', 'feedly',
  'twitch', 'twitch prime',
  'chatgpt', 'chat gpt', 'openai', 'midjourney', 'github copilot', 'copilot',
  'github', 'gitlab', 'bitbucket', 'vercel', 'netlify', 'heroku',
  // Jogos
  'xbox game pass', 'xboxgamepass', 'xbox live', 'game pass',
  'playstation plus', 'playstationplus', 'ps plus', 'psplus',
  'nintendo switch online', 'nintendoswitchonline',
  'steam', 'epic games', 'ubisoft+',
  // Bancos / Fintech (BR)
  'nubank', 'nubank+', 'nubank ultravioleta', 'nubankultravioleta', 'nuinvest', 'roxinho',
  'mercadopago', 'mercado pago',
  'picpay', 'picpay plus',
  'banco inter', 'bancointer', 'inter smart', 'intersmart',
  'c6 bank', 'c6bank', 'c6 carbank', 'c6carbank',
  'pagbank', 'pag seguro', 'pagseguro',
  'neon',
  'will bank', 'willbank',
  'banco original', 'bancooriginal',
  'sofisa', 'sofisa direto', 'sofisadireto',
  'modal mais', 'modalmais',
  // Telecom / Internet (BR)
  'vivo', 'vivo fibra', 'vivofibra', 'vivo tv', 'vivotv', 'vivo internet', 'vivointernet',
  'tim', 'tim beta', 'timbeta',
  'clarotv', 'claronet', 'claro internet', 'clarointernet', 'claro fibra', 'clarofibra',
  'oi fibra', 'oifibra', 'oi internet', 'oiinternet',
  'sky', 'sky tv', 'skytv', 'sky+', 'skymais',
  'directv go', 'directv',
  // Delivery / Mobilidade
  'ifood assinatura', 'ifoodassinatura', 'uber one', 'uberone', '99 mais',
  // Academia / Saúde
  'gympass', 'totalpass', 'wellhub', 'smart fit', 'smartfit',
  'bodytech', 'bio ritmo', 'bluefit',
  // Seguros / Financeiro
  'seguro', 'seguro de vida', 'seguro auto', 'seguro residencial',
  'plano de saúde', 'planodesaude', 'plano de saude', 'unimed', 'bradesco saude',
  'anuidade', 'mensalidade cartão',
  // Educação (global + BR)
  'coursera', 'udemy', 'alura', 'rocketseat', 'dio', 'edx', 'khan academy',
  'duolingo', 'babbel', 'busuu',
  'descomplica', 'kultivi', 'curso em video', 'cursoemvideo',
  // Clubes de assinatura (BR)
  'wine', 'clube do vinho', 'clubedovinho', 'evino',
  'petlove', 'doghero',
  // Outros
  'assinatura', 'premium', 'plano', 'membership', 'recorrente',
  'hospedagem', 'dominio', 'servidor', 'vps', 'hospedagem de site',
]

/** Categorias tipicamente associadas a assinaturas */
const SUBSCRIPTION_CATEGORIES = [
  'streaming', 'aplicativos', 'apps', 'assinatura', 'assinaturas',
  'software', 'saas', 'cloud', 'hospedagem',
  'academia', 'ginástica', 'esporte', 'treino', 'musculação',
  'seguro', 'seguro de vida', 'seguro auto', 'seguro residencial',
  'plano de saúde', 'planos de saúde', 'saúde',
  'educação', 'cursos', 'escola', 'faculdade', 'mensalidade',
  'tv', 'cabo', 'satélite', 'antena',
  'telefone', 'celular', 'plano de dados', 'internet', 'banda larga',
  'banco', 'bancos', 'fintech', 'financeiro',
]

/**
 * Calcula os sinais de assinatura para uma despesa com base em nome, valor e categoria.
 * Retorna contagem de sinais (0-3) e detalhes para uso na classificação.
 */
export function calcSubscriptionSignals(
  description: string,
  categoryName: string,
  currentTotal: number,
  historicalTotal: number | null,
): { count: number; exactValue: boolean; nameMatch: boolean; categoryMatch: boolean } {
  let count = 0
  let exactValue = false
  let nameMatch = false
  let categoryMatch = false

  const desc = description.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '')
  const cat = categoryName.toLowerCase()

  // Signal 1: Nome corresponde a serviço de assinatura conhecido
  nameMatch = KNOWN_SUBSCRIPTION_NAMES.some(s => desc.includes(s.replace(/[^a-zà-ÿ0-9]/g, '')))
  if (nameMatch) count++

  // Signal 2: Categoria é tipicamente de assinatura
  categoryMatch = SUBSCRIPTION_CATEGORIES.some(s => cat.includes(s))
  if (categoryMatch) count++

  // Signal 3: Valor exato ou quase exato (±5%)
  if (historicalTotal !== null) {
    const maxVal = Math.max(currentTotal, historicalTotal)
    const minVal = Math.max(Math.min(currentTotal, historicalTotal), 0.01)
    const ratio = maxVal / minVal
    if (ratio <= 1.05) {
      exactValue = true
      count++
    }
  }

  return { count, exactValue, nameMatch, categoryMatch }
}

/**
 * Classifica o tipo de recorrência e confiança base usando sinais (nome, valor, categoria).
 * 
 * Lógica de decisão:
 * - Exact value (±5%) em 2+ meses → subscription (forte)
 * - Nome conhecido + categoria assinatura em 2+ meses → subscription
 * - Nome conhecido + valor aproximado (±10%) em 2+ meses → subscription
 * - Categoria assinatura + valor aproximado (±10%) em 2+ meses → subscription
 * - 3+ meses consecutivos com ±10% → subscription (tradicional)
 * - Nome conhecido com valor variando até 50% em 2+ meses → subscription (baixa)
 * - Demais com match → recurring
 */
export function classifyBySignals(
  monthsWithExact: number,
  monthsWithApprox: number,
  signals: ReturnType<typeof calcSubscriptionSignals>,
): { recType: RecurrenceType | null; baseConfidence: number } {
  const { count: signalCount, exactValue, nameMatch, categoryMatch } = signals

  // Sinal mais forte: valor exato em 2+ meses → subscription
  if (monthsWithExact >= 1 && exactValue) {
    const bonus = (nameMatch ? 0.05 : 0) + (categoryMatch ? 0.03 : 0)
    return { recType: 'subscription', baseConfidence: 0.90 + bonus }
  }

  // Nome + Categoria conhecidos em 2+ meses → subscription (identificação forte)
  if (monthsWithApprox >= 1 && nameMatch && categoryMatch) {
    return { recType: 'subscription', baseConfidence: 0.85 }
  }

  // Nome conhecido + valor próximo (±10%) → subscription
  if (monthsWithExact >= 1 && nameMatch) {
    return { recType: 'subscription', baseConfidence: 0.80 }
  }

  // Categoria assinatura + valor próximo (±10%) → subscription
  if (monthsWithExact >= 1 && categoryMatch) {
    return { recType: 'subscription', baseConfidence: 0.75 }
  }

  // 3+ meses consecutivos com ±10% → subscription (tradicional)
  if (monthsWithExact >= 2) {
    return { recType: 'subscription', baseConfidence: 0.70 }
  }

  // Nome conhecido com valor aproximado (até 50%) → subscription (baixa confiança)
  if (monthsWithApprox >= 1 && nameMatch) {
    return { recType: 'subscription', baseConfidence: 0.60 }
  }

  // Categoria assinatura + valor aproximado → subscription (baixa)
  if (monthsWithApprox >= 1 && categoryMatch && signalCount >= 2) {
    return { recType: 'subscription', baseConfidence: 0.55 }
  }

  // Apenas match básico → recurring
  if (monthsWithApprox >= 1) {
    const signalBonus = signalCount * 0.03
    return { recType: 'recurring', baseConfidence: 0.40 + signalBonus }
  }

  return { recType: null, baseConfidence: 0 }
}

/**
 * Detecta despesas recorrentes com classificação inteligente em 3 níveis.
 * Usa múltiplos sinais (nome do serviço, valor exato, categoria) para
 * identificar assinaturas com alta precisão mesmo com apenas 2 meses de dados.
 * 
 * Níveis de classificação:
 * - subscription: assinatura verdadeira (Netflix, Spotify, etc.) — identificada por
 *   nome conhecido, valor exato, e/ou categoria, com confiança 0.55-0.95+
 * - recurring: gasto que se repete mensalmente mas não é assinatura formal
 *   (ex: supermercado, padaria) — confiança 0.40-0.55
 * - similar: mesma categoria com total mensal similar (descrições diferentes)
 *   — confiança 0.10-0.50
 * 
 * Filtra parcelas (installment_group_id) para não confundir com recorrências.
 * Suporta múltiplos meses históricos para maior precisão.
 */
function detectRecurringExpenses(
  currentExpenses: Expense[],
  previousExpenses: Expense[],
  totalIncomes: number,
  additionalPreviousMonths?: Expense[][],
): RecurringExpenseInfo[] {
  const result: RecurringExpenseInfo[] = []
  const matchedKeys = new Set<string>()

  // Normaliza descrição para comparação
  const normalizeDesc = (desc: string) =>
    desc.toLowerCase().replace(/[^a-zà-ÿ0-9]/g, '').trim()

  // Filtra despesas parceladas — parcelas não são recorrências
  const filterInstallments = (exps: Expense[]) =>
    exps.filter(e => !e.installment_group_id)

  // Monta lista de todos os meses históricos
  const historicalMonths: Expense[][] = [filterInstallments(previousExpenses)]
  if (additionalPreviousMonths) {
    for (const monthExpenses of additionalPreviousMonths) {
      historicalMonths.push(filterInstallments(monthExpenses))
    }
  }

  const validCurrent = filterInstallments(currentExpenses)

  // ── Passo 1: Agrupa despesas atuais por descrição normalizada ──
  // Armazena rawTotal (amount bruto para comparação) e reportTotal (amount * report_weight para exibição)
  const currentGroupedByDesc = new Map<string, {
    description: string
    rawTotal: number
    reportTotal: number
    catName: string
    catId?: string
  }[]>()
  for (const exp of validCurrent) {
    if (!exp.description) continue
    const key = normalizeDesc(exp.description)
    if (!currentGroupedByDesc.has(key)) currentGroupedByDesc.set(key, [])
    currentGroupedByDesc.get(key)!.push({
      description: exp.description,
      rawTotal: exp.amount,
      reportTotal: exp.amount * (exp.report_weight ?? 1),
      catName: exp.category?.name || 'Sem categoria',
      catId: exp.category?.id || exp.category_id,
    })
  }

  // ── Passo 2: Classifica por descrição usando sinais (subscription / recurring) ──
  for (const [key, currentItems] of currentGroupedByDesc) {
    if (matchedKeys.has(key)) continue

    const currentTotal = currentItems.reduce((s, i) => s + i.rawTotal, 0)
    const currentReportTotal = currentItems.reduce((s, i) => s + i.reportTotal, 0)
    if (currentTotal <= 0) continue

    let monthsWithExact = 0  // ±10%
    let monthsWithApprox = 0 // ±50%
    let totalHistoricalAmount = 0
    let totalHistoricalReport = 0

    for (const monthExpenses of historicalMonths) {
      const grouped = new Map<string, { rawTotal: number; reportTotal: number }[]>()
      for (const exp of monthExpenses) {
        if (!exp.description) continue
        const k = normalizeDesc(exp.description)
        if (!grouped.has(k)) grouped.set(k, [])
        grouped.get(k)!.push({ rawTotal: exp.amount, reportTotal: exp.amount * (exp.report_weight ?? 1) })
      }

      const historicalItems = grouped.get(key)
      if (!historicalItems || historicalItems.length === 0) continue

      const historicalRawTotal = historicalItems.reduce((s, i) => s + i.rawTotal, 0)
      const historicalReportTotal = historicalItems.reduce((s, i) => s + i.reportTotal, 0)
      if (historicalRawTotal <= 0) continue

      const maxVal = Math.max(currentTotal, historicalRawTotal)
      const minVal = Math.max(Math.min(currentTotal, historicalRawTotal), 0.01)
      const ratio = maxVal / minVal

      if (ratio <= 1.1) {
        monthsWithExact++
        monthsWithApprox++
        totalHistoricalAmount += historicalRawTotal
        totalHistoricalReport += historicalReportTotal
      } else if (ratio <= 1.5) {
        monthsWithApprox++
        totalHistoricalAmount += historicalRawTotal
        totalHistoricalReport += historicalReportTotal
      }
    }

    // Se não tem match básico, não é recorrente
    if (monthsWithApprox < 1) continue

    // Calcula sinais para classificação mais precisa
    // Usa rawTotal para sinais (comparação de valores brutos)
    const firstHistoricalRaw = totalHistoricalAmount > 0 ? totalHistoricalAmount / monthsWithApprox : null
    const signals = calcSubscriptionSignals(
      currentItems[0].description,
      currentItems[0].catName,
      currentTotal,
      firstHistoricalRaw,
    )

    // Classifica usando sinais
    const { recType, baseConfidence } = classifyBySignals(monthsWithExact, monthsWithApprox, signals)
    if (!recType) continue

    // monthsWithApprox é sempre >= monthsWithExact (exatos também incrementam approx)
    const monthsFound = 1 + monthsWithApprox

    const avgHistoricalRaw = monthsWithApprox > 0 ? totalHistoricalAmount / monthsWithApprox : 0
    const avgHistoricalReport = monthsWithApprox > 0 ? totalHistoricalReport / monthsWithApprox : 0
    const monthlyAmount = Math.round((currentReportTotal + avgHistoricalReport) / 2 * 100) / 100

    // Confiança final: base + bônus por meses encontrados
    const monthsBonus = Math.min(1, (monthsFound - 1) * 0.05)
    const totalRatio = Math.max(currentTotal, avgHistoricalRaw) / Math.max(Math.min(currentTotal, avgHistoricalRaw), 0.01)
    const variance = Math.max(0, totalRatio - 1)
    const variancePenalty = recType === 'subscription' ? variance * 0.3 : variance * 0.8
    const confidence = Math.round(Math.max(0.3, Math.min(1, baseConfidence - variancePenalty + monthsBonus)) * 100) / 100

    matchedKeys.add(key)
    const incomePercentage = totalIncomes > 0
      ? Math.round((monthlyAmount / totalIncomes) * 100 * 100) / 100
      : 0

    const { tier, savingsIfCut, tierReason } = classifySubscription(
      currentItems[0].catName,
      monthlyAmount,
    )

    result.push({
      description: currentItems[0].description,
      categoryName: currentItems[0].catName,
      categoryId: currentItems[0].catId,
      monthlyAmount,
      annualAmount: Math.round(monthlyAmount * 12 * 100) / 100,
      monthsFound,
      confidence,
      recurrenceType: recType,
      nature: recType === 'subscription' && signals.exactValue ? 'fixed' : 'variable',
      isIgnored: isSubscriptionIgnored(currentItems[0].description),
      incomePercentage,
      tier,
      savingsIfCut,
      tierReason,
    })
  }

  // ── Passo 3: Detecta gastos similares por categoria ──
  // Agrupa despesas NÃO matchadas por descrição em categorias
  // rawTotal para comparação, reportTotal para exibição
  const unmatchedByCategory = new Map<string, {
    description: string
    rawTotal: number
    reportTotal: number
    catName: string
    catId: string
  }[]>()
  for (const exp of validCurrent) {
    if (!exp.description) continue
    const descKey = normalizeDesc(exp.description)
    if (matchedKeys.has(descKey)) continue
    const catKey = exp.category?.id || exp.category_id || 'unknown'
    if (!unmatchedByCategory.has(catKey)) unmatchedByCategory.set(catKey, [])
    unmatchedByCategory.get(catKey)!.push({
      description: exp.description,
      rawTotal: exp.amount,
      reportTotal: exp.amount * (exp.report_weight ?? 1),
      catName: exp.category?.name || 'Sem categoria',
      catId: catKey,
    })
  }

  for (const [catKey, catItems] of unmatchedByCategory) {
    const currentCatRaw = catItems.reduce((s, i) => s + i.rawTotal, 0)
    const currentCatReport = catItems.reduce((s, i) => s + i.reportTotal, 0)
    if (currentCatRaw <= 0) continue

    // ── Filtro 1: Excluir categorias agregadoras (supermercado, alimentação, etc.) ──
    const categoryName = catItems[0].catName.toLowerCase()
    if (AGGREGATE_CATEGORIES.some(a => categoryName.includes(a))) continue

    // ── Filtro 2: Dispersão interna — muitos itens pequenos não são recorrência ──
    if (catItems.length >= 5) {
      // Se o maior item representa < 40% do total, provavelmente é gasto agregado
      const maxItem = catItems.reduce((max, item) => Math.max(max, item.rawTotal), 0)
      if (maxItem < currentCatRaw * 0.4) continue
    }

    // ── Filtro 3: Descrição dominante — se 70%+ do valor vem de 1 descrição e há 2+ itens,
    // delegar ao Passo 1/2 (a descrição deve ser matchada por description, não categoria) ──
    const sortedItems = [...catItems].sort((a, b) => b.reportTotal - a.reportTotal)
    const topItem = sortedItems[0]
    if (topItem && catItems.length > 1 && topItem.rawTotal / currentCatRaw >= 0.7) {
      continue
    }

    let monthsWithSimilar = 0
    let totalSimilarRaw = 0
    let totalSimilarReport = 0

    for (const monthExpenses of historicalMonths) {
      const monthExpensesFiltered = monthExpenses.filter(e => (e.category?.id || e.category_id) === catKey)
      const monthCatRaw = monthExpensesFiltered.reduce((s, e) => s + e.amount, 0)
      const monthCatReport = monthExpensesFiltered.reduce((s, e) => s + e.amount * (e.report_weight ?? 1), 0)

      if (monthCatRaw <= 0) continue

      const maxVal = Math.max(currentCatRaw, monthCatRaw)
      const minVal = Math.max(Math.min(currentCatRaw, monthCatRaw), 0.01)
      const ratio = maxVal / minVal

      // Threshold mais restritivo para 'similar' (1.3x = 30% de variação)
      if (ratio <= 1.3) {
        monthsWithSimilar++
        totalSimilarRaw += monthCatRaw
        totalSimilarReport += monthCatReport
      }
    }

    // Exige match em múltiplos meses históricos:
    // - 2+ quando há 3+ meses de histórico disponível
    // - 1+ quando há apenas 1-2 meses de histórico
    const requiredSimilarMonths = historicalMonths.length >= 3 ? 2 : 1
    if (monthsWithSimilar < requiredSimilarMonths) continue

    const monthsFound = 1 + monthsWithSimilar
    const avgSimilarRaw = totalSimilarRaw / monthsWithSimilar
    const avgSimilarReport = totalSimilarReport / monthsWithSimilar
    const monthlyAmount = Math.round((currentCatReport + avgSimilarReport) / 2 * 100) / 100
    const monthsBonus = Math.min(1, (monthsFound - 1) / 4)
    const totalRatio = Math.max(currentCatRaw, avgSimilarRaw) / Math.max(Math.min(currentCatRaw, avgSimilarRaw), 0.01)
    const variance = Math.max(0, totalRatio - 1)
    const confidence = Math.round(Math.max(0.1, Math.min(0.5, 0.3 - variance * 0.5 + monthsBonus * 0.2)) * 100) / 100
    const incomePercentage = totalIncomes > 0
      ? Math.round((monthlyAmount / totalIncomes) * 100 * 100) / 100
      : 0

    const { tier, savingsIfCut, tierReason } = classifySubscription(
      catItems[0].catName,
      monthlyAmount,
    )

    result.push({
      description: sortedItems.length > 1
        ? `${sortedItems[0].description} (+${sortedItems.length - 1})`
        : sortedItems[0].description,
      categoryName: catItems[0].catName,
      categoryId: catItems[0].catId,
      monthlyAmount,
      annualAmount: Math.round(monthlyAmount * 12 * 100) / 100,
      monthsFound,
      confidence,
      recurrenceType: 'similar',
      nature: 'variable',
      isIgnored: false,
      incomePercentage,
      tier,
      savingsIfCut,
      tierReason,
    })
  }

  // Ordena: não-ignorados → tipo (subscription → recurring → similar) → valor
  const typeOrder: Record<RecurrenceType, number> = { subscription: 0, recurring: 1, similar: 2 }
  return result.sort((a, b) => {
    if (a.isIgnored !== b.isIgnored) return a.isIgnored ? 1 : -1
    const typeDiff = typeOrder[a.recurrenceType] - typeOrder[b.recurrenceType]
    if (typeDiff !== 0) return typeDiff
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

  // 2. Despesas recorrentes com classificação inteligente (3 níveis)
  const recurringExpenses = detectRecurringExpenses(
    expenses,
    previousMonthExpenses,
    totalIncomes,
    input.additionalPreviousMonthExpenses,
  )

  // 2b. Deriva subscriptions (backward compat) — apenas subscription e recurring
  const subscriptions = recurringExpenses
    .filter(r => r.recurrenceType === 'subscription' || r.recurrenceType === 'recurring')
    .map(r => ({
      description: r.description,
      categoryName: r.categoryName,
      monthlyAmount: r.monthlyAmount,
      annualAmount: r.annualAmount,
      monthsFound: r.monthsFound,
      categoryId: r.categoryId,
      confidence: r.confidence,
      tier: r.tier,
      savingsIfCut: r.savingsIfCut,
      tierReason: r.tierReason,
      isIgnored: r.isIgnored,
    }))
  const totalSubscriptionsAnnual = subscriptions.reduce((s, sub) => s + sub.annualAmount, 0)

  // 2c. Cuttable subscriptions (não-essenciais, não ignoradas)
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
    recurringExpenses,
    incomeConcentration,
    expenseTrend,
    weekendSpending,
    topCategory,
    savingsStatus,
    investmentCommitment,
  }
}

/* ------------------------------------------------------------------ */
/*  Optimization Suggestions                                           */
/*  (formerly optimizationSuggestionsEngine.ts — merged into engine)   */
/* ------------------------------------------------------------------ */

export type SuggestionAction =
  | { type: 'reallocate'; fromId: string; toId: string; amount: number }
  | { type: 'navigate'; path: string }

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
  const { insights, reallocationRecommendation, totalIncomes, totalExpenses } = input

  /* ── 1. Remanejamento inteligente ── */
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

  /* ── 2. Gastos de fim de semana elevados ── */
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

  /* ── 3. Status da poupança (se for crítico ou baixo) ── */
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

  /* ── 4. Compromisso com investimentos baixo (só se poupança for saudável) ── */
  if (insights.investmentCommitment && !insights.investmentCommitment.isAdequate
      && insights.savingsStatus
      && insights.savingsStatus.level !== 'crítico'
      && insights.savingsStatus.level !== 'baixo') {
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
