import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Profile, PortfolioTransaction, PortfolioGroupTarget } from '@/types'
import { useClientPortfolio } from '@/hooks/useClientPortfolio'
import { useClientManagement } from '@/hooks/useClientManagement'
import { useRebalancingTrades } from '@/hooks/useRebalancingTrades'
import { generateConsultingPDF } from '@/services/pdfGenerator'
import { prepareBatchValuationContext, valuatePortfolioSync } from '@/utils/portfolioValuationLoader'
import ContributionSimulator from '@/components/ContributionSimulator'
import Card from '@/components/Card'
import Loader from '@/components/Loader'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import ModalForm from '@/components/ModalForm'
import ModalFooter from '@/components/ModalFooter'
import PageHeader, { PageHeaderActions } from '@/components/PageHeader'
import PageHeaderActionButton from '@/components/PageHeaderActionButton'
import { PAGE_HEADERS } from '@/constants/pages'
import { UserPlus, Trash2, ShieldCheck, AlertCircle, RefreshCw, Users } from 'lucide-react'
import toast from 'react-hot-toast'
import InvestmentsGroupTargetForm from '@/components/investments/InvestmentsGroupTargetForm'
import Switch from '@/components/Switch'
import { isProvisionalClientEmail } from '@/constants/provisionalClient'
import { resolveProfileDisplayName } from '@/utils/profileDisplayName'
import { getAllocationClassColor } from '@/utils/categoryColors'
import { nonCashPortfolioPerformance } from '@/utils/portfolioDisplayMetrics'

// Componentes Modulares
import AdvisorOverview from '@/components/consulting/AdvisorOverview'
import ClientOverviewHeader from '@/components/consulting/ClientOverviewHeader'
import ClientKpiCards, { type ClientKpiYieldBasis } from '@/components/consulting/ClientKpiCards'
import ClientAllocationCharts from '@/components/consulting/ClientAllocationCharts'
import RebalancingChecklist from '@/components/consulting/RebalancingChecklist'
import PositionsTable from '@/components/consulting/PositionsTable'
import LedgerBook from '@/components/consulting/LedgerBook'
import ClientPickerModal from '@/components/consulting/ClientPickerModal'
import SectorExposureChart from '@/components/consulting/SectorExposureChart'
import ExposureVsLimitsChart from '@/components/consulting/ExposureVsLimitsChart'
import ExposureLimitsPanel from '@/components/consulting/ExposureLimitsPanel'
import EditAssetClassModal from '@/components/consulting/EditAssetClassModal'
import ConsultantTabBar, { type ConsultantTab } from '@/components/consulting/ConsultantTabBar'
import ReportAndBilling from '@/components/consulting/ReportAndBilling'
import AssetThesesEditor from '@/components/consulting/AssetThesesEditor'
import InvestmentEvolutionChart from '@/components/investments/InvestmentEvolutionChart'

import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import AssetDefinitionFormModal from '@/components/investments/AssetDefinitionFormModal'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'

// ─── AUM global overview ──────────────────────────────────────────────────────

type GlobalAumRow = {
  id: string
  name: string
  email: string
  aum: number
  cash: number
  assetsCount: number
  deviationPct: number
}

type GlobalAumData = {
  totalAum: number
  totalCash: number
  clientCount: number
  clientRows: GlobalAumRow[]
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ConsultantDashboard() {
  const { user } = useAuth()

  // ── Seleção de cliente ────────────────────────────────────────────────────
  const [selectedClientId, setSelectedClientId] = useState('')
  const selectedClientIdRef = useRef(selectedClientId)
  selectedClientIdRef.current = selectedClientId

  const [activeTab, setActiveTab] = useState<ConsultantTab>('overview')
  const [yieldBasis, setYieldBasis] = useState<ClientKpiYieldBasis>('gross')
  const [isClientPickerOpen, setIsClientPickerOpen] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // ── Visão geral AUM ────────────────────────────────────────────────────────
  const [globalAumData, setGlobalAumData] = useState<GlobalAumData | null>(null)

  // ── Hooks de domínio ──────────────────────────────────────────────────────
  const portfolioHook = useClientPortfolio()
  const clientMgmt = useClientManagement()

  const {
    portfolio, transactions, positions, investedValue, cashValue, totalValue,
    shareValue, totalShares, assetPrices, assetDefinitions,
    groupTargets, billingFeeRate, clientNotes, assetTheses,
    executiveSummary, nextMonthPlan, shareHistoryData,
    performanceMetrics, consolidatedClass: consolidatedClassData,
    consolidatedSector: consolidatedSectorData, loadingPortfolio,
    loadPortfolioData, updateClientNotes, updateBillingFeeRate,
    updateExecutiveSummary, updateNextMonthPlan,
  } = portfolioHook

  const {
    clients, loadingClients, creatingClient, deletingClient, eligibleClients,
    loadingEligible, linking, loadClients, handleCreateClient,
    handleDeleteClient, handleLinkClient, loadEligibleClients,
  } = clientMgmt

  const rebalancingTrades = useRebalancingTrades(positions, totalValue)

  // ── Estados de UI secundários ─────────────────────────────────────────────
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [clientToDelete, setClientToDelete] = useState<Profile | null>(null)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('')

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false)
  const [selectedRealClientId, setSelectedRealClientId] = useState('')

  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [isReconciliationOpen, setIsReconciliationOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)

  const [assetDefModalOpen, setAssetDefModalOpen] = useState(false)
  const [assetDefTicker, setAssetDefTicker] = useState('')

  const [isEditAssetModalOpen, setIsEditAssetModalOpen] = useState(false)
  const [editingAssetTicker, setEditingAssetTicker] = useState('')
  const [editingAssetClass, setEditingAssetClass] = useState('')
  const [editingAssetSector, setEditingAssetSector] = useState('')
  const [savingAssetClass, setSavingAssetClass] = useState(false)

  const [limitsCollapsed, setLimitsCollapsed] = useState(true)
  const [showGroupTargetForm, setShowGroupTargetForm] = useState(false)
  const [groupTargetType, setGroupTargetType] = useState<'class' | 'sector'>('class')
  const [groupTargetName, setGroupTargetName] = useState('Ações Nacionais')
  const [groupTargetPct, setGroupTargetPct] = useState('')
  const [editingGroupTarget, setEditingGroupTarget] = useState<PortfolioGroupTarget | null>(null)
  const [savingGroupTarget, setSavingGroupTarget] = useState(false)

  const [editingThesisTicker, setEditingThesisTicker] = useState('')
  const [thesisText, setThesisText] = useState('')
  const [savingThesis, setSavingThesis] = useState(false)
  const [savingReport, setSavingReport] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)

  // ── Cálculos derivados (memo) ─────────────────────────────────────────────

  // Rentabilidade consolidada corrigida (com dividendos) e ganho em BRL
  const { overallYieldPct, overallGainBrl } = React.useMemo(() => {
    const perf = nonCashPortfolioPerformance(positions, yieldBasis)
    return {
      overallYieldPct: perf.yieldPct,
      overallGainBrl: perf.gainBrl
    }
  }, [positions, yieldBasis])

  const netShareValue = React.useMemo(() => {
    const totalCost = positions.reduce((s, p) => s + p.cost_basis, 0)
    const totalNet = positions.reduce((s, p) => s + p.cost_basis * (1 + p.net_yield_pct / 100), 0)
    if (totalCost <= 0 || shareValue <= 0) return shareValue
    return Math.round(shareValue * (totalNet / totalCost) * 10000) / 10000
  }, [positions, shareValue])

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    loadClients()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      loadPortfolioData(selectedClientId)
    } else {
      loadGlobalOverview()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId])

  useEffect(() => {
    if (isLinkModalOpen) {
      loadEligibleClients().then((eligible) => {
        if (eligible.length > 0) setSelectedRealClientId(eligible[0].id)
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLinkModalOpen])

  // ── Visão Geral AUM consolidado ───────────────────────────────────────────

  const isOverviewLoadStale = () => selectedClientIdRef.current !== ''

  const loadGlobalOverview = async (opts?: { forceRefresh?: boolean }) => {
    try {
      const { data: ports, error: portsErr } = await supabase
        .from('portfolios')
        .select('*, client:profiles!client_id(*)')
        .or(`consultant_id.eq.${user?.id},client_id.eq.${user?.id}`)
      if (portsErr) throw portsErr

      const portfoliosList = (ports || []).filter((port) => {
        const cp = parseJoinedProfile(port.client)
        return cp && (cp.role === 'client' || cp.id === user?.id)
      })

      let transactionsList: PortfolioTransaction[] = []
      let txPage = 0
      const txPageSize = 1000
      let txHasMore = true
      while (txHasMore) {
        const { data: pageData, error: txsErr } = await supabase
          .from('portfolio_transactions')
          .select('*')
          .range(txPage * txPageSize, (txPage + 1) * txPageSize - 1)
        if (txsErr) throw txsErr
        if (!pageData || pageData.length === 0) {
          txHasMore = false
        } else {
          transactionsList = [...transactionsList, ...pageData]
          if (pageData.length < txPageSize) txHasMore = false
          else txPage++
        }
      }

      const [{ data: allTargets }, { data: allDefinitions }] = await Promise.all([
        supabase.from('target_allocations').select('*'),
        supabase.from('portfolio_asset_definitions').select(
          'id, portfolio_id, ticker, pricing_mode, is_b3_linked, applied_amount, contract_rate, indexer, indexer_percent, maturity_date, manual_current_value, manual_value_updated_at, tax_exempt, is_treasury, application_date, created_at, updated_at, currency, valuation_mode'
        ),
      ])

      const targetsList = allTargets || []
      const definitionsList = (allDefinitions || []) as import('@/types').PortfolioAssetDefinition[]

      const batchContext = await prepareBatchValuationContext(definitionsList, transactionsList, {
        forceRefresh: opts?.forceRefresh,
        extraTickers: targetsList.map((t) => t.ticker.toUpperCase()),
      })

      let overallAum = 0
      let overallCash = 0

      const rows: GlobalAumRow[] = portfoliosList.map((port) => {
        const cp = parseJoinedProfile(port.client)
        const clientName = cp ? resolveProfileDisplayName(cp) : 'Sem nome'
        const clientTxs = transactionsList.filter((t) => t.portfolio_id === port.id)
        const clientTargets = targetsList.filter((t) => t.portfolio_id === port.id)
        const clientDefs = batchContext.normalizedDefinitions.filter((d) => d.portfolio_id === port.id)
        const cashVal = Number(port.cash_balance) || 0

        const { positions: calcPositions, totalValue: tv, cashValue: cv } = valuatePortfolioSync({
          transactions: clientTxs,
          targets: clientTargets,
          definitions: clientDefs,
          cashBalance: cashVal,
          prices: batchContext.prices,
          indexRatesByIndexer: batchContext.indexRatesByIndexer,
          vnaMap: batchContext.vnaMap,
        })

        overallAum += tv
        overallCash += cv

        let deviationPct = 0
        if (tv > 0) {
          calcPositions.forEach((pos) => { deviationPct += Math.abs(pos.current_percentage - pos.target_percentage) })
        }

        return {
          id: port.client_id,
          name: clientName,
          email: cp?.email || '',
          aum: tv,
          cash: cv,
          assetsCount: calcPositions.length,
          deviationPct: Math.round(deviationPct * 10) / 10,
        }
      })

      rows.sort((a, b) => b.deviationPct - a.deviationPct)

      if (isOverviewLoadStale()) return

      setGlobalAumData({ totalAum: overallAum, totalCash: overallCash, clientCount: portfoliosList.length, clientRows: rows })
    } catch (e) {
      console.error('[ConsultantDashboard] loadGlobalOverview:', e)
    }
  }

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectedClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    if (!clientId) setActiveTab('overview')
  }

  const handleForceRefresh = async () => {
    try {
      setRefreshing(true)
      if (selectedClientId) {
        await loadPortfolioData(selectedClientId, { forceRefresh: true })
      } else {
        await loadGlobalOverview({ forceRefresh: true })
      }
      toast.success('Cotações atualizadas com sucesso!')
    } catch {
      toast.error('Erro ao atualizar cotações.')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSavePortfolioSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return
    setSavingSettings(true)
    try {
      const { error } = await supabase
        .from('portfolios')
        .update({ notes: clientNotes })
        .eq('id', portfolio.id)
      if (error) throw error
      toast.success('Anotações salvas com sucesso!')
    } catch {
      toast.error('Erro ao salvar anotações')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleSaveAssetClassification = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingAssetTicker) return
    setSavingAssetClass(true)
    try {
      const { data: existingPrice } = await supabase
        .from('asset_prices')
        .select('current_price')
        .eq('ticker', editingAssetTicker)
        .maybeSingle()
      const currentPrice = existingPrice?.current_price || 50.0
      const { error } = await supabase.from('asset_prices').upsert({
        ticker: editingAssetTicker,
        current_price: currentPrice,
        last_updated: new Date().toISOString(),
        asset_class: editingAssetClass || undefined,
        sector: editingAssetSector || undefined,
      })
      if (error) throw error
      toast.success(`Classificação de ${editingAssetTicker} atualizada com sucesso!`)
      setIsEditAssetModalOpen(false)
      loadPortfolioData(selectedClientId)
    } catch {
      toast.error('Erro ao atualizar classificação do ativo')
    } finally {
      setSavingAssetClass(false)
    }
  }

  const handleSaveGroupTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return
    setSavingGroupTarget(true)
    try {
      const pct = parseFloat(groupTargetPct)
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de limite inválido (0 a 100)')
      const name = groupTargetName.trim()
      if (!name) throw new Error('Insira o nome do grupo')
      const { error } = await supabase.from('portfolio_group_targets').upsert({
        ...(editingGroupTarget?.id ? { id: editingGroupTarget.id } : {}),
        portfolio_id: portfolio.id,
        group_type: groupTargetType,
        group_name: name,
        target_percentage: pct,
      })
      if (error) throw error
      toast.success(editingGroupTarget ? 'Limite de exposição atualizado!' : 'Limite de exposição cadastrado!')
      setGroupTargetPct('')
      setEditingGroupTarget(null)
      setShowGroupTargetForm(false)
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar limite')
    } finally {
      setSavingGroupTarget(false)
    }
  }

  const handleDeleteGroupTarget = async (id: string) => {
    try {
      const { error } = await supabase.from('portfolio_group_targets').delete().eq('id', id)
      if (error) throw error
      toast.success('Limite excluído!')
      loadPortfolioData(selectedClientId)
    } catch {
      toast.error('Erro ao excluir limite')
    }
  }

  const handleEditGroupTarget = (gt: PortfolioGroupTarget) => {
    setEditingGroupTarget(gt)
    setGroupTargetType(gt.group_type)
    setGroupTargetName(gt.group_name)
    setGroupTargetPct(gt.target_percentage.toString())
    setShowGroupTargetForm(true)
  }

  const handleSaveThesis = async () => {
    if (!editingThesisTicker) return
    setSavingThesis(true)
    try {
      const ticker = editingThesisTicker.toUpperCase().trim()
      const { error } = await supabase.from('asset_theses').upsert({
        consultant_id: user?.id,
        ticker,
        thesis: thesisText,
      })
      if (error) throw error
      toast.success(`Tese de ${ticker} salva com sucesso!`)
      setEditingThesisTicker('')
      setThesisText('')
      loadPortfolioData(selectedClientId)
    } catch {
      toast.error('Erro ao salvar tese')
    } finally {
      setSavingThesis(false)
    }
  }

  const handleDeleteThesis = async (ticker: string) => {
    if (!window.confirm(`Excluir a tese de ${ticker}? Esta ação não pode ser desfeita.`)) return
    try {
      const { error } = await supabase
        .from('asset_theses')
        .delete()
        .eq('consultant_id', user?.id)
        .eq('ticker', ticker.toUpperCase())
      if (error) throw error
      toast.success(`Tese de ${ticker} excluída!`)
      if (editingThesisTicker === ticker) { setEditingThesisTicker(''); setThesisText('') }
      loadPortfolioData(selectedClientId)
    } catch {
      toast.error('Erro ao excluir tese')
    }
  }

  const handleSaveReport = async () => {
    setSavingReport(true)
    try {
      const upserts = [
        { consultant_id: user?.id, ticker: '__EXECUTIVE_SUMMARY__', thesis: executiveSummary },
        { consultant_id: user?.id, ticker: '__NEXT_MONTH_PLAN__', thesis: nextMonthPlan },
      ]
      const { error } = await supabase.from('asset_theses').upsert(upserts)
      if (error) throw error
      toast.success('Sumário e planejamento salvos com sucesso!')
    } catch {
      toast.error('Erro ao salvar sumário e planejamento')
    } finally {
      setSavingReport(false)
    }
  }

  const handleSaveFeeRate = async (rate: number) => {
    updateBillingFeeRate(rate)
    if (!portfolio) return
    try {
      const { error } = await supabase
        .from('portfolios')
        .update({ billing_fee_rate: rate })
        .eq('id', portfolio.id)
      if (error) throw error
    } catch {
      console.error('[ConsultantDashboard] Erro ao salvar taxa de fee')
    }
  }

  const handleExportPDF = async () => {
    if (!portfolio || !selectedClientId) return
    const client = clients.find((c) => c.id === selectedClientId)
    if (!client) return
    toast.loading('Gerando relatório PDF de alta qualidade...', { id: 'pdf-toast' })
    try {
      await generateConsultingPDF({
        clientName: resolveProfileDisplayName(client),
        portfolio,
        positions,
        shareHistory: shareHistoryData,
        metrics: performanceMetrics,
        theses: assetTheses,
        cashBalance: Number(portfolio.cash_balance) || 0,
        totalValue,
        investedValue,
        groupTargets,
        executiveSummary: executiveSummary || undefined,
        nextMonthPlan: nextMonthPlan || undefined,
        billingFeeRate,
        assetPrices,
        transactions,
      })
      toast.success('Relatório PDF exportado com sucesso!', { id: 'pdf-toast' })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao renderizar o PDF.', { id: 'pdf-toast' })
    }
  }

  // ── Dados derivados de UI ─────────────────────────────────────────────────

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const isSelfPortfolio = selectedClientId !== '' && selectedClientId === user?.id
  const isTempClient = selectedClient?.email ? isProvisionalClientEmail(selectedClient.email) : false
  const clientPickerLabel = selectedClient ? resolveProfileDisplayName(selectedClient) : 'Visão Geral'

  // ── Render ────────────────────────────────────────────────────────────────

  const headerAction = (
    <PageHeaderActions className="justify-between sm:justify-end">
      <PageHeaderActionButton
        intent="balance"
        icon={Users}
        label={loadingClients ? 'Clientes...' : clientPickerLabel}
        compactOnMobile={false}
        onClick={() => setIsClientPickerOpen(true)}
        disabled={loadingClients}
      />
      <PageHeaderActionButton
        intent="warning"
        icon={RefreshCw}
        label={refreshing ? 'Atualizando...' : 'Atualizar'}
        compactOnMobile={false}
        onClick={handleForceRefresh}
        disabled={refreshing || loadingPortfolio}
      />
      <PageHeaderActionButton
        intent="primary"
        icon={UserPlus}
        label="Novo cliente"
        compactOnMobile={false}
        onClick={() => setIsClientModalOpen(true)}
      />
    </PageHeaderActions>
  )

  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      <PageHeader
        title={PAGE_HEADERS.consulting.title}
        subtitle={
          selectedClient
            ? `Cliente: ${resolveProfileDisplayName(selectedClient)}`
            : PAGE_HEADERS.consulting.description
        }
        action={headerAction}
      />

      {/* Cabeçalho do Cliente Selecionado */}
      {selectedClient && (
        <ClientOverviewHeader
          selectedClient={selectedClient}
          isTempClient={!!isTempClient}
          isSelfPortfolio={isSelfPortfolio}
          onDeleteClick={() => { setClientToDelete(selectedClient); setIsDeleteModalOpen(true) }}
          onLinkClick={() => setIsLinkModalOpen(true)}
        />
      )}

      {/* Barra de Abas Premium */}
      {portfolio && selectedClient && (
        <ConsultantTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      )}

      {/* Conteúdo principal */}
      {portfolio && selectedClientId ? (
        <div className={`transition-all duration-300 ${loadingPortfolio ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="space-y-6 animate-page-enter">

            {/* Aba: Resumo & Relatório */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex items-center gap-2 text-sm text-secondary">
                  <Switch
                    checked={yieldBasis === 'net'}
                    onClick={() => setYieldBasis((b) => (b === 'gross' ? 'net' : 'gross'))}
                    label="Visão líquida"
                  />
                  <span>Visão líquida (IR estimado)</span>
                </div>
                <ClientKpiCards
                  investedValue={investedValue}
                  cashValue={cashValue}
                  totalValue={totalValue}
                  shareValue={shareValue}
                  totalShares={totalShares}
                  overallYieldPct={overallYieldPct}
                  yieldBasis={yieldBasis}
                  netShareValue={netShareValue}
                  overallGainBrl={overallGainBrl}
                />
                <InvestmentEvolutionChart shareHistoryData={shareHistoryData} />
                <ReportAndBilling
                  clientNotes={clientNotes}
                  setClientNotes={updateClientNotes}
                  onSaveNotes={handleSavePortfolioSettings}
                  savingNotes={savingSettings}
                  executiveSummary={executiveSummary}
                  setExecutiveSummary={updateExecutiveSummary}
                  nextMonthPlan={nextMonthPlan}
                  setNextMonthPlan={updateNextMonthPlan}
                  savingReport={savingReport}
                  onSaveReport={handleSaveReport}
                  portfolioValue={totalValue}
                  billingFeeRate={billingFeeRate}
                  setBillingFeeRate={handleSaveFeeRate}
                  positionsCount={positions.length}
                  thesesCount={Object.keys(assetTheses).filter(k => !k.startsWith('__') && assetTheses[k]?.trim()).length}
                  totalPositions={positions.filter(p => !p.ticker.startsWith('__')).length}
                  onExportPDF={handleExportPDF}
                />
              </div>
            )}

            {/* Aba: Alocação & Simulação */}
            {activeTab === 'allocation' && (
              <div className="space-y-6 animate-fade-in">
                <ExposureLimitsPanel
                  groupTargets={groupTargets}
                  limitsCollapsed={limitsCollapsed}
                  onToggleCollapse={() => setLimitsCollapsed((c) => !c)}
                  onEdit={handleEditGroupTarget}
                  onDelete={handleDeleteGroupTarget}
                  onAddNew={() => {
                    setEditingGroupTarget(null)
                    setGroupTargetType('class')
                    setGroupTargetName('Ações Nacionais')
                    setGroupTargetPct('')
                    setShowGroupTargetForm(true)
                  }}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                  <ClientAllocationCharts
                    classChartData={consolidatedClassData.map((g) => ({
                      name: g.name,
                      value: g.total_value,
                      color: getAllocationClassColor(g.name),
                    }))}
                    consolidatedClass={consolidatedClassData}
                  />
                  <SectorExposureChart consolidatedSector={consolidatedSectorData} />
                </div>
                <div className="text-left">
                  <ExposureVsLimitsChart positions={positions} />
                </div>
                <ContributionSimulator
                  portfolio={portfolio}
                  positions={positions}
                  onContributionExecuted={() => loadPortfolioData(selectedClientId)}
                />
                <div className="grid grid-cols-1 gap-6 text-left">
                  <RebalancingChecklist rebalancingTrades={rebalancingTrades} />
                </div>
              </div>
            )}

            {/* Aba: Posições & Teses */}
            {activeTab === 'positions' && (
              <div className="space-y-6 animate-fade-in">
                <PositionsTable
                  positions={positions}
                  groupTargets={groupTargets}
                  assetTheses={assetTheses}
                  showGroupTargetForm={showGroupTargetForm}
                  groupTargetType={groupTargetType}
                  setGroupTargetType={setGroupTargetType}
                  groupTargetName={groupTargetName}
                  setGroupTargetName={setGroupTargetName}
                  groupTargetPct={groupTargetPct}
                  setGroupTargetPct={setGroupTargetPct}
                  onSaveGroupTarget={handleSaveGroupTarget}
                  onDeleteGroupTarget={handleDeleteGroupTarget}
                  onEditAssetClassification={(ticker, cls, sector) => {
                    setEditingAssetTicker(ticker)
                    setEditingAssetClass(cls)
                    setEditingAssetSector(sector)
                    setIsEditAssetModalOpen(true)
                  }}
                  onOpenAssetConfig={(ticker) => {
                    setAssetDefTicker(ticker)
                    setAssetDefModalOpen(true)
                  }}
                />
                <AssetThesesEditor
                  positions={positions}
                  assetTheses={assetTheses}
                  editingThesisTicker={editingThesisTicker}
                  setEditingThesisTicker={setEditingThesisTicker}
                  thesisText={thesisText}
                  setThesisText={setThesisText}
                  savingThesis={savingThesis}
                  onSaveThesis={handleSaveThesis}
                  onDeleteThesis={handleDeleteThesis}
                />
              </div>
            )}

            {/* Aba: Livro-Razão */}
            {activeTab === 'ledger' && (
              <LedgerBook
                transactions={transactions}
                onOpenTxModal={(tx) => { setEditingTransaction(tx ?? null); setIsTxModalOpen(true) }}
                onOpenReconciliation={() => setIsReconciliationOpen(true)}
                portfolioId={portfolio?.id}
                onSaved={() => loadPortfolioData(selectedClientId)}
              />
            )}
          </div>
        </div>
      ) : selectedClientId === '' ? (
        /* Visão Geral AUM */
        <AdvisorOverview
          globalAumData={globalAumData}
          clients={clients}
          onSelectClient={handleSelectedClientChange}
          onDeleteClient={(cl) => { setClientToDelete(cl); setIsDeleteModalOpen(true) }}
        />
      ) : (
        /* Carteira vazia / carregando */
        <Card className="p-10 text-center space-y-3">
          {loadingPortfolio ? (
            <Loader text="Carregando..." className="py-10" />
          ) : (
            <>
              <p className="text-secondary text-sm">Este cliente não possui uma carteira ativa configurada.</p>
              <Button onClick={() => loadPortfolioData(selectedClientId)}>Inicializar Carteira</Button>
            </>
          )}
        </Card>
      )}

      {/* ── Modais ──────────────────────────────────────────────────────── */}

      {/* Seleção de Cliente */}
      <ClientPickerModal
        isOpen={isClientPickerOpen}
        onClose={() => setIsClientPickerOpen(false)}
        clients={clients}
        value={selectedClientId}
        onChange={handleSelectedClientChange}
        selfUserId={user?.id}
      />

      {/* Novo Cliente */}
      <ModalForm
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Cadastrar Novo Cliente"
        onSubmit={(e) => {
          e.preventDefault()
          handleCreateClient(newClientName, newClientEmail, (clientId) => {
            setIsClientModalOpen(false)
            setNewClientName('')
            setNewClientEmail('')
            setSelectedClientId(clientId)
          })
        }}
        footer={(formId) => (
          <ModalFooter
            formId={formId}
            onCancel={() => setIsClientModalOpen(false)}
            submitLabel="Cadastrar Cliente"
            loading={creatingClient}
            loadingLabel="Cadastrando..."
          />
        )}
      >
        <p className="modal-intro font-sans">
          O perfil do cliente será criado diretamente no banco. Quando ele se registrar no app com
          o mesmo e-mail, terá acesso instantâneo.
        </p>
        <Input
          label="Nome Completo"
          type="text"
          required
          placeholder="Nome do cliente"
          value={newClientName}
          onChange={(e) => setNewClientName(e.target.value)}
          className="text-sm font-semibold"
        />
        <Input
          label="E-mail de Acesso (Opcional)"
          type="email"
          placeholder="cliente@email.com"
          value={newClientEmail}
          onChange={(e) => setNewClientEmail(e.target.value)}
          helperText="Deixe em branco se deseja criar um perfil provisório e associar a um e-mail posteriormente."
          className="text-sm font-semibold font-mono"
        />
      </ModalForm>

      {/* Vincular Provisório a Usuário Real */}
      <ModalForm
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Vincular Carteira a Usuário Real"
        onSubmit={(e) => {
          e.preventDefault()
          if (!portfolio) return
          handleLinkClient(portfolio, selectedClientId, selectedRealClientId, (newId) => {
            setIsLinkModalOpen(false)
            setSelectedClientId(newId)
          })
        }}
        footer={(formId) =>
          loadingEligible ? undefined : eligibleClients.length === 0 ? (
            <ModalFooter onCancel={() => setIsLinkModalOpen(false)} cancelLabel="Fechar" />
          ) : (
            <ModalFooter
              formId={formId}
              onCancel={() => setIsLinkModalOpen(false)}
              submitLabel="Vincular Carteira"
              loading={linking}
              loadingLabel="Vinculando..."
            />
          )
        }
      >
        <p className="modal-intro font-sans">
          Selecione uma conta de cliente real cadastrada no aplicativo para transferir a gestão
          desta carteira patrimonial de forma definitiva. O perfil provisório antigo será removido.
        </p>
        {loadingEligible ? (
          <div className="modal-empty-state text-xs text-secondary">Carregando e-mails disponíveis...</div>
        ) : eligibleClients.length === 0 ? (
          <div className="modal-empty-state animate-page-enter">
            <p className="text-xs text-secondary italic font-sans">Nenhuma conta de cliente real sem carteira foi encontrada no banco.</p>
            <p className="text-[10px] text-secondary opacity-60 font-sans">Para vincular, o cliente precisa primeiro se cadastrar no aplicativo com o e-mail real dele.</p>
          </div>
        ) : (
          <Select
            label="Selecionar E-mail Real"
            value={selectedRealClientId}
            onChange={(e) => setSelectedRealClientId(e.target.value)}
            options={eligibleClients.map((c) => ({
              value: c.id,
              label: resolveProfileDisplayName(c),
              sublabel: c.email,
            }))}
            placeholder="Selecione um e-mail real..."
            required
          />
        )}
      </ModalForm>

      {/* Edição de Classificação do Ativo */}
      <EditAssetClassModal
        isOpen={isEditAssetModalOpen}
        onClose={() => setIsEditAssetModalOpen(false)}
        ticker={editingAssetTicker}
        assetClass={editingAssetClass}
        assetSector={editingAssetSector}
        saving={savingAssetClass}
        onAssetClassChange={setEditingAssetClass}
        onAssetSectorChange={setEditingAssetSector}
        onSave={handleSaveAssetClassification}
      />

      {/* Exclusão / Desvinculação de Cliente */}
      <ModalForm
        isOpen={isDeleteModalOpen}
        onClose={() => { setIsDeleteModalOpen(false); setClientToDelete(null); setDeleteConfirmEmail('') }}
        title={
          clientToDelete
            ? isProvisionalClientEmail(clientToDelete.email)
              ? 'Excluir Conta Provisória'
              : 'Desvincular Carteira de Cliente Real'
            : 'Gerenciar Cliente'
        }
        onSubmit={(e) => {
          e.preventDefault()
          if (!clientToDelete) return
          handleDeleteClient(clientToDelete, deleteConfirmEmail, (deletedId) => {
            setIsDeleteModalOpen(false)
            setClientToDelete(null)
            setDeleteConfirmEmail('')
            if (selectedClientId === deletedId) setSelectedClientId('')
          })
        }}
        footer={(formId) =>
          clientToDelete ? (
            <ModalFooter
              formId={formId}
              onCancel={() => { setIsDeleteModalOpen(false); setClientToDelete(null); setDeleteConfirmEmail('') }}
              submitLabel={isProvisionalClientEmail(clientToDelete.email) ? 'Sim, Excluir Definitivamente' : 'Sim, Desvincular Assessoria'}
              submitVariant={isProvisionalClientEmail(clientToDelete.email) ? 'danger' : 'primary'}
              submitIcon={<Trash2 size={13} aria-hidden />}
              submitDisabled={deleteConfirmEmail.trim() !== clientToDelete.email}
              loading={deletingClient}
              loadingLabel={isProvisionalClientEmail(clientToDelete.email) ? 'Excluindo...' : 'Desvinculando...'}
            />
          ) : undefined
        }
      >
        {clientToDelete && (
          <>
            {isProvisionalClientEmail(clientToDelete.email) ? (
              <div className="modal-alert modal-alert--danger font-sans">
                <AlertCircle size={16} className="shrink-0 mt-0.5" aria-hidden />
                <div>
                  <strong className="mb-1 block font-bold">Atenção! Esta ação é irreversível.</strong>
                  Ao confirmar, todos os dados da carteira provisória, metas e transações do e-mail provisório{' '}
                  <strong>{clientToDelete.email}</strong> serão excluídos permanentemente do banco de dados.
                </div>
              </div>
            ) : (
              <div className="modal-alert modal-alert--warning font-sans">
                <ShieldCheck size={16} className="shrink-0 mt-0.5" aria-hidden />
                <div>
                  <strong className="mb-1 block font-bold">Desvinculação de Assessoria (Seguro)</strong>
                  Esta é uma conta de cliente real. Ao confirmar, o sistema apenas removerá o seu acesso como consultor a esta carteira patrimonial.
                </div>
              </div>
            )}
            <div className="modal-field-group">
              <label className="block font-sans text-[10px] font-extrabold uppercase tracking-wider text-secondary">
                Para prosseguir, digite o e-mail do cliente abaixo:
              </label>
              <p className="modal-panel-glass inline-block select-all p-2 font-mono text-xs text-primary">
                {clientToDelete.email}
              </p>
              <Input
                type="email"
                required
                placeholder="Digite o e-mail exato para confirmar"
                value={deleteConfirmEmail}
                onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </>
        )}
      </ModalForm>

      {/* Transações e Reconciliação */}
      {portfolio && (
        <>
          <PortfolioTransactionFormModal
            isOpen={isTxModalOpen}
            onClose={() => { setIsTxModalOpen(false); setEditingTransaction(null) }}
            portfolioId={portfolio.id}
            editingTransaction={editingTransaction}
            onSaved={() => loadPortfolioData(selectedClientId)}
          />
          <InvestmentReconciliationModal
            isOpen={isReconciliationOpen}
            onClose={() => setIsReconciliationOpen(false)}
            portfolioId={portfolio.id}
            existingTransactions={transactions}
            onSaved={() => loadPortfolioData(selectedClientId)}
            onOpenAssetConfig={(ticker) => { setAssetDefTicker(ticker); setAssetDefModalOpen(true) }}
          />
        </>
      )}

      {/* Definição e Metas de Ativos */}
      {portfolio && (
        <AssetDefinitionFormModal
          isOpen={assetDefModalOpen}
          onClose={() => setAssetDefModalOpen(false)}
          portfolioId={portfolio.id}
          ticker={assetDefTicker}
          existing={assetDefinitions.find((d) => d.ticker.toUpperCase() === assetDefTicker.toUpperCase()) ?? null}
          onSaved={() => loadPortfolioData(selectedClientId)}
        />
      )}

      {/* Limites de Exposição — Modal */}
      {portfolio && (
        <ModalForm
          isOpen={showGroupTargetForm}
          onClose={() => { setShowGroupTargetForm(false); setEditingGroupTarget(null) }}
          title="Definir Limites de Exposição"
          size="md"
          onSubmit={(event) => void handleSaveGroupTarget(event)}
          footer={(formId) => (
            <ModalFooter
              formId={formId}
              onCancel={() => { setShowGroupTargetForm(false); setEditingGroupTarget(null) }}
              submitLabel={savingGroupTarget ? 'Salvando...' : 'Salvar Limite'}
              submitDisabled={savingGroupTarget}
              loading={savingGroupTarget}
            />
          )}
        >
          <InvestmentsGroupTargetForm
            groupTargetType={groupTargetType}
            groupTargetName={groupTargetName}
            groupTargetPct={groupTargetPct}
            onTypeChange={(type) => { setGroupTargetType(type); setGroupTargetName(type === 'class' ? 'Ações Nacionais' : '') }}
            onNameChange={setGroupTargetName}
            onPctChange={setGroupTargetPct}
          />
        </ModalForm>
      )}
    </div>
  )
}

// ─── Utilitário local ─────────────────────────────────────────────────────────

function parseJoinedProfile(raw: unknown): import('@/types').Profile | null {
  if (!raw) return null
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object' || !('id' in obj)) return null
  return obj as import('@/types').Profile
}
