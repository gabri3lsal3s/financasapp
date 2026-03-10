import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExpenseCategoryMonthLimit } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function useExpenseCategoryLimits(month: string) {
  const { isOnline } = useNetworkStatus()
  const [limits, setLimits] = useState<ExpenseCategoryMonthLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLimits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadLimits()
    }
    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => window.removeEventListener('offline-queue-processed', onQueueProcessed)
  }, [month])

  const getCacheKey = () => `expense_category_limits-${month}`

  const loadLimits = async () => {
    try {
      setLoading(true)
      const cacheKey = getCacheKey()
      const cached = await getCache<ExpenseCategoryMonthLimit[]>(cacheKey)
      if (cached) {
        setLimits(cached)
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('expense_category_month_limits')
        .select('*')
        .eq('month', month)

      if (fetchError) throw fetchError

      const newData = data || []
      setLimits(newData)
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar limites de despesas')
    } finally {
      setLoading(false)
    }
  }

  const setCategoryLimit = async (categoryId: string, amount: number | null) => {
    try {
      if (amount === null) {
        const { error: deleteError } = await supabase
          .from('expense_category_month_limits')
          .delete()
          .eq('category_id', categoryId)
          .eq('month', month)

        if (deleteError) throw deleteError

        setLimits((prev) => prev.filter((item) => !(item.category_id === categoryId && item.month === month)))
        return { data: null, error: null }
      }

      const payload = {
        category_id: categoryId,
        month,
        limit_amount: amount,
      }

      const { data, error: upsertError } = await supabase
        .from('expense_category_month_limits')
        .upsert([payload], { onConflict: 'category_id,month' })
        .select()
        .single()

      if (upsertError) throw upsertError

      setLimits((prev) => {
        const filtered = prev.filter((item) => !(item.category_id === categoryId && item.month === month))
        return [...filtered, data]
      })

      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (amount === null) {
          enqueueOfflineOperation({
            entity: 'expense_category_month_limits',
            action: 'delete',
            recordId: `${categoryId}-${month}`,
            payload: { category_id: categoryId, month }, // Pass payload to make custom queue deletion aware
          })
          setLimits((prev) => {
            const next = prev.filter((item) => !(item.category_id === categoryId && item.month === month))
            setCache(getCacheKey(), next).catch(console.error)
            return next
          })
          return { data: null, error: null }
        }

        const payload = {
          category_id: categoryId,
          month,
          limit_amount: amount,
        }

        enqueueOfflineOperation({
          entity: 'expense_category_month_limits',
          action: 'update',
          recordId: `${categoryId}-${month}`,
          payload: payload as Record<string, unknown>,
        })

        const itemData = {
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
        }

        setLimits((prev) => {
          const filtered = prev.filter((item) => !(item.category_id === categoryId && item.month === month))
          const next = [...filtered, itemData as ExpenseCategoryMonthLimit]
          setCache(getCacheKey(), next).catch(console.error)
          return next
        })

        return { data: itemData, error: null }
      }
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar limite da categoria'
      return { data: null, error: errorMessage }
    }
  }

  return {
    limits,
    loading,
    error,
    setCategoryLimit,
    refreshLimits: loadLimits,
  }
}
