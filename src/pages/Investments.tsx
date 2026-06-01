import { useEffect, useState, useMemo, Fragment } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { formatCurrency, formatCurrencyByCode } from '@/utils/format'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, TrendingDown, Layers, Trash2, Settings2, FileSpreadsheet, Edit2, Check, X, BarChart2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'

import InvestmentsGroupTargetForm from '@/components/investments/InvestmentsGroupTargetForm'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import AssetDefinitionFormModal from '@/components/investments/AssetDefinitionFormModal'
import InvestmentReconciliationModal from '@/components/investments/InvestmentReconciliationModal'
import AssetTransactionsModal from '@/components/investments/AssetTransactionsModal'
import LedgerBook from '@/components/consulting/LedgerBook'
import toast from 'react-hot-toast'
import Modal from '@/components/Modal'
import { 
  AssetPosition, 
  ConsolidatedGroup, 
  calculateConsolidatedByClass, 
  calculateConsolidatedBySector 
} from '@/services/investmentEngine'

import { loadPortfolioValuation } from '@/utils/portfolioValuationLoader'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'
import { fetchAllPortfolioTransactions } from '@/services/cashOffsetService'





export default function Investments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()

  // Dados da carteira sob consultoria
  const [portfolioData, setPortfolioData] = useState<{
    cashBalance: number
    investedValue: number
    cashValue: number
    totalValue: number
    positions: AssetPosition[]
    consolidatedClass: ConsolidatedGroup[]
    consolidatedSector: ConsolidatedGroup[]
  } | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  const [savingGroupTarget, setSavingGroupTarget] = useState<boolean>(false)

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
  const [groupTargets, setGroupTargets] = useState<any[]>([])

  const sumClass = useMemo(() => {
    return groupTargets
      .filter((gt: any) => gt.group_type === 'class')
      .reduce((sum: number, gt: any) => sum + Number(gt.target_percentage || 0), 0)
  }, [groupTargets])

  const sumSector = useMemo(() => {
    return groupTargets
      .filter((gt: any) => gt.group_type === 'sector')
      .reduce((sum: number, gt: any) => sum + Number(gt.target_percentage || 0), 0)
  }, [groupTargets])

  const [showGroupTargetForm, setShowGroupTargetForm] = useState<boolean>(false)
  const [groupTargetType, setGroupTargetType] = useState<'class' | 'sector'>('class')
  const [groupTargetName, setGroupTargetName] = useState<string>('Ações Nacionais')
  const [groupTargetPct, setGroupTargetPct] = useState<string>('')
  const [editingGroupTarget, setEditingGroupTarget] = useState<any | null>(null)

  const handleEditGroupTarget = (gt: any) => {
    setEditingGroupTarget(gt)
    setGroupTargetType(gt.group_type)
    setGroupTargetName(gt.group_name)
    setGroupTargetPct(String(gt.target_percentage))
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

  // Memoiza o agrupamento de posições por classe (exclui entradas de caixa/saldo)
  // Usado tanto na tabela Desktop quanto nos cards Mobile — evita recálculo duplo
  const positionsByClass = useMemo<Record<string, AssetPosition[]>>(() => {
    if (!portfolioData?.positions) return {}
    const displayPositions = portfolioData.positions.filter(
      (pos) => pos.pricing_mode !== 'cash' && pos.ticker !== 'SALDO_INV' && pos.ticker !== 'CAIXA'
    )
    const groups: Record<string, AssetPosition[]> = {}
    displayPositions.forEach(pos => {
      const cls = pos.asset_class || 'Não classificado'
      if (!groups[cls]) groups[cls] = []
      groups[cls].push(pos)
    })
    return groups
  }, [portfolioData?.positions])

  const handleSaveInlinePrice = async (ticker: string) => {
    try {
      setSavingPrice(true)
      const numericPrice = parseFloat(editingPriceValue)
      if (isNaN(numericPrice) || numericPrice < 0) {
        toast.error('Preço inválido')
        return
      }
      
      const { forceUpdateAssetPrice } = await import('@/services/priceService')
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
        const cached = await getCache<any>(userCacheKey)
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
  }, [isOnline])



  const handleSaveGroupTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) return
    setSavingGroupTarget(true)

    try {
      const pct = parseFloat(groupTargetPct)
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de limite inválido (0 a 100)')
      
      const name = groupTargetName.trim()
      if (!name) throw new Error('Insira o nome do grupo')

      // Validar se o limite acumulado excede 100%
      const currentSum = groupTargets
        .filter((gt: any) => gt.group_type === groupTargetType && gt.id !== editingGroupTarget?.id)
        .reduce((sum: number, gt: any) => sum + Number(gt.target_percentage || 0), 0)

      if (currentSum + pct > 100) {
        throw new Error(
          `O limite total de exposição por ${
            groupTargetType === 'class' ? 'classe' : 'setor'
          } não pode ultrapassar 100% (atual: ${currentSum.toFixed(0)}%)`
        )
      }

      const { error } = await supabase
        .from('portfolio_group_targets')
        .upsert({
          ...(editingGroupTarget?.id ? { id: editingGroupTarget.id } : {}),
          portfolio_id: portfolioId,
          group_type: groupTargetType,
          group_name: name,
          target_percentage: pct
        })

      if (error) throw error

      toast.success(editingGroupTarget ? 'Limite de exposição atualizado!' : 'Limite de exposição cadastrado!')
      setGroupTargetPct('')
      setEditingGroupTarget(null)
      setShowGroupTargetForm(false)
      loadPortfolio()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar limite')
    } finally {
      setSavingGroupTarget(false)
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
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleForceRefresh}
              disabled={refreshing || portfolioLoading}
              className="hidden sm:flex items-center gap-2 border-amber-500/20 text-amber-600 hover:bg-amber-500/10 font-bold"
            >
              {refreshing ? (
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <TrendingUp size={16} className="text-amber-500" />
              )}
              <span>{refreshing ? 'Atualizando...' : 'Atualizar Cotações'}</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsReconciliationOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 font-bold animate-pulse-subtle"
            >
              <FileSpreadsheet size={16} className="text-emerald-500" />
              <span>Conciliação B3</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleOpenTxModal()}
              className="flex items-center gap-2 border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 font-bold"
            >
              <Plus size={16} className="text-indigo-500" />
              <span className="hidden sm:inline">Lançar Transação</span>
            </Button>
          </div>
        }
      />

      <div className="p-4 lg:p-6 space-y-4 lg:space-y-6 animate-page-enter">
        {portfolioLoading ? (
          <Loader text="Carregando sua carteira..." className="py-12" />
        ) : portfolioData && (
          <div className="space-y-6 animate-fade-in">
            {/* Cards de KPIs da Consultoria */}
            {(() => {
              const nonCashPositions = portfolioData.positions.filter(p => p.pricing_mode !== 'cash')
              const totalCost = nonCashPositions.reduce((sum, p) => {
                const rate = p.usd_rate || 5.25
                return sum + (p.currency === 'USD' ? p.cost_basis * rate : p.cost_basis)
              }, 0)
              const totalCurrent = nonCashPositions.reduce((sum, p) => {
                const rate = p.usd_rate || 5.25
                return sum + (p.currency === 'USD' ? p.total_value * rate : p.total_value)
              }, 0)
              const consolidatedYield = totalCost > 0 ? ((totalCurrent - totalCost) / totalCost) * 100 : 0
              const consolidatedGain = totalCurrent - totalCost
              const isPositive = consolidatedYield >= 0

              const totalCash = portfolioData.cashValue

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <Card 
                    className="p-3 sm:p-5 flex flex-col justify-between border-l-4"
                    style={{ borderLeftColor: 'var(--color-income)' }}
                  >
                    <p className="text-[9px] sm:text-xs font-semibold text-secondary tracking-wide uppercase whitespace-nowrap">Patrimônio Investido</p>
                    <p className="text-sm xs:text-base sm:text-2xl font-black text-primary mt-1 sm:mt-2 font-mono">
                      {formatCurrency(portfolioData.investedValue)}
                    </p>
                    <p className="hidden sm:block text-xs text-secondary mt-1">Valor total de investimentos</p>
                  </Card>
                  <Card 
                    className="p-3 sm:p-5 flex flex-col justify-between border-l-4"
                    style={{ borderLeftColor: '#6366f1' }}
                  >
                    <p className="text-[9px] sm:text-xs font-semibold text-secondary tracking-wide uppercase whitespace-nowrap">Saldo em Caixa</p>
                    <p className="text-sm xs:text-base sm:text-2xl font-black text-primary mt-1 sm:mt-2 font-mono">
                      {formatCurrency(totalCash)}
                    </p>
                    <p className="hidden sm:block text-xs text-secondary mt-1">Disponível para novos aportes</p>
                  </Card>
                  <Card 
                    className="p-3 sm:p-5 flex flex-col justify-between border-l-4"
                    style={{ borderLeftColor: isPositive ? 'var(--color-income)' : 'var(--color-expense)' }}
                  >
                    <p className="text-[9px] sm:text-xs font-semibold text-secondary tracking-wide uppercase whitespace-nowrap">Rentabilidade Consolidada</p>
                    <div className="flex items-baseline gap-1.5 mt-1 sm:mt-2 flex-wrap">
                      <p className={`text-sm xs:text-base sm:text-2xl font-black font-mono flex items-center ${
                        isPositive ? 'text-income' : 'text-expense'
                      }`}>
                        {isPositive ? '+' : ''}{consolidatedYield.toFixed(2)}%
                      </p>
                      <span className={`text-[10px] sm:text-xs font-semibold font-mono whitespace-nowrap ${
                        consolidatedGain >= 0 ? 'text-income' : 'text-expense'
                      }`}>
                        ({consolidatedGain >= 0 ? '+' : ''}{formatCurrency(consolidatedGain)})
                      </span>
                    </div>
                    <p className="hidden sm:block text-xs text-secondary mt-1">Retorno sobre o capital investido</p>
                  </Card>
                </div>
              )
            })()}
            <div className="bg-secondary/40 border border-primary p-4 rounded-2xl space-y-4">
              {/* Cabeçalho clicável */}
              <div 
                onClick={() => setLimitsCollapsed(!limitsCollapsed)}
                className="flex items-center justify-between gap-3 text-left cursor-pointer hover:opacity-85 transition-opacity duration-200 select-none"
              >
                <div className="flex items-start gap-2.5">
                  <Layers size={18} className="text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-black text-primary">Limites de Exposição</h4>
                    <p className="text-[10px] text-secondary mt-0.5 leading-relaxed">
                      Defina limites percentuais máximos recomendados para diversificação do seu portfólio por classe e setor
                    </p>
                  </div>
                </div>
                
                {/* Indicador de expansão */}
                <div className="flex items-center gap-2 text-secondary shrink-0">
                  <span className="text-[10px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full font-mono">
                    {groupTargets.filter((gt: any) => gt.group_type === consolidationView).length}
                  </span>
                  <Plus 
                    size={16} 
                    className={`transition-transform duration-300 ${!limitsCollapsed ? 'rotate-45 text-primary' : 'rotate-0 text-secondary/60'}`} 
                  />
                </div>
              </div>

              {/* Grid de Limites (Listagem + Botão Novo Limite) */}
              <div className={`pt-3 border-t border-primary/5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 text-left w-full ${
                limitsCollapsed ? 'hidden' : 'grid'
              }`}>
                {groupTargets
                  .filter((gt: any) => gt.group_type === consolidationView)
                  .map((gt: any) => (
                    <div 
                      key={gt.id} 
                      onClick={() => handleEditGroupTarget(gt)}
                      className="cursor-pointer flex items-center justify-between p-3.5 bg-primary border border-primary/50 rounded-2xl shadow-sm hover:border-indigo-500/30 active:bg-secondary/40 transition-all select-none animate-page-enter w-full"
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
                        <span className="font-mono text-indigo-500 font-black text-sm">{gt.target_percentage}%</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation(); // Evita abrir o modal de edição ao excluir
                            handleDeleteGroupTarget(gt.id);
                          }}
                          className="text-secondary hover:text-red-500 transition-colors p-1.5 rounded-xl hover:bg-red-500/10 flex items-center justify-center"
                          title="Remover limite"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                {/* Adicionar Limite Card Button */}
                {(consolidationView === 'class' ? sumClass < 100 : sumSector < 100) && (
                  <div 
                    onClick={() => {
                      setEditingGroupTarget(null);
                      setGroupTargetType(consolidationView);
                      setGroupTargetName(consolidationView === 'class' ? 'Ações Nacionais' : '');
                      setGroupTargetPct('');
                      setShowGroupTargetForm(true);
                    }}
                    className="cursor-pointer flex items-center justify-center gap-2 p-3.5 bg-secondary/30 border border-dashed border-indigo-500/35 hover:border-indigo-500/60 rounded-2xl transition-all select-none animate-page-enter w-full h-[62px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/5 hover:scale-[1.01]"
                  >
                    <Plus size={15} className="text-indigo-500" />
                    <span className="text-xs font-black uppercase tracking-wider">Novo Limite</span>
                  </div>
                )}
              </div>
            </div>

            {/* Demonstrativo Detalhado de Consolidação em Largura Total */}
            <div className="w-full animate-fade-in">
              <Card className="p-4 lg:p-6 space-y-4 w-full">
                <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b border-primary/5">
                  <div className="flex items-center gap-2">
                    {consolidationView === 'class' ? (
                      <Layers size={18} className="text-indigo-500 shrink-0 transition-colors duration-300" />
                    ) : (
                      <Briefcase size={18} className="text-emerald-500 shrink-0 transition-colors duration-300" />
                    )}
                    <h3 className="text-sm sm:text-base font-bold text-primary leading-tight transition-all duration-300">
                      {consolidationView === 'class' ? 'Consolidação por Classes' : 'Consolidação por Setores'}
                    </h3>
                  </div>
                  
                  {/* Switcher Discreto Unificado com Fundo Deslizante Fluido */}
                  <div className="relative inline-flex items-center bg-secondary/50 border border-primary p-0.5 rounded-full select-none shrink-0 shadow-sm h-[30px] w-40 sm:w-44 overflow-hidden">
                    {/* Indicador Deslizante com transição lateral e de cores */}
                    <div 
                      className={`absolute top-[2px] bottom-[2px] rounded-full transition-all duration-300 ease-out ${
                        consolidationView === 'class'
                          ? 'left-[2px] w-[calc(50%-2px)] bg-indigo-500 shadow-md'
                          : 'left-[calc(50%)] w-[calc(50%-2px)] bg-emerald-500 shadow-md'
                      }`}
                    />
                    
                    <button
                      type="button"
                      onClick={() => setConsolidationView('class')}
                      className={`relative z-10 flex-1 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-colors duration-300 flex items-center justify-center gap-1 ${
                        consolidationView === 'class' ? 'text-white' : 'text-secondary hover:text-primary'
                      }`}
                    >
                      <Layers size={10} />
                      <span>Classes</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConsolidationView('sector')}
                      className={`relative z-10 flex-1 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider rounded-full transition-colors duration-300 flex items-center justify-center gap-1 ${
                        consolidationView === 'sector' ? 'text-white' : 'text-secondary hover:text-primary'
                      }`}
                    >
                      <Briefcase size={10} />
                      <span>Setores</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 transition-all duration-300">
                  {(consolidationView === 'class' 
                    ? portfolioData.consolidatedClass 
                    : portfolioData.consolidatedSector
                  ).map((group) => {
                    const isPositive = group.yield_pct >= 0
                    return (
                      <div key={group.name} className="p-3.5 bg-secondary border border-primary rounded-2xl space-y-3.5 text-left transition-all duration-250 hover:border-primary/80">
                        <div className="flex items-center justify-between flex-wrap gap-2.5">
                          <span className="font-bold text-primary text-sm tracking-wide">{group.name}</span>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                              isPositive ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                            }`}>
                              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              Bruta {isPositive ? '+' : ''}{group.gross_yield_pct.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-secondary font-mono">
                              Líq. {group.net_yield_pct >= 0 ? '+' : ''}{group.net_yield_pct.toFixed(2)}%
                            </span>
                            <span className="text-xs text-secondary font-extrabold bg-primary px-2.5 py-0.5 rounded-xl border border-primary/25 font-mono">
                              {group.current_percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar com Alvo vs Atual */}
                        <div className="space-y-2">
                          <div className="w-full h-2 rounded-full bg-primary relative overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-500 ${
                                consolidationView === 'class' ? 'bg-balance' : 'bg-income'
                              }`} 
                              style={{ width: `${Math.min(group.current_percentage, 100)}%` }} 
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-secondary font-mono">
                            <span>Atual: {formatCurrency(group.total_value)}</span>
                            <span>Alvo recomendado: {group.target_percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>

            {/* Lista Detalhada de Ativos */}
            <Card className="p-4 lg:p-6 space-y-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="text-sm sm:text-base font-bold text-primary">Demonstrativo Detalhado de Ativos</h3>
                
                {/* Botão de atualizar cotações visível apenas no Mobile */}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleForceRefresh}
                  disabled={refreshing || portfolioLoading}
                  className="flex sm:hidden items-center justify-center h-8 w-8 p-0 border-amber-500/20 text-amber-600 hover:bg-amber-500/10 font-bold"
                  title="Atualizar cotações"
                >
                  {refreshing ? (
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <TrendingUp size={15} className="text-amber-500" />
                  )}
                </Button>
              </div>

              {/* 1. Tabela para Desktop */}
              <div className="hidden md:block overflow-x-auto border border-primary rounded-xl">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-secondary border-b border-primary text-xs font-bold text-secondary uppercase tracking-wider">
                      <th className="p-3">Ativo</th>
                      <th className="p-3">Classe</th>
                      <th className="p-3">Setor</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3 text-right">Preço Atual</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-right">Rent. bruta</th>
                      <th className="p-3 text-center">Part. Real</th>
                      <th className="p-3 text-center">Part. Alvo</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary">
                    {Object.entries(positionsByClass).map(([className, classPositions]) => (
                        <Fragment key={className}>
                          {/* Linha de cabeçalho do grupo de classe */}
                          <tr className="bg-secondary/60 font-bold border-l-4 border-l-[var(--color-income)] text-primary text-xs tracking-wider">
                            <td colSpan={10} className="p-3.5 uppercase font-extrabold text-secondary">
                              {className}
                            </td>
                          </tr>
                          {classPositions.map((pos) => {
                            const isPositive = pos.gross_yield_pct >= 0
                            return (
                              <tr
                                key={pos.ticker}
                                className="hover:bg-secondary/40 transition-colors cursor-pointer"
                                onClick={() => handleOpenAssetTxModal(pos)}
                                title="Ver transações do ativo"
                              >
                                <td className={`p-3 pl-6 font-bold text-primary border-l-4 ${isPositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'}`}>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {pos.ticker}
                                    {pos.pricing_mode === 'market' && pos.is_b3_linked && (pos.quotation_status === 'stale' || pos.quotation_status === 'unavailable') && (
                                      <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-sans" title="Cotação desatualizada ou indisponível na B3">
                                        Cotação Desatualizada
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 text-xs text-secondary font-medium">{pos.asset_class || 'Não classificado'}</td>
                                <td className="p-3 text-xs text-secondary font-semibold">{pos.sector || 'Outros'}</td>
                                <td className="p-3 text-right text-primary font-medium">
                                  {pos.quantity.toLocaleString('pt-BR')}
                                </td>
                                 <td className="p-3 text-right text-secondary">
                                   {editingPriceTicker === pos.ticker ? (
                                     <div className="flex items-center justify-end gap-1.5">
                                       <input
                                         type="number"
                                         step="0.01"
                                         value={editingPriceValue}
                                         onChange={(e) => setEditingPriceValue(e.target.value)}
                                         onKeyDown={(e) => {
                                           if (e.key === 'Enter') handleSaveInlinePrice(pos.ticker)
                                           if (e.key === 'Escape') setEditingPriceTicker(null)
                                         }}
                                         disabled={savingPrice}
                                         className="w-20 px-1.5 py-0.5 text-xs text-right border border-indigo-500 rounded bg-primary text-primary font-mono outline-none"
                                         autoFocus
                                       />
                                       <button
                                         type="button"
                                         onClick={() => handleSaveInlinePrice(pos.ticker)}
                                         disabled={savingPrice}
                                         className="text-income hover:bg-income/10 p-0.5 rounded transition-colors"
                                         title="Salvar"
                                       >
                                         <Check size={12} />
                                       </button>
                                       <button
                                         type="button"
                                         onClick={() => setEditingPriceTicker(null)}
                                         disabled={savingPrice}
                                         className="text-expense hover:bg-expense/10 p-0.5 rounded transition-colors"
                                         title="Cancelar"
                                       >
                                         <X size={12} />
                                       </button>
                                     </div>
                                   ) : (
                                     <div className="group flex items-center justify-end gap-1 select-none">
                                       <span className="font-mono">{formatCurrencyByCode(pos.current_price, pos.currency)}</span>
                                       {pos.pricing_mode === 'market' && (
                                         <button
                                           type="button"
                                           onClick={() => {
                                             setEditingPriceTicker(pos.ticker)
                                             setEditingPriceValue(pos.current_price.toString())
                                           }}
                                           className="opacity-0 group-hover:opacity-100 text-secondary hover:text-indigo-500 p-0.5 rounded transition-all"
                                           title="Editar cotação manualmente"
                                         >
                                           <Edit2 size={11} className="shrink-0" />
                                         </button>
                                       )}
                                     </div>
                                   )}
                                 </td>
                                <td className="p-3 text-right text-primary font-semibold">{formatCurrencyByCode(pos.total_value, pos.currency)}</td>
                                <td className={`p-3 text-right font-semibold ${pos.gross_yield_pct >= 0 ? 'text-income' : 'text-expense'}`}>
                                  {`${pos.gross_yield_pct >= 0 ? '+' : ''}${pos.gross_yield_pct.toFixed(2)}%`}
                                </td>
                                <td className="p-3 text-center font-bold text-primary">{pos.current_percentage.toFixed(1)}%</td>
                                <td className="p-3 text-center font-bold text-income">
                                  {pos.target_percentage.toFixed(0)}%
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setAssetDefTicker(pos.ticker)
                                      setAssetDefModalOpen(true)
                                    }}
                                    className="text-secondary hover:text-primary transition-colors"
                                    title="Configurar Ativo"
                                  >
                                    <Settings2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 2. Visualização em Cards para Mobile */}
              <div className="block md:hidden space-y-4">
                {Object.entries(positionsByClass).map(([className, classPositions]) => (
                    <div key={className} className="space-y-2">
                      {/* Cabeçalho do Grupo de Classe */}
                      <div className="text-[10px] font-extrabold uppercase tracking-widest text-secondary bg-secondary/50 border-l-4 border-l-[var(--color-income)] px-3 py-1.5 rounded-lg select-none text-left">
                        {className}
                      </div>

                      {/* Cards de Ativos */}
                      <div className="space-y-3">
                        {classPositions.map((pos) => {
                          const isGrossPositive = pos.gross_yield_pct >= 0;
                          const isExpanded = !!expandedAssets[pos.ticker];
                          
                          return (
                            <div 
                              key={pos.ticker}
                              className={`bg-card border border-border/40 border-l-4 ${isGrossPositive ? 'border-l-[var(--color-income)]' : 'border-l-[var(--color-expense)]'} rounded-2xl shadow-sm transition-all animate-page-enter overflow-hidden`}
                            >
                              {/* Cabeçalho compacto clicável */}
                              <div 
                                onClick={() => toggleAssetExpanded(pos.ticker)}
                                className="p-3.5 flex items-center justify-between cursor-pointer hover:bg-secondary/30 active:bg-secondary/50 transition-colors select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isGrossPositive ? 'bg-income' : 'bg-expense'}`} />
                                  <div className="text-left">
                                    <span className="font-mono font-black text-primary text-sm block leading-tight">
                                      {pos.ticker}
                                    </span>
                                    <span className="text-[10px] text-secondary font-medium block">
                                      {pos.sector || 'Outros'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 text-right">
                                  <div>
                                    <span className="text-xs font-black text-primary font-mono block leading-tight">
                                      {formatCurrencyByCode(pos.total_value, pos.currency)}
                                    </span>
                                    <span className={`text-[10px] font-bold font-mono block ${isGrossPositive ? 'text-income' : 'text-expense'}`}>
                                      {isGrossPositive ? '+' : ''}{pos.gross_yield_pct.toFixed(2)}%
                                    </span>
                                  </div>
                                  <div className="text-secondary">
                                    <Plus 
                                      size={15} 
                                      className={`transition-transform duration-300 ${isExpanded ? 'rotate-45 text-primary' : 'rotate-0 text-secondary/60'}`} 
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* Conteúdo Expandido */}
                              {isExpanded && (
                                <div className="px-4 pb-4 pt-2 border-t border-primary/10 space-y-3.5 animate-page-enter bg-secondary/10">
                                  {/* Grid de Métricas */}
                                  <div className="grid grid-cols-2 gap-3 text-left bg-secondary/30 p-2.5 rounded-xl border border-primary/10">
                                    <div>
                                      <span className="text-[9px] uppercase font-extrabold text-secondary block">Quantidade</span>
                                      <span className="text-xs font-bold text-primary font-mono">
                                        {pos.quantity.toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase font-extrabold text-secondary block">Preço Atual</span>
                                      {editingPriceTicker === pos.ticker ? (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <input
                                            type="number"
                                            step="0.01"
                                            value={editingPriceValue}
                                            onChange={(e) => setEditingPriceValue(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') handleSaveInlinePrice(pos.ticker)
                                              if (e.key === 'Escape') setEditingPriceTicker(null)
                                            }}
                                            disabled={savingPrice}
                                            className="w-16 px-1.5 py-0.5 text-xs border border-indigo-500 rounded bg-primary text-primary font-mono outline-none"
                                            autoFocus
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleSaveInlinePrice(pos.ticker)}
                                            disabled={savingPrice}
                                            className="text-income hover:bg-income/10 p-0.5 rounded transition-colors"
                                          >
                                            <Check size={11} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => setEditingPriceTicker(null)}
                                            disabled={savingPrice}
                                            className="text-expense hover:bg-expense/10 p-0.5 rounded transition-colors"
                                          >
                                            <X size={11} />
                                          </button>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1 mt-0.5">
                                          <span className="text-xs font-bold text-primary font-mono">
                                            {formatCurrencyByCode(pos.current_price, pos.currency)}
                                          </span>
                                          {pos.pricing_mode === 'market' && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingPriceTicker(pos.ticker)
                                                setEditingPriceValue(pos.current_price.toString())
                                              }}
                                              className="text-secondary hover:text-indigo-500 p-0.5 rounded"
                                              title="Editar cotação manualmente"
                                            >
                                              <Edit2 size={10} className="shrink-0" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="col-span-2">
                                      <span className="text-[9px] uppercase font-extrabold text-secondary block">Custo Total</span>
                                      <span className="text-xs font-bold text-primary font-mono">
                                        {formatCurrencyByCode(pos.cost_basis, pos.currency)}
                                      </span>
                                    </div>
                                    
                                    <div className="col-span-2 pt-2 border-t border-primary/10 text-xs">
                                      <div>
                                        <span className="text-secondary text-[10px] block font-semibold uppercase tracking-wider">Rent. Bruta</span>
                                        <span className={`font-black font-mono text-sm ${isGrossPositive ? 'text-income' : 'text-expense'}`}>
                                          {isGrossPositive ? '+' : ''}{pos.gross_yield_pct.toFixed(2)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Progresso de Metas de Exposição */}
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px]">
                                      <div className="flex items-center gap-1">
                                        <span className="text-secondary font-medium">Real:</span>
                                        <span className="font-mono font-bold text-primary">{pos.current_percentage.toFixed(1)}%</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <span className="text-secondary font-medium">Meta:</span>
                                        <span className="font-mono font-bold text-income">{pos.target_percentage.toFixed(0)}%</span>
                                      </div>
                                    </div>
                                    
                                    {/* Barra de Progresso elegante */}
                                    <div className="w-full h-1.5 bg-primary/20 rounded-full overflow-hidden relative">
                                      <div 
                                        className="h-full bg-income rounded-full transition-all duration-500"
                                        style={{ width: `${Math.min(pos.current_percentage, 100)}%` }}
                                      />
                                      {pos.target_percentage > 0 && (
                                        <div 
                                          className="absolute top-0 bottom-0 w-0.5 bg-indigo-300 dark:bg-indigo-700"
                                          style={{ left: `${Math.min(pos.target_percentage, 99)}%` }}
                                        />
                                      )}
                                    </div>
                                  </div>

                                  {/* Precificação e Ações rápidas */}
                                  <div className="flex justify-between items-center pt-2 border-t border-primary/5">
                                    <div>
                                      {pos.pricing_mode === 'market' && pos.is_b3_linked && (pos.quotation_status === 'stale' || pos.quotation_status === 'unavailable') && (
                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 font-sans" title="Cotação desatualizada ou indisponível na B3">
                                          Cotação Desatualizada
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenAssetTxModal(pos);
                                        }}
                                        className="flex items-center gap-1.5 text-[10px] text-emerald-600 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300 transition-all py-1.5 px-3 border border-emerald-500/20 rounded-xl bg-emerald-500/5 hover:bg-emerald-500/10 font-bold"
                                      >
                                        <BarChart2 size={12} />
                                        <span>Transações</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setAssetDefTicker(pos.ticker);
                                          setAssetDefModalOpen(true);
                                        }}
                                        className="flex items-center gap-1.5 text-[10px] text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 transition-all py-1.5 px-3 border border-indigo-500/20 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 font-bold"
                                      >
                                        <Settings2 size={12} />
                                        <span>Configurar</span>
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                ))}
              </div>
            </Card>

            {/* Card de Transações do Livro-Razão */}
            <LedgerBook
              transactions={transactions}
              onOpenTxModal={handleOpenTxModal}
              onOpenReconciliation={() => setIsReconciliationOpen(true)}
              portfolioId={portfolioId}
              onSaved={loadPortfolio}
            />
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
          <Modal
            isOpen={showGroupTargetForm}
            onClose={() => setShowGroupTargetForm(false)}
            title="Definir Limites de Exposição"
            maxWidth="max-w-md"
          >
            <InvestmentsGroupTargetForm
              groupTargetType={groupTargetType}
              groupTargetName={groupTargetName}
              groupTargetPct={groupTargetPct}
              savingGroupTarget={savingGroupTarget}
              onTypeChange={(type) => {
                setGroupTargetType(type)
                setGroupTargetName(type === 'class' ? 'Ações Nacionais' : '')
              }}
              onNameChange={setGroupTargetName}
              onPctChange={setGroupTargetPct}
              onSubmit={handleSaveGroupTarget}
            />
          </Modal>
        </>
      )}
    </div>
  )
}
