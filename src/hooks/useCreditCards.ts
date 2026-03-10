import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CreditCard } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function useCreditCards() {
  const { isOnline } = useNetworkStatus()
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCreditCards = async () => {
    try {
      setLoading(true)
      const cacheKey = 'credit_cards-all'
      const cached = await getCache<CreditCard[]>(cacheKey)
      if (cached) {
        setCreditCards(cached)
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('credit_cards')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      const newData = data || []
      setCreditCards(newData)
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cartões de crédito')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCreditCards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadCreditCards()
    }
    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => window.removeEventListener('offline-queue-processed', onQueueProcessed)
  }, [])

  const createCreditCard = async (payload: Omit<CreditCard, 'id' | 'created_at'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('credit_cards')
        .insert([payload])
        .select()
        .single()

      if (insertError) throw insertError
      setCreditCards((previous) => [...previous, data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'credit_cards',
          action: 'create',
          payload: payload as Record<string, unknown>,
        })
        const offlineCard: CreditCard = {
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...payload,
        }
        setCreditCards((previous) => {
          const next = [...previous, offlineCard].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          setCache('credit_cards-all', next).catch(console.error)
          return next
        })
        return { data: offlineCard, error: null }
      }
      return { data: null, error: err instanceof Error ? err.message : 'Erro ao criar cartão de crédito' }
    }
  }

  const updateCreditCard = async (id: string, updates: Partial<CreditCard>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('credit_cards')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      setCreditCards((previous) => previous
        .map((card) => (card.id === id ? data : card))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))

      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'credit_cards',
          action: 'update',
          recordId: id,
          payload: updates as Record<string, unknown>,
        })
        setCreditCards((previous) => {
          const next = previous
            .map((card) => (card.id === id ? { ...card, ...updates } : card))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          setCache('credit_cards-all', next).catch(console.error)
          return next
        })
        return { data: { id, ...updates } as CreditCard, error: null }
      }
      return { data: null, error: err instanceof Error ? err.message : 'Erro ao atualizar cartão de crédito' }
    }
  }

  const deactivateCreditCard = async (id: string) => {
    return updateCreditCard(id, { is_active: false })
  }

  return {
    creditCards,
    loading,
    error,
    createCreditCard,
    updateCreditCard,
    deactivateCreditCard,
    refreshCreditCards: loadCreditCards,
  }
}
