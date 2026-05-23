-- Remove a coluna risk_profile da tabela portfolios
ALTER TABLE public.portfolios DROP COLUMN IF EXISTS risk_profile;
