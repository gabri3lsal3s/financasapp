import Button from '@/components/Button'

interface ModalActionFooterProps {
  submitLabel: string
  onCancel: () => void
  cancelLabel?: string
  submitDisabled?: boolean
  deleteLabel?: string
  onDelete?: () => void
}

export default function ModalActionFooter({
  submitLabel,
  onCancel,
  cancelLabel = 'Cancelar',
  submitDisabled = false,
  deleteLabel,
  onDelete,
}: ModalActionFooterProps) {
  return (
    <>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" fullWidth onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button type="submit" fullWidth disabled={submitDisabled}>
          {submitLabel}
        </Button>
      </div>

      {onDelete && deleteLabel && (
        <Button type="button" variant="danger" fullWidth onClick={onDelete}>
          {deleteLabel}
        </Button>
      )}
    </>
  )
}
