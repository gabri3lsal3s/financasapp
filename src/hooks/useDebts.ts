import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Debt } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function useDebts() {
  const { isOnline } = useNetworkStatus()
  const [debts, setDebts] = useState<Debt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDebts = async (silent = false) => {
    try {
      const cacheKey = 'debts-all'
      const cached = await getCache<Debt[]>(cacheKey)
      if (cached) {
        setDebts(cached)
      }
      
      if (!silent && debts.length === 0 && !cached) {
        setLoading(true)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('debts')
        .select(`
          *,
          expense:expenses(
            *,
            category:categories(*),
            credit_card:credit_cards(*)
          )
        `)
        .order('due_date', { ascending: true })

      if (fetchError) throw fetchError
      const newData = data || []
      setDebts(newData)
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dívidas e cobranças')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDebts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadDebts(true)
    }
    const onLocalDataChanged = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.entity === 'debts') {
        loadDebts(true)
      }
    }
    window.addEventListener('offline-queue-processed', onQueueProcessed)
    window.addEventListener('local-data-changed', onLocalDataChanged)
    return () => {
      window.removeEventListener('offline-queue-processed', onQueueProcessed)
      window.removeEventListener('local-data-changed', onLocalDataChanged)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- WHY: listeners de sync offline; re-bind só ao montar
  }, [])

  const createDebt = async (payload: Omit<Debt, 'id' | 'created_at'>) => {
    const tempId = `temp-${Date.now()}`
    const tempDebt: Debt = {
      id: tempId,
      created_at: new Date().toISOString(),
      ...payload,
    }
    
    setDebts((previous) => [...previous, tempDebt].sort((a, b) => a.due_date.localeCompare(b.due_date)))

    try {
      const { data, error: insertError } = await supabase
        .from('debts')
        .insert([payload])
        .select()
        .single()

      if (insertError) throw insertError
      
      setDebts((previous) => previous
        .map((debt) => (debt.id === tempId ? data : debt))
        .sort((a, b) => a.due_date.localeCompare(b.due_date)))
      
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'debts',
          action: 'create',
          payload: payload as Record<string, unknown>,
        })
        const offlineDebt: Debt = {
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
        }
        setDebts((previous) => {
          const next = previous
            .map((debt) => (debt.id === tempId ? offlineDebt : debt))
            .sort((a, b) => a.due_date.localeCompare(b.due_date))
          setCache('debts-all', next).catch(console.error)
          return next
        })
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
        return { data: offlineDebt, error: null }
      }
      
      // Rollback on error
      setDebts((previous) => previous.filter((debt) => debt.id !== tempId))
      return { data: null, error: err instanceof Error ? err.message : 'Erro ao criar dívida' }
    }
  }

  const updateDebt = async (id: string, updates: Partial<Debt>) => {
    let previousDebts: Debt[] = []
    setDebts((previous) => {
      previousDebts = previous
      return previous
        .map((debt) => (debt.id === id ? { ...debt, ...updates } : debt))
        .sort((a, b) => a.due_date.localeCompare(b.due_date))
    })

    try {
      const { data, error: updateError } = await supabase
        .from('debts')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      setDebts((previous) => previous
        .map((debt) => (debt.id === id ? { ...debt, ...data } : debt))
        .sort((a, b) => a.due_date.localeCompare(b.due_date)))

      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'debts',
          action: 'update',
          recordId: id,
          payload: updates as Record<string, unknown>,
        })
        setDebts((previous) => {
          setCache('debts-all', previous).catch(console.error)
          return previous
        })
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
        return { data: { id, ...updates } as Debt, error: null }
      }
      
      // Rollback on error
      setDebts(previousDebts)
      return { data: null, error: err instanceof Error ? err.message : 'Erro ao atualizar dívida' }
    }
  }

  const deleteDebt = async (id: string) => {
    let previousDebts: Debt[] = []
    setDebts((previous) => {
      previousDebts = previous
      return previous.filter((debt) => debt.id !== id)
    })

    try {
      const { error: deleteError } = await supabase
        .from('debts')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      const nextDebts = debts.filter((debt) => debt.id !== id)
      await setCache('debts-all', nextDebts)
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'debts',
          action: 'delete',
          recordId: id,
        })
        const nextDebts = debts.filter((debt) => debt.id !== id)
        await setCache('debts-all', nextDebts).catch(console.error)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
        return { error: null }
      }
      
      // Rollback on error
      setDebts(previousDebts)
      return { error: err instanceof Error ? err.message : 'Erro ao excluir dívida' }
    }
  }

  return {
    debts,
    loading,
    error,
    createDebt,
    updateDebt,
    deleteDebt,
    refreshDebts: () => loadDebts(true),
  }
}
