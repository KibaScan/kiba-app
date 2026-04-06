-- Migration 032: Safe Switch capture computed serving size and rebalance (M9 Phase C)
-- Adds:
--   A. safe_switches.new_serving_size (NUMERIC)
--   B. safe_switches.new_feedings_per_day (SMALLINT)
--   C. Overwrites complete_safe_switch_with_pantry_swap RPC to apply these fields to pantry_pet_assignments.
-- 
-- Resolves the architectural conflict where Safe Switch in-place swapping preserved the old food's 
-- serving size, ignoring the new food's different kcal density.

BEGIN;

-- ─── A & B. Add serving size properties to safe_switches ───────────────────

ALTER TABLE safe_switches
  ADD COLUMN new_serving_size NUMERIC,
  ADD COLUMN new_feedings_per_day SMALLINT;

-- ─── C. Overwrite complete_safe_switch_with_pantry_swap RPC ────────────────

CREATE OR REPLACE FUNCTION complete_safe_switch_with_pantry_swap(
  p_switch_id UUID,
  p_outcome_summary JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_pantry_item_id UUID;
  v_new_product_id UUID;
  v_user_id UUID;
  v_pet_id UUID;
  v_new_serving_size NUMERIC;
  v_new_feedings_per_day SMALLINT;
BEGIN
  SELECT pantry_item_id, new_product_id, user_id, pet_id, new_serving_size, new_feedings_per_day
    INTO v_pantry_item_id, v_new_product_id, v_user_id, v_pet_id, v_new_serving_size, v_new_feedings_per_day
  FROM safe_switches
  WHERE id = p_switch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Safe switch % not found', p_switch_id;
  END IF;

  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Safe switch % does not belong to caller', p_switch_id;
  END IF;

  -- Swap pantry product_id + reset quantity to 0 so the existing D-155
  -- empty-state + Restock flow picks up the real fresh-bag size.
  IF v_pantry_item_id IS NOT NULL THEN
    UPDATE pantry_items
    SET product_id = v_new_product_id,
        quantity_remaining = 0
    WHERE id = v_pantry_item_id
      AND is_active = true;

    -- Update the pantry pet assignment for this specific pet to apply the safe switch computed serving size
    -- (Phase C fix to prevent using old kcal density)
    IF v_new_serving_size IS NOT NULL AND v_new_feedings_per_day IS NOT NULL THEN
      UPDATE pantry_pet_assignments
      SET serving_size = v_new_serving_size,
          feedings_per_day = v_new_feedings_per_day
      WHERE pantry_item_id = v_pantry_item_id
        AND pet_id = v_pet_id;
    END IF;
  END IF;

  -- Mark switch completed + persist outcome
  UPDATE safe_switches
  SET status = 'completed',
      completed_at = NOW(),
      outcome_summary = p_outcome_summary
  WHERE id = p_switch_id;
END;
$$;

COMMENT ON FUNCTION complete_safe_switch_with_pantry_swap IS
  'M9 Phase C: atomic Safe Switch completion. Swaps pantry_items.product_id, applies new serving size, and flips status to completed. Called from safeSwitchService.completeSafeSwitch. SECURITY INVOKER respects RLS.';

COMMIT;
