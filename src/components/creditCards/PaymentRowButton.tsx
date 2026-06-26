import type { ReactNode } from 'react'
import RowButton from '@/components/RowButton'

interface PaymentRowButtonProps {
  children: ReactNode
  onClick: () => void
}

export default function PaymentRowButton({ children, onClick }: PaymentRowButtonProps) {
  return (
    <RowButton onClick={onClick}>
      {children}
    </RowButton>
  )
}
