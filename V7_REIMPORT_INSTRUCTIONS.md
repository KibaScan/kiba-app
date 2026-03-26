# v7 Reimport — Claude Code Instructions

## Overview
Wipe and reimport all product data from `dataset_kiba_v7_master.json` (19,058 products from Chewy + Amazon + Walmart). This adds DMB pre-computation, AAFCO inference, supplemental classification, and 10,000 new products.

## Prerequisites
1. Copy `dataset_kiba_v7_master.json` into `scripts/import/` (or update `config.py` JSON_PATH to point to it)
2. Copy the updated `import_products.py` into `scripts/import/` (replacing the old one)
3. Copy `020_v7_enrichment_columns.sql` into `supabase/migrations/`

## Step-by-Step

### Step 1: Run the migration
```bash
# From project root
supabase db push
# Or if using remote:
# supabase db push --linked
```
This adds the new columns (DMB fields, is_supplemental, aafco_inference, retailer IDs, etc.) to the products table. Safe to run even if some columns already exist (uses IF NOT EXISTS).

### Step 2: Wipe existing data (FK order matters)
```sql
-- Run in Supabase SQL Editor or via supabase db reset
-- ORDER MATTERS: child tables first, then parent

-- 1. Junction tables
TRUNCATE product_ingredients CASCADE;

-- 2. UPCs
TRUNCATE product_upcs CASCADE;

-- 3. Products (this is the parent — must be last)
TRUNCATE products CASCADE;

-- Note: ingredients_dict is NOT wiped — we keep the seed data + synonyms
-- Note: user data (pets, scans, pantry) references products via product_id
--        TRUNCATE CASCADE will null those FKs. If you want to preserve user data,
--        use DELETE instead and handle orphaned references.
```

### Step 3: Update config.py
Make sure `JSON_PATH` in `scripts/import/config.py` points to the v7 master:
```python
JSON_PATH = Path(__file__).resolve().parent / 'dataset_kiba_v7_master.json'
```

### Step 4: Dry run first
```bash
cd ~/kiba-app
python3 scripts/import/import_products.py --dry-run --limit 100
```
Verify:
- [ ] No validation errors on the first 100
- [ ] Field mapping looks correct (check the log)
- [ ] DMB fields showing up
- [ ] AAFCO inference counts make sense

### Step 5: Full import
```bash
python3 scripts/import/import_products.py
```
Expected output:
- ~19,058 products inserted
- ~14,620 UPCs inserted
- Products by source: ~15,745 Chewy + ~3,182 Amazon + ~131 Walmart
- DMB computed: ~11,378
- AAFCO yes: ~5,719, likely: ~2,201

### Step 6: Parse ingredients
```bash
python3 scripts/import/parse_ingredients.py --dry-run --limit 200
```
Check match rate. If >95%, run full:
```bash
python3 scripts/import/parse_ingredients.py
```

### Step 7: Cleanup
```bash
python3 scripts/import/cleanup_ingredients.py --dry-run
# Review output, then:
python3 scripts/import/cleanup_ingredients.py
```

### Step 8: Verify Blue Buffalo fix
```sql
SELECT name, aafco_statement, aafco_inference, 
       ga_protein_pct, ga_protein_dmb_pct,
       is_supplemental
FROM products 
WHERE brand = 'Blue Buffalo' 
  AND name ILIKE '%Life Protection%Small Breed%Adult%Chicken%'
LIMIT 5;
```
Expected: `aafco_statement = 'yes'`, `aafco_inference = 'ga_dmb_pass'`, `ga_protein_dmb_pct ≈ 28.9`

### Step 9: Verify supplemental classification
```sql
SELECT name, aafco_statement, is_supplemental, product_form
FROM products 
WHERE is_supplemental = TRUE
ORDER BY name
LIMIT 10;
```
Expected: toppers/mixers/bone broth with `aafco_statement = NULL`

## New Fields Reference

| Field | Type | Source | Purpose |
|---|---|---|---|
| ga_protein_dmb_pct | NUMERIC | Computed | Scoring engine + UI display |
| ga_fat_dmb_pct | NUMERIC | Computed | Scoring engine + UI display |
| ga_fiber_dmb_pct | NUMERIC | Computed | Scoring engine + UI display |
| ga_calcium_dmb_pct | NUMERIC | Computed | Ca:P ratio checks |
| ga_phosphorus_dmb_pct | NUMERIC | Computed | Ca:P ratio checks |
| ga_taurine_dmb_pct | NUMERIC | Computed | DCM mitigation check |
| ga_omega3_dmb_pct | NUMERIC | Computed | Skin/coat scoring |
| ga_omega6_dmb_pct | NUMERIC | Computed | Skin/coat scoring |
| ga_kcal_per_kg_dmb | NUMERIC | Computed | Caloric density comparison |
| is_supplemental | BOOLEAN | Enrichment | Pipeline bypass (D-136/D-146) |
| aafco_inference | TEXT | Enrichment | Audit trail for AAFCO derivation |
| product_form | TEXT | Scraper | UI display (dry/wet/freeze-dried) |
| image_url | TEXT | Scraper | Product card image |
| source_url | TEXT | Scraper | "View on retailer" link |
| chewy_sku | TEXT | Scraper | Cross-retailer dedup |
| asin | TEXT | Scraper | Cross-retailer dedup |
| walmart_id | TEXT | Scraper | Cross-retailer dedup |

## Rollback
If something goes wrong, the old v6 dataset is still in `dataset_kiba_v6_merged.json`. Revert `import_products.py`, re-run the import with the old file.
