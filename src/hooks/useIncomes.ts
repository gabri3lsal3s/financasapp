import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Income } from '@/types'
import { format } from 'date-fns'
import { enqueueOfflineOperation, shouldQueueOffline, updateOfflineCreatePayload, removeOfflineCreateOperation } from '@/utils/offlineQueue'
import { getCache, setCache } from '@/services/offlineCache'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { APP_START_DATE } from '@/utils/format'


export function useIncomes(month?: string) {
  const { isOnline } = useNetworkStatus()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prevMonth, setPrevMonth] = useState(month)
  const currentMonthRef = useRef(month)
  currentMonthRef.current = month

  if (month !== prevMonth) {
    setPrevMonth(month)
    setIncomes([])
    setLoading(true)
  }

  useEffect(() => {
    loadIncomes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    if (!isOnline) return

    const realtimeChannel = supabase
      .channel(`incomes-realtime-${month || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incomes' },
        () => {
          loadIncomes()
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
      loadIncomes()
    }

    const onLocalDataChanged = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.entity === 'incomes') {
        loadIncomes()
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

  const sortIncomesByDate = (list: Income[]) =>
    [...list].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date)
      if (dateDiff !== 0) return dateDiff
      return b.created_at.localeCompare(a.created_at)
    })

  const getCacheKey = () => `incomes-${month || 'all'}`

  const loadIncomes = async () => {
    try {
      setLoading(true)

      const cacheKey = getCacheKey()
      const cached = await getCache<Income[]>(cacheKey)

      if (currentMonthRef.current !== month) return

      if (cached) {
        setIncomes(sortIncomesByDate(cached))
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      let query = supabase
        .from('incomes')
        .select('*, income_category:income_categories(*)')
        .order('date', { ascending: false })

      if (month) {
        // month pode ser 'yyyy-MM' ou 'yyyy-MM-dd', normalizar para 'yyyy-MM'
        const monthStr = month.length === 7 ? month : month.substring(0, 7)
        const [year, monthNum] = monthStr.split('-').map(Number)

        // Criar datas no timezone local para evitar problemas de UTC
        const startDate = new Date(year, monthNum - 1, 1) // monthNum - 1 porque Date usa 0-11
        const endDate = new Date(year, monthNum, 0) // dia 0 do próximo mês = último dia do mês atual

        query = query
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      }

      const { data, error: fetchError } = await query

      if (currentMonthRef.current !== month) return

      if (fetchError) throw fetchError
      const newData = data || []
      setIncomes(sortIncomesByDate(newData))
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar rendas')
      console.error('Error loading incomes:', err)
    } finally {
      setLoading(false)
    }
  }

  const createIncome = async (income: Omit<Income, 'id' | 'created_at' | 'type'>) => {
    try {
      // Validar campos obrigatórios
      if (!income.income_category_id || !income.amount) {
        throw new Error('Categoria e valor são obrigatórios')
      }

      if (income.date && income.date < APP_START_DATE) {
        throw new Error(`O app inicia em 01/01/2026. Lançamentos anteriores não são permitidos.`)
      }


      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      const incomeData = {
        amount: income.amount,
        date: income.date || format(new Date(), 'yyyy-MM-dd'),
        type: 'other',
        income_category_id: income.income_category_id,
        ...(income.report_weight !== undefined && { report_weight: income.report_weight }),
        ...(income.description && { description: income.description }),
      }

      const { data, error: insertError } = await supabase
        .from('incomes')
        .insert([incomeData])
        .select('*, income_category:income_categories(*)')
        .single()

      if (insertError) throw insertError

      setIncomes((prev) => sortIncomesByDate([data, ...prev]))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        const uiId = `offline-${Date.now()}`
        enqueueOfflineOperation({
          entity: 'incomes',
          action: 'create',
          payload: {
            amount: income.amount,
            date: income.date || format(new Date(), 'yyyy-MM-dd'),
            type: 'other',
            income_category_id: income.income_category_id,
            ...(income.report_weight !== undefined && { report_weight: income.report_weight }),
            ...(income.description && { description: income.description }),
            _uiId: uiId,
          },
        })

        let currentIncomeCategories: any[] = []
        try {
          currentIncomeCategories = await getCache<any[]>('income_categories-all') || []
        } catch (e) {
          console.error('Error loading categories from cache during offline create:', e)
        }
        const matchedCategory = currentIncomeCategories.find(c => c.id === income.income_category_id)

        const offlineIncome: Income = {
          id: uiId,
          amount: income.amount,
          date: income.date || format(new Date(), 'yyyy-MM-dd'),
          type: 'other',
          income_category_id: income.income_category_id,
          ...(income.report_weight !== undefined && { report_weight: income.report_weight }),
          ...(income.description && { description: income.description }),
          created_at: new Date().toISOString(),
          income_category: matchedCategory ? {
            id: matchedCategory.id,
            name: matchedCategory.name,
            color: matchedCategory.color || '#9ca3af',
          } : undefined,
        } as Income

        const nextState = sortIncomesByDate([offlineIncome, ...incomes])
        setIncomes(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'incomes' } }))
        return { data: offlineIncome, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar renda'
      return { data: null, error: errorMessage }
    }
  }

  const updateIncome = async (id: string, updates: Partial<Income>) => {
    try {
      if (updates.date && updates.date < APP_START_DATE) {
        throw new Error(`O app inicia em 01/01/2026. Alterações para datas anteriores não são permitidas.`)
      }

      if (!isOnline) {

        throw new Error('Offline ID (bypass supabase)')
      }

      const { data, error: updateError } = await supabase
        .from('incomes')
        .update(updates)
        .eq('id', id)
        .select('*, income_category:income_categories(*)')
        .single()

      if (updateError) throw updateError

      setIncomes((prev) => sortIncomesByDate(prev.map((inc) => (inc.id === id ? data : inc))))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (id.startsWith('offline-')) {
          updateOfflineCreatePayload(id, updates as Record<string, unknown>)
        } else {
          enqueueOfflineOperation({
            entity: 'incomes',
            action: 'update',
            recordId: id,
            payload: updates as Record<string, unknown>,
          })
        }

        const nextState = sortIncomesByDate(incomes.map((inc) => (inc.id === id ? { ...inc, ...updates } : inc)))
        setIncomes(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'incomes' } }))
        return { data: { id, ...updates }, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar renda'
      return { data: null, error: errorMessage }
    }
  }

  const deleteIncome = async (id: string) => {
    try {
      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      if (id.startsWith('offline-')) {
        throw new Error('Offline ID (bypass supabase)')
      }

      const { error: deleteError } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setIncomes((prev) => prev.filter((inc) => inc.id !== id))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (id.startsWith('offline-')) {
          removeOfflineCreateOperation(id)
        } else {
          enqueueOfflineOperation({
            entity: 'incomes',
            action: 'delete',
            recordId: id,
          })
        }

        const nextState = incomes.filter((inc) => inc.id !== id)
        setIncomes(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'incomes' } }))
        return { error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar renda'
      return { error: errorMessage }
    }
  }

  return {
    incomes,
    loading,
    error,
    createIncome,
    updateIncome,
    deleteIncome,
    refreshIncomes: loadIncomes,
  }
}

