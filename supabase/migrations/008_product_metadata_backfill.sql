-- 008: Add dropped dataset fields to products table
-- Source: dataset_kiba_v6_merged.json fields that were not mapped during M3 import
-- Backfill via scripts/data/backfill_product_metadata.py

ALTER TABLE products ADD COLUMN IF NOT EXISTS is_vet_diet BOOLEAN DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS special_diet TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS feeding_guidelines TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;

COMMENT ON COLUMN products.is_vet_diet IS 'TRUE for veterinary/prescription diet products. From scraper _is_vet_diet flag. ~125 products in v6 dataset.';
COMMENT ON COLUMN products.special_diet IS 'Comma-separated diet tags from Chewy: high-protein, limited-ingredient, urinary-health, veterinary, sensitive, weight-management, indoor, hairball, veterinary-mention. NULL = no special diet.';
COMMENT ON COLUMN products.image_url IS 'Product image URL from Chewy scraper. Used for scan result display.';
COMMENT ON COLUMN products.feeding_guidelines IS 'Full feeding guidelines text from scraper. Used by D-136 supplemental classifier — may contain intermittent/supplemental language not in aafco_statement.';
COMMENT ON COLUMN products.source_url IS 'Original product page URL from Chewy scraper. Used for debugging and future rescrapes.';
