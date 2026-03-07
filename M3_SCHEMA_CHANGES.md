# M3 Schema Changes — Quick Reference

> New columns and tables needed for M3. Migration file: `supabase/migrations/004_m3_community_products.sql`
> Create this migration in Session 4 before the community save code runs.

---

## `products` table — New Columns

```sql
-- D-128: Haiku product classification
ALTER TABLE products ADD COLUMN contributed_by UUID REFERENCES auth.users(id);
ALTER TABLE products ADD COLUMN haiku_suggested_category TEXT;  -- 'daily_food'|'treat'|'supplement'|'grooming'
ALTER TABLE products ADD COLUMN haiku_suggested_species TEXT;   -- 'dog'|'cat'|'all'
ALTER TABLE products ADD COLUMN user_corrected_category BOOLEAN DEFAULT false;
ALTER TABLE products ADD COLUMN user_corrected_species BOOLEAN DEFAULT false;

-- D-043: LLM-extracted GA disclaimer (column exists, just noting usage)
-- nutritional_data_source TEXT already exists ('manual'|'llm_extracted')
-- Session 2 sets this to 'llm_extracted' for Haiku GA extractions
```

### Column usage by session:

| Column | Set by | Value |
|--------|--------|-------|
| `contributed_by` | Session 4 (community save) | `auth.uid()` from Supabase JWT |
| `haiku_suggested_category` | Session 4 (Edge Function response) | Haiku's classification before user correction |
| `haiku_suggested_species` | Session 4 (Edge Function response) | Haiku's classification before user correction |
| `user_corrected_category` | Session 4 (ProductConfirmScreen) | `true` if user changed Haiku's category suggestion |
| `user_corrected_species` | Session 4 (ProductConfirmScreen) | `true` if user changed Haiku's species suggestion |
| `source` | Session 1 (import) / Session 4 (miss) | `'scraped'` for import, `'community'` for miss flow |
| `needs_review` | Session 4 (community save) | `true` for all community contributions |
| `nutritional_data_source` | Session 2 (Haiku refinery) | `'llm_extracted'` for Haiku GA values |

---

## No New Tables

M3 does not add new tables. All data fits into the existing schema:

- **Products** → `products` (new columns above)
- **UPC bindings** → `product_upcs` (existing junction)
- **Ingredients** → `product_ingredients` (existing junction)
- **Dictionary** → `ingredients_dict` (existing, gets new rows not new columns)
- **Scans** → `scans` (existing, paywall scan counting queries this)
- **TOS acceptance** → tracked via a flag in app local storage or a new `user_settings` approach (Session 5 decides implementation — may be AsyncStorage or Supabase)

---

## RLS Notes

- `contributed_by` does NOT get its own RLS policy — the `products` table is publicly readable (anyone can see any product). The column is for attribution only.
- Community-contributed products are visible to all users immediately (scores are deterministic, no moderation delay on the score itself — only `needs_review` flags the product data for Steven's review).

---

## Existing Columns M3 Populates (Not New)

These columns exist from the M0 schema but are empty until M3 fills them:

| Column | Table | Populated by |
|--------|-------|-------------|
| `ingredients_raw` | `products` | Session 1 (import from JSON) |
| `ingredients_hash` | `products` | Session 1 (hash normalization) |
| `ga_protein_pct` through `ga_probiotics_cfu` | `products` | Session 2 (Haiku GA extraction) |
| `score_confidence` | `products` | Session 1 (`'partial'` for truncated), Session 4 (`'partial'` for community) |
| `formula_change_log` | `products` | Session 3 (formula change detection) |
| `last_verified_at` | `products` | Session 3 (verification timestamp) |
| All rows in `product_ingredients` | junction | Session 1 (import pipeline) |
| New rows in `ingredients_dict` | dictionary | Session 1 (Haiku batch classification, `review_status = 'llm_generated'`) |
| New rows in `product_upcs` | junction | Session 1 (import) + Session 4 (community) |
