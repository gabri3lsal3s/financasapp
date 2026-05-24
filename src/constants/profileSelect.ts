/** Colunas explícitas de profiles para Auth e listagens (regra 11). */
export const PROFILE_SELECT_COLUMNS =
  'id, email, full_name, is_approved, is_blocked, is_rejected, rejection_count, is_admin, role, created_at, updated_at' as const
