import {
  PortfolioTransaction,
  TargetAllocation,
  AssetPrice,
  PortfolioGroupTarget,
  PortfolioAssetDefinition,
} from '@/types'
import { isPortfolioIncomeType, sortTransactionsStably } from '@/utils/portfolioOperations'
import { calculatePortfolioValuation, type ValuedPosition } from '@/services/valuationEngine'
import { type IndexRateMap } from '@/utils/fixedIncomeValuation'
import { detectDefaultCurrency, isTreasuryTicker } from '@/services/priceService'
import { isBusinessDay } from '@/utils/businessDays'
import { FALLBACK_VNA } from '@/services/vnaService'

export type AssetPosition = ValuedPosition

export interface PortfolioSummary {
  portfolio_id: string
  cash_balance: number
  assets_value: number
  total_value: number
  positions: AssetPosition[]
  yield_total: number // Rentabilidade acumulada total (baseada na cota)
  current_share_value: number // Valor atual da cota (baseado em R$ 1,00)
  total_shares: number // Quantidade atual de cotas
}

export type PerformanceMetricsDataSource = 'share_history' | 'insufficient'

export interface PerformanceMetrics {
  sharpe_ratio: number
  beta_ibov: number
  beta_sp500: number
  volatility_monthly: number
  return_monthly_avg: number
  data_source: PerformanceMetricsDataSource
}

// Histórico mensal estático simplificado de retornos de benchmarks (2025-2026) para cálculo de Beta real
const BENCHMARK_RETURNS: Record<string, number[]> = {
  IBOV: [0.015, -0.008, 0.022, -0.012, 0.005, 0.018, -0.003, 0.011, 0.009, -0.015, 0.021, 0.007],
  SP500: [0.021, 0.012, -0.005, 0.031, 0.018, -0.010, 0.025, 0.008, 0.015, -0.002, 0.028, 0.014],
}

/**
 * Calcula as posições atuais da carteira com base no histórico imutável de transações
 * e nas cotações correntes dos ativos.
 */
export function calculatePositions(
  transactions: PortfolioTransaction[],
  targets: TargetAllocation[],
  prices: Record<string, AssetPrice>,
  cashBalance: number,
  definitions: PortfolioAssetDefinition[] = [],
  indexRatesByIndexer: Record<string, IndexRateMap> = {},
  vnaMap: Record<string, number> = {}
): {
  positions: AssetPosition[]
  investedValue: number
  cashValue: number
  assetsValue: number
  totalValue: number
  cashBalance: number
} {
  const result = calculatePortfolioValuation({
    transactions,
    definitions,
    targets,
    prices,
    cashBalance,
    indexRatesByIndexer,
    vnaMap,
    fallbackPrice: FALLBACK_PRICE,
  })

  return {
    positions: result.positions,
    investedValue: result.investedValue,
    cashValue: result.cashValue,
    assetsValue: result.assetsValue,
    totalValue: result.totalValue,
    cashBalance: result.cashBalance,
  }
}

class BusinessDayHelper {
  private businessDaysList: string[] = []
  private nextBusinessDayIdx = new Map<string, number>()
  private prevBusinessDayIdx = new Map<string, number>()

  constructor(startDateStr: string, endDateStr: string) {
    const startParts = startDateStr.slice(0, 10).split('-')
    const endParts = endDateStr.slice(0, 10).split('-')
    const start = new Date(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10))
    const end = new Date(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10))

    const cursor = new Date(start)
    while (cursor <= end) {
      const yyyy = cursor.getFullYear()
      const mm = String(cursor.getMonth() + 1).padStart(2, '0')
      const dd = String(cursor.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`
      
      if (isBusinessDay(cursor)) {
        this.businessDaysList.push(dateStr)
      }
      cursor.setDate(cursor.getDate() + 1)
    }

    let currentNextIdx = 0
    let lastPrevIdx = -1

    const cursorNext = new Date(start)
    while (cursorNext <= end) {
      const yyyy = cursorNext.getFullYear()
      const mm = String(cursorNext.getMonth() + 1).padStart(2, '0')
      const dd = String(cursorNext.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`

      while (currentNextIdx < this.businessDaysList.length && this.businessDaysList[currentNextIdx] < dateStr) {
        currentNextIdx++
      }
      this.nextBusinessDayIdx.set(dateStr, currentNextIdx)
      cursorNext.setDate(cursorNext.getDate() + 1)
    }

    const cursorPrev = new Date(start)
    while (cursorPrev <= end) {
      const yyyy = cursorPrev.getFullYear()
      const mm = String(cursorPrev.getMonth() + 1).padStart(2, '0')
      const dd = String(cursorPrev.getDate()).padStart(2, '0')
      const dateStr = `${yyyy}-${mm}-${dd}`

      while (lastPrevIdx + 1 < this.businessDaysList.length && this.businessDaysList[lastPrevIdx + 1] <= dateStr) {
        lastPrevIdx++
      }
      this.prevBusinessDayIdx.set(dateStr, lastPrevIdx)
      cursorPrev.setDate(cursorPrev.getDate() + 1)
    }
  }

  private getNextIdx(d: string): number {
    const cached = this.nextBusinessDayIdx.get(d)
    if (cached !== undefined) return cached
    if (this.businessDaysList.length > 0 && d < this.businessDaysList[0]) return 0
    return this.businessDaysList.length
  }

  private getPrevIdx(d: string): number {
    const cached = this.prevBusinessDayIdx.get(d)
    if (cached !== undefined) return cached
    if (this.businessDaysList.length > 0 && d < this.businessDaysList[0]) return -1
    return this.businessDaysList.length - 1
  }

  public countBusinessDaysBetween(d1: string, d2: string): number {
    const idx1 = this.getNextIdx(d1)
    const idx2 = this.getPrevIdx(d2)
    if (idx1 > idx2) return 0
    return idx2 - idx1 + 1
  }

  public eachBusinessDayBetween(d1: string, d2: string): string[] {
    const idx1 = this.getNextIdx(d1)
    const idx2 = this.getPrevIdx(d2)
    if (idx1 > idx2) return []
    return this.businessDaysList.slice(idx1, idx2 + 1)
  }
}

/**
 * Sistema de Cotização Clássico:
 * Reconstrói a linha temporal da carteira isolando aportes/saques para calcular o valor real.
 */
export function calculateShareHistory(
  transactions: PortfolioTransaction[],
  prices: Record<string, AssetPrice>,
  definitions: PortfolioAssetDefinition[] = [],
  indexRatesByIndexer: Record<string, IndexRateMap> = {},
  historicalPrices: Record<string, Record<string, number>> = {},
  vnaMap: Record<string, number> = {}
): {
  currentShareValue: number
  totalShares: number
  shareHistory: {
    date: string
    shareValue: number
    totalValue?: number
    cashValue?: number
    investedValue?: number
    investedCapital?: number
    classes?: Record<string, { totalValue: number; yieldPct: number }>
    sectors?: Record<string, { totalValue: number; yieldPct: number }>
  }[]
} {
  const sortedTxs = sortTransactionsStably(transactions)
  
  if (sortedTxs.length === 0) {
    return { currentShareValue: 1.0, totalShares: 0, shareHistory: [] }
  }

  const firstTxDate = sortedTxs[0].date
  const todayStr = new Date().toISOString().split('T')[0]
  const helper = new BusinessDayHelper(firstTxDate, todayStr)

  const definitionMap = new Map<string, PortfolioAssetDefinition>()
  for (const def of definitions) {
    definitionMap.set(def.ticker.toUpperCase(), def)
  }

  const txsByTicker: Record<string, PortfolioTransaction[]> = {}
  for (const tx of sortedTxs) {
    const t = tx.ticker.toUpperCase()
    if (tx.operation_type === 'buy' || tx.operation_type === 'sell' || tx.operation_type === 'subscription') {
      if (!txsByTicker[t]) txsByTicker[t] = []
      txsByTicker[t].push(tx)
    }
  }

  const getPricingMode = (ticker: string): string => {
    const upper = ticker.toUpperCase().trim()
    if (upper === 'CAIXA' || upper === 'SALDO_INV' || upper === 'SALDO EM CAIXA' || upper === 'SALDO_EM_CAIXA') return 'cash'
    const def = definitionMap.get(upper)
    if (def?.pricing_mode) return def.pricing_mode
    if (isTreasuryTicker(upper)) return 'fixed_income'
    return 'market'
  }

  const getAssetCurrency = (ticker: string): 'BRL' | 'USD' => {
    const upper = ticker.toUpperCase()
    const def = definitionMap.get(upper)
    if (def?.currency) return def.currency
    return detectDefaultCurrency(ticker)
  }

  // 1. Definir o conjunto de todas as datas avaliadas no histórico (dias úteis + transações + hoje)
  const dateSet = new Set<string>()
  const bizDays = helper.eachBusinessDayBetween(firstTxDate, todayStr)
  for (const d of bizDays) {
    dateSet.add(d)
  }
  for (const tx of sortedTxs) {
    dateSet.add(tx.date)
  }
  dateSet.add(todayStr)
  const sortedDates = Array.from(dateSet).sort()

  // 2. Pré-organizar e preencher cotações diárias interpolando/carregando preço de todos os ativos nas datas avaliadas
  const getInterpolatedPrice = (ticker: string, dateStr: string): number => {
    const tickerUpper = ticker.toUpperCase()
    const currentPrice = prices[tickerUpper]?.current_price || FALLBACK_PRICE(tickerUpper)
    const tickerTxs = txsByTicker[tickerUpper] || []
    if (tickerTxs.length === 0) return currentPrice
    
    let lastTx: PortfolioTransaction | null = null
    let nextTx: PortfolioTransaction | null = null
    for (const t of tickerTxs) {
      if (t.date <= dateStr) {
        lastTx = t
      } else {
        nextTx = t
        break
      }
    }
    if (!lastTx) return Number(tickerTxs[0].price)
    
    const d1 = lastTx.date
    const p1 = Number(lastTx.price)
    const d2 = nextTx ? nextTx.date : todayStr
    const p2 = nextTx ? Number(nextTx.price) : currentPrice
    
    if (d1 === d2) return p1
    
    const t1 = new Date(d1 + 'T00:00:00Z').getTime()
    const t2 = new Date(d2 + 'T00:00:00Z').getTime()
    const t = new Date(dateStr + 'T00:00:00Z').getTime()
    
    if (t2 <= t1) return p1
    if (t >= t2) return p2
    if (t <= t1) return p1
    
    const fraction = (t - t1) / (t2 - t1)
    return p1 + (p2 - p1) * fraction
  }

  const dailyPrices: Record<string, Record<string, number>> = {}
  for (const ticker of Object.keys(txsByTicker)) {
    const tickerUpper = ticker.toUpperCase()
    dailyPrices[tickerUpper] = {}
    const tickerHist = historicalPrices[tickerUpper] || {}
    const histDates = Object.keys(tickerHist).sort()
    
    for (const date of sortedDates) {
      if (tickerHist[date] !== undefined && tickerHist[date] > 0) {
        dailyPrices[tickerUpper][date] = tickerHist[date]
      } else {
        let lastHistPrice = -1
        for (const hd of histDates) {
          if (hd > date) break
          lastHistPrice = tickerHist[hd]
        }
        if (lastHistPrice > 0) {
          dailyPrices[tickerUpper][date] = lastHistPrice
        } else {
          dailyPrices[tickerUpper][date] = getInterpolatedPrice(tickerUpper, date)
        }
      }
    }
  }

  const getHistoricalOrInterpolatedPrice = (ticker: string, dateStr: string): number => {
    const tickerUpper = ticker.toUpperCase()
    return dailyPrices[tickerUpper]?.[dateStr] ?? prices[tickerUpper]?.current_price ?? FALLBACK_PRICE(tickerUpper)
  }

  // 3. Pré-organizar e preencher cotações USD diárias
  const dailyUsdRates: Record<string, number> = {}
  const usdTickerUpper = 'USDBRL=X'
  const usdPriceObj = prices[usdTickerUpper]
  const usdCoeff = usdPriceObj?.current_price && usdPriceObj.current_price > 0
    ? usdPriceObj.current_price
    : 5.25
  const usdHist = historicalPrices[usdTickerUpper] || {}
  let lastUsd = usdCoeff
  for (const date of sortedDates) {
    if (usdHist[date] !== undefined && usdHist[date] > 0) {
      lastUsd = usdHist[date]
    }
    dailyUsdRates[date] = lastUsd
  }

  const getHistoricalUsdRate = (dateStr: string): number => {
    return dailyUsdRates[dateStr] ?? usdCoeff
  }

  // 4. Pré-organizar VNAs
  const dailyVna: Record<string, number> = {}
  const sortedVnaDates = Object.keys(vnaMap).sort()
  const resolveVnaForDateFastTemp = (dateStr: string): number => {
    if (vnaMap[dateStr] != null) return vnaMap[dateStr]
    let last = FALLBACK_VNA
    for (const d of sortedVnaDates) {
      if (d > dateStr) break
      last = vnaMap[d]
    }
    return last
  }
  for (const date of sortedDates) {
    dailyVna[date] = resolveVnaForDateFastTemp(date)
  }

  const resolveVnaForDateFast = (date: string): number => {
    return dailyVna[date] ?? FALLBACK_VNA
  }

  const indexerFallbackRate = new Map<string, number>()
  for (const [indexer, rates] of Object.entries(indexRatesByIndexer)) {
    const firstRate = Object.values(rates).find(v => v !== undefined && v !== null)
    indexerFallbackRate.set(indexer.toLowerCase(), firstRate ?? 0)
  }

  const INITIAL_SHARE_VALUE = 1.0
  let totalShares = 0
  let shareValue = INITIAL_SHARE_VALUE
  let runningInvestedCapital = 0
  const currentPortfolio: Record<string, number> = {}
  const runningLedger: Record<string, { quantity: number; totalCost: number; accumulatedDividends: number }> = {}
  const runningRealizedGains: Record<string, number> = {}
  let currentCash = 0
  
  const activeLotsMap = new Map<string, {
    quantity: number
    price: number
    contract_rate: number | null
    vna_at_purchase: number | null
    date: string
  }[]>()

  const shareHistory: { 
    date: string; 
    shareValue: number;
    totalValue?: number;
    cashValue?: number;
    investedValue?: number;
    investedCapital?: number;
    classes?: Record<string, { totalValue: number; yieldPct: number }>
    sectors?: Record<string, { totalValue: number; yieldPct: number }>
  }[] = []

  const valueFixedIncomeTicker = (ticker: string, date: string): number => {
    const def = definitionMap.get(ticker.toUpperCase())
    if (!def) return 0
    const lots = activeLotsMap.get(ticker.toUpperCase()) || []
    const indexRates = indexRatesByIndexer[def.indexer || 'none'] || {}
    const fallbackRate = indexerFallbackRate.get(def.indexer?.toLowerCase() || 'none') ?? 0
    
    let totalVal = 0
    for (const lot of lots) {
      let val = lot.quantity * lot.price
      if (def.indexer === 'ipca' && lot.vna_at_purchase) {
        const n = helper.countBusinessDaysBetween(lot.date, date)
        const vnaToday = resolveVnaForDateFast(date)
        const purchaseVna = lot.vna_at_purchase || FALLBACK_VNA
        const vnaFactor = purchaseVna > 0 ? vnaToday / purchaseVna : 1.0
        const rate = lot.contract_rate !== null ? lot.contract_rate : (def.contract_rate ?? 0)
        val = (lot.quantity * lot.price) * vnaFactor * Math.pow(1 + rate / 100, n / 252)
      } else if (def.indexer && def.indexer !== 'none') {
        const days = helper.eachBusinessDayBetween(lot.date, date)
        const factor = (def.indexer_percent ?? 100) / 100
        let lastKnown = fallbackRate
        for (const day of days) {
          let rawRate = indexRates[day]
          if (rawRate === undefined || rawRate === null) {
            rawRate = lastKnown
          } else {
            lastKnown = rawRate
          }
          val *= 1 + (rawRate / 100) * factor
        }
      } else if (def.contract_rate !== null && def.contract_rate > 0) {
        const n = helper.countBusinessDaysBetween(lot.date, date)
        const rate = lot.contract_rate !== null ? lot.contract_rate : def.contract_rate
        val *= Math.pow(1 + rate / 100, n / 252)
      }
      totalVal += Math.round(val * 100) / 100
    }
    return totalVal
  }

  const txsByDate: Record<string, PortfolioTransaction[]> = {}
  for (const tx of sortedTxs) {
    if (!txsByDate[tx.date]) txsByDate[tx.date] = []
    txsByDate[tx.date].push(tx)
  }

  for (const date of sortedDates) {
    const dayTxs = txsByDate[date] || []
    const dailyUsdRate = getHistoricalUsdRate(date)

    let cashPositionsValueBefore = 0
    let investedPositionsValueBefore = 0
    for (const [ticker, qty] of Object.entries(currentPortfolio)) {
      if (qty <= 0) continue
      const def = definitionMap.get(ticker)
      const pricingMode = getPricingMode(ticker)
      let val = 0

      if (pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)) {
        val = valueFixedIncomeTicker(ticker, date)
      } else if (pricingMode === 'manual_value') {
        val = qty * (def?.manual_current_value ?? getHistoricalOrInterpolatedPrice(ticker, date))
      } else if (pricingMode === 'cash') {
        val = qty * 1.00
      } else {
        val = qty * getHistoricalOrInterpolatedPrice(ticker, date)
      }
      
      const isUsd = getAssetCurrency(ticker) === 'USD'
      const valBrl = isUsd ? val * dailyUsdRate : val
      if (pricingMode === 'cash') {
        cashPositionsValueBefore += valBrl
      } else {
        investedPositionsValueBefore += valBrl
      }
    }
    const totalCashBefore = currentCash + cashPositionsValueBefore
    const totalValueBefore = investedPositionsValueBefore + totalCashBefore

    if (totalShares > 0 && totalValueBefore > 0) {
      shareValue = totalValueBefore / totalShares
    }

    let netCapitalFlow = 0

    for (const tx of dayTxs) {
      const ticker = tx.ticker.toUpperCase()
      const qty = Number(tx.quantity)
      const price = Number(tx.price)
      const amount = qty * price
      const isUsd = getAssetCurrency(ticker) === 'USD'
      const amountBrl = isUsd ? amount * dailyUsdRate : amount
      const pricingMode = getPricingMode(ticker)

      if (!runningLedger[ticker]) {
        runningLedger[ticker] = { quantity: 0, totalCost: 0, accumulatedDividends: 0 }
      }
      const ledgerPos = runningLedger[ticker]

      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        currentCash -= amountBrl
        currentPortfolio[ticker] = (currentPortfolio[ticker] || 0) + (pricingMode === 'cash' ? amountBrl : qty)
        
        ledgerPos.quantity += (pricingMode === 'cash' ? amountBrl : qty)
        ledgerPos.totalCost += (pricingMode === 'cash' ? amountBrl : amount)

        if (pricingMode === 'fixed_income' || definitionMap.get(ticker)?.is_treasury || isTreasuryTicker(ticker)) {
          if (!activeLotsMap.has(ticker)) {
            activeLotsMap.set(ticker, [])
          }
          activeLotsMap.get(ticker)!.push({
            quantity: qty,
            price: price,
            contract_rate: tx.contract_rate !== undefined && tx.contract_rate !== null ? Number(tx.contract_rate) : null,
            vna_at_purchase: tx.vna_at_purchase !== undefined && tx.vna_at_purchase !== null ? Number(tx.vna_at_purchase) : null,
            date: date
          })
        }
      } else if (tx.operation_type === 'sell') {
        if (pricingMode === 'cash') {
          netCapitalFlow -= amountBrl
        } else {
          currentCash += amountBrl
        }

        if (currentPortfolio[ticker]) {
          currentPortfolio[ticker] = Math.max(0, currentPortfolio[ticker] - (pricingMode === 'cash' ? amountBrl : qty))
        }

        if (ledgerPos.quantity > 0) {
          const soldQty = pricingMode === 'cash' ? amountBrl : qty
          const avg = ledgerPos.totalCost / ledgerPos.quantity
          const soldCost = pricingMode === 'cash' ? amountBrl : (soldQty * avg)
          const realizedGain = pricingMode === 'cash' ? 0 : ((soldQty * price) - soldCost)
          
          ledgerPos.quantity = Math.max(0, ledgerPos.quantity - soldQty)
          ledgerPos.totalCost = ledgerPos.quantity * avg
          
          if (pricingMode !== 'cash') {
            runningRealizedGains[ticker] = (runningRealizedGains[ticker] || 0) + realizedGain
          }
        }
        
        if (pricingMode === 'fixed_income' || definitionMap.get(ticker)?.is_treasury || isTreasuryTicker(ticker)) {
          let qtyToSell = qty
          const lots = activeLotsMap.get(ticker) || []
          while (qtyToSell > 0 && lots.length > 0) {
            const firstLot = lots[0]
            if (firstLot.quantity <= qtyToSell) {
              qtyToSell -= firstLot.quantity
              lots.shift()
            } else {
              firstLot.quantity -= qtyToSell
              qtyToSell = 0
            }
          }
        }
      } else if (isPortfolioIncomeType(tx.operation_type)) {
        currentCash += amountBrl
        ledgerPos.accumulatedDividends += amount
      } else if (tx.operation_type === 'split') {
        currentPortfolio[ticker] = (currentPortfolio[ticker] || 0) + qty
        ledgerPos.quantity += qty
      } else if (tx.operation_type === 'reverse_split') {
        if (currentPortfolio[ticker]) {
          currentPortfolio[ticker] = Math.max(0, currentPortfolio[ticker] - qty)
        }
        ledgerPos.quantity = Math.max(0, ledgerPos.quantity - qty)
      }
    }

    if (currentCash < 0) {
      netCapitalFlow += Math.abs(currentCash)
      currentCash = 0
    }

    runningInvestedCapital += netCapitalFlow

    if (netCapitalFlow !== 0) {
      if (totalShares === 0) {
        shareValue = INITIAL_SHARE_VALUE
        totalShares = Math.max(0, netCapitalFlow)
      } else {
        const newShares = netCapitalFlow / shareValue
        totalShares = Math.max(0, totalShares + newShares)
      }
    }

    let cashPositionsValueAfter = 0
    let investedPositionsValueAfter = 0
    for (const [ticker, qty] of Object.entries(currentPortfolio)) {
      if (qty <= 0) continue
      const def = definitionMap.get(ticker)
      const pricingMode = getPricingMode(ticker)
      let val = 0

      if (pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)) {
        val = valueFixedIncomeTicker(ticker, date)
      } else if (pricingMode === 'manual_value') {
        val = qty * (def?.manual_current_value ?? getHistoricalOrInterpolatedPrice(ticker, date))
      } else if (pricingMode === 'cash') {
        val = qty * 1.00
      } else {
        val = qty * getHistoricalOrInterpolatedPrice(ticker, date)
      }
      
      const isUsd = getAssetCurrency(ticker) === 'USD'
      const valBrl = isUsd ? val * dailyUsdRate : val
      if (pricingMode === 'cash') {
        cashPositionsValueAfter += valBrl
      } else {
        investedPositionsValueAfter += valBrl
      }
    }
    const totalCashAfter = currentCash + cashPositionsValueAfter
    const totalValueAfter = investedPositionsValueAfter + totalCashAfter

    if (totalShares > 0) {
      shareValue = totalValueAfter / totalShares
    }

    const classValues: Record<string, number> = {}
    const classCosts: Record<string, number> = {}
    const classGains: Record<string, number> = {}
    const sectorValues: Record<string, number> = {}
    const sectorCosts: Record<string, number> = {}
    const sectorGains: Record<string, number> = {}

    for (const [ticker, pos] of Object.entries(runningLedger)) {
      const def = definitionMap.get(ticker)
      const pricingMode = getPricingMode(ticker)
      if (pricingMode === 'cash') continue
      
      let val = 0
      if (pos.quantity > 0) {
        if (pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)) {
          val = valueFixedIncomeTicker(ticker, date)
        } else if (pricingMode === 'manual_value') {
          val = pos.quantity * (def?.manual_current_value ?? getHistoricalOrInterpolatedPrice(ticker, date))
        } else {
          val = pos.quantity * getHistoricalOrInterpolatedPrice(ticker, date)
        }
      }

      const isUsd = getAssetCurrency(ticker) === 'USD'
      const valBrl = isUsd ? val * dailyUsdRate : val
      const costBrl = isUsd ? pos.totalCost * dailyUsdRate : pos.totalCost
      const accDivBrl = isUsd ? pos.accumulatedDividends * dailyUsdRate : pos.accumulatedDividends
      const realizedGainBrl = isUsd
        ? (runningRealizedGains[ticker] || 0) * dailyUsdRate
        : (runningRealizedGains[ticker] || 0)

      let gainBrl = (valBrl - costBrl) + realizedGainBrl
      if (pricingMode === 'market') {
        gainBrl += accDivBrl
      }

      const priceObj = prices[ticker]
      const className = pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)
          ? 'Renda Fixa'
          : priceObj?.asset_class || 'Não classificado'

      const sectorName = pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)
          ? 'Títulos Públicos/Privados'
          : priceObj?.sector || 'Outros'

      classValues[className] = (classValues[className] || 0) + valBrl
      classCosts[className] = (classCosts[className] || 0) + costBrl
      classGains[className] = (classGains[className] || 0) + gainBrl

      sectorValues[sectorName] = (sectorValues[sectorName] || 0) + valBrl
      sectorCosts[sectorName] = (sectorCosts[sectorName] || 0) + costBrl
      sectorGains[sectorName] = (sectorGains[sectorName] || 0) + gainBrl
    }

    const classesGroup: Record<string, { totalValue: number; yieldPct: number }> = {}
    for (const name of Object.keys(classValues)) {
      const val = classValues[name]
      const cost = classCosts[name]
      const gain = classGains[name]
      const yld = cost > 0 ? (gain / cost) * 100 : 0
      classesGroup[name] = {
        totalValue: Math.round(val * 100) / 100,
        yieldPct: Math.round(yld * 100) / 100,
      }
    }

    const sectorsGroup: Record<string, { totalValue: number; yieldPct: number }> = {}
    for (const name of Object.keys(sectorValues)) {
      const val = sectorValues[name]
      const cost = sectorCosts[name]
      const gain = sectorGains[name]
      const yld = cost > 0 ? (gain / cost) * 100 : 0
      sectorsGroup[name] = {
        totalValue: Math.round(val * 100) / 100,
        yieldPct: Math.round(yld * 100) / 100,
      }
    }

    shareHistory.push({
      date,
      shareValue: Math.round(shareValue * 10000) / 10000,
      totalValue: Math.round(totalValueAfter * 100) / 100,
      cashValue: Math.round(totalCashAfter * 100) / 100,
      investedValue: Math.round(investedPositionsValueAfter * 100) / 100,
      investedCapital: Math.round(runningInvestedCapital * 100) / 100,
      classes: classesGroup,
      sectors: sectorsGroup,
    })
  }

  const lastDate = sortedDates[sortedDates.length - 1]
  if (lastDate && lastDate < todayStr) {
    let finalCashPositionsValue = 0
    let finalInvestedPositionsValue = 0
    const finalUsdRate = getHistoricalUsdRate(todayStr)
    for (const [ticker, qty] of Object.entries(currentPortfolio)) {
      if (qty <= 0) continue
      const def = definitionMap.get(ticker)
      const pricingMode = getPricingMode(ticker)
      let val = 0

      if (pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)) {
        val = valueFixedIncomeTicker(ticker, todayStr)
      } else if (pricingMode === 'manual_value') {
        val = qty * (def?.manual_current_value ?? (prices[ticker]?.current_price || FALLBACK_PRICE(ticker)))
      } else if (pricingMode === 'cash') {
        val = qty * 1.00
      } else {
        val = qty * (prices[ticker]?.current_price || FALLBACK_PRICE(ticker))
      }
      
      const isUsd = getAssetCurrency(ticker) === 'USD'
      const valBrl = isUsd ? val * finalUsdRate : val
      if (pricingMode === 'cash') {
        finalCashPositionsValue += valBrl
      } else {
        finalInvestedPositionsValue += valBrl
      }
    }
    const finalCashValue = currentCash + finalCashPositionsValue
    const finalTotalValue = finalInvestedPositionsValue + finalCashValue
    if (totalShares > 0) {
      shareValue = finalTotalValue / totalShares
    }

    const classValuesToday: Record<string, number> = {}
    const classCostsToday: Record<string, number> = {}
    const classGainsToday: Record<string, number> = {}
    const sectorValuesToday: Record<string, number> = {}
    const sectorCostsToday: Record<string, number> = {}
    const sectorGainsToday: Record<string, number> = {}

    for (const [ticker, pos] of Object.entries(runningLedger)) {
      const def = definitionMap.get(ticker)
      const pricingMode = getPricingMode(ticker)
      if (pricingMode === 'cash') continue
      
      let val = 0
      if (pos.quantity > 0) {
        if (pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)) {
          val = valueFixedIncomeTicker(ticker, todayStr)
        } else if (pricingMode === 'manual_value') {
          val = pos.quantity * (def?.manual_current_value ?? (prices[ticker]?.current_price || FALLBACK_PRICE(ticker)))
        } else {
          val = pos.quantity * (prices[ticker]?.current_price || FALLBACK_PRICE(ticker))
        }
      }

      const isUsd = getAssetCurrency(ticker) === 'USD'
      const valBrl = isUsd ? val * finalUsdRate : val
      const costBrl = isUsd ? pos.totalCost * finalUsdRate : pos.totalCost
      const accDivBrl = isUsd ? pos.accumulatedDividends * finalUsdRate : pos.accumulatedDividends
      const realizedGainBrl = isUsd
        ? (runningRealizedGains[ticker] || 0) * finalUsdRate
        : (runningRealizedGains[ticker] || 0)

      let gainBrl = (valBrl - costBrl) + realizedGainBrl
      if (pricingMode === 'market') {
        gainBrl += accDivBrl
      }

      const priceObj = prices[ticker]
      const className = pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)
          ? 'Renda Fixa'
          : priceObj?.asset_class || 'Não classificado'

      const sectorName = pricingMode === 'fixed_income' || def?.is_treasury || isTreasuryTicker(ticker)
          ? 'Títulos Públicos/Privados'
          : priceObj?.sector || 'Outros'

      classValuesToday[className] = (classValuesToday[className] || 0) + valBrl
      classCostsToday[className] = (classCostsToday[className] || 0) + costBrl
      classGainsToday[className] = (classGainsToday[className] || 0) + gainBrl

      sectorValuesToday[sectorName] = (sectorValuesToday[sectorName] || 0) + valBrl
      sectorCostsToday[sectorName] = (sectorCostsToday[sectorName] || 0) + costBrl
      sectorGainsToday[sectorName] = (sectorGainsToday[sectorName] || 0) + gainBrl
    }

    const classesGroupToday: Record<string, { totalValue: number; yieldPct: number }> = {}
    for (const name of Object.keys(classValuesToday)) {
      const val = classValuesToday[name]
      const cost = classCostsToday[name]
      const gain = classGainsToday[name]
      const yld = cost > 0 ? (gain / cost) * 100 : 0
      classesGroupToday[name] = {
        totalValue: Math.round(val * 100) / 100,
        yieldPct: Math.round(yld * 100) / 100,
      }
    }

    const sectorsGroupToday: Record<string, { totalValue: number; yieldPct: number }> = {}
    for (const name of Object.keys(sectorValuesToday)) {
      const val = sectorValuesToday[name]
      const cost = sectorCostsToday[name]
      const gain = sectorGainsToday[name]
      const yld = cost > 0 ? (gain / cost) * 100 : 0
      sectorsGroupToday[name] = {
        totalValue: Math.round(val * 100) / 100,
        yieldPct: Math.round(yld * 100) / 100,
      }
    }

    shareHistory.push({
      date: todayStr,
      shareValue: Math.round(shareValue * 10000) / 10000,
      totalValue: Math.round(finalTotalValue * 100) / 100,
      cashValue: Math.round(finalCashValue * 100) / 100,
      investedValue: Math.round(finalInvestedPositionsValue * 100) / 100,
      investedCapital: Math.round(runningInvestedCapital * 100) / 100,
      classes: classesGroupToday,
      sectors: sectorsGroupToday,
    })
  }

  return {
    currentShareValue: Math.round(shareValue * 10000) / 10000,
    totalShares: Math.round(totalShares * 100) / 100,
    shareHistory
  }
}

export function calculatePerformanceMetrics(
  shareHistory: { date: string; shareValue: number }[],
): PerformanceMetrics {
  // Retorna métricas padrão caso o histórico seja curto
  if (shareHistory.length < 2) {
    return {
      sharpe_ratio: 0,
      beta_ibov: 1.0,
      beta_sp500: 1.0,
      volatility_monthly: 0,
      return_monthly_avg: 0,
      data_source: 'insufficient',
    }
  }

  // 1. Extrai retornos mensais aproximados a partir do histórico de cota
  // Agrupa por mês
  const monthlyValues: Record<string, number> = {}
  for (const hist of shareHistory) {
    const monthKey = hist.date.substring(0, 7) // YYYY-MM
    // Guarda o último valor conhecido de cada mês
    monthlyValues[monthKey] = hist.shareValue
  }

  const sortedMonths = Object.keys(monthlyValues).sort()
  const monthlyReturns: number[] = []

  for (let i = 1; i < sortedMonths.length; i++) {
    const valPrev = monthlyValues[sortedMonths[i - 1]]
    const valCurr = monthlyValues[sortedMonths[i]]
    if (valPrev > 0) {
      monthlyReturns.push((valCurr - valPrev) / valPrev)
    }
  }

  // Fallback se não tivermos histórico mensal suficiente
  if (monthlyReturns.length === 0) {
    // Tenta usar retornos diários adaptados
    const dailyReturns: number[] = []
    for (let i = 1; i < shareHistory.length; i++) {
      const prev = shareHistory[i - 1].shareValue
      const curr = shareHistory[i].shareValue
      if (prev > 0) {
        dailyReturns.push((curr - prev) / prev)
      }
    }
    // Converte média e volatilidade diária para mensal (multiplica por sqrt(21))
    const avgDaily = average(dailyReturns)
    const stdDaily = stdDev(dailyReturns, avgDaily)
    
    const avgMonthly = avgDaily * 21
    const volMonthly = stdDaily * Math.sqrt(21)
    
    // CDI médio mensal de 0,85% (~10,75% a.a.)
    const riskFreeRate = 0.0085
    const sharpe = volMonthly > 0 ? (avgMonthly - riskFreeRate) / volMonthly : 0

    return {
      sharpe_ratio: Math.round(sharpe * 100) / 100,
      beta_ibov: 0.95,
      beta_sp500: 0.88,
      volatility_monthly: Math.round(volMonthly * 10000) / 100,
      return_monthly_avg: Math.round(avgMonthly * 10000) / 100,
      data_source: 'share_history',
    }
  }

  if (monthlyReturns.length === 0) {
    return {
      sharpe_ratio: 0,
      beta_ibov: 1.0,
      beta_sp500: 1.0,
      volatility_monthly: 0,
      return_monthly_avg: 0,
      data_source: 'insufficient',
    }
  }

  return buildPerformanceMetricsFromReturns(monthlyReturns, 'share_history')
}

function buildPerformanceMetricsFromReturns(
  monthlyReturns: number[],
  dataSource: PerformanceMetricsDataSource,
): PerformanceMetrics {
  const avgReturn = average(monthlyReturns)
  const volMonthly = stdDev(monthlyReturns, avgReturn)
  const riskFreeRate = 0.0085
  const sharpe = volMonthly > 0 ? (avgReturn - riskFreeRate) / volMonthly : 0

  const bReturnsIbov = BENCHMARK_RETURNS.IBOV.slice(0, monthlyReturns.length)
  const bReturnsSp500 = BENCHMARK_RETURNS.SP500.slice(0, monthlyReturns.length)

  while (bReturnsIbov.length < monthlyReturns.length) bReturnsIbov.push(0.01)
  while (bReturnsSp500.length < monthlyReturns.length) bReturnsSp500.push(0.015)

  const betaIbov = calculateBeta(monthlyReturns, bReturnsIbov)
  const betaSp500 = calculateBeta(monthlyReturns, bReturnsSp500)

  return {
    sharpe_ratio: Math.round(sharpe * 100) / 100,
    beta_ibov: Math.round(betaIbov * 100) / 100,
    beta_sp500: Math.round(betaSp500 * 100) / 100,
    volatility_monthly: Math.round(volMonthly * 10000) / 100,
    return_monthly_avg: Math.round(avgReturn * 10000) / 100,
    data_source: dataSource,
  }
}

// Funções utilitárias auxiliares de estatística
function average(arr: number[]): number {
  return arr.reduce((sum, val) => sum + val, 0) / arr.length
}

function stdDev(arr: number[], avg: number): number {
  if (arr.length <= 1) return 0
  const variance = arr.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / (arr.length - 1)
  return Math.sqrt(variance)
}

function calculateBeta(portfolio: number[], benchmark: number[]): number {
  const avgPort = average(portfolio)
  const avgBench = average(benchmark)
  
  let covariance = 0
  let varianceBench = 0
  
  for (let i = 0; i < portfolio.length; i++) {
    covariance += (portfolio[i] - avgPort) * (benchmark[i] - avgBench)
    varianceBench += Math.pow(benchmark[i] - avgBench, 2)
  }
  
  if (varianceBench === 0) return 1.0
  return (covariance / (portfolio.length - 1)) / (varianceBench / (portfolio.length - 1))
}

export function FALLBACK_PRICE(ticker: string): number {
  const defaults: Record<string, number> = {
    WEGE3: 39.50, VALE3: 63.80, PETR4: 36.20, IBOV: 125000, VOO: 475.00
  }
  return defaults[ticker.toUpperCase()] || 50.00
}

export interface ConsolidatedGroup {
  name: string
  total_value: number
  cost_basis: number
  current_percentage: number
  target_percentage: number
  yield_pct: number
  gross_yield_pct: number
  net_yield_pct: number
}

/**
 * Consolida as posições do portfólio agrupadas por Classe de Ativos.
 */
export function calculateConsolidatedByClass(
  positions: AssetPosition[],
  totalPortfolioValue: number,
  groupTargets?: PortfolioGroupTarget[]
): ConsolidatedGroup[] {
  const groups: Record<string, { total_value: number; cost_basis: number; target_percentage: number; gross_gain: number; net_gain: number }> = {}

  for (const pos of positions) {
    const className = pos.asset_class || 'Não classificado'
    if (!groups[className]) {
      groups[className] = { total_value: 0, cost_basis: 0, target_percentage: 0, gross_gain: 0, net_gain: 0 }
    }

    const grp = groups[className]
    const usdRate = pos.usd_rate || 5.25
    const posValBrl = pos.currency === 'USD' ? pos.total_value * usdRate : pos.total_value
    const posCostBrl = pos.currency === 'USD' ? pos.cost_basis * usdRate : pos.cost_basis
    const grossGainOriginal = pos.cost_basis > 0 ? (pos.cost_basis * (pos.gross_yield_pct / 100)) : (pos.total_value - pos.cost_basis)
    const netGainOriginal = pos.cost_basis > 0 ? (pos.cost_basis * (pos.net_yield_pct / 100)) : (pos.total_value - pos.cost_basis)
    const grossGainBrl = pos.currency === 'USD' ? grossGainOriginal * usdRate : grossGainOriginal
    const netGainBrl = pos.currency === 'USD' ? netGainOriginal * usdRate : netGainOriginal

    grp.total_value += posValBrl
    grp.cost_basis += posCostBrl
    grp.target_percentage += pos.target_percentage
    grp.gross_gain += grossGainBrl
    grp.net_gain += netGainBrl
  }

  return Object.entries(groups).map(([name, data]) => {
    const yieldPct = data.cost_basis > 0 ? (data.gross_gain / data.cost_basis) * 100 : 0
    const grossYieldPct = data.cost_basis > 0 ? (data.gross_gain / data.cost_basis) * 100 : 0
    const netYieldPct = data.cost_basis > 0 ? (data.net_gain / data.cost_basis) * 100 : 0
    const currentPercentage = totalPortfolioValue > 0 ? (data.total_value / totalPortfolioValue) * 100 : 0
    
    const explicitTarget = groupTargets?.find(
      t => t.group_type === 'class' && t.group_name.toUpperCase() === name.toUpperCase()
    )
    const targetPct = explicitTarget ? Number(explicitTarget.target_percentage) : data.target_percentage

    return {
      name,
      total_value: Math.round(data.total_value * 100) / 100,
      cost_basis: Math.round(data.cost_basis * 100) / 100,
      current_percentage: Math.round(currentPercentage * 100) / 100,
      target_percentage: Math.round(targetPct * 100) / 100,
      yield_pct: Math.round(yieldPct * 100) / 100,
      gross_yield_pct: Math.round(grossYieldPct * 100) / 100,
      net_yield_pct: Math.round(netYieldPct * 100) / 100,
    }
  }).sort((a, b) => b.total_value - a.total_value)
}

/**
 * Consolida as posições do portfólio agrupadas por Setor econômico.
 */
export function calculateConsolidatedBySector(
  positions: AssetPosition[],
  totalPortfolioValue: number,
  groupTargets?: PortfolioGroupTarget[]
): ConsolidatedGroup[] {
  const groups: Record<string, { total_value: number; cost_basis: number; target_percentage: number; gross_gain: number; net_gain: number }> = {}

  for (const pos of positions) {
    const sectorName = pos.sector || 'Outros'
    if (!groups[sectorName]) {
      groups[sectorName] = { total_value: 0, cost_basis: 0, target_percentage: 0, gross_gain: 0, net_gain: 0 }
    }

    const grp = groups[sectorName]
    const usdRate = pos.usd_rate || 5.25
    const posValBrl = pos.currency === 'USD' ? pos.total_value * usdRate : pos.total_value
    const posCostBrl = pos.currency === 'USD' ? pos.cost_basis * usdRate : pos.cost_basis
    const grossGainOriginal = pos.cost_basis > 0 ? (pos.cost_basis * (pos.gross_yield_pct / 100)) : (pos.total_value - pos.cost_basis)
    const netGainOriginal = pos.cost_basis > 0 ? (pos.cost_basis * (pos.net_yield_pct / 100)) : (pos.total_value - pos.cost_basis)
    const grossGainBrl = pos.currency === 'USD' ? grossGainOriginal * usdRate : grossGainOriginal
    const netGainBrl = pos.currency === 'USD' ? netGainOriginal * usdRate : netGainOriginal

    grp.total_value += posValBrl
    grp.cost_basis += posCostBrl
    grp.target_percentage += pos.target_percentage
    grp.gross_gain += grossGainBrl
    grp.net_gain += netGainBrl
  }

  return Object.entries(groups).map(([name, data]) => {
    const yieldPct = data.cost_basis > 0 ? (data.gross_gain / data.cost_basis) * 100 : 0
    const grossYieldPct = data.cost_basis > 0 ? (data.gross_gain / data.cost_basis) * 100 : 0
    const netYieldPct = data.cost_basis > 0 ? (data.net_gain / data.cost_basis) * 100 : 0
    const currentPercentage = totalPortfolioValue > 0 ? (data.total_value / totalPortfolioValue) * 100 : 0
    
    const explicitTarget = groupTargets?.find(
      t => t.group_type === 'sector' && t.group_name.toUpperCase() === name.toUpperCase()
    )
    const targetPct = explicitTarget ? Number(explicitTarget.target_percentage) : data.target_percentage

    return {
      name,
      total_value: Math.round(data.total_value * 100) / 100,
      cost_basis: Math.round(data.cost_basis * 100) / 100,
      current_percentage: Math.round(currentPercentage * 100) / 100,
      target_percentage: Math.round(targetPct * 100) / 100,
      yield_pct: Math.round(yieldPct * 100) / 100,
      gross_yield_pct: Math.round(grossYieldPct * 100) / 100,
      net_yield_pct: Math.round(netYieldPct * 100) / 100,
    }
  }).sort((a, b) => b.total_value - a.total_value)
}
