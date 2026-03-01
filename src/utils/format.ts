import { format as dateFormat, parseISO } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'

export const APP_START_MONTH = '2026-01'
export const APP_START_DATE = '2026-01-01'

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
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function parseMoneyInput(value: string): number {
  const cleaned = value
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
  return Number(value).toFixed(2).replace('.', ',')
}

export function formatDate(date: string | Date): string {
  const dateObj = typeof date === 'string' ? parseISO(date) : date
  return dateFormat(dateObj, 'dd/MM/yyyy', { locale: ptBR })
}

export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
  return dateFormat(date, "MMMM 'de' yyyy", { locale: ptBR })
}

export function formatMonthShort(month: string): string {
  const [year, monthNum] = month.split('-')
  const date = new Date(parseInt(year), parseInt(monthNum) - 1, 1)
  return dateFormat(date, 'MMM/yyyy', { locale: ptBR })
}

