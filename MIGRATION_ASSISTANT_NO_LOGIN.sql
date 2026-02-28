-- MODO SEM LOGIN PARA O ASSISTENTE
-- Use este script quando o app operar sem autenticação de usuário.
-- Ele remove o bloqueio de RLS nas tabelas assistant_* para permitir uso no PWA sem login.

ALTER TABLE IF EXISTS assistant_sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assistant_commands DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assistant_confirmations DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assistant_category_mappings DISABLE ROW LEVEL SECURITY;

-- Opcional: limpar políticas antigas (não é obrigatório com RLS desativado)
DROP POLICY IF EXISTS assistant_sessions_select_own ON assistant_sessions;
DROP POLICY IF EXISTS assistant_sessions_insert_own ON assistant_sessions;
DROP POLICY IF EXISTS assistant_sessions_update_own ON assistant_sessions;
DROP POLICY IF EXISTS assistant_sessions_delete_own ON assistant_sessions;

DROP POLICY IF EXISTS assistant_commands_select_own ON assistant_commands;
DROP POLICY IF EXISTS assistant_commands_insert_own ON assistant_commands;
DROP POLICY IF EXISTS assistant_commands_update_own ON assistant_commands;
DROP POLICY IF EXISTS assistant_commands_delete_own ON assistant_commands;

DROP POLICY IF EXISTS assistant_confirmations_select_own ON assistant_confirmations;
DROP POLICY IF EXISTS assistant_confirmations_insert_own ON assistant_confirmations;
DROP POLICY IF EXISTS assistant_confirmations_update_own ON assistant_confirmations;
DROP POLICY IF EXISTS assistant_confirmations_delete_own ON assistant_confirmations;

DROP POLICY IF EXISTS assistant_mappings_select_own ON assistant_category_mappings;
DROP POLICY IF EXISTS assistant_mappings_insert_own ON assistant_category_mappings;
DROP POLICY IF EXISTS assistant_mappings_update_own ON assistant_category_mappings;
DROP POLICY IF EXISTS assistant_mappings_delete_own ON assistant_category_mappings;
