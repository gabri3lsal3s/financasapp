import { cn } from '@/lib/utils'

export interface FlipRect {
  left: number
  top: number
  width: number
  height: number
}

export interface CalculatorPosition {
  /** Lado da tela onde a calculadora fica ancorada */
  side: 'left' | 'right'
  /** Posição vertical como percentual seguro do viewport (0-100, clamped internamente para SAFE_ZONE_TOP..SAFE_ZONE_BOTTOM) */
  yPercent: number
}

export const CALCULATOR_POSITION_KEY = 'floating-calculator-position'

/** Zonas seguras: percentual do viewport que define os limites superior e inferior. */
export const SAFE_ZONE_TOP_FRACTION = 0.12
export const SAFE_ZONE_BOTTOM_FRACTION = 0.12

/** Posição padrão mais discreta: lado direito, 35% do topo. */
export const DEFAULT_CALCULATOR_POSITION: CalculatorPosition = {
  side: 'right',
  yPercent: 35,
}

/**
 * Retorna a margem em pixels para o botão ficar visível.
 * @param buttonHeight altura do botão em px
 */
export function getButtonSafeMargin(buttonHeight: number = 40): number {
  return buttonHeight / 2 + 8
}

/**
 * Retorna o intervalo Y seguro em pixels: [minY, maxY]
 */
export function getSafeYRange(
  viewportHeight: number,
  buttonHeight: number = 40
): [number, number] {
  const margin = getButtonSafeMargin(buttonHeight)
  const availableRaw = viewportHeight - margin * 2
  const topSafeZonePx = availableRaw * SAFE_ZONE_TOP_FRACTION
  const bottomSafeZonePx = availableRaw * (1 - SAFE_ZONE_BOTTOM_FRACTION)
  return [
    Math.max(margin, margin + topSafeZonePx),
    Math.min(viewportHeight - margin, margin + bottomSafeZonePx),
  ]
}

/**
 * Calcula a posição Y em pixels a partir do percentual e viewport,
 * respeitando as zonas seguras (não permite extremos topo/base).
 */
export function calculateYFromPercent(
  yPercent: number,
  viewportHeight: number,
  buttonHeight: number = 40
): number {
  const [minY, maxY] = getSafeYRange(viewportHeight, buttonHeight)
  const available = maxY - minY
  const normalizedPercent = Math.max(0, Math.min(100, yPercent))
  return Math.round(minY + (available * normalizedPercent) / 100)
}

/**
 * Converte uma posição Y em pixels para percentual seguro (0-100).
 */
export function calculatePercentFromY(
  yPx: number,
  viewportHeight: number,
  buttonHeight: number = 40
): number {
  const [minY, maxY] = getSafeYRange(viewportHeight, buttonHeight)
  const available = maxY - minY
  const normalized = Math.max(0, Math.min(available, yPx - minY))
  return Math.round((normalized / available) * 100)
}

/**
 * Lê a posição persistida da calculadora do localStorage.
 * Se `isDesktop`, força o lado para 'right' (menu de navegação ocupa a esquerda).
 */
export function readPersistedPosition(isDesktop: boolean = false): CalculatorPosition {
  try {
    const raw = window.localStorage.getItem(CALCULATOR_POSITION_KEY)
    if (!raw) {
      return isDesktop
        ? { ...DEFAULT_CALCULATOR_POSITION, side: 'right' }
        : { ...DEFAULT_CALCULATOR_POSITION }
    }

    const parsed = JSON.parse(raw) as Partial<CalculatorPosition>
    let side = parsed.side
    if (side !== 'left' && side !== 'right') {
      side = DEFAULT_CALCULATOR_POSITION.side
    }
    // Desktop: força 'right'
    if (isDesktop) {
      side = 'right'
    }

    const yPercent = typeof parsed.yPercent === 'number'
      ? Math.max(0, Math.min(100, parsed.yPercent))
      : DEFAULT_CALCULATOR_POSITION.yPercent

    return { side, yPercent }
  } catch {
    window.localStorage.removeItem(CALCULATOR_POSITION_KEY)
    return isDesktop
      ? { ...DEFAULT_CALCULATOR_POSITION, side: 'right' }
      : { ...DEFAULT_CALCULATOR_POSITION }
  }
}

/**
 * Persiste a posição da calculadora no localStorage.
 * No desktop, força side='right' antes de salvar.
 */
export function persistPosition(position: CalculatorPosition, isDesktop: boolean = false): void {
  try {
    const toSave = isDesktop
      ? { ...position, side: 'right' as const }
      : position
    window.localStorage.setItem(CALCULATOR_POSITION_KEY, JSON.stringify(toSave))
  } catch {
    // Ignorar erros de localStorage (quota excedida, etc.)
  }
}

export function captureFlipRect(element: Element | null | undefined): FlipRect | null {
  if (!element) return null

  const rect = element.getBoundingClientRect()
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function buildFlipStartTransform(from: FlipRect, to: FlipRect): string {
  const deltaX = from.left + from.width / 2 - (to.left + to.width / 2)
  const deltaY = from.top + from.height / 2 - (to.top + to.height / 2)
  const scaleX = from.width / Math.max(to.width, 1)
  const scaleY = from.height / Math.max(to.height, 1)

  return `translate3d(${deltaX}px, ${deltaY}px, 0) scale(${scaleX}, ${scaleY})`
}

export function buildIconDragTransform(offset: { x: number; y: number }, dragging: boolean): string {
  if (dragging) {
    return `translate3d(${offset.x}px, ${offset.y}px, 0) scale(1.02)`
  }
  return `translate3d(${offset.x}px, ${offset.y}px, 0)`
}

/**
 * Retorna a classe de animação de abertura do painel da calculadora
 * baseada no lado onde está ancorada.
 */
export function getCalculatorPanelOpenClass(side: 'left' | 'right'): string {
  if (side === 'left') {
    return 'animate-calculator-open-side-left'
  }
  return 'animate-calculator-open-side-right'
}

/**
 * Classe para o wrapper do botão da calculadora.
 * Aplica transição fluida para o movimento no eixo Y.
 */
export function getCalculatorButtonWrapperClass(
  _side: 'left' | 'right',
  isDragging: boolean,
  isReturning: boolean
): string {
  return cn(
    'fixed pointer-events-none z-[1300]',
    'calculator-icon-wrapper-transition',
    isDragging && 'calculator-icon-wrapper-transition--no-transition',
    isReturning && !isDragging && 'calculator-icon-wrapper-transition--returning'
  )
}
