-- Adiciona modo de precificação "cash" (Saldo em caixa, sem rentabilidade)

ALTER TABLE public.portfolio_asset_definitions
  DROP CONSTRAINT IF EXISTS portfolio_asset_definitions_pricing_mode_check;

ALTER TABLE public.portfolio_asset_definitions
  ADD CONSTRAINT portfolio_asset_definitions_pricing_mode_check
  CHECK (pricing_mode IN ('market', 'fixed_income', 'manual_value', 'cash'));
