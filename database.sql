-- Script SQL para criar as tabelas no Supabase
-- Execute este script no SQL Editor do Supabase

-- Tabela de categorias de despesas
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de categorias de rendas
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de despesas
CREATE TABLE IF NOT EXISTS expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  report_weight DECIMAL(5, 4) NOT NULL DEFAULT 1.0 CHECK (report_weight >= 0 AND report_weight <= 1),
  date DATE NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
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
  user_id UUID
);

-- Tabela de investimentos
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  month TEXT NOT NULL, -- formato YYYY-MM
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de limites mensais por categoria de despesa
CREATE TABLE IF NOT EXISTS expense_category_month_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  limit_amount DECIMAL(10, 2) CHECK (limit_amount IS NULL OR limit_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Tabela de expectativas mensais por categoria de renda
CREATE TABLE IF NOT EXISTS income_category_month_expectations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  income_category_id UUID NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  expectation_amount DECIMAL(10, 2) CHECK (expectation_amount IS NULL OR expectation_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
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

-- Habilitar Row Level Security (RLS) se necessário
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE incomes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE investments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- DESABILITAR RLS (se estiver habilitado e causando problemas)
-- ============================================
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE incomes DISABLE ROW LEVEL SECURITY;
ALTER TABLE income_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE investments DISABLE ROW LEVEL SECURITY;
ALTER TABLE expense_category_month_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE income_category_month_expectations DISABLE ROW LEVEL SECURITY;

-- Políticas RLS (ajuste conforme sua necessidade de autenticação)
-- CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);





