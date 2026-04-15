-- Migration 029: Category browse infrastructure
-- Adds variety pack flag, browse indexes, trigram search, and browse counts RPC.

-- ─── 1. Variety pack column + backfill ─────────────────────

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_variety_pack BOOLEAN DEFAULT false;

-- Backfill: flag true variety packs and multi-product bundles.
-- "Bundle:" prefix = multi-product combos (e.g., "Bundle: Food A + Treats B")
-- "variety pack", "sampler", "assorted", "multi-pack" = obvious variety packs
-- Explicitly does NOT match "case of", "pack of", "N-lb bundle", "bundle of N"
UPDATE products SET is_variety_pack = true
WHERE name ~* '(variety\s*pack|sampler|assorted|multi[- ]?pack)'
   OR name ~* '^Bundle:';

-- Partial index for fast exclusion in browse queries
CREATE INDEX IF NOT EXISTS idx_products_variety_pack
ON products (is_variety_pack) WHERE is_variety_pack = true;

-- ─── 2. Trigram extension + text search indexes ────────────

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_products_name_trgm
ON products USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_products_brand_trgm
ON products USING gin (brand gin_trgm_ops);

-- ─── 3. Composite browse index ─────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_browse
ON products (target_species, category, is_variety_pack, is_recalled, is_vet_diet, needs_review);

-- ─── 4. Browse counts RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION get_browse_counts(p_species TEXT)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT json_build_object(
    'daily_food', COUNT(*) FILTER (
      WHERE category = 'daily_food'
        AND NOT COALESCE(is_supplemental, false)
        AND NOT COALESCE(is_vet_diet, false)
    ),
    'toppers_mixers', COUNT(*) FILTER (
      WHERE category = 'daily_food'
        AND COALESCE(is_supplemental, false)
    ),
    'treat', COUNT(*) FILTER (
      WHERE category = 'treat'
    ),
    'supplement', COUNT(*) FILTER (
      WHERE category = 'supplement'
    ),
    'daily_dry', COUNT(*) FILTER (
      WHERE category = 'daily_food'
        AND product_form = 'dry'
        AND NOT COALESCE(is_supplemental, false)
        AND NOT COALESCE(is_vet_diet, false)
    ),
    'daily_wet', COUNT(*) FILTER (
      WHERE category = 'daily_food'
        AND product_form = 'wet'
        AND NOT COALESCE(is_supplemental, false)
        AND NOT COALESCE(is_vet_diet, false)
    ),
    'daily_freeze_dried', COUNT(*) FILTER (
      WHERE category = 'daily_food'
        AND product_form IN ('freeze_dried', 'freeze-dried')
        AND NOT COALESCE(is_supplemental, false)
        AND NOT COALESCE(is_vet_diet, false)
    ),
    'daily_vet_diet', COUNT(*) FILTER (
      WHERE COALESCE(is_vet_diet, false)
    ),
    'daily_other', COUNT(*) FILTER (
      WHERE category = 'daily_food'
        AND (product_form IS NULL OR product_form NOT IN ('dry', 'wet', 'freeze_dried', 'freeze-dried'))
        AND NOT COALESCE(is_supplemental, false)
        AND NOT COALESCE(is_vet_diet, false)
    )
  )
  FROM products
  WHERE target_species IN (p_species, 'all')
    AND NOT COALESCE(is_variety_pack, false)
    AND NOT COALESCE(is_recalled, false)
    AND NOT COALESCE(needs_review, false);
$$;
