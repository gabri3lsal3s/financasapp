-- Migration: Add currency column to portfolio_asset_definitions
-- Habilita suporte multi-moeda no módulo de investimentos do financasapp.

ALTER TABLE public.portfolio_asset_definitions
ADD COLUMN IF NOT EXISTS currency VARCHAR(3) NOT NULL DEFAULT 'BRL'
CHECK (currency IN ('BRL', 'USD'));
