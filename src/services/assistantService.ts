import { format, isValid, parse, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import type {
  AssistantCommand,
  AssistantConfirmResult,
  AssistantIntent,
  AssistantInterpretResult,
  AssistantMonthlyInsightsResult,
  AssistantResolvedCategory,
  AssistantSession,
  AssistantSlots,
} from '@/types'

interface CategoryLookupItem {
  id: string
  name: string
  color?: string
}

const CONFIRMATION_WINDOW_MS = 2 * 60 * 1000
const DEFAULT_LOCALE = 'pt-BR'
const DEFAULT_CATEGORY_COLOR = '#9ca3af'
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

const WRITE_INTENTS: AssistantIntent[] = [
  'add_expense',
  'add_income',
  'add_investment',
]

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const normalizeAmount = (value: string): number | undefined => {
  const cleaned = value.replace(/\s+/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number(cleaned)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const extractAmount = (text: string): number | undefined => {
  const amountMatch = text.match(/(?:r\$\s*)?(\d+[\d.,]*)/i)
  if (!amountMatch) return undefined
  return normalizeAmount(amountMatch[1])
}

const extractDate = (text: string): string => {
  const normalized = normalizeText(text)
  const today = new Date()

  if (normalized.includes('hoje')) return format(today, 'yyyy-MM-dd')
  if (normalized.includes('ontem')) return format(new Date(today.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd')

  const brDateMatch = normalized.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (brDateMatch) {
    const day = brDateMatch[1].padStart(2, '0')
    const month = brDateMatch[2].padStart(2, '0')
    const year = brDateMatch[3] ? brDateMatch[3].padStart(4, '20') : String(today.getFullYear())
    const parsed = parse(`${day}/${month}/${year}`, 'dd/MM/yyyy', today)
    if (isValid(parsed)) {
      return format(parsed, 'yyyy-MM-dd')
    }
  }

  return format(today, 'yyyy-MM-dd')
}

const normalizeDescriptionCasing = (value: string) => {
  const lowerWords = ['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'no', 'na', 'nos', 'nas', 'com', 'para', 'por']

  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase()
      if (index > 0 && lowerWords.includes(lower)) return lower
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join(' ')
}

const extractDescription = (text: string, intent: AssistantIntent): string | undefined => {
  if (
    intent !== 'add_expense'
    && intent !== 'add_income'
    && intent !== 'add_investment'
    && intent !== 'update_transaction'
    && intent !== 'delete_transaction'
    && intent !== 'create_category'
  ) {
    return text.trim() || undefined
  }

  let description = text.trim()

  description = description
    .replace(/^(adicion(?:e|ar)?|registre|registrar|lance|lancar|lançar|inclua|incluir|atualize|atualizar|edite|editar|corrija|corrigir|apague|apagar|exclua|excluir|delete|deletar|remova|remover)\s+/i, '')
    .replace(/^(uma|um)\s+/i, '')

  description = description.replace(/^(a|o|as|os)\s+/i, '')

  if (intent === 'create_category') {
    description = description
      .replace(/^(crie|criar|adicione|adicionar)\s+/i, '')
      .replace(/^(uma|um)\s+/i, '')
      .replace(/^(nova|novo)\s+/i, '')
      .replace(/^(categoria)\s+/i, '')
      .replace(/^(de\s+)?(despesa|gasto|renda|receita)\s+/i, '')
      .replace(/^(chamada|com\s+nome|nome)\s+/i, '')
  }

  if (intent === 'add_expense') {
    description = description.replace(/^(despesa|gasto|conta)\s*(de|da|do|das|dos)?\s*/i, '')
  }

  if (intent === 'add_income') {
    description = description.replace(/^(renda|receita|ganho|sal[aá]rio)\s*(de|da|do|das|dos)?\s*/i, '')
  }

  if (intent === 'add_investment') {
    description = description.replace(/^(investimento|aporte)\s*(de|da|do|das|dos)?\s*/i, '')
  }

  if (intent === 'update_transaction') {
    description = description
      .replace(/^(a|o)\s+/i, '')
      .replace(/^(transacao|transação|lancamento|lançamento|despesa|renda|investimento)\s+/i, '')
      .replace(/^(para|como)\s+/i, '')
      .replace(/\s+(para|como)\s+.*$/i, '')
  }

  if (intent === 'delete_transaction') {
    description = description
      .replace(/^(a|o)\s+/i, '')
      .replace(/^(transacao|transação|lancamento|lançamento|despesa|renda|investimento)\s+/i, '')
      .replace(/^(de|da|do)\s+/i, '')
  }

  description = description
    .replace(/\b(despesa|gasto|conta|renda|receita|ganho|sal[aá]rio|investimento|aporte)\b/gi, ' ')
    .replace(/\b(no\s+valor\s+de|valor\s+de|valor)\b/gi, ' ')
    .replace(/\b(adiciona(?:r)?|adicione|adicionar|registre|registrar|lance|lançar|lancar|inclua|incluir)\b/gi, ' ')
    .replace(/\br\$\s*\d+[\d.,]*/gi, ' ')
    .replace(/\b\d+[\d.,]*\b/g, ' ')
    .replace(/\b(de|da|do|das|dos)\s+(para|pra)\b/gi, ' ')
    .replace(/\b(hoje|ontem)\b/gi, ' ')
    .replace(/\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/g, ' ')
    .replace(/[,:;.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  description = description
    .replace(/^(de|da|do|das|dos|em|no|na|nos|nas)\s+/i, '')
    .replace(/^(para|pra)\s+(o|a|os|as)\s+/i, '')
    .replace(/^(para|pra)\s+/i, '')
    .replace(/^(a|o|as|os)\s+/i, '')
    .replace(/\s+(no|na|nos|nas)\s*$/i, '')
    .trim()

  if (intent === 'add_expense' || intent === 'add_income' || intent === 'add_investment') {
    const contextualMatch = description.match(/(?:para|pra)\s+(?:o|a|os|as)?\s*(.+)$/i)
      || description.match(/(?:de|da|do|das|dos)\s+(?:um|uma)?\s*(.+)$/i)

    if (contextualMatch?.[1]) {
      const contextualDescription = contextualMatch[1]
        .replace(/[,:;.!?]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      if (contextualDescription.length >= 2) {
        description = contextualDescription
      }
    }
  }

  if (!description) return undefined

  return normalizeDescriptionCasing(description)
}

const cleanSpeechNoise = (text: string) => {
  return text
    .replace(/\b(ah+|eh+|uh+|hum+|hã+|tipo|assim|né|né\?)\b/gi, ' ')
    .replace(/[\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const extractAddItemsFromText = (
  text: string,
  intent: AssistantIntent,
  fallbackDate: string,
): AssistantSlots['items'] => {
  if (intent !== 'add_expense' && intent !== 'add_income' && intent !== 'add_investment') {
    return undefined
  }

  const cleaned = cleanSpeechNoise(text)
  const commandRemoved = cleaned
    .replace(/^(adicion(?:a|ar|e)?|registre|registrar|lance|lan[çc]ar|inclua|incluir)\s+/i, '')
    .replace(/^(uma|um|as|os)\s+/i, '')
    .replace(/^(a|o)\s+/i, '')

  const chunkCandidates = commandRemoved
    .split(/\s+(?:e|mais|tamb[eé]m)\s+|;|,/i)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  if (!chunkCandidates.length) return undefined

  const parsedItems = chunkCandidates
    .map((chunk) => {
      const amountMatch = chunk.match(/(?:r\$\s*)?(\d+[\d.,]*)/i)
      if (!amountMatch) return null

      const amount = normalizeAmount(amountMatch[1])
      if (!amount) return null

      const rawDescription = chunk
        .replace(amountMatch[0], ' ')
        .replace(/\b(despesa|gasto|conta|renda|receita|ganho|sal[aá]rio|investimento|aporte)\b/gi, ' ')
        .replace(/[,:;.!?]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      const polishedDescription = rawDescription
        ? normalizeDescriptionCasing(
          rawDescription
            .replace(/^(de|da|do|das|dos|para|pra|a|o|as|os)\s+/i, '')
            .trim(),
        )
        : undefined

      if (intent === 'add_investment') {
        return {
          amount,
          description: polishedDescription,
          date: fallbackDate,
          month: fallbackDate.substring(0, 7),
        }
      }

      return {
        amount,
        description: polishedDescription,
        date: fallbackDate,
        month: fallbackDate.substring(0, 7),
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return parsedItems.length > 1 ? parsedItems : undefined
}

const inferIntent = (text: string): { intent: AssistantIntent; confidence: number } => {
  const normalized = normalizeText(text)

  if (/invest|aporte/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_investment', confidence: 0.9 }
  }

  if (/renda|receita|ganho|salario|salário/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_income', confidence: 0.9 }
  }

  if (/despesa|gasto|conta/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_expense', confidence: 0.9 }
  }

  return { intent: 'unknown', confidence: 0.3 }
}

const buildSlots = (text: string, intent: AssistantIntent): AssistantSlots => {
  const amount = extractAmount(text)
  const date = extractDate(text)
  const description = extractDescription(text, intent)
  const items = extractAddItemsFromText(text, intent, date)

  if (intent === 'add_investment') {
    return {
      amount,
      description,
      month: date.substring(0, 7),
      date,
      items,
    }
  }

  return {
    amount,
    description,
    date,
    month: date.substring(0, 7),
    items,
  }
}

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

const requiresConfirmation = (intent: AssistantIntent) => WRITE_INTENTS.includes(intent)

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
      .map((item) => `${item.description || 'Sem descrição'} (R$${item.amount.toFixed(2)})`)
      .join(', ')

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
    return `Confirma despesa de R$${(slots.amount ?? 0).toFixed(2)} em ${slots.category?.name || 'Sem categoria'} na data ${slots.date}?`
  }

  if (intent === 'add_income') {
    return `Confirma renda de R$${(slots.amount ?? 0).toFixed(2)} em ${slots.category?.name || 'Sem categoria'} na data ${slots.date}?`
  }

  if (intent === 'add_investment') {
    return `Confirma investimento de R$${(slots.amount ?? 0).toFixed(2)} para ${slots.month}?`
  }

  if (intent === 'update_transaction') {
    const parts: string[] = []
    if (slots.amount) {
      parts.push(`valor para R$${slots.amount.toFixed(2)}`)
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
      return `Confirma excluir lançamento de R$${slots.amount.toFixed(2)}?`
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

interface WritableTransactionRecord {
  id: string
  amount: number
  description?: string
  dateOrMonth: string
  type: WritableTransactionType
}

const inferUpdateTargetType = (commandText: string): WritableTransactionType | 'auto' => {
  const normalized = normalizeText(commandText)
  if (/invest|aporte/.test(normalized)) return 'investment'
  if (/renda|receita|salario|salário|ganho/.test(normalized)) return 'income'
  if (/despesa|gasto|conta/.test(normalized)) return 'expense'
  return 'auto'
}

const scoreRecordMatch = (recordDescription: string | undefined, tokens: string[]) => {
  if (!recordDescription || !tokens.length) return 0
  const normalized = normalizeText(recordDescription)
  return tokens.reduce((score, token) => (normalized.includes(token) ? score + 1 : score), 0)
}

const amountIsClose = (valueA: number, valueB: number) => Math.abs(valueA - valueB) <= 0.01

const resolveCreateCategoryType = (commandText: string, description?: string): 'expense' | 'income' => {
  const normalized = normalizeText(`${commandText} ${description || ''}`)
  if (/renda|receita|ganho|salario|salário/.test(normalized)) return 'income'
  return 'expense'
}

const findBestRecordForMutation = async (
  command: AssistantCommand,
  userId?: string,
): Promise<WritableTransactionRecord | null> => {
  const targetType = inferUpdateTargetType(command.command_text)
  const descriptionTokens = normalizeText(command.slots_json?.description || '')
    .split(/\s+/)
    .filter((token) => token.length >= 3)

  const queryExpenses = supabase
    .from('expenses')
    .select('id, amount, description, date')
    .order('date', { ascending: false })
    .limit(25)

  const queryIncomes = supabase
    .from('incomes')
    .select('id, amount, description, date')
    .order('date', { ascending: false })
    .limit(25)

  const queryInvestments = supabase
    .from('investments')
    .select('id, amount, description, month')
    .order('month', { ascending: false })
    .limit(25)

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    targetType === 'income' || targetType === 'investment'
      ? Promise.resolve({ data: [] as Array<{ id: string; amount: number; description?: string; date: string }> })
      : (userId ? queryExpenses.eq('user_id', userId) : queryExpenses),
    targetType === 'expense' || targetType === 'investment'
      ? Promise.resolve({ data: [] as Array<{ id: string; amount: number; description?: string; date: string }> })
      : (userId ? queryIncomes.eq('user_id', userId) : queryIncomes),
    targetType === 'expense' || targetType === 'income'
      ? Promise.resolve({ data: [] as Array<{ id: string; amount: number; description?: string; month: string }> })
      : (userId ? queryInvestments.eq('user_id', userId) : queryInvestments),
  ])

  const allRecords: WritableTransactionRecord[] = [
    ...(expensesResult.data || []).map((item) => ({
      id: item.id,
      amount: Number(item.amount),
      description: item.description,
      dateOrMonth: item.date,
      type: 'expense' as const,
    })),
    ...(incomesResult.data || []).map((item) => ({
      id: item.id,
      amount: Number(item.amount),
      description: item.description,
      dateOrMonth: item.date,
      type: 'income' as const,
    })),
    ...(investmentsResult.data || []).map((item) => ({
      id: item.id,
      amount: Number(item.amount),
      description: item.description,
      dateOrMonth: item.month,
      type: 'investment' as const,
    })),
  ]

  if (!allRecords.length) return null

  const targetAmount = command.slots_json?.amount

  const scored = allRecords
    .map((record) => ({
      record,
      score:
        scoreRecordMatch(record.description, descriptionTokens)
        + (Number.isFinite(targetAmount) && amountIsClose(record.amount, Number(targetAmount)) ? 2 : 0),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.record.dateOrMonth.localeCompare(a.record.dateOrMonth)
    })

  return scored[0]?.record || null
}

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

  const addItems =
    (slots.items && slots.items.length
      ? slots.items
      : (slots.amount
          ? [{
            amount: Number(slots.amount),
            description: slots.description,
            date: slots.date,
            month: slots.month,
            category: slots.category,
          }]
          : []))

  if (command.interpreted_intent === 'add_expense') {
    if (!addItems.length) {
      return { status: 'failed', message: 'Comando incompleto para despesa.', commandId: command.id }
    }

    const { data: expenseCategories } = await supabase
      .from('categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedExpenseId = (expenseCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id

    const payload = await Promise.all(addItems.map(async (item) => {
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

      resolvedCategoryId = resolvedCategoryId || uncategorizedExpenseId

      return {
        amount: item.amount,
        date: item.date || slots.date,
        category_id: resolvedCategoryId,
        description: item.description,
        user_id: userId,
      }
    }))

    if (payload.some((item) => !item.date || !item.category_id)) {
      return { status: 'failed', message: 'Não foi possível resolver data/categoria para todas as despesas.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert(payload)
      .select('id')

    if (error) {
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    const createdIds = data?.map((item) => item.id) || []
    return {
      status: 'executed',
      message: createdIds.length > 1
        ? `${createdIds.length} despesas adicionadas com sucesso.`
        : 'Despesa adicionada com sucesso.',
      commandId: command.id,
      transactionId: createdIds[0],
    }
  }

  if (command.interpreted_intent === 'add_income') {
    if (!addItems.length) {
      return { status: 'failed', message: 'Comando incompleto para renda.', commandId: command.id }
    }

    const { data: incomeCategories } = await supabase
      .from('income_categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedIncomeId = (incomeCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id

    const payload = await Promise.all(addItems.map(async (item) => {
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

      resolvedCategoryId = resolvedCategoryId || uncategorizedIncomeId

      return {
        amount: item.amount,
        date: item.date || slots.date,
        income_category_id: resolvedCategoryId,
        type: 'other',
        description: item.description,
        user_id: userId,
      }
    }))

    if (payload.some((item) => !item.date || !item.income_category_id)) {
      return { status: 'failed', message: 'Não foi possível resolver data/categoria para todas as rendas.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('incomes')
      .insert(payload)
      .select('id')

    if (error) {
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    const createdIds = data?.map((item) => item.id) || []
    return {
      status: 'executed',
      message: createdIds.length > 1
        ? `${createdIds.length} rendas adicionadas com sucesso.`
        : 'Renda adicionada com sucesso.',
      commandId: command.id,
      transactionId: createdIds[0],
    }
  }

  if (command.interpreted_intent === 'add_investment') {
    if (!addItems.length) {
      return { status: 'failed', message: 'Comando incompleto para investimento.', commandId: command.id }
    }

    const payload = addItems.map((item) => ({
      amount: item.amount,
      month: item.month || slots.month,
      description: item.description,
      user_id: userId,
    }))

    if (payload.some((item) => !item.month)) {
      return { status: 'failed', message: 'Não foi possível resolver o mês para todos os investimentos.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('investments')
      .insert(payload)
      .select('id')

    if (error) {
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    const createdIds = data?.map((item) => item.id) || []
    return {
      status: 'executed',
      message: createdIds.length > 1
        ? `${createdIds.length} investimentos adicionados com sucesso.`
        : 'Investimento adicionado com sucesso.',
      commandId: command.id,
      transactionId: createdIds[0],
    }
  }

  if (command.interpreted_intent === 'update_transaction') {
    const hasAmountUpdate = Number.isFinite(slots.amount)
    const hasDescriptionUpdate = !!slots.description

    if (!hasAmountUpdate && !hasDescriptionUpdate) {
      return {
        status: 'failed',
        message: 'Comando incompleto para atualização. Informe novo valor e/ou descrição.',
        commandId: command.id,
      }
    }

    const targetRecord = await findBestRecordForMutation(command, userId)
    if (!targetRecord) {
      return {
        status: 'failed',
        message: 'Não encontrei lançamento para atualizar.',
        commandId: command.id,
      }
    }

    const updates: Record<string, unknown> = {}
    if (hasAmountUpdate) updates.amount = slots.amount
    if (hasDescriptionUpdate) updates.description = slots.description

    if (targetRecord.type === 'expense') {
      const { error } = await supabase.from('expenses').update(updates).eq('id', targetRecord.id)
      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    }

    if (targetRecord.type === 'income') {
      const { error } = await supabase.from('incomes').update(updates).eq('id', targetRecord.id)
      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    }

    if (targetRecord.type === 'investment') {
      const { error } = await supabase.from('investments').update(updates).eq('id', targetRecord.id)
      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    }

    return {
      status: 'executed',
      message: `Lançamento ${targetRecord.type} atualizado com sucesso.`,
      commandId: command.id,
      transactionId: targetRecord.id,
    }
  }

  if (command.interpreted_intent === 'delete_transaction') {
    const targetRecord = await findBestRecordForMutation(command, userId)
    if (!targetRecord) {
      return {
        status: 'failed',
        message: 'Não encontrei lançamento para excluir.',
        commandId: command.id,
      }
    }

    if (targetRecord.type === 'expense') {
      const { error } = await supabase.from('expenses').delete().eq('id', targetRecord.id)
      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    }

    if (targetRecord.type === 'income') {
      const { error } = await supabase.from('incomes').delete().eq('id', targetRecord.id)
      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    }

    if (targetRecord.type === 'investment') {
      const { error } = await supabase.from('investments').delete().eq('id', targetRecord.id)
      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    }

    return {
      status: 'executed',
      message: `Lançamento ${targetRecord.type} excluído com sucesso.`,
      commandId: command.id,
      transactionId: targetRecord.id,
    }
  }

  if (command.interpreted_intent === 'create_category') {
    const categoryName = command.slots_json?.description?.trim()
    if (!categoryName) {
      return {
        status: 'failed',
        message: 'Comando incompleto para criar categoria. Informe o nome da categoria.',
        commandId: command.id,
      }
    }

    const categoryType = resolveCreateCategoryType(command.command_text, categoryName)
    const normalizedName = categoryName.replace(/\s+/g, ' ').trim()

    if (categoryType === 'expense') {
      let existsQuery = supabase
        .from('categories')
        .select('id')
        .ilike('name', normalizedName)
        .limit(1)
        .maybeSingle()

      if (userId) {
        existsQuery = supabase
          .from('categories')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', normalizedName)
          .limit(1)
          .maybeSingle()
      }

      const { data: existingCategory } = await existsQuery
      if (existingCategory?.id) {
        return {
          status: 'failed',
          message: 'Já existe uma categoria de despesa com esse nome.',
          commandId: command.id,
          transactionId: existingCategory.id,
        }
      }

      const { data, error } = await supabase
        .from('categories')
        .insert([
          {
            name: normalizeDescriptionCasing(normalizedName),
            color: DEFAULT_CATEGORY_COLOR,
            user_id: userId,
          },
        ])
        .select('id')
        .single()

      if (error) {
        return { status: 'failed', message: error.message, commandId: command.id }
      }

      return {
        status: 'executed',
        message: 'Categoria de despesa criada com sucesso.',
        commandId: command.id,
        transactionId: data.id,
      }
    }

    let existsQuery = supabase
      .from('income_categories')
      .select('id')
      .ilike('name', normalizedName)
      .limit(1)
      .maybeSingle()

    if (userId) {
      existsQuery = supabase
        .from('income_categories')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', normalizedName)
        .limit(1)
        .maybeSingle()
    }

    const { data: existingIncomeCategory } = await existsQuery
    if (existingIncomeCategory?.id) {
      return {
        status: 'failed',
        message: 'Já existe uma categoria de renda com esse nome.',
        commandId: command.id,
        transactionId: existingIncomeCategory.id,
      }
    }

    const { data, error } = await supabase
      .from('income_categories')
      .insert([
        {
          name: normalizeDescriptionCasing(normalizedName),
          color: DEFAULT_CATEGORY_COLOR,
          user_id: userId,
        },
      ])
      .select('id')
      .single()

    if (error) {
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    return {
      status: 'executed',
      message: 'Categoria de renda criada com sucesso.',
      commandId: command.id,
      transactionId: data.id,
    }
  }

  return { status: 'failed', message: 'Intenção de escrita ainda não implementada.', commandId: command.id }
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
  const targetMonth = month || format(new Date(), 'yyyy-MM')
  const start = format(startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')
  const end = format(endOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')

  if (intent === 'get_month_balance') {
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
      message: `Seu saldo de ${targetMonth} é R$${balance.toFixed(2)}.`,
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

const fetchMonthTotals = async (month: string) => {
  const start = `${month}-01`
  const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
  const end = format(endOfMonth(parsedStart), 'yyyy-MM-dd')

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    supabase.from('expenses').select('amount').gte('date', start).lte('date', end),
    supabase.from('incomes').select('amount').gte('date', start).lte('date', end),
    supabase.from('investments').select('amount').eq('month', month),
  ])

  return {
    expenses: (expensesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    incomes: (incomesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    investments: (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }
}

export async function interpretAssistantCommand(params: {
  deviceId: string
  text: string
  locale?: string
}): Promise<AssistantInterpretResult> {
  const session = await ensureSession(params.deviceId, params.locale || DEFAULT_LOCALE)
  const { intent, confidence } = inferIntent(params.text)
  const userId = session.user_id || await getCurrentUserId()

  const slots = buildSlots(params.text, intent)
  const categoryResolution = await resolveCategory(intent, slots)
  if (categoryResolution.selectedCategory) {
    slots.category = categoryResolution.selectedCategory
  }

  const pendingConfirmation = requiresConfirmation(intent)

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
      confirmation_method: 'voice',
    },
  ])

  if (!params.confirmed) {
    await supabase
      .from('assistant_commands')
      .update({ status: 'denied', updated_at: new Date().toISOString() })
      .eq('id', command.id)

    return {
      status: 'denied',
      message: 'Comando cancelado por voz.',
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
      message: 'Confirmação expirada. Refaça o comando por voz.',
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
  const targetMonth = month || format(new Date(), 'yyyy-MM')
  const previousMonth = format(subMonths(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date()), 1), 'yyyy-MM')

  const [currentTotals, previousTotals] = await Promise.all([
    fetchMonthTotals(targetMonth),
    fetchMonthTotals(previousMonth),
  ])

  const currentBalance = currentTotals.incomes - currentTotals.expenses - currentTotals.investments
  const previousBalance = previousTotals.incomes - previousTotals.expenses - previousTotals.investments

  const highlights: string[] = []
  const recommendations: string[] = []

  const expensesDelta = currentTotals.expenses - previousTotals.expenses
  if (expensesDelta > 0) {
    highlights.push(`Despesas subiram R$${expensesDelta.toFixed(2)} em relação a ${previousMonth}.`)
    recommendations.push('Revise categorias com maior crescimento e ajuste metas mensais.')
  } else {
    highlights.push(`Despesas reduziram R$${Math.abs(expensesDelta).toFixed(2)} versus ${previousMonth}.`)
  }

  const incomesDelta = currentTotals.incomes - previousTotals.incomes
  if (incomesDelta < 0) {
    highlights.push(`Rendas caíram R$${Math.abs(incomesDelta).toFixed(2)} em relação a ${previousMonth}.`)
    recommendations.push('Avalie fontes complementares de renda para recompor o fluxo.')
  } else {
    highlights.push(`Rendas cresceram R$${incomesDelta.toFixed(2)} versus ${previousMonth}.`)
  }

  highlights.push(`Saldo estimado de ${targetMonth}: R$${currentBalance.toFixed(2)}.`)

  if (currentBalance < previousBalance) {
    recommendations.push('Priorize despesas fixas e limite compras variáveis nas próximas semanas.')
  }

  if (!recommendations.length) {
    recommendations.push('Mantenha o ritmo atual e atualize limites por categoria para preservar o saldo.')
  }

  return {
    month: targetMonth,
    highlights,
    recommendations,
  }
}

export async function getActiveAssistantSession(deviceId: string) {
  return ensureSession(deviceId, DEFAULT_LOCALE)
}
