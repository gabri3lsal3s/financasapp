import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ExpenseCategoryMonthLimit } from '@/types'

export function useExpenseCategoryLimits(month: string) {
  const [limits, setLimits] = useState<ExpenseCategoryMonthLimit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadLimits()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const loadLimits = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('expense_category_month_limits')
        .select('*')
        .eq('month', month)

      if (fetchError) throw fetchError

      setLimits(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar limites de despesas')
    } finally {
      setLoading(false)
    }
  }

  const setCategoryLimit = async (categoryId: string, amount: number | null) => {
    try {
      if (amount === null) {
        const { error: deleteError } = await supabase
          .from('expense_category_month_limits')
          .delete()
          .eq('category_id', categoryId)
          .eq('month', month)

        if (deleteError) throw deleteError

        setLimits((prev) => prev.filter((item) => !(item.category_id === categoryId && item.month === month)))
        return { data: null, error: null }
      }

      const payload = {
        category_id: categoryId,
        month,
        limit_amount: amount,
      }

      const { data, error: upsertError } = await supabase
        .from('expense_category_month_limits')
        .upsert([payload], { onConflict: 'category_id,month' })
        .select()
        .single()

      if (upsertError) throw upsertError

      setLimits((prev) => {
        const filtered = prev.filter((item) => !(item.category_id === categoryId && item.month === month))
        return [...filtered, data]
      })

      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar limite da categoria'
      return { data: null, error: errorMessage }
    }
  }

  return {
    limits,
    loading,
    error,
    setCategoryLimit,
    refreshLimits: loadLimits,
  }
}
