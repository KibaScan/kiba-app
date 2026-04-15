-- Migration 033: Add new_serving_size_unit to safe_switches (Phase C fix)
--
-- Migration 032 added new_serving_size and new_feedings_per_day but omitted
-- the unit. Without it, a dry→wet Safe Switch completion writes the wet food's
-- serving amount but leaves serving_size_unit as the old food's 'cups',
-- breaking depletion math and display.

BEGIN;

-- ─── A. Add serving size unit column ──────────────────────
ALTER TABLE safe_switches
  ADD COLUMN new_serving_size_unit TEXT;

-- ─── B. Overwrite RPC to apply unit alongside size ────────
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
  v_new_serving_size_unit TEXT;
  v_new_feedings_per_day SMALLINT;
BEGIN
  SELECT pantry_item_id, new_product_id, user_id, pet_id,
         new_serving_size, new_serving_size_unit, new_feedings_per_day
    INTO v_pantry_item_id, v_new_product_id, v_user_id, v_pet_id,
         v_new_serving_size, v_new_serving_size_unit, v_new_feedings_per_day
  FROM safe_switches
  WHERE id = p_switch_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Safe switch % not found', p_switch_id;
  END IF;

  IF v_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Safe switch % does not belong to caller', p_switch_id;
  END IF;

  -- Swap pantry product_id + reset quantity to 0 so D-155 Restock flow picks up fresh-bag size.
  IF v_pantry_item_id IS NOT NULL THEN
    UPDATE pantry_items
    SET product_id = v_new_product_id,
        quantity_remaining = 0
    WHERE id = v_pantry_item_id
      AND is_active = true;

    -- Apply computed serving size, unit, and frequency from Phase C auto-math.
    IF v_new_serving_size IS NOT NULL AND v_new_feedings_per_day IS NOT NULL THEN
      UPDATE pantry_pet_assignments
      SET serving_size = v_new_serving_size,
          serving_size_unit = COALESCE(v_new_serving_size_unit, serving_size_unit),
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
  'M9 Phase C: atomic Safe Switch completion. Swaps pantry_items.product_id, applies new serving size + unit + frequency, and flips status to completed. Migration 033 adds serving_size_unit. SECURITY INVOKER respects RLS.';

COMMIT;
