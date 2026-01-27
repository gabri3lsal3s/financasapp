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

-- Políticas RLS (ajuste conforme sua necessidade de autenticação)
-- CREATE POLICY "Users can view own categories" ON categories FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can insert own categories" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own categories" ON categories FOR UPDATE USING (auth.uid() = user_id);
-- CREATE POLICY "Users can delete own categories" ON categories FOR DELETE USING (auth.uid() = user_id);


