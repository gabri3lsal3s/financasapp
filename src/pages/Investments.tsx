import { useEffect, useState, useMemo } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, Layers, Settings2, FileSpreadsheet, X, Search, RefreshCw } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import Select from '@/components/Select'

import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import AssetDefinitionFormModal from '@/components/investments/AssetDefinitionFormModal'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'
import AssetTransactionsModal from '@/components/investments/AssetTransactionsModal'
import LedgerBook from '@/components/investments/LedgerBook'
import toast from 'react-hot-toast'
import GroupTargetModal from '@/components/investments/GroupTargetModal'
import { forceUpdateAssetPrice, getAssetPrices } from '@/services/priceService'
import { usePortfolioClose } from '@/hooks/usePortfolioClose'
import { usePortfolio } from '@/hooks/usePortfolio'
import type { AssetPosition } from '@/services/investmentEngine'
import type { PortfolioGroupTarget, PortfolioTransaction } from '@/types'

// Sub-componentes decompostos
import PortfolioKpiBar from '@/components/investments/PortfolioKpiBar'
import AllocationPieChart from '@/components/investments/AllocationPieChart'
import RebalancingPanel from '@/components/investments/RebalancingPanel'
import AllocationLimitsSection from '@/components/investments/AllocationLimitsSection'
import AllocationPerformanceTable from '@/components/investments/AllocationPerformanceTable'
import AllocationMonthlyFlowChart from '@/components/investments/AllocationMonthlyFlowChart'
import AssetsTable from '@/components/investments/AssetsTable'
import AssetCardMobile from '@/components/investments/AssetCardMobile'

export default function Investments() {
  const [searchParams, setSearchParams] = useSearchParams()

  const {
    portfolioData,
    transactions,
    groupTargets,
    assetDefinitions,
    targetAllocations,
    valuationPrices,
    indexRatesByIndexer,
    portfolioId,
    loading: portfolioLoading,
    refreshing: portfolioRefreshing,
    dynamicHistory,
    chartPalette,
    refresh: refreshPortfolio,
    reload: reloadPortfolio,
  } = usePortfolio()

  // Abas e Filtros
  const [activeTab, setActiveTab] = useState<string>('distribution')
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all')
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [hoveredPieSegment, setHoveredPieSegment] = useState<any>(null)
  const [selectedPieSegment, setSelectedPieSegment] = useState<any>(null)
  const [collapsedClasses, setCollapsedClasses] = useState<Record<string, boolean>>({})
  const [showFilters, setShowFilters] = useState<boolean>(false)

  // Modais
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)
  const [assetDefModalOpen, setAssetDefModalOpen] = useState(false)
  const [assetDefTicker, setAssetDefTicker] = useState('')
  const [showGroupTargetForm, setShowGroupTargetForm] = useState<boolean>(false)
  const [editingGroupTarget, setEditingGroupTarget] = useState<PortfolioGroupTarget | null>(null)

  // Posições Detalhadas e Preço Inline
  const [expandedAssets, setExpandedAssets] = useState<Record<string, boolean>>({})
  const [limitsCollapsed, setLimitsCollapsed] = useState<boolean>(true)
  const [assetTxModalPosition, setAssetTxModalPosition] = useState<AssetPosition | null>(null)
  const [editingPriceTicker, setEditingPriceTicker] = useState<string | null>(null)
  const [editingPriceValue, setEditingPriceValue] = useState<string>('')
  const [savingPrice, setSavingPrice] = useState<boolean>(false)
  const [consolidationView, setConsolidationView] = useState<'class' | 'sector'>('class')

  const { closing: closingPortfolio, runClose } = usePortfolioClose()

  const toggleClassCollapsed = (className: string) => {
    setCollapsedClasses((prev) => ({
      ...prev,
      [className]: !prev[className],
    }))
  }

  const toggleAssetExpanded = (ticker: string) => {
    setExpandedAssets((prev) => ({
      ...prev,
      [ticker]: !prev[ticker],
    }))
  }

  const handleOpenAssetTxModal = (pos: AssetPosition) => {
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

  const handleEditGroupTarget = (gt: PortfolioGroupTarget) => {
    setEditingGroupTarget(gt)
    setShowGroupTargetForm(true)
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

  const uniqueClasses = useMemo(() => {
    if (!portfolioData?.positions) return []
    const classes = new Set<string>()
    portfolioData.positions.forEach((p) => {
      if (p.asset_class && p.pricing_mode !== 'cash' && p.ticker !== 'SALDO_INV' && p.ticker !== 'CAIXA') {
        classes.add(p.asset_class)
      }
    })
    return Array.from(classes).sort()
  }, [portfolioData?.positions])

  const uniqueSectors = useMemo(() => {
    if (!portfolioData?.positions) return []
    const sectors = new Set<string>()
    portfolioData.positions.forEach((p) => {
      if (p.sector && p.pricing_mode !== 'cash' && p.ticker !== 'SALDO_INV' && p.ticker !== 'CAIXA') {
        sectors.add(p.sector)
      }
    })
    return Array.from(sectors).sort()
  }, [portfolioData?.positions])

  const filteredPositions = useMemo(() => {
    if (!portfolioData?.positions) return []
    return portfolioData.positions.filter((pos) => {
      if (pos.pricing_mode === 'cash' || pos.ticker === 'SALDO_INV' || pos.ticker === 'CAIXA') {
        return false
      }

      if (selectedClassFilter !== 'all') {
        const cls = pos.asset_class || 'Não classificado'
        if (cls !== selectedClassFilter) return false
      }

      if (selectedSectorFilter !== 'all') {
        const sec = pos.sector || 'Outros'
        if (sec !== selectedSectorFilter) return false
      }

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
    filteredPositions.forEach((pos) => {
      const cls = pos.asset_class || 'Não classificado'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(pos)
    })
    return groups
  }, [filteredPositions])

  const activeGroupAssets = useMemo(() => {
    if (!selectedPieSegment || !portfolioData?.positions) return []
    return portfolioData.positions.filter((pos) => {
      if (pos.pricing_mode === 'cash' || pos.ticker === 'SALDO_INV' || pos.ticker === 'CAIXA') return false
      if (consolidationView === 'class') {
        return (pos.asset_class || 'Não classificado') === selectedPieSegment.name
      } else {
        return (pos.sector || 'Outros') === selectedPieSegment.name
      }
    })
  }, [selectedPieSegment, portfolioData?.positions, consolidationView])

  const pieData = useMemo(() => {
    if (!portfolioData) return []
    const groups =
      consolidationView === 'class' ? portfolioData.consolidatedClass : portfolioData.consolidatedSector

    return groups
      .filter((g) => g.total_value > 0)
      .map((g) => ({
        name: g.name,
        value: g.total_value,
        percent: g.current_percentage,
        target: g.target_percentage,
        yield_pct: g.yield_pct,
        gross_yield_pct: g.gross_yield_pct,
        net_yield_pct: g.net_yield_pct,
      }))
  }, [portfolioData, consolidationView])

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
      await reloadPortfolio()
    } catch (err) {
      console.error(err)
      toast.error('Erro ao salvar cotação')
    } finally {
      setSavingPrice(false)
    }
  }

  const handleDailyClose = async () => {
    if (!portfolioId || transactions.length === 0) {
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
    await reloadPortfolio()
  }

  const handleForceRefresh = async () => {
    await refreshPortfolio()
  }

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    if (
      portfolioId &&
      transactions.length > 0 &&
      Object.keys(valuationPrices).length > 0 &&
      !portfolioLoading &&
      !closingPortfolio
    ) {
      void (async () => {
        const { data: port } = await supabase
          .from('portfolios')
          .select('last_close_date')
          .eq('id', portfolioId)
          .maybeSingle()
        if (port && (port as { last_close_date: string | null }).last_close_date !== today) {
          void handleDailyClose()
        }
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, transactions, valuationPrices, portfolioLoading])

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

  const handleDeleteGroupTarget = async (id: string) => {
    try {
      const { error } = await supabase.from('portfolio_group_targets').delete().eq('id', id)

      if (error) throw error

      toast.success('Limite excluído!')
      await reloadPortfolio()
    } catch (err) {
      toast.error('Erro ao excluir limite')
    }
  }

  const handleViewDetailedAssets = (groupName: string) => {
    if (consolidationView === 'class') {
      setSelectedClassFilter(groupName)
      setSelectedSectorFilter('all')
    } else {
      setSelectedSectorFilter(groupName)
      setSelectedClassFilter('all')
    }
    setActiveTab('assets')
  }

  const handleRebalancingPanelAssetClick = (ticker: string) => {
    setSearchTerm(ticker)
    setSelectedClassFilter('all')
    setSelectedSectorFilter('all')
    setActiveTab('assets')
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
        ) : (
          portfolioData && (
            <div className="space-y-6 animate-fade-in">
              <PortfolioKpiBar portfolioData={portfolioData} dynamicHistory={dynamicHistory} />

              {transactions.length === 0 ? (
                <Card className="p-8 border border-balance/25 bg-balance/5 rounded-3xl flex flex-col items-center justify-center text-center gap-6 shadow-sm max-w-2xl mx-auto my-6 animate-page-enter">
                  <div className="w-16 h-16 rounded-2xl bg-balance/10 flex items-center justify-center text-balance shrink-0">
                    <Briefcase size={30} />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-black text-primary">Sua carteira de investimentos está vazia</h4>
                    <p className="text-xs text-secondary leading-relaxed max-w-md font-medium">
                      Para começar a acompanhar sua alocação, rentabilidade e rebalanceamento automático, sugerimos inserir seus investimentos importando os dados da B3 ou cadastrando transações manualmente.
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto shrink-0 justify-center">
                    <Button
                      type="button"
                      variant="income"
                      onClick={() => setIsReconciliationOpen(true)}
                      className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-11 rounded-xl w-full sm:w-auto"
                    >
                      <FileSpreadsheet size={16} />
                      <span>Conciliação B3</span>
                    </Button>
                    <Button
                      type="button"
                      variant="balance"
                      onClick={() => handleOpenTxModal()}
                      className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-11 rounded-xl w-full sm:w-auto"
                    >
                      <Plus size={16} />
                      <span>Lançamento Manual</span>
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
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
                        <AllocationPieChart
                          pieData={pieData}
                          chartPalette={chartPalette}
                          consolidationView={consolidationView}
                          setConsolidationView={setConsolidationView}
                          hoveredPieSegment={hoveredPieSegment}
                          setHoveredPieSegment={setHoveredPieSegment}
                          selectedPieSegment={selectedPieSegment}
                          setSelectedPieSegment={setSelectedPieSegment}
                          totalValue={portfolioData.totalValue}
                          onViewDetailedAssets={handleViewDetailedAssets}
                        />

                        <RebalancingPanel
                          selectedPieSegment={selectedPieSegment}
                          setSelectedPieSegment={setSelectedPieSegment}
                          activeGroupAssets={activeGroupAssets}
                          consolidationView={consolidationView}
                          portfolioData={portfolioData}
                          chartPalette={chartPalette}
                          onAssetClick={handleRebalancingPanelAssetClick}
                          onGroupClick={setSelectedPieSegment}
                        />
                      </div>

                      {/* Tabela de Performance por Classe/Setor */}
                      <AllocationPerformanceTable
                        groups={
                          consolidationView === 'class'
                            ? portfolioData.consolidatedClass
                            : portfolioData.consolidatedSector
                        }
                        consolidationView={consolidationView}
                      />

                      {/* Gráfico de Fluxo Mensal por Classe/Setor */}
                      {dynamicHistory && dynamicHistory.shareHistory && (
                        <AllocationMonthlyFlowChart
                          shareHistory={dynamicHistory.shareHistory}
                          chartPalette={chartPalette}
                          initialConsolidationView={
                            consolidationView === 'class' ? 'class' : 'portfolio'
                          }
                        />
                      )}

                      <AllocationLimitsSection
                        groupTargets={groupTargets}
                        consolidationView={consolidationView}
                        limitsCollapsed={limitsCollapsed}
                        setLimitsCollapsed={setLimitsCollapsed}
                        onEditGroupTarget={handleEditGroupTarget}
                        onDeleteGroupTarget={handleDeleteGroupTarget}
                        onNewLimit={() => {
                          setEditingGroupTarget(null)
                          setShowGroupTargetForm(true)
                        }}
                        sumClass={sumClass}
                        sumSector={sumSector}
                      />
                    </TabsContent>

                    {/* Aba 2: Detalhamento de Ativos */}
                    <TabsContent value="assets" className="space-y-4">
                      <Card className="p-4 lg:p-6 space-y-4">
                        <div className="flex flex-col gap-4">
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
                              disabled={portfolioRefreshing || portfolioLoading}
                              className="flex items-center gap-1.5 h-8 px-3 text-secondary hover:text-primary hover:bg-secondary/60 font-semibold text-xs shrink-0 rounded-xl"
                              title="Atualizar cotações"
                            >
                              <RefreshCw
                                size={13}
                                className={portfolioRefreshing ? 'animate-spin text-income' : 'text-secondary'}
                              />
                              <span className="hidden sm:inline text-[11px]">
                                {portfolioRefreshing ? 'Atualizando...' : 'Atualizar'}
                              </span>
                            </Button>
                          </div>

                          <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-3 sm:gap-3 w-full">
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

                            <div className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-col sm:flex-row sm:col-span-2 gap-3 w-full animate-fade-in`}>
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

                        <AssetsTable
                          filteredPositionsByClass={filteredPositionsByClass}
                          collapsedClasses={collapsedClasses}
                          toggleClassCollapsed={toggleClassCollapsed}
                          editingPriceTicker={editingPriceTicker}
                          editingPriceValue={editingPriceValue}
                          setEditingPriceValue={setEditingPriceValue}
                          setEditingPriceTicker={setEditingPriceTicker}
                          savingPrice={savingPrice}
                          handleSaveInlinePrice={handleSaveInlinePrice}
                          handleOpenAssetTxModal={handleOpenAssetTxModal}
                          setAssetDefTicker={setAssetDefTicker}
                          setAssetDefModalOpen={setAssetDefModalOpen}
                        />

                        <AssetCardMobile
                          filteredPositionsByClass={filteredPositionsByClass}
                          collapsedClasses={collapsedClasses}
                          toggleClassCollapsed={toggleClassCollapsed}
                          expandedAssets={expandedAssets}
                          toggleAssetExpanded={toggleAssetExpanded}
                          editingPriceTicker={editingPriceTicker}
                          editingPriceValue={editingPriceValue}
                          setEditingPriceValue={setEditingPriceValue}
                          setEditingPriceTicker={setEditingPriceTicker}
                          savingPrice={savingPrice}
                          handleSaveInlinePrice={handleSaveInlinePrice}
                          handleOpenAssetTxModal={handleOpenAssetTxModal}
                          setAssetDefTicker={setAssetDefTicker}
                          setAssetDefModalOpen={setAssetDefModalOpen}
                        />
                      </Card>
                    </TabsContent>

                    {/* Aba 3: Histórico de Transações */}
                    <TabsContent value="history">
                      <LedgerBook
                        transactions={transactions}
                        onOpenTxModal={handleOpenTxModal}
                        onOpenReconciliation={() => setIsReconciliationOpen(true)}
                        portfolioId={portfolioId}
                        onSaved={reloadPortfolio}
                      />
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          )
        )}
      </div>

      {portfolioId && (
        <>
          <PortfolioTransactionFormModal
            isOpen={isTxModalOpen}
            onClose={handleCloseTxModal}
            portfolioId={portfolioId}
            editingTransaction={editingTransaction}
            onSaved={reloadPortfolio}
          />
          <InvestmentReconciliationModal
            isOpen={isReconciliationOpen}
            onClose={() => setIsReconciliationOpen(false)}
            portfolioId={portfolioId}
            existingTransactions={transactions}
            onSaved={reloadPortfolio}
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
            onSaved={reloadPortfolio}
          />
          <AssetTransactionsModal
            isOpen={!!assetTxModalPosition}
            onClose={handleCloseAssetTxModal}
            position={assetTxModalPosition}
            allTransactions={transactions}
            portfolioId={portfolioId}
            onSaved={reloadPortfolio}
          />
          <GroupTargetModal
            isOpen={showGroupTargetForm}
            onClose={() => setShowGroupTargetForm(false)}
            onSaved={reloadPortfolio}
            editingTarget={editingGroupTarget}
            groupTargets={groupTargets}
            portfolioId={portfolioId}
          />
        </>
      )}

      {/* Visual Feedback de Fechamento Diário Automático */}
      {closingPortfolio && (
        <div className="fixed bottom-4 right-4 z-50 bg-balance/95 border border-glass rounded-xl p-3 shadow-lg flex items-center gap-2.5 text-xs font-semibold text-primary animate-fade-in">
          <RefreshCw size={14} className="animate-spin text-income shrink-0" />
          <span>Fechamento diário automático em andamento...</span>
        </div>
      )}
    </div>
  )
}
