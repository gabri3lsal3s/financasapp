/** Domínio interno para e-mails de clientes provisórios criados pelo consultor. */
export const PROVISIONAL_CLIENT_EMAIL_SUFFIX = '@provisional.internal' as const

/** Legado — clientes criados antes da renomeação do domínio. */
export const LEGACY_PROVISIONAL_CLIENT_EMAIL_SUFFIX = '@cerrado.internal' as const

export function isProvisionalClientEmail(email: string): boolean {
  const normalized = email.trim()
  return (
    normalized.startsWith('temp_') &&
    (normalized.endsWith(PROVISIONAL_CLIENT_EMAIL_SUFFIX) ||
      normalized.endsWith(LEGACY_PROVISIONAL_CLIENT_EMAIL_SUFFIX))
  )
}

export function buildProvisionalClientEmail(cleanName: string, randId: string): string {
  return `temp_${cleanName}_${randId}${PROVISIONAL_CLIENT_EMAIL_SUFFIX}`
}
