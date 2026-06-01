-- Estende operation_type para JCP e Rendimento (FII)
ALTER TABLE public.portfolio_transactions
  DROP CONSTRAINT IF EXISTS portfolio_transactions_operation_type_check;

ALTER TABLE public.portfolio_transactions
  ADD CONSTRAINT portfolio_transactions_operation_type_check
  CHECK (operation_type IN (
    'buy', 'sell', 'dividend', 'jcp', 'fii_yield',
    'split', 'subscription'
  ));
