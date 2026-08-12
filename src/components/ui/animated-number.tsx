import { useEffect, useRef, useState } from 'react'
import { formatNumberBR } from '@/utils/format'
import { cn } from '@/lib/utils'

interface AnimatedNumberProps {
  value: number
  /** Opções Intl (ex.: { maximumFractionDigits: 2 }). Padrão: inteiro. */
  formatOptions?: Intl.NumberFormatOptions
  /** Duração da animação em ms. Padrão: 500. */
  duration?: number
  className?: string
  /** Formatação customizada (sobrescreve formatOptions). */
  format?: (n: number) => string
}

/**
 * Primitivo de contador numérico animado.
 *
 * RESTRIÇÃO DE PERFORMANCE (Regra 6 do plano): usar apenas em KPIs de topo.
 * Em listas (50+ itens), usar tipografia `font-mono` tabular estática.
 *
 * - Anima com requestAnimationFrame (sem Framer Motion, leve e sem layout shift).
 * - Respeita `prefers-reduced-motion` (salta direto para o valor final).
 * - Formatação via `formatNumberBR` (Regra 3 — nada de toFixed/toLocaleString).
 */
export function AnimatedNumber({
  value,
  formatOptions,
  duration = 500,
  className,
  format,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(() => Number.isFinite(value) ? value : 0)
  // Último valor efetivamente renderizado — permite continuar a animação
  // suavemente do valor visível quando `value` muda no meio da transição.
  const displayedRef = useRef(display)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const target = Number.isFinite(value) ? value : 0
    const from = displayedRef.current

    if (target === from) return

    // Acessibilidade: sem animação para quem prefere movimento reduzido
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      setDisplay(target)
      displayedRef.current = target
      return
    }

    const start = performance.now()

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      // Easing suave (easeOutCubic) para uma parada natural
      const eased = 1 - Math.pow(1 - progress, 3)
      const next = from + (target - from) * eased
      setDisplay(next)
      displayedRef.current = next
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        displayedRef.current = target
      }
    }

    rafRef.current = requestAnimationFrame(tick)

    // No cleanup, `displayedRef` mantém o último valor renderizado — a próxima
    // animação parte dele (evita salto visual quando `value` muda no meio da
    // transição). Nada a fazer além de cancelar o RAF.
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  const formatted = format
    ? format(display)
    : formatNumberBR(display, formatOptions ?? { maximumFractionDigits: 0 })

  return (
    <span className={cn('font-mono tabular-nums', className)}>
      {formatted}
    </span>
  )
}

export default AnimatedNumber
