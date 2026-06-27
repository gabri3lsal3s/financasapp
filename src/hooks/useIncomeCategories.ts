import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { IncomeCategory } from '@/types'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { setCache } from '@/services/offlineCache'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'

const DEFAULT_CATEGORY_NAME = 'Sem categoria'
const DEFAULT_CATEGORY_COLOR = 'var(--category-fallback-muted)'

const sortIncomeCategories = (items: IncomeCategory[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export function useIncomeCategories() {
  const { user } = useAuth()

  const table = useSupabaseTable<IncomeCategory>({
    table: 'income_categories',
    select: '*',
    orderBy: { column: 'name', ascending: true },
    userScoped: true,
    sortBy: sortIncomeCategories,
    errorMessage: 'Erro ao carregar categorias de renda',
  })

  const { setData } = table

  const getIncomeCategoryUsageCount = useCallback(async (id: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('incomes')
        .select('id', { count: 'exact', head: true })
        .eq('income_category_id', id)

      if (error) throw error
      return count || 0
    } catch (err) {
      logger.error('Error counting income category usage:', err)
      return 0
    }
  }, [])

  const createIncomeCategory = useCallback(
    async (incomeCategory: Omit<IncomeCategory, 'id' | 'created_at'>) => {
      return table.create(incomeCategory)
    },
    [table],
  )

  const updateIncomeCategory = useCallback(
    async (id: string, updates: Partial<IncomeCategory>) => {
      return table.update(id, updates)
    },
    [table],
  )

  const deleteIncomeCategory = useCallback(
    async (id: string, targetCategoryId?: string) => {
      try {
        const { data: currentCategory } = await supabase
          .from('income_categories')
          .select('id, name')
          .eq('id', id)
          .single()

        if (currentCategory?.name === DEFAULT_CATEGORY_NAME) {
          return { error: 'A categoria padrão "Sem categoria" não pode ser excluída.' }
        }

        const { count: linkedIncomesCount, error: countError } = await supabase
          .from('incomes')
          .select('id', { count: 'exact', head: true })
          .eq('income_category_id', id)

        if (countError) throw countError

        if ((linkedIncomesCount ?? 0) > 0) {
          let finalTargetId = targetCategoryId

          if (!finalTargetId || finalTargetId === id) {
            const { data: existingDefaultCategory, error: defaultFetchError } = await supabase
              .from('income_categories')
              .select('id, name')
              .eq('name', DEFAULT_CATEGORY_NAME)
              .limit(1)
              .maybeSingle()

            if (defaultFetchError) throw defaultFetchError

            if (existingDefaultCategory?.id) {
              finalTargetId = existingDefaultCategory.id
            } else {
              const { data: createdDefaultCategory, error: defaultCreateError } = await supabase
                .from('income_categories')
                .insert([{ name: DEFAULT_CATEGORY_NAME, color: DEFAULT_CATEGORY_COLOR }])
                .select()
                .single()

              if (defaultCreateError) throw defaultCreateError
              finalTargetId = createdDefaultCategory.id

              setData((prev) => sortIncomeCategories([...prev, createdDefaultCategory]))
            }
          }

          if (!finalTargetId || finalTargetId === id) {
            return { error: 'Não foi possível reatribuir os itens para a categoria padrão.' }
          }

          const { error: reassignError } = await supabase
            .from('incomes')
            .update({ income_category_id: finalTargetId })
            .eq('income_category_id', id)

          if (reassignError) throw reassignError
        }

        return table.remove(id)
      } catch (err) {
        if (shouldQueueOffline(err)) {
          enqueueOfflineOperation({
            entity: 'income_categories',
            action: 'delete',
            recordId: id,
          })

          setData((prev) => {
            const next = prev.filter((cat) => cat.id !== id)
            const cacheKey = user?.id ? `income_categories-all-${user.id}` : 'income_categories-all'
            setCache(cacheKey, next).catch((e) => logger.error('Error setting income categories cache:', e))
            return next
          })
          return { error: null }
        }
        const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar categoria de renda'
        return { error: errorMessage }
      }
    },
    [setData, table],
  )

  return {
    incomeCategories: table.data,
    loading: table.loading,
    error: table.error,
    getIncomeCategoryUsageCount,
    createIncomeCategory,
    updateIncomeCategory,
    deleteIncomeCategory,
    refreshIncomeCategories: table.refresh,
  }
}
