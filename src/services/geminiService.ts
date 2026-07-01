import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

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
    logger.error('Falha ao consultar o assistente Gemini:', err)
    throw new Error('Não foi possível conectar ao assistente de IA. Verifique sua conexão e tente novamente.')
  }
}
