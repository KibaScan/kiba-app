# M3 LLM Nutritional Refinery

Extracts Guaranteed Analysis (GA) values from pet food products using Claude Haiku.
Targets ~514 products that have `ingredients_raw` but no GA data.

## Usage

```bash
# Dry run — process 5 products, no DB writes
python3 scripts/refinery/extract_ga.py --dry-run

# Process all products with missing GA
python3 scripts/refinery/extract_ga.py

# Process limited batch
python3 scripts/refinery/extract_ga.py --limit 50
```

## Requirements

```bash
pip install anthropic supabase python-dotenv
```

Environment variables (in `.env`):
- `ANTHROPIC_API_KEY` — Claude API key (server-side only, D-127)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Pipeline

1. Query products where `ingredients_raw IS NOT NULL` and `ga_protein_pct IS NULL`
2. Send each product to Claude Haiku for structured GA extraction
3. Validate extracted values against absolute + typical ranges (D-043)
4. Write valid results to Supabase, flag out-of-range for manual review

## Validation (D-043)

Values are validated as-fed (the scoring engine handles DMB conversion):

| Field | Absolute Range | Typical Range |
|-------|---------------|---------------|
| protein_min_pct | 0-80% | 5-55% |
| fat_min_pct | 0-50% | 2-30% |
| fiber_max_pct | 0-30% | 0.5-15% |
| moisture_max_pct | 0-85% | 5-82% |
| kcal_per_cup | 100-7000 | 200-600 |
| kcal_per_kg | 100-7000 | 2000-5500 |

Cross-validations:
- moisture >60% for dry product → reject
- protein + fat + fiber + moisture >100% → reject

## Output Files

- `refinery_results.json` — per-product extraction summary
- `flagged_for_review.json` — products with out-of-range values

## Cost

Uses `claude-haiku-4-5-20251001` ($0.80/MTok input, $4.00/MTok output).
~514 products at ~500 tokens/request ≈ $0.20-0.50 total.
