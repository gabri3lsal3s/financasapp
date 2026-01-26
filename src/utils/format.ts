import { format as dateFormat, parseISO } from 'date-fns'
import ptBR from 'date-fns/locale/pt-BR'

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
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

