-- Migration 031: Safe Switch pantry coupling + pantry two-slot model (M9 Phase B)
-- Adds:
--   A. pantry_pet_assignments.slot_index (0|1, partial unique per pet, nullable for legacy/non-daily-food)
--   B. Backfill slot_index for existing daily food assignments (oldest-first, grandfather 3+)
--   C. safe_switches.pantry_item_id (FK, ON DELETE SET NULL, nullable for historical rows)
--   D. Backfill safe_switches.pantry_item_id via (old_product_id, pet_id) match
--   E. safe_switches.outcome_summary JSONB (persists computeSwitchOutcome + getOutcomeMessage at completion)
--   F. complete_safe_switch_with_pantry_swap RPC (atomic: swap pantry_items.product_id + mark switch completed)
--
-- Corresponds to plan file /Users/stevendiaz/.claude/plans/playful-giggling-platypus.md
-- Non-goals: no slot-aware diet completeness copy changes, no past-switches UI, no CompareScreen entry point.

BEGIN;

-- ─── A. pantry_pet_assignments.slot_index ────────────────────────

ALTER TABLE pantry_pet_assignments
  ADD COLUMN slot_index SMALLINT CHECK (slot_index IN (0, 1));

-- Enforces at most 2 slots per pet (slot 0 = primary, slot 1 = secondary).
-- Partial: grandfathered 3+ rows stay null, treats/supplements stay null.
CREATE UNIQUE INDEX pantry_pet_assignments_slot_unique
  ON pantry_pet_assignments (pet_id, slot_index)
  WHERE slot_index IS NOT NULL;

-- ─── B. Backfill slot_index for existing daily food assignments ─

DO $$
DECLARE
  pet_row RECORD;
  asgn RECORD;
  slot SMALLINT;
  grandfathered INT;
BEGIN
  FOR pet_row IN (SELECT DISTINCT pet_id FROM pantry_pet_assignments) LOOP
    slot := 0;
    grandfathered := 0;
    FOR asgn IN (
      SELECT ppa.id
      FROM pantry_pet_assignments ppa
      JOIN pantry_items pi ON pi.id = ppa.pantry_item_id
      JOIN products p ON p.id = pi.product_id
      WHERE ppa.pet_id = pet_row.pet_id
        AND pi.is_active = true
        AND p.category = 'daily_food'
        AND COALESCE(p.is_supplemental, false) = false
        AND COALESCE(p.is_vet_diet, false) = false
      ORDER BY ppa.created_at ASC
    ) LOOP
      IF slot < 2 THEN
        UPDATE pantry_pet_assignments SET slot_index = slot WHERE id = asgn.id;
        slot := slot + 1;
      ELSE
        grandfathered := grandfathered + 1;
      END IF;
    END LOOP;
    IF grandfathered > 0 THEN
      RAISE NOTICE 'Pet %: % grandfathered null-slot daily food assignments (3+ items)', pet_row.pet_id, grandfathered;
    END IF;
  END LOOP;
END $$;

-- ─── C. safe_switches.pantry_item_id ────────────────────────────

ALTER TABLE safe_switches
  ADD COLUMN pantry_item_id UUID REFERENCES pantry_items(id) ON DELETE SET NULL;

CREATE INDEX idx_safe_switches_pantry_item
  ON safe_switches (pantry_item_id)
  WHERE pantry_item_id IS NOT NULL;

-- ─── D. Backfill safe_switches.pantry_item_id ───────────────────

DO $$
DECLARE
  sw RECORD;
  pi_id UUID;
  unmatched INT := 0;
  matched INT := 0;
BEGIN
  FOR sw IN (SELECT id, old_product_id, pet_id FROM safe_switches) LOOP
    SELECT pi.id INTO pi_id
    FROM pantry_items pi
    JOIN pantry_pet_assignments ppa ON ppa.pantry_item_id = pi.id
    WHERE pi.product_id = sw.old_product_id
      AND ppa.pet_id = sw.pet_id
      AND pi.is_active = true
    LIMIT 1;

    IF pi_id IS NOT NULL THEN
      UPDATE safe_switches SET pantry_item_id = pi_id WHERE id = sw.id;
      matched := matched + 1;
    ELSE
      unmatched := unmatched + 1;
    END IF;
    pi_id := NULL;
  END LOOP;
  RAISE NOTICE 'safe_switches backfill: % matched, % unmatched', matched, unmatched;
END $$;

-- ─── E. safe_switches.outcome_summary ───────────────────────────

-- Shape: { outcome: SwitchOutcome, message: OutcomeMessage } from safeSwitchHelpers.ts
ALTER TABLE safe_switches
  ADD COLUMN outcome_summary JSONB;

-- ─── F. Atomic completion RPC ───────────────────────────────────
--
-- Swaps pantry_items.product_id and marks the switch completed in a single
-- plpgsql transaction. SECURITY INVOKER so existing RLS applies.
-- Called by safeSwitchService.completeSafeSwitch() (Phase 4).
-- Defense-in-depth: if pantry_item_id is NULL (historical row), skip the
-- pantry swap gracefully and still flip status.

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
BEGIN
  SELECT pantry_item_id, new_product_id, user_id
    INTO v_pantry_item_id, v_new_product_id, v_user_id
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
  -- Updated_at handled by trigger — do not set manually.
  IF v_pantry_item_id IS NOT NULL THEN
    UPDATE pantry_items
    SET product_id = v_new_product_id,
        quantity_remaining = 0
    WHERE id = v_pantry_item_id
      AND is_active = true;
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
  'M9 Phase B: atomic Safe Switch completion. Swaps pantry_items.product_id to the switch''s new_product_id and flips status to completed with outcome_summary JSONB. Called from safeSwitchService.completeSafeSwitch. SECURITY INVOKER respects RLS.';

COMMIT;
