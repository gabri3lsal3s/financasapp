import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { addMonths, format } from 'date-fns'
import { enqueueOfflineOperation, shouldQueueOffline } from '@/utils/offlineQueue'

const splitAmountIntoInstallments = (totalAmount: number, installments: number) => {
  const totalInCents = Math.round(totalAmount * 100)
  const baseInstallment = Math.floor(totalInCents / installments)
  const remainder = totalInCents - (baseInstallment * installments)

  return Array.from({ length: installments }, (_, index) => {
    const cents = baseInstallment + (index < remainder ? 1 : 0)
    return Number((cents / 100).toFixed(2))
  })
}

const generateInstallmentPayloads = (
  expense: Omit<Expense, 'id' | 'created_at' | 'category'>,
  installments: number,
) => {
  const installmentTotal = Math.max(1, Math.min(60, Math.trunc(installments || 1)))
  const baseDate = new Date(`${expense.date || format(new Date(), 'yyyy-MM-dd')}T00:00:00`)

  if (installmentTotal <= 1) {
    return [{
      amount: expense.amount,
      date: expense.date || format(new Date(), 'yyyy-MM-dd'),
      category_id: expense.category_id,
      ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
      ...(expense.description && { description: expense.description }),
    }]
  }

  const groupId = crypto.randomUUID()
  const installmentAmounts = splitAmountIntoInstallments(expense.amount, installmentTotal)

  return installmentAmounts.map((installmentAmount, index) => ({
    amount: installmentAmount,
    date: format(addMonths(baseDate, index), 'yyyy-MM-dd'),
    category_id: expense.category_id,
    ...(expense.report_weight !== undefined && { report_weight: expense.report_weight }),
    ...(expense.description && { description: expense.description }),
    installment_group_id: groupId,
    installment_number: index + 1,
    installment_total: installmentTotal,
  }))
}

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

      const installments = Number(expense.installment_total || 1)
      const expenseData = generateInstallmentPayloads(expense, installments)

      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select(`
          *,
          category:categories(*)
        `)

      if (insertError) throw insertError

      const inserted = data || []
      setExpenses((prev) => sortExpensesByDate([...prev, ...inserted]))
      return { data: inserted[0] || null, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        const installments = Number(expense.installment_total || 1)
        const expenseData = generateInstallmentPayloads(expense, installments)

        expenseData.forEach((payload) => {
          enqueueOfflineOperation({
            entity: 'expenses',
            action: 'create',
            payload,
          })
        })

        const nowIso = new Date().toISOString()
        const offlineExpenses: Expense[] = expenseData.map((payload, index) => {
          const installmentGroupId = 'installment_group_id' in payload ? payload.installment_group_id : undefined
          const installmentNumber = 'installment_number' in payload ? payload.installment_number : undefined
          const installmentTotal = 'installment_total' in payload ? payload.installment_total : undefined

          return {
            id: `offline-${Date.now()}-${index}`,
            amount: Number(payload.amount),
            report_weight: payload.report_weight !== undefined ? Number(payload.report_weight) : undefined,
            date: String(payload.date),
            category_id: String(payload.category_id),
            installment_group_id: installmentGroupId ? String(installmentGroupId) : null,
            installment_number: installmentNumber !== undefined ? Number(installmentNumber) : null,
            installment_total: installmentTotal !== undefined ? Number(installmentTotal) : null,
            description: payload.description ? String(payload.description) : undefined,
            created_at: nowIso,
          }
        })

        setExpenses((prev) => sortExpensesByDate([...offlineExpenses, ...prev]))
        return { data: offlineExpenses[0] || null, error: null }
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

