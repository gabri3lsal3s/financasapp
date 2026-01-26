import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySummary, CategoryExpense } from '@/types'
import { format, startOfYear, endOfYear, endOfMonth, eachMonthOfInterval } from 'date-fns'

export function useReports(year?: number) {
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetYear = year || new Date().getFullYear()

  useEffect(() => {
    loadReports()
  }, [targetYear])

  const loadReports = async () => {
    try {
      setLoading(true)
      
      const startDate = startOfYear(new Date(targetYear, 0, 1))
      const endDate = endOfYear(new Date(targetYear, 11, 31))
      
      // Carregar despesas do ano
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

      // Carregar rendas do ano
      const { data: incomes, error: incomesError } = await supabase
        .from('incomes')
        .select('amount, date')
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      if (incomesError) throw incomesError

      // Carregar investimentos do ano
      const { data: investments, error: investmentsError } = await supabase
        .from('investments')
        .select('amount, month')
        .gte('month', format(startDate, 'yyyy-MM'))
        .lte('month', format(endDate, 'yyyy-MM'))

      if (investmentsError) throw investmentsError

      // Processar resumos mensais
      const months = eachMonthOfInterval({ start: startDate, end: endDate })
      const summaries: MonthlySummary[] = months.map((month) => {
        const monthStr = format(month, 'yyyy-MM')
        const monthStart = format(month, 'yyyy-MM-dd')
        const monthEnd = format(endOfMonth(month), 'yyyy-MM-dd')

        const monthExpenses = (expenses || []).filter(
          (exp) => exp.date >= monthStart && exp.date <= monthEnd
        )
        const monthIncomes = (incomes || []).filter(
          (inc) => inc.date >= monthStart && inc.date <= monthEnd
        )
        const monthInvestments = (investments || []).filter(
          (inv) => inv.month === monthStr
        )

        const totalExpenses = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0)
        const totalIncomes = monthIncomes.reduce((sum, inc) => sum + inc.amount, 0)
        const totalInvestments = monthInvestments.reduce((sum, inv) => sum + inv.amount, 0)

        return {
          month: monthStr,
          total_income: totalIncomes,
          total_expenses: totalExpenses,
          total_investments: totalInvestments,
          balance: totalIncomes - totalExpenses - totalInvestments,
        }
      })

      setMonthlySummaries(summaries)

      // Processar gastos por categoria
      const categoryMap = new Map<string, CategoryExpense>()
      
      ;(expenses || []).forEach((exp) => {
        const catId = exp.category_id
        const cat = exp.category as any
        
        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            category_id: catId,
            category_name: cat?.name || 'Sem categoria',
            total: 0,
            color: cat?.color || '#6b7280',
          })
        }
        
        const categoryExpense = categoryMap.get(catId)!
        categoryExpense.total += exp.amount
      })

      setCategoryExpenses(Array.from(categoryMap.values()))

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
      console.error('Error loading reports:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    monthlySummaries,
    categoryExpenses,
    loading,
    error,
    refreshReports: loadReports,
  }
}

