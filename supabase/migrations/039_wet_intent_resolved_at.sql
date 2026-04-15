-- Migration 039: wet_intent_resolved_at — tracks whether the user has
-- resolved the wet-food intent intercept on FeedingIntentSheet.
-- See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md

BEGIN;

ALTER TABLE pets
  ADD COLUMN IF NOT EXISTS wet_intent_resolved_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: existing pets skip the intercept on their next add.
-- Applies to: pets already on non-dry_only feeding_style, OR pets with
-- any active cross-format pantry assignment (wet item or topper).
UPDATE pets SET wet_intent_resolved_at = NOW()
WHERE feeding_style != 'dry_only'
   OR id IN (
     SELECT DISTINCT ppa.pet_id
     FROM pantry_pet_assignments ppa
     JOIN pantry_items pi ON pi.id = ppa.pantry_item_id
     JOIN products p ON p.id = pi.product_id
     WHERE pi.is_active = true
       AND (p.product_form != 'dry' OR p.is_supplemental = true)
   );

-- Cache invalidation not needed: wet_intent_resolved_at is a UI gate,
-- not a scoring input. pet_product_scores is unaffected.

COMMIT;
