-- MIGRAÇÃO BASE PARA ASSISTENTE DE VOZ (GEMINI/ASSISTANT)
-- Objetivo: auditar comandos, controlar confirmação e manter contexto de sessão.

CREATE TABLE IF NOT EXISTS assistant_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'android',
  locale TEXT DEFAULT 'pt-BR',
  user_id UUID,
  status TEXT NOT NULL DEFAULT 'active', -- active | expired | closed
  last_intent TEXT,
  context_json JSONB,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assistant_commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  user_id UUID,
  command_text TEXT NOT NULL,
  interpreted_intent TEXT,
  confidence NUMERIC(5,4),
  slots_json JSONB,
  category_resolution_json JSONB,
  requires_confirmation BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'pending_confirmation',
  -- pending_confirmation | confirmed | denied | executed | failed | expired
  idempotency_key TEXT,
  execution_result_json JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assistant_confirmations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  command_id UUID NOT NULL REFERENCES assistant_commands(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES assistant_sessions(id) ON DELETE CASCADE,
  user_id UUID,
  confirmed BOOLEAN NOT NULL,
  spoken_text TEXT,
  confirmation_method TEXT NOT NULL DEFAULT 'voice', -- voice | touch
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Opcional: memória de mapeamentos aceitos pelo usuário para inferência de categoria
CREATE TABLE IF NOT EXISTS assistant_category_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  phrase TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('expense','income')),
  category_id UUID,
  income_category_id UUID,
  confidence NUMERIC(5,4),
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT assistant_mapping_category_xor CHECK (
    (category_id IS NOT NULL AND income_category_id IS NULL)
    OR
    (category_id IS NULL AND income_category_id IS NOT NULL)
  )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_device ON assistant_sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_user ON assistant_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_status ON assistant_sessions(status);
CREATE INDEX IF NOT EXISTS idx_assistant_sessions_expires_at ON assistant_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_assistant_commands_session ON assistant_commands(session_id);
CREATE INDEX IF NOT EXISTS idx_assistant_commands_user ON assistant_commands(user_id);
CREATE INDEX IF NOT EXISTS idx_assistant_commands_status ON assistant_commands(status);
CREATE INDEX IF NOT EXISTS idx_assistant_commands_intent ON assistant_commands(interpreted_intent);
CREATE INDEX IF NOT EXISTS idx_assistant_commands_created_at ON assistant_commands(created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_assistant_commands_idempotency ON assistant_commands(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assistant_confirmations_command ON assistant_confirmations(command_id);
CREATE INDEX IF NOT EXISTS idx_assistant_confirmations_session ON assistant_confirmations(session_id);
CREATE INDEX IF NOT EXISTS idx_assistant_confirmations_created_at ON assistant_confirmations(created_at);

CREATE INDEX IF NOT EXISTS idx_assistant_mappings_user_phrase ON assistant_category_mappings(user_id, phrase);
CREATE INDEX IF NOT EXISTS idx_assistant_mappings_type ON assistant_category_mappings(transaction_type);

-- Nota:
-- Se você usar RLS em produção, aplique políticas por user_id nessas tabelas.
