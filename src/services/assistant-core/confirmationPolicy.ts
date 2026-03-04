import type { AssistantIntent, AssistantSlots } from '@/types'

export type AssistantConfirmationMode = 'write_only' | 'always' | 'never'
export type AssistantConfirmationRisk = 'low' | 'medium' | 'high' | 'critical'

const WRITE_INTENTS = new Set<AssistantIntent>([
  'add_expense',
  'add_income',
  'add_investment',
  'update_transaction',
  'delete_transaction',
  'create_category',
])

const CRITICAL_INTENTS = new Set<AssistantIntent>([
  'delete_transaction',
  'update_transaction',
  'create_category',
])

export interface ConfirmationPolicyParams {
  intent: AssistantIntent
  slots?: AssistantSlots
  confidence?: number
  needsCategoryDisambiguation?: boolean
  mode?: AssistantConfirmationMode
  forceConfirmation?: boolean
}

export interface ConfirmationPolicyResult {
  requiresConfirmation: boolean
  risk: AssistantConfirmationRisk
  reason:
    | 'forced'
    | 'mode_always'
    | 'mode_never'
    | 'sensitive_intent'
    | 'disambiguation_required'
    | 'high_value'
    | 'write_intent'
    | 'read_only'
}

const resolveMaxAmount = (slots?: AssistantSlots): number => {
  if (!slots) return 0
  const singleAmount = Number.isFinite(Number(slots.amount)) ? Number(slots.amount) : 0
  const itemsMax = (slots.items || []).reduce((max, item) => {
    const amount = Number(item.amount || 0)
    return Number.isFinite(amount) && amount > max ? amount : max
  }, 0)
  return Math.max(singleAmount, itemsMax)
}

const hasMultiItemWrite = (slots?: AssistantSlots) => (slots?.items?.length || 0) > 1

const hasInstallments = (slots?: AssistantSlots) => {
  if ((slots?.installment_count || 0) > 1) return true
  return (slots?.items || []).some((item) => (item.installment_count || 0) > 1)
}

const classifyRisk = ({
  intent,
  slots,
  confidence,
  needsCategoryDisambiguation,
}: Pick<ConfirmationPolicyParams, 'intent' | 'slots' | 'confidence' | 'needsCategoryDisambiguation'>): AssistantConfirmationRisk => {
  if (CRITICAL_INTENTS.has(intent)) return 'critical'
  if (needsCategoryDisambiguation) return 'critical'

  if (!WRITE_INTENTS.has(intent)) return 'low'

  const maxAmount = resolveMaxAmount(slots)
  const lowConfidence = typeof confidence === 'number' && confidence < 0.55
  const highValue = maxAmount >= 1000

  if (highValue || hasMultiItemWrite(slots) || hasInstallments(slots) || lowConfidence) {
    return 'high'
  }

  return 'medium'
}

export const resolveConfirmationPolicy = ({
  intent,
  slots,
  confidence,
  needsCategoryDisambiguation,
  mode = 'write_only',
  forceConfirmation = false,
}: ConfirmationPolicyParams): ConfirmationPolicyResult => {
  const risk = classifyRisk({
    intent,
    slots,
    confidence,
    needsCategoryDisambiguation,
  })

  if (forceConfirmation) {
    return {
      requiresConfirmation: true,
      reason: 'forced',
      risk,
    }
  }

  if (mode === 'always') {
    return {
      requiresConfirmation: true,
      reason: 'mode_always',
      risk,
    }
  }

  if (risk === 'critical') {
    return {
      requiresConfirmation: true,
      reason: needsCategoryDisambiguation ? 'disambiguation_required' : 'sensitive_intent',
      risk,
    }
  }

  if (mode === 'never') {
    return {
      requiresConfirmation: false,
      reason: 'mode_never',
      risk,
    }
  }

  if (risk === 'high') {
    return {
      requiresConfirmation: true,
      reason: 'high_value',
      risk,
    }
  }

  if (WRITE_INTENTS.has(intent)) {
    return {
      requiresConfirmation: true,
      reason: 'write_intent',
      risk,
    }
  }

  return {
    requiresConfirmation: false,
    reason: 'read_only',
    risk,
  }
}
