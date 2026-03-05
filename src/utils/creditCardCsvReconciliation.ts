import type { BillExpenseItem } from '@/utils/creditCardBilling'

export type CreditCardCsvProvider = 'auto' | 'nubank' | 'itau' | 'inter' | 'generic'

type FieldKey = 'date' | 'description' | 'amount' | 'installment' | 'transactionType'

type LearnedProvider = {
  seen: number
  fieldAliases: Record<FieldKey, Record<string, number>>
}

type LearningState = {
  providers: Record<string, LearnedProvider>
}

const STORAGE_KEY = 'assistant-credit-card-csv-learning-v1'

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const normalizeHeader = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9]/g, '')

const parseMoneyValue = (rawValue: string): number | null => {
  const value = String(rawValue || '').trim()
  if (!value) return null

  const negativeByParenthesis = /^\(.+\)$/.test(value)
  const negativeBySignal = /(^-|-$|\s-\s|debito|d[eé]bito)/i.test(value)

  const stripped = value
    .replace(/\s+/g, '')
    .replace(/[R$]/gi, '')
    .replace(/[^0-9,.-]/g, '')

  const lastCommaIndex = stripped.lastIndexOf(',')
  const lastDotIndex = stripped.lastIndexOf('.')

  let normalized = stripped

  if (lastCommaIndex >= 0 && lastDotIndex >= 0) {
    if (lastCommaIndex > lastDotIndex) {
      normalized = stripped.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = stripped.replace(/,/g, '')
    }
  } else if (lastCommaIndex >= 0) {
    const commaCount = (stripped.match(/,/g) || []).length
    if (commaCount > 1) {
      const parts = stripped.split(',')
      const decimal = parts.pop() || ''
      normalized = `${parts.join('')}.${decimal}`
    } else {
      normalized = stripped.replace(',', '.')
    }
  } else if (lastDotIndex >= 0) {
    const dotCount = (stripped.match(/\./g) || []).length
    if (dotCount > 1) {
      const parts = stripped.split('.')
      const decimal = parts.pop() || ''
      normalized = `${parts.join('')}.${decimal}`
    }
  }

  const cleaned = normalized.replace(/[^0-9.-]/g, '')

  if (!cleaned || cleaned === '-' || cleaned === '.') return null

  const parsed = Number(cleaned)
  if (!Number.isFinite(parsed)) return null

  const absolute = Math.abs(parsed)
  const negativeByParsedValue = parsed < 0
  return negativeByParenthesis || negativeBySignal || negativeByParsedValue ? -absolute : absolute
}

const parseDateValue = (rawValue: string): string | null => {
  const value = String(rawValue || '').trim()
  if (!value) return null

  const yyyyMmDd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (yyyyMmDd) return `${yyyyMmDd[1]}-${yyyyMmDd[2]}-${yyyyMmDd[3]}`

  const ddMmYyyy = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ddMmYyyy) return `${ddMmYyyy[3]}-${ddMmYyyy[2]}-${ddMmYyyy[1]}`

  const ddMmYy = value.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (ddMmYy) {
    const year = Number(ddMmYy[3]) >= 70 ? `19${ddMmYy[3]}` : `20${ddMmYy[3]}`
    return `${year}-${ddMmYy[2]}-${ddMmYy[1]}`
  }

  return null
}

const parseInstallmentFromDescription = (description: string) => {
  const text = normalize(description)
  if (!text || text === '-') {
    return { installmentNumber: null, installmentTotal: null }
  }

  const onlyDeTotal = text.match(/^de\s*(\d{1,2})$/)
  if (onlyDeTotal) {
    const total = Number(onlyDeTotal[1])
    if (total >= 1 && total <= 99) {
      return { installmentNumber: 1, installmentTotal: total }
    }
  }

  const directDePattern = text.match(/^(\d{1,2})\s*de\s*(\d{1,2})$/)
  if (directDePattern) {
    const number = Number(directDePattern[1])
    const total = Number(directDePattern[2])
    if (number >= 1 && total >= number && total <= 99) {
      return { installmentNumber: number, installmentTotal: total }
    }
  }

  const directFraction = text.match(/(\d{1,2})\s*\/\s*(\d{1,2})/)
  if (directFraction) {
    const number = Number(directFraction[1])
    const total = Number(directFraction[2])
    if (number >= 1 && total >= number && total <= 99) {
      return { installmentNumber: number, installmentTotal: total }
    }
  }

  const parcelaPattern = text.match(/parc(?:ela)?\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/)
  if (parcelaPattern) {
    const number = Number(parcelaPattern[1])
    const total = Number(parcelaPattern[2])
    if (number >= 1 && total >= number && total <= 99) {
      return { installmentNumber: number, installmentTotal: total }
    }
  }

  return { installmentNumber: null, installmentTotal: null }
}

const inferDelimiter = (headerLine: string) => {
  const candidates: Array<';' | ',' | '\t'> = [';', ',', '\t']
  let best: ';' | ',' | '\t' = ';'
  let bestCount = -1

  candidates.forEach((candidate) => {
    const count = headerLine.split(candidate).length
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  })

  return best
}

const parseCsvRows = (content: string, delimiter: string): string[][] => {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentValue = ''
  let insideQuotes = false

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]
    const nextChar = content[index + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentValue += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (!insideQuotes && char === delimiter) {
      currentRow.push(currentValue)
      currentValue = ''
      continue
    }

    if (!insideQuotes && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') index += 1
      currentRow.push(currentValue)
      currentValue = ''
      if (currentRow.some((cell) => String(cell || '').trim())) {
        rows.push(currentRow)
      }
      currentRow = []
      continue
    }

    currentValue += char
  }

  if (currentValue || currentRow.length > 0) {
    currentRow.push(currentValue)
    if (currentRow.some((cell) => String(cell || '').trim())) {
      rows.push(currentRow)
    }
  }

  return rows
}

const DEFAULT_ALIASES: Record<FieldKey, string[]> = {
  date: ['data', 'datacompra', 'datalancamento', 'dia', 'transactiondate', 'purchaseDate', 'dtlancamento'],
  description: ['descricao', 'descricaoajustada', 'descricaooriginal', 'titulo', 'historico', 'detalhes', 'estabelecimento', 'merchant', 'descricao', 'description'],
  amount: ['valor', 'valorfinal', 'valororiginal', 'amount', 'total', 'valorparcela', 'valorbrl'],
  installment: ['parcela', 'parcelas', 'numeroParcela', 'installment', 'installments'],
  transactionType: ['tipo', 'tipolancamento', 'natureza', 'operationtype', 'transactiontype', 'tipo movimentacao', 'debitocredito'],
}

const PROVIDER_ALIASES: Record<Exclude<CreditCardCsvProvider, 'auto'>, Partial<Record<FieldKey, string[]>>> = {
  generic: {},
  nubank: {
    date: ['data', 'data da compra', 'data compra'],
    description: ['descricao', 'descricao original', 'titulo'],
    amount: ['valor', 'valor (r$)'],
    installment: ['parcela'],
    transactionType: ['tipo'],
  },
  itau: {
    date: ['data', 'lancamento'],
    description: ['descricao', 'historico', 'detalhes'],
    amount: ['valor', 'valor em reais'],
    installment: ['parcela'],
    transactionType: ['tipo'],
  },
  inter: {
    date: ['data', 'data transacao'],
    description: ['descricao', 'estabelecimento'],
    amount: ['valor', 'valor total'],
    installment: ['parcela', 'numero parcela'],
    transactionType: ['tipo'],
  },
}

const createEmptyLearningState = (): LearningState => ({
  providers: {},
})

const readLearningState = (): LearningState => {
  try {
    if (typeof localStorage === 'undefined') return createEmptyLearningState()
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createEmptyLearningState()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return createEmptyLearningState()
    return parsed as LearningState
  } catch {
    return createEmptyLearningState()
  }
}

const writeLearningState = (state: LearningState) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const buildProviderAliases = (provider: CreditCardCsvProvider, learningState: LearningState) => {
  const providerKey = provider === 'auto' ? 'generic' : provider
  const learned = learningState.providers[providerKey]

  const aliases: Record<FieldKey, string[]> = {
    date: [...DEFAULT_ALIASES.date],
    description: [...DEFAULT_ALIASES.description],
    amount: [...DEFAULT_ALIASES.amount],
    installment: [...DEFAULT_ALIASES.installment],
    transactionType: [...DEFAULT_ALIASES.transactionType],
  }

  const providerAliases = PROVIDER_ALIASES[providerKey as Exclude<CreditCardCsvProvider, 'auto'>] || {}

  ;(Object.keys(aliases) as FieldKey[]).forEach((field) => {
    const specific = providerAliases[field] || []
    aliases[field].push(...specific.map(normalizeHeader))

    const learnedVotes = learned?.fieldAliases[field] || {}
    const learnedHeaders = Object.entries(learnedVotes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([header]) => header)

    aliases[field].push(...learnedHeaders)
  })

  return aliases
}

const findHeaderIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader)
  const normalizedCandidates = candidates.map(normalizeHeader)

  for (let idx = 0; idx < normalizedHeaders.length; idx += 1) {
    const header = normalizedHeaders[idx]
    if (normalizedCandidates.includes(header)) return idx
  }

  return -1
}

const updateLearningFromMapping = (
  provider: CreditCardCsvProvider,
  headerRow: string[],
  mapping: Record<FieldKey, number>,
) => {
  const providerKey = provider === 'auto' ? 'generic' : provider
  const learningState = readLearningState()
  const previous = learningState.providers[providerKey] || {
    seen: 0,
    fieldAliases: {
      date: {},
      description: {},
      amount: {},
      installment: {},
      transactionType: {},
    },
  }

  const next: LearnedProvider = {
    seen: previous.seen + 1,
    fieldAliases: {
      date: { ...previous.fieldAliases.date },
      description: { ...previous.fieldAliases.description },
      amount: { ...previous.fieldAliases.amount },
      installment: { ...previous.fieldAliases.installment },
      transactionType: { ...previous.fieldAliases.transactionType },
    },
  }

  ;(Object.keys(mapping) as FieldKey[]).forEach((field) => {
    const index = mapping[field]
    if (index < 0) return

    const header = normalizeHeader(headerRow[index] || '')
    if (!header) return

    next.fieldAliases[field][header] = Number(next.fieldAliases[field][header] || 0) + 1
  })

  learningState.providers[providerKey] = next
  writeLearningState(learningState)

  return {
    provider: providerKey,
    seen: next.seen,
  }
}

export type OfficialInvoiceItem = {
  id: string
  date: string
  amount: number
  description: string
  kind: 'purchase' | 'refund'
  isRefund: boolean
  installmentNumber: number | null
  installmentTotal: number | null
  raw: Record<string, string>
}

const isInvoicePaymentDescription = (value: string) => {
  const text = normalize(value)
  return /pagamento\s+de\s+fatura|pagamento\s+fatura|pagto\s+fatura|payment\s+of\s+invoice|payment\s+invoice/.test(text)
}

const isRefundDescription = (value: string) => {
  const text = normalize(value)
  return /estorno|refund|chargeback/.test(text)
}

const isInvoicePaymentRow = (values: string[]) => {
  const fullText = normalize(values.join(' '))
  return /pagamento\s+de\s+fatura|pagamento\s+fatura|pagto\s+fatura|payment\s+of\s+invoice|payment\s+invoice/.test(fullText)
}

const isRefundByTransactionType = (value: string) => {
  const text = normalize(value)
  return /estorno|refund|chargeback|credito|credit/.test(text) && !/debito|debit/.test(text)
}

const isStrongNonCardDescription = (value: string) => {
  const text = normalize(value)
  return /salario|salario\s+liquido|receita|rendimento|provento|transferencia|ted|pix\s+recebido|deposito|aporte/.test(text)
}

export type CsvParseResult = {
  supported: boolean
  reason?: string
  providerUsed?: string
  items: OfficialInvoiceItem[]
  learned?: {
    provider: string
    seen: number
  }
}

export const parseCreditCardInvoiceCsv = (content: string, provider: CreditCardCsvProvider): CsvParseResult => {
  const normalizedContent = String(content || '').trim()
  if (!normalizedContent) {
    return {
      supported: false,
      reason: 'Arquivo vazio.',
      items: [],
    }
  }

  const firstLine = normalizedContent.split(/\r?\n/)[0] || ''
  const delimiter = inferDelimiter(firstLine)
  const rows = parseCsvRows(normalizedContent, delimiter)

  if (rows.length < 2) {
    return {
      supported: false,
      reason: 'CSV sem dados suficientes para conciliação.',
      items: [],
    }
  }

  const headers = rows[0].map((header) => String(header || '').trim())
  const dataRows = rows.slice(1)
  const learningState = readLearningState()

  const aliases = buildProviderAliases(provider, learningState)

  const mapping: Record<FieldKey, number> = {
    date: findHeaderIndex(headers, aliases.date),
    description: findHeaderIndex(headers, aliases.description),
    amount: findHeaderIndex(headers, aliases.amount),
    installment: findHeaderIndex(headers, aliases.installment),
    transactionType: findHeaderIndex(headers, aliases.transactionType),
  }

  if (mapping.date < 0 || mapping.description < 0 || mapping.amount < 0) {
    return {
      supported: false,
      reason: 'Arquivo não parece ser uma fatura de cartão suportada (faltam colunas de data, descrição ou valor).',
      items: [],
    }
  }

  const parsedItems: OfficialInvoiceItem[] = []
  const dedupMap = new Map<string, OfficialInvoiceItem>()

  dataRows.forEach((cells, rowIndex) => {
    const date = parseDateValue(cells[mapping.date] || '')
    const description = String(cells[mapping.description] || '').trim()
    const amount = parseMoneyValue(cells[mapping.amount] || '')

    if (!date || !description || amount === null || Number.isNaN(amount)) return
    if (isInvoicePaymentRow(cells)) return
    if (isInvoicePaymentDescription(description)) return

    const transactionTypeValue = mapping.transactionType >= 0 ? String(cells[mapping.transactionType] || '') : ''
    const isRefundByAmount = Number(amount) < 0
    const isRefund = isRefundByAmount || isRefundDescription(description) || isRefundByTransactionType(transactionTypeValue)
    const normalizedAmount = isRefund ? -Math.abs(Number(amount)) : Math.abs(Number(amount))

    const installmentSource = mapping.installment >= 0 ? String(cells[mapping.installment] || '') : description
    const installmentFromDescription = parseInstallmentFromDescription(installmentSource || description)

    const raw = headers.reduce<Record<string, string>>((accumulator, header, index) => {
      accumulator[header] = String(cells[index] || '')
      return accumulator
    }, {})

    const parsedItem: OfficialInvoiceItem = {
      id: `official-${rowIndex}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      amount: Number(normalizedAmount.toFixed(2)),
      description,
      kind: isRefund ? 'refund' : 'purchase',
      isRefund,
      installmentNumber: installmentFromDescription.installmentNumber,
      installmentTotal: installmentFromDescription.installmentTotal,
      raw,
    }

    const dedupKey = `${parsedItem.date}|${normalize(parsedItem.description)}|${parsedItem.amount.toFixed(2)}`
    dedupMap.set(dedupKey, parsedItem)
  })

  parsedItems.push(...Array.from(dedupMap.values()))

  if (!parsedItems.length) {
    return {
      supported: false,
      reason: 'Arquivo enviado não contém lançamentos de fatura de cartão reconhecíveis.',
      items: [],
    }
  }

  const invoiceLikeHits = parsedItems.filter((item) => {
    const text = normalize(item.description)
    return /compra|credito|cartao|fatura|parcela|estorno|anuidade|iof|juros|pagto/.test(text)
  }).length

  const nonCardHits = parsedItems.filter((item) => isStrongNonCardDescription(item.description)).length
  const invoiceRatio = invoiceLikeHits / parsedItems.length
  const nonCardRatio = nonCardHits / parsedItems.length

  const looksLikeCardInvoice = invoiceRatio >= 0.1 || (parsedItems.length >= 1 && nonCardRatio < 0.5)
  const looksLikeNonCardFile = nonCardRatio >= 0.6 && invoiceRatio < 0.1

  if (!looksLikeCardInvoice || looksLikeNonCardFile) {
    return {
      supported: false,
      reason: 'Arquivo não pertence ao contexto de fatura de cartão de crédito suportado.',
      items: [],
    }
  }

  const learned = updateLearningFromMapping(provider, headers, mapping)

  return {
    supported: true,
    providerUsed: provider === 'auto' ? 'genérico/aprendido' : provider,
    items: parsedItems,
    learned,
  }
}

const dateDiffInDays = (left: string, right: string) => {
  const leftDate = new Date(`${left}T12:00:00`)
  const rightDate = new Date(`${right}T12:00:00`)
  if (!Number.isFinite(leftDate.getTime()) || !Number.isFinite(rightDate.getTime())) return 99

  const diffMs = Math.abs(leftDate.getTime() - rightDate.getTime())
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export type ReconciliationConflict = {
  official: OfficialInvoiceItem
  existing: BillExpenseItem
  score: number
  suggestedUpdate: {
    date: string
    amount: number
    description: string
    installmentLabel?: string
    needsUpdate: boolean
  }
}

export type ReconciliationResult = {
  matched: Array<{ official: OfficialInvoiceItem; existing: BillExpenseItem; score: number }>
  missing: OfficialInvoiceItem[]
  conflicts: ReconciliationConflict[]
  existingOnly: BillExpenseItem[]
}

export const reconcileCreditCardBill = (
  officialItems: OfficialInvoiceItem[],
  existingBillItems: BillExpenseItem[],
): ReconciliationResult => {
  const candidates = existingBillItems.filter((item) => Number.isFinite(Number(item.amount || 0)))
  const usedExistingIds = new Set<string>()

  const matched: ReconciliationResult['matched'] = []
  const missing: OfficialInvoiceItem[] = []
  const conflicts: ReconciliationConflict[] = []

  officialItems.forEach((official) => {
    const absoluteOfficialAmount = Math.abs(Number(official.amount || 0))

    const scored = candidates
      .filter((existing) => !usedExistingIds.has(String(existing.id || '')))
      .map((existing) => {
        const absoluteExistingAmount = Math.abs(Number(existing.base_amount ?? existing.amount ?? 0))
        const amountDelta = Math.abs(absoluteOfficialAmount - absoluteExistingAmount)
        const dayDiff = dateDiffInDays(official.date, existing.date)

        const isExactAmount = amountDelta <= 0.01
        const isExactDate = dayDiff === 0
        const isExactDateAndAmount = isExactAmount && isExactDate

        const amountScore = isExactAmount ? 1 : amountDelta <= 0.2 ? 0.62 : 0
        const dateScore = isExactDate ? 1 : dayDiff <= 3 ? 0.55 : 0

        const score = isExactDateAndAmount
          ? 1
          : Number((amountScore * 0.65 + dateScore * 0.35).toFixed(4))

        return {
          existing,
          score,
          isExactDateAndAmount,
          amountScore,
          dayDiff,
          amountDelta,
        }
      })
      .sort((a, b) => b.score - a.score)

    const best = scored[0]

    if (!best || best.amountScore <= 0) {
      missing.push(official)
      return
    }

    const bestId = String(best.existing.id || '')

    if (best.isExactDateAndAmount) {
      if (bestId) usedExistingIds.add(bestId)
      matched.push({ official, existing: best.existing, score: best.score })
      return
    }

    if (best.score < 0.55) {
      missing.push(official)
      return
    }

    if (bestId) usedExistingIds.add(bestId)

    const currentAmount = Math.abs(Number(best.existing.base_amount ?? best.existing.amount ?? 0))
    const nextAmount = Math.abs(Number(official.amount || 0))
    const suggestedDescription = official.description.trim()

    const installmentLabel =
      official.installmentNumber && official.installmentTotal
        ? `${official.installmentNumber}/${official.installmentTotal}`
        : undefined

    const needsUpdate =
      Math.abs(currentAmount - nextAmount) > 0.009
      || best.existing.date !== official.date

    conflicts.push({
      official,
      existing: best.existing,
      score: best.score,
      suggestedUpdate: {
        date: official.date,
        amount: nextAmount,
        description: suggestedDescription,
        installmentLabel,
        needsUpdate,
      },
    })
  })

  const existingOnly = candidates.filter((item) => !usedExistingIds.has(String(item.id || '')))

  return {
    matched,
    missing,
    conflicts,
    existingOnly,
  }
}
