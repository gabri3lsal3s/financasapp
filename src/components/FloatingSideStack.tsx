import { useFloatingActions } from '@/hooks/useFloatingActions'
import {
  CALCULATOR_SIDE_SLOT_ID,
  getFloatingSideStackClasses,
  PAGE_ACTIONS_PORTAL_ID,
} from '@/components/floatingSideLayout'

/** Container fixo compartilhado para botões laterais da página e calculadora em modo aba. */
export default function FloatingSideStack() {
  const { actions } = useFloatingActions()

  return (
    <div className={getFloatingSideStackClasses('right')}>
      <div id={PAGE_ACTIONS_PORTAL_ID}>{actions}</div>
      <div id={CALCULATOR_SIDE_SLOT_ID} className="pointer-events-none empty:hidden" />
    </div>
  )
}
