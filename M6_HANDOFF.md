# M6 Handoff — Session Summary

> Date: March 25, 2026
> Context: Data pipeline v7 reimport + M6 spec drafting session
> Start next chat with: "Read M6_HANDOFF.md to get current"

---

## What We Did This Session

### 1. Data Pipeline — v7 Master Dataset (COMPLETE)

Built and imported a 19,058-product dataset from 3 retailers:

| Source | Products | Ingredients | GA | UPC |
|---|---|---|---|---|
| Chewy (v6 + rerun merged) | 15,745 | 96.0% | 70.8% | 92.0% |
| Amazon (6 scrape files) | 3,182 | 100% | 0% | 0.6% |
| Walmart (cleaned) | 131 | 97.8% | 0% | 85.1% |
| **Total** | **19,058** | **96.6%** | **58.5%** | **76.7%** |

**Enrichment applied to dataset before import:**
- DMB conversion (11,378 products) — `ga_protein_dmb_pct`, `ga_fat_dmb_pct`, etc.
- AAFCO inference — 5,719 upgraded to "yes" (GA passes AAFCO on DMB), 2,201 to "likely"
- AAFCO nulled for treats (6,002), supplements (4,044), supplemental (840)
- kcal/kg derivation — 1,954 products fixed using species-specific ratios
- Supplemental classification — 1,592 toppers/mixers/broth tagged
- Blue Buffalo Life Protection Small Breed: AAFCO now shows "yes" (was "unknown")

**Database state:**
- Migration 020 applied (DMB columns, supplemental flag, retailer IDs, AAFCO inference)
- 19,058 products inserted, 14,620 UPCs, 0 errors
- Ingredients parsed: 98.4% match rate, 414,105 junction rows, 7,690 ingredients_dict entries
- kcal SQL fix (v3 species-specific) applied post-import

### 2. Walmart Dataset Cleanup (COMPLETE)

Original 270 MB → 777 KB after stripping bloated `_pet_food_flavor` fields. Fixed:
- Brand extraction (was "Brand Shop Directory" → now Ol' Roy/Pure Balance/Special Kitty/Vibrant Life)
- HTML entities in ingredients
- Multi-pack brand detection

### 3. Files Delivered

**Pipeline scripts (copy to `scripts/import/`):**
- `import_products.py` — updated for v7 fields (DMB, AAFCO, supplemental, retailer IDs)
- `add_products.py` — **NEW** incremental import (use for all future data adds, never wipe again)

**Migrations (copy to `supabase/migrations/`):**
- `020_v7_enrichment_columns.sql` — DMB, supplemental, AAFCO inference, retailer IDs, product display fields

**Reference docs (copy to `references/` or project root):**
- `DATA_PIPELINE_GUIDE.md` — complete knowledge base: dataset overview, incremental import flow, enrichment pipeline, ingredient dictionary, all 4 missing data strategies (Vertex AI TLDR, A+ image OCR, Atwater kcal, OCR Edge Function)
- `V7_REIMPORT_INSTRUCTIONS.md` — step-by-step for the reimport (already executed, keep for reference)

**M6 specs (copy to `specs/` or `docs/`):**
- `M6_SAFE_SWAP_COMPARE_SPEC.md` — Safe Swap + Compare feature spec (DRAFT)
- `M6_WEIGHT_MANAGEMENT_SPEC.md` — D-160 slider + D-161 accumulator + D-162 BCS (DRAFT)

**Mocks:**
- `kiba_vet_report_mock_v2.html` — diet-centric vet report, 3 pages (DRAFT)

---

## M6 Scope — What's Specced vs Not

### ✅ Specced (draft complete, needs review)

**1. Safe Swap Recommendations + Compare** (`M6_SAFE_SWAP_COMPARE_SPEC.md`)
- Safe Swap section on ResultScreen — curated alternatives
- Daily dry: 3-pick system (Non-Fish, Fish-Based, Great Value by price-per-kg)
- All other forms: generic top-5 horizontal scroll, strictly form-matched
- Hard filters: no severe ingredients, no allergens, no pantry/recent scans
- Multi-pet chip row: solo default, "All Dogs"/"All Cats" group mode with floor score + allergen union
- Rotation: daily seed + pantry/scan exclusion + manual refresh ↻
- Compare: side-by-side premium screen with Key Differences engine (8 rules-based checks)
- M8 Kiba Index sort prep (COALESCE columns ready, falls back to score-only until M8)
- Brand-blind value slot (price-per-kg math, no hardcoded brand list)
- **Needs:** Migration for `price`, `price_currency`, `product_size_kg` columns + backfill

**2. Weight Management** (`M6_WEIGHT_MANAGEMENT_SPEC.md`)
- D-160: 7-position weight goal slider on PortionCard (−3 to +3, cat cap at −2)
- Health condition constraints: overweight blocks gain (+1/+2/+3), underweight blocks loss
- Auto-reset + toast when health condition conflicts with current goal
- D-161: Caloric accumulator in auto-deplete cron (dogs 3,150 kcal/lb, cats 3,000 kcal/lb)
- Notify-and-confirm flow: "Buster may have gained about 1 lb"
- D-162: BCS reference tool (9-point scale, species-tabbed, primordial pouch callout)
- Optional BCS self-assessment stored on pet profile (`bcs_score`, `bcs_assessed_at`)
- **Needs:** Migration 022 (`caloric_accumulator`, `accumulator_last_reset_at`, `accumulator_notification_sent`, `bcs_score`, `bcs_assessed_at` on pets)

**3. Vet Report** (mock complete, spec not yet written)
- Diet-centric 3-page PDF (not product-centric)
- Page 1: Pet profile + BCS + activity + full diet table + flags
- Page 2: Combined GA (as-fed + DMB + AAFCO pass/fail), per-product score breakdown, weight tracking
- Page 3: Ingredient lists with allergen-only flags (no good/caution clutter), vet notes box
- Walk tracking: leverages appointment system (recurring daily "Walk" type with duration)
- **Needs:** Full spec written, PDF generation approach decided (react-native-pdf? server-side? expo-print?)

### ❌ Not Yet Specced (M6 scope per ROADMAP + this session)

**4. Health Conditions Expansion**
- Expanded condition list (hypothyroidism, hyperthyroidism, kidney disease, diabetes, pancreatitis, heart disease)
- Mutual exclusions (hypo/hyper, overweight/underweight)
- Contextual notes on ResultScreen per condition (D-095 safe)
- Condition management education cards
- Medication tracking (current + past, on pet profile + vet report)
- **Decision needed:** Notes-only vs Layer 3 score adjustments (needs vet audit if score-affecting)
- See "Health Conditions Expansion" section below for full details

**5. Pet Sitter Report**
- Slim 1-page PDF: feeding schedule, meds, allergies, emergency contacts, behavioral notes
- No scores, no GA, no ingredient analysis — just care instructions
- Needs emergency contact fields on pet profile
- See "Pet Sitter Report" section below for full details

**6. Affiliate Integration**
- Chewy affiliate program application
- Amazon Associates setup
- `affiliate_links` JSONB population
- FTC disclosure auto-rendered below buy buttons
- Buy buttons hidden for products scoring <50
- Pricing display (Chewy: estimated price, Amazon: "Check Current Price")
- **Blocked on:** ~500+ active users (Chewy program requirement)

**7. BCS Reference Tool Visual Assets**
- 9 dog silhouettes (BCS 1-9, side + top view)
- 9 cat silhouettes (BCS 1-9, side + top view)
- Can use placeholder text descriptions initially, real illustrations later
- **Blocked on:** illustrator/designer or AI-generated assets

### ⏳ Deferred (future milestones)

| Feature | Milestone | Status |
|---|---|---|
| M7 Safe Switch Guide | M7 | Not started — 7-day transition plan |
| Kiba Index voting (Taste Test + Tummy Check) | M8 | Safe Swap sort query designed for it |
| Health conditions → score adjustments (if approved) | M6 or M7 | Needs decision: notes-only vs Layer 3 modifiers. Vet audit required for modifiers. |
| Medication-food interaction warnings | M10+ | e.g., thyroid meds + calcium. Needs pharmacology DB. |
| Walk tracking via HealthKit | M10+ | Manual logging first, schema supports both |
| A+ Image OCR for GA backfill | Post-launch | Pipeline designed, ~$160 for Amazon |
| Vertex AI TLDR backfill | Post-launch | ~$3.50 for meaningful coverage |
| Atwater kcal estimation (D-149) | Post-launch | Formula ready, needs script |
| Zooplus import | When ready | `add_products.py` built for this |

---

## Tech Debt Carried Into M6

From M5 Polish (believed done but verify):
- D-159 low-score context line
- Time picker redesign
- D-166 cups/servings helper text + "Track in cups" conversion fix
- PantryCard treat vs as_needed
- D-124 treat quick picker
- HomeScreen dashboard cards
- Feeding stepper expansion (1-3 → 1-5)

Known issues:
- Search function and category browsing need improvement
- Treat calorie tracking accuracy needs verification
- Atwater fallback not confirmed wired
- Free user experience not fully tested
- Product names need cleanup pass ("BUNDLE:Sheba..." prefixes)

---

## Database Current State

| Table | Rows | Notes |
|---|---|---|
| products | 19,058 | v7 master, 3 retailers |
| product_upcs | 14,620 | 76.7% coverage |
| product_ingredients | 414,105 | 98.4% match rate |
| ingredients_dict | 7,690 | 648 curated, ~7,042 auto-inserted |
| ingredients with TLDR | ~208 | Vertex AI backfill pending for ~270 high-occurrence |

**Schema additions (Migration 020):**
- `ga_*_dmb_pct` columns (9 DMB fields)
- `is_supplemental`, `aafco_inference`
- `product_form`, `image_url`, `source_url`
- `chewy_sku`, `asin`, `walmart_id`
- `ga_omega3_pct`, `ga_omega6_pct`, `ga_epa_pct`, `ga_linoleic_acid_pct`

**Still needs (Migration 021 — Safe Swap):**
- `price NUMERIC`, `price_currency TEXT`, `product_size_kg NUMERIC`

**Still needs (Migration 022 — Weight Management):**
- `caloric_accumulator NUMERIC`, `accumulator_last_reset_at TIMESTAMPTZ`, `accumulator_notification_sent BOOLEAN`
- `bcs_score SMALLINT`, `bcs_assessed_at TIMESTAMPTZ`

**Still needs (Migration 023 — Health + Sitter):**
- `pets`: `emergency_vet_name TEXT`, `emergency_vet_phone TEXT`, `emergency_contact_name TEXT`, `emergency_contact_phone TEXT`, `behavioral_notes TEXT`
- New table `pet_medications`: `id UUID PK`, `pet_id UUID FK`, `medication_name TEXT`, `status TEXT ('current'/'past'/'as_needed')`, `dosage TEXT`, `started_at DATE`, `ended_at DATE`, `prescribed_for TEXT`, `notes TEXT`, RLS on user_id via pets join

---

## Prompt Order for Claude Code (M6 Build)

### Phase 1: Safe Swap + Compare
1. Migration 021 (price columns) + backfill from v7 dataset + parse_size_to_kg()
2. SafeSwapSection component + safeSwapService.ts (query, rotation, multi-pet)
3. CompareScreen (side-by-side, Key Differences engine)
4. Polish + edge cases (empty cache, missing images, slot fallbacks)

### Phase 2: Weight Management
5. Migration 022 (accumulator + BCS columns)
6. Weight goal slider on PortionCard + getAdjustedDER() + health condition constraints
7. Caloric accumulator in auto-deplete cron + push notification
8. WeightEstimateSheet (confirm/enter/dismiss flow)
9. BCS Reference Screen (educational, placeholder illustrations)

### Phase 3: Vet Report + Pet Sitter Report
10. Vet Report spec (needs writing)
11. PDF generation approach
12. Diet-centric vet report layout (3 pages)
13. Walk tracking via appointment system
14. Pet Sitter Report — slimmer 1-page version (see below)

### Phase 4: Health Conditions Expansion
15. Expand health condition list + mutual exclusions (see below)
16. Health conditions → score influence (Layer 3 personalization)
17. Condition management education cards (D-095 compliant)
18. Medication tracking (current + past)

### Phase 5: Polish
19. Product name cleanup ("Bundle:" prefix strip, etc.)
20. Search improvements
21. Free user experience audit
22. Treat calorie accuracy pass

---

## Health Conditions Expansion (Phase 4 — needs spec)

### Current State
Health conditions exist on pet profiles but are underutilized. They block slider positions (overweight/underweight) as of this session, but don't influence scores or provide educational context.

### Planned Improvements

**1. Expanded condition list with mutual exclusions:**

| Condition | Species | Mutually Exclusive With | Score Impact (planned) |
|---|---|---|---|
| Overweight / Obese | Both | Underweight | Blocks gain on slider. Future: boost fiber scoring, flag calorie-dense foods. |
| Underweight | Both | Overweight / Obese | Blocks loss on slider. Future: flag low-calorie foods. |
| **Hypothyroidism** (NEW) | Dogs primarily | Hyperthyroidism | Low metabolism — weight gain risk. Flag high-fat foods. Common in dogs, rare in cats. |
| **Hyperthyroidism** (NEW) | Cats primarily | Hypothyroidism | High metabolism — weight loss risk. Flag iodine-restricted diets. Common in cats, rare in dogs. |
| Kidney disease | Both | — | Flag high-phosphorus foods, note protein quality over quantity |
| Diabetes | Both | — | Flag high-glycemic carbs, note fiber importance |
| Pancreatitis | Both | — | Flag high-fat foods |
| Heart disease | Both | — | Flag high-sodium foods, note taurine/L-carnitine |
| Urinary issues | Both | — | Note moisture importance, mineral balance |
| Allergies/sensitivities | Both | — | Already handled by allergen system (D-129) |

**Mutual exclusion UI:** Selecting hypothyroidism grays out hyperthyroidism (and vice versa). Same for overweight/underweight. Tap on grayed option shows: "Can't select both — [Pet Name] is already marked as [condition]."

**2. Health conditions influencing scores (Layer 3):**

This is sensitive territory. D-094 says scores are suitability matches, D-095 says no prescriptive language. The safe approach:

- Conditions add **contextual notes** on the ResultScreen, NOT score modifiers
- Example: Pet has pancreatitis → note below NP section: "This product has 18% fat (DMB). Pets with pancreatitis history may benefit from lower-fat options. Discuss with your veterinarian."
- Notes are factual observations, not recommendations
- Scoring engine stays condition-blind — conditions affect **what we show** (notes, safe swap filters), not the number

**Alternative (bolder, needs D-095 review):** Conditions apply small Layer 3 adjustments (±5 pts max) with citations. Pancreatitis pet scanning a 25% fat food gets a −3 on NP sub-score. Requires vet audit and careful framing.

**Decision needed:** Contextual notes only (safe) vs small score adjustments (bolder, more useful, needs vet sign-off)?

**3. Condition management education:**

Per-condition education cards accessible from pet profile. Similar to BCS reference — informational, not diagnostic.

| Card Content | D-095 Safe | D-095 Dangerous |
|---|---|---|
| "Hypothyroidism is a condition where..." | ✅ Factual definition | |
| "Dogs with hypothyroidism may benefit from..." | ❌ | "benefit from" is prescriptive |
| "Some veterinarians recommend lower-fat diets for..." | ✅ Attributed to vets | |
| "You should switch to a weight management food" | | ❌ Prescriptive |
| "Common dietary considerations include fiber content and caloric density" | ✅ Observational | |

**Framing rule:** Always "some veterinarians consider" or "dietary factors that may be relevant include" — never "you should" or "this food is good/bad for [condition]."

**4. Medication tracking:**

| Field | Type | Notes |
|---|---|---|
| medication_name | TEXT | User-entered (no autocomplete — we're not a pharmacy DB) |
| status | ENUM | 'current' / 'past' / 'as_needed' |
| started_at | DATE | Optional |
| ended_at | DATE | Optional (null = still taking) |
| dosage | TEXT | Free text ("1 tablet daily", "0.5ml twice daily") |
| prescribed_for | TEXT | Optional — links to a health condition |
| notes | TEXT | Optional |

Schema: `pet_medications` table with FK to `pets.id`, RLS on `user_id`.

**Medications do NOT influence scoring.** They appear on the vet report only — vets want to see the medication list alongside the diet. Certain medications have food interactions (e.g., thyroid meds and calcium-rich foods) but encoding that is M10+ scope at earliest.

**Display:** Medication section on PetHubScreen below health conditions. Current meds shown with green dot, past meds collapsed. Vet report includes full medication list.

---

## Pet Sitter Report (Phase 3 — needs spec)

A slimmer 1-page version of the vet report designed for when you leave your pet with a sitter, boarder, or family member.

### What's On It

| Section | Content |
|---|---|
| **Pet basics** | Name, species, breed, age, weight, photo |
| **Health conditions** | Listed with brief notes |
| **Allergies** | Bold, prominent — sitter MUST know these |
| **Current medications** | Name, dosage, frequency, time of day |
| **Feeding schedule** | Each food product, serving size, time of day, special instructions |
| **Treat limits** | Max treats per day, which treats are approved |
| **Emergency contacts** | Vet clinic name + phone, owner phone, backup contact |
| **Activity needs** | Walk duration/frequency (dogs), play notes |
| **Behavioral notes** | Free text field — "scared of thunder", "doesn't like other dogs", etc. |

### What's NOT On It

- Scores (sitter doesn't need to know the food scored 85%)
- Nutritional profile / GA tables
- Ingredient lists
- Weight tracking / accumulator
- BCS assessment

### Entry Point

PetHubScreen → "Generate Sitter Report" button (next to "Generate Vet Report"). Outputs a clean, printable 1-page PDF or shareable image.

### Schema Additions Needed

```sql
-- On pets table (or a separate pet_sitter_info table)
ALTER TABLE pets ADD COLUMN IF NOT EXISTS emergency_vet_name TEXT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS emergency_vet_phone TEXT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
ALTER TABLE pets ADD COLUMN IF NOT EXISTS behavioral_notes TEXT;
```

These fields live on the pet profile and only surface in the sitter report.

---

## Key Decisions This Session

| Topic | Decision |
|---|---|
| Reimport approach | Full wipe for v7 (one-time), incremental going forward |
| AAFCO inference | Tier 1: GA passes DMB → "yes". Tier 2: signals → "likely". Null for treats/supplements/supplemental. |
| DMB storage | Pre-computed in dataset + DB (not compute-at-score-time) |
| kcal derivation | Baked into enrichment pipeline permanently (not a SQL patch) |
| Supplemental AAFCO | Null (not applicable) — showing "no AAFCO" on toppers is misleading |
| Safe Swap value slot | Price-per-kg math, brand-blind (no hardcoded brand list) |
| Safe Swap rotation | Daily seed + pantry/scan exclusion + manual refresh |
| Safe Swap for supplemental | Yes — supplemental ↔ supplemental matching |
| No severe in recommendations | Hard filter on all Safe Swap queries |
| Multi-pet swaps | Solo default, "All Dogs"/"All Cats" group mode, species never mix |
| Weight slider + health conditions | Overweight blocks gain, underweight blocks loss, auto-reset on conflict |
| Vet report approach | Diet-centric (whole diet), not product-centric (one product) |
| Ingredient flags on vet report | Allergen-only — removed good/caution (vets don't need it) |
| BCS | Optional owner-reported, stored on pet profile, displayed on vet report |
| Walk tracking | Via existing appointment system (recurring daily "Walk" type with duration) |
| Health conditions → scores | Needs decision: contextual notes only (safe) vs small Layer 3 adjustments (bolder, needs vet audit) |
| Hypothyroidism/Hyperthyroidism | Mutually exclusive. Hypo = dogs primarily, Hyper = cats primarily. Gray out the other when one is selected. |
| Medications | Track current + past on pet profile. Display on vet report. Do NOT influence scoring. |
| Pet sitter report | Slim 1-page version of vet report: feeding schedule, meds, allergies, emergency contacts. No scores or nutrition data. |
| Pawdi competitive context | They use OPFF (crowdsourced) + LLM scoring (non-deterministic). We use curated scraped data + deterministic engine. Their 300K claim is inflated. |
