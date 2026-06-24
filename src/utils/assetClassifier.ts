/**
 * assetClassifier.ts
 *
 * Centralizador de classificação de ativos para o financasapp.
 * Todas as funções aqui são puras e sem efeitos colaterais.
 *
 * Regra de dependência: este módulo NÃO deve importar de services/
 * para evitar dependências circulares.  Apenas types e outras utils são permitidas.
 *
 * Este arquivo é a ÚNICA fonte de verdade para classificação de tickers.
 * NÃO re-implemente a lógica de isB3, isFixed, isCash nos modais —
 * importe as funções daqui.
 */
import type { PortfolioAssetIndexer, PortfolioPricingMode } from '@/types'

export type B3AssetCategory =
  | 'equityB3'   // Ações, FIIs, ETFs listados na B3
  | 'fixedIncome'// CDB, LCI, LCA, CRI, CRA, Debenture
  | 'treasury'   // Tesouro Direto (LFT, NTN-B, LTN etc.)
  | 'crypto'     // Criptomoedas (BTC, ETH…)
  | 'international' // Ações US (AAPL, VOO…)
  | 'cash'       // CAIXA / SALDO_INV
  | 'other'

// ---------------------------------------------------------------------------
// Constantes internas
// ---------------------------------------------------------------------------

const CASH_TICKERS = new Set(['CAIXA', 'SALDO_INV', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'])

const FIXED_INCOME_PREFIXES = ['CDB', 'LCI', 'LCA', 'CRI', 'CRA', 'CCB', 'LF', 'DEBENTURE']

const FIXED_INCOME_KEYWORDS = [
  'DEBENTURE',
  'LETRA DE CR',
  'LETRA FINANCEIRA',
  'CERTIFICADO DE DEP',
]

const CRYPTO_TICKERS = new Set(['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT', 'BNB', 'MATIC'])

// Sufixo numérico padrão de ações B3 cotadas normalmente
const STANDARD_B3_SUFFIXES = new Set([3, 4, 5, 6, 7, 8, 11, 32, 33, 34, 35, 36, 39])

// ---------------------------------------------------------------------------
// Funções públicas
// ---------------------------------------------------------------------------

/**
 * Classifica um ticker/produto de carteira em uma categoria B3AssetCategory.
 * @param ticker  Código do ativo (ex: "PETR4", "CDB - Itaú", "TESOURO SELIC 2026")
 * @param name    Nome do produto opcional (usado na planilha B3)
 */
export function classifyAsset(ticker: string, name?: string): B3AssetCategory {
  const t = ticker.trim().toUpperCase()
  const combined = t + ' ' + (name ?? '').trim().toUpperCase()

  if (CASH_TICKERS.has(t)) return 'cash'

  if (isTreasury(t)) return 'treasury'

  // Renda fixa — prefixos e keywords
  for (const pfx of FIXED_INCOME_PREFIXES) {
    if (t === pfx || t.startsWith(pfx + '-') || t.startsWith(pfx + ' ') || t.startsWith(pfx)) {
      return 'fixedIncome'
    }
  }
  for (const kw of FIXED_INCOME_KEYWORDS) {
    if (combined.includes(kw)) return 'fixedIncome'
  }
  // Heurística: ticker com espaço " - " é renda fixa (ex: "CDB - Banco Itaú - 110%CDI")
  if (t.includes(' - ')) return 'fixedIncome'

  // Criptomoedas
  if (CRYPTO_TICKERS.has(t) || t.endsWith('-BRL') || t.endsWith('USDT')) return 'crypto'

  // Ações / FIIs / ETFs brasileiros padrão B3
  if (isB3EquityPattern(t)) return 'equityB3'

  // Ações internacionais (3-4 letras sem números, ex: AAPL, VOO)
  if (/^[A-Z]{2,5}$/.test(t) && !['CDI', 'SELIC', 'IPCA', 'PRE'].includes(t)) return 'international'

  return 'other'
}

/**
 * Retorna true se o ticker segue o padrão de código B3 (4 letras + 1-2 dígitos).
 * Exemplos: PETR4, MXRF11, BOVA11.
 * Normaliza sufixos ".SA" e lotes fracionários "F".
 */
export function isB3EquityPattern(ticker: string): boolean {
  let t = ticker.trim().toUpperCase()
  if (t.endsWith('.SA')) t = t.slice(0, -3)
  if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(t)) t = t.slice(0, -1)
  return /^[A-Z]{4}[0-9]{1,2}$/.test(t)
}

/**
 * Retorna true se o ticker é de um ativo de direito de subscrição ou não-padrão B3
 * (ex: MXRF12 → sufixo 12 não é padrão de ações nem FIIs).\n */
export function isSubscriptionRight(ticker: string): boolean {
  let t = ticker.trim().toUpperCase()
  if (t.endsWith('.SA')) t = t.slice(0, -3)
  if (/^[A-Z]{4}[0-9]{1,2}F$/i.test(t)) t = t.slice(0, -1)
  if (/^[A-Z]{4}[0-9]{1,2}$/.test(t)) {
    const match = t.match(/[0-9]+$/)
    if (match) return !STANDARD_B3_SUFFIXES.has(parseInt(match[0], 10))
  }
  return false
}

/**
 * Retorna true para títulos do Tesouro Direto.
 * Exemplos: "TESOURO SELIC 2026", "LFT 2025", "NTN-B 2035", "SELIC 26", "IPCA 35"
 */
export function isTreasury(ticker: string): boolean {
  const upper = ticker.trim().toUpperCase()
  return (
    upper.includes('TESOURO') ||
    upper.startsWith('LFT') ||
    upper.startsWith('NTN') ||
    upper.startsWith('LTN') ||
    /^(IPCA|SELIC|PRE)\s*\d{2,4}$/i.test(upper)
  )
}

/**
 * Detecta a moeda padrão de cotação de um ticker.
 * BRL para ativos brasileiros, crypto e renda fixa; USD para internacionais.
 */
export function detectCurrency(ticker: string): 'BRL' | 'USD' {
  const t = ticker.trim().toUpperCase()

  if (CASH_TICKERS.has(t)) return 'BRL'
  if (CRYPTO_TICKERS.has(t)) return 'BRL' // cotados em BRL no Brasil
  if (isB3EquityPattern(t)) return 'BRL'
  if (isTreasury(t)) return 'BRL'

  const category = classifyAsset(t)
  if (category === 'fixedIncome') return 'BRL'

  // Internacionais (ex: AAPL, VOO, SPY) → USD
  if (/^[A-Z]{2,5}$/.test(t) && !['CDI', 'SELIC', 'IPCA', 'PRE'].includes(t)) return 'USD'

  return 'BRL'
}

/**
 * Retorna o indexador padrão mais provável para um ativo de renda fixa a partir do ticker.
 * Para tickers sem indexador explícito, retorna 'none' (pré-fixado).
 */
export function getDefaultIndexer(ticker: string): PortfolioAssetIndexer {
  const upper = ticker.trim().toUpperCase()

  if (upper.includes('SELIC') || upper.startsWith('LFT')) return 'selic'
  if (upper.includes('IPCA') || upper.startsWith('NTN')) return 'ipca'
  if (upper.includes('CDI')) return 'cdi'
  if (upper.startsWith('LTN') || upper.startsWith('PRE')) return 'none' // pré-fixado

  return 'none'
}

/**
 * Retorna true se o ticker deve ter cotação buscada no Yahoo Finance / B3.
 * Exclui: caixa, renda fixa, tesouro, cripto estrangeiras não BRL.
 */
export function requiresMarketQuote(ticker: string): boolean {
  const cat = classifyAsset(ticker)
  return cat === 'equityB3' || cat === 'international'
}

// ---------------------------------------------------------------------------
// Helpers de mapeamento para PortfolioPricingMode
// Use estas funções nos modais em vez de re-implementar o regex inline.
// ---------------------------------------------------------------------------

/**
 * Retorna true para tickers de saldo em caixa (CAIXA, SALDO_INV, etc).
 * Fonte única para a verificação — não duplique este check nos modais.
 */
export function isCashTicker(ticker: string): boolean {
  return CASH_TICKERS.has(ticker.trim().toUpperCase())
}

/**
 * Retorna true para ativos de renda fixa (CDB, LCI, LCA, Tesouro, etc).
 * Equivalente ao antigo bloco `isFixedInc` dos modais.
 */
export function isFixedIncomeTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase()
  const category = classifyAsset(t)
  return category === 'fixedIncome' || category === 'treasury'
}

/**
 * Retorna true para ativos de renda variável B3 (ações, FIIs, ETFs).
 * Equivalente ao antigo `isB3Var` dos modais.
 */
export function isB3VariableTicker(ticker: string): boolean {
  const t = ticker.trim().toUpperCase()
  return isB3EquityPattern(t) && !isTreasury(t)
}

/**
 * Mapeia um ticker diretamente para o PortfolioPricingMode correto.
 * Use no lugar de if/else cascade nos modais.
 *
 * @returns 'market' | 'fixed_income' | 'cash' | null
 *   null = ticker novo/desconhecido, deixar usuário escolher
 */
export function toPricingMode(ticker: string): PortfolioPricingMode | null {
  const t = ticker.trim().toUpperCase()
  if (!t) return null
  if (isCashTicker(t)) return 'cash'
  if (isFixedIncomeTicker(t)) return 'fixed_income'
  if (isB3VariableTicker(t)) return 'market'
  return null // outro tipo: manual ou internacional
}

/**
 * Detecta a moeda padrão de cotação de um ticker (alias para detectCurrency).
 * BRL para ativos brasileiros, crypto e renda fixa; USD para internacionais.
 */
export const detectDefaultCurrency = detectCurrency

/**
 * Metadados de classificação de ativo: asset_class e sector.
 * Usa a classificação do ticker para determinar a categoria e setor.
 */
export function getAssetMetadata(ticker: string): { asset_class: string; sector: string } {
  const t = ticker.trim().toUpperCase()

  // 1. Criptomoedas
  if (CRYPTO_TICKERS.has(t)) {
    return { asset_class: 'Criptoativos', sector: 'Tecnologia Blockchain' }
  }

  // Verificar se é Unit B3 (termina em 11 mas é ação, não FII)
  const BR_UNITS = new Set(['TAEE11', 'KLBN11', 'SANB11', 'BPAC11', 'ALUP11', 'RAPT11', 'SAPR11', 'ENGI11', 'SULA11'])
  const isBrUnit = BR_UNITS.has(t)

  // 2. Fundos Imobiliários (4 letras + 11)
  const isFii = /^[A-Z]{4}11$/.test(t) && !isBrUnit && !['BOVA11', 'SMAL11', 'IVVB11', 'ECOO11', 'DIVO11', 'PIBB11'].includes(t)
  if (isFii) {
    return { asset_class: 'Fundos Imobiliários', sector: 'Imobiliário Diversificado' }
  }

  // 3. ETFs
  if (['BOVA11', 'SMAL11', 'IVVB11', 'VOO', 'IVV', 'SPY', 'QQQ', 'VT', 'BND', 'HASH11', 'QBTC11', 'QETH11', 'GOLD11'].includes(t)) {
    return { asset_class: 'ETFs', sector: 'Índices de Mercado' }
  }

  // 4. BDRs (4 letras + 34)
  if (/^[A-Z]{4}34$/.test(t)) {
    return { asset_class: 'Ações Internacionais', sector: 'BDRs / Mercado Global' }
  }

  // 5. Ações Brasileiras (4 letras + 3-8)
  const isBrStock = /^[A-Z]{4}[345678]$/.test(t) || isBrUnit
  if (isBrStock) {
    if (['PETR4', 'PETR3', 'RECV3', 'PRIO3', 'RRRP3', 'UGPA3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Petróleo, Gás e Biocombustíveis' }
    }
    if (['VALE3', 'CSNA3', 'GGBR4', 'USIM5', 'KLBN11', 'SUZB3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Materiais Básicos (Mineração/Siderurgia)' }
    }
    if (['ITUB4', 'ITUB3', 'BBDC4', 'BBDC3', 'BBAS3', 'SANB11', 'BPAC11', 'CXSE3', 'BBSE3', 'PSSA3', 'IRBR3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Financeiro e Seguros' }
    }
    if (['ELET3', 'ELET6', 'CPLE6', 'EGIE3', 'ENGI11', 'TAEE11', 'ALUP11', 'TRPL4', 'CMIG4', 'SBSP3', 'CSMG3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Utilidade Pública (Energia/Saneamento)' }
    }
    if (['WEGE3', 'TUPY3', 'EMBR3', 'RAPT4', 'POMO4'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Bens Industriais' }
    }
    if (['RENT3', 'MOVI3', 'RAIL3', 'STBP3', 'AZUL4', 'GOLL4', 'JSLG3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Logística e Transportes' }
    }
    if (['LREN3', 'MGLU3', 'VIIA3', 'BHIA3', 'AREZ3', 'SOMA3', 'ALPA4', 'PETZ3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Consumo Cíclico (Varejo)' }
    }
    if (['ABEV3', 'JBSS3', 'BRFS3', 'MRFG3', 'BEEF3', 'MDIA3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Consumo Não Cíclico (Alimentos/Bebidas)' }
    }
    if (['HAPV3', 'RADL3', 'FLRY3', 'ONCO3', 'RDNI3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Saúde' }
    }
    if (['VIVT3', 'TIMS3'].includes(t)) {
      return { asset_class: 'Ações Nacionais', sector: 'Telecomunicações' }
    }
    return { asset_class: 'Ações Nacionais', sector: 'Consumo e Indústria Geral' }
  }

  // 6. Ações Internacionais (3-4 letras, sem números)
  if (/^[A-Z]{2,5}$/.test(t) && !['CDI', 'SELIC', 'IPCA', 'PRE'].includes(t)) {
    if (['AAPL', 'MSFT', 'GOOGL', 'GOOG', 'NVDA', 'AMD', 'INTC', 'META', 'NFLX'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Tecnologia' }
    }
    if (['JPM', 'BAC', 'WFC', 'C', 'V', 'MA'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Financeiro' }
    }
    if (['TSLA', 'AMZN', 'HD', 'NKE', 'DIS', 'MCD'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Consumo' }
    }
    if (['JNJ', 'PFE', 'UNH', 'ABBV', 'MRK'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Saúde' }
    }
    if (['XOM', 'CVX'].includes(t)) {
      return { asset_class: 'Ações Internacionais', sector: 'Energia' }
    }
    return { asset_class: 'Ações Internacionais', sector: 'EUA / Global Diversificado' }
  }

  // 7. Renda Fixa
  if (
    isFixedIncomeTicker(t) ||
    ['CDI', 'SELIC', 'IPCA', 'TESOURO', 'LCI', 'LCA', 'CDB', 'DEBENTURE'].some(rf => t.includes(rf))
  ) {
    return { asset_class: 'Renda Fixa', sector: 'Títulos Públicos/Privados' }
  }

  return { asset_class: 'Outros', sector: 'Indefinido' }
}
