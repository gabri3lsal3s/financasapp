/**
 * Natural Language Transaction Parser
 *
 * Extrai dados estruturados de despesas/receitas a partir de texto livre.
 * Exemplos:
 *   "gastei 50 reais com almoço" → { type: 'despesa', amount: 50, title: 'Almoço', category: 'Supermercado' }
 *   "recebi 3000 de salário"    → { type: 'receita', amount: 3000, title: 'Salário', category: 'Salário' }
 */

export interface ParsedTransaction {
  type: 'despesa' | 'receita'
  amount: number
  title: string
  detectedCategory: string
}

/**
 * Detecta se o texto descreve uma despesa ou receita e extrai valor + título + categoria.
 * Retorna null se não for identificado como transação.
 */
export function parseTransaction(text: string): ParsedTransaction | null {
  const lower = text.toLowerCase().trim()

  if (!lower) return null

  let parsedAmount = 0
  let parsedTitle = ''
  let parsedType: 'despesa' | 'receita' | null = null
  let detectedCategory = 'Outros'

  const isExpense =
    lower.includes('despesa') ||
    lower.includes('gastei') ||
    lower.includes('gastou') ||
    lower.includes('gasto') ||
    lower.includes('paguei') ||
    lower.includes('pagou') ||
    lower.includes('compra') ||
    lower.includes('comprei') ||
    lower.includes('gastar')

  const isIncome =
    lower.includes('receita') ||
    lower.includes('recebi') ||
    lower.includes('ganhei') ||
    lower.includes('renda') ||
    lower.includes('entrada') ||
    lower.includes('salário') ||
    lower.includes('salario') ||
    lower.includes('pix')

  if (!isExpense && !isIncome) return null

  parsedType = isExpense ? 'despesa' : 'receita'

  // Extrair valor monetário
  const rxAmount = /(?:r\$\s*)?(\d+(?:[.,]\d{2})?)/i
  const amountMatch = lower.match(rxAmount)
  if (amountMatch) {
    const rawAmount = amountMatch[1].replace(',', '.')
    parsedAmount = parseFloat(rawAmount)
  }

  // Extrair descrição
  const rxDesc = /(?:com|de|em|para)\s+([a-zA-Z0-9\sãáàâéêíóôúç]{3,20})/i
  const descMatch = lower.match(rxDesc)
  if (descMatch) {
    parsedTitle = descMatch[1].trim()
    parsedTitle = parsedTitle.charAt(0).toUpperCase() + parsedTitle.slice(1)
  } else {
    parsedTitle = isExpense ? 'Gasto IA' : 'Receita IA'
  }

  // Mapear para categoria
  if (parsedTitle.toLowerCase().includes('cafe') ||
      parsedTitle.toLowerCase().includes('almoço') ||
      parsedTitle.toLowerCase().includes('comida') ||
      parsedTitle.toLowerCase().includes('refrigerante') ||
      parsedTitle.toLowerCase().includes('pizza') ||
      parsedTitle.toLowerCase().includes('lanche') ||
      parsedTitle.toLowerCase().includes('mercado')) {
    detectedCategory = 'Supermercado'
  } else if (parsedTitle.toLowerCase().includes('carro') ||
             parsedTitle.toLowerCase().includes('gasolina') ||
             parsedTitle.toLowerCase().includes('uber') ||
             parsedTitle.toLowerCase().includes('taxi') ||
             parsedTitle.toLowerCase().includes('transporte') ||
             parsedTitle.toLowerCase().includes('combustível')) {
    detectedCategory = 'Transporte'
  } else if (parsedTitle.toLowerCase().includes('cinema') ||
             parsedTitle.toLowerCase().includes('role') ||
             parsedTitle.toLowerCase().includes('festa') ||
             parsedTitle.toLowerCase().includes('lazer') ||
             parsedTitle.toLowerCase().includes('jantar')) {
    detectedCategory = 'Lazer'
  } else if (parsedTitle.toLowerCase().includes('salario') ||
             parsedTitle.toLowerCase().includes('pagamento') ||
             parsedTitle.toLowerCase().includes('reembolso') ||
             parsedTitle.toLowerCase().includes('honorário')) {
    detectedCategory = 'Reembolso'
  } else if (parsedTitle.toLowerCase().includes('monitoria') ||
             parsedTitle.toLowerCase().includes('aula')) {
    detectedCategory = 'Monitoria'
  }

  if (!parsedAmount || parsedAmount <= 0) return null

  return {
    type: parsedType,
    amount: parsedAmount,
    title: parsedTitle,
    detectedCategory,
  }
}

/**
 * Retorna a interface para o contexto financeiro enviado ao Gemini.
 */
export function buildFinancialContext(params: {
  balance: number
  totalIncome: number
  totalExpense: number
  totalInvestment: number
  spentToday: number
  cardInvoice: number
  expenses: Array<{ id: string; title: string; category: string; amount: number; date: string; group: string }>
  incomes: Array<{ id: string; title: string; category: string; amount: number; date: string }>
}) {
  return params
}
