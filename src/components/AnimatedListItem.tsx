import { ReactNode, useEffect, useState } from 'react'

interface Props {
  children: ReactNode
  className?: string
  isRemoving?: boolean
}

export default function AnimatedListItem({ children, className = '', isRemoving = false }: Props) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // trigger mount animation
    const t = setTimeout(() => setMounted(true), 10)
    return () => clearTimeout(t)
  }, [])

  const enterClass = mounted ? 'animate-fade-in' : ''
  const exitClass = isRemoving ? 'animate-fade-out animate-slide-down' : ''

  return (
    <div className={`${enterClass} ${exitClass} ${className}`.trim()}>
      {children}
    </div>
  )
}
