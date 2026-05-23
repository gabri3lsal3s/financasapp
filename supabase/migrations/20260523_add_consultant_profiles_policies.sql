-- Migração SQL: RLS adicionais para permitir que consultores gerenciem perfis de seus clientes
-- Executado em: 2026-05-23

-- 1. Permite que consultores insiram novos perfis de clientes (incluindo temporários/provisórios)
DROP POLICY IF EXISTS "Consultants can insert client profiles" ON public.profiles;
CREATE POLICY "Consultants can insert client profiles" ON public.profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'consultant' AND p.is_blocked = FALSE
    )
  );

-- 2. Permite que consultores atualizem os perfis de clientes sob sua gestão ou provisórios
DROP POLICY IF EXISTS "Consultants can update client profiles they manage" ON public.profiles;
CREATE POLICY "Consultants can update client profiles they manage" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'consultant' AND p.is_blocked = FALSE
    ) AND (
      EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id AND port.consultant_id = auth.uid()
      ) OR NOT EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id
      )
    )
  );

-- 3. Permite que consultores deletem perfis sob sua gestão ou temporários órfãos (para vinculação)
DROP POLICY IF EXISTS "Consultants can delete client profiles they manage" ON public.profiles;
CREATE POLICY "Consultants can delete client profiles they manage" ON public.profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'consultant' AND p.is_blocked = FALSE
    ) AND (
      EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id AND port.consultant_id = auth.uid()
      ) OR NOT EXISTS (
        SELECT 1 FROM public.portfolios port
        WHERE port.client_id = id
      )
    )
  );
