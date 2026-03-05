-- =====================================================
-- MIGRATION_RENAME_EXTORNO_TO_ESTORNO.sql
-- Objetivo: padronizar categoria de renda "Extorno" -> "Estorno"
-- Segurança: idempotente + merge de referências quando ambas existirem
-- =====================================================

BEGIN;

-- 1) Renomear diretamente "Extorno" para "Estorno" quando ainda não existe
--    categoria "Estorno" para o mesmo user_id.
UPDATE public.income_categories AS src
SET name = 'Estorno'
WHERE lower(btrim(src.name)) = 'extorno'
  AND NOT EXISTS (
    SELECT 1
    FROM public.income_categories AS tgt
    WHERE tgt.user_id IS NOT DISTINCT FROM src.user_id
      AND lower(btrim(tgt.name)) = 'estorno'
  );

-- 2) Se coexistirem "Extorno" e "Estorno" para o mesmo user_id,
--    mover todas as referências de "Extorno" para um "Estorno" canônico.
WITH canonical_estorno AS (
  SELECT id, user_id
  FROM (
    SELECT
      id,
      user_id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS row_num
    FROM public.income_categories
    WHERE lower(btrim(name)) = 'estorno'
  ) ranked
  WHERE row_num = 1
), mapping AS (
  SELECT src.id AS source_category_id, can.id AS target_category_id
  FROM public.income_categories AS src
  JOIN canonical_estorno AS can
    ON can.user_id IS NOT DISTINCT FROM src.user_id
  WHERE lower(btrim(src.name)) = 'extorno'
)
UPDATE public.incomes AS inc
SET income_category_id = mp.target_category_id
FROM mapping AS mp
WHERE inc.income_category_id = mp.source_category_id;

-- 3) Resolver conflitos de UNIQUE (income_category_id, month) antes de mover expectativas.
WITH canonical_estorno AS (
  SELECT id, user_id
  FROM (
    SELECT
      id,
      user_id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS row_num
    FROM public.income_categories
    WHERE lower(btrim(name)) = 'estorno'
  ) ranked
  WHERE row_num = 1
), mapping AS (
  SELECT src.id AS source_category_id, can.id AS target_category_id
  FROM public.income_categories AS src
  JOIN canonical_estorno AS can
    ON can.user_id IS NOT DISTINCT FROM src.user_id
  WHERE lower(btrim(src.name)) = 'extorno'
)
DELETE FROM public.income_category_month_expectations AS src_exp
USING mapping AS mp,
      public.income_category_month_expectations AS tgt_exp
WHERE src_exp.income_category_id = mp.source_category_id
  AND tgt_exp.income_category_id = mp.target_category_id
  AND tgt_exp.month = src_exp.month;

-- 4) Mover expectativas restantes para a categoria canônica.
WITH canonical_estorno AS (
  SELECT id, user_id
  FROM (
    SELECT
      id,
      user_id,
      ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS row_num
    FROM public.income_categories
    WHERE lower(btrim(name)) = 'estorno'
  ) ranked
  WHERE row_num = 1
), mapping AS (
  SELECT src.id AS source_category_id, can.id AS target_category_id
  FROM public.income_categories AS src
  JOIN canonical_estorno AS can
    ON can.user_id IS NOT DISTINCT FROM src.user_id
  WHERE lower(btrim(src.name)) = 'extorno'
)
UPDATE public.income_category_month_expectations AS exp
SET income_category_id = mp.target_category_id
FROM mapping AS mp
WHERE exp.income_category_id = mp.source_category_id;

-- 5) Atualizar mapeamentos do assistente (quando a tabela existir).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'assistant_category_mappings'
  ) THEN
    WITH canonical_estorno AS (
      SELECT id, user_id
      FROM (
        SELECT
          id,
          user_id,
          ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at, id) AS row_num
        FROM public.income_categories
        WHERE lower(btrim(name)) = 'estorno'
      ) ranked
      WHERE row_num = 1
    ), mapping AS (
      SELECT src.id AS source_category_id, can.id AS target_category_id
      FROM public.income_categories AS src
      JOIN canonical_estorno AS can
        ON can.user_id IS NOT DISTINCT FROM src.user_id
      WHERE lower(btrim(src.name)) = 'extorno'
    )
    UPDATE public.assistant_category_mappings AS acm
    SET income_category_id = mp.target_category_id
    FROM mapping AS mp
    WHERE acm.income_category_id = mp.source_category_id;
  END IF;
END $$;

-- 6) Remover categorias legadas "Extorno" já sem referência.
DELETE FROM public.income_categories
WHERE lower(btrim(name)) = 'extorno';

-- 7) Normalizar caixa para o padrão visual final.
UPDATE public.income_categories
SET name = 'Estorno'
WHERE lower(btrim(name)) = 'estorno'
  AND name <> 'Estorno';

COMMIT;
