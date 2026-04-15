-- Migration 014: User notification settings (M5 Phase 2)
-- Per-user notification preferences with per-category toggles and global kill switch.
-- Separate from push_tokens (013) — preferences change infrequently, tokens change per device.

BEGIN;

-- ─── 1. user_settings ───────────────────────────────────────

CREATE TABLE user_settings (
  id                            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  notifications_enabled         BOOLEAN NOT NULL DEFAULT true,
  feeding_reminders_enabled     BOOLEAN NOT NULL DEFAULT true,
  low_stock_alerts_enabled      BOOLEAN NOT NULL DEFAULT true,
  empty_alerts_enabled          BOOLEAN NOT NULL DEFAULT true,
  recall_alerts_enabled         BOOLEAN NOT NULL DEFAULT true,
  appointment_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  digest_frequency              TEXT NOT NULL DEFAULT 'weekly' CHECK (digest_frequency IN ('weekly', 'daily', 'off')),
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_settings_owner ON user_settings
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
