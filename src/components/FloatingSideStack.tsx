import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  CALCULATOR_SIDE_SLOT_ID,
  getFloatingSideStackClasses,
  FLOATING_SIDE_STACK_ID,
} from '@/components/floatingSideLayout'

/** Container fixo compartilhado — usado apenas para ancorar a calculadora em modo aba lateral. */
export default function FloatingSideStack() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div id={FLOATING_SIDE_STACK_ID} className={getFloatingSideStackClasses('right')}>
      <div id={CALCULATOR_SIDE_SLOT_ID} className="pointer-events-none h-10 w-10 shrink-0" />
    </div>,
    document.body
  )
}
