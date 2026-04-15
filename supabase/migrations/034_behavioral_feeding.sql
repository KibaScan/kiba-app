-- Migration 034: Behavioral Feeding (M9 Phase D)
-- Adds schema and RPCs to transition from meal-fraction allocation to behavioral feeding styles.

BEGIN;

-- ─── 1. pets: New Columns ───────────────────────────────────────
ALTER TABLE pets
  ADD COLUMN feeding_style TEXT DEFAULT 'dry_only' 
    CHECK (feeding_style IN ('dry_only', 'dry_and_wet', 'wet_only', 'custom')),
  ADD COLUMN wet_reserve_kcal INTEGER DEFAULT 0,
  ADD COLUMN wet_reserve_source TEXT;

-- ─── 2. pantry_pet_assignments: New Columns ─────────────────────
ALTER TABLE pantry_pet_assignments
  ADD COLUMN feeding_role TEXT 
    CHECK (feeding_role IN ('base', 'rotational') OR feeding_role IS NULL),
  ADD COLUMN auto_deplete_enabled BOOLEAN DEFAULT FALSE,
  ADD COLUMN calorie_share_pct INTEGER DEFAULT 100 CHECK (calorie_share_pct >= 0 AND calorie_share_pct <= 100);

-- ─── 3. Drop legacy unique slot index ───────────────────────────
-- Safely drop the slot_index partial unique index from Migration 031
DROP INDEX IF EXISTS pantry_pet_assignments_slot_unique;

-- ─── 4. feeding_log Table ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS feeding_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  pantry_item_id UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kcal_fed SMALLINT NOT NULL CHECK (kcal_fed >= 0),
  quantity_fed NUMERIC NOT NULL CHECK (quantity_fed > 0),
  fed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for efficient today-boundary querying
CREATE INDEX idx_feeding_log_pet_fed_at ON feeding_log (pet_id, fed_at);

-- RLS for feeding_log
ALTER TABLE feeding_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feeding logs"
  ON feeding_log
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── 5. RPC: log_wet_feeding_atomic ─────────────────────────────
-- Atomically inserts feeding_log and deducts from pantry_items.quantity_remaining.
CREATE OR REPLACE FUNCTION log_wet_feeding_atomic(
  p_pet_id UUID,
  p_pantry_item_id UUID,
  p_kcal_fed SMALLINT,
  p_quantity_fed NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Insert the history log
  INSERT INTO feeding_log (pet_id, pantry_item_id, user_id, kcal_fed, quantity_fed)
  VALUES (p_pet_id, p_pantry_item_id, v_user_id, p_kcal_fed, p_quantity_fed)
  RETURNING id INTO v_log_id;

  -- 2. Deduct from pantry inventory (floored at 0 to prevent negative inventory)
  UPDATE pantry_items
  SET quantity_remaining = GREATEST(0, quantity_remaining - p_quantity_fed),
      last_deducted_at = NOW(),
      updated_at = NOW()
  WHERE id = p_pantry_item_id
    AND user_id = v_user_id;

  RETURN v_log_id;
END;
$$;

-- ─── 6. RPC: undo_wet_feeding_atomic ────────────────────────────
-- Atomically deletes feeding_log and reverses the inventory deduction.
CREATE OR REPLACE FUNCTION undo_wet_feeding_atomic(
  p_log_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_user_id UUID;
  v_pantry_item_id UUID;
  v_quantity_fed NUMERIC;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify log ownership and fetch variables
  SELECT pantry_item_id, quantity_fed INTO v_pantry_item_id, v_quantity_fed
  FROM feeding_log
  WHERE id = p_log_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feeding log not found or not authorized';
  END IF;

  -- 1. Re-increment the inventory
  UPDATE pantry_items
  SET quantity_remaining = quantity_remaining + v_quantity_fed,
      updated_at = NOW()
  WHERE id = v_pantry_item_id
    AND user_id = v_user_id;

  -- 2. Delete the log
  DELETE FROM feeding_log WHERE id = p_log_id;
END;
$$;

-- Backfill existing daily food assignments with 'base' role
UPDATE pantry_pet_assignments ppa
SET feeding_role = 'base'
WHERE ppa.feeding_frequency = 'daily'
  AND EXISTS (
    SELECT 1 FROM pantry_items pi
    JOIN products p ON p.id = pi.product_id
    WHERE pi.id = ppa.pantry_item_id
      AND p.category = 'daily_food'
  );

COMMIT;
