-- Migração SQL: Atualização de RLS para permitir que clientes gerenciem suas próprias carteiras pessoais
-- Executado em: 2026-05-23

-- 1. Atualização para portfolio_group_targets
DROP POLICY IF EXISTS "Consultants can manage portfolio group targets" ON public.portfolio_group_targets;
CREATE POLICY "Users and consultants can manage portfolio group targets" ON public.portfolio_group_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.consultant_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

-- 2. Atualização para target_allocations
DROP POLICY IF EXISTS "Consultants can manage target allocations" ON public.target_allocations;
CREATE POLICY "Users and consultants can manage target allocations" ON public.target_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.consultant_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

-- 3. Atualização para portfolio_transactions
DROP POLICY IF EXISTS "Consultants can manage transactions of portfolios they manage" ON public.portfolio_transactions;
CREATE POLICY "Users and consultants can manage transactions of portfolios they manage" ON public.portfolio_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.consultant_id = auth.uid() OR p.client_id = auth.uid())
    )
  );
