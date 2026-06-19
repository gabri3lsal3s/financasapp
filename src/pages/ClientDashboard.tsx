import { useEffect, useState, useMemo, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Portfolio, PortfolioTransaction, AssetPrice, PortfolioAssetDefinition } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import {
  calculateShareHistory,
  calculatePerformanceMetrics,
  AssetPosition,
  calculateConsolidatedByClass,
  calculateConsolidatedBySector
} from '@/services/investmentEngine'
import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'
import { generateConsultingPDF } from '@/services/pdfGenerator'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'
import {
  formatCurrency,
  formatNumberBR,
  formatPercentBR,
  formatCurrencyByCode
} from '@/utils/format'
import Card from '@/components/Card'
import Loader from '@/components/Loader'
import Button from '@/components/Button'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import { PAGE_HEADERS } from '@/constants/pages'
import ClientKpiCards, { type ClientKpiYieldBasis } from '@/components/consulting/ClientKpiCards'
import ClientAdvisoryReportSection from '@/components/consulting/ClientAdvisoryReportSection'
import { useTheme } from '@/hooks/useTheme'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Switch from '@/components/Switch'
import {
  TrendingUp, FileText, CheckCircle, ShieldCheck,
  Layers, Briefcase, Search, X
} from 'lucide-react'
import toast from 'react-hot-toast'
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { nonCashPortfolioPerformance } from '@/utils/portfolioDisplayMetrics'

type ClientDashboardCache = {
  portfolio?: Portfolio
  transactions?: PortfolioTransaction[]
  assetPrices?: Record<string, AssetPrice>
  assetTheses?: Record<string, string>
  assetDefinitions?: PortfolioAssetDefinition[]
  indexRatesByIndexer?: Record<string, IndexRateMap>
  positions?: AssetPosition[]
  portfolioValue?: number
  investedValue?: number
  cashValue?: number
  totalValue?: number
  shareValue?: number
  totalShares?: number
  vnaMap?: Record<string, number>
}

export default function ClientDashboard() {
  const { user } = useAuth()
  const { colorPalette } = useTheme()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetPrice>>({})
  const [assetTheses, setAssetTheses] = useState<Record<string, string>>({})
  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [indexRatesByIndexer, setIndexRatesByIndexer] = useState<Record<string, IndexRateMap>>({})
  const [vnaMap, setVnaMap] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState<boolean>(true)

  // Estados calculados e UI
  const [activeTab, setActiveTab] = useState<string>('distribution')
  const [positions, setPositions] = useState<AssetPosition[]>([])
  const [investedValue, setInvestedValue] = useState<number>(0)
  const [cashValue, setCashValue] = useState<number>(0)
  const [totalValue, setTotalValue] = useState<number>(0)
  const [shareValue, setShareValue] = useState<number>(1.0)
  const [totalShares, setTotalShares] = useState<number>(0)
  const [yieldBasis, setYieldBasis] = useState<ClientKpiYieldBasis>('gross')
  const [executiveSummary, setExecutiveSummary] = useState('')
  const [nextMonthPlan, setNextMonthPlan] = useState('')

  // Estados do Gráfico de Rosca interativo
  const [consolidationView, setConsolidationView] = useState<'class' | 'sector'>('class')
  const [selectedPieSegment, setSelectedPieSegment] = useState<{ name: string; value: number; percent: number; target: number } | null>(null)
  const [hoveredPieSegment, setHoveredPieSegment] = useState<{ name: string; value: number; percent: number } | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) {
      loadClientData()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WHY: bootstrap por user; loadClientData recriada a cada render
  }, [user])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        selectedPieSegment &&
        chartContainerRef.current &&
        !chartContainerRef.current.contains(event.target as Node)
      ) {
        setSelectedPieSegment(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('click', handleClickOutside)
    }
  }, [selectedPieSegment])

  const loadClientData = async () => {
    if (!user) return
    const cacheKey = `client-dashboard-data-${user.id}`

    try {
      const cached = await getCache<ClientDashboardCache>(cacheKey)
      if (cached && !portfolio) {
        if (cached.portfolio) setPortfolio(cached.portfolio)
        if (cached.transactions) setTransactions(cached.transactions)
        if (cached.assetPrices) setAssetPrices(cached.assetPrices)
        if (cached.assetTheses) setAssetTheses(cached.assetTheses)
        if (cached.assetDefinitions) setAssetDefinitions(cached.assetDefinitions)
        if (cached.indexRatesByIndexer) setIndexRatesByIndexer(cached.indexRatesByIndexer)
        if (cached.positions) setPositions(cached.positions)
        if (cached.investedValue !== undefined) setInvestedValue(cached.investedValue)
        if (cached.cashValue !== undefined) setCashValue(cached.cashValue)
        if (cached.totalValue !== undefined) setTotalValue(cached.totalValue)
        else if (cached.portfolioValue) {
          setInvestedValue(cached.portfolioValue)
          setTotalValue(cached.portfolioValue)
        }
        if (cached.shareValue) setShareValue(cached.shareValue)
        if (cached.totalShares) setTotalShares(cached.totalShares)
        if (cached.vnaMap) setVnaMap(cached.vnaMap)
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
      const mappedTheses: Record<string, string> = {}
      if (portData.consultant_id) {
        const { data: thesesData, error: thesesError } = await supabase
          .from('asset_theses')
          .select('*')
          .eq('consultant_id', portData.consultant_id)

        if (!thesesError && thesesData) {
          for (const item of thesesData) {
            mappedTheses[item.ticker.toUpperCase()] = item.thesis
          }
          setExecutiveSummary(mappedTheses['__EXECUTIVE_SUMMARY__'] || '')
          setNextMonthPlan(mappedTheses['__NEXT_MONTH_PLAN__'] || '')
          delete mappedTheses['__EXECUTIVE_SUMMARY__']
          delete mappedTheses['__NEXT_MONTH_PLAN__']
          setAssetTheses(mappedTheses)
        }
      }

      // 5. Busca cotações dos ativos para os cálculos
      let finalPrices = {}
      let finalPositions: AssetPosition[] = []
      let finalInvested = 0
      let finalCash = 0
      let finalTotal = 0
      let finalDefinitions: PortfolioAssetDefinition[] = []
      let finalIndexRates: Record<string, IndexRateMap> = {}
      let finalVna = {}
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
        setInvestedValue(valuation.investedValue)
        setCashValue(valuation.cashValue)
        setTotalValue(valuation.totalValue)
        setAssetDefinitions(valuation.definitions)
        setIndexRatesByIndexer(valuation.indexRatesByIndexer)

        const shareHistoryResult = calculateShareHistory(
          txs,
          valuation.prices,
          valuation.definitions,
          valuation.indexRatesByIndexer,
          {},
          valuation.vnaMap || {}
        )
        currentShareValue = shareHistoryResult.currentShareValue
        sharesOutstanding = shareHistoryResult.totalShares
        setShareValue(currentShareValue)
        setTotalShares(sharesOutstanding)

        finalPrices = valuation.prices
        finalPositions = valuation.positions
        finalInvested = valuation.investedValue
        finalCash = valuation.cashValue
        finalTotal = valuation.totalValue
        finalDefinitions = valuation.definitions
        finalIndexRates = valuation.indexRatesByIndexer
        finalVna = valuation.vnaMap || {}
      } else {
        setPositions([])
        setInvestedValue(0)
        setCashValue(0)
        setTotalValue(0)
        setShareValue(1.0)
        setTotalShares(0)
        setAssetDefinitions([])
        setIndexRatesByIndexer({})
        setVnaMap({})
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
        investedValue: finalInvested,
        cashValue: finalCash,
        totalValue: finalTotal,
        shareValue: currentShareValue,
        totalShares: sharesOutstanding,
        vnaMap: finalVna
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
      const { shareHistory } = calculateShareHistory(
        transactions,
        assetPrices,
        assetDefinitions,
        indexRatesByIndexer,
        {},
        vnaMap
      )
      const metrics = calculatePerformanceMetrics(shareHistory)

      await generateConsultingPDF({
        clientName: user?.email?.split('@')[0].toUpperCase() || 'CLIENTE',
        portfolio,
        positions,
        shareHistory,
        metrics,
        theses: assetTheses,
        cashBalance: Number(portfolio.cash_balance) || 0,
        totalValue,
        investedValue,
      })
      toast.success('Relatório baixado com sucesso!', { id: 'client-report' })
    } catch (err) {
      console.error(err)
      toast.error('Falha ao baixar relatório.', { id: 'client-report' })
    }
  }



  const displayTheses = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(assetTheses).filter(
          ([ticker]) => !ticker.startsWith('__') && ticker.trim().length > 0,
        ),
      ),
    [assetTheses],
  )

  // Rentabilidade consolidada corrigida (com dividendos) e ganho em BRL
  const { overallYieldPct, overallGainBrl } = useMemo(() => {
    const perf = nonCashPortfolioPerformance(positions, yieldBasis)
    return {
      overallYieldPct: perf.yieldPct,
      overallGainBrl: perf.gainBrl
    }
  }, [positions, yieldBasis])

  const netShareValue = useMemo(() => {
    const totalCost = positions.reduce((s, p) => s + p.cost_basis, 0)
    const totalNet = positions.reduce(
      (s, p) => s + p.cost_basis * (1 + p.net_yield_pct / 100),
      0
    )
    if (totalCost <= 0 || shareValue <= 0) return shareValue
    return Math.round(shareValue * (totalNet / totalCost) * 10000) / 10000
  }, [positions, shareValue])

  // Consolidações por classe e setor
  const consolidatedClass = useMemo(() => {
    return calculateConsolidatedByClass(positions, totalValue)
  }, [positions, totalValue])

  const consolidatedSector = useMemo(() => {
    return calculateConsolidatedBySector(positions, totalValue)
  }, [positions, totalValue])

  const chartPalette = useMemo(() => {
    if (colorPalette === 'monochrome') {
      return Array.from({ length: 6 }, (_, i) => `var(--chart-mono-${i})`)
    }
    return [
      'var(--color-primary)',
      ...Array.from({ length: 6 }, (_, i) => `var(--chart-glass-${i})`),
    ]
  }, [colorPalette])

  const pieData = useMemo(() => {
    const groups = consolidationView === 'class' 
      ? consolidatedClass 
      : consolidatedSector
    
    return groups.filter(g => g.total_value > 0).map(g => ({
      name: g.name,
      value: g.total_value,
      percent: g.current_percentage,
      target: g.target_percentage,
      yield_pct: g.yield_pct,
      gross_yield_pct: g.gross_yield_pct,
      net_yield_pct: g.net_yield_pct
    }))
  }, [consolidatedClass, consolidatedSector, consolidationView])

  const activeGroupAssets = useMemo(() => {
    if (!selectedPieSegment) return []
    return positions.filter(pos => {
      if (pos.pricing_mode === 'cash' || pos.ticker === 'SALDO_INV' || pos.ticker === 'CAIXA') return false
      if (consolidationView === 'class') {
        return (pos.asset_class || 'Não classificado') === selectedPieSegment.name
      } else {
        return (pos.sector || 'Outros') === selectedPieSegment.name
      }
    })
  }, [selectedPieSegment, positions, consolidationView])

  const headerAction = portfolio ? (
    <PageHeaderActions>
      <PageHeaderActionButton
        intent="balance"
        icon={FileText}
        label="Relatório PDF"
        onClick={handleDownloadReport}
      />
    </PageHeaderActions>
  ) : undefined

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-page-enter">
        <PageHeader
          title={PAGE_HEADERS.clientConsulting.title}
          subtitle={PAGE_HEADERS.clientConsulting.description}
        />
        <Loader text="Carregando sua carteira..." className="py-24" />
      </div>
    )
  }

  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      <PageHeader
        title={PAGE_HEADERS.clientConsulting.title}
        subtitle={PAGE_HEADERS.clientConsulting.description}
        action={headerAction}
      />

      <div className="relative overflow-hidden p-6 lg:p-8 bg-gradient-to-br from-primary/15 via-secondary/70 to-secondary/40 rounded-3xl border border-primary/30 text-primary shadow-xl text-left surface-glass">
        <div className="absolute right-0 top-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 font-sans">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-income/10 border border-income/20 text-income text-xs font-bold rounded-full uppercase tracking-wider mb-3">
            <CheckCircle size={12} className="text-income" />
            Carteira sob assessoria
          </div>
          <h2 className="text-2xl lg:text-3xl font-black text-primary">Meu Painel de Investimentos</h2>
          <p className="text-sm text-secondary mt-1">
            Acompanhamento e rebalanceamento em tempo real do seu patrimônio
          </p>
        </div>
      </div>

      {portfolio ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-secondary">
              <Switch
                checked={yieldBasis === 'net'}
                onClick={() => setYieldBasis((b) => (b === 'gross' ? 'net' : 'gross'))}
                label="Visão líquida (IR estimado)"
              />
              <span>Visão líquida (IR estimado)</span>
            </div>
          </div>
          <ClientKpiCards
            investedValue={investedValue}
            cashValue={cashValue}
            totalValue={totalValue}
            shareValue={shareValue}
            totalShares={totalShares}
            yieldVariant="accumulated"
            overallYieldPct={overallYieldPct}
            yieldBasis={yieldBasis}
            netShareValue={netShareValue}
            overallGainBrl={overallGainBrl}
          />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-xs mx-auto mb-6">
              <TabsTrigger value="distribution" className="text-xs font-bold gap-1.5">
                <Layers size={14} />
                <span>Distribuição</span>
              </TabsTrigger>
              <TabsTrigger value="assets" className="text-xs font-bold gap-1.5">
                <Briefcase size={14} />
                <span>Meus Ativos</span>
              </TabsTrigger>
            </TabsList>

            {/* Aba 1: Distribuição & Rebalanceamento */}
            <TabsContent value="distribution" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                
                {/* Card do Gráfico de Rosca */}
                <Card className="p-4 lg:p-6 flex flex-col items-center relative overflow-hidden text-left w-full">
                  <div className="w-full flex items-center justify-between gap-3 mb-4 pb-2 border-b border-primary/5">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary">Alocação Atual</h4>
                    
                    {/* Switcher de Consolidação */}
                    <Tabs 
                      value={consolidationView} 
                      onValueChange={(val) => {
                        setConsolidationView(val as 'class' | 'sector')
                        setSelectedPieSegment(null)
                      }}
                      className="w-auto shrink-0"
                    >
                      <TabsList className="grid grid-cols-2 w-40 h-[32px] p-0.5">
                        <TabsTrigger value="class" className="text-[10px] font-black uppercase tracking-wider py-1">
                          Classes
                        </TabsTrigger>
                        <TabsTrigger value="sector" className="text-[10px] font-black uppercase tracking-wider py-1">
                          Setores
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>

                  {pieData.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-center text-secondary italic text-xs">
                      Nenhum ativo alocado para gerar o gráfico.
                    </div>
                  ) : (
                    <>
                      <div 
                        ref={chartContainerRef}
                        onClick={() => setSelectedPieSegment(null)}
                        className="relative w-full h-64 sm:h-80 cursor-pointer"
                      >
                        <div className="absolute inset-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius="62%"
                                outerRadius="82%"
                                paddingAngle={3}
                                dataKey="value"
                                onMouseEnter={(_, index) => {
                                  if (window.matchMedia('(hover: hover)').matches) {
                                    if (pieData[index]) setHoveredPieSegment(pieData[index])
                                  }
                                }}
                                onMouseLeave={() => setHoveredPieSegment(null)}
                                onClick={(_, index, event) => {
                                  if (event && event.stopPropagation) {
                                    event.stopPropagation()
                                  }
                                  const segment = pieData[index]
                                  if (segment) {
                                    setSelectedPieSegment(prev => 
                                      prev?.name === segment.name ? null : segment
                                    )
                                  }
                                }}
                              >
                                {pieData.map((entry, index) => {
                                  const isSelected = selectedPieSegment ? selectedPieSegment.name === entry.name : false
                                  const hasSelection = selectedPieSegment !== null
                                  return (
                                    <Cell 
                                      key={`cell-${index}`} 
                                      fill={chartPalette[index % chartPalette.length]} 
                                      stroke="var(--color-border)" 
                                      strokeWidth={isSelected ? 2.5 : 1}
                                      opacity={hasSelection ? (isSelected ? 1.0 : 0.4) : 1.0}
                                      className="outline-none cursor-pointer transition-all duration-300"
                                    />
                                  )
                                })}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Texto no Centro do Donut */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                          <div className="max-w-[150px] text-center flex flex-col items-center justify-center">
                            <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-secondary leading-tight line-clamp-2">
                              {hoveredPieSegment 
                                ? hoveredPieSegment.name 
                                : (selectedPieSegment ? selectedPieSegment.name : 'Patrimônio Total')}
                            </span>
                            <span className="text-base sm:text-lg font-black text-primary font-mono mt-1.5 leading-tight">
                              {hoveredPieSegment 
                                ? formatCurrency(hoveredPieSegment.value)
                                : (selectedPieSegment 
                                  ? formatCurrency(selectedPieSegment.value)
                                  : formatCurrency(totalValue))}
                            </span>
                            <span className="text-[10px] font-bold text-income mt-1 font-mono leading-none">
                              {hoveredPieSegment 
                                ? `${formatPercentBR(hoveredPieSegment.percent, 1)}`
                                : (selectedPieSegment 
                                  ? `${formatPercentBR(selectedPieSegment.percent, 1)}`
                                  : '100.0%')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Botão de Ver Ativos Detalhados */}
                      {selectedPieSegment && (
                        <div className="w-full flex justify-center animate-fade-in mt-1 select-none">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setActiveTab('assets')
                            }}
                            className="flex items-center gap-1.5 text-[10px] font-extrabold tracking-wider uppercase text-balance hover:bg-balance/5 !min-h-0 h-auto py-1.5 px-3.5 rounded-full transition-all"
                          >
                            <Search size={12} className="text-balance" />
                            <span>Ver ativos detalhados</span>
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </Card>

                {/* Card de Rebalanceamento */}
                <Card className="p-4 lg:p-6 flex flex-col text-left w-full h-full justify-between">
                  <div className="flex items-center justify-between pb-2 border-b border-primary/5 mb-4 flex-wrap gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                      {selectedPieSegment 
                        ? `Ativos em ${selectedPieSegment.name}` 
                        : 'Rebalanceamento de Carteira'}
                    </h4>
                    {selectedPieSegment ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedPieSegment(null)}
                        className="!min-h-0 text-[9px] font-black uppercase tracking-wider text-secondary hover:text-primary flex items-center gap-1 py-1 px-2.5 rounded-full bg-secondary/50"
                      >
                        <X size={10} />
                        <span>Voltar para grupos</span>
                      </Button>
                    ) : (
                      <span className="text-[9px] font-black text-secondary uppercase tracking-widest bg-secondary/50 px-2 py-0.5 rounded-full font-sans">
                        Meta Recomendada
                      </span>
                    )}
                  </div>

                  <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                    {selectedPieSegment ? (
                      activeGroupAssets.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-center text-secondary italic text-xs">
                          Nenhum ativo individual cadastrado nesta fatia.
                        </div>
                      ) : (
                        activeGroupAssets.map((pos, index) => {
                          const targetPct = pos.target_percentage || 0
                          const currentPct = pos.current_percentage || 0
                          const devPct = currentPct - targetPct
                          const diffValue = totalValue * (targetPct / 100) - pos.total_value

                          let statusColor = 'text-secondary'
                          let statusBg = 'bg-secondary/40'
                          let statusText = 'Sem meta'

                          if (targetPct > 0) {
                            if (devPct > 1.0) {
                              statusColor = 'text-expense'
                              statusBg = 'bg-expense/10 border border-expense/20'
                              statusText = `Venda sugerida: -${formatCurrencyByCode(Math.abs(diffValue), pos.currency)}`
                            } else if (devPct < -1.0) {
                              statusColor = 'text-income'
                              statusBg = 'bg-income/10 border border-income/20'
                              statusText = `Aporte sugerido: +${formatCurrencyByCode(diffValue, pos.currency)}`
                            } else {
                              statusColor = 'text-primary'
                              statusBg = 'bg-primary/10 border border-primary/20'
                              statusText = 'Alinhado'
                            }
                          }

                          return (
                            <div 
                              key={pos.ticker} 
                              onClick={() => {
                                setActiveTab('assets')
                              }}
                              className="p-3.5 surface-glass border border-glass rounded-2xl flex flex-col gap-2 text-left cursor-pointer hover-lift-subtle shadow-sm transition-all select-none"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                                    style={{ backgroundColor: chartPalette[index % chartPalette.length] }} 
                                  />
                                  <span className="font-mono font-black text-primary text-xs tracking-wider truncate">{pos.ticker}</span>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${statusBg} ${statusColor} shrink-0`}>
                                  {statusText}
                                </span>
                              </div>

                              {/* Barra horizontal de alocação vs alvo */}
                              <div className="space-y-1">
                                <div className="w-full h-1.5 rounded-full bg-primary/10 relative overflow-hidden">
                                  <div 
                                    className="h-full bg-income rounded-full transition-all duration-500" 
                                    style={{ width: `${Math.min(pos.current_percentage, 100)}%` }} 
                                  />
                                  {targetPct > 0 && (
                                    <div 
                                      className="absolute top-0 bottom-0 w-0.5 bg-primary/60"
                                      style={{ left: `${Math.min(targetPct, 99)}%` }}
                                    />
                                  )}
                                </div>
                                <div className="flex items-center justify-between text-[9px] text-secondary font-mono leading-none">
                                  <span>Real: {formatPercentBR(pos.current_percentage, 1)} ({formatCurrencyByCode(pos.total_value, pos.currency)})</span>
                                  <span>Alvo: {formatPercentBR(targetPct, 0)}</span>
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )
                    ) : (
                      (consolidationView === 'class' 
                        ? consolidatedClass 
                        : consolidatedSector
                      ).map((group, index) => {
                        const targetPct = group.target_percentage || 0
                        const currentPct = group.current_percentage || 0
                        const devPct = currentPct - targetPct
                        const diffValue = totalValue * (targetPct / 100) - group.total_value

                        let statusColor = 'text-secondary'
                        let statusBg = 'bg-secondary/40 border border-secondary/50'
                        let statusText = 'Sem meta'

                        if (targetPct > 0) {
                          if (devPct > 1.5) {
                            statusColor = 'text-expense'
                            statusBg = 'bg-expense/10 border border-expense/20'
                            statusText = `Venda: -${formatCurrency(Math.abs(diffValue))}`
                          } else if (devPct < -1.5) {
                            statusColor = 'text-income'
                            statusBg = 'bg-income/10 border border-income/20'
                            statusText = `Aporte: +${formatCurrency(diffValue)}`
                          } else {
                            statusColor = 'text-primary'
                            statusBg = 'bg-primary/10 border border-primary/20'
                            statusText = 'Alinhado'
                          }
                        }

                        return (
                          <div 
                            key={group.name} 
                            onClick={() => {
                              setSelectedPieSegment({
                                name: group.name,
                                value: group.total_value,
                                percent: group.current_percentage,
                                target: group.target_percentage
                              })
                            }}
                            className="p-3.5 surface-glass border border-glass rounded-2xl flex flex-col gap-2 text-left cursor-pointer hover-lift-subtle shadow-sm transition-all select-none"
                          >
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full shrink-0" 
                                  style={{ backgroundColor: chartPalette[index % chartPalette.length] }} 
                                />
                                <span className="font-sans font-extrabold text-primary text-xs truncate">{group.name}</span>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${statusBg} ${statusColor} shrink-0`}>
                                {statusText}
                              </span>
                            </div>

                            {/* Barra horizontal de alocação vs alvo */}
                            <div className="space-y-1">
                              <div className="w-full h-1.5 rounded-full bg-primary/10 relative overflow-hidden">
                                <div 
                                  className="h-full bg-income rounded-full transition-all duration-500" 
                                  style={{ width: `${Math.min(group.current_percentage, 100)}%` }} 
                                />
                                {targetPct > 0 && (
                                  <div 
                                    className="absolute top-0 bottom-0 w-0.5 bg-primary/60"
                                    style={{ left: `${Math.min(targetPct, 99)}%` }}
                                  />
                                )}
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-secondary font-mono leading-none">
                                <span>Real: {formatPercentBR(group.current_percentage, 1)} ({formatCurrency(group.total_value)})</span>
                                <span>Alvo: {formatPercentBR(targetPct, 0)}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </Card>
              </div>
            </TabsContent>

            {/* Aba 2: Meus Ativos */}
            <TabsContent value="assets" className="space-y-6">
              <ClientAdvisoryReportSection
                executiveSummary={executiveSummary}
                nextMonthPlan={nextMonthPlan}
              />

              {portfolio?.notes && (
                <Card className="p-5 border border-glass surface-glass transition-all hover:scale-[1.005] hover:border-glass-strong hover:shadow-md shadow-sm relative overflow-hidden text-left">
                  <div
                    className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none"
                  />
                  <h4 className="font-bold text-sm accent-primary flex items-center gap-1.5 mb-2.5">
                    <ShieldCheck size={16} />
                    Notas do assessor
                  </h4>
                  <p className="text-[11px] text-primary whitespace-pre-wrap leading-relaxed relative z-10">
                    {portfolio.notes}
                  </p>
                </Card>
              )}

              <Card className="p-5 lg:p-6 text-left">
                <h3 className="font-bold text-lg text-primary mb-4">Composição de Ativos & Exposição</h3>

                {positions.length === 0 ? (
                  <p className="text-center py-8 text-sm text-secondary">Aguardando inserção dos lançamentos iniciais pelo seu consultor.</p>
                ) : (
                  <>
                    {/* 1. Tabela para Desktop */}
                    <div className="hidden md:block overflow-x-auto modal-table-shell">
                      <table className="w-full border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-glass modal-table-head">
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
                            positions.forEach(pos => {
                              const cls = pos.asset_class || 'Renda Fixa'
                              if (!positionsByClass[cls]) positionsByClass[cls] = []
                              positionsByClass[cls].push(pos)
                            })
                            return Object.entries(positionsByClass).map(([className, classPositions]) => (
                              <div key={className} style={{ display: 'contents' }}>
                                <tr className="bg-muted/10 border-l-4 border-l-income font-extrabold text-xs tracking-wider">
                                  <td colSpan={6} className="p-3 text-secondary uppercase font-extrabold">
                                    {className}
                                  </td>
                                </tr>
                                {classPositions.map(pos => (
                                  <tr key={pos.ticker} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-3.5 pl-6 font-extrabold text-primary flex items-center gap-2">
                                      <span className="w-1.5 h-1.5 rounded-full bg-income"></span>
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
                                      <span className="px-2 py-0.5 bg-income/10 text-income rounded text-xs font-bold">{pos.target_percentage}%</span>
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
                        positions.forEach(pos => {
                          const cls = pos.asset_class || 'Renda Fixa'
                          if (!positionsByClass[cls]) positionsByClass[cls] = []
                          positionsByClass[cls].push(pos)
                        })
                        return Object.entries(positionsByClass).map(([className, classPositions]) => (
                          <div key={className} className="space-y-2">
                            <div className="text-[10px] font-extrabold uppercase tracking-widest text-secondary bg-muted/10 border-l-4 border-l-income px-3 py-1.5 rounded-lg select-none">
                              {className}
                            </div>
                            
                            <div className="space-y-3">
                              {classPositions.map(pos => (
                                <div 
                                  key={pos.ticker}
                                  className="p-4 surface-glass border-glass rounded-2xl space-y-3 transition-all hover:scale-[1.01] glass-card-interactive"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="w-2 h-2 rounded-full bg-income shrink-0" />
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
                                        <span className="font-mono font-bold text-income">{pos.target_percentage}%</span>
                                      </div>
                                    </div>
                                    
                                    <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden relative">
                                      <div 
                                        className="h-full bg-income rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                                      />
                                      {pos.target_percentage > 0 && (
                                        <div 
                                          className="absolute top-0 bottom-0 w-0.5 bg-income/40 dark:bg-income/70"
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

              <Card className="p-5 lg:p-6 text-left">
                <h3 className="font-bold text-base text-primary flex items-center gap-2 mb-4">
                  <TrendingUp size={18} className="text-income" />
                  Por que possuo estes ativos?
                </h3>
                <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                  {positions.filter(pos => displayTheses[pos.ticker]).length === 0 ? (
                    <p className="text-xs text-secondary text-center py-4">Seu consultor ainda não anexou teses qualitativas este mês.</p>
                  ) : (
                    positions.filter(pos => displayTheses[pos.ticker]).map(pos => (
                      <div key={pos.ticker} className="p-3 modal-panel-glass border-glass rounded-lg space-y-1">
                         <div className="flex items-center justify-between text-xs font-bold text-primary">
                          <span>{pos.ticker}</span>
                          <span className="text-[10px] text-income font-semibold">{pos.target_percentage}% alvo</span>
                        </div>
                        <p className="text-[11px] text-secondary leading-relaxed pt-1">
                          {displayTheses[pos.ticker]}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </TabsContent>

          </Tabs>
        </>
      ) : (
        <Card className="border border-glass surface-glass relative overflow-hidden p-8 sm:p-12 text-center flex flex-col items-center max-w-lg mx-auto shadow-lg hover:border-glass-strong transition-all duration-300">
          <div className="absolute -top-12 -left-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
          <p className="text-secondary text-sm font-semibold">Nenhuma carteira ativa vinculada</p>
          <p className="text-xs text-secondary mt-2 max-w-sm leading-relaxed">
            Não encontramos nenhuma carteira ativa vinculada à sua conta pelo seu consultor. Entre em contato com seu assessor para inicializar seus investimentos.
          </p>
        </Card>
      )}
    </div>
  )
}
