import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'
import type { UserFeedback } from '@/utils/recurringExpenseLearning'

const TAG = '[recurringExpenseFeedbackService]'

/* ------------------------------------------------------------------ */
/*  Cache de sessão — evita repetir chamadas Supabase que falharam     */
/* ------------------------------------------------------------------ */

let _supabaseFailed = false

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'recurring-expense-feedback-v1'
const TABLE_NAME = 'recurring_expense_feedback'

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

function readLocal(): UserFeedback[] {
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

function writeLocal(feedbacks: UserFeedback[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(feedbacks))
  } catch {
    // localStorage cheio ou indisponível — ignorar
  }
}

/* ------------------------------------------------------------------ */
/*  Supabase helpers                                                   */
/* ------------------------------------------------------------------ */

async function loadFromSupabase(): Promise<UserFeedback[] | null> {
  if (_supabaseFailed) return null // cache de sessão: não repete chamadas que já falharam

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('feedback')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (!data?.feedback) return null

    return data.feedback as unknown as UserFeedback[]
  } catch (err) {
    logger.warn(TAG, 'Erro ao carregar do Supabase, usando localStorage:', err)
    _supabaseFailed = true // marca cache para evitar repetição
    return null
  }
}

async function saveToSupabase(feedbacks: UserFeedback[]): Promise<void> {
  if (_supabaseFailed) return // cache de sessão: não tenta salvar se já falhou antes

  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert({
        user_id: user.id,
        feedback: feedbacks,
      }, { onConflict: 'user_id' })

    if (error) throw error
  } catch (err) {
    logger.warn(TAG, 'Erro ao salvar no Supabase:', err)
    _supabaseFailed = true // marca cache para evitar repetição
  }
}

/* ------------------------------------------------------------------ */
/*  API pública                                                        */
/* ------------------------------------------------------------------ */

/**
 * Sincroniza os feedbacks do Supabase para o localStorage.
 * Deve ser chamado uma vez na inicialização do app.
 * Se o Supabase tiver dados, sobrescreve o localStorage.
 */
export async function syncFeedbackFromServer(): Promise<UserFeedback[]> {
  try {
    const remote = await loadFromSupabase()
    if (remote && remote.length > 0) {
      writeLocal(remote)
      return remote
    }
  } catch {
    // fallback para localStorage
  }
  return readLocal()
}

/**
 * Salva a lista completa de feedbacks.
 * Atualiza localStorage imediatamente e dispara sync para Supabase em background.
 */
export async function saveAllFeedback(feedbacks: UserFeedback[]): Promise<void> {
  writeLocal(feedbacks)

  // Sync com Supabase em background (não bloqueia)
  saveToSupabase(feedbacks).catch(() => {
    // Falha silenciosa — localStorage já foi atualizado
  })
}

/**
 * Retorna todos os feedbacks do localStorage (síncrono, instantâneo).
 */
export function getAllFeedback(): UserFeedback[] {
  return readLocal()
}
