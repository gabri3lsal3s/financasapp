import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { formatCurrency } from '@/utils/format'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, TrendingDown, Layers, Trash2, Percent, Settings2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Input from '@/components/Input'
import InvestmentsGroupTargetForm from '@/components/investments/InvestmentsGroupTargetForm'
import PortfolioTransactionFormModal from '@/components/investments/PortfolioTransactionFormModal'
import AssetDefinitionFormModal from '@/components/investments/AssetDefinitionFormModal'
import toast from 'react-hot-toast'
import { 
  AssetPosition, 
  ConsolidatedGroup, 
  calculateConsolidatedByClass, 
  calculateConsolidatedBySector 
} from '@/services/investmentEngine'
import { searchB3Assets } from '@/services/priceService'
import { loadPortfolioValuation, getAssetPricingBadgeLabel } from '@/utils/portfolioValuationLoader'
import type { PortfolioAssetDefinition, PortfolioTransaction } from '@/types'

import {
  buildLegacyTransactionPayload,
  findMatchingLegacyTransaction,
  type LegacyInvestmentRow,
} from '@/utils/legacyInvestmentMigration'

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function Investments() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isOnline } = useNetworkStatus()

  // Dados da carteira sob consultoria
  const [portfolioData, setPortfolioData] = useState<{
    cashBalance: number
    totalValue: number
    positions: AssetPosition[]
    consolidatedClass: ConsolidatedGroup[]
    consolidatedSector: ConsolidatedGroup[]
  } | null>(null)
  const [portfolioLoading, setPortfolioLoading] = useState(false)

  const [savingGroupTarget, setSavingGroupTarget] = useState<boolean>(false)

  // Estados adicionais para integração e sincronização de ativos e metas
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [targetAllocations, setTargetAllocations] = useState<any[]>([])
  const [isTxModalOpen, setIsTxModalOpen] = useState(false)
  const [editingTransaction, setEditingTransaction] = useState<PortfolioTransaction | null>(null)

  const [showTargetForm, setShowTargetForm] = useState<boolean>(false)
  const [targetTicker, setTargetTicker] = useState<string>('')
  const [targetPct, setTargetPct] = useState<string>('')
  const [savingTarget, setSavingTarget] = useState<boolean>(false)
  const [targetAssetClass, setTargetAssetClass] = useState<string>('')
  const [targetSector, setTargetSector] = useState<string>('')
  const [isCustomTicker, setIsCustomTicker] = useState<boolean>(false)

  const [targetSuggestions, setTargetSuggestions] = useState<{ ticker: string, name: string }[]>([])
  const [showTargetSuggestions, setShowTargetSuggestions] = useState<boolean>(false)
  const [assetPrices, setAssetPrices] = useState<Record<string, any>>({})
  const [assetDefinitions, setAssetDefinitions] = useState<PortfolioAssetDefinition[]>([])
  const [assetDefModalOpen, setAssetDefModalOpen] = useState(false)
  const [assetDefTicker, setAssetDefTicker] = useState('')

  // Estados para limites de exposição por classe e setor
  const [portfolioId, setPortfolioId] = useState<string>('')
  const [groupTargets, setGroupTargets] = useState<any[]>([])
  const [showGroupTargetForm, setShowGroupTargetForm] = useState<boolean>(false)
  const [groupTargetType, setGroupTargetType] = useState<'class' | 'sector'>('class')
  const [groupTargetName, setGroupTargetName] = useState<string>('Ações Nacionais')
  const [groupTargetPct, setGroupTargetPct] = useState<string>('')



  const handleOpenTxModal = (tx?: PortfolioTransaction) => {
    setEditingTransaction(tx ?? null)
    setShowTargetForm(false)
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
      setShowTargetForm(false)
      setIsTxModalOpen(true)

      const next = new URLSearchParams(searchParams)
      next.delete('quickAdd')
      next.delete('month')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  async function loadPortfolio() {
    try {
      setPortfolioLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

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

      const { data: existingTransactions } = await supabase
        .from('portfolio_transactions')
        .select('id, portfolio_id, ticker, operation_type, quantity, price, date, created_at')
        .eq('portfolio_id', portfolio.id)

      const knownTransactions = (existingTransactions as PortfolioTransaction[]) || []

      // 2. Migração idempotente dos dados legados (evita recriar SALDO_INV após exclusão)
      const { data: userInvestments } = await supabase
        .from('investments')
        .select('id, month, amount, ticker, quantity, price, created_at, transaction_id')
        .eq('user_id', user.id)

      const unconverted = (userInvestments as LegacyInvestmentRow[] | null)?.filter((inv) => !inv.transaction_id) || []

      if (unconverted.length > 0) {
        const txsToInsert: Omit<PortfolioTransaction, 'created_at'>[] = []
        const investmentsToUpdate: { id: string; transaction_id: string }[] = []
        let migratedCount = 0

        for (const inv of unconverted) {
          const existingMatch = findMatchingLegacyTransaction(inv, knownTransactions)

          if (existingMatch) {
            investmentsToUpdate.push({
              id: inv.id,
              transaction_id: existingMatch.id,
            })
            migratedCount += 1
            continue
          }

          const txId = generateUUID()
          txsToInsert.push(buildLegacyTransactionPayload(inv, portfolio.id, txId))
          investmentsToUpdate.push({
            id: inv.id,
            transaction_id: txId,
          })
          migratedCount += 1
        }

        if (txsToInsert.length > 0) {
          const { error: txsInsertError } = await supabase
            .from('portfolio_transactions')
            .insert(txsToInsert)
          if (txsInsertError) throw txsInsertError
        }

        for (const item of investmentsToUpdate) {
          const { error: linkError } = await supabase
            .from('investments')
            .update({ transaction_id: item.transaction_id })
            .eq('id', item.id)

          if (linkError) throw linkError
        }

        if (migratedCount > 0 && txsToInsert.length > 0) {
          toast.success('Seus dados legados foram importados com sucesso para a carteira de consultoria!')
        }
      }

      // 3. Carregar os dados atualizados do portfolio
      const { data: transactionsData } = await supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('portfolio_id', portfolio.id)

      const { data: targets } = await supabase
        .from('target_allocations')
        .select('*')
        .eq('portfolio_id', portfolio.id)

      const { data: groupTargetsData } = await supabase
        .from('portfolio_group_targets')
        .select('*')
        .eq('portfolio_id', portfolio.id)

      setTransactions(transactionsData || [])
      setTargetAllocations(targets || [])
      setGroupTargets(groupTargetsData || [])

      if (!transactionsData || transactionsData.length === 0) {
        setPortfolioData({
          cashBalance: 0,
          totalValue: 0,
          positions: [],
          consolidatedClass: [],
          consolidatedSector: []
        })
        return
      }

      const valuation = await loadPortfolioValuation(
        portfolio.id,
        transactionsData || [],
        targets || [],
        Number(portfolio.cash_balance) || 0
      )

      setAssetPrices(valuation.prices || {})
      setAssetDefinitions(valuation.definitions)

      const { positions, totalValue } = valuation
      const consolidatedClass = calculateConsolidatedByClass(positions, totalValue, groupTargetsData || [])
      const consolidatedSector = calculateConsolidatedBySector(positions, totalValue, groupTargetsData || [])

      setPortfolioData({
        cashBalance: valuation.cashBalance,
        totalValue,
        positions,
        consolidatedClass,
        consolidatedSector
      })    } catch (err) {
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

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) return
    setSavingTarget(true)

    try {
      const ticker = targetTicker.toUpperCase().trim()
      const pct = parseFloat(targetPct)

      if (!ticker) throw new Error('Insira o ticker do ativo')
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de alocação inválido (0 a 100)')

      const currentSum = targetAllocations
        .filter(t => t.ticker.toUpperCase() !== ticker)
        .reduce((sum, t) => sum + Number(t.target_percentage), 0)

      if (currentSum + pct > 100.00) {
        throw new Error(`A soma das alocações passaria de 100% (Atual: ${currentSum}%, Tentativa de adicionar: ${pct}%)`)
      }

      const { error: upsertError } = await supabase
        .from('target_allocations')
        .upsert({
          portfolio_id: portfolioId,
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
      loadPortfolio()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar meta')
    } finally {
      setSavingTarget(false)
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
      loadPortfolio()
    } catch (err) {
      toast.error('Erro ao excluir meta')
    }
  }

  const handleSaveGroupTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) return
    setSavingGroupTarget(true)

    try {
      const pct = parseFloat(groupTargetPct)
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de limite inválido (0 a 100)')
      
      const name = groupTargetName.trim()
      if (!name) throw new Error('Insira o nome do grupo')

      const { error } = await supabase
        .from('portfolio_group_targets')
        .upsert({
          portfolio_id: portfolioId,
          group_type: groupTargetType,
          group_name: name,
          target_percentage: pct
        })

      if (error) throw error

      toast.success('Limite de exposição atualizado!')
      setGroupTargetPct('')
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
          <div className="flex gap-2">
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
          <Loader text="Carregando sua carteira de consultoria..." className="py-12" />
        ) : portfolioData && (
          <div className="space-y-6 animate-fade-in">
            {/* Cards de KPIs da Consultoria */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4 md:p-5 flex flex-col justify-between border-l-4 border-l-[var(--color-income)]">
                <p className="text-xs font-semibold text-secondary tracking-wide uppercase">Patrimônio sob Consultoria</p>
                <p className="text-2xl font-bold text-primary mt-2">
                  {formatCurrency(portfolioData.totalValue)}
                </p>
                <p className="text-xs text-secondary mt-1">Valor total alocado em ativos</p>
              </Card>
              <Card className="p-4 md:p-5 flex flex-col justify-between border-l-4 border-l-[var(--color-balance)]">
                <p className="text-xs font-semibold text-secondary tracking-wide uppercase">Ativos Gerenciados</p>
                <p className="text-2xl font-bold text-primary mt-2">
                  {portfolioData.positions.length}
                </p>
                <p className="text-xs text-secondary mt-1">Tickers recomendados pelo gestor</p>
              </Card>
            </div>
            <div className="bg-secondary/40 border border-primary p-4 rounded-2xl space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2.5 text-left">
                  <Layers size={18} className="text-indigo-500" />
                  <div>
                    <h4 className="text-sm font-bold text-primary">Limites de Exposição por Classe & Setor</h4>
                    <p className="text-[10px] text-secondary">Defina limites percentuais máximos recomendados para diversificação do seu portfólio</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowGroupTargetForm(!showGroupTargetForm)}
                  className="flex items-center gap-1.5 text-xs border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 dark:hover:text-indigo-300 py-1.5 px-3 rounded-xl font-semibold shadow-sm transition-all"
                >
                  <Plus size={13} />
                  {showGroupTargetForm ? 'Fechar Painel' : 'Definir Limites'}
                </Button>
              </div>

              {showGroupTargetForm && (
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
              )}

              {/* Listagem de Limites Cadastrados */}
              {groupTargets.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2 text-left">
                  {groupTargets.map((gt: any) => (
                    <span key={gt.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary border border-primary rounded-xl text-xs font-semibold text-primary shadow-sm hover:border-indigo-500/30 transition-all animate-page-enter">
                      <span className="text-secondary uppercase text-[8px] font-extrabold tracking-wider">
                        {gt.group_type === 'class' ? 'Classe' : 'Setor'}:
                      </span>
                      <strong>{gt.group_name}</strong> ({gt.target_percentage}%)
                      <button
                        type="button"
                        onClick={() => handleDeleteGroupTarget(gt.id)}
                        className="text-secondary hover:text-red-500 transition-colors ml-1.5 flex items-center justify-center"
                        title="Remover limite"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Grid de Consolidações: Classes de Ativos e Setores Econômicos */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              
              {/* 1. Classes de Ativos */}
              <Card className="p-4 lg:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-secondary" />
                  <h3 className="text-base font-bold text-primary">Consolidação por Classes de Ativos</h3>
                </div>

                <div className="space-y-4">
                  {portfolioData.consolidatedClass.map((cls) => {
                    const isPositive = cls.yield_pct >= 0
                    return (
                      <div key={cls.name} className="p-3 bg-secondary border border-primary rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary text-sm">{cls.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                              isPositive ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                            }`}>
                              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              Bruta {isPositive ? '+' : ''}{cls.gross_yield_pct.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-secondary">
                              Líq. {cls.net_yield_pct >= 0 ? '+' : ''}{cls.net_yield_pct.toFixed(2)}%
                            </span>
                            <span className="text-xs text-secondary font-medium">
                              {cls.current_percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar com Alvo vs Atual */}
                        <div className="space-y-1">
                          <div className="w-full h-2 rounded-full bg-primary relative overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-income transition-all duration-500" 
                              style={{ width: `${Math.min(cls.current_percentage, 100)}%` }} 
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-secondary">
                            <span>Atual: {formatCurrency(cls.total_value)}</span>
                            <span>Alvo recomendado: {cls.target_percentage.toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>

              {/* 2. Setores Econômicos */}
              <Card className="p-4 lg:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Briefcase size={18} className="text-secondary" />
                  <h3 className="text-base font-bold text-primary">Consolidação por Setores Econômicos</h3>
                </div>

                <div className="space-y-4">
                  {portfolioData.consolidatedSector.map((sec) => {
                    const isPositive = sec.yield_pct >= 0
                    return (
                      <div key={sec.name} className="p-3 bg-secondary border border-primary rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-primary text-sm">{sec.name}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                              isPositive ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'
                            }`}>
                              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                              Bruta {isPositive ? '+' : ''}{sec.gross_yield_pct.toFixed(2)}%
                            </span>
                            <span className="text-[10px] text-secondary">
                              Líq. {sec.net_yield_pct >= 0 ? '+' : ''}{sec.net_yield_pct.toFixed(2)}%
                            </span>
                            <span className="text-xs text-secondary font-medium">
                              {sec.current_percentage.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="w-full h-2 rounded-full bg-primary relative overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-balance transition-all duration-500" 
                              style={{ width: `${Math.min(sec.current_percentage, 100)}%` }} 
                            />
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-secondary">
                            <span>Atual: {formatCurrency(sec.total_value)}</span>
                            <span>Alvo recomendado: {sec.target_percentage.toFixed(0)}%</span>
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
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <h3 className="text-base font-bold text-primary">Demonstrativo Detalhado de Ativos</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowTargetForm(!showTargetForm)
                      const registered = Array.from(new Set([
                        ...transactions.map(t => t.ticker.toUpperCase()),
                        ...targetAllocations.map(t => t.ticker.toUpperCase())
                      ]))
                      setIsCustomTicker(registered.length === 0)
                    }}
                    className="flex items-center gap-1.5 text-xs border-emerald-500/20 text-emerald-600 hover:bg-emerald-500/10 py-1 px-2.5 rounded-lg"
                  >
                    <Percent size={13} className="text-emerald-500" />
                    Ajustar Metas
                  </Button>
                </div>
              </div>

              {showTargetForm && (() => {
                const registeredTickers = Array.from(new Set([
                  ...transactions.map(t => t.ticker.toUpperCase()),
                  ...targetAllocations.map(t => t.ticker.toUpperCase())
                ])).sort()

                return (
                  <form onSubmit={handleSaveTarget} className="p-4 bg-muted/20 border border-border/40 rounded-xl mb-4.5 flex flex-wrap md:flex-nowrap gap-3 items-end animate-page-enter">
                    <div className="flex-1 min-w-[150px] text-left">
                      <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Selecionar Ticker</label>
                      <select
                        value={isCustomTicker ? 'custom' : targetTicker}
                        onChange={e => handleSelectRegisteredTicker(e.target.value)}
                        className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                      >
                        <option value="">Selecione um ativo...</option>
                        {registeredTickers.map(ticker => (
                          <option key={ticker} value={ticker}>{ticker}</option>
                        ))}
                        <option value="custom">➕ Outro Ativo (Digitar...)</option>
                      </select>
                    </div>

                    {isCustomTicker && (
                      <div className="flex-1 min-w-[120px] relative text-left animate-page-enter">
                        <Input
                          label="Digitar Ticker"
                          type="text"
                          required
                          placeholder="Ex: WEGE3"
                          value={targetTicker}
                          onChange={e => handleCustomTickerChange(e.target.value)}
                          onBlur={() => setTimeout(() => setShowTargetSuggestions(false), 200)}
                          onFocus={() => targetTicker.length >= 2 && setShowTargetSuggestions(true)}
                          className="uppercase text-sm font-semibold text-primary bg-primary"
                        />
                        {showTargetSuggestions && targetSuggestions.length > 0 && (
                          <div className="absolute z-[1001] w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
                            {targetSuggestions.map(s => (
                              <button
                                key={s.ticker}
                                type="button"
                                onClick={() => {
                                  setTargetTicker(s.ticker)
                                  const existing = assetPrices[s.ticker.toUpperCase()]
                                  if (existing) {
                                    setTargetAssetClass(existing.asset_class || '')
                                    setTargetSector(existing.sector || '')
                                  }
                                  setShowTargetSuggestions(false)
                                }}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-tertiary text-primary flex items-center justify-between border-b border-primary/10 last:border-0"
                              >
                                <span className="font-bold">{s.ticker}</span>
                                <span className="text-[10px] text-secondary truncate max-w-[150px]">{s.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-[120px] text-left">
                      <Input
                        label="% Alvo Ideal"
                        type="number"
                        required
                        step="0.1"
                        placeholder="Ex: 15"
                        value={targetPct}
                        onChange={e => setTargetPct(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                    <div className="flex-1 min-w-[140px] text-left">
                      <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Classe (Opcional)</label>
                      <select
                        value={targetAssetClass}
                        onChange={e => setTargetAssetClass(e.target.value)}
                        className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                      >
                        <option value="">Inferir Auto</option>
                        <option value="Ações Nacionais">Ações Nacionais</option>
                        <option value="Ações Internacionais">Ações Internacionais</option>
                        <option value="Fundos Imobiliários">Fundos Imobiliários</option>
                        <option value="ETFs Nacionais">ETFs Nacionais</option>
                        <option value="ETFs Internacionais">ETFs Internacionais</option>
                        <option value="Criptoativos">Criptoativos</option>
                        <option value="Renda Fixa">Renda Fixa</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[140px] text-left">
                      <Input
                        label="Setor (Opcional)"
                        type="text"
                        placeholder="Ex: Energia"
                        value={targetSector}
                        onChange={e => setTargetSector(e.target.value)}
                        className="text-sm font-semibold"
                      />
                    </div>
                    <Button type="submit" disabled={savingTarget} variant="primary" className="text-xs h-[42px] shrink-0 font-extrabold shadow-sm">
                      Salvar Meta
                    </Button>
                  </form>
                )
              })()}

              <div className="overflow-x-auto border border-primary rounded-xl">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="bg-secondary border-b border-primary text-xs font-bold text-secondary uppercase tracking-wider">
                      <th className="p-3">Ativo</th>
                      <th className="p-3">Classe</th>
                      <th className="p-3">Setor</th>
                      <th className="p-3 text-right">Qtd</th>
                      <th className="p-3 text-right">Custo Médio</th>
                      <th className="p-3 text-right">Preço Atual</th>
                      <th className="p-3 text-right">Valor Total</th>
                      <th className="p-3 text-right">Rent. bruta</th>
                      <th className="p-3 text-right">Rent. líq.</th>
                      <th className="p-3 text-center">Part. Real</th>
                      <th className="p-3 text-center">Part. Alvo</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary">
                    {(() => {
                      const positionsByClass: Record<string, AssetPosition[]> = {}
                      portfolioData.positions.forEach(pos => {
                        const cls = pos.asset_class || 'Não classificado'
                        if (!positionsByClass[cls]) positionsByClass[cls] = []
                        positionsByClass[cls].push(pos)
                      })
                      return Object.entries(positionsByClass).map(([className, classPositions]) => (
                        <div key={className} style={{ display: 'contents' }}>
                          {/* Linha de cabeçalho do grupo de classe */}
                          <tr className="bg-secondary/60 font-bold border-l-4 border-l-[var(--color-income)] text-primary text-xs tracking-wider">
                            <td colSpan={12} className="p-3.5 uppercase font-extrabold text-secondary">
                              {className}
                            </td>
                          </tr>
                          {classPositions.map((pos) => (
                            <tr key={pos.ticker} className="hover:bg-secondary/40 transition-colors">
                              <td className="p-3 pl-6 font-bold text-primary">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-income shrink-0" />
                                  {pos.ticker === 'SALDO_INV' || pos.ticker === 'CAIXA'
                                    ? 'Saldo em caixa'
                                    : pos.ticker}
                                  {getAssetPricingBadgeLabel(pos) && (
                                    <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600">
                                      {getAssetPricingBadgeLabel(pos)}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3 text-xs text-secondary font-medium">{pos.asset_class || 'Não classificado'}</td>
                              <td className="p-3 text-xs text-secondary font-semibold">{pos.sector || 'Outros'}</td>
                              <td className="p-3 text-right text-primary font-medium">
                                {pos.pricing_mode === 'cash' ? '—' : pos.quantity.toLocaleString('pt-BR')}
                              </td>
                              <td className="p-3 text-right text-secondary">
                                {pos.pricing_mode === 'cash' ? '—' : formatCurrency(pos.average_price)}
                              </td>
                              <td className="p-3 text-right text-secondary">
                                {pos.pricing_mode === 'cash' ? '—' : formatCurrency(pos.current_price)}
                              </td>
                              <td className="p-3 text-right text-primary font-semibold">{formatCurrency(pos.total_value)}</td>
                              <td className={`p-3 text-right font-semibold ${pos.pricing_mode === 'cash' ? 'text-secondary' : pos.gross_yield_pct >= 0 ? 'text-income' : 'text-expense'}`}>
                                {pos.pricing_mode === 'cash' ? '—' : `${pos.gross_yield_pct >= 0 ? '+' : ''}${pos.gross_yield_pct.toFixed(2)}%`}
                              </td>
                              <td className={`p-3 text-right font-semibold ${pos.pricing_mode === 'cash' ? 'text-secondary' : pos.net_yield_pct >= 0 ? 'text-income' : 'text-expense'}`}>
                                {pos.pricing_mode === 'cash' ? '—' : `${pos.net_yield_pct >= 0 ? '+' : ''}${pos.net_yield_pct.toFixed(2)}%`}
                              </td>
                              <td className="p-3 text-center font-bold text-primary">{pos.current_percentage.toFixed(1)}%</td>
                              <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="font-bold text-income">{pos.target_percentage.toFixed(0)}%</span>
                                    {pos.target_percentage > 0 && (
                                      <button
                                        onClick={() => {
                                          const targetObj = targetAllocations.find(t => t.ticker.toUpperCase() === pos.ticker);
                                          if (targetObj) handleDeleteTarget(targetObj.id);
                                        }}
                                        className="text-secondary hover:text-red-500 transition-colors"
                                        title="Remover meta"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              <td className="p-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssetDefTicker(pos.ticker)
                                    setAssetDefModalOpen(true)
                                  }}
                                  className="text-secondary hover:text-primary transition-colors"
                                  title="Configurar precificação"
                                >
                                  <Settings2 size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </div>
                      ))
                    })()}

                  </tbody>
                </table>
              </div>
            </Card>

            {/* Card de Transações do Livro-Razão */}
            <Card className="p-4 lg:p-6 space-y-4">
              <h3 className="text-base font-bold text-primary flex items-center gap-2">
                <Briefcase size={16} className="text-indigo-500" />
                Livro-Razão (Histórico de Transações)
              </h3>

              <div className="space-y-2.5 max-h-[280px] overflow-y-auto pr-1">
                {transactions.length === 0 ? (
                  <p className="text-center py-6 text-xs text-secondary italic">
                    Nenhuma transação de ativo registrada.
                  </p>
                ) : (
                  [...transactions].reverse().map(tx => (
                    <button
                      key={tx.id}
                      type="button"
                      onClick={() => handleOpenTxModal(tx)}
                      className="w-full p-3 bg-secondary/30 border border-primary rounded-xl flex items-center justify-between text-xs transition-all hover:border-indigo-500/20 hover:bg-secondary/50 text-left cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-primary font-bold">
                            {tx.ticker === 'SALDO_INV' || tx.ticker === 'CAIXA'
                              ? 'Saldo em caixa'
                              : tx.ticker}
                          </strong>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider ${
                              tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                                ? 'bg-income/10 text-income'
                                : tx.operation_type === 'dividend'
                                ? 'bg-indigo-500/10 text-indigo-500'
                                : 'bg-expense/10 text-expense'
                            }`}
                          >
                            {tx.operation_type === 'buy' ? 'Compra' : tx.operation_type === 'sell' ? 'Venda' : tx.operation_type === 'dividend' ? 'Provento' : tx.operation_type === 'subscription' ? 'Subscrição' : 'Desdobro'}
                          </span>
                        </div>
                        <div className="text-[10px] text-secondary mt-1 flex flex-wrap items-center gap-2">
                          <span>Quantidade: <strong>{Number(tx.quantity).toLocaleString('pt-BR')}</strong></span>
                          <span>•</span>
                          <span>Preço: <strong>{formatCurrency(Number(tx.price))}</strong></span>
                          <span>•</span>
                          <span>Total: <strong>{formatCurrency(Number(tx.quantity) * Number(tx.price))}</strong></span>
                        </div>
                      </div>
                      <span className="text-[10px] text-secondary font-medium shrink-0">{tx.date}</span>
                    </button>
                  ))
                )}
              </div>
            </Card>
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
          <AssetDefinitionFormModal
            isOpen={assetDefModalOpen}
            onClose={() => setAssetDefModalOpen(false)}
            portfolioId={portfolioId}
            ticker={assetDefTicker}
            existing={assetDefinitions.find((d) => d.ticker.toUpperCase() === assetDefTicker.toUpperCase()) ?? null}
            onSaved={loadPortfolio}
          />
        </>
      )}
    </div>
  )
}
