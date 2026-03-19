# Kiba M3 Prompt Guide — Data Pipeline + Paywall

> **Milestone:** M3 (Weeks 12–15)
> **Goal:** Populated product database. Premium tier functional.
> **Author:** Claude (QA/Strategy) → Claude Code (Implementation)
> **Date:** March 3, 2026
> **Prior art:** M2 Prompt Guide (1776 lines, 5 sessions) — this guide matches that standard.
> **M2 Final State:** 447/447 tests passing. Pure Balance regression = 69.

---

## How to Use This Guide

1. Read the **Pre-Session Checklist** before touching any code.
2. Consult the **Session Map** to know what you're building and where.
3. Each session has a **copy-paste ready prompt** in a fenced code block — paste it directly into Claude Code.
4. After each `/clear`, paste the **Preamble Template** for the next session so context carries over.
5. Each session ends with a **Verification Prompt** and a **Progress Doc** that feeds the next session.
6. **Constraint reminders** are baked into every prompt. Don't remove them.

---

## Pre-Session Checklist (Do This Once Before M3 Starts)

### 1. Update CLAUDE.md

Before any M3 code, apply these edits to `CLAUDE.md`:

```
□ Change "Current phase" to: M3 Data Pipeline + Paywall (M0 + M1 + M2 Complete)
□ Update decision count: 128 decisions (D-001 through D-124 existing + D-125 through D-128 added below)
□ Update test count: 447 tests passing
□ Add to project structure: scripts/ directory (Python pipeline scripts)
□ Add to project structure: supabase/functions/ directory (Edge Functions)
□ Add to "What NOT to Build":
    ❌ Modify scoring engine (M1 complete, M3 only populates data)
    ❌ Score supplements (M16+, D-096 — store only)
□ Add to Self-Check:
    □ Paywall logic ONLY in permissions.ts? (D-051)
    □ LLM-extracted GA validated before DB insertion? (D-043)
    □ API keys server-side only, never in app binary? (D-127)
    □ Hash normalization applied before ingredients_hash? (D-044)
```

### 2. Environment Setup

```
□ .env file in kiba-app/ root with:
    SUPABASE_URL=<https://jvvdghwbikwrzrowmlmt.supabase.co>
    SUPABASE_ANON_KEY=<your-anon-key>
    SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
    ANTHROPIC_API_KEY=<your-anthropic-key>              ← for LLM refinery scripts ONLY
    SCRAPEDO_API_KEY=<your-scrapedo-key>                ← for Chewy re-scrape (only proxy that bypasses Akamai)
    # NOTE: Once Chewy affiliate is approved, their API replaces Scrape.do entirely
    REVENUECAT_API_KEY=<your-revenuecat-key>            ← for paywall SDK
    # NOTE: UPCitemdb free tier needs NO API key — bare GET to /prod/trial/ endpoint
□ Python 3.10+ available (for pipeline scripts)
□ pip install supabase anthropic requests hashlib (pipeline deps)
□ Node.js 20+ (already have this from M0-M2)
□ EAS Build configured (required for RevenueCat native module)
```

### 3. Verify M2 State

```
□ cd kiba-app && npm test → 447/447 passing
□ All files from M2 file tree present (see M3_HANDOFF.md §13)
□ Supabase migrations 001-003 applied
□ permissions.ts contains stubs (isPremium → false, canAddPet → count < 1)
□ useScanStore has weeklyCount tracking
```

### 4. Dataset Ready

```
□ kiba_cleaned.json available (8,868 products, 31MB)
□ Verified: 4,119 daily_food+treat products with full ingredients + GA
□ Verified: 514 daily_food+treat products with ingredients but no GA (refinery candidates)
□ Verified: 2,412 supplements (store, do NOT score — D-096)
```

---

## Session Map — Quick Reference

| # | Domain | Environment | Key Deliverables | Duration | /clear or /compact |
|---|--------|-------------|-----------------|----------|-------------------|
| 1 | Data Import Pipeline | Python `scripts/` | Import 8,868 products → Supabase, parse ingredients → product_ingredients junction, compute ingredients_hash, map UPCs → product_upcs | ~2 hrs | START FRESH |
| 2 | LLM Nutritional Refinery | Python `scripts/` | Claude Haiku GA extraction for 514 products missing GA, Python validation, `nutritional_data_source` tagging | ~1.5 hrs | /compact (same env) |
| 3 | Formula Change Detection + Re-scrape | Python `scripts/` + Supabase migration | Hash normalization pipeline, diff engine, `formula_change_log`, monthly re-scrape cron stub, Supabase Edge Function for Haiku calls | ~1.5 hrs | /compact (same env) |
| 4 | Database Miss Handling | React Native `src/` | D-091 Level 4 Hybrid: UPC external lookup → confirm → OCR → Edge Function → Haiku parse → partial score → community save | ~2.5 hrs | /clear (NEW env) |
| 5 | Paywall + Legal | React Native `src/` | RevenueCat SDK, paywall screen, permissions.ts upgrade, 5 active triggers + 2 pre-wired, rolling scan window, clickwrap TOS, dev menu | ~2.5 hrs | /compact (same env) |
| 6 | Integration + Polish | Full stack | E2E test, bug fixes, compliance audit, CLAUDE.md update, decision logging, final regression | ~2 hrs | /clear (FULL context) |

**Total estimated: ~12 hours across 6 sessions.**

---

## Decision Reference Table

Every prompt references specific decisions. This table maps D-numbers to sessions.

| D-Number | Topic | Session(s) | Key Rule |
|----------|-------|-----------|----------|
| D-017 | Missing GA Fallback | 1, 2, 4 | Reweight to 78% ingredient / 22% formulation. Show "Partial" badge. |
| D-043 | LLM Nutritional Refinery | 2 | Claude Haiku, strict JSON schema, Python validation, `nutritional_data_source = 'llm_extracted'` |
| D-044 | Formula Change Detection | 3 | Normalized `ingredients_hash` + monthly re-scrape + stale badge + notification if Δ >15 pts |
| D-050 | Pricing | 5 | Free: 5 scans/week. Annual: $24.99/yr. Monthly: $5.99/mo |
| D-051 | Paywall UX Rules | 5 | Lead with annual. Pet-centric copy. Triggers ONLY. Never before first score. ONLY in permissions.ts |
| D-052 | Paywall Triggers (Updated) | 5 | 5 active: 6th scan, 2nd pet, safe swap, search, compare. 2 pre-wired: vet report, elimination diet |
| D-054 | RevenueCat Timing | 5 | Install at M3, not before |
| D-055 | Search = Premium | 5 | Text search gated, barcode scan free |
| D-084 | Zero Emoji | ALL | Ionicons only, no emoji anywhere |
| D-091 | Database Miss Handling | 4 | Level 4 Hybrid: external UPC → confirm → OCR → partial score → auto-contribute |
| D-094 | Suitability Framing | 4, 5 | "[X]% match for [Pet Name]" always. Never naked scores. |
| D-095 | UPVM Compliance | ALL | No prescribe/treat/cure/prevent/diagnose in UI copy |
| D-096 | Supplement Scoring | 1 | Deferred to M16+. Store supplements, do NOT score them. |
| D-125 | Recall Siren → Free Tier | 5 | Recall alerts included in basic/free tier, not premium-gated |
| D-126 | Paywall Psychology | 5 | Blur not padlock (safe swaps), per-month math ("$2.08/mo"), identity framing |
| D-127 | API Keys Server-Side Only | 3, 4 | No Anthropic/external API keys in React Native binary. Use Supabase Edge Functions. |
| D-128 | Haiku Product Classification | 3, 4 | Edge Function classifies category (daily_food/treat/supplement/grooming) + species (dog/cat/all). User confirms via chips. Supplement/grooming → store only, no score. |

---

## New Decisions to Log (Pre-Session 1)

Before starting M3 code, add these to DECISIONS.md:

```markdown
## D-125: Recall Siren → Free Tier
**Status:** LOCKED
**Date:** 2026-03-03
**Decision:** Recall Siren (recall alerts, FDA monitoring notifications) moves from premium
to basic/free tier.
**Rationale:** Greater user safety reach, community trust signal, freemium engagement driver.
Removes "Recall alert signup" from D-052 paywall triggers.

## D-126: Paywall Screen Psychology Patterns
**Status:** LOCKED
**Date:** 2026-03-03
**Decision:** Paywall screen implements four behavioral patterns:
1. Curiosity Gap: Safe Swap alternatives shown as blurred images behind paywall, not padlocked.
2. Identity Framing: "About $2/month to protect [Pet Name] for a full year" — subscription
   framed as pet care, not software purchase.
3. Endowment Effect: 2nd pet profile trigger leverages invested time in first profile.
4. Decoy Pricing: Annual card shows "$24.99/year (Just $2.08/mo)" with anchoring line.
**Rationale:** Behavioral psychology maximizes $24.99/yr conversion without dark patterns.

## D-127: API Keys Server-Side Only
**Status:** LOCKED
**Date:** 2026-03-03
**Decision:** No external API keys (Anthropic, etc.) in the React Native app
binary. All external API calls route through Supabase Edge Functions. For keyed APIs
(Anthropic), Edge Functions hold the secret server-side. For keyless APIs (UPCitemdb
free tier), Edge Functions still serve as an abstraction layer — swap to a paid UPC
API later without pushing an app update.
**Rationale:** App binaries can be reverse-engineered. Exposed keys = drained budgets.
Supabase Edge Functions provide secure key storage with row-level access control.

## D-128: Haiku Product Classification on Database Miss
**Status:** LOCKED
**Date:** 2026-03-04
**Decision:** When the parse-ingredients Edge Function processes OCR text from a database
miss (D-091), Haiku also classifies the product's category (daily_food, treat, supplement,
grooming) and target species (dog, cat, all). The Edge Function returns suggested values
with a confidence score. ProductConfirmScreen shows Haiku's suggestions as pre-selected
chips — user can tap to correct. Corrected values are stored alongside suggestions for
accuracy tracking.
**Rationale:** Users scanning an unknown product often don't know the scoring category.
Getting it wrong produces misleading scores (treat scored as daily food gets hammered by
missing-GA fallback). Haiku has strong signal from product name + ingredient text to
classify correctly. User confirmation preserves human oversight. Storing both suggested
and corrected values enables classification accuracy auditing.
**Category handling:**
- daily_food → score with D-017 partial fallback (78/22 if no GA)
- treat → score with 100/0/0 ingredient-only weighting
- supplement → store only, do NOT score (D-096), show "Supplement scoring coming soon"
- grooming → store only, do NOT score (D-083), show "Grooming scoring coming soon"
```

---

## Session 1: Data Import Pipeline

### What We're Building

A Python import pipeline that takes the existing 8,868-product JSON dataset and loads it into Supabase. This is NOT a scraper session — the data is already scraped. This session transforms and loads it.

### Environment

- **Directory:** `scripts/import/`
- **Language:** Python 3.10+
- **Dependencies:** `supabase-py`, `hashlib`, `json`, `re`
- **Supabase tables touched:** `products`, `product_upcs`, `product_ingredients`, `ingredients_dict`
- **Scoring engine:** DO NOT TOUCH. Zero files in `src/services/scoring/`.

### Pre-Session 1 Context File

Save this as `scripts/import/SESSION1_CONTEXT.md` before starting:

```markdown
# Session 1 Context — Data Import Pipeline

## Dataset: kiba_cleaned.json (8,868 records)

### Data Shape
- Records: 8,868 (5,205 dog / 3,663 cat)
- Categories: 3,466 daily_food / 2,990 treats / 2,412 supplements
- Fields per record: 47 columns including QA flags

### Completeness Matrix (daily_food + treats only — 6,456 products)
- Full score ready (ingredients + GA): 4,119 (63%)
- Partial score (ingredients, no GA): 514 (8%) → LLM refinery in Session 2
- Metadata only (no ingredients): 1,823 (28%) → stored, not scored

### QA Flags in Dataset
- _qa_has_ingredients: True/False
- _qa_has_ga: True/False
- _qa_has_upc: True/False
- _ingredient_status: 'clean' | 'contaminated' | 'missing' | 'borderline'
  - 'contaminated' (1,435) = empty ingredients_raw, metadata only
  - 'borderline' (284) = ingredients present but may need manual review

### Field Mapping: Dataset → Supabase
| Dataset Field | Supabase Column | Transform |
|--------------|-----------------|-----------|
| brand | products.brand | Direct |
| product_name | products.name | Direct |
| category | products.category | Direct ('daily_food', 'treat', 'supplement') |
| target_species | products.target_species | Direct ('dog', 'cat') |
| barcode_upc | product_upcs.upc (primary) | String, pad to valid length |
| upcs[] | product_upcs (multi-row) | One row per UPC, all → same product_id |
| ingredients_raw | products.ingredients_raw | Direct (preserve verbatim) |
| protein_min_pct | products.ga_protein_pct | Rename only |
| fat_min_pct | products.ga_fat_pct | Rename only |
| fiber_max_pct | products.ga_fiber_pct | Rename only |
| moisture_max_pct | products.ga_moisture_pct | Rename only |
| kcal_per_cup | products.ga_kcal_per_cup | Direct |
| kcal_per_kg | products.ga_kcal_per_kg | Direct |
| taurine_pct | products.ga_taurine_pct | Direct |
| dha_pct | products.ga_dha_pct | Direct |
| omega3_pct | products.ga_omega3_pct | Direct |
| omega6_pct | products.ga_omega6_pct | Direct |
| aafco_statement | products.aafco_statement | Map: 'yes'→text, 'likely'→'likely', 'unknown'→null |
| is_grain_free | products.is_grain_free | Map: 'yes'→true, 'no'→false, 'unknown'→null |
| preservative_type | products.preservative_type | Direct |
| product_form | (derive ga_moisture hint) | 'wet' → expect moisture >12% |
| life_stage_claim | products.life_stage_claim | Direct |
| nasc_certified | (store for M16+) | Supplements only |
| ingredient_type | (store for M16+) | Supplements only |
| source_url | (metadata, store in notes) | Chewy/Amazon URL |
| _ingredient_status | (QA filter) | Skip 'contaminated' for ingredient parsing |

### Supplements (2,412 records)
Per D-096: store in products table with category='supplement'.
Do NOT attempt to score. Do NOT parse into product_ingredients.
Store ingredients_raw for future M16+ parsing.

### UPC Handling
- 8,223 products have at least one UPC
- 729 products have multiple UPCs (size variants)
- upcs[] array maps to product_upcs junction (one row per UPC)
- 645 products have no UPC → insert product, skip product_upcs

### Ingredient Parsing Strategy
- Parse ingredients_raw into product_ingredients junction
- Split on commas, trim whitespace, normalize to lowercase for matching
- Match each ingredient against ingredients_dict by canonical_name
- IMPORTANT: ingredients_dict already has tier 1, 1.5, and 2 ingredient content
  seeded in Supabase from M1/M2 builds (119+ ingredients and growing, with severity ratings,
  clinical justifications, and display content). Do NOT re-import or overwrite
  existing ingredient records. Only INSERT new ingredients not already in the table.
- Unknown ingredients: insert into ingredients_dict with severity='unknown',
  needs_review=true — score engine treats unknowns as neutral (no penalty)
- Preserve original position (1 = first listed ingredient)
- Do NOT parse supplements (D-096)

### Hash Computation (D-044)
- Normalize: lowercase → collapse whitespace → standardize separators to
  comma-space → trim each entry → join
- Do NOT alphabetize — ingredient order reflects proportion per AAFCO
- SHA-256 hash of normalized string → ingredients_hash
- Null ingredients_raw → null ingredients_hash
```

### Prompt 1.1 — Import Pipeline Core

Paste this into Claude Code after `/clear`:

````
@CLAUDE.md @DECISIONS.md @ROADMAP.md

## Context
We are in M3 Session 1: Data Import Pipeline. M0+M1+M2 are complete (447 tests passing).
The scoring engine in src/services/scoring/ is LOCKED — do not touch any file in that directory.

We have a pre-scraped dataset of 8,868 products as JSON (kiba_cleaned.json).
This session builds a Python import pipeline to load this data into Supabase.

Read scripts/import/SESSION1_CONTEXT.md for the full dataset analysis, field mapping,
and import rules before writing any code.

## Task: Build the Product Import Pipeline

Create `scripts/import/import_products.py` that:

1. **Reads** kiba_cleaned.json
2. **Validates** each record:
   - Required: brand, product_name, category, target_species
   - category must be 'daily_food', 'treat', or 'supplement'
   - target_species must be 'dog' or 'cat'
   - Skip records failing validation, log them to import_errors.json
3. **Inserts into products table:**
   - Generate UUID for each product
   - Map fields per SESSION1_CONTEXT.md field mapping table
   - Set source = 'scraped'
   - Set nutritional_data_source = 'manual' for records with GA data
   - Set score_confidence = 'high' for records with both ingredients + GA,
     'partial' for ingredients only, null for no ingredients
   - Set needs_review = true for _ingredient_status == 'borderline'
4. **Inserts into product_upcs junction:**
   - For each product, insert barcode_upc as primary UPC
   - If upcs[] array exists and has additional entries, insert those too
   - All UPCs for same product point to same product_id
   - Skip products with no UPC (645 records) — product still inserted, just no UPC rows
5. **Computes ingredients_hash (D-044):**
   - Normalize: lowercase → collapse whitespace → standardize separators to comma-space →
     trim each entry → join with ', '
   - IMPORTANT: Do NOT alphabetize. Ingredient order = proportion order per AAFCO labeling.
     Reordering IS a real formula change.
   - SHA-256 of normalized string → ingredients_hash column
   - Null ingredients_raw → null ingredients_hash
   - Set last_verified_at = NOW() for all imported records
6. **Batch operations:**
   - Process in batches of 100 (Supabase rate limits)
   - Log progress every 500 records
   - On error: log to import_errors.json with record index + error, continue processing
   - Final summary: total inserted, skipped, errors, by category

## Constraints
- D-084: No emoji in any output/logging
- D-096: Supplements get stored but NOT scored, NOT parsed into product_ingredients
- Source field = 'scraped' (not 'apify' or 'chewy' — source-agnostic per architecture decision)
- Use SUPABASE_SERVICE_ROLE_KEY for import (bypasses RLS — this is a data pipeline, not user code)
- All environment variables from .env, never hardcoded
- is_grain_free: map 'yes' → true, 'no' → false, 'unknown' → null (tri-state, null = unknown)

## Output
- scripts/import/import_products.py (main pipeline)
- scripts/import/config.py (env vars, Supabase client setup)
- scripts/import/validators.py (record validation functions)
- scripts/import/README.md (how to run, expected output, troubleshooting)
````

### Prompt 1.2 — Ingredient Parsing + Junction Population

After Prompt 1.1 is complete and verified:

````
@CLAUDE.md @DECISIONS.md

## Context
Session 1 continued. Products are now in Supabase. Next: parse ingredients_raw into
the product_ingredients junction table, matching against ingredients_dict.

Read scripts/import/SESSION1_CONTEXT.md for ingredient parsing rules.

## Task: Build Ingredient Parser

Create `scripts/import/parse_ingredients.py` that:

1. **Queries products** where:
   - ingredients_raw IS NOT NULL
   - category IN ('daily_food', 'treat') — NOT supplements (D-096)
   - _ingredient_status != 'contaminated' (already filtered by null ingredients_raw, but be explicit)

2. **For each product, parses ingredients_raw:**
   - Split on commas (handle edge cases: parenthetical commas like
     "Animal Fat (Preserved With BHA & Citric Acid)" should NOT split)
   - Trim whitespace from each ingredient
   - Assign position: 1 = first listed, incrementing
   - Normalize for matching: lowercase, strip leading/trailing whitespace

3. **Matches against ingredients_dict:**
   - Exact match on canonical_name (case-insensitive)
   - If no exact match: fuzzy match attempt (strip parenthetical qualifiers,
     try singular/plural, try with/without "dried", "ground", "organic" prefix)
   - If still no match: INSERT new row into ingredients_dict with:
     - canonical_name = normalized ingredient text
     - dog_base_severity = 'unknown'
     - cat_base_severity = 'unknown'
     - needs_review = true (implicit — severity unknown = review needed)
     - All other fields null (consumer content populated later)
   - Track new ingredients for manual review report

4. **Inserts into product_ingredients junction:**
   - product_id, ingredient_id, position
   - UNIQUE(product_id, position) constraint — skip duplicates on re-run

5. **Generates reports:**
   - matched_ingredients.json: {canonical_name: match_count} — sorted by frequency
   - new_ingredients.json: ingredients not in dict, with example products + positions
   - parsing_errors.json: products where parsing failed (malformed ingredients_raw)
   - Summary: X products parsed, Y total ingredient links, Z new ingredients added

## Constraints
- Do NOT parse supplements (D-096 — category = 'supplement' is excluded)
- Parenthetical content stays with its parent ingredient — "Animal Fat (Preserved With BHA
  & Citric Acid)" is ONE ingredient, not three
- Position must reflect label order exactly — this drives the position-weighted scoring
- Do NOT modify any existing ingredients_dict entries — only INSERT new unknowns
- The existing entries in ingredients_dict (119+ and growing) are the seed data.
  This script will likely add 500-1000+ new entries from real product labels.
- Log every new ingredient added so Steven can review them
- NOTE: New ingredients will have NULL cluster_id. Ingredient splitting detection
  (D-044, uses GROUP BY cluster_id HAVING count >= 2) will NOT detect splitting
  for new ingredients until cluster_id is manually assigned. This is expected —
  Steven will review new_ingredients.json and assign cluster_ids for related
  ingredient groups (e.g., "peas", "pea protein", "pea starch" → same cluster).

## Output
- scripts/import/parse_ingredients.py
- scripts/import/ingredient_matcher.py (matching logic, reusable for OCR flow later)
````

### Verification Prompt — Session 1

````
## Verify Session 1

1. Run: python scripts/import/import_products.py --dry-run
   Show me the first 5 records it would insert and the final summary counts.

2. Run the actual import. Show me:
   - Total products inserted by category (daily_food / treat / supplement)
   - Total UPCs inserted
   - Total products with no UPC
   - Any errors from import_errors.json

3. Run: python scripts/import/parse_ingredients.py --dry-run --limit 10
   Show me ingredient parsing for 10 products: original text → parsed list → matched/new.

4. Run the actual ingredient parse. Show me:
   - Total product_ingredients rows created
   - Total new ingredients added to ingredients_dict
   - Top 20 most common ingredients (with match counts)
   - Top 20 most common NEW ingredients (not in seed data)

5. Verify: SELECT count(*) FROM products GROUP BY category;
   Expected: ~3,466 daily_food, ~2,990 treats, ~2,412 supplements

6. Verify: SELECT count(*) FROM product_upcs;
   Expected: ~9,000+ (8,223 products × avg 1.1 UPCs per product)

7. Verify: SELECT count(*) FROM product_ingredients;
   Expected: high number (avg ~25 ingredients per product × ~5,500 parsed products)

8. Run existing test suite: npm test → must still be 447/447 passing.
   M3 data pipeline work must NOT break any existing tests.
````

### Session 1 Progress Doc Template

After Session 1 completes, save as `scripts/import/session1-m3-progress.md`:

```markdown
# M3 Session 1 Complete — Data Import Pipeline

## What Was Built
- [list files created]

## Counts
- Products inserted: [X] (daily_food: [X], treats: [X], supplements: [X])
- UPCs inserted: [X]
- Product-ingredient links created: [X]
- New ingredients added to dict: [X]
- Import errors: [X] (see import_errors.json)
- Parsing errors: [X] (see parsing_errors.json)

## Known Issues
- [any issues encountered]

## Ready for Session 2
- [X] products have ingredients but no GA → LLM refinery candidates
- Existing tests: 447/447 still passing
```

---

## Session 2: LLM Nutritional Refinery

### What We're Building

A Python batch processor that uses Claude Haiku to extract GA values from product label text for the ~514 daily_food/treat products that have ingredients but no GA data.

### Environment

- **Directory:** `scripts/refinery/`
- **Language:** Python 3.10+
- **Dependencies:** `anthropic`, `supabase-py`, `json`
- **API:** Anthropic (Claude Haiku) — called from script, NOT from app
- **Cost estimate:** ~$0.125 for 500 products

### Preamble (paste after /compact)

````
@CLAUDE.md @DECISIONS.md @NUTRITIONAL_PROFILE_BUCKET_SPEC.md

## Context
M3 Session 2: LLM Nutritional Refinery. Session 1 is complete — 8,868 products imported
to Supabase, ingredients parsed into junction table, hashes computed.

Now we build the Claude Haiku extraction pipeline for ~514 products that have
ingredients_raw but no GA data (protein/fat/fiber/moisture columns are null).

Session 1 progress: [paste session1-m3-progress.md contents here]

CRITICAL: This script runs server-side in scripts/. It calls the Anthropic API directly.
The API key is in .env — NEVER in the React Native app (D-127).
Do NOT touch any files in src/services/scoring/. 447 tests must still pass.

IMPORTANT — Read NUTRITIONAL_PROFILE_BUCKET_SPEC.md before writing validation logic.
It defines the exact GA ranges, DMB conversion rules, and carb estimation formula.
Haiku-extracted values must survive the same validation the scoring engine applies.
````

### Prompt 2.1 — Haiku GA Extraction Pipeline

````
## Task: Build the LLM Nutritional Refinery

Create `scripts/refinery/extract_ga.py` that:

1. **Queries Supabase** for products where:
   - ingredients_raw IS NOT NULL
   - ga_protein_pct IS NULL
   - category IN ('daily_food', 'treat')
   - Results sorted by: daily_food first (they need GA for the 30% nutritional bucket),
     then treats (100% ingredient scoring, GA is bonus data)

2. **For each product, calls Claude Haiku** with this prompt structure:
   ```
   You are a pet food label data extractor. Extract the Guaranteed Analysis values
   from this pet food product information. Return ONLY a JSON object, no other text.

   Product: {product_name}
   Brand: {brand}
   Ingredients: {ingredients_raw}
   Product Form: {product_form or 'unknown'}

   Extract these values as numbers (no % sign). Use null if not found:
   {
     "protein_min_pct": <number or null>,
     "fat_min_pct": <number or null>,
     "fiber_max_pct": <number or null>,
     "moisture_max_pct": <number or null>,
     "kcal_per_cup": <number or null>,
     "kcal_per_kg": <number or null>
   }

   IMPORTANT: Only extract values explicitly stated. Never infer or calculate.
   If the label text doesn't contain GA data, return all nulls.
   ```

3. **Validates extraction results** — THIS IS NOT OPTIONAL (D-043):
   - protein_min_pct: 0–80% (typical range 15-50%)
   - fat_min_pct: 0–50% (typical range 5-25%)
   - fiber_max_pct: 0–30% (typical range 1-12%)
   - moisture_max_pct: 0–85% (dry food <14%, wet food 70-85%)
   - kcal_per_cup: 100–7000 (typical range 250-500)
   - kcal_per_kg: 100–7000 (typical range 2500-4500)
   - If ANY value is out of range → flag for manual review, do NOT insert
   - Cross-validation: if moisture >60% but product_form='dry', flag as suspicious
   - ASH CONVERSION TRAP: Haiku extracts as-fed values. The scoring engine's carb
     estimation (D-104) needs as-fed GA values — it handles DMB conversion internally.
     Do NOT convert to DMB in this script. Store as-fed values exactly as extracted.
     The scoring engine in src/services/scoring/dmbConversion.ts does its own conversion.

4. **Updates Supabase** on successful validation:
   - Set ga_protein_pct, ga_fat_pct, ga_fiber_pct, ga_moisture_pct, kcal values
   - Set nutritional_data_source = 'llm_extracted'
   - Set score_confidence = 'high' (now has both ingredients + GA)
   - Do NOT overwrite existing non-null GA values (safety guard)
   - IMPORTANT (§7c disclaimer): Products with nutritional_data_source = 'llm_extracted'
     display a disclaimer in GATable.tsx: "Nutritional values extracted from label text
     by AI. Minor inaccuracies possible." This is already wired in the M1 ResultScreen —
     it checks the nutritional_data_source field. Just ensure the field is set correctly.

5. **Handles failures gracefully:**
   - Haiku returns invalid JSON → log, skip, continue
   - Haiku returns all nulls → product has no GA in its label text, leave as-is
   - Out-of-range values → write to flagged_for_review.json with product_id + values
   - API rate limit → exponential backoff with max 3 retries
   - Total Haiku failure → log, skip, continue (never crash the batch)

6. **Reports:**
   - refinery_results.json: per-product extraction summary
   - flagged_for_review.json: out-of-range values needing manual check
   - Summary: X processed, Y successfully extracted, Z flagged, W failed

## Constraints
- D-043: Python validation is NOT optional. Never silently insert unvalidated data.
- D-127: Anthropic API key in .env only, never in app code
- Use claude-haiku-4-5-20251001 model (cheapest, fast, sufficient for structured extraction)
- Batch size: 10 concurrent requests max (respect rate limits)
- Cost tracking: log input/output tokens per batch, print running total
- Dry run mode: --dry-run flag processes first 5 products, prints results, no DB writes

## Output
- scripts/refinery/extract_ga.py (main pipeline)
- scripts/refinery/validator.py (range checks, cross-validation)
- scripts/refinery/README.md
````

### Verification Prompt — Session 2

````
## Verify Session 2

1. Run: python scripts/refinery/extract_ga.py --dry-run
   Show me extraction results for 5 products: input text → Haiku output → validation result.

2. Check validation catches bad data:
   - Feed it a fake product with protein=95% → must be flagged, not inserted
   - Feed it a fake product with moisture=80% + product_form='dry' → must be flagged
   - Feed it a product with valid values → must pass and show what would be inserted

3. Run the actual refinery. Show me:
   - Total products processed
   - Successfully extracted count
   - Flagged for review count
   - Failed count
   - Total Anthropic API cost (tokens × rate)

4. Verify DB state:
   SELECT count(*) FROM products
   WHERE nutritional_data_source = 'llm_extracted'
   AND ga_protein_pct IS NOT NULL;
   Expected: ~300-450 (not all 514 will have GA in their label text)

5. Verify no existing data was overwritten:
   SELECT count(*) FROM products
   WHERE nutritional_data_source = 'manual';
   Must equal pre-refinery count (unchanged).

6. npm test → 447/447 still passing.
````

### Session 2 Progress Doc Template

```markdown
# M3 Session 2 Complete — LLM Nutritional Refinery

## What Was Built
- [list files]

## Counts
- Products processed: [X]
- Successfully extracted: [X]
- Flagged for review: [X]
- Failed/skipped: [X]
- API cost: $[X.XX]

## Score Readiness After Session 2
- Full score (ingredients + GA): [X] daily_food + treats (was 4,119, now ~4,500+)
- Partial score (ingredients only): [X] (reduced from 514)
- Metadata only: [X] (unchanged)

## Known Issues
- [flagged products, any patterns in failures]
```

---

## Session 3: Formula Change Detection + Edge Functions

### What We're Building

The formula change detection system (D-044) and a Supabase Edge Function for secure Haiku API calls (D-127). The Edge Function is reused by Session 4's OCR flow.

### Environment

- **Directory:** `scripts/pipeline/` (change detection), `supabase/functions/` (Edge Functions)
- **Language:** Python (pipeline), TypeScript (Edge Functions)
- **Supabase tables touched:** products (ingredients_hash, last_verified_at, formula_change_log, score_confidence)

### Preamble (paste after /compact)

````
@CLAUDE.md @DECISIONS.md

## Context
M3 Session 3: Formula Change Detection + Supabase Edge Functions.
Sessions 1-2 complete. Products imported, GA refined. Now we build:
1. The re-scrape + hash diff pipeline for detecting formula changes
2. A Supabase Edge Function for secure Claude Haiku calls (D-127)

Session 2 progress: [paste session2-m3-progress.md contents here]

CRITICAL: Do NOT touch src/services/scoring/. 447 tests must still pass.
````

### Prompt 3.1 — Formula Change Detection

````
## Task: Build Formula Change Detection Pipeline

Create `scripts/pipeline/detect_changes.py` that:

1. **Re-scrape simulation** (for now — actual re-scrape uses Apify + Scrape.do, or Chewy affiliate API once approved):
   - Accept a JSON file of re-scraped products (same schema as import dataset)
   - This script runs monthly, comparing new scrape data against stored data

2. **For each re-scraped product:**
   - Match to existing product by UPC (product_upcs lookup) or by brand+name exact match
   - If no match → new product, queue for import pipeline (Session 1 script)
   - If match found → compare ingredients

3. **Hash comparison (D-044):**
   - Compute ingredients_hash of new ingredients_raw using SAME normalization as Session 1:
     lowercase → collapse whitespace → standardize separators to comma-space → trim each → join
   - IMPORTANT: Do NOT alphabetize. Reordering IS meaningful per AAFCO.
   - Compare new hash against stored ingredients_hash
   - Match → update last_verified_at = NOW(), no further action
   - Mismatch → formula change detected

4. **On formula change:**
   - Set score_confidence = 'under_review' on the product
   - Append to formula_change_log JSONB:
     ```json
     {
       "detected_at": "ISO timestamp",
       "old_hash": "sha256...",
       "new_hash": "sha256...",
       "old_ingredients_preview": "first 100 chars...",
       "new_ingredients_preview": "first 100 chars..."
     }
     ```
   - Update ingredients_raw with new text
   - Recompute ingredients_hash
   - Re-parse into product_ingredients (delete old links, insert new)
   - Calculate score delta: [TODO — requires scoring engine call, defer to Session 6]
   - If delta >15 points → flag for push notification (pantry notification in M5)

5. **Report:**
   - change_detection_report.json: list of changed products with old/new preview
   - Summary: X products checked, Y verified unchanged, Z formula changes detected

## Constraints
- D-044: Hash normalization must be identical to Session 1 (shared utility function)
- Do NOT alphabetize ingredients before hashing — order reflects proportion
- formula_change_log is append-only JSONB array — never overwrite history
- score_confidence = 'under_review' is a transient state — resolved when re-scored

## Output
- scripts/pipeline/detect_changes.py
- scripts/pipeline/hash_utils.py (shared normalization + hashing — also used by Session 1)
- scripts/pipeline/README.md
````

### Prompt 3.2 — Supabase Edge Function for Haiku

````
## Task: Build Supabase Edge Function for Claude Haiku API Calls

Create `supabase/functions/parse-ingredients/index.ts` — a Supabase Edge Function that:

1. **Accepts POST request** with body:
   ```json
   {
     "raw_text": "Chicken, Brown Rice, Chicken Meal...",
     "product_name": "Optional product name for context",
     "brand": "Optional brand name for context"
   }
   ```

2. **Calls Claude Haiku** server-side with the Anthropic API key from Edge Function secrets:
   - Prompt: structured extraction of ingredient list from OCR text + product classification
   - The prompt asks Haiku to:
     a) Parse ingredients into an ordered array
     b) Classify the product category: 'daily_food', 'treat', 'supplement', or 'grooming'
     c) Classify the target species: 'dog', 'cat', or 'all'
     d) Provide confidence level and reasoning for classification
   - Classification signals include: product name keywords ("shampoo" → grooming,
     "treats" → treat), ingredient chemistry (surfactants → grooming, AAFCO statement
     mentions → daily_food), and species indicators in product name or label text
   - Model: claude-haiku-4-5-20251001

3. **Validates and returns** parsed result:
   ```json
   {
     "ingredients": ["Chicken", "Brown Rice", "Chicken Meal", ...],
     "confidence": "high" | "medium" | "low",
     "raw_input_length": 450,
     "parsed_count": 28,
     "suggested_category": "daily_food" | "treat" | "supplement" | "grooming",
     "suggested_species": "dog" | "cat" | "all",
     "category_confidence": "high" | "medium" | "low",
     "classification_signals": "Named protein sources, AAFCO statement detected, dog-specific label text"
   }
   ```

4. **Error handling:**
   - Invalid/empty input → 400 with error message
   - Haiku API failure → 502 with error message
   - Haiku returns unparseable result → 422 with raw Haiku output for debugging

5. **Security:**
   - Require Supabase auth token (anon key or user JWT) — no public access
   - Rate limit: 10 requests per minute per user (prevent abuse)
   - ANTHROPIC_API_KEY stored as Edge Function secret, never exposed to client

## Why This Exists (D-127)
The React Native app needs to call Claude Haiku for OCR ingredient parsing (Session 4).
But the Anthropic API key CANNOT be in the app binary — anyone could reverse-engineer it.
This Edge Function holds the key server-side. The app calls Supabase, Supabase calls Haiku.

## Deployment
```bash
supabase functions deploy parse-ingredients
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

## Output
- supabase/functions/parse-ingredients/index.ts
- supabase/functions/parse-ingredients/README.md
````

### Verification Prompt — Session 3

````
## Verify Session 3

1. Test hash normalization consistency:
   - Hash "Chicken, Brown Rice, Chicken Meal"
   - Hash "chicken,  brown rice,chicken meal  "
   - Hash "chicken, brown rice, chicken meal"
   - First two must produce SAME hash. Third must produce SAME hash as first two.

2. Test formula change detection with mock data:
   - Create a product with ingredients "Chicken, Rice, Peas"
   - Run detect_changes with same product but "Chicken, Rice, Lentils"
   - Verify: score_confidence = 'under_review', formula_change_log appended,
     old ingredients_raw replaced, new hash computed

3. Test Edge Function locally:
   supabase functions serve parse-ingredients
   curl -X POST http://localhost:54321/functions/v1/parse-ingredients \
     -H "Authorization: Bearer <anon-key>" \
     -H "Content-Type: application/json" \
     -d '{"raw_text": "Chicken, Brown Rice, Oatmeal, Chicken Fat", "product_name": "Acme Dog Food", "brand": "Acme"}'
   Verify: returns parsed ingredient array in order + suggested_category + suggested_species.

4. Test Haiku classification (D-128) with three distinct product types:
   a) Daily food: product_name="Purina ONE SmartBlend", raw_text="Chicken, Rice Flour..."
      Expected: suggested_category = 'daily_food', suggested_species = 'dog'
   b) Treat: product_name="Greenies Dental Treats", raw_text="Wheat Flour, Glycerin..."
      Expected: suggested_category = 'treat'
   c) Grooming: product_name="Wahl Waterless Oatmeal Dog Shampoo",
      raw_text="Water, PEG-80 Sorbitan Laurate, Cocamidopropyl Betaine..."
      Expected: suggested_category = 'grooming', suggested_species = 'dog'
   Verify all three return correct classification with 'high' confidence.

5. Verify hash_utils.py is importable from both import_products.py and detect_changes.py
   (shared utility, not duplicated).

6. npm test → 447/447 still passing.
````

---

## Session 4: Database Miss Handling (App Code)

### What We're Building

The D-091 Level 4 Hybrid flow — what happens when a user scans a barcode that isn't in the Kiba database. This replaces the current "Product not found" alert in ScanScreen.

### Environment

- **Directory:** `src/` — back in React Native / Expo territory
- **New screens/components** in `src/screens/` and `src/components/`
- **Edge Function** from Session 3 is called by the app (not Anthropic directly)
- **Scoring engine:** STILL DO NOT TOUCH.

### Preamble (paste after /clear — different environment)

````
@CLAUDE.md @DECISIONS.md @ROADMAP.md @NUTRITIONAL_PROFILE_BUCKET_SPEC.md

## Context
M3 Session 4: Database Miss Handling (D-091). This is React Native app code.
Sessions 1-3 were backend Python scripts — this session is back in src/.

M2 Final State: 447/447 tests passing. All screens migrated to useActivePetStore.
Scoring engine in src/services/scoring/ is LOCKED.

The Supabase Edge Function `parse-ingredients` exists from Session 3 — it accepts
raw OCR text and returns parsed ingredient JSON via Claude Haiku server-side.

Session 3 progress: [paste session3-m3-progress.md contents here]

Current ScanScreen behavior on miss: shows "Product not found" alert. We're replacing
this with a multi-step flow.

IMPORTANT — Read NUTRITIONAL_PROFILE_BUCKET_SPEC.md §7a-7b for the exact partial-score
fallback rules. When GA is missing, the scoring engine reweights to 78/22
(ingredient/formulation). The partial score badge and tooltip copy must match the
existing ResultScreen implementation from M1 (ScoreRing "Partial" badge + ScoreWaterfall
78/22 reweight). Do NOT rebuild — reuse the existing D-017 code paths.

RULES FOR THIS SESSION:
- D-084: Zero emoji anywhere
- D-094: All scores framed as "[X]% match for [Pet Name]"
- D-095: No prescribe/treat/cure/prevent/diagnose in any UI copy
- D-017: Missing GA → reweight 78/22, show "Partial" badge
- D-127: No API keys in app code — use Edge Function for Haiku calls
- D-128: Haiku classifies category + species, user confirms via chips. Supplement/grooming → store only, no score.
- Do NOT modify src/services/scoring/* — 447 tests must pass
````

### Prompt 4.1 — UPC External Lookup + Confirmation

````
## Task: Build Database Miss Flow — Part 1 (UPC Lookup + Confirmation)

When ScanScreen gets a UPC that returns no result from product_upcs, instead of
showing "Product not found", implement this flow:

### Step 1: External UPC Lookup
- Call UPCitemdb API (free tier, 100 lookups/day): GET https://api.upcitemdb.com/prod/trial/lookup?upc={upc}
- NOTE: The free /trial/ endpoint requires NO API key — just a bare GET request.
  The Edge Function still makes sense (D-127) because: (a) you don't want the endpoint
  hardcoded in the app binary, and (b) you'll eventually swap to a paid UPC API without
  pushing an app update. The Edge Function is the abstraction layer.
- Create `supabase/functions/upc-lookup/index.ts` for this
- If UPCitemdb returns a result: extract product name, brand, category
- If UPCitemdb also misses: skip to Step 3 (OCR prompt)

### Step 2: User Confirmation + Classification Screen
Create `src/screens/ProductConfirmScreen.tsx`:
- Shows: "Is this [Product Name] by [Brand]?" with product image if available
- Two buttons: "Yes, that's it" | "No, wrong product"
- If confirmed, pre-fill brand and product_name for the community contribution
- If wrong, user can manually enter product name (optional text input)

**After product identity confirmation (or skip), show classification chips (D-128):**
- After OCR text is sent to the parse-ingredients Edge Function (Step 3), the
  response includes `suggested_category` and `suggested_species` from Haiku.
- Display two rows of tappable chips:
  - **Category:** "Daily Food" | "Treat" | "Supplement" | "Grooming"
    → Haiku's suggestion is pre-selected (highlighted). User can tap a different one.
  - **Species:** "Dog" | "Cat" | "Any Pet"
    → Haiku's suggestion is pre-selected. User can tap to correct.
- If category_confidence is 'low', show NO pre-selection — require user to pick.
- Label: "We think this is a [category] for [species]. Tap to correct if needed."
- Clean, minimal. This is a moment of user frustration — keep it fast.

**Category-based routing (D-128):**
- daily_food or treat → proceed to scoring (Step 4 in Prompt 4.2)
- supplement → store product (source='community', needs_review=true, contributed_by=auth.uid()), show:
  "We've saved this supplement. Supplement scoring is coming soon!"
  Then navigate back to ScanScreen. Do NOT attempt to score.
- grooming → store product (source='community', needs_review=true, contributed_by=auth.uid()), show:
  "We've saved this grooming product. Grooming analysis is coming soon!"
  Then navigate back to ScanScreen. Do NOT attempt to score.

### Step 3: OCR Prompt Screen
Create `src/screens/IngredientCaptureScreen.tsx`:
- Header: "Photograph the ingredient list"
- Instructional text: "Turn the package to find the ingredient list, then take a clear photo."
- Camera opens (reuse expo-camera pattern from ScanScreen)
- After capture: show preview with "Use This Photo" / "Retake" buttons
- On "Use This Photo" → extract text → send to Edge Function (which returns BOTH
  parsed ingredients AND classification) → show classification chips on
  ProductConfirmScreen (or inline if flow is combined) → proceed based on category

### Navigation
- ScanScreen miss → ProductConfirmScreen (if UPC found externally) → IngredientCaptureScreen → classification chips → route by category
- ScanScreen miss → IngredientCaptureScreen (if UPC not found) → classification chips → route by category
- daily_food/treat → ResultScreen (with partial score)
- supplement/grooming → save + "coming soon" message → ScanScreen

### Error Handling
- UPCitemdb rate limit (100/day) → skip external lookup, go straight to OCR
- Camera permission denied → show settings prompt
- Blurry/unreadable photo → "We couldn't read that clearly. Try again with better lighting."
- Non-pet-food product detected (D-090) → "This doesn't appear to be a pet food product."

## Constraints
- D-084: No emoji
- D-127: UPCitemdb call routed through Edge Function (no API key needed for free tier, but Edge Function is the abstraction layer for future paid API swap)
- D-128: Haiku classification drives routing — supplement/grooming exit before scoring
- D-094: Any score shown must include pet name
- Navigation params must follow existing patterns in src/types/navigation.ts

## Output
- supabase/functions/upc-lookup/index.ts
- src/screens/ProductConfirmScreen.tsx
- src/screens/IngredientCaptureScreen.tsx
- Update src/services/scanner.ts to route misses to new flow
- Update src/types/navigation.ts with new routes
````

### Prompt 4.2 — OCR → Parse → Partial Score → Community Save

````
## Task: Build Database Miss Flow — Part 2 (Parse + Score + Save)

After the user photographs the ingredient list in IngredientCaptureScreen:

### On-Device Text Extraction
- Use expo-camera or expo-image-manipulator to capture the photo
- Use ML Kit Text Recognition (via @react-native-ml-kit/text-recognition or equivalent
  Expo-compatible library) for on-device OCR
- Extract raw text from the photograph

### Edge Function Parsing
- Send raw OCR text to the `parse-ingredients` Edge Function (Session 3)
- Edge Function calls Claude Haiku server-side (D-127 — no API key in app)
- Returns: parsed ingredient array in label order + confidence score +
  suggested_category + suggested_species (D-128)
- NOTE: By the time we reach Prompt 4.2, the user has already confirmed/corrected
  the category and species via chips in ProductConfirmScreen (Prompt 4.1).
  Supplements and grooming products have already exited the flow.
  Only daily_food and treat products reach this point.

### Partial Score Calculation
- Create a temporary product object from parsed data:
  - ingredients from Haiku parsing
  - NO GA data (this is an OCR-only flow)
  - category from user-confirmed classification (D-128) — either 'daily_food' or 'treat'
    (supplements and grooming already exited in Prompt 4.1)
  - target_species from user-confirmed classification (D-128), NOT from active pet profile
    (user may scan a cat food while their active pet is a dog — store the product's
    actual species, score against the active pet)
- Feed to scoring engine with D-017 missing GA fallback:
  - Reweight to 78% ingredient quality / 22% formulation
  - No nutritional profile bucket (0% — no GA data)
- Display score on ResultScreen with:
  - "Partial" badge prominently shown
  - Tooltip: "Nutritional data unavailable for this product. Score is based on ingredient
    analysis only and may change when full data is available."
  - Score framed as "[X]% match for [Pet Name]" (D-094) — NEVER a naked number

### Auto-Save to Community Database
- Insert product into Supabase products table:
  - source = 'community'
  - needs_review = true
  - contributed_by = auth.uid() (from Supabase JWT — enables future EXP attribution)
  - ingredients_raw = raw OCR text (not parsed — preserve original)
  - score_confidence = 'partial'
  - nutritional_data_source = null (no GA)
  - category = user-confirmed category (from D-128 classification chips)
  - target_species = user-confirmed species (from D-128 classification chips)
  - haiku_suggested_category = Haiku's original suggestion (before user correction)
  - haiku_suggested_species = Haiku's original suggestion (before user correction)
  - user_corrected_category = true/false (did user change Haiku's category suggestion?)
  - user_corrected_species = true/false (did user change Haiku's species suggestion?)
- Insert parsed ingredients into product_ingredients junction
- If UPC available: insert into product_upcs
- Compute and store ingredients_hash (same normalization as Session 1)
- NOTE: The haiku_suggested vs user_corrected fields enable accuracy auditing.
  Over time, this data shows how often Haiku gets classification right and where
  it fails — valuable for prompt tuning.

### Failure Modes (each needs graceful UX, not error states)
- OCR returns garbled text → "We had trouble reading that. Try a clearer photo."
- Haiku can't parse the text → "We couldn't identify the ingredients. You can try
  photographing just the ingredient list section."
- Product appears to be human food (D-090) → "This appears to be a human food product.
  Kiba only scores pet food and treats."
- NOTE: Supplement and grooming products are handled by D-128 exit paths in Prompt 4.1
  (ProductConfirmScreen). They never reach this scoring step.

## Constraints
- D-017: Missing GA → 78/22 reweight, "Partial" badge
- D-094: Score MUST include pet name context
- D-095: No prescriptive language in any copy
- D-084: No emoji
- D-127: No API keys in app — Edge Function only
- D-128: Category and species come from user-confirmed classification, not guessed
- Community contributions: needs_review = true, source = 'community'
- Preserve original OCR text in ingredients_raw (not cleaned/parsed version)
- Store both Haiku suggestions and user corrections for accuracy auditing

## Output
- src/services/ocrService.ts (on-device text extraction)
- src/services/ingredientParser.ts (calls Edge Function, handles response)
- src/components/PartialScoreBadge.tsx (visual badge + tooltip)
- Update src/screens/IngredientCaptureScreen.tsx (wire up full flow)
- Update src/screens/ResultScreen.tsx (handle partial score display)
````

### Verification Prompt — Session 4

````
## Verify Session 4

1. Test the full miss flow end-to-end:
   - Scan a UPC that doesn't exist in the database
   - Verify: routes to ProductConfirmScreen (if UPC found externally) or IngredientCaptureScreen
   - Verify: OCR → parse → partial score → result screen with "Partial" badge
   - Verify: community product saved with needs_review = true

2. Test D-017 compliance:
   - Verify partial score reweights to 78/22 (not 55/30/15)
   - Verify nutritional profile bucket = 0 (no GA data)
   - Verify "Partial" badge is visible on ResultScreen

3. Test D-094 compliance:
   - Verify score displays as "[X]% match for [Pet Name]"
   - Verify pet name appears on result screen
   - Verify no naked scores anywhere in the flow

4. Test D-127 compliance:
   - grep -r "ANTHROPIC" src/ → must return ZERO results
   - grep -r "upcitemdb" src/ → must return ZERO results (calls go through Edge Function, not direct from app)
   - Verify Edge Function is called, not direct API

5. Test error handling:
   - What happens when OCR returns empty text?
   - What happens when Edge Function is unreachable?
   - What happens when camera permission is denied?

6. Test D-128 classification flow:
   - Verify ProductConfirmScreen shows category + species chips
   - Verify Haiku's suggestion is pre-selected (highlighted chip)
   - Verify user can tap to change category (e.g., change "Daily Food" to "Treat")
   - Verify supplement selection → stores product, shows "coming soon", exits to ScanScreen
   - Verify grooming selection → stores product, shows "coming soon", exits to ScanScreen
   - Verify community-saved product has both haiku_suggested_* and user_corrected_* fields
   - Query: SELECT contributed_by, haiku_suggested_category, user_corrected_category
     FROM products WHERE source = 'community' ORDER BY created_at DESC LIMIT 5;
   - Verify contributed_by is NOT NULL (auth.uid() captured at insert time)
   - Verify treat uses 100/0/0 weighting (not 78/22 daily food fallback)

7. npm test → 447/447 still passing (plus any new tests from this session).
````

---

## Session 5: Paywall + Legal Clickwrap

### What We're Building

RevenueCat SDK integration, the paywall screen, permissions.ts upgrade from stubs to real checks, all trigger wiring, and the legal clickwrap TOS.

### Environment

- **Directory:** `src/`
- **New deps:** `react-native-purchases` (RevenueCat)
- **Requires:** EAS Build (RevenueCat has native modules — `expo start` alone won't work)
- **Key file:** `src/utils/permissions.ts` — THE ONLY FILE with paywall logic (D-051)

### Preamble (paste after /compact — same React Native env as Session 4)

````
@CLAUDE.md @DECISIONS.md @ROADMAP.md

## Context
M3 Session 5: Paywall + Legal Clickwrap. Session 4 complete (database miss handling).
We're still in src/ React Native territory.

CRITICAL ARCHITECTURE RULE (D-051):
Paywall logic lives ONLY in src/utils/permissions.ts. NEVER scatter if(isPremium)
checks across screens. Every screen calls permissions.ts functions. The compliance
audit in Session 6 will grep for violations.

Session 4 progress: [paste session4-m3-progress.md contents here]

RULES FOR THIS SESSION:
- D-050: $24.99/yr annual, $5.99/mo monthly, 5 free scans/week
- D-051: Paywall logic ONLY in permissions.ts
- D-052 (Updated): 5 active triggers + 2 pre-wired
- D-054: RevenueCat installs NOW (M3)
- D-055: Text search = premium
- D-084: Zero emoji
- D-094: All scores include pet name
- D-095: No UPVM terms
- D-125: Recall Siren = free tier
- D-126: Paywall psychology patterns (blur, identity framing, decoy pricing)
````

### Prompt 5.1 — RevenueCat + permissions.ts

````
## Task: Install RevenueCat + Upgrade permissions.ts

### RevenueCat SDK Setup
1. Install: npx expo install react-native-purchases
2. Configure in app entry point (App.tsx or equivalent):
   - Purchases.configure({ apiKey: REVENUECAT_API_KEY })
   - API key from environment variable
3. Note: This requires EAS Build for testing — expo start won't load native modules

### Upgrade permissions.ts from Stubs to Real Logic

Current stubs:
- isPremium() → always returns false
- canAddPet(currentCount) → checks currentCount < 1

Replace with real RevenueCat-backed checks:

```typescript
// src/utils/permissions.ts — THE ONLY FILE WITH PAYWALL LOGIC (D-051)

// Core entitlement check
export async function isPremium(): Promise<boolean>
// Uses RevenueCat: Purchases.getCustomerInfo() → check for active 'premium' entitlement

// Scan limit (D-050: 5 scans/week rolling window)
export async function canScan(): Promise<boolean>
// Premium → always true
// Free → check rolling 7-day window (NOT calendar week)
// Rolling window = count scans where scanned_at > (NOW - 7 days)
// IMPORTANT: Use actual scan timestamps, not a simple counter reset

// Pet limit
export async function canAddPet(currentPetCount: number): Promise<boolean>
// Premium → always true
// Free → currentPetCount < 1

// Feature gates (each returns boolean)
export async function canSearch(): Promise<boolean>        // D-055: premium only
export async function canCompare(): Promise<boolean>       // premium only
export async function canUseSafeSwaps(): Promise<boolean>  // premium only
export async function canUseGoalWeight(): Promise<boolean> // premium only
export async function canUseTreatBattery(): Promise<boolean> // premium only
export async function canExportVetReport(): Promise<boolean> // pre-wired, premium
export async function canStartEliminationDiet(): Promise<boolean> // pre-wired, premium

// FREE for all users (D-125):
// - Barcode scanning (up to 5/week)
// - Basic score display
// - 1 pet profile
// - Recall Siren alerts
```

### Rolling Scan Window Implementation (Trap 5 from M3 Handoff)
- Query scans table: SELECT count(*) WHERE user_id = X AND scanned_at > NOW() - INTERVAL '7 days'
- NOT a calendar week reset. If user scans 5 on Saturday, they don't get 5 more on Sunday.
- This is a conversion-rate-sensitive detail — calendar week resets feel too generous.

### Dev Menu for QA (Trap 3 from feedback)
- Create `src/components/DevMenu.tsx` — only renders when __DEV__ is true
- Accessible from PetHubScreen: tap version number 5 times
- Features:
  - Toggle premium status (override RevenueCat for testing)
  - Inject N scan timestamps into the rolling window
  - Reset scan count
  - Show current entitlement state
  - Show rolling window count + oldest scan timestamp
- MUST be completely stripped from production builds (__DEV__ guard)

## Constraints
- D-051: ALL paywall checks go through permissions.ts. No exceptions.
- Rolling window, not calendar week (Trap 5)
- RevenueCat API key from env var, never hardcoded
- Dev menu only in __DEV__ builds
- canScan() must use scan timestamps from Supabase, not Zustand weeklyCount
  (Zustand resets on app restart — DB is source of truth)

## Output
- Updated src/utils/permissions.ts (real RevenueCat logic)
- src/components/DevMenu.tsx
- Update app entry point with RevenueCat configuration
- Update PetHubScreen.tsx with dev menu access
````

### Prompt 5.2 — Paywall Screen + Triggers

````
## Task: Build Paywall Screen + Wire All Triggers

### Paywall Screen
Create `src/screens/PaywallScreen.tsx`:

**Layout (D-051 + D-126 psychology patterns):**

1. **Header:** Pet photo + "Upgrade to protect [Pet Name]" (identity framing)

2. **Annual card (PRIMARY — visually dominant):**
   - "$24.99/year"
   - Prominent sub-text: "Just $2.08/mo"
   - Anchoring line: "Less than the cost of one bag of premium treats"
   - Green accent / highlighted border
   - "Best Value" badge

3. **Monthly card (SECONDARY — visually recessive):**
   - "$5.99/month"
   - Grayed or smaller styling — this is the "pay more" option
   - No "Best Value" badge

4. **Feature list** — what premium unlocks (with Ionicons, NOT emoji):
   - Unlimited scans (scan-outline icon)
   - Multiple pet profiles (paw-outline icon)
   - Search by name (search-outline icon)
   - Product comparison (git-compare-outline icon)
   - Safe Swap alternatives (swap-horizontal-outline icon)
   - Goal weight tracking (trending-down-outline icon)
   - Treat battery (battery-half-outline icon)

5. **Legal fine print:** "Cancel anytime. Recurring billing."

6. **CTA button:** "Start Protecting [Pet Name]" (NOT "Subscribe" or "Buy Premium")

7. **Dismiss:** "Maybe later" text link below CTA — never aggressive about closing

### Trigger Wiring (D-052 Updated)

**5 Active Triggers (fire paywall now):**

1. **6th scan in a week:**
   - In ScanScreen: after successful scan, check canScan()
   - If false → navigate to PaywallScreen with trigger='scan_limit'
   - IMPORTANT: Show the score FIRST, then trigger paywall on NEXT scan attempt
   - Never before first score (D-051)

2. **Second pet profile:**
   - In CreatePetScreen (or SpeciesSelectScreen): check canAddPet(currentCount)
   - If false → PaywallScreen with trigger='pet_limit'

3. **First Safe Swap tap:**
   - In ResultScreen: Safe Swap section (currently placeholder)
   - Show blurred alternatives with lock overlay (D-126 curiosity gap)
   - On tap → PaywallScreen with trigger='safe_swap'

4. **Search by product name (D-055):**
   - In SearchScreen: on text input attempt
   - Check canSearch() → if false → PaywallScreen with trigger='search'

5. **Compare products:**
   - Compare button (wherever it lives): check canCompare()
   - If false → PaywallScreen with trigger='compare'

**2 Pre-Wired Triggers (gate exists, feature doesn't yet):**

6. **Vet report export:** canExportVetReport() → PaywallScreen with trigger='vet_report'
   - Wire the gate in permissions.ts. The feature ships in a future milestone.

7. **Elimination diet tracker:** canStartEliminationDiet() → PaywallScreen with trigger='elimination_diet'
   - Same pattern — gate exists, feature is M16+

### Trigger Context on Paywall Screen
- PaywallScreen receives a `trigger` param
- Contextual header changes based on trigger:
  - scan_limit: "You've used all 5 free scans this week"
  - pet_limit: "Add unlimited pets with Premium"
  - safe_swap: "Discover healthier alternatives for [Pet Name]"
  - search: "Search any product by name"
  - compare: "Compare products side-by-side"

## Constraints
- D-051: Trigger checks call permissions.ts functions, not inline isPremium checks
- D-084: Ionicons only, zero emoji
- D-094: Pet name in paywall copy
- D-126: Blur pattern for safe swaps, per-month math, identity framing
- D-125: Recall Siren is NOT a trigger (it's free)
- Never show paywall before first score (D-051 rule)
- PaywallScreen must handle RevenueCat purchase flow (Purchases.purchasePackage)

## Output
- src/screens/PaywallScreen.tsx
- Update src/screens/ScanScreen.tsx (scan limit trigger)
- Update src/screens/SearchScreen.tsx (search trigger)
- Update src/screens/ResultScreen.tsx (safe swap blur + trigger, compare trigger)
- Update src/screens/CreatePetScreen.tsx or SpeciesSelectScreen.tsx (pet limit trigger)
- Update src/types/navigation.ts (PaywallScreen params)
````

### Prompt 5.3 — Legal Clickwrap TOS

````
## Task: Build Onboarding Clickwrap TOS (D-094)

Create `src/screens/TermsScreen.tsx`:

1. **When it shows:**
   - During first app launch, after onboarding intro screens, before first scan
   - Blocks ALL app usage until accepted
   - Check: if user has accepted TOS (stored in Supabase user metadata or AsyncStorage),
     skip this screen

2. **Content:**
   - Kiba logo/wordmark at top
   - The disclaimer text (D-094 — attorney-approved):
     "Kiba provides algorithmically generated suitability estimates based on public
     veterinary research and your pet's specific profile. Kiba scores do not constitute
     absolute product quality or safety ratings, nor are they an assessment of regulatory
     compliance."
   - Active checkbox: "I understand and agree" — MUST be tapped (not passive scroll)
   - "Continue" button — disabled until checkbox is active
   - Links to full Terms of Service and Privacy Policy (placeholder URLs for now)

3. **Storage:**
   - On accept: store { tos_accepted: true, tos_version: '1.0', accepted_at: ISO timestamp }
   - Store in Supabase user metadata (if authenticated) AND AsyncStorage (for anonymous users)
   - If TOS version changes in future, re-prompt acceptance

4. **Navigation:**
   - Shows before OnboardingScreen if TOS not accepted
   - After acceptance → normal onboarding flow (D-092 scan-first)
   - Cannot navigate backward past this screen

## Constraints
- MUST be active checkbox, not passive scroll-through (legal requirement)
- Blocks ALL app usage until accepted (no sneaking past)
- D-084: No emoji
- Clean, professional design — this is a legal screen, not a marketing screen
- Store acceptance with version number for future TOS updates

## Output
- src/screens/TermsScreen.tsx
- Update navigation/index.tsx (gate all routes behind TOS acceptance)
````

### Verification Prompt — Session 5

````
## Verify Session 5

### Paywall Logic Compliance
1. grep -rn "isPremium\|canScan\|canAddPet\|canSearch\|canCompare\|canUseSafeSwaps" src/
   EVERY hit must be an import from or definition in src/utils/permissions.ts.
   If ANY screen has inline premium checks → D-051 violation, must fix.

2. grep -rn "entitlement\|customerInfo\|RevenueCat\|Purchases\." src/ --include="*.ts" --include="*.tsx"
   RevenueCat calls must ONLY appear in permissions.ts and app entry point.
   Never in screen files.

### Trigger Testing
3. Test each trigger fires correctly:
   - Scan 6 times → 6th scan shows paywall? (use dev menu to inject timestamps)
   - Create 2nd pet → paywall shown?
   - Tap safe swap → paywall shown? (blurred overlay visible?)
   - Type in search → paywall shown?
   - Tap compare → paywall shown?

### Rolling Window
4. Use dev menu to:
   - Inject 5 scans from 8 days ago → canScan() should return true (outside window)
   - Inject 5 scans from 2 days ago → canScan() should return false
   - Inject 4 scans from today → canScan() should return true (under limit)

### Free Features Still Work
5. Verify recall siren is NOT gated (D-125):
   - recallCheck.ts should NOT call any permissions function
   - Recall alerts visible to non-premium users

### Clickwrap
6. Clear app storage → launch app → verify TOS screen blocks progress
7. Accept TOS → verify normal flow resumes
8. Re-launch → verify TOS screen does NOT show again

### Paywall Screen Design
9. Verify: annual card is visually dominant over monthly
10. Verify: "$2.08/mo" sub-text visible on annual card
11. Verify: pet name appears in paywall copy
12. Verify: Ionicons used, zero emoji anywhere on screen

### Regression
13. npm test → 447/447 still passing (plus new tests from Sessions 4-5)
````

---

## Session 6: Integration + Polish + Bug Fixes

### What We're Building

End-to-end verification, bug fixes from M2, scan experience polish (haptic + animation + sound), compliance audit, and documentation updates.

### Environment

- **Full stack** — Python scripts + Supabase + React Native
- **This is the final session** — everything must be production-ready

### Preamble (paste after /clear — full context reload)

````
@CLAUDE.md @DECISIONS.md @ROADMAP.md @NUTRITIONAL_PROFILE_BUCKET_SPEC.md

## Context
M3 Session 6: Integration + Polish. Sessions 1-5 are complete.
This is the final M3 session. Goals:
1. End-to-end test: scan → score with real imported data
2. Fix M2 bugs
3. Scan experience polish: haptic feedback, scanner frame animation, confirmation tone
4. Full compliance audit
5. Update CLAUDE.md and DECISIONS.md
6. Final regression test

Session 5 progress: [paste session5-m3-progress.md contents here]

RULES: All prior constraints still apply. This session is about verification, not new features.
````

### Prompt 6.1 — E2E Test + Bug Fixes

````
## Task: End-to-End Verification + Bug Fixes

### E2E Test
1. Pick 3 real products from the imported database:
   - One daily_food with full GA (should get full 55/30/15 score)
   - One treat (should get 100/0/0 score)
   - One with ingredients but no GA (should get 78/22 partial score)
2. Scan each (or simulate scan via test) → verify:
   - Score displays correctly as "[X]% match for [Pet Name]"
   - Waterfall breakdown shows correct layer contributions
   - Ingredient list renders with severity colors
   - PortionCard shows for daily food (if pet has weight)
   - TreatBatteryGauge shows for treats (if pet has weight)
   - "Partial" badge shows for missing-GA product (D-017)

3. **Worked example regression — cat wet food:**
   Pick a cat wet food with full GA from the imported data. Verify:
   - DMB conversion fires (moisture >12%) — check GATable shows dual display
   - Nutritional bucket scores against DMB values, not as-fed
   - Carb estimation uses DMB values (not as-fed) for the NFE calculation
   - Expected: nutritional bucket should score in the 85-95 range for a decent product
     (if scoring 30-50, DMB conversion is likely broken — as-fed values are being used)
   - D-104 carb display renders: confidence badge, qualitative label, expandable formula

4. **CKD gate verification:**
   - If a cat pet profile has `ckd` (chronic kidney disease) in health conditions:
     Verify that breed modifiers and personalization layer handle it correctly
   - CKD cats need LOWER phosphorus and LOWER protein — confirm the scoring engine's
     Layer 3 personalization applies the right direction
   - If CKD is not yet in the health conditions list: document as M4 gap, do NOT build

### Bug Fix 1: Delete Button Shows Stale Pet Name
- Location: EditPetScreen.tsx
- Issue: "Delete [Pet Name]" reads from initial mount data, not current form state
- Fix: Read pet name from form state (watch('name') or equivalent), not route.params
- Low priority, cosmetic, but fix it while we're here

### Bug Fix 2: DEV Test Result Screen Broken
- Location: HomeScreen.tsx → "Test Result Screen" dev button
- Issue: White screen — references old usePetStore or stale nav params
- Fix: Delete it entirely. We now have a proper DevMenu (Session 5) and real data
  to test with. This dev button is dead code.

### Bug Fix 3: Clean Up Dead Code
- Delete src/screens/MeScreen.tsx (replaced by PetHubScreen in M2)
- Remove any imports/references to MeScreen
- Remove usePetStore.ts if no longer imported anywhere (replaced by useActivePetStore)

### Polish: ScanScreen Sensory Feedback
The scan experience currently has no physical feedback — barcode detection silently navigates.
Add three layers of "scan confirmed" feedback:

**A. Haptic feedback**
- On successful barcode detection: `Haptics.notificationAsync(NotificationFeedbackType.Success)`
  — firm double-tap, unmistakable "got it" feel
- On database miss (D-091 flow starts): `Haptics.notificationAsync(NotificationFeedbackType.Warning)`
  — softer single pulse, signals "working on it" not "failed"
- Import from `expo-haptics` (already in Expo SDK, no install needed)

**B. Scanner frame animation**
- Viewfinder overlay: four corner brackets (partial-border positioned views) framing
  the scan area. Static green (#4ADE80) outline, transparent center.
- Animated scan line: `Animated.View` with green glow, loops top-to-bottom inside the
  frame using `Animated.loop` + `Animated.timing`. 1.5-2s per cycle.
- On barcode detected: corners briefly snap inward (scale animation, ~150ms) and flash
  brighter — the "locked on" moment. Then navigate after the animation completes.
- Keep it lightweight — this is a styled overlay on the camera, no heavy dependencies.

**C. Confirmation tone**
- Bundle a short (~200ms) subtle confirmation sound asset (soft chime, not a grocery
  scanner beep). Use `expo-av` Audio.Sound to play on barcode detection.
- Add a mute toggle: store `scanSoundEnabled` in AsyncStorage (default: true).
  Accessible from a small speaker icon on the ScanScreen (top-right, near flash toggle).
- When muted: haptic still fires, sound doesn't. Icon switches to muted state.
- D-084 compliance: use Ionicon `volume-high-outline` / `volume-mute-outline`, no emoji.

**Implementation notes:**
- All three fire in the `onBarcodeScanned` callback, before navigation
- The corner animation needs ~200ms to complete — add a brief delay before navigating
  so the user sees the "locked" state. This also prevents accidental double-scans.
- Sound file: include a royalty-free chime in `assets/sounds/scan-confirm.mp3`
  (keep under 50KB — it's a tiny blip, not a melody)
- Test with phone on silent mode — haptic should still work, sound respects silent switch

## Output
- Fixed EditPetScreen.tsx
- Cleaned HomeScreen.tsx (removed dead dev button)
- Deleted MeScreen.tsx
- Deleted usePetStore.ts (if fully replaced)
- Updated src/screens/ScanScreen.tsx (haptic, animation, sound)
- New src/components/ScannerOverlay.tsx (corner brackets + animated scan line)
- New assets/sounds/scan-confirm.mp3 (bundled confirmation tone)
````

### Prompt 6.2 — Compliance Audit

````
## Task: Full M3 Compliance Audit

Run every check below. Report results as PASS/FAIL with evidence.

### D-084: Zero Emoji
```bash
# Search for emoji in all TypeScript/TSX files
grep -rPn '[\x{1F300}-\x{1F9FF}\x{2600}-\x{26FF}\x{2700}-\x{27BF}]' src/ --include="*.ts" --include="*.tsx"
```
Expected: ZERO results. Any emoji → must replace with Ionicon.

### D-094: No Naked Scores
```bash
# Find score displays — every one must include pet name
grep -rn "score\|Score\|match\|Match\|suitability" src/screens/ src/components/ --include="*.tsx" | grep -v "Pet\|pet\|Name\|name"
```
Review results manually. Every score display must be "[X]% match for [Pet Name]".

### D-095: UPVM Compliance
```bash
# Prohibited terms in UI-facing copy
grep -rni "prescribe\|\ treat\ \|\ cure\ \|\ prevent\ \|\ diagnose" src/ --include="*.ts" --include="*.tsx"
```
Expected: ZERO results in UI copy. (Code variable names like `treatBattery` are OK.)

### D-051: Paywall Centralization
```bash
# Every isPremium/canScan/etc call must come from permissions.ts
grep -rn "isPremium\|canScan\|canAddPet\|canSearch\|canCompare" src/ --include="*.ts" --include="*.tsx" | grep -v "permissions.ts" | grep -v "import.*from.*permissions"
```
Expected: Only import statements, never inline logic.

### D-127: No API Keys in App
```bash
grep -rni "ANTHROPIC\|sk-ant\|upcitemdb\|scrapedo" src/ --include="*.ts" --include="*.tsx"
```
Expected: ZERO results. All API keys live in Edge Functions or .env (backend scripts only).

### D-043: LLM Data Validated
- Verify extract_ga.py has range checks before DB insertion
- Verify no code path bypasses validation

### D-125: Recall Siren Free
```bash
grep -rn "isPremium\|canScan\|permission" src/services/recallCheck.ts
```
Expected: ZERO results. Recall checking must not involve any paywall logic.

### D-128: Haiku Classification Flow
- Verify parse-ingredients Edge Function returns suggested_category + suggested_species
- Verify ProductConfirmScreen renders category + species chip selectors
- Verify supplement selection exits flow without scoring
- Verify grooming selection exits flow without scoring
- Verify community-saved products have haiku_suggested_category and user_corrected_category columns:
```bash
# Check that classification fields exist in the community save code
grep -rn "haiku_suggested\|user_corrected" src/ --include="*.ts" --include="*.tsx"
```
Expected: References in ProductConfirmScreen or ingredientParser service.

### Scoring Engine Untouched
```bash
git diff HEAD -- src/services/scoring/
```
Expected: ZERO changes to any file in scoring directory.

### Report Format
For each check, report:
- CHECK: [description]
- RESULT: PASS | FAIL
- EVIDENCE: [grep output or explanation]
- FIX: [if FAIL, what to change]
````

### Prompt 6.3 — Documentation Updates

````
## Task: Update Project Documentation

### CLAUDE.md Updates
Apply all changes from the Pre-Session Checklist (§1 of this guide):
- Current phase → M3 Data Pipeline + Paywall (M0 + M1 + M2 Complete)
- Decision count → 128 (D-001 through D-124 existing + D-125 through D-128 added in M3)
- Test count → [actual count after M3]
- Add scripts/ and supabase/functions/ to project structure
- Add "What NOT to Build" entries
- Add Self-Check entries

### DECISIONS.md Updates
- Add D-125 (Recall Siren → free tier)
- Add D-126 (Paywall psychology patterns)
- Add D-127 (API keys server-side only)
- Add D-128 (Haiku product classification on database miss)
- Update D-052 (new trigger list — 5 active + 2 pre-wired)
- Log any other decisions that emerged during Sessions 1-5

### ROADMAP.md Updates
- Check all M3 items as complete [x]
- Update "Current Status" header
- Update completed section with M3 summary

### Final Regression
npm test → all tests must pass.
Report final test count (should be 447 + new tests from Sessions 4-5).
````

---

## Notes for Steven

### Manual Steps You'll Need to Do (Can't Be Automated by Claude Code)

1. **App Store Connect:** Create $24.99/yr and $5.99/mo subscription products. RevenueCat needs these product IDs.
2. **RevenueCat Dashboard:** Create app, configure entitlements, link to App Store Connect products.
3. **EAS Build:** After Session 5, run `eas build --profile development` to get a build with native RevenueCat module. `expo start` alone won't work for paywall testing.
4. **Supabase Dashboard:** Deploy Edge Functions and set secrets (ANTHROPIC_API_KEY).
5. **Review flagged_for_review.json** from Session 2 — these are products where Haiku extracted suspicious GA values that need manual verification.
6. **Review new_ingredients.json** from Session 1 — these are ingredients not in the seed database that were auto-added as 'unknown'. The top ~50 most common ones should be manually categorized. Also assign `cluster_id` values to related ingredients (e.g., "peas", "pea protein", "pea starch" → same cluster) — ingredient splitting detection won't work for new ingredients until this is done.

### What to Watch For in Plan Review

- **Session 1 is the big one for data integrity.** If the import pipeline has mapping bugs, everything downstream scores wrong. Verify the first 10 products manually against Chewy before running the full batch.
- **Session 2's Haiku extraction will NOT work for all 514 products.** Many of them don't have GA text in their scraped data — Haiku can't extract what isn't there. Expect ~60-70% success rate. The rest stay as partial-score products.
- **Session 5 requires EAS Build.** Budget 30-60 minutes for the first build if you haven't done one recently. RevenueCat's native module won't load in Expo Go.
- **The rolling scan window (Session 5) is subtle.** Use the dev menu extensively to test edge cases: 5 scans exactly 7 days ago (should be free again), 5 scans 6 days 23 hours ago (should still be blocked), etc.

### Cost Estimates for M3

| Item | Cost | Notes |
|------|------|-------|
| Claude Haiku (Session 2 refinery) | ~$0.15 | ~500 products × ~300 tokens each |
| Claude Haiku (Session 4 OCR, ongoing) | ~$0.001/parse | Per community contribution |
| Scrape.do (monthly re-scrape) | ~$3-5/run | Pay-per-request, only proxy that bypasses Chewy Akamai. Replaced by Chewy affiliate API once approved. |
| RevenueCat | Free tier | Free up to $2.5K MTR |
| UPCitemdb | Free tier | 100 lookups/day, no key needed |
| **Total M3 one-time** | **~$5-10** | Mostly Scrape.do |

### Regional Expansion — Future Scope (Documented, Not Built)

Your note about regional affiliate targeting is filed for M15 (International):
- US: Chewy + Amazon.com (current)
- Canada: PetSmart.ca + Amazon.ca
- EU: Zooplus + Amazon regional
- Implementation: IP-based locale detection → retailer mapping in affiliate_links JSONB
- Data model is already retailer-agnostic (source_url, no hardcoded retailer logic)
- This does NOT affect M3 scope

---

## M3 File Tree (Expected Final State)

```
kiba-app/
├── CLAUDE.md                          ← Updated in Session 6
├── DECISIONS.md                       ← Updated (D-125 through D-128 + D-052 update)
├── ROADMAP.md                         ← Updated (M3 items checked off)
├── scripts/                           ← NEW: M3 backend pipeline scripts
│   ├── import/
│   │   ├── import_products.py         ← Session 1: JSON → Supabase
│   │   ├── parse_ingredients.py       ← Session 1: ingredients → junction table
│   │   ├── ingredient_matcher.py      ← Session 1: matching logic (reused by OCR)
│   │   ├── config.py                  ← Shared: env vars, Supabase client
│   │   ├── validators.py              ← Session 1: record validation
│   │   ├── SESSION1_CONTEXT.md
│   │   └── README.md
│   ├── refinery/
│   │   ├── extract_ga.py              ← Session 2: Haiku GA extraction
│   │   ├── validator.py               ← Session 2: range checks
│   │   └── README.md
│   └── pipeline/
│       ├── detect_changes.py          ← Session 3: formula change detection
│       ├── hash_utils.py              ← Session 3: shared normalization + hashing
│       └── README.md
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_m2_pet_profiles.sql
│   │   └── 003_m2_health_reviewed.sql
│   └── functions/                     ← NEW: Edge Functions
│       ├── parse-ingredients/
│       │   └── index.ts               ← Session 3: Haiku ingredient parsing + product classification (D-128)
│       └── upc-lookup/
│           └── index.ts               ← Session 4: external UPC lookup
├── src/
│   ├── screens/
│   │   ├── ProductConfirmScreen.tsx    ← Session 4: "Is this [Product Name]?"
│   │   ├── IngredientCaptureScreen.tsx ← Session 4: OCR photo capture
│   │   ├── PaywallScreen.tsx          ← Session 5: subscription screen
│   │   ├── TermsScreen.tsx            ← Session 5: legal clickwrap
│   │   ├── [all existing M0-M2 screens]
│   │   └── MeScreen.tsx               ← DELETED in Session 6
│   ├── services/
│   │   ├── ocrService.ts              ← Session 4: on-device text extraction
│   │   ├── ingredientParser.ts        ← Session 4: calls Edge Function
│   │   ├── scanner.ts                 ← UPDATED: routes misses to D-091 flow
│   │   ├── scoring/                   ← UNTOUCHED — M1 code, locked
│   │   └── [all existing M1-M2 services]
│   ├── components/
│   │   ├── PartialScoreBadge.tsx      ← Session 4: "Partial" badge
│   │   ├── ScannerOverlay.tsx         ← Session 6: corner brackets + animated scan line
│   │   ├── DevMenu.tsx                ← Session 5: __DEV__ only QA tool
│   │   └── [all existing M0-M2 components]
│   ├── utils/
│   │   ├── permissions.ts             ← Session 5: UPGRADED from stubs to RevenueCat
│   │   └── [all existing utils]
│   ├── stores/
│   │   ├── usePetStore.ts             ← DELETED in Session 6 (replaced by useActivePetStore)
│   │   └── [all existing stores]
│   └── navigation/
│       └── index.tsx                  ← UPDATED: TOS gate, new screen routes
├── assets/
│   └── sounds/
│       └── scan-confirm.mp3          ← Session 6: bundled confirmation tone (<50KB)
└── __tests__/
    ├── services/scoring/              ← UNTOUCHED — M1 tests
    └── [all existing + new M3 tests]
```

---

## Self-Check — Run Before Declaring M3 Complete

```
□ Data imported: ~8,800+ products in Supabase?
□ Ingredients parsed: product_ingredients junction populated for daily_food + treats?
□ ingredients_dict expanded with new ingredients (needs_review = true)?
□ LLM refinery: ~300-450 products upgraded from partial → full GA?
□ Formula change detection: hash normalization consistent, diff engine tested?
□ Database miss flow: UPC external lookup → confirm → OCR → partial score → community save?
□ Haiku classification: category + species suggested, user confirms via chips (D-128)?
□ Supplement/grooming exit paths: stored but NOT scored (D-096, D-083, D-128)?
□ Community products log: haiku_suggested + user_corrected fields stored for accuracy auditing?
□ Edge Functions deployed: parse-ingredients + upc-lookup (D-127)?
□ Paywall: RevenueCat installed, permissions.ts upgraded, 5 triggers wired?
□ Paywall triggers: 6th scan, 2nd pet, safe swap, search, compare — all fire?
□ Rolling scan window: 7-day rolling, NOT calendar week?
□ Recall Siren: free for all users, NOT gated (D-125)?
□ Paywall screen: annual dominant, $2.08/mo callout, pet name in copy, Ionicons?
□ Clickwrap TOS: active checkbox, blocks app until accepted?
□ Dev menu: accessible in __DEV__, stripped from production?
□ Bug fixes: stale delete name, dead dev button, MeScreen deleted?
□ Scan polish: haptic fires on detection, corner animation plays, confirmation tone plays?
□ Scan mute toggle: persists across sessions, icon updates, sound silenced when muted?
□ Compliance audit: D-084, D-094, D-095, D-051, D-127 all PASS?
□ Scoring engine: ZERO changes to src/services/scoring/?
□ All tests passing: 447 + new M3 tests?
□ CLAUDE.md updated with M3 state?
□ DECISIONS.md updated with D-125, D-126, D-127, D-128, D-052 revision?
□ ROADMAP.md M3 items checked off?
□ No API keys in React Native code (grep verified)?
□ Supplements stored but NOT scored (D-096)?
□ All partial scores show "Partial" badge + explanation (D-017)?
□ All scores display as "[X]% match for [Pet Name]" (D-094)?
□ No UPVM-prohibited terms in UI copy (D-095)?
```

---

*This prompt guide is complete. 6 sessions, 3 environments, copy-paste ready.
Match or exceed M2 quality. Ship it.*