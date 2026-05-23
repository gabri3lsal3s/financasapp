-- ============================================================================
-- MASTER MIGRATION SQL CONSOLIDADO: INVESTIMENTOS E WEALTH MANAGEMENT (CERRADO)
-- Data de Criação: 2026-05-23
-- Descrição: Consolida todas as estruturas criadas hoje para o sistema de 
--            consultoria de investimentos, livro-razão B3 e aportes diretos,
--            garantindo políticas de RLS e triggers consistentes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. LIMPEZA DE ESTRUTURAS OBSOLETAS
-- ----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.portfolio_assets CASCADE;
DROP TABLE IF EXISTS public.consulting_report_assets CASCADE;
DROP TABLE IF EXISTS public.consulting_reports CASCADE;
DROP TABLE IF EXISTS public.portfolio_sectors CASCADE;
DROP TABLE IF EXISTS public.consulting_clients CASCADE;

-- ----------------------------------------------------------------------------
-- 2. ALTERAÇÕES NA TABELA PROFILES (CONTROLE DE ACESSO)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'client' CHECK (role IN ('consultant', 'client'));
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ----------------------------------------------------------------------------
-- 3. CRIAÇÃO DAS TABELAS DE CUSTÓDIA, TESES E ALOCAÇÕES
-- ----------------------------------------------------------------------------

-- Tabela portfolios: Vincula um cliente ao seu consultor, armazena saldo de caixa e notas diagnósticas
CREATE TABLE IF NOT EXISTS public.portfolios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  consultant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  cash_balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00 CHECK (cash_balance >= 0),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_client_portfolio UNIQUE (client_id)
);

-- Tabela portfolio_transactions: Livro-razão de movimentações (compras, vendas, dividendos etc.)
CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker VARCHAR(12) NOT NULL,
  operation_type VARCHAR(15) NOT NULL CHECK (operation_type IN ('buy', 'sell', 'dividend', 'split', 'subscription')),
  quantity DECIMAL(15, 6) NOT NULL CHECK (quantity >= 0),
  price DECIMAL(15, 4) NOT NULL CHECK (price >= 0),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela target_allocations: Definição de pesos percentuais alvo por ativo para rebalanceamento
CREATE TABLE IF NOT EXISTS public.target_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  ticker VARCHAR(12) NOT NULL,
  target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_portfolio_ticker UNIQUE (portfolio_id, ticker)
);

-- Tabela portfolio_group_targets: Limites e metas de exposição por classe de ativos e setor econômico
CREATE TABLE IF NOT EXISTS public.portfolio_group_targets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  portfolio_id UUID NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  group_type VARCHAR(15) NOT NULL CHECK (group_type IN ('class', 'sector')),
  group_name TEXT NOT NULL,
  target_percentage DECIMAL(5, 2) NOT NULL CHECK (target_percentage >= 0 AND target_percentage <= 100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_portfolio_group UNIQUE (portfolio_id, group_type, group_name)
);

-- Tabela asset_theses: Repositório qualitativo onde o consultor salva teses de investimentos dos ativos
CREATE TABLE IF NOT EXISTS public.asset_theses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  consultant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticker VARCHAR(12) NOT NULL,
  thesis TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT unique_consultant_ticker UNIQUE (consultant_id, ticker)
);

-- Tabela asset_prices: Cache de preços e classificação de ativos (Classe de Ativo e Setor Econômico)
CREATE TABLE IF NOT EXISTS public.asset_prices (
  ticker VARCHAR(12) PRIMARY KEY,
  current_price DECIMAL(15, 4) NOT NULL CHECK (current_price >= 0),
  asset_class TEXT,
  sector TEXT,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. ESTENSÃO DE APORTES MENSAIS COM ATIVOS E TRANSAÇÕES
-- ----------------------------------------------------------------------------
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS ticker VARCHAR(12);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS quantity DECIMAL(15, 6);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS price DECIMAL(15, 4);
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.portfolio_transactions(id) ON DELETE SET NULL;

-- ----------------------------------------------------------------------------
-- 5. ÍNDICES DE PERFORMANCE DE CONSULTAS
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_portfolios_client ON public.portfolios(client_id);
CREATE INDEX IF NOT EXISTS idx_portfolios_consultant ON public.portfolios(consultant_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_portfolio ON public.portfolio_transactions(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_ticker ON public.portfolio_transactions(ticker);
CREATE INDEX IF NOT EXISTS idx_portfolio_transactions_date ON public.portfolio_transactions(date);
CREATE INDEX IF NOT EXISTS idx_target_allocations_portfolio ON public.target_allocations(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_group_targets_portfolio ON public.portfolio_group_targets(portfolio_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_group_targets_type ON public.portfolio_group_targets(group_type);
CREATE INDEX IF NOT EXISTS idx_asset_theses_consultant ON public.asset_theses(consultant_id);

-- ----------------------------------------------------------------------------
-- 6. SEGURANÇA E ROW LEVEL SECURITY (RLS)
-- ----------------------------------------------------------------------------
ALTER TABLE public.portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_group_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_theses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_prices ENABLE ROW LEVEL SECURITY;

-- 6.1 Políticas para portfolios
DROP POLICY IF EXISTS "Users can view portfolios related to them" ON public.portfolios;
CREATE POLICY "Users can view portfolios related to them" ON public.portfolios
  FOR SELECT USING (auth.uid() = client_id OR auth.uid() = consultant_id);

DROP POLICY IF EXISTS "Consultants can manage portfolios they manage" ON public.portfolios;
CREATE POLICY "Consultants can manage portfolios they manage" ON public.portfolios
  FOR ALL USING (auth.uid() = consultant_id OR auth.uid() = client_id);

-- 6.2 Políticas para portfolio_transactions (Lê todos associados, gerencia cliente e consultor)
DROP POLICY IF EXISTS "Users can view transactions of their portfolios" ON public.portfolio_transactions;
CREATE POLICY "Users can view transactions of their portfolios" ON public.portfolio_transactions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users and consultants can manage transactions of portfolios they manage" ON public.portfolio_transactions;
CREATE POLICY "Users and consultants can manage transactions of portfolios they manage" ON public.portfolio_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.consultant_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

-- 6.3 Políticas para target_allocations (Metas)
DROP POLICY IF EXISTS "Users can view target allocations" ON public.target_allocations;
CREATE POLICY "Users can view target allocations" ON public.target_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users and consultants can manage target allocations" ON public.target_allocations;
CREATE POLICY "Users and consultants can manage target allocations" ON public.target_allocations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.consultant_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

-- 6.4 Políticas para portfolio_group_targets (Limites por classe/setor)
DROP POLICY IF EXISTS "Users can view portfolio group targets" ON public.portfolio_group_targets;
CREATE POLICY "Users can view portfolio group targets" ON public.portfolio_group_targets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.client_id = auth.uid() OR p.consultant_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users and consultants can manage portfolio group targets" ON public.portfolio_group_targets;
CREATE POLICY "Users and consultants can manage portfolio group targets" ON public.portfolio_group_targets
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.portfolios p
      WHERE p.id = portfolio_id AND (p.consultant_id = auth.uid() OR p.client_id = auth.uid())
    )
  );

-- 6.5 Políticas para asset_theses (Teses qualitativas)
DROP POLICY IF EXISTS "Anyone view theses" ON public.asset_theses;
CREATE POLICY "Anyone view theses" ON public.asset_theses
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Consultants manage own theses" ON public.asset_theses;
CREATE POLICY "Consultants manage own theses" ON public.asset_theses
  FOR ALL USING (auth.uid() = consultant_id);

-- 6.6 Políticas para asset_prices (Cache de Cotações)
DROP POLICY IF EXISTS "Authenticated users can read prices" ON public.asset_prices;
CREATE POLICY "Authenticated users can read prices" ON public.asset_prices
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "All users can write prices" ON public.asset_prices;
CREATE POLICY "All users can write prices" ON public.asset_prices
  FOR ALL USING (TRUE); -- Permitido atualização de cotações a partir do client-side

-- 6.7 Políticas para profiles (Permite que consultores gerenciem perfis de seus clientes)
DROP POLICY IF EXISTS "Consultants can insert client profiles" ON public.profiles;
CREATE POLICY "Consultants can insert client profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'consultant' AND p.is_blocked = FALSE
    )
  );

DROP POLICY IF EXISTS "Consultants can update client profiles they manage" ON public.profiles;
CREATE POLICY "Consultants can update client profiles they manage" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'consultant' AND p.is_blocked = FALSE
    ) AND (
      EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id AND port.consultant_id = auth.uid()
      ) OR NOT EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id
      )
    )
  );

DROP POLICY IF EXISTS "Consultants can delete client profiles they manage" ON public.profiles;
CREATE POLICY "Consultants can delete client profiles they manage" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'consultant' AND p.is_blocked = FALSE
    ) AND (
      EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id AND port.consultant_id = auth.uid()
      ) OR NOT EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id
      )
    )
  );

-- ----------------------------------------------------------------------------
-- 7. TRIGGERS DE INTEGRIDADE REFERENCIAL E DE ALOCAÇÃO
-- ----------------------------------------------------------------------------

-- 7.1 Garante que a soma das alocações alvo unitárias não estoure 100% no banco de dados.
CREATE OR REPLACE FUNCTION verify_target_allocation_total_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_total DECIMAL(5, 2);
END_VAL DECIMAL(5, 2);
BEGIN
  SELECT COALESCE(SUM(target_percentage), 0) INTO current_total
  FROM public.target_allocations
  WHERE portfolio_id = NEW.portfolio_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  IF (current_total + NEW.target_percentage) > 100.00 THEN
    RAISE EXCEPTION 'A soma das alocações alvo no portfólio não pode ultrapassar 100 por cento (Valor atual: %, Tentativa de adicionar: %)', current_total, NEW.target_percentage;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS check_target_allocation_total ON public.target_allocations;
CREATE TRIGGER check_target_allocation_total
  BEFORE INSERT OR UPDATE ON public.target_allocations
  FOR EACH ROW EXECUTE FUNCTION verify_target_allocation_total_limit();

-- 7.2 Cria automaticamente uma carteira/portfolio para novos perfis com a role = 'client'.
CREATE OR REPLACE FUNCTION public.handle_new_portfolio_for_client()
RETURNS trigger AS $$
BEGIN
  IF NEW.role = 'client' AND NOT EXISTS (SELECT 1 FROM public.portfolios WHERE client_id = NEW.id) THEN
    INSERT INTO public.portfolios (client_id, cash_balance)
    VALUES (NEW.id, 0.00);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_client_profile_created ON public.profiles;
CREATE TRIGGER on_client_profile_created
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_portfolio_for_client();
