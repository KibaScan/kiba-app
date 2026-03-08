# Kiba App - Claude Code Memory

## M3 Session 1 - Data Import (Completed 2026-03-06)

- Import script: `scripts/import_products.py` — imports kiba_cleaned.json into Supabase
- 8,868 products imported (3,466 daily_food / 2,990 treats / 2,412 supplements)
- 8,952 UPCs, 143,087 product_ingredients junction rows
- 5,859 total ingredients in dict (121 original M1 + 5,738 new from import)
- Supplements stored but NOT ingredient-parsed (D-096)
- `ga_calcium_pct` and `ga_phosphorus_pct` columns missing from prod DB — need migration 004
- Existing Pure Balance reference product preserved (id: afd04040-425b-5742-9100-9e370c1c3cc9)

## DB Connection

- Supabase URL: https://jvvdghwbikwrzrowmlmt.supabase.co
- Credentials in `.env` file (service role key for server-side scripts)
- Use `supabase-py` (installed via --break-system-packages)

## Key Patterns

- Ingredient normalization: strip parens/brackets, lowercase, underscores, synonym map in import script
- D-044 hash: lowercase, collapse whitespace, comma-space separators, SHA-256 (order preserved)
- Batch size 100 for Supabase REST API inserts; one-by-one fallback on batch errors
