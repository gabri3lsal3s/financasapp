import type { ReactNode } from 'react'
import Button, { type ButtonVariant } from '@/components/Button'
import { useMediaQuery } from '@/hooks/useMediaQuery'
import { Trash2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalFooterProps {
  formId?: string
  submitLabel?: string
  submitDisabled?: boolean
  submitVariant?: ButtonVariant
  submitIcon?: ReactNode
  deleteLabel?: string
  onDelete?: () => void
  onCancel?: () => void
  cancelLabel?: string
  onSubmit?: (e?: React.MouseEvent<HTMLButtonElement>) => void
  loading?: boolean
  loadingLabel?: string
  className?: string
}

/** Rodapé híbrido: ícones no mobile, botões textuais no desktop (sm+). */
export default function ModalFooter({
  formId,
  submitLabel,
  submitDisabled = false,
  submitVariant = 'primary',
  submitIcon,
  deleteLabel,
  onDelete,
  onCancel,
  cancelLabel = 'Cancelar',
  onSubmit,
  loading = false,
  loadingLabel,
  className,
}: ModalFooterProps) {
  const isDesktop = useMediaQuery('(min-width: 640px)')

  if (isDesktop) {
    return (
      <div className={cn('modal-footer-hybrid modal-button-footer', className)}>
        {onCancel ? (
          <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
        ) : null}
        {onDelete && deleteLabel ? (
          <Button type="button" variant="danger" size="sm" onClick={onDelete} disabled={loading}>
            {deleteLabel}
          </Button>
        ) : null}
        {submitLabel ? (
          <Button
            type={onSubmit ? 'button' : 'submit'}
            form={formId}
            variant={submitVariant}
            size="sm"
            disabled={submitDisabled || loading}
            className="inline-flex items-center gap-1.5 font-bold shadow-md"
            onClick={onSubmit}
          >
            {submitIcon}
            {loading ? (loadingLabel ?? submitLabel) : submitLabel}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('modal-footer-hybrid modal-action-footer', className)}>
      {onDelete && deleteLabel ? (
        <Button
          type="button"
          variant="ghost-danger"
          className="px-3 flex-shrink-0"
          onClick={onDelete}
          title={deleteLabel}
          aria-label={deleteLabel}
          disabled={loading}
        >
          <Trash2 size={24} />
        </Button>
      ) : null}
      {submitLabel ? (
        <Button
          type={onSubmit ? 'button' : 'submit'}
          form={formId}
          variant="ghost-success"
          className="px-3 flex-shrink-0"
          disabled={submitDisabled || loading}
          title={submitLabel}
          aria-label={submitLabel}
          onClick={onSubmit}
        >
          <Check size={24} />
        </Button>
      ) : null}
    </div>
  )
}
