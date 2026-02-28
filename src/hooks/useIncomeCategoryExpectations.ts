import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { IncomeCategoryMonthExpectation } from '@/types'

export function useIncomeCategoryExpectations(month: string) {
  const [expectations, setExpectations] = useState<IncomeCategoryMonthExpectation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadExpectations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  const loadExpectations = async () => {
    try {
      setLoading(true)
      const { data, error: fetchError } = await supabase
        .from('income_category_month_expectations')
        .select('*')
        .eq('month', month)

      if (fetchError) throw fetchError

      setExpectations(data || [])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar expectativas de renda')
    } finally {
      setLoading(false)
    }
  }

  const setIncomeCategoryExpectation = async (incomeCategoryId: string, amount: number | null) => {
    try {
      if (amount === null) {
        const { error: deleteError } = await supabase
          .from('income_category_month_expectations')
          .delete()
          .eq('income_category_id', incomeCategoryId)
          .eq('month', month)

        if (deleteError) throw deleteError

        setExpectations((prev) => prev.filter((item) => !(item.income_category_id === incomeCategoryId && item.month === month)))
        return { data: null, error: null }
      }

      const payload = {
        income_category_id: incomeCategoryId,
        month,
        expectation_amount: amount,
      }

      const { data, error: upsertError } = await supabase
        .from('income_category_month_expectations')
        .upsert([payload], { onConflict: 'income_category_id,month' })
        .select()
        .single()

      if (upsertError) throw upsertError

      setExpectations((prev) => {
        const filtered = prev.filter((item) => !(item.income_category_id === incomeCategoryId && item.month === month))
        return [...filtered, data]
      })

      return { data, error: null }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar expectativa da categoria de renda'
      return { data: null, error: errorMessage }
    }
  }

  return {
    expectations,
    loading,
    error,
    setIncomeCategoryExpectation,
    refreshExpectations: loadExpectations,
  }
}
