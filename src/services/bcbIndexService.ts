import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'
import type { IndexRateRow, PortfolioAssetIndexer } from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'

const BCB_SERIES: Record<'cdi' | 'selic' | 'ipca', number> = {
  cdi: 12,
  selic: 11, // SGS 11: SELIC diária em percentual
  ipca: 433, // SGS 433: IPCA mensal em percentual
}

function formatBcbDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}/${m}/${y}`
}

function parseBcbDate(brDate: string): string {
  const [d, m, y] = brDate.split('/')
  return `${y}-${m}-${d}`
}

async function fetchBcbSeries(
  indexer: 'cdi' | 'selic' | 'ipca',
  startDate: string,
  endDate: string
): Promise<IndexRateRow[]> {
  const seriesCode = BCB_SERIES[indexer]
  const url =
    `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados` +
    `?formato=json&dataInicial=${formatBcbDate(startDate)}&dataFinal=${formatBcbDate(endDate)}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`BCB indisponível para ${indexer}`)
  }

  const data = (await response.json()) as { data: string; valor: string }[]
  return data.map((row) => {
    let rate = Number(row.valor)
    
    // Auto-correção: Converte taxa anualizada (ex: 10.75 a.a.) para taxa diária equivalente
    if ((indexer === 'selic' || indexer === 'cdi') && rate > 1.0) {
      rate = (Math.pow(1 + rate / 100, 1 / 252) - 1) * 100
    } else if (indexer === 'ipca' && rate > 0.0) {
      // Converte taxa IPCA mensal (ex: 0.35%) para taxa diária equivalente (~22 dias úteis)
      rate = (Math.pow(1 + rate / 100, 1 / 22) - 1) * 100
    }

    return {
      rate_date: parseBcbDate(row.data),
      indexer,
      daily_rate: rate,
    }
  })
}

function rowsToMap(rows: IndexRateRow[]): IndexRateMap {
  const map: IndexRateMap = {}
  for (const row of rows) {
    let rate = row.daily_rate
    
    // Auto-correção para dados legados já salvos no banco ou no cache local
    if ((row.indexer === 'selic' || row.indexer === 'cdi') && rate > 1.0) {
      rate = (Math.pow(1 + rate / 100, 1 / 252) - 1) * 100
    } else if (row.indexer === 'ipca' && rate > 0.0) {
      rate = (Math.pow(1 + rate / 100, 1 / 22) - 1) * 100
    }

    map[row.rate_date] = rate
  }
  return map
}

async function loadFromSupabase(
  indexer: 'cdi' | 'selic' | 'ipca',
  startDate: string,
  endDate: string
): Promise<IndexRateRow[]> {
  const { data, error } = await supabase
    .from('index_rates')
    .select('rate_date, indexer, daily_rate')
    .eq('indexer', indexer)
    .gte('rate_date', startDate)
    .lte('rate_date', endDate)
    .order('rate_date')

  if (error || !data) return []
  return data as IndexRateRow[]
}

async function saveToSupabase(rows: IndexRateRow[]): Promise<void> {
  if (rows.length === 0) return
  await supabase.from('index_rates').upsert(
    rows.map((r) => ({
      rate_date: r.rate_date,
      indexer: r.indexer,
      daily_rate: r.daily_rate,
    })),
    { onConflict: 'rate_date,indexer' }
  )
}

/**
 * Obtém mapa de taxas diárias do indexador (BCB + cache local + Supabase).
 */
export async function getIndexRatesForRange(
  indexer: PortfolioAssetIndexer,
  startDate: string,
  endDate: string
): Promise<IndexRateMap> {
  if (indexer === 'none') return {}

  const cacheKey = `bcb-rates:${indexer}:${startDate}:${endDate}`
  const cached = await getCache<IndexRateMap>(cacheKey)
  if (cached) return cached

  const dbRows = await loadFromSupabase(indexer, startDate, endDate)
  if (dbRows.length > 0) {
    const map = rowsToMap(dbRows)
    await setCache(cacheKey, map)
    return map
  }

  try {
    const fetched = await fetchBcbSeries(indexer, startDate, endDate)
    await saveToSupabase(fetched)
    const map = rowsToMap(fetched)
    await setCache(cacheKey, map)
    return map
  } catch {
    return {}
  }
}

export async function buildCombinedIndexRates(
  indexers: PortfolioAssetIndexer[],
  startDate: string,
  endDate: string
): Promise<Record<PortfolioAssetIndexer, IndexRateMap>> {
  const unique = [...new Set(indexers.filter((i) => i !== 'none'))] as Array<'cdi' | 'selic' | 'ipca'>
  const result: Record<PortfolioAssetIndexer, IndexRateMap> = {
    none: {},
    cdi: {},
    selic: {},
    ipca: {},
  }

  await Promise.all(
    unique.map(async (indexer) => {
      result[indexer] = await getIndexRatesForRange(indexer, startDate, endDate)
    })
  )

  return result
}
