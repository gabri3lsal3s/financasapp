import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Profile, Portfolio, PortfolioTransaction, TargetAllocation, AssetPrice, PortfolioGroupTarget } from '@/types'
import { calculatePositions, calculateShareHistory, calculatePerformanceMetrics, AssetPosition } from '@/services/investmentEngine'
import { getAssetPrices, searchB3Assets, getAssetRichData, AssetRichData } from '@/services/priceService'
import ContributionSimulator from '@/components/ContributionSimulator'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Loader from '@/components/Loader'
import Input from '@/components/Input'
import Select from '@/components/Select'
import Modal from '@/components/Modal'
import PageHeader from '@/components/PageHeader'
import { Plus, Wallet, TrendingUp, DollarSign, Percent, FileText, Trash2, UserPlus, Edit, Layers } from 'lucide-react'
import toast from 'react-hot-toast'
import { generateConsultingPDF } from '@/services/pdfGenerator'

export default function ConsultantDashboard() {
  const { user } = useAuth()
  const [clients, setClients] = useState<Profile[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string>('')
  const [loadingClients, setLoadingClients] = useState<boolean>(true)
  
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [transactions, setTransactions] = useState<PortfolioTransaction[]>([])
  const [targetAllocations, setTargetAllocations] = useState<TargetAllocation[]>([])
  const [assetPrices, setAssetPrices] = useState<Record<string, AssetPrice>>({})
  const [loadingPortfolio, setLoadingPortfolio] = useState<boolean>(false)

  // Estados de cálculo
  const [positions, setPositions] = useState<AssetPosition[]>([])
  const [portfolioValue, setPortfolioValue] = useState<number>(0)
  const [shareValue, setShareValue] = useState<number>(1.0)
  
  // Estado para cadastrar novo cliente (Opção A)
  const [isClientModalOpen, setIsClientModalOpen] = useState<boolean>(false)
  const [newClientName, setNewClientName] = useState<string>('')
  const [newClientEmail, setNewClientEmail] = useState<string>('')
  const [creatingClient, setCreatingClient] = useState<boolean>(false)

  // Estado para vinculação de carteira provisória a e-mail real
  const [isLinkModalOpen, setIsLinkModalOpen] = useState<boolean>(false)
  const [eligibleClients, setEligibleClients] = useState<Profile[]>([])
  const [selectedRealClientId, setSelectedRealClientId] = useState<string>('')
  const [linking, setLinking] = useState<boolean>(false)
  const [loadingEligible, setLoadingEligible] = useState<boolean>(false)

  // Estado para lançar transações
  const [showTxForm, setShowTxForm] = useState<boolean>(false)
  const [txTicker, setTxTicker] = useState<string>('')
  const [txType, setTxType] = useState<'buy' | 'sell' | 'dividend' | 'split' | 'subscription'>('buy')
  const [txQty, setTxQty] = useState<string>('')
  const [txPrice, setTxPrice] = useState<string>('')
  const [txDate, setTxDate] = useState<string>(new Date().toISOString().split('T')[0])
  const [savingTx, setSavingTx] = useState<boolean>(false)

  // Estado para gerenciar Metas de Alocação
  const [showTargetForm, setShowTargetForm] = useState<boolean>(false)
  const [targetTicker, setTargetTicker] = useState<string>('')
  const [targetPct, setTargetPct] = useState<string>('')
  const [savingTarget, setSavingTarget] = useState<boolean>(false)
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

  // Autocomplete B3 & Dados Ricos Yahoo Finance
  const [txSuggestions, setTxSuggestions] = useState<{ ticker: string, name: string }[]>([])
  const [showTxSuggestions, setShowTxSuggestions] = useState<boolean>(false)
  const [targetSuggestions, setTargetSuggestions] = useState<{ ticker: string, name: string }[]>([])
  const [showTargetSuggestions, setShowTargetSuggestions] = useState<boolean>(false)
  const [txAssetRichData, setTxAssetRichData] = useState<AssetRichData | null>(null)
  const [loadingRichData, setLoadingRichData] = useState<boolean>(false)

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
  const [savingGroupTarget, setSavingGroupTarget] = useState<boolean>(false)
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
    }
  }, [selectedClientId])

  useEffect(() => {
    if (isLinkModalOpen) {
      loadEligibleClients()
    }
  }, [isLinkModalOpen])

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

  const getClientDisplayName = (email: string) => {
    if (email.startsWith('temp_') && email.endsWith('@cerrado.internal')) {
      const parts = email.replace('temp_', '').split('@')[0].split('_')
      parts.pop() // remove o random id
      return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ') + ' (Provisório)'
    }
    return email
  }

  const loadEligibleClients = async () => {
    try {
      setLoadingEligible(true)
      // 1. Busca perfis client reais
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .not('email', 'like', 'temp_%')
        .order('email')

      if (profilesError) throw profilesError

      // 2. Busca todos os portfolios existentes
      const { data: portfoliosData, error: portfoliosError } = await supabase
        .from('portfolios')
        .select('client_id')

      if (portfoliosError) throw portfoliosError

      const takenIds = new Set(portfoliosData?.map(p => p.client_id) || [])

      // 3. Filtra os perfis reais elegíveis (que não possuem portfolios)
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
      // 1. Transfere a carteira provisória para o cliente real
      const { error: updateError } = await supabase
        .from('portfolios')
        .update({ client_id: selectedRealClientId })
        .eq('id', portfolio.id)

      if (updateError) throw updateError

      // 2. Deleta o perfil provisório antigo
      const { error: deleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', selectedClientId)

      if (deleteError) {
        console.error('Erro ao deletar perfil temporário órfão:', deleteError)
      }

      toast.success('Carteira vinculada com sucesso!')
      setIsLinkModalOpen(false)
      
      // Recarrega a lista de clientes
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('*')
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
    try {
      setLoadingClients(true)
      // Carrega perfis que são clientes
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('email')

      if (error) throw error
      setClients(data || [])
      if (data && data.length > 0) {
        setSelectedClientId(data[0].id)
      }
    } catch (err) {
      console.error('Erro ao carregar clientes:', err)
      toast.error('Erro ao buscar lista de clientes')
    } finally {
      setLoadingClients(false)
    }
  }

  const loadPortfolioData = async (clientId: string) => {
    try {
      setLoadingPortfolio(true)
      
      // 1. Carrega ou cria o portfolio
      let { data: portData, error: portError } = await supabase
        .from('portfolios')
        .select('*')
        .eq('client_id', clientId)
        .maybeSingle()

      if (portError) throw portError

      if (!portData) {
        // Cria portfolio padrão em caso de ausência
        const { data: newPort, error: createError } = await supabase
          .from('portfolios')
          .insert({ client_id: clientId, consultant_id: user?.id, cash_balance: 0.00 })
          .select()
          .single()

        if (createError) throw createError
        portData = newPort
      }

      setPortfolio(portData)

      // 2. Carrega as transações
      const { data: txsData, error: txsError } = await supabase
        .from('portfolio_transactions')
        .select('*')
        .eq('portfolio_id', portData.id)
        .order('date', { ascending: true })

      if (txsError) throw txsError
      const txs = txsData || []
      setTransactions(txs)

      // 3. Carrega metas de alocação
      const { data: targetsData, error: targetsError } = await supabase
        .from('target_allocations')
        .select('*')
        .eq('portfolio_id', portData.id)

      if (targetsError) throw targetsError
      setTargetAllocations(targetsData || [])

      // 3.1 Carrega limites agregados (classe/setor)
      const { data: groupTargetsData } = await supabase
        .from('portfolio_group_targets')
        .select('*')
        .eq('portfolio_id', portData.id)
      
      setGroupTargets(groupTargetsData || [])

      // 4. Carrega teses fundamentalistas do consultor
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

      // 5. Busca cotações dos ativos da carteira
      const tickers = Array.from(new Set([
        ...txs.map(t => t.ticker.toUpperCase()),
        ...(targetsData || []).map(t => t.ticker.toUpperCase())
      ]))

      if (tickers.length > 0) {
        const prices = await getAssetPrices(tickers)
        setAssetPrices(prices)
        
        // Roda o motor de investimentos para calcular posições
        const { positions: calcPositions, totalValue } = calculatePositions(
          txs,
          targetsData || [],
          prices,
          Number(portData.cash_balance)
        )
        setPositions(calcPositions)
        setPortfolioValue(totalValue)

        // Calcula a cota
        const { currentShareValue } = calculateShareHistory(txs, prices, Number(portData.cash_balance))
        setShareValue(currentShareValue)
      } else {
        setPositions([])
        setPortfolioValue(Number(portData.cash_balance))
        setShareValue(1.0)
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

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreatingClient(true)
    try {
      const tempId = crypto.randomUUID()
      let clientEmail = newClientEmail.trim()
      
      // Se não informou e-mail, gera um temporário
      if (!clientEmail) {
        const cleanName = newClientName
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '') // remove acentos
          .replace(/[^a-z0-9]/g, '_') // remove caracteres especiais
          .replace(/_+/g, '_') // remove duplicados
        const randId = Math.random().toString(36).substring(2, 8)
        clientEmail = `temp_${cleanName}_${randId}@cerrado.internal`
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: tempId,
          email: clientEmail,
          role: 'client',
          is_approved: true
        })

      if (profileError) throw profileError

      // O trigger do banco cria o portfolio automaticamente!
      // Associamos o consultor ao portfolio recém-criado
      await supabase
        .from('portfolios')
        .update({ consultant_id: user?.id })
        .eq('client_id', tempId)

      toast.success('Cliente cadastrado com sucesso!')
      setIsClientModalOpen(false)
      setNewClientName('')
      setNewClientEmail('')
      
      // Recarrega clientes e seleciona o recém-criado
      const { data: clientsData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('email')
        
      setClients(clientsData || [])
      setSelectedClientId(tempId)
    } catch (err) {
      console.error('Erro ao criar perfil de cliente:', err)
      toast.error(err instanceof Error ? err.message : 'Falha ao cadastrar cliente')
    } finally {
      setCreatingClient(false)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return
    setSavingTx(true)

    try {
      const qty = parseFloat(txQty)
      const price = parseFloat(txPrice)
      const ticker = txTicker.toUpperCase().trim()

      if (isNaN(qty) || qty <= 0) throw new Error('Quantidade inválida')
      if (isNaN(price) || price <= 0) throw new Error('Preço inválido')
      if (!ticker) throw new Error('Insira o ticker')

      // Registra a transação no banco
      const { error: txError } = await supabase
        .from('portfolio_transactions')
        .insert({
          portfolio_id: portfolio.id,
          ticker,
          operation_type: txType,
          quantity: qty,
          price,
          date: txDate
        })

      if (txError) throw txError

      // Ajusta o saldo de caixa do portfolio
      const totalCost = qty * price
      let newCash = Number(portfolio.cash_balance)
      
      if (txType === 'buy' || txType === 'subscription') {
        newCash = Math.max(0, newCash - totalCost)
      } else if (txType === 'sell' || txType === 'dividend') {
        newCash = newCash + totalCost
      }

      await supabase
        .from('portfolios')
        .update({ cash_balance: newCash })
        .eq('id', portfolio.id)

      toast.success('Transação registrada!')
      setShowTxForm(false)
      setTxTicker('')
      setTxQty('')
      setTxPrice('')
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar transação')
    } finally {
      setSavingTx(false)
    }
  }

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm('Tem certeza que deseja remover esta transação do livro-razão?')) return

    try {
      const tx = transactions.find(t => t.id === txId)
      if (!tx || !portfolio) return

      const { error: delError } = await supabase
        .from('portfolio_transactions')
        .delete()
        .eq('id', txId)

      if (delError) throw delError

      // Ajusta o caixa estornando a operação
      const totalCost = Number(tx.quantity) * Number(tx.price)
      let newCash = Number(portfolio.cash_balance)

      if (tx.operation_type === 'buy' || tx.operation_type === 'subscription') {
        newCash = newCash + totalCost
      } else if (tx.operation_type === 'sell' || tx.operation_type === 'dividend') {
        newCash = Math.max(0, newCash - totalCost)
      }

      await supabase
        .from('portfolios')
        .update({ cash_balance: newCash })
        .eq('id', portfolio.id)

      toast.success('Transação excluída e caixa ajustado!')
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao deletar transação')
    }
  }

  const handleSaveTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!portfolio) return
    setSavingTarget(true)

    try {
      const ticker = targetTicker.toUpperCase().trim()
      const pct = parseFloat(targetPct)

      if (!ticker) throw new Error('Insira o ticker do ativo')
      if (isNaN(pct) || pct < 0 || pct > 100) throw new Error('Percentual de alocação inválido (0 a 100)')

      // Verifica se a soma total não passa de 100% (o banco também impedirá via trigger)
      const currentSum = targetAllocations
        .filter(t => t.ticker.toUpperCase() !== ticker)
        .reduce((sum, t) => sum + Number(t.target_percentage), 0)

      if (currentSum + pct > 100.00) {
        throw new Error(`A soma das alocações passaria de 100% (Atual: ${currentSum}%, Tentativa de adicionar: ${pct}%)`)
      }

      const { error: upsertError } = await supabase
        .from('target_allocations')
        .upsert({
          portfolio_id: portfolio.id,
          ticker,
          target_percentage: pct
        })

      if (upsertError) throw upsertError

      // Força a gravação de classe e setor em asset_prices caso preenchidos
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
      loadPortfolioData(selectedClientId)
    } catch (err) {
      toast.error('Erro ao excluir meta')
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

  const handleExportPDF = async () => {
    if (!portfolio || !selectedClientId) return
    const client = clients.find(c => c.id === selectedClientId)
    if (!client) return

    toast.loading('Gerando relatório PDF de alta qualidade...', { id: 'pdf-toast' })
    try {
      // Puxa o histórico de cotas
      const { shareHistory } = calculateShareHistory(transactions, assetPrices, Number(portfolio.cash_balance))
      const metrics = calculatePerformanceMetrics(shareHistory)

      await generateConsultingPDF({
        clientName: client.email.split('@')[0].toUpperCase(),
        portfolio,
        positions,
        shareHistory,
        metrics,
        theses: assetTheses,
        cashBalance: Number(portfolio.cash_balance),
        groupTargets: groupTargets,
        executiveSummary: executiveSummary || undefined,
        nextMonthPlan: nextMonthPlan || undefined
      })
      toast.success('Relatório PDF exportado com sucesso!', { id: 'pdf-toast' })
    } catch (err) {
      console.error(err)
      toast.error('Erro ao renderizar o PDF.', { id: 'pdf-toast' })
    }
  }

  const sumTargetPercentages = targetAllocations.reduce((sum, t) => sum + Number(t.target_percentage), 0)

  const headerAction = (
    <div className="flex items-center gap-3 w-full sm:w-auto">
      {loadingClients ? (
        <span className="text-xs text-secondary">Carregando clientes...</span>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-secondary uppercase tracking-wider hidden md:inline">Cliente:</span>
          <div className="w-48 sm:w-56">
            <Select
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              options={clients.map(c => ({ value: c.id, label: getClientDisplayName(c.email) }))}
              placeholder="Selecionar Cliente"
            />
          </div>
        </div>
      )}
      <Button
        size="sm"
        onClick={() => setIsClientModalOpen(true)}
        variant="primary"
        className="flex items-center gap-1 text-xs shrink-0"
      >
        <UserPlus size={14} />
        <span>Novo</span>
      </Button>
    </div>
  )

  const selectedClient = clients.find(c => c.id === selectedClientId)
  const isTempClient = selectedClient?.email?.startsWith('temp_') && selectedClient?.email?.endsWith('@cerrado.internal')

  return (
    <div className="space-y-6 lg:space-y-8 animate-page-enter">
      <PageHeader
        title="Consultoria de Investimentos"
        subtitle="Gestão patrimonial institucional e Metodologia do Cerrado"
        action={headerAction}
      />

      {isTempClient && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-page-enter">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
            <span>Este é um cliente provisório sem e-mail real cadastrado. Você pode vincular esta carteira patrimonial a um e-mail de acesso cadastrado a qualquer momento.</span>
          </div>
          <Button
            size="sm"
            onClick={() => setIsLinkModalOpen(true)}
            variant="outline"
            className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 font-bold text-xs self-start sm:self-center py-1 px-3 shrink-0"
          >
            Vincular Conta Real
          </Button>
        </div>
      )}

      {loadingPortfolio ? (
        <Loader text="Compilando matemática da carteira..." className="py-20" />
      ) : portfolio ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Coluna da Esquerda: Resumo e Simulador */}
          <div className="lg:col-span-2 space-y-6 lg:space-y-8">
            {/* Cards de KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-emerald-500 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Patrimônio Líquido</span>
                  <strong className="text-xl font-black text-primary mt-1 block">
                    R$ {portfolioValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-lg">
                  <Wallet size={20} />
                </div>
              </Card>

              <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-sky-500 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Saldo em Caixa</span>
                  <strong className="text-xl font-black text-primary mt-1 block">
                    R$ {Number(portfolio.cash_balance).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div className="p-2.5 bg-sky-500/10 text-sky-500 rounded-lg">
                  <DollarSign size={20} />
                </div>
              </Card>

              <Card className="p-4.5 bg-gradient-to-br from-card to-background border-l-4 border-l-purple-500 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-semibold text-secondary uppercase tracking-wider block">Valor da Cota (Rentabilidade)</span>
                  <strong className="text-xl font-black text-primary mt-1 block">
                    R$ {shareValue.toFixed(4)}
                    <span className="text-xs text-emerald-500 font-bold ml-1.5">
                      +{((shareValue - 1) * 100).toFixed(2)}%
                    </span>
                  </strong>
                </div>
                <div className="p-2.5 bg-purple-500/10 text-purple-500 rounded-lg">
                  <TrendingUp size={20} />
                </div>
              </Card>
            </div>

            {/* Simulador de Aportes Cerrado */}
            <ContributionSimulator
              portfolio={portfolio}
              positions={positions}
              onContributionExecuted={() => loadPortfolioData(selectedClientId)}
            />

            {/* Tabela de Posições Atuais do Cliente */}
            <Card className="p-5 lg:p-6" style={{ isolation: 'isolate' }}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4.5">
                <h3 className="font-bold text-base text-primary">Composição Atual e Alvos</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const nextShow = !showTargetForm
                      setShowTargetForm(nextShow)
                      setShowGroupTargetForm(false)
                      if (nextShow) {
                        const registered = Array.from(new Set([
                          ...transactions.map(t => t.ticker.toUpperCase()),
                          ...targetAllocations.map(t => t.ticker.toUpperCase())
                        ]))
                        setIsCustomTicker(registered.length === 0)
                      }
                    }}
                    className="flex items-center gap-1 text-xs"
                  >
                    <Percent size={14} />
                    Ajustar Metas ({sumTargetPercentages}%)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setShowGroupTargetForm(!showGroupTargetForm)
                      setShowTargetForm(false)
                    }}
                    className="flex items-center gap-1 text-xs border-purple-500/20 text-purple-600 hover:bg-purple-500/10 dark:hover:text-purple-300"
                  >
                    <Layers size={14} className="text-purple-500" />
                    Limites de Exposição
                  </Button>
                </div>
              </div>

              {showGroupTargetForm && (
                <form onSubmit={handleSaveGroupTarget} className="p-4 bg-muted/20 border border-border/40 rounded-xl mb-4.5 space-y-4 animate-page-enter">
                  <div className="flex flex-wrap md:flex-nowrap gap-3 items-end text-left">
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
                          className="text-sm font-semibold"
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
                        className="text-sm font-semibold"
                      />
                    </div>

                    <Button type="submit" disabled={savingGroupTarget} variant="primary" className="text-xs h-[42px] shrink-0">
                      Salvar Limite
                    </Button>
                  </div>

                  {/* Listagem de Limites já Cadastrados */}
                  {groupTargets.length > 0 && (
                    <div className="pt-3 border-t border-primary/20 space-y-2 text-left">
                      <p className="text-[10px] uppercase font-extrabold text-secondary tracking-wider">Limites Ativos:</p>
                      <div className="flex flex-wrap gap-2">
                        {groupTargets.map(gt => (
                          <span key={gt.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary border border-primary rounded-lg text-xs font-semibold text-primary">
                            <span className="text-secondary uppercase text-[9px] font-extrabold">
                              {gt.group_type === 'class' ? 'Classe' : 'Setor'}:
                            </span>
                            {gt.group_name} ({gt.target_percentage}%)
                            <button
                              type="button"
                              onClick={() => handleDeleteGroupTarget(gt.id)}
                              className="text-secondary hover:text-red-500 transition-colors ml-1 font-bold"
                              title="Remover limite"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              )}

              {showTargetForm && (() => {
                const registeredTickers = Array.from(new Set([
                  ...transactions.map(t => t.ticker.toUpperCase()),
                  ...targetAllocations.map(t => t.ticker.toUpperCase())
                ])).sort()

                return (
                  <form onSubmit={handleSaveTarget} className="p-4 bg-muted/20 border border-border/40 rounded-xl mb-4.5 space-y-3 animate-page-enter">
                    {/* Linha 1: Seletor de ticker + digitação livre */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="text-left">
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
                        <div className="relative text-left animate-page-enter">
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
                            <div className="absolute z-50 w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto" style={{ top: '100%' }}>
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
                    </div>

                    {/* Linha 2: % Alvo, Classe, Setor */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="text-left">
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
                      <div className="text-left">
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
                      <div className="text-left">
                        <Input
                          label="Setor (Opcional)"
                          type="text"
                          placeholder="Ex: Energia"
                          value={targetSector}
                          onChange={e => setTargetSector(e.target.value)}
                          className="text-sm font-semibold"
                        />
                      </div>
                    </div>

                    {/* Linha 3: Botão submit */}
                    <div className="flex justify-end pt-1">
                      <Button type="submit" disabled={savingTarget} variant="primary" className="text-xs h-[42px] px-6 font-extrabold shadow-sm">
                        Salvar Meta
                      </Button>
                    </div>
                  </form>
                )
              })()}

              {positions.length === 0 ? (
                <p className="text-center py-6 text-sm text-secondary">Nenhum ativo em carteira. Cadastre metas ou compras para começar.</p>
              ) : (
                <div className="overflow-x-auto border border-border/30 rounded-xl bg-background/30">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border/30 bg-muted/20">
                        <th className="p-3 font-semibold text-secondary">Ativo</th>
                        <th className="p-3 font-semibold text-secondary text-right">Qtd</th>
                        <th className="p-3 font-semibold text-secondary text-right">Custo Médio</th>
                        <th className="p-3 font-semibold text-secondary text-right">Cotação</th>
                        <th className="p-3 font-semibold text-secondary text-right">Total Atual</th>
                        <th className="p-3 font-semibold text-secondary text-center">Peso Real</th>
                        <th className="p-3 font-semibold text-secondary text-center">Meta Alvo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/20">
                      {(() => {
                        const positionsByClass: Record<string, AssetPosition[]> = {}
                        positions.forEach(pos => {
                          const cls = pos.asset_class || 'Renda Fixa'
                          if (!positionsByClass[cls]) positionsByClass[cls] = []
                          positionsByClass[cls].push(pos)
                        })
                        return Object.entries(positionsByClass).map(([className, classPositions]) => (
                          <div key={className} style={{ display: 'contents' }}>
                            {/* Linha de cabeçalho do grupo de classe */}
                            <tr className="bg-muted/10 border-l-4 border-l-emerald-500 font-extrabold text-xs tracking-wider">
                              <td colSpan={7} className="p-3 text-secondary uppercase font-extrabold">
                                {className}
                              </td>
                            </tr>
                            {classPositions.map(pos => (
                              <tr key={pos.ticker} className="hover:bg-muted/10 transition-colors">
                                <td className="p-3 pl-6 font-bold text-primary flex items-center gap-1.5 flex-wrap">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {pos.ticker}
                                  <span className="text-[10px] text-secondary font-normal">({pos.sector || 'Outros'})</span>
                                  <button
                                    onClick={() => {
                                      setEditingAssetTicker(pos.ticker)
                                      setEditingAssetClass(pos.asset_class || 'Renda Fixa')
                                      setEditingAssetSector(pos.sector || 'Outros')
                                      setIsEditAssetModalOpen(true)
                                    }}
                                    className="text-secondary hover:text-emerald-500 transition-colors p-0.5 ml-1"
                                    title="Editar classificação"
                                  >
                                    <Edit size={11} />
                                  </button>
                                  {assetTheses[pos.ticker] && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 ml-1" title="Tese cadastrada" />
                                  )}
                                </td>
                                <td className="p-3 text-right font-medium text-secondary">{pos.quantity.toLocaleString('pt-BR')}</td>
                                <td className="p-3 text-right text-secondary">R$ {pos.average_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right text-secondary font-semibold">R$ {pos.current_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-3 text-right font-bold text-primary">R$ {pos.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 bg-muted rounded text-xs font-semibold text-secondary">{pos.current_percentage}%</span>
                                </td>
                                <td className="p-3 text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded text-xs font-bold">{pos.target_percentage}%</span>
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
              )}
            </Card>
          </div>

          {/* Coluna da Direita: Transações e Ações Administrativas */}
          <div className="space-y-6 lg:space-y-8">
            {/* Card de Faturamento e Relatório */}
            <Card className="p-5 lg:p-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <h3 className="font-bold text-base text-primary flex items-center gap-2 mb-3">
                <FileText size={18} className="text-emerald-500" />
                Faturamento & Relatórios
              </h3>
              
              <div className="p-4 bg-muted/20 rounded-xl border border-border/40 mb-5">
                <div className="flex items-center justify-between text-xs text-secondary uppercase tracking-wider mb-1">
                  <span>Taxa de Gestão Mensal (0,1%)</span>
                  <span>Fee-Based</span>
                </div>
                <strong className="text-2xl font-black text-primary block">
                  R$ {(portfolioValue * 0.001).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </strong>
                <span className="text-[10px] text-emerald-500 font-medium block mt-1">
                  1,2% ao ano sobre o patrimônio sob gestão
                </span>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={handleExportPDF}
                  variant="primary"
                  fullWidth
                  className="font-extrabold shadow-md flex items-center justify-center gap-2 py-2.5"
                >
                  <FileText size={16} />
                  Exportar Relatório PDF
                </Button>
              </div>
            </Card>

            {/* Lançamentos no Livro-Razão */}
            <Card className="p-5 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-primary flex items-center gap-2">
                  <Wallet size={18} className="text-emerald-500" />
                  Livro-Razão (Transações)
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowTxForm(!showTxForm)}
                  className="flex items-center gap-1"
                >
                  <Plus size={12} />
                  Lançar
                </Button>
              </div>

              {showTxForm && (
                <form onSubmit={handleAddTransaction} className="p-3.5 border border-border/40 bg-muted/10 rounded-xl mb-4 space-y-3 animate-page-enter">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="relative flex-1">
                      <Input
                        label="Ticker"
                        type="text"
                        required
                        placeholder="PETR4"
                        value={txTicker}
                        onChange={e => handleTxTickerChange(e.target.value)}
                        onBlur={() => setTimeout(() => setShowTxSuggestions(false), 200)}
                        onFocus={() => txTicker.length >= 2 && setShowTxSuggestions(true)}
                        className="uppercase text-xs"
                      />
                      {showTxSuggestions && txSuggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-primary border border-primary rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto" style={{ top: '100%' }}>
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
                    <Select
                      label="Operação"
                      value={txType}
                      onChange={e => setTxType(e.target.value as any)}
                      options={[
                        { value: 'buy', label: 'Compra' },
                        { value: 'sell', label: 'Venda' },
                        { value: 'dividend', label: 'Provento/Div' },
                        { value: 'split', label: 'Desdobrar' },
                        { value: 'subscription', label: 'Subscrição' }
                      ]}
                      className="flex-1"
                    />
                  </div>

                  {loadingRichData && (
                    <div className="text-[10px] text-secondary animate-pulse pl-1">Carregando dados da B3/Yahoo...</div>
                  )}

                  {txAssetRichData && (
                    <div className="p-2.5 bg-background border border-border/30 rounded-lg text-[10px] space-y-1 text-secondary animate-page-enter mx-1">
                      <div className="flex justify-between items-center">
                        <strong className="text-primary font-bold">{txAssetRichData.name}</strong>
                        <span className="text-emerald-500 font-extrabold">R$ {txAssetRichData.price.toFixed(2)}</span>
                      </div>
                      {txAssetRichData.dividendYield !== undefined && (
                        <div className="flex justify-between items-center text-[9px] opacity-80 pt-0.5 border-t border-primary/5">
                          <span>Dividend Yield Anual (DY):</span>
                          <span className="text-indigo-500 font-bold">{txAssetRichData.dividendYield.toFixed(2)}%</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <Input
                      label="Qtd"
                      type="number"
                      required
                      step="any"
                      placeholder="10"
                      value={txQty}
                      onChange={e => setTxQty(e.target.value)}
                      className="text-xs"
                    />
                    <Input
                      label="Preço Execução"
                      type="number"
                      required
                      step="any"
                      placeholder="35.50"
                      value={txPrice}
                      onChange={e => setTxPrice(e.target.value)}
                      className="text-xs"
                    />
                  </div>

                  <Input
                    label="Data"
                    type="date"
                    required
                    value={txDate}
                    onChange={e => setTxDate(e.target.value)}
                    className="text-xs"
                  />

                  <Button type="submit" disabled={savingTx} variant="primary" fullWidth className="text-xs py-1.5 mt-1.5">
                    {savingTx ? 'Processando Lançamento...' : 'Registrar Lançamento'}
                  </Button>
                </form>
              )}

              {/* Lista recente de transações */}
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {transactions.length === 0 ? (
                  <p className="text-center py-4 text-xs text-secondary">Nenhuma transação registrada no livro-razão.</p>
                ) : (
                  [...transactions].reverse().map(tx => (
                    <div key={tx.id} className="p-2.5 bg-background border border-border/30 rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <strong className="text-primary">{tx.ticker}</strong>
                          <span
                            className={`px-1.5 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider ${
                              tx.operation_type === 'buy' || tx.operation_type === 'subscription'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : tx.operation_type === 'dividend'
                                ? 'bg-indigo-500/10 text-indigo-500'
                                : 'bg-red-500/10 text-red-500'
                            }`}
                          >
                            {tx.operation_type === 'buy' ? 'Compra' : tx.operation_type === 'sell' ? 'Venda' : tx.operation_type === 'dividend' ? 'Provento' : 'Desdobro'}
                          </span>
                        </div>
                        <div className="text-[10px] text-secondary mt-0.5 flex items-center gap-1.5">
                          <span>{tx.quantity.toLocaleString('pt-BR')} un</span>
                          <span>•</span>
                          <span>R$ {tx.price.toLocaleString('pt-BR')}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-secondary font-medium">{tx.date}</span>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-1 text-secondary hover:text-red-500 transition-colors"
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
        </div>

      ) : (
        <Card className="p-10 text-center space-y-3">
          <p className="text-secondary text-sm">Este cliente não possui uma carteira ativa configurada.</p>
          <Button onClick={() => loadPortfolioData(selectedClientId)}>Inicializar Carteira</Button>
        </Card>
      )}

      {/* Card de Análise Qualitativa — Linha Completa (só quando há portfolio ativo) */}
      {portfolio && (
        <Card className="p-5 lg:p-7" style={{ isolation: 'isolate' }}>
          <div className="flex items-center gap-2 mb-6">
            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg">
              <Percent size={18} />
            </div>
            <div>
              <h3 className="font-bold text-base text-primary">Análise Qualitativa &amp; Relatório</h3>
              <p className="text-[11px] text-secondary">Teses por ativo, sumário executivo e planejamento mensal — todos exportados no PDF</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Coluna 1: Teses por Ativo */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">Tese por Ativo</p>
                {editingThesisTicker && (
                  <button
                    type="button"
                    onClick={() => { setEditingThesisTicker(''); setThesisText('') }}
                    className="text-[10px] text-secondary hover:text-primary transition-colors font-semibold"
                  >
                    ✕ Cancelar
                  </button>
                )}
              </div>
              <Select
                value={editingThesisTicker}
                onChange={e => {
                  const val = e.target.value
                  setEditingThesisTicker(val)
                  setThesisText(assetTheses[val.toUpperCase()] || '')
                }}
                options={positions.map(p => ({ value: p.ticker, label: `${p.ticker}${assetTheses[p.ticker] ? ' ✓' : ''}` }))}
                placeholder="Selecione um ativo para editar..."
                className="text-xs w-full"
              />
              {editingThesisTicker && (
                <div className="space-y-2 animate-page-enter">
                  <textarea
                    rows={5}
                    value={thesisText}
                    onChange={e => setThesisText(e.target.value)}
                    placeholder={`Análise qualitativa de ${editingThesisTicker} para o relatório PDF...`}
                    className="w-full p-3 border rounded-xl bg-primary text-primary placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all border-[var(--color-border)] text-xs resize-none"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveThesis}
                      disabled={savingThesis}
                      variant="secondary"
                      className="text-xs font-semibold flex-1"
                    >
                      {savingThesis ? 'Salvando...' : `Salvar Tese de ${editingThesisTicker}`}
                    </Button>
                    {assetTheses[editingThesisTicker.toUpperCase()] && (
                      <Button
                        size="sm"
                        onClick={() => handleDeleteThesis(editingThesisTicker)}
                        variant="outline"
                        className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10 hover:border-red-500/60 shrink-0"
                      >
                        <Trash2 size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Lista de teses já cadastradas */}
              {Object.keys(assetTheses).filter(t => !t.startsWith('__') && assetTheses[t]?.trim()).length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/20">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">Teses Cadastradas</p>
                  {Object.keys(assetTheses)
                    .filter(t => !t.startsWith('__') && assetTheses[t]?.trim())
                    .map(ticker => (
                      <div
                        key={ticker}
                        className={`p-3 rounded-xl border transition-all ${
                          editingThesisTicker === ticker
                            ? 'border-indigo-500/40 bg-indigo-500/5'
                            : 'border-border/30 bg-muted/10 hover:border-indigo-500/20'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                            <span className="text-xs font-extrabold text-primary">{ticker}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingThesisTicker(ticker)
                                setThesisText(assetTheses[ticker] || '')
                              }}
                              className="p-1 text-secondary hover:text-indigo-500 transition-colors rounded"
                              title="Editar tese"
                            >
                              <Edit size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteThesis(ticker)}
                              className="p-1 text-secondary hover:text-red-500 transition-colors rounded"
                              title="Excluir tese"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-secondary line-clamp-2 leading-relaxed">{assetTheses[ticker]}</p>
                      </div>
                    ))
                  }
                </div>
              )}
              {!editingThesisTicker && Object.keys(assetTheses).filter(t => !t.startsWith('__') && assetTheses[t]?.trim()).length === 0 && (
                <p className="text-[11px] text-secondary italic pt-2">Nenhuma tese cadastrada. Selecione um ativo para adicionar.</p>
              )}
            </div>

            {/* Coluna 2: Sumário Executivo */}
            <div className="space-y-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">Sumário Executivo</p>
              <textarea
                rows={10}
                value={executiveSummary}
                onChange={e => setExecutiveSummary(e.target.value)}
                placeholder="Descreva a visão geral da carteira, desempenho do período, principais movimentos e contexto macroeconômico. Aparecerá na capa do relatório PDF..."
                className="w-full p-3 border rounded-xl bg-primary text-primary placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all border-[var(--color-border)] text-xs resize-none"
              />
            </div>

            {/* Coluna 3: Planejamento Próximo Mês */}
            <div className="space-y-3">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-secondary">Planejamento para o Próximo Mês</p>
              <textarea
                rows={10}
                value={nextMonthPlan}
                onChange={e => setNextMonthPlan(e.target.value)}
                placeholder="Descreva os aportes previstos, rebalanceamentos planejados, ativos em observação e estratégia para o próximo ciclo mensal..."
                className="w-full p-3 border rounded-xl bg-primary text-primary placeholder-[var(--color-text-secondary)] hover:border-[var(--color-focus)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:border-transparent transition-all border-[var(--color-border)] text-xs resize-none"
              />
            </div>
          </div>

          {/* Botão salvar sumário e planejamento */}
          <div className="flex justify-end pt-5 mt-2 border-t border-border/20">
            <Button
              onClick={handleSaveReport}
              disabled={savingReport}
              variant="primary"
              className="text-xs font-extrabold px-8 h-[40px] shadow flex items-center gap-2"
            >
              <FileText size={14} />
              {savingReport ? 'Salvando...' : 'Salvar Sumário & Planejamento'}
            </Button>
          </div>
        </Card>
      )}
      <Modal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        title="Cadastrar Novo Cliente"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-secondary mb-4">
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
            />

            <Input
              label="E-mail de Acesso (Opcional)"
              type="email"
              placeholder="cliente@email.com"
              value={newClientEmail}
              onChange={e => setNewClientEmail(e.target.value)}
              helperText="Deixe em branco se deseja criar um perfil provisório e associar a um e-mail posteriormente."
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

      {/* Modal de Vinculação de Conta Real */}
      <Modal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        title="Vincular Carteira a Usuário Real"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-secondary mb-4">
            Selecione uma conta de cliente real cadastrada no aplicativo para transferir a gestão desta carteira patrimonial de forma definitiva. O perfil provisório antigo será removido.
          </p>

          {loadingEligible ? (
            <div className="text-center py-6 text-xs text-secondary">Carregando e-mails disponíveis...</div>
          ) : eligibleClients.length === 0 ? (
            <div className="text-center py-6 space-y-2 animate-page-enter">
              <p className="text-xs text-secondary italic">Nenhuma conta de cliente real sem carteira foi encontrada no banco.</p>
              <p className="text-[10px] text-secondary opacity-60">Para vincular, o cliente precisa primeiro se cadastrar no aplicativo com o e-mail real dele.</p>
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
                options={eligibleClients.map(c => ({ value: c.id, label: c.email }))}
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
                  className="font-bold text-xs px-5 shadow-md"
                >
                  {linking ? 'Vinculando...' : 'Vincular Carteira'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>

      {/* Modal de Edição de Classificação do Ativo */}
      <Modal
        isOpen={isEditAssetModalOpen}
        onClose={() => setIsEditAssetModalOpen(false)}
        title={`Editar Classificação: ${editingAssetTicker}`}
      >
        <form onSubmit={handleSaveAssetClassification} className="space-y-4 text-left">
          <p className="text-xs text-secondary mb-4">
            Altere manualmente a classe e o setor econômico do ativo **{editingAssetTicker}** no banco de dados. Essas configurações serão aplicadas imediatamente a todos os relatórios e carteiras que contêm este ativo.
          </p>

          <div>
            <label className="text-[10px] uppercase font-extrabold text-secondary tracking-wider block mb-1">Classe de Ativo</label>
            <select
              value={editingAssetClass}
              onChange={e => setEditingAssetClass(e.target.value)}
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
    </div>
  )
}
