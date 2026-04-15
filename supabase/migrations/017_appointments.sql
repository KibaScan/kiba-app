-- Migration 017: Pet appointments (M5 — D-103)
-- Scheduler for vet visits, grooming, medication, vaccinations, and custom types.
-- UUID[] for pet_ids (simpler than junction table for this use case).
-- Premium gating: free tier = 2 active appointments, premium = unlimited.

BEGIN;

CREATE TABLE pet_appointments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL CHECK (type IN ('vet_visit','grooming','medication','vaccination','other')),
  custom_label   TEXT,
  scheduled_at   TIMESTAMPTZ NOT NULL,
  pet_ids        UUID[] NOT NULL,
  location       TEXT,
  notes          TEXT,
  reminder       TEXT NOT NULL DEFAULT '1_day' CHECK (reminder IN ('off','1_hour','1_day','3_days','1_week')),
  recurring      TEXT NOT NULL DEFAULT 'none' CHECK (recurring IN ('none','monthly','quarterly','biannual','yearly')),
  is_completed   BOOLEAN NOT NULL DEFAULT false,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upcoming appointments lookup (most common query)
CREATE INDEX idx_appointments_user_upcoming
  ON pet_appointments (user_id, scheduled_at)
  WHERE is_completed = false;

-- Filter by pet (GIN for array containment queries)
CREATE INDEX idx_appointments_pet
  ON pet_appointments USING GIN (pet_ids);

-- RLS
ALTER TABLE pet_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY appointments_owner ON pet_appointments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add 'deworming' to appointment type CHECK (D-163)
ALTER TABLE pet_appointments DROP CONSTRAINT pet_appointments_type_check;
ALTER TABLE pet_appointments ADD CONSTRAINT pet_appointments_type_check
  CHECK (type IN ('vet_visit','grooming','medication','vaccination','deworming','other'));

-- Pet health records (D-163)
CREATE TABLE pet_health_records (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pet_id            UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id    UUID REFERENCES pet_appointments(id) ON DELETE SET NULL,
  record_type       TEXT NOT NULL CHECK (record_type IN ('vaccination', 'deworming')),
  treatment_name    TEXT NOT NULL,
  administered_at   DATE NOT NULL,
  next_due_at       DATE,
  vet_name          TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_health_records_pet ON pet_health_records (pet_id);
CREATE INDEX idx_health_records_user_type ON pet_health_records (user_id, record_type);

ALTER TABLE pet_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY health_records_owner ON pet_health_records
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMIT;
