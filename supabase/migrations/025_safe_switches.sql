-- Migration 025: Safe Switch Guide (M7)
-- Guided 7-day (dogs) / 10-day (cats) food transition tracking.
-- One active switch per pet enforced via partial unique index.

-- ─── Safe Switches ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS safe_switches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  old_product_id UUID NOT NULL REFERENCES products(id),
  new_product_id UUID NOT NULL REFERENCES products(id),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  total_days SMALLINT NOT NULL DEFAULT 7,
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One active/paused switch per pet at a time
CREATE UNIQUE INDEX idx_safe_switches_one_active_per_pet
  ON safe_switches (pet_id)
  WHERE status IN ('active', 'paused');

-- Quick lookup for active switches
CREATE INDEX idx_safe_switches_pet_status
  ON safe_switches (pet_id, status);

-- User lookup for all switches
CREATE INDEX idx_safe_switches_user
  ON safe_switches (user_id);

-- ─── Safe Switch Logs (daily tummy checks) ────────────────

CREATE TABLE IF NOT EXISTS safe_switch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  switch_id UUID NOT NULL REFERENCES safe_switches(id) ON DELETE CASCADE,
  day_number SMALLINT NOT NULL,
  tummy_check TEXT CHECK (tummy_check IN ('perfect', 'soft_stool', 'upset')),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (switch_id, day_number)
);

CREATE INDEX idx_safe_switch_logs_switch
  ON safe_switch_logs (switch_id);

-- ─── RLS ──────────────────────────────────────────────────

ALTER TABLE safe_switches ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_switch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own switches"
  ON safe_switches FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users manage own switch logs"
  ON safe_switch_logs FOR ALL
  USING (switch_id IN (SELECT id FROM safe_switches WHERE user_id = auth.uid()));
