import { cn } from '@/lib/utils'
import { Z_INDEX } from '@/constants/zIndex'

export type DesktopPosition = 'right' | 'top'
export type MobilePosition = 'right' | 'left'

export const FLOATING_SIDE_STACK_ID = 'floating-side-stack'
export const PAGE_ACTIONS_PORTAL_ID = 'page-actions-portal-root'
export const CALCULATOR_SIDE_SLOT_ID = 'floating-calculator-side-slot'

export const FLOATING_SIDE_BUTTON_HEIGHT = 'h-10 min-h-10 max-h-10 shrink-0 box-border py-0'
export const FLOATING_MOBILE_BOTTOM = 'bottom-[calc(6.5rem+env(safe-area-inset-bottom))]'
/** Ancoragem superior do stack lateral — mobile e desktop. */
export const FLOATING_SIDE_TOP =
  'top-[calc(env(safe-area-inset-top)+6rem)] lg:top-52 xl:top-60'
export const FLOATING_SIDE_GAP = 'gap-2'
export const FLOATING_FAB_BOTTOM = FLOATING_MOBILE_BOTTOM

export const FLOATING_SIDE_BUTTON_BASE =
  'group relative flex items-center justify-start transition-all duration-300 select-none pointer-events-auto glass-button-side press-subtle motion-spring focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]'

export const FLOATING_SIDE_BUTTON_SURFACE =
  'border-[var(--floating-btn-border)] hover:border-[var(--floating-btn-border-hover)] hover:bg-accent/40'

export const FLOATING_SIDE_FAB_BASE = cn(
  FLOATING_SIDE_BUTTON_HEIGHT,
  'w-10 min-w-10 rounded-full flex items-center justify-center pointer-events-auto glass-button-side press-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] transition-all duration-300 hover:scale-110 border border-[var(--floating-btn-border)] hover:border-[var(--floating-btn-border-hover)] motion-standard hover-lift-subtle'
)

export const FLOATING_SIDE_BUTTON_NEUTRAL =
  cn('text-primary', FLOATING_SIDE_BUTTON_SURFACE)

export type FloatingSidePosition = DesktopPosition | MobilePosition

export function getFloatingSideSlideClasses(side: FloatingSidePosition): string {
  if (side === 'top') {
    return '-translate-y-2'
  }
  if (side === 'left') {
    return '-translate-x-2'
  }
  return 'translate-x-2'
}

export function getFloatingSideShapeClasses(side: FloatingSidePosition): string {
  if (side === 'top') {
    return 'rounded-none rounded-b-2xl rounded-t-none border-x border-b border-t-0 pt-2.5 pb-2 px-4'
  }
  if (side === 'left') {
    return 'rounded-none rounded-r-2xl rounded-l-none border-y border-r border-l-0 pl-6 pr-4 min-w-10'
  }
  return 'rounded-none rounded-l-2xl rounded-r-none border-y border-l border-r-0 pl-4 pr-6 min-w-10'
}

/** Classes compartilhadas entre botões laterais da página e calculadora em modo aba. */
export function getFloatingSideTabButtonClassName(
  side: FloatingSidePosition,
  extras?: string
): string {
  return cn(
    FLOATING_SIDE_BUTTON_BASE,
    FLOATING_SIDE_BUTTON_HEIGHT,
    getFloatingSideShapeClasses(side),
    getFloatingSideSlideClasses(side),
    extras
  )
}

export function getFloatingSideStackClasses(activePosition: FloatingSidePosition): string {
  const stackZ = `${Z_INDEX.SIDE_STACK}`
  if (activePosition === 'top') {
    return cn(
      `fixed ${stackZ} pointer-events-none flex flex-row items-start overflow-visible right-8 top-0`,
      FLOATING_SIDE_GAP
    )
  }

  if (activePosition === 'left') {
    return cn(
      `fixed ${stackZ} pointer-events-none flex flex-col items-start overflow-visible left-0`,
      FLOATING_SIDE_GAP,
      FLOATING_SIDE_TOP
    )
  }

  return cn(
    `fixed ${stackZ} pointer-events-none flex flex-col items-end overflow-visible right-0`,
    FLOATING_SIDE_GAP,
    FLOATING_SIDE_TOP
  )
}
