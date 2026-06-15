import { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import ReconciliationBadge, { BadgeVariant } from './ReconciliationBadge'
import { cn } from '@/lib/utils'

interface ReconciliationSideBySideProps {
  leftTitle: string
  leftBadgeText?: string
  leftBadgeVariant?: BadgeVariant
  leftContent: ReactNode
  rightTitle: string
  rightBadgeText?: string
  rightBadgeVariant?: BadgeVariant
  rightContent: ReactNode
  arrowIcon?: boolean
  className?: string
}

export default function ReconciliationSideBySide({
  leftTitle,
  leftBadgeText,
  leftBadgeVariant = 'system',
  leftContent,
  rightTitle,
  rightBadgeText,
  rightBadgeVariant = 'official',
  rightContent,
  arrowIcon = true,
  className = '',
}: ReconciliationSideBySideProps) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-11 gap-3 items-center', className)}>
      {/* Left panel (usually System) */}
      <div className="md:col-span-5 modal-panel-glass p-2.5 rounded-xl text-xs space-y-1">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-primary font-bold">{leftTitle}</strong>
          {leftBadgeText && (
            <ReconciliationBadge variant={leftBadgeVariant}>
              {leftBadgeText}
            </ReconciliationBadge>
          )}
        </div>
        {leftContent}
      </div>

      {/* Center divider (arrow) */}
      <div className="md:col-span-1 flex items-center justify-center text-secondary py-1 md:py-0">
        {arrowIcon && <ArrowRight size={18} className="rotate-90 md:rotate-0" />}
      </div>

      {/* Right panel (usually Official) */}
      <div className="md:col-span-5 border border-[color-mix(in_srgb,var(--color-balance)_25%,var(--glass-border))] bg-[color-mix(in_srgb,var(--color-balance)_6%,var(--glass-layer-panel))] p-2.5 rounded-xl text-xs space-y-1">
        <div className="flex justify-between items-center mb-1">
          <strong className="text-primary font-bold">{rightTitle}</strong>
          {rightBadgeText && (
            <ReconciliationBadge variant={rightBadgeVariant}>
              {rightBadgeText}
            </ReconciliationBadge>
          )}
        </div>
        {rightContent}
      </div>
    </div>
  )
}
