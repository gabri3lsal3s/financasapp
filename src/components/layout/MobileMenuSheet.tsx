import type { Ref } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, LogOut, PiggyBank, Settings, Tags } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import Button from '@/components/Button'
import { isCalculatorElement } from '@/utils/calculator'

interface MobileMenuSheetProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  contentRef: Ref<HTMLDivElement>
  isOnline: boolean
  onLogout: () => void
}

/** Menu "Mais Opções" mobile (bottom sheet) — destinos secundários + logout. */
export default function MobileMenuSheet({
  isOpen,
  onOpenChange,
  contentRef,
  isOnline,
  onLogout,
}: MobileMenuSheetProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        ref={contentRef}
        side="bottom"
        showCloseButton={false}
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
        className="modal-sheet-bottom max-h-[85vh] rounded-t-3xl safe-area-bottom gap-0 p-0"
      >
        <div className="modal-drag-handle shrink-0" />
        <SheetHeader className="modal-glass-header text-left">
          <SheetTitle className="text-base font-bold uppercase tracking-wide text-primary">
            Mais Opções
          </SheetTitle>
        </SheetHeader>
        <div className="p-5 overflow-y-auto max-h-[calc(85vh-5.5rem)]">
          <div className="grid grid-cols-2 gap-3">
            <Link
              to="/investments"
              className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
            >
              <PiggyBank size={20} className="text-secondary mb-2" />
              <span className="text-xs font-bold text-primary">Investimentos</span>
            </Link>
            {isOnline && (
              <Link
                to="/reports"
                className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
              >
                <BarChart3 size={20} className="text-secondary mb-2" />
                <span className="text-xs font-bold text-primary">Relatórios</span>
              </Link>
            )}
            {isOnline && (
              <Link
                to="/categories"
                className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
              >
                <Tags size={20} className="text-secondary mb-2" />
                <span className="text-xs font-bold text-primary">Categorias</span>
              </Link>
            )}
            <Link
              to="/settings"
              className="flex flex-col items-center justify-center p-4 surface-glass border border-glass rounded-2xl motion-standard hover-lift-subtle press-subtle select-none"
            >
              <Settings size={20} className="text-secondary mb-2" />
              <span className="text-xs font-bold text-primary">Ajustes</span>
            </Link>

            <Button
              variant="danger"
              onClick={onLogout}
              className="col-span-2 mt-2 uppercase tracking-wider text-xs"
            >
              <LogOut size={16} />
              Sair do App
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
