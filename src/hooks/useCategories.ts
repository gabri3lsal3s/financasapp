import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Category } from '@/types'

const DEFAULT_CATEGORY_NAME = 'Sem categoria'
const DEFAULT_CATEGORY_COLOR = '#9ca3af'

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCategories()
  }, [])

  const loadCategories = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('categories')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      setCategories(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias')
      console.error('Error loading categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const createCategory = async (category: Omit<Category, 'id' | 'created_at'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('categories')
        .insert([category])
        .select()
        .single()

      if (insertError) throw insertError
      
      setCategories((prev) => [...prev, data])
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar categoria'
      return { data: null, error: errorMessage }
    }
  }

  const updateCategory = async (id: string, updates: Partial<Category>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError
      
      setCategories((prev) =>
        prev.map((cat) => (cat.id === id ? data : cat))
      )
      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar categoria'
      return { data: null, error: errorMessage }
    }
  }

  const deleteCategory = async (id: string) => {
    try {
      const { data: currentCategory } = await supabase
        .from('categories')
        .select('id, name')
        .eq('id', id)
        .single()

      if (currentCategory?.name === DEFAULT_CATEGORY_NAME) {
        return { error: 'A categoria padrão "Sem categoria" não pode ser excluída.' }
      }

      const { count: linkedExpensesCount, error: countError } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id)

      if (countError) throw countError

      if ((linkedExpensesCount ?? 0) > 0) {
        let defaultCategoryId: string | null = null

        const { data: existingDefaultCategory, error: defaultFetchError } = await supabase
          .from('categories')
          .select('id, name')
          .eq('name', DEFAULT_CATEGORY_NAME)
          .limit(1)
          .maybeSingle()

        if (defaultFetchError) throw defaultFetchError

        if (existingDefaultCategory?.id) {
          defaultCategoryId = existingDefaultCategory.id
        } else {
          const { data: createdDefaultCategory, error: defaultCreateError } = await supabase
            .from('categories')
            .insert([{ name: DEFAULT_CATEGORY_NAME, color: DEFAULT_CATEGORY_COLOR }])
            .select()
            .single()

          if (defaultCreateError) throw defaultCreateError
          defaultCategoryId = createdDefaultCategory.id

          setCategories((prev) => [...prev, createdDefaultCategory])
        }

        if (!defaultCategoryId || defaultCategoryId === id) {
          return { error: 'Não foi possível reatribuir os itens para a categoria padrão.' }
        }

        const { error: reassignError } = await supabase
          .from('expenses')
          .update({ category_id: defaultCategoryId })
          .eq('category_id', id)

        if (reassignError) throw reassignError
      }

      const { error: deleteError } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError
      
      setCategories((prev) => prev.filter((cat) => cat.id !== id))
      return { error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar categoria'
      return { error: errorMessage }
    }
  }

  return {
    categories,
    loading,
    error,
    createCategory,
    updateCategory,
    deleteCategory,
    refreshCategories: loadCategories,
  }
}





