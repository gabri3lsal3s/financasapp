import { useState, useMemo } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, FileSpreadsheet, PenLine } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatCurrency } from '@/utils/format'

import { usePortfolioState } from '@/hooks/usePortfolioState'
import PortfolioKpiBar from '@/components/investments/PortfolioKpiBar'
import EvolutionChart from '@/components/investments/EvolutionChart'
import HoldingsTable from '@/components/investments/HoldingsTable'
import RebalancingView from '@/components/investments/RebalancingView'
import LedgerBook from '@/components/investments/LedgerBook'
import AssetClassAllocationCard from '@/components/investments/AssetClassAllocationCard'
import InvestmentsInsights from '@/components/investments/InvestmentsInsights'
import PieChartsSection from '@/components/investments/PieChartsSection'
import ClassPerformanceCard from '@/components/investments/ClassPerformanceCard'
import ExposureLimitsEditor from '@/components/investments/ExposureLimitsEditor'
import MonthlySummaryCard from '@/components/investments/MonthlySummaryCard'

import AssetConfigModal from '@/components/investments/AssetConfigModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'

import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'
import AssetDetailModal from '@/components/investments/AssetDetailModal'
import ScrollToTop from '@/components/ScrollToTop'

import GlassChoiceCard from '@/components/GlassChoiceCard'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import type { PortfolioTransaction } from '@/types'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { classPerformanceToPieSlices, sectorPerformanceToPieSlices, topAssetsToPieSlices, aggregateClassPerformance, aggregateSectorPerformance } from '@/utils/portfolioBenchmarks'

export default function Investments() {
  const {
    loading,
    portfolioId,
    transactions,
    shareHistory,
    positions,
    totalValue,
    investedValue,
    cashValue,
    groupTargets,
    reload
  } = usePortfolioState()

  // Abas
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Filtro de ticker para o LedgerBook
  const [ledgerSearchTicker, setLedgerSearchTicker] = useState<string>('')

  // Controle de modais
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)
  
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [configTicker, setConfigTicker] = useState('')

  // Modal de Detalhamento do Ativo
  const [selectedAssetPosition, setSelectedAssetPosition] = useState<ValuedPosition | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Dados para os gráficos pizza
  const nonCashPositions = useMemo(
    () => positions.filter(p => p.pricing_mode !== 'cash'),
    [positions]
  )

  const classPieData = useMemo(
    () => classPerformanceToPieSlices(aggregateClassPerformance(nonCashPositions, totalValue)),
    [nonCashPositions, totalValue]
  )

  const assetPieData = useMemo(
    () => topAssetsToPieSlices(nonCashPositions, totalValue),
    [nonCashPositions, totalValue]
  )

  const sectorPieData = useMemo(
    () => sectorPerformanceToPieSlices(aggregateSectorPerformance(nonCashPositions, totalValue)),
    [nonCashPositions, totalValue]
  )

  // Handler para clique em fatia do gráfico de ativos
  const handleAssetSliceClick = (sliceName: string) => {
    if (sliceName === 'Outros') return
    const pos = positions.find(
      (p) => p.ticker.toUpperCase() === sliceName.toUpperCase()
    )
    if (pos) {
      handleOpenAssetDetail(pos)
    }
  }

  // Handler para clique em fatia do gráfico de classes
  const handleClassSliceClick = () => {
    setActiveTab('assets')
  }

  // Handler para clique em fatia do gráfico de setores
  const handleSectorSliceClick = () => {
    setActiveTab('assets')
  }

  const handleOpenTxModal = (tx?: PortfolioTransaction) => {
    setEditingTransaction(tx ?? null)
    setIsTxModalOpen(true)
  }

  const handleCloseTxModal = () => {
    setIsTxModalOpen(false)
    setEditingTransaction(null)
  }

  const handleOpenConfig = (ticker: string) => {
    setConfigTicker(ticker)
    setIsConfigOpen(true)
  }

  const handleOpenAssetDetail = (pos: ValuedPosition) => {
    setSelectedAssetPosition(pos)
    setIsDetailModalOpen(true)
  }

  const handleViewInLedger = (ticker: string) => {
    setIsDetailModalOpen(false)
    setActiveTab('ledger')
    setLedgerSearchTicker(ticker)
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.investments.title}
        subtitle={PAGE_HEADERS.investments.description}
        action={
          <PageHeaderActions launchModalOpen={isSelectorOpen || isTxModalOpen || isReconciliationOpen || isConfigOpen || isDetailModalOpen}>
            <PageHeaderActionButton
              actionRole="launch"
              intent="primary"
              icon={Plus}
              label="Lançar transação"
              compactOnMobile={false}
              onClick={() => setIsSelectorOpen(true)}
            />
          </PageHeaderActions>
        }
      />

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter" id="investments-page-top">
        {loading ? (
          <Loader text="Carregando dados da carteira..." className="py-12" />
        ) : (
          <div className="space-y-6 animate-fade-in">
            
            {/* Barra superior de KPIs */}
            <PortfolioKpiBar
              totalValue={totalValue}
              investedValue={investedValue}
              shareHistory={shareHistory}
              transactions={transactions}
            />

            {/* Controle de Navegação em Abas */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="flex justify-center select-none pb-2">
                <TabsList className="bg-glass/10 p-0.5 rounded-xl border border-glass flex gap-1 h-9 overflow-x-auto max-w-full flex-nowrap justify-start sm:justify-center scrollbar-none">
                  <TabsTrigger
                    value="overview"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap shrink-0"
                  >
                    <TrendingUp size={12} />
                    <span>Visão Geral</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="assets"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap shrink-0"
                  >
                    <Briefcase size={12} />
                    <span>Ativos</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="ledger"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap shrink-0"
                  >
                    <FileSpreadsheet size={12} />
                    <span>Livro Razão</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Aba 1: Visão Geral */}
              <TabsContent value="overview" className="mt-6 space-y-5 lg:space-y-6 w-full animate-fade-in">
                {/* Topo: Saldo em Caixa (largura total) */}
                <Card className="border border-glass bg-glass/5 rounded-3xl p-5 lg:p-6 flex flex-col justify-between text-left gap-4 relative overflow-hidden hover:border-glass-strong hover:shadow-md transition-all duration-300">
                  <div
                    className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-[0.08]"
                    style={{ backgroundColor: cashValue > 0 ? 'var(--color-income)' : 'var(--color-primary)' }}
                  />
                  <div className="space-y-1.5 z-10">
                    <span className="text-[9px] font-black uppercase text-secondary tracking-wider">Saldo em Caixa</span>
                    <h4 className="text-2xl font-black text-primary font-mono">{formatCurrency(cashValue)}</h4>
                    <p className="text-[10px] text-secondary font-medium leading-relaxed">
                      Saldo líquido disponível na corretora para novas compras e rebalanceamento.
                    </p>
                  </div>
                </Card>

                {/* Card de Insights em largura total */}
                <InvestmentsInsights
                  positions={positions}
                  cashValue={cashValue}
                  totalValue={totalValue}
                />

                {/* Resumo Mensal com navegação */}
                <MonthlySummaryCard
                  transactions={transactions}
                  shareHistory={shareHistory}
                />

                {/* Cards em largura total — empilhamento vertical */}
                <EvolutionChart shareHistory={shareHistory} />

                {/* Gráficos Pizza lado a lado */}
                {(assetPieData.length > 0 || classPieData.length > 0 || sectorPieData.length > 0) && (
                  <PieChartsSection
                    assetPieData={assetPieData}
                    classPieData={classPieData}
                    sectorPieData={sectorPieData}
                    handleAssetSliceClick={handleAssetSliceClick}
                    handleClassSliceClick={handleClassSliceClick}
                    handleSectorSliceClick={handleSectorSliceClick}
                  />
                )}

                <AssetClassAllocationCard
                  positions={positions}
                  cashValue={cashValue}
                  totalValue={totalValue}
                  groupTargets={groupTargets}
                />

                {nonCashPositions.length > 0 && (
                  <ClassPerformanceCard
                    positions={nonCashPositions}
                    totalValue={totalValue}
                    transactions={transactions}
                  />
                )}

              </TabsContent>

              {/* Aba 2: Ativos */}
              <TabsContent value="assets" className="mt-6 w-full">
                <div className="space-y-5 lg:space-y-6">
                    <HoldingsTable
                      positions={positions}
                      onOpenAssetDetail={handleOpenAssetDetail}
                    />
                    {portfolioId && (
                      <ExposureLimitsEditor
                        portfolioId={portfolioId}
                        positions={positions}
                        totalValue={totalValue}
                        groupTargets={groupTargets}
                        onSaved={reload}
                      />
                    )}
                    <RebalancingView
                      positions={positions}
                      totalValue={totalValue}
                    />
                </div>
              </TabsContent>

              {/* Aba 3: Livro Razão de Lançamentos */}
              <TabsContent value="ledger" className="mt-6 w-full">
                <LedgerBook
                  transactions={transactions}
                  onDeleteTransaction={reload}
                  initialSearchTerm={ledgerSearchTicker}
                  onEditTransaction={handleOpenTxModal}
                />
              </TabsContent>
            </Tabs>

          </div>
        )}
      </div>

      {/* Modal Seletor: Lançamento Manual ou Conciliação B3 */}
      <Modal isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} title="Nova transação">
        <div className="modal-body-stack">
          <ModalIntro align="center">Escolha o tipo de lançamento que deseja fazer:</ModalIntro>
          <ModalChoiceGrid>
            <GlassChoiceCard
              label="Lançamento Manual"
              icon={<PenLine size={24} />}
              intent="balance"
              onClick={() => {
                setIsSelectorOpen(false)
                handleOpenTxModal()
              }}
            />
            <GlassChoiceCard
              label="Conciliação B3"
              icon={<FileSpreadsheet size={24} />}
              intent="income"
              onClick={() => {
                setIsSelectorOpen(false)
                setIsReconciliationOpen(true)
              }}
            />
          </ModalChoiceGrid>
        </div>
      </Modal>

      {portfolioId && (
        <>
          {/* Modal de Transações Gerais */}
          <PortfolioTransactionFormModal
            isOpen={isTxModalOpen}
            onClose={handleCloseTxModal}
            portfolioId={portfolioId}
            editingTransaction={editingTransaction}
            onSaved={reload}
          />

          {/* Modal de Conciliação B3 */}
          <InvestmentReconciliationModal
            isOpen={isReconciliationOpen}
            onClose={() => setIsReconciliationOpen(false)}
            portfolioId={portfolioId}
            existingTransactions={transactions}
            onSaved={reload}
            onOpenAssetConfig={handleOpenConfig}
          />

          {/* Modal de Configuração de Ativo */}
          <AssetConfigModal
            isOpen={isConfigOpen}
            onClose={() => {
              setIsConfigOpen(false)
              setConfigTicker('')
            }}
            portfolioId={portfolioId}
            ticker={configTicker}
            onSaved={reload}
          />

          {/* Modal de Detalhamento de Ativo */}
          <AssetDetailModal
            isOpen={isDetailModalOpen}
            onClose={() => {
              setIsDetailModalOpen(false)
              setSelectedAssetPosition(null)
            }}
            position={selectedAssetPosition}
            transactions={transactions}
            onOpenAssetConfig={(ticker) => {
              setIsDetailModalOpen(false)
              handleOpenConfig(ticker)
            }}
            onEditTransaction={(tx) => {
              setIsDetailModalOpen(false)
              handleOpenTxModal(tx)
            }}
            onViewInLedger={handleViewInLedger}
          />
        </>
      )}
      {/* ScrollToTop */}
      <ScrollToTop />
    </div>
  )
}
