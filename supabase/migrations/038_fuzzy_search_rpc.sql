-- Migration 038: High-performance fuzzy search RPC
-- Replaces ILIKE substring matching with pg_trgm word similarity.
-- pg_trgm already enabled in migration 029.

-- ─── 1. Functional GIN index for cross-column search ──────
-- Separate indexes on name/brand (from 029) can't serve queries that
-- span both columns. This index lets the <% operator do a bitmap scan
-- on the concatenated string instead of a sequential scan.

CREATE INDEX IF NOT EXISTS idx_products_brand_name_trgm
ON products USING gin ((brand || ' ' || name) gin_trgm_ops);

-- ─── 2. Fuzzy search RPC ──────────────────────────────────

CREATE OR REPLACE FUNCTION search_products_fuzzy(
  search_query text,
  p_species text,
  p_category text DEFAULT NULL,
  p_product_form text DEFAULT NULL,
  p_is_supplemental boolean DEFAULT NULL,
  p_is_vet_diet boolean DEFAULT false
) RETURNS SETOF products
LANGUAGE sql STABLE
SET pg_trgm.word_similarity_threshold = 0.3
AS $$
  SELECT p.*
  FROM products p
  WHERE p.target_species = p_species
    AND p.is_recalled = false
    AND COALESCE(p.is_variety_pack, false) = false
    AND p.needs_review = false
    AND p.category != 'supplement'
    AND COALESCE(p.is_vet_diet, false) = p_is_vet_diet
    AND (p_category IS NULL OR p.category = p_category)
    AND (p_is_supplemental IS NULL OR COALESCE(p.is_supplemental, false) = p_is_supplemental)
    AND (
      p_product_form IS NULL
      OR (p_product_form = 'freeze_dried' AND p.product_form IN ('freeze_dried', 'freeze-dried'))
      OR (p_product_form = 'other' AND (p.product_form IS NULL OR p.product_form NOT IN ('dry', 'wet', 'freeze_dried', 'freeze-dried')))
      OR p.product_form = p_product_form
    )
    AND search_query <% (p.brand || ' ' || p.name)
  ORDER BY
    word_similarity(search_query, p.brand || ' ' || p.name) DESC,
    p.name ASC
  LIMIT 50;
$$;
