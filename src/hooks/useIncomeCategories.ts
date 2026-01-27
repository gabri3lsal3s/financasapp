import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { IncomeCategory } from '@/types'

export function useIncomeCategories() {
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIncomeCategories()
  }, [])

  const loadIncomeCategories = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('income_categories')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setIncomeCategories(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias de renda')
      console.error('Error loading income categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const createIncomeCategory = async (incomeCategory: Omit<IncomeCategory, 'id' | 'created_at'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('income_categories')
        .insert([incomeCategory])
        .select()
        .single()

      if (insertError) throw insertError
      
      setIncomeCategories((prev) => [...prev, data])
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar categoria de renda'
      return { data: null, error: errorMessage }
    }
  }

  const updateIncomeCategory = async (id: string, updates: Partial<IncomeCategory>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('income_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      
      setIncomeCategories((prev) =>
        prev.map((cat) => (cat.id === id ? data : cat))
      )
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar categoria de renda'
      return { data: null, error: errorMessage }
    }
  }

  const deleteIncomeCategory = async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('income_categories')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      
      setIncomeCategories((prev) => prev.filter((cat) => cat.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar categoria de renda'
      return { error: errorMessage }
    }
  }

  return {
    incomeCategories,
    loading,
    error,
    createIncomeCategory,
    updateIncomeCategory,
    deleteIncomeCategory,
    refreshIncomeCategories: loadIncomeCategories,
  }
}
