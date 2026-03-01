-- MIGRAÇÃO SEGURA: Parcelamento de despesas
-- Pode ser executada múltiplas vezes sem quebrar.
-- Foco: adicionar somente o necessário para parcelamento em expenses.

BEGIN;

-- 1) Colunas de parcelamento
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS installment_group_id UUID;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS installment_number INTEGER;

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS installment_total INTEGER;

-- 2) Constraints (criadas apenas se ainda não existirem)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_installment_number_check'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_installment_number_check
      CHECK (installment_number IS NULL OR installment_number >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_installment_total_check'
      AND conrelid = 'public.expenses'::regclass
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_installment_total_check
      CHECK (installment_total IS NULL OR installment_total >= 1);
  END IF;
END $$;

-- 3) Índice para consultas por grupo de parcelamento
CREATE INDEX IF NOT EXISTS idx_expenses_installment_group
  ON public.expenses (installment_group_id);

COMMIT;
