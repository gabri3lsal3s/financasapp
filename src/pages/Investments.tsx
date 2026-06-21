import { useState } from 'react'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, FileSpreadsheet } from 'lucide-react'
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

import AssetConfigModal from '@/components/investments/AssetConfigModal'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'

import type { PortfolioTransaction } from '@/types'
import type { ValuedPosition } from '@/utils/portfolioCalculations'

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
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)
  
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [configTicker, setConfigTicker] = useState('')

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

  const handleOpenAssetTransactions = (pos: ValuedPosition) => {
    // Definimos o filtro no livro razão e mudamos de aba
    setActiveTab('ledger')
    // Simulamos busca no LedgerBook filtrando pelo ticker
    setLedgerSearchTicker(pos.ticker)
  }

  return (
    <div>
      <PageHeader
        title={PAGE_HEADERS.investments.title}
        subtitle={PAGE_HEADERS.investments.description}
        action={
          <PageHeaderActions launchModalOpen={isReconciliationOpen || isTxModalOpen || isConfigOpen}>
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

      <div className="p-4 lg:p-6 space-y-6 animate-page-enter">
        {loading ? (
          <Loader text="Carregando dados da carteira..." className="py-12" />
        ) : (
          <div className="space-y-6 animate-fade-in">
            
            {/* Barra superior de KPIs */}
            <PortfolioKpiBar
              totalValue={totalValue}
              investedValue={investedValue}
              shareHistory={shareHistory}
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
                    <span>Ativos e Alocação</span>
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

              {/* Aba 1: Visão Geral (Gráfico + Alocações + Caixa e Insights) */}
              <TabsContent value="overview" className="mt-6 space-y-6 animate-fade-in">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:gap-6 items-start">
                  {/* Coluna da Esquerda (2 Colunas no Desktop): Gráfico e Distribuição de Ativos */}
                  <div className="flex flex-col gap-5 lg:col-span-2">
                    <EvolutionChart shareHistory={shareHistory} />
                    <AssetClassAllocationCard
                      positions={positions}
                      cashValue={cashValue}
                      totalValue={totalValue}
                      groupTargets={groupTargets}
                    />
                  </div>

                  {/* Coluna da Direita (1 Coluna no Desktop): Saldo e Insights */}
                  <div className="flex flex-col gap-5 lg:col-span-1">
                    {/* Card de Resumo de Caixa e Operações */}
                    <Card className="border border-glass bg-glass/5 rounded-3xl p-5 flex flex-col justify-between text-left gap-4 relative overflow-hidden hover:border-glass-strong hover:shadow-md transition-all duration-300">
                      {/* Glow halo baseando-se no nível do saldo */}
                      <div
                        className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-[0.08]"
                        style={{ backgroundColor: cashValue > 0 ? 'var(--color-income)' : 'var(--color-primary)' }}
                      />
                      
                      <div className="space-y-1.5 z-10">
                        <span className="text-[9px] font-black uppercase text-secondary tracking-wider">Saldo em Caixa</span>
                        <h4 className="text-2xl font-black text-primary font-mono">{formatCurrency(cashValue)}</h4>
                        <p className="text-[10px] text-secondary font-medium leading-relaxed">
                          Saldo líquido disponível na corretora para novas compras de ativos e rebalanceamento da carteira.
                        </p>
                      </div>
                      
                      <div className="space-y-2 z-10">
                        <Button
                          type="button"
                          variant="income"
                          onClick={() => setIsReconciliationOpen(true)}
                          className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-10 rounded-xl w-full"
                        >
                          <FileSpreadsheet size={14} />
                          <span>Importar Planilha B3</span>
                        </Button>
                        <Button
                          type="button"
                          variant="balance"
                          onClick={() => handleOpenTxModal()}
                          className="flex items-center justify-center gap-2 text-xs font-black uppercase tracking-wider py-2.5 px-5 h-10 rounded-xl w-full"
                        >
                          <Plus size={14} />
                          <span>Lançar Transação</span>
                        </Button>
                      </div>
                    </Card>

                    {/* Insights da Carteira */}
                    <InvestmentsInsights
                      positions={positions}
                      cashValue={cashValue}
                      totalValue={totalValue}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Aba 2: Ativos e Alocação */}
              <TabsContent value="assets" className="mt-6">
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 lg:gap-6 items-start">
                  <div className="xl:col-span-2">
                    <HoldingsTable
                      positions={positions}
                      onOpenAssetConfig={handleOpenConfig}
                      onOpenAssetTransactions={handleOpenAssetTransactions}
                    />
                  </div>
                  <div className="xl:col-span-1">
                    <RebalancingView
                      positions={positions}
                      totalValue={totalValue}
                    />
                  </div>
                </div>
              </TabsContent>

              {/* Aba 4: Livro Razão de Lançamentos */}
              <TabsContent value="ledger" className="mt-6">
                <LedgerBook
                  transactions={transactions}
                  onDeleteTransaction={reload}
                  initialSearchTerm={ledgerSearchTicker}
                />
              </TabsContent>
            </Tabs>

          </div>
        )}
      </div>

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
        </>
      )}
    </div>
  )
}
