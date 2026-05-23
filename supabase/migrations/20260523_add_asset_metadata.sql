-- Adiciona colunas para armazenamento de Classe de Ativo e Setor no cache de ativos
ALTER TABLE public.asset_prices ADD COLUMN IF NOT EXISTS asset_class TEXT;
ALTER TABLE public.asset_prices ADD COLUMN IF NOT EXISTS sector TEXT;
