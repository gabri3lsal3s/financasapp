import { addMonths, format, isValid, parse, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import {
  EXPENSE_ACTION_HINTS,
  EXPENSE_CONTEXT_HINTS,
  INCOME_CONTEXT_HINTS,
  INVESTMENT_CONTEXT_HINTS,
} from '@/services/assistant-core/constants'
import { enqueueOfflineOperation, shouldQueueOffline } from '@/utils/offlineQueue'
import { resolveBillCompetence } from '@/utils/creditCardBilling'
import { clampMonthToAppStart, formatCurrencyCompactBR } from '@/utils/format'
import type {
  AssistantCommand,
  AssistantConfirmResult,
  AssistantIntent,
  AssistantInterpretResult,
  AssistantMonthlyInsightsResult,
  AssistantResolvedCategory,
  AssistantSession,
  AssistantSlots,
  Expense,
  Income,
  Investment,
} from '@/types'const normalizeInstallmentCount = (value: number | string | null | undefined): number => {
  if (!value) return 1
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const parseSharedParticipants = (text: string): number | undefined => {
  const match = text.match(/(?:dividid[oa]|dividindo|repartid[oa]|rachad[oa])\s+(?:com|por|entre)\s+(\w+)/i)
  if (!match) return undefined
  const word = match[1].toLowerCase()
  const map: Record<string, number> = {
    'dois': 2, 'tres': 3, 'três': 3, 'quatro': 4, 'cinco': 5, 'seis': 6,
    'ele': 2, 'ela': 2, 'amigo': 2, 'amiga': 2, 'namorado': 2, 'namorada': 2,
    'esposa': 2, 'marido': 2, 'irmao': 2, 'irmão': 2, 'irma': 2, 'irmã': 2,
    'pai': 2, 'mae': 2, 'mãe': 2, 'pais': 3
  }
  return map[word] || (Number.isFinite(Number(word)) ? Number(word) : undefined)
}

const buildInstallmentDates = (baseDate: string, count: number): string[] => {
  const dates: string[] = []
  let currentDate = parse(baseDate, 'yyyy-MM-dd', new Date())
  for (let i = 0; i < count; i++) {
    dates.push(format(currentDate, 'yyyy-MM-dd'))
    currentDate = addMonths(currentDate, 1)
  }
  return dates
}

const splitInstallmentAmounts = (total: number, count: number): number[] => {
  if (count <= 1) return [total]
  const baseAmount = Math.floor((total / count) * 100) / 100
  const remainder = Math.round((total - (baseAmount * count)) * 100) / 100
  const amounts = Array(count).fill(baseAmount)
  amounts[0] = Math.round((amounts[0] + remainder) * 100) / 100
  return amounts
}

const generateUuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

import { extractIntentAndSlots } from '@/services/ai/voice'
import { generateMonthlyInsights } from '@/services/ai/insights'
import type { AssistantConfirmationMode } from '@/services/assistant-core/confirmationPolicy'
import { resolveConfirmationPolicy } from '@/services/assistant-core/confirmationPolicy'

interface CategoryLookupItem {
  id: string
  name: string
  color?: string
}

const CONFIRMATION_WINDOW_MS = 2 * 60 * 1000
const DEFAULT_LOCALE = 'pt-BR'
const CATEGORY_CONFIDENCE_AUTO_ASSIGN = 0.8
const CATEGORY_CONFIDENCE_DISAMBIGUATION = 0.5

const getCurrentUserId = async (): Promise<string | undefined> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) return undefined
  return data.user?.id
}

const EXPENSE_KEYWORDS: Record<string, string[]> = {
  Alimentação: ['almoço', 'jantar', 'lanche', 'restaurante', 'mercado', 'ifood', 'padaria'],
  Transporte: ['uber', '99', 'taxi', 'ônibus', 'onibus', 'combustível', 'combustivel', 'gasolina'],
  Moradia: ['aluguel', 'energia', 'água', 'agua', 'internet', 'condomínio', 'condominio'],
  Saúde: ['saúde', 'saude', 'farmácia', 'farmacia', 'médico', 'medico', 'exame'],
}

const INCOME_KEYWORDS: Record<string, string[]> = {
  Salário: ['salário', 'salario', 'folha', 'pagamento'],
  Freelancer: ['freela', 'freelancer', 'projeto', 'job'],
  Dividendos: ['dividendos', 'dividendo', 'proventos', 'juros'],
  Aluguel: ['aluguel recebido', 'locação', 'locacao'],
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const getPreferredMapping = async (
  phrase: string,
  transactionType: 'expense' | 'income',
): Promise<{ category_id?: string; income_category_id?: string; confidence?: number } | null> => {
  const { data, error } = await supabase
    .from('assistant_category_mappings')
    .select('category_id, income_category_id, confidence')
    .eq('phrase', phrase)
    .eq('transaction_type', transactionType)
    .order('usage_count', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data) return null
  return data
}

const resolveByKeyword = (
  description: string,
  categories: CategoryLookupItem[],
  dictionary: Record<string, string[]>,
): AssistantResolvedCategory | null => {
  const normalizedDescription = normalizeText(description)

  for (const [canonicalName, terms] of Object.entries(dictionary)) {
    const matched = terms.some((term) => normalizedDescription.includes(normalizeText(term)))
    if (!matched) continue

    const matchedCategory = categories.find((category) =>
      normalizeText(category.name).includes(normalizeText(canonicalName)),
    )

    if (matchedCategory) {
      return {
        id: matchedCategory.id,
        name: matchedCategory.name,
        confidence: 0.88,
        source: 'keyword',
      }
    }
  }

  return null
}

const resolveByCategoryName = (
  description: string,
  categories: CategoryLookupItem[],
): AssistantResolvedCategory | null => {
  const normalizedDescription = normalizeText(description)

  const matchedCategory = categories.find((category) =>
    normalizedDescription.includes(normalizeText(category.name)),
  )

  if (!matchedCategory) return null

  return {
    id: matchedCategory.id,
    name: matchedCategory.name,
    confidence: 0.82,
    source: 'name_match',
  }
}

const isUncategorizedCategory = (categoryName: string) =>
  normalizeText(categoryName) === normalizeText('Sem categoria')

const getPreferredCategoryPool = (categories: CategoryLookupItem[]) => {
  const nonUncategorized = categories.filter((category) => !isUncategorizedCategory(category.name))
  return nonUncategorized.length ? nonUncategorized : categories
}

const resolveBestCategoryFallback = (
  categories: CategoryLookupItem[],
  description?: string,
): AssistantResolvedCategory => {
  const pool = getPreferredCategoryPool(categories)

  if (!pool.length) {
    return {
      name: 'Sem categoria',
      confidence: 0.2,
      source: 'fallback_uncategorized',
    }
  }

  const tokens = normalizeText(description || '')
    .split(/\s+/)
    .filter((token) => token.length >= 3)

  if (tokens.length) {
    const bestByToken = pool
      .map((category) => {
        const categoryName = normalizeText(category.name)
        const score = tokens.reduce((sum, token) => (categoryName.includes(token) ? sum + 1 : sum), 0)
        return { category, score }
      })
      .sort((a, b) => b.score - a.score)

    if ((bestByToken[0]?.score || 0) > 0) {
      return {
        id: bestByToken[0].category.id,
        name: bestByToken[0].category.name,
        confidence: 0.58,
        source: 'name_match',
      }
    }
  }

  return {
    id: pool[0].id,
    name: pool[0].name,
    confidence: isUncategorizedCategory(pool[0].name) ? 0.35 : 0.55,
    source: isUncategorizedCategory(pool[0].name) ? 'fallback_uncategorized' : 'name_match',
  }
}

const resolveBySimilarityCandidates = (
  description: string,
  categories: CategoryLookupItem[],
): AssistantResolvedCategory[] => {
  const tokens = normalizeText(description)
    .split(/\s+/)
    .filter((token) => token.length >= 3)

  if (!tokens.length || !categories.length) return []

  const scored = categories
    .map((category) => {
      const categoryName = normalizeText(category.name)
      const matchCount = tokens.reduce((score, token) => (categoryName.includes(token) ? score + 1 : score), 0)
      const ratio = matchCount / tokens.length
      const confidence = 0.5 + ratio * 0.29

      return {
        category,
        ratio,
        confidence,
      }
    })
    .filter((item) => item.ratio > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)

  return scored.map((item) => ({
    id: item.category.id,
    name: item.category.name,
    confidence: Number(item.confidence.toFixed(2)),
    source: 'name_match',
  }))
}

interface CategoryResolutionResult {
  selectedCategory?: AssistantResolvedCategory
  candidates: AssistantResolvedCategory[]
  needsDisambiguation: boolean
}

const resolveCategory = async (
  intent: AssistantIntent,
  slots: AssistantSlots,
): Promise<CategoryResolutionResult> => {
  if (!slots.description || (intent !== 'add_expense' && intent !== 'add_income')) {
    return {
      selectedCategory: undefined,
      candidates: [],
      needsDisambiguation: false,
    }
  }

  if (intent === 'add_expense') {
    const [categoriesResult, mapping] = await Promise.all([
      supabase.from('categories').select('id, name, color').order('name', { ascending: true }),
      getPreferredMapping(slots.description, 'expense'),
    ])

    const categories = categoriesResult.data || []
    const preferredCategories = getPreferredCategoryPool(categories)

    if (mapping?.category_id) {
      const mapped = categories.find((category) => category.id === mapping.category_id)
      if (mapped) {
        if (isUncategorizedCategory(mapped.name) && preferredCategories.some((category) => !isUncategorizedCategory(category.name))) {
          // Ignora mapeamento para "Sem categoria" quando existem categorias melhores.
        } else {
          return {
            selectedCategory: {
              id: mapped.id,
              name: mapped.name,
              confidence: mapping.confidence ?? 0.9,
              source: 'mapping',
            },
            candidates: [],
            needsDisambiguation: false,
          }
        }
      }
    }

    const byKeyword = resolveByKeyword(slots.description, preferredCategories, EXPENSE_KEYWORDS)
    if (byKeyword) {
      return {
        selectedCategory: byKeyword,
        candidates: [],
        needsDisambiguation: false,
      }
    }

    const byName = resolveByCategoryName(slots.description, preferredCategories)
    if (byName) {
      return {
        selectedCategory: byName,
        candidates: [],
        needsDisambiguation: false,
      }
    }

    const similarityCandidates = resolveBySimilarityCandidates(slots.description, preferredCategories)
    if (similarityCandidates.length) {
      const [bestCandidate] = similarityCandidates
      const needsDisambiguation =
        bestCandidate.confidence >= CATEGORY_CONFIDENCE_DISAMBIGUATION
        && bestCandidate.confidence < CATEGORY_CONFIDENCE_AUTO_ASSIGN

      return {
        selectedCategory: needsDisambiguation ? undefined : bestCandidate,
        candidates: similarityCandidates,
        needsDisambiguation,
      }
    }

    const fallback = resolveBestCategoryFallback(preferredCategories, slots.description)
    return {
      selectedCategory: fallback,
      candidates: [fallback],
      needsDisambiguation: false,
    }
  }

  const [incomeCategoriesResult, mapping] = await Promise.all([
    supabase.from('income_categories').select('id, name, color').order('name', { ascending: true }),
    getPreferredMapping(slots.description, 'income'),
  ])

  const incomeCategories = incomeCategoriesResult.data || []
  const preferredIncomeCategories = getPreferredCategoryPool(incomeCategories)

  if (mapping?.income_category_id) {
    const mapped = incomeCategories.find((category) => category.id === mapping.income_category_id)
    if (mapped) {
      if (isUncategorizedCategory(mapped.name) && preferredIncomeCategories.some((category) => !isUncategorizedCategory(category.name))) {
        // Ignora mapeamento para "Sem categoria" quando existem categorias melhores.
      } else {
        return {
          selectedCategory: {
            id: mapped.id,
            name: mapped.name,
            confidence: mapping.confidence ?? 0.9,
            source: 'mapping',
          },
          candidates: [],
          needsDisambiguation: false,
        }
      }
    }
  }

  const byKeyword = resolveByKeyword(slots.description, preferredIncomeCategories, INCOME_KEYWORDS)
  if (byKeyword) {
    return {
      selectedCategory: byKeyword,
      candidates: [],
      needsDisambiguation: false,
    }
  }

  const byName = resolveByCategoryName(slots.description, preferredIncomeCategories)
  if (byName) {
    return {
      selectedCategory: byName,
      candidates: [],
      needsDisambiguation: false,
    }
  }

  const similarityCandidates = resolveBySimilarityCandidates(slots.description, preferredIncomeCategories)
  if (similarityCandidates.length) {
    const [bestCandidate] = similarityCandidates
    const needsDisambiguation =
      bestCandidate.confidence >= CATEGORY_CONFIDENCE_DISAMBIGUATION
      && bestCandidate.confidence < CATEGORY_CONFIDENCE_AUTO_ASSIGN

    return {
      selectedCategory: needsDisambiguation ? undefined : bestCandidate,
      candidates: similarityCandidates,
      needsDisambiguation,
    }
  }

  const fallback = resolveBestCategoryFallback(preferredIncomeCategories, slots.description)
  return {
    selectedCategory: fallback,
    candidates: [fallback],
    needsDisambiguation: false,
  }
}

const requiresConfirmation = (intent: AssistantIntent) => resolveConfirmationPolicy({
  intent,
  mode: 'write_only',
}).requiresConfirmation

const buildConfirmationText = (
  intent: AssistantIntent,
  slots: AssistantSlots,
  options?: { needsCategoryDisambiguation?: boolean; categoryCandidates?: AssistantResolvedCategory[] },
) => {
  if (!requiresConfirmation(intent)) return 'Comando entendido.'

  if (options?.needsCategoryDisambiguation && options.categoryCandidates?.length) {
    const optionsText = options.categoryCandidates
      .slice(0, 3)
      .map((candidate) => candidate.name)
      .join(', ')
    return `Preciso confirmar a categoria. Diga a categoria desejada: ${optionsText}.`
  }

  if (slots.items && slots.items.length > 1) {
    const preview = slots.items
      .slice(0, 3)
      .map((item) => {
        const label = item.transactionType === 'investment'
          ? 'investimento'
          : item.transactionType === 'income'
            ? 'renda'
            : 'despesa'
        const installmentLabel =
          item.transactionType === 'expense' && item.installment_count && item.installment_count > 1
            ? `, ${item.installment_count}x`
            : ''
        const cardLabel =
          item.transactionType === 'expense' && item.payment_method === 'credit_card'
            ? `, cartão ${item.credit_card_name || 'crédito'}`
            : ''
        return `${label}: ${item.description || item.category?.name || label} (${formatCurrencyCompactBR(item.amount)}${installmentLabel}${cardLabel})`
      })
      .join(', ')

    const hasMixedTypes = new Set(
      slots.items.map((item) => {
        if (item.transactionType) return item.transactionType
        if (intent === 'add_investment') return 'investment'
        if (intent === 'add_income') return 'income'
        return 'expense'
      }),
    ).size > 1

    if (hasMixedTypes) {
      return `Confirma adicionar ${slots.items.length} lançamentos: ${preview}?`
    }

    if (intent === 'add_expense') {
      return `Confirma adicionar ${slots.items.length} despesas: ${preview}?`
    }

    if (intent === 'add_income') {
      return `Confirma adicionar ${slots.items.length} rendas: ${preview}?`
    }

    if (intent === 'add_investment') {
      return `Confirma adicionar ${slots.items.length} investimentos: ${preview}?`
    }
  }

  if (intent === 'add_expense') {
    const installmentLabel = slots.installment_count && slots.installment_count > 1
      ? ` em ${slots.installment_count} parcelas`
      : ''
    const cardLabel = slots.payment_method === 'credit_card'
      ? ` no cartão ${slots.credit_card_name || 'de crédito'}`
      : ''
    return `Confirma despesa de ${formatCurrencyCompactBR(slots.amount ?? 0)}${installmentLabel}${cardLabel} em ${slots.category?.name || 'Sem categoria'} na data ${slots.date}?`
  }

  if (intent === 'add_income') {
    return `Confirma renda de ${formatCurrencyCompactBR(slots.amount ?? 0)} em ${slots.category?.name || 'Sem categoria'} na data ${slots.date}?`
  }

  if (intent === 'add_investment') {
    return `Confirma investimento de ${formatCurrencyCompactBR(slots.amount ?? 0)} para ${slots.month}?`
  }

  if (intent === 'update_transaction') {
    const parts: string[] = []
    if (slots.amount) {
      parts.push(`valor para ${formatCurrencyCompactBR(slots.amount)}`)
    }
    if (slots.description) {
      parts.push(`descrição para ${slots.description}`)
    }

    if (!parts.length) {
      return 'Confirma atualização do lançamento selecionado?'
    }

    return `Confirma atualizar lançamento com ${parts.join(' e ')}?`
  }

  if (intent === 'delete_transaction') {
    if (slots.description) {
      return `Confirma excluir lançamento relacionado a ${slots.description}?`
    }
    if (slots.amount) {
      return `Confirma excluir lançamento de ${formatCurrencyCompactBR(slots.amount)}?`
    }
    return 'Confirma excluir o lançamento selecionado?'
  }

  if (intent === 'create_category') {
    const normalized = normalizeText(slots.description || '')
    const type = /renda|receita/.test(normalized) ? 'renda' : 'despesa'
    if (slots.description) {
      return `Confirma criar categoria de ${type} com nome ${slots.description}?`
    }
    return `Confirma criar nova categoria de ${type}?`
  }

  return 'Confirma a execução do comando?'
}

const generateIdempotencyKey = (sessionId: string, text: string) => {
  const normalized = normalizeText(text).replace(/\s+/g, '_')
  const minuteBucket = format(new Date(), 'yyyyMMddHHmm')
  return `${sessionId}:${normalized}:${minuteBucket}`
}

const isCommandExpired = (createdAt: string) => {
  const createdAtMs = new Date(createdAt).getTime()
  return Number.isFinite(createdAtMs) && Date.now() - createdAtMs > CONFIRMATION_WINDOW_MS
}

const resolveCategoryFromSpokenConfirmation = (
  command: AssistantCommand,
  spokenText?: string,
): AssistantResolvedCategory | undefined => {
  const candidates = (command.category_resolution_json as { candidates?: AssistantResolvedCategory[] } | undefined)?.candidates || []
  if (!candidates.length || !spokenText) return undefined

  const normalizedSpoken = normalizeText(spokenText)
  const directMatch = candidates.find((candidate) => normalizedSpoken.includes(normalizeText(candidate.name)))
  if (directMatch) return directMatch

  const spokenTokens = normalizedSpoken.split(/\s+/).filter((token) => token.length >= 3)
  if (!spokenTokens.length) return undefined

  const scored = candidates
    .map((candidate) => {
      const candidateName = normalizeText(candidate.name)
      const score = spokenTokens.reduce((sum, token) => (candidateName.includes(token) ? sum + 1 : sum), 0)
      return { candidate, score }
    })
    .sort((a, b) => b.score - a.score)

  if ((scored[0]?.score || 0) <= 0) return undefined
  return scored[0].candidate
}

type WritableTransactionType = 'expense' | 'income' | 'investment'

const executeWriteIntent = async (command: AssistantCommand): Promise<AssistantConfirmResult> => {
  const slots = command.slots_json || {}
  const userId = command.user_id || await getCurrentUserId()

  if (
    command.interpreted_intent !== 'add_expense'
    && command.interpreted_intent !== 'add_income'
    && command.interpreted_intent !== 'add_investment'
  ) {
    return {
      status: 'failed',
      message: 'No momento, o assistente executa apenas adições de despesas, rendas e investimentos.',
      commandId: command.id,
    }
  }

  const addItems: Array<{
    transactionType: WritableTransactionType
    amount: number
    installment_count?: number
    payment_method?: 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other'
    credit_card_id?: string
    credit_card_name?: string
    report_weight?: number
    description?: string
    date?: string
    month?: string
    category?: AssistantResolvedCategory
  }> =
    (slots.items && slots.items.length
      ? slots.items.map((item) => ({
        ...item,
        installment_count: normalizeInstallmentCount(item.installment_count),
        transactionType:
          item.transactionType
          || (command.interpreted_intent === 'add_investment'
            ? 'investment'
            : command.interpreted_intent === 'add_income'
              ? 'income'
              : 'expense'),
      }))
      : (slots.amount
          ? (() => {
            const singleItemParticipants = parseSharedParticipants(command.command_text)
            const slotTransactionType = slots.transactionType === 'investment'
              ? 'investment'
              : slots.transactionType === 'income'
                ? 'income'
                : slots.transactionType === 'expense'
                  ? 'expense'
                  : undefined
            return [{
            transactionType:
              slotTransactionType
              || (command.interpreted_intent === 'add_investment'
                ? 'investment'
                : command.interpreted_intent === 'add_income'
                  ? 'income'
                  : 'expense'),
            amount: Number(slots.amount),
            installment_count: normalizeInstallmentCount(slots.installment_count),
            payment_method: slots.payment_method,
            credit_card_id: slots.credit_card_id,
            credit_card_name: slots.credit_card_name,
            report_weight: Number.isFinite(singleItemParticipants)
              ? Number((1 / Number(singleItemParticipants)).toFixed(4))
              : undefined,
            description: slots.description,
            date: slots.date,
            month: slots.month,
            category: slots.category,
          }]
          })()
          : []))

  if (!addItems.length) {
    return { status: 'failed', message: 'Comando incompleto para lançamento.', commandId: command.id }
  }

  const expenseItems = addItems.filter((item) => item.transactionType === 'expense')
  const incomeItems = addItems.filter((item) => item.transactionType === 'income')
  const investmentItems = addItems.filter((item) => item.transactionType === 'investment')

  const createdIds: string[] = []
  const queuedOfflineCounts: Record<WritableTransactionType, number> = {
    expense: 0,
    income: 0,
    investment: 0,
  }

  if (expenseItems.length) {
    const needsCreditCardLookup = expenseItems.some((item) =>
      item.payment_method === 'credit_card' || item.credit_card_id || item.credit_card_name,
    )

    let creditCards: Array<{ id: string; name: string; closing_day: number; is_active: boolean | null }> = []

    if (needsCreditCardLookup) {
      const { data: cardsData } = await supabase
        .from('credit_cards')
        .select('id, name, closing_day, is_active')
        .order('name', { ascending: true })

      creditCards = cardsData || []
    }

    const monthlyCycleClosingByCardAndMonth: Record<string, number> = {}

    if (needsCreditCardLookup && creditCards.length) {
      const neededCompetences = new Set<string>()

      expenseItems.forEach((item) => {
        const baseDate = item.date || slots.date
        if (!baseDate) return

        const installmentCount = normalizeInstallmentCount(item.installment_count) || 1
        const installmentDates = buildInstallmentDates(baseDate, installmentCount)
        installmentDates.forEach((dateValue) => neededCompetences.add(dateValue.substring(0, 7)))
      })

      if (neededCompetences.size) {
        const { data: cycleRows } = await supabase
          .from('credit_card_monthly_cycles')
          .select('credit_card_id, competence, closing_day')
          .in('credit_card_id', creditCards.map((card) => card.id))
          .in('competence', Array.from(neededCompetences))

        ;(cycleRows || []).forEach((row) => {
          const key = `${String(row.credit_card_id || '')}:${String(row.competence || '')}`
          if (key.startsWith(':')) return

          const closingDay = Number(row.closing_day)
          if (Number.isFinite(closingDay)) {
            monthlyCycleClosingByCardAndMonth[key] = closingDay
          }
        })
      }
    }

    let hasMissingCreditCardReference = false

    const { data: expenseCategories } = await supabase
      .from('categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedExpenseId = (expenseCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id
    const fallbackExpenseCategoryId = uncategorizedExpenseId || (expenseCategories || [])[0]?.id

    const expensePayloadNested = await Promise.all(expenseItems.map(async (item) => {
      let resolvedCategoryId = item.category?.id

      if (!resolvedCategoryId && item.description) {
        const resolution = await resolveCategory('add_expense', {
          amount: item.amount,
          description: item.description,
          date: item.date || slots.date,
          month: item.month || slots.month,
        })
        resolvedCategoryId = resolution.selectedCategory?.id
      }

      resolvedCategoryId = resolvedCategoryId || fallbackExpenseCategoryId

      const effectiveDate = item.date || slots.date
      const installmentCount = normalizeInstallmentCount(item.installment_count) || 1
      const normalizedCardName = normalizeText(item.credit_card_name || '')

      let resolvedCreditCardId = item.credit_card_id

      if (!resolvedCreditCardId && normalizedCardName) {
        const matchedByName = creditCards.find((card) => {
          const normalizedRegistered = normalizeText(card.name)
          return normalizedRegistered.includes(normalizedCardName) || normalizedCardName.includes(normalizedRegistered)
        })
        resolvedCreditCardId = matchedByName?.id
      }

      const resolveClosingDayForDate = (targetDate: string) => {
        if (!resolvedCreditCardId) return undefined

        const competence = targetDate.substring(0, 7)
        const monthlyClosingDay = monthlyCycleClosingByCardAndMonth[`${resolvedCreditCardId}:${competence}`]
        if (Number.isFinite(monthlyClosingDay)) {
          return Number(monthlyClosingDay)
        }

        const card = creditCards.find((candidate) => candidate.id === resolvedCreditCardId)
        if (card && Number.isFinite(card.closing_day)) {
          return Number(card.closing_day)
        }

        return undefined
      }

      const resolvedPaymentMethod = item.payment_method || (resolvedCreditCardId ? 'credit_card' : 'other')

      if (resolvedPaymentMethod === 'credit_card' && !resolvedCreditCardId) {
        hasMissingCreditCardReference = true
        return []
      }

      if (!effectiveDate || !resolvedCategoryId) {
        return []
      }

      if (installmentCount <= 1) {
        const closingDay = resolveClosingDayForDate(effectiveDate)
        const billCompetence =
          resolvedPaymentMethod === 'credit_card' && Number.isFinite(closingDay)
            ? resolveBillCompetence(effectiveDate, Number(closingDay))
            : undefined

        return [{
          amount: item.amount,
          report_weight: item.report_weight,
          date: effectiveDate,
          category_id: resolvedCategoryId,
          payment_method: resolvedPaymentMethod,
          ...(resolvedCreditCardId ? { credit_card_id: resolvedCreditCardId } : {}),
          ...(billCompetence ? { bill_competence: billCompetence } : {}),
          description: item.description,
          ...(userId ? { user_id: userId } : {}),
        }]
      }

      const installmentGroupId = generateUuid()
      const installmentAmounts = splitInstallmentAmounts(item.amount, installmentCount)
      const installmentDates = buildInstallmentDates(effectiveDate, installmentCount)

      return installmentAmounts.map((installmentAmount, index) => {
        const installmentDate = installmentDates[index]
        const closingDay = resolveClosingDayForDate(installmentDate)
        const billCompetence =
          resolvedPaymentMethod === 'credit_card' && Number.isFinite(closingDay)
            ? resolveBillCompetence(installmentDate, Number(closingDay))
            : undefined

        return {
          amount: installmentAmount,
          report_weight: item.report_weight,
          date: installmentDate,
          category_id: resolvedCategoryId,
          payment_method: resolvedPaymentMethod,
          ...(resolvedCreditCardId ? { credit_card_id: resolvedCreditCardId } : {}),
          ...(billCompetence ? { bill_competence: billCompetence } : {}),
          description: item.description,
          installment_group_id: installmentGroupId,
          installment_number: index + 1,
          installment_total: installmentCount,
          ...(userId ? { user_id: userId } : {}),
        }
      })
    }))

    const expensePayload = expensePayloadNested.flat()

    if (hasMissingCreditCardReference) {
      return { status: 'failed', message: 'Não encontrei o cartão informado. Verifique o nome do cartão e tente novamente.', commandId: command.id }
    }

    if (expensePayload.some((item) => !item.date || !item.category_id)) {
      return { status: 'failed', message: 'Não foi possível resolver data/categoria para todas as despesas.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert(expensePayload)
      .select('id')

    if (error) {
      if (shouldQueueOffline(error)) {
        expensePayload.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'expenses',
            action: 'create',
            payload,
            idempotencyKey: `${command.id}:expense:${index}`,
          })
        })
        queuedOfflineCounts.expense += expensePayload.length
      } else {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    } else {
      createdIds.push(...(data?.map((item) => item.id) || []))
    }
  }

  if (incomeItems.length) {
    const { data: incomeCategories } = await supabase
      .from('income_categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedIncomeId = (incomeCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id
    const fallbackIncomeCategoryId = uncategorizedIncomeId || (incomeCategories || [])[0]?.id

    const incomePayload = await Promise.all(incomeItems.map(async (item) => {
      let resolvedCategoryId = item.category?.id

      if (!resolvedCategoryId && item.description) {
        const resolution = await resolveCategory('add_income', {
          amount: item.amount,
          description: item.description,
          date: item.date || slots.date,
          month: item.month || slots.month,
        })
        resolvedCategoryId = resolution.selectedCategory?.id
      }

      resolvedCategoryId = resolvedCategoryId || fallbackIncomeCategoryId

      return {
        amount: item.amount,
        report_weight: item.report_weight,
        date: item.date || slots.date,
        income_category_id: resolvedCategoryId,
        type: 'other',
        description: item.description,
        ...(userId ? { user_id: userId } : {}),
      }
    }))

    if (incomePayload.some((item) => !item.date || !item.income_category_id)) {
      return { status: 'failed', message: 'Não foi possível resolver data/categoria para todas as rendas.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('incomes')
      .insert(incomePayload)
      .select('id')

    if (error) {
      if (shouldQueueOffline(error)) {
        incomePayload.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'incomes',
            action: 'create',
            payload,
            idempotencyKey: `${command.id}:income:${index}`,
          })
        })
        queuedOfflineCounts.income += incomePayload.length
      } else {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    } else {
      createdIds.push(...(data?.map((item) => item.id) || []))
    }
  }

  if (investmentItems.length) {
    const investmentPayload = investmentItems.map((item) => ({
      amount: item.amount,
      month: item.month || slots.month,
      description: item.description,
      ...(userId ? { user_id: userId } : {}),
    }))

    if (investmentPayload.some((item) => !item.month)) {
      return { status: 'failed', message: 'Não foi possível resolver o mês para todos os investimentos.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('investments')
      .insert(investmentPayload)
      .select('id')

    if (error) {
      if (shouldQueueOffline(error)) {
        investmentPayload.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'investments',
            action: 'create',
            payload,
            idempotencyKey: `${command.id}:investment:${index}`,
          })
        })
        queuedOfflineCounts.investment += investmentPayload.length
      } else {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    } else {
      createdIds.push(...(data?.map((item) => item.id) || []))
    }
  }

  const totalQueuedOffline = queuedOfflineCounts.expense + queuedOfflineCounts.income + queuedOfflineCounts.investment

  if (createdIds.length || totalQueuedOffline > 0) {
    const launchedTypesCount = [
      (expenseItems.length - queuedOfflineCounts.expense) > 0
        ? `${expenseItems.length - queuedOfflineCounts.expense} despesa${(expenseItems.length - queuedOfflineCounts.expense) > 1 ? 's' : ''}`
        : undefined,
      (incomeItems.length - queuedOfflineCounts.income) > 0
        ? `${incomeItems.length - queuedOfflineCounts.income} renda${(incomeItems.length - queuedOfflineCounts.income) > 1 ? 's' : ''}`
        : undefined,
      (investmentItems.length - queuedOfflineCounts.investment) > 0
        ? `${investmentItems.length - queuedOfflineCounts.investment} investimento${(investmentItems.length - queuedOfflineCounts.investment) > 1 ? 's' : ''}`
        : undefined,
    ].filter(Boolean)

    const queuedTypesCount = [
      queuedOfflineCounts.expense > 0 ? `${queuedOfflineCounts.expense} despesa${queuedOfflineCounts.expense > 1 ? 's' : ''}` : undefined,
      queuedOfflineCounts.income > 0 ? `${queuedOfflineCounts.income} renda${queuedOfflineCounts.income > 1 ? 's' : ''}` : undefined,
      queuedOfflineCounts.investment > 0 ? `${queuedOfflineCounts.investment} investimento${queuedOfflineCounts.investment > 1 ? 's' : ''}` : undefined,
    ].filter(Boolean)

    const onlineMessage = launchedTypesCount.length > 1
      ? `Lançamentos adicionados com sucesso: ${launchedTypesCount.join(', ')}.`
      : launchedTypesCount.length === 1
        ? 'Lançamento adicionado com sucesso.'
        : ''

    const offlineMessage = queuedTypesCount.length
      ? `Sem conexão no momento. ${queuedTypesCount.join(', ')} ${queuedTypesCount.length > 1 ? 'foram enfileirados' : 'foi enfileirado'} para sincronização automática.`
      : ''

    return {
      status: 'executed',
      message: [onlineMessage, offlineMessage].filter(Boolean).join(' '),
      commandId: command.id,
      transactionId: createdIds[0],
    }
  }

  return { status: 'failed', message: 'Não foi possível criar lançamentos com os dados informados.', commandId: command.id }
}

const saveMappingIfPossible = async (command: AssistantCommand, confirmed: boolean) => {
  if (!confirmed || !command.slots_json?.description || !command.slots_json.category?.id) return

  if (command.interpreted_intent !== 'add_expense' && command.interpreted_intent !== 'add_income') {
    return
  }

  const mappingUserId = command.user_id || await getCurrentUserId()
  if (!mappingUserId) return

  const transactionType = command.interpreted_intent === 'add_expense' ? 'expense' : 'income'
  const payload = {
    user_id: mappingUserId,
    phrase: command.slots_json.description,
    transaction_type: transactionType,
    confidence: command.slots_json.category.confidence,
    category_id: transactionType === 'expense' ? command.slots_json.category.id : null,
    income_category_id: transactionType === 'income' ? command.slots_json.category.id : null,
    last_used_at: new Date().toISOString(),
  }

  await supabase.from('assistant_category_mappings').insert([payload])
}

const ensureSession = async (
  deviceId: string,
  locale: string = DEFAULT_LOCALE,
): Promise<AssistantSession> => {
  const userId = await getCurrentUserId()

  let activeSessionQuery = supabase
    .from('assistant_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (userId) {
    activeSessionQuery = activeSessionQuery.eq('user_id', userId)
  }

  const { data: activeSession } = await activeSessionQuery.maybeSingle()

  if (activeSession) {
    if (!activeSession.user_id && userId) {
      const { data: updatedSession } = await supabase
        .from('assistant_sessions')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', activeSession.id)
        .select('*')
        .single()

      return updatedSession || activeSession
    }

    return activeSession
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const { data: createdSession, error } = await supabase
    .from('assistant_sessions')
    .insert([
      {
        device_id: deviceId,
        platform: 'android',
        locale,
        user_id: userId,
        status: 'active',
        expires_at: expiresAt,
      },
    ])
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdSession
}

const resolveReadOnlyIntent = async (
  intent: AssistantIntent,
  month?: string,
): Promise<{ message: string; payload?: Record<string, unknown> }> => {
  const targetMonth = clampMonthToAppStart(month || format(new Date(), 'yyyy-MM'))
  const start = format(startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')
  const end = format(endOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')

  if (intent === 'get_month_balance') {
    if (!(await monthHasAnyData(targetMonth))) {
      return {
        message: `Não encontrei lançamentos em ${targetMonth}. Posso analisar apenas meses com dados.`,
        payload: {
          month: targetMonth,
          hasData: false,
        },
      }
    }

    const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
      supabase.from('expenses').select('amount').gte('date', start).lte('date', end),
      supabase.from('incomes').select('amount').gte('date', start).lte('date', end),
      supabase.from('investments').select('amount').eq('month', targetMonth),
    ])

    const totalExpenses = (expensesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const totalIncomes = (incomesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const totalInvestments = (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const balance = totalIncomes - totalExpenses - totalInvestments

    return {
      message: `Seu saldo de ${targetMonth} é ${formatCurrencyCompactBR(balance)}.`,
      payload: {
        month: targetMonth,
        totalExpenses,
        totalIncomes,
        totalInvestments,
        balance,
      },
    }
  }

  if (intent === 'list_recent_transactions') {
    const [expensesResult, incomesResult] = await Promise.all([
      supabase.from('expenses').select('id, amount, date, description').order('date', { ascending: false }).limit(5),
      supabase.from('incomes').select('id, amount, date, description').order('date', { ascending: false }).limit(5),
    ])

    return {
      message: 'Busquei seus últimos lançamentos.',
      payload: {
        expenses: expensesResult.data || [],
        incomes: incomesResult.data || [],
      },
    }
  }

  return {
    message: 'No momento, posso adicionar despesas, rendas e investimentos por comando de voz.',
  }
}

const monthHasAnyData = async (month: string): Promise<boolean> => {
  const start = `${month}-01`
  const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
  const end = format(endOfMonth(parsedStart), 'yyyy-MM-dd')

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    supabase.from('expenses').select('id').gte('date', start).lte('date', end).limit(1),
    supabase.from('incomes').select('id').gte('date', start).lte('date', end).limit(1),
    supabase.from('investments').select('id').eq('month', month).limit(1),
  ])

  const hasExpenses = (expensesResult.data || []).length > 0
  const hasIncomes = (incomesResult.data || []).length > 0
  const hasInvestments = (investmentsResult.data || []).length > 0

  return hasExpenses || hasIncomes || hasInvestments
}

const getMonthRange = (month: string) => {
  const start = `${month}-01`
  const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
  const monthEndDate = endOfMonth(parsedStart)

  return {
    start,
    parsedStart,
    end: format(monthEndDate, 'yyyy-MM-dd'),
    daysInMonth: monthEndDate.getDate(),
  }
}

const getAnalysisEndDate = (month: string, dayOfMonth: number) => {
  const { parsedStart, daysInMonth } = getMonthRange(month)
  const boundedDay = Math.max(1, Math.min(dayOfMonth, daysInMonth))
  return format(new Date(parsedStart.getFullYear(), parsedStart.getMonth(), boundedDay), 'yyyy-MM-dd')
}

const isValidMonthDate = (month: string, dateValue: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return false
  if (!dateValue.startsWith(`${month}-`)) return false

  const parsed = parse(dateValue, 'yyyy-MM-dd', new Date())
  if (!isValid(parsed)) return false

  return format(parsed, 'yyyy-MM-dd') === dateValue
}

const sanitizeReportWeight = (reportWeight?: number | null) => {
  const parsedWeight = Number(reportWeight ?? 1)

  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 1) {
    return {
      weight: 1,
      corrected: true,
    }
  }

  return {
    weight: parsedWeight,
    corrected: false,
  }
}


const fetchMonthInsightDataset = async (
  month: string,
  options?: { analysisEndDate?: string },
) => {
  const { start, end } = getMonthRange(month)
  const analysisEndDate = options?.analysisEndDate

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount, report_weight, date, description, category:categories(name)')
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('incomes')
      .select('amount, report_weight, date, description')
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('investments')
      .select('amount')
      .eq('month', month),
  ])

  const rawExpenses = (expensesResult.data || []) as InsightExpenseRow[]
  const rawIncomes = (incomesResult.data || []) as InsightIncomeRow[]
  const validation = createInsightValidationSummary()

  const expenses = rawExpenses.reduce<InsightExpenseRow[]>((acc, item) => {
    const amount = Number(item.amount || 0)
    const date = String(item.date || '')

    if (!Number.isFinite(amount) || amount <= 0 || !isValidMonthDate(month, date)) {
      validation.invalidExpenseRows += 1
      return acc
    }

    if (analysisEndDate && date > analysisEndDate) {
      validation.ignoredFutureRows += 1
      return acc
    }

    const { weight, corrected } = sanitizeReportWeight(item.report_weight)
    if (corrected) validation.correctedWeights += 1

    acc.push({
      ...item,
      amount,
      date,
      report_weight: weight,
    })

    return acc
  }, [])

  const incomes = rawIncomes.reduce<InsightIncomeRow[]>((acc, item) => {
    const amount = Number(item.amount || 0)
    const date = String(item.date || '')

    if (!Number.isFinite(amount) || amount <= 0 || !isValidMonthDate(month, date)) {
      validation.invalidIncomeRows += 1
      return acc
    }

    if (analysisEndDate && date > analysisEndDate) {
      validation.ignoredFutureRows += 1
      return acc
    }

    const { weight, corrected } = sanitizeReportWeight(item.report_weight)
    if (corrected) validation.correctedWeights += 1

    acc.push({
      ...item,
      amount,
      date,
      report_weight: weight,
    })

    return acc
  }, [])

  const investments = ((investmentsResult.data || []) as Array<{ amount?: number | null }>)
    .map((item) => Number(item.amount || 0))
    .filter((amount) => Number.isFinite(amount) && amount > 0)

  return {
    expenses,
    incomes,
    investments,
    validation,
    totals: {
      expenses: expenses.reduce((sum, item) => sum + getWeightedAmount(Number(item.amount || 0), item.report_weight), 0),
      incomes: incomes.reduce((sum, item) => sum + getWeightedAmount(Number(item.amount || 0), item.report_weight), 0),
      investments: investments.reduce((sum, amount) => sum + amount, 0),
    },
  }
}

const fetchHistoricalMonthSeries = async (targetMonth: string, lookbackMonths: number) => {
  const recentMonths = buildRecentMonths(targetMonth, lookbackMonths)
  const firstMonth = recentMonths[0]
  const lastMonth = recentMonths[recentMonths.length - 1]

  const rangeStart = `${firstMonth}-01`
  const rangeEnd = format(endOfMonth(parse(`${lastMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount, report_weight, date')
      .gte('date', rangeStart)
      .lte('date', rangeEnd),
    supabase
      .from('incomes')
      .select('amount, report_weight, date')
      .gte('date', rangeStart)
      .lte('date', rangeEnd),
    supabase
      .from('investments')
      .select('amount, month')
      .gte('month', firstMonth)
      .lte('month', lastMonth),
  ])

  const expenseByMonth = new Map<string, number>()
  const incomeByMonth = new Map<string, number>()
  const investmentByMonth = new Map<string, number>()

  ;(expensesResult.data || []).forEach((item) => {
    const monthKey = getMonthKeyFromDate(String(item.date || ''))
    if (!monthKey) return
    const weighted = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    if (weighted <= 0) return
    expenseByMonth.set(monthKey, (expenseByMonth.get(monthKey) || 0) + weighted)
  })

  ;(incomesResult.data || []).forEach((item) => {
    const monthKey = getMonthKeyFromDate(String(item.date || ''))
    if (!monthKey) return
    const weighted = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    if (weighted <= 0) return
    incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + weighted)
  })

  ;(investmentsResult.data || []).forEach((item) => {
    const monthKey = String(item.month || '')
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return
    const amount = Number(item.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) return
    investmentByMonth.set(monthKey, (investmentByMonth.get(monthKey) || 0) + amount)
  })

  return recentMonths.map((month) => {
    const expenses = expenseByMonth.get(month) || 0
    const incomes = incomeByMonth.get(month) || 0
    const investments = investmentByMonth.get(month) || 0
    return {
      month,
      expenses,
      incomes,
      investments,
      balance: incomes - expenses - investments,
    }
  })
}

type InsightTimingPhase = 'early' | 'middle' | 'closing' | 'closed'

const getInsightTimingProfile = (targetMonth: string, referenceDate = new Date()) => {
  const currentMonthKey = clampMonthToAppStart(format(referenceDate, 'yyyy-MM'))
  const isClosedMonth = targetMonth < currentMonthKey
  const isCurrentMonth = currentMonthKey === targetMonth
  const { daysInMonth } = getMonthRange(targetMonth)
  const elapsedDays = isCurrentMonth ? Math.min(referenceDate.getDate(), daysInMonth) : daysInMonth
  const isLastDayOfCurrentMonth = isCurrentMonth && referenceDate.getDate() >= daysInMonth
  const isFinalizedAnalysis = isClosedMonth || isLastDayOfCurrentMonth
  const monthProgressPct = (elapsedDays / Math.max(daysInMonth, 1)) * 100
  const analysisEndDate = getAnalysisEndDate(targetMonth, elapsedDays)
  const analysisPhase: InsightTimingPhase = isClosedMonth
    ? 'closed'
    : monthProgressPct < 35
      ? 'early'
      : monthProgressPct < 85
        ? 'middle'
        : 'closing'

  return {
    isClosedMonth,
    isCurrentMonth,
    daysInMonth,
    elapsedDays,
    monthProgressPct,
    analysisEndDate,
    analysisPhase,
    isFinalizedAnalysis,
    allowsConclusiveComparisons: isFinalizedAnalysis,
    allowsMixedComparisons: !isFinalizedAnalysis && (analysisPhase === 'middle' || analysisPhase === 'closing'),
  }
}

export async function interpretAssistantCommand(params: {
  deviceId: string
  text: string
  locale?: string
  confirmationMode?: AssistantConfirmationMode
}): Promise<AssistantInterpretResult> {
  const session = await ensureSession(params.deviceId, params.locale || DEFAULT_LOCALE)
  const userId = session.user_id || await getCurrentUserId()

  // Extract using the new AI Service
  const extracted = await extractIntentAndSlots(params.text)
  const intent = extracted.intent
  const confidence = 0.95 // High confidence when coming from LLM
  
  const slots: AssistantSlots = {
    amount: extracted.slots.amount,
    date: extracted.slots.date,
    month: extracted.slots.month,
    description: extracted.slots.description,
    payment_method: extracted.slots.payment_method,
    credit_card_name: extracted.slots.credit_card_name,
    installment_count: extracted.slots.installment_count,
    items: extracted.slots.items?.map(i => ({
      transactionType: i.transactionType === 'expense' ? 'expense' : i.transactionType === 'income' ? 'income' : 'investment',
      amount: i.amount,
      description: i.description,
      installment_count: i.installment_count,
      payment_method: i.payment_method,
      credit_card_name: i.credit_card_name
    }))
  }

  const categoryResolution = await resolveCategory(intent, slots)
  if (categoryResolution.selectedCategory) {
    slots.category = categoryResolution.selectedCategory
  }

  const confirmationPolicy = resolveConfirmationPolicy({
    intent,
    slots,
    confidence,
    needsCategoryDisambiguation: categoryResolution.needsDisambiguation,
    mode: params.confirmationMode || 'write_only',
  })
  const pendingConfirmation = confirmationPolicy.requiresConfirmation

  const { data: insertedCommand, error } = await supabase
    .from('assistant_commands')
    .insert([
      {
        session_id: session.id,
        user_id: userId,
        command_text: params.text,
        interpreted_intent: intent,
        confidence,
        slots_json: slots,
        category_resolution_json: {
          selectedCategory: categoryResolution.selectedCategory || null,
          candidates: categoryResolution.candidates,
          needsDisambiguation: categoryResolution.needsDisambiguation,
        },
        requires_confirmation: pendingConfirmation,
        status: pendingConfirmation ? 'pending_confirmation' : 'executed',
        idempotency_key: generateIdempotencyKey(session.id, params.text),
      },
    ])
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!pendingConfirmation) {
    const readOnlyResult = await resolveReadOnlyIntent(intent, slots.month)

    await supabase
      .from('assistant_commands')
      .update({
        execution_result_json: readOnlyResult.payload || { message: readOnlyResult.message },
        updated_at: new Date().toISOString(),
      })
      .eq('id', insertedCommand.id)

    return {
      command: insertedCommand,
      intent,
      confidence,
      slots,
      requiresConfirmation: false,
      confirmationText: readOnlyResult.message,
    }
  }

  return {
    command: insertedCommand,
    intent,
    confidence,
    slots,
    requiresConfirmation: true,
    confirmationText: buildConfirmationText(intent, slots, {
      needsCategoryDisambiguation: categoryResolution.needsDisambiguation,
      categoryCandidates: categoryResolution.candidates,
    }),
  }
}

export async function confirmAssistantCommand(params: {
  commandId: string
  confirmed: boolean
  spokenText?: string
  editedDescription?: string
  editedSlots?: AssistantSlots
  confirmationMethod?: 'voice' | 'touch'
}): Promise<AssistantConfirmResult> {
  const { data: command, error } = await supabase
    .from('assistant_commands')
    .select('*')
    .eq('id', params.commandId)
    .single()

  if (error || !command) {
    throw new Error(error?.message || 'Comando não encontrado.')
  }

  const userId = command.user_id || await getCurrentUserId()

  await supabase.from('assistant_confirmations').insert([
    {
      command_id: command.id,
      session_id: command.session_id,
      user_id: userId,
      confirmed: params.confirmed,
      spoken_text: params.spokenText,
      confirmation_method: params.confirmationMethod || 'voice',
    },
  ])

  if (!params.confirmed) {
    await supabase
      .from('assistant_commands')
      .update({ status: 'denied', updated_at: new Date().toISOString() })
      .eq('id', command.id)

    return {
      status: 'denied',
      message: params.confirmationMethod === 'touch' ? 'Comando cancelado.' : 'Comando cancelado por voz.',
      commandId: command.id,
    }
  }

  if (isCommandExpired(command.created_at)) {
    await supabase
      .from('assistant_commands')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', command.id)

    return {
      status: 'expired',
      message: params.confirmationMethod === 'touch'
        ? 'Confirmação expirada. Refaça o comando.'
        : 'Confirmação expirada. Refaça o comando por voz.',
      commandId: command.id,
    }
  }

  await supabase
    .from('assistant_commands')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', command.id)

  let commandToExecute: AssistantCommand = command
  const needsDisambiguation = Boolean(
    (command.category_resolution_json as { needsDisambiguation?: boolean } | undefined)?.needsDisambiguation,
  )

  const editedDescription = params.editedDescription?.trim()
  const editedSlots = params.editedSlots
  if (editedSlots) {
    const baseSlots = commandToExecute.slots_json || {}

    const normalizedItems = editedSlots.items
      ?.map((item) => ({
        ...item,
        amount: Number(item.amount),
        installment_count: normalizeInstallmentCount(item.installment_count),
        report_weight: Number.isFinite(item.report_weight) ? Number(item.report_weight) : undefined,
        description: item.description?.trim() || undefined,
        date: item.date?.trim() || undefined,
        month: item.month?.trim() || undefined,
      }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0)

    const updatedSlots: AssistantSlots = {
      ...baseSlots,
      ...editedSlots,
      amount: Number.isFinite(editedSlots.amount) ? Number(editedSlots.amount) : baseSlots.amount,
      installment_count: normalizeInstallmentCount(editedSlots.installment_count) || baseSlots.installment_count,
      description: editedSlots.description?.trim() || baseSlots.description,
      date: editedSlots.date?.trim() || baseSlots.date,
      month: editedSlots.month?.trim() || baseSlots.month,
      category: editedSlots.category || baseSlots.category,
      items: normalizedItems ?? baseSlots.items,
    }

    await supabase
      .from('assistant_commands')
      .update({
        slots_json: updatedSlots,
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.id)

    commandToExecute = {
      ...commandToExecute,
      slots_json: updatedSlots,
    }
  }

  if (editedDescription) {
    const sanitizedDescription = normalizeDescriptionCasing(removeLeadingArticle(editedDescription))
    const originalSlots = commandToExecute.slots_json || {}
    const updatedSlots: AssistantSlots = {
      ...originalSlots,
      description: sanitizedDescription,
      items: originalSlots.items?.map((item, index) => {
        if (index !== 0 || (originalSlots.items?.length || 0) > 1) return item
        return {
          ...item,
          description: sanitizedDescription,
        }
      }),
    }

    await supabase
      .from('assistant_commands')
      .update({
        slots_json: updatedSlots,
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.id)

    commandToExecute = {
      ...commandToExecute,
      slots_json: updatedSlots,
    }
  }

  if (needsDisambiguation && (command.interpreted_intent === 'add_expense' || command.interpreted_intent === 'add_income')) {
    const resolvedCategory = resolveCategoryFromSpokenConfirmation(command, params.spokenText)
    if (!resolvedCategory?.id) {
      return {
        status: 'failed',
        message: 'Não consegui identificar a categoria informada na confirmação por voz.',
        commandId: command.id,
      }
    }

    const updatedSlots: AssistantSlots = {
      ...(command.slots_json || {}),
      category: resolvedCategory,
    }

    await supabase
      .from('assistant_commands')
      .update({
        slots_json: updatedSlots,
        category_resolution_json: {
          ...(command.category_resolution_json as Record<string, unknown> || {}),
          selectedCategory: resolvedCategory,
          needsDisambiguation: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.id)

    commandToExecute = {
      ...command,
      slots_json: updatedSlots,
      category_resolution_json: {
        ...(command.category_resolution_json as Record<string, unknown> || {}),
        selectedCategory: resolvedCategory,
        needsDisambiguation: false,
      },
    }
  }

  const execution = await executeWriteIntent(commandToExecute)

  const updatePayload: Record<string, unknown> = {
    status: execution.status,
    execution_result_json: execution,
    updated_at: new Date().toISOString(),
  }

  if (execution.status === 'failed') {
    updatePayload.error_message = execution.message
  }

  await supabase.from('assistant_commands').update(updatePayload).eq('id', command.id)
  await saveMappingIfPossible(commandToExecute, params.confirmed)

  return execution
}

export async function getAssistantMonthlyInsights(month?: string): Promise<AssistantMonthlyInsightsResult> {
  const targetMonth = clampMonthToAppStart(month || format(new Date(), 'yyyy-MM'))


  if (!(await monthHasAnyData(targetMonth))) {
    return {
      month: targetMonth,
      highlights: [`Ainda não há lançamentos em ${targetMonth}. O assistente só interpreta meses com dados.`],
      recommendations: [],
    }
  }

  const currentData = await fetchMonthInsightDataset(targetMonth)

  const expensesForContext = currentData.expenses.map(e => ({
    amount: e.amount,
    category: {
      id: '',
      name: e.category?.name || 'Sem categoria',
      color: '#000000',
      user_id: ''
    },
    date: e.date,
    id: e.date,
    description: e.description || '',
    user_id: '',
    payment_method: 'other',
    installment_count: 1,
    created_at: new Date().toISOString(),
    category_id: ''
  })) as Expense[]

  const incomesForContext = currentData.incomes.map(i => ({
    amount: i.amount,
    type: 'other',
    date: i.date,
    id: i.date,
    description: i.description || '',
    user_id: ''
  } as Income))

  const investmentsForContext = currentData.investments.map((inv, idx) => ({
    amount: inv,
    month: targetMonth,
    id: `inv-${idx}`,
    description: '',
    user_id: ''
  } as Investment))

  const formattedMonthName = new Date(`${targetMonth}-01T12:00:00`).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
  
  const insights = await generateMonthlyInsights({
    monthName: formattedMonthName.charAt(0).toUpperCase() + formattedMonthName.slice(1),
    expenses: expensesForContext,
    incomes: incomesForContext,
    investments: investmentsForContext
  })

  // Fallback to minimal response if AI fails
  if (!insights) {
    return {
      month: targetMonth,
      highlights: ['Não foi possível gerar os insights no momento.'],
      recommendations: []
    }
  }

  return {
    month: insights.month,
    highlights: insights.highlights,
    recommendations: insights.recommendations,
  }
}

export async function getActiveAssistantSession(deviceId: string) {
  return ensureSession(deviceId, DEFAULT_LOCALE)
}

export const assistantParserInternals = {
}
