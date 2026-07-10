/**
 * Aprendizado do usuário sobre despesas recorrentes.
 * 
 * Permite ao usuário:
 * - Ignorar/desconsiderar ocorrências específicas de uma despesa recorrente
 * - Confirmar/validar ocorrências que o sistema não identificou
 * 
 * O feedback é usado para refinar a detecção futura.
 * 
 * Persistência: localStorage (imediato) + Supabase (background).
 */

import {
  getAllFeedback,
  saveAllFeedback,
  syncFeedbackFromServer,
} from '@/services/recurringExpenseFeedbackService'

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

function getOrCreate(feedbacks: UserFeedback[], recurringKey: string): UserFeedback {
  let fb = feedbacks.find(f => f.recurringKey === recurringKey)
  if (!fb) {
    fb = { recurringKey, dismissedIds: [], confirmedIds: [], updatedAt: new Date().toISOString() }
    feedbacks.push(fb)
  }
  return fb
}

async function persistAndSync(feedbacks: UserFeedback[]): Promise<void> {
  await saveAllFeedback(feedbacks)
}

/* ------------------------------------------------------------------ */
/*  API pública                                                        */
/* ------------------------------------------------------------------ */

/**
 * Inicializa o sistema de aprendizado, sincronizando do Supabase para localStorage.
 * Chamar uma vez na inicialização do app.
 */
export async function initRecurringLearning(): Promise<void> {
  await syncFeedbackFromServer()
}

/**
 * Retorna o feedback para uma despesa recorrente (síncrono, lê do localStorage).
 */
export function getFeedback(recurringKey: string): UserFeedback {
  const all = getAllFeedback()
  return getOrCreate(all, recurringKey)
}

/**
 * Marca um expense ID como "não é recorrência" (falso positivo).
 * Atualiza localStorage imediatamente e sincroniza com Supabase em background.
 */
export async function dismissOccurrence(recurringKey: string, expenseId: string): Promise<void> {
  const all = getAllFeedback()
  const fb = getOrCreate(all, recurringKey)
  fb.dismissedIds = [...new Set([...fb.dismissedIds, expenseId])]
  fb.confirmedIds = fb.confirmedIds.filter(id => id !== expenseId)
  fb.updatedAt = new Date().toISOString()
  const idx = all.findIndex(f => f.recurringKey === recurringKey)
  if (idx >= 0) all[idx] = fb
  else all.push(fb)
  await persistAndSync(all)
}

/**
 * Marca um expense ID como "é recorrência" (falso negativo).
 * Atualiza localStorage imediatamente e sincroniza com Supabase em background.
 */
export async function confirmOccurrence(recurringKey: string, expenseId: string): Promise<void> {
  const all = getAllFeedback()
  const fb = getOrCreate(all, recurringKey)
  fb.confirmedIds = [...new Set([...fb.confirmedIds, expenseId])]
  fb.dismissedIds = fb.dismissedIds.filter(id => id !== expenseId)
  fb.updatedAt = new Date().toISOString()
  const idx = all.findIndex(f => f.recurringKey === recurringKey)
  if (idx >= 0) all[idx] = fb
  else all.push(fb)
  await persistAndSync(all)
}

/**
 * Remove um expense ID de qualquer feedback (restaura).
 * Atualiza localStorage imediatamente e sincroniza com Supabase em background.
 */
export async function clearOccurrenceFeedback(recurringKey: string, expenseId: string): Promise<void> {
  const all = getAllFeedback()
  const fb = getOrCreate(all, recurringKey)
  fb.dismissedIds = fb.dismissedIds.filter(id => id !== expenseId)
  fb.confirmedIds = fb.confirmedIds.filter(id => id !== expenseId)
  fb.updatedAt = new Date().toISOString()
  const idx = all.findIndex(f => f.recurringKey === recurringKey)
  if (idx >= 0) all[idx] = fb
  else all.push(fb)
  await persistAndSync(all)
}

/**
 * Retorna todos os expense IDs que o usuário já marcou como "não recorrência" para uma chave.
 * (síncrono, lê do localStorage)
 */
export function getDismissedIds(recurringKey: string): string[] {
  return getFeedback(recurringKey).dismissedIds
}

/**
 * Retorna todos os expense IDs que o usuário já confirmou como recorrência.
 * (síncrono, lê do localStorage)
 */
export function getConfirmedIds(recurringKey: string): string[] {
  return getFeedback(recurringKey).confirmedIds
}

/**
 * Remove todo o feedback para uma chave (usado quando a despesa é restaurada).
 * Atualiza localStorage imediatamente e sincroniza com Supabase em background.
 */
export async function clearFeedbackForRecurring(recurringKey: string): Promise<void> {
  const all = getAllFeedback().filter(f => f.recurringKey !== recurringKey)
  await persistAndSync(all)
}
