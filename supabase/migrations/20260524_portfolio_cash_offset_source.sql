-- Vincula vendas automáticas de caixa à compra/subscrição que as originou.
ALTER TABLE public.portfolio_transactions
  ADD COLUMN IF NOT EXISTS cash_offset_source_id UUID
  REFERENCES public.portfolio_transactions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_cash_offset_source
  ON public.portfolio_transactions(cash_offset_source_id)
  WHERE cash_offset_source_id IS NOT NULL;
