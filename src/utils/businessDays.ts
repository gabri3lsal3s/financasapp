import { addDays, format, isSaturday, isSunday, parseISO } from 'date-fns'
import anbimaHolidayDates from '@/data/anbima-holidays-2025-2026.json'

/** Feriados nacionais fixos (MM-dd). */
const FIXED_HOLIDAYS = new Set([
  '01-01',
  '04-21',
  '05-01',
  '09-07',
  '10-12',
  '11-02',
  '11-15',
  '12-25',
])

const ANBIMA_HOLIDAYS = new Set(anbimaHolidayDates as string[])

function isHoliday(date: Date): boolean {
  const iso = format(date, 'yyyy-MM-dd')
  return FIXED_HOLIDAYS.has(format(date, 'MM-dd')) || ANBIMA_HOLIDAYS.has(iso)
}

export function isBusinessDay(date: Date): boolean {
  return !isSunday(date) && !isSaturday(date) && !isHoliday(date)
}

export function countBusinessDaysBetween(startDate: string, endDate: string): number {
  const start = parseISO(startDate.length === 10 ? startDate : startDate.slice(0, 10))
  const end = parseISO(endDate.length === 10 ? endDate : endDate.slice(0, 10))
  if (end < start) return 0

  let count = 0
  let cursor = start
  while (cursor <= end) {
    if (isBusinessDay(cursor)) count += 1
    cursor = addDays(cursor, 1)
  }
  return count
}

export function eachBusinessDayBetween(startDate: string, endDate: string): string[] {
  const start = parseISO(startDate.length === 10 ? startDate : startDate.slice(0, 10))
  const end = parseISO(endDate.length === 10 ? endDate : endDate.slice(0, 10))
  const days: string[] = []
  if (end < start) return days

  let cursor = start
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      days.push(format(cursor, 'yyyy-MM-dd'))
    }
    cursor = addDays(cursor, 1)
  }
  return days
}

export function calendarDaysBetween(startDate: string, endDate: string): number {
  const start = parseISO(startDate.length === 10 ? startDate : startDate.slice(0, 10))
  const end = parseISO(endDate.length === 10 ? endDate : endDate.slice(0, 10))
  const diffMs = end.getTime() - start.getTime()
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}
