-- Migração: Adicionar colunas de valoração de caixa e custo investido histórico
-- Data: 2026-06-22

ALTER TABLE public.portfolio_share_daily
  ADD COLUMN IF NOT EXISTS cash_value DECIMAL(15, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invested_cost DECIMAL(15, 2) NOT NULL DEFAULT 0;
