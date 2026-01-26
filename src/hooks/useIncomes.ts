import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Income } from '@/types'
import { format } from 'date-fns'

export function useIncomes(month?: string) {
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIncomes()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const loadIncomes = async () => {
    try {
      setLoading(true)
      let query = supabase
        .from('incomes')
        .select('*')
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
      setIncomes(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar rendas')
      console.error('Error loading incomes:', err)
    } finally {
      setLoading(false)
    }
  }

  const createIncome = async (income: Omit<Income, 'id' | 'created_at'>) => {
    try {
      const incomeData = {
        ...income,
        date: income.date || format(new Date(), 'yyyy-MM-dd'),
      }

      const { data, error: insertError } = await supabase
        .from('incomes')
        .insert([incomeData])
        .select()
        .single()

      if (insertError) throw insertError
      
      setIncomes((prev) => [data, ...prev])
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar renda'
      return { data: null, error: errorMessage }
    }
  }

  const updateIncome = async (id: string, updates: Partial<Income>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('incomes')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      
      setIncomes((prev) =>
        prev.map((inc) => (inc.id === id ? data : inc))
      )
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar renda'
      return { data: null, error: errorMessage }
    }
  }

  const deleteIncome = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('incomes')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      
      setIncomes((prev) => prev.filter((inc) => inc.id !== id))
      return { error: null }
    } catch (err) {
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

