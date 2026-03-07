# M3 Import Pipeline

Imports `kiba_cleaned.json` (8,868 pre-scraped products) into Supabase.

## Prerequisites

```bash
pip install supabase python-dotenv
```

Environment variables (set in `.env` at project root or export in shell):
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (bypasses RLS)

## Usage

```bash
# Dry run (validates and maps data, no writes)
python3 scripts/import/import_products.py --dry-run

# Import first 100 records (test batch)
python3 scripts/import/import_products.py --limit 100

# Full import
python3 scripts/import/import_products.py
```

Run from the project root directory (`kiba-app/`).

## What It Does

1. **Validates** each record (brand, product_name, category, target_species required)
2. **Inserts into `products`** table with field mapping:
   - `source` = 'scraped' for all records
   - `nutritional_data_source` = 'manual' when GA data present
   - `score_confidence` = 'high' (ingredients + GA), 'partial' (otherwise)
   - `is_grain_free` = true/false ('unknown' maps to false per NOT NULL constraint)
   - `needs_review` = true when `_ingredient_status == 'borderline'`
   - `last_verified_at` = import timestamp
   - `ingredients_hash` computed per D-044 (SHA-256 of normalized string)
3. **Inserts into `product_upcs`** junction table (645 products have no UPC)
4. Supplements are stored but NOT parsed into product_ingredients (D-096)

## Output Files

- `scripts/import/import_errors.json` - All validation + insert errors with context

## Expected Output

For full 8,868 record import:
- ~8,868 products inserted (0 expected validation failures)
- ~8,850+ UPC rows (645 products have no barcode, some have multiple UPCs)
- Category split: ~3,466 daily_food, ~2,990 treats, ~2,412 supplements
- Species split: ~5,205 dog, ~3,663 cat

## Schema Notes

- `is_grain_free`: Schema is `BOOLEAN NOT NULL DEFAULT false`. The dataset has
  'yes'/'no'/'unknown'. 'unknown' maps to false (we don't flag products we're
  unsure about as grain-free).
- `score_confidence`: Schema is `TEXT NOT NULL DEFAULT 'high'`. Records with no
  ingredients get 'partial' (null not allowed by constraint).
- `ga_calcium_pct` and `ga_phosphorus_pct` columns exist in schema and are populated
  from the dataset's `calcium_pct` and `phosphorus_pct` fields.

## Troubleshooting

- **"SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set"**: Check your `.env`
  file exists at project root with both variables.
- **Batch insert failures**: The pipeline falls back to one-by-one inserts on batch
  failure. Check `import_errors.json` for specifics.
- **Duplicate UPC errors**: Expected if re-running. UPC is a primary key. Clear the
  tables first or use `--limit` for testing.
- **Rate limits**: Batches of 100 with no artificial delay. If hitting limits, reduce
  `BATCH_SIZE` in `config.py`.
