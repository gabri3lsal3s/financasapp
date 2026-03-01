import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Investment } from '@/types'
import { format } from 'date-fns'
import { enqueueOfflineOperation, shouldQueueOffline } from '@/utils/offlineQueue'

export function useInvestments(month?: string) {
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadInvestments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  useEffect(() => {
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
  }, [month])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadInvestments()
    }

    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => window.removeEventListener('offline-queue-processed', onQueueProcessed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortInvestmentsByMonth = (list: Investment[]) =>
    [...list].sort((a, b) => {
      const monthDiff = b.month.localeCompare(a.month)
      if (monthDiff !== 0) return monthDiff
      return b.created_at.localeCompare(a.created_at)
    })

  const loadInvestments = async () => {
    try {
      setLoading(true)
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

      if (fetchError) throw fetchError
      setInvestments(sortInvestmentsByMonth(data || []))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar investimentos')
      console.error('Error loading investments:', err)
    } finally {
      setLoading(false)
    }
  }

  const createInvestment = async (investment: Omit<Investment, 'id' | 'created_at'>) => {
    try {
      const investmentData = {
        ...investment,
        month: investment.month || format(new Date(), 'yyyy-MM'),
      }

      const { data, error: insertError } = await supabase
        .from('investments')
        .insert([investmentData])
        .select()
        .single()

      if (insertError) throw insertError
      
      setInvestments((prev) => sortInvestmentsByMonth([data, ...prev]))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'investments',
          action: 'create',
          payload: {
            amount: investment.amount,
            month: investment.month || format(new Date(), 'yyyy-MM'),
            ...(investment.description && { description: investment.description }),
          },
        })

        const offlineInvestment: Investment = {
          id: `offline-${Date.now()}`,
          amount: investment.amount,
          month: investment.month || format(new Date(), 'yyyy-MM'),
          ...(investment.description && { description: investment.description }),
          created_at: new Date().toISOString(),
        }

        setInvestments((prev) => sortInvestmentsByMonth([offlineInvestment, ...prev]))
        return { data: offlineInvestment, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar investimento'
      return { data: null, error: errorMessage }
    }
  }

  const updateInvestment = async (id: string, updates: Partial<Investment>) => {
    try {
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
        enqueueOfflineOperation({
          entity: 'investments',
          action: 'update',
          recordId: id,
          payload: updates as Record<string, unknown>,
        })

        setInvestments((prev) => sortInvestmentsByMonth(prev.map((inv) => (inv.id === id ? { ...inv, ...updates } : inv))))
        return { data: { id, ...updates }, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar investimento'
      return { data: null, error: errorMessage }
    }
  }

  const deleteInvestment = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('investments')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      
      setInvestments((prev) => prev.filter((inv) => inv.id !== id))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'investments',
          action: 'delete',
          recordId: id,
        })

        setInvestments((prev) => prev.filter((inv) => inv.id !== id))
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

