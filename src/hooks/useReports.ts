import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { MonthlySummary, CategoryExpense, Expense, PortfolioOperationType } from '@/types'
import { format, startOfYear, endOfYear, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { getWeightedReportAmount } from '@/utils/reportWeight'
import { sumPortfolioTransactionsForMonth } from '@/utils/portfolioMonthlyFlow'
import { logger } from '@/utils/logger'

/** Gastos por categoria em um mês (yyyy-MM -> lista) */
export type MonthlyCategoryExpenses = Record<string, CategoryExpense[]>

export interface UseReportsReturn {
  monthlySummaries: MonthlySummary[]
  categoryExpenses: CategoryExpense[]
  monthlyCategoryExpenses: MonthlyCategoryExpenses
  annualExpenses: Expense[] // Adicionado para permitir agrupamentos flexíveis no componente se necessário
  loading: boolean
  error: string | null
  refreshReports: () => Promise<void>
}

export function useReports(year?: number, includeReportWeights = true): UseReportsReturn {
  const { isOnline } = useNetworkStatus()
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlySummary[]>([])
  const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
  const [monthlyCategoryExpenses, setMonthlyCategoryExpenses] = useState<MonthlyCategoryExpenses>({})
  const [annualExpenses, setAnnualExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const targetYear = year ?? new Date().getFullYear()

  const loadReports = useCallback(async () => {
    if (!isOnline) {
      setLoading(false)
      return
    }
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
        return getWeightedReportAmount(entry.amount, entry.report_weight)
      }

      const startDate = startOfYear(new Date(targetYear, 0, 1))
      const endDate = endOfYear(new Date(targetYear, 11, 31))

      let { data: expenses, error: expensesError } = await supabase
        .from('expenses')
        .select(`
          id,
          created_at,
          amount,
          report_weight,
          date,
          category_id,
          payment_method,
          credit_card_id,
          category:categories(id, name, color),
          credit_card:credit_cards(id, name, color)
        `)
        .gte('date', format(startDate, 'yyyy-MM-dd'))
        .lte('date', format(endDate, 'yyyy-MM-dd'))

      if (expensesError && hasMissingReportWeightError(expensesError)) {
        const fallback = await supabase
          .from('expenses')
          .select(`
            id,
            created_at,
            amount,
            date,
            category_id,
            payment_method,
            credit_card_id,
            category:categories(id, name, color),
            credit_card:credit_cards(id, name, color)
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

      const { data: authData } = await supabase.auth.getUser()
      let portfolioTransactions: {
        id: string
        date: string
        operation_type: PortfolioOperationType
        quantity: number
        price: number
        cash_offset_source_id?: string | null
      }[] = []

      if (authData.user) {
        const { data: portfolio } = await supabase
          .from('portfolios')
          .select('id')
          .eq('client_id', authData.user.id)
          .maybeSingle()

        if (portfolio) {
          const { data: txs } = await supabase
            .from('portfolio_transactions')
            .select('id, cash_offset_source_id, date, operation_type, quantity, price')
            .eq('portfolio_id', portfolio.id)
            .gte('date', format(startDate, 'yyyy-MM-dd'))
            .lte('date', format(endDate, 'yyyy-MM-dd'))

          const rawTxs = txs || []
          const offsetSourceIds = new Set(
            rawTxs
              .map((t) => t.cash_offset_source_id)
              .filter((id): id is string => !!id)
          )

          portfolioTransactions = rawTxs.filter(
            (t) => !t.cash_offset_source_id && !offsetSourceIds.has(t.id)
          )
        }
      }

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

        const totalExpenses = monthExpenses.reduce((sum, exp) => sum + getWeightedAmount(exp), 0)
        const totalIncomes = monthIncomes.reduce((sum, inc) => sum + getWeightedAmount(inc), 0)
        const totalInvestments = sumPortfolioTransactionsForMonth(portfolioTransactions, monthStr)

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
              color: cat?.color ?? 'var(--category-fallback-neutral)',
            })
          }
          const categoryRow = categoryMap.get(catId)
          if (categoryRow) {
            categoryRow.total += getWeightedAmount(exp)
          } else {
            logger.warn(`Categoria não encontrada na agregação mensal: ${catId}`)
          }
        })
        byMonth[monthStr] = Array.from(categoryMap.values())
      })

      setMonthlySummaries(summaries)
      setMonthlyCategoryExpenses(byMonth)

      const annualCategoryMap = new Map<string, CategoryExpense>()
        ; (expenses || []).forEach((exp) => {
          const catId = exp.category_id
          const cat = exp.category as { id?: string; name?: string; color?: string } | null
          if (!annualCategoryMap.has(catId)) {
            annualCategoryMap.set(catId, {
              category_id: catId,
              category_name: cat?.name ?? 'Sem categoria',
              total: 0,
              color: cat?.color ?? 'var(--category-fallback-neutral)',
            })
          }
          const annualCat = annualCategoryMap.get(catId)
          if (annualCat) {
            annualCat.total += getWeightedAmount(exp)
          } else {
            logger.warn(`Categoria não encontrada na agregação anual: ${catId}`)
          }
        })
      setCategoryExpenses(Array.from(annualCategoryMap.values()))
      setAnnualExpenses((expenses || []) as unknown as Expense[])
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar relatórios')
    } finally {
      setLoading(false)
    }
  }, [targetYear, includeReportWeights, isOnline])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  return {
    monthlySummaries,
    categoryExpenses,
    monthlyCategoryExpenses,
    annualExpenses,
    loading,
    error,
    refreshReports: loadReports,
  }
}

