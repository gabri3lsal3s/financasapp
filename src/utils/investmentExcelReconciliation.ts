import * as XLSX from 'xlsx'
import type { PortfolioAssetDefinition, PortfolioOperationType, PortfolioTransaction } from '@/types'
import { isPortfolioIncomeType } from '@/utils/portfolioOperations'
import { buildPortfolioLedger } from '@/utils/portfolioLedger'

export type B3AssetCategory = 'equityB3' | 'fixedIncome' | 'treasury' | 'other'
export type B3MovementCategory = 'trade' | 'income' | 'corporate' | 'ignore'

export interface B3ParseDedupeStats {
  ignoredInternal: number
  ignoredCorporate: number
  dedupedTrades: number
}

export interface B3ParseResult {
  items: B3TransactionItem[]
  ignoredByMovement: number
  dedupe: B3ParseDedupeStats
}

/**
 * Classifica um ticker/produto B3:
 * - equityB3    -> Acoes, FIIs, ETFs (ex: WEGE3, MXRF11, BOVA11)
 * - treasury    -> Tesouro Direto (Selic, IPCA+, Prefixado)
 * - fixedIncome -> CDB, LCI, LCA, CRI, CRA, Debenture
 * - other       -> Outros nao classificados
 */
/** Ticker de direito de subscrição FII (ex: MXRF12, HGLG12) — não é posição permanente. */
export function isB3SubscriptionRightsTicker(ticker: string): boolean {
  return /^[A-Z]{4}12$/.test(String(ticker || '').trim().toUpperCase())
}

export function classifyB3Item(ticker: string, productName?: string): B3AssetCategory {
  const t = ticker.trim().toUpperCase()
  const p = (productName ?? '').trim().toUpperCase()
  const combined = t + ' ' + p

  if (
    combined.includes('TESOURO') ||
    t.startsWith('LFT') ||
    t.startsWith('NTN') ||
    t.startsWith('LTN') ||
    t.startsWith('TES ') ||
    t.startsWith('TESOURO') ||
    /^(IPCA|SELIC|PRE)\s+\d{2}$/i.test(t)
  ) {
    return 'treasury'
  }

  const fixedPrefixes = ['CDB', 'LCI', 'LCA', 'CRI', 'CRA', 'CCB']
  for (const pfx of fixedPrefixes) {
    if (t === pfx || t.startsWith(pfx + '-') || t.startsWith(pfx + ' ') || t.startsWith(pfx)) return 'fixedIncome'
  }
  const fixedKeywords = ['DEBENTURE', 'LETRA DE CR', 'LETRA FINANCEIRA', 'CERTIFICADO DE DEP']
  for (const kw of fixedKeywords) {
    if (combined.includes(kw)) return 'fixedIncome'
  }
  if (t.includes(' - ')) return 'fixedIncome'

  if (/^[A-Z]{4}[0-9]{1,2}$/.test(t)) return 'equityB3'

  return 'other'
}

/** Categoria da linha B3 antes do mapeamento para operation_type do livro-razão. */
export function classifyB3Movement(rawMov: string): B3MovementCategory {
  const m = normalizeString(rawMov)
  if (!m || m.includes('cancelado')) return 'ignore'

  if (m.includes('liquidacao')) return 'trade'
  if (m === 'compra' || m === 'venda') return 'trade'
  if (m.includes('compra / venda') || m.includes('compra/venda')) return 'trade'

  if (m.includes('juros sobre capital')) return 'income'
  if (m.includes('dividendo')) return 'income'
  if (m.includes('rendimento')) return 'income'

  if (m.includes('desdobro') || m.includes('grupamento') || m.includes('bonificacao')) return 'corporate'

  // Movimentações de Renda Fixa e Tesouro Direto
  if (
    m.includes('aplicacao') ||
    m.includes('aplicação') ||
    m.includes('resgate') ||
    m.includes('vencimento')
  ) {
    return 'trade'
  }

  if (
    m.includes('pagamento de juros') ||
    m.includes('juros') ||
    m.includes('amortizacao') ||
    m.includes('amortização')
  ) {
    return 'income'
  }

  // Direitos / oferta de cotas / subscrição: ativos temporários — não entram no livro-razão via conciliação
  if (m.includes('nao exercido')) return 'ignore'
  if (m.includes('subscricao') || m.includes('direito de subscricao') || m.includes('direitos de subscricao')) {
    return 'ignore'
  }
  if (m.includes('oferta') && m.includes('cota')) return 'ignore'

  if (m.includes('cessao de direitos')) return 'ignore'
  // Transferência espelhada (Crédito+Débito, mesma qtd) é movimento interno de custódia — não altera posição
  if (m === 'transferencia' || m.includes('transferencia sem financeiro')) return 'ignore'
  if (
    m.includes('emprestimo') ||
    m.includes('atualizacao') ||
    m.includes('leilao') ||
    m.includes('fracao em ativos') ||
    m.includes('reembolso') ||
    m.includes('retirada de custodia')
  ) {
    return 'ignore'
  }

  return 'ignore'
}

export interface B3TransactionItem {
  id: string
  date: string
  direction: 'Credito' | 'Debito'
  operation_type: PortfolioOperationType
  raw_operation_type: string
  movement_category: B3MovementCategory
  ticker: string
  product_name: string
  institution: string
  quantity: number
  price: number
  total_value: number
  maturity_date?: string | null
}

export type B3FieldKey =
  | 'direction'
  | 'date'
  | 'operationType'
  | 'product'
  | 'institution'
  | 'quantity'
  | 'price'
  | 'totalValue'

const B3_HEADER_ALIASES: Record<B3FieldKey, string[]> = {
  direction: ['entrada/saida', 'entradasaida', 'sentido', 'tipo', 'entrada/saída'],
  date: ['data', 'data de movimentacao', 'dt movimentacao', 'dia', 'data de movimentação'],
  operationType: ['movimentacao', 'tipo movimentacao', 'operacao', 'tipo de movimentacao', 'movimentação', 'tipo movimentação'],
  product: ['produto', 'ativo', 'ticker', 'descricao', 'descrição'],
  institution: ['instituicao', 'corretora', 'agente', 'instituição'],
  quantity: ['quantidade', 'qtd', 'quant'],
  price: ['preco unitario', 'preco', 'valor unitario', 'preco unit', 'preço unitário', 'preço'],
  totalValue: ['valor da operacao', 'valor total', 'valor', 'total', 'valor da operação'],
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

const isLiquidationMovement = (rawMov: string) => normalizeString(rawMov).includes('liquidacao')

const isExplicitTradeMovement = (rawMov: string) => {
  const m = normalizeString(rawMov)
  if (isLiquidationMovement(m)) return true
  if (m === 'compra' || m === 'venda') return true
  return m.includes('compra / venda') || m.includes('compra/venda')
}

const isPlainTransferMovement = (rawMov: string) => {
  const m = normalizeString(rawMov)
  return m === 'transferencia' || m.includes('transferencia sem financeiro')
}

const isRightsCessionMovement = (rawMov: string) => normalizeString(rawMov).includes('cessao de direitos')

const CORPORATE_NAME_TO_TICKER: Record<string, string> = {
  WEG: 'WEGE3',
  VALE: 'VALE3',
  PETROBRAS: 'PETR4',
  'PETROLEO BRASILEIRO': 'PETR4',
  'ITAU UNIBANCO': 'ITUB4',
  ITAU: 'ITUB4',
  ITAUSA: 'ITSA4',
  'BANCO DO BRASIL': 'BBAS3',
  BRADESCO: 'BBDC4',
  TAESA: 'TAEE11',
  KLABIN: 'KLBN11',
  SANEPAR: 'SAPR11',
  ALUPAR: 'ALUP11',
  ENGIE: 'EGIE3',
  ELETROBRAS: 'ELET3',
  COPEL: 'CPLE6',
  'MAGAZINE LUIZA': 'MGLU3',
  'LOJAS RENNER': 'LREN3',
  AMBEV: 'ABEV3',
  JBS: 'JBSS3',
  LOCALIZA: 'RENT3',
  'XP INVESTIMENTOS': 'XPML11',
  'XP LOG': 'XPLG11',
  VINCI: 'VILG11',
  'BRL TRUST': 'BTLG11',
  'BTG PACTUAL': 'BPAC11',
  'CAIXA SEGURIDADE': 'CXSE3',
  'PORTO SEGURO': 'PSSA3',
  EMBRAER: 'EMBR3',
  'RAIA DROGASIL': 'RADL3',
  FLEURY: 'FLRY3',
}

export const parseB3Product = (rawProduct: string) => {
  const clean = String(rawProduct || '').trim()
  if (!clean) return { ticker: '', name: '', maturityDate: null }

  let ticker = ''
  let name = ''
  let maturityDate: string | null = null

  const parts = clean.split(' - ')
  const firstPart = parts[0]?.trim() || ''
  const isCdbOrSimilar = /^(cdb|lci|lca|lc|cri|cra|debenture|debentures)$/i.test(firstPart)

  if (parts.length >= 2) {
    if (isCdbOrSimilar && parts.length >= 3) {
      // Extrai o nome do banco emissor (parts[2]) e remove a data de vencimento se estiver na 4ª parte (ex: "29/12/2025")
      let issuer = parts[2].trim()
      if (parts.length >= 4 && /\b\d{2}[/-]\d{2}[/-]\d{4}\b/.test(parts[3])) {
        issuer = parts[2].trim()
        maturityDate = parseB3Date(parts[3].trim())
      }
      ticker = `${firstPart} - ${issuer}`
      name = parts[1].trim() // Armazena o código (ex: 24F02320359) no name para fins de histórico e conciliação
    } else if (isCdbOrSimilar) {
      ticker = clean
      name = clean
    } else {
      ticker = firstPart
      name = parts.slice(1).join(' - ').trim()
    }
  } else {
    ticker = clean
    name = clean
  }

  // Apenas tenta casar ticker padrão B3 ou nome corporativo se NÃO for CDB/LCI/LCA/etc.
  if (!isCdbOrSimilar) {
    if (!/^[A-Z]{4}[0-9]{1,2}$/i.test(ticker)) {
      const b3Match = clean.match(/\b([A-Z]{4}[0-9]{1,2})(F)?\b/i)
      if (b3Match) {
        ticker = b3Match[1]
        name = clean
      }
    }

    if (!/^[A-Z]{4}[0-9]{1,2}$/i.test(ticker)) {
      const normalizedClean = clean.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      for (const [kw, tck] of Object.entries(CORPORATE_NAME_TO_TICKER)) {
        if (normalizedClean.includes(kw)) {
          ticker = tck
          name = clean
          break
        }
      }
    }
  }

  if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(ticker)) {
    ticker = ticker.slice(0, -1)
  }

  let finalTicker = ticker.toUpperCase()
  if (finalTicker.length > 12 && finalTicker.includes('TESOURO')) {
    let type = 'PRE'
    if (finalTicker.includes('SELIC')) type = 'SELIC'
    else if (finalTicker.includes('IPCA')) type = 'IPCA'
    const yearMatch = finalTicker.match(/\b(20[2-5][0-9])\b/)
    const yearSuffix = yearMatch ? yearMatch[1].slice(-2) : ''
    finalTicker = `${type} ${yearSuffix}`.trim()
  }

  // -----------------------------------------------------------------------
  // Sufixo de vencimento para Renda Fixa (CDB, LCI, LCA, CRI, CRA)
  // Garante que dois CDBs do mesmo banco com vencimentos distintos gerem
  // tickers únicos na carteira. Ex: "CDB - BANCO XP - 2026-12" vs "CDB - BANCO XP - 2028-06"
  // Sem sufixo → mesclados no mesmo lote, gerando erro de contabilidade.
  // -----------------------------------------------------------------------
  if (isCdbOrSimilar && maturityDate) {
    // Usa apenas YYYY-MM para o sufixo (mês de vencimento), evitando tickers longos demais.
    const suffix = maturityDate.slice(0, 7) // "YYYY-MM"
    finalTicker = `${finalTicker} - ${suffix}`
  }

  if (finalTicker.length > 50) {
    finalTicker = finalTicker.slice(0, 50).trim()
  }

  return { ticker: finalTicker, name, maturityDate }
}

export const mapB3OperationType = (
  rawMov: string,
  direction?: 'Credito' | 'Debito',
  totalValue?: number
): PortfolioOperationType => {
  const mov = normalizeString(rawMov)
  const dir = direction ?? 'Credito'

  if (mov.includes('juros sobre capital')) return 'jcp'
  if (mov.includes('dividendo')) return 'dividend'
  if (mov.includes('rendimento')) return 'fii_yield'

  if (mov.includes('pagamento de juros') || mov.includes('juros') || mov.includes('amortizacao') || mov.includes('amortização')) {
    return 'dividend'
  }

  if (mov.includes('aplicacao') || mov.includes('aplicação')) {
    return 'buy'
  }

  if (mov.includes('resgate') || mov.includes('vencimento')) {
    return 'sell'
  }

  if (mov.includes('grupamento')) return 'reverse_split'
  if (mov.includes('desdobro')) return 'split'
  if (mov.includes('subscricao') && !mov.includes('nao exercido')) return 'subscription'
  if (mov.includes('bonificacao')) return 'buy'

  if (mov.includes('compra / venda') || mov.includes('compra/venda')) {
    return dir === 'Debito' ? 'sell' : 'buy'
  }

  if (mov === 'venda' || (mov.includes('venda') && !mov.includes('compra'))) return 'sell'
  if (mov === 'compra' || (mov.includes('compra') && !mov.includes('venda'))) return 'buy'

  if (mov.includes('liquidacao')) {
    if (mov.includes('venda')) return 'sell'
    if (mov.includes('compra')) return 'buy'

    const tv = totalValue ?? 0
    if (dir === 'Debito') {
      if (tv < 0) return 'sell'
      return 'sell'
    }
    if (dir === 'Credito') {
      if (tv > 0) return 'buy'
      return 'buy'
    }
  }

  throw new Error(`Não foi possível mapear operação B3: ${rawMov}`)
}

export const parseB3Date = (val: unknown): string | null => {
  if (val === undefined || val === null) return null
  const str = String(val).trim()
  if (!str) return null

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

  const matchDmy = str.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/)
  if (matchDmy) {
    return `${matchDmy[3]}-${matchDmy[2]}-${matchDmy[1]}`
  }

  const matchYmd = str.match(/^(\d{4})[/-](\d{2})[/-](\d{2})$/)
  if (matchYmd) {
    return `${matchYmd[1]}-${matchYmd[2]}-${matchYmd[3]}`
  }

  return null
}

export const parseNumericValue = (val: unknown): number => {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val

  const raw = String(val).trim().replace(/\s+/g, '').replace(/[R$]/gi, '')
  if (!raw || raw === '-') return 0

  if (/,\d{1,2}$/.test(raw)) {
    const cleaned = raw.replace(/\./g, '').replace(',', '.')
    const num = Number(cleaned)
    return isNaN(num) ? 0 : num
  }

  const num = Number(raw.replace(',', '.'))
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

const tradeGroupKey = (item: B3TransactionItem) =>
  `${item.date}|${item.ticker}|${item.quantity}`

/** Remove pares espelhados, cessões e trades redundantes frente à liquidação. */
export const deduplicateB3Items = (items: B3TransactionItem[]): { items: B3TransactionItem[]; stats: B3ParseDedupeStats } => {
  const stats: B3ParseDedupeStats = {
    ignoredInternal: 0,
    ignoredCorporate: 0,
    dedupedTrades: 0,
  }
  const removeIds = new Set<string>()

  // 1. Pares Transferência espelhados (Crédito + Débito, mesma data/ticker/qtd): sem efeito na posição
  const transferGroups = new Map<string, B3TransactionItem[]>()
  for (const item of items) {
    if (!isPlainTransferMovement(item.raw_operation_type)) continue
    const key = `${item.date}|${item.ticker}|${item.quantity}`
    const list = transferGroups.get(key) ?? []
    list.push(item)
    transferGroups.set(key, list)
  }
  for (const group of transferGroups.values()) {
    const credit = group.find((i) => i.direction === 'Credito')
    const debit = group.find((i) => i.direction === 'Debito')
    if (credit && debit) {
      removeIds.add(credit.id)
      removeIds.add(debit.id)
      stats.ignoredInternal += 2
    }
  }

  // 2. Pares Cessão de Direitos
  const cessionGroups = new Map<string, B3TransactionItem[]>()
  for (const item of items) {
    if (!isRightsCessionMovement(item.raw_operation_type)) continue
    const key = `${item.date}|${item.ticker}|${item.quantity}`
    const list = cessionGroups.get(key) ?? []
    list.push(item)
    cessionGroups.set(key, list)
  }
  for (const group of cessionGroups.values()) {
    if (group.length >= 2) {
      for (const item of group) {
        if (!removeIds.has(item.id)) {
          removeIds.add(item.id)
          stats.ignoredCorporate += 1
        }
      }
    }
  }

  // 3. Preferir Transferência - Liquidação sobre Compra/Venda explícita
  const liquidationKeys = new Set<string>()
  for (const item of items) {
    if (removeIds.has(item.id)) continue
    if (isLiquidationMovement(item.raw_operation_type)) {
      liquidationKeys.add(tradeGroupKey(item))
    }
  }
  for (const item of items) {
    if (removeIds.has(item.id)) continue
    if (!isExplicitTradeMovement(item.raw_operation_type)) continue
    if (isLiquidationMovement(item.raw_operation_type)) continue
    const key = tradeGroupKey(item)
    if (liquidationKeys.has(key)) {
      removeIds.add(item.id)
      stats.dedupedTrades += 1
    }
  }

  // 4. Remover duplicatas exatas de movimentações/compras/vendas e ativos de Renda Fixa/Tesouro
  const seenExact = new Set<string>()
  for (const item of items) {
    if (removeIds.has(item.id)) continue
    const category = classifyB3Item(item.ticker, item.product_name)
    const isTradeOrRF = ['buy', 'sell', 'subscription'].includes(item.operation_type) || 
                        category === 'fixedIncome' || 
                        category === 'treasury'
                        
    if (isTradeOrRF) {
      const key = `${item.date}|${item.ticker.toUpperCase()}|${item.operation_type}|${item.quantity}|${item.price}`
      if (seenExact.has(key)) {
        removeIds.add(item.id)
        stats.dedupedTrades += 1
      } else {
        seenExact.add(key)
      }
    }
  }

  const filtered = items.filter((item) => !removeIds.has(item.id))
  return { items: filtered, stats }
}

export const parseB3Excel = (fileBuffer: ArrayBuffer): B3ParseResult => {
  const data = new Uint8Array(fileBuffer)
  const workbook = XLSX.read(data, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    return { items: [], ignoredByMovement: 0, dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 } }
  }

  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 })

  if (rows.length < 2) {
    return { items: [], ignoredByMovement: 0, dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 } }
  }

  const headers = (rows[0] as unknown[]).map((h) => String(h || '').trim())
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

  if (mapping.date < 0 || mapping.product < 0 || mapping.operationType < 0) {
    throw new Error('Planilha inválida: colunas essenciais não identificadas (Data, Produto ou Movimentação).')
  }

  const items: B3TransactionItem[] = []
  let ignoredByMovement = 0

  ;(dataRows as unknown[][]).forEach((row, idx) => {
    if (!row || row.length === 0) return

    const rawDate = row[mapping.date]
    const date = parseB3Date(rawDate)
    const rawProduct = row[mapping.product]
    const productStr = String(rawProduct || '').trim()

    if (!date || !productStr) return

    const rawOperation = String(row[mapping.operationType] || '')
    const movementCategory = classifyB3Movement(rawOperation)
    if (movementCategory === 'ignore') {
      ignoredByMovement += 1
      return
    }

    const { ticker, name, maturityDate } = parseB3Product(productStr)

    if (isB3SubscriptionRightsTicker(ticker)) {
      ignoredByMovement += 1
      return
    }

    const rawDirection = mapping.direction >= 0 ? row[mapping.direction] : ''
    const direction = normalizeString(String(rawDirection)).includes('debito')
      ? ('Debito' as const)
      : ('Credito' as const)

    const rawTotalVal = mapping.totalValue >= 0 ? row[mapping.totalValue] : undefined
    let quantity = mapping.quantity >= 0 ? parseNumericValue(row[mapping.quantity]) : 1
    let price = mapping.price >= 0 ? parseNumericValue(row[mapping.price]) : 0
    const totalValue =
      mapping.totalValue >= 0 ? parseNumericValue(rawTotalVal) : quantity * price

    const category = classifyB3Item(ticker, name)
    const isRFOrTreasury = category === 'fixedIncome' || category === 'treasury'

    if (quantity <= 0.000_001 && totalValue > 0.000_001 && isRFOrTreasury) {
      quantity = 1
      price = totalValue
    }

    if (isRFOrTreasury && (price <= 0.000_001 || totalValue <= 0.000_001)) {
      ignoredByMovement += 1
      return
    }

    if (quantity <= 0.000_001 && totalValue <= 0.000_001) {
      ignoredByMovement += 1
      return
    }

    let operationType: PortfolioOperationType
    try {
      operationType = mapB3OperationType(rawOperation, direction, totalValue)
    } catch {
      ignoredByMovement += 1
      return
    }

    if (normalizeString(rawOperation).includes('bonificacao') && price > 0 && quantity > 0) {
      // Bonificação: quantidade entra sem custo
      price = 0
    }

    const institution = mapping.institution >= 0 ? String(row[mapping.institution] || '').trim() : ''

    items.push({
      id: `b3-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      date,
      direction,
      operation_type: operationType,
      raw_operation_type: rawOperation,
      movement_category: movementCategory,
      ticker,
      product_name: name,
      institution,
      quantity,
      price,
      total_value: totalValue,
      maturity_date: maturityDate,
    })
  })

  const sorted = items.sort((a, b) => b.date.localeCompare(a.date))
  const { items: deduped, stats } = deduplicateB3Items(sorted)

  return {
    items: deduped,
    ignoredByMovement,
    dedupe: stats,
  }
}

const dateDiffInDays = (left: string, right: string) => {
  const leftDate = new Date(`${left}T12:00:00`)
  const rightDate = new Date(`${right}T12:00:00`)
  if (isNaN(leftDate.getTime()) || isNaN(rightDate.getTime())) return 99

  const diffMs = Math.abs(leftDate.getTime() - rightDate.getTime())
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

const operationTypesCompatible = (
  official: PortfolioOperationType,
  existing: PortfolioOperationType
): boolean => {
  if (official === existing) return true
  if (isPortfolioIncomeType(official) && isPortfolioIncomeType(existing)) return true
  return false
}

export const scoreInvestmentMatch = (official: B3TransactionItem, existing: PortfolioTransaction): number => {
  const isOfficialFixed = classifyB3Item(official.ticker, official.product_name) === 'fixedIncome'
  const isExistingFixed = existing.ticker.toUpperCase().includes('CDB') ||
                          existing.ticker.toUpperCase().includes('LCI') ||
                          existing.ticker.toUpperCase().includes('LCA') ||
                          existing.ticker.toUpperCase().includes('CRI') ||
                          existing.ticker.toUpperCase().includes('CRA') ||
                          existing.ticker.toUpperCase().includes('DEBENTURE')

  let tickerMatch = official.ticker.toUpperCase() === existing.ticker.toUpperCase()

  if (!tickerMatch && (isOfficialFixed || isExistingFixed)) {
    const cleanStr = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]/g, ' ').toUpperCase()
    const wordsOfficial = cleanStr(official.ticker + ' ' + (official.product_name || '')).split(/\s+/).filter(w => w.length > 2)
    const wordsExisting = cleanStr(existing.ticker).split(/\s+/).filter(w => w.length > 2)

    const common = wordsOfficial.filter((w, idx) => wordsExisting.includes(w) && wordsOfficial.indexOf(w) === idx)
    const minWords = Math.min(wordsOfficial.length, wordsExisting.length)
    if (common.length >= 3 || (minWords > 0 && common.length / minWords >= 0.6)) {
      tickerMatch = true
    }
  }

  if (!tickerMatch) return 0
  if (!operationTypesCompatible(official.operation_type, existing.operation_type)) return 0

  const incomeTypeMismatch =
    official.operation_type !== existing.operation_type &&
    isPortfolioIncomeType(official.operation_type) &&
    isPortfolioIncomeType(existing.operation_type)

  const dateDiff = Math.abs(dateDiffInDays(official.date, existing.date))

  const maxDays = isPortfolioIncomeType(official.operation_type) ? 10 : 15
  if (dateDiff > maxDays) return 0

  const qtyDiff = Math.abs(official.quantity - existing.quantity)
  const priceDiff = Math.abs(official.price - existing.price)
  const totalOfficial = official.total_value || official.quantity * official.price
  const totalExisting = existing.quantity * existing.price
  const totalDiff = Math.abs(totalOfficial - totalExisting)

  const isExactDate = dateDiff === 0
  const isExactQty = qtyDiff < 0.0001
  const isExactPrice = priceDiff < 0.0001
  const isExactTotal = totalDiff < 0.01

  if (isExactDate && isExactQty && isExactPrice) {
    return incomeTypeMismatch ? 0.92 : 1.0
  }

  const dateScore = isExactDate ? 1.0 : dateDiff <= 3 ? 0.7 : dateDiff <= 7 ? 0.4 : dateDiff <= 15 ? 0.1 : 0.0

  let valScore = 0.0
  if (isExactQty && isExactPrice) valScore = 1.0
  else if (isExactQty) valScore = 0.7
  else if (isExactPrice) valScore = 0.5
  else if (official.quantity > 0 && existing.quantity > 0) {
    const qtyPct = qtyDiff / official.quantity
    const pricePct = official.price > 0 ? priceDiff / official.price : 0
    if (qtyPct < 0.05 && pricePct < 0.05) valScore = 0.3
  }

  const totalScore = isExactTotal ? 1.0 : totalDiff < 1.0 ? 0.5 : 0.0

  let score = dateScore * 0.4 + valScore * 0.45 + totalScore * 0.15
  if (incomeTypeMismatch) score *= 0.9
  return score
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

  const candidates = existingTransactions.filter(
    (tx) =>
      tx.ticker !== 'SALDO_INV' &&
      tx.ticker !== 'CAIXA' &&
      tx.ticker !== 'SALDO EM CAIXA' &&
      tx.ticker !== 'SALDO_EM_CAIXA'
  )

  const matchedOfficialIds = new Set<string>()
  const passes = [1.0, 0.85, 0.7, 0.45]

  passes.forEach((minScore) => {
    officialItems.forEach((official) => {
      if (matchedOfficialIds.has(official.id)) return

      const scored = candidates
        .filter((existing) => !usedExistingIds.has(existing.id))
        .map((existing) => {
          const score = scoreInvestmentMatch(official, existing)
          return { existing, score }
        })
        .filter((candidate) => candidate.score >= minScore)
        .sort((a, b) => b.score - a.score)

      const best = scored[0]

      if (best) {
        usedExistingIds.add(best.existing.id)
        matchedOfficialIds.add(official.id)

        const isExact = best.score >= 0.999
        if (isExact) {
          matched.push({ official, existing: best.existing, score: best.score })
        } else {
          const needsUpdate =
            best.existing.date !== official.date ||
            Math.abs(best.existing.quantity - official.quantity) > 0.0001 ||
            Math.abs(best.existing.price - official.price) > 0.0001 ||
            best.existing.operation_type !== official.operation_type

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
      }
    })
  })

  const missing = officialItems.filter((official) => !matchedOfficialIds.has(official.id))

  let existingOnly: PortfolioTransaction[] = []
  if (officialItems.length > 0) {
    const dates = officialItems.map((item) => item.date).sort()
    const minDate = dates[0]
    const maxDate = dates[dates.length - 1]

    existingOnly = candidates.filter((tx) => {
      if (usedExistingIds.has(tx.id)) return false
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

export interface B3PositionParseResult {
  /** Renda variável B3 (ações, FIIs, ETFs) — usada na dupla checagem. */
  equity: Record<string, number>
  treasury: Record<string, number>
  fixedIncome: Record<string, number>
  sheetCounts: Record<string, number>
}

export type PositionValidationStatus =
  | 'ok'
  | 'movements_official'
  | 'system_official'
  | 'movements_system'
  | 'all_differ'
  | 'ghost_system'
  | 'missing_everywhere'

export interface PositionValidationRow {
  ticker: string
  official: number
  fromMovements: number
  system: number
  status: PositionValidationStatus
  manualAction: string | null
}

export interface PositionValidationResult {
  rows: PositionValidationRow[]
  allOk: boolean
  mismatchCount: number
  nonEquityNote: string | null
}

export interface PositionAdjustmentSuggestion {
  ticker: string
  targetQty: number
  currentSystemQty: number
  quantity: number
  operation_type: 'buy' | 'sell'
  date: string
  price: number
  label: string
  requiresManualPrice?: boolean
}

export interface PositionAdjustmentOptions {
  asOfDate?: string
  definitions?: PortfolioAssetDefinition[]
  marketPrices?: Record<string, { current_price?: number }>
}

/** Ajustes de compra/venda para alinhar o livro-razão à posição oficial B3. */
export function suggestPositionAdjustments(
  validation: PositionValidationResult,
  transactions: PortfolioTransaction[],
  movementItems: B3TransactionItem[],
  options?: PositionAdjustmentOptions | string,
): PositionAdjustmentSuggestion[] {
  const opts: PositionAdjustmentOptions =
    typeof options === 'string' ? { asOfDate: options } : (options ?? {})
  const fallbackDate = opts.asOfDate ?? new Date().toISOString().slice(0, 10)

  return validation.rows
    .filter((row) => !qtyEqual(row.official, row.system))
    .map((row) => {
      const delta = row.official - row.system
      const operation_type = delta > 0 ? ('buy' as const) : ('sell' as const)
      const quantity = Math.round(Math.abs(delta) * 1_000_000) / 1_000_000
      const price = resolveAdjustmentPrice(
        transactions,
        row.ticker,
        opts.definitions,
        opts.marketPrices,
      )
      const requiresManualPrice = price <= 0
      const date = resolveAdjustmentDate(transactions, movementItems, row.ticker, fallbackDate)
      const label =
        row.official <= 0.000_001
          ? `Zerar posição (vender ${row.system} cotas)`
          : delta > 0
            ? `Comprar ${quantity} cotas (sistema ${row.system} → B3 ${row.official})`
            : `Vender ${quantity} cotas (sistema ${row.system} → B3 ${row.official})`

      return {
        ticker: row.ticker,
        targetQty: row.official,
        currentSystemQty: row.system,
        quantity,
        operation_type,
        date,
        price,
        label,
        requiresManualPrice,
      }
    })
    .filter((s) => s.quantity > 0.000_001)
}

function resolveAdjustmentDate(
  transactions: PortfolioTransaction[],
  movementItems: B3TransactionItem[],
  ticker: string,
  fallback: string
): string {
  const upper = ticker.toUpperCase()
  let maxDate = ''

  for (const tx of transactions) {
    if (tx.ticker.toUpperCase() !== upper || tx.cash_offset_source_id) continue
    if (tx.date > maxDate) maxDate = tx.date
  }
  for (const item of movementItems) {
    if (item.ticker.toUpperCase() !== upper) continue
    if (item.date > maxDate) maxDate = item.date
  }

  return maxDate || fallback
}

function resolveAdjustmentPrice(
  transactions: PortfolioTransaction[],
  ticker: string,
  definitions?: PortfolioAssetDefinition[],
  marketPrices?: Record<string, { current_price?: number }>,
): number {
  const upper = ticker.toUpperCase()
  const relevant = transactions
    .filter(
      (tx) =>
        tx.ticker.toUpperCase() === upper &&
        !tx.cash_offset_source_id &&
        tx.price > 0 &&
        (tx.operation_type === 'buy' || tx.operation_type === 'sell'),
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  if (relevant.length > 0) return relevant[0].price

  const anyPriced = transactions
    .filter((tx) => tx.ticker.toUpperCase() === upper && tx.price > 0)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (anyPriced[0]?.price) return anyPriced[0].price

  const def = definitions?.find((d) => d.ticker.toUpperCase() === upper)
  if (def?.manual_current_value && def.manual_current_value > 0) {
    return def.manual_current_value
  }

  const market = marketPrices?.[upper]?.current_price
  if (market && market > 0) return market

  return 0
}

const POSITION_EQUITY_SHEETS = new Set([
  'acoes',
  'acao',
  'etf',
  'fundodeinvestimento',
  'fundosdeinvestimento',
])

const isPositionTotalRow = (row: unknown[]): boolean => {
  const joined = row.map((c) => String(c ?? '').trim().toLowerCase()).join('|')
  return joined.includes('total') && !/[a-z]{4}\d{1,2}/i.test(joined)
}

const sheetCategoryFromName = (sheetName: string): B3AssetCategory | 'skip' => {
  const key = normalizeHeader(sheetName)
  if (POSITION_EQUITY_SHEETS.has(key)) return 'equityB3'
  if (key.includes('tesouro')) return 'treasury'
  if (key.includes('rendafixa') || key.includes('rendafixo')) return 'fixedIncome'
  return 'skip'
}

/**
 * Relatório de posição atual B3/XP (multi-abas: Ações, ETF, FIIs, RF, Tesouro).
 * Valida cotas oficiais contra movimentações e livro-razão.
 */
export const parseB3PositionExcel = (fileBuffer: ArrayBuffer): B3PositionParseResult => {
  const data = new Uint8Array(fileBuffer)
  const workbook = XLSX.read(data, { type: 'array' })
  const equity: Record<string, number> = {}
  const treasury: Record<string, number> = {}
  const fixedIncome: Record<string, number> = {}
  const sheetCounts: Record<string, number> = {}

  for (const sheetName of workbook.SheetNames) {
    const category = sheetCategoryFromName(sheetName)
    if (category === 'skip') continue

    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 })
    if (rows.length < 2) continue

    const headers = (rows[0] as unknown[]).map((h) => String(h || '').trim())
    const codeIdx = findHeaderIndex(headers, [
      'codigo de negociacao',
      'código de negociação',
      'codigo isin',
      'código isin',
      'codigo',
    ])
    const productIdx = findHeaderIndex(headers, ['produto', 'ativo'])
    const qtyIdx = findHeaderIndex(headers, ['quantidade', 'quantidade disponivel', 'quantidade disponível'])

    if (qtyIdx < 0) continue

    let sheetCount = 0
    ;(rows.slice(1) as unknown[][]).forEach((row) => {
      if (!row || row.length === 0 || isPositionTotalRow(row)) return

      let ticker = ''
      
      // Para Renda Fixa e Tesouro, priorizamos o nome do produto para extrair o ticker
      // humanamente legível compatível com as movimentações e livro-razão.
      if (category !== 'equityB3' && productIdx >= 0) {
        const productRaw = String(row[productIdx] ?? '').trim()
        const parsed = parseB3Product(productRaw)
        ticker = parsed.ticker
        if (!ticker && productRaw) {
          ticker = productRaw.slice(0, 80)
        }
      }

      // Fallback ou Renda Variável (onde o código oficial ex: BBAS3 é soberano)
      if (!ticker && codeIdx >= 0) {
        const code = String(row[codeIdx] ?? '').trim().toUpperCase()
        if (/^[A-Z]{4}\d{1,2}$/.test(code)) {
          ticker = code
        } else if (code.length >= 4 && category !== 'equityB3') {
          ticker = code
        }
      }

      if (!ticker && productIdx >= 0) {
        const productRaw = String(row[productIdx] ?? '').trim()
        const parsed = parseB3Product(productRaw)
        ticker = parsed.ticker
        if (!ticker && category !== 'equityB3' && productRaw) {
          ticker = productRaw.slice(0, 80)
        }
      }

      if (!ticker) return

      if (isB3SubscriptionRightsTicker(ticker)) return

      const qty = parseNumericValue(row[qtyIdx])
      if (qty <= 0.000_001) return

      const target =
        category === 'equityB3' ? equity : category === 'treasury' ? treasury : fixedIncome

      target[ticker] = (target[ticker] ?? 0) + qty
      sheetCount += 1
    })

    if (sheetCount > 0) sheetCounts[sheetName] = sheetCount
  }

  return { equity, treasury, fixedIncome, sheetCounts }
}

export const isB3PositionWorkbook = (fileBuffer: ArrayBuffer): boolean => {
  try {
    const data = new Uint8Array(fileBuffer)
    const workbook = XLSX.read(data, { type: 'array' })
    const hasPositionSheet = workbook.SheetNames.some((name) => {
      const key = normalizeHeader(name)
      return POSITION_EQUITY_SHEETS.has(key) || key.includes('tesouro') || key.includes('rendafixa')
    })
    if (!hasPositionSheet) return false

    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1 })
    const headers = ((rows[0] as unknown[]) ?? []).map((h) => String(h || '').trim())
    const hasTradingCode = findHeaderIndex(headers, ['codigo de negociacao', 'código de negociação']) >= 0
    const hasMovement = findHeaderIndex(headers, B3_HEADER_ALIASES.operationType) >= 0
    return hasTradingCode && !hasMovement
  } catch {
    return false
  }
}

const qtyEqual = (a: number, b: number) => Math.abs(a - b) <= 0.0001

const buildManualAction = (row: Omit<PositionValidationRow, 'manualAction'>): string | null => {
  switch (row.status) {
    case 'ok':
      return null
    case 'movements_official':
      return `O extrato de movimentação não reproduz a posição oficial de ${row.ticker}. Inclua um extrato mais antigo/completo ou cadastre manualmente os eventos faltantes (compras, vendas, desdobros, grupamentos).`
    case 'system_official':
      return `O livro-razão difere da posição B3 em ${row.ticker}. Revolva lançamentos faltantes, divergentes ou exclusivos do sistema nas etapas anteriores.`
    case 'movements_system':
      return `Movimentações e livro-razão divergem em ${row.ticker}, mas a posição oficial já confere com uma das fontes. Ajuste o lado inconsistente antes de concluir.`
    case 'all_differ':
      return `Três fontes diferentes para ${row.ticker}. Corrija o livro-razão, reimporte movimentações e confira desdobros/grupamentos registrados como cotas creditadas (não como multiplicador).`
    case 'ghost_system':
      return `${row.ticker} consta no livro-razão com saldo, mas não aparece na posição B3. Pode ser venda não registrada, ticker errado ou ativo já zerado na custódia — exclua ou corrija no livro-razão.`
    case 'missing_everywhere':
      return null
    default:
      return null
  }
}

/** Cruza posição oficial, posição derivada das movimentações e livro-razão. */
export function buildPositionValidation(
  officialEquity: Record<string, number>,
  fromMovements: Record<string, number>,
  system: Record<string, number>
): PositionValidationResult {
  const tickers = new Set([
    ...Object.keys(officialEquity),
    ...Object.keys(fromMovements),
    ...Object.keys(system),
  ])

  const rows: PositionValidationRow[] = []

  for (const ticker of Array.from(tickers).sort()) {
    const official = officialEquity[ticker] ?? 0
    const movementQty = fromMovements[ticker] ?? 0
    const systemQty = system[ticker] ?? 0

    const hasOfficial = official > 0.000_001
    const hasMovements = movementQty > 0.000_001
    const hasSystem = systemQty > 0.000_001

    if (!hasOfficial && !hasMovements && !hasSystem) continue

    let status: PositionValidationStatus = 'ok'

    const officialMovements = qtyEqual(official, movementQty)
    const officialSystem = qtyEqual(official, systemQty)
    const movementsSystem = qtyEqual(movementQty, systemQty)

    if (officialMovements && officialSystem) {
      status = 'ok'
    } else if (!hasOfficial && hasSystem && !hasMovements) {
      status = 'ghost_system'
    } else if (!officialMovements && !officialSystem && !movementsSystem) {
      status = 'all_differ'
    } else if (!officialMovements && officialSystem) {
      status = 'movements_official'
    } else if (officialMovements && !officialSystem) {
      status = 'system_official'
    } else if (!movementsSystem) {
      status = 'movements_system'
    } else {
      status = 'all_differ'
    }

    const base = {
      ticker,
      official: hasOfficial ? official : 0,
      fromMovements: hasMovements ? movementQty : 0,
      system: hasSystem ? systemQty : 0,
      status,
    }
    rows.push({
      ...base,
      manualAction: buildManualAction(base),
    })
  }

  const mismatchCount = rows.filter((r) => r.status !== 'ok').length
  return {
    rows: rows.filter((r) => r.official > 0 || r.fromMovements > 0 || r.system > 0),
    allOk: mismatchCount === 0,
    mismatchCount,
    nonEquityNote: null,
  }
}

/** Posição por ticker após aplicar itens parseados (pré-visualização na conciliação). */
export function computePositionsFromB3Items(items: B3TransactionItem[]): Record<string, number> {
  const transactions: PortfolioTransaction[] = items.map((item) => ({
    id: item.id,
    portfolio_id: '',
    ticker: item.ticker,
    operation_type: item.operation_type,
    quantity: item.quantity,
    price: item.price,
    date: item.date,
    created_at: '',
  }))
  const ledger = buildPortfolioLedger(transactions)
  const positions: Record<string, number> = {}
  for (const [ticker, entry] of Object.entries(ledger)) {
    if (entry.quantity > 0.000_001) {
      positions[ticker] = Math.round(entry.quantity * 1_000_000) / 1_000_000
    }
  }
  return positions
}
