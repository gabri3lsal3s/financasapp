import { format, isValid, parse, startOfMonth, endOfMonth } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { clampMonthToAppStart, formatCurrencyCompactBR } from '@/utils/format'
import type {
  AssistantCommand,
  AssistantConfirmResult,
  AssistantIntent,
  AssistantInterpretResult,
  AssistantMonthlyInsightsResult,
  AssistantSession,
  AssistantSlots,
  Expense,
  Income,
  Investment,
} from '@/types'

import { extractVoiceCommand as extractIntentAndSlots } from '@/services/ai/voice'
import { generateMonthlyInsights } from '@/services/ai/insights'

import { resolveConfirmationPolicy } from '@/services/assistant-core/confirmationPolicy'
import type { AssistantConfirmationMode } from '@/services/assistant-core/confirmationPolicy'
import { resolveCategory } from '@/services/assistant-core/resolveCategory'
import {
  buildConfirmationText,
  isCommandExpired,
  resolveCategoryFromSpokenConfirmation,
} from '@/services/assistant-core/buildConfirmation'
import {
  executeWriteIntent,
  saveMappingIfPossible,
  getCurrentUserId,
  normalizeInstallmentCount,
} from '@/services/assistant-core/executeCommand'
import { inferIntent } from '@/services/assistant-core/inferIntent'
import { buildSlots } from '@/services/assistant-core/buildSlots'
import * as manualExtractors from '@/services/assistant-core/extractors'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const DEFAULT_LOCALE = 'pt-BR'

const ensureSession = async (
  deviceId: string,
  locale: string = DEFAULT_LOCALE,
): Promise<AssistantSession> => {
  const userId = await getCurrentUserId()

  let activeSessionQuery = supabase
    .from('assistant_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)

  if (userId) {
    activeSessionQuery = activeSessionQuery.eq('user_id', userId)
  }

  const { data: activeSession } = await activeSessionQuery.maybeSingle()

  if (activeSession) {
    if (!activeSession.user_id && userId) {
      const { data: updatedSession } = await supabase
        .from('assistant_sessions')
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq('id', activeSession.id)
        .select('*')
        .single()

      return updatedSession || activeSession
    }

    return activeSession
  }

  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()

  const { data: createdSession, error } = await supabase
    .from('assistant_sessions')
    .insert([
      {
        device_id: deviceId,
        platform: 'android',
        locale,
        user_id: userId,
        status: 'active',
        expires_at: expiresAt,
      },
    ])
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return createdSession
}

const resolveReadOnlyIntent = async (
  intent: AssistantIntent,
  month?: string,
): Promise<{ message: string; payload?: Record<string, unknown> }> => {
  const targetMonth = clampMonthToAppStart(month || format(new Date(), 'yyyy-MM'))
  const start = format(startOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')
  const end = format(endOfMonth(parse(`${targetMonth}-01`, 'yyyy-MM-dd', new Date())), 'yyyy-MM-dd')

  if (intent === 'get_month_balance') {
    if (!(await monthHasAnyData(targetMonth))) {
      return {
        message: `Não encontrei lançamentos em ${targetMonth}. Posso analisar apenas meses com dados.`,
        payload: {
          month: targetMonth,
          hasData: false,
        },
      }
    }

    const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
      supabase.from('expenses').select('amount').gte('date', start).lte('date', end),
      supabase.from('incomes').select('amount').gte('date', start).lte('date', end),
      supabase.from('investments').select('amount').eq('month', targetMonth),
    ])

    const totalExpenses = (expensesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const totalIncomes = (incomesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const totalInvestments = (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
    const balance = totalIncomes - totalExpenses - totalInvestments

    return {
      message: `Seu saldo de ${targetMonth} é ${formatCurrencyCompactBR(balance)}.`,
      payload: {
        month: targetMonth,
        totalExpenses,
        totalIncomes,
        totalInvestments,
        balance,
      },
    }
  }

  if (intent === 'list_recent_transactions') {
    const [expensesResult, incomesResult] = await Promise.all([
      supabase.from('expenses').select('id, amount, date, description').order('date', { ascending: false }).limit(5),
      supabase.from('incomes').select('id, amount, date, description').order('date', { ascending: false }).limit(5),
    ])

    return {
      message: 'Busquei seus últimos lançamentos.',
      payload: {
        expenses: expensesResult.data || [],
        incomes: incomesResult.data || [],
      },
    }
  }

  return {
    message: 'No momento, posso adicionar despesas, rendas e investimentos por comando de voz.',
  }
}

const monthHasAnyData = async (month: string): Promise<boolean> => {
  try {
    const start = `${month}-01`
    const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
    const end = format(endOfMonth(parsedStart), 'yyyy-MM-dd')

    const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
      supabase.from('expenses').select('id').gte('date', start).lte('date', end).limit(1),
      supabase.from('incomes').select('id').gte('date', start).lte('date', end).limit(1),
      supabase.from('investments').select('id').eq('month', month).limit(1),
    ])

    const hasExpenses = (expensesResult.data || []).length > 0
    const hasIncomes = (incomesResult.data || []).length > 0
    const hasInvestments = (investmentsResult.data || []).length > 0

    return hasExpenses || hasIncomes || hasInvestments
  } catch (err) {
    console.error('[monthHasAnyData] Error checking data:', err)
    // Return true on error to allow executeGetAssistantMonthlyInsights to proceed
    // where its own cache fallback will attempt to find data in localStorage.
    return true
  }
}

const getMonthRange = (month: string) => {
  const start = `${month}-01`
  const parsedStart = parse(start, 'yyyy-MM-dd', new Date())
  const monthEndDate = endOfMonth(parsedStart)

  return {
    start,
    parsedStart,
    end: format(monthEndDate, 'yyyy-MM-dd'),
    daysInMonth: monthEndDate.getDate(),
  }
}

const getAnalysisEndDate = (month: string, dayOfMonth: number) => {
  const { parsedStart, daysInMonth } = getMonthRange(month)
  const boundedDay = Math.max(1, Math.min(dayOfMonth, daysInMonth))
  return format(new Date(parsedStart.getFullYear(), parsedStart.getMonth(), boundedDay), 'yyyy-MM-dd')
}

const isValidMonthDate = (month: string, dateValue: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return false
  if (!dateValue.startsWith(`${month}-`)) return false

  const parsed = parse(dateValue, 'yyyy-MM-dd', new Date())
  if (!isValid(parsed)) return false

  return format(parsed, 'yyyy-MM-dd') === dateValue
}

const sanitizeReportWeight = (reportWeight?: number | null) => {
  const parsedWeight = Number(reportWeight ?? 1)

  if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 1) {
    return {
      weight: 1,
      corrected: true,
    }
  }

  return {
    weight: parsedWeight,
    corrected: false,
  }
}

const fetchMonthInsightDataset = async (
  month: string,
  options?: { analysisEndDate?: string },
) => {
  const { start, end } = getMonthRange(month)
  const analysisEndDate = options?.analysisEndDate

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    supabase
      .from('expenses')
      .select('amount, report_weight, date, description, category:categories(name)')
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('incomes')
      .select('amount, report_weight, date, description')
      .gte('date', start)
      .lte('date', end),
    supabase
      .from('investments')
      .select('amount')
      .eq('month', month),
  ])

  const rawExpenses = (expensesResult.data || []) as any[]
  const rawIncomes = (incomesResult.data || []) as any[]
  const validation = { invalidExpenseRows: 0, invalidIncomeRows: 0, ignoredFutureRows: 0, correctedWeights: 0 }

  const expenses = rawExpenses.reduce<any[]>((acc, item) => {
    const amount = Number(item.amount || 0)
    const date = String(item.date || '')

    if (!Number.isFinite(amount) || amount <= 0 || !isValidMonthDate(month, date)) {
      validation.invalidExpenseRows += 1
      return acc
    }

    if (analysisEndDate && date > analysisEndDate) {
      validation.ignoredFutureRows += 1
      return acc
    }

    const { weight, corrected } = sanitizeReportWeight(item.report_weight)
    if (corrected) validation.correctedWeights += 1

    acc.push({
      ...item,
      amount,
      date,
      report_weight: weight,
    })

    return acc
  }, [])

  const incomes = rawIncomes.reduce<any[]>((acc, item) => {
    const amount = Number(item.amount || 0)
    const date = String(item.date || '')

    if (!Number.isFinite(amount) || amount <= 0 || !isValidMonthDate(month, date)) {
      validation.invalidIncomeRows += 1
      return acc
    }

    if (analysisEndDate && date > analysisEndDate) {
      validation.ignoredFutureRows += 1
      return acc
    }

    const { weight, corrected } = sanitizeReportWeight(item.report_weight)
    if (corrected) validation.correctedWeights += 1

    acc.push({
      ...item,
      amount,
      date,
      report_weight: weight,
    })

    return acc
  }, [])

  const investments = ((investmentsResult.data || []) as Array<{ amount?: number | null }>)
    .map((item) => Number(item.amount || 0))
    .filter((amount) => Number.isFinite(amount) && amount > 0)

  return {
    expenses,
    incomes,
    investments,
    validation,
    totals: {
      expenses: expenses.reduce((sum, item) => sum + (Number(item.amount || 0) * (item.report_weight || 1)), 0),
      incomes: incomes.reduce((sum, item) => sum + (Number(item.amount || 0) * (item.report_weight || 1)), 0),
      investments: investments.reduce((sum, amount) => sum + amount, 0),
    },
  }
}

const generateIdempotencyKey = (sessionId: string, text: string) => {
  const normalized = normalizeText(text).replace(/\s+/g, '_')
  const minuteBucket = format(new Date(), 'yyyyMMddHHmm')
  return `${sessionId}:${normalized}:${minuteBucket}`
}

const normalizeDescriptionCasing = (value: string) => {
  if (!value) return value
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
}

const removeLeadingArticle = (value: string) => {
  return value.replace(/^(o|a|os|as|um|uma|uns|umas)\s+/i, '')
}

type InsightTimingPhase = 'early' | 'middle' | 'closing' | 'closed'

const getInsightTimingProfile = (targetMonth: string, referenceDate = new Date()) => {
  const currentMonthKey = clampMonthToAppStart(format(referenceDate, 'yyyy-MM'))
  const isClosedMonth = targetMonth < currentMonthKey
  const isCurrentMonth = currentMonthKey === targetMonth
  const { daysInMonth } = getMonthRange(targetMonth)
  const elapsedDays = isCurrentMonth ? Math.min(referenceDate.getDate(), daysInMonth) : daysInMonth
  const isLastDayOfCurrentMonth = isCurrentMonth && referenceDate.getDate() >= daysInMonth
  const isFinalizedAnalysis = isClosedMonth || isLastDayOfCurrentMonth
  const monthProgressPct = (elapsedDays / Math.max(daysInMonth, 1)) * 100
  const analysisEndDate = getAnalysisEndDate(targetMonth, elapsedDays)
  const analysisPhase: InsightTimingPhase = isClosedMonth
    ? 'closed'
    : monthProgressPct < 35
      ? 'early'
      : monthProgressPct < 85
        ? 'middle'
        : 'closing'

  return {
    isClosedMonth,
    isCurrentMonth,
    daysInMonth,
    elapsedDays,
    monthProgressPct,
    analysisEndDate,
    analysisPhase,
    isFinalizedAnalysis,
    allowsConclusiveComparisons: isFinalizedAnalysis,
    allowsMixedComparisons: !isFinalizedAnalysis && (analysisPhase === 'middle' || analysisPhase === 'closing'),
  }
}

export async function interpretAssistantCommand(params: {
  deviceId: string
  text: string
  locale?: string
  confirmationMode?: AssistantConfirmationMode
  forceConfirmation?: boolean
}): Promise<AssistantInterpretResult> {
  const session = await ensureSession(params.deviceId, params.locale || DEFAULT_LOCALE)
  const userId = session.user_id || await getCurrentUserId()

  const [categoriesResult, incomeCategoriesResult, creditCardsResult] = await Promise.all([
    supabase.from('categories').select('*'),
    supabase.from('income_categories').select('*'),
    supabase.from('credit_cards').select('id, name, is_active').or('is_active.is.null,is_active.eq.true'),
  ])

  // Extract using the new AI Service
  let extracted;
  try {
    extracted = await extractIntentAndSlots(params.text, {
      categories: categoriesResult.data || [],
      incomeCategories: incomeCategoriesResult.data || [],
      creditCards: creditCardsResult.data || [],
    })
  } catch (error) {
    console.error('[interpretAssistantCommand] AI Error:', error)
    const errorMessage = error instanceof Error ? error.message : ''
    if (errorMessage.includes('429') || errorMessage.toLowerCase().includes('quota') || errorMessage.toLowerCase().includes('limit')) {
      throw new Error('Limite de uso do assistente atingido. Tente novamente mais tarde.')
    }
    throw error
  }
  const intent = extracted.intent
  const confidence = 0.95 // High confidence when coming from LLM

  const slots: AssistantSlots = {
    amount: extracted.slots.amount,
    date: extracted.slots.date,
    month: extracted.slots.month,
    description: extracted.slots.description,
    payment_method: extracted.slots.payment_method,
    credit_card_id: (extracted.slots as any).creditCardId || extracted.slots.credit_card_id,
    credit_card_name: (extracted.slots as any).creditCardName || extracted.slots.credit_card_name,
    installment_count: (extracted.slots as any).installmentCount || extracted.slots.installment_count,
    report_weight: (extracted.slots as any).reportWeight || extracted.slots.report_weight,
    items: extracted.slots.items?.map(i => ({
      transactionType: i.transactionType === 'expense' ? 'expense' : i.transactionType === 'income' ? 'income' : 'investment',
      amount: i.amount,
      description: i.description,
      installment_count: (i as any).installmentCount || i.installment_count,
      payment_method: i.payment_method,
      credit_card_id: (i as any).creditCardId || i.credit_card_id,
      credit_card_name: (i as any).creditCardName || i.credit_card_name,
      report_weight: (i as any).reportWeight || i.report_weight
    }))
  }

  const categoryResolution = await resolveCategory(intent, slots)
  if (categoryResolution.selectedCategory) {
    slots.category = categoryResolution.selectedCategory
  }

  // Ensure credit_card_id and credit_card_name are set in slots if not already
  if (!slots.credit_card_id && extracted.slots.credit_card_id) {
    slots.credit_card_id = extracted.slots.credit_card_id
  }
  if (!slots.credit_card_name && extracted.slots.credit_card_name) {
    slots.credit_card_name = extracted.slots.credit_card_name
  }

  // Se houver indicação de cartão, garantir que o modo de pagamento seja cartão
  if ((slots.credit_card_id || slots.credit_card_name) && intent === 'add_expense' && slots.payment_method !== 'credit_card') {
    slots.payment_method = 'credit_card'
  }

  const confirmationPolicy = resolveConfirmationPolicy({
    intent,
    slots,
    confidence,
    needsCategoryDisambiguation: categoryResolution.needsDisambiguation,
    mode: params.confirmationMode || 'write_only',
    forceConfirmation: params.forceConfirmation,
  })
  const pendingConfirmation = confirmationPolicy.requiresConfirmation

  const { data: insertedCommand, error } = await supabase
    .from('assistant_commands')
    .insert([
      {
        session_id: session.id,
        user_id: userId,
        command_text: params.text,
        interpreted_intent: intent,
        confidence,
        slots_json: slots,
        category_resolution_json: {
          selectedCategory: categoryResolution.selectedCategory || null,
          candidates: categoryResolution.candidates,
          needsDisambiguation: categoryResolution.needsDisambiguation,
        },
        requires_confirmation: pendingConfirmation,
        status: pendingConfirmation ? 'pending_confirmation' : 'executed',
        idempotency_key: generateIdempotencyKey(session.id, params.text),
      },
    ])
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  if (!pendingConfirmation) {
    const readOnlyResult = await resolveReadOnlyIntent(intent, slots.month)

    await supabase
      .from('assistant_commands')
      .update({
        execution_result_json: readOnlyResult.payload || { message: readOnlyResult.message },
        updated_at: new Date().toISOString(),
      })
      .eq('id', insertedCommand.id)

    return {
      command: insertedCommand,
      intent,
      confidence,
      slots,
      requiresConfirmation: false,
      confirmationText: readOnlyResult.message,
    }
  }

  return {
    command: insertedCommand,
    intent,
    confidence,
    slots,
    requiresConfirmation: true,
    confirmationText: buildConfirmationText(intent, slots, {
      needsCategoryDisambiguation: categoryResolution.needsDisambiguation,
      categoryCandidates: categoryResolution.candidates,
    }),
  }
}

export async function confirmAssistantCommand(params: {
  commandId: string
  confirmed: boolean
  spokenText?: string
  editedDescription?: string
  editedSlots?: AssistantSlots
  confirmationMethod?: 'voice' | 'touch'
}): Promise<AssistantConfirmResult> {
  const { data: command, error } = await supabase
    .from('assistant_commands')
    .select('*')
    .eq('id', params.commandId)
    .single()

  if (error || !command) {
    throw new Error(error?.message || 'Comando não encontrado.')
  }

  const userId = command.user_id || await getCurrentUserId()

  await supabase.from('assistant_confirmations').insert([
    {
      command_id: command.id,
      session_id: command.session_id,
      user_id: userId,
      confirmed: params.confirmed,
      spoken_text: params.spokenText,
      confirmation_method: params.confirmationMethod || 'voice',
    },
  ])

  if (!params.confirmed) {
    await supabase
      .from('assistant_commands')
      .update({ status: 'denied', updated_at: new Date().toISOString() })
      .eq('id', command.id)

    return {
      status: 'denied',
      message: params.confirmationMethod === 'touch' ? 'Comando cancelado.' : 'Comando cancelado por voz.',
      commandId: command.id,
    }
  }

  if (isCommandExpired(command.created_at)) {
    await supabase
      .from('assistant_commands')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', command.id)

    return {
      status: 'expired',
      message: params.confirmationMethod === 'touch'
        ? 'Confirmação expirada. Refaça o comando.'
        : 'Confirmação expirada. Refaça o comando por voz.',
      commandId: command.id,
    }
  }

  await supabase
    .from('assistant_commands')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', command.id)

  let commandToExecute: AssistantCommand = command
  const needsDisambiguation = Boolean(
    (command.category_resolution_json as { needsDisambiguation?: boolean } | undefined)?.needsDisambiguation,
  )

  const editedDescription = params.editedDescription?.trim()
  const editedSlots = params.editedSlots
  if (editedSlots) {
    const baseSlots = commandToExecute.slots_json || {}

    const normalizedItems = editedSlots.items
      ?.map((item) => ({
        ...item,
        amount: Number(item.amount),
        installment_count: normalizeInstallmentCount(item.installment_count),
        report_weight: Number.isFinite(item.report_weight) ? Number(item.report_weight) : undefined,
        description: item.description?.trim() || undefined,
        date: item.date?.trim() || undefined,
        month: item.month?.trim() || undefined,
      }))
      .filter((item) => Number.isFinite(item.amount) && item.amount > 0)

    const updatedSlots: AssistantSlots = {
      ...baseSlots,
      ...editedSlots,
      amount: Number.isFinite(editedSlots.amount) ? Number(editedSlots.amount) : baseSlots.amount,
      installment_count: normalizeInstallmentCount(editedSlots.installment_count) || baseSlots.installment_count,
      description: editedSlots.description?.trim() || baseSlots.description,
      date: editedSlots.date?.trim() || baseSlots.date,
      month: editedSlots.month?.trim() || baseSlots.month,
      category: editedSlots.category || baseSlots.category,
      items: normalizedItems ?? baseSlots.items,
    }

    await supabase
      .from('assistant_commands')
      .update({
        slots_json: updatedSlots,
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.id)

    commandToExecute = {
      ...commandToExecute,
      slots_json: updatedSlots,
    }
  }

  if (editedDescription) {
    const sanitizedDescription = normalizeDescriptionCasing(removeLeadingArticle(editedDescription))
    const originalSlots = commandToExecute.slots_json || {}
    const updatedSlots: AssistantSlots = {
      ...originalSlots,
      description: sanitizedDescription,
      items: originalSlots.items?.map((item, index) => {
        if (index !== 0 || (originalSlots.items?.length || 0) > 1) return item
        return {
          ...item,
          description: sanitizedDescription,
        }
      }),
    }

    await supabase
      .from('assistant_commands')
      .update({
        slots_json: updatedSlots,
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.id)

    commandToExecute = {
      ...commandToExecute,
      slots_json: updatedSlots,
    }
  }

  if (needsDisambiguation && (command.interpreted_intent === 'add_expense' || command.interpreted_intent === 'add_income')) {
    const resolvedCategory = resolveCategoryFromSpokenConfirmation(command, params.spokenText)
    if (!resolvedCategory?.id) {
      return {
        status: 'failed',
        message: 'Não consegui identificar a categoria informada na confirmação por voz.',
        commandId: command.id,
      }
    }

    const updatedSlots: AssistantSlots = {
      ...(command.slots_json || {}),
      category: resolvedCategory,
    }

    await supabase
      .from('assistant_commands')
      .update({
        slots_json: updatedSlots,
        category_resolution_json: {
          ...(command.category_resolution_json as Record<string, unknown> || {}),
          selectedCategory: resolvedCategory,
          needsDisambiguation: false,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', command.id)

    commandToExecute = {
      ...command,
      slots_json: updatedSlots,
      category_resolution_json: {
        ...(command.category_resolution_json as Record<string, unknown> || {}),
        selectedCategory: resolvedCategory,
        needsDisambiguation: false,
      },
    }
  }

  console.log('[confirmAssistantCommand] Executing intent with payload:', commandToExecute)
  const execution = await executeWriteIntent(commandToExecute)
  console.log('[confirmAssistantCommand] Execution result:', execution)

  const updatePayload: Record<string, unknown> = {
    status: execution.status,
    execution_result_json: execution,
    updated_at: new Date().toISOString(),
  }

  if (execution.status === 'failed') {
    updatePayload.error_message = execution.message
  }

  await supabase.from('assistant_commands').update(updatePayload).eq('id', command.id)
  await saveMappingIfPossible(commandToExecute, params.confirmed)

  return execution
}

const activeInsightPromises = new Map<string, Promise<AssistantMonthlyInsightsResult | null>>()

export async function getAssistantMonthlyInsights(month?: string, force?: boolean): Promise<AssistantMonthlyInsightsResult | null> {
  const targetMonth = clampMonthToAppStart(month || format(new Date(), 'yyyy-MM'))

  // Use a singleton pattern to prevent concurrent requests for the same month
  // We keep force separate in the key to allow a forced request to join an existing forced one
  const cacheKey = `singleton:${targetMonth}${force ? ':force' : ''}`
  const existingPromise = activeInsightPromises.get(cacheKey)
  if (existingPromise) return existingPromise

  const newPromise = (async () => {
    try {
      return await executeGetAssistantMonthlyInsights(targetMonth, force)
    } finally {
      activeInsightPromises.delete(cacheKey)
    }
  })()

  activeInsightPromises.set(cacheKey, newPromise)
  return newPromise
}

const isMonthComplete = (month: string): boolean => {
  const [year, m] = month.split('-').map(Number)
  const lastDay = new Date(year, m, 0) // last day of month
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today >= lastDay
}

const computeDataHash = (data: { expenses: { amount: number }[], incomes: { amount: number }[], investments: number[] }): string => {
  const expTotal = Math.round(data.expenses.reduce((s, e) => s + e.amount, 0) * 100)
  const incTotal = Math.round(data.incomes.reduce((s, i) => s + i.amount, 0) * 100)
  const invTotal = Math.round(data.investments.reduce((s, v) => s + v, 0) * 100)
  return `${data.expenses.length}:${data.incomes.length}:${data.investments.length}:${expTotal}:${incTotal}:${invTotal}`
}

const getLocalStorageInsights = (month: string): AssistantMonthlyInsightsResult | null => {
  const cachedDbDataRaw = localStorage.getItem(`minhas-financas:insights-cache:${month}`)
  if (cachedDbDataRaw) {
    try {
      const cachedParsed = JSON.parse(cachedDbDataRaw)
      return { month, highlights: cachedParsed.highlights, recommendations: cachedParsed.recommendations }
    } catch {
      return null
    }
  }
  return null
}

async function executeGetAssistantMonthlyInsights(targetMonth: string, force?: boolean): Promise<AssistantMonthlyInsightsResult | null> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return getLocalStorageInsights(targetMonth)
  }

  const failureKey = `minhas-financas:insights-failure:${targetMonth}`

  // 1. Get current userId
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return getLocalStorageInsights(targetMonth)

  // 2. Load current data upfront (needed for hash comparison)
  if (!(await monthHasAnyData(targetMonth))) {
    return getLocalStorageInsights(targetMonth)
  }

  const currentData = await fetchMonthInsightDataset(targetMonth)
  const currentHash = computeDataHash(currentData)

  // 3. Fetch from Supabase
  let cachedDbData = null
  try {
    const { data } = await supabase
      .from('monthly_insights')
      .select('month, highlights, recommendations, data_hash, updated_at')
      .eq('month', targetMonth)
      .limit(1)
      .maybeSingle()
    cachedDbData = data
  } catch (err) {
    console.error('[executeGetAssistantMonthlyInsights] Error fetching from Supabase:', err)
    // Fallback to localStorage if Supabase query fails
    return getLocalStorageInsights(targetMonth)
  }

  const cachedData = cachedDbData ? {
    month: cachedDbData.month,
    highlights: cachedDbData.highlights as string[],
    recommendations: cachedDbData.recommendations as string[],
    dataHash: cachedDbData.data_hash as string | undefined,
    generatedAt: cachedDbData.updated_at as string | undefined
  } : null

  // 4. Apply locking/caching rules
  if (cachedData && !force) {
    const monthComplete = isMonthComplete(targetMonth)

    if (monthComplete) {
      // Past month: return cached unless data has provably changed
      // Backward-compatible: if cache has no hash, treat it as locked (no re-generation without force)
      const hashChanged = cachedData.dataHash && cachedData.dataHash !== currentHash
      if (!hashChanged) {
        return { month: cachedData.month, highlights: cachedData.highlights, recommendations: cachedData.recommendations }
      }
    } else {
      // Current month: 15-day rule
      if (cachedData.generatedAt) {
        const diffDays = Math.floor((Date.now() - new Date(cachedData.generatedAt).getTime()) / (1000 * 60 * 60 * 24))
        if (diffDays < 15) {
          return { month: cachedData.month, highlights: cachedData.highlights, recommendations: cachedData.recommendations }
        }
      }
    }
  }

  // 5. Check failure cooldown (skip if forced)
  if (!force) {
    const lastFailure = localStorage.getItem(failureKey)
    if (lastFailure) {
      const diffHours = (Date.now() - new Date(lastFailure).getTime()) / (1000 * 60 * 60)
      if (diffHours < 1) {
        if (cachedData) return { month: cachedData.month, highlights: cachedData.highlights, recommendations: cachedData.recommendations }
        return null // Silently fail – Dashboard will show a toast
      }
    }
  }

  // 6. Call the API
  const expensesForContext = currentData.expenses.map(e => ({
    ...e,
    id: e.id || e.date,
    user_id: e.user_id || '',
    category_id: e.category_id || '',
    created_at: e.created_at || new Date().toISOString(),
    payment_method: e.payment_method || 'other',
    installment_count: e.installment_count || 1,
    category: {
      id: '',
      name: e.category?.name || 'Sem categoria',
      color: '#000000',
      user_id: '',
      created_at: new Date().toISOString()
    }
  })) as unknown as Expense[]

  const incomesForContext = currentData.incomes.map(i => ({
    amount: i.amount,
    type: 'other',
    date: i.date,
    id: i.date,
    description: i.description || '',
    user_id: ''
  } as Income))

  const investmentsForContext = currentData.investments.map((inv, idx) => ({
    amount: inv,
    month: targetMonth,
    id: `inv-${idx}`,
    description: '',
    user_id: ''
  } as Investment))

  const formattedMonthName = new Date(`${targetMonth}-01T12:00:00`).toLocaleString('pt-BR', { month: 'long', year: 'numeric' })

  const insights = await generateMonthlyInsights({
    monthName: formattedMonthName.charAt(0).toUpperCase() + formattedMonthName.slice(1),
    expenses: expensesForContext,
    incomes: incomesForContext,
    investments: investmentsForContext
  })

  // 7. Handle API failure
  if (!insights) {
    if (typeof navigator !== 'undefined' && !navigator.onLine && cachedData) {
      // Offline fallback: do not write failure, just return cached seamlessly
      return { month: cachedData.month, highlights: cachedData.highlights, recommendations: cachedData.recommendations }
    }
    localStorage.setItem(failureKey, new Date().toISOString())
    if (cachedData) return { month: cachedData.month, highlights: cachedData.highlights, recommendations: cachedData.recommendations }
    return null // Silently fail – caller will show a toast
  }

  // 8. Success: Save to Supabase using upsert
  localStorage.removeItem(failureKey)
  const result: AssistantMonthlyInsightsResult = {
    month: insights.month,
    highlights: insights.highlights,
    recommendations: insights.recommendations,
  }

  localStorage.setItem(`minhas-financas:insights-cache:${targetMonth}`, JSON.stringify(result))

  // Fire and forget upsert OR await it. It's better to await to ensure consistency
  await supabase
    .from('monthly_insights')
    .upsert(
      {
        user_id: user.id,
        month: targetMonth,
        highlights: insights.highlights,
        recommendations: insights.recommendations,
        data_hash: currentHash,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id, month' }
    )

  return result
}

export async function getActiveAssistantSession(deviceId: string) {
  return ensureSession(deviceId, DEFAULT_LOCALE)
}

export const assistantParserInternals = {
  inferIntent: (text: string) =>
    inferIntent({
      text,
      extractAmount: manualExtractors.extractAmount,
      classifyWriteTransactionType: () => ({ type: 'expense', scores: { expense: 0, income: 0, investment: 0 } }),
    }),
  buildSlots: (text: string, intent: AssistantIntent) =>
    buildSlots({
      text,
      intent,
      extractAmount: manualExtractors.extractAmount,
      extractDate: manualExtractors.extractDate,
      extractDescription: manualExtractors.extractDescription,
      extractAddItemsFromText: manualExtractors.extractAddItemsFromText,
      extractInstallmentCount: manualExtractors.extractInstallmentCount,
      extractPaymentMethod: manualExtractors.extractPaymentMethod,
      extractCreditCardName: manualExtractors.extractCreditCardName,
    }),
  getInsightTimingProfile,
  mergeRelatedConclusiveHighlights: (highlights: string[]) => {
    const result: string[] = []
    const catData: Record<string, { overLimit?: string; concentration?: string }> = {}
    const others: string[] = []

    for (const h of highlights) {
      const olMatch = h.match(/^(.+?)\s+passou do limite em\s+([\d%]+)\.?/)
      const cnMatch = h.match(/^(.+?)\s+concentrou\s+([\d%]+)\s+das despesas/)

      if (olMatch) {
        const cat = olMatch[1].trim()
        catData[cat] = { ...catData[cat], overLimit: olMatch[2] }
      } else if (cnMatch) {
        const cat = cnMatch[1].trim()
        catData[cat] = { ...catData[cat], concentration: cnMatch[2] }
      } else {
        others.push(h)
      }
    }

    for (const [cat, data] of Object.entries(catData)) {
      if (data.overLimit && data.concentration) {
        result.push(`${cat} passou do limite em ${data.overLimit} concentrando ${data.concentration} das despesas.`)
      } else if (data.overLimit) {
        result.push(`${cat} passou do limite em ${data.overLimit}.`)
      } else if (data.concentration) {
        result.push(`${cat} concentrou ${data.concentration} das despesas do mês.`)
      }
    }

    return [...result, ...others]
  },
  buildInProgressRecommendations: (_h: string[], r: string[]) => r, // Stub
}
