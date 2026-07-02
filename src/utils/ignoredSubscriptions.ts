/**
 * Gerencia o estado de assinaturas/gastos recorrentes ignorados pelo usuário.
 * Persiste em localStorage para que a escolha seja mantida entre sessões.
 * Segue o mesmo padrão de creditCardCsvLearning.ts.
 */

const STORAGE_KEY = 'dashboard-ignored-subscriptions-v1'

export interface IgnoredSubscription {
  /** Descrição normalizada que identifica unicamente a despesa */
  key: string
  /** Nome amigável para exibir na seção de ignorados */
  displayName: string
  /** Timestamp ISO de quando foi ignorado */
  ignoredAt: string
}

const readIgnored = (): IgnoredSubscription[] => {
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

const writeIgnored = (items: IgnoredSubscription[]) => {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

/**
 * Normaliza uma descrição para usar como chave única de identificação.
 */
export function normalizeKey(description: string): string {
  return description
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Verifica se uma assinatura/despesa foi ignorada pelo usuário.
 */
export function isSubscriptionIgnored(description: string): boolean {
  const key = normalizeKey(description)
  if (!key) return false
  const ignored = readIgnored()
  return ignored.some((item) => item.key === key)
}

/**
 * Adiciona uma assinatura/despesa à lista de ignoradas.
 * Retorna true se foi adicionada, false se já existia.
 */
export function ignoreSubscription(description: string): boolean {
  const key = normalizeKey(description)
  if (!key) return false

  const ignored = readIgnored()
  if (ignored.some((item) => item.key === key)) return false

  ignored.push({
    key,
    displayName: description,
    ignoredAt: new Date().toISOString(),
  })

  writeIgnored(ignored)
  return true
}

/**
 * Remove uma assinatura/despesa da lista de ignoradas (restaura).
 */
export function restoreSubscription(description: string): void {
  const key = normalizeKey(description)
  if (!key) return

  const ignored = readIgnored().filter((item) => item.key !== key)
  writeIgnored(ignored)
}

/**
 * Retorna a lista de assinaturas ignoradas para exibição na seção recolhida.
 */
export function getIgnoredSubscriptions(): IgnoredSubscription[] {
  return readIgnored()
}

/**
 * Remove todas as assinaturas ignoradas.
 */
export function clearAllIgnored(): void {
  writeIgnored([])
}
