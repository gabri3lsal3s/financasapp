import ModalFooter from '@/components/ModalFooter'

interface ModalActionFooterProps {
  formId?: string
  submitLabel?: string
  submitDisabled?: boolean
  deleteLabel?: string
  onDelete?: () => void
  onCancel?: () => void
  cancelLabel?: string
  onSubmit?: (e?: React.MouseEvent<HTMLButtonElement>) => void
}

/** @deprecated Prefer `ModalFooter` — mantido para compatibilidade; delega ao footer híbrido. */
export default function ModalActionFooter(props: ModalActionFooterProps) {
  return <ModalFooter {...props} />
}
