-- Exclusão de usuários pelo super admin (auth + dados financeiros pessoais).
-- E-mail canônico: gabrielisaacsales@gmail.com (ver src/constants/adminProfile.ts)

CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void AS $$
DECLARE
  caller_is_admin BOOLEAN;
  target_email TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND is_blocked = FALSE
      AND (
        is_admin = TRUE
        OR email = 'gabrielisaacsales@gmail.com'
      )
  ) INTO caller_is_admin;

  IF NOT caller_is_admin THEN
    RAISE EXCEPTION 'Apenas administradores ativos podem excluir usuários.';
  END IF;

  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use a opção em Segurança para excluir sua própria conta.';
  END IF;

  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  IF target_email = 'gabrielisaacsales@gmail.com' OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_user_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir administradores.';
  END IF;

  DELETE FROM public.expenses WHERE user_id = target_user_id;
  DELETE FROM public.incomes WHERE user_id = target_user_id;
  DELETE FROM public.expense_category_month_limits WHERE user_id = target_user_id;
  DELETE FROM public.income_category_month_expectations WHERE user_id = target_user_id;
  DELETE FROM public.investments WHERE user_id = target_user_id;
  DELETE FROM public.monthly_insights WHERE user_id = target_user_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'credit_cards'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'credit_card_monthly_cycles'
    ) THEN
      DELETE FROM public.credit_card_monthly_cycles
      WHERE credit_card_id IN (
        SELECT id FROM public.credit_cards WHERE user_id = target_user_id
      );
    END IF;

    DELETE FROM public.credit_cards WHERE user_id = target_user_id;
  END IF;

  DELETE FROM public.categories WHERE user_id = target_user_id;
  DELETE FROM public.income_categories WHERE user_id = target_user_id;

  -- Perfil (cascata: portfolios, asset_theses como consultor, etc.)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Conta de autenticação (pode não existir em clientes provisórios)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated;
