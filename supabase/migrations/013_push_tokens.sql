-- Migration 013: Push token storage (M5 Phase 2)
-- Stores Expo push tokens per user per device for server-sent notifications.
-- Separate from user_settings (014) — tokens are device-specific, preferences are user-wide.

BEGIN;

-- ─── 1. push_tokens ─────────────────────────────────────────

CREATE TABLE push_tokens (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expo_push_token  TEXT NOT NULL,
  device_id        TEXT NOT NULL,
  platform         TEXT NOT NULL DEFAULT 'ios' CHECK (platform IN ('ios', 'android')),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_push_tokens_user_device ON push_tokens (user_id, device_id);
CREATE INDEX idx_push_tokens_active ON push_tokens (is_active) WHERE is_active = true;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY push_tokens_owner ON push_tokens
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
