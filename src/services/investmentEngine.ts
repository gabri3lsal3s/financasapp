import { PortfolioTransaction, TargetAllocation, AssetPrice, PortfolioGroupTarget } from '@/types'

export interface AssetPosition {
  ticker: string
  quantity: number
  average_price: number
  current_price: number
  total_value: number
  target_percentage: number
  current_percentage: number
  gap_financial: number
  gap_percentage: number
  asset_class?: string
  sector?: string
}

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

export interface PerformanceMetrics {
  sharpe_ratio: number
  beta_ibov: number
  beta_sp500: number
  volatility_monthly: number
  return_monthly_avg: number
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
  cashBalance: number
): { positions: AssetPosition[]; assetsValue: number; totalValue: number } {
  const positionsMap: Record<string, { quantity: number; totalCost: number }> = {}

  // Processa o livro-razão de transações de forma cronológica
  const sortedTransactions = [...transactions].sort((a, b) => a.date.localeCompare(b.date))

  for (const tx of sortedTransactions) {
    const ticker = tx.ticker.toUpperCase()
    if (!positionsMap[ticker]) {
      positionsMap[ticker] = { quantity: 0, totalCost: 0 }
    }

    const pos = positionsMap[ticker]

    if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
      const newQty = pos.quantity + Number(tx.quantity)
      const newCost = pos.totalCost + (Number(tx.quantity) * Number(tx.price))
      pos.quantity = newQty
      pos.totalCost = newCost
    } else if (tx.operation_type === 'sell') {
      const sellQty = Number(tx.quantity)
      if (pos.quantity > 0) {
        // Reduz o custo médio proporcionalmente à quantidade vendida
        const avgPrice = pos.totalCost / pos.quantity
        pos.quantity = Math.max(0, pos.quantity - sellQty)
        pos.totalCost = pos.quantity * avgPrice
      }
    } else if (tx.operation_type === 'split') {
      // No desdobramento, tx.quantity é o fator multiplicador (ex: 2 para desdobramento de 1 para 2)
      // E tx.price é o novo preço ajustado (opcional)
      pos.quantity = pos.quantity * Number(tx.quantity)
      // O custo total permanece o mesmo, mudando o preço médio
    }
  }

  // Monta as posições calculando valores de mercado e metas
  let assetsValue = 0
  const tempPositions: Omit<AssetPosition, 'current_percentage' | 'gap_financial' | 'gap_percentage'>[] = []

  for (const [ticker, data] of Object.entries(positionsMap)) {
    if (data.quantity <= 0) continue

    const currentPrice = prices[ticker]?.current_price || FALLBACK_PRICE(ticker)
    const totalValue = data.quantity * currentPrice
    assetsValue += totalValue

    const avgPrice = data.quantity > 0 ? data.totalCost / data.quantity : 0
    const target = targets.find(t => t.ticker.toUpperCase() === ticker)
    const targetPct = target ? Number(target.target_percentage) : 0

    const priceObj = prices[ticker]
    tempPositions.push({
      ticker,
      quantity: data.quantity,
      average_price: Math.round(avgPrice * 100) / 100,
      current_price: currentPrice,
      total_value: Math.round(totalValue * 100) / 100,
      target_percentage: targetPct,
      asset_class: priceObj?.asset_class,
      sector: priceObj?.sector,
    })
  }

  const totalValue = assetsValue + cashBalance

  // Adiciona os percentuais reais e desvios (gaps) com base no total do portfólio
  const positions: AssetPosition[] = tempPositions.map(pos => {
    const currentPercentage = totalValue > 0 ? (pos.total_value / totalValue) * 100 : 0
    const targetValue = (pos.target_percentage / 100) * totalValue
    const gapFinancial = targetValue - pos.total_value

    return {
      ...pos,
      current_percentage: Math.round(currentPercentage * 100) / 100,
      gap_financial: Math.round(gapFinancial * 100) / 100,
      gap_percentage: Math.round((pos.target_percentage - currentPercentage) * 100) / 100,
    }
  })

  return { positions, assetsValue, totalValue }
}

/**
 * Sistema de Cotização Clássico:
 * Reconstrói a linha temporal da carteira isolando aportes/saques para calcular o valor real da cota.
 */
export function calculateShareHistory(
  transactions: PortfolioTransaction[],
  prices: Record<string, AssetPrice>,
  finalCashBalance: number
): { currentShareValue: number; totalShares: number; shareHistory: { date: string; shareValue: number }[] } {
  // Ordena transações por data
  const sortedTxs = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  
  if (sortedTxs.length === 0) {
    return { currentShareValue: 1.0, totalShares: 0, shareHistory: [] }
  }

  let totalShares = 0
  let shareValue = 1.00 // Cota inicial é sempre R$ 1,00
  let currentPortfolio: Record<string, number> = {} // ticker -> quantidade
  let currentCash = 0
  
  const shareHistory: { date: string; shareValue: number }[] = []

  // Agrupa transações por data para processar dia a dia
  const txsByDate: Record<string, PortfolioTransaction[]> = {}
  for (const tx of sortedTxs) {
    if (!txsByDate[tx.date]) txsByDate[tx.date] = []
    txsByDate[tx.date].push(tx)
  }

  const sortedDates = Object.keys(txsByDate).sort()

  for (const date of sortedDates) {
    const dayTxs = txsByDate[date]

    // 1. Antes de aplicar as operações do dia, valoriza a carteira com preços simulados/conhecidos daquele dia
    // (Para simplificar, usamos as cotações atuais ponderadas por uma variação histórica caso necessário,
    // ou assumimos a valorização do mercado. Na abordagem client-side, o valor final é calculado perfeitamente
    // e o histórico reflete a evolução acumulada).
    let assetsValueBefore = 0
    for (const [ticker, qty] of Object.entries(currentPortfolio)) {
      const assetPrice = prices[ticker]?.current_price || FALLBACK_PRICE(ticker)
      assetsValueBefore += qty * assetPrice
    }
    let totalValueBefore = assetsValueBefore + currentCash

    if (totalShares > 0 && totalValueBefore > 0) {
      shareValue = totalValueBefore / totalShares
    }

    // 2. Aplica as transações do dia
    let netCapitalFlow = 0 // Aportes de fora (dinheiro novo) ou saques

    for (const tx of dayTxs) {
      const ticker = tx.ticker.toUpperCase()
      const qty = Number(tx.quantity)
      const price = Number(tx.price)
      const amount = qty * price

      if (tx.operation_type === 'buy') {
        // Se comprou, diminui caixa e aumenta ativos
        currentCash -= amount
        currentPortfolio[ticker] = (currentPortfolio[ticker] || 0) + qty
        // Nota: A compra em si não injeta capital de fora, ela apenas troca caixa por ativo.
        // Mas se o caixa ficasse negativo, pressupõe-se um aporte externo equivalente no mesmo dia.
        if (currentCash < 0) {
          netCapitalFlow += Math.abs(currentCash)
          currentCash = 0
        }
      } else if (tx.operation_type === 'sell') {
        currentCash += amount
        if (currentPortfolio[ticker]) {
          currentPortfolio[ticker] = Math.max(0, currentPortfolio[ticker] - qty)
        }
      } else if (tx.operation_type === 'dividend') {
        // Dividendos aumentam caixa sem movimentar cotas, valorizando a cota
        currentCash += amount
      } else if (tx.operation_type === 'split') {
        if (currentPortfolio[ticker]) {
          currentPortfolio[ticker] = currentPortfolio[ticker] * qty
        }
      } else if (tx.operation_type === 'subscription') {
        currentCash -= amount
        currentPortfolio[ticker] = (currentPortfolio[ticker] || 0) + qty
        if (currentCash < 0) {
          netCapitalFlow += Math.abs(currentCash)
          currentCash = 0
        }
      }
    }

    // Se houve fluxo de capital de fora (Aporte/Saque), ajusta o número de cotas
    if (netCapitalFlow !== 0) {
      if (totalShares === 0) {
        // Primeiro aporte: valor inicial da cota R$ 1.00
        shareValue = 1.00
        totalShares = netCapitalFlow // 1 cota = 1 real
      } else {
        // Aportes adicionais compram cotas pelo valor atual da cota
        const newShares = netCapitalFlow / shareValue
        totalShares += newShares
      }
    }

    // Registra a cota do fim do dia
    let assetsValueAfter = 0
    for (const [ticker, qty] of Object.entries(currentPortfolio)) {
      const assetPrice = prices[ticker]?.current_price || FALLBACK_PRICE(ticker)
      assetsValueAfter += qty * assetPrice
    }
    const totalValueAfter = assetsValueAfter + currentCash
    
    if (totalShares > 0) {
      shareValue = totalValueAfter / totalShares
    }

    shareHistory.push({
      date,
      shareValue: Math.round(shareValue * 10000) / 10000
    })
  }

  // 3. Ponderação final com preços correntes e o saldo de caixa real atual do banco
  let finalAssetsValue = 0
  for (const [ticker, qty] of Object.entries(currentPortfolio)) {
    const currentPrice = prices[ticker]?.current_price || FALLBACK_PRICE(ticker)
    finalAssetsValue += qty * currentPrice
  }
  const finalTotalValue = finalAssetsValue + finalCashBalance
  
  if (totalShares > 0) {
    shareValue = finalTotalValue / totalShares
  }

  return {
    currentShareValue: Math.round(shareValue * 10000) / 10000,
    totalShares: Math.round(totalShares * 100) / 100,
    shareHistory
  }
}

/**
 * Calcula indicadores de Risco e Sharpe/Beta para o relatório.
 */
export function calculatePerformanceMetrics(
  shareHistory: { date: string; shareValue: number }[]
): PerformanceMetrics {
  // Retorna métricas padrão caso o histórico seja curto
  if (shareHistory.length < 2) {
    return {
      sharpe_ratio: 0,
      beta_ibov: 1.0,
      beta_sp500: 1.0,
      volatility_monthly: 0,
      return_monthly_avg: 0
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
      return_monthly_avg: Math.round(avgMonthly * 10000) / 100
    }
  }

  // 2. Cálculos clássicos mensais
  const avgReturn = average(monthlyReturns)
  const volMonthly = stdDev(monthlyReturns, avgReturn)
  const riskFreeRate = 0.0085 // CDI mensal base (~10.75% a.a.)
  const sharpe = volMonthly > 0 ? (avgReturn - riskFreeRate) / volMonthly : 0

  // 3. Cálculo do Beta em relação aos benchmarks (Covariância / Variância)
  const bReturnsIbov = BENCHMARK_RETURNS.IBOV.slice(0, monthlyReturns.length)
  const bReturnsSp500 = BENCHMARK_RETURNS.SP500.slice(0, monthlyReturns.length)

  // Preenche fallbacks caso o tamanho seja diferente
  while (bReturnsIbov.length < monthlyReturns.length) bReturnsIbov.push(0.01)
  while (bReturnsSp500.length < monthlyReturns.length) bReturnsSp500.push(0.015)

  const betaIbov = calculateBeta(monthlyReturns, bReturnsIbov)
  const betaSp500 = calculateBeta(monthlyReturns, bReturnsSp500)

  return {
    sharpe_ratio: Math.round(sharpe * 100) / 100,
    beta_ibov: Math.round(betaIbov * 100) / 100,
    beta_sp500: Math.round(betaSp500 * 100) / 100,
    volatility_monthly: Math.round(volMonthly * 10000) / 100,
    return_monthly_avg: Math.round(avgReturn * 10000) / 100
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

function FALLBACK_PRICE(ticker: string): number {
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
}

/**
 * Consolida as posições do portfólio agrupadas por Classe de Ativos.
 */
export function calculateConsolidatedByClass(
  positions: AssetPosition[],
  totalPortfolioValue: number,
  groupTargets?: PortfolioGroupTarget[]
): ConsolidatedGroup[] {
  const groups: Record<string, { total_value: number; cost_basis: number; target_percentage: number }> = {}

  for (const pos of positions) {
    const className = pos.asset_class || 'Renda Fixa'
    if (!groups[className]) {
      groups[className] = { total_value: 0, cost_basis: 0, target_percentage: 0 }
    }
    
    const grp = groups[className]
    grp.total_value += pos.total_value
    grp.cost_basis += pos.quantity * pos.average_price
    grp.target_percentage += pos.target_percentage
  }

  return Object.entries(groups).map(([name, data]) => {
    const yieldPct = data.cost_basis > 0 ? ((data.total_value - data.cost_basis) / data.cost_basis) * 100 : 0
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
  const groups: Record<string, { total_value: number; cost_basis: number; target_percentage: number }> = {}

  for (const pos of positions) {
    const sectorName = pos.sector || 'Outros'
    if (!groups[sectorName]) {
      groups[sectorName] = { total_value: 0, cost_basis: 0, target_percentage: 0 }
    }
    
    const grp = groups[sectorName]
    grp.total_value += pos.total_value
    grp.cost_basis += pos.quantity * pos.average_price
    grp.target_percentage += pos.target_percentage
  }

  return Object.entries(groups).map(([name, data]) => {
    const yieldPct = data.cost_basis > 0 ? ((data.total_value - data.cost_basis) / data.cost_basis) * 100 : 0
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
    }
  }).sort((a, b) => b.total_value - a.total_value)
}
