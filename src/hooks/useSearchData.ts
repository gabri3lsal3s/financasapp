import { useMemo } from 'react'
import type { SearchableData } from '@/utils/searchEngine'
import { useExpenses } from './useExpenses'
import { useIncomes } from './useIncomes'
import { useDebts } from './useDebts'
import { useCreditCards } from './useCreditCards'
import { useCategories } from './useCategories'
import { useIncomeCategories } from './useIncomeCategories'

/**
 * Hook que consolida TODOS os dados pesquisáveis em um único objeto.
 *
 * Carrega **todos os meses** de despesas e rendas (sem filtro de mês)
 * para permitir busca histórica completa. O motor de busca (searchEngine)
 * já aplica os limites de performance (MAX_ITEMS_PER_TYPE = 500).
 *
 * O scoring por recência (recencyBonus) garante que resultados mais
 * recentes apareçam primeiro, mesmo com dados de vários meses atrás.
 */
export function useSearchData(): SearchableData {
  // Carrega TODOS os registros (sem filtro de mês) para busca completa
  const { expenses } = useExpenses()
  const { incomes } = useIncomes()

  // Dados que não são filtrados por mês
  const { debts } = useDebts()
  const { creditCards } = useCreditCards()
  const { categories } = useCategories()
  const { incomeCategories } = useIncomeCategories()

  return useMemo(() => ({
    expenses,
    incomes,
    debts,
    creditCards,
    categories,
    incomeCategories,
  }), [
    expenses,
    incomes,
    debts,
    creditCards,
    categories,
    incomeCategories,
  ])
}
