import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { IncomeCategoryMonthExpectation } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAuth } from '@/contexts/AuthContext'

const EXPECTATION_SELECT =
  'id, income_category_id, month, expectation_amount, user_id, created_at'

export function useIncomeCategoryExpectations(month: string) {
  const { user } = useAuth()
  const { isOnline } = useNetworkStatus()
  const [expectations, setExpectations] = useState<IncomeCategoryMonthExpectation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExpectations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadExpectations()
    }
    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => window.removeEventListener('offline-queue-processed', onQueueProcessed)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WHY: listener de sync offline; month já está nas deps
  }, [month])

  const getCacheKey = () => `income_category_expectations-${month}`

  const loadExpectations = async () => {
    try {
      setLoading(true)
      const cacheKey = getCacheKey()
      const cached = await getCache<IncomeCategoryMonthExpectation[]>(cacheKey)
      if (cached) {
        setExpectations(cached)
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('income_category_month_expectations')
        .select(EXPECTATION_SELECT)
        .eq('month', month)

      if (fetchError) throw fetchError

      const newData = data || []
      setExpectations(newData)
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar expectativas de renda')
    } finally {
      setLoading(false)
    }
  }

  const setIncomeCategoryExpectation = async (incomeCategoryId: string, amount: number | null) => {
    try {
      if (amount === null) {
        const { error: deleteError } = await supabase
          .from('income_category_month_expectations')
          .delete()
          .eq('income_category_id', incomeCategoryId)
          .eq('month', month)

        if (deleteError) throw deleteError

        setExpectations((prev) => {
          const next = prev.filter(
            (item) => !(item.income_category_id === incomeCategoryId && item.month === month),
          )
          setCache(getCacheKey(), next).catch(() => undefined)
          return next
        })
        window.dispatchEvent(new Event('local-data-changed'))
        return { data: null, error: null }
      }

      const payload = {
        income_category_id: incomeCategoryId,
        month,
        expectation_amount: amount,
        user_id: user?.id,
      }

      const { data, error: upsertError } = await supabase
        .from('income_category_month_expectations')
        .upsert([payload], { onConflict: 'income_category_id,month' })
        .select(EXPECTATION_SELECT)
        .single()

      if (upsertError) throw upsertError

      setExpectations((prev) => {
        const filtered = prev.filter(
          (item) => !(item.income_category_id === incomeCategoryId && item.month === month),
        )
        const next = [...filtered, data]
        setCache(getCacheKey(), next).catch(() => undefined)
        return next
      })
      window.dispatchEvent(new Event('local-data-changed'))

      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (amount === null) {
          enqueueOfflineOperation({
            entity: 'income_category_month_expectations',
            action: 'delete',
            recordId: `${incomeCategoryId}-${month}`,
            payload: { income_category_id: incomeCategoryId, month },
          })
          setExpectations((prev) => {
            const next = prev.filter(
              (item) => !(item.income_category_id === incomeCategoryId && item.month === month),
            )
            setCache(getCacheKey(), next).catch(() => undefined)
            return next
          })
          window.dispatchEvent(new Event('local-data-changed'))
          return { data: null, error: null }
        }

        const payload = {
          income_category_id: incomeCategoryId,
          month,
          expectation_amount: amount,
          user_id: user?.id,
        }

        enqueueOfflineOperation({
          entity: 'income_category_month_expectations',
          action: 'update',
          recordId: `${incomeCategoryId}-${month}`,
          payload: payload as Record<string, unknown>,
        })

        const itemData: IncomeCategoryMonthExpectation = {
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
        }

        setExpectations((prev) => {
          const filtered = prev.filter(
            (item) => !(item.income_category_id === incomeCategoryId && item.month === month),
          )
          const next = [...filtered, itemData]
          setCache(getCacheKey(), next).catch(() => undefined)
          return next
        })
        window.dispatchEvent(new Event('local-data-changed'))

        return { data: itemData, error: null }
      }

      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao salvar expectativa da categoria de renda'
      return { data: null, error: errorMessage }
    }
  }

  return {
    expectations,
    loading,
    error,
    setIncomeCategoryExpectation,
    refreshExpectations: loadExpectations,
  }
}
