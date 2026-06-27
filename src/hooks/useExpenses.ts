import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Expense, Category, CreditCard, Debt } from '@/types'
import { format } from 'date-fns'
import { buildInstallmentDates, fetchCardClosingDayContext, generateInstallmentPayloads } from '@/utils/expenseInstallments'
import { resolveBillCompetence } from '@/utils/creditCardBilling'
import { getCache, setCache, clearCacheByKeyPrefix } from '@/services/offlineCache'
import { shouldQueueOffline, enqueueOfflineOperation, updateOfflineCreatePayload, removeOfflineCreateOperation } from '@/utils/offlineQueue'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { useAuth } from '@/contexts/AuthContext'
import { APP_START_DATE } from '@/utils/format'
import { logger } from '@/utils/logger'

export function useExpenses(month?: string) {
  const { user } = useAuth()
  const { isOnline } = useNetworkStatus()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [prevMonth, setPrevMonth] = useState(month)
  const currentMonthRef = useRef(month)
  currentMonthRef.current = month

  if (month !== prevMonth) {
    setPrevMonth(month)
    setExpenses([])
    setLoading(true)
  }

  const getCacheKey = () => user?.id ? `expenses-${month || 'all'}-${user.id}` : `expenses-${month || 'all'}`

  useEffect(() => {
    loadExpenses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    if (!isOnline) return

    const realtimeChannel = supabase
      .channel(`expenses-realtime-${month || 'all'}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses' },
        () => {
          loadExpenses()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(realtimeChannel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, isOnline])

  useEffect(() => {
    const onQueueProcessed = () => {
      loadExpenses()
    }

    const onLocalDataChanged = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.entity === 'expenses') {
        loadExpenses()
      }
    }

    window.addEventListener('offline-queue-processed', onQueueProcessed)
    window.addEventListener('local-data-changed', onLocalDataChanged)
    return () => {
      window.removeEventListener('offline-queue-processed', onQueueProcessed)
      window.removeEventListener('local-data-changed', onLocalDataChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortExpensesByDate = (list: Expense[]) =>
    [...list].sort((a, b) => {
      const dateDiff = b.date.localeCompare(a.date)
      if (dateDiff !== 0) return dateDiff
      return (b.created_at || '').localeCompare(a.created_at || '')
    })

  const loadExpenses = async () => {
    try {
      setLoading(true)

      const cacheKey = getCacheKey()
      const cached = await getCache<Expense[]>(cacheKey)

      if (currentMonthRef.current !== month) return

      if (cached) {
        setExpenses(sortExpensesByDate(cached))
        setLoading(false)
      }

      if (!isOnline) {
        setLoading(false)
        return
      }

      let query = supabase
        .from('expenses')
        .select(`
          *,
          category:categories(*),
          credit_card:credit_cards(*)
        `)
        .order('date', { ascending: false })

      if (month) {
        // month pode ser 'yyyy-MM' ou 'yyyy-MM-dd', normalizar para 'yyyy-MM'
        const monthStr = month.length === 7 ? month : month.substring(0, 7)
        const [year, monthNum] = monthStr.split('-').map(Number)

        // Criar datas no timezone local para evitar problemas de UTC
        const startDate = new Date(year, monthNum - 1, 1) // monthNum - 1 porque Date usa 0-11
        const endDate = new Date(year, monthNum, 0) // dia 0 do próximo mês = último dia do mês atual

        query = query
          .gte('date', format(startDate, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
      }

      const { data, error: fetchError } = await query

      if (currentMonthRef.current !== month) return

      if (fetchError) throw fetchError
      const newData = data || []
      setExpenses(sortExpensesByDate(newData))
      await setCache(cacheKey, newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar despesas')
      logger.error('Error loading expenses:', err)
    } finally {
      setLoading(false)
    }
  }

  const createExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'category' | 'credit_card'>) => {
    try {
      // Validar campos obrigatórios
      if (!expense.category_id || !expense.amount) {
        throw new Error('Categoria e valor são obrigatórios')
      }

      if (expense.date && expense.date < APP_START_DATE) {
        throw new Error(`O app inicia em 01/01/2026. Lançamentos anteriores não são permitidos.`)
      }


      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      const installments = Number(expense.installment_total || 1)
      let resolveClosingDayForDate: ((expenseDate: string) => number | undefined) | undefined

      if (expense.payment_method === 'credit_card' && expense.credit_card_id) {
        const startDate = expense.date || format(new Date(), 'yyyy-MM-dd')
        const installmentDates = buildInstallmentDates(startDate, installments)
        const competences = installmentDates.map((dateValue) => dateValue.substring(0, 7))
        const closingDayContext = await fetchCardClosingDayContext(expense.credit_card_id, competences)

        resolveClosingDayForDate = (expenseDate: string) => {
          const competence = expenseDate.substring(0, 7)
          return closingDayContext.closingDayByCompetence[competence] || closingDayContext.defaultClosingDay
        }
      }

      const expenseData = generateInstallmentPayloads(expense, installments, resolveClosingDayForDate)

      const { data, error: insertError } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select(`
          *,
          category:categories(*),
          credit_card:credit_cards(*)
        `)

      if (insertError) throw insertError

      const inserted = data || []
      setExpenses((prev) => sortExpensesByDate([...prev, ...inserted]))
      return { data: inserted[0] || null, error: null, insertedExpenses: inserted }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        const installments = Number(expense.installment_total || 1)
        const expenseData = generateInstallmentPayloads(expense, installments)

        const offlineIds = expenseData.map((_, index) => `offline-${Date.now()}-${index}`)

        expenseData.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'expenses',
            action: 'create',
            payload: { ...payload, _uiId: offlineIds[index] },
          })
        })

        let currentCategories: Category[] = []
        let currentCards: CreditCard[] = []
        try {
          const [catCached, cardCached] = await Promise.all([
            getCache<Category[]>('categories-all'),
            getCache<CreditCard[]>('credit_cards-all')
          ])
          currentCategories = catCached || []
          currentCards = cardCached || []
        } catch (e) {
          logger.error('Error loading metadata from cache during offline create:', e)
        }

        const nowIso = new Date().toISOString()
        const offlineExpenses: Expense[] = expenseData.map((payload, index) => {
          const installmentGroupId = 'installment_group_id' in payload ? payload.installment_group_id : undefined
          const installmentNumber = 'installment_number' in payload ? payload.installment_number : undefined
          const installmentTotal = 'installment_total' in payload ? payload.installment_total : undefined

          const matchedCategory = currentCategories.find(c => c.id === payload.category_id)
          const matchedCard = payload.credit_card_id ? currentCards.find(c => c.id === payload.credit_card_id) : undefined

          return {
            id: offlineIds[index],
            amount: Number(payload.amount),
            report_weight: payload.report_weight !== undefined ? Number(payload.report_weight) : undefined,
            date: String(payload.date),
            category_id: String(payload.category_id),
            installment_group_id: installmentGroupId ? String(installmentGroupId) : null,
            installment_number: installmentNumber !== undefined ? Number(installmentNumber) : null,
            installment_total: installmentTotal !== undefined ? Number(installmentTotal) : null,
            payment_method: payload.payment_method ? String(payload.payment_method) as Expense['payment_method'] : undefined,
            credit_card_id: payload.credit_card_id ? String(payload.credit_card_id) : null,
            bill_competence: payload.bill_competence ? String(payload.bill_competence) : null,
            description: payload.description ? String(payload.description) : undefined,
            created_at: nowIso,
            category: matchedCategory ? {
              id: matchedCategory.id,
              name: matchedCategory.name,
              color: matchedCategory.color || 'var(--category-fallback-muted)',
            } : undefined,
            credit_card: matchedCard ? {
              id: matchedCard.id,
              name: matchedCard.name,
            } : undefined,
          } as Expense
        })

        const nextState = sortExpensesByDate([...offlineExpenses, ...expenses])
        setExpenses(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'expenses' } }))
        return { data: offlineExpenses[0] || null, error: null, insertedExpenses: offlineExpenses }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar despesa'
      return { data: null, error: errorMessage }
    }
  }

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    let updatePayload: Partial<Expense> = { ...updates }

    try {
      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      if (id.startsWith('offline-')) {
        throw new Error('Offline ID (bypass supabase)')
      }

      const existingExpense = expenses.find((item) => item.id === id)
      const effectiveDate = String(updatePayload.date || existingExpense?.date || '')

      if (effectiveDate && effectiveDate < APP_START_DATE) {
        throw new Error(`O app inicia em 01/01/2026. Alterações para datas anteriores não são permitidas.`)
      }

      const effectivePaymentMethod =
        (updatePayload.payment_method || existingExpense?.payment_method || 'other') as Expense['payment_method']
      const effectiveCreditCardId =
        (updatePayload.credit_card_id !== undefined
          ? updatePayload.credit_card_id
          : existingExpense?.credit_card_id) || null

      if (effectivePaymentMethod === 'credit_card' && effectiveCreditCardId && effectiveDate) {
        // Se a competência for fornecida explicitamente (update manual), preserva ela.
        // Caso contrário, recalcula apenas se a data ou cartão mudarem e não houver bill_competence explícita no payload.
        let finalCompetence = updatePayload.bill_competence

        if (finalCompetence === undefined) {
          const competence = effectiveDate.substring(0, 7)
          const closingDayContext = await fetchCardClosingDayContext(effectiveCreditCardId, [competence])
          finalCompetence = resolveBillCompetence(effectiveDate, (c) => closingDayContext.closingDayByCompetence[c] || closingDayContext.defaultClosingDay)
        }

        updatePayload = {
          ...updatePayload,
          payment_method: 'credit_card',
          credit_card_id: effectiveCreditCardId,
          bill_competence: finalCompetence,
        }
      } else {
        updatePayload = {
          ...updatePayload,
          ...(effectivePaymentMethod !== 'credit_card' ? { credit_card_id: null } : {}),
          bill_competence: null,
        }
      }

      const { data, error: updateError } = await supabase
        .from('expenses')
        .update(updatePayload)
        .eq('id', id)
        .select(`
          *,
          category:categories(*),
          credit_card:credit_cards(*)
        `)
        .single()

      if (updateError) throw updateError

      setExpenses((prev) => sortExpensesByDate(prev.map((exp) => (exp.id === id ? data : exp))))
      return { data, error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        if (id.startsWith('offline-')) {
          updateOfflineCreatePayload(id, updatePayload as Record<string, unknown>)
        } else {
          enqueueOfflineOperation({
            entity: 'expenses',
            action: 'update',
            recordId: id,
            payload: updatePayload as Record<string, unknown>,
          })
        }

        const nextState = sortExpensesByDate(expenses.map((exp) => (exp.id === id ? { ...exp, ...updatePayload } : exp)))
        setExpenses(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'expenses' } }))
        return { data: { id, ...updatePayload }, error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar despesa'
      return { data: null, error: errorMessage }
    }
  }

  const deleteExpense = async (id: string, mode: 'single' | 'all' | 'subsequent' = 'single') => {
    const target = expenses.find((exp) => exp.id === id)
    const targetGroupId = target?.installment_group_id
    const targetInstallmentNumber = target?.installment_number

    let idsToDelete: string[] = []

    try {
      if (!isOnline) {
        throw new Error('Offline (bypass)')
      }

      if (mode !== 'single' && targetGroupId) {
        let query = supabase
          .from('expenses')
          .select('id, installment_number, installment_group_id')
          .eq('installment_group_id', targetGroupId)

        if (mode === 'subsequent' && targetInstallmentNumber !== null && targetInstallmentNumber !== undefined) {
          query = query.gte('installment_number', targetInstallmentNumber)
        }

        const { data: dbExpenses, error: dbError } = await query
        if (dbError) throw dbError

        if (dbExpenses && dbExpenses.length > 0) {
          idsToDelete = dbExpenses.map((exp) => exp.id)
        }
      } else if (target) {
        idsToDelete = [target.id]
      }

      if (idsToDelete.length === 0) {
        return { error: null }
      }

      const hasOfflineId = idsToDelete.some(idVal => idVal.startsWith('offline-'))
      if (hasOfflineId) {
        throw new Error('Offline ID (bypass supabase)')
      }

      // Delete associated pending debts in Supabase
      await supabase
        .from('debts')
        .delete()
        .in('expense_id', idsToDelete)
        .eq('status', 'pending')

      // Update local debts cache
      const debtsCache = await getCache<Debt[]>('debts-all')
      if (debtsCache) {
        const nextDebts = debtsCache.filter((d) => !(d.expense_id && idsToDelete.includes(d.expense_id) && d.status === 'pending'))
        await setCache('debts-all', nextDebts)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
      }

      const { error: deleteError } = await supabase
        .from('expenses')
        .delete()
        .in('id', idsToDelete)

      if (deleteError) throw deleteError

      const nextState = expenses.filter((exp) => !idsToDelete.includes(exp.id))
      setExpenses(nextState)
      await setCache(getCacheKey(), nextState)
      await clearCacheByKeyPrefix('expenses-')
      window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'expenses' } }))
      return { error: null }
    } catch (err) {
      if (shouldQueueOffline(err)) {
        let toDeleteOffline: Expense[] = []
        if (mode === 'all' && targetGroupId) {
          toDeleteOffline = expenses.filter((exp) => exp.installment_group_id === targetGroupId)
        } else if (mode === 'subsequent' && targetGroupId && targetInstallmentNumber !== null && targetInstallmentNumber !== undefined) {
          toDeleteOffline = expenses.filter((exp) => exp.installment_group_id === targetGroupId && (exp.installment_number ?? 1) >= targetInstallmentNumber)
        } else if (target) {
          toDeleteOffline = [target]
        }

        if (toDeleteOffline.length === 0) {
          return { error: null }
        }

        const offlineIdsToDelete = toDeleteOffline.map((exp) => exp.id)

        for (const exp of toDeleteOffline) {
          if (exp.id.startsWith('offline-')) {
            removeOfflineCreateOperation(exp.id)
          } else {
            enqueueOfflineOperation({
              entity: 'expenses',
              action: 'delete',
              recordId: exp.id,
            })
          }
        }

        // Enqueue delete operation for associated pending debts offline
        const debtsCache = await getCache<Debt[]>('debts-all')
        if (debtsCache) {
          const linkedPendingDebts = debtsCache.filter((d) => d.expense_id && offlineIdsToDelete.includes(d.expense_id) && d.status === 'pending')
          for (const debt of linkedPendingDebts) {
            if (!debt.id.startsWith('offline-')) {
              enqueueOfflineOperation({
                entity: 'debts',
                action: 'delete',
                recordId: debt.id,
              })
            } else {
              removeOfflineCreateOperation(debt.id)
            }
          }
          const nextDebts = debtsCache.filter((d) => !(d.expense_id && offlineIdsToDelete.includes(d.expense_id) && d.status === 'pending'))
          await setCache('debts-all', nextDebts)
          window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'debts' } }))
        }

        const nextState = expenses.filter((exp) => !offlineIdsToDelete.includes(exp.id))
        setExpenses(nextState)
        await setCache(getCacheKey(), nextState)
        window.dispatchEvent(new CustomEvent('local-data-changed', { detail: { entity: 'expenses' } }))
        return { error: null }
      }

      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar despesa'
      return { error: errorMessage }
    }
  }

  return {
    expenses,
    loading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    refreshExpenses: loadExpenses,
  }
}

