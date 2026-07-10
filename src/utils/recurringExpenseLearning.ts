/**
 * Aprendizado do usuário sobre despesas recorrentes.
 * 
 * Permite ao usuário:
 * - Ignorar/desconsiderar ocorrências específicas de uma despesa recorrente
 * - Confirmar/validar ocorrências que o sistema não identificou
 * 
 * O feedback é usado para refinar a detecção futura.
 */

const STORAGE_KEY = 'recurring-expense-learning-v1'

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface UserFeedback {
  /** Descrição normalizada da despesa recorrente */
  recurringKey: string
  /** Expense IDs que o usuário marcou como "não é recorrência" */
  dismissedIds: string[]
  /** Expense IDs que o usuário marcou como "é recorrência" */
  confirmedIds: string[]
  /** Timestamp da última atualização */
  updatedAt: string
}

/* ------------------------------------------------------------------ */
/*  Internas                                                           */
/* ------------------------------------------------------------------ */

function readAll(): UserFeedback[] {
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

function writeAll(feedbacks: UserFeedback[]) {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks))
}

function getOrCreate(recurringKey: string): UserFeedback {
  const all = readAll()
  let fb = all.find(f => f.recurringKey === recurringKey)
  if (!fb) {
    fb = { recurringKey, dismissedIds: [], confirmedIds: [], updatedAt: new Date().toISOString() }
    all.push(fb)
  }
  return fb
}

function save(fb: UserFeedback) {
  const all = readAll()
  const idx = all.findIndex(f => f.recurringKey === fb.recurringKey)
  if (idx >= 0) all[idx] = fb
  else all.push(fb)
  writeAll(all)
}

/* ------------------------------------------------------------------ */
/*  API pública                                                        */
/* ------------------------------------------------------------------ */

/**
 * Retorna o feedback para uma despesa recorrente.
 */
export function getFeedback(recurringKey: string): UserFeedback {
  return getOrCreate(recurringKey)
}

/**
 * Marca um expense ID como "não é recorrência" (falso positivo).
 */
export function dismissOccurrence(recurringKey: string, expenseId: string): void {
  const fb = getOrCreate(recurringKey)
  fb.dismissedIds = [...new Set([...fb.dismissedIds, expenseId])]
  fb.confirmedIds = fb.confirmedIds.filter(id => id !== expenseId)
  fb.updatedAt = new Date().toISOString()
  save(fb)
}

/**
 * Marca um expense ID como "é recorrência" (falso negativo).
 */
export function confirmOccurrence(recurringKey: string, expenseId: string): void {
  const fb = getOrCreate(recurringKey)
  fb.confirmedIds = [...new Set([...fb.confirmedIds, expenseId])]
  fb.dismissedIds = fb.dismissedIds.filter(id => id !== expenseId)
  fb.updatedAt = new Date().toISOString()
  save(fb)
}

/**
 * Remove um expense ID de qualquer feedback (restaura).
 */
export function clearOccurrenceFeedback(recurringKey: string, expenseId: string): void {
  const fb = getOrCreate(recurringKey)
  fb.dismissedIds = fb.dismissedIds.filter(id => id !== expenseId)
  fb.confirmedIds = fb.confirmedIds.filter(id => id !== expenseId)
  fb.updatedAt = new Date().toISOString()
  save(fb)
}

/**
 * Retorna todos os expense IDs que o usuário já marcou como "não recorrência" para uma chave.
 */
export function getDismissedIds(recurringKey: string): string[] {
  return getOrCreate(recurringKey).dismissedIds
}

/**
 * Retorna todos os expense IDs que o usuário já confirmou como recorrência.
 */
export function getConfirmedIds(recurringKey: string): string[] {
  return getOrCreate(recurringKey).confirmedIds
}

/**
 * Remove todo o feedback para uma chave (usado quando a despesa é restaurada).
 */
export function clearFeedbackForRecurring(recurringKey: string): void {
  const all = readAll().filter(f => f.recurringKey !== recurringKey)
  writeAll(all)
}
