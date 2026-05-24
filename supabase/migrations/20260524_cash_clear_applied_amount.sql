-- Saldo em caixa: valor vem do livro-razão, não de applied_amount estático

UPDATE public.portfolio_asset_definitions
SET applied_amount = NULL
WHERE pricing_mode = 'cash' AND applied_amount IS NOT NULL;
