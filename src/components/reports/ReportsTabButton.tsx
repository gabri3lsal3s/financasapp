import { ReactNode } from 'react'

interface ReportsTabButtonProps {
  active: boolean
  onClick: () => void
  children: ReactNode
}

export default function ReportsTabButton({ active, onClick, children }: ReportsTabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-1 px-2.5 text-[10px] font-bold rounded-md transition-all ${
        active
          ? 'bg-background text-primary shadow-sm'
          : 'text-secondary hover:text-primary'
      }`}
    >
      {children}
    </button>
  )
}
