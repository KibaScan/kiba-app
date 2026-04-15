-- Migration 021: pet_condition_details + pet_medications
-- M6 Health Conditions Part 2 — structured condition data + medication tracking

-- ─── pet_condition_details ──────────────────────────────────
-- Adds structured sub-type/severity data on top of existing health_conditions TEXT[] on pets.
-- Scoring engine reads from pet_conditions (tag list); this table adds detail for UI + future rules.

CREATE TABLE IF NOT EXISTS pet_condition_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  sub_type TEXT,                    -- e.g., 'iodine_restricted', 'medication_managed'
  severity TEXT DEFAULT 'moderate', -- 'mild', 'moderate', 'severe'
  diagnosed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, condition)
);

ALTER TABLE pet_condition_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet conditions"
  ON pet_condition_details
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));

-- ─── pet_medications ────────────────────────────────────────
-- Display-only — does NOT influence scoring. For vet report + pet sitter report.

CREATE TABLE IF NOT EXISTS pet_medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'past', 'as_needed')),
  dosage TEXT,
  started_at DATE,
  ended_at DATE,
  prescribed_for TEXT,              -- links to a condition name (not FK — soft reference)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pet_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet medications"
  ON pet_medications
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
