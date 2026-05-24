-- Adiciona a coluna billing_fee_rate na tabela portfolios para salvar a taxa de fee anual da assessoria
ALTER TABLE public.portfolios
  ADD COLUMN IF NOT EXISTS billing_fee_rate DECIMAL(10, 4) DEFAULT 0.1000 CHECK (billing_fee_rate >= 0 AND billing_fee_rate <= 100);
