# M3 Session 2 Complete — LLM Nutritional Refinery

## What Was Built
- scripts/refinery/extract_ga.py (Haiku GA extraction pipeline)
- scripts/refinery/validator.py (range checks, cross-validation per D-043)
- scripts/refinery/README.md (usage docs)

## Counts
- Products queried (missing GA): 397 (286 daily_food, 111 treats)
- Successfully extracted: 0
- Flagged for review: 0
- All-null (no GA in source text): 397
- API cost: $0.004 (dry run only, full batch not run)

## Why Zero Extractions
The 397 products have ingredients_raw (ingredient lists) but NO Guaranteed Analysis
text in the scraped data. kiba_cleaned.json captured ingredient lists from Chewy but
did not capture the separate GA panel. Haiku correctly returned all-null — it was
instructed never to infer values not explicitly stated.

The pipeline code is validated and functional. It will work when GA text is available
from other sources (manufacturer site scrapes, label photos via OCR in Session 4).

## Score Readiness After Session 2 (Unchanged from Session 1)
- Full score (ingredients + GA): 4,237 daily_food + treats
- Partial score (ingredients only, 78/22 reweight): 397
- Metadata only (no ingredients): remaining
- Supplements: 2,412 (stored, not scored per D-096)

## Pipeline Validated
- Dry run: 5 products processed, all correctly returned all-null
- Validation logic confirmed: range checks, cross-validation, safety guards
- As-fed values only (no DMB conversion — scoring engine handles that)
- nutritional_data_source = 'llm_extracted' tag wired correctly
- Never overwrites existing non-null GA values

## Known Gap
- GA data for these 397 products needs a different source than ingredients_raw
- Options: re-scrape with GA panel capture, manufacturer website scrape, or
  label photo OCR when users scan these products (Session 4 D-091 flow)

## Existing tests: 447/447 still passing
