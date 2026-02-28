-- RLS PARA TABELAS DO ASSISTENTE DE VOZ
-- Objetivo: restringir leitura/escrita por usuário autenticado (auth.uid() = user_id)

-- ============================================
-- 1) HABILITAR RLS
-- ============================================
ALTER TABLE assistant_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_category_mappings ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2) POLÍTICAS: assistant_sessions
-- ============================================
DROP POLICY IF EXISTS assistant_sessions_select_own ON assistant_sessions;
DROP POLICY IF EXISTS assistant_sessions_insert_own ON assistant_sessions;
DROP POLICY IF EXISTS assistant_sessions_update_own ON assistant_sessions;
DROP POLICY IF EXISTS assistant_sessions_delete_own ON assistant_sessions;

CREATE POLICY assistant_sessions_select_own
  ON assistant_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY assistant_sessions_insert_own
  ON assistant_sessions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_sessions_update_own
  ON assistant_sessions
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_sessions_delete_own
  ON assistant_sessions
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 3) POLÍTICAS: assistant_commands
-- ============================================
DROP POLICY IF EXISTS assistant_commands_select_own ON assistant_commands;
DROP POLICY IF EXISTS assistant_commands_insert_own ON assistant_commands;
DROP POLICY IF EXISTS assistant_commands_update_own ON assistant_commands;
DROP POLICY IF EXISTS assistant_commands_delete_own ON assistant_commands;

CREATE POLICY assistant_commands_select_own
  ON assistant_commands
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY assistant_commands_insert_own
  ON assistant_commands
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM assistant_sessions s
      WHERE s.id = session_id
        AND s.user_id = auth.uid()
    )
  );

CREATE POLICY assistant_commands_update_own
  ON assistant_commands
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_commands_delete_own
  ON assistant_commands
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4) POLÍTICAS: assistant_confirmations
-- ============================================
DROP POLICY IF EXISTS assistant_confirmations_select_own ON assistant_confirmations;
DROP POLICY IF EXISTS assistant_confirmations_insert_own ON assistant_confirmations;
DROP POLICY IF EXISTS assistant_confirmations_update_own ON assistant_confirmations;
DROP POLICY IF EXISTS assistant_confirmations_delete_own ON assistant_confirmations;

CREATE POLICY assistant_confirmations_select_own
  ON assistant_confirmations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY assistant_confirmations_insert_own
  ON assistant_confirmations
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM assistant_commands c
      WHERE c.id = command_id
        AND c.user_id = auth.uid()
        AND c.session_id = session_id
    )
  );

CREATE POLICY assistant_confirmations_update_own
  ON assistant_confirmations
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_confirmations_delete_own
  ON assistant_confirmations
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 5) POLÍTICAS: assistant_category_mappings
-- ============================================
DROP POLICY IF EXISTS assistant_mappings_select_own ON assistant_category_mappings;
DROP POLICY IF EXISTS assistant_mappings_insert_own ON assistant_category_mappings;
DROP POLICY IF EXISTS assistant_mappings_update_own ON assistant_category_mappings;
DROP POLICY IF EXISTS assistant_mappings_delete_own ON assistant_category_mappings;

CREATE POLICY assistant_mappings_select_own
  ON assistant_category_mappings
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY assistant_mappings_insert_own
  ON assistant_category_mappings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_mappings_update_own
  ON assistant_category_mappings
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY assistant_mappings_delete_own
  ON assistant_category_mappings
  FOR DELETE
  USING (auth.uid() = user_id);

-- Nota operacional:
-- Com estas políticas, chamadas sem usuário autenticado não terão acesso às tabelas assistant_*.
-- Em automações servidor-side, use service role key (bypass RLS) quando apropriado.
