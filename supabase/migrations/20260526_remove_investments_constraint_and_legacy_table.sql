-- Migração SQL: Remover constraint de caixa positivo, migrar aportes legados e excluir a tabela legada 'investments'
-- Executado em: 2026-05-26

-- 1. MIGRAÇÃO SEGURA DOS DADOS REMANESCENTES DE 'investments' PARA 'portfolio_transactions'
DO $$
DECLARE
    r RECORD;
    p_id UUID;
    t_id UUID;
BEGIN
    -- Verifica se a tabela 'investments' ainda existe antes de realizar a migração
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'investments') THEN
        FOR r IN 
            SELECT id, user_id, amount, description, month, ticker, quantity, price, created_at
            FROM public.investments 
            WHERE transaction_id IS NULL
        LOOP
            -- Encontra a carteira (portfolio) associada a este usuário (client_id)
            SELECT id INTO p_id FROM public.portfolios WHERE client_id = r.user_id;
            
            IF p_id IS NOT NULL THEN
                t_id := gen_random_uuid();
                
                -- Insere o aporte na tabela de livro-razão (portfolio_transactions)
                INSERT INTO public.portfolio_transactions (
                    id,
                    portfolio_id,
                    ticker,
                    operation_type,
                    quantity,
                    price,
                    date,
                    created_at
                ) VALUES (
                    t_id,
                    p_id,
                    COALESCE(UPPER(TRIM(r.ticker)), 'SALDO_INV'),
                    'buy',
                    COALESCE(r.quantity, 1.0),
                    COALESCE(r.price, r.amount),
                    (r.month || '-01')::DATE,
                    r.created_at
                );
                
                -- Se possuir um ticker válido, cria também a definição do ativo para compatibilidade
                IF r.ticker IS NOT NULL AND r.ticker != '' AND EXISTS (
                    SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'portfolio_asset_definitions'
                ) THEN
                    INSERT INTO public.portfolio_asset_definitions (
                        portfolio_id,
                        ticker,
                        pricing_mode,
                        is_b3_linked,
                        applied_amount,
                        application_date,
                        is_treasury,
                        updated_at
                    ) VALUES (
                        p_id,
                        UPPER(TRIM(r.ticker)),
                        'market',
                        TRUE,
                        r.amount,
                        (r.month || '-01')::DATE,
                        FALSE,
                        r.created_at
                    ) ON CONFLICT (portfolio_id, ticker) DO NOTHING;
                END IF;
                
                -- Atualiza a referência temporariamente (opcional, para controle do loop)
                UPDATE public.investments SET transaction_id = t_id WHERE id = r.id;
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- 2. REMOVER A CONSTRAINT DE SALDO EM CAIXA POSITIVO
-- Permite que o saldo de caixa do portfólio fique temporariamente negativo (ex: dívida pendente, atraso de lançamentos ou conciliações B3)
ALTER TABLE public.portfolios DROP CONSTRAINT IF EXISTS portfolios_cash_balance_check;

-- 3. EXCLUSÃO DEFINITIVA DA TABELA LEGADA 'investments' E SUAS POLÍTICAS
DROP TABLE IF EXISTS public.investments CASCADE;
