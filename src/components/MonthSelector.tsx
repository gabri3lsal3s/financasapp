import { useEffect, useRef, useState } from 'react'
import { APP_START_MONTH, formatMonth, getCurrentMonthString, addMonths, clampMonthToAppStart } from '@/utils/format'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import IconButton from '@/components/IconButton'
import Button from '@/components/Button'
import MonthPickerModal from '@/components/MonthPickerModal'
import { cn } from '@/lib/utils'
import {
  getMonthShiftDirection,
  monthLabelAnimationClass,
  type MonthShiftDirection,
} from '@/utils/monthNavigation'

interface MonthSelectorProps {
  value: string
  onChange: (month: string) => void
  isOnline?: boolean
  className?: string
  showLiveOption?: boolean
}

export default function MonthSelector({
  value,
  onChange,
  isOnline = true,
  className = '',
  showLiveOption = false,
}: MonthSelectorProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [labelDirection, setLabelDirection] = useState<MonthShiftDirection>('none')
  const prevValueRef = useRef(value)
  const normalizedValue = clampMonthToAppStart(value)
  const currentMonth = getCurrentMonthString()
  const isCurrentMonth = normalizedValue === currentMonth
  const isAtMinimumMonth = normalizedValue <= APP_START_MONTH

  const prevMonth = addMonths(normalizedValue, -1)
  const nextMonth = addMonths(normalizedValue, 1)

  const isWithinOfflineWindow = (month: string) => {
    const diff = (new Date(month + '-01').getTime() - new Date(currentMonth + '-01').getTime()) / (1000 * 60 * 60 * 24 * 30)
    return Math.abs(Math.round(diff)) <= 1
  }

  const canNavigatePrev = isOnline ? !isAtMinimumMonth : (!isAtMinimumMonth && isWithinOfflineWindow(prevMonth))
  const canNavigateNext = isOnline ? true : isWithinOfflineWindow(nextMonth)
  const canReturnToCurrent = isOnline ? !isCurrentMonth : (isWithinOfflineWindow(currentMonth) && !isCurrentMonth)

  useEffect(() => {
    if (prevValueRef.current !== normalizedValue) {
      setLabelDirection(getMonthShiftDirection(prevValueRef.current, normalizedValue))
      prevValueRef.current = normalizedValue
    }
  }, [normalizedValue])

  const emitMonthChange = (target: string) => {
    if (target === normalizedValue) return
    setLabelDirection(getMonthShiftDirection(normalizedValue, target))
    onChange(target)
  }

  const handlePickerChange = (month: string) => {
    if (month === 'live') {
      emitMonthChange(month)
      return
    }
    const clamped = clampMonthToAppStart(month)
    if (!isOnline && !isWithinOfflineWindow(clamped)) {
      return
    }
    if (clamped < APP_START_MONTH) {
      return
    }
    emitMonthChange(clamped)
  }

  const labelAnimClass = monthLabelAnimationClass(labelDirection)

  return (
    <>
      <div className={cn('mb-4 flex items-center justify-between month-selector', className)}>
        <div className="flex h-10 w-10 items-center justify-center">
          {canNavigatePrev ? (
            <IconButton
              size="sm"
              icon={<ChevronLeft size={18} className="text-primary month-selector-chevron-back" />}
              label="Mês anterior"
              onClick={() => emitMonthChange(prevMonth)}
            />
          ) : null}
        </div>

        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setIsPickerOpen(true)}
            className="group rounded-lg px-2 py-0.5 transition-colors hover:bg-accent"
            aria-label="Abrir seletor de mês"
          >
            <span className="month-selector-label-stage">
              <span
                key={normalizedValue}
                className={cn(
                  'month-selector-label inline-block text-base font-semibold text-primary sm:text-lg',
                  labelAnimClass,
                )}
              >
                {formatMonth(normalizedValue)}
              </span>
            </span>
          </button>
          <div className="flex h-8 items-center justify-center">
            {canReturnToCurrent ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => emitMonthChange(currentMonth)}
                className="h-auto px-2 py-0.5 text-xs text-secondary"
              >
                Voltar ao mês atual
              </Button>
            ) : isCurrentMonth ? (
              <span className="text-xs text-secondary font-medium px-2 py-0.5 select-none">
                Mês atual
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex h-10 w-10 items-center justify-center">
          {canNavigateNext ? (
            <IconButton
              size="sm"
              icon={<ChevronRight size={18} className="text-primary month-selector-chevron-forward" />}
              label="Próximo mês"
              onClick={() => emitMonthChange(nextMonth)}
            />
          ) : null}
        </div>
      </div>

      <MonthPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        value={normalizedValue}
        onChange={handlePickerChange}
        showLiveOption={showLiveOption}
      />
    </>
  )
}
