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

---

## M4 Pre-Session 2: Ingredient Severity Alignment Fix (2026-03-07)

**Problem:** M3 ingredient parser created variant rows in `ingredients_dict` with default `neutral` severity when they should have inherited the parent's severity from the master list. Examples:
- `fd&c_red_40` (neutral) should match `red_40` (caution)
- `red_40_lake` (neutral) should match `red_40` (caution)
- `soy_flour` (neutral) should match `soy` (caution)
- `menadione_sodium_bisulfite` (neutral) should match `menadione` (caution)

**Root cause:** Parser stored ingredient names with batch codes, FD&C prefixes, lake/color suffixes, and recipe name leakage — creating separate DB rows that never matched the master list severity assignments.

**Fix:** Updated `dog_base_severity` and `cat_base_severity` on 862 variant rows to match their parent ingredient's severity. No scoring engine changes.

**Categories fixed:**
- 737 HIGH confidence: parser artifacts (batch codes, recipe leakage), FD&C prefixes, lake/color suffixes
- 122 MEDIUM confidence: sub-ingredient forms (soy_flour, wheat_gluten, etc.)
- 3 COMPOUND fixes: entries containing concern ingredients (mixed_tocopherols_and_bha, etc.)

**Excluded (4 edge cases):** brown_rice_syrup, corn_sugar, salmon_by_product(s)

**Impact on category averages:**
| Segment | Before | After | Delta |
|---------|--------|-------|-------|
| daily_food x cat x grain-inclusive | 69.2 | 63.4 | -5.8 |
| daily_food x cat x grain-free | 75.1 | 73.9 | -1.2 |
| daily_food x dog x grain-inclusive | 74.0 | 72.7 | -1.3 |
| daily_food x dog x grain-free | 75.1 | 74.9 | -0.2 |
| treat x cat x grain-inclusive | 73.2 | 69.2 | -4.0 |
| treat x cat x grain-free | 73.2 | 71.6 | -1.6 |
| treat x dog x grain-inclusive | 81.7 | 79.4 | -2.3 |
| treat x dog x grain-free | 87.0 | 86.4 | -0.6 |

**Verification:** Pure Balance reference score = 69 (unchanged). 447 tests passing.

**SQL script:** `scripts/scoring/fix_severity_alignment.sql`
