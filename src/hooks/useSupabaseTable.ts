import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getCache, setCache } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation } from '@/utils/offlineQueue'
import type { QueueEntity } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAuth } from '@/contexts/AuthContext'
import { format } from 'date-fns'
import { logger } from '@/utils/logger'
import toast from 'react-hot-toast'
import {
  REALTIME_LISTEN_TYPES,
  REALTIME_POSTGRES_CHANGES_LISTEN_EVENT,
} from '@supabase/realtime-js'
import type { RealtimePostgresChangesFilter } from '@supabase/realtime-js'

export interface UseSupabaseTableConfig<T extends { id: string }> {
  /** Nome da tabela no Supabase */
  table: QueueEntity
  /** Colunas a selecionar (padrão: '*') */
  select?: string
  /** Filtros simples: { coluna: valor } → .eq(coluna, valor) */
  filters?: Record<string, unknown>
  /** Ordenação */
  orderBy?: { column: string; ascending?: boolean }
  /** Mês para filtrar por data (usa dateColumn) */
  month?: string
  /** Nome da coluna de data para filtro mensal (padrão: 'date') */
  dateColumn?: string
  /** Chave de cache customizada. Se omitida, gera automaticamente */
  cacheKey?: string | (() => string)
  /** Escopa a chave de cache por user.id */
  userScoped?: boolean
  /** Inscrever em mudanças em tempo real via Supabase Realtime */
  subscribe?: boolean
  /** Nome do canal Realtime (padrão: `${table}-realtime-${month || 'all'}`) */
  subscribeChannel?: string
  /** Função de ordenação customizada dos dados */
  sortBy?: (items: T[]) => T[]
  /** Escutar evento 'local-data-changed' para recarregar */
  listenLocalDataChanged?: boolean
  /** Entidade para filtrar evento local-data-changed (padrão: nome da tabela) */
  localDataEntity?: string
  /** Mensagem de erro padrão */
  errorMessage?: string
}

interface CreateResult<T> {
  data: T | null
  error: string | null
}

interface DeleteResult {
  error: string | null
}

export interface SupabaseTableResult<T extends { id: string }> {
  data: T[]
  loading: boolean
  error: string | null
  /** Recarrega dados do Supabase */
  refresh: () => Promise<void>
  /** Cria um novo registro */
  create: (payload: Omit<T, 'id' | 'created_at'>) => Promise<CreateResult<T>>
  /** Atualiza um registro existente */
  update: (id: string, updates: Partial<T>) => Promise<CreateResult<T>>
  /** Remove um registro */
  remove: (id: string) => Promise<DeleteResult>
  /** Define o estado de dados diretamente (para atualizações otimistas) */
  setData: React.Dispatch<React.SetStateAction<T[]>>
}

/**
 * Hook genérico para operações CRUD em tabelas Supabase.
 *
 * Abstrai o padrão repetitivo de:
 * - load com cache + fallback offline
 * - create / update / delete com suporte offline
 * - inscrição Realtime
 * - listener offline-queue-processed
 * - estados loading / error
 *
 * @example
 * ```tsx
 * const table = useSupabaseTable<Category>({
 *   table: 'categories',
 *   orderBy: { column: 'name', ascending: true },
 *   userScoped: true,
 *   sortBy: (items) => items.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
 * })
 *
 * // Uso na página:
 * const { data: categories, loading, create, update, remove } = table
 * ```
 */
export function useSupabaseTable<T extends { id: string }>(
  config: UseSupabaseTableConfig<T>,
): SupabaseTableResult<T> {
  // ── Store config in a ref to avoid infinite loops ──
  // The config object is recreated every render (e.g. inline object literal in useCategories).
  // useCallbacks read from configRef instead of depending on fresh object references,
  // keeping their identities stable across renders.
  const configRef = useRef(config)
  configRef.current = config

  const table = config.table
  const month = config.month
  const userScoped = config.userScoped ?? false
  const enableSubscribe = config.subscribe ?? true
  const subscribeChannel = config.subscribeChannel
  const listenLocalDataChanged = config.listenLocalDataChanged ?? true
  const localDataEntity = config.localDataEntity

  const { user } = useAuth()
  const { isOnline } = useNetworkStatus()

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prevMonth, setPrevMonth] = useState(month)
  const currentMonthRef = useRef(month)
  currentMonthRef.current = month

  // ── Reset do estado quando o mês muda ──
  if (month !== prevMonth) {
    setPrevMonth(month)
    setData([])
    setLoading(true)
  }

  // ── Cache key (estável: lê de configRef) ──
  const getCacheKey = useCallback(() => {
    const { cacheKey: cacheKeyOption } = configRef.current
    if (cacheKeyOption) {
      return typeof cacheKeyOption === 'function' ? cacheKeyOption() : cacheKeyOption
    }
    const userIdSuffix = userScoped && user?.id ? `-${user.id}` : ''
    const monthSuffix = month ? `-${month}` : '-all'
    return `${table}${monthSuffix}${userIdSuffix}`
  }, [table, userScoped, user?.id, month])

  // ── Build query base (estável: lê de configRef) ──
  // O tipo de retorno é inferido pelo Supabase QueryBuilder — não explicitamos
  // os genéricos porque o select(*) retorna um tipo específico do Supabase
  // que não corresponde exatamente a T. O resultado é usado com cast em load().
  const buildQuery = useCallback(() => {
    const { select, filters, dateColumn, orderBy } = configRef.current
    const query = supabase.from(table).select(select ?? '*')

    // Filtros simples
    if (filters) {
      for (const [column, value] of Object.entries(filters)) {
        query.eq(column, value)
      }
    }

    // Filtro por mês (date range ou exact match)
    if (month) {
      const monthStr = month.length === 7 ? month : month.substring(0, 7)
      const [year, monthNum] = monthStr.split('-').map(Number)

      if ((dateColumn ?? 'date') === 'month') {
        // Tabelas com coluna 'month' (ex: expense_category_month_limits)
        query.eq('month', monthStr)
      } else {
        // Tabelas com coluna de data (ex: expenses.date)
        const startDate = new Date(year, monthNum - 1, 1)
        const endDate = new Date(year, monthNum, 0)

        query
          .gte(dateColumn ?? 'date', format(startDate, 'yyyy-MM-dd'))
          .lte(dateColumn ?? 'date', format(endDate, 'yyyy-MM-dd'))
      }
    }

    // Ordenação
    if (orderBy) {
      query.order(orderBy.column, { ascending: orderBy.ascending ?? true })
    }

    return query
  }, [table, month])

  // ── Load function (estável: lê de configRef) ──
  const load = useCallback(async () => {
    const { sortBy, errorMessage: msg } = configRef.current

    try {
      setLoading(true)
      const cacheKey = getCacheKey()
      const cached = await getCache<T[]>(cacheKey)

      if (currentMonthRef.current !== month) return

      if (cached) {
        setData(cached)
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      const query = buildQuery()
      const { data: fetchedData, error: fetchError } = await query

      if (currentMonthRef.current !== month) return

      if (fetchError) throw fetchError

      const newData: T[] = (fetchedData || []) as unknown as T[]
      const sortedData = sortBy ? sortBy(newData) : newData

      setData(sortedData)
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : (msg ?? `Erro ao carregar ${table}`))
      logger.error(`Error loading ${table}:`, err)
    } finally {
      setLoading(false)
    }
  }, [table, month, isOnline, getCacheKey, buildQuery])

  // ── Effects ──
  // NOTE: load é estável porque depende apenas de primitivas (table, month, isOnline)
  // e de funções que também são estáveis (getCacheKey, buildQuery).
  // NÃO causa loop infinito.
  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!enableSubscribe || !isOnline) return

    const channel = subscribeChannel || `${table}-realtime-${month || 'all'}`
    const realtimeFilter: RealtimePostgresChangesFilter<typeof REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL> = {
      event: REALTIME_POSTGRES_CHANGES_LISTEN_EVENT.ALL,
      schema: 'public',
      table,
    }

    const realtimeChannel = supabase
      .channel(channel)
      .on(REALTIME_LISTEN_TYPES.POSTGRES_CHANGES, realtimeFilter, () => {
        load()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(realtimeChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline, enableSubscribe, subscribeChannel, table])

  useEffect(() => {
    const onQueueProcessed = () => {
      load()
    }

    const onLocalDataChanged = (e: Event) => {
      if (!listenLocalDataChanged) return
      const customEvent = e as CustomEvent<{ entity?: string }>
      const entity = customEvent.detail?.entity
      if (!entity || entity === table || entity === localDataEntity) {
        load()
      }
    }

    window.addEventListener('offline-queue-processed', onQueueProcessed)
    if (listenLocalDataChanged) {
      window.addEventListener('local-data-changed', onLocalDataChanged as EventListener)
    }

    return () => {
      window.removeEventListener('offline-queue-processed', onQueueProcessed)
      if (listenLocalDataChanged) {
        window.removeEventListener('local-data-changed', onLocalDataChanged as EventListener)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listenLocalDataChanged, localDataEntity, table])

  // ── Create ──
  const create = useCallback(
    async (payload: Omit<T, 'id' | 'created_at'>): Promise<CreateResult<T>> => {
      const { select, sortBy } = configRef.current

      try {
        if (!isOnline) {
          throw new Error('Offline (bypass)')
        }

        const { data: created, error: insertError } = await supabase
          .from(table)
          .insert([payload as Record<string, unknown>])
          .select(select ?? '*')
          .single()

        if (insertError) throw insertError

        const result = (created ?? null) as unknown as T | null
        if (result) {
          setData((prev) => {
            const next = sortBy ? sortBy([...prev, result]) : [...prev, result]
            return next
          })
        }

        return { data: result, error: null }
      } catch (err) {
        if (shouldQueueOffline(err)) {
          const offlineId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          enqueueOfflineOperation({
            entity: table,
            action: 'create',
            payload: { ...payload, _uiId: offlineId } as Record<string, unknown>,
          })

          const offlineRecord = {
            id: offlineId,
            created_at: new Date().toISOString(),
            ...payload,
          } as unknown as T

          setData((prev) => {
            const next = sortBy ? sortBy([...prev, offlineRecord]) : [...prev, offlineRecord]
            setCache(getCacheKey(), next).catch((e) => {
              logger.error(e)
              toast.error('Erro ao salvar dados localmente. Tente novamente.')
            })
            return next
          })
          window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: table } }))

          return { data: offlineRecord, error: null }
        }

        const errorMsg = err instanceof Error ? err.message : `Erro ao criar em ${table}`
        return { data: null, error: errorMsg }
      }
    },
    [isOnline, table, getCacheKey],
  )

  // ── Update ──
  const update = useCallback(
    async (id: string, updates: Partial<T>): Promise<CreateResult<T>> => {
      const { select, sortBy } = configRef.current

      try {
        if (!isOnline) {
          throw new Error('Offline (bypass)')
        }

        const { data: updated, error: updateError } = await supabase
          .from(table)
          .update(updates as Record<string, unknown>)
          .eq('id', id)
          .select(select ?? '*')
          .single()

        if (updateError) throw updateError

        const result = (updated ?? null) as unknown as T | null
        if (result) {
          setData((prev) => {
            const next = sortBy
              ? sortBy(prev.map((item) => (item.id === id ? result : item)))
              : prev.map((item) => (item.id === id ? result : item))
            return next
          })
        }

        return { data: result, error: null }
      } catch (err) {
        if (shouldQueueOffline(err)) {
          enqueueOfflineOperation({
            entity: table,
            action: 'update',
            recordId: id,
            payload: updates as Record<string, unknown>,
          })

          setData((prev) => {
            const next = sortBy
              ? sortBy(prev.map((item) => (item.id === id ? { ...item, ...updates } : item)))
              : prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
            setCache(getCacheKey(), next).catch((e) => {
              logger.error(e)
              toast.error('Erro ao salvar dados localmente. Tente novamente.')
            })
            return next
          })
          window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: table } }))

          return { data: { id, ...updates } as unknown as T, error: null }
        }

        const errorMsg = err instanceof Error ? err.message : `Erro ao atualizar em ${table}`
        return { data: null, error: errorMsg }
      }
    },
    [isOnline, table, getCacheKey],
  )

  // ── Delete ──
  const remove = useCallback(
    async (id: string): Promise<DeleteResult> => {
      try {
        if (!isOnline) {
          throw new Error('Offline (bypass)')
        }

        const { error: deleteError } = await supabase
          .from(table)
          .delete()
          .eq('id', id)

        if (deleteError) throw deleteError

        setData((prev) => {
          const next = prev.filter((item) => item.id !== id)
          return next
        })
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: table } }))

        return { error: null }
      } catch (err) {
        if (shouldQueueOffline(err)) {
          enqueueOfflineOperation({
            entity: table,
            action: 'delete',
            recordId: id,
          })

          setData((prev) => {
            const next = prev.filter((item) => item.id !== id)
            setCache(getCacheKey(), next).catch((e) => {
              logger.error(e)
              toast.error('Erro ao salvar dados localmente. Tente novamente.')
            })
            return next
          })
          window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: table } }))

          return { error: null }
        }

        const errorMsg = err instanceof Error ? err.message : `Erro ao deletar em ${table}`
        return { error: errorMsg }
      }
    },
    [isOnline, table, getCacheKey],
  )

  return {
    data,
    loading,
    error,
    refresh: load,
    create,
    update,
    remove,
    setData,
  }
}
