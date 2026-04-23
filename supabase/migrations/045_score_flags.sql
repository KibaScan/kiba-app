-- Migration 045: Score Flags (user-reported data quality issues, per D-072)
-- Users can insert and read their own flags; admin reviews via Studio (service role).
-- Cache invalidation not needed: does not affect pet_product_scores inputs.

CREATE TABLE score_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products ON DELETE CASCADE,
  scan_id UUID NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('score_wrong','ingredient_missing','recalled','data_outdated','recipe_concern','other')),
  detail TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','reviewed','resolved','rejected')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);
CREATE INDEX score_flags_open_idx ON score_flags (status, created_at DESC) WHERE status = 'open';
CREATE INDEX score_flags_user_idx ON score_flags (user_id, created_at DESC);

ALTER TABLE score_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users insert own flags" ON score_flags
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users read own flags" ON score_flags
  FOR SELECT TO authenticated USING (user_id = auth.uid());
-- UPDATE: service role only.
