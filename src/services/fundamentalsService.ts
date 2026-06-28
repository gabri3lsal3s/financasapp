import { supabase } from '@/lib/supabase'
import { AssetFundamentalsCache, PortfolioAssetDefinition } from '@/types'
import { logger } from '@/utils/logger'
import { fetchWithCorsProxy } from './priceService'

const memoryFundamentalsCache: Record<string, AssetFundamentalsCache> = {}

interface YahooQuoteSummaryResponse {
  quoteSummary?: {
    result?: Array<{
      financialData?: {
        returnOnAssets?: { raw?: number }
        returnOnEquity?: { raw?: number }
        ebitda?: { raw?: number }
        totalDebt?: { raw?: number }
        totalCash?: { raw?: number }
      }
      defaultKeyStatistics?: {
        enterpriseValue?: { raw?: number }
        forwardPE?: { raw?: number }
        trailingPE?: { raw?: number }
      }
      summaryDetail?: {
        dividendYield?: { raw?: number }
        trailingPE?: { raw?: number }
      }
    }>
  }
}

/**
 * Normaliza o ticker para busca na API do Yahoo Finance
 */
function normalizeSymbol(ticker: string): string {
  const t = ticker.trim().toUpperCase()
  if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT'].includes(t)) {
    return `${t}-BRL`
  }
  const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(t)
  return isB3 ? `${t}.SA` : t
}

/**
 * Busca e atualiza os fundamentos de um ativo (Yahoo Finance + Cache Supabase)
 */
export async function getAssetFundamentals(
  ticker: string,
  options?: { forceRefresh?: boolean }
): Promise<AssetFundamentalsCache | null> {
  const normTicker = ticker.trim().toUpperCase()
  if (!normTicker) return null

  // 1. Verificar cache em memória
  if (!options?.forceRefresh && memoryFundamentalsCache[normTicker]) {
    return memoryFundamentalsCache[normTicker]
  }

  const now = new Date()

  // 2. Verificar cache do Supabase
  try {
    const { data, error } = await supabase
      .from('asset_fundamentals_cache')
      .select('*')
      .eq('ticker', normTicker)
      .maybeSingle()

    if (!error && data) {
      const fund = data as AssetFundamentalsCache
      const lastUpdated = new Date(fund.last_updated)
      const isStale = now.getTime() - lastUpdated.getTime() > 24 * 60 * 60 * 1000 // 24 horas

      if (!options?.forceRefresh && !isStale) {
        memoryFundamentalsCache[normTicker] = fund
        return fund
      }
    }
  } catch (err) {
    logger.warn('Erro ao ler cache de fundamentos do Supabase:', err)
  }

  // 3. Buscar na API do Yahoo Finance
  const symbol = normalizeSymbol(normTicker)
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=financialData,defaultKeyStatistics,summaryDetail`

  let fetched: AssetFundamentalsCache | null = null

  try {
    const response = await fetchWithCorsProxy(url)
    if (response.ok) {
      const rawText = await response.text()
      const data = JSON.parse(rawText) as YahooQuoteSummaryResponse
      const result = data?.quoteSummary?.result?.[0]

      if (result) {
        const financialData = result.financialData
        const defaultKeyStats = result.defaultKeyStatistics
        const summaryDetail = result.summaryDetail

        // ROIC: Yahoo não dá direto no quoteSummary básico, usamos returnOnEquity ou returnOnAssets como aproximação
        const roicRaw = financialData?.returnOnEquity?.raw ?? financialData?.returnOnAssets?.raw ?? 0
        const roic = roicRaw * 100 // Converter de decimal para porcentagem

        // Dividend Yield: summaryDetail dividendYield
        const dyRaw = summaryDetail?.dividendYield?.raw ?? 0
        const dividendYield = dyRaw * 100

        // P/L Ratio: trailingPE
        const peRatio = summaryDetail?.trailingPE?.raw ?? defaultKeyStats?.trailingPE?.raw ?? defaultKeyStats?.forwardPE?.raw ?? null

        // EV / EBITDA
        let evEbitda: number | null = null
        const ev = defaultKeyStats?.enterpriseValue?.raw
        const ebitda = financialData?.ebitda?.raw
        if (ev && ebitda && ebitda > 0) {
          evEbitda = ev / ebitda
        }

        // Net Debt / EBITDA
        let netDebtEbitda: number | null = null
        const totalDebt = financialData?.totalDebt?.raw
        const totalCash = financialData?.totalCash?.raw
        if (totalDebt !== undefined && totalCash !== undefined && ebitda && ebitda > 0) {
          netDebtEbitda = (totalDebt - totalCash) / ebitda
        }

        // 5y Averages: A API do quoteSummary não fornece isso diretamente sem consultas pesadas adicionais.
        // Iniciamos com valores padrão/null e permitimos que overrides do usuário os definam.
        const pe5yAverage = null
        const evEbitda5yAverage = null
        const netDebtTrendUp2y = false

        fetched = {
          ticker: normTicker,
          roic: Number(roic.toFixed(2)),
          dividend_yield: Number(dividendYield.toFixed(2)),
          pe_ratio: peRatio != null ? Number(peRatio.toFixed(2)) : null,
          ev_ebitda: evEbitda != null ? Number(evEbitda.toFixed(2)) : null,
          net_debt_ebitda: netDebtEbitda != null ? Number(netDebtEbitda.toFixed(2)) : null,
          pe_5y_average: pe5yAverage,
          ev_ebitda_5y_average: evEbitda5yAverage,
          net_debt_trend_up_2y: netDebtTrendUp2y,
          last_updated: now.toISOString(),
        }
      }
    }
  } catch (err) {
    logger.warn(`Erro ao buscar fundamentos do Yahoo para ${normTicker}:`, err)
  }

  // 4. Se falhar API, usar valores estáticos/fallback padrão (se não tiver cache anterior)
  if (!fetched) {
    // Tenta carregar o cache antigo do Supabase mesmo que esteja stale
    try {
      const { data } = await supabase
        .from('asset_fundamentals_cache')
        .select('*')
        .eq('ticker', normTicker)
        .maybeSingle()

      if (data) {
        fetched = data as AssetFundamentalsCache
      }
    } catch {
      // Ignora erro
    }
  }

  // Se ainda não temos dados, retornamos um objeto vazio estruturado com nulls
  if (!fetched) {
    fetched = {
      ticker: normTicker,
      roic: null,
      dividend_yield: null,
      pe_ratio: null,
      ev_ebitda: null,
      net_debt_ebitda: null,
      pe_5y_average: null,
      ev_ebitda_5y_average: null,
      net_debt_trend_up_2y: false,
      last_updated: now.toISOString(),
    }
  }

  // 5. Persistir no Supabase em background
  memoryFundamentalsCache[normTicker] = fetched
  const toUpsert = fetched
  void (async () => {
    try {
      await supabase.from('asset_fundamentals_cache').upsert(toUpsert)
    } catch (err) {
      logger.warn('Erro ao atualizar cache de fundamentos no Supabase:', err)
    }
  })()

  return fetched
}

/**
 * Mescla os dados de fundamentos buscados com os overrides manuais definidos no ativo.
 */
export function getMergedFundamentals(
  fetched: AssetFundamentalsCache | null,
  definition: PortfolioAssetDefinition | undefined
): {
  roic: number
  dividend_yield: number
  pe_ratio: number | null
  ev_ebitda: number | null
  net_debt_ebitda: number | null
  pe_5y_average: number | null
  ev_ebitda_5y_average: number | null
  net_debt_trend_up_2y: boolean
} {
  return {
    roic: definition?.manual_roic ?? fetched?.roic ?? 0,
    dividend_yield: definition?.manual_dividend_yield ?? fetched?.dividend_yield ?? 0,
    pe_ratio: definition?.manual_pe_ratio !== undefined ? definition.manual_pe_ratio : (fetched?.pe_ratio ?? null),
    ev_ebitda: definition?.manual_ev_ebitda !== undefined ? definition.manual_ev_ebitda : (fetched?.ev_ebitda ?? null),
    net_debt_ebitda: definition?.manual_net_debt_ebitda !== undefined ? definition.manual_net_debt_ebitda : (fetched?.net_debt_ebitda ?? null),
    pe_5y_average: definition?.manual_pe_5y_average !== undefined ? definition.manual_pe_5y_average : (fetched?.pe_5y_average ?? null),
    ev_ebitda_5y_average: definition?.manual_ev_ebitda_5y_average !== undefined ? definition.manual_ev_ebitda_5y_average : (fetched?.ev_ebitda_5y_average ?? null),
    net_debt_trend_up_2y: definition?.manual_net_debt_trend_up_2y ?? fetched?.net_debt_trend_up_2y ?? false,
  }
}
