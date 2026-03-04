import type { AssistantIntent, AssistantResolvedCategory, AssistantSlots } from '@/types'

interface SlotItem {
  transactionType?: 'expense' | 'income' | 'investment'
  amount: number
  installment_count?: number
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
}: BuildSlotsParams): AssistantSlots => {
  const amount = extractAmount(text)
  const date = extractDate(text)
  const description = extractDescription(text, intent)
  const items = extractAddItemsFromText(text, intent, date)
  const installmentCount = intent === 'add_expense'
    ? extractInstallmentCount(text)
    : undefined
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
    description,
    date,
    month: date.substring(0, 7),
    items,
  }
}
