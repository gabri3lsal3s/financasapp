import type { ReactNode } from 'react'
import Button from '@/components/Button'

interface PaymentRowButtonProps {
  children: ReactNode
  onClick: () => void
}

export default function PaymentRowButton({ children, onClick }: PaymentRowButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="w-full h-auto text-left flex-col items-stretch p-2.5"
    >
      {children}
    </Button>
  )
}
