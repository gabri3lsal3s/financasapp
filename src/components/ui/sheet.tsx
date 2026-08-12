import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z_INDEX } from '@/constants/zIndex'

/** Distância mínima (px) de arrasto para disparar o dismiss por gesto. */
const DRAG_DISMISS_THRESHOLD = 96
/** Resistência do arrasto (0–1): quanto menor, mais "pesado" o sheet. */
const DRAG_RESISTANCE = 0.55
/** Elementos interativos que não devem iniciar o gesto de arrastar.
 *  NOTA: NÃO incluir `[role="dialog"] *` aqui — o SheetContent tem role="dialog"
 *  e esse seletor casaria com todos os descendentes, impedindo o gesto. */
const DRAG_IGNORE_SELECTOR =
  'button, a, input, select, textarea, [role="button"], [contenteditable="true"]'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      `modal-overlay fixed inset-0 ${Z_INDEX.OVERLAY} data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0`,
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  `fixed ${Z_INDEX.MODAL} gap-4 border-glass p-6 transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:duration-300 data-[state=open]:duration-500 modal-dialog-shell`,
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top rounded-b-3xl',
        bottom:
          'inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom rounded-t-3xl',
        left: 'inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm',
        right:
          'inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {
  showCloseButton?: boolean
  overlayClassName?: string
  /** Habilita swipe-to-dismiss (arrastar para baixo fecha) em sheets side="bottom". */
  dragToDismiss?: boolean
  /** Chamado quando o gesto de arrasto confirma o fechamento. */
  onDragDismiss?: () => void
}

const SheetContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetContentProps
>(({
  side = 'right',
  className,
  children,
  showCloseButton = true,
  overlayClassName,
  dragToDismiss = false,
  onDragDismiss,
  ...props
}, ref) => {
  // ── Swipe-to-dismiss (somente bottom sheets) ───────────────────────────
  const [dragOffset, setDragOffset] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  // Ref espelhada do offset: evita ler estado stale no pointerup (o último
  // pointermove pode não ter sido commitado antes do pointerup disparar).
  const dragOffsetRef = React.useRef(0)
  const dragStateRef = React.useRef<{ startY: number; started: boolean } | null>(null)
  const localRef = React.useRef<HTMLDivElement | null>(null)
  const isBottomSheet = side === 'bottom'

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      localRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    },
    [ref]
  )

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragToDismiss || !isBottomSheet) return
      const target = e.target as HTMLElement
      // Não intercepta controles interativos (botões, inputs, links...)
      if (target.closest(DRAG_IGNORE_SELECTOR)) return
      // Não captura quando a área rolável está deslocada (scroll interno)
      const el = localRef.current
      if (el && el.scrollTop > 0) return

      dragStateRef.current = { startY: e.clientY, started: false }
      e.currentTarget.setPointerCapture?.(e.pointerId)
    },
    [dragToDismiss, isBottomSheet]
  )

  const handlePointerMove = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragStateRef.current
      if (!drag) return
      const dy = e.clientY - drag.startY
      if (!drag.started) {
        // Exige um pequeno movimento para baixo antes de "engatar" o gesto
        if (dy < 8) return
        drag.started = true
        setIsDragging(true)
      }
      if (dy <= 0) return
      const next = dy * DRAG_RESISTANCE
      dragOffsetRef.current = next
      setDragOffset(next)
    },
    []
  )

  const handlePointerUp = React.useCallback(() => {
    const drag = dragStateRef.current
    dragStateRef.current = null
    setIsDragging(false)
    if (!drag?.started) return

    const el = localRef.current
    const sheetHeight = el?.offsetHeight ?? 480
    const currentOffset = dragOffsetRef.current
    if (currentOffset >= DRAG_DISMISS_THRESHOLD || currentOffset >= sheetHeight * 0.18) {
      onDragDismiss?.()
    }
    dragOffsetRef.current = 0
    setDragOffset(0)
  }, [onDragDismiss])

  return (
    <SheetPortal>
      <SheetOverlay className={overlayClassName} />
      <SheetPrimitive.Content
        ref={setRefs}
        className={cn(sheetVariants({ side }), className)}
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : undefined,
          transition: isDragging ? 'none' : undefined,
          // Durante o arrasto, desativa o gesto nativo de scroll para o drag
          // funcionar em touch; fora do arrasto, mantém pan-y (scroll interno).
          touchAction: isBottomSheet && dragToDismiss ? (isDragging ? 'none' : 'pan-y') : undefined,
        }}
        onPointerDown={dragToDismiss && isBottomSheet ? handlePointerDown : undefined}
        onPointerMove={dragToDismiss && isBottomSheet ? handlePointerMove : undefined}
        onPointerUp={dragToDismiss && isBottomSheet ? handlePointerUp : undefined}
        onPointerCancel={dragToDismiss && isBottomSheet ? handlePointerUp : undefined}
        {...props}
      >
        {children}
        {showCloseButton && (
          <SheetPrimitive.Close className="absolute right-4 top-4 rounded-full border border-glass p-1.5 opacity-70 ring-offset-background transition-opacity hover:opacity-100 hover:bg-accent focus:outline-none disabled:pointer-events-none motion-standard">
            <X className="h-4 w-4" />
            <span className="sr-only">Fechar</span>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPortal>
  )
})
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 text-center sm:text-left', className)}
    {...props}
  />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-primary', className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
SheetDescription.displayName = SheetPrimitive.Description.displayName

export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
