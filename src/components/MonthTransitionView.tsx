import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  getMonthShiftDirection,
  monthShiftAnimationClass,
  type MonthShiftDirection,
} from '@/utils/monthNavigation'

interface MonthTransitionViewProps {
  month: string
  children: React.ReactNode
  className?: string
}

export default function MonthTransitionView({ month, children, className }: MonthTransitionViewProps) {
  const prevMonthRef = useRef(month)
  const direction: MonthShiftDirection =
    prevMonthRef.current !== month
      ? getMonthShiftDirection(prevMonthRef.current, month)
      : 'none'

  useEffect(() => {
    prevMonthRef.current = month
  }, [month])

  return (
    <div
      key={month}
      className={cn('month-transition-view', monthShiftAnimationClass(direction), className)}
    >
      {children}
    </div>
  )
}
