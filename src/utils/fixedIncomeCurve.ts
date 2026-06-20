import type { PortfolioTransaction, PortfolioAssetDefinition } from '@/types'

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

  if (indexer === 'none') {
    // Apenas taxa pré-fixada
    const dailyRate = annualToDailyRate(contractRateAnnual)
    factor = Math.pow(1 + dailyRate, businessDays)
  } else if (indexer === 'cdi' || indexer === 'selic') {
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
        
        factor *= (1 + dailyIndexerRate + spreadDaily)
      }
      curDate.setDate(curDate.getDate() + 1)
    }
  } else if (indexer === 'ipca') {
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
}

/**
 * Calcula o valor na curva de Renda Fixa agrupado por lotes/transações de aportes.
 * Útil para títulos públicos do Tesouro Direto que possuem aportes em datas distintas.
 */
export function calculateLotBasedFixedIncomeValue(params: LotBasedParams): number {
  const { transactions, ticker, definition, asOfDate, indexRates, vnaToday } = params

  const buys = transactions.filter(
    (t) =>
      t.ticker.toUpperCase().trim() === ticker.toUpperCase().trim() &&
      (t.operation_type === 'buy' || t.operation_type === 'subscription') &&
      t.date <= asOfDate
  )

  let totalValue = 0

  for (const buy of buys) {
    const principal = Number(buy.quantity) * Number(buy.price)
    
    // IPCA+ com VNA ANBIMA
    if (definition.indexer === 'ipca' && vnaToday && buy.vna_at_purchase) {
      const vnaPurchase = Number(buy.vna_at_purchase)
      const vnaFactor = vnaPurchase > 0 ? vnaToday / vnaPurchase : 1.0
      
      const businessDays = countBusinessDays(buy.date, asOfDate)
      const rateAnnual = definition.contract_rate ?? buy.contract_rate ?? 0
      const fixedDaily = annualToDailyRate(rateAnnual)
      const fixedFactor = Math.pow(1 + fixedDaily, businessDays)

      totalValue += principal * vnaFactor * fixedFactor
    } else {
      // Outros indexadores pós-fixados normais por lote
      const lotVal = calculateFixedIncomeValue({
        principal,
        contractRateAnnual: definition.contract_rate ?? buy.contract_rate ?? 0,
        indexer: definition.indexer,
        indexerPercent: definition.indexer_percent,
        applicationDate: buy.date,
        asOfDate,
        indexRates
      })
      totalValue += lotVal
    }
  }

  return totalValue
}
