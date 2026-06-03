import type { ReactNode } from 'react'
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
}: ConfirmModalProps) {
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
              disabled={confirmDisabled || loading}
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
        <div className="modal-body-stack">{children}</div>
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
          submitDisabled={confirmDisabled}
          loading={loading}
          onSubmit={onConfirm}
        />
      }
    >
      <div className="modal-body-stack">{children}</div>
    </Modal>
  )
}
