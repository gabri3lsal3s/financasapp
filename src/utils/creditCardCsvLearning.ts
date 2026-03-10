type CsvLearningEntry = {
  id: string
  officialDescription: string
  normalizedOfficialDescription: string
  suggestedDescription: string
  categoryId: string
  uses: number
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'assistant-credit-card-csv-description-learning-v1'

const normalize = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const tokenSet = (value: string) =>
  new Set(
    normalize(value)
      .split(' ')
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  )

export const similarity = (left: string, right: string) => {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (!leftTokens.size || !rightTokens.size) return 0

  let intersection = 0
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1
  })

  const union = new Set([...leftTokens, ...rightTokens]).size
  if (!union) return 0
  return intersection / union
}

const readEntries = (): CsvLearningEntry[] => {
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

const writeEntries = (entries: CsvLearningEntry[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
}

export const learnFromCreditCardCsvInsertion = (input: {
  officialDescription: string
  chosenDescription: string
  chosenCategoryId: string
}) => {
  const officialDescription = String(input.officialDescription || '').trim()
  const chosenDescription = String(input.chosenDescription || '').trim()
  const chosenCategoryId = String(input.chosenCategoryId || '').trim()

  if (!officialDescription || !chosenDescription || !chosenCategoryId) return null

  const normalizedOfficialDescription = normalize(officialDescription)
  if (!normalizedOfficialDescription) return null

  const entries = readEntries()
  const now = new Date().toISOString()

  const existing = entries.find((entry) => entry.normalizedOfficialDescription === normalizedOfficialDescription)

  if (existing) {
    const updated: CsvLearningEntry = {
      ...existing,
      officialDescription,
      suggestedDescription: chosenDescription,
      categoryId: chosenCategoryId,
      uses: Number(existing.uses || 0) + 1,
      updatedAt: now,
    }

    writeEntries(entries.map((entry) => (entry.id === existing.id ? updated : entry)))
    return updated
  }

  const created: CsvLearningEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    officialDescription,
    normalizedOfficialDescription,
    suggestedDescription: chosenDescription,
    categoryId: chosenCategoryId,
    uses: 1,
    createdAt: now,
    updatedAt: now,
  }

  writeEntries([created, ...entries].slice(0, 1000))
  return created
}

export const suggestFromCreditCardCsvLearning = (officialDescription: string) => {
  const normalizedTarget = normalize(officialDescription)
  if (!normalizedTarget) return null

  const entries = readEntries()
  if (!entries.length) return null

  const exact = entries.find((entry) => entry.normalizedOfficialDescription === normalizedTarget)
  if (exact) {
    return {
      categoryId: exact.categoryId,
      description: exact.suggestedDescription,
      confidence: 1,
      sourceDescription: exact.officialDescription,
    }
  }

  const best = entries
    .map((entry) => ({
      entry,
      score: similarity(normalizedTarget, entry.normalizedOfficialDescription),
    }))
    .filter((item) => item.score >= 0.55)
    .sort((a, b) => b.score - a.score)[0]

  if (!best) return null

  return {
    categoryId: best.entry.categoryId,
    description: best.entry.suggestedDescription,
    confidence: Number(best.score.toFixed(2)),
    sourceDescription: best.entry.officialDescription,
  }
}
