import { countBusinessDaysBetween, eachBusinessDayBetween } from '@/utils/businessDays'
import type { PortfolioAssetIndexer, PortfolioTransaction, PortfolioAssetDefinition } from '@/types'
import { sortTransactionsStably } from '@/utils/portfolioOperations'
import { FALLBACK_VNA } from '@/services/vnaService'

export interface IndexRateMap {
  [date: string]: number
}

export interface FixedIncomeValuationInput {
  principal: number
  contractRateAnnual: number | null
  indexer: PortfolioAssetIndexer
  indexerPercent: number
  applicationDate: string
  asOfDate: string
  indexRates: IndexRateMap
  /** VNA na data do aporte (Tesouro IPCA+). */
  vnaAtPurchase?: number | null
  /** VNA na data de valoração. */
  vnaToday?: number | null
}

function dailyRateFromAnnualPercent(annualPercent: number, businessDaysInYear = 252): number {
  const annualDecimal = annualPercent / 100
  return Math.pow(1 + annualDecimal, 1 / businessDaysInYear) - 1
}

// ---------------------------------------------------------------------------
// Otimização O(1): mapa de fator acumulado pré-computado
// ---------------------------------------------------------------------------

/**
 * Pré-computa, para cada data em `dates`, o fator de capitalização acumulado
 * do indexador levando em conta `indexerPercent` (ex: 110 para 110% CDI).
 *
 * Uso: valor_lote = principal × (cumMap[asOfDate] / cumMap[dayBeforePurchase])
 *
 * @param dates          Lista de datas ordenadas (dias úteis)
 * @param indexRates     Mapa date → taxa diária (% ao dia)
 * @param indexerPercent Percentual do indexador (ex: 100 = 100% CDI)
 */
export function buildCumulativeIndexerMap(
  dates: string[],
  indexRates: IndexRateMap,
  indexerPercent = 100
): Record<string, number> {
  if (dates.length === 0) return {}

  const pct = indexerPercent / 100
  const cumMap: Record<string, number> = {}
  let cumFactor = 1.0
  let lastKnownRate = Object.values(indexRates).find(v => v !== undefined && v !== null) ?? 0

  for (const date of dates) {
    const raw = indexRates[date]
    if (raw !== undefined && raw !== null) lastKnownRate = raw
    const dailyDecimal = lastKnownRate / 100
    cumFactor *= 1 + dailyDecimal * pct
    cumMap[date] = cumFactor
  }

  return cumMap
}

/**
 * Retorna o fator de crescimento de um lote entre purchaseDate e asOfDate
 * usando um mapa de fatores pré-computados (O(1) por lote).
 *
 * Lógica: o lote começa a crescer em purchaseDate. O divisor é o fator
 * acumulado imediatamente ANTES de purchaseDate (fator "zero" do lote).
 * Se purchaseDate for o início do mapa, o divisor é 1.0.
 */
export function getLotGrowthFactor(
  cumMap: Record<string, number>,
  purchaseDate: string,
  asOfDate: string
): number {
  const sortedDates = Object.keys(cumMap).sort()
  if (sortedDates.length === 0) return 1.0

  const resolveUpTo = (targetDate: string): number => {
    let last = 1.0
    for (const d of sortedDates) {
      if (d > targetDate) break
      last = cumMap[d]
    }
    return last
  }

  // Fator do dia imediatamente antes da compra
  const resolveStrictlyBefore = (targetDate: string): number => {
    let last = 1.0
    for (const d of sortedDates) {
      if (d >= targetDate) break
      last = cumMap[d]
    }
    return last
  }

  const factorBefore = resolveStrictlyBefore(purchaseDate)
  const factorAtAsOf = resolveUpTo(asOfDate)

  if (factorBefore <= 0) return 1.0
  return factorAtAsOf / factorBefore
}

// ---------------------------------------------------------------------------
// Funções privadas de capitalização
// ---------------------------------------------------------------------------

function accumulatePostFixed(
  principal: number,
  businessDays: string[],
  _indexer: PortfolioAssetIndexer,
  indexerPercent: number,
  indexRates: IndexRateMap
): number {
  if (principal <= 0 || businessDays.length === 0) return principal

  let value = principal
  const factor = indexerPercent / 100

  // Busca a primeira taxa válida disponível no mapa para usar como taxa inicial de fallback
  const firstAvailableRate = Object.values(indexRates).find(v => v !== undefined && v !== null)
  let lastKnownRate = firstAvailableRate ?? 0

  for (const day of businessDays) {
    let rawRate = indexRates[day]
    if (rawRate === undefined || rawRate === null) {
      rawRate = lastKnownRate
    } else {
      lastKnownRate = rawRate
    }
    const dailyDecimal = rawRate / 100
    value *= 1 + dailyDecimal * factor
  }

  return value
}

/** Pré-fixado: VF = VP × (1 + i)^(n/252) com n = dias úteis. */
function accumulatePreFixed(
  principal: number,
  applicationDate: string,
  asOfDate: string,
  contractRateAnnual: number
): number {
  if (principal <= 0) return 0
  const n = countBusinessDaysBetween(applicationDate, asOfDate)
  if (n <= 0) return principal
  const annualDecimal = contractRateAnnual / 100
  return principal * Math.pow(1 + annualDecimal, n / 252)
}

/** Tesouro IPCA+: VF = VP × (VNA_hoje / VNA_compra) × (1 + i)^(n/252). */
function accumulateIpcaPlusTreasury(
  principal: number,
  applicationDate: string,
  asOfDate: string,
  contractRateAnnual: number,
  vnaAtPurchase: number,
  vnaToday: number
): number {
  if (principal <= 0 || vnaAtPurchase <= 0 || vnaToday <= 0) return principal
  const n = countBusinessDaysBetween(applicationDate, asOfDate)
  const vnaFactor = vnaToday / vnaAtPurchase
  const annualDecimal = contractRateAnnual / 100
  const rateFactor = n > 0 ? Math.pow(1 + annualDecimal, n / 252) : 1
  return principal * vnaFactor * rateFactor
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

/**
 * Valor teórico de renda fixa (pré ou pós-fixada por dias úteis).
 */
export function calculateFixedIncomeValue(input: FixedIncomeValuationInput): number {
  const {
    principal,
    contractRateAnnual,
    indexer,
    indexerPercent,
    applicationDate,
    asOfDate,
    indexRates,
    vnaAtPurchase,
    vnaToday,
  } = input

  if (principal <= 0) return 0

  if (indexer === 'ipca') {
    const finalVnaAtPurchase = vnaAtPurchase || FALLBACK_VNA
    const finalVnaToday = vnaToday || FALLBACK_VNA
    const finalRate = contractRateAnnual ?? 0
    return Math.round(
      accumulateIpcaPlusTreasury(
        principal,
        applicationDate,
        asOfDate,
        finalRate,
        finalVnaAtPurchase,
        finalVnaToday
      ) * 100
    ) / 100
  }

  if (indexer !== 'none') {
    const businessDays = eachBusinessDayBetween(applicationDate, asOfDate)
    return Math.round(
      accumulatePostFixed(principal, businessDays, indexer, indexerPercent, indexRates) * 100
    ) / 100
  }

  if (contractRateAnnual !== null && contractRateAnnual > 0) {
    return Math.round(
      accumulatePreFixed(principal, applicationDate, asOfDate, contractRateAnnual) * 100
    ) / 100
  }

  return principal
}

/**
 * Calcula o valor teórico total de renda fixa lote por lote (FIFO),
 * considerando as diferentes taxas e datas acordadas em cada aporte individual.
 *
 * Para indexadores CDI/Selic, aceita `cumulativeIndexerMap` pré-computado para
 * valoração O(1) por lote (em vez do loop O(D) original).
 */
export function calculateLotBasedFixedIncomeValue({
  transactions,
  ticker,
  definition,
  asOfDate,
  indexRates,
  vnaToday,
  cumulativeIndexerMap,
}: {
  transactions: PortfolioTransaction[]
  ticker: string
  definition: PortfolioAssetDefinition
  asOfDate: string
  indexRates: IndexRateMap
  vnaToday?: number | null
  /** Mapa pré-computado O(1) para indexadores CDI/Selic — gerado por buildCumulativeIndexerMap. */
  cumulativeIndexerMap?: Record<string, number>
}): number {
  const upperTicker = ticker.toUpperCase().trim()

  // Filtrar transações históricas até a data de valoração informada
  const historicalTxs = transactions.filter((t) => t.date <= asOfDate)

  const buyLots = sortTransactionsStably(
    historicalTxs.filter(
      (t) =>
        t.ticker.toUpperCase().trim() === upperTicker &&
        (t.operation_type === 'buy' || t.operation_type === 'subscription') &&
        (t.settlement_status ?? 'settled') === 'settled'
    )
  ).map((t) => ({
      date: t.date,
      quantity: Number(t.quantity),
      price: Number(t.price),
      contract_rate:
        t.contract_rate !== undefined && t.contract_rate !== null ? Number(t.contract_rate) : null,
      vna_at_purchase:
        t.vna_at_purchase !== undefined && t.vna_at_purchase !== null
          ? Number(t.vna_at_purchase)
          : null,
    }))

  const sales = historicalTxs.filter(
    (t) =>
      t.ticker.toUpperCase().trim() === upperTicker &&
      t.operation_type === 'sell' &&
      (t.settlement_status ?? 'settled') === 'settled'
  )
  let totalQuantitySold = sales.reduce((sum, t) => sum + Number(t.quantity), 0)

  for (const lot of buyLots) {
    if (totalQuantitySold <= 0) break
    if (lot.quantity <= totalQuantitySold) {
      totalQuantitySold -= lot.quantity
      lot.quantity = 0
    } else {
      lot.quantity -= totalQuantitySold
      totalQuantitySold = 0
    }
  }

  // Usa o mapa de fatores acumulados O(1) para indexadores pós-fixados (CDI/Selic)
  const canUseO1 =
    cumulativeIndexerMap !== undefined &&
    Object.keys(cumulativeIndexerMap).length > 0 &&
    definition.indexer !== 'none' &&
    definition.indexer !== 'ipca'

  let totalTheoreticalValue = 0
  for (const lot of buyLots) {
    if (lot.quantity <= 0) continue
    const lotPrincipal = lot.quantity * lot.price

    if (canUseO1) {
      // Caminho O(1): multiplica o principal pelo fator de crescimento entre compra e hoje
      const growthFactor = getLotGrowthFactor(cumulativeIndexerMap!, lot.date, asOfDate)
      totalTheoreticalValue += Math.round(lotPrincipal * growthFactor * 100) / 100
    } else {
      // Caminho fallback O(D): comportamento original preservado
      const lotRate = lot.contract_rate !== null ? lot.contract_rate : definition.contract_rate
      const lotValue = calculateFixedIncomeValue({
        principal: lotPrincipal,
        contractRateAnnual: lotRate,
        indexer: definition.indexer,
        indexerPercent: definition.indexer_percent,
        applicationDate: lot.date,
        asOfDate,
        indexRates,
        vnaAtPurchase: lot.vna_at_purchase ?? undefined,
        vnaToday: vnaToday ?? undefined,
      })
      totalTheoreticalValue += lotValue
    }
  }

  return totalTheoreticalValue
}

export { dailyRateFromAnnualPercent }
