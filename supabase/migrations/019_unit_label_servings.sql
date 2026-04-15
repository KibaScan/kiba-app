-- Migration 019: D-164 — Collapse unit_label to 'servings'
-- Removes cans/pouches/units options, replaces with single 'servings' value.

BEGIN;

-- Backfill existing rows
UPDATE pantry_items SET unit_label = 'servings'
  WHERE unit_label IN ('cans', 'pouches', 'units');

-- Drop old CHECK constraint and add new one
ALTER TABLE pantry_items DROP CONSTRAINT pantry_items_unit_label_check;
ALTER TABLE pantry_items ADD CONSTRAINT pantry_items_unit_label_check
  CHECK (unit_label IN ('servings'));

-- Update default
ALTER TABLE pantry_items ALTER COLUMN unit_label SET DEFAULT 'servings';

COMMIT;
