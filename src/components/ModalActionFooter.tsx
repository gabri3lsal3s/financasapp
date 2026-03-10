import Button from '@/components/Button'
import { Trash2, Check } from 'lucide-react'

interface ModalActionFooterProps {
  submitLabel: string
  submitDisabled?: boolean
  deleteLabel?: string
  onDelete?: () => void
  onCancel?: () => void
  cancelLabel?: string
}

export default function ModalActionFooter({
  submitLabel,
  submitDisabled = false,
  deleteLabel,
  onDelete,
  // onCancel: _onCancel, // Intentionally unused to satisfy props
  // cancelLabel: _cancelLabel, // Intentionally unused to satisfy props
}: ModalActionFooterProps) {
  return (
    <div className="flex pt-4 justify-center items-center gap-4">
      {onDelete && deleteLabel && (
        <Button
          type="button"
          variant="ghost"
          className="btn-discrete-delete px-3 flex-shrink-0"
          onClick={onDelete}
          title={deleteLabel}
        >
          <Trash2 size={24} />
        </Button>
      )}
      <Button
        type="submit"
        variant="ghost"
        className="btn-discrete-save px-3 flex-shrink-0"
        disabled={submitDisabled}
        title={submitLabel}
      >
        <Check size={24} />
      </Button>
    </div>
  )
}
