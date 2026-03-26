-- Migration: Add v7 enrichment columns to products table
-- DMB (Dry Matter Basis) pre-computed values for scoring engine + UI display
-- Supplemental classification, AAFCO inference tracking, retailer source fields

-- ─── DMB Fields ──────────────────────────────────────────────
-- Pre-computed from as-fed GA values: dmb = as_fed / (1 - moisture/100)
-- Scoring engine uses these directly; no recalculation at score time.
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_protein_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_fat_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_fiber_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_calcium_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_phosphorus_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_taurine_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_omega3_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_omega6_dmb_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_kcal_per_kg_dmb NUMERIC;

-- ─── Supplemental Classification ─────────────────────────────
-- Toppers, mixers, bone broth, goat milk — NOT primary food.
-- Scored with 65/35/0 weights (D-136/D-146), AAFCO not applicable.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_supplemental BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── AAFCO Inference Tracking ────────────────────────────────
-- How aafco_statement was derived: 'original' (scraper), 'ga_dmb_pass',
-- 'signal_based', 'not_applicable' (treats/supplements/toppers)
ALTER TABLE products ADD COLUMN IF NOT EXISTS aafco_inference TEXT;

-- ─── Product Display & Source Fields ─────────────────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_form TEXT;      -- dry, wet, freeze-dried, raw, topper
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;         -- product image for UI
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_url TEXT;        -- retailer page URL

-- ─── Retailer-Specific IDs ───────────────────────────────────
-- For dedup across retailers and future price/availability tracking
ALTER TABLE products ADD COLUMN IF NOT EXISTS chewy_sku TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS asin TEXT;              -- Amazon Standard ID
ALTER TABLE products ADD COLUMN IF NOT EXISTS walmart_id TEXT;

-- ─── Indexes for lookup ──────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_chewy_sku ON products (chewy_sku) WHERE chewy_sku IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_asin ON products (asin) WHERE asin IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_walmart_id ON products (walmart_id) WHERE walmart_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_is_supplemental ON products (is_supplemental) WHERE is_supplemental = TRUE;

-- ─── Omega3/Omega6 as-fed (may not exist yet) ───────────────
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_omega3_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_omega6_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_epa_pct NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS ga_linoleic_acid_pct NUMERIC;
