import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'
import { sortTransactionsStably } from './portfolioOperations'

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
 * Retorna se uma data é dia útil (segunda a sexta).
 */
export function isBusinessDay(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
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

  // Contar dias úteis
  const businessDays = countBusinessDays(applicationDate, asOfDate)
  if (businessDays <= 0) return principal

  let factor = 1.0

  const idx = (indexer || 'none').toLowerCase()

  if (idx === 'none') {
    // Apenas taxa pré-fixada
    const dailyRate = annualToDailyRate(contractRateAnnual)
    factor = Math.pow(1 + dailyRate, businessDays)
  } else if (idx === 'cdi' || idx === 'selic') {
    // Acumular CDI/SELIC dia a dia
    const curDate = parseLocalDate(applicationDate)
    const endDate = parseLocalDate(asOfDate)

    // Taxa anual pré de acréscimo se houver (ex: CDI + 2%)
    const spreadDaily = contractRateAnnual > 0 ? annualToDailyRate(contractRateAnnual) : 0

    while (curDate < endDate) {
      if (isBusinessDay(curDate)) {
        const dateStr = formatLocalDate(curDate)
        // Ler taxa diária da tabela ou assumir fallback de 10.75% a.a. se não houver taxa cadastrada
        const rawRate = indexRates[dateStr] !== undefined ? indexRates[dateStr] : annualToDailyRate(10.75)
        const dailyIndexerRate = rawRate * (indexerPercent / 100)
        
        factor *= (1 + dailyIndexerRate) * (1 + spreadDaily)
      }
      curDate.setDate(curDate.getDate() + 1)
    }
  } else if (idx === 'ipca') {
    // IPCA+ (Normalmente IPCA + Taxa Fixa Anual)
    // Usamos fallback caso não haja VNA disponível
    const dailySpreadRate = annualToDailyRate(contractRateAnnual)
    const fixedFactor = Math.pow(1 + dailySpreadRate, businessDays)

    // Fallback de inflação média de 4.5% a.a.
    const ipcaDailyRate = annualToDailyRate(4.5)
    const ipcaFactor = Math.pow(1 + ipcaDailyRate, businessDays)

    factor = fixedFactor * ipcaFactor
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
  returnNet?: boolean
}

/**
 * Calcula o valor na curva de Renda Fixa agrupado por lotes/transações de aportes. Rastreia compras e vendas.
 */
export function calculateLotBasedFixedIncomeValue(params: LotBasedParams): number {
  const { transactions, ticker, definition, asOfDate, indexRates, vnaToday, returnNet } = params

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
    if (idx === 'ipca' && vnaToday && lot.vnaAtPurchase) {
      const vnaPurchase = lot.vnaAtPurchase
      const vnaFactor = vnaPurchase > 0 ? vnaToday / vnaPurchase : 1.0
      
      const businessDays = countBusinessDays(lot.date, asOfDate)
      const fixedDaily = annualToDailyRate(lot.contractRate)
      const fixedFactor = Math.pow(1 + fixedDaily, businessDays)

      lotVal = lot.principal * vnaFactor * fixedFactor
    } else {
      // Outros indexadores pós-fixados normais por lote
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
        const days = (new Date(asOfDate).getTime() - new Date(lot.date).getTime()) / (1000 * 60 * 60 * 24)
        let irRate = 0.15
        if (days <= 180) irRate = 0.225
        else if (days <= 360) irRate = 0.20
        else if (days <= 720) irRate = 0.175
        lotVal = lot.principal + profit * (1 - irRate)
      }
    }

    totalValue += lotVal
  }

  return totalValue
}
