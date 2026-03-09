import { formatCurrencyCompactBR } from '@/utils/format'
import type {
  AssistantCommand,
  AssistantIntent,
  AssistantResolvedCategory,
  AssistantSlots,
} from '@/types'
import { resolveConfirmationPolicy } from './confirmationPolicy'
import { CONFIRMATION_WINDOW_MS } from './constants'

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export const requiresConfirmation = (intent: AssistantIntent) =>
  resolveConfirmationPolicy({
    intent,
    mode: 'write_only',
  }).requiresConfirmation

export const buildConfirmationText = (
  intent: AssistantIntent,
  slots: AssistantSlots,
  options?: { needsCategoryDisambiguation?: boolean; categoryCandidates?: AssistantResolvedCategory[] },
) => {
  if (!requiresConfirmation(intent)) return 'Comando entendido.'

  if (options?.needsCategoryDisambiguation && options.categoryCandidates?.length) {
    const optionsText = options.categoryCandidates
      .slice(0, 3)
      .map((candidate) => candidate.name)
      .join(', ')
    return `Preciso confirmar a categoria. Diga a categoria desejada: ${optionsText}.`
  }

  if (slots.items && slots.items.length > 1) {
    const preview = slots.items
      .slice(0, 3)
      .map((item) => {
        const label =
          item.transactionType === 'investment'
            ? 'investimento'
            : item.transactionType === 'income'
            ? 'renda'
            : 'despesa'
        const installmentLabel =
          item.transactionType === 'expense' && item.installment_count && item.installment_count > 1
            ? `, ${item.installment_count}x`
            : ''
        const cardLabel =
          item.transactionType === 'expense' && item.payment_method === 'credit_card'
            ? `, cartão ${item.credit_card_name || 'crédito'}`
            : ''
        return `${label}: ${item.description || item.category?.name || label} (${formatCurrencyCompactBR(
          item.amount,
        )}${installmentLabel}${cardLabel})`
      })
      .join(', ')

    const hasMixedTypes =
      new Set(
        slots.items.map((item) => {
          if (item.transactionType) return item.transactionType
          if (intent === 'add_investment') return 'investment'
          if (intent === 'add_income') return 'income'
          return 'expense'
        }),
      ).size > 1

    if (hasMixedTypes) {
      return `Confirma adicionar ${slots.items.length} lançamentos: ${preview}?`
    }

    if (intent === 'add_expense') {
      return `Confirma adicionar ${slots.items.length} despesas: ${preview}?`
    }

    if (intent === 'add_income') {
      return `Confirma adicionar ${slots.items.length} rendas: ${preview}?`
    }

    if (intent === 'add_investment') {
      return `Confirma adicionar ${slots.items.length} investimentos: ${preview}?`
    }
  }

  if (intent === 'add_expense') {
    const installmentLabel =
      slots.installment_count && slots.installment_count > 1 ? ` em ${slots.installment_count} parcelas` : ''
    const cardLabel =
      slots.payment_method === 'credit_card' ? ` no cartão ${slots.credit_card_name || 'de crédito'}` : ''
    return `Confirma despesa de ${formatCurrencyCompactBR(slots.amount ?? 0)}${installmentLabel}${cardLabel} em ${
      slots.category?.name || 'Sem categoria'
    } na data ${slots.date}?`
  }

  if (intent === 'add_income') {
    return `Confirma renda de ${formatCurrencyCompactBR(slots.amount ?? 0)} em ${
      slots.category?.name || 'Sem categoria'
    } na data ${slots.date}?`
  }

  if (intent === 'add_investment') {
    return `Confirma investimento de ${formatCurrencyCompactBR(slots.amount ?? 0)} para ${slots.month}?`
  }

  if (intent === 'update_transaction') {
    const parts: string[] = []
    if (slots.amount) {
      parts.push(`valor para ${formatCurrencyCompactBR(slots.amount)}`)
    }
    if (slots.description) {
      parts.push(`descrição para ${slots.description}`)
    }

    if (!parts.length) {
      return 'Confirma atualização do lançamento selecionado?'
    }

    return `Confirma atualizar lançamento com ${parts.join(' e ')}?`
  }

  if (intent === 'delete_transaction') {
    if (slots.description) {
      return `Confirma excluir lançamento relacionado a ${slots.description}?`
    }
    if (slots.amount) {
      return `Confirma excluir lançamento de ${formatCurrencyCompactBR(slots.amount)}?`
    }
    return 'Confirma excluir o lançamento selecionado?'
  }

  if (intent === 'create_category') {
    const normalized = normalizeText(slots.description || '')
    const type = /renda|receita/.test(normalized) ? 'renda' : 'despesa'
    if (slots.description) {
      return `Confirma criar categoria de ${type} com nome ${slots.description}?`
    }
    return `Confirma criar nova categoria de ${type}?`
  }

  return 'Confirma a execução do comando?'
}

export const isCommandExpired = (createdAt: string) => {
  const createdAtMs = new Date(createdAt).getTime()
  return Number.isFinite(createdAtMs) && Date.now() - createdAtMs > CONFIRMATION_WINDOW_MS
}

export const resolveCategoryFromSpokenConfirmation = (
  command: AssistantCommand,
  spokenText?: string,
): AssistantResolvedCategory | undefined => {
  const candidates =
    (command.category_resolution_json as { candidates?: AssistantResolvedCategory[] } | undefined)?.candidates || []
  if (!candidates.length || !spokenText) return undefined

  const normalizedSpoken = normalizeText(spokenText)
  const directMatch = candidates.find((candidate) => normalizedSpoken.includes(normalizeText(candidate.name)))
  if (directMatch) return directMatch

  const spokenTokens = normalizedSpoken.split(/\s+/).filter((token) => token.length >= 3)
  if (!spokenTokens.length) return undefined

  const scored = candidates
    .map((candidate) => {
      const candidateName = normalizeText(candidate.name)
      const score = spokenTokens.reduce((sum, token) => (candidateName.includes(token) ? sum + 1 : sum), 0)
      return { candidate, score }
    })
    .sort((a, b) => b.score - a.score)

  if ((scored[0]?.score || 0) <= 0) return undefined
  return scored[0].candidate
}
