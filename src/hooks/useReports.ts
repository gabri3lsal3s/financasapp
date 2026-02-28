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

export function useReports(year?: number, includeReportWeights = true): UseReportsReturn {
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [monthlyCategoryExpenses, setMonthlyCategoryExpenses] = useState<MonthlyCategoryExpenses>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetYear = year ?? new Date().getFullYear()

  useEffect(() => {
    loadReports()
  }, [targetYear, includeReportWeights])

  const loadReports = async () => {
    try {
      setLoading(true)
      const hasMissingReportWeightError = (error: unknown) => {
        const message = typeof error === 'object' && error && 'message' in error
          ? String((error as { message?: string }).message)
          : ''
        return message.toLowerCase().includes('report_weight')
      }

      const getWeightedAmount = (entry: { amount: number; report_weight?: number | null }) => {
        if (!includeReportWeights) {
          return entry.amount
        }

        const weight = entry.report_weight ?? 1
        return entry.amount * weight
      }

      const startDate = startOfYear(new Date(targetYear, 0, 1))
      const endDate = endOfYear(new Date(targetYear, 11, 31))

      let { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          amount,
          report_weight,
          date,
          category_id,
          category:categories(id, name, color)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      if (expensesError && hasMissingReportWeightError(expensesError)) {
        const fallback = await supabase
          .from('expenses')
          .select(`
            amount,
            date,
            category_id,
            category:categories(id, name, color)
          `)
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))

        expenses = (fallback.data || []).map((exp) => ({ ...exp, report_weight: 1 }))
        expensesError = fallback.error
      }

      if (expensesError) throw expensesError

      let { data: incomes, error: incomesError } = await supabase
        .from('incomes')
        .select('amount, report_weight, date')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      if (incomesError && hasMissingReportWeightError(incomesError)) {
        const fallback = await supabase
          .from('incomes')
          .select('amount, date')
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))

        incomes = (fallback.data || []).map((inc) => ({ ...inc, report_weight: 1 }))
        incomesError = fallback.error
      }

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

        const totalExpenses = monthExpenses.reduce((sum, exp) => sum + getWeightedAmount(exp), 0)
        const totalIncomes = monthIncomes.reduce((sum, inc) => sum + getWeightedAmount(inc), 0)
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
          categoryMap.get(catId)!.total += getWeightedAmount(exp)
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
        annualCategoryMap.get(catId)!.total += getWeightedAmount(exp)
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

