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

export type AssistantIntent =
  | 'add_expense'
  | 'add_income'
  | 'add_investment'
  | 'get_month_balance'
  | 'list_recent_transactions'
  | 'update_transaction'
  | 'delete_transaction'
  | 'create_category'
  | 'monthly_insights'
  | 'unknown'

export type AssistantCommandStatus =
  | 'pending_confirmation'
  | 'confirmed'
  | 'denied'
  | 'executed'
  | 'failed'
  | 'expired'

export interface AssistantResolvedCategory {
  id?: string
  name: string
  confidence: number
  source: 'mapping' | 'keyword' | 'name_match' | 'fallback_uncategorized'
}

export interface AssistantSlots {
  amount?: number
  description?: string
  date?: string
  month?: string
  category?: AssistantResolvedCategory
  items?: Array<{
    amount: number
    description?: string
    date?: string
    month?: string
    category?: AssistantResolvedCategory
  }>
}

export interface AssistantSession {
  id: string
  device_id: string
  platform: string
  locale?: string
  user_id?: string
  status: 'active' | 'expired' | 'closed'
  last_intent?: AssistantIntent
  context_json?: Record<string, unknown>
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface AssistantCommand {
  id: string
  session_id: string
  user_id?: string
  command_text: string
  interpreted_intent?: AssistantIntent
  confidence?: number
  slots_json?: AssistantSlots
  category_resolution_json?: Record<string, unknown>
  requires_confirmation: boolean
  status: AssistantCommandStatus
  idempotency_key?: string
  execution_result_json?: Record<string, unknown>
  error_message?: string
  created_at: string
  updated_at: string
}

export interface AssistantConfirmation {
  id: string
  command_id: string
  session_id: string
  user_id?: string
  confirmed: boolean
  spoken_text?: string
  confirmation_method: 'voice' | 'touch'
  created_at: string
}

export interface AssistantInterpretResult {
  command: AssistantCommand
  intent: AssistantIntent
  confidence: number
  slots: AssistantSlots
  requiresConfirmation: boolean
  confirmationText: string
}

export interface AssistantConfirmResult {
  status: 'executed' | 'denied' | 'failed' | 'expired'
  message: string
  commandId: string
  transactionId?: string
}

export interface AssistantMonthlyInsightsResult {
  month: string
  highlights: string[]
  recommendations: string[]
}





