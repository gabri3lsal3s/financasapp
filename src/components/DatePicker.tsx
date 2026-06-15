import { useState, useMemo, useEffect } from 'react'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { formatDate } from '@/utils/format'
import { cn } from '@/lib/utils'

interface DatePickerProps {
  value: string // 'YYYY-MM-DD'
  onChange: (e: { target: { value: string; name?: string } }) => void
  name?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  className?: string
  id?: string
}

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
]

const START_YEAR = 2020
const END_YEAR = new Date().getFullYear() + 10
const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i)

export default function DatePicker({
  value,
  onChange,
  name,
  placeholder = 'Selecione a data...',
  disabled = false,
  className = '',
  id
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Parse initial date or default to today for calendar view state
  const initialDate = useMemo(() => {
    if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    return new Date()
  }, [value])

  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()) // 0-11

  // Update calendar view state when value changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentYear(initialDate.getFullYear())
      setCurrentMonth(initialDate.getMonth())
    }
  }, [isOpen, initialDate])

  const todayStr = useMemo(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  }, [])

  // Calculate 42 cells (6 rows * 7 days) of the grid
  const cells = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay() // 0 = Sun, 6 = Sat
    const totalDays = new Date(currentYear, currentMonth + 1, 0).getDate()
    const prevTotalDays = new Date(currentYear, currentMonth, 0).getDate()

    const tempCells: { dateStr: string; day: number; isCurrentMonth: boolean }[] = []

    // Trailing days from previous month
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevTotalDays - i
      const m = currentMonth === 0 ? 11 : currentMonth - 1
      const y = currentMonth === 0 ? currentYear - 1 : currentYear
      tempCells.push({
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false
      })
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      tempCells.push({
        dateStr: `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: true
      })
    }

    // Leading days of next month
    const remaining = 42 - tempCells.length
    for (let d = 1; d <= remaining; d++) {
      const m = currentMonth === 11 ? 0 : currentMonth + 1
      const y = currentMonth === 11 ? currentYear + 1 : currentYear
      tempCells.push({
        dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
        day: d,
        isCurrentMonth: false
      })
    }

    return tempCells
  }, [currentYear, currentMonth])

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => Math.max(START_YEAR, y - 1))
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => Math.min(END_YEAR, y + 1))
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  const selectDate = (dateStr: string) => {
    onChange({ target: { value: dateStr, name } })
    setIsOpen(false)
  }

  const clearDate = () => {
    onChange({ target: { value: '', name } })
    setIsOpen(false)
  }

  const selectToday = () => {
    selectDate(todayStr)
  }

  const formattedDisplayValue = useMemo(() => {
    if (!value) return ''
    try {
      return formatDate(value)
    } catch {
      return value
    }
  }, [value])

  return (
    <>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(true)}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-xl border border-glass glass-input px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50 text-left transition-all motion-standard cursor-pointer select-none',
          value ? 'text-primary' : 'text-muted-foreground',
          className
        )}
      >
        <span className="truncate">{formattedDisplayValue || placeholder}</span>
        <CalendarIcon className="h-4 w-4 opacity-50 shrink-0 ml-2" />
      </button>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Selecionar Data"
        size="sm"
      >
        <div className="modal-body-stack">
          {/* Header Navigation */}
          <div className="flex items-center justify-between gap-1.5 border-b border-glass pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handlePrevMonth}
              className="p-1.5 h-auto w-auto shrink-0"
              disabled={currentMonth === 0 && currentYear === START_YEAR}
            >
              <ChevronLeft size={16} />
            </Button>

            <div className="flex items-center gap-1">
              <select
                value={currentMonth}
                onChange={(e) => setCurrentMonth(Number(e.target.value))}
                className="h-8 rounded-lg border border-glass bg-secondary/35 text-xs text-primary px-1.5 cursor-pointer font-bold focus:outline-none"
              >
                {MONTH_NAMES.map((name, index) => (
                  <option key={index} value={index} className="text-primary bg-card">
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={currentYear}
                onChange={(e) => setCurrentYear(Number(e.target.value))}
                className="h-8 rounded-lg border border-glass bg-secondary/35 text-xs text-primary px-1.5 cursor-pointer font-bold focus:outline-none"
              >
                {YEARS.map((y) => (
                  <option key={y} value={y} className="text-primary bg-card">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleNextMonth}
              className="p-1.5 h-auto w-auto shrink-0"
              disabled={currentMonth === 11 && currentYear === END_YEAR}
            >
              <ChevronRight size={16} />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="pt-2">
            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 text-center font-black text-[10px] text-secondary uppercase tracking-widest mb-2">
              <span>Dom</span>
              <span>Seg</span>
              <span>Ter</span>
              <span>Qua</span>
              <span>Qui</span>
              <span>Sex</span>
              <span>Sáb</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 justify-items-center">
              {cells.map((cell, index) => {
                const isSelected = cell.dateStr === value
                const isToday = cell.dateStr === todayStr

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => selectDate(cell.dateStr)}
                    className={cn(
                      'h-9 w-9 text-xs rounded-xl flex items-center justify-center transition-all hover:bg-secondary hover:bg-opacity-30 relative font-bold select-none cursor-pointer',
                      cell.isCurrentMonth ? 'text-primary' : 'text-secondary opacity-35 font-normal',
                      isToday && !isSelected ? 'border border-primary/40' : '',
                      isSelected ? 'bg-[var(--ds-color-accent-primary)] text-[var(--ds-color-button-text)] font-black shadow-sm scale-105 hover:bg-[var(--ds-color-accent-primary)]' : ''
                    )}
                  >
                    <span>{cell.day}</span>
                    {isToday && (
                      <span
                        className={cn(
                          'absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full',
                          isSelected ? 'bg-[var(--ds-color-button-text)]' : 'bg-[var(--ds-color-accent-primary)]'
                        )}
                      />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between gap-3 border-t border-glass pt-3 mt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={clearDate}
              className="px-3"
            >
              Limpar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={selectToday}
              className="px-3"
            >
              Hoje
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
