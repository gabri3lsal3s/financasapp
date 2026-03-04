import type { AssistantIntent, AssistantResolvedCategory, AssistantSlots } from '@/types'

export type AssistantMemoryTransactionType = 'expense' | 'income'

export interface AssistantMemoryEntry {
  id: string
  keyword: string
  transactionType: AssistantMemoryTransactionType
  categoryId: string
  categoryName: string
  confidence: number
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'assistant-memory-entries'
export const ASSISTANT_MEMORY_UPDATED_EVENT = 'assistant-memory-updated'
export const ASSISTANT_MEMORY_STORAGE_KEY = STORAGE_KEY

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

const readEntries = (): AssistantMemoryEntry[] => {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const writeEntries = (entries: AssistantMemoryEntry[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(ASSISTANT_MEMORY_UPDATED_EVENT, {
      detail: { total: entries.length },
    }))
  }
}

export const getAssistantMemoryEntries = () => readEntries()

export const clearAssistantMemoryEntries = () => {
  writeEntries([])
}

export const createAssistantMemoryEntry = (input: {
  keyword: string
  transactionType: AssistantMemoryTransactionType
  categoryId: string
  categoryName: string
  confidence?: number
}) => {
  const keyword = input.keyword.trim()
  if (!keyword || !input.categoryId || !input.categoryName) return null

  const now = new Date().toISOString()
  const normalizedKeyword = normalize(keyword)
  const entries = readEntries()

  const existing = entries.find((entry) =>
    normalize(entry.keyword) === normalizedKeyword
    && entry.transactionType === input.transactionType,
  )

  if (existing) {
    const updated = {
      ...existing,
      keyword,
      categoryId: input.categoryId,
      categoryName: input.categoryName,
      confidence: input.confidence ?? existing.confidence,
      updatedAt: now,
    }

    const next = entries.map((entry) => (entry.id === existing.id ? updated : entry))
    writeEntries(next)
    return updated
  }

  const created: AssistantMemoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    keyword,
    transactionType: input.transactionType,
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    confidence: input.confidence ?? 0.88,
    createdAt: now,
    updatedAt: now,
  }

  writeEntries([created, ...entries])
  return created
}

export const updateAssistantMemoryEntry = (
  id: string,
  updates: Partial<Pick<AssistantMemoryEntry, 'keyword' | 'transactionType' | 'categoryId' | 'categoryName' | 'confidence'>>,
) => {
  const entries = readEntries()
  const current = entries.find((entry) => entry.id === id)
  if (!current) return null

  const nextItem: AssistantMemoryEntry = {
    ...current,
    ...updates,
    keyword: updates.keyword?.trim() || current.keyword,
    categoryId: updates.categoryId || current.categoryId,
    categoryName: updates.categoryName || current.categoryName,
    updatedAt: new Date().toISOString(),
  }

  if (!nextItem.keyword || !nextItem.categoryId || !nextItem.categoryName) return null

  const next = entries.map((entry) => (entry.id === id ? nextItem : entry))
  writeEntries(next)
  return nextItem
}

export const deleteAssistantMemoryEntry = (id: string) => {
  const entries = readEntries()
  const next = entries.filter((entry) => entry.id !== id)
  if (next.length === entries.length) return false
  writeEntries(next)
  return true
}

const intentToMemoryType = (intent: AssistantIntent): AssistantMemoryTransactionType | null => {
  if (intent === 'add_expense') return 'expense'
  if (intent === 'add_income') return 'income'
  return null
}

export const applyAssistantMemoryToSlots = (
  intent: AssistantIntent,
  slots: AssistantSlots,
): { slots: AssistantSlots; matched: AssistantMemoryEntry | null } => {
  const transactionType = intentToMemoryType(intent)
  if (!transactionType) return { slots, matched: null }

  if (slots.category?.id || !slots.description?.trim()) {
    return { slots, matched: null }
  }

  const matched = findAssistantMemoryMatch(intent, slots)

  if (!matched) return { slots, matched: null }

  const nextSlots: AssistantSlots = {
    ...slots,
    category: {
      id: matched.categoryId,
      name: matched.categoryName,
      confidence: matched.confidence,
      source: 'memory' as AssistantResolvedCategory['source'],
    },
  }

  return {
    slots: nextSlots,
    matched,
  }
}

export const findAssistantMemoryMatch = (
  intent: AssistantIntent,
  slots: AssistantSlots,
): AssistantMemoryEntry | null => {
  const transactionType = intentToMemoryType(intent)
  if (!transactionType) return null
  if (!slots.description?.trim()) return null

  const entries = readEntries()
  const normalizedDescription = normalize(slots.description)

  const matched = entries
    .filter((entry) => entry.transactionType === transactionType)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .find((entry) => normalizedDescription.includes(normalize(entry.keyword)))

  return matched || null
}

export const learnAssistantMemoryFromConfirmation = (intent: AssistantIntent, slots: AssistantSlots) => {
  const transactionType = intentToMemoryType(intent)
  if (!transactionType) return null

  const keyword = slots.description?.trim()
  const categoryId = slots.category?.id
  const categoryName = slots.category?.name

  if (!keyword || !categoryId || !categoryName) return null

  return createAssistantMemoryEntry({
    keyword,
    transactionType,
    categoryId,
    categoryName,
    confidence: Math.max(0.8, Math.min(0.98, slots.category?.confidence ?? 0.9)),
  })
}
