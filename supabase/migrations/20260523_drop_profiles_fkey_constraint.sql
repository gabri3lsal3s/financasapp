-- Migração SQL: Remoção do vínculo de chave estrangeira rígido para permitir perfis provisórios/temporários
-- Executado em: 2026-05-23

-- Remove a restrição de chave estrangeira que exige que todos os perfis em 'profiles' existam em 'auth.users'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
