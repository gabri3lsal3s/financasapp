import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Portfolio, PortfolioTransaction, AssetPrice, PortfolioAssetDefinition } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import { calculateShareHistory, calculatePerformanceMetrics, AssetPosition } from '@/services/investmentEngine'
import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { generateConsultingPDF } from '@/services/pdfGenerator'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'
import { formatCurrency, formatNumberBR } from '@/utils/format'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import PageHeader from '@/components/PageHeader'
import ClientKpiCards from '@/components/consulting/ClientKpiCards'
import {
  TrendingUp, FileText, CheckCircle,
  AlertCircle, ArrowUpRight, ArrowDownRight, ShieldCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

export default function ClientDashboard() {
  const { user } = useAuth()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetPrice>>({})
  const [assetTheses, setAssetTheses] = useState<Record<string, string>>({})
  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [indexRatesByIndexer, setIndexRatesByIndexer] = useState<Record<string, IndexRateMap>>({})
  const [loading, setLoading] = useState<boolean>(true)

  // Estados calculados
  const [positions, setPositions] = useState<AssetPosition[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number>(0)
  const [shareValue, setShareValue] = useState<number>(1.0)
  const [totalShares, setTotalShares] = useState<number>(0)

  useEffect(() => {
    if (user) {
      loadClientData()
    }
  }, [user])

  const loadClientData = async () => {
    if (!user) return
    const cacheKey = `client-dashboard-data-${user.id}`

    try {
      const cached = await getCache<any>(cacheKey)
      if (cached && !portfolio) {
        if (cached.portfolio) setPortfolio(cached.portfolio)
        if (cached.transactions) setTransactions(cached.transactions)
        if (cached.assetPrices) setAssetPrices(cached.assetPrices)
        if (cached.assetTheses) setAssetTheses(cached.assetTheses)
        if (cached.assetDefinitions) setAssetDefinitions(cached.assetDefinitions)
        if (cached.indexRatesByIndexer) setIndexRatesByIndexer(cached.indexRatesByIndexer)
        if (cached.positions) setPositions(cached.positions)
        if (cached.portfolioValue) setPortfolioValue(cached.portfolioValue)
        if (cached.shareValue) setShareValue(cached.shareValue)
        if (cached.totalShares) setTotalShares(cached.totalShares)
      }

      setLoading(!cached)
      
      // 1. Puxa o portfolio do cliente logado
      const { data: portData, error: portError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('client_id', user?.id)
        .not('consultant_id', 'is', null)
        .maybeSingle()

      if (portError) throw portError
      if (!portData) {
        setPortfolio(null)
        setLoading(false)
        return
      }

      setPortfolio(portData)

      // 2. Carrega as transações da carteira do cliente
      const txs = await fetchAllPortfolioTransactions(portData.id, { orderField: 'date', ascending: true })
      setTransactions(txs)

      // 3. Carrega metas de alocação
      const { data: targetsData, error: targetsError } = await supabase
        .from('target_allocations')
        .select('*')
        .eq('portfolio_id', portData.id)

      if (targetsError) throw targetsError

      // 4. Carrega as teses de investimentos do consultor vinculadas
      let mappedTheses: Record<string, string> = {}
      if (portData.consultant_id) {
        const { data: thesesData, error: thesesError } = await supabase
          .from('asset_theses')
          .select('*')
          .eq('consultant_id', portData.consultant_id)

        if (!thesesError && thesesData) {
          for (const item of thesesData) {
            mappedTheses[item.ticker.toUpperCase()] = item.thesis
          }
          setAssetTheses(mappedTheses)
        }
      }

      // 5. Busca cotações dos ativos para os cálculos
      let finalPrices = {}
      let finalPositions: AssetPosition[] = []
      let finalPortfolioValue = 0
      let finalDefinitions: PortfolioAssetDefinition[] = []
      let finalIndexRates: Record<string, IndexRateMap> = {}
      let currentShareValue = 1.0
      let sharesOutstanding = 0

      if (txs.length > 0) {
        const valuation = await loadPortfolioValuation(
          portData.id,
          txs,
          targetsData || [],
          Number(portData.cash_balance) || 0
        )
        setAssetPrices(valuation.prices)
        setPositions(valuation.positions)
        setPortfolioValue(valuation.investedValue)
        setAssetDefinitions(valuation.definitions)
        setIndexRatesByIndexer(valuation.indexRatesByIndexer)

        const shareHistoryResult = calculateShareHistory(
          txs,
          valuation.prices,
          valuation.definitions,
          valuation.indexRatesByIndexer
        )
        currentShareValue = shareHistoryResult.currentShareValue
        sharesOutstanding = shareHistoryResult.totalShares
        setShareValue(currentShareValue)
        setTotalShares(sharesOutstanding)

        finalPrices = valuation.prices
        finalPositions = valuation.positions
        finalPortfolioValue = valuation.investedValue
        finalDefinitions = valuation.definitions
        finalIndexRates = valuation.indexRatesByIndexer
      } else {
        setPositions([])
        setPortfolioValue(0)
        setShareValue(1.0)
        setTotalShares(0)
        setAssetDefinitions([])
        setIndexRatesByIndexer({})
      }

      // Cache all details
      await setCache(cacheKey, {
        portfolio: portData,
        transactions: txs,
        assetPrices: finalPrices,
        assetTheses: mappedTheses,
        assetDefinitions: finalDefinitions,
        indexRatesByIndexer: finalIndexRates,
        positions: finalPositions,
        portfolioValue: finalPortfolioValue,
        shareValue: currentShareValue,
        totalShares: sharesOutstanding
      })

    } catch (err) {
      console.error('Erro ao compilar painel do cliente:', err)
      toast.error('Erro ao processar dados da sua carteira')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadReport = async () => {
    if (!portfolio) return
    toast.loading('Compilando seu relatório premium...', { id: 'client-report' })
    try {
      const { shareHistory } = calculateShareHistory(transactions, assetPrices, assetDefinitions, indexRatesByIndexer)
      const metrics = calculatePerformanceMetrics(shareHistory)

      await generateConsultingPDF({
        clientName: user?.email?.split('@')[0].toUpperCase() || 'CLIENTE',
        portfolio,
        positions,
        shareHistory,
        metrics,
        theses: assetTheses,
        cashBalance: Number(portfolio.cash_balance) || 0
      })
    } catch (err) {
      console.error(err)
      toast.error('Falha ao baixar relatório.', { id: 'client-report' })
    }
  }

  // Lógica de cálculo de rebalanceamento
  const rebalancingTrades = useMemo(() => {
    if (positions.length === 0 || portfolioValue === 0) return []

    const trades: Array<{
      ticker: string
      action: 'buy' | 'sell' | 'hold'
      amount: number
      shares: number
      currentPct: number
      targetPct: number
    }> = []

    positions.forEach(pos => {
      const diffPct = pos.target_percentage - pos.current_percentage
      const diffAmount = (diffPct / 100) * portfolioValue
      const action = diffPct > 1.0 ? 'buy' : diffPct < -1.0 ? 'sell' : 'hold'
      const price = pos.current_price || 50.00
      const shares = Math.round(diffAmount / price)

      if (action !== 'hold' && Math.abs(shares) > 0) {
        trades.push({
          ticker: pos.ticker,
          action,
          amount: Math.abs(diffAmount),
          shares: Math.abs(shares),
          currentPct: pos.current_percentage,
          targetPct: pos.target_percentage
        })
      }
    })

    // Ordenar compras primeiro, maiores necessidades primeiro
    return trades.sort((a, b) => {
      if (a.action !== b.action) {
        return a.action === 'buy' ? -1 : 1
      }
      return b.amount - a.amount
    })
  }, [positions, portfolioValue])

  // Rentabilidade consolidada ponderada dos ativos em carteira
  const overallYieldPct = useMemo(() => {
    const totalCostBasis = positions.reduce((sum, p) => sum + p.cost_basis, 0)
    const totalGrossGain = positions.reduce((sum, p) => sum + p.cost_basis * (p.gross_yield_pct / 100), 0)
    return totalCostBasis > 0 ? (totalGrossGain / totalCostBasis) * 100 : 0
  }, [positions])

  // Processar dados de exposição por classe para gráfico
  const classChartData = useMemo(() => {
    const dataMap: Record<string, { name: string; value: number; color: string }> = {}
    positions.forEach(pos => {
      const cls = pos.asset_class || 'Renda Fixa'
      if (!dataMap[cls]) {
        let color = '#3b82f6' // Azul padrão
        if (cls.includes('Ações Nacionais')) color = '#6366f1' // Roxo Indigo
        else if (cls.includes('Fundos')) color = '#10b981' // Verde Esmeralda
        else if (cls.includes('Cripto')) color = '#f59e0b' // Laranja Amber
        else if (cls.includes('Renda Fixa')) color = '#ec4899' // Rosa
        else if (cls.includes('Internacionais')) color = '#06b6d4' // Ciano
        else if (cls.includes('ETFs')) color = '#8b5cf6' // Violeta
        
        dataMap[cls] = { name: cls, value: 0, color }
      }
      dataMap[cls].value += pos.total_value
    })

    return Object.values(dataMap)
  }, [positions])

  const headerAction = portfolio ? (
    <Button
      size="sm"
      variant="outline"
      onClick={handleDownloadReport}
      className="flex items-center gap-2 border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 font-bold w-full sm:w-auto"
    >
      <FileText size={16} />
      <span className="hidden sm:inline">Baixar Relatório PDF</span>
      <span className="sm:hidden">Relatório PDF</span>
    </Button>
  ) : undefined

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-page-enter">
        <PageHeader title="Minha Consultoria" subtitle="Página de Consultoria de Investimentos" />
        <Loader text="Carregando sua carteira..." className="py-24" />
      </div>
    )
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      <PageHeader
        title="Minha Consultoria"
        subtitle="Página de Consultoria de Investimentos"
        action={headerAction}
      />

      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-emerald-950 via-slate-900 to-slate-900 rounded-3xl border border-emerald-800/30 text-white shadow-xl text-left">
        <div className="absolute right-0 top-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 font-sans">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full uppercase tracking-wider mb-3">
            <CheckCircle size={12} className="text-emerald-400" />
            Carteira sob assessoria
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-white">Meu Painel de Investimentos</h2>
          <p className="text-sm text-slate-300 mt-1">
            Acompanhamento e rebalanceamento em tempo real do seu patrimônio
          </p>
        </div>
      </div>

      {portfolio ? (
        <>
          <ClientKpiCards
            portfolioValue={portfolioValue}
            shareValue={shareValue}
            totalShares={totalShares}
            yieldVariant="accumulated"
            overallYieldPct={overallYieldPct}
          />

          {/* Seção Gráfica e Rebalanceamento */}
          {positions.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 text-left">
              {/* Gráfico de Exposição Recharts */}
              <Card className="p-5 lg:p-6 flex flex-col justify-between">
                <h3 className="font-bold text-base text-primary mb-4 flex items-center gap-2">
                  <TrendingUp size={16} className="text-indigo-500" />
                  Distribuição de Ativos por Classe
                </h3>
                <div className="h-64 w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={classChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                      >
                        {classChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Patrimônio']} 
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              {/* Guia de Ação de Rebalanceamento */}
              <Card className="p-5 lg:p-6">
                <h3 className="font-bold text-base text-primary mb-3 flex items-center gap-2">
                  <AlertCircle size={16} className="text-indigo-500" />
                  Ações de Rebalanceamento Recomendadas
                </h3>
                <p className="text-[11px] text-secondary mb-4">Trades sugeridos para aproximar sua alocação real do alvo desenhado pelo seu consultor</p>
                <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                  {rebalancingTrades.length === 0 ? (
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl text-center text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      Sua carteira está perfeitamente alinhada com as metas de alocação recomendadas! 🎉
                    </div>
                  ) : (
                    rebalancingTrades.map(trade => (
                      <div key={trade.ticker} className="p-3 bg-secondary border border-primary rounded-xl flex items-center justify-between text-xs transition-all hover:border-indigo-500/20">
                        <div>
                          <div className="flex items-center gap-2">
                            <strong className="text-primary font-bold">{trade.ticker === 'SALDO_INV' ? 'Saldo para Investimento' : trade.ticker}</strong>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              trade.action === 'buy' 
                                ? 'bg-income/10 text-income' 
                                : 'bg-expense/10 text-expense'
                            }`}>
                              {trade.action === 'buy' ? 'Comprar' : 'Vender'}
                            </span>
                          </div>
                          <div className="text-[10px] text-secondary mt-1 flex items-center gap-1.5">
                            <span>Participação real: <strong>{trade.currentPct}%</strong></span>
                            <span>•</span>
                            <span>Meta Alvo: <strong>{trade.targetPct}%</strong></span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div className="text-[11px] font-semibold text-primary">
                            {trade.action === 'buy' ? '+' : '-'}{trade.shares} cotas
                            <div className="text-[9px] text-secondary font-medium">Est: R$ {trade.amount.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</div>
                          </div>
                          {trade.action === 'buy' ? (
                            <ArrowUpRight size={16} className="text-income" />
                          ) : (
                            <ArrowDownRight size={16} className="text-expense" />
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          )}

          <div className="space-y-6 lg:gap-8 text-left">
            {portfolio?.notes && (
              <Card className="p-5 bg-gradient-to-br from-secondary to-background border-l-4 border-l-indigo-500 shadow-sm">
                <h4 className="font-bold text-sm text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5 mb-2.5">
                  <ShieldCheck size={16} />
                  Notas do assessor
                </h4>
                <p className="text-[11px] text-primary whitespace-pre-wrap leading-relaxed">
                  {portfolio.notes}
                </p>
              </Card>
            )}

            <Card className="p-5 lg:p-6">
              <h3 className="font-bold text-lg text-primary mb-4">Composição de Ativos & Exposição</h3>

              {positions.length === 0 ? (
                <p className="text-center py-8 text-sm text-secondary">Aguardando inserção dos lançamentos iniciais pelo seu consultor.</p>
              ) : (
                <>
                  {/* 1. Tabela para Desktop */}
                  <div className="hidden md:block overflow-x-auto border border-border/30 rounded-xl bg-background/50">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border/30 bg-muted/20">
                          <th className="p-3.5 font-bold text-secondary">Ativo</th>
                          <th className="p-3.5 font-bold text-secondary text-right">Qtd</th>
                          <th className="p-3.5 font-bold text-secondary text-right">Cotação</th>
                          <th className="p-3.5 font-bold text-secondary text-right">Total Atual</th>
                          <th className="p-3.5 font-bold text-secondary text-center">Meu Peso</th>
                          <th className="p-3.5 font-bold text-secondary text-center">Peso Recomendado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/20">
                        {(() => {
                          const positionsByClass: Record<string, AssetPosition[]> = {}
                          positions
                            .forEach(pos => {
                              const cls = pos.asset_class || 'Renda Fixa'
                              if (!positionsByClass[cls]) positionsByClass[cls] = []
                              positionsByClass[cls].push(pos)
                            })
                          return Object.entries(positionsByClass).map(([className, classPositions]) => (
                            <div key={className} style={{ display: 'contents' }}>
                              <tr className="bg-muted/10 border-l-4 border-l-emerald-500 font-extrabold text-xs tracking-wider">
                                <td colSpan={6} className="p-3 text-secondary uppercase font-extrabold">
                                  {className}
                                </td>
                              </tr>
                              {classPositions.map(pos => (
                                <tr key={pos.ticker} className="hover:bg-muted/10 transition-colors">
                                  <td className="p-3.5 pl-6 font-extrabold text-primary flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    {pos.ticker === 'SALDO_INV' ? 'Saldo para Investimento' : pos.ticker}
                                    <span className="text-[10px] text-secondary font-normal font-sans">({pos.sector || 'Outros'})</span>
                                  </td>
                                  <td className="p-3.5 text-right text-secondary font-medium">{formatNumberBR(pos.quantity)}</td>
                                  <td className="p-3.5 text-right font-semibold text-secondary">{formatCurrency(pos.current_price)}</td>
                                  <td className="p-3.5 text-right font-bold text-primary">{formatCurrency(pos.total_value)}</td>
                                  <td className="p-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-muted rounded text-xs font-bold text-secondary">{pos.current_percentage}%</span>
                                  </td>
                                  <td className="p-3.5 text-center">
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold">{pos.target_percentage}%</span>
                                  </td>
                                </tr>
                              ))}
                            </div>
                          ))
                        })()}
                      </tbody>
                    </table>
                  </div>

                  {/* 2. Visualização em Cards para Mobile */}
                  <div className="block md:hidden space-y-4">
                    {(() => {
                      const positionsByClass: Record<string, AssetPosition[]> = {}
                      positions
                        .forEach(pos => {
                          const cls = pos.asset_class || 'Renda Fixa'
                          if (!positionsByClass[cls]) positionsByClass[cls] = []
                          positionsByClass[cls].push(pos)
                        })
                      return Object.entries(positionsByClass).map(([className, classPositions]) => (
                        <div key={className} className="space-y-2">
                          <div className="text-[10px] font-extrabold uppercase tracking-widest text-secondary bg-muted/10 border-l-4 border-l-emerald-500 px-3 py-1.5 rounded-lg select-none">
                            {className}
                          </div>
                          
                          <div className="space-y-3">
                            {classPositions.map(pos => (
                              <div 
                                key={pos.ticker}
                                className="p-4 bg-card border border-border/40 rounded-2xl space-y-3 shadow-sm transition-all hover:scale-[1.01]"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                    <span className="font-mono font-bold text-primary text-sm">
                                      {pos.ticker === 'SALDO_INV' ? 'Saldo Investimento' : pos.ticker}
                                    </span>
                                    <span className="text-[10px] text-secondary font-medium font-sans">({pos.sector || 'Outros'})</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[9px] uppercase font-extrabold text-secondary block">Preço</span>
                                    <span className="text-xs font-bold text-primary font-mono">
                                      {formatCurrency(pos.current_price)}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3 text-left bg-secondary/35 p-2.5 rounded-xl border border-primary/5">
                                  <div>
                                    <span className="text-[9px] uppercase font-extrabold text-secondary block">Qtd</span>
                                    <span className="text-xs font-semibold text-primary font-mono">
                                      {formatNumberBR(pos.quantity)}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] uppercase font-extrabold text-secondary block">Total</span>
                                    <span className="text-xs font-bold text-primary font-mono">
                                      {formatCurrency(pos.total_value)}
                                    </span>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <div className="flex items-center gap-1">
                                      <span className="text-secondary font-medium">Meu Peso:</span>
                                      <span className="font-mono font-bold text-primary">{pos.current_percentage}%</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <span className="text-secondary font-medium">Recomendado:</span>
                                      <span className="font-mono font-bold text-emerald-500">{pos.target_percentage}%</span>
                                    </div>
                                  </div>
                                  
                                  <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden relative">
                                    <div 
                                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                      style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                                    />
                                    {pos.target_percentage > 0 && (
                                      <div 
                                        className="absolute top-0 bottom-0 w-0.5 bg-emerald-300 dark:bg-emerald-700"
                                        style={{ left: `${Math.min(pos.target_percentage, 99)}%` }}
                                      />
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    })()}
                  </div>
                </>
              )}
            </Card>

            <Card className="p-5 lg:p-6">
              <h3 className="font-bold text-base text-primary flex items-center gap-2 mb-4">
                <TrendingUp size={18} className="text-emerald-500" />
                Por que possuo estes ativos?
              </h3>
              <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                {positions.filter(pos => assetTheses[pos.ticker]).length === 0 ? (
                  <p className="text-xs text-secondary text-center py-4">Seu consultor ainda não anexou teses qualitativas este mês.</p>
                ) : (
                  positions.filter(pos => assetTheses[pos.ticker]).map(pos => (
                    <div key={pos.ticker} className="p-3 bg-muted/20 border border-border/30 rounded-lg space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold text-primary">
                        <span>{pos.ticker}</span>
                        <span className="text-[10px] text-emerald-500 font-semibold">{pos.target_percentage}% alvo</span>
                      </div>
                      <p className="text-[11px] text-secondary leading-relaxed pt-1">
                        {assetTheses[pos.ticker]}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </>
      ) : (
        <Card className="p-10 text-center space-y-3 bg-gradient-to-br from-card to-background">
          <p className="text-secondary text-sm">Nenhuma carteira ativa foi vinculada à sua conta pelo seu consultor.</p>
          <p className="text-xs text-secondary/70">Entre em contato com seu consultor para inicializar seus aportes.</p>
        </Card>
      )}
    </div>
  )
}
