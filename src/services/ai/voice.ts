import { createGenAIClient, GEMINI_MODEL } from './client'
import { Type, Schema } from '@google/genai'
import { AssistantSlots, AssistantIntent, Category, IncomeCategory } from '@/types'
import { format } from 'date-fns'

interface VoiceExtractionContext {
  categories: Category[]
  incomeCategories: IncomeCategory[]
  recentHistory?: string // Ex: "Geralmente no restaurante ele paga com VR, no Mercado com crédito"
}

export interface VoiceExtractionResult {
  intent: AssistantIntent
  slots: AssistantSlots
  requiresConfirmation: boolean
  confidence: number
}

// Define the expected JSON Schema for Gemini Output
const extractionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      description: 'The classified user intent. Can be add_expense, add_income, add_investment, create_category, get_month_balance, list_recent_transactions, update_transaction, delete_transaction, or unknown.',
    },
    confidence: {
      type: Type.NUMBER,
      description: 'A confidence score from 0.0 to 1.0 about the extraction quality.',
    },
    transactionType: {
      type: Type.STRING,
      description: 'The type of transaction (expense, income, investment) if applicable.',
    },
    amount: {
      type: Type.NUMBER,
      description: 'The main or total amount mentioned in the transaction. Use absolute positive numbers.',
    },
    report_weight: {
        type: Type.NUMBER,
        description: 'If the transaction is shared (e.g. "my part was 50, but the total was 200"), put the ratio here. For instance, (50/200) = 0.25. If not shared, omit it.',
    },
    installment_count: {
      type: Type.INTEGER,
      description: 'Number of installments if the purchase was divided into installments (e.g. "in 3 times").',
    },
    payment_method: {
      type: Type.STRING,
      description: 'The determined payment method: cash, debit, credit_card, pix, transfer, or other. Deduce from context if missing.',
    },
    description: {
      type: Type.STRING,
      description: 'A clean, capitalized, normalized description of the transaction or category name.',
    },
    date: {
      type: Type.STRING,
      description: 'The ISO date (YYYY-MM-DD) extracted or deduced from the input text.',
    },
    categoryId: {
      type: Type.STRING,
      description: 'The ID of the category that best matches the transaction, chosen EXPLICITLY from the provided list.',
    },
    categoryName: {
      type: Type.STRING,
      description: 'The name of the category that best matches.',
    }
  },
  required: ['intent', 'confidence'],
}

const buildVoicePrompt = (text: string, context: VoiceExtractionContext) => {
  const expenseCategoriesStr = context.categories.map(c => `[ID: ${c.id}] ${c.name}`).join(', ')
  const incomeCategoriesStr = context.incomeCategories.map(c => `[ID: ${c.id}] ${c.name}`).join(', ')
  const today = format(new Date(), 'yyyy-MM-dd')

  return `
Você é um assistente de finanças pessoais avançado.
Seu objetivo é extrair dados estruturados a partir da fala do usuário. 
Você deve usar raciocínio dedutivo para preencher informações que o usuário não disse explicitamente, mas que são óbvias pelo contexto (e.g., "gasolina" geralmente é Transporte e pago com credit_card ou debit; "almoço" é Alimentação; etc).

Data atual do sistema: ${today}

Lista de categorias de Despesa do usuário:
${expenseCategoriesStr || 'Nenhuma'}

Lista de categorias de Renda do usuário:
${incomeCategoriesStr || 'Nenhuma'}

Regras de Extração:
1. "intent": Determine a ação. Se o usuário diz que gastou, comprou ou pagou algo, é "add_expense". Se recebeu salarial, "add_income". Se investiu, "add_investment".
2. "amount": O valor total da transação.
3. "report_weight": Muito importante. Se o usuário disser "Paguei a conta do restaurante de 200 reais, mas a minha parte deu 50", o amount é 200, e o report_weight é 0.25 (50 / 200).
4. "categoryId" e "categoryName": Baseado na descrição ("comida", "ifood", "mercado"), escolha a ID exata da lista de categorias fornecida que melhor combina.
5. "date": Se ele disser "ontem", calcule a data de ontem. Se "hoje", use a data atual. Sempre no formato YYYY-MM-DD.

Fala do usuário: "${text}"

Responda APENAS com o JSON válido seguindo a estrutura fornecida na sua configuração.
  `.trim()
}

export const extractVoiceCommand = async (
  text: string,
  context: VoiceExtractionContext
): Promise<VoiceExtractionResult> => {
  const ai = createGenAIClient()
  if (!ai) {
    throw new Error('Chave da API do Google Gemini não configurada.')
  }
  const prompt = buildVoicePrompt(text, context)

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: extractionSchema,
        temperature: 0.1 // Low temperature for consistent extraction
      }
    })

    const rawJson = response.text
    if (!rawJson) {
      throw new Error('Retorno vazio do LLM')
    }

    const data = JSON.parse(rawJson)

    // Parse back to AssistantSlots format
    const slots: AssistantSlots = {}
    if (data.transactionType) slots.transactionType = data.transactionType
    if (data.amount) slots.amount = data.amount
    if (data.installment_count) slots.installment_count = data.installment_count
    if (data.payment_method) slots.payment_method = data.payment_method
    if (data.description) slots.description = data.description
    if (data.date) slots.date = data.date
    if (data.categoryId && data.categoryName) {
      slots.category = {
        id: data.categoryId,
        name: data.categoryName,
        confidence: data.confidence || 0.8,
        source: 'mapping'
      }
    }

    // Add nested items for division if report_weight is present
    if (data.report_weight !== undefined && data.report_weight !== 1.0) {
        slots.items = [{
            amount: data.amount,
            report_weight: data.report_weight,
            transactionType: slots.transactionType,
            payment_method: slots.payment_method,
            description: slots.description,
            date: slots.date,
            category: slots.category,
        }]
    }

    const intent = (data.intent as AssistantIntent) || 'unknown'

    return {
      intent,
      slots,
      requiresConfirmation: data.confidence < 0.9,
      confidence: data.confidence || 0.8
    }

  } catch (error) {
    console.error('Gemini API Error in extractVoiceCommand:', error)
    throw error
  }
}
