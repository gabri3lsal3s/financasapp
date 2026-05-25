-- Migração SQL: Correção de RLS para Carteiras Pessoais (Clientes Autônomos)
-- Descrição: Permite que usuários com carteira pessoal (consultant_id IS NULL) possam gerenciar suas próprias transações, definições, metas e portfólios,
-- mantendo a restrição de somente leitura para clientes sob assessoria (consultant_id IS NOT NULL).

-- 1. Tabela portfolios: Permitir atualização pelo próprio dono se for carteira pessoal
DROP POLICY IF EXISTS "Consultants can insert portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Consultants can update portfolios" ON public.portfolios;
DROP POLICY IF EXISTS "Consultants can delete portfolios" ON public.portfolios;

CREATE POLICY "Portfolios manage policy" ON public.portfolios
  FOR ALL USING (
    auth.uid() = consultant_id
    OR (auth.uid() = client_id AND consultant_id IS NULL)
    OR (
      consultant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
      )
    )
  );

-- 2. Tabela portfolio_transactions: Permitir gerenciamento total pelo dono se for carteira pessoal ou pelo consultor se for assessoria
DROP POLICY IF EXISTS "Consultants can insert portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Consultants can update portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Consultants can delete portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Clients can insert portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Clients can update portfolio transactions" ON public.portfolio_transactions;
DROP POLICY IF EXISTS "Clients can delete portfolio transactions" ON public.portfolio_transactions;

CREATE POLICY "Portfolio transactions manage policy" ON public.portfolio_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
          OR (p.client_id = auth.uid() AND p.consultant_id IS NULL)
          OR (
            p.consultant_id IS NULL
            AND EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
            )
          )
        )
    )
  );

-- 3. Tabela portfolio_asset_definitions: Permitir gerenciamento pelo dono se for carteira pessoal ou pelo consultor
DROP POLICY IF EXISTS "Portfolio owners can insert asset definitions" ON public.portfolio_asset_definitions;
DROP POLICY IF EXISTS "Portfolio owners can update asset definitions" ON public.portfolio_asset_definitions;
DROP POLICY IF EXISTS "Portfolio owners can delete asset definitions" ON public.portfolio_asset_definitions;

CREATE POLICY "Portfolio asset definitions manage policy" ON public.portfolio_asset_definitions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
          OR (p.client_id = auth.uid() AND p.consultant_id IS NULL)
          OR (
            p.consultant_id IS NULL
            AND EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
            )
          )
        )
    )
  );

-- 4. Tabela target_allocations: Permitir gerenciamento pelo dono se for carteira pessoal ou pelo consultor
DROP POLICY IF EXISTS "Consultants can insert target allocations" ON public.target_allocations;
DROP POLICY IF EXISTS "Consultants can update target allocations" ON public.target_allocations;
DROP POLICY IF EXISTS "Consultants can delete target allocations" ON public.target_allocations;

CREATE POLICY "Target allocations manage policy" ON public.target_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
          OR (p.client_id = auth.uid() AND p.consultant_id IS NULL)
          OR (
            p.consultant_id IS NULL
            AND EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
            )
          )
        )
    )
  );

-- 5. Tabela portfolio_group_targets: Permitir gerenciamento pelo dono se for carteira pessoal ou pelo consultor
DROP POLICY IF EXISTS "Consultants can insert portfolio group targets" ON public.portfolio_group_targets;
DROP POLICY IF EXISTS "Consultants can update portfolio group targets" ON public.portfolio_group_targets;
DROP POLICY IF EXISTS "Consultants can delete portfolio group targets" ON public.portfolio_group_targets;

CREATE POLICY "Portfolio group targets manage policy" ON public.portfolio_group_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
          OR (p.client_id = auth.uid() AND p.consultant_id IS NULL)
          OR (
            p.consultant_id IS NULL
            AND EXISTS (
              SELECT 1 FROM public.profiles
              WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
            )
          )
        )
    )
  );
