import { TouchEvent, useRef } from 'react'

export function useSwipeYear(
  currentYear: number,
  onChange: (year: number) => void
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
          // Swipe Left -> Next Year
          onChange(currentYear + 1)
        } else {
          // Swipe Right -> Previous Year
          onChange(currentYear - 1)
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
