import type { AssistantIntent, AssistantResolvedCategory, AssistantSlots } from '@/types'

interface SlotItem {
  transactionType?: 'expense' | 'income' | 'investment'
  amount: number
  installment_count?: number
  payment_method?: 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other'
  credit_card_id?: string
  credit_card_name?: string
  report_weight?: number
  description?: string
  date?: string
  month?: string
  category?: {
    id?: string
    name: string
    confidence: number
    source: AssistantResolvedCategory['source']
  }
}

interface BuildSlotsParams {
  text: string
  intent: AssistantIntent
  extractAmount: (text: string) => number | undefined
  extractDate: (text: string) => string
  extractDescription: (text: string, intent: AssistantIntent) => string | undefined
  extractAddItemsFromText: (text: string, intent: AssistantIntent, fallbackDate: string) => SlotItem[] | undefined
  extractInstallmentCount: (text: string) => number | undefined
  extractPaymentMethod: (text: string) => 'cash' | 'debit' | 'credit_card' | 'pix' | 'transfer' | 'other' | undefined
  extractCreditCardName: (text: string) => string | undefined
}

const resolveTransactionTypeFromIntent = (
  intent: AssistantIntent,
): 'expense' | 'income' | 'investment' | undefined => {
  if (intent === 'add_investment') return 'investment'
  if (intent === 'add_income') return 'income'
  if (intent === 'add_expense') return 'expense'
  return undefined
}

export const buildSlots = ({
  text,
  intent,
  extractAmount,
  extractDate,
  extractDescription,
  extractAddItemsFromText,
  extractInstallmentCount,
  extractPaymentMethod,
  extractCreditCardName,
}: BuildSlotsParams): AssistantSlots => {
  const amount = extractAmount(text)
  const date = extractDate(text)
  const description = extractDescription(text, intent)
  const items = extractAddItemsFromText(text, intent, date)
  const installmentCount = intent === 'add_expense'
    ? extractInstallmentCount(text)
    : undefined
  const paymentMethod = intent === 'add_expense'
    ? extractPaymentMethod(text)
    : undefined
  const creditCardName = intent === 'add_expense'
    ? extractCreditCardName(text)
    : undefined

  const calculateReportWeight = (text: string): number | undefined => {
    const normalized = text.toLowerCase()
    const isShared = normalized.includes('divid') || 
                     normalized.includes('rachad') || 
                     normalized.includes('rachou') ||
                     normalized.includes('cada um') || 
                     normalized.includes('cadaum') ||
                     normalized.includes('por cabeca') ||
                     normalized.includes('porcabeca') ||
                     normalized.includes('meu foi') ||
                     normalized.includes('o meu saiu') ||
                     normalized.includes('pra mim deu') ||
                     normalized.includes('pramim deu') ||
                     normalized.includes('com amigos') ||
                     normalized.includes('com 2 amigos')

    if (!isShared) return undefined

    const numberMatches = text.match(/\d+(?:\s*[.,]\s*\d+)?/g) || []
    const amounts = numberMatches.map(m => parseFloat(m.replace(/\s+/g, '').replace(',', '.')))
    
    const divMatch = normalized.match(/divid\w+\s+(?:por|em)\s+(\w+)/i)
    if (divMatch) {
        const map: Record<string, number> = { 'dois': 2, 'tres': 3, 'quatro': 4, 'cinco': 5 }
        const val = map[divMatch[1]] ?? Number(divMatch[1])
        if (val > 0) return Number((1 / val).toFixed(4))
    }

    if (normalized.includes('com 2 amigos')) return 0.3333
    
    if (amounts.length >= 2) {
      const total = Math.max(...amounts)
      const part = Math.min(...amounts)
      if (part < total) return Number((part / total).toFixed(4))
    }

    if (normalized.includes('rachou') || normalized.includes('rachamos')) return 0.5
    
    if (normalized.includes('cadaum') || normalized.includes('cada 1') || normalized.includes('pramim') || normalized.includes('cada um')) return 0.3333

    return 0.25 
  }

  const reportWeight = !items || items.length === 0 ? calculateReportWeight(text) : undefined
  const transactionType = resolveTransactionTypeFromIntent(intent)

  if (intent === 'add_investment') {
    return {
      transactionType,
      amount,
      description,
      month: date.substring(0, 7),
      date,
      items,
    }
  }

    return {
      transactionType,
      amount,
      installment_count: installmentCount,
      payment_method: paymentMethod,
      credit_card_name: creditCardName,
      report_weight: reportWeight,
      description,
      date,
      month: date.substring(0, 7),
      items,
    }
}
