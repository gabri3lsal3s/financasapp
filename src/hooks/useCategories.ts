import { useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Category } from '@/types'
import { useSupabaseTable } from '@/hooks/useSupabaseTable'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { setCache } from '@/services/offlineCache'
import { useAuth } from '@/contexts/AuthContext'
import { logger } from '@/utils/logger'

const DEFAULT_CATEGORY_NAME = 'Sem categoria'
const DEFAULT_CATEGORY_COLOR = 'var(--category-fallback-muted)'

const sortCategories = (items: Category[]) =>
  [...items].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))

export function useCategories() {
  const { user } = useAuth()

  const table = useSupabaseTable<Category>({
    table: 'categories',
    select: '*',
    orderBy: { column: 'name', ascending: true },
    userScoped: true,
    sortBy: sortCategories,
    errorMessage: 'Erro ao carregar categorias',
  })

  const { data: categories, setData } = table

  const getCategoryUsageCount = useCallback(async (id: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id)

      if (error) throw error
      return count || 0
    } catch (err) {
      logger.error('Error counting category usage:', err)
      return 0
    }
  }, [])

  const createCategory = useCallback(
    async (category: Omit<Category, 'id' | 'created_at'>) => {
      if (categories.length >= 15) {
        return { data: null, error: 'Limite máximo de 15 categorias atingido. Exclua uma categoria existente para criar uma nova.' }
      }
      return table.create(category)
    },
    [categories.length, table],
  )

  const updateCategory = useCallback(
    async (id: string, updates: Partial<Category>) => {
      return table.update(id, updates)
    },
    [table],
  )

  const deleteCategory = useCallback(
    async (id: string, targetCategoryId?: string) => {
      try {
        const { data: currentCategory } = await supabase
          .from('categories')
          .select('id, name')
          .eq('id', id)
          .single()

        if (currentCategory?.name === DEFAULT_CATEGORY_NAME) {
          return { error: 'A categoria padrão "Sem categoria" não pode ser excluída.' }
        }

        const { count: linkedExpensesCount, error: countError } = await supabase
          .from('expenses')
          .select('id', { count: 'exact', head: true })
          .eq('category_id', id)

        if (countError) throw countError

        if ((linkedExpensesCount ?? 0) > 0) {
          let finalTargetId = targetCategoryId

          if (!finalTargetId || finalTargetId === id) {
            const { data: existingDefaultCategory, error: defaultFetchError } = await supabase
              .from('categories')
              .select('id, name')
              .eq('name', DEFAULT_CATEGORY_NAME)
              .limit(1)
              .maybeSingle()

            if (defaultFetchError) throw defaultFetchError

            if (existingDefaultCategory?.id) {
              finalTargetId = existingDefaultCategory.id
            } else {
              const { data: createdDefaultCategory, error: defaultCreateError } = await supabase
                .from('categories')
                .insert([{ name: DEFAULT_CATEGORY_NAME, color: DEFAULT_CATEGORY_COLOR }])
                .select()
                .single()

              if (defaultCreateError) throw defaultCreateError
              finalTargetId = createdDefaultCategory.id

              setData((prev) => sortCategories([...prev, createdDefaultCategory]))
            }
          }

          if (!finalTargetId || finalTargetId === id) {
            return { error: 'Não foi possível reatribuir os itens para a categoria padrão.' }
          }

          const { error: reassignError } = await supabase
            .from('expenses')
            .update({ category_id: finalTargetId })
            .eq('category_id', id)

          if (reassignError) throw reassignError
        }

        return table.remove(id)
      } catch (err) {
        if (shouldQueueOffline(err)) {
          enqueueOfflineOperation({
            entity: 'categories',
            action: 'delete',
            recordId: id,
          })

          setData((prev) => {
            const next = prev.filter((cat) => cat.id !== id)
            // Reaplica a lógica de cache key idêntica à do useSupabaseTable
            const cacheKey = user?.id ? `categories-all-${user.id}` : 'categories-all'
            setCache(cacheKey, next).catch((e) => logger.error('Error setting categories cache:', e))
            return next
          })
          return { error: null }
        }
        const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar categoria'
        return { error: errorMessage }
      }
    },
    [setData, table, user?.id],
  )

  return {
    categories: table.data,
    loading: table.loading,
    error: table.error,
    getCategoryUsageCount,
    createCategory,
    updateCategory,
    deleteCategory,
    refreshCategories: table.refresh,
  }
}
