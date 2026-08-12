/**
 * Contexto compartilhado do grid de widgets do Dashboard: callback de abertura
 * do modal de detalhe de categoria. Extraído para módulo próprio (sem JSX)
 * para manter o contrato DRY e evitar exports mistos em arquivos de componente.
 */
import { createContext, useContext } from 'react'

export interface CategoryDetailTarget {
  categoryId: string
  categoryName: string
  color: string
  type: 'expense' | 'income'
}

export const CategoryDetailContext = createContext<((target: CategoryDetailTarget) => void) | null>(
  null,
)

export function useOpenCategoryDetail() {
  return useContext(CategoryDetailContext)
}
