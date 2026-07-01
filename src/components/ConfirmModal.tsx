import { useState, useEffect, type ReactNode } from 'react'
import Modal, { type ModalSize } from '@/components/Modal'
import ModalFooter from '@/components/ModalFooter'
import Button from '@/components/Button'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: ReactNode
  confirmLabel: string
  onConfirm: () => void
  confirmVariant?: 'danger' | 'primary'
  confirmDisabled?: boolean
  loading?: boolean
  cancelLabel?: string
  layout?: 'hybrid' | 'stacked'
  size?: ModalSize
  requireCheckbox?: boolean
  checkboxLabel?: string
}

/** Modal de confirmação destrutiva ou de 2 passos. */
export default function ConfirmModal({
  isOpen,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  confirmVariant = 'danger',
  confirmDisabled = false,
  loading = false,
  cancelLabel = 'Cancelar',
  layout = 'hybrid',
  size = 'md',
  requireCheckbox = false,
  checkboxLabel,
}: ConfirmModalProps) {
  const [isChecked, setIsChecked] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsChecked(false)
    }
  }, [isOpen])

  const isConfirmDisabled = confirmDisabled || (requireCheckbox && !isChecked)

  const checkboxElement = requireCheckbox && (
    <label className="flex items-start gap-2.5 p-3 rounded-xl border border-glass surface-glass hover:bg-glass-strong cursor-pointer text-xs select-none transition-all mt-4">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => setIsChecked(e.target.checked)}
        className="mt-0.5 rounded border-glass bg-glass text-expense focus:ring-offset-0 focus:ring-expense shrink-0 cursor-pointer"
        aria-label={checkboxLabel || 'Confirmo que estou ciente desta ação'}
      />
      <span className="text-secondary font-medium leading-relaxed">
        {checkboxLabel || 'Estou ciente de que esta ação é permanente e não poderá ser desfeita.'}
      </span>
    </label>
  )

  if (layout === 'stacked') {
    return (
      <Modal
        isOpen={isOpen}
        onClose={() => !loading && onClose()}
        title={title}
        size={size}
        footer={
          <div className="modal-actions-stacked">
            <Button
              variant={confirmVariant === 'danger' ? 'danger' : 'primary'}
              onClick={onConfirm}
              disabled={isConfirmDisabled || loading}
              className="flex w-full items-center justify-center gap-2 py-3 font-bold"
            >
              {loading ? 'Processando...' : confirmLabel}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="flex w-full items-center justify-center py-3"
            >
              {cancelLabel}
            </Button>
          </div>
        }
      >
        <div className="modal-body-stack">
          {children}
          {checkboxElement}
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => !loading && onClose()}
      title={title}
      size={size}
      footer={
        <ModalFooter
          onCancel={onClose}
          cancelLabel={cancelLabel}
          submitLabel={confirmLabel}
          submitVariant={confirmVariant === 'danger' ? 'danger' : 'primary'}
          submitDisabled={isConfirmDisabled}
          loading={loading}
          onSubmit={onConfirm}
        />
      }
    >
      <div className="modal-body-stack">
        {children}
        {checkboxElement}
      </div>
    </Modal>
  )
}
