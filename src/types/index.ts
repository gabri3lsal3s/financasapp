export interface Category {
  id: string
  name: string
  color: string
  created_at: string
  user_id?: string
}

export interface Expense {
  id: string
  amount: number
  report_weight?: number
  date: string
  category_id: string
  description?: string
  created_at: string
  user_id?: string
  category?: Category
}

export interface Income {
  id: string
  amount: number
  report_weight?: number
  date: string
  type: IncomeType
  income_category_id: string
  description?: string
  created_at: string
  user_id?: string
  income_category?: IncomeCategory
}

export interface IncomeCategory {
  id: string
  name: string
  color: string
  created_at: string
  user_id?: string
}

export interface ExpenseCategoryMonthLimit {
  id: string
  category_id: string
  month: string
  limit_amount: number | null
  created_at: string
  user_id?: string
}

export interface IncomeCategoryMonthExpectation {
  id: string
  income_category_id: string
  month: string
  expectation_amount: number | null
  created_at: string
  user_id?: string
}

export type IncomeType = 'salary' | 'freelancer' | 'dividends' | 'rent' | 'other'

export interface Investment {
  id: string
  amount: number
  month: string // YYYY-MM format
  description?: string
  created_at: string
  user_id?: string
}

export interface MonthlySummary {
  month: string
  total_income: number
  total_expenses: number
  total_investments: number
  balance: number
}

export interface CategoryExpense {
  category_id: string
  category_name: string
  total: number
  color: string
}





