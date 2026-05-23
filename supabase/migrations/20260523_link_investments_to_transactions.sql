-- Migração SQL: Vinculação de Aportes Mensais a Ativos e Transações (B3 & Consultoria)
-- Executado em: 2026-05-23

-- Estende a tabela investments com colunas para aporte direto em ativos
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS ticker VARCHAR(12);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS quantity DECIMAL(15, 6);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS price DECIMAL(15, 4);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.portfolio_transactions(id) ON DELETE SET NULL;
