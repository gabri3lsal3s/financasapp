import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense } from '@/types'
import { format } from 'date-fns'

export function useExpenses(month?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

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
      setExpenses(data || [])
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
      const expenseData = {
        ...expense,
        date: expense.date || format(new Date(), 'yyyy-MM-dd'),
      }

      // Se for parcelado, criar múltiplas despesas
      if (expense.is_fixed && expense.installments && expense.installments > 1) {
        const expenses = []
        const baseDate = new Date(expenseData.date)
        
        for (let i = 0; i < expense.installments; i++) {
          const installmentDate = new Date(baseDate)
          installmentDate.setMonth(installmentDate.getMonth() + i)
          
          expenses.push({
            ...expenseData,
            date: format(installmentDate, 'yyyy-MM-dd'),
            current_installment: i + 1,
            installments: expense.installments,
          })
        }

        const { data, error: insertError } = await supabase
          .from('expenses')
          .insert(expenses)
          .select(`
            *,
            category:categories(*)
          `)

        if (insertError) throw insertError
        
        setExpenses((prev) => [...prev, ...data])
        return { data, error: null }
      } else {
        const { data, error: insertError } = await supabase
          .from('expenses')
          .insert([expenseData])
          .select(`
            *,
            category:categories(*)
          `)
          .single()

        if (insertError) throw insertError
        
        setExpenses((prev) => [...prev, data])
        return { data, error: null }
      }
    } catch (err) {
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
      
      setExpenses((prev) =>
        prev.map((exp) => (exp.id === id ? data : exp))
      )
      return { data, error: null }
    } catch (err) {
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

