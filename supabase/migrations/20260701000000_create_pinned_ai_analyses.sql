-- Migração SQL: Tabela de Análise de IA Fixada
-- Criada em: 2026-07-01

CREATE TABLE IF NOT EXISTS public.pinned_ai_analyses (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  pinned_analysis JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.pinned_ai_analyses ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
CREATE POLICY "Users can select their own pinned analysis"
  ON public.pinned_ai_analyses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pinned analysis"
  ON public.pinned_ai_analyses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pinned analysis"
  ON public.pinned_ai_analyses FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pinned analysis"
  ON public.pinned_ai_analyses FOR DELETE
  USING (auth.uid() = user_id);
