-- Migration: Aumentar precisão de colunas DECIMAL para evitar overflow no motor de rentabilidade
-- Erro: "numeric field overflow - A field with precision 15, scale 2 must round to an absolute value less than 10^13"
-- Data: 2026-06-29

-- ─── portfolio_share_daily ─────────────────────────────────────────────────
ALTER TABLE public.portfolio_share_daily
  ALTER COLUMN gross_pl TYPE DECIMAL(18, 2),
  ALTER COLUMN net_pl TYPE DECIMAL(18, 2),
  ALTER COLUMN cash_value TYPE DECIMAL(18, 2),
  ALTER COLUMN invested_cost TYPE DECIMAL(18, 2);

-- ─── portfolios ────────────────────────────────────────────────────────────
ALTER TABLE public.portfolios
  ALTER COLUMN cash_balance TYPE DECIMAL(18, 2),
  ALTER COLUMN last_gross_pl TYPE DECIMAL(18, 2),
  ALTER COLUMN last_net_pl TYPE DECIMAL(18, 2);

-- Nota: cash_balance mantém CHECK (cash_balance >= 0) pois o tipo só aumenta.

-- ─── portfolio_period_snapshots ────────────────────────────────────────────
ALTER TABLE public.portfolio_period_snapshots
  ALTER COLUMN somatorio_aportes TYPE DECIMAL(18, 2),
  ALTER COLUMN somatorio_resgates TYPE DECIMAL(18, 2),
  ALTER COLUMN dividendos_recebidos TYPE DECIMAL(18, 2);

-- ─── portfolio_asset_definitions ────────────────────────────────────────────
ALTER TABLE public.portfolio_asset_definitions
  ALTER COLUMN applied_amount TYPE DECIMAL(18, 2),
  ALTER COLUMN manual_current_value TYPE DECIMAL(18, 2);
