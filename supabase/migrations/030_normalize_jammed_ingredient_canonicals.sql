-- Migration 030: Normalize jammed ingredient canonical names
--
-- PROBLEM
-- Some rows in `ingredients_dict` were imported without underscore separators
-- (e.g. "meatbyproducts" instead of "meat_by_products"). Canonical names are
-- expected to be snake_case across the codebase — the v7 ingestion pipeline
-- dropped separators for certain compound names.
--
-- IMPACT
-- This is a real functional bug, not just a display issue:
--   * `src/components/scoring/ConcernTags.tsx:85` matches on the proper snake_case
--     forms ('meat_by_products', 'poultry_by_product_meal'). Rows with the jammed
--     form never satisfy the membership check, so the "Unnamed Source" concern
--     tag silently fails to fire on affected products.
--   * `src/utils/formatters.ts` has a DISPLAY_NAME_OVERRIDES band-aid that renders
--     the jammed form as "Meat By-Products" at the UI layer. That map stays in
--     place as a defensive fallback but should become dead code after this migration.
--
-- SAFETY
-- `ingredients_dict.id` is the UUID primary key; `product_ingredients.ingredient_id`
-- references the UUID. Renaming `canonical_name` values does not break any FK
-- relationships. The scoring engine uses severity flags (`is_unnamed_species`,
-- `dog_base_severity`, etc.), not canonical_name string matching, so scores are
-- not affected.
--
-- COLLISION HANDLING
-- `canonical_name` has a UNIQUE constraint. For each jammed→proper pair:
--   * If only the jammed row exists: rename in place (simple UPDATE).
--   * If both exist: merge by reassigning product_ingredients rows from the
--     jammed id to the proper id, then delete the jammed row.
--   * If only the proper row exists: no-op.
--
-- DISCOVERY
-- The DO block emits NOTICEs for any canonical_name that looks like a jammed
-- compound (contains "byproduct" without separators, or is longer than 15 chars
-- with no underscore at all). Review the logs after running — new entries there
-- indicate other jammed names that should be added to this migration's list.

-- ─── Step 1: Discovery — log potentially jammed canonicals not in fix list ──

DO $$
DECLARE
  r RECORD;
  known_jammed TEXT[] := ARRAY[
    'meatbyproducts',
    'poultrybyproducts',
    'chickenbyproducts',
    'beefbyproducts',
    'meatbyproductmeal',
    'poultrybyproductmeal'
  ];
BEGIN
  FOR r IN
    SELECT canonical_name FROM ingredients_dict
    WHERE (
      canonical_name ~ 'byproduct'
      OR (length(canonical_name) >= 15 AND position('_' IN canonical_name) = 0)
    )
    AND canonical_name != ALL(known_jammed)
    ORDER BY canonical_name
  LOOP
    RAISE NOTICE 'Potential jammed canonical NOT in fix list: %', r.canonical_name;
  END LOOP;
END $$;

-- ─── Step 2: Rename or merge each known jammed canonical ──

DO $$
DECLARE
  jammed_list TEXT[] := ARRAY[
    'meatbyproducts',
    'poultrybyproducts',
    'chickenbyproducts',
    'beefbyproducts',
    'meatbyproductmeal',
    'poultrybyproductmeal'
  ];
  proper_list TEXT[] := ARRAY[
    'meat_by_products',
    'poultry_by_products',
    'chicken_by_products',
    'beef_by_products',
    'meat_by_product_meal',
    'poultry_by_product_meal'
  ];
  jammed_name TEXT;
  proper_name TEXT;
  jammed_id UUID;
  proper_id UUID;
  reassigned_count INT;
BEGIN
  IF array_length(jammed_list, 1) <> array_length(proper_list, 1) THEN
    RAISE EXCEPTION 'jammed_list and proper_list length mismatch — aborting';
  END IF;

  FOR i IN 1 .. array_length(jammed_list, 1) LOOP
    jammed_name := jammed_list[i];
    proper_name := proper_list[i];

    SELECT id INTO jammed_id FROM ingredients_dict WHERE canonical_name = jammed_name;

    IF jammed_id IS NULL THEN
      -- Nothing to fix for this pair
      CONTINUE;
    END IF;

    SELECT id INTO proper_id FROM ingredients_dict WHERE canonical_name = proper_name;

    IF proper_id IS NULL THEN
      -- Simple rename — no collision
      UPDATE ingredients_dict
      SET canonical_name = proper_name
      WHERE id = jammed_id;

      RAISE NOTICE 'Renamed % → % (id=%)', jammed_name, proper_name, jammed_id;
    ELSE
      -- Merge — reassign product_ingredients from jammed id to proper id,
      -- then delete the now-orphaned jammed row. ON DELETE CASCADE on
      -- product_ingredients is NOT triggered here because we reassign first.
      UPDATE product_ingredients
      SET ingredient_id = proper_id
      WHERE ingredient_id = jammed_id;
      GET DIAGNOSTICS reassigned_count = ROW_COUNT;

      DELETE FROM ingredients_dict WHERE id = jammed_id;

      RAISE NOTICE 'Merged % into % (% product_ingredients rows reassigned)',
        jammed_name, proper_name, reassigned_count;
    END IF;
  END LOOP;
END $$;

-- ─── Step 3: Invalidate pet_product_scores cache for affected products ──
--
-- Numeric scores do not change (engine uses severity flags, not names), but
-- the ConcernTags "Unnamed Source" pill will newly fire on affected products.
-- Concern tags are rendered fresh from ingredient data at view time, not from
-- pet_product_scores. This DELETE is a belt-and-suspenders invalidation — it
-- guarantees the next view computes any state that *might* depend on the
-- normalized canonical_name (and no-ops otherwise).

DELETE FROM pet_product_scores
WHERE product_id IN (
  SELECT DISTINCT pi.product_id
  FROM product_ingredients pi
  JOIN ingredients_dict d ON d.id = pi.ingredient_id
  WHERE d.canonical_name IN (
    'meat_by_products',
    'poultry_by_products',
    'chicken_by_products',
    'beef_by_products',
    'meat_by_product_meal',
    'poultry_by_product_meal'
  )
);
