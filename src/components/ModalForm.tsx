import { FormEvent, ReactNode, useId } from 'react'
import Modal, { type ModalSize } from '@/components/Modal'
import { cn } from '@/lib/utils'

interface ModalFormProps {
  isOpen: boolean
  onClose: () => void
  title: string
  onSubmit: (e: FormEvent<HTMLFormElement>) => void
  footer: (formId: string) => ReactNode
  children: ReactNode
  header?: ReactNode
  formClassName?: string
  bodyClassName?: string
  size?: ModalSize
  zIndexClass?: string
}

/** Modal com formulário rolável e rodapé fixo padronizado. */
export default function ModalForm({
  isOpen,
  onClose,
  title,
  onSubmit,
  footer,
  children,
  header,
  formClassName,
  bodyClassName,
  size,
  zIndexClass,
}: ModalFormProps) {
  const formId = useId()

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      header={header}
      footer={footer(formId)}
      bodyClassName={bodyClassName}
      size={size}
      zIndexClass={zIndexClass}
    >
      <form
        id={formId}
        onSubmit={onSubmit}
        className={cn('modal-form-stack w-full text-left', formClassName)}
      >
        {children}
      </form>
    </Modal>
  )
}
