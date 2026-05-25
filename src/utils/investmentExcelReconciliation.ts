export type B3AssetCategory = 'equityB3' | 'fixedIncome' | 'treasury' | 'other'

/**
 * Classifica um ticker/produto B3:
 * - equityB3    -> Acoes, FIIs, ETFs (ex: WEGE3, MXRF11, BOVA11)
 * - treasury    -> Tesouro Direto (Selic, IPCA+, Prefixado)
 * - fixedIncome -> CDB, LCI, LCA, CRI, CRA, Debenture
 * - other       -> Outros nao classificados
 */
export function classifyB3Item(ticker: string, productName?: string): B3AssetCategory {
  const t = ticker.trim().toUpperCase()
  const p = (productName ?? '').trim().toUpperCase()
  const combined = t + ' ' + p

  // 1. Tesouro Direto
  if (combined.includes('TESOURO') || t.startsWith('LFT') || t.startsWith('NTN') || t.startsWith('LTN')) {
    return 'treasury'
  }

  // 2. Renda fixa por prefixo
  const fixedPrefixes = ['CDB', 'LCI', 'LCA', 'CRI', 'CRA', 'CCB']
  for (const pfx of fixedPrefixes) {
    if (t === pfx || t.startsWith(pfx + '-') || t.startsWith(pfx + ' ')) return 'fixedIncome'
  }
  // Renda fixa por palavra-chave
  const fixedKeywords = ['DEBENTURE', 'LETRA DE CR', 'LETRA FINANCEIRA', 'CERTIFICADO DE DEP']
  for (const kw of fixedKeywords) {
    if (combined.includes(kw)) return 'fixedIncome'
  }
  // Ticker com ' - ' = produto de RF (ex: 'CDB - Banco X')
  if (t.includes(' - ')) return 'fixedIncome'

  // 3. Ativo B3 renda variavel (Acoes, FIIs, ETFs)
  if (/^[A-Z]{4}[0-9]{1,2}$/.test(t)) return 'equityB3'

  return 'other'
}

export interface B3TransactionItem {
  id: string
  date: string // YYYY-MM-DD
  direction: 'Credito' | 'Debito'
  operation_type: PortfolioOperationType
  raw_operation_type: string // B3 MovimentaÃ§Ã£o
  ticker: string // e.g. EGIE3, Tesouro Selic 2031
  product_name: string // e.g. ENGIE BRASIL ENERGIA S.A.
  institution: string
  quantity: number
  price: number
  total_value: number
}

export type B3FieldKey = 'direction' | 'date' | 'operationType' | 'product' | 'institution' | 'quantity' | 'price' | 'totalValue'

const B3_HEADER_ALIASES: Record<B3FieldKey, string[]> = {
  direction: ['entrada/saida', 'entradasaida', 'sentido', 'tipo', 'entrada/saÃ­da'],
  date: ['data', 'data de movimentacao', 'dt movimentacao', 'dia', 'data de movimentaÃ§Ã£o'],
  operationType: ['movimentacao', 'tipo movimentacao', 'operacao', 'tipo de movimentacao', 'movimentaÃ§Ã£o', 'tipo movimentaÃ§Ã£o'],
  product: ['produto', 'ativo', 'ticker', 'descricao', 'descriÃ§Ã£o'],
  institution: ['instituicao', 'corretora', 'agente', 'instituiÃ§Ã£o'],
  quantity: ['quantidade', 'qtd', 'quant'],
  price: ['preco unitario', 'preco', 'valor unitario', 'preco unit', 'preÃ§o unitÃ¡rio', 'preÃ§o'],
  totalValue: ['valor da operacao', 'valor total', 'valor', 'total', 'valor da operaÃ§Ã£o'],
}

const normalizeHeader = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const normalizeString = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export const parseB3Product = (rawProduct: string) => {
  const clean = String(rawProduct || '').trim()
  if (!clean) return { ticker: '', name: '' }
  
  const parts = clean.split(' - ')
  if (parts.length >= 2) {
    const firstPart = parts[0].trim()
    const isCdbOrSimilar = /^(cdb|lci|lca|lc|cri|cra|debenture|debentures)$/i.test(firstPart)
    
    if (isCdbOrSimilar && parts.length >= 3) {
      const ticker = `${firstPart} - ${parts[1].trim()}`
      const name = parts.slice(2).join(' - ').trim()
      return { ticker, name }
    } else if (isCdbOrSimilar) {
      return { ticker: clean, name: clean }
    }
    
    const ticker = firstPart
    const name = parts.slice(1).join(' - ').trim()
    return { ticker, name }
  }
  
  return { ticker: clean, name: clean }
}

export const mapB3OperationType = (rawMov: string, direction?: 'Credito' | 'Debito'): PortfolioOperationType => {
  const mov = normalizeString(rawMov)
  
  if (mov.includes('compra')) return 'buy'
  if (mov.includes('venda')) return 'sell'
  if (
    mov.includes('dividendo') ||
    mov.includes('juros sobre capital') ||
    mov.includes('rendimento') ||
    mov.includes('jcp') ||
    mov.includes('provento')
  ) {
    return 'dividend'
  }
  if (mov.includes('subscricao') || mov.includes('subscriÃ§Ã£o')) return 'subscription'
  if (mov.includes('desdobro') || mov.includes('grupamento') || mov.includes('split')) return 'split'
  
  if (direction === 'Debito') return 'sell'
  return 'buy' // Default
}

export const parseB3Date = (val: any): string | null => {
  if (val === undefined || val === null) return null
  const str = String(val).trim()
  if (!str) return null

  // Se for data serial do Excel (nÃºmero)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const serial = Number(str)
    const utc_days = Math.floor(serial - 25569)
    const utc_value = utc_days * 86400
    const date_info = new Date(utc_value * 1000)
    const year = date_info.getUTCFullYear()
    const month = String(date_info.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date_info.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Se for DD/MM/YYYY
  const matchDmy = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (matchDmy) {
    return `${matchDmy[3]}-${matchDmy[2]}-${matchDmy[1]}`
  }

  // Se for YYYY-MM-DD
  const matchYmd = str.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/)
  if (matchYmd) {
    return `${matchYmd[1]}-${matchYmd[2]}-${matchYmd[3]}`
  }

  return null
}

const parseNumericValue = (val: any): number => {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return val
  
  const cleaned = String(val)
    .replace(/\s+/g, '')
    .replace(/[R$]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  
  const num = Number(cleaned)
  return isNaN(num) ? 0 : num
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

export const parseB3Excel = (fileBuffer: ArrayBuffer): B3TransactionItem[] => {
  const data = new Uint8Array(fileBuffer)
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 })

  if (rows.length < 2) return []

  const headers = rows[0].map((h) => String(h || '').trim())
  const dataRows = rows.slice(1)

  const mapping: Record<B3FieldKey, number> = {
    direction: findHeaderIndex(headers, B3_HEADER_ALIASES.direction),
    date: findHeaderIndex(headers, B3_HEADER_ALIASES.date),
    operationType: findHeaderIndex(headers, B3_HEADER_ALIASES.operationType),
    product: findHeaderIndex(headers, B3_HEADER_ALIASES.product),
    institution: findHeaderIndex(headers, B3_HEADER_ALIASES.institution),
    quantity: findHeaderIndex(headers, B3_HEADER_ALIASES.quantity),
    price: findHeaderIndex(headers, B3_HEADER_ALIASES.price),
    totalValue: findHeaderIndex(headers, B3_HEADER_ALIASES.totalValue),
  }

  // Deve haver pelo menos Data, Produto e OperaÃ§Ã£o
  if (mapping.date < 0 || mapping.product < 0 || mapping.operationType < 0) {
    throw new Error('Planilha invÃ¡lida: colunas essenciais nÃ£o identificadas (Data, Produto ou MovimentaÃ§Ã£o).')
  }

  const items: B3TransactionItem[] = []

  dataRows.forEach((row, idx) => {
    if (!row || row.length === 0) return

    const rawDate = row[mapping.date]
    const date = parseB3Date(rawDate)
    const rawProduct = row[mapping.product]
    const productStr = String(rawProduct || '').trim()

    if (!date || !productStr) return

    const { ticker, name } = parseB3Product(productStr)
    const rawDirection = mapping.direction >= 0 ? row[mapping.direction] : ''
    const direction = normalizeString(String(rawDirection)).includes('debito') ? 'Debito' as const : 'Credito' as const

    const rawOperation = row[mapping.operationType]
    const operationType = mapB3OperationType(String(rawOperation), direction)

    const institution = mapping.institution >= 0 ? String(row[mapping.institution] || '').trim() : ''
    const quantity = mapping.quantity >= 0 ? parseNumericValue(row[mapping.quantity]) : 1
    const price = mapping.price >= 0 ? parseNumericValue(row[mapping.price]) : 0
    const totalValue = mapping.totalValue >= 0 ? parseNumericValue(row[mapping.totalValue]) : quantity * price

    items.push({
      id: `b3-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      direction,
      operation_type: operationType,
      raw_operation_type: String(rawOperation || ''),
      ticker,
      product_name: name,
      institution,
      quantity,
      price,
      total_value: totalValue,
    })
  })

  // Ordenar por data mais recente
  return items.sort((a, b) => b.date.localeCompare(a.date))
}

const dateDiffInDays = (left: string, right: string) => {
  const leftDate = new Date(`${left}T12:00:00`)
  const rightDate = new Date(`${right}T12:00:00`)
  if (isNaN(leftDate.getTime()) || isNaN(rightDate.getTime())) return 99

  const diffMs = Math.abs(leftDate.getTime() - rightDate.getTime())
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export const scoreInvestmentMatch = (official: B3TransactionItem, existing: PortfolioTransaction): number => {
  if (official.ticker.toUpperCase() !== existing.ticker.toUpperCase()) return 0
  if (official.operation_type !== existing.operation_type) return 0

  const dateDiff = Math.abs(dateDiffInDays(official.date, existing.date))
  const qtyDiff = Math.abs(official.quantity - existing.quantity)
  const priceDiff = Math.abs(official.price - existing.price)
  const totalOfficial = official.total_value || (official.quantity * official.price)
  const totalExisting = existing.quantity * existing.price
  const totalDiff = Math.abs(totalOfficial - totalExisting)

  const isExactDate = dateDiff === 0
  const isExactQty = qtyDiff < 0.0001
  const isExactPrice = priceDiff < 0.0001
  const isExactTotal = totalDiff < 0.01

  if (isExactDate && isExactQty && isExactPrice) return 1.0 // Perfeito

  // Pesos: 40% Data, 45% Quantidade/PreÃ§o, 15% Valor Total
  const dateScore = isExactDate ? 1.0 : dateDiff <= 3 ? 0.7 : dateDiff <= 7 ? 0.4 : dateDiff <= 15 ? 0.1 : 0.0
  
  let valScore = 0.0
  if (isExactQty && isExactPrice) valScore = 1.0
  else if (isExactQty) valScore = 0.7
  else if (isExactPrice) valScore = 0.5
  else if (official.quantity > 0 && existing.quantity > 0) {
    const qtyPct = qtyDiff / official.quantity
    const pricePct = priceDiff / official.price
    if (qtyPct < 0.05 && pricePct < 0.05) valScore = 0.3
  }
  
  const totalScore = isExactTotal ? 1.0 : totalDiff < 1.0 ? 0.5 : 0.0

  return dateScore * 0.4 + valScore * 0.45 + totalScore * 0.15
}

export interface InvestmentReconciliationConflict {
  official: B3TransactionItem
  existing: PortfolioTransaction
  score: number
  suggestedUpdate: {
    date: string
    quantity: number
    price: number
    operation_type: PortfolioOperationType
    needsUpdate: boolean
  }
}

export interface InvestmentReconciliationResult {
  matched: Array<{ official: B3TransactionItem; existing: PortfolioTransaction; score: number }>
  conflicts: InvestmentReconciliationConflict[]
  missing: B3TransactionItem[]
  existingOnly: PortfolioTransaction[]
}

export const reconcileInvestmentTransactions = (
  officialItems: B3TransactionItem[],
  existingTransactions: PortfolioTransaction[]
): InvestmentReconciliationResult => {
  const usedExistingIds = new Set<string>()
  const matched: InvestmentReconciliationResult['matched'] = []
  const conflicts: InvestmentReconciliationResult['conflicts'] = []
  const missing: B3TransactionItem[] = []

  // Filtra transaÃ§Ãµes legÃ­timas (ignora caixas automÃ¡ticos se houver)
  const candidates = existingTransactions.filter(
    (tx) =>
      tx.ticker !== 'SALDO_INV' &&
      tx.ticker !== 'CAIXA' &&
      tx.ticker !== 'SALDO EM CAIXA' &&
      tx.ticker !== 'SALDO_EM_CAIXA'
  )

  officialItems.forEach((official) => {
    const scored = candidates
      .filter((existing) => !usedExistingIds.has(existing.id))
      .map((existing) => {
        const score = scoreInvestmentMatch(official, existing)
        return { existing, score }
      })
      .filter((candidate) => candidate.score >= 0.45)
      .sort((a, b) => b.score - a.score)

    const best = scored[0]

    if (!best) {
      missing.push(official)
      return
    }

    usedExistingIds.add(best.existing.id)

    const isExact = best.score >= 0.999
    if (isExact) {
      matched.push({ official, existing: best.existing, score: best.score })
    } else {
      const needsUpdate =
        best.existing.date !== official.date ||
        Math.abs(best.existing.quantity - official.quantity) > 0.0001 ||
        Math.abs(best.existing.price - official.price) > 0.0001

      conflicts.push({
        official,
        existing: best.existing,
        score: best.score,
        suggestedUpdate: {
          date: official.date,
          quantity: official.quantity,
          price: official.price,
          operation_type: official.operation_type,
          needsUpdate,
        },
      })
    }
  })

  // Descobrir transaÃ§Ãµes que existem apenas no livro-razÃ£o no perÃ­odo do arquivo
  let existingOnly: PortfolioTransaction[] = []
  if (officialItems.length > 0) {
    const dates = officialItems.map((item) => item.date).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]

    existingOnly = candidates.filter((tx) => {
      if (usedExistingIds.has(tx.id)) return false
      // Verifica se a transaÃ§Ã£o estÃ¡ dentro da janela do arquivo (com tolerÃ¢ncia de 3 dias nas bordas)
      const dayDiffMin = dateDiffInDays(tx.date, minDate)
      const dayDiffMax = dateDiffInDays(tx.date, maxDate)
      
      const inWindow = tx.date >= minDate && tx.date <= maxDate
      const nearWindow = (tx.date < minDate && dayDiffMin <= 3) || (tx.date > maxDate && dayDiffMax <= 3)

      return inWindow || nearWindow
    })
  }

  return {
    matched,
    conflicts,
    missing,
    existingOnly,
  }
}
