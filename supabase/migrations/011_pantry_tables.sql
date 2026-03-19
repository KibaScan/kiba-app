-- Migration 011: Pantry tables (M5)
-- Replaces preliminary pantry_items from 001 with M5 spec §1a schema.
-- Two tables: pantry_items (user-owned inventory) + pantry_pet_assignments (per-pet serving config).

BEGIN;

-- ─── 0. Drop old pantry_items from migration 001 ─────────────

DROP POLICY IF EXISTS pantry_items_owner ON pantry_items;
DROP INDEX IF EXISTS idx_pantry_items_user_id;
DROP TABLE IF EXISTS pantry_items CASCADE;

-- ─── 1. pantry_items ──────────────────────────────────────────

CREATE TABLE pantry_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_original   DECIMAL(10,2) NOT NULL,
  quantity_remaining  DECIMAL(10,2) NOT NULL,
  quantity_unit       TEXT NOT NULL CHECK (quantity_unit IN ('lbs', 'oz', 'kg', 'g', 'units')),
  serving_mode        TEXT NOT NULL CHECK (serving_mode IN ('weight', 'unit')),
  unit_label          TEXT DEFAULT 'units' CHECK (unit_label IN ('cans', 'pouches', 'units')),
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_deducted_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pantry_items_user_active ON pantry_items (user_id, is_active) WHERE is_active = true;
CREATE INDEX idx_pantry_items_product ON pantry_items (product_id) WHERE is_active = true;

ALTER TABLE pantry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY pantry_items_owner ON pantry_items
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER pantry_items_updated_at
  BEFORE UPDATE ON pantry_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── 2. pantry_pet_assignments ────────────────────────────────

CREATE TABLE pantry_pet_assignments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pantry_item_id      UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  pet_id              UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  serving_size        DECIMAL(8,4) NOT NULL,
  serving_size_unit   TEXT NOT NULL CHECK (serving_size_unit IN ('cups', 'scoops', 'units')),
  feedings_per_day    SMALLINT NOT NULL DEFAULT 2,
  feeding_frequency   TEXT NOT NULL DEFAULT 'daily' CHECK (feeding_frequency IN ('daily', 'as_needed')),
  feeding_times       JSONB,
  notifications_on    BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pantry_item_id, pet_id)
);

CREATE INDEX idx_pantry_assignments_pet ON pantry_pet_assignments (pet_id);

ALTER TABLE pantry_pet_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY pantry_pet_assignments_owner ON pantry_pet_assignments
  FOR ALL USING (
    pantry_item_id IN (SELECT id FROM pantry_items WHERE user_id = auth.uid())
  )
  WITH CHECK (
    pantry_item_id IN (SELECT id FROM pantry_items WHERE user_id = auth.uid())
  );

CREATE TRIGGER pantry_pet_assignments_updated_at
  BEFORE UPDATE ON pantry_pet_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
