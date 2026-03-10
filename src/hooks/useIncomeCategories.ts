import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { IncomeCategory } from '@/types'
import { getCache, setCache } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

const DEFAULT_CATEGORY_NAME = 'Sem categoria'
const DEFAULT_CATEGORY_COLOR = '#9ca3af'

export function useIncomeCategories() {
  const { isOnline } = useNetworkStatus()
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadIncomeCategories()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadIncomeCategories()
    }
    window.addEventListener('offline-queue-processed', onQueueProcessed)
    return () => window.removeEventListener('offline-queue-processed', onQueueProcessed)
  }, [])

  const getIncomeCategoryUsageCount = async (id: string): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('incomes')
        .select('id', { count: 'exact', head: true })
        .eq('income_category_id', id)

      if (error) throw error
      return count || 0
    } catch (err) {
      console.error('Error counting income category usage:', err)
      return 0
    }
  }

  const loadIncomeCategories = async () => {
    try {
      setLoading(true)
      const cacheKey = 'income_categories-all'
      const cached = await getCache<IncomeCategory[]>(cacheKey)
      if (cached) {
        setIncomeCategories(cached)
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      const { data, error: fetchError } = await supabase
        .from('income_categories')
        .select('*')
        .order('name', { ascending: true })

      if (fetchError) throw fetchError
      const newData = data || []
      setIncomeCategories(newData)
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar categorias de renda')
      console.error('Error loading income categories:', err)
    } finally {
      setLoading(false)
    }
  }

  const createIncomeCategory = async (incomeCategory: Omit<IncomeCategory, 'id' | 'created_at'>) => {
    try {
      const { data, error: insertError } = await supabase
        .from('income_categories')
        .insert([incomeCategory])
        .select()
        .single()

      if (insertError) throw insertError

      setIncomeCategories((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'income_categories',
          action: 'create',
          payload: incomeCategory as Record<string, unknown>,
        })
        const offlineCategory: IncomeCategory = {
          id: `offline-${Date.now()}`,
          created_at: new Date().toISOString(),
          ...incomeCategory,
        }
        setIncomeCategories((prev) => {
          const next = [...prev, offlineCategory].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          setCache('income_categories-all', next).catch(console.error)
          return next
        })
        return { data: offlineCategory, error: null }
      }
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar categoria de renda'
      return { data: null, error: errorMessage }
    }
  }

  const updateIncomeCategory = async (id: string, updates: Partial<IncomeCategory>) => {
    try {
      const { data, error: updateError } = await supabase
        .from('income_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (updateError) throw updateError

      setIncomeCategories((prev) =>
        prev.map((cat) => (cat.id === id ? data : cat)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      )
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'income_categories',
          action: 'update',
          recordId: id,
          payload: updates as Record<string, unknown>,
        })
        setIncomeCategories((prev) => {
          const next = prev
            .map((cat) => (cat.id === id ? { ...cat, ...updates } : cat))
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
          setCache('income_categories-all', next).catch(console.error)
          return next
        })
        return { data: { id, ...updates } as IncomeCategory, error: null }
      }
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar categoria de renda'
      return { data: null, error: errorMessage }
    }
  }

  const deleteIncomeCategory = async (id: string, targetCategoryId?: string) => {
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

            setIncomeCategories((prev) => [...prev, createdDefaultCategory])
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

      const { error: deleteError } = await supabase
        .from('income_categories')
        .delete()
        .eq('id', id)

      if (deleteError) throw deleteError

      setIncomeCategories((prev) => prev.filter((cat) => cat.id !== id))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        enqueueOfflineOperation({
          entity: 'income_categories',
          action: 'delete',
          recordId: id,
        })
        setIncomeCategories((prev) => {
          const next = prev.filter((cat) => cat.id !== id)
          setCache('income_categories-all', next).catch(console.error)
          return next
        })
        return { error: null }
      }
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar categoria de renda'
      return { error: errorMessage }
    }
  }

  return {
    incomeCategories,
    loading,
    error,
    getIncomeCategoryUsageCount,
    createIncomeCategory,
    updateIncomeCategory,
    deleteIncomeCategory,
    refreshIncomeCategories: loadIncomeCategories,
  }
}
