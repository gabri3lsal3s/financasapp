-- Migration SQL: Adicionar contract_rate na tabela portfolio_transactions para suportar taxas específicas por aporte de renda fixa/tesouro
-- Executado em: 2026-06-02

ALTER TABLE public.portfolio_transactions ADD COLUMN IF NOT EXISTS contract_rate DECIMAL(8, 4) NULL;

-- Atualizar o comentário para documentar o campo
COMMENT ON COLUMN public.portfolio_transactions.contract_rate IS 'Taxa de rentabilidade anual acordada no momento específico do aporte (usado para Renda Fixa e Tesouro Direto)';
