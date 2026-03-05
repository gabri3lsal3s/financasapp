-- =====================================================
-- MIGRATION_CREDIT_CARD_MONTHLY_CYCLES.sql
-- Funcionalidade: Ciclo mensal por cartão (fechamento/vencimento por competência)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.credit_card_monthly_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  competence TEXT NOT NULL CHECK (competence ~ '^\d{4}-\d{2}$'),
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID,
  CONSTRAINT credit_card_monthly_cycles_unique UNIQUE (credit_card_id, competence)
);

CREATE INDEX IF NOT EXISTS idx_credit_card_monthly_cycles_card_id
  ON public.credit_card_monthly_cycles(credit_card_id);

CREATE INDEX IF NOT EXISTS idx_credit_card_monthly_cycles_competence
  ON public.credit_card_monthly_cycles(competence);

CREATE INDEX IF NOT EXISTS idx_credit_card_monthly_cycles_card_competence
  ON public.credit_card_monthly_cycles(credit_card_id, competence);
