import { format as dateFormat, parseISO } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'

/** Retorna o mês atual no formato yyyy-MM */
export function getCurrentMonthString(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Avança ou retrocede um mês a partir de yyyy-MM; retorna novo yyyy-MM */
export function addMonths(monthStr: string, delta: number): string {
  const [y, m] = monthStr.split('-').map(Number)
  const date = new Date(y, m - 1, 1)
  date.setMonth(date.getMonth() + delta)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
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

