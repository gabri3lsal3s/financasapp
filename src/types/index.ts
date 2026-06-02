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
  payment_method?: 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other'
  credit_card_id?: string | null
  bill_competence?: string | null
  date: string
  installment_group_id?: string | null
  installment_number?: number | null
  installment_total?: number | null
  category_id: string
  description?: string
  created_at: string
  user_id?: string
  category?: Category
  credit_card?: CreditCard
}

export interface CreditCard {
  id: string
  name: string
  brand?: string | null
  limit_total?: number | null
  closing_day: number
  due_day: number
  color?: string | null
  is_active?: boolean
  created_at: string
  user_id?: string
}

export interface CreditCardBillPayment {
  id: string
  credit_card_id: string
  bill_competence: string
  amount: number
  payment_date: string
  note?: string | null
  created_at: string
  user_id?: string
}

export interface CreditCardMonthlyCycle {
  id: string
  credit_card_id: string
  competence: string
  closing_day: number
  due_day: number
  created_at: string
  user_id?: string
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
  ticker?: string
  quantity?: number
  price?: number
  transaction_id?: string
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

export interface Profile {
  id: string
  email: string
  full_name?: string | null
  is_approved: boolean
  is_blocked: boolean
  is_rejected: boolean
  rejection_count: number
  is_admin: boolean
  role: 'consultant' | 'client' | null
  created_at: string
  updated_at: string
}

export interface Portfolio {
  id: string
  client_id: string
  consultant_id: string | null
  cash_balance: number
  created_at: string
  client?: Profile
  consultant?: Profile
  notes?: string
  billing_fee_rate?: number
  total_shares?: number
  last_share_value?: number
  last_close_date?: string | null
  last_gross_pl?: number | null
  last_net_pl?: number | null
}

export type PortfolioOperationType =
  | 'buy'
  | 'sell'
  | 'dividend'
  | 'jcp'
  | 'fii_yield'
  | 'split'
  | 'reverse_split'
  | 'subscription'

export interface PortfolioTransaction {
  id: string
  portfolio_id: string
  ticker: string
  operation_type: PortfolioOperationType
  quantity: number
  price: number
  date: string
  created_at: string
  /** Compra/subscrição que originou venda automática de caixa. */
  cash_offset_source_id?: string | null
  contract_rate?: number | null
  settlement_status?: 'pending' | 'settled'
  vna_at_purchase?: number | null
}

export interface TargetAllocation {
  id: string
  portfolio_id: string
  ticker: string
  target_percentage: number
  created_at: string
}

export interface AssetThesis {
  id: string
  consultant_id: string
  ticker: string
  thesis: string
  created_at: string
}

export interface AssetPrice {
  ticker: string
  current_price: number
  last_updated: string
  asset_class?: string
  sector?: string
  quotation_status?: 'live' | 'stale' | 'fallback_static' | 'unavailable' | 'manual'
}

export type PortfolioPricingMode = 'market' | 'fixed_income' | 'manual_value' | 'cash'

export type PortfolioAssetIndexer = 'none' | 'cdi' | 'selic' | 'ipca'

export type PortfolioValuationMode = 'curve' | 'market'

export interface PortfolioAssetDefinition {
  id: string
  portfolio_id: string
  ticker: string
  pricing_mode: PortfolioPricingMode
  is_b3_linked: boolean
  applied_amount: number | null
  contract_rate: number | null
  indexer: PortfolioAssetIndexer
  indexer_percent: number
  maturity_date: string | null
  manual_current_value: number | null
  manual_value_updated_at: string | null
  tax_exempt: boolean
  is_treasury: boolean
  application_date: string | null
  created_at: string
  updated_at: string
  currency?: 'BRL' | 'USD'
  valuation_mode?: PortfolioValuationMode
}

export interface PortfolioShareDailyRow {
  portfolio_id: string
  rate_date: string
  share_value: number
  gross_pl: number
  net_pl: number
  total_shares: number
}

export interface PortfolioPeriodSnapshotRow {
  id: string
  portfolio_id: string
  period_type: 'month' | 'year'
  period_key: string
  cota_abertura: number
  cota_fechamento: number
  somatorio_aportes: number
  somatorio_resgates: number
  dividendos_recebidos: number
  drawdown_maximo: number
  period_return: number | null
  created_at: string
}

export interface IndexRateRow {
  rate_date: string
  indexer: PortfolioAssetIndexer
  daily_rate: number
}

export interface PortfolioGroupTarget {
  id: string
  portfolio_id: string
  group_type: 'class' | 'sector'
  group_name: string
  target_percentage: number
  created_at: string
}
