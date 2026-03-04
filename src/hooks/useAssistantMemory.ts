import { useEffect, useState } from 'react'
import {
  ASSISTANT_MEMORY_UPDATED_EVENT,
  clearAssistantMemoryEntries,
  createAssistantMemoryEntry,
  deleteAssistantMemoryEntry,
  getAssistantMemoryEntries,
  updateAssistantMemoryEntry,
  type AssistantMemoryEntry,
  type AssistantMemoryTransactionType,
} from '@/utils/assistantMemory'

export function useAssistantMemory() {
  const [entries, setEntries] = useState<AssistantMemoryEntry[]>(() => getAssistantMemoryEntries())

  const refresh = () => {
    setEntries(getAssistantMemoryEntries())
  }

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    window.addEventListener(ASSISTANT_MEMORY_UPDATED_EVENT, refresh)

    return () => {
      window.removeEventListener(ASSISTANT_MEMORY_UPDATED_EVENT, refresh)
    }
  }, [])

  return {
    entries,
    createEntry: (input: {
      keyword: string
      transactionType: AssistantMemoryTransactionType
      categoryId: string
      categoryName: string
      confidence?: number
    }) => createAssistantMemoryEntry(input),
    updateEntry: updateAssistantMemoryEntry,
    deleteEntry: deleteAssistantMemoryEntry,
    clearEntries: clearAssistantMemoryEntries,
    refresh,
  }
}
