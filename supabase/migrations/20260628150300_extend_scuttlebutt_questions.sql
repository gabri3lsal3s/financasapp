-- Migração SQL: Estender perguntas qualitativas com portfólio específico
-- Criada em: 2026-06-28

ALTER TABLE public.scuttlebutt_questions 
  ADD COLUMN IF NOT EXISTS portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE;

-- Atualizar RLS
DROP POLICY IF EXISTS "Anyone authenticated can view questions of readable pillars" ON public.scuttlebutt_questions;
DROP POLICY IF EXISTS "Users can manage questions of own pillars" ON public.scuttlebutt_questions;

CREATE POLICY "Anyone authenticated can view questions of readable pillars"
  ON public.scuttlebutt_questions FOR SELECT
  USING (
    (portfolio_id IS NULL OR EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    ))
    AND EXISTS (
      SELECT 1 FROM public.scuttlebutt_pillars pil
      WHERE pil.id = pillar_id AND (
        pil.portfolio_id IS NULL OR
        EXISTS (
          SELECT 1 FROM public.portfolios p
          WHERE p.id = pil.portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
        )
      )
    )
  );

CREATE POLICY "Users can manage questions of own portfolio"
  ON public.scuttlebutt_questions FOR ALL
  USING (
    portfolio_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );
