import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { CreditCard } from '@/types'

export function useCreditCards() {
  const [creditCards, setCreditCards] = useState<CreditCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadCreditCards = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('credit_cards')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setCreditCards(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cartões de crédito')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCreditCards()
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
