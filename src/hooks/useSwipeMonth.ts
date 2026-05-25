import { TouchEvent, useRef } from 'react'
import { addMonths } from '@/utils/format'

export function useSwipeMonth(
  currentMonth: string,
  onChange: (month: string) => void
) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)

  const onTouchStart = (e: TouchEvent) => {
    const touch = e.touches[0]
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    }
  }

  const onTouchEnd = (e: TouchEvent) => {
    if (!touchStartRef.current) return
    const touch = e.changedTouches[0]
    if (touch) {
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y

      // Only trigger if horizontal swipe is dominant and exceeds 75px threshold
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 75) {
        if (deltaX < 0) {
          // Swipe Left -> Next Month
          const nextMonth = addMonths(currentMonth, 1)
          onChange(nextMonth)
        } else {
          // Swipe Right -> Previous Month
          const prevMonth = addMonths(currentMonth, -1)
          onChange(prevMonth)
        }
      }
    }
    touchStartRef.current = null
  }

  return {
    onTouchStart,
    onTouchEnd,
  }
}
