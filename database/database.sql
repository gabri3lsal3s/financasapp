-- Script SQL para criar as tabelas no Supabase
-- Execute este script no SQL Editor do Supabase

-- Tabela de categorias de despesas
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de categorias de rendas
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  report_weight DECIMAL(5, 4) NOT NULL DEFAULT 1.0 CHECK (report_weight >= 0 AND report_weight <= 1),
  date DATE NOT NULL,
  installment_group_id UUID,
  installment_number INTEGER CHECK (installment_number IS NULL OR installment_number >= 1),
  installment_total INTEGER CHECK (installment_total IS NULL OR installment_total >= 1),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de rendas
CREATE TABLE IF NOT EXISTS incomes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  report_weight DECIMAL(5, 4) NOT NULL DEFAULT 1.0 CHECK (report_weight >= 0 AND report_weight <= 1),
  date DATE NOT NULL,
  type TEXT DEFAULT 'other',
  income_category_id UUID REFERENCES income_categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de investimentos
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  month TEXT NOT NULL, -- formato YYYY-MM
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de insights mensais gerados por IA
CREATE TABLE IF NOT EXISTS monthly_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_insights_user_month_unique ON monthly_insights(user_id, month);

-- Tabela de limites mensais por categoria de despesa
CREATE TABLE IF NOT EXISTS expense_category_month_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  limit_amount DECIMAL(10, 2) CHECK (limit_amount IS NULL OR limit_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de expectativas mensais por categoria de renda
CREATE TABLE IF NOT EXISTS income_category_month_expectations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  income_category_id UUID NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  expectation_amount DECIMAL(10, 2) CHECK (expectation_amount IS NULL OR expectation_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_installment_group ON expenses(installment_group_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_month ON investments(month);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_limits_category_month_unique ON expense_category_month_limits(category_id, month);
CREATE INDEX IF NOT EXISTS idx_expense_limits_month ON expense_category_month_limits(month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_expectations_category_month_unique ON income_category_month_expectations(income_category_id, month);
CREATE INDEX IF NOT EXISTS idx_income_expectations_month ON income_category_month_expectations(month);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_month_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_category_month_expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_insights ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Categories
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Income Categories
CREATE POLICY "Users can view own income categories" ON income_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income categories" ON income_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income categories" ON income_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income categories" ON income_categories FOR DELETE USING (auth.uid() = user_id);

-- Expenses
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- Incomes
CREATE POLICY "Users can view own incomes" ON incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incomes" ON incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incomes" ON incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own incomes" ON incomes FOR DELETE USING (auth.uid() = user_id);

-- Investments
CREATE POLICY "Users can view own investments" ON investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON investments FOR DELETE USING (auth.uid() = user_id);

-- Expense Category Month Limits
CREATE POLICY "Users can view own expense limits" ON expense_category_month_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expense limits" ON expense_category_month_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expense limits" ON expense_category_month_limits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expense limits" ON expense_category_month_limits FOR DELETE USING (auth.uid() = user_id);

-- Income Category Month Expectations
CREATE POLICY "Users can view own income expectations" ON income_category_month_expectations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income expectations" ON income_category_month_expectations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income expectations" ON income_category_month_expectations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income expectations" ON income_category_month_expectations FOR DELETE USING (auth.uid() = user_id);

-- Monthly Insights
CREATE POLICY "Users can view own monthly insights" ON monthly_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly insights" ON monthly_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly insights" ON monthly_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly insights" ON monthly_insights FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CONSULTORIA DE INVESTIMENTOS
-- ============================================

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

ALTER TABLE consulting_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consulting clients" ON consulting_clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consulting clients" ON consulting_clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own consulting clients" ON consulting_clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own consulting clients" ON consulting_clients FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own portfolio assets" ON portfolio_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio assets" ON portfolio_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio assets" ON portfolio_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio assets" ON portfolio_assets FOR DELETE USING (auth.uid() = user_id);

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

ALTER TABLE consulting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_report_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consulting reports" ON consulting_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consulting reports" ON consulting_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
  date DATE NOT NULL,
  type TEXT DEFAULT 'other',
  income_category_id UUID REFERENCES income_categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de investimentos
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  month TEXT NOT NULL, -- formato YYYY-MM
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de insights mensais gerados por IA
CREATE TABLE IF NOT EXISTS monthly_insights (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  data_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_insights_user_month_unique ON monthly_insights(user_id, month);

-- Tabela de limites mensais por categoria de despesa
CREATE TABLE IF NOT EXISTS expense_category_month_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  limit_amount DECIMAL(10, 2) CHECK (limit_amount IS NULL OR limit_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Tabela de expectativas mensais por categoria de renda
CREATE TABLE IF NOT EXISTS income_category_month_expectations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  income_category_id UUID NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  expectation_amount DECIMAL(10, 2) CHECK (expectation_amount IS NULL OR expectation_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_installment_group ON expenses(installment_group_id);
CREATE INDEX IF NOT EXISTS idx_incomes_date ON incomes(date);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_investments_month ON investments(month);
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_limits_category_month_unique ON expense_category_month_limits(category_id, month);
CREATE INDEX IF NOT EXISTS idx_expense_limits_month ON expense_category_month_limits(month);
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_expectations_category_month_unique ON income_category_month_expectations(income_category_id, month);
CREATE INDEX IF NOT EXISTS idx_income_expectations_month ON income_category_month_expectations(month);

-- ============================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_month_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_category_month_expectations ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_insights ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- Categories
CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);

-- Income Categories
CREATE POLICY "Users can view own income categories" ON income_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income categories" ON income_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income categories" ON income_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income categories" ON income_categories FOR DELETE USING (auth.uid() = user_id);

-- Expenses
CREATE POLICY "Users can view own expenses" ON expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expenses" ON expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON expenses FOR DELETE USING (auth.uid() = user_id);

-- Incomes
CREATE POLICY "Users can view own incomes" ON incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own incomes" ON incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own incomes" ON incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own incomes" ON incomes FOR DELETE USING (auth.uid() = user_id);

-- Investments
CREATE POLICY "Users can view own investments" ON investments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own investments" ON investments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own investments" ON investments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own investments" ON investments FOR DELETE USING (auth.uid() = user_id);

-- Expense Category Month Limits
CREATE POLICY "Users can view own expense limits" ON expense_category_month_limits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own expense limits" ON expense_category_month_limits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expense limits" ON expense_category_month_limits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expense limits" ON expense_category_month_limits FOR DELETE USING (auth.uid() = user_id);

-- Income Category Month Expectations
CREATE POLICY "Users can view own income expectations" ON income_category_month_expectations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own income expectations" ON income_category_month_expectations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income expectations" ON income_category_month_expectations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income expectations" ON income_category_month_expectations FOR DELETE USING (auth.uid() = user_id);

-- Monthly Insights
CREATE POLICY "Users can view own monthly insights" ON monthly_insights FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own monthly insights" ON monthly_insights FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own monthly insights" ON monthly_insights FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own monthly insights" ON monthly_insights FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- CONSULTORIA DE INVESTIMENTOS
-- ============================================

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

ALTER TABLE consulting_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consulting clients" ON consulting_clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consulting clients" ON consulting_clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own consulting clients" ON consulting_clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own consulting clients" ON consulting_clients FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own portfolio assets" ON portfolio_assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio assets" ON portfolio_assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio assets" ON portfolio_assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio assets" ON portfolio_assets FOR DELETE USING (auth.uid() = user_id);

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

ALTER TABLE consulting_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE consulting_report_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consulting reports" ON consulting_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own consulting reports" ON consulting_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own consulting reports" ON consulting_reports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own consulting reports" ON consulting_reports FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own consulting report assets" ON consulting_report_assets FOR SELECT USING (EXISTS (SELECT 1 FROM consulting_reports cr WHERE cr.id = report_id AND cr.user_id = auth.uid()));
CREATE POLICY "Users can insert own consulting report assets" ON consulting_report_assets FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM consulting_reports cr WHERE cr.id = report_id AND cr.user_id = auth.uid()));
CREATE POLICY "Users can update own consulting report assets" ON consulting_report_assets FOR UPDATE USING (EXISTS (SELECT 1 FROM consulting_reports cr WHERE cr.id = report_id AND cr.user_id = auth.uid()));
CREATE POLICY "Users can delete own consulting report assets" ON consulting_report_assets FOR DELETE USING (EXISTS (SELECT 1 FROM consulting_reports cr WHERE cr.id = report_id AND cr.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS portfolio_sectors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES consulting_clients(id) ON DELETE CASCADE,
  macro_category TEXT NOT NULL,
  sector_name TEXT NOT NULL,
  target_percentage DECIMAL(10, 4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID DEFAULT auth.uid()
);

ALTER TABLE portfolio_sectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own portfolio sectors" ON portfolio_sectors FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own portfolio sectors" ON portfolio_sectors FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio sectors" ON portfolio_sectors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio sectors" ON portfolio_sectors FOR DELETE USING (auth.uid() = user_id);

-- Adding Sector Relationship and Optional Advanced Detail Fields to Assets
ALTER TABLE portfolio_assets
ADD COLUMN IF NOT EXISTS sector_id UUID REFERENCES portfolio_sectors(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS applied_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS custom_rate TEXT,
ADD COLUMN IF NOT EXISTS maturity_date TEXT,
ADD COLUMN IF NOT EXISTS variation_month TEXT,
ADD COLUMN IF NOT EXISTS variation_total TEXT,
ADD COLUMN IF NOT EXISTS monthly_contribution DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_dividends DECIMAL(15, 2) DEFAULT 0;

-- Equivalente para Report Assets (Fotografia congelada estendida)
ALTER TABLE consulting_report_assets
ADD COLUMN IF NOT EXISTS sector_id UUID,
ADD COLUMN IF NOT EXISTS applied_amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS custom_rate TEXT,
ADD COLUMN IF NOT EXISTS maturity_date TEXT,
ADD COLUMN IF NOT EXISTS variation_month TEXT,
ADD COLUMN IF NOT EXISTS variation_total TEXT,
ADD COLUMN IF NOT EXISTS monthly_contribution DECIMAL(15, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_dividends DECIMAL(15, 2) DEFAULT 0;
