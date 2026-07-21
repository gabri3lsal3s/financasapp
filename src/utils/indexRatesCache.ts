import { annualToDailyRate, eachBusinessDayBetween } from './fixedIncomeCurve'

export interface IndexRatesMap {
  [indexer: string]: Record<string, number> // data -> taxa diária (ex: '2024-05-10' -> 0.000412)
}

export interface IndexerFactorCache {
  getFactor(indexer: string, indexerPercent: number, startDate: string, endDate: string): number
}

/**
  Retorna a taxa diária com mecanismo de Carry-Forward.
  Se não houver taxa gravada na data específica, busca a última taxa válida anterior no mapa.
  Se o mapa estiver totalmente vazio, utiliza a taxa SELIC/CDI base fallback (ex: 10.75% a.a.).
 */
export function getDailyRateWithCarryForward(
  rateMap: Record<string, number>,
  dateStr: string,
  lastValidRateRef: { rate: number | null }
): number {
  if (rateMap[dateStr] !== undefined && rateMap[dateStr] !== null && !isNaN(rateMap[dateStr])) {
    const r = rateMap[dateStr]
    lastValidRateRef.rate = r
    return r
  }

  if (lastValidRateRef.rate !== null) {
    return lastValidRateRef.rate
  }

  // Se o mapa tiver dados em outras datas, pegar a taxa mais próxima anterior a dateStr
  const dates = Object.keys(rateMap).sort()
  let closestRate: number | null = null
  for (const d of dates) {
    if (d > dateStr) break
    closestRate = rateMap[d]
  }

  if (closestRate !== null) {
    lastValidRateRef.rate = closestRate
    return closestRate
  }

  // Ultimate fallback caso o banco não possua NENHUMA taxa cadastrada
  const fallbackDaily = annualToDailyRate(10.75)
  lastValidRateRef.rate = fallbackDaily
  return fallbackDaily
}

/**
 * Calcula o fator acumulado entre startDate e endDate para CDI/SELIC pós-fixados.
 */
export function calculateAccumulatedIndexFactor(
  indexer: string,
  indexerPercent: number,
  startDate: string,
  endDate: string,
  rateMap: Record<string, number> = {}
): number {
  if (startDate >= endDate) return 1.0

  const idx = (indexer || 'none').toLowerCase()
  if (idx === 'none') return 1.0

  const businessDays = eachBusinessDayBetween(startDate, endDate)
  if (businessDays.length === 0) return 1.0

  let accumulatedFactor = 1.0
  const pct = (indexerPercent ?? 100) / 100
  const lastValidRateRef = { rate: null as number | null }

  for (const dateStr of businessDays) {
    const rawRate = getDailyRateWithCarryForward(rateMap, dateStr, lastValidRateRef)
    const dailyIndexerRate = rawRate * pct
    accumulatedFactor *= (1 + dailyIndexerRate)
  }

  return accumulatedFactor
}

/**
 * Busca o VNA ANBIMA de forma resiliente para IPCA+ com carry-forward/fallback.
 */
export function getResilientVna(vnaMap: Record<string, number>, dateStr: string): number | null {
  if (vnaMap[dateStr] !== undefined && vnaMap[dateStr] !== null && vnaMap[dateStr] > 0) {
    return vnaMap[dateStr]
  }

  const dates = Object.keys(vnaMap).sort()
  let lastVna: number | null = null
  for (const d of dates) {
    if (d > dateStr) break
    if (vnaMap[d] > 0) lastVna = vnaMap[d]
  }

  return lastVna
}
