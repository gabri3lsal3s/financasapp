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
-- 4. AJUSTES DE PARCELAMENTO EM EXPENSES
-- ============================================
-- Remover colunas antigas de parcelamento
ALTER TABLE expenses DROP COLUMN IF EXISTS is_recurring;
ALTER TABLE expenses DROP COLUMN IF EXISTS is_fixed;
ALTER TABLE expenses DROP COLUMN IF EXISTS installments;
ALTER TABLE expenses DROP COLUMN IF EXISTS current_installment;

-- Adicionar estrutura nova de parcelamento
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_group_id UUID;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_number INTEGER;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS installment_total INTEGER;

ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_installment_number_check;
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_installment_total_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_installment_number_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_installment_number_check
      CHECK (installment_number IS NULL OR installment_number >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'expenses_installment_total_check'
  ) THEN
    ALTER TABLE expenses
      ADD CONSTRAINT expenses_installment_total_check
      CHECK (installment_total IS NULL OR installment_total >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_expenses_installment_group ON expenses(installment_group_id);

-- ============================================
-- 5. ADICIONAR PESO DE INCLUSÃO NOS RELATÓRIOS
-- ============================================

-- 5.1 Garantir colunas
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS report_weight DECIMAL(5, 4) NOT NULL DEFAULT 1.0;

ALTER TABLE incomes
ADD COLUMN IF NOT EXISTS report_weight DECIMAL(5, 4) NOT NULL DEFAULT 1.0;

-- 5.2 Normalizar dados existentes
UPDATE expenses
SET report_weight = 1.0
WHERE report_weight IS NULL;

UPDATE incomes
SET report_weight = 1.0
WHERE report_weight IS NULL;

UPDATE expenses
SET report_weight = LEAST(GREATEST(report_weight, 0), 1)
WHERE report_weight < 0 OR report_weight > 1;

UPDATE incomes
SET report_weight = LEAST(GREATEST(report_weight, 0), 1)
WHERE report_weight < 0 OR report_weight > 1;

-- 5.3 Garantir tipo e regras da coluna (mesmo se já existia)
ALTER TABLE expenses
ALTER COLUMN report_weight TYPE DECIMAL(5, 4) USING ROUND(report_weight::numeric, 4),
ALTER COLUMN report_weight SET DEFAULT 1.0,
ALTER COLUMN report_weight SET NOT NULL;

ALTER TABLE incomes
ALTER COLUMN report_weight TYPE DECIMAL(5, 4) USING ROUND(report_weight::numeric, 4),
ALTER COLUMN report_weight SET DEFAULT 1.0,
ALTER COLUMN report_weight SET NOT NULL;

-- 5.4 Reforçar constraints de faixa válida
ALTER TABLE expenses
DROP CONSTRAINT IF EXISTS expenses_report_weight_check;

ALTER TABLE incomes
DROP CONSTRAINT IF EXISTS incomes_report_weight_check;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'expenses_report_weight_check'
  ) THEN
    ALTER TABLE expenses
    ADD CONSTRAINT expenses_report_weight_check CHECK (report_weight >= 0 AND report_weight <= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incomes_report_weight_check'
  ) THEN
    ALTER TABLE incomes
    ADD CONSTRAINT incomes_report_weight_check CHECK (report_weight >= 0 AND report_weight <= 1);
  END IF;
END $$;

-- ============================================
-- 6. CRIAR ÍNDICES PARA PERFORMANCE
-- ============================================
CREATE INDEX IF NOT EXISTS idx_income_categories_user ON income_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_incomes_category ON incomes(income_category_id);
CREATE INDEX IF NOT EXISTS idx_incomes_user ON incomes(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user ON categories(user_id);

-- ============================================
-- 7. LIMITES DE DESPESA E EXPECTATIVAS DE RENDA (MENSAL)
-- ============================================

CREATE TABLE IF NOT EXISTS expense_category_month_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  limit_amount DECIMAL(10, 2) CHECK (limit_amount IS NULL OR limit_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

CREATE TABLE IF NOT EXISTS income_category_month_expectations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  income_category_id UUID NOT NULL REFERENCES income_categories(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  expectation_amount DECIMAL(10, 2) CHECK (expectation_amount IS NULL OR expectation_amount >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_limits_category_month_unique
ON expense_category_month_limits(category_id, month);

CREATE INDEX IF NOT EXISTS idx_expense_limits_month
ON expense_category_month_limits(month);

CREATE INDEX IF NOT EXISTS idx_expense_limits_user
ON expense_category_month_limits(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_income_expectations_category_month_unique
ON income_category_month_expectations(income_category_id, month);

CREATE INDEX IF NOT EXISTS idx_income_expectations_month
ON income_category_month_expectations(month);

CREATE INDEX IF NOT EXISTS idx_income_expectations_user
ON income_category_month_expectations(user_id);

-- ============================================
-- 8. CRIAR ALGUMAS CATEGORIAS DE RENDAS PADRÃO (OPCIONAL)
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
