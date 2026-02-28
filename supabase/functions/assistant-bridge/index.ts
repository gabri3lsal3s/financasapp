import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'

type TurnType = 'interpret' | 'confirm' | 'insights'

type TurnRequest = {
  turnType: TurnType
  deviceId: string
  locale?: string
  text?: string
  commandId?: string
  confirmed?: boolean
  spokenText?: string
  month?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const writeIntents = new Set(['add_expense', 'add_income', 'add_investment', 'update_transaction', 'delete_transaction', 'create_category'])
const DEFAULT_CATEGORY_COLOR = '#9ca3af'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const inferIntent = (text: string) => {
  const normalized = normalizeText(text)

  if (/insight|resumo|analise|análise/.test(normalized)) return { intent: 'monthly_insights', confidence: 0.9 }
  if (/saldo|balanco|balanço/.test(normalized)) return { intent: 'get_month_balance', confidence: 0.88 }
  if (/listar|ultim|recent/.test(normalized)) return { intent: 'list_recent_transactions', confidence: 0.82 }
  if (/invest|aporte/.test(normalized) && /adicion|registr|lanc/.test(normalized)) return { intent: 'add_investment', confidence: 0.9 }
  if (/renda|receita|ganho|salario|salário/.test(normalized) && /adicion|registr|lanc/.test(normalized)) return { intent: 'add_income', confidence: 0.9 }
  if (/despesa|gasto|conta/.test(normalized) && /adicion|registr|lanc/.test(normalized)) return { intent: 'add_expense', confidence: 0.9 }
  if (/apagar|delet|excluir|remover/.test(normalized)) return { intent: 'delete_transaction', confidence: 0.76 }
  if (/atualiz|editar|corrig/.test(normalized)) return { intent: 'update_transaction', confidence: 0.75 }
  if (/criar categoria|nova categoria/.test(normalized)) return { intent: 'create_category', confidence: 0.8 }

  return { intent: 'unknown', confidence: 0.3 }
}

const extractAmount = (text: string): number | undefined => {
  const amountMatch = text.match(/(?:r\$\s*)?(\d+[\d.,]*)/i)
  if (!amountMatch) return undefined
  const cleaned = amountMatch[1].replace(/\./g, '').replace(',', '.')
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : undefined
}

const extractDate = (text: string): string => {
  const normalized = normalizeText(text)
  const today = new Date()

  if (normalized.includes('ontem')) {
    return new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  const match = normalized.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/)
  if (match) {
    const day = match[1].padStart(2, '0')
    const month = match[2].padStart(2, '0')
    const year = match[3] ? match[3].padStart(4, '20') : String(today.getFullYear())
    return `${year}-${month}-${day}`
  }

  return today.toISOString().slice(0, 10)
}

const extractDescription = (text: string): string => {
  return text
    .replace(/\br\$\s*\d+[\d.,]*/gi, ' ')
    .replace(/\b\d+[\d.,]*\b/g, ' ')
    .replace(/[,:;.!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const buildConfirmationText = (intent: string, slots: Record<string, unknown>) => {
  if (intent === 'add_expense') {
    return `Confirma despesa de R$${Number(slots.amount || 0).toFixed(2)} em ${String((slots.category as { name?: string } | undefined)?.name || 'Sem categoria')}?`
  }
  if (intent === 'add_income') {
    return `Confirma renda de R$${Number(slots.amount || 0).toFixed(2)} em ${String((slots.category as { name?: string } | undefined)?.name || 'Sem categoria')}?`
  }
  if (intent === 'add_investment') {
    return `Confirma investimento de R$${Number(slots.amount || 0).toFixed(2)} para ${String(slots.month || '')}?`
  }

  if (intent === 'update_transaction') {
    const hasAmount = Number.isFinite(Number(slots.amount))
    const hasDescription = Boolean(slots.description)
    if (hasAmount && hasDescription) {
      return `Confirma atualizar lançamento para R$${Number(slots.amount).toFixed(2)} com descrição ${String(slots.description)}?`
    }
    if (hasAmount) {
      return `Confirma atualizar lançamento para R$${Number(slots.amount).toFixed(2)}?`
    }
    if (hasDescription) {
      return `Confirma atualizar descrição do lançamento para ${String(slots.description)}?`
    }
    return 'Confirma atualizar o lançamento selecionado?'
  }

  if (intent === 'delete_transaction') {
    if (slots.description) return `Confirma excluir lançamento relacionado a ${String(slots.description)}?`
    if (Number.isFinite(Number(slots.amount))) return `Confirma excluir lançamento de R$${Number(slots.amount).toFixed(2)}?`
    return 'Confirma excluir o lançamento selecionado?'
  }

  if (intent === 'create_category') {
    const categoryType = /renda|receita/.test(normalizeText(String(slots.description || ''))) ? 'renda' : 'despesa'
    return `Confirma criar categoria de ${categoryType} com nome ${String(slots.description || 'Nova Categoria')}?`
  }

  return 'Confirma a execução do comando?'
}

type WritableRecord = {
  id: string
  amount: number
  description?: string | null
  dateOrMonth: string
  type: 'expense' | 'income' | 'investment'
}

const inferTargetType = (commandText: string): 'expense' | 'income' | 'investment' | 'auto' => {
  const normalized = normalizeText(commandText)
  if (/invest|aporte/.test(normalized)) return 'investment'
  if (/renda|receita|salario|salário|ganho/.test(normalized)) return 'income'
  if (/despesa|gasto|conta/.test(normalized)) return 'expense'
  return 'auto'
}

const findBestRecordForMutation = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  commandText: string,
  slots: Record<string, unknown>,
) => {
  const targetType = inferTargetType(commandText)
  const tokens = normalizeText(String(slots.description || ''))
    .split(/\s+/)
    .filter((token) => token.length >= 3)
  const targetAmount = Number(slots.amount)

  const queryExpenses = supabase
    .from('expenses')
    .select('id, amount, description, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(25)

  const queryIncomes = supabase
    .from('incomes')
    .select('id, amount, description, date')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(25)

  const queryInvestments = supabase
    .from('investments')
    .select('id, amount, description, month')
    .eq('user_id', userId)
    .order('month', { ascending: false })
    .limit(25)

  const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
    targetType === 'income' || targetType === 'investment'
      ? Promise.resolve({ data: [] as Array<{ id: string; amount: number; description?: string; date: string }> })
      : queryExpenses,
    targetType === 'expense' || targetType === 'investment'
      ? Promise.resolve({ data: [] as Array<{ id: string; amount: number; description?: string; date: string }> })
      : queryIncomes,
    targetType === 'expense' || targetType === 'income'
      ? Promise.resolve({ data: [] as Array<{ id: string; amount: number; description?: string; month: string }> })
      : queryInvestments,
  ])

  const allRecords: WritableRecord[] = [
    ...(expensesResult.data || []).map((item) => ({ id: item.id, amount: Number(item.amount), description: item.description, dateOrMonth: item.date, type: 'expense' as const })),
    ...(incomesResult.data || []).map((item) => ({ id: item.id, amount: Number(item.amount), description: item.description, dateOrMonth: item.date, type: 'income' as const })),
    ...(investmentsResult.data || []).map((item) => ({ id: item.id, amount: Number(item.amount), description: item.description, dateOrMonth: item.month, type: 'investment' as const })),
  ]

  if (!allRecords.length) return null

  const scored = allRecords
    .map((record) => {
      const normalizedDescription = normalizeText(record.description || '')
      const tokenScore = tokens.reduce((sum, token) => (normalizedDescription.includes(token) ? sum + 1 : sum), 0)
      const amountScore = Number.isFinite(targetAmount) && Math.abs(record.amount - targetAmount) <= 0.01 ? 2 : 0
      return { record, score: tokenScore + amountScore }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.record.dateOrMonth.localeCompare(a.record.dateOrMonth)
    })

  return scored[0]?.record || null
}

const resolveCreateCategoryType = (commandText: string, description?: string) => {
  const normalized = normalizeText(`${commandText} ${description || ''}`)
  if (/renda|receita|ganho|salario|salário/.test(normalized)) return 'income'
  return 'expense'
}

const getSupabaseClient = (request: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
  const authHeader = request.headers.get('Authorization') || ''

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios na função.')
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  })
}

const ensureSession = async (supabase: ReturnType<typeof createClient>, userId: string, deviceId: string, locale: string) => {
  const { data: activeSession } = await supabase
    .from('assistant_sessions')
    .select('*')
    .eq('device_id', deviceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeSession) return activeSession

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

  if (error || !createdSession) {
    throw new Error(error?.message || 'Falha ao criar sessão do assistente.')
  }

  return createdSession
}

const resolveCategory = async (
  supabase: ReturnType<typeof createClient>,
  userId: string,
  intent: string,
  description: string,
) => {
  if (intent !== 'add_expense' && intent !== 'add_income') return undefined

  const table = intent === 'add_expense' ? 'categories' : 'income_categories'
  const { data: categories } = await supabase
    .from(table)
    .select('id, name')
    .eq('user_id', userId)

  const normalized = normalizeText(description)
  const matched = (categories || []).find((category) => normalized.includes(normalizeText(category.name)))

  if (matched) {
    return { id: matched.id, name: matched.name, confidence: 0.82 }
  }

  const uncategorized = (categories || []).find((category) => normalizeText(category.name) === 'sem categoria')
  if (uncategorized) {
    return { id: uncategorized.id, name: uncategorized.name, confidence: 0.4 }
  }

  return undefined
}

const executeConfirmedWrite = async (supabase: ReturnType<typeof createClient>, command: Record<string, unknown>) => {
  const intent = String(command.interpreted_intent || '')
  const slots = (command.slots_json as Record<string, unknown> | null) || {}
  const userId = String(command.user_id || '')
  const commandText = String(command.command_text || '')

  if (intent === 'add_expense') {
    const { data, error } = await supabase
      .from('expenses')
      .insert([
        {
          amount: Number(slots.amount || 0),
          date: String(slots.date || new Date().toISOString().slice(0, 10)),
          category_id: (slots.category as { id?: string } | undefined)?.id,
          description: slots.description ? String(slots.description) : null,
          user_id: userId,
        },
      ])
      .select('id')
      .single()

    if (error) return { status: 'failed', message: error.message }
    return { status: 'executed', message: 'Despesa adicionada com sucesso.', transactionId: data.id }
  }

  if (intent === 'add_income') {
    const { data, error } = await supabase
      .from('incomes')
      .insert([
        {
          amount: Number(slots.amount || 0),
          date: String(slots.date || new Date().toISOString().slice(0, 10)),
          income_category_id: (slots.category as { id?: string } | undefined)?.id,
          type: 'other',
          description: slots.description ? String(slots.description) : null,
          user_id: userId,
        },
      ])
      .select('id')
      .single()

    if (error) return { status: 'failed', message: error.message }
    return { status: 'executed', message: 'Renda adicionada com sucesso.', transactionId: data.id }
  }

  if (intent === 'add_investment') {
    const { data, error } = await supabase
      .from('investments')
      .insert([
        {
          amount: Number(slots.amount || 0),
          month: String(slots.month || new Date().toISOString().slice(0, 7)),
          description: slots.description ? String(slots.description) : null,
          user_id: userId,
        },
      ])
      .select('id')
      .single()

    if (error) return { status: 'failed', message: error.message }
    return { status: 'executed', message: 'Investimento adicionado com sucesso.', transactionId: data.id }
  }

  if (intent === 'update_transaction') {
    const hasAmount = Number.isFinite(Number(slots.amount))
    const hasDescription = Boolean(slots.description)

    if (!hasAmount && !hasDescription) {
      return { status: 'failed', message: 'Comando incompleto para atualização.' }
    }

    const targetRecord = await findBestRecordForMutation(supabase, userId, commandText, slots)
    if (!targetRecord) {
      return { status: 'failed', message: 'Não encontrei lançamento para atualizar.' }
    }

    const updates: Record<string, unknown> = {}
    if (hasAmount) updates.amount = Number(slots.amount)
    if (hasDescription) updates.description = String(slots.description)

    if (targetRecord.type === 'expense') {
      const { error } = await supabase.from('expenses').update(updates).eq('id', targetRecord.id)
      if (error) return { status: 'failed', message: error.message }
    }

    if (targetRecord.type === 'income') {
      const { error } = await supabase.from('incomes').update(updates).eq('id', targetRecord.id)
      if (error) return { status: 'failed', message: error.message }
    }

    if (targetRecord.type === 'investment') {
      const { error } = await supabase.from('investments').update(updates).eq('id', targetRecord.id)
      if (error) return { status: 'failed', message: error.message }
    }

    return {
      status: 'executed',
      message: `Lançamento ${targetRecord.type} atualizado com sucesso.`,
      transactionId: targetRecord.id,
    }
  }

  if (intent === 'delete_transaction') {
    const targetRecord = await findBestRecordForMutation(supabase, userId, commandText, slots)
    if (!targetRecord) {
      return { status: 'failed', message: 'Não encontrei lançamento para excluir.' }
    }

    if (targetRecord.type === 'expense') {
      const { error } = await supabase.from('expenses').delete().eq('id', targetRecord.id)
      if (error) return { status: 'failed', message: error.message }
    }

    if (targetRecord.type === 'income') {
      const { error } = await supabase.from('incomes').delete().eq('id', targetRecord.id)
      if (error) return { status: 'failed', message: error.message }
    }

    if (targetRecord.type === 'investment') {
      const { error } = await supabase.from('investments').delete().eq('id', targetRecord.id)
      if (error) return { status: 'failed', message: error.message }
    }

    return {
      status: 'executed',
      message: `Lançamento ${targetRecord.type} excluído com sucesso.`,
      transactionId: targetRecord.id,
    }
  }

  if (intent === 'create_category') {
    const categoryName = String(slots.description || '').trim()
    if (!categoryName) {
      return { status: 'failed', message: 'Informe o nome da categoria para criação.' }
    }

    const categoryType = resolveCreateCategoryType(commandText, categoryName)

    if (categoryType === 'expense') {
      const { data: existing } = await supabase
        .from('categories')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', categoryName)
        .limit(1)
        .maybeSingle()

      if (existing?.id) {
        return { status: 'failed', message: 'Já existe uma categoria de despesa com esse nome.', transactionId: existing.id }
      }

      const { data, error } = await supabase
        .from('categories')
        .insert([{ name: categoryName, color: DEFAULT_CATEGORY_COLOR, user_id: userId }])
        .select('id')
        .single()

      if (error) return { status: 'failed', message: error.message }
      return { status: 'executed', message: 'Categoria de despesa criada com sucesso.', transactionId: data.id }
    }

    const { data: existingIncome } = await supabase
      .from('income_categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', categoryName)
      .limit(1)
      .maybeSingle()

    if (existingIncome?.id) {
      return { status: 'failed', message: 'Já existe uma categoria de renda com esse nome.', transactionId: existingIncome.id }
    }

    const { data, error } = await supabase
      .from('income_categories')
      .insert([{ name: categoryName, color: DEFAULT_CATEGORY_COLOR, user_id: userId }])
      .select('id')
      .single()

    if (error) return { status: 'failed', message: error.message }
    return { status: 'executed', message: 'Categoria de renda criada com sucesso.', transactionId: data.id }
  }

  return { status: 'failed', message: 'Intenção de escrita ainda não suportada nesta função.' }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ status: 'error', error: 'Use POST.' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await request.json()) as TurnRequest
    const supabase = getSupabaseClient(request)

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          status: 'error',
          requiresConfirmation: false,
          speakText: 'Usuário não autenticado.',
          error: userError?.message || 'Token inválido.',
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    if (body.turnType === 'interpret') {
      if (!body.text?.trim()) {
        return new Response(JSON.stringify({ status: 'error', requiresConfirmation: false, speakText: 'Comando vazio.', error: 'Campo text obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const session = await ensureSession(supabase, user.id, body.deviceId, body.locale || 'pt-BR')
      const { intent, confidence } = inferIntent(body.text)
      const date = extractDate(body.text)
      const amount = extractAmount(body.text)
      const description = extractDescription(body.text)
      const category = await resolveCategory(supabase, user.id, intent, description)

      const slots = {
        amount,
        description,
        date,
        month: date.slice(0, 7),
        category,
      }

      const requiresConfirmation = writeIntents.has(intent)
      const idempotencyKey = `${session.id}:${normalizeText(body.text).replace(/\s+/g, '_')}:${new Date().toISOString().slice(0, 16)}`

      const { data: command, error } = await supabase
        .from('assistant_commands')
        .insert([
          {
            session_id: session.id,
            user_id: user.id,
            command_text: body.text,
            interpreted_intent: intent,
            confidence,
            slots_json: slots,
            category_resolution_json: category || null,
            requires_confirmation: requiresConfirmation,
            status: requiresConfirmation ? 'pending_confirmation' : 'executed',
            idempotency_key: idempotencyKey,
          },
        ])
        .select('*')
        .single()

      if (error || !command) {
        throw new Error(error?.message || 'Falha ao criar comando.')
      }

      if (!requiresConfirmation) {
        if (intent === 'get_month_balance') {
          const month = slots.month as string
          const start = `${month}-01`
          const endDate = new Date(`${month}-01T00:00:00.000Z`)
          endDate.setUTCMonth(endDate.getUTCMonth() + 1)
          endDate.setUTCDate(0)
          const end = endDate.toISOString().slice(0, 10)

          const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
            supabase.from('expenses').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end),
            supabase.from('incomes').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end),
            supabase.from('investments').select('amount').eq('user_id', user.id).eq('month', month),
          ])

          const expenses = (expensesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
          const incomes = (incomesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
          const investments = (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
          const balance = incomes - expenses - investments

          const speakText = `Seu saldo de ${month} é R$${balance.toFixed(2)}.`

          await supabase
            .from('assistant_commands')
            .update({ execution_result_json: { month, expenses, incomes, investments, balance }, updated_at: new Date().toISOString() })
            .eq('id', command.id)

          return new Response(JSON.stringify({ status: 'ok', requiresConfirmation: false, speakText, commandId: command.id, intent }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        const speakText = 'Comando interpretado com sucesso.'
        return new Response(JSON.stringify({ status: 'ok', requiresConfirmation: false, speakText, commandId: command.id, intent }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      return new Response(JSON.stringify({
        status: 'ok',
        requiresConfirmation: true,
        speakText: buildConfirmationText(intent, slots),
        commandId: command.id,
        intent,
        payload: { confidence, slots },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.turnType === 'confirm') {
      if (!body.commandId) {
        return new Response(JSON.stringify({ status: 'error', requiresConfirmation: false, speakText: 'Comando inválido.', error: 'commandId obrigatório.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: command, error: commandError } = await supabase
        .from('assistant_commands')
        .select('*')
        .eq('id', body.commandId)
        .eq('user_id', user.id)
        .single()

      if (commandError || !command) {
        throw new Error(commandError?.message || 'Comando não encontrado.')
      }

      await supabase
        .from('assistant_confirmations')
        .insert([
          {
            command_id: command.id,
            session_id: command.session_id,
            user_id: user.id,
            confirmed: !!body.confirmed,
            spoken_text: body.spokenText,
            confirmation_method: 'voice',
          },
        ])

      if (!body.confirmed) {
        await supabase.from('assistant_commands').update({ status: 'denied', updated_at: new Date().toISOString() }).eq('id', command.id)

        return new Response(JSON.stringify({
          status: 'ok',
          requiresConfirmation: false,
          speakText: 'Comando cancelado por voz.',
          commandId: command.id,
          payload: { resultStatus: 'denied' },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      await supabase.from('assistant_commands').update({ status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', command.id)

      const execution = await executeConfirmedWrite(supabase, command)

      await supabase
        .from('assistant_commands')
        .update({
          status: execution.status,
          execution_result_json: execution,
          error_message: execution.status === 'failed' ? execution.message : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', command.id)

      return new Response(JSON.stringify({
        status: execution.status === 'failed' ? 'error' : 'ok',
        requiresConfirmation: false,
        speakText: execution.message,
        commandId: command.id,
        payload: { resultStatus: execution.status, transactionId: execution.transactionId },
        error: execution.status === 'failed' ? execution.message : undefined,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (body.turnType === 'insights') {
      const month = body.month || new Date().toISOString().slice(0, 7)
      const start = `${month}-01`
      const endDate = new Date(`${month}-01T00:00:00.000Z`)
      endDate.setUTCMonth(endDate.getUTCMonth() + 1)
      endDate.setUTCDate(0)
      const end = endDate.toISOString().slice(0, 10)

      const [expensesResult, incomesResult, investmentsResult] = await Promise.all([
        supabase.from('expenses').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('incomes').select('amount').eq('user_id', user.id).gte('date', start).lte('date', end),
        supabase.from('investments').select('amount').eq('user_id', user.id).eq('month', month),
      ])

      const expenses = (expensesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const incomes = (incomesResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const investments = (investmentsResult.data || []).reduce((sum, item) => sum + Number(item.amount || 0), 0)
      const balance = incomes - expenses - investments

      const highlights = [
        `Despesas totais: R$${expenses.toFixed(2)}.`,
        `Rendas totais: R$${incomes.toFixed(2)}.`,
        `Saldo estimado: R$${balance.toFixed(2)}.`,
      ]

      const recommendations = balance < 0
        ? ['Seu saldo está negativo neste mês. Revise despesas variáveis.']
        : ['Seu saldo está positivo. Mantenha metas por categoria atualizadas.']

      return new Response(JSON.stringify({
        status: 'ok',
        requiresConfirmation: false,
        speakText: `Insights de ${month}. ${highlights.join(' ')} ${recommendations.join(' ')}`,
        intent: 'monthly_insights',
        payload: { month, highlights, recommendations },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ status: 'error', requiresConfirmation: false, speakText: 'Tipo de turno não suportado.', error: 'turnType inválido.' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      requiresConfirmation: false,
      speakText: 'Erro ao processar turno do assistente.',
      error: error instanceof Error ? error.message : 'Erro desconhecido.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
