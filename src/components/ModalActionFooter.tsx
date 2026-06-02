import Button from '@/components/Button'
import { Trash2, Check } from 'lucide-react'

interface ModalActionFooterProps {
  submitLabel?: string
  submitDisabled?: boolean
  deleteLabel?: string
  onDelete?: () => void
  onCancel?: () => void
  cancelLabel?: string
  onSubmit?: (e?: React.MouseEvent<HTMLButtonElement>) => void
}

export default function ModalActionFooter({
  submitLabel,
  submitDisabled = false,
  deleteLabel,
  onDelete,
  // onCancel: _onCancel, // Intentionally unused to satisfy props
  // cancelLabel: _cancelLabel, // Intentionally unused to satisfy props
  onSubmit,
}: ModalActionFooterProps) {
  return (
    <div className="flex pt-4 justify-center items-center gap-4">
      {onDelete && deleteLabel && (
        <Button
          type="button"
          variant="ghost-danger"
          className="px-3 flex-shrink-0"
          onClick={onDelete}
          title={deleteLabel}
        >
          <Trash2 size={24} />
        </Button>
      )}
      {submitLabel && (
        <Button
          type={onSubmit ? "button" : "submit"}
          variant="ghost-success"
          className="px-3 flex-shrink-0"
          disabled={submitDisabled}
          title={submitLabel}
          onClick={onSubmit}
        >
          <Check size={24} />
        </Button>
      )}
    </div>
  )
}
