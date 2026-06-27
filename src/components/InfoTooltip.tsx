import { useState, useRef, useEffect } from 'react'
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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const placementClasses = {
    center: 'left-1/2 -translate-x-1/2',
    left: 'left-0',
    right: 'right-0'
  }

  const arrowClasses = {
    center: 'left-1/2 -translate-x-1/2',
    left: 'left-3 translate-x-0',
    right: 'right-3 translate-x-0'
  }

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-flex items-center', className)}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        className="text-secondary hover:text-primary transition-colors focus:outline-none p-0.5 rounded-full hover:bg-glass/10 cursor-help select-none"
        aria-label="Ajuda explicativa"
      >
        <HelpCircle size={iconSize} className="shrink-0" />
      </button>

      {visible && (
        <div
          className={cn(
            `absolute bottom-full mb-2 w-64 p-3 surface-glass-strong border border-glass rounded-xl shadow-lg text-[10px] text-secondary font-medium leading-relaxed ${Z_INDEX.POPOVER} animate-in fade-in slide-in-from-bottom-1 duration-200 pointer-events-none`,
            placementClasses[placement]
          )}
          role="tooltip"
        >
          {/* Arrow element */}
          <div
            className={cn(
              'absolute top-full -mt-1 w-2 h-2 bg-[var(--glass-surface-strong)] border-r border-b border-glass rotate-45',
              arrowClasses[placement]
            )}
          />
          {content}
        </div>
      )}
    </div>
  )
}
