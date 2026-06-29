import { sortTransactionsStably } from './portfolioOperations'
import { calculateLotBasedFixedIncomeValue } from './fixedIncomeCurve'
import { isCashTicker } from './assetClassifier'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'

export interface DailyShareRow {
  portfolio_id: string
  rate_date: string
  share_value: number
  gross_pl: number
  net_pl: number
  total_shares: number
  cash_value: number
  invested_cost: number
}

export interface PeriodSnapshotRow {
  portfolio_id: string
  period_type: 'month'
  period_key: string
  cota_abertura: number
  cota_fechamento: number
  somatorio_aportes: number
  somatorio_resgates: number
  dividendos_recebidos: number
  drawdown_maximo: number
  period_return: number
}

export interface TwrEngineInput {
  portfolioId: string
  transactions: PortfolioTransaction[]
  definitions: PortfolioAssetDefinition[]
  priceMap: Record<string, Record<string, number>>
  pricesToday: Record<string, number>
  indexRates: Record<string, Record<string, number>>
  vnaMap?: Record<string, number>
  startDate: string
  endDate: string
}

export interface TwrEngineResult {
  dailyRows: DailyShareRow[]
  periodSnapshots: PeriodSnapshotRow[]
  totalShares: number
  lastShareValue: number
  cumulativeExternalContribution: number
}

/** Itera datas inclusive usando componentes locais (evita drift de fuso com toISOString). */
export function iterateDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const [sy, sm, sd] = startDate.split('-').map(Number)
  const [ey, em, ed] = endDate.split('-').map(Number)
  const endTime = new Date(ey, em - 1, ed).getTime()
  const cursor = new Date(sy, sm - 1, sd)

  while (cursor.getTime() <= endTime) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

export function adjustTransactionsForSplits(txs: PortfolioTransaction[]): PortfolioTransaction[] {
  const txByTicker: Record<string, PortfolioTransaction[]> = {}
  for (const tx of txs) {
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) txByTicker[ticker] = []
    txByTicker[ticker].push(tx)
  }

  const adjustedAll: PortfolioTransaction[] = []

  for (const ticker of Object.keys(txByTicker)) {
    const sorted = sortTransactionsStably(txByTicker[ticker])
    const hasSplits = sorted.some(tx => tx.operation_type === 'split' || tx.operation_type === 'reverse_split')

    if (!hasSplits) {
      adjustedAll.push(...sorted)
      continue
    }

    let qtyMultiplier = 1.0
    const adjusted: PortfolioTransaction[] = []
    const originalQuantities: number[] = []
    let currentQty = 0

    for (const tx of sorted) {
      originalQuantities.push(currentQty)
      const q = Number(tx.quantity)
      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        currentQty += q
      } else if (tx.operation_type === 'sell') {
        currentQty = Math.max(0, currentQty - q)
      } else if (tx.operation_type === 'split') {
        currentQty += q
      } else if (tx.operation_type === 'reverse_split') {
        currentQty = Math.max(0, currentQty - q)
      }
    }

    for (let i = sorted.length - 1; i >= 0; i--) {
      const tx = sorted[i]
      const type = tx.operation_type
      const q = Number(tx.quantity)
      const p = Number(tx.price)

      if (type === 'split') {
        const qtyBefore = originalQuantities[i]
        if (qtyBefore > 0) {
          const ratio = (qtyBefore + q) / qtyBefore
          qtyMultiplier *= ratio
        }
        continue
      }

      if (type === 'reverse_split') {
        const qtyBefore = originalQuantities[i]
        if (qtyBefore > 0) {
          const ratio = Math.max(0, qtyBefore - q) / qtyBefore
          qtyMultiplier *= ratio
        }
        continue
      }

      adjusted.unshift({
        ...tx,
        quantity: q * qtyMultiplier,
        price: qtyMultiplier > 0 ? p / qtyMultiplier : p
      })
    }

    adjustedAll.push(...adjusted)
  }

  return sortTransactionsStably(adjustedAll)
}

export function calculateSnapshotValuation(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[],
  priceMap: Record<string, Record<string, number>>,
  pricesToday: Record<string, number>,
  indexRates: Record<string, Record<string, number>>,
  vnaMap: Record<string, number>,
  asOfDate: string
) {
  const txByTicker: Record<string, PortfolioTransaction[]> = {}
  for (const tx of transactions) {
    if (tx.date > asOfDate) continue
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) txByTicker[ticker] = []
    txByTicker[ticker].push(tx)
  }

  const defByTicker = Object.fromEntries(
    definitions.map((d) => [d.ticker.trim().toUpperCase(), d])
  )

  const cashTickers = new Set([
    ...['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'],
    ...definitions.filter(d => d.pricing_mode === 'cash').map(d => d.ticker.toUpperCase().trim())
  ])

  const tickers = new Set([
    ...Object.keys(txByTicker),
    ...Object.keys(defByTicker)
  ])

  let investedValue = 0
  let cashValue = 0
  let investedCostBasis = 0

  for (const ticker of tickers) {
    const rawTxs = sortTransactionsStably(txByTicker[ticker] ?? [])
    const txs = adjustTransactionsForSplits(rawTxs)
    const definition = defByTicker[ticker]

    let quantity = 0
    let totalCost = 0
    const isCash = cashTickers.has(ticker)

    for (const tx of txs) {
      const q = Number(tx.quantity)
      const p = Number(tx.price)

      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        if (isCash) {
          totalCost += q * p
          quantity = totalCost
        } else {
          quantity += q
          totalCost += q * p
        }
      } else if (tx.operation_type === 'sell') {
        if (isCash) {
          totalCost = Math.max(0, totalCost - q * p)
          quantity = totalCost
        } else if (quantity > 0) {
          const pm = totalCost / quantity
          quantity = Math.max(0, quantity - q)
          totalCost = quantity * pm
        }
      }
    }

    if (quantity <= 0 && totalCost <= 0) continue

    const pricingMode = isCash ? 'cash' : (definition?.pricing_mode ?? 'market')
    let totalValue = 0

    if (pricingMode === 'fixed_income') {
      const idx = definition?.indexer ?? 'none'
      const activeRates = indexRates[idx] ?? {}
      totalValue = calculateLotBasedFixedIncomeValue({
        transactions: txs,
        ticker,
        definition: definition!,
        asOfDate,
        indexRates: activeRates,
        vnaToday: idx === 'ipca' ? vnaMap[asOfDate] : undefined
      })
    } else if (pricingMode === 'manual_value') {
      totalValue = quantity > 0 ? (definition?.manual_current_value ?? totalCost) : 0
    } else if (pricingMode === 'cash') {
      totalValue = totalCost
    } else {
      const tickerPrices = priceMap[ticker]
      let dayPrice = 0

      if (tickerPrices && tickerPrices[asOfDate] !== undefined) {
        dayPrice = tickerPrices[asOfDate]
      } else if (tickerPrices) {
        const priceDates = Object.keys(tickerPrices).sort()
        let lastPrice = 0
        for (const pd of priceDates) {
          if (pd > asOfDate) break
          lastPrice = tickerPrices[pd]
        }
        dayPrice = lastPrice
      } else {
        dayPrice = pricesToday[ticker] ?? 0
      }

      totalValue = quantity * (dayPrice > 0 ? dayPrice : (quantity > 0 ? totalCost / quantity : 0))
    }

    if (pricingMode === 'cash') {
      cashValue += totalValue
    } else {
      investedValue += totalValue
      investedCostBasis += totalCost
    }
  }

  return {
    investedValue,
    cashValue,
    totalValue: investedValue + cashValue,
    investedCostBasis
  }
}

function computeDayCashFlow(
  dayTxs: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[],
  allTransactions: PortfolioTransaction[]
): number {
  let cashFlow = 0

  for (const tx of dayTxs) {
    const tickerUpper = tx.ticker.trim().toUpperCase()
    const isCash = isCashTicker(tickerUpper) ||
      definitions.some(d => d.ticker.trim().toUpperCase() === tickerUpper && d.pricing_mode === 'cash')

    if (isCash && tx.cash_offset_source_id) {
      const sourceTx = allTransactions.find(t => t.id === tx.cash_offset_source_id)
      if (sourceTx && ['dividend', 'jcp', 'fii_yield'].includes(sourceTx.operation_type)) {
        continue
      }
    }

    const q = Number(tx.quantity)
    const p = Number(tx.price)
    const type = tx.operation_type

    if (type === 'buy' || type === 'subscription') {
      cashFlow += q * p
    } else if (type === 'sell') {
      cashFlow -= q * p
    }
  }

  return cashFlow
}

export function computeDailyShareHistory(input: TwrEngineInput): TwrEngineResult {
  const {
    portfolioId,
    transactions: rawTransactions,
    definitions,
    priceMap,
    pricesToday,
    indexRates,
    vnaMap = {},
    startDate,
    endDate
  } = input

  const transactions = adjustTransactionsForSplits(sortTransactionsStably(rawTransactions))
  const dateRange = iterateDateRange(startDate, endDate)

  let totalShares = 0
  let lastShareValue = 1.0
  let cumulativeExternalContribution = 0

  const dailyRows: DailyShareRow[] = []
  const periodSnapshots: PeriodSnapshotRow[] = []    // Track cumulative cash flow per month for period snapshots
  let monthlyCashFlow = 0
  let monthlyDividends = 0
  let peakShareValue = 1.0
  let monthlyMaxDrawdown = 0

  for (const dateStr of dateRange) {
    const dayTxs = transactions.filter(t => t.date === dateStr)
    const prevTxs = transactions.filter(t => t.date < dateStr)

    const valuationPrev = calculateSnapshotValuation(
      prevTxs,
      definitions,
      priceMap,
      pricesToday,
      indexRates,
      vnaMap,
      dateStr
    )

    if (totalShares > 0) {
      lastShareValue = valuationPrev.totalValue / totalShares
    } else if (valuationPrev.totalValue > 0) {
      totalShares = valuationPrev.totalValue
      lastShareValue = 1.0
    }

    const cashFlow = computeDayCashFlow(dayTxs, definitions, transactions)

    if (cashFlow !== 0) {
      const cota = lastShareValue > 0 ? lastShareValue : 1.0
      const sharesDiff = cashFlow / cota
      totalShares = Math.max(0, totalShares + sharesDiff)
    }

    cumulativeExternalContribution += cashFlow
    monthlyCashFlow += cashFlow

    let dayDividends = 0
    for (const tx of dayTxs) {
      if (['dividend', 'jcp', 'fii_yield'].includes(tx.operation_type)) {
        dayDividends += Number(tx.quantity) * Number(tx.price)
      }
    }
    monthlyDividends += dayDividends

    const dayValuation = calculateSnapshotValuation(
      transactions,
      definitions,
      priceMap,
      pricesToday,
      indexRates,
      vnaMap,
      dateStr
    )

    const grossPL = dayValuation.investedValue
    const netPL = grossPL - dayValuation.investedCostBasis

    let endShareValue = 1.0
    if (dayValuation.totalValue <= 0.01) {
      totalShares = 0
      endShareValue = 1.0
    } else if (totalShares > 0) {
      endShareValue = dayValuation.totalValue / totalShares
    } else {
      totalShares = dayValuation.totalValue
      endShareValue = 1.0
    }
    lastShareValue = endShareValue

    // Track drawdown: update peak and calculate current drawdown
    if (endShareValue > peakShareValue) {
      peakShareValue = endShareValue
    } else if (peakShareValue > 0) {
      const currentDrawdown = (peakShareValue - endShareValue) / peakShareValue
      if (currentDrawdown > monthlyMaxDrawdown) {
        monthlyMaxDrawdown = currentDrawdown
      }
    }

    // Arredonda para 2 casas decimais para evitar overflow NUMERIC(15,2) no banco
    const round2 = (v: number) => Math.round(v * 100) / 100
    dailyRows.push({
      portfolio_id: portfolioId,
      rate_date: dateStr,
      share_value: endShareValue,
      gross_pl: round2(grossPL),
      net_pl: round2(netPL),
      total_shares: totalShares,
      cash_value: round2(dayValuation.cashValue),
      invested_cost: round2(dayValuation.investedCostBasis)
    })

    const [y, m] = dateStr.split('-').map(Number)
    const nextDay = new Date(y, m - 1, Number(dateStr.split('-')[2]) + 1)
    const isLastDayOfMonth = nextDay.getMonth() !== (m - 1)

    if (isLastDayOfMonth) {
      const periodKey = `${y}-${String(m).padStart(2, '0')}`
      const startMonthDate = `${y}-${String(m).padStart(2, '0')}-01`
      
      // Abertura do mês = cota de fechamento do mês anterior (ou 1.0 se for o primeiro mês)
      const lastMonthRows = dailyRows.filter(row => row.rate_date < startMonthDate)
      const cotaAbertura = lastMonthRows.length > 0 
        ? Number(lastMonthRows[lastMonthRows.length - 1].share_value) 
        : 1.0
      const periodReturn = cotaAbertura > 0 ? (endShareValue / cotaAbertura) - 1 : 0

      periodSnapshots.push({
        portfolio_id: portfolioId,
        period_type: 'month',
        period_key: periodKey,
        cota_abertura: cotaAbertura,
        cota_fechamento: endShareValue,
        somatorio_aportes: monthlyCashFlow > 0 ? monthlyCashFlow : 0,
        somatorio_resgates: monthlyCashFlow < 0 ? Math.abs(monthlyCashFlow) : 0,
        dividendos_recebidos: monthlyDividends,
        drawdown_maximo: monthlyMaxDrawdown,
        period_return: periodReturn
      })

      // Reset peak and max drawdown for next month
      peakShareValue = endShareValue
      monthlyMaxDrawdown = 0

      // Reset monthly accumulators for next month
      monthlyCashFlow = 0
      monthlyDividends = 0
    }
  }

  return {
    dailyRows,
    periodSnapshots,
    totalShares,
    lastShareValue,
    cumulativeExternalContribution
  }
}

export function needsHistoricalBackfill(
  shareHistory: { rate_date: string }[],
  firstTransactionDate: string,
  todayStr: string
): boolean {
  if (shareHistory.length === 0) return true
  if (shareHistory.length === 1) return true

  const firstStored = shareHistory[0]?.rate_date
  if (firstStored && firstStored > firstTransactionDate) return true

  const expectedDays = iterateDateRange(firstTransactionDate, todayStr).length
  if (shareHistory.length < Math.max(2, Math.floor(expectedDays * 0.9))) return true

  return false
}
