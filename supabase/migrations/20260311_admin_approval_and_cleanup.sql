-- ==========================================================
-- SCRIPT DE MIGRAÇÃO E MANUTENÇÃO (2026-03-11)
-- ==========================================================
-- Este script configura o sistema de aprovação e bloqueio.
-- As seções 8, 9 e 10 são para manutenção/testes e podem ser 
-- removidas após a configuração inicial.

-- 1. Create Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  is_approved BOOLEAN DEFAULT FALSE,
  is_blocked BOOLEAN DEFAULT FALSE,
  is_rejected BOOLEAN DEFAULT FALSE,
  rejection_count INTEGER DEFAULT 0,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure columns exist (for cases where table already existed)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_rejected BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;

-- 2. Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Profiles Policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users can insert their own profile." ON public.profiles;
CREATE POLICY "Users can insert their own profile." ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile." ON public.profiles
  FOR UPDATE USING (auth.uid() = id AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_blocked = TRUE
  ));

DROP POLICY IF EXISTS "Admins can update all profiles." ON public.profiles;
CREATE POLICY "Admins can update all profiles." ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE AND is_blocked = FALSE
    )
  );


-- 4. Function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, is_approved, is_admin, is_blocked, is_rejected, rejection_count)
  VALUES (
    new.id, 
    new.email, 
    (CASE WHEN new.email = 'gabrielisaacsales@gmail.com' THEN TRUE ELSE FALSE END),
    (CASE WHEN new.email = 'gabrielisaacsales@gmail.com' THEN TRUE ELSE FALSE END),
    FALSE,
    FALSE,
    0
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. RPC Function for Admin to delete users
-- This allows deleting a user from auth.users, which cascades to public.profiles
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if the caller is an admin and not blocked
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND is_admin = TRUE AND is_blocked = FALSE
  ) THEN
    RAISE EXCEPTION 'Apenas administradores ativos podem excluir usuários.';
  END IF;

  -- Prevent deleting admins for safety
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_user_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir outros administradores.';
  END IF;

  -- Delete from auth.users (requires security definer and bypasses RLS)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Ensure existing users (including admin) have a profile record
INSERT INTO public.profiles (id, email, is_approved, is_admin, is_blocked, is_rejected, rejection_count)
SELECT 
  id, 
  email, 
  (CASE WHEN email = 'gabrielisaacsales@gmail.com' THEN TRUE ELSE FALSE END),
  (CASE WHEN email = 'gabrielisaacsales@gmail.com' THEN TRUE ELSE FALSE END),
  FALSE,
  FALSE,
  0
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
  is_admin = EXCLUDED.is_admin,
  is_approved = EXCLUDED.is_approved,
  is_rejected = COALESCE(profiles.is_rejected, EXCLUDED.is_rejected),
  rejection_count = COALESCE(profiles.rejection_count, EXCLUDED.rejection_count),
  updated_at = NOW();



-- ==========================================================
-- MANUTENÇÃO E LIMPEZA (OPCIONAL)
-- ==========================================================

-- 8. RESET DE USUÁRIOS: Limpa o status de todos os usuários de teste
UPDATE public.profiles 
SET 
  is_approved = FALSE, 
  is_blocked = FALSE, 
  is_rejected = FALSE, 
  rejection_count = 0
WHERE email != 'gabrielisaacsales@gmail.com';

-- 9. CONFIRMAÇÃO AUTOMÁTICA: Evita erro de Rate Limit do Supabase
UPDATE auth.users 
SET email_confirmed_at = NOW() 
WHERE email_confirmed_at IS NULL;

-- 10. CLEANUP DE DADOS: Remove lançamentos anteriores a 2026
DELETE FROM public.expenses WHERE date < '2026-01-01';
DELETE FROM public.incomes WHERE date < '2026-01-01';
DELETE FROM public.investments WHERE month < '2026-01';
DELETE FROM public.monthly_insights WHERE month < '2026-01';
DELETE FROM public.expense_category_month_limits WHERE month < '2026-01';
DELETE FROM public.income_category_month_expectations WHERE month < '2026-01';



