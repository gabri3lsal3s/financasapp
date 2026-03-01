import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { format } from 'date-fns'
import { enqueueOfflineOperation, shouldQueueOffline } from '@/utils/offlineQueue'

export function useExpenses(month?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  useEffect(() => {
    const realtimeChannel = supabase
      .channel(`expenses-realtime-${month || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          loadExpenses()
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
      loadExpenses()
    }

    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => window.removeEventListener('offline-queue-processed', onQueueProcessed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortExpensesByDate = (list: Expense[]) =>
    [...list].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date)
      if (dateDiff !== 0) return dateDiff
      return b.created_at.localeCompare(a.created_at)
    })

  const loadExpenses = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*)
        `)
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

      if (fetchError) throw fetchError
      setExpenses(sortExpensesByDate(data || []))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar despesas')
      console.error('Error loading expenses:', err)
    } finally {
      setLoading(false)
    }
  }

  const createExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'category'>) => {
    try {
      // Validar campos obrigatórios
      if (!expense.category_id || !expense.amount) {
        throw new Error('Categoria e valor são obrigatórios')
      }

      const expenseData = {
        amount: expense.amount,
        date: expense.date || format(new Date(), 'yyyy-MM-dd'),
        category_id: expense.category_id,
        ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
        ...(expense.description && { description: expense.description }),
      }

      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert([expenseData])
        .select(`
          *,
          category:categories(*)
        `)
        .single()

      if (insertError) throw insertError
      
      setExpenses((prev) => sortExpensesByDate([...prev, data]))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'expenses',
          action: 'create',
          payload: {
            amount: expense.amount,
            date: expense.date || format(new Date(), 'yyyy-MM-dd'),
            category_id: expense.category_id,
            ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
            ...(expense.description && { description: expense.description }),
          },
        })

        const offlineExpense: Expense = {
          id: `offline-${Date.now()}`,
          amount: expense.amount,
          date: expense.date || format(new Date(), 'yyyy-MM-dd'),
          category_id: expense.category_id,
          ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
          ...(expense.description && { description: expense.description }),
          created_at: new Date().toISOString(),
        }

        setExpenses((prev) => sortExpensesByDate([offlineExpense, ...prev]))
        return { data: offlineExpense, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar despesa'
      return { data: null, error: errorMessage }
    }
  }

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('expenses')
        .update(updates)
        .eq('id', id)
        .select(`
          *,
          category:categories(*)
        `)
        .single()

      if (updateError) throw updateError
      
      setExpenses((prev) => sortExpensesByDate(prev.map((exp) => (exp.id === id ? data : exp))))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'expenses',
          action: 'update',
          recordId: id,
          payload: updates as Record<string, unknown>,
        })

        setExpenses((prev) => sortExpensesByDate(prev.map((exp) => (exp.id === id ? { ...exp, ...updates } : exp))))
        return { data: { id, ...updates }, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar despesa'
      return { data: null, error: errorMessage }
    }
  }

  const deleteExpense = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      
      setExpenses((prev) => prev.filter((exp) => exp.id !== id))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'expenses',
          action: 'delete',
          recordId: id,
        })

        setExpenses((prev) => prev.filter((exp) => exp.id !== id))
        return { error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar despesa'
      return { error: errorMessage }
    }
  }

  return {
    expenses,
    loading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    refreshExpenses: loadExpenses,
  }
}

