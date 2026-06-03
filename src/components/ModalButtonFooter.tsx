import type { ReactNode } from 'react'
import ModalFooter from '@/components/ModalFooter'
import type { ButtonVariant } from '@/components/Button'

interface ModalButtonFooterProps {
  formId?: string
  onCancel?: () => void
  cancelLabel?: string
  submitLabel: string
  submitVariant?: ButtonVariant
  submitIcon?: ReactNode
  submitDisabled?: boolean
  loading?: boolean
  loadingLabel?: string
  className?: string
}

/** @deprecated Prefer `ModalFooter` — mantido para compatibilidade; delega ao footer híbrido. */
export default function ModalButtonFooter(props: ModalButtonFooterProps) {
  return <ModalFooter {...props} />
}
