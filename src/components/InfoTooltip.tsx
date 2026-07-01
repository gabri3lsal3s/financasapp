import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Z_INDEX } from '@/constants/zIndex'

interface InfoTooltipProps {
  content: string
  className?: string
  iconSize?: number
  placement?: 'center' | 'left' | 'right'
}

export default function InfoTooltip({
  content,
  className = '',
  iconSize = 14,
  placement = 'center'
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({})

  const updatePosition = useCallback(() => {
    if (!buttonRef.current || !visible) return
    const rect = buttonRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2

    let left: number
    if (placement === 'left') {
      left = rect.left
    } else if (placement === 'right') {
      left = rect.right - 256 // w-64 = 256px
    } else {
      left = centerX - 128 // 128 = half of 256px (w-64)
    }

    // Reposition if near viewport edges
    const tooltipWidth = 256
    if (left + tooltipWidth > window.innerWidth - 8) {
      left = window.innerWidth - tooltipWidth - 8
    }
    if (left < 8) {
      left = 8
    }

    setTooltipStyle({
      position: 'fixed' as const,
      bottom: window.innerHeight - rect.top + 6,
      left,
      zIndex: 150,
    })
  }, [visible, placement])

  useEffect(() => {
    if (!visible) return
    updatePosition()

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, updatePosition])

  // Click outside to close — sem overlay destrutivo
  useEffect(() => {
    if (!visible) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setVisible(false)
      }
    }
    // Delay para evitar que o clique que abriu o tooltip o feche imediatamente
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [visible])

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
    >
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="text-secondary hover:text-primary transition-colors focus:outline-none p-0.5 rounded-full hover:bg-glass/10 cursor-help select-none"
        aria-label="Ajuda explicativa"
      >
        <HelpCircle size={iconSize} className="shrink-0" />
      </button>

      {visible && typeof document !== 'undefined' && createPortal(
        <div
          style={tooltipStyle}
          className={cn(
            'fixed w-64 p-3 surface-glass-strong border border-glass rounded-xl shadow-lg text-[10px] text-secondary font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-200 pointer-events-none',
            Z_INDEX.POPOVER,
          )}
          role="tooltip"
        >
          {/* Arrow pointing down */}
          <div
            className={cn(
              'absolute -bottom-1 w-2 h-2 bg-[var(--glass-surface-strong)] border-r border-b border-glass rotate-45',
              placement === 'center' && 'left-1/2 -translate-x-1/2',
              placement === 'left' && 'left-3 translate-x-0',
              placement === 'right' && 'right-3 translate-x-0',
            )}
          />
          {content}
        </div>,
        document.body
      )}
    </div>
  )
}
