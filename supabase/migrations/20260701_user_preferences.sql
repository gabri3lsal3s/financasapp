-- Migração: Tabela unificada de preferências do usuário
-- Substitui pinned_ai_analyses para suportar layout do dashboard + insights
-- Criada em: 2026-07-01

-- 1. Migra dados da tabela antiga para a nova (se existirem)
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pinned_ai_analyses') THEN
    INSERT INTO public.user_preferences (user_id, preferences, created_at, updated_at)
    SELECT
      user_id,
      jsonb_build_object('pinnedAnalysis', pinned_analysis),
      created_at,
      updated_at
    FROM public.pinned_ai_analyses
    ON CONFLICT (user_id) DO NOTHING;

    DROP TABLE IF EXISTS public.pinned_ai_analyses;
  END IF;
END;
$$;

-- 2. Cria tabela unificada
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER trg_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_preferences_updated_at();

-- 4. Row Level Security
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_preferences_select"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own_preferences_insert"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_preferences_update"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own_preferences_delete"
  ON public.user_preferences FOR DELETE
  USING (auth.uid() = user_id);
