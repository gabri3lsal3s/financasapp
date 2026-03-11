import { createGenAIClient, GEMINI_MODEL } from './client'
import { Type, Schema } from '@google/genai'
import { AssistantMonthlyInsightsResult, Expense, Income, Investment } from '@/types'

interface InsightsContext {
  monthName: string
  expenses: Expense[]
  incomes: Income[]
  investments: Investment[]
}

const insightsSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    month: {
      type: Type.STRING,
      description: 'The name of the analyzed month.'
    },
    highlights: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: 'A list of 3-4 highlights about where the user spent the most, surprising facts, etc.'
    },
    recommendations: {
      type: Type.ARRAY,
      items: {
        type: Type.STRING,
      },
      description: 'A list of 2-3 practical, specific recommendations for the next month based on this month behavior.'
    }
  },
  required: ['month', 'highlights', 'recommendations'],
}

const buildInsightsPrompt = (context: InsightsContext) => {
  const formatMoney = (val: number) => `R$ ${val.toFixed(2)}`

  // Aplicar pesos (report_weight) se existirem, caso contrário usar o valor cheio (1)
  const totalExpense = context.expenses.reduce((acc, curr) => acc + (curr.amount * (curr.report_weight ?? 1)), 0)
  const totalIncome = context.incomes.reduce((acc, curr) => acc + (curr.amount * (curr.report_weight ?? 1)), 0)
  const totalInvestment = context.investments.reduce((acc, curr) => acc + curr.amount, 0)

  // Top 5 expenses by category (usando valores ponderados)
  const expensesByCategory = context.expenses.reduce((acc, exp) => {
    const catName = exp.category?.name || 'Outros'
    const weightedAmount = exp.amount * (exp.report_weight ?? 1)
    acc[catName] = (acc[catName] || 0) + weightedAmount
    return acc
  }, {} as Record<string, number>)

  const sortedCategories = Object.entries(expensesByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, amount]) => `- ${cat}: ${formatMoney(amount)}`)
    .join('\n')

  return `
Você é um consultor financeiro pessoal especialista.
Analise os dados financeiros do usuário referentes ao mês de ${context.monthName} e devolva um JSON com "highlights" (destaques) e "recommendations" (recomendações práticas e acionáveis).

*IMPORTANTE:* Os valores abaixo já estão PONDERADOS pelo peso de importância definido pelo usuário (report_weight). Se um gasto de R$ 1000 tem peso 0.5, ele aparece aqui como R$ 500. Analise estes valores como sendo a realidade financeira final do usuário para o relatório.

*Resumo do Mês (Valores Ponderados):*
- Renda Total: ${formatMoney(totalIncome)}
- Gasto Total: ${formatMoney(totalExpense)}
- Investimento Total: ${formatMoney(totalInvestment)}

*Principais Gastos por Categoria (Top 5 - Valores Ponderados):*
${sortedCategories || 'Nenhum gasto registrado.'}

*Objetivo:*
Crie 3 a 4 "highlights" muito concisos e diretos em português, destacando os fatos principais.
Crie 2 a 3 "recommendations" também em português, propondo cortes ou atitudes benéficas.
Seja positivo e motivador. Mencione que a análise considera os pesos de relevância definidos pelo usuário.

Responda APENAS com o JSON válido de acordo com o schema fornecido. Não adicione textos extras.
  `.trim()
}


export const generateMonthlyInsights = async (
  context: InsightsContext
): Promise<AssistantMonthlyInsightsResult | null> => {
  try {
    const ai = createGenAIClient()
    if (!ai) return null

    const prompt = buildInsightsPrompt(context)

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: insightsSchema,
        temperature: 0.7 // A bit more creativity for text generation
      }
    })

    const rawJson = response.text
    if (!rawJson) return null

    const data = JSON.parse(rawJson)

    return {
      month: data.month || context.monthName,
      highlights: data.highlights || [],
      recommendations: data.recommendations || []
    }
  } catch (error) {
    console.error('Gemini API Error in generateMonthlyInsights:', error)
    return null
  }
}
