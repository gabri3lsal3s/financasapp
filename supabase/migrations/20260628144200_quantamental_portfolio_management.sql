-- Migração SQL: Gestão Quantamental de Portfólio
-- Criada em: 2026-06-28

-- 1. TABELA DE PREFERÊNCIAS QUANTITATIVAS DO PORTFÓLIO
CREATE TABLE IF NOT EXISTS public.portfolio_quant_preferences (
  portfolio_id UUID PRIMARY KEY REFERENCES public.portfolios(id) ON DELETE CASCADE,
  tier_s_limit DECIMAL(5, 2) NOT NULL DEFAULT 20.00 CHECK (tier_s_limit >= 0 AND tier_s_limit <= 100),
  tier_a_limit DECIMAL(5, 2) NOT NULL DEFAULT 10.00 CHECK (tier_a_limit >= 0 AND tier_a_limit <= 100),
  tier_b_limit DECIMAL(5, 2) NOT NULL DEFAULT 5.00 CHECK (tier_b_limit >= 0 AND tier_b_limit <= 100),
  tier_c_limit DECIMAL(5, 2) NOT NULL DEFAULT 0.00 CHECK (tier_c_limit >= 0 AND tier_c_limit <= 100),
  max_sector_acoes DECIMAL(5, 2) NOT NULL DEFAULT 30.00 CHECK (max_sector_acoes >= 0 AND max_sector_acoes <= 100),
  max_sector_fiis DECIMAL(5, 2) NOT NULL DEFAULT 45.00 CHECK (max_sector_fiis >= 0 AND max_sector_fiis <= 100),
  min_roic_excelente DECIMAL(5, 2) NOT NULL DEFAULT 15.00,
  max_divida_ebitda DECIMAL(5, 2) NOT NULL DEFAULT 2.50,
  scuttlebutt_decay_days INTEGER NOT NULL DEFAULT 365 CHECK (scuttlebutt_decay_days IN (90, 180, 365)),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e criar políticas para portfolio_quant_preferences
ALTER TABLE public.portfolio_quant_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own portfolio quant preferences"
  ON public.portfolio_quant_preferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own portfolio quant preferences"
  ON public.portfolio_quant_preferences FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

-- 2. TABELA DE PILARES DO SCUTTLEBUTT (QUALITATIVO)
CREATE TABLE IF NOT EXISTS public.scuttlebutt_pillars (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE CASCADE, -- NULL indica pilar global/padrão
  name TEXT NOT NULL,
  weight_percentage DECIMAL(5, 2) NOT NULL CHECK (weight_percentage >= 0 AND weight_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e políticas para scuttlebutt_pillars
ALTER TABLE public.scuttlebutt_pillars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view global or own pillars"
  ON public.scuttlebutt_pillars FOR SELECT
  USING (
    portfolio_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own pillars"
  ON public.scuttlebutt_pillars FOR ALL
  USING (
    portfolio_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

-- 3. TABELA DE PERGUNTAS DO SCUTTLEBUTT
CREATE TABLE IF NOT EXISTS public.scuttlebutt_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pillar_id UUID NOT NULL REFERENCES public.scuttlebutt_pillars(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  weight DECIMAL(5, 2) NOT NULL DEFAULT 1.00 CHECK (weight >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e políticas para scuttlebutt_questions
ALTER TABLE public.scuttlebutt_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view questions of readable pillars"
  ON public.scuttlebutt_questions FOR SELECT
  USING (
    EXISTS (
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

CREATE POLICY "Users can manage questions of own pillars"
  ON public.scuttlebutt_questions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scuttlebutt_pillars pil
      WHERE pil.id = pillar_id AND pil.portfolio_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.portfolios p
        WHERE p.id = pil.portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
      )
    )
  );

-- 4. TABELA DE RESPOSTAS DO SCUTTLEBUTT
CREATE TABLE IF NOT EXISTS public.scuttlebutt_answers (
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker VARCHAR(12) NOT NULL,
  question_id UUID NOT NULL REFERENCES public.scuttlebutt_questions(id) ON DELETE CASCADE,
  answer VARCHAR(5) NOT NULL CHECK (answer IN ('yes', 'no', 'na')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (portfolio_id, ticker, question_id)
);

-- Habilitar RLS e políticas para scuttlebutt_answers
ALTER TABLE public.scuttlebutt_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scuttlebutt answers"
  ON public.scuttlebutt_answers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

CREATE POLICY "Users can manage own scuttlebutt answers"
  ON public.scuttlebutt_answers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

-- 5. TABELA DE CACHE GLOBAL DE INDICADORES QUANTITATIVOS
CREATE TABLE IF NOT EXISTS public.asset_fundamentals_cache (
  ticker VARCHAR(12) PRIMARY KEY,
  roic DECIMAL(8, 4),
  dividend_yield DECIMAL(8, 4),
  pe_ratio DECIMAL(8, 4),
  ev_ebitda DECIMAL(8, 4),
  net_debt_ebitda DECIMAL(8, 4),
  pe_5y_average DECIMAL(8, 4),
  ev_ebitda_5y_average DECIMAL(8, 4),
  net_debt_trend_up_2y BOOLEAN DEFAULT FALSE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS e políticas para asset_fundamentals_cache (leitura aberta para autenticados, escrita por qualquer um para cache do client-side)
ALTER TABLE public.asset_fundamentals_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read fundamentals cache"
  ON public.asset_fundamentals_cache FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "All users can write fundamentals cache"
  ON public.asset_fundamentals_cache FOR ALL
  USING (TRUE);

-- 6. ADICIONAR CAMPOS DE OVERRIDE MANUAL EM PORTFOLIO_ASSET_DEFINITIONS
ALTER TABLE public.portfolio_asset_definitions 
  ADD COLUMN IF NOT EXISTS manual_roic DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_dividend_yield DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_pe_ratio DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_ev_ebitda DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_net_debt_ebitda DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_pe_5y_average DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_ev_ebitda_5y_average DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_net_debt_trend_up_2y BOOLEAN,
  ADD COLUMN IF NOT EXISTS manual_p_vp DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_vacancy DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_etf_fee DECIMAL(8, 4),
  ADD COLUMN IF NOT EXISTS manual_etf_tracking_error DECIMAL(8, 4);

-- 7. POPULAR PILARES E PERGUNTAS DE TEMPLATE GLOBAIS (PORTFOLIO_ID IS NULL)
-- Limpar possíveis resquícios duplicados
DELETE FROM public.scuttlebutt_pillars WHERE portfolio_id IS NULL;

-- Inserir os 4 pilares globais padrão
INSERT INTO public.scuttlebutt_pillars (id, portfolio_id, name, weight_percentage) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Gestão e Governança', 30.00),
  ('00000000-0000-0000-0000-000000000002', NULL, 'Vantagem Competitiva (Moat)', 30.00),
  ('00000000-0000-0000-0000-000000000003', NULL, 'Ecossistema e Regulação', 20.00),
  ('00000000-0000-0000-0000-000000000004', NULL, 'Cultura e Inovação', 20.00);

-- Inserir perguntas padrão para cada pilar global
-- Pilar 1: Gestão e Governança
INSERT INTO public.scuttlebutt_questions (pillar_id, question_text, weight) VALUES
  ('00000000-0000-0000-0000-000000000001', 'O ativo possui nível elevado de governança (ex: Novo Mercado na B3)?', 1.00),
  ('00000000-0000-0000-0000-000000000001', 'A diretoria e conselho possuem incentivos alinhados e skin in the game (possuem ações do ativo)?', 1.00),
  ('00000000-0000-0000-0000-000000000001', 'O ativo possui histórico recente limpo de escândalos éticos, fiscais ou regulatórios?', 1.00),
  ('00000000-0000-0000-0000-000000000001', 'A gestão passou por transição recente de liderança (CEO/CFO) tranquila e planejada?', 1.00);

-- Pilar 2: Moat
INSERT INTO public.scuttlebutt_questions (pillar_id, question_text, weight) VALUES
  ('00000000-0000-0000-0000-000000000002', 'A empresa possui margens financeiras historicamente superiores aos seus concorrentes diretos?', 1.00),
  ('00000000-0000-0000-0000-000000000002', 'A participação de mercado (market share) é dominante ou apresenta crescimento consistente?', 1.00),
  ('00000000-0000-0000-0000-000000000002', 'Existem barreiras de entrada elevadas (patentes, custos de troca do cliente, efeito de rede)?', 1.00);

-- Pilar 3: Ecossistema e Regulação
INSERT INTO public.scuttlebutt_questions (pillar_id, question_text, weight) VALUES
  ('00000000-0000-0000-0000-000000000003', 'O negócio possui independência em relação a fornecedores ou clientes únicos relevantes?', 1.00),
  ('00000000-0000-0000-0000-000000000003', 'O negócio está livre de risco elevado de controle de preços estatal ou canetadas regulatórias?', 1.00);

-- Pilar 4: Cultura e Inovação
INSERT INTO public.scuttlebutt_questions (pillar_id, question_text, weight) VALUES
  ('00000000-0000-0000-0000-000000000004', 'O ativo possui baixo índice de turnover executivo e colaboradores satisfeitos?', 1.00),
  ('00000000-0000-0000-0000-000000000004', 'A empresa demonstra inovação contínua aderente e integrada ao seu core business?', 1.00);

-- 8. TRIGGER DE CRIAÇÃO AUTOMÁTICA DE PREFERÊNCIAS QUANTITATIVAS
CREATE OR REPLACE FUNCTION public.handle_new_portfolio_quant_preferences()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.portfolio_quant_preferences (portfolio_id)
  VALUES (NEW.id)
  ON CONFLICT (portfolio_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_portfolio_created_setup_quant
  AFTER INSERT ON public.portfolios
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_portfolio_quant_preferences();

-- Criar preferências para os portfólios já existentes
INSERT INTO public.portfolio_quant_preferences (portfolio_id)
SELECT id FROM public.portfolios
ON CONFLICT (portfolio_id) DO NOTHING;
