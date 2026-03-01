-- Kiba — M2 Pet Profiles Schema Migration
-- Aligns `pets` table with PET_PROFILE_SPEC.md
-- Renames, precision changes, constraint updates, new columns, dropped columns
-- Does NOT touch pet_conditions or pet_allergens (already exist in 001)

BEGIN;

-- ─── 1. Rename Columns (data-preserving) ──────────────────

ALTER TABLE pets RENAME COLUMN weight_lbs TO weight_current_lbs;
ALTER TABLE pets RENAME COLUMN goal_weight_lbs TO weight_goal_lbs;
ALTER TABLE pets RENAME COLUMN birth_date TO date_of_birth;
ALTER TABLE pets RENAME COLUMN is_spayed_neutered TO is_neutered;

-- ─── 2. Precision Changes ─────────────────────────────────
-- DECIMAL(5,2) → DECIMAL(5,1) for weight columns

ALTER TABLE pets ALTER COLUMN weight_current_lbs TYPE DECIMAL(5,1);
ALTER TABLE pets ALTER COLUMN weight_goal_lbs TYPE DECIMAL(5,1);

-- ─── 3. Activity Level Constraint Update ──────────────────
-- Migrate 'sedentary' → 'low' before swapping constraints

UPDATE pets SET activity_level = 'low' WHERE activity_level = 'sedentary';

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_activity_level_check;
ALTER TABLE pets ADD CONSTRAINT pets_activity_level_check
  CHECK (activity_level IN ('low', 'moderate', 'high', 'working'));

-- ─── 4. New Columns ───────────────────────────────────────

ALTER TABLE pets ADD COLUMN sex TEXT CHECK (sex IN ('male', 'female'));
ALTER TABLE pets ADD COLUMN dob_is_approximate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pets ADD COLUMN weight_updated_at TIMESTAMPTZ;
ALTER TABLE pets ADD COLUMN breed_size TEXT CHECK (breed_size IN ('small', 'medium', 'large', 'giant'));

-- ─── 5. Life Stage Constraint ─────────────────────────────
-- Add CHECK for the 7-value life stage system (D-064)

ALTER TABLE pets ADD CONSTRAINT pets_life_stage_check
  CHECK (life_stage IN ('puppy', 'kitten', 'junior', 'adult', 'mature', 'senior', 'geriatric'));

-- ─── 6. Breed Default ─────────────────────────────────────

ALTER TABLE pets ALTER COLUMN breed SET DEFAULT 'Mixed Breed';

-- ─── 7. Drop Obsolete Columns ─────────────────────────────

ALTER TABLE pets DROP COLUMN IF EXISTS is_indoor;
ALTER TABLE pets DROP COLUMN IF EXISTS allergies;
ALTER TABLE pets DROP COLUMN IF EXISTS weight_loss_target_rate;

COMMIT;
