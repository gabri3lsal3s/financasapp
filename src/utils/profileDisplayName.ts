import { isPrimaryAdminEmail, PRIMARY_ADMIN_DISPLAY_NAME } from '@/constants/adminProfile'
import { isProvisionalClientEmail } from '@/constants/provisionalClient'

export type ProfileNameInput = {
  email: string
  full_name?: string | null
  id?: string
}

function parseTempClientName(email: string): string | null {
  if (!isProvisionalClientEmail(email)) return null
  const parts = email.replace('temp_', '').split('@')[0].split('_')
  parts.pop()
  if (parts.length === 0) return null
  return `${parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(' ')} (Provisório)`
}

/** Nome principal para UI (dropdown, lista, PDF). Sem nome cadastrado → e-mail. */
export function resolveProfileDisplayName(profile: ProfileNameInput): string {
  const email = profile.email?.trim() ?? ''
  if (!email) return 'Sem nome'

  if (isPrimaryAdminEmail(email)) return PRIMARY_ADMIN_DISPLAY_NAME

  const registered = profile.full_name?.trim()
  if (registered) return registered

  const tempName = parseTempClientName(email)
  if (tempName) return tempName

  return email
}

export function profileSelectSublabel(
  profile: ProfileNameInput,
  _options?: { selfUserId?: string }
): string {
  return profile.email?.trim() ?? ''
}
