-- Migração SQL: Tabela de Feedback do Usuário para Despesas Recorrentes
-- Criada em: 2026-07-10
-- Armazena o feedback do usuário sobre ocorrências de despesas recorrentes:
-- quais ele confirmou como recorrência e quais ele descartou (falso positivo).

CREATE TABLE IF NOT EXISTS public.recurring_expense_feedback (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  feedback JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.recurring_expense_feedback ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Users can select their own feedback"
  ON public.recurring_expense_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own feedback"
  ON public.recurring_expense_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own feedback"
  ON public.recurring_expense_feedback FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own feedback"
  ON public.recurring_expense_feedback FOR DELETE
  USING (auth.uid() = user_id);
