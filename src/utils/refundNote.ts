export const REFUND_NOTE_PREFIX = '[REFUND]'

export const buildRefundNote = (incomeId: string, description: string) =>
  `${REFUND_NOTE_PREFIX}${JSON.stringify({ incomeId, description })}`

export const parseRefundNote = (rawNote?: string | null) => {
  const note = String(rawNote || '')
  if (!note.startsWith(REFUND_NOTE_PREFIX)) {
    return { isRefund: false as const }
  }

  const payload = note.slice(REFUND_NOTE_PREFIX.length)

  try {
    const parsed = JSON.parse(payload) as { incomeId?: string; description?: string }
    if (!parsed?.incomeId) {
      return { isRefund: false as const }
    }

    return {
      isRefund: true as const,
      incomeId: String(parsed.incomeId),
      description: String(parsed.description || ''),
    }
  } catch {
    return { isRefund: false as const }
  }
}
