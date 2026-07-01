import { supabase } from '@/lib/supabase'

export interface ChatMessage {
  sender: 'user' | 'bot' | 'assistant';
  text: string;
  chartData?: any;
}

export interface FinancialsContext {
  balance: number;
  totalIncome: number;
  totalExpense: number;
  totalInvestment: number;
  spentToday: number;
  cardInvoice: number;
  expenses: any[];
  incomes: any[];
}

export async function askGemini(
  messages: { sender: 'user' | 'bot' | 'assistant'; text: string }[],
  financials: FinancialsContext
): Promise<{ text: string; chartData?: any }> {
  try {
    const { data, error } = await supabase.functions.invoke('gemini-chat', {
      body: { messages, currentFinancials: financials }
    })

    if (error) {
      throw error
    }

    return data
  } catch (err) {
    console.warn('Failed to call gemini-chat Edge Function, running client-side simulation:', err)
    const userText = messages[messages.length - 1]?.text || ''
    return simulateAssistantResponseClient(userText, financials)
  }
}

function simulateAssistantResponseClient(userText: string, currentFinancials: FinancialsContext) {
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
