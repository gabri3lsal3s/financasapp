import { createGenAIClient, GEMINI_MODEL } from './client'
import { Type, Schema } from '@google/genai'
import { Category } from '@/types'

// Recebemos uma lista de descrições e valores oriundos da fatura CSV
export interface CSVTransactionToClassify {
  id: string // Identificador único na nossa interface
  description: string
  amount: number
}

export interface CSVClassifiedTransaction {
  id: string
  suggestedCategoryId: string | null
  confidence: number
  cleanDescription?: string
}

interface CSVReconciliationContext {
  transactions: CSVTransactionToClassify[]
  categories: Category[]
}

const csvReconciliationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    classifications: {
      type: Type.ARRAY,
      description: 'The mapped classifications for the provided transactions',
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description: 'The same ID provided in the input.'
          },
          suggestedCategoryId: {
            type: Type.STRING,
            description: 'The ID of the best matching category from the user list. If unknown, return an empty string.'
          },
          confidence: {
            type: Type.NUMBER,
            description: 'A confidence score from 0.0 to 1.0 about the match.'
          },
          cleanDescription: {
            type: Type.STRING,
            description: 'A human-readable cleaned version of the original description. Capitalize properly. Omit numbers, dates, locations like "SAO PAULO BR" unless it is the merchant name.'
          }
        },
        required: ['id', 'suggestedCategoryId', 'confidence', 'cleanDescription']
      }
    }
  },
  required: ['classifications']
}

const buildReconciliationPrompt = (context: CSVReconciliationContext) => {
  const expenseCategoriesStr = context.categories.map(c => `[ID: ${c.id}] ${c.name}`).join('\n')
  
  const transactionsStr = context.transactions.map(
    t => `- ID: ${t.id} | Descrição: "${t.description}" | Valor: R$ ${t.amount}`
  ).join('\n')

  return `
Você é um categorizador avançado de faturas de cartão de crédito.
Sua missão é ler um lote de itens extraídos de uma fatura, limpar a descrição e categorizá-los corretamente, baseado APENAS na lista de categorias do usuário abaixo.

*Desafio com Descrições:*
Muitas faturas trazem pedaços inúteis nas descrições como "Uber *Trip", "PG*TON", "SAO PAULO BR", números de loja, etc.
Sua tarefa é retornar o campo "cleanDescription" contendo APENAS a marca ou o serviço real com a primeira letra maiúscula (Ex: "Uber", "Netflix", "McDonald's", "Amazon").

*Categorias Disponíveis do Usuário:*
${expenseCategoriesStr || 'Nenhuma categoria cadastrada.'}

*Itens da Fatura Analisados:*
${transactionsStr || 'Nenhum item.'}

*Regras:*
Para cada ID na entrada, você deve devolver o "id" exato, "suggestedCategoryId" (da lista acima), a "confidence" (0.0 a 1.0) e a "cleanDescription". Se você não fizer ideia da categoria, deixe "suggestedCategoryId" vazio "".

Responda APENAS com JSON estruturado validamente, seguindo schema.
  `.trim()
}

export const classifyCSVTransactions = async (
  context: CSVReconciliationContext
): Promise<CSVClassifiedTransaction[]> => {
  // Limitação de lote para não estourar o contexto do LLM
  // O ideal é não enviar mais que 50 transações por vez (por safety e timeout api)
  const MAX_BATCH_SIZE = 40
  if (context.transactions.length === 0) return []

  try {
    const ai = createGenAIClient()
    if (!ai) return []
    const allClassifications: CSVClassifiedTransaction[] = []

    // Dividimos os batches
    for (let i = 0; i < context.transactions.length; i += MAX_BATCH_SIZE) {
      const batchTransactions = context.transactions.slice(i, i + MAX_BATCH_SIZE)
      const prompt = buildReconciliationPrompt({
        categories: context.categories,
        transactions: batchTransactions
      })

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: csvReconciliationSchema,
          temperature: 0.1 // Precisão acima de tudo
        }
      })

      const rawJson = response.text
      if (!rawJson) continue

      const data = JSON.parse(rawJson)

      if (data && Array.isArray(data.classifications)) {
        allClassifications.push(...data.classifications)
      }
    }

    return allClassifications
  } catch (error) {
    console.error('Gemini API Error in classifyCSVTransactions:', error)
    return []
  }
}
