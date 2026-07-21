import * as XLSX from 'xlsx'
import type { PortfolioOperationType } from '@/types'

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

export interface B3PositionParseResult {
  /** Renda variável B3 (ações, FIIs, ETFs) — usada na dupla checagem. */
  equity: Record<string, number>
  treasury: Record<string, number>
  fixedIncome: Record<string, number>
  sheetCounts: Record<string, number>
}

const B3_HEADER_ALIASES: Record<B3FieldKey, string[]> = {
  direction: [
    'entrada/saida', 'entradasaida', 'sentido', 'tipo', 'entrada/saída',
    'entrada / saída', 'entrada / saida', 'c/d', 'credito/debito', 'credito / debito',
    'movimento', 'debito/credito', 'débito/crédito'
  ],
  date: [
    'data', 'data de movimentacao', 'dt movimentacao', 'dia', 'data de movimentação',
    'data da operacao', 'data operacao', 'data do negocio', 'data pregao', 'data liquidacao',
    'data da operação', 'data operação', 'data liquidação', 'dt. movimentacao', 'dt. movimentação'
  ],
  operationType: [
    'movimentacao', 'tipo movimentacao', 'operacao', 'tipo de movimentacao', 'movimentação',
    'tipo movimentação', 'tipo de operacao', 'tipo operacao', 'tipo da operacao',
    'historico', 'histórico', 'evento', 'tipo de operação', 'tipo operação'
  ],
  product: [
    'produto', 'ativo', 'ticker', 'descricao', 'descrição', 'codigo', 'código',
    'codigo de negociacao', 'código de negociação', 'codigo do ativo', 'código do ativo',
    'papel', 'discriminacao', 'discriminação'
  ],
  institution: [
    'instituicao', 'corretora', 'agente', 'instituição', 'instituicao financeira',
    'instituição financeira', 'custodiante', 'agente custodiante'
  ],
  quantity: [
    'quantidade', 'qtd', 'quant', 'qtd.', 'quantidade negociada', 'quant.'
  ],
  price: [
    'preco unitario', 'preco', 'valor unitario', 'preco unit', 'preço unitário', 'preço',
    'preco (r$)', 'preço (r$)', 'preco medio', 'preço médio', 'valor unitario (r$)', 'valor unitário (r$)'
  ],
  totalValue: [
    'valor da operacao', 'valor total', 'valor', 'total', 'valor da operação',
    'valor (r$)', 'valor liquidado', 'valor negociado', 'valor liquido', 'valor líquido', 'financeiro'
  ],
}

const normalizeHeader = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

export const normalizeString = (value: string) =>
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

export const isPlainTransferMovement = (rawMov: string) => {
  const m = normalizeString(rawMov)
  return m === 'transferencia' || m.includes('transferencia sem financeiro')
}

const isRightsCessionMovement = (rawMov: string) => normalizeString(rawMov).includes('cessao de direitos')

const findHeaderIndex = (headers: string[], candidates: string[]) => {
  const normalizedHeaders = headers.map(normalizeHeader)
  const normalizedCandidates = candidates.map(normalizeHeader)

  for (let idx = 0; idx < normalizedHeaders.length; idx += 1) {
    const header = normalizedHeaders[idx]
    if (normalizedCandidates.includes(header)) return idx
  }

  return -1
}

interface B3HeaderValidation {
  valid: boolean
  found: Record<string, string | null>
  missing: string[]
  foundHeaders: string[]
}

/**
 * Valida os cabeçalhos da planilha de movimentação B3 e retorna um diagnóstico
 * detalhado sobre colunas encontradas, ausentes e sugestões de correção.
 */
export function validateB3MovementHeaders(headers: string[]): B3HeaderValidation {
  const found: Record<string, string | null> = {
    date: null,
    operationType: null,
    product: null,
    direction: null,
    quantity: null,
    price: null,
    totalValue: null,
    institution: null,
  }
  const missing: string[] = []

  const dateIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.date)
  if (dateIdx >= 0) found.date = headers[dateIdx]
  else missing.push('Data')

  const opIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.operationType)
  if (opIdx >= 0) found.operationType = headers[opIdx]
  else missing.push('Movimentação')

  const prodIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.product)
  if (prodIdx >= 0) found.product = headers[prodIdx]
  else missing.push('Produto')

  const dirIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.direction)
  if (dirIdx >= 0) found.direction = headers[dirIdx]

  const qtyIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.quantity)
  if (qtyIdx >= 0) found.quantity = headers[qtyIdx]

  const priceIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.price)
  if (priceIdx >= 0) found.price = headers[priceIdx]

  const tvIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.totalValue)
  if (tvIdx >= 0) found.totalValue = headers[tvIdx]

  const instIdx = findHeaderIndex(headers, B3_HEADER_ALIASES.institution)
  if (instIdx >= 0) found.institution = headers[instIdx]

  return {
    valid: missing.length === 0,
    found,
    missing,
    foundHeaders: headers.filter((h) => h.length > 0),
  }
}

function formatHeaderValidationError(validation: B3HeaderValidation): string {
  const lines: string[] = [
    '[AVISO] A planilha enviada não tem o formato esperado da B3.',
    '',
    `Colunas encontradas no arquivo (${validation.foundHeaders.length}): ${validation.foundHeaders.join(', ') || '(nenhuma)'}`,
  ]

  if (validation.missing.length > 0) {
    lines.push('', '[ERRO] Colunas obrigatórias ausentes:')
    for (const col of validation.missing) {
      const suggestions: Record<string, string> = {
        Data: 'Espere um cabeçalho como "Data", "Data de Movimentação" ou "Dt. Movimentação"',
        Movimentação: 'Espere um cabeçalho como "Movimentação", "Tipo Movimentação" ou "Operação"',
        Produto: 'Espere um cabeçalho como "Produto", "Ativo", "Ticker" ou "Descrição"',
      }
      lines.push(`  • "${col}" — ${suggestions[col] || ''}`)
    }
    lines.push('', 'Dica: Exporte o relatório pelo menu Investimentos → Movimentações (.xlsx) da sua corretora.')
  } else {
    lines.push('', 'Todas as colunas obrigatórias identificadas!')
    lines.push('', `   Data: ${validation.found.date}`)
    lines.push(`   Movimentação: ${validation.found.operationType}`)
    lines.push(`   Produto: ${validation.found.product}`)
    if (validation.found.direction) lines.push(`   Entrada/Saída: ${validation.found.direction}`)
    if (validation.found.quantity) lines.push(`   Quantidade: ${validation.found.quantity}`)
    if (validation.found.price) lines.push(`   Preço: ${validation.found.price}`)
    if (validation.found.totalValue) lines.push(`   Valor Total: ${validation.found.totalValue}`)
  }

  return lines.join('\n')
}

const tradeGroupKey = (item: B3TransactionItem) =>
  `${item.date}|${item.ticker}|${item.quantity}`

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
      let issuer = parts[2].trim()
      if (parts.length >= 4 && /\b\d{2}[/-]\d{2}[/-]\d{4}\b/.test(parts[3])) {
        issuer = parts[2].trim()
        maturityDate = parseB3Date(parts[3].trim())
      }
      ticker = `${firstPart} - ${issuer}`
      name = parts[1].trim()
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

  // Sufixo de vencimento para Renda Fixa (CDB, LCI, LCA, CRI, CRA)
  if (isCdbOrSimilar && maturityDate) {
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
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null
    const year = val.getFullYear()
    const month = String(val.getMonth() + 1).padStart(2, '0')
    const day = String(val.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

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

  const matchDmy = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/)
  if (matchDmy) {
    const day = matchDmy[1].padStart(2, '0')
    const month = matchDmy[2].padStart(2, '0')
    let year = matchDmy[3]
    if (year.length === 2) year = `20${year}`
    return `${year}-${month}-${day}`
  }

  const matchYmd = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/)
  if (matchYmd) {
    const year = matchYmd[1]
    const month = matchYmd[2].padStart(2, '0')
    const day = matchYmd[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return null
}

export const parseNumericValue = (val: unknown): number => {
  if (val === undefined || val === null) return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val

  const raw = String(val).trim().replace(/\s+/g, '').replace(/[R$]/gi, '')
  if (!raw || raw === '-') return 0

  if (/,\d+$/.test(raw)) {
    const cleaned = raw.replace(/\./g, '').replace(',', '.')
    const num = Number(cleaned)
    return isNaN(num) ? 0 : num
  }

  const num = Number(raw.replace(',', '.'))
  return isNaN(num) ? 0 : num
}

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

function findMovementHeaderRow(rows: unknown[][]): {
  headerRowIndex: number
  headers: string[]
  mapping: Record<B3FieldKey, number>
} {
  let bestRowIndex = -1
  let bestMapping: Record<B3FieldKey, number> = {
    direction: -1,
    date: -1,
    operationType: -1,
    product: -1,
    institution: -1,
    quantity: -1,
    price: -1,
    totalValue: -1,
  }
  let maxFoundCount = -1

  const maxScanRows = Math.min(rows.length, 25)
  for (let r = 0; r < maxScanRows; r += 1) {
    const row = rows[r]
    if (!row || !Array.isArray(row)) continue
    const candidateHeaders = row.map((h) => String(h ?? '').trim())

    const mapping: Record<B3FieldKey, number> = {
      direction: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.direction),
      date: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.date),
      operationType: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.operationType),
      product: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.product),
      institution: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.institution),
      quantity: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.quantity),
      price: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.price),
      totalValue: findHeaderIndex(candidateHeaders, B3_HEADER_ALIASES.totalValue),
    }

    const mandatoryCount =
      (mapping.date >= 0 ? 1 : 0) +
      (mapping.product >= 0 ? 1 : 0) +
      (mapping.operationType >= 0 ? 1 : 0)

    const totalFound =
      mandatoryCount +
      (mapping.direction >= 0 ? 1 : 0) +
      (mapping.quantity >= 0 ? 1 : 0) +
      (mapping.price >= 0 ? 1 : 0) +
      (mapping.totalValue >= 0 ? 1 : 0) +
      (mapping.institution >= 0 ? 1 : 0)

    if (mandatoryCount === 3) {
      return { headerRowIndex: r, headers: candidateHeaders, mapping }
    }

    if (totalFound > maxFoundCount) {
      maxFoundCount = totalFound
      bestRowIndex = r
      bestMapping = mapping
    }
  }

  const defaultRow = bestRowIndex >= 0 ? bestRowIndex : 0
  const defaultHeaders = ((rows[defaultRow] as unknown[]) ?? []).map((h) => String(h ?? '').trim())
  return { headerRowIndex: defaultRow, headers: defaultHeaders, mapping: bestMapping }
}

export const parseB3Excel = (fileBuffer: ArrayBuffer): B3ParseResult => {
  const data = new Uint8Array(fileBuffer)
  const workbook = XLSX.read(data, { type: 'array' })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    return { items: [], ignoredByMovement: 0, dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 } }
  }

  let selectedRows: unknown[][] = []
  let selectedHeaderRowIndex = 0
  let selectedHeaders: string[] = []
  let selectedMapping: Record<B3FieldKey, number> = {
    direction: -1, date: -1, operationType: -1, product: -1, institution: -1, quantity: -1, price: -1, totalValue: -1
  }
  let foundValidSheet = false

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1 })
    if (rows.length < 2) continue

    const { headerRowIndex, headers, mapping } = findMovementHeaderRow(rows as unknown[][])
    if (mapping.date >= 0 && mapping.product >= 0 && mapping.operationType >= 0) {
      selectedRows = rows as unknown[][]
      selectedHeaderRowIndex = headerRowIndex
      selectedHeaders = headers
      selectedMapping = mapping
      foundValidSheet = true
      break
    } else if (!foundValidSheet && rows.length > selectedRows.length) {
      selectedRows = rows as unknown[][]
      selectedHeaderRowIndex = headerRowIndex
      selectedHeaders = headers
      selectedMapping = mapping
    }
  }

  if (selectedRows.length < 2) {
    return { items: [], ignoredByMovement: 0, dedupe: { ignoredInternal: 0, ignoredCorporate: 0, dedupedTrades: 0 } }
  }

  if (selectedMapping.date < 0 || selectedMapping.product < 0 || selectedMapping.operationType < 0) {
    const validation = validateB3MovementHeaders(selectedHeaders)
    throw new Error(formatHeaderValidationError(validation))
  }

  const dataRows = selectedRows.slice(selectedHeaderRowIndex + 1)
  const mapping = selectedMapping

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

    let headerRowIdx = -1
    let codeIdx = -1
    let productIdx = -1
    let qtyIdx = -1

    const maxScan = Math.min(rows.length, 25)
    for (let r = 0; r < maxScan; r += 1) {
      const candidateRow = rows[r] as unknown[]
      if (!candidateRow || !Array.isArray(candidateRow)) continue
      const candidateHeaders = candidateRow.map((h) => String(h ?? '').trim())

      const cIdx = findHeaderIndex(candidateHeaders, [
        'codigo de negociacao',
        'código de negociação',
        'codigo isin',
        'código isin',
        'codigo',
        'código',
        'papel',
        'ticker',
      ])
      const pIdx = findHeaderIndex(candidateHeaders, ['produto', 'ativo', 'descricao', 'descrição'])
      const qIdx = findHeaderIndex(candidateHeaders, ['quantidade', 'quantidade disponivel', 'quantidade disponível', 'qtd', 'qtd.'])

      if (qIdx >= 0 && (cIdx >= 0 || pIdx >= 0)) {
        headerRowIdx = r
        codeIdx = cIdx
        productIdx = pIdx
        qtyIdx = qIdx
        break
      }
    }

    if (headerRowIdx < 0 || qtyIdx < 0) continue

    let sheetCount = 0
    ;(rows.slice(headerRowIdx + 1) as unknown[][]).forEach((row) => {
      if (!row || row.length === 0 || isPositionTotalRow(row)) return

      let ticker = ''

      if (category !== 'equityB3' && productIdx >= 0) {
        const productRaw = String(row[productIdx] ?? '').trim()
        const parsed = parseB3Product(productRaw)
        ticker = parsed.ticker
        if (!ticker && productRaw) {
          ticker = productRaw.slice(0, 80)
        }
      }

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

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
      const maxScan = Math.min(rows.length, 25)
      for (let r = 0; r < maxScan; r += 1) {
        const candidateRow = rows[r] as unknown[]
        if (!candidateRow || !Array.isArray(candidateRow)) continue
        const headers = candidateRow.map((h) => String(h ?? '').trim())
        const hasTradingCode = findHeaderIndex(headers, [
          'codigo de negociacao',
          'código de negociação',
          'codigo isin',
          'código isin',
          'quantidade disponivel',
          'quantidade disponível',
        ]) >= 0
        const hasMovement = findHeaderIndex(headers, B3_HEADER_ALIASES.operationType) >= 0

        if (hasTradingCode && !hasMovement) return true
        if (hasPositionSheet && !hasMovement && findHeaderIndex(headers, B3_HEADER_ALIASES.quantity) >= 0) return true
      }
    }
    return false
  } catch {
    return false
  }
}
