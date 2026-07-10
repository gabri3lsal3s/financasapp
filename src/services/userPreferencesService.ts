import { supabase } from '@/lib/supabase'
import { logger } from '@/utils/logger'

const TAG = '[userPreferencesService]'

/* ------------------------------------------------------------------ */
/*  Tipos                                                              */
/* ------------------------------------------------------------------ */

export interface PinnedAnalysisPref {
  text: string
  dataHash: string
}

export interface DashboardLayoutPref {
  order: string[]
  visibility: Record<string, boolean>
}

export interface UserPreferences {
  pinnedAnalysis?: PinnedAnalysisPref
  dashboardLayout?: DashboardLayoutPref
}

/* ------------------------------------------------------------------ */
/*  Constantes                                                         */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = 'app.user.preferences'
const TABLE_NAME = 'user_preferences'

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

function readLocal(): UserPreferences {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as UserPreferences
  } catch {
    return {}
  }
}

function writeLocal(prefs: UserPreferences): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // localStorage cheio ou indisponível — ignorar
  }
}

/* ------------------------------------------------------------------ */
/*  Supabase helpers                                                   */
/* ------------------------------------------------------------------ */

async function loadFromSupabase(): Promise<UserPreferences | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('preferences')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    if (!data?.preferences) return null

    return data.preferences as unknown as UserPreferences
  } catch (err) {
    logger.warn(TAG, 'Erro ao carregar do Supabase, usando localStorage:', err)
    return null
  }
}

async function saveToSupabase(prefs: UserPreferences): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from(TABLE_NAME)
      .upsert({
        user_id: user.id,
        preferences: prefs,
    }, { onConflict: 'user_id' }) // updated_at é gerenciado pelo trigger no banco

    if (error) throw error
  } catch (err) {
    logger.warn(TAG, 'Erro ao salvar no Supabase:', err)
  }
}

/* ------------------------------------------------------------------ */
/*  API pública                                                        */
/* ------------------------------------------------------------------ */

/**
 * Carrega as preferências do usuário.
 * Estratégia: tenta Supabase primeiro. Se falhar, usa localStorage.
 * Se conseguir do Supabase, sincroniza para localStorage.
 */
export async function loadUserPreferences(): Promise<UserPreferences> {
  try {
    const remote = await loadFromSupabase()
    if (remote && Object.keys(remote).length > 0) {
      writeLocal(remote)
      return remote
    }
  } catch {
    // fallback para localStorage
  }

  return readLocal()
}

/**
 * Salva as preferências do usuário.
 * Salva imediatamente no localStorage e dispara sync para Supabase em background.
 */
export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  writeLocal(prefs)

  // Sync com Supabase em background (não bloqueia)
  saveToSupabase(prefs).catch(() => {
    // Falha silenciosa — localStorage já foi atualizado
  })
}

/**
 * Atualiza apenas valores parciais (merge com o que já existe).
 */
export async function updateUserPreferences(partial: Partial<UserPreferences>): Promise<UserPreferences> {
  const current = readLocal()
  const merged: UserPreferences = { ...current, ...partial }
  await saveUserPreferences(merged)
  return merged
}

/* ------------------------------------------------------------------ */
/*  Helpers específicos                                                */
/* ------------------------------------------------------------------ */

/** Atalho: carrega apenas o pinnedAnalysis */
export async function loadPinnedAnalysis(): Promise<PinnedAnalysisPref | null> {
  const prefs = await loadUserPreferences()
  return prefs.pinnedAnalysis ?? null
}

/** Atalho: salva apenas o pinnedAnalysis */
export async function savePinnedAnalysis(data: PinnedAnalysisPref): Promise<void> {
  const prefs = readLocal()
  prefs.pinnedAnalysis = data
  await saveUserPreferences(prefs)
}

/** Atalho: remove o pinnedAnalysis */
export async function clearPinnedAnalysis(): Promise<void> {
  const prefs = readLocal()
  delete prefs.pinnedAnalysis
  await saveUserPreferences(prefs)
}

/** Atalho: carrega apenas o dashboardLayout (lê de loadUserPreferences para manter consistência) */
export async function loadDashboardLayout(): Promise<DashboardLayoutPref | null> {
  const prefs = await loadUserPreferences()
  return prefs.dashboardLayout ?? null
}

/** Atalho: salva apenas o dashboardLayout (instantâneo, sem Supabase) */
export async function saveDashboardLayout(layout: DashboardLayoutPref): Promise<void> {
  const prefs = readLocal()
  prefs.dashboardLayout = layout
  await saveUserPreferences(prefs)
}
