import { useCallback, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import AmountText from '@/components/ui/amount-text'
import { CardChip, BrandMark } from '@/components/ui/card-hologram'
import { BANK_CARD_SCRIM } from '@/utils/bankBranding'
import { ensureHexColor } from '@/utils/colorValue'
import { useMediaQuery } from '@/hooks/useMediaQuery'

interface CreditCardFaceProps {
  cardName: string
  brand?: string | null
  color: string
  limitTotal?: number | null
  currentBill?: number
  closingDay: number
  dueDay: number
}

const MAX_TILT = 6

/** Cor térmica da barra de limite: esmeralda → âmbar → coral conforme consumo (8.3). */
function limitBarColor(usage: number) {
  if (usage >= 0.8) return 'var(--color-expense)'
  if (usage >= 0.6) return 'var(--color-warning)'
  return 'var(--color-income)'
}

/**
 * 8.3 — Cartão estilo Apple Wallet 3D (R10): face premium com a cor
 * institucional do banco + scrim, chip holográfico, selo da bandeira e barra
 * térmica de limite. Tilt 3D sutil no hover apenas em desktop (sem conflito
 * de gestos no mobile).
 */
export default function CreditCardFace({
  cardName,
  brand,
  color,
  limitTotal,
  currentBill = 0,
  closingDay,
  dueDay,
}: CreditCardFaceProps) {
  const canTilt = useMediaQuery('(hover: hover) and (min-width: 1024px)')
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const faceRef = useRef<HTMLDivElement>(null)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!canTilt || !faceRef.current) return
      const rect = faceRef.current.getBoundingClientRect()
      const px = (e.clientX - rect.left) / rect.width - 0.5
      const py = (e.clientY - rect.top) / rect.height - 0.5
      setTilt({ x: -py * MAX_TILT, y: px * MAX_TILT })
    },
    [canTilt]
  )

  const handleMouseLeave = useCallback(() => setTilt({ x: 0, y: 0 }), [])

  const baseColor = ensureHexColor(color)
  const usage = limitTotal && limitTotal > 0 ? Math.min(1, currentBill / limitTotal) : 0

  return (
    <div
      className="w-full max-w-[420px] mx-auto"
      style={{ perspective: '1000px' }}
    >
      <div
        ref={faceRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'relative aspect-[1.586] rounded-2xl border border-white/20 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)]',
          'overflow-hidden select-none transition-transform duration-200 ease-out will-change-transform'
        )}
        style={{
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transformStyle: 'preserve-3d',
          background: baseColor,
        }}
      >
        {/* Scrim fosco de contraste (F2: WCAG ≥ 4.5:1) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: BANK_CARD_SCRIM }}
        />
        {/* Brilho superior refratário */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.04) 42%, transparent 60%)' }}
        />

        {/* Conteúdo */}
        <div className="relative flex flex-col justify-between h-full p-4 sm:p-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <CardChip />
            <BrandMark brand={brand} />
          </div>

          <div className="space-y-2">
            <p className="text-[9px] uppercase tracking-[0.22em] text-white/70 font-bold">
              {cardName}
            </p>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[9px] uppercase tracking-wider text-white/70 font-bold mb-0.5">
                  Fatura atual
                </p>
                <AmountText
                  value={currentBill}
                  size="lg"
                  weight="extrabold"
                  className="text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]"
                />
              </div>
              <div className="text-right shrink-0">
                <p className="text-[9px] uppercase tracking-wider text-white/70 font-bold mb-0.5">
                  Fecha dia {closingDay} · Vence dia {dueDay}
                </p>
              </div>
            </div>

            {/* Barra térmica de limite (8.3) */}
            {limitTotal && limitTotal > 0 && (
              <div className="pt-1.5">
                <div className="h-1.5 rounded-full bg-black/25 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${usage * 100}%`,
                      backgroundColor: limitBarColor(usage),
                      boxShadow: `0 0 8px ${limitBarColor(usage)}`,
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-[9px] text-white/75 font-bold">
                  <span>Limite utilizado: {Math.round(usage * 100)}%</span>
                  <AmountText value={limitTotal} size="xs" className="text-white/90" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
