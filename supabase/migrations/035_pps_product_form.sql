-- Migration 035: Add product_form to pet_product_scores for form-aware cache maturity
-- Fixes: minority product forms (freeze-dried, raw, dehydrated) never get batch scored
-- because cache maturity check counts all forms, and dry+wet fill the 80% threshold.

BEGIN;

-- 1. Add column (nullable — some products have unknown form)
ALTER TABLE pet_product_scores
ADD COLUMN IF NOT EXISTS product_form TEXT;

-- 2. Backfill from products table
UPDATE pet_product_scores pps
SET product_form = p.product_form
FROM products p
WHERE pps.product_id = p.id
  AND pps.product_form IS NULL;

-- 3. Composite index for form-aware maturity checks + browse queries
CREATE INDEX IF NOT EXISTS idx_pps_pet_cat_form_score
ON pet_product_scores (pet_id, category, product_form, final_score DESC);

COMMIT;
