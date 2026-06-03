import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useFloatingActions } from '@/hooks/useFloatingActions'
import {
  CALCULATOR_SIDE_SLOT_ID,
  getFloatingSideStackClasses,
  PAGE_ACTIONS_PORTAL_ID,
  FLOATING_SIDE_STACK_ID,
} from '@/components/floatingSideLayout'

/** Container fixo compartilhado para botões laterais da página e calculadora em modo aba. */
export default function FloatingSideStack() {
  const { actions } = useFloatingActions()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return createPortal(
    <div id={FLOATING_SIDE_STACK_ID} className={getFloatingSideStackClasses('right')}>
      <div id={PAGE_ACTIONS_PORTAL_ID}>{actions}</div>
      <div id={CALCULATOR_SIDE_SLOT_ID} className="pointer-events-none h-10 w-10 shrink-0" />
    </div>,
    document.body
  )
}
