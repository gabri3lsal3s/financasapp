import { addDays, format, isSaturday, isSunday, parseISO } from 'date-fns'
import anbimaHolidayDates from '@/data/anbima-holidays-2025-2026.json'

/** Feriados nacionais fixos (MM-dd). */
const FIXED_HOLIDAYS = new Set([
  '01-01', // Ano Novo
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Senhora Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
])

const ANBIMA_HOLIDAYS = new Set(anbimaHolidayDates as string[])
const movableHolidaysCache = new Map<number, Set<string>>()

function getMovableHolidays(year: number): Set<string> {
  const cached = movableHolidaysCache.get(year)
  if (cached) return cached

  // Algoritmo de Gauss para calcular a Páscoa no calendário gregoriano
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  const easter = new Date(year, month - 1, day)

  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${y}-${mm}-${dd}`
  }

  const goodFriday = new Date(easter)
  goodFriday.setDate(easter.getDate() - 2)

  const carnivalMonday = new Date(easter)
  carnivalMonday.setDate(easter.getDate() - 48)

  const carnivalTuesday = new Date(easter)
  carnivalTuesday.setDate(easter.getDate() - 47)

  const corpusChristi = new Date(easter)
  corpusChristi.setDate(easter.getDate() + 60)

  const result = new Set([
    fmt(goodFriday),
    fmt(carnivalMonday),
    fmt(carnivalTuesday),
    fmt(corpusChristi),
  ])

  movableHolidaysCache.set(year, result)
  return result
}

function isHoliday(date: Date): boolean {
  const iso = format(date, 'yyyy-MM-dd')
  const year = date.getFullYear()
  const movable = getMovableHolidays(year)

  return (
    FIXED_HOLIDAYS.has(format(date, 'MM-dd')) ||
    ANBIMA_HOLIDAYS.has(iso) ||
    movable.has(iso)
  )
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
