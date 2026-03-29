-- Migration 021: Safe Swap price columns
-- Adds price, price_currency, and product_size_kg for the "Great Value" slot
-- in Safe Swap recommendations (M6). These are best-effort enrichment columns —
-- NULLs are expected and handled by Safe Swap queries (value slot requires both).
--
-- Data source: v7 scraped dataset (Chewy ~83% price coverage, Walmart ~100%, Amazon 0%)
-- product_size_kg is parsed from product_size strings at import/backfill time.
--
-- Depends on: Migration 020 (v7 enrichment columns)
-- Related: M6_SAFE_SWAP_COMPARE_SPEC.md §10

ALTER TABLE products ADD COLUMN IF NOT EXISTS price NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_currency TEXT DEFAULT 'USD';
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_size_kg NUMERIC;

-- Index for the value slot query: ORDER BY price/product_size_kg ASC
-- Partial index — only rows with both values are candidates for value ranking
CREATE INDEX IF NOT EXISTS idx_products_price_per_kg
  ON products ((price / NULLIF(product_size_kg, 0)))
  WHERE price IS NOT NULL AND product_size_kg IS NOT NULL AND product_size_kg > 0;

COMMENT ON COLUMN products.price IS 'Scraped retail price in price_currency (best-effort, NULL for many Amazon products)';
COMMENT ON COLUMN products.price_currency IS 'ISO currency code, default USD. Only USD products used in value comparisons.';
COMMENT ON COLUMN products.product_size_kg IS 'Normalized product weight in kg, parsed from product_size string. NULL for count/pack items.';
