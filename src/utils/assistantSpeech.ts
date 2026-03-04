export type AssistantSpeechDepth = 'concise' | 'consultive'

const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim()

const takeFirstSentence = (value: string) => {
  const match = value.match(/^[^.!?]+[.!?]?/)
  return match ? match[0].trim() : value
}

const ensureEnding = (value: string) => {
  if (!value) return value
  if (/[.!?]$/.test(value)) return value
  return `${value}.`
}

const truncate = (value: string, maxLength: number) => {
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1)).trim()}…`
}

export const formatAssistantSpeechText = (text: string, depth: AssistantSpeechDepth = 'consultive') => {
  const normalized = normalizeWhitespace(text)
  if (!normalized) return ''

  if (depth === 'concise') {
    const firstSentence = takeFirstSentence(normalized)
    return ensureEnding(truncate(firstSentence, 120))
  }

  return ensureEnding(truncate(normalized, 220))
}
