import type { AssistantIntent } from '@/types'
import {
  EXPENSE_ACTION_HINTS,
  EXPENSE_CONTEXT_HINTS,
  INCOME_CONTEXT_HINTS,
  INVESTMENT_CONTEXT_HINTS,
} from '@/services/assistant-core/constants'

type TransactionClassification = {
  type: 'expense' | 'income' | 'investment'
  scores: Record<'expense' | 'income' | 'investment', number>
}

interface InferIntentParams {
  text: string
  extractAmount: (text: string) => number | undefined
  classifyWriteTransactionType: (text: string) => TransactionClassification
}

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const hasHint = (normalizedText: string, hints: string[]) =>
  hints.some((hint) => normalizedText.includes(normalizeText(hint)))

export const inferIntent = ({
  text,
  extractAmount,
  classifyWriteTransactionType,
}: InferIntentParams): { intent: AssistantIntent; confidence: number } => {
  const normalized = normalizeText(text)
  const hasAmount = Boolean(extractAmount(text))
  const hasExpenseContext = hasHint(normalized, EXPENSE_CONTEXT_HINTS)
  const hasExpenseAction = hasHint(normalized, EXPENSE_ACTION_HINTS)
  const hasIncomeContext = hasHint(normalized, INCOME_CONTEXT_HINTS)
  const hasInvestmentContext = hasHint(normalized, INVESTMENT_CONTEXT_HINTS)

  if (/invest|aporte/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_investment', confidence: 0.9 }
  }

  if (/renda|receita|ganho|salario|salário/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_income', confidence: 0.9 }
  }

  if (/despesa|gasto|conta/.test(normalized) && /adicion|registr|lanc/.test(normalized)) {
    return { intent: 'add_expense', confidence: 0.9 }
  }

  if (hasAmount && hasInvestmentContext) {
    return { intent: 'add_investment', confidence: 0.86 }
  }

  if (hasAmount && hasIncomeContext) {
    return { intent: 'add_income', confidence: 0.84 }
  }

  if (hasAmount && (hasExpenseContext || hasExpenseAction)) {
    return { intent: 'add_expense', confidence: 0.85 }
  }

  if (hasAmount) {
    const classification = classifyWriteTransactionType(text)

    if (classification.type === 'investment' && classification.scores.investment >= 4) {
      return { intent: 'add_investment', confidence: 0.83 }
    }

    if (classification.type === 'income' && classification.scores.income >= 4) {
      return { intent: 'add_income', confidence: 0.81 }
    }
  }

  if (hasAmount) {
    return { intent: 'add_expense', confidence: 0.68 }
  }

  return { intent: 'unknown', confidence: 0.3 }
}
