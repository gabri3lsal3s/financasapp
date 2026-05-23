-- Criação da tabela de limites/metas por classe e setor para portfolios
CREATE TABLE IF NOT EXISTS public.portfolio_group_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  group_type VARCHAR(15) NOT NULL CHECK (group_type IN ('class', 'sector')),
  group_name TEXT NOT NULL,
  target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_portfolio_group UNIQUE (portfolio_id, group_type, group_name)
);

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_portfolio_group_targets_portfolio ON public.portfolio_group_targets(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_group_targets_type ON public.portfolio_group_targets(group_type);

-- Segurança RLS
ALTER TABLE public.portfolio_group_targets ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view portfolio group targets" ON public.portfolio_group_targets;
CREATE POLICY "Users can view portfolio group targets" ON public.portfolio_group_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Consultants can manage portfolio group targets" ON public.portfolio_group_targets;
CREATE POLICY "Consultants can manage portfolio group targets" ON public.portfolio_group_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND p.consultant_id = auth.uid()
    )
  );
