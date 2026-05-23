-- Migração SQL: Customizações de Consultoria (Perfil de Risco e Anotações)
-- Executado em: 2026-05-23

-- Estende portfolios com campos de adequabilidade (risk_profile) e notas
ALTER TABLE public.portfolios ADD COLUMN IF NOT EXISTS risk_profile TEXT DEFAULT 'moderado' CHECK (risk_profile IN ('conservador', 'moderado', 'arrojado'));
ALTER TABLE public.portfolios ADD COLUMN IF NOT EXISTS notes TEXT;
