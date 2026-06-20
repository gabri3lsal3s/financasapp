-- Migração: Ativar pg_cron e agendar o fechamento diário
-- Data: 2026-06-18
-- Descrição: Habilita pg_cron e cria o agendamento do fechamento patrimonial.

-- Habilita as extensões necessárias se não estiverem presentes
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remover job anterior se existir para evitar duplicações
SELECT cron.unschedule('daily-close-job');

-- Função auxiliar para disparar a Edge Function de fechamento
CREATE OR REPLACE FUNCTION public.trigger_daily_close()
RETURNS void AS $$
DECLARE
  project_ref text;
  req_url text;
BEGIN
  -- Tenta pegar a url do projeto de forma dinâmica ou usa o kong local
  SELECT coalesce(
    (SELECT current_setting('custom.supabase_url', true)),
    'http://kong:8000'
  ) INTO req_url;

  -- Dispara o fechamento via requisição HTTP assíncrona do pg_net
  PERFORM extensions.net_http_post(
    url := req_url || '/functions/v1/daily-close',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Agendar o job para rodar diariamente às 22:00 UTC (19:00 BRT)
SELECT cron.schedule(
  'daily-close-job',
  '0 22 * * *',
  'SELECT public.trigger_daily_close();'
);
