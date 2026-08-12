import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * 8.3 — Chip holográfico metálico (R10): SVG puro com gradiente e reflexos,
 * reutilizável na face do cartão (Apple Wallet style).
 */
export function CardChip({ className }: { className?: string }) {
  const rawId = useId().replace(/:/g, '')
  const chipId = `chip-${rawId}`
  const lineId = `chip-line-${rawId}`

  return (
    <svg
      viewBox="0 0 44 32"
      width="44"
      height="32"
      className={className}
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id={chipId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5e7b8" />
          <stop offset="45%" stopColor="#d9b45e" />
          <stop offset="100%" stopColor="#9c7426" />
        </linearGradient>
        <linearGradient id={lineId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {/* Corpo do chip */}
      <rect x="1" y="1" width="42" height="30" rx="6" fill={`url(#${chipId})`} stroke="rgba(0,0,0,0.28)" />
      {/* Reflexo superior */}
      <rect x="1" y="1" width="42" height="13" rx="6" fill={`url(#${lineId})`} opacity="0.5" />
      {/* Pistas de contato */}
      <g stroke="rgba(92,64,20,0.5)" strokeWidth="1.4" fill="none" opacity="0.8">
        <path d="M22 1v13M12 1v13M32 1v13" />
        <path d="M9 8h12M9 14h12M33 8h-12M33 14h-12" />
      </g>
      <rect x="9" y="17" width="26" height="12" rx="3" fill="none" stroke="rgba(92,64,20,0.35)" strokeWidth="1" />
    </svg>
  )
}

/**
 * 8.3 — Selo da bandeira (R10): pílula de vidro com o nome da bandeira em
 * caixa alta, contrastando sobre a cor do banco.
 */
export function BrandMark({ brand, className }: { brand?: string | null; className?: string }) {
  const label = (brand || 'Crédito').toUpperCase()
  return (
    <span
      className={cn(
        'px-2.5 py-1 rounded-lg border border-white/25 bg-white/10 backdrop-blur-[6px] text-white/95 font-black tracking-[0.18em] text-[10px] leading-none select-none',
        className
      )}
    >
      {label}
    </span>
  )
}
