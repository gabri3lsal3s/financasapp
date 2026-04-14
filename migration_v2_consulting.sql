-- ============================================
-- MIRAÇÃO: MÓDULO DE CONSULTORIA DETALHADO
-- RODAR NO SQL EDITOR DO SUPABASE
-- ============================================

-- 1. Tabelas Base (Clientes e Ativos)
CREATE TABLE IF NOT EXISTS consulting_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS portfolio_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES consulting_clients(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL, 
  current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  target_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- 2. Histórico de Relatórios (Snapshots)
CREATE TABLE IF NOT EXISTS consulting_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES consulting_clients(id) ON DELETE CASCADE,
  month TEXT NOT NULL,
  total_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

CREATE TABLE IF NOT EXISTS consulting_report_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES consulting_reports(id) ON DELETE CASCADE,
  asset_name TEXT NOT NULL,
  category TEXT NOT NULL, 
  current_balance DECIMAL(15, 2) NOT NULL DEFAULT 0,
  target_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0, 
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Setores e Estrutura do Método Cerrado
CREATE TABLE IF NOT EXISTS portfolio_sectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES consulting_clients(id) ON DELETE CASCADE,
  macro_category TEXT NOT NULL,
  sector_name TEXT NOT NULL,
  target_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- 4. Atualização de Colunas (Se as tabelas já existirem)
ALTER TABLE portfolio_assets
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES portfolio_sectors(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS applied_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS custom_rate TEXT,
ADD COLUMN IF NOT EXISTS maturity_date TEXT,
ADD COLUMN IF NOT EXISTS variation_month TEXT,
ADD COLUMN IF NOT EXISTS variation_total TEXT;

ALTER TABLE consulting_report_assets
ADD COLUMN IF NOT EXISTS sector_id UUID,
ADD COLUMN IF NOT EXISTS applied_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS custom_rate TEXT,
ADD COLUMN IF NOT EXISTS maturity_date TEXT,
ADD COLUMN IF NOT EXISTS variation_month TEXT,
ADD COLUMN IF NOT EXISTS variation_total TEXT;

-- 5. Segurança (RLS)
ALTER TABLE consulting_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_report_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_sectors ENABLE ROW LEVEL SECURITY;

-- Políticas
DO $$ 
BEGIN
    -- Clientes
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own consulting clients') THEN
        CREATE POLICY "Users can view own consulting clients" ON consulting_clients FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own consulting clients') THEN
        CREATE POLICY "Users can insert own consulting clients" ON consulting_clients FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own consulting clients') THEN
        CREATE POLICY "Users can update own consulting clients" ON consulting_clients FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete own consulting clients') THEN
        CREATE POLICY "Users can delete own consulting clients" ON consulting_clients FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Ativos
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own portfolio assets') THEN
        CREATE POLICY "Users can view own portfolio assets" ON portfolio_assets FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own portfolio assets') THEN
        CREATE POLICY "Users can insert own portfolio assets" ON portfolio_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own portfolio assets') THEN
        CREATE POLICY "Users can update own portfolio assets" ON portfolio_assets FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete own portfolio assets') THEN
        CREATE POLICY "Users can delete own portfolio assets" ON portfolio_assets FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Reports
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own consulting reports') THEN
        CREATE POLICY "Users can view own consulting reports" ON consulting_reports FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own consulting reports') THEN
        CREATE POLICY "Users can insert own consulting reports" ON consulting_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own consulting reports') THEN
        CREATE POLICY "Users can update own consulting reports" ON consulting_reports FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete own consulting reports') THEN
        CREATE POLICY "Users can delete own consulting reports" ON consulting_reports FOR DELETE USING (auth.uid() = user_id);
    END IF;

    -- Report Assets (Garantir acesso aos ativos congelados)
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can manage own consulting report assets') THEN
        CREATE POLICY "Users can manage own consulting report assets" ON consulting_report_assets FOR ALL
        USING (auth.uid() IN (SELECT user_id FROM consulting_reports WHERE id = report_id));
    END IF;

    -- Setores
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can view own portfolio sectors') THEN
        CREATE POLICY "Users can view own portfolio sectors" ON portfolio_sectors FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can insert own portfolio sectors') THEN
        CREATE POLICY "Users can insert own portfolio sectors" ON portfolio_sectors FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can update own portfolio sectors') THEN
        CREATE POLICY "Users can update own portfolio sectors" ON portfolio_sectors FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'Users can delete own portfolio sectors') THEN
        CREATE POLICY "Users can delete own portfolio sectors" ON portfolio_sectors FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;
