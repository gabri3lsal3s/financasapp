import type { ValuedPosition } from './portfolioCalculations'
import { loadIndexRatesFromDb } from '@/services/indexRatesFetcher'
import { getAssetPrices, loadHistoricalPrices } from '@/services/priceService'

export interface BenchmarkInfo {
  name: string
  ticker: string
  description: string
}

export interface ClassPerformance {
  name: string
  totalValue: number
  percentage: number
  grossYieldPct: number
  accumulatedDividends: number
  benchmark: BenchmarkInfo
  benchmarkYieldPct: number | null
}

/**
 * Mapeamento de classes de ativos para seus respectivos benchmarks de referência.
 */
export function getBenchmarkForClass(assetClass: string): BenchmarkInfo {
  const map: Record<string, BenchmarkInfo> = {
    'Ações Nacionais': {
      name: 'IBOVESPA',
      ticker: '^BVSP',
      description: 'Ibovespa',
    },
    'Fundos Imobiliários': {
      name: 'IFIX',
      ticker: 'IFIX',
      description: 'IFIX',
    },
    'Renda Fixa': {
      name: 'CDI',
      ticker: 'CDI',
      description: 'CDI (taxa livre de risco)',
    },
    'Ações Internacionais': {
      name: 'S&P 500',
      ticker: '^GSPC',
      description: 'S&P 500',
    },
    'ETFs Nacionais': {
      name: 'IBOVESPA',
      ticker: '^BVSP',
      description: 'Ibovespa',
    },
    'ETFs Internacionais': {
      name: 'S&P 500',
      ticker: '^GSPC',
      description: 'S&P 500',
    },
    Criptoativos: {
      name: 'Bitcoin',
      ticker: 'BTC-USD',
      description: 'Bitcoin (BTC)',
    },
    ETFs: {
      name: 'IBOVESPA',
      ticker: '^BVSP',
      description: 'Ibovespa (referência)',
    },
  }

  return (
    map[assetClass] || {
      name: 'CDI',
      ticker: 'CDI',
      description: 'CDI (benchmark padrão)',
    }
  )
}

/**
 * Busca dados reais de benchmarks do banco de dados e APIs.
 * Retorna um mapa de ticker do benchmark -> retorno percentual acumulado.
 */
export async function fetchBenchmarkReturns(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const result: Record<string, number> = {}

  // 1. CDI: acumular taxas diárias do banco de dados
  try {
    const cdiRates = await loadIndexRatesFromDb('cdi', startDate, endDate)
    if (cdiRates && Object.keys(cdiRates).length > 0) {
      let cdiAccumulated = 1
      for (const dateStr of Object.keys(cdiRates).sort()) {
        cdiAccumulated *= 1 + cdiRates[dateStr]
      }
      result['CDI'] = (cdiAccumulated - 1) * 100
    }
  } catch (err) {
    console.warn('[fetchBenchmarkReturns] Erro ao buscar CDI:', err)
  }

  // 2. Índices de mercado via Yahoo Finance / cache
  const marketTickers = ['^BVSP', 'IFIX', '^GSPC', 'BTC-USD']
  try {
    const currentPrices = await getAssetPrices(marketTickers, { forceRefresh: false })
    
    // Buscar preços históricos (12 meses atrás ou desde startDate, o que for mais antigo)
    const oneYearAgo = new Date(endDate)
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
    const historyStart = startDate < oneYearAgo.toISOString().slice(0, 10)
      ? startDate
      : oneYearAgo.toISOString().slice(0, 10)
    
    const historicalPrices = await loadHistoricalPrices(marketTickers, historyStart, endDate)

    // Calcular retorno de cada benchmark
    for (const ticker of marketTickers) {
      const current = currentPrices[ticker]?.current_price
      if (!current || current <= 0) continue

      const history = historicalPrices[ticker]
      if (!history || Object.keys(history).length === 0) continue

      // Usar o preço mais antigo disponível como base
      const dates = Object.keys(history).sort()
      const oldestPrice = history[dates[0]]
      if (oldestPrice && oldestPrice > 0) {
        result[ticker] = ((current / oldestPrice) - 1) * 100
      }
    }
  } catch (err) {
    console.warn('[fetchBenchmarkReturns] Erro ao buscar benchmarks de mercado:', err)
  }

  return result
}

/**
 * Agrega posições por classe de ativo e calcula rentabilidade ponderada.
 */
export function aggregateClassPerformance(
  positions: ValuedPosition[],
  totalValue: number
): ClassPerformance[] {
  const classMap = new Map<
    string,
    { totalValue: number; totalCost: number; accumulatedDividends: number }
  >()

  for (const pos of positions) {
    const cls = pos.asset_class || 'Outros'
    const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
    const costInBrl = pos.currency === 'USD' ? pos.cost_basis * pos.usd_rate : pos.cost_basis
    const current = classMap.get(cls) || { totalValue: 0, totalCost: 0, accumulatedDividends: 0 }

    current.totalValue += valueInBrl
    current.totalCost += costInBrl
    current.accumulatedDividends += pos.accumulated_dividends
    classMap.set(cls, current)
  }

  const results: ClassPerformance[] = []
  for (const [name, data] of classMap.entries()) {
    const grossReturn = data.totalValue - data.totalCost + data.accumulatedDividends
    const grossYieldPct = data.totalCost > 0 ? (grossReturn / data.totalCost) * 100 : 0

    results.push({
      name,
      totalValue: data.totalValue,
      percentage: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
      grossYieldPct,
      accumulatedDividends: data.accumulatedDividends,
      benchmark: getBenchmarkForClass(name),
      benchmarkYieldPct: null, // será populado externamente com dados reais
    })
  }

  return results.sort((a, b) => b.totalValue - a.totalValue)
}

/**
 * Agrega posições por setor para exibição.
 */
export function aggregateSectorPerformance(
  positions: ValuedPosition[],
  totalValue: number
): ClassPerformance[] {
  const sectorMap = new Map<
    string,
    { totalValue: number; totalCost: number; accumulatedDividends: number }
  >()

  for (const pos of positions) {
    const sector = pos.sector || 'Indefinido'
    const valueInBrl = pos.currency === 'USD' ? pos.total_value * pos.usd_rate : pos.total_value
    const costInBrl = pos.currency === 'USD' ? pos.cost_basis * pos.usd_rate : pos.cost_basis
    const current = sectorMap.get(sector) || { totalValue: 0, totalCost: 0, accumulatedDividends: 0 }

    current.totalValue += valueInBrl
    current.totalCost += costInBrl
    current.accumulatedDividends += pos.accumulated_dividends
    sectorMap.set(sector, current)
  }

  const results: ClassPerformance[] = []
  for (const [name, data] of sectorMap.entries()) {
    const grossReturn = data.totalValue - data.totalCost + data.accumulatedDividends
    const grossYieldPct = data.totalCost > 0 ? (grossReturn / data.totalCost) * 100 : 0

    results.push({
      name,
      totalValue: data.totalValue,
      percentage: totalValue > 0 ? (data.totalValue / totalValue) * 100 : 0,
      grossYieldPct,
      accumulatedDividends: data.accumulatedDividends,
      benchmark: { name: '-', ticker: '', description: '' },
      benchmarkYieldPct: null,
    })
  }

  return results.sort((a, b) => b.totalValue - a.totalValue)
}

/**
 * Gera dados para gráfico pizza a partir de uma agregação de performance.
 */
export function classPerformanceToPieSlices(
  performances: ClassPerformance[]
): Array<{ name: string; value: number; percentage: number; color: string }> {
  const CLASS_COLORS: Record<string, string> = {
    'Ações Nacionais': 'var(--color-primary)',
    'Ações Internacionais': 'var(--color-income)',
    'Fundos Imobiliários': 'var(--color-balance)',
    'ETFs Nacionais': 'var(--color-text-primary)',
    'ETFs Internacionais': 'var(--color-balance)',
    ETFs: 'var(--color-text-primary)',
    Criptoativos: 'var(--color-warning)',
    'Renda Fixa': 'var(--color-primary-strong)',
    Outros: 'var(--color-text-secondary)',
  }

  const PIE_FALLBACKS = [
    'var(--chart-glass-3)', 'var(--chart-glass-0)', 'var(--chart-glass-1)',
    'var(--chart-glass-2)', 'var(--chart-glass-4)',
  ]

  return performances.map((p, i) => ({
    name: p.name,
    value: p.totalValue,
    percentage: p.percentage,
    color: CLASS_COLORS[p.name] || PIE_FALLBACKS[i % PIE_FALLBACKS.length],
  }))
}

/**
 * Gera dados para gráfico pizza a partir de uma agregação de setores.
 * Usa paleta de fallback independente pois os nomes de setor são imprevisíveis.
 */
export function sectorPerformanceToPieSlices(
  performances: ClassPerformance[]
): Array<{ name: string; value: number; percentage: number; color: string }> {
  const SECTOR_COLORS = [
    'var(--color-primary)',
    'var(--color-income)',
    'var(--color-balance)',
    'var(--color-expense)',
    'var(--color-income-strong)',
    'var(--color-primary-strong)',
    'var(--chart-glass-3)',
    'var(--chart-glass-0)',
    'var(--chart-glass-1)',
    'var(--chart-glass-2)',
    'var(--chart-glass-4)',
    'var(--color-text-secondary)',
  ]

  return performances.map((p, i) => ({
    name: p.name,
    value: p.totalValue,
    percentage: p.percentage,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }))
}

/**
 * Gera dados para gráfico pizza de TOP N ativos + "Outros".
 *
 * @param maxItems - Número máximo de ativos individuais exibidos (default 12)
 * @param minPct - Percentual mínimo para um ativo aparecer individualmente (default 1.5%)
 *                 Ativos abaixo desse percentual são agrupados em "Outros"
 */
export function topAssetsToPieSlices(
  positions: ValuedPosition[],
  totalValue: number,
  maxItems: number = 12,
  minPct: number = 1.5
): Array<{ name: string; value: number; percentage: number; color: string }> {
  const PIE_COLORS = [
    'var(--color-primary)',
    'var(--color-income)',
    'var(--color-balance)',
    'var(--color-expense)',
    'var(--color-income-strong)',
    'var(--color-primary-strong)',
    'var(--chart-glass-3)',
    'var(--chart-glass-0)',
    'var(--chart-glass-1)',
    'var(--chart-glass-2)',
    'var(--chart-glass-4)',
    'var(--color-text-secondary)',
  ]

  const sorted = [...positions]
    .map((p) => {
      const valueInBrl = p.currency === 'USD' ? p.total_value * p.usd_rate : p.total_value
      return { ...p, valueInBrl }
    })
    .filter((p) => p.valueInBrl > 0)
    .sort((a, b) => b.valueInBrl - a.valueInBrl)

  // Separar: ativos que aparecem individualmente vs os que vão para "Outros"
  const individuals: typeof sorted = []
  const rest: typeof sorted = []

  for (const pos of sorted) {
    const pct = totalValue > 0 ? (pos.valueInBrl / totalValue) * 100 : 0
    if (individuals.length < maxItems && pct >= minPct) {
      individuals.push(pos)
    } else {
      rest.push(pos)
    }
  }

  const slices = individuals.map((pos, i) => ({
    name: pos.ticker,
    value: pos.valueInBrl,
    percentage: totalValue > 0 ? (pos.valueInBrl / totalValue) * 100 : 0,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))

  if (rest.length > 0) {
    const restValue = rest.reduce((sum, p) => sum + p.valueInBrl, 0)
    slices.push({
      name: rest.length === 1 ? rest[0].ticker : `Outros (${rest.length})`,
      value: restValue,
      percentage: totalValue > 0 ? (restValue / totalValue) * 100 : 0,
      color: 'var(--color-text-secondary)',
    })
  }

  return slices
}
