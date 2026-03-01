import { addMonths, format, isValid, parse, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { clampDateToAppStart, clampMonthToAppStart } from '@/utils/format'
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

const EXPENSE_CONTEXT_HINTS = [
  'almoco', 'almoçar', 'jantar', 'lanche', 'restaurante', 'mercado', 'compra', 'compras', 'ifood',
  'padaria', 'uber', 'taxi', 'onibus', 'ônibus', 'gasolina', 'combustivel', 'combustível', 'farmacia',
  'farmácia', 'medico', 'médico', 'exame', 'conta', 'despesa', 'gasto',
]

const EXPENSE_ACTION_HINTS = ['gastei', 'paguei', 'comprei', 'deu', 'custou', 'fui', 'pagar', 'gastou']
const INCOME_CONTEXT_HINTS = ['recebi', 'recebemos', 'recebimento', 'ganhei', 'caiu', 'entrou', 'salario', 'salário', 'renda', 'receita', 'freela', 'dividendo', 'provento', 'comissao', 'comissão']
const INVESTMENT_CONTEXT_HINTS = ['investi', 'investimento', 'aporte', 'apliquei', 'aplicacao', 'aplicação', 'corretora']

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
  const compact = value.replace(/\s+/g, '')
  if (!compact) return undefined

  let normalized = compact
  const hasComma = compact.includes(',')
  const hasDot = compact.includes('.')

  if (hasComma && hasDot) {
    const lastComma = compact.lastIndexOf(',')
    const lastDot = compact.lastIndexOf('.')
    const decimalSeparator = lastComma > lastDot ? ',' : '.'

    if (decimalSeparator === ',') {
      normalized = compact.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = compact.replace(/,/g, '')
    }
  } else if (hasComma) {
    normalized = /,\d{1,2}$/.test(compact)
      ? compact.replace(',', '.')
      : compact.replace(/,/g, '')
  } else if (hasDot) {
    normalized = /\.\d{1,2}$/.test(compact)
      ? compact
      : compact.replace(/\./g, '')
  }

  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

const WORD_NUMBER_MAP: Record<string, number> = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezasseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
}

const parseWordNumberUpTo99 = (rawTokens: string[]): number | undefined => {
  const tokens = rawTokens
    .map((token) => normalizeText(token))
    .filter((token) => token && token !== 'e')

  if (!tokens.length) return undefined

  if (tokens.length === 1) {
    return WORD_NUMBER_MAP[tokens[0]]
  }

  if (tokens.length === 2) {
    const tens = WORD_NUMBER_MAP[tokens[0]]
    const unit = WORD_NUMBER_MAP[tokens[1]]
    if (Number.isFinite(tens) && Number.isFinite(unit) && tens >= 20 && unit <= 9) {
      return tens + unit
    }
  }

  return undefined
}

const parseNumericOrWordNumberUpTo99 = (rawTokens: string[]): number | undefined => {
  const tokens = rawTokens
    .map((token) => normalizeText(token))
    .filter((token) => token && token !== 'e')

  if (!tokens.length) return undefined

  const numericToken = tokens.join('')
  if (/^\d{1,2}$/.test(numericToken)) {
    const parsed = Number(numericToken)
    if (Number.isFinite(parsed) && parsed >= 0 && parsed < 100) return parsed
  }

  return parseWordNumberUpTo99(tokens)
}

const parseNumericOrWordWholeAmount = (rawTokens: string[]): number | undefined => {
  const tokens = rawTokens
    .map((token) => normalizeText(token))
    .filter((token) => token && token !== 'e')

  if (!tokens.length) return undefined

  const numericToken = tokens.join('')
  if (/^\d{1,7}$/.test(numericToken)) {
    const parsed = Number(numericToken)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return parseWordNumberUpTo99(tokens)
}

const extractSpokenCurrencyAmount = (text: string): number | undefined => {
  const normalized = normalizeText(text)

  const numericWithComMatch = normalized.match(/\b(\d{1,6})\s+com\s+(\d{1,2})\b/)
  if (numericWithComMatch) {
    const whole = Number(numericWithComMatch[1])
    const cents = Number(numericWithComMatch[2].padEnd(2, '0').slice(0, 2))
    if (Number.isFinite(whole) && Number.isFinite(cents) && cents >= 0 && cents < 100) {
      return Number(`${whole}.${String(cents).padStart(2, '0')}`)
    }
  }

  const numericSplitMatch = normalized.match(/\b(\d{1,6})\s*e\s*(\d{1,2})\s+reais?\b/)
  if (numericSplitMatch) {
    const whole = Number(numericSplitMatch[1])
    const cents = Number(numericSplitMatch[2].padEnd(2, '0').slice(0, 2))
    if (Number.isFinite(whole) && Number.isFinite(cents) && cents >= 0 && cents < 100) {
      return Number(`${whole}.${String(cents).padStart(2, '0')}`)
    }
  }

  const tokenized = normalized.split(/\s+/).filter(Boolean)

  for (let index = 0; index < tokenized.length; index += 1) {
    const token = tokenized[index]
    if (token !== 'real' && token !== 'reais') continue

    const centIndex = tokenized
      .slice(index + 1, index + 9)
      .findIndex((value) => value === 'centavo' || value === 'centavos')

    if (centIndex < 0) continue

    const absoluteCentIndex = index + 1 + centIndex
    const wholeWindow = tokenized.slice(Math.max(0, index - 4), index)
    const centsWindow = tokenized
      .slice(index + 1, absoluteCentIndex)
      .filter((value) => value !== 'e')

    let whole: number | undefined
    for (let start = 0; start < wholeWindow.length; start += 1) {
      const candidate = parseNumericOrWordWholeAmount(wholeWindow.slice(start))
      if (typeof candidate === 'number') {
        whole = candidate
        break
      }
    }

    if (typeof whole !== 'number') continue

    let cents: number | undefined
    for (let start = 0; start < centsWindow.length; start += 1) {
      const candidate = parseNumericOrWordNumberUpTo99(centsWindow.slice(start))
      if (typeof candidate === 'number') {
        cents = candidate
        break
      }
    }

    if (typeof cents !== 'number' || cents < 0 || cents >= 100) continue

    return Number(`${whole}.${String(cents).padStart(2, '0')}`)
  }

  for (let index = 0; index < tokenized.length; index += 1) {
    const token = tokenized[index]
    if (token !== 'real' && token !== 'reais') continue

    const leftWindow = tokenized.slice(Math.max(0, index - 7), index)
    const splitIndexes = leftWindow
      .map((value, idx) => (value === 'e' ? idx : -1))
      .filter((idx) => idx > 0 && idx < leftWindow.length - 1)

    for (const splitIndex of splitIndexes) {
      let whole: number | undefined

      for (let start = 0; start < splitIndex; start += 1) {
        const candidate = parseWordNumberUpTo99(leftWindow.slice(start, splitIndex))
        if (typeof candidate === 'number') {
          whole = candidate
          break
        }
      }

      if (typeof whole !== 'number') continue

      let cents: number | undefined
      for (let end = leftWindow.length; end > splitIndex + 1; end -= 1) {
        const candidate = parseWordNumberUpTo99(leftWindow.slice(splitIndex + 1, end))
        if (typeof candidate === 'number') {
          cents = candidate
          break
        }
      }

      if (typeof cents !== 'number' || cents < 0 || cents >= 100) continue

      return Number(`${whole}.${String(cents).padStart(2, '0')}`)
    }
  }

  return undefined
}

const extractAmount = (text: string): number | undefined => {
  const spokenAmount = extractSpokenCurrencyAmount(text)
  if (spokenAmount) return spokenAmount

  const amountMatch = text.match(/(?:r\$\s*)?(\d+[\d.,]*)/i)
  if (!amountMatch) return undefined
  return normalizeAmount(amountMatch[1])
}

const extractDate = (text: string): string => {
  const normalized = normalizeText(text)
  const today = new Date()

  if (normalized.includes('hoje')) return clampDateToAppStart(format(today, 'yyyy-MM-dd'))
  if (normalized.includes('ontem')) return clampDateToAppStart(format(new Date(today.getTime() - 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))

  const brDateMatch = normalized.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (brDateMatch) {
    const day = brDateMatch[1].padStart(2, '0')
    const month = brDateMatch[2].padStart(2, '0')
    const year = brDateMatch[3] ? brDateMatch[3].padStart(4, '20') : String(today.getFullYear())
    const parsed = parse(`${day}/${month}/${year}`, 'dd/MM/yyyy', today)
    if (isValid(parsed)) {
      return clampDateToAppStart(format(parsed, 'yyyy-MM-dd'))
    }
  }

  return clampDateToAppStart(format(today, 'yyyy-MM-dd'))
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

const removeLeadingArticle = (value: string) => value.replace(/^(a|o|as|os)\s+/i, '').trim()

const toAlphaNumericTokens = (value: string) =>
  normalizeText(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

const extractLocationContext = (text: string): { preposition: string; place: string } | undefined => {
  const locationPattern = /\b(em|no|na|nos|nas|com)\s+([a-zà-ú0-9][\wÀ-ÿ'’.-]*(?:\s+[a-zà-ú0-9][\wÀ-ÿ'’.-]*){0,4})/gi
  const ignoredPlaces = new Set(['valor', 'data', 'hoje', 'ontem', 'despesa', 'renda', 'investimento'])

  let lastMatch: { preposition: string; place: string } | undefined
  let match = locationPattern.exec(text)

  while (match) {
    const preposition = match[1].toLowerCase()
    const placeTokens = match[2]
      .replace(/[,:;.!?]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((token, index, tokens) => {
        if (/^\d+(?:[.,]\d+)?$/.test(token) && index >= tokens.length - 1) return false
        return true
      })

    const trailingNoise = new Set(['deu', 'ficou', 'custou', 'totalizou', 'e', 'mas'])
    while (placeTokens.length && trailingNoise.has(normalizeText(placeTokens[placeTokens.length - 1]))) {
      placeTokens.pop()
    }

    if (normalizeText(placeTokens[placeTokens.length - 1] || '') === 'conta') {
      placeTokens.pop()
      if (normalizeText(placeTokens[placeTokens.length - 1] || '') === 'a') {
        placeTokens.pop()
      }
    }

    const place = placeTokens.join(' ').trim()

    const normalizedPlace = normalizeText(place)
    if (place.length >= 2 && !ignoredPlaces.has(normalizedPlace)) {
      lastMatch = { preposition, place }
    }

    match = locationPattern.exec(text)
  }

  return lastMatch
}

const extractPurchaseObjectPhrase = (text: string): string | undefined => {
  const purchaseMatch = text.match(/\bcomprei\s+(?:um|uma|o|a|os|as)?\s*(.+?)(?=\s+(?:ficou|deu|custou|por)\b|[,.!?;]|$)/i)
  if (!purchaseMatch?.[1]) return undefined

  const phrase = purchaseMatch[1]
    .replace(/[,:;.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return phrase ? normalizeDescriptionCasing(removeLeadingArticle(phrase)) : undefined
}

const inferInvestmentHeadword = (text: string, fallbackDescription?: string): string | undefined => {
  const normalized = normalizeText(text)

  if (/\bbolsa\b/.test(normalized)) return 'Investimento na Bolsa'
  if (/\bcorretora\b/.test(normalized)) return 'Investimento na Corretora'

  const fallback = removeLeadingArticle(fallbackDescription || '')
  if (!fallback) return 'Investimento'

  if (!/^investimento\b/i.test(fallback)) {
    return `Investimento ${fallback}`
  }

  return fallback
}

const inferExpenseHeadword = (text: string, fallbackDescription?: string): string | undefined => {
  const normalized = normalizeText(text)

  if (/\balmoc(?:ar|o|ei)\b/.test(normalized)) return 'Almoço'
  if (/\bjant(?:ar|ei|o)\b/.test(normalized)) return 'Jantar'
  if (/\blanche\b/.test(normalized)) return 'Lanche'
  if (/\b(?:mercado|supermercado)\b/.test(normalized)) return 'Mercado'
  if (/\bcompr(?:a|ar|ei|as)\b/.test(normalized)) return 'Compras'
  if (/\bifood\b/.test(normalized)) return 'Ifood'
  if (/\buber\b/.test(normalized)) return 'Uber'
  if (/\b99\b/.test(normalized)) return 'Transporte'
  if (/\bfarmac(?:ia|ias)\b/.test(normalized)) return 'Farmácia'
  if (/\brestaurante\b/.test(normalized)) return 'Restaurante'

  if (!fallbackDescription) return undefined

  const stopTokens = new Set([
    'fui', 'deu', 'hoje', 'ontem', 'para', 'pra', 'com', 'sem', 'valor', 'gasto', 'despesa', 'renda',
    'investimento', 'no', 'na', 'nos', 'nas', 'em', 'de', 'da', 'do', 'das', 'dos', 'o', 'a', 'os', 'as',
  ])

  const candidateToken = toAlphaNumericTokens(fallbackDescription)
    .find((token) => token.length >= 4 && !stopTokens.has(token))

  return candidateToken ? normalizeDescriptionCasing(candidateToken) : undefined
}

const refineWriteDescription = (
  text: string,
  intent: AssistantIntent,
  fallbackDescription: string,
): string => {
  if (intent === 'add_investment') {
    return inferInvestmentHeadword(text, fallbackDescription) || 'Investimento'
  }

  if (intent !== 'add_expense') {
    return removeLeadingArticle(fallbackDescription)
  }

  const purchaseObject = extractPurchaseObjectPhrase(text)
  const headword = purchaseObject || inferExpenseHeadword(text, fallbackDescription) || removeLeadingArticle(fallbackDescription)
  const location = extractLocationContext(text)
  const normalizedHeadword = removeLeadingArticle(headword)

  if (!location?.place) {
    return normalizedHeadword
  }

  const place = normalizeDescriptionCasing(removeLeadingArticle(location.place))
  if (!place) {
    return normalizedHeadword
  }

  if (!normalizedHeadword) return place

  return `${normalizedHeadword} ${location.preposition} ${place}`
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
    .replace(/\b(deu|ficou|custou|totalizou)\b/gi, ' ')
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

  const normalizedDescription = normalizeDescriptionCasing(description)

  if (intent === 'add_expense' || intent === 'add_income' || intent === 'add_investment') {
    const refined = refineWriteDescription(text, intent, normalizedDescription)
    return refined ? normalizeDescriptionCasing(refined) : undefined
  }

  return normalizeDescriptionCasing(removeLeadingArticle(normalizedDescription))
}

const cleanSpeechNoise = (text: string) => {
  return text
    .replace(/\b(ah+|eh+|uh+|hum+|hã+|tipo|assim|né|né\?)\b/gi, ' ')
    .replace(/[\-–—]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const countHints = (normalizedText: string, hints: string[]) =>
  hints.reduce((score, hint) => (normalizedText.includes(normalizeText(hint)) ? score + 1 : score), 0)

const classifyWriteTransactionType = (text: string): {
  type: 'expense' | 'income' | 'investment'
  scores: Record<'expense' | 'income' | 'investment', number>
} => {
  const normalized = normalizeText(text)

  const scores: Record<'expense' | 'income' | 'investment', number> = {
    expense: 0,
    income: 0,
    investment: 0,
  }

  scores.expense += countHints(normalized, EXPENSE_CONTEXT_HINTS) * 2
  scores.expense += countHints(normalized, EXPENSE_ACTION_HINTS) * 3
  scores.income += countHints(normalized, INCOME_CONTEXT_HINTS) * 2
  scores.investment += countHints(normalized, INVESTMENT_CONTEXT_HINTS) * 3

  if (/\b(paguei|gastei|comprei|debito|débito|fatura|boleto|conta|parcela)\b/.test(normalized)) scores.expense += 6
  if (/\b(recebi|ganhei|entrou|caiu|credito|crédito)\b/.test(normalized)) scores.income += 6
  if (/\b(investi|aportei|apliquei|aporte|investimento|tesouro|cdb|lci|lca|fii|corretora|bolsa)\b/.test(normalized)) scores.investment += 7

  if (/\bpix\b/.test(normalized)) {
    if (/\b(recebi|entrou|caiu|ganhei)\b/.test(normalized)) scores.income += 4
    if (/\b(paguei|enviei|transferi|sa[ií]u)\b/.test(normalized)) scores.expense += 4
  }

  if (/\bpagamento\b/.test(normalized)) {
    if (/\b(recebi|entrou|caiu|cliente)\b/.test(normalized)) scores.income += 3
    if (/\b(paguei|efetuei)\b/.test(normalized)) scores.expense += 3
  }

  if (/\breembolso\b/.test(normalized)) {
    if (/\b(recebi|entrou|caiu)\b/.test(normalized)) scores.income += 3
    if (/\b(paguei|fiz)\b/.test(normalized)) scores.expense += 2
  }

  const entries = Object.entries(scores) as Array<['expense' | 'income' | 'investment', number]>
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1]

    const priority: Record<'expense' | 'income' | 'investment', number> = {
      investment: 3,
      income: 2,
      expense: 1,
    }

    return priority[b[0]] - priority[a[0]]
  })

  return {
    type: entries[0][0],
    scores,
  }
}

const inferWriteItemType = (text: string): 'expense' | 'income' | 'investment' => {
  return classifyWriteTransactionType(text).type
}

const parseSharedParticipants = (
  text: string,
  options?: { allowGenericDivisionHints?: boolean },
): number | undefined => {
  const normalized = normalizeText(text)
  const allowGenericDivisionHints = options?.allowGenericDivisionHints ?? true

  const wordToNumber: Record<string, number> = {
    dois: 2,
    duas: 2,
    tres: 3,
    três: 3,
    quatro: 4,
    cinco: 5,
  }

  const numericMatch = normalized.match(/\b(?:para|entre|em|por)\s+(?:os\s+|as\s+)?(\d{1,2})\b/)
  if (numericMatch) {
    const participants = Number(numericMatch[1])
    if (participants > 1) return participants
  }

  const withFriendsNumericMatch = normalized.match(/\bcom\s+(\d{1,2})\s+(?:amig(?:o|os|a|as)|pessoa(?:s)?|colega(?:s)?|parceir(?:o|os|a|as)|s[oó]ci(?:o|os|a|as))\b/)
  if (withFriendsNumericMatch) {
    const participants = Number(withFriendsNumericMatch[1])
    if (participants > 1) return participants
  }

  const textualMatch = normalized.match(/\b(?:para|entre|em|por)\s+(?:os\s+|as\s+)?(dois|duas|tres|três|quatro|cinco)\b/)
  if (textualMatch) {
    const participants = wordToNumber[textualMatch[1]]
    if (participants > 1) return participants
  }

  const withFriendsTextualMatch = normalized.match(/\bcom\s+(dois|duas|tres|três|quatro|cinco)\s+(?:amig(?:o|os|a|as)|pessoa(?:s)?|colega(?:s)?|parceir(?:o|os|a|as)|s[oó]ci(?:o|os|a|as))\b/)
  if (withFriendsTextualMatch) {
    const participants = wordToNumber[withFriendsTextualMatch[1]]
    if (participants > 1) return participants
  }

  if (allowGenericDivisionHints && /\b(meia|metade|meio a meio|dividimos|dividi|rachamos|rachou)\b/.test(normalized)) {
    return 2
  }

  return undefined
}

const parseExplicitReportAmount = (text: string): number | undefined => {
  const patterns = [
    /\b(?:minha|minha\s+parte|meu|meu\s+lado|para\s+mim|pra\s+mim)\s+(?:parte\s+)?(?:foi|ficou|deu)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bcada\s+um\s+(?:pagou|ficou\s+com)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bpor\s+cabe[cç]a\s*(?:de|foi)?\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bo\s+meu\s+(?:saiu|ficou|deu)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bcada\s+um\s+deu\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bminha\s+cota\s+(?:foi|ficou|deu)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bpra\s+mim\s+(?:foi|ficou|deu)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bmeu\s+(?:foi|ficou|deu)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bcada\s*1\s+(?:pagou|deu|ficou\s+com)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bpramim\s+(?:foi|ficou|deu)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bporcabe[cç]a\s*(?:de|foi)?\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
    /\bcadaum\s+(?:pagou|deu|ficou\s+com)\s*(?:r\$\s*)?(\d+[\d.,]*)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (!match?.[1]) continue
    const amount = normalizeAmount(match[1])
    if (amount) return amount
  }

  return undefined
}

const computeReportWeightFromContext = (
  text: string,
  amount: number,
): { reportWeight?: number; explicitParticipants?: boolean; explicitReportAmount?: boolean } => {
  if (!Number.isFinite(amount) || amount <= 0) return {}

  const explicitReportAmount = parseExplicitReportAmount(text)
  if (explicitReportAmount && explicitReportAmount > 0 && explicitReportAmount <= amount) {
    return {
      reportWeight: Number((explicitReportAmount / amount).toFixed(4)),
      explicitParticipants: true,
      explicitReportAmount: true,
    }
  }

  const explicitParticipants = parseSharedParticipants(text, { allowGenericDivisionHints: false })
  const fallbackParticipants = parseSharedParticipants(text)
  const participants = explicitParticipants || fallbackParticipants

  if (participants && participants > 1) {
    return {
      reportWeight: Number((1 / participants).toFixed(4)),
      explicitParticipants: Boolean(explicitParticipants),
      explicitReportAmount: false,
    }
  }

  return {}
}

const extractMonetaryAmount = (text: string): number | undefined => {
  const spokenAmount = extractSpokenCurrencyAmount(text)
  if (spokenAmount) return spokenAmount

  const matches = [...text.matchAll(/(?:r\$\s*)?(\d+[\d.,]*)/gi)]
  if (!matches.length) return undefined

  for (const match of matches) {
    const fullMatch = match[0]
    const amountRaw = match[1]
    const index = match.index ?? 0
    const before = text.slice(Math.max(0, index - 16), index)
    const after = text.slice(index + fullMatch.length, index + fullMatch.length + 28)
    const normalizedAfter = normalizeText(after)

    const looksLikeParticipantCount =
      /\bcom\s*$/i.test(before)
      && /^\s*(amig|pessoa|colega|parceir|soci)/i.test(normalizedAfter)

    if (looksLikeParticipantCount) continue

    const parsed = normalizeAmount(amountRaw)
    if (parsed) return parsed
  }

  return undefined
}

const normalizeInstallmentCount = (value: number | undefined): number | undefined => {
  if (!Number.isFinite(value)) return undefined
  const rounded = Math.floor(Number(value))
  if (rounded < 2 || rounded > 48) return undefined
  return rounded
}

const extractInstallmentCount = (text: string): number | undefined => {
  const normalized = normalizeText(text)

  const patterns = [
    /\b(\d{1,2})\s*x\b/i,
    /\bem\s+(\d{1,2})\s+parcelas?\b/i,
    /\bparcelad[oa]\s+em\s+(\d{1,2})\b/i,
    /\b(\d{1,2})\s+parcelas?\b/i,
  ]

  for (const pattern of patterns) {
    const match = normalized.match(pattern)
    const parsed = match?.[1] ? Number(match[1]) : undefined
    const normalizedCount = normalizeInstallmentCount(parsed)
    if (normalizedCount) return normalizedCount
  }

  return undefined
}

const splitInstallmentAmounts = (totalAmount: number, installmentCount: number): number[] => {
  const totalCents = Math.round(totalAmount * 100)
  const baseCents = Math.floor(totalCents / installmentCount)
  let remainder = totalCents - baseCents * installmentCount

  return Array.from({ length: installmentCount }, () => {
    const value = baseCents + (remainder > 0 ? 1 : 0)
    if (remainder > 0) remainder -= 1
    return value / 100
  })
}

const buildInstallmentDates = (startDate: string, installmentCount: number): string[] => {
  const parsedDate = new Date(`${startDate}T12:00:00`)
  if (!Number.isFinite(parsedDate.getTime())) {
    return Array.from({ length: installmentCount }, () => startDate)
  }

  return Array.from({ length: installmentCount }, (_, index) =>
    format(addMonths(parsedDate, index), 'yyyy-MM-dd'),
  )
}

const normalizeItemDescriptionByType = (
  text: string,
  type: 'expense' | 'income' | 'investment',
): string | undefined => {
  const mappedIntent: AssistantIntent =
    type === 'investment'
      ? 'add_investment'
      : type === 'income'
        ? 'add_income'
        : 'add_expense'

  return extractDescription(text, mappedIntent)
}

const extractMixedItemsFromText = (
  text: string,
  fallbackDate: string,
): AssistantSlots['items'] => {
  const normalized = normalizeText(text)
  const looksLikeSingleReaisCentavos =
    /\b\d{1,6}\s+reais?\s+e\s+\d{1,2}\s+centavos?\b/.test(normalized)
    || /\b\d{1,6}\s+com\s+\d{1,2}\b/.test(normalized)

  if (looksLikeSingleReaisCentavos) {
    return undefined
  }

  const amountMatches = [...text.matchAll(/(?:r\$\s*)?(\d+[\d.,]*)/gi)]
  if (amountMatches.length < 1) return undefined

  const cleaned = cleanSpeechNoise(text)
  const protectedDecimals = cleaned
    .replace(/(\d+),(\d{1,2})/g, '$1__DECIMAL__$2')
    .replace(/(\d+)\.(\d{1,2})/g, '$1__DOTDECIMAL__$2')
  const chunks = protectedDecimals
    .split(/\s*(?:,|;|\.|\bem\s+seguida\b|\bdepois\b|\bent[aã]o\b)\s*/i)
    .map((chunk) => chunk
      .replace(/__DECIMAL__/g, ',')
      .replace(/__DOTDECIMAL__/g, '.')
      .trim())
    .filter(Boolean)

  if (!chunks.length) return undefined

  const items: NonNullable<AssistantSlots['items']> = []
  let pendingContext = ''

  const applySplitHintToLastItem = (chunkText: string) => {
    const lastItemIndex = [...items]
      .reverse()
      .findIndex((item) => Boolean(item.transactionType))

    if (lastItemIndex < 0) return

    const indexFromStart = items.length - 1 - lastItemIndex
    const target = items[indexFromStart]
    const reportContext = computeReportWeightFromContext(chunkText, target.amount)
    if (!reportContext.reportWeight) return

    if (target.report_weight && !reportContext.explicitParticipants && !reportContext.explicitReportAmount) return

    items[indexFromStart] = {
      ...target,
      report_weight: reportContext.reportWeight,
    }
  }

  chunks.forEach((chunk) => {
    const chunkAmount = extractMonetaryAmount(chunk)

    if (!chunkAmount) {
      applySplitHintToLastItem(chunk)
      pendingContext = `${pendingContext} ${chunk}`.trim()
      return
    }

    const combined = `${pendingContext} ${chunk}`.trim()
    const itemType = inferWriteItemType(combined)
    const description = normalizeItemDescriptionByType(combined, itemType)

    applySplitHintToLastItem(combined)

    const reportContext = computeReportWeightFromContext(combined, chunkAmount)

    items.push({
      transactionType: itemType,
      amount: chunkAmount,
      ...(itemType === 'expense'
        ? { installment_count: extractInstallmentCount(combined) }
        : {}),
      description,
      date: fallbackDate,
      month: fallbackDate.substring(0, 7),
      ...(reportContext.reportWeight
        ? { report_weight: reportContext.reportWeight }
        : {}),
    })

    pendingContext = ''
  })

  if (items.length > 1) return items
  if (items.length === 1 && Number.isFinite(items[0].report_weight)) return items
  return undefined
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
  const normalizedCleaned = normalizeText(cleaned)
  const looksLikeSingleSpokenDecimal =
    /\b\d{1,6}\s+reais?\s+e\s+\d{1,2}\s+centavos?\b/.test(normalizedCleaned)
    || /\b\d{1,6}\s+com\s+\d{1,2}\b/.test(normalizedCleaned)
    || /\breais?\s+e\s+[a-z\s]+centavos?\b/.test(normalizedCleaned)

  if (looksLikeSingleSpokenDecimal && extractSpokenCurrencyAmount(cleaned)) {
    return undefined
  }

  const mixedItems = extractMixedItemsFromText(cleaned, fallbackDate)
  if (mixedItems?.length) {
    return mixedItems
  }

  const commandRemoved = cleaned
    .replace(/^(adicion(?:a|ar|e)?|registre|registrar|lance|lan[çc]ar|inclua|incluir)\s+/i, '')
    .replace(/^(uma|um|as|os)\s+/i, '')
    .replace(/^(a|o)\s+/i, '')

  const protectedCommandDecimals = commandRemoved
    .replace(/(\d+),(\d{1,2})/g, '$1__DECIMAL__$2')
    .replace(/(\d+)\.(\d{1,2})/g, '$1__DOTDECIMAL__$2')

  const chunkCandidates = protectedCommandDecimals
    .split(/\s+(?:e|mais|tamb[eé]m)\s+|;|,/i)
    .map((chunk) => chunk
      .replace(/__DECIMAL__/g, ',')
      .replace(/__DOTDECIMAL__/g, '.')
      .trim())
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
        ...(intent === 'add_expense'
          ? { installment_count: extractInstallmentCount(chunk) }
          : {}),
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
  const hasAmount = Boolean(extractAmount(text))
  const hasExpenseContext = EXPENSE_CONTEXT_HINTS.some((hint) => normalized.includes(normalizeText(hint)))
  const hasExpenseAction = EXPENSE_ACTION_HINTS.some((hint) => normalized.includes(normalizeText(hint)))
  const hasIncomeContext = INCOME_CONTEXT_HINTS.some((hint) => normalized.includes(normalizeText(hint)))
  const hasInvestmentContext = INVESTMENT_CONTEXT_HINTS.some((hint) => normalized.includes(normalizeText(hint)))

  if (/invest|aporte/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_investment', confidence: 0.9 }
  }

  if (/renda|receita|ganho|salario|salário/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_income', confidence: 0.9 }
  }

  if (/despesa|gasto|conta/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_expense', confidence: 0.9 }
  }

  if (hasAmount && hasInvestmentContext) {
    return { intent: 'add_investment', confidence: 0.86 }
  }

  if (hasAmount && hasIncomeContext) {
    return { intent: 'add_income', confidence: 0.84 }
  }

  if (hasAmount && (hasExpenseContext || hasExpenseAction)) {
    return { intent: 'add_expense', confidence: 0.85 }
  }

  if (hasAmount) {
    const classification = classifyWriteTransactionType(text)

    if (classification.type === 'investment' && classification.scores.investment >= 4) {
      return { intent: 'add_investment', confidence: 0.83 }
    }

    if (classification.type === 'income' && classification.scores.income >= 4) {
      return { intent: 'add_income', confidence: 0.81 }
    }
  }

  if (hasAmount) {
    return { intent: 'add_expense', confidence: 0.68 }
  }

  return { intent: 'unknown', confidence: 0.3 }
}

const buildSlots = (text: string, intent: AssistantIntent): AssistantSlots => {
  const amount = extractAmount(text)
  const date = extractDate(text)
  const description = extractDescription(text, intent)
  const items = extractAddItemsFromText(text, intent, date)
  const installmentCount = intent === 'add_expense'
    ? extractInstallmentCount(text)
    : undefined
  const transactionType: 'expense' | 'income' | 'investment' | undefined =
    intent === 'add_investment'
      ? 'investment'
      : intent === 'add_income'
        ? 'income'
        : intent === 'add_expense'
          ? 'expense'
          : undefined

  if (intent === 'add_investment') {
    return {
      transactionType,
      amount,
      description,
      month: date.substring(0, 7),
      date,
      items,
    }
  }

  return {
    transactionType,
    amount,
    installment_count: installmentCount,
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
        return `${label}: ${item.description || 'Sem descrição'} (R$${item.amount.toFixed(2)}${installmentLabel})`
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
    return `Confirma despesa de R$${(slots.amount ?? 0).toFixed(2)}${installmentLabel} em ${slots.category?.name || 'Sem categoria'} na data ${slots.date}?`
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

  if (expenseItems.length) {
    const { data: expenseCategories } = await supabase
      .from('categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedExpenseId = (expenseCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id

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

      resolvedCategoryId = resolvedCategoryId || uncategorizedExpenseId

      const effectiveDate = item.date || slots.date
      const installmentCount = normalizeInstallmentCount(item.installment_count) || 1

      if (!effectiveDate || !resolvedCategoryId) {
        return []
      }

      if (installmentCount <= 1) {
        return [{
          amount: item.amount,
          report_weight: item.report_weight,
          date: effectiveDate,
          category_id: resolvedCategoryId,
          description: item.description,
          user_id: userId,
        }]
      }

      const installmentGroupId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      const installmentAmounts = splitInstallmentAmounts(item.amount, installmentCount)
      const installmentDates = buildInstallmentDates(effectiveDate, installmentCount)

      return installmentAmounts.map((installmentAmount, index) => ({
        amount: installmentAmount,
        report_weight: item.report_weight,
        date: installmentDates[index],
        category_id: resolvedCategoryId,
        description: item.description,
        installment_group_id: installmentGroupId,
        installment_number: index + 1,
        installment_total: installmentCount,
        user_id: userId,
      }))
    }))

    const expensePayload = expensePayloadNested.flat()

    if (expensePayload.some((item) => !item.date || !item.category_id)) {
      return { status: 'failed', message: 'Não foi possível resolver data/categoria para todas as despesas.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('expenses')
      .insert(expensePayload)
      .select('id')

    if (error) {
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    createdIds.push(...(data?.map((item) => item.id) || []))
  }

  if (incomeItems.length) {
    const { data: incomeCategories } = await supabase
      .from('income_categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedIncomeId = (incomeCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id

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

      resolvedCategoryId = resolvedCategoryId || uncategorizedIncomeId

      return {
        amount: item.amount,
        report_weight: item.report_weight,
        date: item.date || slots.date,
        income_category_id: resolvedCategoryId,
        type: 'other',
        description: item.description,
        user_id: userId,
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
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    createdIds.push(...(data?.map((item) => item.id) || []))
  }

  if (investmentItems.length) {
    const investmentPayload = investmentItems.map((item) => ({
      amount: item.amount,
      month: item.month || slots.month,
      description: item.description,
      user_id: userId,
    }))

    if (investmentPayload.some((item) => !item.month)) {
      return { status: 'failed', message: 'Não foi possível resolver o mês para todos os investimentos.', commandId: command.id }
    }

    const { data, error } = await supabase
      .from('investments')
      .insert(investmentPayload)
      .select('id')

    if (error) {
      return { status: 'failed', message: error.message, commandId: command.id }
    }

    createdIds.push(...(data?.map((item) => item.id) || []))
  }

  if (createdIds.length) {
    const launchedTypesCount = [
      expenseItems.length ? `${expenseItems.length} despesa${expenseItems.length > 1 ? 's' : ''}` : undefined,
      incomeItems.length ? `${incomeItems.length} renda${incomeItems.length > 1 ? 's' : ''}` : undefined,
      investmentItems.length ? `${investmentItems.length} investimento${investmentItems.length > 1 ? 's' : ''}` : undefined,
    ].filter(Boolean)

    return {
      status: 'executed',
      message: launchedTypesCount.length > 1
        ? `Lançamentos adicionados com sucesso: ${launchedTypesCount.join(', ')}.`
        : 'Lançamento adicionado com sucesso.',
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

const fetchMonthTotals = async (month: string) => {
  const start = `${month}-01`
  const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
  const end = format(endOfMonth(parsedStart), 'yyyy-MM-dd')

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    supabase.from('expenses').select('amount, report_weight').gte('date', start).lte('date', end),
    supabase.from('incomes').select('amount, report_weight').gte('date', start).lte('date', end),
    supabase.from('investments').select('amount').eq('month', month),
  ])

  return {
    expenses: (expensesResult.data || []).reduce((sum, item) => sum + (Number(item.amount || 0) * Number(item.report_weight ?? 1)), 0),
    incomes: (incomesResult.data || []).reduce((sum, item) => sum + (Number(item.amount || 0) * Number(item.report_weight ?? 1)), 0),
    investments: (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
  }
}

type InsightExpenseRow = {
  amount: number
  report_weight?: number
  date: string
  description?: string | null
  category?: { name?: string } | null
}

type InsightIncomeRow = {
  amount: number
  report_weight?: number
  date: string
  description?: string | null
}

const getWeightedAmount = (amount: number, reportWeight?: number | null) => amount * Number(reportWeight ?? 1)

const getMonthKeyFromDate = (dateValue: string) => {
  const parsed = parse(dateValue, 'yyyy-MM-dd', new Date())
  if (!isValid(parsed)) return clampMonthToAppStart(dateValue.slice(0, 7))
  return clampMonthToAppStart(format(parsed, 'yyyy-MM'))
}

const getPreviousYearMonth = (month: string) => {
  const parsed = parse(`${month}-01`, 'yyyy-MM-dd', new Date())
  return clampMonthToAppStart(format(subMonths(parsed, 12), 'yyyy-MM'))
}

const buildRecentMonths = (targetMonth: string, count: number) => {
  const parsed = parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())
  const months = Array.from({ length: count }, (_, index) => format(subMonths(parsed, index), 'yyyy-MM'))
    .map((monthValue) => clampMonthToAppStart(monthValue))
    .reverse()

  return [...new Set(months)]
}

type CategoryImportance = 'essential' | 'strategic' | 'flexible' | 'uncategorized'

const getCategoryImportance = (categoryName: string): CategoryImportance => {
  const normalized = normalizeText(categoryName)

  if (!normalized || normalized === 'sem categoria') return 'uncategorized'

  if (
    /moradia|aluguel|energia|agua|água|internet|condominio|condomínio|saude|saúde|farmacia|farmácia|medico|médico|escola|educacao|educação|transporte/.test(normalized)
  ) {
    return 'essential'
  }

  if (/investimento|aporte|poupanca|poupança|previdencia|previdência|seguro|reserva/.test(normalized)) {
    return 'strategic'
  }

  if (/lazer|restaurante|ifood|viagem|streaming|assinatura|compras|presentes|bar/.test(normalized)) {
    return 'flexible'
  }

  return 'flexible'
}

const getImportanceLabel = (importance: CategoryImportance) => {
  if (importance === 'essential') return 'essencial'
  if (importance === 'strategic') return 'estratégica'
  if (importance === 'uncategorized') return 'ainda sem classificação'
  return 'flexível'
}

const safePercent = (value: number, total: number) => {
  if (!Number.isFinite(value) || !Number.isFinite(total) || total <= 0) return 0
  return (value / total) * 100
}

const normalizeInsightKey = (message: string) =>
  normalizeText(message)
    .replace(/r\$\s*\d+[\d.,]*/g, 'valor')
    .replace(/\d+[\d.,]*/g, 'n')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const getInsightScore = (message: string, kind: 'highlight' | 'recommendation') => {
  const normalized = normalizeText(message)
  let score = 0

  if (/saldo.*negativ|passou do limite|acima da meta|perdeu forca|perdeu força/.test(normalized)) score += 100
  if (/pode virar negativ|aceler|fora da media|fora da média|abaixo da media|abaixo da média/.test(normalized)) score += 70
  if (/perto do limite|atencao especial|atenção especial|pressao|pressão/.test(normalized)) score += 50
  if (/proxim|próxim|fechamento|curto prazo/.test(normalized)) score += 35
  if (/\d+%|r\$\s*\d+/.test(normalized)) score += 12
  if (kind === 'recommendation' && /priorizar|revisar|ajuste|reduzir|adiar|automatizar|definir teto/.test(normalized)) score += 30
  if (kind === 'recommendation' && /renegoci|acompanhar|separar|distribuir/.test(normalized)) score += 20
  if (/estavel|estável|bom ritmo|sem sinais criticos|sem sinais críticos/.test(normalized)) score -= 40

  return score
}

const isInsightTooGeneric = (message: string) => {
  const normalized = normalizeText(message)
  return /no geral|bom ritmo|sem sinais criticos|sem sinais críticos|comportamento esperado/.test(normalized)
}

const hasActionableRecommendation = (message: string) => {
  const normalized = normalizeText(message)
  return /revisar|ajuste|ajustar|reduzir|definir|adiar|automatizar|renegoci|acompanhar|separar|distribuir|priorizar/.test(normalized)
}

const prioritizeInsightLines = (
  messages: string[],
  maxItems: number,
  kind: 'highlight' | 'recommendation',
) => {
  const seen = new Set<string>()

  const unique = messages.filter((message) => {
    const key = normalizeInsightKey(message)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })

  const useful = unique.filter((message) => {
    if (isInsightTooGeneric(message)) return false
    if (kind === 'recommendation' && !hasActionableRecommendation(message)) return false
    return true
  })

  const source = useful.length ? useful : unique

  return source
    .map((message) => ({ message, score: getInsightScore(message, kind) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.message.length - b.message.length
    })
    .slice(0, maxItems)
    .map((item) => item.message)
}

const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2
  }
  return sorted[middle]
}

const fetchMonthInsightDataset = async (month: string) => {
  const start = `${month}-01`
  const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
  const end = format(endOfMonth(parsedStart), 'yyyy-MM-dd')

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

  const expenses = (expensesResult.data || []) as InsightExpenseRow[]
  const incomes = (incomesResult.data || []) as InsightIncomeRow[]

  return {
    expenses,
    incomes,
    investments: investmentsResult.data || [],
    totals: {
      expenses: expenses.reduce((sum, item) => sum + getWeightedAmount(Number(item.amount || 0), item.report_weight), 0),
      incomes: incomes.reduce((sum, item) => sum + getWeightedAmount(Number(item.amount || 0), item.report_weight), 0),
      investments: (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
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
    const weighted = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    expenseByMonth.set(monthKey, (expenseByMonth.get(monthKey) || 0) + weighted)
  })

  ;(incomesResult.data || []).forEach((item) => {
    const monthKey = getMonthKeyFromDate(String(item.date || ''))
    const weighted = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    incomeByMonth.set(monthKey, (incomeByMonth.get(monthKey) || 0) + weighted)
  })

  ;(investmentsResult.data || []).forEach((item) => {
    const monthKey = String(item.month || '')
    investmentByMonth.set(monthKey, (investmentByMonth.get(monthKey) || 0) + Number(item.amount || 0))
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
  editedDescription?: string
  editedSlots?: AssistantSlots
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

  const currentMonthDate = parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())
  const previousMonth = clampMonthToAppStart(format(subMonths(currentMonthDate, 1), 'yyyy-MM'))

  const previousYearMonth = getPreviousYearMonth(targetMonth)

  const [currentData, previousTotals, previousYearTotals, monthSeries, limitsResult] = await Promise.all([
    fetchMonthInsightDataset(targetMonth),
    fetchMonthTotals(previousMonth),
    fetchMonthTotals(previousYearMonth),
    fetchHistoricalMonthSeries(targetMonth, 8),
    supabase
      .from('expense_category_month_limits')
      .select('category_id, limit_amount, category:categories(name)')
      .eq('month', targetMonth),
  ])

  const currentTotals = currentData.totals
  const currentBalance = currentTotals.incomes - currentTotals.expenses - currentTotals.investments
  const previousBalance = previousTotals.incomes - previousTotals.expenses - previousTotals.investments

  const highlights: string[] = []
  const recommendations: string[] = []

  if (currentData.expenses.length === 0 && currentData.incomes.length === 0 && currentData.investments.length === 0) {
    return {
      month: targetMonth,
      highlights: ['Ainda não há dados suficientes deste mês para gerar insights úteis.'],
      recommendations: ['Registre os próximos lançamentos para receber uma leitura curta e acionável.'],
    }
  }

  const expensesByCategory = currentData.expenses.reduce((map, item) => {
    const categoryName = item.category?.name || 'Sem categoria'
    const weightedAmount = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    map.set(categoryName, (map.get(categoryName) || 0) + weightedAmount)
    return map
  }, new Map<string, number>())

  const topCategoryEntry = Array.from(expensesByCategory.entries())
    .sort((a, b) => b[1] - a[1])[0]

  if (topCategoryEntry && currentTotals.expenses > 0) {
    const topCategoryImportance = getCategoryImportance(topCategoryEntry[0])
    const topCategoryImportanceLabel = getImportanceLabel(topCategoryImportance)
    const topCategoryShare = safePercent(topCategoryEntry[1], currentTotals.expenses)

    if (topCategoryShare >= 45) {
      highlights.push(`${topCategoryEntry[0]} (${topCategoryImportanceLabel}) concentrou ${topCategoryShare.toFixed(0)}% das despesas do mês.`)

      if (topCategoryImportance === 'essential') {
        recommendations.push(`Como ${topCategoryEntry[0]} é uma categoria essencial, a melhor estratégia é buscar eficiência (renegociação ou ajuste de frequência) sem perder qualidade.`)
      } else if (topCategoryImportance === 'strategic') {
        recommendations.push(`${topCategoryEntry[0]} tem perfil estratégico; mantenha o aporte com cadência, mas ajuste valores para preservar equilíbrio no curto prazo.`)
      } else {
        recommendations.push(`${topCategoryEntry[0]} é uma categoria com margem de ajuste e pode ser o primeiro ponto para aliviar pressão até o fechamento.`)
      }
    } else if (topCategoryShare >= 30) {
      highlights.push(`${topCategoryEntry[0]} (${topCategoryImportanceLabel}) lidera seus gastos com ${topCategoryShare.toFixed(0)}% do total.`)
    }
  }

  const limitRows = (limitsResult.data || []) as Array<{ category_id: string; limit_amount: number | null; category?: { name?: string } | null }>
  if (limitRows.length > 0) {
    const usageByCategory = currentData.expenses.reduce((map, item) => {
      const categoryName = item.category?.name || 'Sem categoria'
      const weightedAmount = getWeightedAmount(Number(item.amount || 0), item.report_weight)
      map.set(categoryName, (map.get(categoryName) || 0) + weightedAmount)
      return map
    }, new Map<string, number>())

    const limitAlerts = limitRows
      .map((row) => {
        const categoryName = row.category?.name || 'Sem categoria'
        const limit = Number(row.limit_amount ?? 0)
        if (limit <= 0) return null
        const used = usageByCategory.get(categoryName) || 0
        const usage = safePercent(used, limit)
        return { categoryName, limit, used, usage }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .sort((a, b) => b.usage - a.usage)

    const exceededLimit = limitAlerts.find((item) => item.used > item.limit)
    if (exceededLimit) {
      const importance = getCategoryImportance(exceededLimit.categoryName)
      const importanceLabel = getImportanceLabel(importance)
      const overLimitPct = safePercent(exceededLimit.used - exceededLimit.limit, Math.max(exceededLimit.limit, 1))

      highlights.push(`${exceededLimit.categoryName} (${importanceLabel}) passou do limite em ${overLimitPct.toFixed(0)}%.`)

      if (importance === 'essential') {
        recommendations.push(`Como é uma categoria essencial, o foco aqui é otimizar custos sem cortar o necessário (troca de plano, fornecedor ou frequência).`)
      } else if (importance === 'strategic') {
        recommendations.push(`Por ser estratégica, vale recalibrar o valor temporariamente para manter consistência sem comprometer o caixa do mês.`)
      } else {
        recommendations.push(`Essa categoria tem boa flexibilidade e pode ser reduzida agora para recuperar margem com rapidez.`)
      }
    } else {
      const nearLimit = limitAlerts.find((item) => item.usage >= 85)
      if (nearLimit) {
        const importance = getCategoryImportance(nearLimit.categoryName)
        const importanceLabel = getImportanceLabel(importance)
        highlights.push(`${nearLimit.categoryName} (${importanceLabel}) já consumiu ${nearLimit.usage.toFixed(0)}% do limite mensal.`)

        if (importance === 'essential') {
          recommendations.push(`Para ${nearLimit.categoryName}, prefira ajustes finos de eficiência no dia a dia em vez de cortes abruptos.`)
        } else {
          recommendations.push(`Um ajuste de frequência em ${nearLimit.categoryName} já tende a devolver folga ao mês.`)
        }
      }
    }
  }

  const expenseByDay = currentData.expenses.reduce((map, item) => {
    const weightedAmount = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    map.set(item.date, (map.get(item.date) || 0) + weightedAmount)
    return map
  }, new Map<string, number>())

  const dailyExpenses = Array.from(expenseByDay.entries()).sort((a, b) => b[1] - a[1])
  if (dailyExpenses.length > 0) {
    const [peakDay, peakValue] = dailyExpenses[0]
    const medianDailyExpense = median(dailyExpenses.map(([, value]) => value))
    if (medianDailyExpense > 0 && peakValue >= medianDailyExpense * 2.2) {
      const parsedPeakDay = parse(peakDay, 'yyyy-MM-dd', new Date())
      const weekdayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
      const peakWeekday = isValid(parsedPeakDay) ? weekdayNames[parsedPeakDay.getDay()] : 'um único dia'
      highlights.push(`Houve um pico de gastos concentrado em ${peakWeekday}, acima do seu padrão diário mais comum.`)
      recommendations.push('Vale distribuir compras maiores ao longo das semanas para deixar o fluxo mais leve e previsível.')
    }
  }

  const weekDayNames = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado']
  const expensesByWeekDay = currentData.expenses.reduce((map, item) => {
    const parsed = parse(item.date, 'yyyy-MM-dd', new Date())
    if (!isValid(parsed)) return map
    const dayIndex = parsed.getDay()
    const weightedAmount = getWeightedAmount(Number(item.amount || 0), item.report_weight)
    map.set(dayIndex, (map.get(dayIndex) || 0) + weightedAmount)
    return map
  }, new Map<number, number>())

  if (expensesByWeekDay.size >= 2 && currentTotals.expenses > 0) {
    const orderedWeekdays = Array.from(expensesByWeekDay.entries()).sort((a, b) => b[1] - a[1])
    const [topWeekDay, topWeekDayAmount] = orderedWeekdays[0]
    const weekdayShare = safePercent(topWeekDayAmount, currentTotals.expenses)
    if (weekdayShare >= 30) {
      highlights.push(`Seu padrão semanal mostra maior pressão na ${weekDayNames[topWeekDay]}, quando seus gastos costumam pesar mais.`)
      recommendations.push(`Definir um teto prático para ${weekDayNames[topWeekDay]} pode ajudar bastante a manter o controle sem esforço extra.`)
    }
  }

  const today = new Date()
  const isCurrentMonth = clampMonthToAppStart(format(today, 'yyyy-MM')) === targetMonth
  const daysInMonth = endOfMonth(currentMonthDate).getDate()
  const elapsedDays = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth

  if (elapsedDays > 0 && currentTotals.expenses > 0 && currentTotals.incomes > 0) {
    const projectedExpenses = (currentTotals.expenses / elapsedDays) * daysInMonth
    const projectedBalance = currentTotals.incomes - projectedExpenses - currentTotals.investments

    if (isCurrentMonth && projectedBalance < 0 && currentBalance >= 0) {
      recommendations.push('No ritmo atual, seu saldo pode virar negativo até o fechamento; um ajuste leve nas despesas variáveis já ajuda a evitar isso.')
    } else if (isCurrentMonth && projectedBalance < currentBalance) {
      recommendations.push('Os gastos aceleraram neste mês; acompanhar os próximos dias de perto pode preservar sua margem até o fechamento.')
    }
  }

  if (currentTotals.incomes > 0) {
    const investmentRate = safePercent(currentTotals.investments, currentTotals.incomes)
    if (currentTotals.investments <= 0) {
      recommendations.push('Ainda não houve aporte neste mês; separar um valor fixo, mesmo pequeno, ajuda a manter as metas de longo prazo em movimento.')
    } else if (investmentRate < 10) {
      recommendations.push('A taxa de aporte está abaixo do ideal para este mês; automatizar um valor mínimo semanal pode facilitar a consistência.')
    }
  }

  const expensesDelta = currentTotals.expenses - previousTotals.expenses
  const expensesDeltaPct = safePercent(Math.abs(expensesDelta), Math.max(previousTotals.expenses, 1))
  if (expensesDelta > 0 && expensesDeltaPct >= 12) {
    highlights.push(`As despesas subiram ${expensesDeltaPct.toFixed(0)}% em relação ao mês anterior.`)
    recommendations.push('Revisar os três maiores lançamentos recentes costuma ser um caminho rápido para recuperar equilíbrio.')
  } else if (expensesDelta < 0 && expensesDeltaPct >= 12) {
    highlights.push(`As despesas caíram ${expensesDeltaPct.toFixed(0)}% versus o mês anterior.`)
  }

  const incomesDelta = currentTotals.incomes - previousTotals.incomes
  const incomesDeltaPct = safePercent(Math.abs(incomesDelta), Math.max(previousTotals.incomes, 1))
  if (incomesDelta < 0 && incomesDeltaPct >= 10) {
    highlights.push(`A renda recuou ${incomesDeltaPct.toFixed(0)}% frente ao mês anterior.`)
    recommendations.push('Revise despesas variáveis deste mês para compensar a queda da renda com menor impacto no essencial.')
  } else if (incomesDelta > 0 && incomesDeltaPct >= 10) {
    highlights.push(`A renda subiu ${incomesDeltaPct.toFixed(0)}% em comparação ao mês anterior.`)
  }

  if (currentBalance < previousBalance) {
    recommendations.push('Sua margem de segurança ficou menor que no mês anterior; manter foco no essencial por enquanto ajuda a recuperar folga.')
  }

  if (previousYearTotals.expenses > 0 || previousYearTotals.incomes > 0) {
    const yearlyExpenseDeltaPct = safePercent(
      Math.abs(currentTotals.expenses - previousYearTotals.expenses),
      Math.max(previousYearTotals.expenses, 1),
    )
    const yearlyIncomeDeltaPct = safePercent(
      Math.abs(currentTotals.incomes - previousYearTotals.incomes),
      Math.max(previousYearTotals.incomes, 1),
    )

    if (currentTotals.expenses > previousYearTotals.expenses && yearlyExpenseDeltaPct >= 15) {
      highlights.push('Comparando com o mesmo período do ano passado, a pressão de despesas está mais forte neste ciclo.')
    }

    if (currentTotals.incomes < previousYearTotals.incomes && yearlyIncomeDeltaPct >= 12) {
      recommendations.push('Em relação ao mesmo mês do ano passado, a renda perdeu força; vale adiar novos compromissos até o fluxo se estabilizar.')
    }
  }

  const seriesWindow = monthSeries.slice(-6)
  if (seriesWindow.length >= 4) {
    const expenseValues = seriesWindow.map((item) => item.expenses)
    const balanceValues = seriesWindow.map((item) => item.balance)
    const averageExpense = expenseValues.reduce((sum, value) => sum + value, 0) / expenseValues.length
    const averageBalance = balanceValues.reduce((sum, value) => sum + value, 0) / balanceValues.length

    if (averageExpense > 0 && currentTotals.expenses > averageExpense * 1.18) {
      highlights.push('As despesas deste mês ficaram acima do seu padrão recente, indicando uma aceleração fora da média dos últimos meses.')
    }

    if (currentBalance < averageBalance && averageBalance > 0) {
      recommendations.push('Seu saldo está abaixo da média recente; antecipar pequenos ajustes agora tende a proteger os próximos fechamentos.')
    }
  }

  if (!highlights.length) {
    highlights.push('No geral, seu mês está estável e sem sinais críticos fora do comportamento esperado.')
  }

  if (!recommendations.length) {
    recommendations.push('Você está em um bom ritmo; manter limites por categoria atualizados deve preservar previsibilidade até o fechamento.')
  }

  const prioritizedHighlights = prioritizeInsightLines(highlights, 2, 'highlight')
  const prioritizedRecommendations = prioritizeInsightLines(recommendations, 2, 'recommendation')

  return {
    month: targetMonth,
    highlights: prioritizedHighlights,
    recommendations: prioritizedRecommendations,
  }
}

export async function getActiveAssistantSession(deviceId: string) {
  return ensureSession(deviceId, DEFAULT_LOCALE)
}

export const assistantParserInternals = {
  inferIntent,
  extractDescription,
  buildSlots,
}
