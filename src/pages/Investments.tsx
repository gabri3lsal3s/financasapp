import { useEffect, useState } from 'react'
import PageHeader from '@/components/PageHeader'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { formatCurrency } from '@/utils/format'
import { PAGE_HEADERS } from '@/constants/pages'
import { Plus, Briefcase, TrendingUp, TrendingDown, Layers, Trash2, Percent } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import Input from '@/components/Input'
import toast from 'react-hot-toast'
import { 
  AssetPosition, 
  ConsolidatedGroup, 
  calculatePositions, 
  calculateConsolidatedByClass, 
  calculateConsolidatedBySector 
} from '@/services/investmentEngine'
import { getAssetPrices, searchB3Assets, getAssetRichData } from '@/services/priceService'

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
  const [transactions, setTransactions] = useState<any[]>([])
  const [targetAllocations, setTargetAllocations] = useState<any[]>([])
  const [showTxForm, setShowTxForm] = useState<boolean>(false)
  const [txTicker, setTxTicker] = useState<string>('')
  const [txType, setTxType] = useState<'buy' | 'sell' | 'dividend' | 'split' | 'subscription'>('buy')
  const [txQty, setTxQty] = useState<string>('')
  const [txPrice, setTxPrice] = useState<string>('')
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [savingTx, setSavingTx] = useState<boolean>(false)

  const [showTargetForm, setShowTargetForm] = useState<boolean>(false)
  const [targetTicker, setTargetTicker] = useState<string>('')
  const [targetPct, setTargetPct] = useState<string>('')
  const [savingTarget, setSavingTarget] = useState<boolean>(false)
  const [targetAssetClass, setTargetAssetClass] = useState<string>('')
  const [targetSector, setTargetSector] = useState<string>('')
  const [isCustomTicker, setIsCustomTicker] = useState<boolean>(false)

  // Autocomplete
  const [txSuggestions, setTxSuggestions] = useState<{ ticker: string, name: string }[]>([])
  const [showTxSuggestions, setShowTxSuggestions] = useState<boolean>(false)
  const [targetSuggestions, setTargetSuggestions] = useState<{ ticker: string, name: string }[]>([])
  const [showTargetSuggestions, setShowTargetSuggestions] = useState<boolean>(false)
  const [txAssetRichData, setTxAssetRichData] = useState<any>(null)
  const [loadingRichData, setLoadingRichData] = useState<boolean>(false)
  const [assetPrices, setAssetPrices] = useState<Record<string, any>>({})

  // Estados para limites de exposição por classe e setor
  const [portfolioId, setPortfolioId] = useState<string>('')
  const [groupTargets, setGroupTargets] = useState<any[]>([])
  const [showGroupTargetForm, setShowGroupTargetForm] = useState<boolean>(false)
  const [groupTargetType, setGroupTargetType] = useState<'class' | 'sector'>('class')
  const [groupTargetName, setGroupTargetName] = useState<string>('Ações Nacionais')
  const [groupTargetPct, setGroupTargetPct] = useState<string>('')



  useEffect(() => {
    const quickAdd = searchParams.get('quickAdd')
    if (quickAdd === '1') {
      setShowTxForm(true)
      setShowTargetForm(false)

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

      // 2. Executar a Migração única dos dados legados (se houver)
      const { data: userInvestments } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', user.id)

      const unconverted = userInvestments?.filter(inv => !inv.transaction_id) || []

      if (unconverted.length > 0) {
        const txsToInsert: any[] = []
        const investmentsToUpdate: { id: string; transaction_id: string }[] = []

        for (const inv of unconverted) {
          // Todo e qualquer investimento legando cadastrado pelo usuário até agora é convertido em transações
          // no livro-razão como "Saldo para Investimento", com data original para manter precisão de registro mensal.
          const dateStr = inv.month ? `${inv.month}-01` : new Date(inv.created_at).toISOString().split('T')[0]
          const txId = generateUUID()
          txsToInsert.push({
            id: txId,
            portfolio_id: portfolio.id,
            ticker: 'SALDO_INV',
            operation_type: 'buy',
            quantity: 1,
            price: Number(inv.amount),
            date: dateStr
          })
          investmentsToUpdate.push({
            id: inv.id,
            transaction_id: txId
          })
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

        toast.success('Seus dados legados foram importados com sucesso para a Carteira Cerrado!')
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

      const tickers = Array.from(new Set(transactionsData.map(t => t.ticker)))
      const prices = await getAssetPrices(tickers)
      setAssetPrices(prices || {})

      const { positions, totalValue } = calculatePositions(
        transactionsData,
        targets || [],
        prices,
        0
      )

      const consolidatedClass = calculateConsolidatedByClass(positions, totalValue, groupTargetsData || [])
      const consolidatedSector = calculateConsolidatedBySector(positions, totalValue, groupTargetsData || [])

      setPortfolioData({
        cashBalance: 0,
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

  const handleTxTickerChange = async (val: string) => {
    setTxTicker(val)
    if (val.length >= 2) {
      const suggestions = await searchB3Assets(val)
      setTxSuggestions(suggestions)
      setShowTxSuggestions(true)
    } else {
      setTxSuggestions([])
      setShowTxSuggestions(false)
      setTxAssetRichData(null)
    }
  }

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

  useEffect(() => {
    const fetchRichData = async () => {
      if (txTicker.length >= 3) {
        setLoadingRichData(true)
        try {
          const data = await getAssetRichData(txTicker)
          setTxAssetRichData(data)
          if (data && (!txPrice || txPrice === '0' || txPrice === '')) {
            setTxPrice(data.price.toFixed(2))
          }
        } catch (err) {
          console.warn('Erro ao carregar dados ricos da cotação:', err)
        } finally {
          setLoadingRichData(false)
        }
      } else {
        setTxAssetRichData(null)
      }
    }

    const timer = setTimeout(fetchRichData, 500)
    return () => clearTimeout(timer)
  }, [txTicker])

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolioId) return
    setSavingTx(true)

    try {
      const qty = parseFloat(txQty)
      const price = parseFloat(txPrice)
      const ticker = txTicker.toUpperCase().trim()

      if (isNaN(qty) || qty <= 0) throw new Error('Quantidade inválida')
      if (isNaN(price) || price <= 0) throw new Error('Preço inválido')
      if (!ticker) throw new Error('Insira o ticker')

      const { error: txError } = await supabase
        .from('portfolio_transactions')
        .insert({
          portfolio_id: portfolioId,
          ticker,
          operation_type: txType,
          quantity: qty,
          price,
          date: txDate
        })

      if (txError) throw txError

      // Salva em investments para histórico consolidado de caixa (rastreabilidade nos relatórios)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const totalCost = qty * price
        const netChange = (txType === 'buy' || txType === 'subscription') ? -totalCost : totalCost
        await supabase
          .from('investments')
          .insert({
            user_id: user.id,
            amount: netChange,
            month: txDate.substring(0, 7),
            description: `${txType === 'buy' ? 'Compra' : txType === 'sell' ? 'Venda' : txType === 'dividend' ? 'Provento' : txType === 'subscription' ? 'Subscrição' : 'Desdobro'}: ${qty} ${ticker}`,
            ticker,
            quantity: qty,
            price,
            transaction_id: `cerrado_tx_${generateUUID()}`
          })
      }

      toast.success('Transação registrada com sucesso!')
      setTxTicker('')
      setTxQty('')
      setTxPrice('')
      setShowTxForm(false)
      loadPortfolio()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao registrar transação')
    } finally {
      setSavingTx(false)
    }
  }

  const handleDeleteTransaction = async (txId: string) => {
    try {
      const { data: tx } = await supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('id', txId)
        .single()

      if (!tx) throw new Error('Transação não encontrada')

      const { error: delError } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', txId)

      if (delError) throw delError

      // Deleta o registro correspondente no histórico (investments)
      await supabase
        .from('investments')
        .delete()
        .eq('ticker', tx.ticker)
        .eq('quantity', tx.quantity)
        .eq('price', tx.price)

      toast.success('Transação excluída!')
      loadPortfolio()
    } catch (err) {
      toast.error('Erro ao deletar transação')
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
              onClick={() => {
                setShowTxForm(prev => !prev)
                setShowTargetForm(false)
              }}
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
          <Loader text="Carregando sua Carteira Cerrado..." className="py-12" />
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
                <form onSubmit={handleSaveGroupTarget} className="p-4 bg-primary/40 border border-primary rounded-xl space-y-4 animate-page-enter">
                  <div className="flex flex-wrap gap-3 items-end text-left">
                    <div className="flex-1 min-w-[150px]">
                      <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Tipo de Limite</label>
                      <select
                        value={groupTargetType}
                        onChange={e => {
                          const val = e.target.value as 'class' | 'sector'
                          setGroupTargetType(val)
                          setGroupTargetName(val === 'class' ? 'Ações Nacionais' : '')
                        }}
                        className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                      >
                        <option value="class">Por Classe de Ativos</option>
                        <option value="sector">Por Setor Econômico</option>
                      </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      {groupTargetType === 'class' ? (
                        <div>
                          <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Classe de Ativo</label>
                          <select
                            value={groupTargetName}
                            onChange={e => setGroupTargetName(e.target.value)}
                            className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                            required
                          >
                            <option value="Ações Nacionais">Ações Nacionais</option>
                            <option value="Ações Internacionais">Ações Internacionais</option>
                            <option value="Fundos Imobiliários">Fundos Imobiliários</option>
                            <option value="ETFs Nacionais">ETFs Nacionais</option>
                            <option value="ETFs Internacionais">ETFs Internacionais</option>
                            <option value="Criptoativos">Criptoativos</option>
                            <option value="Renda Fixa">Renda Fixa</option>
                          </select>
                        </div>
                      ) : (
                        <Input
                          label="Setor Econômico"
                          type="text"
                          required
                          placeholder="Ex: Petróleo e Gás"
                          value={groupTargetName}
                          onChange={e => setGroupTargetName(e.target.value)}
                          className="text-sm font-semibold text-primary bg-primary"
                        />
                      )}
                    </div>

                    <div className="w-[120px]">
                      <Input
                        label="Limite Alvo (%)"
                        type="number"
                        required
                        placeholder="Ex: 30"
                        value={groupTargetPct}
                        onChange={e => setGroupTargetPct(e.target.value)}
                        className="text-sm font-semibold text-primary bg-primary"
                      />
                    </div>

                    <Button type="submit" disabled={savingGroupTarget} variant="primary" className="text-xs h-[42px] shrink-0 font-extrabold px-5 shadow-sm">
                      {savingGroupTarget ? 'Salvando...' : 'Salvar Limite'}
                    </Button>
                  </div>
                </form>
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
                              {isPositive ? '+' : ''}{cls.yield_pct.toFixed(2)}%
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
                              {isPositive ? '+' : ''}{sec.yield_pct.toFixed(2)}%
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
                      setShowTxForm(false)
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
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowTxForm(!showTxForm)
                      setShowTargetForm(false)
                    }}
                    className="flex items-center gap-1.5 text-xs border-indigo-500/20 text-indigo-600 hover:bg-indigo-500/10 py-1 px-2.5 rounded-lg"
                  >
                    <Plus size={13} className="text-indigo-500" />
                    Lançar Transação
                  </Button>
                </div>
              </div>

              {showTxForm && (
                <form onSubmit={handleAddTransaction} className="p-4 bg-muted/20 border border-border/40 rounded-xl mb-4.5 space-y-3 animate-page-enter">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left">
                    <div className="relative">
                      <Input
                        label="Ticker"
                        type="text"
                        required
                        placeholder="Ex: PETR4"
                        value={txTicker}
                        onChange={e => handleTxTickerChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowTxSuggestions(false), 200)}
                        onFocus={() => txTicker.length >= 2 && setShowTxSuggestions(true)}
                        className="uppercase text-sm font-semibold text-primary bg-primary"
                      />
                      {showTxSuggestions && txSuggestions.length > 0 && (
                        <div className="absolute z-[1001] w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
                          {txSuggestions.map(s => (
                            <button
                              key={s.ticker}
                              type="button"
                              onClick={() => {
                                setTxTicker(s.ticker)
                                setShowTxSuggestions(false)
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

                    <div>
                      <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Operação</label>
                      <select
                        value={txType}
                        onChange={e => setTxType(e.target.value as any)}
                        className="w-full bg-primary text-primary text-sm font-semibold rounded-xl border border-primary p-2.5 h-[42px] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
                      >
                        <option value="buy">Compra</option>
                        <option value="sell">Venda</option>
                        <option value="dividend">Provento/Div</option>
                        <option value="split">Desdobrar</option>
                        <option value="subscription">Subscrição</option>
                      </select>
                    </div>

                    <div>
                      <Input
                        label="Data"
                        type="date"
                        required
                        value={txDate}
                        onChange={e => setTxDate(e.target.value)}
                        className="text-sm font-semibold text-primary bg-primary"
                      />
                    </div>
                  </div>

                  {loadingRichData && (
                    <div className="text-[10px] text-secondary animate-pulse pl-1 text-left">Carregando dados da B3/Yahoo...</div>
                  )}

                  {txAssetRichData && (
                    <div className="p-3 bg-primary border border-primary rounded-xl text-xs space-y-1 text-secondary animate-page-enter mx-1 max-w-md text-left">
                      <div className="flex justify-between items-center">
                        <strong className="text-primary font-bold">{txAssetRichData.name}</strong>
                        <span className="text-emerald-500 font-extrabold">R$ {txAssetRichData.price.toFixed(2)}</span>
                      </div>
                      {txAssetRichData.dividendYield !== undefined && (
                        <div className="flex justify-between items-center text-[10px] opacity-80 pt-0.5 border-t border-primary/10">
                          <span>Dividend Yield Anual (DY):</span>
                          <span className="text-indigo-500 font-bold">{txAssetRichData.dividendYield.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-left items-end">
                    <div>
                      <Input
                        label="Quantidade"
                        type="number"
                        required
                        step="any"
                        placeholder="Ex: 10"
                        value={txQty}
                        onChange={e => setTxQty(e.target.value)}
                        className="text-sm font-semibold text-primary bg-primary"
                      />
                    </div>
                    <div>
                      <Input
                        label="Preço de Execução"
                        type="number"
                        required
                        step="any"
                        placeholder="Ex: 35.50"
                        value={txPrice}
                        onChange={e => setTxPrice(e.target.value)}
                        className="text-sm font-semibold text-primary bg-primary"
                      />
                    </div>
                    <Button type="submit" disabled={savingTx} variant="primary" className="text-xs h-[42px] shrink-0 font-extrabold shadow-sm w-full">
                      {savingTx ? 'Registrando...' : 'Registrar Transação'}
                    </Button>
                  </div>
                </form>
              )}

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
                      <th className="p-3 text-center">Part. Real</th>
                      <th className="p-3 text-center">Part. Alvo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary">
                    {(() => {
                      const positionsByClass: Record<string, AssetPosition[]> = {}
                      portfolioData.positions.forEach(pos => {
                        const cls = pos.asset_class || 'Renda Fixa'
                        if (!positionsByClass[cls]) positionsByClass[cls] = []
                        positionsByClass[cls].push(pos)
                      })
                      return Object.entries(positionsByClass).map(([className, classPositions]) => (
                        <div key={className} style={{ display: 'contents' }}>
                          {/* Linha de cabeçalho do grupo de classe */}
                          <tr className="bg-secondary/60 font-bold border-l-4 border-l-[var(--color-income)] text-primary text-xs tracking-wider">
                            <td colSpan={9} className="p-3.5 uppercase font-extrabold text-secondary">
                              {className}
                            </td>
                          </tr>
                          {classPositions.map((pos) => (
                            <tr key={pos.ticker} className="hover:bg-secondary/40 transition-colors">
                              <td className="p-3 pl-6 font-bold text-primary flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-income"></span>
                                {pos.ticker === 'SALDO_INV' ? 'Saldo para Investimento' : pos.ticker}
                              </td>
                              <td className="p-3 text-xs text-secondary font-medium">{pos.asset_class || 'Renda Fixa'}</td>
                              <td className="p-3 text-xs text-secondary font-semibold">{pos.sector || 'Outros'}</td>
                              <td className="p-3 text-right text-primary font-medium">{pos.quantity.toLocaleString('pt-BR')}</td>
                              <td className="p-3 text-right text-secondary">{formatCurrency(pos.average_price)}</td>
                              <td className="p-3 text-right text-secondary">{formatCurrency(pos.current_price)}</td>
                              <td className="p-3 text-right text-primary font-semibold">{formatCurrency(pos.total_value)}</td>
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
                  <p className="text-center py-6 text-xs text-secondary italic text-left">Nenhuma transação de ativo registrada.</p>
                ) : (
                  [...transactions].reverse().map(tx => (
                    <div key={tx.id} className="p-3 bg-secondary/30 border border-primary rounded-xl flex items-center justify-between text-xs transition-all hover:border-indigo-500/20 text-left">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-primary font-bold">{tx.ticker === 'SALDO_INV' ? 'Saldo para Investimento' : tx.ticker}</strong>
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
                          <span>Preço: <strong>R$ {Number(tx.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                          <span>•</span>
                          <span>Total: <strong>R$ {(Number(tx.quantity) * Number(tx.price)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-secondary font-medium">{tx.date}</span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 text-secondary hover:text-red-500 transition-colors"
                          title="Excluir transação e estornar caixa"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
