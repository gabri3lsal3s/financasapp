-- Clientes de assessoria: somente leitura em portfólio e entidades relacionadas.
-- Consultores mantêm INSERT/UPDATE/DELETE (incl. carteiras com consultant_id IS NULL).

-- Helper: consultor ativo
-- (inline nas políticas via EXISTS)

-- 1. portfolios
DROP POLICY IF EXISTS "Consultants can manage portfolios they manage" ON public.portfolios;

CREATE POLICY "Consultants can insert portfolios" ON public.portfolios
  FOR INSERT WITH CHECK (
    auth.uid() = consultant_id
    OR (
      consultant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
      )
    )
  );

CREATE POLICY "Consultants can update portfolios" ON public.portfolios
  FOR UPDATE USING (
    auth.uid() = consultant_id
    OR (
      consultant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
      )
    )
  );

CREATE POLICY "Consultants can delete portfolios" ON public.portfolios
  FOR DELETE USING (
    auth.uid() = consultant_id
    OR (
      consultant_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
      )
    )
  );

-- SELECT permanece em "Users can view portfolios related to them"

-- 2. portfolio_transactions
DROP POLICY IF EXISTS "Users and consultants can manage transactions of portfolios they manage" ON public.portfolio_transactions;

CREATE POLICY "Consultants can insert portfolio transactions" ON public.portfolio_transactions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

CREATE POLICY "Consultants can update portfolio transactions" ON public.portfolio_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

CREATE POLICY "Consultants can delete portfolio transactions" ON public.portfolio_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

-- 3. target_allocations
DROP POLICY IF EXISTS "Users and consultants can manage target allocations" ON public.target_allocations;

CREATE POLICY "Consultants can insert target allocations" ON public.target_allocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

CREATE POLICY "Consultants can update target allocations" ON public.target_allocations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

CREATE POLICY "Consultants can delete target allocations" ON public.target_allocations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

-- 4. portfolio_group_targets
DROP POLICY IF EXISTS "Users and consultants can manage portfolio group targets" ON public.portfolio_group_targets;

CREATE POLICY "Consultants can insert portfolio group targets" ON public.portfolio_group_targets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

CREATE POLICY "Consultants can update portfolio group targets" ON public.portfolio_group_targets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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

CREATE POLICY "Consultants can delete portfolio group targets" ON public.portfolio_group_targets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.consultant_id = auth.uid()
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
