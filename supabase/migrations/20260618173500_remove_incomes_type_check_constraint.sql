-- Migração SQL: Remover qualquer constraint CHECK do campo 'type' na tabela 'incomes'
-- Descrição: Remove restrições que impeçam a inserção dos novos métodos de renda (PIX, Dinheiro, etc.)
-- Criado em: 2026-06-18

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Busca restrições do tipo CHECK (contype = 'c') na tabela incomes que mencionam a palavra 'type'
    FOR r IN 
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint 
        WHERE conrelid = 'public.incomes'::regclass 
          AND contype = 'c'
    LOOP
        IF r.def LIKE '%type%' THEN
            EXECUTE 'ALTER TABLE public.incomes DROP CONSTRAINT IF EXISTS ' || quote_ident(r.conname) || ' CASCADE;';
            RAISE NOTICE 'Constraint de type removida: %', r.conname;
        END IF;
    END LOOP;
END;
$$;
