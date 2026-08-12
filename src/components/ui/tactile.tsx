import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * 8.2 — Micro-spring físico (R8): prensa tátil ao tocar/clicar em cards.
 *
 * Envolve o conteúdo em um `motion.div` com mola física
 * (`stiffness: 450, damping: 25`): `scale: 0.985` no toque (whileTap) e um
 * leve lift de 1.01 no hover (desktop). Respeita `prefers-reduced-motion`.
 *
 * Uso: substitua o elemento raiz clicável por `<TactilePress onClick=... className=...>`.
 */
interface TactilePressProps extends HTMLMotionProps<'div'> {}

export default function TactilePress({
  children,
  className,
  ...rest
}: TactilePressProps) {
  const shouldReduceMotion = useReducedMotion()

  return (
    <motion.div
      whileHover={shouldReduceMotion ? undefined : { scale: 1.01 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      className={cn('will-change-transform', className)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
