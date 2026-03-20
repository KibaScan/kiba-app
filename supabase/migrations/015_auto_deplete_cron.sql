-- Migration 015: Auto-deplete cron schedule (M5)
-- Schedules the auto-deplete Edge Function to run every 30 minutes via pg_cron + pg_net.
-- The Edge Function deducts pantry quantities and sends low stock / empty push notifications.
--
-- PREREQUISITES (one-time manual setup via Supabase Dashboard):
--   1. Enable pg_cron extension: Database > Extensions > pg_cron > Enable
--   2. Enable pg_net extension: Database > Extensions > pg_net > Enable
--   3. Store vault secrets:
--      INSERT INTO vault.secrets (secret, name) VALUES ('https://<project-ref>.supabase.co', 'project_url');
--      INSERT INTO vault.secrets (secret, name) VALUES ('<service-role-key>', 'service_role_key');

BEGIN;

-- ─── 1. Ensure extensions exist ────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ─── 2. Schedule auto-deplete every 30 minutes ────────────

SELECT cron.schedule(
  'auto-deplete-30m',
  '*/30 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'project_url' LIMIT 1)
           || '/functions/v1/auto-deplete',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret
            FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMIT;
