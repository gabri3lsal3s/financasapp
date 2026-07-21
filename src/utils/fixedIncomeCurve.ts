import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'
import { sortTransactionsStably } from './portfolioOperations'
import { isBusinessDay as isAnbimaBusinessDay } from './businessDays'
import { calculateAccumulatedIndexFactor, getResilientVna } from './indexRatesCache'

interface FixedIncomeParams {
  principal: number
  contractRateAnnual: number
  indexer: string
  indexerPercent: number
  applicationDate: string
  asOfDate: string
  indexRates: Record<string, number> // data -> taxa_diaria (ex: 0.000412)
}

export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLocalDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Retorna se uma data é dia útil (considerando calendário de feriados ANBIMA).
 */
export function isBusinessDay(date: Date): boolean {
  return isAnbimaBusinessDay(date)
}

/**
 * Conta os dias úteis entre duas datas (inclusive data inicial, exclusiva final).
 */
export function countBusinessDays(start: string, end: string): number {
  const dStart = parseLocalDate(start)
  const dEnd = parseLocalDate(end)
  if (dStart >= dEnd) return 0

  let count = 0
  const cur = new Date(dStart)
  while (cur < dEnd) {
    if (isBusinessDay(cur)) {
      count++
    }
    cur.setDate(cur.getDate() + 1)
  }
  return count
}

/**
 * Retorna lista de datas de dias úteis entre duas datas.
 */
export function eachBusinessDayBetween(start: string, end: string): string[] {
  const dStart = parseLocalDate(start)
  const dEnd = parseLocalDate(end)
  const result: string[] = []
  if (dStart >= dEnd) return result

  const cur = new Date(dStart)
  while (cur < dEnd) {
    if (isBusinessDay(cur)) {
      result.push(formatLocalDate(cur))
    }
    cur.setDate(cur.getDate() + 1)
  }
  return result
}

/**
 * Converte taxa anual para diária (base 252 DU).
 */
export function annualToDailyRate(annualRatePercent: number): number {
  return Math.pow(1 + annualRatePercent / 100, 1 / 252) - 1
}

/**
 * Calcula o valor de um ativo de Renda Fixa na curva.
 */
export function calculateFixedIncomeValue(params: FixedIncomeParams): number {
  const {
    principal,
    contractRateAnnual,
    indexer,
    indexerPercent,
    applicationDate,
    asOfDate,
    indexRates
  } = params

  if (principal <= 0) return 0
  if (applicationDate >= asOfDate) return principal

  const businessDays = countBusinessDays(applicationDate, asOfDate)
  if (businessDays <= 0) return principal

  const idx = (indexer || 'none').toLowerCase()
  let factor = 1.0

  const spreadDaily = contractRateAnnual > 0 ? annualToDailyRate(contractRateAnnual) : 0
  const spreadFactor = Math.pow(1 + spreadDaily, businessDays)

  if (idx === 'none') {
    factor = spreadFactor
  } else if (idx === 'cdi' || idx === 'selic') {
    const indexerFactor = calculateAccumulatedIndexFactor(idx, indexerPercent, applicationDate, asOfDate, indexRates)
    factor = indexerFactor * spreadFactor
  } else if (idx === 'ipca') {
    const ipcaDailyRate = annualToDailyRate(4.5)
    const ipcaFactor = Math.pow(1 + ipcaDailyRate, businessDays)
    factor = spreadFactor * ipcaFactor
  }

  return principal * factor
}

interface LotBasedParams {
  transactions: PortfolioTransaction[]
  ticker: string
  definition: PortfolioAssetDefinition
  asOfDate: string
  indexRates: Record<string, number>
  vnaToday?: number
  vnaMap?: Record<string, number>
  returnNet?: boolean
}

/**
 * Calcula o valor na curva de Renda Fixa agrupado por lotes/transações de aportes. Rastreia compras e vendas.
 */
export function calculateLotBasedFixedIncomeValue(params: LotBasedParams): number {
  const { transactions, ticker, definition, asOfDate, indexRates, vnaToday, vnaMap, returnNet } = params

  const tickerTxs = transactions.filter(
    (t) => t.ticker.toUpperCase().trim() === ticker.toUpperCase().trim() && t.date <= asOfDate
  )
  const sortedTxs = sortTransactionsStably(tickerTxs)

  interface Lot {
    quantity: number
    principal: number
    date: string
    contractRate: number
    vnaAtPurchase?: number
  }

  const lots: Lot[] = []
  let totalQty = 0

  for (const tx of sortedTxs) {
    const q = Number(tx.quantity)
    const p = Number(tx.price)
    const type = tx.operation_type

    if (type === 'buy' || type === 'subscription') {
      lots.push({
        quantity: q,
        principal: q * p,
        date: tx.date,
        contractRate: definition.contract_rate ?? tx.contract_rate ?? 0,
        vnaAtPurchase: tx.vna_at_purchase ? Number(tx.vna_at_purchase) : undefined
      })
      totalQty += q
    } else if (type === 'sell') {
      if (totalQty > 0) {
        const sellRatio = Math.max(0, 1 - (q / totalQty))
        for (const lot of lots) {
          lot.quantity *= sellRatio
          lot.principal *= sellRatio
        }
        totalQty = Math.max(0, totalQty - q)
      }
    }
  }

  let totalValue = 0

  for (const lot of lots) {
    if (lot.principal <= 0) continue

    let lotVal = 0
    const idx = (definition.indexer || 'none').toLowerCase()

    // IPCA+ com VNA ANBIMA
    if (idx === 'ipca') {
      const vnaPurchase = lot.vnaAtPurchase || (vnaMap ? getResilientVna(vnaMap, lot.date) : null)
      const vnaCurrent = vnaToday || (vnaMap ? getResilientVna(vnaMap, asOfDate) : null)

      if (vnaPurchase && vnaCurrent && vnaPurchase > 0) {
        const vnaFactor = vnaCurrent / vnaPurchase
        const businessDays = countBusinessDays(lot.date, asOfDate)
        const fixedDaily = annualToDailyRate(lot.contractRate)
        const fixedFactor = Math.pow(1 + fixedDaily, businessDays)
        lotVal = lot.principal * vnaFactor * fixedFactor
      } else {
        lotVal = calculateFixedIncomeValue({
          principal: lot.principal,
          contractRateAnnual: lot.contractRate,
          indexer: definition.indexer,
          indexerPercent: definition.indexer_percent,
          applicationDate: lot.date,
          asOfDate,
          indexRates
        })
      }
    } else {
      lotVal = calculateFixedIncomeValue({
        principal: lot.principal,
        contractRateAnnual: lot.contractRate,
        indexer: definition.indexer,
        indexerPercent: definition.indexer_percent,
        applicationDate: lot.date,
        asOfDate,
        indexRates
      })
    }

    if (returnNet) {
      const profit = lotVal - lot.principal
      if (profit > 0) {
        const dStart = parseLocalDate(lot.date)
        const dAsOf = parseLocalDate(asOfDate)
        const calendarDays = Math.max(0, Math.round((dAsOf.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)))

        let irRate = 0.15
        if (calendarDays <= 180) irRate = 0.225
        else if (calendarDays <= 360) irRate = 0.20
        else if (calendarDays <= 720) irRate = 0.175

        lotVal = lot.principal + profit * (1 - irRate)
      }
    }

    totalValue += lotVal
  }

  return totalValue
}

