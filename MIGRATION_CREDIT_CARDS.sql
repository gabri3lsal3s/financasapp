-- =====================================================
-- MIGRATION_CREDIT_CARDS.sql
-- Funcionalidade: Cartões de crédito + Faturas
-- =====================================================

CREATE TABLE IF NOT EXISTS public.credit_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  limit_total DECIMAL(12, 2) CHECK (limit_total IS NULL OR limit_total >= 0),
  closing_day INTEGER NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
  due_day INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  color TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID
);

CREATE TABLE IF NOT EXISTS public.credit_card_bill_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  credit_card_id UUID NOT NULL REFERENCES public.credit_cards(id) ON DELETE CASCADE,
  bill_competence TEXT NOT NULL CHECK (bill_competence ~ '^\d{4}-\d{2}$'),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  user_id UUID
);

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bill_competence TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_payment_method_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('cash', 'debit', 'credit_card', 'pix', 'transfer', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_bill_competence_check'
  ) THEN
    ALTER TABLE public.expenses
      ADD CONSTRAINT expenses_bill_competence_check
      CHECK (bill_competence IS NULL OR bill_competence ~ '^\d{4}-\d{2}$');
  END IF;
END $$;

UPDATE public.expenses
SET payment_method = 'other'
WHERE payment_method IS NULL;

CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_active ON public.credit_cards(is_active);
CREATE INDEX IF NOT EXISTS idx_credit_card_bill_payments_card_competence ON public.credit_card_bill_payments(credit_card_id, bill_competence);
CREATE INDEX IF NOT EXISTS idx_expenses_credit_card_id ON public.expenses(credit_card_id);
CREATE INDEX IF NOT EXISTS idx_expenses_bill_competence ON public.expenses(bill_competence);
CREATE INDEX IF NOT EXISTS idx_expenses_card_bill_competence ON public.expenses(credit_card_id, bill_competence);
