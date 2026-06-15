import { useEffect, useState, useMemo, useRef, Fragment } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import KpiCard from '@/components/KpiCard'
import Button from '@/components/Button'
import IconButton from '@/components/IconButton'
import Input from '@/components/Input'
import Loader from '@/components/Loader'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import {
  formatCurrency,
  formatCurrencyByCode,
  formatPercentBR,
  formatQuantityBR,
  formatSignedPercentBR,
} from '@/utils/format'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, Layers, Trash2, Settings2, FileSpreadsheet, Edit2, Check, X, BarChart2, Search, ChevronDown, RefreshCw, Wallet } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'
import { useTheme } from '@/hooks/useTheme'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Select from '@/components/Select'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'

import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import AssetDefinitionFormModal from '@/components/investments/AssetDefinitionFormModal'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'
import AssetTransactionsModal from '@/components/investments/AssetTransactionsModal'
import LedgerBook from '@/components/consulting/LedgerBook'
import toast from 'react-hot-toast'
import GroupTargetModal from '@/components/investments/GroupTargetModal'
import { 
  AssetPosition, 
  ConsolidatedGroup, 
  calculateConsolidatedByClass, 
  calculateConsolidatedBySector 
} from '@/services/investmentEngine'

import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import { nonCashPortfolioPerformance } from '@/utils/portfolioDisplayMetrics'
import { usePortfolioClose } from '@/hooks/usePortfolioClose'
import { getAssetPrices, forceUpdateAssetPrice } from '@/services/priceService'
import type {
  PortfolioAssetDefinition,
  PortfolioGroupTarget,
  PortfolioTransaction,
  TargetAllocation,
} from '@/types'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'

type InvestmentsPortfolioData = {
  cashBalance: number
  investedValue: number
  cashValue: number
  totalValue: number
  positions: AssetPosition[]
  consolidatedClass: ConsolidatedGroup[]
  consolidatedSector: ConsolidatedGroup[]
}

type PortfolioValuationCache = {
  portfolioData?: InvestmentsPortfolioData
  transactions?: PortfolioTransaction[]
  groupTargets?: PortfolioGroupTarget[]
  assetDefinitions?: PortfolioAssetDefinition[]
}

export default function Investments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()
  const { colorPalette } = useTheme()

  const [activeTab, setActiveTab] = useState<string>('distribution')
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all')
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [hoveredPieSegment, setHoveredPieSegment] = useState<{ name: string; value: number; percent: number } | null>(null)
  const [selectedPieSegment, setSelectedPieSegment] = useState<{ name: string; value: number; percent: number; target: number } | null>(null)
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({})

  const toggleClassCollapsed = (className: string) => {
    setCollapsedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }))
  }

  const [activeKpiIndex, setActiveKpiIndex] = useState<number>(0)
  const [showFilters, setShowFilters] = useState<boolean>(false)

  const handleKpisScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget
    const cardWidth = container.clientWidth * 0.85
    const index = Math.round(container.scrollLeft / cardWidth)
    setActiveKpiIndex(index)
  }

  const chartContainerRef = useRef<HTMLDivElement>(null)

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

  // Dados da carteira sob consultoria
  const [portfolioData, setPortfolioData] = useState<InvestmentsPortfolioData | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  // Estados adicionais para integração e sincronização de ativos e metas
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)

  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [assetDefModalOpen, setAssetDefModalOpen] = useState(false)
  const [assetDefTicker, setAssetDefTicker] = useState('')

  // Estados para limites de exposição por classe e setor
  const [portfolioId, setPortfolioId] = useState<string>('')
  const [groupTargets, setGroupTargets] = useState<PortfolioGroupTarget[]>([])
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>([])
  const [valuationPrices, setValuationPrices] = useState<Record<string, import('@/types').AssetPrice>>({})
  const [indexRatesByIndexer, setIndexRatesByIndexer] = useState<Record<string, IndexRateMap>>({})
  const { closing: closingPortfolio, runClose } = usePortfolioClose()

  const sumClass = useMemo(() => {
    return groupTargets
      .filter((gt) => gt.group_type === 'class')
      .reduce((sum, gt) => sum + Number(gt.target_percentage || 0), 0)
  }, [groupTargets])

  const sumSector = useMemo(() => {
    return groupTargets
      .filter((gt) => gt.group_type === 'sector')
      .reduce((sum, gt) => sum + Number(gt.target_percentage || 0), 0)
  }, [groupTargets])

  const [showGroupTargetForm, setShowGroupTargetForm] = useState<boolean>(false)
  const [editingGroupTarget, setEditingGroupTarget] = useState<PortfolioGroupTarget | null>(null)

  const handleEditGroupTarget = (gt: PortfolioGroupTarget) => {
    setEditingGroupTarget(gt)
    setShowGroupTargetForm(true)
  }

  // Estados de controle do layout mobile
  const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({})
  const [limitsCollapsed, setLimitsCollapsed] = useState<boolean>(true)

  const toggleAssetExpanded = (ticker: string) => {
    setExpandedAssets(prev => ({
      ...prev,
      [ticker]: !prev[ticker]
    }))
  }

  // Estado do modal de transações detalhadas do ativo
  const [assetTxModalPosition, setAssetTxModalPosition] = useState<import('@/services/investmentEngine').AssetPosition | null>(null)

  const handleOpenAssetTxModal = (pos: import('@/services/investmentEngine').AssetPosition) => {
    setAssetTxModalPosition(pos)
  }

  const handleCloseAssetTxModal = () => {
    setAssetTxModalPosition(null)
  }



  const handleOpenTxModal = (tx?: PortfolioTransaction) => {
    setEditingTransaction(tx ?? null)
    setIsTxModalOpen(true)
  }

  const handleCloseTxModal = () => {
    setIsTxModalOpen(false)
    setEditingTransaction(null)
  }

  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    if (quickAdd === '1') {
      setEditingTransaction(null)
      setIsTxModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const [refreshing, setRefreshing] = useState(false)

  // Estados para edição inline de cotações
  const [editingPriceTicker, setEditingPriceTicker] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState<string>('')
  const [savingPrice, setSavingPrice] = useState<boolean>(false)

  // Estado para transitar entre a visualização de Classes e Setores
  const [consolidationView, setConsolidationView] = useState<'class' | 'sector'>('class')

  const uniqueClasses = useMemo(() => {
    if (!portfolioData?.positions) return []
    const classes = new Set<string>()
    portfolioData.positions.forEach(p => {
      if (p.asset_class && p.pricing_mode !== 'cash' && p.ticker !== 'SALDO_INV' && p.ticker !== 'CAIXA') {
        classes.add(p.asset_class)
      }
    })
    return Array.from(classes).sort()
  }, [portfolioData?.positions])

  const uniqueSectors = useMemo(() => {
    if (!portfolioData?.positions) return []
    const sectors = new Set<string>()
    portfolioData.positions.forEach(p => {
      if (p.sector && p.pricing_mode !== 'cash' && p.ticker !== 'SALDO_INV' && p.ticker !== 'CAIXA') {
        sectors.add(p.sector)
      }
    })
    return Array.from(sectors).sort()
  }, [portfolioData?.positions])

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
    if (!portfolioData) return []
    const groups = consolidationView === 'class' 
      ? portfolioData.consolidatedClass 
      : portfolioData.consolidatedSector
    
    return groups.filter(g => g.total_value > 0).map(g => ({
      name: g.name,
      value: g.total_value,
      percent: g.current_percentage,
      target: g.target_percentage,
      yield_pct: g.yield_pct,
      gross_yield_pct: g.gross_yield_pct,
      net_yield_pct: g.net_yield_pct
    }))
  }, [portfolioData, consolidationView])

  const filteredPositions = useMemo(() => {
    if (!portfolioData?.positions) return []
    return portfolioData.positions.filter((pos) => {
      if (pos.pricing_mode === 'cash' || pos.ticker === 'SALDO_INV' || pos.ticker === 'CAIXA') {
        return false
      }

      // Filter by class
      if (selectedClassFilter !== 'all') {
        const cls = pos.asset_class || 'Não classificado'
        if (cls !== selectedClassFilter) return false
      }

      // Filter by sector
      if (selectedSectorFilter !== 'all') {
        const sec = pos.sector || 'Outros'
        if (sec !== selectedSectorFilter) return false
      }

      // Search term
      if (searchTerm.trim() !== '') {
        const query = searchTerm.toLowerCase().trim()
        const tickerMatch = pos.ticker.toLowerCase().includes(query)
        const classMatch = (pos.asset_class || '').toLowerCase().includes(query)
        const sectorMatch = (pos.sector || '').toLowerCase().includes(query)
        if (!tickerMatch && !classMatch && !sectorMatch) return false
      }

      return true
    })
  }, [portfolioData?.positions, selectedClassFilter, selectedSectorFilter, searchTerm])

  const filteredPositionsByClass = useMemo<Record<string, AssetPosition[]>>(() => {
    const groups: Record<string, AssetPosition[]> = {}
    filteredPositions.forEach(pos => {
      const cls = pos.asset_class || 'Não classificado'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(pos)
    })
    return groups
  }, [filteredPositions])

  const activeGroupAssets = useMemo(() => {
    if (!selectedPieSegment || !portfolioData?.positions) return []
    return portfolioData.positions.filter(pos => {
      if (pos.pricing_mode === 'cash' || pos.ticker === 'SALDO_INV' || pos.ticker === 'CAIXA') return false
      if (consolidationView === 'class') {
        return (pos.asset_class || 'Não classificado') === selectedPieSegment.name
      } else {
        return (pos.sector || 'Outros') === selectedPieSegment.name
      }
    })
  }, [selectedPieSegment, portfolioData?.positions, consolidationView])

  const handleSaveInlinePrice = async (ticker: string) => {
    try {
      setSavingPrice(true)
      const numericPrice = parseFloat(editingPriceValue)
      if (isNaN(numericPrice) || numericPrice < 0) {
        toast.error('Preço inválido')
        return
      }
      
      await forceUpdateAssetPrice(ticker, numericPrice)
      
      toast.success('Cotação atualizada!')
      setEditingPriceTicker(null)
      await loadPortfolio()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar cotação')
    } finally {
      setSavingPrice(false)
    }
  }

  const handleDailyClose = async () => {
    if (!portfolioId || transactions.length === 0) {
      toast.error('Cadastre transações antes do fechamento.')
      return
    }
    const prices =
      Object.keys(valuationPrices).length > 0
        ? valuationPrices
        : await getAssetPrices(
            Array.from(new Set(transactions.map((t) => t.ticker.toUpperCase()))),
            { forceRefresh: true }
          )
    await runClose({
      portfolioId,
      transactions,
      definitions: assetDefinitions,
      targets: targetAllocations,
      prices,
      cashBalance: portfolioData?.cashBalance ?? 0,
      indexRatesByIndexer,
    })
    await loadPortfolio({ forceRefresh: true })
  }

  const handleForceRefresh = async () => {
    try {
      setRefreshing(true)
      await loadPortfolio({ forceRefresh: true })
      toast.success('Cotações atualizadas com sucesso!')
    } catch (err) {
      toast.error('Erro ao atualizar cotações.')
    } finally {
      setRefreshing(false)
    }
  }

  async function loadPortfolio(options?: { forceRefresh?: boolean }) {
    try {

      
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const userCacheKey = `portfolio-valuation-data-${user.id}`

      // Try cache first if not forcing refresh
      if (!options?.forceRefresh && !portfolioData) {
        const cached = await getCache<PortfolioValuationCache>(userCacheKey)
        if (cached) {
          if (cached.portfolioData) setPortfolioData(cached.portfolioData)
          if (cached.transactions) setTransactions(cached.transactions)
          if (cached.groupTargets) setGroupTargets(cached.groupTargets)
          if (cached.assetDefinitions) setAssetDefinitions(cached.assetDefinitions)
        }
      }

      setPortfolioLoading(!portfolioData)

      // 1. Verificar e Criar Portfolio se não existir
      let { data: portfolio } = await supabase
        .from('portfolios')
        .select('id, cash_balance')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: user.id, cash_balance: 0.00 })
          .select('id, cash_balance')
          .single()
        
        if (createError) throw createError
        portfolio = newPort
      }

      setPortfolioId(portfolio.id)

      // 3. Carregar os dados atualizados do portfolio
      const transactionsData = await fetchAllPortfolioTransactions(portfolio.id)

      const { data: targets } = await supabase
        .from('target_allocations')
        .select('*')
        .eq('portfolio_id', portfolio.id)

      const { data: groupTargetsData } = await supabase
        .from('portfolio_group_targets')
        .select('*')
        .eq('portfolio_id', portfolio.id)

      const finalTransactions = transactionsData || []
      const finalGroupTargets = groupTargetsData || []

      setTransactions(finalTransactions)
      setGroupTargets(finalGroupTargets)
      setTargetAllocations(targets || [])

      if (finalTransactions.length === 0) {
        const emptyPortfolio = {
          cashBalance: 0,
          investedValue: 0,
          cashValue: 0,
          totalValue: 0,
          positions: [],
          consolidatedClass: [],
          consolidatedSector: []
        }
        setPortfolioData(emptyPortfolio)
        
        // Cache the empty portfolio
        await setCache(userCacheKey, {
          portfolioData: emptyPortfolio,
          transactions: finalTransactions,
          groupTargets: finalGroupTargets,
          assetDefinitions: []
        })
        return
      }

      const valuation = await loadPortfolioValuation(
        portfolio.id,
        finalTransactions,
        targets || [],
        Number(portfolio.cash_balance) || 0,
        { forceRefresh: options?.forceRefresh }
      )

      setAssetDefinitions(valuation.definitions)
      setValuationPrices(valuation.prices)
      setIndexRatesByIndexer(valuation.indexRatesByIndexer)

      const { positions, investedValue, cashValue, totalValue } = valuation
      const consolidatedClass = calculateConsolidatedByClass(positions, totalValue, finalGroupTargets)
      const consolidatedSector = calculateConsolidatedBySector(positions, totalValue, finalGroupTargets)

      const nextPortfolioData = {
        cashBalance: valuation.cashBalance,
        investedValue,
        cashValue,
        totalValue,
        positions,
        consolidatedClass,
        consolidatedSector
      }

      setPortfolioData(nextPortfolioData)

      // Save to cache
      await setCache(userCacheKey, {
        portfolioData: nextPortfolioData,
        transactions: finalTransactions,
        groupTargets: finalGroupTargets,
        assetDefinitions: valuation.definitions
      })
    } catch (err) {
      console.error('Erro ao carregar carteira de consultoria em investimentos:', err)
      toast.error('Erro ao sincronizar dados da carteira: RLS ou conexão.')
    } finally {
      setPortfolioLoading(false)
    }
  }

  useEffect(() => {
    if (isOnline) {
      loadPortfolio()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega ao reconectar; loadPortfolio depende do estado local
  }, [isOnline])

  // Fechamento diário automático: executa uma vez por dia via localStorage
  // O guard persiste entre recargas de página enquanto for o mesmo dia
  useEffect(() => {
    const LS_KEY = 'portfolio_auto_close_date'
    const today = new Date().toISOString().slice(0, 10)
    const lastClosed = localStorage.getItem(LS_KEY)
    if (
      portfolioId &&
      transactions.length > 0 &&
      Object.keys(valuationPrices).length > 0 &&
      !portfolioLoading &&
      !closingPortfolio &&
      lastClosed !== today
    ) {
      localStorage.setItem(LS_KEY, today)
      void handleDailyClose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, transactions, valuationPrices, portfolioLoading])





  const handleDeleteGroupTarget = async (id: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_group_targets')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Limite excluído!')
      loadPortfolio()
    } catch (err) {
      toast.error('Erro ao excluir limite')
    }
  }



  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.investments.title}
        subtitle={PAGE_HEADERS.investments.description}
        action={
          <PageHeaderActions launchModalOpen={isTxModalOpen}>
            <PageHeaderActionButton
              intent="income"
              icon={FileSpreadsheet}
              label="Conciliação B3"
              compactOnMobile={false}
              onClick={() => setIsReconciliationOpen(true)}
            />
            <PageHeaderActionButton
              actionRole="launch"
              intent="balance"
              icon={Plus}
              label="Lançar transação"
              compactOnMobile={false}
              onClick={() => handleOpenTxModal()}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-page-enter">
        {portfolioLoading ? (
          <Loader text="Carregando sua carteira..." className="py-12" />
        ) : portfolioData && (
          <div className="space-y-6 animate-fade-in">
            {/* Cards de KPIs da Consultoria */}
            {(() => {
              const { yieldPct: consolidatedYield, gainBrl: consolidatedGain } =
                nonCashPortfolioPerformance(portfolioData.positions, 'gross')
              const isPositive = consolidatedYield >= 0
              const totalCash = portfolioData.cashValue

              return (
                <div className="flex flex-col gap-2">
                  <div 
                    onScroll={handleKpisScroll}
                    className="flex overflow-x-auto gap-3 pb-2 scrollbar-none snap-x snap-mandatory sm:grid sm:grid-cols-3 sm:gap-4 sm:pb-0 sm:items-stretch"
                  >
                    <KpiCard
                      title="Patrimônio Investido"
                      value={formatCurrency(portfolioData.investedValue)}
                      subtext="Valor total de investimentos"
                      icon={<Briefcase size={16} className="w-4 h-4" />}
                      glowColor="var(--color-income)"
                      showGlow={true}
                      index={1}
                      className="flex-none w-[90%] sm:w-auto sm:h-full snap-center"
                    />

                    <KpiCard
                      title="Saldo em Caixa"
                      value={formatCurrency(totalCash)}
                      subtext="Disponível para novos aportes"
                      icon={<Wallet size={16} className="w-4 h-4" />}
                      glowColor="var(--color-balance)"
                      showGlow={false}
                      index={2}
                      className="flex-none w-[90%] sm:w-auto sm:h-full snap-center"
                    />

                    <KpiCard
                      title="Rentabilidade Consolidada"
                      value={
                        <div className="flex items-baseline gap-1.5 flex-wrap">
                          <p className={`text-sm xs:text-base sm:text-2xl font-black font-mono flex items-center ${
                            isPositive ? 'text-income' : 'text-expense'
                          }`}>
                            {formatSignedPercentBR(consolidatedYield)}
                          </p>
                          <span className={`text-[10px] sm:text-xs font-semibold font-mono whitespace-nowrap ${
                            consolidatedGain >= 0 ? 'text-income' : 'text-expense'
                          }`}>
                            ({consolidatedGain >= 0 ? '+' : ''}{formatCurrency(consolidatedGain)})
                          </span>
                        </div>
                      }
                      subtext="Retorno sobre o capital investido"
                      icon={<TrendingUp size={16} className="w-4 h-4" />}
                      glowColor={isPositive ? 'var(--color-income)' : 'var(--color-expense)'}
                      showGlow={true}
                      isTrendPositive={isPositive}
                      index={3}
                      className="flex-none w-[90%] sm:w-auto sm:h-full snap-center"
                    />
                  </div>
                  {/* Pontos de paginação apenas no mobile */}
                  <div className="flex justify-center gap-1.5 mt-1 sm:hidden">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                          activeKpiIndex === i ? 'bg-primary w-3.5' : 'bg-primary/20'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )
            })()}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid grid-cols-3 w-full max-w-md mx-auto mb-6">
                <TabsTrigger value="distribution" className="text-xs font-bold gap-1.5">
                  <Layers size={14} />
                  <span>Distribuição</span>
                </TabsTrigger>
                <TabsTrigger value="assets" className="text-xs font-bold gap-1.5">
                  <Briefcase size={14} />
                  <span>Meus Ativos</span>
                </TabsTrigger>
                <TabsTrigger value="history" className="text-xs font-bold gap-1.5">
                  <TrendingUp size={14} />
                  <span>Histórico</span>
                </TabsTrigger>
              </TabsList>

              {/* Aba 1: Distribuição & Alocação */}
              <TabsContent value="distribution" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                  
                  {/* Card do Gráfico de Rosca */}
                  <Card className="p-4 lg:p-6 flex flex-col items-center relative overflow-hidden">
                    <div className="w-full flex items-center justify-between gap-3 mb-4 pb-2 border-b border-primary/5">
                      <h4 className="text-xs font-black uppercase tracking-wider text-primary">Alocação Atual</h4>
                      
                      {/* Switcher de Consolidação */}
                      <div className="relative inline-flex items-center border border-glass surface-glass p-0.5 rounded-full select-none shrink-0 shadow-sm h-[32px] w-40 overflow-hidden">
                        {/* Camada Estática de Fundo (Texto Secundário) */}
                        <div className="absolute inset-0 flex items-center text-[10px] font-black uppercase tracking-wider text-secondary pointer-events-none">
                          <span className="w-1/2 text-center">Classes</span>
                          <span className="w-1/2 text-center">Setores</span>
                        </div>

                        {/* Botão Seletor Deslizante (Pill com Máscara e Cores Ativas) */}
                        <div 
                          className="absolute top-[2px] bottom-[2px] left-[2px] w-[calc(50%-2px)] rounded-full transition-transform duration-300 ease-out bg-background border border-glass/40 shadow-sm overflow-hidden pointer-events-none"
                          style={{
                            transform: consolidationView === 'class' ? 'translateX(0px)' : 'translateX(78px)'
                          }}
                        >
                          {/* Texto Estacionário Interno (Revelado pela Máscara do Seletor) */}
                          <div 
                            className="absolute top-0 bottom-0 left-[-2px] w-40 flex items-center text-[10px] font-black uppercase tracking-wider transition-transform duration-300 ease-out pointer-events-none"
                            style={{
                              transform: consolidationView === 'class' ? 'translateX(0px)' : 'translateX(-78px)'
                            }}
                          >
                            <span className="w-1/2 text-center text-[var(--color-balance)]">Classes</span>
                            <span className="w-1/2 text-center text-[var(--color-income)]">Setores</span>
                          </div>
                        </div>

                        {/* Camada Interativa (Botões do Componente Invisíveis por cima) */}
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setConsolidationView('class')
                            setSelectedPieSegment(null)
                          }}
                          className="relative z-10 w-1/2 h-full opacity-0 cursor-pointer hover:bg-transparent !min-h-0 py-0"
                          title="Exibir Classes"
                        >
                          Classes
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setConsolidationView('sector')
                            setSelectedPieSegment(null)
                          }}
                          className="relative z-10 w-1/2 h-full opacity-0 cursor-pointer hover:bg-transparent !min-h-0 py-0"
                          title="Exibir Setores"
                        >
                          Setores
                        </Button>
                      </div>
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
                          className="relative w-full h-64 sm:h-80 flex items-center justify-center cursor-pointer"
                        >
                          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
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
                                    : formatCurrency(portfolioData.totalValue))}
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

                        {/* Botão de Ver Ativos Detalhados quando uma fatia está selecionada */}
                        {selectedPieSegment && (
                          <div className="w-full flex justify-center animate-fade-in mt-1 select-none">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (consolidationView === 'class') {
                                  setSelectedClassFilter(selectedPieSegment.name)
                                  setSelectedSectorFilter('all')
                                } else {
                                  setSelectedSectorFilter(selectedPieSegment.name)
                                  setSelectedClassFilter('all')
                                }
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
                  <Card className="p-4 lg:p-6 flex flex-col text-left">
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
                            const diffValue = portfolioData.totalValue * (targetPct / 100) - pos.total_value

                            let statusColor = 'text-secondary'
                            let statusBg = 'bg-secondary/40'
                            let statusText = 'Sem meta'

                            if (targetPct > 0) {
                              if (devPct > 1.0) {
                                statusColor = 'text-expense'
                                statusBg = 'bg-expense/10'
                                statusText = `Venda sugerida: -${formatCurrencyByCode(Math.abs(diffValue), pos.currency)}`
                              } else if (devPct < -1.0) {
                                statusColor = 'text-income'
                                statusBg = 'bg-income/10'
                                statusText = `Aporte sugerido: +${formatCurrencyByCode(diffValue, pos.currency)}`
                              } else {
                                statusColor = 'text-primary'
                                statusBg = 'bg-primary border border-primary/30'
                                statusText = 'Alinhado'
                              }
                            }

                            return (
                              <div 
                                key={pos.ticker} 
                                onClick={() => {
                                  setSearchTerm(pos.ticker)
                                  setSelectedClassFilter('all')
                                  setSelectedSectorFilter('all')
                                  setActiveTab('assets')
                                }}
                                className="p-3 bg-secondary/50 border border-primary rounded-xl flex flex-col gap-2 text-left cursor-pointer hover:border-primary/80 transition-all select-none"
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
                                  <div className="w-full h-1.5 rounded-full bg-primary relative overflow-hidden">
                                    <div 
                                      className="h-full bg-income rounded-full transition-all duration-500" 
                                      style={{ width: `${Math.min(pos.current_percentage, 100)}%` }} 
                                    />
                                    {targetPct > 0 && (
                                      <div 
                                        className="absolute top-0 bottom-0 w-0.5 bg-primary-dark/60 dark:bg-white/60"
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
                          ? portfolioData.consolidatedClass 
                          : portfolioData.consolidatedSector
                        ).map((group, index) => {
                          const targetPct = group.target_percentage || 0
                          const currentPct = group.current_percentage || 0
                          const devPct = currentPct - targetPct
                          const diffValue = portfolioData.totalValue * (targetPct / 100) - group.total_value

                          let statusColor = 'text-secondary'
                          let statusBg = 'bg-secondary/40'
                          let statusText = 'Sem meta'

                          if (targetPct > 0) {
                            if (devPct > 1.5) {
                              statusColor = 'text-expense'
                              statusBg = 'bg-expense/10'
                              statusText = `Venda sugerida: -${formatCurrency(Math.abs(diffValue))}`
                            } else if (devPct < -1.5) {
                              statusColor = 'text-income'
                              statusBg = 'bg-income/10'
                              statusText = `Aporte sugerido: +${formatCurrency(diffValue)}`
                            } else {
                              statusColor = 'text-primary'
                              statusBg = 'bg-primary border border-primary/30'
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
                              className="p-3 bg-secondary/50 border border-primary rounded-xl flex flex-col gap-2 text-left cursor-pointer hover:border-primary/80 transition-all select-none"
                            >
                              <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span 
                                    className="w-2.5 h-2.5 rounded-full shrink-0" 
                                    style={{ backgroundColor: chartPalette[index % chartPalette.length] }} 
                                  />
                                  <span className="font-bold text-primary text-xs tracking-wide truncate">{group.name}</span>
                                </div>
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${statusBg} ${statusColor} shrink-0`}>
                                  {statusText}
                                </span>
                              </div>

                              {/* Barra horizontal de alocação vs alvo */}
                              <div className="space-y-1">
                                <div className="w-full h-1.5 rounded-full bg-primary relative overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      consolidationView === 'class' ? 'bg-balance' : 'bg-income'
                                    }`} 
                                    style={{ width: `${Math.min(group.current_percentage, 100)}%` }} 
                                  />
                                  {targetPct > 0 && (
                                    <div 
                                      className="absolute top-0 bottom-0 w-0.5 bg-primary-dark/60 dark:bg-white/60"
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

                {/* Limites de Exposição - Fica no rodapé da Distribuição */}
                <div className="bg-secondary/40 border border-primary p-4 rounded-2xl space-y-4">
                  <div 
                    onClick={() => setLimitsCollapsed(!limitsCollapsed)}
                    className="flex items-center justify-between gap-3 text-left cursor-pointer hover:opacity-85 transition-opacity duration-200 select-none"
                  >
                    <div className="flex items-start gap-2.5">
                      <Layers size={18} className="text-balance shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-black text-primary">Configurar Limites de Exposição Alvo</h4>
                        <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                          Defina metas de exposição percentuais para equilibrar e guiar o rebalanceamento automático da sua carteira.
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-secondary shrink-0">
                      <span className="text-[10px] font-black bg-balance/10 text-balance px-2 py-0.5 rounded-full font-mono">
                        {groupTargets.filter((gt) => gt.group_type === consolidationView).length}
                      </span>
                      <Plus 
                        size={16} 
                        className={`transition-transform duration-300 ${!limitsCollapsed ? 'rotate-45 text-primary' : 'rotate-0 text-secondary/60'}`} 
                      />
                    </div>
                  </div>

                  <div className={`pt-3 border-t border-primary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-left w-full ${
                    limitsCollapsed ? 'hidden' : 'grid'
                  }`}>
                    {groupTargets
                      .filter((gt) => gt.group_type === consolidationView)
                      .map((gt) => (
                        <div 
                          key={gt.id} 
                          onClick={() => handleEditGroupTarget(gt)}
                          className="cursor-pointer flex items-center justify-between p-3.5 bg-primary border border-primary/50 rounded-2xl shadow-sm hover:border-balance/30 active:bg-secondary/40 transition-all select-none animate-page-enter w-full"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex flex-col text-left">
                              <span className="text-secondary uppercase text-[7px] font-extrabold tracking-wider leading-none">
                                {gt.group_type === 'class' ? 'Classe' : 'Setor'}
                              </span>
                              <span className="text-primary font-black text-xs sm:text-sm mt-0.5 leading-tight">
                                {gt.group_name}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="h-6 w-[1px] bg-primary/25" />
                            <span className="font-mono text-balance font-black text-sm">{gt.target_percentage}%</span>
                            <IconButton
                               type="button"
                               variant="danger"
                               size="sm"
                               icon={<Trash2 size={13} />}
                               label="Remover limite"
                               onClick={(e) => {
                                 e.stopPropagation()
                                 handleDeleteGroupTarget(gt.id)
                               }}
                               className="!rounded-xl"
                            />
                          </div>
                        </div>
                      ))}

                    {(consolidationView === 'class' ? sumClass < 100 : sumSector < 100) && (
                      <div 
                        onClick={() => {
                          setEditingGroupTarget(null);
                          setShowGroupTargetForm(true);
                        }}
                        className="cursor-pointer flex items-center justify-center gap-2 p-3.5 bg-secondary/30 border border-dashed border-balance/35 hover:border-balance/60 rounded-2xl transition-all select-none animate-page-enter w-full h-[62px] text-balance hover:bg-balance/5 hover:scale-[1.01]"
                      >
                        <Plus size={15} className="text-balance" />
                        <span className="text-xs font-black uppercase tracking-wider">Novo Limite</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Aba 2: Detalhamento de Ativos */}
              <TabsContent value="assets" className="space-y-4">
                <Card className="p-4 lg:p-6 space-y-4">
                  
                  <div className="flex flex-col gap-4">
                    {/* Header da aba com ícone, badge de contagem e botão de atualização */}
                    <div className="flex items-center justify-between gap-3 pb-3 border-b border-primary/5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="p-1.5 rounded-xl bg-income/10 shrink-0">
                          <Briefcase size={15} className="text-income" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-primary leading-tight">Meus Ativos</h3>
                          <p className="text-[10px] text-secondary font-medium leading-none mt-0.5 hidden sm:block">
                            Posições valorizadas a mercado
                          </p>
                        </div>
                        {filteredPositions.length > 0 && (
                          <span className="text-[10px] font-black font-mono bg-income/10 text-income px-2 py-0.5 rounded-full shrink-0 animate-fade-in">
                            {filteredPositions.length}
                          </span>
                        )}
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleForceRefresh}
                        disabled={refreshing || portfolioLoading}
                        className="flex items-center gap-1.5 h-8 px-3 text-secondary hover:text-primary hover:bg-secondary/60 font-semibold text-xs shrink-0 rounded-xl"
                        title="Atualizar cotações"
                      >
                        <RefreshCw
                          size={13}
                          className={refreshing ? 'animate-spin text-income' : 'text-secondary'}
                        />
                        <span className="hidden sm:inline text-[11px]">
                          {refreshing ? 'Atualizando...' : 'Atualizar'}
                        </span>
                      </Button>
                    </div>

                    {/* Barra de Filtros e Busca */}
                    <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3 w-full">
                      {/* Busca por Ticker com botão de filtros no mobile */}
                      <div className="flex items-center gap-2 w-full">
                        <div className="relative flex-1">
                          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-secondary/60 pointer-events-none" />
                          <Input
                            type="text"
                            placeholder="Buscar ativo por ticker..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="!pl-10 text-sm font-semibold !py-2.5 w-full bg-secondary/20"
                          />
                          {searchTerm && (
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => setSearchTerm('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary p-1 !min-h-0 h-auto w-auto"
                            >
                              <X size={14} />
                            </Button>
                          )}
                        </div>

                        {/* Botão de Filtros Adicionais no Mobile */}
                        <Button
                          type="button"
                          variant={selectedClassFilter !== 'all' || selectedSectorFilter !== 'all' ? 'outline' : 'ghost'}
                          onClick={() => setShowFilters(!showFilters)}
                          className={`sm:hidden flex items-center gap-1.5 px-3 h-10 shrink-0 ${
                            selectedClassFilter !== 'all' || selectedSectorFilter !== 'all'
                              ? 'border-balance/40 text-balance bg-balance/5'
                              : 'border-primary/20 text-secondary hover:text-primary'
                          }`}
                        >
                          <Settings2 size={16} />
                          <span className="text-xs font-bold">Filtros</span>
                          {(selectedClassFilter !== 'all' || selectedSectorFilter !== 'all') && (
                            <span className="w-1.5 h-1.5 rounded-full bg-balance animate-pulse" />
                          )}
                        </Button>
                      </div>

                      {/* Filtros de Seleção (Sempre visíveis no desktop, colapsáveis no mobile) */}
                      <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:col-span-2 gap-3 w-full animate-fade-in`}>
                        {/* Filtro por Classe */}
                        <Select
                          value={selectedClassFilter}
                          onChange={(e) => setSelectedClassFilter(e.target.value)}
                          options={[
                            { value: 'all', label: 'Todas as Classes' },
                            ...uniqueClasses.map((cls) => ({ value: cls, label: cls })),
                          ]}
                          placeholder="Filtrar por classe..."
                          className="w-full"
                        />

                        {/* Filtro por Setor */}
                        <Select
                          value={selectedSectorFilter}
                          onChange={(e) => setSelectedSectorFilter(e.target.value)}
                          options={[
                            { value: 'all', label: 'Todos os Setores' },
                            ...uniqueSectors.map((sec) => ({ value: sec, label: sec })),
                          ]}
                          placeholder="Filtrar por setor..."
                          className="w-full"
                        />
                      </div>
                    </div>

                    {/* Banner de filtros ativos */}
                    {(selectedClassFilter !== 'all' || selectedSectorFilter !== 'all') && (
                      <div className="flex items-center justify-between p-3 bg-balance/5 border border-balance/25 rounded-2xl animate-fade-in select-none text-left">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <Briefcase size={14} className="text-balance shrink-0" />
                          <span className="text-xs text-primary leading-tight truncate">
                            Filtros ativos:{' '}
                            {selectedClassFilter !== 'all' && (
                              <span>Classe: <strong className="font-extrabold text-balance">{selectedClassFilter}</strong></span>
                            )}
                            {selectedClassFilter !== 'all' && selectedSectorFilter !== 'all' && ' | '}
                            {selectedSectorFilter !== 'all' && (
                              <span>Setor: <strong className="font-extrabold text-balance">{selectedSectorFilter}</strong></span>
                            )}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => {
                            setSelectedClassFilter('all')
                            setSelectedSectorFilter('all')
                          }}
                          className="text-xs text-secondary hover:text-primary font-bold flex items-center gap-1 leading-none hover:bg-secondary/40 px-2.5 py-1 rounded-xl transition-all shrink-0"
                        >
                          <X size={12} />
                          Limpar Filtros
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* 1. Tabela para Desktop */}
                  <div className="hidden md:block overflow-x-auto border border-glass rounded-2xl ring-1 ring-primary/5">
                    <table className="w-full border-collapse text-left text-sm">
                      <thead>
                        <tr className="surface-glass border-b border-glass text-[10px] font-black text-secondary uppercase tracking-widest">
                          <th className="px-4 py-3">Ativo</th>
                          <th className="px-4 py-3">Classe</th>
                          <th className="px-4 py-3">Setor</th>
                          <th className="px-4 py-3 text-right">Qtd</th>
                          <th className="px-4 py-3 text-right">Cotação</th>
                          <th className="px-4 py-3 text-right">Valor Total</th>
                          <th className="px-4 py-3 text-right">Rent. Bruta</th>
                          <th className="px-4 py-3 text-center">Real</th>
                          <th className="px-4 py-3 text-center">Alvo</th>
                          <th className="px-4 py-3 text-center">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-glass">
                        {Object.entries(filteredPositionsByClass).length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-12 text-center">
                              <div className="flex flex-col items-center gap-3 text-secondary">
                                <Search size={28} className="opacity-30" />
                                <p className="text-sm font-semibold">Nenhum ativo encontrado</p>
                                <p className="text-xs opacity-70">Tente ajustar os filtros ativos</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          Object.entries(filteredPositionsByClass).map(([className, classPositions]) => {
                            const isCollapsed = !!collapsedClasses[className]
                            return (
                              <Fragment key={className}>
                                {/* Linha de cabeçalho do grupo de classe (Clicável para recolher) */}
                                <tr 
                                  onClick={() => toggleClassCollapsed(className)}
                                  className="surface-glass border-l-4 border-l-[var(--color-income)] text-primary cursor-pointer hover:bg-secondary/70 transition-colors select-none"
                                >
                                  <td colSpan={10} className="px-4 py-2.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-secondary">{className}</span>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[9px] font-black bg-income/10 text-income px-2 py-0.5 rounded-full font-mono">
                                          {classPositions.length} {classPositions.length === 1 ? 'ativo' : 'ativos'}
                                        </span>
                                        <ChevronDown
                                          size={13}
                                          className={`text-secondary/60 transition-transform duration-300 ${isCollapsed ? '-rotate-90' : 'rotate-0'}`}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                                
                                {/* Linhas de posições do grupo */}
                                {!isCollapsed && classPositions.map((pos) => {
                                  const isPositive = pos.gross_yield_pct >= 0
                                  return (
                                    <tr
                                      key={pos.ticker}
                                      className="hover:bg-secondary/50 transition-colors cursor-pointer group/row"
                                      onClick={() => handleOpenAssetTxModal(pos)}
                                      title="Ver transações do ativo"
                                    >
                                      <td className={`px-4 py-3 pl-7 font-bold text-primary border-l-4 ${isPositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'}`}>
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="font-mono font-black text-xs tracking-wider">{pos.ticker}</span>
                                          {pos.pricing_mode === 'market' && pos.is_b3_linked && (pos.quotation_status === 'stale' || pos.quotation_status === 'unavailable') && (
                                            <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-warning/10 text-warning font-sans">
                                              Desatualizada
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="text-[10px] font-semibold text-secondary bg-secondary/60 px-2 py-0.5 rounded-md">
                                          {pos.asset_class || 'Não classificado'}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-xs text-secondary font-medium">{pos.sector || 'Outros'}</td>
                                      <td className="px-4 py-3 text-right font-mono text-xs text-primary font-semibold">
                                        {formatQuantityBR(pos.quantity)}
                                      </td>
                                      <td className="px-4 py-3 text-right text-secondary">
                                        {editingPriceTicker === pos.ticker ? (
                                          <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={editingPriceValue}
                                              onChange={(e) => setEditingPriceValue(e.target.value)}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleSaveInlinePrice(pos.ticker)
                                                if (e.key === 'Escape') setEditingPriceTicker(null)
                                              }}
                                              disabled={savingPrice}
                                              className="!w-20 !py-0.5 !px-1.5 text-xs text-right !border-balance font-mono"
                                              autoFocus
                                            />
                                            <IconButton
                                              type="button"
                                              variant="success"
                                              size="sm"
                                              icon={<Check size={12} />}
                                              label="Salvar"
                                              onClick={() => handleSaveInlinePrice(pos.ticker)}
                                              disabled={savingPrice}
                                              className="!rounded"
                                            />
                                            <IconButton
                                              type="button"
                                              variant="danger"
                                              size="sm"
                                              icon={<X size={12} />}
                                              label="Cancelar"
                                              onClick={() => setEditingPriceTicker(null)}
                                              disabled={savingPrice}
                                              className="!rounded"
                                            />
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-end gap-1 select-none" onClick={(e) => e.stopPropagation()}>
                                            <span className="font-mono text-xs">{formatCurrencyByCode(pos.current_price, pos.currency)}</span>
                                            {pos.pricing_mode === 'market' && (
                                              <IconButton
                                                type="button"
                                                size="sm"
                                                icon={<Edit2 size={11} className="shrink-0" />}
                                                label="Editar cotação manualmente"
                                                onClick={() => {
                                                  setEditingPriceTicker(pos.ticker)
                                                  setEditingPriceValue(pos.current_price.toString())
                                                }}
                                                className="opacity-0 group-hover/row:opacity-100 !rounded transition-all"
                                              />
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-right font-mono text-xs text-primary font-black">{formatCurrencyByCode(pos.total_value, pos.currency)}</td>
                                      <td className={`px-4 py-3 text-right font-mono text-xs font-black ${pos.gross_yield_pct >= 0 ? 'text-income' : 'text-expense'}`}>
                                        {formatSignedPercentBR(pos.gross_yield_pct)}
                                      </td>
                                      <td className="px-4 py-3 text-center font-mono text-xs font-bold text-primary">{formatPercentBR(pos.current_percentage, 1)}</td>
                                      <td className="px-4 py-3 text-center font-mono text-xs font-bold text-income">
                                        {formatPercentBR(pos.target_percentage, 0)}
                                      </td>
                                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                        <IconButton
                                          type="button"
                                          size="sm"
                                          icon={<Settings2 size={14} />}
                                          label="Configurar Ativo"
                                          onClick={() => {
                                            setAssetDefTicker(pos.ticker)
                                            setAssetDefModalOpen(true)
                                          }}
                                        />
                                      </td>
                                    </tr>
                                  )
                                })}
                              </Fragment>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 2. Visualização em Cards para Mobile */}
                  <div className="block md:hidden space-y-4">
                    {Object.entries(filteredPositionsByClass).length === 0 ? (
                      <div className="flex flex-col items-center gap-3 py-10 text-secondary animate-fade-in">
                        <div className="w-12 h-12 rounded-2xl bg-secondary/60 flex items-center justify-center">
                          <Search size={20} className="opacity-40" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold">Nenhum ativo encontrado</p>
                          <p className="text-xs opacity-70 mt-0.5">Tente ajustar os filtros ativos</p>
                        </div>
                      </div>
                    ) : (
                      Object.entries(filteredPositionsByClass).map(([className, classPositions]) => {
                        const isClassCollapsed = !!collapsedClasses[className]
                        return (
                          <div key={className} className="space-y-2 text-left animate-page-enter">
                            {/* Cabeçalho do Grupo de Classe (Clicável para recolher) — glass premium */}
                            <div 
                              onClick={() => toggleClassCollapsed(className)}
                              className="flex items-center justify-between surface-glass border border-glass border-l-4 border-l-[var(--color-income)] px-3.5 py-2.5 rounded-xl select-none text-left cursor-pointer hover:bg-secondary/60 active:bg-secondary/80 transition-colors"
                            >
                              <span className="text-[10px] font-black uppercase tracking-widest text-secondary">{className}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black bg-income/10 text-income px-2 py-0.5 rounded-full font-mono">
                                  {classPositions.length} {classPositions.length === 1 ? 'ativo' : 'ativos'}
                                </span>
                                <ChevronDown
                                  size={12}
                                  className={`text-secondary/60 transition-transform duration-300 ${
                                    isClassCollapsed ? '-rotate-90' : 'rotate-0'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Cards de Ativos */}
                            {!isClassCollapsed && (
                              <div className="space-y-2.5">
                                {classPositions.map((pos) => {
                                  const isGrossPositive = pos.gross_yield_pct >= 0;
                                  const isExpanded = !!expandedAssets[pos.ticker];
                                  
                                  return (
                                    <div 
                                      key={pos.ticker}
                                      className={`surface-glass border-glass border-l-4 ${isGrossPositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'} rounded-2xl overflow-hidden animate-page-enter`}
                                    >
                                      {/* Cabeçalho compacto clicável */}
                                      <div 
                                        onClick={() => toggleAssetExpanded(pos.ticker)}
                                        className="px-4 py-3.5 flex items-center justify-between cursor-pointer hover:bg-secondary/30 active:bg-secondary/50 transition-colors select-none"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span className={`w-2 h-2 rounded-full shrink-0 ${isGrossPositive ? 'bg-income' : 'bg-expense'}`} />
                                          <div className="text-left min-w-0">
                                            <span className="font-mono font-black text-primary text-[13px] block leading-tight tracking-wider truncate">
                                              {pos.ticker}
                                            </span>
                                            <span className="text-[10px] text-secondary font-medium block truncate">
                                              {pos.sector || pos.asset_class || 'Outros'}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-3 text-right shrink-0">
                                          <div>
                                            <span className="text-xs font-black text-primary font-mono block leading-tight">
                                              {formatCurrencyByCode(pos.total_value, pos.currency)}
                                            </span>
                                            <span className={`text-[10px] font-bold font-mono block ${isGrossPositive ? 'text-income' : 'text-expense'}`}>
                                              {formatSignedPercentBR(pos.gross_yield_pct)}
                                            </span>
                                          </div>
                                          <ChevronDown
                                            size={14}
                                            className={`text-secondary/60 transition-transform duration-300 shrink-0 ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                                          />
                                        </div>
                                      </div>
          
                                      {/* Conteúdo Expandido — animação CSS max-height */}
                                      <div
                                        className={`overflow-hidden transition-all duration-300 ease-out ${
                                          isExpanded ? 'max-h-[700px] opacity-100' : 'max-h-0 opacity-0'
                                        }`}
                                      >
                                        <div className="px-4 pb-4 pt-3 border-t border-primary/10 space-y-3.5 bg-secondary/10 text-left">
                                          {/* Grid de Métricas — 2x2 com separadores */}
                                          <div className="grid grid-cols-2 gap-0 rounded-xl border border-primary/10 overflow-hidden">
                                            <div className="p-3 bg-secondary/30">
                                              <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">Quantidade</span>
                                              <span className="text-xs font-bold text-primary font-mono">
                                                {formatQuantityBR(pos.quantity)}
                                              </span>
                                            </div>

                                            <div className="p-3 bg-secondary/30 border-l border-primary/10">
                                              <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">Custo Total</span>
                                              <span className="text-xs font-bold text-primary font-mono">
                                                {formatCurrencyByCode(pos.cost_basis, pos.currency)}
                                              </span>
                                            </div>

                                            <div className="p-3 bg-secondary/20 border-t border-primary/10">
                                              <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">Cotação</span>
                                              <div className="flex items-center gap-1">
                                                <span className="text-xs font-bold text-primary font-mono">
                                                  {formatCurrencyByCode(pos.current_price, pos.currency)}
                                                </span>
                                                {pos.pricing_mode === 'market' && editingPriceTicker !== pos.ticker && (
                                                  <IconButton
                                                    type="button"
                                                    size="sm"
                                                    icon={<Edit2 size={9} className="shrink-0" />}
                                                    label="Editar cotação manualmente"
                                                    onClick={() => {
                                                      setEditingPriceTicker(pos.ticker)
                                                      setEditingPriceValue(pos.current_price.toString())
                                                    }}
                                                    className="!rounded !p-0.5"
                                                  />
                                                )}
                                              </div>
                                            </div>

                                            <div className="p-3 bg-secondary/20 border-t border-l border-primary/10">
                                              <span className="text-[9px] uppercase font-extrabold text-secondary block mb-0.5">Rent. Bruta</span>
                                              <span className={`text-xs font-black font-mono ${isGrossPositive ? 'text-income' : 'text-expense'}`}>
                                                {formatSignedPercentBR(pos.gross_yield_pct)}
                                              </span>
                                            </div>
                                          </div>

                                          {/* Edição inline de preço */}
                                          {editingPriceTicker === pos.ticker && (
                                            <div className="p-3 bg-balance/5 border border-balance/20 rounded-xl" onClick={(e) => e.stopPropagation()}>
                                              <span className="text-[9px] uppercase font-extrabold text-secondary block mb-1.5">Atualizar Preço ({pos.ticker})</span>
                                              <div className="flex items-center gap-2">
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  value={editingPriceValue}
                                                  onChange={(e) => setEditingPriceValue(e.target.value)}
                                                  onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleSaveInlinePrice(pos.ticker)
                                                    if (e.key === 'Escape') setEditingPriceTicker(null)
                                                  }}
                                                  disabled={savingPrice}
                                                  className="flex-1 !py-1.5 !px-3 text-xs !border-balance font-mono h-9"
                                                  autoFocus
                                                />
                                                <Button
                                                  type="button"
                                                  variant="ghost-success"
                                                  size="sm"
                                                  onClick={() => handleSaveInlinePrice(pos.ticker)}
                                                  disabled={savingPrice}
                                                  className="h-9 px-3 font-semibold text-xs"
                                                >
                                                  Salvar
                                                </Button>
                                                <Button
                                                  type="button"
                                                  variant="ghost-danger"
                                                  size="sm"
                                                  onClick={() => setEditingPriceTicker(null)}
                                                  disabled={savingPrice}
                                                  className="h-9 px-3 font-semibold text-xs"
                                                >
                                                  Cancelar
                                                </Button>
                                              </div>
                                            </div>
                                          )}
              
                                          {/* Barra de alocação real vs. meta */}
                                          <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-[10px]">
                                              <div className="flex items-center gap-1">
                                                <span className="text-secondary font-medium">Participação real:</span>
                                                <span className="font-mono font-bold text-primary">{formatPercentBR(pos.current_percentage, 1)}</span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <span className="text-secondary font-medium">Meta:</span>
                                                <span className="font-mono font-bold text-income">{formatPercentBR(pos.target_percentage, 0)}</span>
                                              </div>
                                            </div>
                                            <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden relative">
                                              <div 
                                                className="h-full bg-income rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                                              />
                                              {pos.target_percentage > 0 && (
                                                <div 
                                                  className="absolute top-0 bottom-0 w-0.5 bg-balance/60"
                                                  style={{ left: `${Math.min(pos.target_percentage, 99)}%` }}
                                                />
                                              )}
                                            </div>
                                          </div>
              
                                          {/* Ações rápidas */}
                                          <div className="flex items-center justify-between pt-2 border-t border-primary/5">
                                            <div>
                                              {pos.pricing_mode === 'market' && pos.is_b3_linked && (pos.quotation_status === 'stale' || pos.quotation_status === 'unavailable') && (
                                                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-warning/10 text-warning">
                                                  Cotação desatualizada
                                                </span>
                                              )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  handleOpenAssetTxModal(pos)
                                                }}
                                                className="!min-h-0 py-1.5 text-[10px] text-income border-income/25 bg-income/5 hover:bg-income/10 font-bold"
                                              >
                                                <BarChart2 size={11} />
                                                <span>Transações</span>
                                              </Button>
                                              <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setAssetDefTicker(pos.ticker)
                                                  setAssetDefModalOpen(true)
                                                }}
                                                className="!min-h-0 py-1.5 text-[10px] font-bold"
                                              >
                                                <Settings2 size={11} />
                                                <span>Configurar</span>
                                              </Button>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </Card>
              </TabsContent>

              {/* Aba 3: Histórico de Transações */}
              <TabsContent value="history">
                <LedgerBook
                  transactions={transactions}
                  onOpenTxModal={handleOpenTxModal}
                  onOpenReconciliation={() => setIsReconciliationOpen(true)}
                  portfolioId={portfolioId}
                  onSaved={loadPortfolio}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {portfolioId && (
        <>
          <PortfolioTransactionFormModal
            isOpen={isTxModalOpen}
            onClose={handleCloseTxModal}
            portfolioId={portfolioId}
            editingTransaction={editingTransaction}
            onSaved={loadPortfolio}
          />
          <InvestmentReconciliationModal
            isOpen={isReconciliationOpen}
            onClose={() => setIsReconciliationOpen(false)}
            portfolioId={portfolioId}
            existingTransactions={transactions}
            onSaved={loadPortfolio}
            onOpenAssetConfig={(ticker) => {
              setAssetDefTicker(ticker)
              setAssetDefModalOpen(true)
            }}
          />
          <AssetDefinitionFormModal
            isOpen={assetDefModalOpen}
            onClose={() => setAssetDefModalOpen(false)}
            portfolioId={portfolioId}
            ticker={assetDefTicker}
            existing={assetDefinitions.find((d) => d.ticker.toUpperCase() === assetDefTicker.toUpperCase()) ?? null}
            onSaved={loadPortfolio}
          />
          <AssetTransactionsModal
            isOpen={!!assetTxModalPosition}
            onClose={handleCloseAssetTxModal}
            position={assetTxModalPosition}
            allTransactions={transactions}
            portfolioId={portfolioId}
            onSaved={loadPortfolio}
          />
          <GroupTargetModal
            isOpen={showGroupTargetForm}
            onClose={() => setShowGroupTargetForm(false)}
            onSaved={async () => {
              await loadPortfolio()
            }}
            editingTarget={editingGroupTarget}
            groupTargets={groupTargets}
            portfolioId={portfolioId}
          />
        </>
      )}
    </div>
  )
}
