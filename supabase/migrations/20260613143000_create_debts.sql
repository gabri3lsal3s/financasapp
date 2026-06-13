-- Migration: Criar tabela de dívidas e cobranças
-- Data: 2026-06-13
-- Arquivo: supabase/migrations/20260613143000_create_debts.sql

CREATE TABLE IF NOT EXISTS public.debts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID DEFAULT auth.uid() NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('payable', 'receivable')),
  amount DECIMAL(10, 2) NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  expense_id UUID REFERENCES public.expenses(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para debts
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_debts_user ON public.debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_due_date ON public.debts(due_date);
CREATE INDEX IF NOT EXISTS idx_debts_expense ON public.debts(expense_id);
