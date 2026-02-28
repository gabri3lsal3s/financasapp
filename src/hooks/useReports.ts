import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySummary, CategoryExpense } from '@/types'
import { format, startOfYear, endOfYear, endOfMonth, eachMonthOfInterval } from 'date-fns'

/** Gastos por categoria em um mês (yyyy-MM -> lista) */
export type MonthlyCategoryExpenses = Record<string, CategoryExpense[]>

export interface UseReportsReturn {
  monthlySummaries: MonthlySummary[]
  categoryExpenses: CategoryExpense[]
  monthlyCategoryExpenses: MonthlyCategoryExpenses
  loading: boolean
  error: string | null
  refreshReports: () => Promise<void>
}

export function useReports(year?: number): UseReportsReturn {
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [monthlyCategoryExpenses, setMonthlyCategoryExpenses] = useState<MonthlyCategoryExpenses>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetYear = year ?? new Date().getFullYear()

  useEffect(() => {
    loadReports()
  }, [targetYear])

  const loadReports = async () => {
    try {
      setLoading(true)
      const startDate = startOfYear(new Date(targetYear, 0, 1))
      const endDate = endOfYear(new Date(targetYear, 11, 31))

      const { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          amount,
          date,
          category_id,
          category:categories(id, name, color)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      if (expensesError) throw expensesError

      const { data: incomes, error: incomesError } = await supabase
        .from('incomes')
        .select('amount, date')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      if (incomesError) throw incomesError

      const { data: investments, error: investmentsError } = await supabase
        .from('investments')
        .select('amount, month')
        .gte('month', format(startDate, 'yyyy-MM'))
        .lte('month', format(endDate, 'yyyy-MM'))

      if (investmentsError) throw investmentsError

      const months = eachMonthOfInterval({ start: startDate, end: endDate })
      const summaries: MonthlySummary[] = []
      const byMonth: MonthlyCategoryExpenses = {}

      months.forEach((month) => {
        const monthStr = format(month, 'yyyy-MM')
        const monthStart = format(month, 'yyyy-MM-dd')
        const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')

        const monthExpenses = (expenses || []).filter(
          (exp) => exp.date >= monthStart && exp.date <= monthEnd
        )
        const monthIncomes = (incomes || []).filter(
          (inc) => inc.date >= monthStart && inc.date <= monthEnd
        )
        const monthInvestments = (investments || []).filter((inv) => inv.month === monthStr)

        const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
        const totalIncomes = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0)
        const totalInvestments = monthInvestments.reduce((sum, inv) => sum + inv.amount, 0)

        summaries.push({
          month: monthStr,
          total_income: totalIncomes,
          total_expenses: totalExpenses,
          total_investments: totalInvestments,
          balance: totalIncomes - totalExpenses - totalInvestments,
        })

        const categoryMap = new Map<string, CategoryExpense>()
        monthExpenses.forEach((exp) => {
          const catId = exp.category_id
          const cat = exp.category as { id?: string; name?: string; color?: string } | null
          if (!categoryMap.has(catId)) {
            categoryMap.set(catId, {
              category_id: catId,
              category_name: cat?.name ?? 'Sem categoria',
              total: 0,
              color: cat?.color ?? '#6b7280',
            })
          }
          categoryMap.get(catId)!.total += exp.amount
        })
        byMonth[monthStr] = Array.from(categoryMap.values())
      })

      setMonthlySummaries(summaries)
      setMonthlyCategoryExpenses(byMonth)

      const annualCategoryMap = new Map<string, CategoryExpense>()
      ;(expenses || []).forEach((exp) => {
        const catId = exp.category_id
        const cat = exp.category as { id?: string; name?: string; color?: string } | null
        if (!annualCategoryMap.has(catId)) {
          annualCategoryMap.set(catId, {
            category_id: catId,
            category_name: cat?.name ?? 'Sem categoria',
            total: 0,
            color: cat?.color ?? '#6b7280',
          })
        }
        annualCategoryMap.get(catId)!.total += exp.amount
      })
      setCategoryExpenses(Array.from(annualCategoryMap.values()))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }

  return {
    monthlySummaries,
    categoryExpenses,
    monthlyCategoryExpenses,
    loading,
    error,
    refreshReports: loadReports,
  }
}

