-- Migration 042: User XP (experience points events log + running totals)
-- Two tables: append-only event log (insert via triggers only) + denormalized totals.
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE TABLE user_xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('scan','discovery','vote_verified','missing_product_approved','recipe_approved')),
  xp_delta INT NOT NULL,
  product_id UUID NULL REFERENCES products ON DELETE SET NULL,
  recipe_id UUID NULL REFERENCES community_recipes ON DELETE SET NULL,
  vote_id UUID NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX user_xp_events_user_time_idx ON user_xp_events (user_id, created_at DESC);
CREATE INDEX user_xp_events_recipe_idx ON user_xp_events (recipe_id) WHERE recipe_id IS NOT NULL;
CREATE INDEX user_xp_events_product_idx ON user_xp_events (product_id) WHERE product_id IS NOT NULL;

ALTER TABLE user_xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp events" ON user_xp_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- INSERT: triggers only (no client write). No policy = denied.

CREATE TABLE user_xp_totals (
  user_id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  total_xp INT NOT NULL DEFAULT 0,
  scans_count INT NOT NULL DEFAULT 0,
  discoveries_count INT NOT NULL DEFAULT 0,
  contributions_count INT NOT NULL DEFAULT 0,
  streak_current_days INT NOT NULL DEFAULT 0,
  streak_longest_days INT NOT NULL DEFAULT 0,
  streak_last_scan_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE user_xp_totals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own xp totals" ON user_xp_totals
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- INSERT/UPDATE: triggers only.

-- NOTE: user_xp_events and user_xp_totals have no INSERT/UPDATE policy.
-- All writes come from triggers added in migration 046 (Task 8) which MUST
-- be declared SECURITY DEFINER owned by `postgres` — otherwise they fire
-- as the invoking user, hit the SELECT-only RLS wall, and rollback the
-- originating INSERT (into scans, kiba_index_votes, etc.). Pattern matches
-- existing 026_kiba_index.sql get_kiba_index_stats RPC.
