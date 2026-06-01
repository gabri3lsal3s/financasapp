-- Migration: Increase ticker columns length in all tables
-- Permite tickers mais longos como nomes de Tesouro Direto ou CDBs sem estourar limites no Supabase.

ALTER TABLE public.portfolio_transactions ALTER COLUMN ticker TYPE VARCHAR(50);
ALTER TABLE public.portfolio_asset_definitions ALTER COLUMN ticker TYPE VARCHAR(50);
ALTER TABLE public.target_allocations ALTER COLUMN ticker TYPE VARCHAR(50);
ALTER TABLE public.asset_theses ALTER COLUMN ticker TYPE VARCHAR(50);
ALTER TABLE public.asset_prices ALTER COLUMN ticker TYPE VARCHAR(50);
