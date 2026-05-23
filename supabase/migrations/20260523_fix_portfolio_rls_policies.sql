-- Migração SQL: Correção de políticas de RLS para a tabela public.portfolios
-- Executado em: 2026-05-23
-- Descrição: Permite que consultores visualizem e atualizem carteiras recém-criadas que ainda não possuem consultor associado (consultant_id IS NULL), resolvendo conflitos RLS e erros de chave duplicada (409/23505) no cadastro de clientes.

-- 1. Atualiza política de leitura (SELECT)
DROP POLICY IF EXISTS "Users can view portfolios related to them" ON public.portfolios;
CREATE POLICY "Users can view portfolios related to them" ON public.portfolios
  FOR SELECT USING (
    auth.uid() = client_id 
    OR auth.uid() = consultant_id
    OR (
      consultant_id IS NULL 
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
      )
    )
  );

-- 2. Atualiza política de escrita e gerenciamento total (ALL)
DROP POLICY IF EXISTS "Consultants can manage portfolios they manage" ON public.portfolios;
CREATE POLICY "Consultants can manage portfolios they manage" ON public.portfolios
  FOR ALL USING (
    auth.uid() = consultant_id 
    OR auth.uid() = client_id
    OR (
      consultant_id IS NULL 
      AND EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'consultant' AND is_blocked = FALSE
      )
    )
  );
