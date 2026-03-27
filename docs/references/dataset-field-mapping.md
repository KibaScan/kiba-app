# Dataset Field Mapping — Product Data → Supabase

> Documents which fields from the scraped datasets were imported into the products table,
> which were dropped, and why.
>
> Last updated: March 26, 2026 (v7 reimport — migration 020, 19,058 products from Chewy + Amazon + Walmart)

---

## Source

- **Current dataset:** v7 reimport (March 25, 2026) — 19,058 products from Chewy, Amazon, Walmart
- **Previous:** v6 merged (9,089 records, Chewy only) — fully superseded by v7
- **Import script:** `scripts/import/import_products.py`
- **Latest enrichment (migration 020):** Pre-computed DMB columns, AAFCO inference audit trail, retailer dedup IDs

---

## Mapped Fields (28)

Fields imported into the `products` table (or `product_upcs`):

| Dataset Field | DB Column | Notes |
|---|---|---|
| `brand` | `products.brand` | Direct |
| `product_name` | `products.name` | Renamed |
| `category` | `products.category` | Direct |
| `target_species` | `products.target_species` | Direct |
| `aafco_statement` | `products.aafco_statement` | `'unknown'` → NULL |
| `life_stage_claim` | `products.life_stage_claim` | Direct |
| `preservative_type` | `products.preservative_type` | Validated against `natural/synthetic/mixed/unknown` |
| `protein_min_pct` | `products.ga_protein_pct` | Renamed with `ga_` prefix |
| `fat_min_pct` | `products.ga_fat_pct` | Renamed with `ga_` prefix |
| `fiber_max_pct` | `products.ga_fiber_pct` | Renamed with `ga_` prefix |
| `moisture_max_pct` | `products.ga_moisture_pct` | Renamed with `ga_` prefix |
| `calcium_pct` | `products.ga_calcium_pct` | Renamed with `ga_` prefix |
| `phosphorus_pct` | `products.ga_phosphorus_pct` | Renamed with `ga_` prefix |
| `kcal_per_cup` | `products.ga_kcal_per_cup` | Renamed with `ga_` prefix |
| `kcal_per_kg` | `products.ga_kcal_per_kg` | Renamed with `ga_` prefix |
| `taurine_pct` | `products.ga_taurine_pct` | Renamed with `ga_` prefix |
| `dha_pct` | `products.ga_dha_pct` | Renamed with `ga_` prefix |
| `omega3_pct` | `products.ga_omega3_pct` | Renamed with `ga_` prefix |
| `omega6_pct` | `products.ga_omega6_pct` | Renamed with `ga_` prefix |
| `ingredients_raw` | `products.ingredients_raw` | Direct |
| `is_grain_free` | `products.is_grain_free` | `'yes'` → true, else false |
| `barcode_upc` | `product_upcs.upc` | Junction table, not products |
| `feeding_guidelines` | `products.feeding_guidelines` | **Migration 008** — was dropped, now backfilled |
| `_is_vet_diet` | `products.is_vet_diet` | **Migration 008** — was dropped, now backfilled |
| `special_diet` | `products.special_diet` | **Migration 008** — was dropped, now backfilled |
| `image_url` | `products.image_url` | **Migration 008** — was dropped, now backfilled |
| `source_url` | `products.source_url` | **Migration 008** — was dropped, now backfilled |

### Derived at import time (not direct field mappings)

| Logic | DB Column | Source Fields |
|---|---|---|
| `'scraped'` constant | `products.source` | — |
| `_qa_has_ingredients && _qa_has_ga` → `'high'`, else `'partial'` | `products.score_confidence` | `_qa_has_ingredients`, `_qa_has_ga` |
| `'manual'` if `_qa_has_ga`, else NULL | `products.nutritional_data_source` | `_qa_has_ga` |
| `compute_ingredients_hash(ingredients_raw)` | `products.ingredients_hash` | `ingredients_raw` |
| `false` constant | `products.is_recalled` | — |
| `now()` | `products.last_verified_at` | — |

---

## Dropped Fields — Intentionally Excluded (7)

Scraper/QA metadata with no product-level value:

| Dataset Field | Reason |
|---|---|
| `_phase` | Scraper batch identifier (e.g., "phase1", "phase2") — internal tracking only |
| `_qa_has_ga` | Used for `score_confidence` derivation, not stored directly |
| `_qa_has_ingredients` | Used for `score_confidence` derivation, not stored directly |
| `_qa_has_upc` | QA flag — redundant with checking `barcode_upc` presence |
| `_scraped_at` | Scraper timestamp — we set `last_verified_at` at import time instead |
| `_ing_strategy` | Parser strategy metadata (e.g., "standard", "variety_pack") |
| `source_type` | Always `'scraped'` — hardcoded as `products.source` |

---

## Dropped Fields — Deferred for Future Use (14)

These have potential value but no current consumer in the app:

| Dataset Field | Potential Use | Priority |
|---|---|---|
| `epa_pct` | EPA omega-3 subtype — paired with DHA for cardiovascular scoring | Medium (M5+ if NP bucket expands) |
| `linoleic_acid_pct` | Omega-6 subtype — AAFCO has a minimum for dogs (1.0% DMB) | Medium (NP bucket expansion) |
| `nasc_certified` | NASC quality seal — relevant for supplement confidence | Low (M16+ supplement scoring) |
| `product_form` | Kibble/wet/raw/freeze-dried — useful for UI display and portion logic | Medium (M5 pantry serving format) |
| `product_size` | Package size — needed for pantry bag countdown (D-065) | Medium (M5 pantry) |
| `breed_size` | Product-targeted breed size (e.g., "small breed formula") | Low (display only) |
| `chewy_sku` | Chewy SKU for affiliate link construction | Low (M6 affiliate) |
| ~~`source_url`~~ | ~~Moved to Mapped — Migration 008~~ | — |
| `description` | Product marketing description text | Low (display) |
| `made_in` | Country of origin (e.g., "USA", "Canada") | Low (display) |
| `rating` | Chewy user rating (1-5 stars) | Low (M8 Kiba Index context) |
| `review_count` | Chewy review count | Low (M8 Kiba Index context) |
| `price` | Product price at scrape time | Low (M6 value comparisons) |
| `price_currency` | Currency code (always "USD" for Chewy) | Low (M6) |
| `price_size` | Price-per-unit label from Chewy | Low (M6) |
| `notes` | Scraper notes (edge cases, warnings) | Low |
| `ingredient_type` | Scraper-assigned ingredient classification hint | Low |

---

## Dataset Statistics (v7)

| Metric | Count |
|---|---|
| Total products | 19,058 |
| Sources | Chewy + Amazon + Walmart |
| With `ingredients_raw` | ~18,500 |
| With GA data | ~12,000 |
| With UPC | ~16,000 |
| `is_vet_diet = true` | ~200 |

v6 stats (historical): 9,089 records, Chewy only.

---

## v7 Enrichment Fields (Migration 020)

| DB Column | Purpose |
|---|---|
| `ga_protein_dmb_pct` (+ fat, fiber, Ca, P) | Pre-computed DMB values — avoids runtime conversion |
| `aafco_inference` | Derivation audit trail for inferred AAFCO status |
| `chewy_sku` | Chewy retailer ID for dedup + affiliate |
| `asin` | Amazon retailer ID |
| `walmart_id` | Walmart retailer ID |
| `image_url` | Product image URL |
| `source_url` | Source listing URL |
| `kcal_per_unit` | Per-unit calorie data |
| `unit_weight_g` | Unit weight in grams |
| `default_serving_format` | Default serving format hint |

---

## Migration History

| Migration | Fields Added |
|---|---|
| 001 | Initial schema — most GA columns, core product fields |
| 004 | `needs_review`, `contributed_by`, `user_corrected_*` (community) |
| 005 | `base_score`, `review_status` (batch scoring) |
| 007 | `is_supplemental` (D-136 classification) |
| 008 | `feeding_guidelines`, `is_vet_diet`, `special_diet`, `image_url`, `source_url` |
| 010 | `product_form` (kibble/wet/raw/freeze-dried) |
| 014 | `pantry_items`, `pantry_pet_assignments` tables |
| 017 | `push_tokens`, `user_settings` tables |
| 018 | `pet_appointments` table |
| **020** | **v7 enrichment: `ga_*_dmb_pct`, `aafco_inference`, `chewy_sku`, `asin`, `walmart_id`, `kcal_per_unit`, `unit_weight_g`, `default_serving_format`** |
