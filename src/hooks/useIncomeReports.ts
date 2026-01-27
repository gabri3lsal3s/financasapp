import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface IncomeByCategory {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

export function useIncomeReports(year: number) {
  const [incomeByCategory, setIncomeByCategory] = useState<IncomeByCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIncomeByCategory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year])

  const loadIncomeByCategory = async () => {
    try {
      setLoading(true)
      
      // Pegar todas as rendas do ano
      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      const { data: incomes, error: incomesError } = await supabase
        .from('incomes')
        .select(`
          amount,
          income_category_id,
          income_categories (
            name,
            color
          )
        `)
        .gte('date', startDate)
        .lte('date', endDate)

      if (incomesError) throw incomesError

      // Agrupar por categoria
      const groupedByCategory: Record<string, IncomeByCategory> = {}

      incomes.forEach((income: any) => {
        const categoryId = income.income_category_id
        const categoryName = income.income_categories?.name || 'Sem categoria'
        const categoryColor = income.income_categories?.color || '#808080'

        if (!groupedByCategory[categoryId]) {
          groupedByCategory[categoryId] = {
            income_category_id: categoryId,
            category_name: categoryName,
            total: 0,
            color: categoryColor,
          }
        }

        groupedByCategory[categoryId].total += income.amount
      })

      setIncomeByCategory(Object.values(groupedByCategory))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios de renda')
      console.error('Error loading income reports:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    incomeByCategory,
    loading,
    error,
  }
}
