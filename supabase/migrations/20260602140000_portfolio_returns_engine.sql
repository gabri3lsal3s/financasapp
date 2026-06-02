-- Motor de rentabilidade v2: snapshots diários/mensais, preços históricos, VNA e cache de cotas

-- Cache denormalizado na carteira
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS total_shares DECIMAL(18, 6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_share_value DECIMAL(18, 8) NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_close_date DATE,
  ADD COLUMN IF NOT EXISTS last_gross_pl DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS last_net_pl DECIMAL(15, 2);

-- Modo de valoração (Tesouro na curva vs mercado)
ALTER TABLE public.portfolio_asset_definitions
  ADD COLUMN IF NOT EXISTS valuation_mode VARCHAR(10) NOT NULL DEFAULT 'curve'
    CHECK (valuation_mode IN ('curve', 'market'));

UPDATE public.portfolio_asset_definitions
SET valuation_mode = 'curve'
WHERE is_treasury = TRUE;

-- Transações: liquidação e VNA na compra (Tesouro IPCA+)
ALTER TABLE public.portfolio_transactions
  ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(10) NOT NULL DEFAULT 'settled'
    CHECK (settlement_status IN ('pending', 'settled')),
  ADD COLUMN IF NOT EXISTS vna_at_purchase DECIMAL(15, 6);

COMMENT ON COLUMN public.portfolio_transactions.settlement_status IS 'pending: incluído no fechamento D+0; settled: já consolidado no PL';
COMMENT ON COLUMN public.portfolio_transactions.vna_at_purchase IS 'VNA na data do aporte (Tesouro IPCA+)';

-- Histórico de cota diária por carteira
CREATE TABLE IF NOT EXISTS public.portfolio_share_daily (
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  rate_date DATE NOT NULL,
  share_value DECIMAL(18, 8) NOT NULL,
  gross_pl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  net_pl DECIMAL(15, 2) NOT NULL DEFAULT 0,
  total_shares DECIMAL(18, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, rate_date)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_share_daily_portfolio
  ON public.portfolio_share_daily(portfolio_id);

-- Snapshots mensais e anuais (TWR)
CREATE TABLE IF NOT EXISTS public.portfolio_period_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  period_type VARCHAR(10) NOT NULL CHECK (period_type IN ('month', 'year')),
  period_key VARCHAR(10) NOT NULL,
  cota_abertura DECIMAL(18, 8) NOT NULL,
  cota_fechamento DECIMAL(18, 8) NOT NULL,
  somatorio_aportes DECIMAL(15, 2) NOT NULL DEFAULT 0,
  somatorio_resgates DECIMAL(15, 2) NOT NULL DEFAULT 0,
  dividendos_recebidos DECIMAL(15, 2) NOT NULL DEFAULT 0,
  drawdown_maximo DECIMAL(8, 4) NOT NULL DEFAULT 0,
  period_return DECIMAL(12, 8),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (portfolio_id, period_type, period_key)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_period_snapshots_portfolio
  ON public.portfolio_period_snapshots(portfolio_id);

-- Preços de fechamento diários (mercado)
CREATE TABLE IF NOT EXISTS public.asset_price_daily (
  ticker VARCHAR(50) NOT NULL,
  price_date DATE NOT NULL,
  close_price DECIMAL(15, 4) NOT NULL CHECK (close_price >= 0),
  source VARCHAR(20) NOT NULL DEFAULT 'yahoo',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (ticker, price_date)
);

CREATE INDEX IF NOT EXISTS idx_asset_price_daily_ticker
  ON public.asset_price_daily(ticker);

-- VNA Tesouro IPCA+ (ANBIMA)
CREATE TABLE IF NOT EXISTS public.vna_daily (
  reference_date DATE PRIMARY KEY,
  vna_value DECIMAL(15, 6) NOT NULL CHECK (vna_value > 0),
  source VARCHAR(20) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.portfolio_share_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_period_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_price_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vna_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Portfolio share daily read"
  ON public.portfolio_share_daily FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Portfolio share daily write"
  ON public.portfolio_share_daily FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Portfolio period snapshots read"
  ON public.portfolio_period_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Portfolio period snapshots write"
  ON public.portfolio_period_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id
        AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Authenticated read asset price daily"
  ON public.asset_price_daily FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated upsert asset price daily"
  ON public.asset_price_daily FOR ALL
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated read vna daily"
  ON public.vna_daily FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "Authenticated upsert vna daily"
  ON public.vna_daily FOR ALL
  TO authenticated
  USING (TRUE);
