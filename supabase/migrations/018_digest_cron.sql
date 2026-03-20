-- Migration 018: Weekly/daily digest cron schedules (M5 — D-130)
-- Two pg_cron jobs calling the same Edge Function with different mode payloads.
-- Weekly: Sundays at 9:00 AM UTC. Daily: every day at 9:00 AM UTC.
-- Timezone-aware scheduling is a v2 improvement; UTC for now.

BEGIN;

-- ─── 1. Weekly digest — Sundays at 9:00 AM UTC ──────────

SELECT cron.schedule(
  'weekly-digest-sunday',
  '0 9 * * 0',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'project_url' LIMIT 1)
           || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret
            FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "weekly"}'::jsonb
  );
  $$
);

-- ─── 2. Daily digest — every day at 9:00 AM UTC ─────────

SELECT cron.schedule(
  'daily-digest',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'project_url' LIMIT 1)
           || '/functions/v1/weekly-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (SELECT decrypted_secret
            FROM vault.decrypted_secrets WHERE name = 'service_role_key' LIMIT 1),
      'Content-Type', 'application/json'
    ),
    body := '{"mode": "daily"}'::jsonb
  );
  $$
);

COMMIT;
