import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Investment } from '@/types'
import { format } from 'date-fns'
import { enqueueOfflineOperation, shouldQueueOffline, updateOfflineCreatePayload, removeOfflineCreateOperation } from '@/utils/offlineQueue'
import { getCache, setCache } from '@/services/offlineCache'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { applyCashOffsetAfterBuy, fetchPortfolioCashContext } from '@/services/cashOffsetService'
import { resolvePricingMode } from '@/utils/cashBalanceApplication'

export type CreateInvestmentInput = Omit<Investment, 'id' | 'created_at'> & {
  /** Data real da operação (yyyy-MM-dd); usada no livro-razão de ativos. */
  operation_date?: string
}

export function useInvestments(month?: string) {
  const { isOnline } = useNetworkStatus()
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prevMonth, setPrevMonth] = useState(month)
  const currentMonthRef = useRef(month)
  currentMonthRef.current = month

  if (month !== prevMonth) {
    setPrevMonth(month)
    setInvestments([])
    setLoading(true)
  }

  useEffect(() => {
    loadInvestments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    if (!isOnline) return

    const realtimeChannel = supabase
      .channel(`investments-realtime-${month || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investments' },
        () => {
          loadInvestments()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(realtimeChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadInvestments()
    }

    const onLocalDataChanged = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.entity === 'investments') {
        loadInvestments()
      }
    }

    window.addEventListener('offline-queue-processed', onQueueProcessed)
    window.addEventListener('local-data-changed', onLocalDataChanged)
    return () => {
      window.removeEventListener('offline-queue-processed', onQueueProcessed)
      window.removeEventListener('local-data-changed', onLocalDataChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortInvestmentsByMonth = (list: Investment[]) =>
    [...list].sort((a, b) => {
      const monthDiff = b.month.localeCompare(a.month)
      if (monthDiff !== 0) return monthDiff
      return b.created_at.localeCompare(a.created_at)
    })

  const getCacheKey = () => `investments-${month || 'all'}`

  const loadInvestments = async () => {
    try {
      setLoading(true)
      const cacheKey = getCacheKey()
      const cached = await getCache<Investment[]>(cacheKey)

      if (currentMonthRef.current !== month) return

      if (cached) {
        setInvestments(sortInvestmentsByMonth(cached))
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      let query = supabase
        .from('investments')
        .select('*')
        .order('month', { ascending: false })

      if (month) {
        // month pode ser 'yyyy-MM' ou 'yyyy-MM-dd', normalizar para 'yyyy-MM'
        const monthStr = month.length === 7 ? month : month.substring(0, 7)
        query = query.eq('month', monthStr)
      }

      const { data, error: fetchError } = await query

      if (currentMonthRef.current !== month) return

      if (fetchError) throw fetchError
      const newData = data || []
      setInvestments(sortInvestmentsByMonth(newData))
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar investimentos')
      console.error('Error loading investments:', err)
    } finally {
      setLoading(false)
    }
  }

  const createInvestment = async (investment: CreateInvestmentInput) => {
    try {
      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      const month = investment.month || format(new Date(), 'yyyy-MM')
      const operationDate =
        investment.operation_date ||
        (month.length === 7 ? `${month}-01` : month)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Usuário não autenticado')
      }

      if (!investment.ticker) {
        return {
          data: null,
          error: 'Aportes em caixa livre não são mais permitidos. Registre uma transação na carteira.',
        }
      }

      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle()

      if (!portfolio) {
        throw new Error('Carteira não encontrada. Abra a página de investimentos para inicializar.')
      }

      const tickerUpper = investment.ticker.toUpperCase().trim()
      const qty = Number(investment.quantity)
      const price = Number(investment.price)

      const { data: inserted, error: txError } = await supabase
        .from('portfolio_transactions')
        .insert({
          portfolio_id: portfolio.id,
          ticker: tickerUpper,
          operation_type: 'buy',
          quantity: qty,
          price,
          date: operationDate,
        })
        .select('id')
        .single()

      if (txError) throw txError

      const { transactions, definitions } = await fetchPortfolioCashContext(portfolio.id)
      const assetPricingMode = resolvePricingMode(tickerUpper, definitions)

      await applyCashOffsetAfterBuy({
        portfolioId: portfolio.id,
        sourceTransactionId: inserted.id,
        buyAmount: qty * price,
        buyDate: operationDate,
        assetPricingMode,
        operationType: 'buy',
        transactions,
        definitions,
      })

      window.dispatchEvent(
        new CustomEvent('local-data-changed', { detail: { entity: 'portfolio_transactions' } })
      )
      return { data: null, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        const uiId = `offline-${Date.now()}`
        enqueueOfflineOperation({
          entity: 'investments',
          action: 'create',
          payload: {
            amount: investment.amount,
            month: investment.month || format(new Date(), 'yyyy-MM'),
            ...(investment.description && { description: investment.description }),
            _uiId: uiId,
          },
        })

        const offlineInvestment: Investment = {
          id: uiId,
          amount: investment.amount,
          month: investment.month || format(new Date(), 'yyyy-MM'),
          ...(investment.description && { description: investment.description }),
          created_at: new Date().toISOString(),
        }

        const nextState = sortInvestmentsByMonth([offlineInvestment, ...investments])
        setInvestments(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'investments' } }))
        return { data: offlineInvestment, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar investimento'
      return { data: null, error: errorMessage }
    }
  }

  const updateInvestment = async (id: string, updates: Partial<Investment>) => {
    try {
      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      if (id.startsWith('offline-')) {
        throw new Error('Offline ID (bypass supabase)')
      }

      // 1. Busca os dados antigos para calcular o estorno e obter o transaction_id
      const { data: oldInv, error: fetchOldError } = await supabase
        .from('investments')
        .select('amount, ticker, quantity, price, transaction_id, month')
        .eq('id', id)
        .maybeSingle()

      if (fetchOldError) throw fetchOldError
      if (!oldInv) throw new Error('Investimento não encontrado')

      // 2. Se houver transação vinculada, atualiza a transação também
      if (oldInv.transaction_id) {
        const nextTicker = (updates.ticker !== undefined ? updates.ticker : oldInv.ticker || '').toUpperCase().trim()
        const nextQty = updates.quantity !== undefined ? updates.quantity : oldInv.quantity
        const nextPrice = updates.price !== undefined ? updates.price : oldInv.price
        const nextMonth = updates.month !== undefined ? updates.month : oldInv.month
        const nextDate = nextMonth ? `${nextMonth}-01` : format(new Date(), 'yyyy-MM-dd')

        const { error: txUpdateError } = await supabase
          .from('portfolio_transactions')
          .update({
            ticker: nextTicker,
            quantity: Number(nextQty),
            price: Number(nextPrice),
            date: nextDate
          })
          .eq('id', oldInv.transaction_id)

        if (txUpdateError) throw txUpdateError
      }

      // 3. Atualiza o investimento no banco
      const { data, error: updateError } = await supabase
        .from('investments')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      setInvestments((prev) => sortInvestmentsByMonth(prev.map((inv) => (inv.id === id ? data : inv))))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (id.startsWith('offline-')) {
          updateOfflineCreatePayload(id, updates as Record<string, unknown>)
        } else {
          enqueueOfflineOperation({
            entity: 'investments',
            action: 'update',
            recordId: id,
            payload: updates as Record<string, unknown>,
          })
        }

        const nextState = sortInvestmentsByMonth(investments.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv)))
        setInvestments(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'investments' } }))
        return { data: { id, ...updates }, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar investimento'
      return { data: null, error: errorMessage }
    }
  }

  const deleteInvestment = async (id: string) => {
    try {
      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      if (id.startsWith('offline-')) {
        throw new Error('Offline ID (bypass supabase)')
      }

      // 1. Busca os dados do investimento antes de deletar
      const { data: oldInv, error: fetchOldError } = await supabase
        .from('investments')
        .select('amount, ticker, quantity, price, transaction_id')
        .eq('id', id)
        .maybeSingle()

      if (fetchOldError) throw fetchOldError
      if (!oldInv) throw new Error('Investimento não encontrado')

      // 2. Se houver transação vinculada, deleta primeiro
      if (oldInv.transaction_id) {
        const { error: txDelError } = await supabase
          .from('portfolio_transactions')
          .delete()
          .eq('id', oldInv.transaction_id)

        if (txDelError) {
          console.warn('Erro ao deletar transação vinculada ao excluir investimento:', txDelError)
        }
      }

      // 3. Deleta o investimento
      const { error: deleteError } = await supabase
        .from('investments')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setInvestments((prev) => prev.filter((inv) => inv.id !== id))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (id.startsWith('offline-')) {
          removeOfflineCreateOperation(id)
        } else {
          enqueueOfflineOperation({
            entity: 'investments',
            action: 'delete',
            recordId: id,
          })
        }

        const nextState = investments.filter((inv) => inv.id !== id)
        setInvestments(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'investments' } }))
        return { error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar investimento'
      return { error: errorMessage }
    }
  }

  return {
    investments,
    loading,
    error,
    createInvestment,
    updateInvestment,
    deleteInvestment,
    refreshInvestments: loadInvestments,
  }
}

