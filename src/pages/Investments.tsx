import { useState, useMemo } from 'react'
import { usePageActions } from '@/hooks/usePageActions'
import { SkeletonInvestments } from '@/components/Skeleton'
import { 
  Plus, Briefcase, TrendingUp, FileSpreadsheet, PenLine, Target
} from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

import { usePortfolioState } from '@/hooks/usePortfolioState'
import PortfolioKpiBar from '@/components/investments/PortfolioKpiBar'
import EvolutionChart from '@/components/investments/EvolutionChart'
import HoldingsTable from '@/components/investments/HoldingsTable'
import LedgerBook from '@/components/investments/LedgerBook'
import MonthlyActivityCard from '@/components/investments/MonthlyActivityCard'
import AssetAnalyticsCard from '@/components/investments/AssetAnalyticsCard'
import RebalancingView from '@/components/investments/RebalancingView'

import AssetConfigModal from '@/components/investments/AssetConfigModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'
import AssetDetailModal from '@/components/investments/AssetDetailModal'
import QuickBalanceUpdateModal from '@/components/investments/QuickBalanceUpdateModal'

import GlassChoiceCard from '@/components/GlassChoiceCard'
import Modal from '@/components/Modal'
import ModalIntro from '@/components/ModalIntro'
import ModalChoiceGrid from '@/components/ModalChoiceGrid'
import type { PortfolioTransaction } from '@/types'
import type { ValuedPosition } from '@/utils/portfolioCalculations'
import { 
  classPerformanceToPieSlices, sectorPerformanceToPieSlices, 
  topAssetsToPieSlices, aggregateClassPerformance, aggregateSectorPerformance 
} from '@/utils/portfolioBenchmarks'

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
    preferences,
    reload
  } = usePortfolioState()

  // Abas (overview | assets | rebalance | ledger)
  const [activeTab, setActiveTab] = useState<string>('overview')

  // Navegação mensal do resumo compacto
  const [monthNavDate, setMonthNavDate] = useState<string>(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })

  const addMonths = (delta: number) => {
    const [y, m] = monthNavDate.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setMonthNavDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const canNavNext = monthNavDate < (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  // Filtro de ticker para o LedgerBook
  const [ledgerSearchTicker, setLedgerSearchTicker] = useState<string>('')

  // Controle de modais
  const [isSelectorOpen, setIsSelectorOpen] = useState(false)
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)
  const [initialTxTicker, setInitialTxTicker] = useState<string>('')
  
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [configTicker, setConfigTicker] = useState('')

  // Modal de Detalhamento do Ativo
  const [selectedAssetPosition, setSelectedAssetPosition] = useState<ValuedPosition | null>(null)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false)

  // Modal de Atualização Rápida de Saldos
  const [isQuickUpdateOpen, setIsQuickUpdateOpen] = useState(false)

  const isAnyInvestmentModalOpen = isSelectorOpen || isTxModalOpen || isReconciliationOpen || isConfigOpen || isDetailModalOpen || isQuickUpdateOpen

  usePageActions(
    [
      {
        icon: Plus,
        label: 'Lançar transação',
        intent: 'primary',
        actionRole: 'launch',
        compactOnMobile: false,
        onClick: () => setIsSelectorOpen(true),
      },
    ],
    isAnyInvestmentModalOpen
  )

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

  const handleOpenTxModal = (tx?: PortfolioTransaction, ticker?: string) => {
    setEditingTransaction(tx ?? null)
    setInitialTxTicker(ticker ?? '')
    setIsTxModalOpen(true)
  }

  const handleCloseTxModal = () => {
    setIsTxModalOpen(false)
    setEditingTransaction(null)
    setInitialTxTicker('')
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
      <div className="p-4 lg:p-6 space-y-6 animate-page-enter" id="investments-page-top">
        {loading ? (
          <SkeletonInvestments />
        ) : (
          <div className="space-y-6 animate-fade-in">
            
            {/* Controle de Navegação em 4 Abas Temáticas */}
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
                    <span>Minha Carteira</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="rebalance"
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all whitespace-nowrap shrink-0"
                  >
                    <Target size={12} />
                    <span>Rebalanceamento</span>
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

              {/* Aba 1: Visão Geral (Resumo Executivo do Patrimônio) */}
              <TabsContent value="overview" className="mt-6 space-y-5 lg:space-y-6 w-full animate-fade-in">
                {/* KPIs */}
                <PortfolioKpiBar
                  totalValue={totalValue}
                  investedValue={investedValue}
                  shareHistory={shareHistory}
                  transactions={transactions}
                />

                {/* Atividade Mensal com Saldo em Caixa Integrado */}
                <MonthlyActivityCard
                  transactions={transactions}
                  monthNavDate={monthNavDate}
                  onPrevMonth={() => addMonths(-1)}
                  onNextMonth={() => addMonths(1)}
                  canNavNext={canNavNext}
                  cashValue={cashValue}
                />

                {/* Evolução Histórica do Patrimônio */}
                <EvolutionChart shareHistory={shareHistory} />
              </TabsContent>

              {/* Aba 2: Minha Carteira (Análise Consolidada + Custódia de Ativos) */}
              <TabsContent value="assets" className="mt-6 space-y-5 lg:space-y-6 w-full animate-fade-in">
                <AssetAnalyticsCard
                  positions={positions}
                  cashValue={cashValue}
                  totalValue={totalValue}
                  groupTargets={groupTargets}
                  transactions={transactions}
                  assetPieData={assetPieData}
                  classPieData={classPieData}
                  sectorPieData={sectorPieData}
                  onAssetSliceClick={handleAssetSliceClick}
                />

                <HoldingsTable
                  positions={positions}
                  onOpenAssetDetail={handleOpenAssetDetail}
                  onOpenQuickUpdate={() => setIsQuickUpdateOpen(true)}
                />
              </TabsContent>

              {/* Aba 3: Rebalanceamento & Aportes Inteligentes */}
              <TabsContent value="rebalance" className="mt-6 w-full animate-fade-in">
                {portfolioId && (
                  <RebalancingView
                    portfolioId={portfolioId}
                    positions={positions}
                    totalValue={totalValue}
                    cashValue={cashValue}
                    groupTargets={groupTargets}
                    preferences={preferences}
                    onSaved={reload}
                  />
                )}
              </TabsContent>

              {/* Aba 4: Livro Razão de Lançamentos */}
              <TabsContent value="ledger" className="mt-6 w-full animate-fade-in">
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
            initialTicker={initialTxTicker}
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
            portfolioId={portfolioId}
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
            onNewTransaction={(ticker) => {
              setIsDetailModalOpen(false)
              handleOpenTxModal(undefined, ticker)
            }}
          />

          {/* Modal de Atualização Rápida de Saldos */}
          <QuickBalanceUpdateModal
            isOpen={isQuickUpdateOpen}
            onClose={() => setIsQuickUpdateOpen(false)}
            portfolioId={portfolioId}
            onSaved={reload}
          />
        </>
      )}
    </div>
  )
}
