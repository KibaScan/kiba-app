-- Migration 016: Recall detection tables (M5 Recall Siren)
-- Three tables for the recall-check Edge Function pipeline:
--   recall_log — confirmed recalls linked to products (HIGH confidence matches)
--   recall_review_queue — MEDIUM confidence matches for manual review
--   recall_notifications — dedup table for push notifications
--
-- D-125: Recall features are always free — no premium gating.
-- D-158: Recalled products are a pipeline bypass — no score computed.

BEGIN;

-- ─── 1. recall_log ─────────────────────────────────────────────

CREATE TABLE recall_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  recall_date  DATE,
  reason       TEXT,
  fda_url      TEXT,
  lot_numbers  TEXT[],
  detected_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recall_log_product ON recall_log (product_id);

-- No RLS — system table written by Edge Function with service role.

-- ─── 2. recall_review_queue ────────────────────────────────────

CREATE TABLE recall_review_queue (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fda_entry_title     TEXT NOT NULL,
  fda_entry_url       TEXT,
  matched_product_id  UUID REFERENCES products(id),
  match_confidence    TEXT NOT NULL CHECK (match_confidence IN ('medium', 'low')),
  reviewed            BOOLEAN NOT NULL DEFAULT false,
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- No RLS — system table for manual review.

-- ─── 3. recall_notifications ───────────────────────────────────

CREATE TABLE recall_notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

ALTER TABLE recall_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY recall_notifications_owner ON recall_notifications
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 4. Cron schedule — daily at 6:00 AM UTC ──────────────────

SELECT cron.schedule(
  'recall-check-daily',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets
            WHERE name = 'project_url' LIMIT 1)
           || '/functions/v1/recall-check',
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
