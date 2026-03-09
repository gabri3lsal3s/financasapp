import { addMonths, format, parse } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { enqueueOfflineOperation, shouldQueueOffline } from '@/utils/offlineQueue'
import { resolveBillCompetence } from '@/utils/creditCardBilling'
import type {
  AssistantCommand,
  AssistantConfirmResult,
  AssistantResolvedCategory,
} from '@/types'
import { resolveCategory } from './resolveCategory'

export type WritableTransactionType = 'expense' | 'income' | 'investment'

export const getCurrentUserId = async (): Promise<string | undefined> => {
  const { data, error } = await supabase.auth.getUser()
  if (error) return undefined
  return data.user?.id
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export const normalizeInstallmentCount = (value: number | string | null | undefined): number => {
  if (!value) return 1
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const parseSharedParticipants = (text: string): number | undefined => {
  const match = text.match(/(?:dividid[oa]|dividindo|repartid[oa]|rachad[oa])\s+(?:com|por|entre)\s+(\w+)/i)
  if (!match) return undefined
  const word = match[1].toLowerCase()
  const map: Record<string, number> = {
    dois: 2,
    tres: 3,
    três: 3,
    quatro: 4,
    cinco: 5,
    seis: 6,
    ele: 2,
    ela: 2,
    amigo: 2,
    amiga: 2,
    namorado: 2,
    namorada: 2,
    esposa: 2,
    marido: 2,
    irmao: 2,
    irmão: 2,
    irma: 2,
    irmã: 2,
    pai: 2,
    mae: 2,
    mãe: 2,
    pais: 3,
  }
  return map[word] || (Number.isFinite(Number(word)) ? Number(word) : undefined)
}

const buildInstallmentDates = (baseDate: string, count: number): string[] => {
  const dates: string[] = []
  let currentDate = parse(baseDate, 'yyyy-MM-dd', new Date())
  for (let i = 0; i < count; i++) {
    dates.push(format(currentDate, 'yyyy-MM-dd'))
    currentDate = addMonths(currentDate, 1)
  }
  return dates
}

const splitInstallmentAmounts = (total: number, count: number): number[] => {
  if (count <= 1) return [total]
  const baseAmount = Math.floor((total / count) * 100) / 100
  const remainder = Math.round((total - baseAmount * count) * 100) / 100
  const amounts = Array(count).fill(baseAmount)
  amounts[0] = Math.round((amounts[0] + remainder) * 100) / 100
  return amounts
}

const generateUuid = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0,
      v = c == 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export const executeWriteIntent = async (command: AssistantCommand): Promise<AssistantConfirmResult> => {
  const slots = command.slots_json || {}
  const userId = command.user_id || (await getCurrentUserId())

  if (
    command.interpreted_intent !== 'add_expense' &&
    command.interpreted_intent !== 'add_income' &&
    command.interpreted_intent !== 'add_investment'
  ) {
    return {
      status: 'failed',
      message: 'No momento, o assistente executa apenas adições de despesas, rendas e investimentos.',
      commandId: command.id,
    }
  }

  const addItems: Array<{
    transactionType: WritableTransactionType
    amount: number
    installment_count?: number
    payment_method?: 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other'
    credit_card_id?: string
    credit_card_name?: string
    report_weight?: number
    description?: string
    date?: string
    month?: string
    category?: AssistantResolvedCategory
  }> =
    slots.items && slots.items.length
      ? slots.items.map((item) => ({
          ...item,
          installment_count: normalizeInstallmentCount(item.installment_count),
          transactionType:
            item.transactionType ||
            (command.interpreted_intent === 'add_investment'
              ? 'investment'
              : command.interpreted_intent === 'add_income'
              ? 'income'
              : 'expense'),
        }))
      : slots.amount
      ? (() => {
          const singleItemParticipants = parseSharedParticipants(command.command_text)
          const slotTransactionType =
            slots.transactionType === 'investment'
              ? 'investment'
              : slots.transactionType === 'income'
              ? 'income'
              : slots.transactionType === 'expense'
              ? 'expense'
              : undefined
          return [
            {
              transactionType:
                slotTransactionType ||
                (command.interpreted_intent === 'add_investment'
                  ? 'investment'
                  : command.interpreted_intent === 'add_income'
                  ? 'income'
                  : 'expense'),
              amount: Number(slots.amount),
              installment_count: normalizeInstallmentCount(slots.installment_count),
              payment_method: slots.payment_method,
              credit_card_id: slots.credit_card_id,
              credit_card_name: slots.credit_card_name,
              report_weight: Number.isFinite(singleItemParticipants)
                ? Number((1 / Number(singleItemParticipants)).toFixed(4))
                : undefined,
              description: slots.description,
              date: slots.date,
              month: slots.month,
              category: slots.category,
            },
          ]
        })()
      : []

  if (!addItems.length) {
    return { status: 'failed', message: 'Comando incompleto para lançamento.', commandId: command.id }
  }

  const expenseItems = addItems.filter((item) => item.transactionType === 'expense')
  const incomeItems = addItems.filter((item) => item.transactionType === 'income')
  const investmentItems = addItems.filter((item) => item.transactionType === 'investment')

  const createdIds: string[] = []
  const queuedOfflineCounts: Record<WritableTransactionType, number> = {
    expense: 0,
    income: 0,
    investment: 0,
  }

  if (expenseItems.length) {
    const needsCreditCardLookup = expenseItems.some(
      (item) => item.payment_method === 'credit_card' || item.credit_card_id || item.credit_card_name,
    )

    let creditCards: Array<{ id: string; name: string; closing_day: number; is_active: boolean | null }> = []

    if (needsCreditCardLookup) {
      const { data: cardsData } = await supabase
        .from('credit_cards')
        .select('id, name, closing_day, is_active')
        .order('name', { ascending: true })

      creditCards = cardsData || []
    }

    const monthlyCycleClosingByCardAndMonth: Record<string, number> = {}

    if (needsCreditCardLookup && creditCards.length) {
      const neededCompetences = new Set<string>()

      expenseItems.forEach((item) => {
        const baseDate = item.date || slots.date
        if (!baseDate) return

        const installmentCount = normalizeInstallmentCount(item.installment_count) || 1
        const installmentDates = buildInstallmentDates(baseDate, installmentCount)
        installmentDates.forEach((dateValue) => neededCompetences.add(dateValue.substring(0, 7)))
      })

      if (neededCompetences.size) {
        const { data: cycleRows } = await supabase
          .from('credit_card_monthly_cycles')
          .select('credit_card_id, competence, closing_day')
          .in(
            'credit_card_id',
            creditCards.map((card) => card.id),
          )
          .in('competence', Array.from(neededCompetences))

        ;(cycleRows || []).forEach((row) => {
          const key = `${String(row.credit_card_id || '')}:${String(row.competence || '')}`
          if (key.startsWith(':')) return

          const closingDay = Number(row.closing_day)
          if (Number.isFinite(closingDay)) {
            monthlyCycleClosingByCardAndMonth[key] = closingDay
          }
        })
      }
    }

    let hasMissingCreditCardReference = false

    const { data: expenseCategories } = await supabase
      .from('categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedExpenseId = (expenseCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id
    const fallbackExpenseCategoryId = uncategorizedExpenseId || (expenseCategories || [])[0]?.id

    const expensePayloadNested = await Promise.all(
      expenseItems.map(async (item) => {
        let resolvedCategoryId = item.category?.id

        if (!resolvedCategoryId && item.description) {
          const resolution = await resolveCategory('add_expense', {
            amount: item.amount,
            description: item.description,
            date: item.date || slots.date,
            month: item.month || slots.month,
          })
          resolvedCategoryId = resolution.selectedCategory?.id
        }

        resolvedCategoryId = resolvedCategoryId || fallbackExpenseCategoryId

        const effectiveDate = item.date || slots.date
        const installmentCount = normalizeInstallmentCount(item.installment_count) || 1
        const normalizedCardName = normalizeText(item.credit_card_name || '')

        let resolvedCreditCardId = item.credit_card_id

        if (!resolvedCreditCardId && normalizedCardName) {
          const matchedByName = creditCards.find((card) => {
            const normalizedRegistered = normalizeText(card.name)
            return normalizedRegistered.includes(normalizedCardName) || normalizedCardName.includes(normalizedRegistered)
          })
          resolvedCreditCardId = matchedByName?.id
        }

        const resolveClosingDayForDate = (targetDate: string) => {
          if (!resolvedCreditCardId) return undefined

          const competence = targetDate.substring(0, 7)
          const monthlyClosingDay = monthlyCycleClosingByCardAndMonth[`${resolvedCreditCardId}:${competence}`]
          if (Number.isFinite(monthlyClosingDay)) {
            return Number(monthlyClosingDay)
          }

          const card = creditCards.find((candidate) => candidate.id === resolvedCreditCardId)
          if (card && Number.isFinite(card.closing_day)) {
            return Number(card.closing_day)
          }

          return undefined
        }

        const resolvedPaymentMethod = item.payment_method || (resolvedCreditCardId ? 'credit_card' : 'other')

        if (resolvedPaymentMethod === 'credit_card' && !resolvedCreditCardId) {
          hasMissingCreditCardReference = true
          return []
        }

        if (!effectiveDate || !resolvedCategoryId) {
          return []
        }

        if (installmentCount <= 1) {
          const closingDay = resolveClosingDayForDate(effectiveDate)
          const billCompetence =
            resolvedPaymentMethod === 'credit_card' && Number.isFinite(closingDay)
              ? resolveBillCompetence(effectiveDate, Number(closingDay))
              : undefined

          return [
            {
              amount: item.amount,
              report_weight: item.report_weight,
              date: effectiveDate,
              category_id: resolvedCategoryId,
              payment_method: resolvedPaymentMethod,
              ...(resolvedCreditCardId ? { credit_card_id: resolvedCreditCardId } : {}),
              ...(billCompetence ? { bill_competence: billCompetence } : {}),
              description: item.description,
              ...(userId ? { user_id: userId } : {}),
            },
          ]
        }

        const installmentGroupId = generateUuid()
        const installmentAmounts = splitInstallmentAmounts(item.amount, installmentCount)
        const installmentDates = buildInstallmentDates(effectiveDate, installmentCount)

        return installmentAmounts.map((installmentAmount, index) => {
          const installmentDate = installmentDates[index]
          const closingDay = resolveClosingDayForDate(installmentDate)
          const billCompetence =
            resolvedPaymentMethod === 'credit_card' && Number.isFinite(closingDay)
              ? resolveBillCompetence(installmentDate, Number(closingDay))
              : undefined

          return {
            amount: installmentAmount,
            report_weight: item.report_weight,
            date: installmentDate,
            category_id: resolvedCategoryId,
            payment_method: resolvedPaymentMethod,
            ...(resolvedCreditCardId ? { credit_card_id: resolvedCreditCardId } : {}),
            ...(billCompetence ? { bill_competence: billCompetence } : {}),
            description: item.description,
            installment_group_id: installmentGroupId,
            installment_number: index + 1,
            installment_total: installmentCount,
            ...(userId ? { user_id: userId } : {}),
          }
        })
      }),
    )

    const expensePayload = expensePayloadNested.flat()

    if (hasMissingCreditCardReference) {
      return {
        status: 'failed',
        message: 'Não encontrei o cartão informado. Verifique o nome do cartão e tente novamente.',
        commandId: command.id,
      }
    }

    if (expensePayload.some((item) => !item.date || !item.category_id)) {
      return {
        status: 'failed',
        message: 'Não foi possível resolver data/categoria para todas as despesas.',
        commandId: command.id,
      }
    }

    const { data, error } = await supabase.from('expenses').insert(expensePayload).select('id')

    if (error) {
      if (shouldQueueOffline(error)) {
        expensePayload.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'expenses',
            action: 'create',
            payload,
            idempotencyKey: `${command.id}:expense:${index}`,
          })
        })
        queuedOfflineCounts.expense += expensePayload.length
      } else {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    } else {
      createdIds.push(...(data?.map((item) => item.id) || []))
    }
  }

  if (incomeItems.length) {
    const { data: incomeCategories } = await supabase
      .from('income_categories')
      .select('id, name, color')
      .order('name', { ascending: true })

    const uncategorizedIncomeId = (incomeCategories || []).find(
      (category) => normalizeText(category.name) === normalizeText('Sem categoria'),
    )?.id
    const fallbackIncomeCategoryId = uncategorizedIncomeId || (incomeCategories || [])[0]?.id

    const incomePayload = await Promise.all(
      incomeItems.map(async (item) => {
        let resolvedCategoryId = item.category?.id

        if (!resolvedCategoryId && item.description) {
          const resolution = await resolveCategory('add_income', {
            amount: item.amount,
            description: item.description,
            date: item.date || slots.date,
            month: item.month || slots.month,
          })
          resolvedCategoryId = resolution.selectedCategory?.id
        }

        resolvedCategoryId = resolvedCategoryId || fallbackIncomeCategoryId

        return {
          amount: item.amount,
          report_weight: item.report_weight,
          date: item.date || slots.date,
          income_category_id: resolvedCategoryId,
          type: 'other',
          description: item.description,
          ...(userId ? { user_id: userId } : {}),
        }
      }),
    )

    if (incomePayload.some((item) => !item.date || !item.income_category_id)) {
      return {
        status: 'failed',
        message: 'Não foi possível resolver data/categoria para todas as rendas.',
        commandId: command.id,
      }
    }

    const { data, error } = await supabase.from('incomes').insert(incomePayload).select('id')

    if (error) {
      if (shouldQueueOffline(error)) {
        incomePayload.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'incomes',
            action: 'create',
            payload,
            idempotencyKey: `${command.id}:income:${index}`,
          })
        })
        queuedOfflineCounts.income += incomePayload.length
      } else {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    } else {
      createdIds.push(...(data?.map((item) => item.id) || []))
    }
  }

  if (investmentItems.length) {
    const investmentPayload = investmentItems.map((item) => ({
      amount: item.amount,
      month: item.month || slots.month,
      description: item.description,
      ...(userId ? { user_id: userId } : {}),
    }))

    if (investmentPayload.some((item) => !item.month)) {
      return {
        status: 'failed',
        message: 'Não foi possível resolver o mês para todos os investimentos.',
        commandId: command.id,
      }
    }

    const { data, error } = await supabase.from('investments').insert(investmentPayload).select('id')

    if (error) {
      if (shouldQueueOffline(error)) {
        investmentPayload.forEach((payload, index) => {
          enqueueOfflineOperation({
            entity: 'investments',
            action: 'create',
            payload,
            idempotencyKey: `${command.id}:investment:${index}`,
          })
        })
        queuedOfflineCounts.investment += investmentPayload.length
      } else {
        return { status: 'failed', message: error.message, commandId: command.id }
      }
    } else {
      createdIds.push(...(data?.map((item) => item.id) || []))
    }
  }

  const totalQueuedOffline = queuedOfflineCounts.expense + queuedOfflineCounts.income + queuedOfflineCounts.investment

  if (createdIds.length || totalQueuedOffline > 0) {
    const launchedTypesCount = [
      expenseItems.length - queuedOfflineCounts.expense > 0
        ? `${expenseItems.length - queuedOfflineCounts.expense} despesa${
            expenseItems.length - queuedOfflineCounts.expense > 1 ? 's' : ''
          }`
        : undefined,
      incomeItems.length - queuedOfflineCounts.income > 0
        ? `${incomeItems.length - queuedOfflineCounts.income} renda${
            incomeItems.length - queuedOfflineCounts.income > 1 ? 's' : ''
          }`
        : undefined,
      investmentItems.length - queuedOfflineCounts.investment > 0
        ? `${investmentItems.length - queuedOfflineCounts.investment} investimento${
            investmentItems.length - queuedOfflineCounts.investment > 1 ? 's' : ''
          }`
        : undefined,
    ].filter(Boolean)

    const queuedTypesCount = [
      queuedOfflineCounts.expense > 0
        ? `${queuedOfflineCounts.expense} despesa${queuedOfflineCounts.expense > 1 ? 's' : ''}`
        : undefined,
      queuedOfflineCounts.income > 0
        ? `${queuedOfflineCounts.income} renda${queuedOfflineCounts.income > 1 ? 's' : ''}`
        : undefined,
      queuedOfflineCounts.investment > 0
        ? `${queuedOfflineCounts.investment} investimento${queuedOfflineCounts.investment > 1 ? 's' : ''}`
        : undefined,
    ].filter(Boolean)

    const onlineMessage =
      launchedTypesCount.length > 1
        ? `Lançamentos adicionados com sucesso: ${launchedTypesCount.join(', ')}.`
        : launchedTypesCount.length === 1
        ? 'Lançamento adicionado com sucesso.'
        : ''

    const offlineMessage = queuedTypesCount.length
      ? `Sem conexão no momento. ${queuedTypesCount.join(', ')} ${
          queuedTypesCount.length > 1 ? 'foram enfileirados' : 'foi enfileirado'
        } para sincronização automática.`
      : ''

    return {
      status: 'executed',
      message: [onlineMessage, offlineMessage].filter(Boolean).join(' '),
      commandId: command.id,
      transactionId: createdIds[0],
    }
  }

  return {
    status: 'failed',
    message: 'Não foi possível criar lançamentos com os dados informados.',
    commandId: command.id,
  }
}

export const saveMappingIfPossible = async (command: AssistantCommand, confirmed: boolean) => {
  if (!confirmed || !command.slots_json?.description || !command.slots_json.category?.id) return

  if (command.interpreted_intent !== 'add_expense' && command.interpreted_intent !== 'add_income') {
    return
  }

  const mappingUserId = command.user_id || (await getCurrentUserId())
  if (!mappingUserId) return

  const transactionType = command.interpreted_intent === 'add_expense' ? 'expense' : 'income'
  const payload = {
    user_id: mappingUserId,
    phrase: command.slots_json.description,
    transaction_type: transactionType,
    confidence: command.slots_json.category.confidence,
    category_id: transactionType === 'expense' ? command.slots_json.category.id : null,
    income_category_id: transactionType === 'income' ? command.slots_json.category.id : null,
    last_used_at: new Date().toISOString(),
  }

  await supabase.from('assistant_category_mappings').insert([payload])
}
