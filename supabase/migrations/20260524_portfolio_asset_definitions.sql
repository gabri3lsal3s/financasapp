-- Definições de ativos por carteira (modo de precificação, RF, manual, B3)
-- + cache de indexadores BCB + RLS para cliente e consultor

CREATE TABLE IF NOT EXISTS public.portfolio_asset_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker VARCHAR(12) NOT NULL,
  pricing_mode VARCHAR(20) NOT NULL DEFAULT 'market'
    CHECK (pricing_mode IN ('market', 'fixed_income', 'manual_value')),
  is_b3_linked BOOLEAN NOT NULL DEFAULT FALSE,
  applied_amount DECIMAL(15, 2),
  contract_rate DECIMAL(8, 4),
  indexer VARCHAR(10) NOT NULL DEFAULT 'none'
    CHECK (indexer IN ('none', 'cdi', 'selic', 'ipca')),
  indexer_percent DECIMAL(8, 4) NOT NULL DEFAULT 100,
  maturity_date DATE,
  manual_current_value DECIMAL(15, 2),
  manual_value_updated_at TIMESTAMPTZ,
  tax_exempt BOOLEAN NOT NULL DEFAULT FALSE,
  is_treasury BOOLEAN NOT NULL DEFAULT FALSE,
  application_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, ticker)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_asset_definitions_portfolio
  ON public.portfolio_asset_definitions(portfolio_id);

CREATE TABLE IF NOT EXISTS public.index_rates (
  rate_date DATE NOT NULL,
  indexer VARCHAR(10) NOT NULL CHECK (indexer IN ('cdi', 'selic', 'ipca')),
  daily_rate DECIMAL(12, 8) NOT NULL,
  PRIMARY KEY (rate_date, indexer)
);

ALTER TABLE public.portfolio_asset_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.index_rates ENABLE ROW LEVEL SECURITY;

-- SELECT definições: cliente ou consultor da carteira
CREATE POLICY "Users can view portfolio asset definitions"
  ON public.portfolio_asset_definitions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

-- INSERT/UPDATE/DELETE: cliente dono ou consultor da carteira
CREATE POLICY "Portfolio owners can insert asset definitions"
  ON public.portfolio_asset_definitions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.client_id = auth.uid()
          OR p.consultant_id = auth.uid()
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

CREATE POLICY "Portfolio owners can update asset definitions"
  ON public.portfolio_asset_definitions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.client_id = auth.uid()
          OR p.consultant_id = auth.uid()
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

CREATE POLICY "Portfolio owners can delete asset definitions"
  ON public.portfolio_asset_definitions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (
          p.client_id = auth.uid()
          OR p.consultant_id = auth.uid()
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

-- Index rates: leitura autenticada; escrita aberta (cache compartilhado, sem PII)
CREATE POLICY "Authenticated can read index rates"
  ON public.index_rates FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated can upsert index rates"
  ON public.index_rates FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "Authenticated can update index rates"
  ON public.index_rates FOR UPDATE
  TO authenticated
  USING (TRUE);

-- Clientes podem cadastrar transações na própria carteira
CREATE POLICY "Clients can insert portfolio transactions"
  ON public.portfolio_transactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can update portfolio transactions"
  ON public.portfolio_transactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.client_id = auth.uid()
    )
  );

CREATE POLICY "Clients can delete portfolio transactions"
  ON public.portfolio_transactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.client_id = auth.uid()
    )
  );
