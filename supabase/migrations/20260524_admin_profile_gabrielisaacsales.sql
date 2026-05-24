-- Garante perfil completo do administrador principal (consultoria + aprovação de usuários).
-- E-mail canônico: gabrielisaacsales@gmail.com (ver src/constants/adminProfile.ts)

UPDATE public.profiles
SET
  is_admin = TRUE,
  is_approved = TRUE,
  is_blocked = FALSE,
  is_rejected = FALSE,
  rejection_count = 0,
  role = 'consultant',
  updated_at = NOW()
WHERE email = 'gabrielisaacsales@gmail.com';
