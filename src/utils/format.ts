import { format as dateFormat, parseISO } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'

export const APP_START_MONTH = '2026-01'
export const APP_START_DATE = '2026-01-01'
const BR_LOCALE = 'pt-BR'

const numberFormatterCache = new Map<string, Intl.NumberFormat>()

const getNumberFormatter = (options: Intl.NumberFormatOptions): Intl.NumberFormat => {
  const cacheKey = JSON.stringify(options)
  const cachedFormatter = numberFormatterCache.get(cacheKey)

  if (cachedFormatter) {
    return cachedFormatter
  }

  const formatter = new Intl.NumberFormat(BR_LOCALE, options)
  numberFormatterCache.set(cacheKey, formatter)
  return formatter
}

const normalizeMonthString = (value: string): string | null => {
  if (!/^\d{4}-\d{2}$/.test(value)) return null
  return value
}

const normalizeDateString = (value: string): string | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  return value
}

export function clampMonthToAppStart(value: string): string {
  const normalized = normalizeMonthString(value)
  if (!normalized) return APP_START_MONTH
  return normalized < APP_START_MONTH ? APP_START_MONTH : normalized
}

export function clampDateToAppStart(value: string): string {
  const normalized = normalizeDateString(value)
  if (!normalized) return APP_START_DATE
  return normalized < APP_START_DATE ? APP_START_DATE : normalized
}

/** Retorna o mês atual no formato yyyy-MM */
export function getCurrentMonthString(): string {
  const d = new Date()
  return clampMonthToAppStart(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
}

/** Avança ou retrocede um mês a partir de yyyy-MM; retorna novo yyyy-MM */
export function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  date.setMonth(date.getMonth() + delta)
  return clampMonthToAppStart(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
}

export function formatCurrency(value: number): string {
  return formatNumberBR(value, {
    style: 'currency',
    currency: 'BRL',
  })
}

export function formatCurrencyByCode(value: number, currency: 'BRL' | 'USD' = 'BRL'): string {
  if (currency === 'USD') {
    return formatNumberBR(value, {
      style: 'currency',
      currency: 'USD',
    })
  }
  return formatCurrency(value)
}

export function formatNumberBR(value: number, options: Intl.NumberFormatOptions = {}): string {
  const numericValue = Number(value)
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0
  return getNumberFormatter(options).format(safeValue)
}

export function formatNumberWithTwoDecimalsBR(value: number): string {
  return formatNumberBR(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatPercentBR(value: number, fractionDigits = 2): string {
  return `${formatNumberBR(value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`
}

export function formatSignedPercentBR(value: number, fractionDigits = 2): string {
  const numericValue = Number.isFinite(value) ? value : 0
  const prefix = numericValue > 0 ? '+' : ''
  return `${prefix}${formatNumberBR(numericValue, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`
}

export function formatQuantityBR(value: number, maximumFractionDigits = 4): string {
  const numericValue = Number.isFinite(value) ? value : 0
  if (numericValue % 1 === 0) {
    return formatNumberBR(numericValue, { maximumFractionDigits: 0 })
  }
  return formatNumberBR(numericValue, { maximumFractionDigits })
}

export function formatCurrencyCompactBR(value: number): string {
  return `R$${formatNumberWithTwoDecimalsBR(value)}`
}

export function roundToDecimals(value: number, fractionDigits: number): number {
  const numericValue = Number.isFinite(value) ? value : 0
  const factor = 10 ** fractionDigits
  return Math.round(numericValue * factor) / factor
}

/** Eixo de gráfico: valores em milhares (ex.: R$150k). */
export function formatAxisCurrencyThousands(value: number, options?: { spaced?: boolean }): string {
  const thousands = (Number.isFinite(value) ? value : 0) / 1000
  const amount = formatNumberBR(thousands, { maximumFractionDigits: 0 })
  return options?.spaced ? `R$ ${amount}k` : `R$${amount}k`
}

/** Eixo Recharts: valores abaixo de 1000 em moeda completa; acima em milhares. */
export function formatChartYAxisCurrency(value: number): string {
  const numericValue = Number.isFinite(value) ? value : 0
  if (numericValue >= 1000) {
    return formatAxisCurrencyThousands(numericValue, { spaced: true })
  }
  return formatCurrency(numericValue)
}

export function parseMoneyInput(value: string | number | undefined | null): number {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  
  const cleaned = String(value)
    .trim()
    .replace(/\s/g, '')
    .replace(/R\$/g, '')
    .replace(/[^\d,.-]/g, '')

  if (!cleaned) return Number.NaN

  if (cleaned.includes(',')) {
    const normalized = cleaned.replace(/\./g, '').replace(',', '.')
    return Number(normalized)
  }

  return Number(cleaned.replace(/,/g, ''))
}

export function formatMoneyInput(value: number): string {
  return formatNumberWithTwoDecimalsBR(value)
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return dateFormat(dateObj, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
  const formatted = dateFormat(date, "MMMM 'de' yyyy", { locale: ptBR })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatMonthShort(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
  const formatted = dateFormat(date, 'MMM/yyyy', { locale: ptBR })
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export function formatDateTime(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return dateFormat(dateObj, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

