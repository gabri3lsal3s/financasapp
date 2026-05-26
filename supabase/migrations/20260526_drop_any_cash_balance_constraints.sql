-- Migração SQL: Remover qualquer constraint de saldo de caixa positivo de forma robusta e dinâmica
-- Descrição: Busca no catálogo do PostgreSQL qualquer CHECK constraint associado à coluna 'cash_balance' na tabela 'portfolios' e a remove.
-- Executado em: 2026-05-26

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Busca restrições do tipo CHECK (contype = 'c') na tabela portfolios que mencionam cash_balance ou cash
    FOR r IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.portfolios'::regclass 
          AND contype = 'c' 
          AND (conname LIKE '%cash_balance%' OR conname LIKE '%portfolios%cash%')
    LOOP
        EXECUTE 'ALTER TABLE public.portfolios DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE;';
        RAISE NOTICE 'Constraint removida dinamicamente: %', r.conname;
    END LOOP;
END;
$$;
