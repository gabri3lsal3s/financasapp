import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { PROFILE_SELECT_COLUMNS } from '@/constants/profileSelect'
import { Profile, Portfolio, PortfolioTransaction, TargetAllocation, AssetPrice, PortfolioGroupTarget, PortfolioAssetDefinition } from '@/types'
import { calculatePositions, calculateShareHistory, calculatePerformanceMetrics, calculateConsolidatedByClass, calculateConsolidatedBySector, AssetPosition } from '@/services/investmentEngine'
import { getAssetPrices, searchB3Assets } from '@/services/priceService'
import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import type { IndexRateMap } from '@/utils/fixedIncomeValuation'
import ContributionSimulator from '@/components/ContributionSimulator'
import Card from '@/components/Card'
import Loader from '@/components/Loader'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import { UserPlus, Trash2, ShieldCheck, AlertCircle, LayoutDashboard, PieChart, RefreshCw, Briefcase, History, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateConsultingPDF } from '@/services/pdfGenerator'

// Componentes Modulares
import AdvisorOverview from '@/components/consulting/AdvisorOverview'
import ClientOverviewHeader from '@/components/consulting/ClientOverviewHeader'
import ClientKpiCards from '@/components/consulting/ClientKpiCards'
import ClientAllocationCharts from '@/components/consulting/ClientAllocationCharts'
import RebalancingChecklist from '@/components/consulting/RebalancingChecklist'
import PositionsTable from '@/components/consulting/PositionsTable'
import AdvisorNotes from '@/components/consulting/AdvisorNotes'
import LedgerBook from '@/components/consulting/LedgerBook'
import QualitativeAnalysis from '@/components/consulting/QualitativeAnalysis'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'

// Novos Componentes de Monitoramento Analítico (Grid Mode)
import SectorExposureChart from '@/components/consulting/SectorExposureChart'
import ExposureVsLimitsChart from '@/components/consulting/ExposureVsLimitsChart'
import WeeklyVariationChart from '@/components/consulting/WeeklyVariationChart'
import PerformanceMetricsCard from '@/components/consulting/PerformanceMetricsCard'
import { isPrimaryAdminProfile } from '@/constants/adminProfile'
import {
  buildProvisionalClientEmail,
  isProvisionalClientEmail,
} from '@/constants/provisionalClient'
import { profileSelectSublabel, resolveProfileDisplayName } from '@/utils/profileDisplayName'

function parseJoinedProfile(raw: unknown): Profile | null {
  if (!raw) return null
  const obj = Array.isArray(raw) ? raw[0] : raw
  if (!obj || typeof obj !== 'object' || !('id' in obj)) return null
  return obj as Profile
}

async function ensurePersonalPortfolio(userId: string): Promise<void> {
  const { data: existing } = await supabase
    .from('portfolios')
    .select('id')
    .eq('client_id', userId)
    .maybeSingle()

  if (existing) return

  const { error } = await supabase
    .from('portfolios')
    .insert({ client_id: userId, cash_balance: 0.0 })

  if (error && error.code !== '23505') throw error
}


export default function ConsultantDashboard() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Profile[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [loadingClients, setLoadingClients] = useState<boolean>(true)
  
  // Estado para Personalização de Layout & Billing
  const [activeTab, setActiveTab] = useState<'overview' | 'allocation' | 'rebalancing' | 'positions' | 'ledger' | 'qualitative'>('overview')
  const [billingFeeRate, setBillingFeeRate] = useState<number>(0.10)

  // Estado para Visão Geral de AUM Consolidado do Consultor
  const [globalAumData, setGlobalAumData] = useState<{
    totalAum: number
    totalCash: number
    clientCount: number
    clientRows: Array<{
      id: string
      name: string
      email: string
      aum: number
      cash: number
      assetsCount: number
      deviationPct: number
    }>
  } | null>(null)

  // Anotações qualitativas do portfólio
  const [clientNotes, setClientNotes] = useState<string>('')
  const [savingSettings, setSavingSettings] = useState<boolean>(false)
  
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>([])
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetPrice>>({})
  const [loadingPortfolio, setLoadingPortfolio] = useState<boolean>(false)
  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [indexRatesByIndexer, setIndexRatesByIndexer] = useState<Record<string, IndexRateMap>>({})

  // Estados de cálculo
  const [positions, setPositions] = useState<AssetPosition[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number>(0)
  const [shareValue, setShareValue] = useState<number>(1.0)
  const [totalShares, setTotalShares] = useState<number>(0)
  
  // Estado para cadastrar novo cliente
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false)
  const [newClientName, setNewClientName] = useState<string>('')
  const [newClientEmail, setNewClientEmail] = useState<string>('')
  const [creatingClient, setCreatingClient] = useState<boolean>(false)

  // Estado para exclusão de cliente (2 etapas)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false)
  const [clientToDelete, setClientToDelete] = useState<Profile | null>(null)
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState<string>('')
  const [deletingClientState, setDeletingClientState] = useState<boolean>(false)

  // Estado para vinculação de carteira provisória a e-mail real
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false)
  const [eligibleClients, setEligibleClients] = useState<Profile[]>([])
  const [selectedRealClientId, setSelectedRealClientId] = useState<string>('')
  const [linking, setLinking] = useState<boolean>(false)
  const [loadingEligible, setLoadingEligible] = useState<boolean>(false)

  // Estado para modal de transações
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)

  // Estado para gerenciar Metas de Alocação
  const [showTargetForm, setShowTargetForm] = useState<boolean>(false)
  const [targetTicker, setTargetTicker] = useState<string>('')
  const [targetPct, setTargetPct] = useState<string>('')
  const [isCustomTicker, setIsCustomTicker] = useState<boolean>(false)

  // Estado para gerenciar teses qualitativas
  const [assetTheses, setAssetTheses] = useState<Record<string, string>>({})
  const [editingThesisTicker, setEditingThesisTicker] = useState<string>('')
  const [thesisText, setThesisText] = useState<string>('')
  const [savingThesis, setSavingThesis] = useState<boolean>(false)

  // Estado para sumário executivo e planejamento
  const [executiveSummary, setExecutiveSummary] = useState<string>('')
  const [nextMonthPlan, setNextMonthPlan] = useState<string>('')
  const [savingReport, setSavingReport] = useState<boolean>(false)

  // Autocomplete B3 para metas de alocação
  const [targetSuggestions, setTargetSuggestions] = useState<{ ticker: string, name: string }[]>([])
  const [showTargetSuggestions, setShowTargetSuggestions] = useState<boolean>(false)

  // Estado para cadastrar novo ativo/meta com classe e setor forçados
  const [targetAssetClass, setTargetAssetClass] = useState<string>('')
  const [targetSector, setTargetSector] = useState<string>('')

  // Estado para modal de edição direta de classificação de qualquer ativo
  const [isEditAssetModalOpen, setIsEditAssetModalOpen] = useState<boolean>(false)
  const [editingAssetTicker, setEditingAssetTicker] = useState<string>('')
  const [editingAssetClass, setEditingAssetClass] = useState<string>('')
  const [editingAssetSector, setEditingAssetSector] = useState<string>('')
  const [savingAssetClass, setSavingAssetClass] = useState<boolean>(false)

  // Estado para limites de grupos (classes e setores)
  const [showGroupTargetForm, setShowGroupTargetForm] = useState<boolean>(false)
  const [groupTargetType, setGroupTargetType] = useState<'class' | 'sector'>('class')
  const [groupTargetName, setGroupTargetName] = useState<string>('Ações Nacionais')
  const [groupTargetPct, setGroupTargetPct] = useState<string>('')
  const [groupTargets, setGroupTargets] = useState<PortfolioGroupTarget[]>([])

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    if (selectedClientId) {
      loadPortfolioData(selectedClientId)
    } else {
      setPortfolio(null)
      setTransactions([])
      setTargetAllocations([])
      setPositions([])
      setPortfolioValue(0)
      loadGlobalOverview()
    }
  }, [selectedClientId])

  useEffect(() => {
    if (isLinkModalOpen) {
      loadEligibleClients()
    }
  }, [isLinkModalOpen])


  const handleSelectRegisteredTicker = (val: string) => {
    if (val === 'custom') {
      setIsCustomTicker(true)
      setTargetTicker('')
      setTargetAssetClass('')
      setTargetSector('')
    } else {
      setIsCustomTicker(false)
      setTargetTicker(val)
      const existing = assetPrices[val.toUpperCase()]
      if (existing) {
        setTargetAssetClass(existing.asset_class || '')
        setTargetSector(existing.sector || '')
      } else {
        setTargetAssetClass('')
        setTargetSector('')
      }
    }
  }

  const handleCustomTickerChange = async (val: string) => {
    setTargetTicker(val)
    const tickerUpper = val.toUpperCase().trim()
    const existing = assetPrices[tickerUpper]
    if (existing) {
      setTargetAssetClass(existing.asset_class || '')
      setTargetSector(existing.sector || '')
    }
    if (val.length >= 2) {
      const suggestions = await searchB3Assets(val)
      setTargetSuggestions(suggestions)
      setShowTargetSuggestions(true)
    } else {
      setTargetSuggestions([])
      setShowTargetSuggestions(false)
    }
  }



  const loadEligibleClients = async () => {
    try {
      setLoadingEligible(true)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('role', 'client')
        .not('email', 'like', 'temp_%')
        .order('email')

      if (profilesError) throw profilesError

      const { data: portfoliosData, error: portfoliosError } = await supabase
        .from('portfolios')
        .select('client_id')

      if (portfoliosError) throw portfoliosError

      const takenIds = new Set(portfoliosData?.map(p => p.client_id) || [])
      const eligible = (profilesData || []).filter(p => !takenIds.has(p.id))
      setEligibleClients(eligible)
      
      if (eligible.length > 0) {
        setSelectedRealClientId(eligible[0].id)
      } else {
        setSelectedRealClientId('')
      }
    } catch (err) {
      console.error('Erro ao carregar clientes elegíveis:', err)
      toast.error('Erro ao carregar contas de clientes reais')
    } finally {
      setLoadingEligible(false)
    }
  }

  const handleLinkClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio || !selectedClientId || !selectedRealClientId) return
    setLinking(true)
    try {
      const { error: updateError } = await supabase
        .from('portfolios')
        .update({ client_id: selectedRealClientId })
        .eq('id', portfolio.id)

      if (updateError) throw updateError

      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedClientId)

      if (deleteError) {
        console.error('Erro ao deletar perfil temporário órfão:', deleteError)
      }

      toast.success('Carteira vinculada com sucesso!')
      setIsLinkModalOpen(false)
      
      const { data: clientsData } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('role', 'client')
        .order('email')
        
      setClients(clientsData || [])
      setSelectedClientId(selectedRealClientId)
    } catch (err) {
      console.error('Erro ao vincular carteira:', err)
      toast.error('Erro ao vincular a carteira patrimonial')
    } finally {
      setLinking(false)
    }
  }

  const loadClients = async () => {
    if (!user?.id) return

    try {
      setLoadingClients(true)

      const [{ data: managedPorts, error: managedError }, { data: selfProfile, error: selfError }] =
        await Promise.all([
          supabase
            .from('portfolios')
            .select('client:profiles!client_id(*)')
            .eq('consultant_id', user.id),
          supabase
            .from('profiles')
            .select(PROFILE_SELECT_COLUMNS)
            .eq('id', user.id)
            .maybeSingle(),
        ])

      if (managedError) throw managedError
      if (selfError) throw selfError

      await ensurePersonalPortfolio(user.id)

      const clientList: Profile[] = []
      const seenIds = new Set<string>()

      if (selfProfile && !seenIds.has(selfProfile.id)) {
        clientList.push(selfProfile)
        seenIds.add(selfProfile.id)
      }

      for (const port of managedPorts || []) {
        const clientObj = parseJoinedProfile(port.client)
        if (clientObj && clientObj.role === 'client' && !seenIds.has(clientObj.id)) {
          clientList.push(clientObj)
          seenIds.add(clientObj.id)
        }
      }

      clientList.sort((a, b) => {
        if (a.id === user.id) return -1
        if (b.id === user.id) return 1
        return (a.email || '').localeCompare(b.email || '')
      })

      setClients(clientList)
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
      toast.error('Erro ao buscar lista de clientes')
    } finally {
      setLoadingClients(false)
    }
  }

  const loadGlobalOverview = async () => {
    try {
      setLoadingPortfolio(true)
      const { data: ports, error: portsErr } = await supabase
        .from('portfolios')
        .select('*, client:profiles!client_id(*)')
        .or(`consultant_id.eq.${user?.id},client_id.eq.${user?.id}`)

      if (portsErr) throw portsErr
      const portfoliosList = (ports || []).filter((port) => {
        const clientProfile = parseJoinedProfile(port.client)
        return clientProfile && (clientProfile.role === 'client' || clientProfile.id === user?.id)
      })

      const { data: allTxs, error: txsErr } = await supabase
        .from('portfolio_transactions')
        .select('*')

      if (txsErr) throw txsErr
      const transactionsList = allTxs || []

      const { data: allTargets, error: targetsErr } = await supabase
        .from('target_allocations')
        .select('*')

      if (targetsErr) throw targetsErr
      const targetsList = allTargets || []

      const tickers = Array.from(new Set([
        ...transactionsList.map(t => t.ticker.toUpperCase()),
        ...targetsList.map(t => t.ticker.toUpperCase())
      ]))

      const prices = tickers.length > 0 ? await getAssetPrices(tickers) : {}
      setAssetPrices(prices)

      let overallAum = 0
      let overallCash = 0
      
      const rows = portfoliosList.map(port => {
        const clientProfile = parseJoinedProfile(port.client)
        const clientName = clientProfile
          ? resolveProfileDisplayName(clientProfile)
          : 'Sem nome'
        const clientTxs = transactionsList.filter(t => t.portfolio_id === port.id)
        const clientTargets = targetsList.filter(t => t.portfolio_id === port.id)
        const cashVal = Number(port.cash_balance) || 0

        const { positions: calcPositions, totalValue } = calculatePositions(
          clientTxs,
          clientTargets,
          prices,
          cashVal
        )

        overallAum += totalValue
        overallCash += cashVal

        let deviationPct = 0
        if (totalValue > 0) {
          let sumDiff = 0
          calcPositions.forEach(pos => {
            sumDiff += Math.abs(pos.current_percentage - pos.target_percentage)
          })
          deviationPct = sumDiff
        }

        return {
          id: port.client_id,
          name: clientName,
          email: clientProfile?.email || '',
          aum: totalValue,
          cash: cashVal,
          assetsCount: calcPositions.length,
          deviationPct: Math.round(deviationPct * 10) / 10
        }
      })

      rows.sort((a, b) => b.deviationPct - a.deviationPct)

      setGlobalAumData({
        totalAum: overallAum,
        totalCash: overallCash,
        clientCount: portfoliosList.length,
        clientRows: rows
      })

    } catch (e) {
      console.error('Erro ao processar visão consolidada do consultor:', e)
    } finally {
      setLoadingPortfolio(false)
    }
  }

  const rebalancingTrades = React.useMemo(() => {
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

    return trades.sort((a, b) => {
      if (a.action !== b.action) {
        return a.action === 'buy' ? -1 : 1
      }
      return b.amount - a.amount
    })
  }, [positions, portfolioValue])

  const classChartData = React.useMemo(() => {
    const dataMap: Record<string, { name: string; value: number; color: string }> = {}
    positions.forEach(pos => {
      const cls = pos.asset_class || 'Renda Fixa'
      if (!dataMap[cls]) {
        let color = 'rgb(59, 130, 246)'
        if (cls.includes('Ações Nacionais')) color = 'rgb(99, 102, 241)'
        else if (cls.includes('Fundos')) color = 'rgb(16, 185, 129)'
        else if (cls.includes('Cripto')) color = 'rgb(245, 158, 11)'
        else if (cls.includes('Renda Fixa')) color = 'rgb(236, 72, 153)'
        else if (cls.includes('Internacionais')) color = 'rgb(6, 182, 212)'
        else if (cls.includes('ETFs')) color = 'rgb(139, 92, 246)'
        
        dataMap[cls] = { name: cls, value: 0, color }
      }
      dataMap[cls].value += pos.total_value
    })

    return Object.values(dataMap)
  }, [positions])

  const shareHistoryData = React.useMemo(() => {
    if (!portfolio) return []
    const { shareHistory } = calculateShareHistory(transactions, assetPrices, assetDefinitions, indexRatesByIndexer)
    return shareHistory
  }, [transactions, assetPrices, portfolio, assetDefinitions, indexRatesByIndexer])

  // Métricas de performance (metrics)
  const performanceMetrics = React.useMemo(() => {
    return calculatePerformanceMetrics(shareHistoryData)
  }, [shareHistoryData])

  // Rentabilidade real consolidada da carteira com base nos ativos
  const overallYieldPct = React.useMemo(() => {
    const totalCostBasis = positions.reduce((sum, p) => sum + p.cost_basis, 0)
    const totalGrossGain = positions.reduce((sum, p) => sum + p.cost_basis * (p.gross_yield_pct / 100), 0)
    return totalCostBasis > 0 ? (totalGrossGain / totalCostBasis) * 100 : 0
  }, [positions])

  // Consolidado por classe de ativos (consolidatedClass)
  const consolidatedClassData = React.useMemo(() => {
    return calculateConsolidatedByClass(positions, portfolioValue, groupTargets)
  }, [positions, portfolioValue, groupTargets])

  // Consolidado por setor econômico (consolidatedSector)
  const consolidatedSectorData = React.useMemo(() => {
    return calculateConsolidatedBySector(positions, portfolioValue, groupTargets)
  }, [positions, portfolioValue, groupTargets])

  const handleSavePortfolioSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return
    setSavingSettings(true)
    try {
      const { error } = await supabase
        .from('portfolios')
        .update({
          notes: clientNotes
        })
        .eq('id', portfolio.id)

      if (error) throw error
      toast.success('Anotações salvas com sucesso!')
      
      setPortfolio(prev => prev ? { ...prev, notes: clientNotes } : null)
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao salvar anotações')
    } finally {
      setSavingSettings(false)
    }
  }

  const loadPortfolioData = async (clientId: string) => {
    try {
      setLoadingPortfolio(true)
      
      const portLookup = await supabase
        .from('portfolios')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()

      let portData = portLookup.data
      const portError = portLookup.error

      if (portError) throw portError

      if (!portData) {
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: clientId, consultant_id: user?.id, cash_balance: 0.00 })
          .select()
          .single()

        if (createError) {
          if (createError.code === '23505') {
            const { data: retryData, error: retryError } = await supabase
              .from('portfolios')
              .select('*')
              .eq('client_id', clientId)
              .maybeSingle()
            if (retryError) throw retryError
            portData = retryData
          } else {
            throw createError
          }
        } else {
          portData = newPort
        }
      }

      if (portData && !portData.consultant_id && user?.id) {
        const { data: updatedPort, error: updateError } = await supabase
          .from('portfolios')
          .update({ consultant_id: user.id })
          .eq('id', portData.id)
          .select()
          .single()
        
        if (!updateError && updatedPort) {
          portData = updatedPort
        }
      }

      setPortfolio(portData)
      setClientNotes(portData ? portData.notes || '' : '')
      setBillingFeeRate(portData && portData.billing_fee_rate !== undefined && portData.billing_fee_rate !== null ? Number(portData.billing_fee_rate) : 0.85)

      const { data: txsData, error: txsError } = await supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('portfolio_id', portData.id)
        .order('date', { ascending: true })

      if (txsError) throw txsError
      const txs = txsData || []
      setTransactions(txs)

      const { data: targetsData, error: targetsError } = await supabase
        .from('target_allocations')
        .select('*')
        .eq('portfolio_id', portData.id)

      if (targetsError) throw targetsError
      setTargetAllocations(targetsData || [])

      const { data: groupTargetsData } = await supabase
        .from('portfolio_group_targets')
        .select('*')
        .eq('portfolio_id', portData.id)
      
      setGroupTargets(groupTargetsData || [])

      const { data: thesesData, error: thesesError } = await supabase
        .from('asset_theses')
        .select('*')
        .eq('consultant_id', user?.id)

      if (!thesesError && thesesData) {
        const mappedTheses: Record<string, string> = {}
        for (const item of thesesData) {
          mappedTheses[item.ticker.toUpperCase()] = item.thesis
        }
        setAssetTheses(mappedTheses)
        setExecutiveSummary(mappedTheses['__EXECUTIVE_SUMMARY__'] || '')
        setNextMonthPlan(mappedTheses['__NEXT_MONTH_PLAN__'] || '')
      }

      if (txs.length > 0) {
        const valuation = await loadPortfolioValuation(
          portData.id,
          txs,
          targetsData || [],
          Number(portData.cash_balance) || 0
        )
        setAssetPrices(valuation.prices)
        setPositions(valuation.positions)
        setPortfolioValue(valuation.totalValue)
        setAssetDefinitions(valuation.definitions)
        setIndexRatesByIndexer(valuation.indexRatesByIndexer)

        const { currentShareValue, totalShares: sharesOutstanding } = calculateShareHistory(
          txs,
          valuation.prices,
          valuation.definitions,
          valuation.indexRatesByIndexer
        )
        setShareValue(currentShareValue)
        setTotalShares(sharesOutstanding)
      } else {
        setPositions([])
        setPortfolioValue(0)
        setShareValue(1.0)
        setTotalShares(0)
        setAssetDefinitions([])
        setIndexRatesByIndexer({})
      }
    } catch (err) {
      console.error('Erro ao carregar dados do portfolio:', err)
      toast.error('Erro ao obter carteira do cliente')
    } finally {
      setLoadingPortfolio(false)
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

      const currentPrice = existingPrice?.current_price || 50.00

      const { error } = await supabase
        .from('asset_prices')
        .upsert({
          ticker: editingAssetTicker,
          current_price: currentPrice,
          last_updated: new Date().toISOString(),
          asset_class: editingAssetClass || undefined,
          sector: editingAssetSector || undefined
        })

      if (error) throw error

      toast.success(`Classificação de ${editingAssetTicker} atualizada com sucesso!`)
      setIsEditAssetModalOpen(false)
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao atualizar classificação do ativo')
      console.error(err)
    } finally {
      setSavingAssetClass(false)
    }
  }

  const handleDeleteClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientToDelete) return
    if (deleteConfirmEmail.trim() !== clientToDelete.email) {
      toast.error('O e-mail digitado não corresponde ao e-mail do cliente.')
      return
    }

    setDeletingClientState(true)
    try {
      const isProvisional = isProvisionalClientEmail(clientToDelete.email)

      if (isProvisional) {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', clientToDelete.id)

        if (error) throw error
        toast.success('Cliente provisório e sua respectiva carteira excluídos com sucesso!')
      } else {
        const { error } = await supabase
          .from('portfolios')
          .update({ consultant_id: null })
          .eq('client_id', clientToDelete.id)

        if (error) throw error
        toast.success('Cliente real desvinculado com sucesso! Os investimentos continuam intactos.')
      }

      setIsDeleteModalOpen(false)
      setClientToDelete(null)
      setDeleteConfirmEmail('')
      
      if (selectedClientId === clientToDelete.id) {
        setSelectedClientId('')
      }
      
      await loadClients()
    } catch (err) {
      console.error('Erro ao excluir/desvincular cliente:', err)
      toast.error(err instanceof Error ? err.message : 'Falha ao processar exclusão')
    } finally {
      setDeletingClientState(false)
    }
  }

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingClient(true)
    try {
      const tempId = crypto.randomUUID()
      let clientEmail = newClientEmail.trim()
      
      if (!clientEmail) {
        const cleanName = newClientName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '_')
          .replace(/_+/g, '_')
        const randId = Math.random().toString(36).substring(2, 8)
        clientEmail = buildProvisionalClientEmail(cleanName, randId)
      }

      let targetClientId = tempId;

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('email', clientEmail)
        .maybeSingle()

      if (existingProfile) {
        targetClientId = existingProfile.id
        
        if (existingProfile.role !== 'client' && existingProfile.id !== user?.id && !isPrimaryAdminProfile(existingProfile)) {
          const { error: updateRoleError } = await supabase
            .from('profiles')
            .update({ role: 'client' })
            .eq('id', existingProfile.id)
          if (updateRoleError) throw updateRoleError
        }

        let { data: portData } = await supabase
          .from('portfolios')
          .select('*')
          .eq('client_id', existingProfile.id)
          .maybeSingle()

        if (!portData) {
          const { data: newPort, error: createError } = await supabase
            .from('portfolios')
            .insert({ client_id: existingProfile.id, consultant_id: user?.id, cash_balance: 0.00 })
            .select()
            .single()
          if (createError) throw createError
          portData = newPort
        } else {
          const { data: updatedPort, error: updateError } = await supabase
            .from('portfolios')
            .update({ consultant_id: user?.id })
            .eq('id', portData.id)
            .select()
            .single()
          if (updateError) throw updateError
          portData = updatedPort
        }

        const { data: userInvestments } = await supabase
          .from('investments')
          .select('*')
          .eq('user_id', existingProfile.id)

        if (userInvestments && userInvestments.length > 0) {
          let extraCash = 0
          const txsToInsert: any[] = []
          const investmentsToUpdate: { id: string; transaction_id: string }[] = []

          for (const inv of userInvestments) {
            if (inv.ticker && inv.quantity && inv.price && !inv.transaction_id) {
              const dateStr = inv.month ? `${inv.month}-01` : new Date(inv.created_at).toISOString().split('T')[0]
              const txId = crypto.randomUUID()
              txsToInsert.push({
                id: txId,
                portfolio_id: portData.id,
                ticker: inv.ticker.toUpperCase().trim(),
                operation_type: 'buy',
                quantity: Number(inv.quantity),
                price: Number(inv.price),
                date: dateStr
              })
              investmentsToUpdate.push({
                id: inv.id,
                transaction_id: txId
              })
            } else if (!inv.ticker && !inv.transaction_id) {
              extraCash += Number(inv.amount)
            }
          }

          if (txsToInsert.length > 0) {
            const { error: txsInsertError } = await supabase
              .from('portfolio_transactions')
              .insert(txsToInsert)
            if (txsInsertError) throw txsInsertError

            for (const item of investmentsToUpdate) {
              await supabase
                .from('investments')
                .update({ transaction_id: item.transaction_id })
                .eq('id', item.id)
            }
          }

          if (extraCash > 0) {
            const newCash = Number(portData.cash_balance) + extraCash
            const { error: cashError } = await supabase
              .from('portfolios')
              .update({ cash_balance: newCash })
              .eq('id', portData.id)
            if (cashError) throw cashError
          }
        }

        toast.success('E-mail cadastrado encontrado! Ativos importados e conta vinculada.')
      } else {
        const trimmedName = newClientName.trim()
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: tempId,
            email: clientEmail,
            full_name: trimmedName || null,
            role: 'client',
            is_approved: true
          })

        if (profileError) throw profileError

        await supabase
          .from('portfolios')
          .update({ consultant_id: user?.id })
          .eq('client_id', tempId)

        toast.success('Cliente cadastrado com sucesso!')
      }

      setIsClientModalOpen(false)
      setNewClientName('')
      setNewClientEmail('')
      
      await loadClients()
      setSelectedClientId(targetClientId)
    } catch (err) {
      console.error('Erro ao criar perfil de cliente:', err)
      toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar cliente')
    } finally {
      setCreatingClient(false)
    }
  }

  const handleOpenTxModal = (tx?: PortfolioTransaction) => {
    setEditingTransaction(tx ?? null)
    setIsTxModalOpen(true)
  }

  const handleCloseTxModal = () => {
    setIsTxModalOpen(false)
    setEditingTransaction(null)
  }

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return

    try {
      const ticker = targetTicker.toUpperCase().trim()
      const pct = parseFloat(targetPct)

      if (!ticker) throw new Error('Insira o ticker do ativo')
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de alocação inválido (0 a 100)')

      const currentSum = targetAllocations
        .filter(t => t.ticker.toUpperCase() !== ticker)
        .reduce((sum, t) => sum + Number(t.target_percentage), 0)

      if (currentSum + pct > 100.00) {
        throw new Error(`A soma das alocações passaria de 100% (Atual: ${currentSum}%, Tentativa: ${pct}%)`)
      }

      const { error: upsertError } = await supabase
        .from('target_allocations')
        .upsert({
          portfolio_id: portfolio.id,
          ticker,
          target_percentage: pct
        })

      if (upsertError) throw upsertError

      if (targetAssetClass || targetSector) {
        const { data: existingPrice } = await supabase
          .from('asset_prices')
          .select('current_price')
          .eq('ticker', ticker)
          .maybeSingle()

        const currentPrice = existingPrice?.current_price || 50.00
        
        await supabase
          .from('asset_prices')
          .upsert({
            ticker,
            current_price: currentPrice,
            last_updated: new Date().toISOString(),
            asset_class: targetAssetClass || undefined,
            sector: targetSector || undefined
          })
      }

      toast.success('Meta de alocação atualizada!')
      setTargetTicker('')
      setTargetPct('')
      setTargetAssetClass('')
      setTargetSector('')
      setIsCustomTicker(false)
      setShowTargetForm(false)
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar meta')
    }
  }

  const handleDeleteTarget = async (targetId: string) => {
    try {
      const { error } = await supabase
        .from('target_allocations')
        .delete()
        .eq('id', targetId)

      if (error) throw error

      toast.success('Meta excluída!')
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao excluir meta')
    }
  }

  const handleSaveGroupTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return

    try {
      const pct = parseFloat(groupTargetPct)
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de limite inválido (0 a 100)')
      
      const name = groupTargetName.trim()
      if (!name) throw new Error('Insira o nome do grupo')

      const { error } = await supabase
        .from('portfolio_group_targets')
        .upsert({
          portfolio_id: portfolio.id,
          group_type: groupTargetType,
          group_name: name,
          target_percentage: pct
        })

      if (error) throw error

      toast.success('Limite de exposição atualizado!')
      setGroupTargetPct('')
      setShowGroupTargetForm(false)
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar limite')
    }
  }

  const handleDeleteGroupTarget = async (id: string) => {
    try {
      const { error } = await supabase
        .from('portfolio_group_targets')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast.success('Limite excluído!')
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao excluir limite')
    }
  }

  const handleSaveThesis = async () => {
    if (!editingThesisTicker) return
    setSavingThesis(true)
    try {
      const ticker = editingThesisTicker.toUpperCase().trim()
      const { error } = await supabase
        .from('asset_theses')
        .upsert({
          consultant_id: user?.id,
          ticker,
          thesis: thesisText
        })

      if (error) throw error
      toast.success(`Tese de ${ticker} salva com sucesso!`)
      setEditingThesisTicker('')
      setThesisText('')
      loadPortfolioData(selectedClientId)
    } catch (err) {
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
      if (editingThesisTicker === ticker) {
        setEditingThesisTicker('')
        setThesisText('')
      }
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao excluir tese')
    }
  }

  const handleSaveReport = async () => {
    setSavingReport(true)
    try {
      const upserts = [
        { consultant_id: user?.id, ticker: '__EXECUTIVE_SUMMARY__', thesis: executiveSummary },
        { consultant_id: user?.id, ticker: '__NEXT_MONTH_PLAN__', thesis: nextMonthPlan }
      ]
      const { error } = await supabase.from('asset_theses').upsert(upserts)
      if (error) throw error
      toast.success('Sumário e planejamento salvos com sucesso!')
    } catch (err) {
      toast.error('Erro ao salvar sumário e planejamento')
    } finally {
      setSavingReport(false)
    }
  }

  const handleSaveFeeRate = async (rate: number) => {
    setBillingFeeRate(rate)
    if (!portfolio) return
    try {
      const { error } = await supabase
        .from('portfolios')
        .update({ billing_fee_rate: rate })
        .eq('id', portfolio.id)
      if (error) throw error
    } catch (err) {
      console.error('Erro ao salvar taxa de fee no banco:', err)
    }
  }

  const handleExportPDF = async () => {
    if (!portfolio || !selectedClientId) return
    const client = clients.find(c => c.id === selectedClientId)
    if (!client) return

    toast.loading('Gerando relatório PDF de alta qualidade...', { id: 'pdf-toast' })
    try {
      const { shareHistory } = calculateShareHistory(transactions, assetPrices, assetDefinitions, indexRatesByIndexer)
      const metrics = calculatePerformanceMetrics(shareHistory)

      await generateConsultingPDF({
        clientName: resolveProfileDisplayName(client),
        portfolio,
        positions,
        shareHistory,
        metrics,
        theses: assetTheses,
        cashBalance: Number(portfolio.cash_balance) || 0,
        groupTargets: groupTargets,
        executiveSummary: executiveSummary || undefined,
        nextMonthPlan: nextMonthPlan || undefined,
        billingFeeRate,
        assetPrices,
        transactions
      })
      toast.success('Relatório PDF exportado com sucesso!', { id: 'pdf-toast' })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao renderizar o PDF.', { id: 'pdf-toast' })
    }
  }

  const headerAction = (
    <div className="flex items-center gap-3 w-full sm:w-auto">
      {loadingClients ? (
        <span className="text-xs text-secondary font-semibold uppercase font-sans">Carregando clientes...</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider hidden md:inline font-sans">Cliente:</span>
          <div className="w-48 sm:w-56">
            <Select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              options={[
                { value: '', label: 'Visão Geral' },
                ...clients.map(c => ({
                  value: c.id,
                  label: resolveProfileDisplayName(c),
                  sublabel: profileSelectSublabel(c, { selfUserId: user?.id }),
                }))
              ]}
              placeholder="Selecionar Cliente"
            />
          </div>
        </div>
      )}
      <Button
        size="sm"
        onClick={() => setIsClientModalOpen(true)}
        variant="primary"
        className="flex items-center gap-1 text-xs shrink-0 font-bold"
      >
        <UserPlus size={14} />
        <span>Novo</span>
      </Button>
    </div>
  )

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const isSelfPortfolio = selectedClientId !== '' && selectedClientId === user?.id
  const isTempClient = selectedClient?.email ? isProvisionalClientEmail(selectedClient.email) : false

  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      <PageHeader
        title="Consultoria de Investimentos"
        subtitle={selectedClient ? `Assessoria ativa para o cliente: ${resolveProfileDisplayName(selectedClient)}` : 'Gestão patrimonial institucional e metodologia de alocação'}
        action={headerAction}
      />

      {/* Cabeçalho do Cliente Selecionado */}
      {selectedClient && (
        <ClientOverviewHeader
          selectedClient={selectedClient}
          isTempClient={!!isTempClient}
          isSelfPortfolio={isSelfPortfolio}
          onDeleteClick={() => {
            setClientToDelete(selectedClient)
            setIsDeleteModalOpen(true)
          }}
          onLinkClick={() => setIsLinkModalOpen(true)}
        />
      )}

      {/* Menu de Personalização de Visualização (Abas Premium) */}
      {portfolio && selectedClient && (
        <div className="flex flex-wrap items-center justify-between gap-4 bg-card border border-border/40 p-4 rounded-3xl shadow-sm text-left animate-page-enter">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block font-sans">
              Painel de Assessoria:
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'overview', label: 'Resumo & Risco', icon: LayoutDashboard },
              { id: 'allocation', label: 'Distribuição & Limites', icon: PieChart },
              { id: 'rebalancing', label: 'Rebalanceamento', icon: RefreshCw },
              { id: 'positions', label: 'Posições', icon: Briefcase },
              { id: 'ledger', label: 'Livro-Razão', icon: History },
              { id: 'qualitative', label: 'Relatório & PDF', icon: FileText }
            ].map(tab => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <Button
                  key={tab.id}
                  variant={isActive ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 text-xs font-bold px-3.5 py-2 rounded-xl transition-all ${
                    isActive 
                      ? 'shadow-md shadow-indigo-500/10' 
                      : 'hover:bg-muted/10'
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </Button>
              )
            })}
          </div>
        </div>
      )}

      {portfolio ? (
        <div className={`transition-all duration-300 ${loadingPortfolio ? 'opacity-60 pointer-events-none' : ''}`}>
          <div className="space-y-6 animate-page-enter">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <ClientKpiCards
                  portfolioValue={portfolioValue}
                  shareValue={shareValue}
                  totalShares={totalShares}
                  overallYieldPct={overallYieldPct}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                  <WeeklyVariationChart shareHistory={shareHistoryData} />
                  <PerformanceMetricsCard metrics={performanceMetrics} />
                </div>
                <AdvisorNotes
                  clientNotes={clientNotes}
                  setClientNotes={setClientNotes}
                  onSaveNotes={handleSavePortfolioSettings}
                  savingSettings={savingSettings}
                />
              </div>
            )}

            {activeTab === 'allocation' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
                  <ClientAllocationCharts
                    classChartData={classChartData}
                    consolidatedClass={consolidatedClassData}
                  />
                  <SectorExposureChart
                    consolidatedSector={consolidatedSectorData}
                  />
                </div>
                <div className="text-left">
                  <ExposureVsLimitsChart positions={positions} />
                </div>
              </div>
            )}

            {activeTab === 'rebalancing' && (
              <div className="space-y-6">
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

            {activeTab === 'positions' && (
              <PositionsTable
                positions={positions}
                targetAllocations={targetAllocations}
                groupTargets={groupTargets}
                assetPrices={assetPrices}
                assetTheses={assetTheses}
                showTargetForm={showTargetForm}
                setShowTargetForm={setShowTargetForm}
                showGroupTargetForm={showGroupTargetForm}
                setShowGroupTargetForm={setShowGroupTargetForm}
                targetTicker={targetTicker}
                setTargetTicker={setTargetTicker}
                targetPct={targetPct}
                setTargetPct={setTargetPct}
                targetAssetClass={targetAssetClass}
                setTargetAssetClass={setTargetAssetClass}
                targetSector={targetSector}
                setTargetSector={setTargetSector}
                isCustomTicker={isCustomTicker}
                setIsCustomTicker={setIsCustomTicker}
                groupTargetType={groupTargetType}
                setGroupTargetType={setGroupTargetType}
                groupTargetName={groupTargetName}
                setGroupTargetName={setGroupTargetName}
                groupTargetPct={groupTargetPct}
                setGroupTargetPct={setGroupTargetPct}
                onSaveTarget={handleSaveTarget}
                onDeleteTarget={handleDeleteTarget}
                onSaveGroupTarget={handleSaveGroupTarget}
                onDeleteGroupTarget={handleDeleteGroupTarget}
                targetSuggestions={targetSuggestions}
                showTargetSuggestions={showTargetSuggestions}
                setShowTargetSuggestions={setShowTargetSuggestions}
                handleCustomTickerChange={handleCustomTickerChange}
                handleSelectRegisteredTicker={handleSelectRegisteredTicker}
                onEditAssetClassification={(ticker, clClass, clSector) => {
                  setEditingAssetTicker(ticker)
                  setEditingAssetClass(clClass)
                  setEditingAssetSector(clSector)
                  setIsEditAssetModalOpen(true)
                }}
                transactions={transactions}
              />
            )}

            {activeTab === 'ledger' && (
              <LedgerBook
                transactions={transactions}
                onOpenTxModal={handleOpenTxModal}
              />
            )}


            {activeTab === 'qualitative' && (
              <QualitativeAnalysis
                positions={positions}
                assetTheses={assetTheses}
                editingThesisTicker={editingThesisTicker}
                setEditingThesisTicker={setEditingThesisTicker}
                thesisText={thesisText}
                setThesisText={setThesisText}
                savingThesis={savingThesis}
                onSaveThesis={handleSaveThesis}
                onDeleteThesis={handleDeleteThesis}
                executiveSummary={executiveSummary}
                setExecutiveSummary={setExecutiveSummary}
                nextMonthPlan={nextMonthPlan}
                setNextMonthPlan={setNextMonthPlan}
                savingReport={savingReport}
                onSaveReport={handleSaveReport}
                portfolioValue={portfolioValue}
                billingFeeRate={billingFeeRate}
                setBillingFeeRate={handleSaveFeeRate}
                onExportPDF={handleExportPDF}
              />
            )}
          </div>
        </div>
      ) : selectedClientId === '' ? (
        /* =======================================================
           C) VISÃO GERAL DE AUM (SEM CLIENTE SELECIONADO)
           ======================================================= */
        <AdvisorOverview
          globalAumData={globalAumData}
          clients={clients}
          onSelectClient={setSelectedClientId}
          onDeleteClient={(cl) => {
            setClientToDelete(cl)
            setIsDeleteModalOpen(true)
          }}
        />
      ) : (
        /* =======================================================
           D) CARTEIRA VAZIA / CARREGANDO
           ======================================================= */
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

      {/* =======================================================
         E) MODAIS ADMINISTRATIVOS E DE PERSONALIZAÇÃO
         ======================================================= */}
      
      {/* Modal: Novo Cliente */}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Cadastrar Novo Cliente"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-secondary mb-4 font-sans">
            O perfil do cliente será criado diretamente no banco. Quando ele se registrar no app com o mesmo e-mail, terá acesso instantâneo.
          </p>

          <form onSubmit={handleCreateClient} className="space-y-4">
            <Input
              label="Nome Completo"
              type="text"
              required
              placeholder="Nome do cliente"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              className="text-sm font-semibold"
            />

            <Input
              label="E-mail de Acesso (Opcional)"
              type="email"
              placeholder="cliente@email.com"
              value={newClientEmail}
              onChange={e => setNewClientEmail(e.target.value)}
              helperText="Deixe em branco se deseja criar um perfil provisório e associar a um e-mail posteriormente."
              className="text-sm font-semibold font-mono"
            />

            <div className="flex gap-2 justify-end pt-4 border-t border-primary/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsClientModalOpen(false)}
                className="text-xs font-semibold"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={creatingClient}
                variant="primary"
                className="font-bold text-xs px-5 shadow-md"
              >
                {creatingClient ? 'Cadastrando...' : 'Cadastrar Cliente'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Modal: Vincular Provisório a Usuário Real */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Vincular Carteira a Usuário Real"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-secondary mb-4 font-sans">
            Selecione uma conta de cliente real cadastrada no aplicativo para transferir a gestão desta carteira patrimonial de forma definitiva. O perfil provisório antigo será removido.
          </p>

          {loadingEligible ? (
            <div className="text-center py-6 text-xs text-secondary">Carregando e-mails disponíveis...</div>
          ) : eligibleClients.length === 0 ? (
            <div className="text-center py-6 space-y-2 animate-page-enter">
              <p className="text-xs text-secondary italic font-sans">Nenhuma conta de cliente real sem carteira foi encontrada no banco.</p>
              <p className="text-[10px] text-secondary opacity-60 font-sans">Para vincular, o cliente precisa primeiro se cadastrar no aplicativo com o e-mail real dele.</p>
              <div className="pt-4 border-t border-primary/20 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsLinkModalOpen(false)}>Fechar</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLinkClient} className="space-y-4 animate-page-enter">
              <Select
                label="Selecionar E-mail Real"
                value={selectedRealClientId}
                onChange={e => setSelectedRealClientId(e.target.value)}
                options={eligibleClients.map(c => ({
                  value: c.id,
                  label: resolveProfileDisplayName(c),
                  sublabel: c.email,
                }))}
                placeholder="Selecione um e-mail real..."
                required
              />

              <div className="flex gap-2 justify-end pt-4 border-t border-primary/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLinkModalOpen(false)}
                  className="text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={linking}
                  variant="primary"
                  className="font-bold text-xs px-5 shadow-md shadow-indigo-500/10"
                >
                  {linking ? 'Vinculando...' : 'Vincular Carteira'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal: Edição Direta de Classificação do Ativo */}
      <Modal
        isOpen={isEditAssetModalOpen}
        onClose={() => setIsEditAssetModalOpen(false)}
        title={`Editar Classificação: ${editingAssetTicker}`}
      >
        <form onSubmit={handleSaveAssetClassification} className="space-y-4 text-left">
          <p className="text-xs text-secondary mb-4 font-sans">
            Altere manualmente a classe e o setor econômico do ativo **{editingAssetTicker}** no banco de dados. Essas configurações serão aplicadas imediatamente a todos os relatórios e carteiras que contêm este ativo.
          </p>

          <Select
            label="Classe de Ativo"
            value={editingAssetClass}
            onChange={e => setEditingAssetClass(e.target.value)}
            options={[
              { value: 'Ações Nacionais', label: 'Ações Nacionais' },
              { value: 'Ações Internacionais', label: 'Ações Internacionais' },
              { value: 'Fundos Imobiliários', label: 'Fundos Imobiliários' },
              { value: 'ETFs Nacionais', label: 'ETFs Nacionais' },
              { value: 'ETFs Internacionais', label: 'ETFs Internacionais' },
              { value: 'Criptoativos', label: 'Criptoativos' },
              { value: 'Renda Fixa', label: 'Renda Fixa' }
            ]}
            required
          />

          <Input
            label="Setor Econômico"
            type="text"
            required
            placeholder="Ex: Petróleo e Gás"
            value={editingAssetSector}
            onChange={e => setEditingAssetSector(e.target.value)}
            className="text-sm font-semibold"
          />

          <div className="flex gap-2 justify-end pt-4 border-t border-primary/20">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditAssetModalOpen(false)}
              className="text-xs font-semibold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={savingAssetClass}
              variant="primary"
              className="font-bold text-xs px-5 shadow-md"
            >
              {savingAssetClass ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Exclusão e Desvinculação de Cliente (Duas Etapas) */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          setIsDeleteModalOpen(false)
          setClientToDelete(null)
          setDeleteConfirmEmail('')
        }}
        title={clientToDelete ? (isProvisionalClientEmail(clientToDelete.email) ? 'Excluir Conta Provisória' : 'Desvincular Carteira de Cliente Real') : 'Gerenciar Cliente'}
      >
        {clientToDelete && (() => {
          const isProvisional = isProvisionalClientEmail(clientToDelete.email)
          return (
            <form onSubmit={handleDeleteClient} className="space-y-4 text-left">
              {isProvisional ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-xl flex items-start gap-2.5 text-xs font-sans">
                  <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-500" />
                  <div>
                    <strong className="font-bold block mb-1">Atenção! Esta ação é irreversível.</strong>
                    Ao confirmar, todos os dados da carteira provisória, metas e transações do e-mail provisório **{clientToDelete.email}** serão excluídos permanentemente do banco de dados.
                  </div>
                </div>
              ) : (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl flex items-start gap-2.5 text-xs font-sans">
                  <ShieldCheck size={16} className="shrink-0 mt-0.5 text-amber-500" />
                  <div>
                    <strong className="font-bold block mb-1">Desvinculação de Assessoria (Seguro)</strong>
                    Esta é uma conta de cliente real. Ao confirmar, o sistema **apenas removerá o seu acesso como consultor** a esta carteira patrimonial.
                    Os dados cadastrados, investimentos pessoais e a conta do cliente **não serão apagados** e continuarão intactos para acesso pessoal dele.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block font-sans">
                  Para prosseguir, digite o e-mail do cliente abaixo:
                </label>
                <p className="text-xs text-primary font-mono select-all bg-muted/30 p-2 rounded-lg border border-border/30 inline-block">
                  {clientToDelete.email}
                </p>
                <Input
                  type="email"
                  required
                  placeholder="Digite o e-mail exato para confirmar"
                  value={deleteConfirmEmail}
                  onChange={e => setDeleteConfirmEmail(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>

              <div className="flex gap-2 justify-end pt-4 border-t border-primary/20">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDeleteModalOpen(false)
                    setClientToDelete(null)
                    setDeleteConfirmEmail('')
                  }}
                  className="text-xs font-semibold"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={deletingClientState || deleteConfirmEmail.trim() !== clientToDelete.email}
                  variant={isProvisional ? "danger" : "primary"}
                  className={`font-bold text-xs px-5 shadow-md flex items-center gap-1.5 ${
                    isProvisional 
                      ? 'bg-red-600 hover:bg-red-700 text-white disabled:opacity-40 disabled:hover:bg-red-600' 
                      : 'shadow-md shadow-indigo-500/10'
                  }`}
                >
                  <Trash2 size={13} />
                  {deletingClientState 
                    ? (isProvisional ? 'Excluindo...' : 'Desvinculando...') 
                    : (isProvisional ? 'Sim, Excluir Definitivamente' : 'Sim, Desvincular Assessoria')}
                </Button>
              </div>
            </form>
          )
        })()}
      </Modal>

      {/* Modal: Lançamento e Edição de Transações (Premium) */}
      {portfolio && (
        <PortfolioTransactionFormModal
          isOpen={isTxModalOpen}
          onClose={handleCloseTxModal}
          portfolioId={portfolio.id}
          editingTransaction={editingTransaction}
          onSaved={() => loadPortfolioData(selectedClientId)}
        />
      )}
    </div>
  )
}
