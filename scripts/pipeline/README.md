# M3 Pipeline Utilities

## Formula Change Detection (D-044)

Compares re-scraped product data against stored Supabase products to detect
ingredient formula changes.

### Usage

```bash
# Dry run — compare only, no DB writes
python3 scripts/pipeline/detect_changes.py rescrape_data.json --dry-run

# Full run
python3 scripts/pipeline/detect_changes.py rescrape_data.json

# Limited batch
python3 scripts/pipeline/detect_changes.py rescrape_data.json --limit 100
```

### Input Format

Same schema as kiba_cleaned.json. Minimum required fields per record:

```json
{
  "product_name": "Adult Chicken & Rice",
  "brand": "Acme Pet Food",
  "ingredients_raw": "Chicken, Brown Rice, ...",
  "barcode_upc": "012345678901",
  "upcs": ["012345678901", "012345678902"]
}
```

### Matching Logic

1. **UPC match** — looks up `barcode_upc` and `upcs[]` against `product_upcs` table
2. **Brand + name fallback** — case-insensitive exact match on `(brand, name)`
3. **No match** — queued as new product for the import pipeline

### Hash Comparison (D-044)

Normalization: lowercase, collapse whitespace, standardize to comma-space, trim each entry.
Order is preserved (AAFCO labeling requires proportion ordering).

- Same hash = verified unchanged, updates `last_verified_at`
- Different hash = formula change detected

### On Formula Change

1. `score_confidence` set to `'under_review'`
2. Entry appended to `formula_change_log` JSONB array (append-only)
3. `ingredients_raw` and `ingredients_hash` updated
4. `product_ingredients` junction rows deleted and re-parsed
5. Score delta calculation deferred to Session 6

### Output

- `change_detection_report.json` — summary + per-product change details

### Requirements

```bash
pip install supabase python-dotenv
```

Environment variables (in `.env`):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Shared Utilities

### hash_utils.py

Shared ingredient hash normalization used by both the import pipeline
and change detection. Ensures consistent D-044 hashing across all scripts.

```python
from hash_utils import compute_ingredients_hash

hash_val = compute_ingredients_hash("Chicken, Brown Rice, Peas")
```
