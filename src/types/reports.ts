/** Modos de visualização dos relatórios */
export type ViewMode = 'year' | 'month' | 'custom'

/** Tipos de detalhamento para o modal de categorias */
export type DetailType = 'expense' | 'income' | 'payment_method' | 'credit_card'

/** Agregação de despesa por categoria */
export interface ExpenseCategorySummary {
  category_id: string
  category_name: string
  total: number
  color: string
}

/** Agregação de receita por categoria */
export interface IncomeCategorySummary {
  income_category_id: string
  category_name: string
  total: number
  color: string
}

/** Dado para gráfico de pizza.
 * Index signature necessária para compatibilidade com PieChartItem do CategoryPieChart. */
export interface PieDatum {
  name: string
  value: number
  baseValue?: number
  color: string
  categoryId?: string
  detailType?: DetailType
  detailPeriod?: 'month' | 'year'
  iconName?: string
  [key: string]: string | number | boolean | undefined
}

/** Metadados de série para gráficos de evolução */
export interface TrendSeriesMeta {
  key: string
  name: string
  color: string
}

/** Estado do modal de detalhamento de categoria */
export interface DetailModalState {
  isOpen: boolean
  type: DetailType
  categoryId: string
  categoryName: string
  period: 'month' | 'year'
}

/** Labels dos meios de pagamento */
export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  debit: 'Débito',
  credit_card: 'Cartão de Crédito',
  pix: 'Pix',
  transfer: 'Transferência',
  other: 'Outros',
}

/** Cores dos meios de pagamento */
export const PAYMENT_METHOD_COLORS: Record<string, string> = {
  cash: 'var(--payment-method-cash)',
  debit: 'var(--payment-method-debit)',
  credit_card: 'var(--payment-method-credit-card)',
  pix: 'var(--payment-method-pix)',
  transfer: 'var(--payment-method-transfer)',
  other: 'var(--payment-method-other)',
}

/** Tipo auxiliar para entrada de despesa no modal de detalhes */
export interface DetailExpenseEntry {
  id: string
  amount: number
  report_weight?: number | null
  category_id: string
  date: string
  description?: string | null
  payment_method?: string | null
  credit_card_id?: string | null
  category?: {
    id?: string | null
    name?: string | null
    color?: string | null
  } | null
}

/** Tipo auxiliar para entrada de receita no modal de detalhes */
export interface DetailIncomeEntry {
  id: string
  amount: number
  report_weight?: number | null
  income_category_id: string
  date: string
  description?: string | null
  income_category?: {
    id?: string | null
    name?: string | null
    color?: string | null
  } | null
}
