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
  
  const totalExpense = context.expenses.reduce((acc, curr) => acc + curr.amount, 0)
  const totalIncome = context.incomes.reduce((acc, curr) => acc + curr.amount, 0)
  const totalInvestment = context.investments.reduce((acc, curr) => acc + curr.amount, 0)

  // Top 5 expenses by category
  const expensesByCategory = context.expenses.reduce((acc, exp) => {
    const catName = exp.category?.name || 'Outros'
    acc[catName] = (acc[catName] || 0) + exp.amount
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

*Resumo do Mês:*
- Renda Total: ${formatMoney(totalIncome)}
- Gasto Total: ${formatMoney(totalExpense)}
- Investimento Total: ${formatMoney(totalInvestment)}

*Principais Gastos por Categoria (Top 5):*
${sortedCategories || 'Nenhum gasto registrado.'}

*Objetivo:*
Crie 3 a 4 "highlights" muito concisos e diretos em português, destacando os fatos principais. Exemplo: "Você gastou quase 40% da renda com Alimentação".
Crie 2 a 3 "recommendations" também em português, propondo cortes ou atitudes benéficas, focando nas categorias que gastaram mais. Seja positivo e motivador.

Responda APENAS com o JSON válido de acordo com o schema fornecido. Não adicione textos extras.
  `.trim()
}

export const generateMonthlyInsights = async (
  context: InsightsContext
): Promise<AssistantMonthlyInsightsResult | null> => {
  try {
    const ai = createGenAIClient()
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
