/**
 * Z-INDEX SYSTEM — Hierarquia unificada.
 *
 * Todos os componentes devem usar estas constantes em vez de valores
 * arbitrários de z-index. Isso garante consistência, evita bugs de
 * sobreposição e facilita a manutenção.
 *
 * Uso:
 *   className={Z_INDEX.MODAL}
 *   style={{ zIndex: 999 }} → className={Z_INDEX.MODAL}
 *
 * Para valores não contemplados, adicione um novo nível aqui e em
 * theme-tokens.css.
 */
export const Z_INDEX = {
  /** Camada base do app (app-shell-glow, grid backgrounds) */
  BASE: 'z-0',
  /** Elementos decorativos (halo glow, barras de progresso) */
  DECORATION: 'z-[1]',
  /** Conteúdo principal elevado (containers de página, prefixos de input, timelines) */
  CONTENT: 'z-10',
  /** Elementos temporariamente elevados (trigger de select aberto) */
  STICKY: 'z-30',
  /** Barras de navegação (bottom nav, sidebar) */
  NAVIGATION: 'z-[100]',
  /** Popovers, tooltips, scroll-to-top, FABs de notificação — acima da navegação (z-100) */
  POPOVER: 'z-[150]',
  /** Overlays de modais e sheets */
  OVERLAY: 'z-[900]',
  /** Conteúdo de modais/sheets padrão */
  MODAL: 'z-[1000]',
  /** Stack lateral flutuante (page actions, calculadora em modo aba) */
  SIDE_STACK: 'z-[1100]',
  /** Modais elevados (sobrepoem outros modais) */
  ELEVATED: 'z-[1200]',
  /** Calculadora flutuante (sempre acima de tudo, exceto toasts) */
  CALCULATOR: 'z-[1300]',
  /** Toasts e notificações temporárias (sempre visíveis) */
  TOAST: 'z-[1400]',
  /** Camada de impressão */
  PRINT: 'z-[9999]',
} as const

export type ZIndexKey = keyof typeof Z_INDEX

/** Valor de z-index para modais elevados (usado em zIndexClass props). */
export type ZIndexElevated = typeof Z_INDEX.ELEVATED
