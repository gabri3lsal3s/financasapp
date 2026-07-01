const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform',
}

interface Message {
  sender: 'user' | 'bot' | 'assistant';
  text: string;
}

interface Financials {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  spentToday: number;
  cardInvoice: number;
  expenses: any[];
  incomes: any[];
}

Deno.serve(async (req) => {
  // CORS check
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { messages, currentFinancials } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Invalid messages body' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const lastMessage = messages[messages.length - 1]
    const userText = lastMessage?.text || ''

    const apiKey = Deno.env.get('GEMINI_API_KEY')

    // If Gemini key is missing, fall back to the local rules-based simulation
    if (!apiKey) {
      console.warn('GEMINI_API_KEY is not configured in Supabase. Using simulated AI response.')
      const simulated = simulateAssistantResponse(userText, currentFinancials)
      return new Response(JSON.stringify(simulated), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Format previous messages for Gemini context
    // Deno/Gemini expects role: 'user' or 'model'
    const contents = messages.map((m: Message) => ({
      role: m.sender === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }))

    // Optimize financial data context for token efficiency
    const { categorySummary, groupSummary, highlights, optimizedExpenses, optimizedIncomes } = optimizeFinancialContext(currentFinancials)

    // Build the system instructions
    const systemInstruction = `
Você é o co-piloto de inteligência financeira pessoal de Gabriel. Suas respostas devem ser extremamente organizadas, sintetizadas, resumidas e fáceis de ler pelo celular.
Mês de referência: Junho de 2026.
Idioma: Português do Brasil.

Seu foco principal é auxiliar a equilibrar as finanças e economizar de forma extremamente direta e objetiva.

Dados financeiros consolidados de Gabriel:
- Saldo atual: R$ ${(currentFinancials?.balance ?? 0).toFixed(2)}
- Receitas totais: R$ ${(currentFinancials?.totalIncome ?? 0).toFixed(2)}
- Despesas totais: R$ ${(currentFinancials?.totalExpense ?? 0).toFixed(2)}
- Saldo Líquido atual: R$ ${((currentFinancials?.totalIncome ?? 0) - (currentFinancials?.totalExpense ?? 0)).toFixed(2)}
- Gastos de hoje: R$ ${(currentFinancials?.spentToday ?? 0).toFixed(2)}
- Fatura Cartão de Crédito: R$ ${(currentFinancials?.cardInvoice ?? 0).toFixed(2)}
- Investido este mês: R$ ${(currentFinancials?.totalInvestment ?? 0).toFixed(2)}

Resumo por Categoria de Despesa (Exato):
${categorySummary}

Resumo por Grupo de Despesa:
${groupSummary}

Destaques e Métricas Avançadas:
${highlights}

Ledger de Lançamentos de Despesa (Amostra Otimizada dos Mais Recentes e Relevantes):
Formato: Data | Título | Categoria | Valor | Grupo
${optimizedExpenses}

Ledger de Lançamentos de Renda (Mais Recentes):
Formato: Data | Título | Categoria | Valor
${optimizedIncomes}

REGRAS CRÍTICAS DE PERSONA, RESPOSTA E FORMATAÇÃO:
1. NUNCA USE SAUDAÇÕES CONVERSACIONAIS OU INFORMAIS: Não comece com "Olá Gabriel!", "Oi Gabriel!", "Fala, Gabriel!", ou saudações similares. Comece respondendo diretamente à pergunta ou com o fato principal solicitado.
2. SEJA EXTREMAMENTE DIRETO E OBJETIVO: Vá direto ao ponto das finanças. Comece imediatamente com enunciados assertivos.
3. SINTETIZE E RESUMA AO MÁXIMO: Apresente somente as informações essenciais e necessárias com base direta no que foi solicitado.
4. EVITE EXCESSO DE TÓPICOS: Não divida muitas informações em bullet points ou listas longas. Prefira textos breves, fluidos e corridos.
5. SEM PARÁGRAFOS GRANDES: Limite cada parágrafo a no máximo 2 linhas.
6. DESTAQUE valores, categorias e metas em **negrito** (ex: **R$ 50,00**).
7. NUNCA USE EMOJIS DE FORMA NENHUMA: Não inclua emojis, ícones ou símbolos pictográficos (como 📊, 🔍, 💡, 💰, ⏱️, 🚗, ➕, 🌸, 📉, 👏, ⚠️, 🎯, 👉) nas suas respostas.
8. Se o usuário pedir gráficos, comparativos, históricos ou distribuição, inclua a linha especial ao final em uma linha própria:
[CHART_DATA: [{"name":"SEG", "value":30}, {"name":"TER", "value":55}, {"name":"QUA", "value":156.46}, {"name":"HOJE", "value":30, "active":true}]]
`

    // Call Gemini API (gemini-2.0-flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: contents,
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        generationConfig: {
          temperature: 0.7,
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`Gemini API error: ${response.status} - ${errorText}`)
      // Fallback
      const simulated = simulateAssistantResponse(userText, currentFinancials)
      return new Response(JSON.stringify(simulated), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    const responseData = await response.json()
    const replyText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || 'Desculpe, não consegui processar sua solicitação no momento.'

    // Check if replyText contains [CHART_DATA: ...]
    let text = replyText
    let chartData = undefined
    const chartRegex = /\[CHART_DATA:\s*(\[.*?\])\s*\]/
    const match = replyText.match(chartRegex)
    if (match) {
      try {
        chartData = JSON.parse(match[1])
        text = replyText.replace(chartRegex, '').trim()
      } catch (err) {
        console.error('Failed to parse chart data generated by model', err)
      }
    }

    return new Response(JSON.stringify({ text, chartData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error in gemini-chat Edge Function:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})

function optimizeFinancialContext(currentFinancials: Financials | null) {
  if (!currentFinancials) {
    return {
      categorySummary: 'Nenhuma registrada',
      groupSummary: 'Nenhum registrado',
      highlights: 'Sem métricas adicionais',
      optimizedExpenses: 'Nenhuma registrada',
      optimizedIncomes: 'Nenhuma registrada'
    }
  }

  const expenses = currentFinancials.expenses || []
  const incomes = currentFinancials.incomes || []

  // 1. Calculate Category Totals (Despesas)
  const categoryMap: Record<string, number> = {}
  let totalExpense = 0
  expenses.forEach(e => {
    const cat = e.category || 'Outros'
    categoryMap[cat] = (categoryMap[cat] || 0) + e.amount
    totalExpense += e.amount
  })

  const categorySummary = Object.entries(categoryMap)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, val]) => {
      const pct = totalExpense > 0 ? ((val / totalExpense) * 100).toFixed(1) : '0'
      return `- ${cat}: R$ ${val.toFixed(2)} (${pct}%)`
    })
    .join('\n')

  // 2. Calculate Group Totals
  const groupMap: Record<string, number> = {}
  expenses.forEach(e => {
    const grp = e.group || 'DESPESAS DO MÊS'
    groupMap[grp] = (groupMap[grp] || 0) + e.amount
  })
  const groupSummary = Object.entries(groupMap)
    .map(([grp, val]) => `- ${grp}: R$ ${val.toFixed(2)}`)
    .join('\n')

  // 3. Highlights
  let largestExpenseName = 'Nenhum'
  let largestExpenseAmount = 0
  expenses.forEach(e => {
    if (e.amount > largestExpenseAmount) {
      largestExpenseAmount = e.amount
      largestExpenseName = `${e.title || e.description} (${e.category || 'Outros'})`
    }
  })

  const avgExpense = expenses.length > 0 ? (totalExpense / expenses.length).toFixed(2) : '0.00'
  const highlights = `- Total de lançamentos de despesa: ${expenses.length} itens\n- Média por despesa: R$ ${avgExpense}\n- Maior despesa única: ${largestExpenseName} por R$ ${largestExpenseAmount.toFixed(2)}`

  // 4. Compact Ledger of Expenses (Sort by Date / Amount to get a highly relevant sample)
  // To avoid token bloat, select top 12 largest + top 15 most recent
  const sortedByAmount = [...expenses].sort((a, b) => b.amount - a.amount)
  const sortedByDate = [...expenses].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime()
  })

  const selectedExpenses = new Map<string, any>()
  // Add top 12 largest
  sortedByAmount.slice(0, 12).forEach(e => {
    if (e && e.id) selectedExpenses.set(e.id, e)
  })
  // Add top 15 most recent
  sortedByDate.slice(0, 15).forEach(e => {
    if (e && e.id) selectedExpenses.set(e.id, e)
  })

  const optimizedExpenses = Array.from(selectedExpenses.values())
    .map(e => `${e.date} | ${e.title || e.description} | ${e.category} | R$ ${e.amount.toFixed(2)} | ${e.group || 'DESPESAS DO MÊS'}`)
    .join('\n')

  // 5. Incomes Compact Ledger
  const optimizedIncomes = incomes
    .slice(0, 15) // Limit to recent 15 incomes
    .map(i => `${i.date} | ${i.title || i.description} | ${i.category} | R$ ${i.amount.toFixed(2)}`)
    .join('\n')

  return {
    categorySummary: categorySummary || 'Nenhuma registrada',
    groupSummary: groupSummary || 'Nenhum registrado',
    highlights: highlights,
    optimizedExpenses: optimizedExpenses || 'Nenhuma registrada',
    optimizedIncomes: optimizedIncomes || 'Nenhuma registrada'
  }
}

function simulateAssistantResponse(userText: string, currentFinancials: Financials | null) {
  const query = userText.toLowerCase()
  let text = ''
  let chartData = undefined

  const totalExpense = currentFinancials?.totalExpense ?? 1939.52
  const totalIncome = currentFinancials?.totalIncome ?? 1238.85
  const balance = currentFinancials?.balance ?? 1238.85
  const spentToday = currentFinancials?.spentToday ?? 30.00

  if (query.includes('gasto') || query.includes('despesa') || query.includes('consumo')) {
    if (query.includes('últimos') || query.includes('dias') || query.includes('gráfico') || query.includes('comparativo')) {
      text = `**Análise Diária de Gastos**\n\nSeu maior gasto recente ocorreu na quarta-feira (**R$ 156,46**), enquanto hoje você gastou apenas **R$ ${spentToday.toFixed(2)}**.\n\n**Dica**: Reduza gastos adicionais com Lazer nos próximos dias para reverter o saldo negativo.`
      chartData = [
        { name: 'SEG', value: 30, active: false },
        { name: 'TER', value: 55, active: false },
        { name: 'QUA', value: 156.46, active: true },
        { name: 'HOJE', value: spentToday, active: false }
      ]
    } else if (query.includes('categoria') || query.includes('onde')) {
      text = `**Distribuição de Gastos**\n\nSeus maiores consumos estão concentrados nas despesas de maior relevância do mês.\n\n**Ação**: Seu saldo líquido mensal está negativo em **-R$ ${(totalExpense - totalIncome).toFixed(2)}**. Moderar custos supérfluos ajudará a restabelecer o caixa.`
      chartData = [
        { name: 'Transporte', value: Math.round(totalExpense * 0.4) },
        { name: 'Lazer', value: Math.round(totalExpense * 0.3) },
        { name: 'Assinaturas', value: Math.round(totalExpense * 0.1) },
        { name: 'Supermercado', value: Math.round(totalExpense * 0.2) }
      ]
    } else {
      text = `**Relatório de Despesas**\n\nSuas despesas somam **R$ ${totalExpense.toFixed(2)}**. Recomendamos verificar seus maiores custos fixos e variáveis no período.\n\n**Foco**: Economizar 10% em despesas de lazer ajudará a restabelecer seu equilíbrio financeiro.`
    }
  } else if (query.includes('saldo') || query.includes('dinheiro') || query.includes('quanto tenho')) {
    text = `**Diagnóstico de Saldo**\n\nVocê possui **R$ ${balance.toFixed(2)}** em conta, mas suas despesas (**R$ ${totalExpense.toFixed(2)}**) superaram as receitas.\n\n**Alerta**: Com um déficit de **-R$ ${(totalExpense - totalIncome).toFixed(2)}**, sugerimos adiar compras adicionais imediatamente.`
  } else if (query.includes('diario') || query.includes('diário') || query.includes('acompanhamento') || query.includes('hoje') || query.includes('limite')) {
    text = `**Acompanhamento Diário**\n\nHoje você gastou **R$ ${spentToday.toFixed(2)}**. Mantenha a disciplina diária para equilibrar as contas.\n\n**Meta**: Manter essa disciplina diária ajudará a cobrir gradualmente o saldo negativo mensal.`
    chartData = [
      { name: 'LIMITE', value: 41.29, active: false },
      { name: 'HOJE', value: spentToday, active: true }
    ]
  } else if (query.includes('ajuda') || query.includes('olá') || query.includes('oi') || query.includes('bom dia') || query.includes('boa tarde')) {
    text = `Aqui está o suporte financeiro inteligente:\n\nEstou pronto para analisar seu saldo atual, detalhar metas diárias ou avaliar o impacto de despesas específicas.`
  } else {
    text = `**Resumo de Indicadores**\n\nSuas receitas de **R$ ${totalIncome.toFixed(2)}** estão abaixo das despesas de **R$ ${totalExpense.toFixed(2)}**, gerando um déficit de **-R$ ${(totalExpense - totalIncome).toFixed(2)}**.\n\nPeça-me uma análise de gastos recentes para começarmos a planejar.`
  }

  return { text, chartData }
}
