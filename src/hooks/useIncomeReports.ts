import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface IncomeByCategory {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

/** Rendas por categoria por mês (yyyy-MM -> lista) */
export type MonthlyIncomeByCategory = Record<string, IncomeByCategory[]>

export function useIncomeReports(year: number, includeReportWeights = true) {
  const [incomeByCategory, setIncomeByCategory] = useState<IncomeByCategory[]>([])
  const [monthlyIncomeByCategory, setMonthlyIncomeByCategory] = useState<MonthlyIncomeByCategory>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIncomeByCategory()
  }, [year, includeReportWeights])

  const loadIncomeByCategory = async () => {
    try {
      setLoading(true)
      const hasMissingReportWeightError = (error: unknown) => {
        const message = typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : ''
        return message.toLowerCase().includes('report_weight')
      }

      const startDate = `${year}-01-01`
      const endDate = `${year}-12-31`

      let { data: incomes, error: incomesError } = await supabase
        .from('incomes')
        .select(`
          amount,
          report_weight,
          date,
          income_category_id,
          income_categories (name, color)
        `)
        .gte('date', startDate)
        .lte('date', endDate)

      if (incomesError && hasMissingReportWeightError(incomesError)) {
        const fallback = await supabase
          .from('incomes')
          .select(`
            amount,
            date,
            income_category_id,
            income_categories (name, color)
          `)
          .gte('date', startDate)
          .lte('date', endDate)

        incomes = (fallback.data || []).map((income) => ({ ...income, report_weight: 1 }))
        incomesError = fallback.error
      }

      if (incomesError) throw incomesError

      const annual: Record<string, IncomeByCategory> = {}
      const byMonth: MonthlyIncomeByCategory = {}

      ;(incomes || []).forEach((income: { amount: number; report_weight?: number | null; date: string; income_category_id: string; income_categories?: { name?: string; color?: string } | { name?: string; color?: string }[] | null }) => {
        const cat = Array.isArray(income.income_categories) ? income.income_categories[0] : income.income_categories
        const categoryId = income.income_category_id
        const categoryName = cat?.name ?? 'Sem categoria'
        const categoryColor = cat?.color ?? '#808080'
        const monthStr = income.date.substring(0, 7)
        const weightedAmount = includeReportWeights
          ? income.amount * (income.report_weight ?? 1)
          : income.amount

        if (!annual[categoryId]) {
          annual[categoryId] = {
            income_category_id: categoryId,
            category_name: categoryName,
            total: 0,
            color: categoryColor,
          }
        }
        annual[categoryId].total += weightedAmount

        if (!byMonth[monthStr]) byMonth[monthStr] = []
        const monthList = byMonth[monthStr]
        const existing = monthList.find((c) => c.income_category_id === categoryId)
        if (existing) {
          existing.total += weightedAmount
        } else {
          monthList.push({
            income_category_id: categoryId,
            category_name: categoryName,
            total: weightedAmount,
            color: categoryColor,
          })
        }
      })

      setIncomeByCategory(Object.values(annual))
      setMonthlyIncomeByCategory(byMonth)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios de renda')
    } finally {
      setLoading(false)
    }
  }

  return {
    incomeByCategory,
    monthlyIncomeByCategory,
    loading,
    error,
  }
}
