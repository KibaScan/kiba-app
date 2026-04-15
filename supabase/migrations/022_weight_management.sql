-- ─── Migration 022: Weight Management (D-160, D-161, D-162) ───────────────
-- Weight goal slider, caloric accumulator, BCS self-assessment.

-- D-160: Weight goal level — 7-position discrete slider (-3 to +3)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS weight_goal_level SMALLINT DEFAULT 0 CHECK (weight_goal_level BETWEEN -3 AND 3);

-- D-161: Caloric accumulator for estimated weight tracking
ALTER TABLE pets ADD COLUMN IF NOT EXISTS caloric_accumulator NUMERIC DEFAULT 0;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS accumulator_last_reset_at TIMESTAMPTZ;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS accumulator_notification_sent BOOLEAN DEFAULT FALSE;

-- D-162: BCS self-assessment (owner-reported, educational only)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS bcs_score SMALLINT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS bcs_assessed_at TIMESTAMPTZ;

-- Weight estimate notification preference
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS weight_estimate_alerts_enabled BOOLEAN DEFAULT TRUE;
