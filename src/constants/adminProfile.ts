/** E-mail do administrador principal (aprovação de cadastros + painel /consulting). */
export const ADMIN_EMAIL = 'gabrielisaacsales@gmail.com' as const

/** Nome exibido na consultoria quando o perfil não tem full_name gravado. */
export const PRIMARY_ADMIN_DISPLAY_NAME = 'Gabriel Sales' as const

export function isPrimaryAdminEmail(email: string): boolean {
  return email.toLowerCase() === ADMIN_EMAIL
}

export function isPrimaryAdminProfile(profile: { email: string; is_admin?: boolean }): boolean {
  return profile.is_admin === true || isPrimaryAdminEmail(profile.email)
}

/** Campos mínimos exigidos no perfil do administrador principal. */
export const PRIMARY_ADMIN_PROFILE_PATCH = {
  role: 'consultant' as const,
  is_admin: true,
  is_approved: true,
}
