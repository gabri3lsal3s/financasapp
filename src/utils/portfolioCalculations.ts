import type { PortfolioTransaction, PortfolioAssetDefinition, AssetPrice } from '@/types'
import { calculateFixedIncomeValue, calculateLotBasedFixedIncomeValue } from './fixedIncomeCurve'

export interface ValuedPosition {
  ticker: string
  quantity: number
  average_price: number
  current_price: number
  total_value: number
  cost_basis: number
  target_percentage: number
  current_percentage: number
  gap_financial: number
  gap_percentage: number
  asset_class: string
  sector: string
  pricing_mode: string
  is_b3_linked: boolean
  gross_yield_pct: number
  net_yield_pct: number
  accumulated_dividends: number
  currency: 'BRL' | 'USD'
  usd_rate: number
}

export function detectDefaultCurrency(ticker: string): 'BRL' | 'USD' {
  const t = ticker.trim().toUpperCase()
  if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT'].includes(t)) {
    return 'BRL'
  }
  // Se for padrão de ativo americano (geralmente 3 ou 4 letras puras, ex: AAPL, VOO)
  const isUsStock = /^[A-Z]{3,4}$/.test(t)
  const isB3 = /^[A-Z]{4}[0-9]{1,2}$/.test(t)
  if (isUsStock && !isB3 && !['CDI', 'SELIC', 'IPCA'].includes(t)) {
    return 'USD'
  }
  return 'BRL'
}

export function getAssetMetadata(ticker: string): { asset_class: string; sector: string } {
  const t = ticker.trim().toUpperCase()
  if (['BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT'].includes(t)) {
    return { asset_class: 'Criptoativos', sector: 'Tecnologia Blockchain' }
  }

  const isBrUnit = ['TAEE11', 'KLBN11', 'SANB11', 'BPAC11', 'ALUP11', 'RAPT11', 'SAPR11', 'ENGI11'].includes(t)
  const isFii = /^[A-Z]{4}11$/.test(t) && !isBrUnit && !['BOVA11', 'SMAL11', 'IVVB11'].includes(t)

  if (isFii) {
    return { asset_class: 'Fundos Imobiliários', sector: 'Imobiliário Diversificado' }
  }
  if (['BOVA11', 'SMAL11', 'IVVB11', 'VOO', 'SPY', 'QQQ', 'VT'].includes(t)) {
    return { asset_class: 'ETFs', sector: 'Índices de Mercado' }
  }
  if (/^[A-Z]{4}34$/.test(t)) {
    return { asset_class: 'Ações Internacionais', sector: 'BDRs / Mercado Global' }
  }
  if (/^[A-Z]{3,4}$/.test(t) && !['CDI', 'SELIC', 'IPCA'].includes(t)) {
    return { asset_class: 'Ações Internacionais', sector: 'EUA / Global Diversificado' }
  }
  if (/^[A-Z]{4}[345678]$/.test(t) || isBrUnit) {
    return { asset_class: 'Ações Nacionais', sector: 'Ações Brasil' }
  }
  if (['CDI', 'SELIC', 'IPCA', 'TESOURO', 'LCI', 'LCA', 'CDB', 'DEBENTURE'].some(rf => t.includes(rf))) {
    return { asset_class: 'Renda Fixa', sector: 'Títulos Públicos/Privados' }
  }
  return { asset_class: 'Outros', sector: 'Indefinido' }
}

export function computePositions(
  transactions: PortfolioTransaction[],
  definitions: PortfolioAssetDefinition[],
  prices: Record<string, AssetPrice>,
  cashBalance: number,
  indexRates: Record<string, Record<string, number>> = {},
  vnaMap: Record<string, number> = {},
  asOfDate: string = new Date().toISOString().slice(0, 10)
): {
  positions: ValuedPosition[]
  investedValue: number
  cashValue: number
  totalValue: number
  investedCostBasis: number
} {
  const usdPriceObj = prices['USDBRL=X']
  const usdRate = usdPriceObj?.current_price && usdPriceObj.current_price > 0
    ? Number(usdPriceObj.current_price)
    : 5.25

  // Agrupar transações por ticker
  const txByTicker: Record<string, PortfolioTransaction[]> = {}
  for (const tx of transactions) {
    const ticker = tx.ticker.trim().toUpperCase()
    if (!txByTicker[ticker]) {
      txByTicker[ticker] = []
    }
    txByTicker[ticker].push(tx)
  }

  // Mapear definições
  const defByTicker = Object.fromEntries(
    definitions.map((d) => [d.ticker.trim().toUpperCase(), d])
  )

  const tickers = new Set([
    ...Object.keys(txByTicker),
    ...Object.keys(defByTicker)
  ])

  const positions: Omit<ValuedPosition, 'current_percentage' | 'gap_financial' | 'gap_percentage'>[] = []
  let investedValue = 0
  let cashFromPositions = 0
  let investedCostBasis = 0

  for (const ticker of tickers) {
    if (['SALDO_INV', 'CAIXA', 'SALDO EM CAIXA', 'SALDO_EM_CAIXA'].includes(ticker)) {
      continue
    }

    const txs = [...(txByTicker[ticker] ?? [])].sort((a, b) => a.date.localeCompare(b.date))
    const definition = defByTicker[ticker]

    let quantity = 0
    let totalCost = 0
    let accumulatedDividends = 0

    // Processar transações
    for (const tx of txs) {
      if (tx.date > asOfDate) continue

      const type = tx.operation_type
      const q = Number(tx.quantity)
      const p = Number(tx.price)

      if (type === 'buy' || type === 'subscription') {
        quantity += q
        totalCost += q * p
      } else if (type === 'sell') {
        if (quantity > 0) {
          const pm = totalCost / quantity
          quantity = Math.max(0, quantity - q)
          totalCost = quantity * pm
        }
      } else if (type === 'split') {
        quantity += q // split B3 é cotas adicionais
      } else if (type === 'reverse_split') {
        quantity = Math.max(0, quantity - q) // grupamento cancela cotas
      } else if (['dividend', 'jcp', 'fii_yield'].includes(type)) {
        accumulatedDividends += q * p
      }
    }

    if (quantity <= 0 && totalCost <= 0 && accumulatedDividends <= 0) {
      continue
    }

    // Identificar classificação
    const meta = getAssetMetadata(ticker)
    const assetClass = definition?.pricing_mode === 'cash' ? 'Saldo em Caixa'
      : (definition?.pricing_mode === 'fixed_income' || definition?.is_treasury) ? 'Renda Fixa'
      : prices[ticker]?.asset_class || meta.asset_class

    const sector = definition?.pricing_mode === 'cash' ? 'Caixa'
      : (definition?.pricing_mode === 'fixed_income' || definition?.is_treasury) ? 'Títulos Públicos/Privados'
      : prices[ticker]?.sector || meta.sector

    const currency = definition?.currency || detectDefaultCurrency(ticker)

    // Determinar preço atual e valoração
    let currentPrice = 0
    let totalValue = 0

    const pricingMode = definition?.pricing_mode ?? 'market'

    if (pricingMode === 'fixed_income') {
      const idx = definition?.indexer ?? 'none'
      const activeRates = indexRates[idx] ?? {}
      if (definition?.is_treasury) {
        totalValue = calculateLotBasedFixedIncomeValue({
          transactions: txs,
          ticker,
          definition,
          asOfDate,
          indexRates: activeRates,
          vnaToday: idx === 'ipca' ? vnaMap[asOfDate] : undefined
        })
      } else {
        totalValue = calculateFixedIncomeValue({
          principal: totalCost,
          contractRateAnnual: definition?.contract_rate ?? 0,
          indexer: idx,
          indexerPercent: definition?.indexer_percent ?? 100,
          applicationDate: definition?.application_date ?? (txs[0]?.date || asOfDate),
          asOfDate,
          indexRates: activeRates
        })
      }
      currentPrice = quantity > 0 ? totalValue / quantity : 0
    } else if (pricingMode === 'manual_value') {
      totalValue = quantity > 0 ? (definition?.manual_current_value ?? totalCost) : 0
      currentPrice = quantity > 0 ? totalValue / quantity : 0
    } else if (pricingMode === 'cash') {
      totalValue = totalCost
      currentPrice = 1.0
      quantity = totalCost
    } else {
      currentPrice = prices[ticker]?.current_price ? Number(prices[ticker].current_price) : 0
      totalValue = quantity * currentPrice
    }

    const costBasis = totalCost
    const grossYield = totalValue - costBasis + accumulatedDividends
    const grossYieldPct = costBasis > 0 ? (grossYield / costBasis) * 100 : 0

    // Provisionar IR básico
    let netYield = grossYield
    if (grossYield > 0) {
      if (pricingMode === 'fixed_income') {
        // Regressiva
        const appDateStr = definition?.application_date ?? (txs[0]?.date || asOfDate)
        const days = (new Date(asOfDate).getTime() - new Date(appDateStr).getTime()) / (1000 * 60 * 60 * 24)
        let irRate = 0.15
        if (days <= 180) irRate = 0.225
        else if (days <= 360) irRate = 0.20
        else if (days <= 720) irRate = 0.175
        netYield = grossYield * (1 - irRate)
      } else if (pricingMode === 'market' && assetClass === 'Ações Nacionais' && grossYield > 20000) {
        // Isento até 20k no mês. Caso passe, provisão de 15%
        netYield = grossYield * 0.85
      } else if (pricingMode === 'market' && assetClass === 'Fundos Imobiliários') {
        // FIIs alíquota de 20% sobre ganho
        netYield = grossYield * 0.80
      }
    }
    const netYieldPct = costBasis > 0 ? (netYield / costBasis) * 100 : 0

    const valueBrl = currency === 'USD' ? totalValue * usdRate : totalValue
    const costBasisBrl = currency === 'USD' ? costBasis * usdRate : costBasis

    if (pricingMode === 'cash') {
      cashFromPositions += valueBrl
    } else {
      investedValue += valueBrl
      investedCostBasis += costBasisBrl
    }

    positions.push({
      ticker,
      quantity,
      average_price: quantity > 0 ? totalCost / quantity : 0,
      current_price: currentPrice,
      total_value: totalValue,
      cost_basis: costBasis,
      target_percentage: 0, // calculado depois
      asset_class: assetClass,
      sector,
      pricing_mode: pricingMode,
      is_b3_linked: definition?.is_b3_linked ?? false,
      gross_yield_pct: grossYieldPct,
      net_yield_pct: netYieldPct,
      accumulated_dividends: accumulatedDividends,
      currency,
      usd_rate: usdRate
    })
  }

  const finalCash = cashBalance
  const totalValue = investedValue + finalCash

  return {
    positions: positions.map(pos => {
      const valBrl = pos.currency === 'USD' ? pos.total_value * usdRate : pos.total_value
      const currentPct = totalValue > 0 ? (valBrl / totalValue) * 100 : 0
      return {
        ...pos,
        current_percentage: currentPct,
        target_percentage: 0,
        gap_financial: 0,
        gap_percentage: 0
      } as ValuedPosition
    }),
    investedValue,
    cashValue: finalCash,
    totalValue,
    investedCostBasis
  }
}
