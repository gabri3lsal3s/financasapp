import { ReactNode, useId } from 'react'
import { X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { isCalculatorElement } from '@/utils/calculator'
import { Z_INDEX, type ZIndexElevated } from '@/constants/zIndex'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

const MODAL_SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  '2xl': 'max-w-5xl',
  full: 'max-w-[min(100vw-1.5rem,64rem)]',
}

const MODAL_STACK = {
  default: { overlay: `${Z_INDEX.OVERLAY} modal-overlay`, content: Z_INDEX.MODAL },
  elevated: { overlay: `${Z_INDEX.SIDE_STACK} modal-overlay`, content: Z_INDEX.ELEVATED },
} as const

/** Padding horizontal/vertical padrão do corpo (sobrescreva com `bodyClassName`, ex. `modal-body-flush`). */
export const MODAL_BODY_PADDING = 'modal-body-padding'

function ModalFooterShell({ children }: { children: ReactNode }) {
  return (
    <div className="modal-glass-footer shrink-0">
      <div className="modal-footer-inner">{children}</div>
    </div>
  )
}

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  /** Usado para acessibilidade (aria) quando `header` customizado é informado */
  title: string
  children: ReactNode
  /** Substitui o título textual padrão; o botão fechar permanece à direita */
  header?: ReactNode
  /** Fixo abaixo da área rolável */
  footer?: ReactNode
  bodyClassName?: string
  size?: ModalSize
  /** Quando informado como Z_INDEX.ELEVATED, usa o stack elevado (z-[1200]) */
  zIndexClass?: ZIndexElevated
}

function resolveWidthClass(size?: ModalSize): string {
  if (size) return MODAL_SIZE_CLASSES[size]
  return MODAL_SIZE_CLASSES.md
}

function resolveStack(zIndexClass?: string) {
  return zIndexClass === Z_INDEX.ELEVATED ? MODAL_STACK.elevated : MODAL_STACK.default
}

function ModalCloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Fechar"
      className="shrink-0 rounded-full border border-glass p-1.5 text-secondary motion-standard hover:bg-accent hover:text-primary focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)]"
    >
      <X size={16} aria-hidden />
    </button>
  )
}

function ModalShellHeader({
  title,
  titleId,
  onClose,
  header,
}: {
  title: string
  titleId: string
  onClose: () => void
  header?: ReactNode
}) {
  return (
    <div className="modal-glass-header flex w-full shrink-0 items-center justify-between gap-3">
      {header ? (
        <div id={titleId} className="min-w-0 flex-1">
          {header}
        </div>
      ) : (
        <h2 id={titleId} className="min-w-0 flex-1 text-base font-bold uppercase tracking-tight text-primary sm:text-lg">
          {title}
        </h2>
      )}
      <ModalCloseButton onClose={onClose} />
    </div>
  )
}

function ModalScrollBody({
  children,
  bodyClassName,
}: {
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <div
      className={cn(
        'modal-glass-body min-h-0 flex-1 overflow-y-auto text-primary',
        MODAL_BODY_PADDING,
        bodyClassName
      )}
    >
      <div className="modal-body-inner w-full text-left">{children}</div>
    </div>
  )
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  header,
  footer,
  bodyClassName,
  size,
  zIndexClass,
}: ModalProps) {
  const titleId = useId()
  const isMobile = useMediaQuery('(max-width: 639px)')
  const widthClass = resolveWidthClass(size)
  const stack = resolveStack(zIndexClass)

  if (isMobile) {
    return (
      <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          overlayClassName={stack.overlay}
          aria-describedby={undefined}
          onPointerDownOutside={(e) => {
            if (isCalculatorElement(e.target)) {
              e.preventDefault()
            }
          }}
          onInteractOutside={(e) => {
            if (isCalculatorElement(e.target)) {
              e.preventDefault()
            }
          }}
          className={cn(
            stack.content,
            'modal-sheet-bottom flex min-h-0 max-h-[min(92vh,900px)] flex-col gap-0 overflow-hidden rounded-t-3xl border-glass p-0',
            footer ? 'pb-0' : 'pb-[max(1rem,env(safe-area-inset-bottom))]'
          )}
        >
          <div className="modal-drag-handle shrink-0" aria-hidden />
          <SheetHeader className="shrink-0 space-y-0 p-0 text-left">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <ModalShellHeader title={title} titleId={titleId} onClose={onClose} header={header} />
          </SheetHeader>
          <ModalScrollBody bodyClassName={bodyClassName}>{children}</ModalScrollBody>
          {footer ? (
            <div className="pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <ModalFooterShell>{footer}</ModalFooterShell>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={stack.overlay}
        aria-describedby={undefined}
        onPointerDownOutside={(e) => {
          if (isCalculatorElement(e.target)) {
            e.preventDefault()
          }
        }}
        onInteractOutside={(e) => {
          if (isCalculatorElement(e.target)) {
            e.preventDefault()
          }
        }}
        className={cn(
          stack.content,
          widthClass,
          'modal-dialog-shell flex min-h-0 w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:w-full'
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 p-0 text-left">
          <DialogTitle className="sr-only">{title}</DialogTitle>
          <ModalShellHeader title={title} titleId={titleId} onClose={onClose} header={header} />
        </DialogHeader>
        <ModalScrollBody bodyClassName={bodyClassName}>{children}</ModalScrollBody>
        {footer ? <ModalFooterShell>{footer}</ModalFooterShell> : null}
      </DialogContent>
    </Dialog>
  )
}
