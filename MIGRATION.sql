-- INSTRUÇÕES DE MIGRAÇÃO DO BANCO DE DADOS
-- Execute estes comandos no SQL Editor do Supabase

-- ============================================
-- 1. CRIAR TABELA DE CATEGORIAS DE RENDAS
-- ============================================
CREATE TABLE IF NOT EXISTS income_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

-- ============================================
-- 2. ADICIONAR COLUNA income_category_id EM INCOMES
-- ============================================
-- Se a coluna já existe, este comando será ignorado
ALTER TABLE incomes 
ADD COLUMN IF NOT EXISTS income_category_id UUID REFERENCES income_categories(id) ON DELETE CASCADE;

-- ============================================
-- 3. REMOVER COLUNA 'type' DE INCOMES (OPCIONAL)
-- ============================================
-- Se você quer remover a coluna antiga 'type' após migração:
-- ALTER TABLE incomes DROP COLUMN IF EXISTS type;

-- ============================================
-- 4. REMOVER COLUNAS ANTIGAS DE EXPENSES
-- ============================================
-- Remover colunas de parcela que não são mais usadas
ALTER TABLE expenses DROP COLUMN IF EXISTS is_recurring;
ALTER TABLE expenses DROP COLUMN IF EXISTS is_fixed;
ALTER TABLE expenses DROP COLUMN IF EXISTS installments;
ALTER TABLE expenses DROP COLUMN IF EXISTS current_installment;

-- ============================================
-- 5. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- ============================================
-- 6. CRIAR ALGUMAS CATEGORIAS DE RENDAS PADRÃO (OPCIONAL)
-- ============================================
-- Descomente e execute se quiser adicionar categorias padrão
-- INSERT INTO income_categories (name, color, user_id) 
-- VALUES 
--   ('Salário', '#22c55e', NULL),
--   ('Freelancer', '#3b82f6', NULL),
--   ('Dividendos', '#f59e0b', NULL),
--   ('Aluguel', '#06b6d4', NULL),
--   ('Outros', '#8b5cf6', NULL)
-- ON CONFLICT DO NOTHING;

-- ============================================
-- PRONTO!
-- ============================================
-- Agora o banco de dados está atualizado para suportar
-- categorias de rendas e a nova estrutura de despesas.
