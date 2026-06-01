-- Migration: Fix USD currency on existing assets
-- Corrige ativos cadastrados antes da migration de currency que ficaram com DEFAULT 'BRL'
-- mesmo sendo ativos internacionais (tickers de 3-4 letras puras, ex: VOO, AAPL, QQQ).

-- Atualiza para USD ativos cujo ticker:
--   1. Tem apenas letras maiúsculas (3 a 5 caracteres)
--   2. NÃO termina com padrão B3 (ex: PETR4, VALE3 — 4 letras + dígito)
--   3. NÃO é um conhecido ativo BRL (CDI, SELIC, IPCA, etc.)
--   4. Tem currency = 'BRL' atualmente (ou seja, não foi configurado manualmente como USD ainda)
UPDATE public.portfolio_asset_definitions
SET currency = 'USD'
WHERE
  currency = 'BRL'
  AND pricing_mode = 'market'
  AND is_treasury = false
  AND ticker ~ '^[A-Z]{3,5}$'
  AND ticker NOT IN (
    'BTC', 'ETH', 'SOL', 'ADA', 'XRP', 'DOT', 'USDT',
    'CDI', 'SELIC', 'IPCA', 'IGPM', 'IBOV',
    'CAIXA', 'SALDO'
  );
