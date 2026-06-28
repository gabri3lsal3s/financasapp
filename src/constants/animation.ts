/**
 * Constantes e utilitários de animação para entradas em lista (stagger).
 *
 * Uso:
 *   import { getStaggerClass, STAGGER_DELAY_CLASSES } from '@/constants/animation'
 *
 *   // Em JSX:
 *   className={`animate-stagger-item ${getStaggerClass(index)}`}
 *
 *   // Ou diretamente com array:
 *   const staggerClasses = STAGGER_DELAY_CLASSES  // ['delay-50', 'delay-100', ...]
 */

/** Duração da animação de saída dos itens de lista (exclusão).
 * Usado para sincronizar o timeout antes de remover o item do estado com a animação CSS. */
export const LIST_ITEM_EXIT_MS = 260

/** Classes de intervalo (50ms cada) para animação sequencial de itens.
 * Usadas em listas de transações, categorias, etc. para criar efeito stagger. */
export const STAGGER_DELAY_CLASSES = [
  'delay-50',
  'delay-100',
  'delay-150',
  'delay-200',
  'delay-250',
  'delay-300',
  'delay-400',
  'delay-500',
] as const satisfies readonly string[]

/** Retorna a classe de stagger delay para um índice, ou string vazia se >= N.
 * @example getStaggerClass(0) // 'delay-50'
 * @example getStaggerClass(8) // '' (fora do intervalo)
 */
export function getStaggerClass(index: number): string {
  return index < STAGGER_DELAY_CLASSES.length ? STAGGER_DELAY_CLASSES[index] : ''
}
