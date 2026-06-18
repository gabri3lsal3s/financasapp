-- ==========================================================
-- FIX (2026-06-18): Corrige permissões RPC admin
-- Problemas:
--   1. delete_user_by_admin criada sem GRANT EXECUTE → 404 na chamada RPC
--   2. delete_own_account nunca foi criada → 404 ao excluir conta própria
-- ==========================================================

-- 1. Recria delete_user_by_admin com limpeza completa + GRANT correto
--    (consolida 20260311 + 20260524 para garantir idempotência)
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS void AS $$
DECLARE
  caller_is_admin BOOLEAN;
  target_email    TEXT;
BEGIN
  -- Verifica se o chamador é admin ativo
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

  -- Impede auto-exclusão via esta rota
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use a opção em Segurança para excluir sua própria conta.';
  END IF;

  -- Busca email do alvo
  SELECT email INTO target_email
  FROM public.profiles
  WHERE id = target_user_id;

  IF target_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado.';
  END IF;

  -- Protege o super admin e outros admins
  IF target_email = 'gabrielisaacsales@gmail.com' OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = target_user_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Não é permitido excluir administradores.';
  END IF;

  -- Limpeza de dados financeiros (tabelas que existem no schema)
  DELETE FROM public.expenses WHERE user_id = target_user_id;
  DELETE FROM public.incomes  WHERE user_id = target_user_id;

  DELETE FROM public.expense_category_month_limits
    WHERE user_id = target_user_id;

  DELETE FROM public.income_category_month_expectations
    WHERE user_id = target_user_id;

  -- investments (tabela legada, pode não existir)
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investments'
  ) THEN
    DELETE FROM public.investments WHERE user_id = target_user_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'monthly_insights'
  ) THEN
    DELETE FROM public.monthly_insights WHERE user_id = target_user_id;
  END IF;

  -- Cartões de crédito + ciclos
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

  -- Dívidas
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) THEN
    DELETE FROM public.debts WHERE user_id = target_user_id;
  END IF;

  -- Categorias
  DELETE FROM public.categories        WHERE user_id = target_user_id;
  DELETE FROM public.income_categories WHERE user_id = target_user_id;

  -- Perfil (cascade cuida de portfolios e advisor_portfolio_links)
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- Conta de autenticação
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- Concede permissão de execução ao role authenticated (ESSENCIAL para RPC via REST)
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(UUID) TO authenticated;


-- 2. Cria delete_own_account (permite ao próprio usuário apagar sua conta)
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void AS $$
DECLARE
  caller_id UUID := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma sessão autenticada.';
  END IF;

  -- Impede que admins excluam a própria conta por esta rota
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = caller_id AND is_admin = TRUE
  ) THEN
    RAISE EXCEPTION 'Administradores não podem excluir a própria conta por este caminho.';
  END IF;

  -- Limpeza de dados financeiros
  DELETE FROM public.expenses WHERE user_id = caller_id;
  DELETE FROM public.incomes  WHERE user_id = caller_id;

  DELETE FROM public.expense_category_month_limits
    WHERE user_id = caller_id;

  DELETE FROM public.income_category_month_expectations
    WHERE user_id = caller_id;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'investments'
  ) THEN
    DELETE FROM public.investments WHERE user_id = caller_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'monthly_insights'
  ) THEN
    DELETE FROM public.monthly_insights WHERE user_id = caller_id;
  END IF;

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
          SELECT id FROM public.credit_cards WHERE user_id = caller_id
        );
    END IF;

    DELETE FROM public.credit_cards WHERE user_id = caller_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'debts'
  ) THEN
    DELETE FROM public.debts WHERE user_id = caller_id;
  END IF;

  DELETE FROM public.categories        WHERE user_id = caller_id;
  DELETE FROM public.income_categories WHERE user_id = caller_id;

  DELETE FROM public.profiles WHERE id = caller_id;
  DELETE FROM auth.users      WHERE id = caller_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
