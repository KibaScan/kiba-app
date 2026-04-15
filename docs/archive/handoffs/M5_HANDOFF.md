# M5 Handoff — Pantry + Recall Siren

> **From:** Claude (QA/Strategy layer — claude.ai)
> **To:** Next development session
> **Date:** March 17, 2026
> **State:** M4.5 complete. UI polish complete. Post-handoff cleanup rounds 1–5 complete. iOS dev client working (tunnel mode). Ready for M5 coding.
> **Pure Balance:** 62 (D-137 DCM pulse framework)
> **Temptations:** 9 (D-142 colorant severity escalation: IQ 19, taurine −10)
> **Tests:** 641 passing, 32 suites
> **Decisions:** D-001 through D-151

---

## What's Done (M0–M4.5 + UI Polish + Cleanup)

### M0: Foundation
Expo + TypeScript, Supabase schema with RLS, Zustand stores, navigation shell, onboarding flow (D-092).

### M1: Scan → Score Pipeline
Camera + barcode, 3-layer scoring engine, result screen with progressive disclosure, score ring, concern tags, waterfall breakdown, full ingredient list.

### M2: Pet Profiles
Create/edit/delete pets, species/breed/weight/DOB/activity, health conditions + allergen picker, multi-pet carousel, portion calculator, treat battery.

### M3: Data + Paywall
8,869 products imported, 175K+ junction rows, ingredient parsing pipeline, GA refinery, formula change detection, database miss flow, RevenueCat paywall (5 triggers, rolling 7-day scan window), legal clickwrap TOS. 447 tests.

### M4: Product Detail + Education (Sessions 1–6)

**New components (10):**
- BenchmarkBar — product vs category average with contextual delta labels ("+14 above avg match"), ≥30 peer threshold, supplemental suppression
- AafcoProgressBars — AAFCO threshold visualization, expandable raw GA, carb estimate with NFE tooltip, supplemental "Macro Profile" mode, treat mode (carb-only)
- BonusNutrientGrid — present-first layout (present items as rows, absent as comma-separated line)
- PositionMap — tap-to-identify with edge-clamped floating label below bar (D-148)
- SplittingDetectionCard — cluster_id splitting detection
- FlavorDeceptionCard — three-layer label mismatch (concern tag + card + annotation)
- DcmAdvisoryCard — heart health education, shows which D-137 rules fired
- FormulaChangeTimeline — reformulation history
- WhatGoodLooksLike — expandable reference card (4 variants)
- PetShareCard + PetHubShareCard — Instagram story format sharing

**Scoring engine changes:**
- D-129: Allergen severity override — direct match = danger (15pts), possible = caution (8pts), dual-IQ scoring, floor rule
- D-136: Supplemental classification — 65/35/0 weights, macro-only NP, is_supplemental boolean, feeding guide keyword parser, five-tier dual color system (supersedes D-113), open arc ring (270°), supplemental badge + contextual line
- D-137: DCM pulse framework — positional pulse load detection (heavyweight/density/substitution), grain-free gate removed, potatoes exonerated, is_pulse + is_pulse_protein flags
- D-142: Artificial colorant severity escalation — all FD&C colorants (red_40, yellow_5, yellow_6, blue_1, blue_2, red_3, titanium_dioxide) elevated from caution to danger. Caramel color stays caution. position_reduction_eligible = FALSE for all.

**Pipeline bypasses (D-144, D-145):**
- Species mismatch: `target_species !== pet.species` → skip scoring, red badge "For [cats/dogs] only" + warning + ingredients. `BypassReason` type union on ScoredResult.
- Variety pack: name keywords ("variety", "multi-pack", "assorted", "sampler") OR ingredient count >80 OR duplicate canonical ingredients → skip scoring, amber badge, no ingredients shown (concatenated list is misleading)

**Supplemental classifier expansion (D-146):**
- `isSupplementalByName()` scans product names for 9 patterns: topper, meal topper, food topper, mixer, meal mixer, meal enhancer, meal booster, sprinkle, dinner dust
- Runtime override in pipeline: products matching name patterns get `is_supplemental=true` before scoring
- PortionCard shows "This product is a meal topper. Refer to package feeding guidelines for serving size."
- BenchmarkBar hidden for supplementals (no peer segment with ≥30 products)

**Visual system:**
- D-136 dual color scale: green family (daily food) / teal-cyan family (supplemental) / shared yellow-amber-red
- Five tiers: 85+ Excellent / 70–84 Good / 65–69 Fair / 51–64 Low / 0–50 Poor
- D-139: Severity colors unified — Danger: #EF4444, Caution: #F59E0B, Good: #4ADE80, Neutral: #6B7280. SEVERITY_COLORS map in constants.ts, single source of truth. All components import from constants.
- D-143: "Danger" → "Severe" display label via SEVERITY_DISPLAY_LABELS map. DB enum unchanged.
- Score ring animation: 0→final over 900ms, ease-out cubic, score count-up in sync (RN Animated API)
- getScoreColor() + SCORING_WEIGHTS + SEVERITY_COLORS + SEVERITY_DISPLAY_LABELS + AAFCO_STATEMENT_STATUS centralized in constants.ts

**Display fixes (D-147):**
- AafcoProgressBars: supplementals show "Macro Profile" / "As listed on label", treats hide GA bars entirely (NP weight is 0%)
- Ultra-high-moisture (>80%): contextual DMB note about concentrated dry portion
- BenchmarkBar delta: "+14 above avg match" (green) / "−37 below avg match" (red) / "At category average" (gray)
- AAFCO statement chip consistency: both states render as plain muted text
- Product name: numberOfLines={2} across all ResultScreen views
- PortionCard: shortenProductName() strips package size after comma, caps at 40 chars
- Floating "likely" suppressed: AAFCO statement requires length >20
- PositionMap: floating label uses ordinal index, not raw DB position (fixes #921 bug)

**Atwater calorie estimation (D-149):**
- `calorieEstimation.ts`: resolveCalories() fallback chain — label kcal_per_kg → label kcal_per_cup → Atwater ME estimate → null
- NRC Modified Atwater factors: protein 3.5, fat 8.5, carb 3.5 kcal/g
- TreatBatteryGauge shows "Calories estimated from nutritional profile" with InfoTooltip when source='estimated'
- CalorieSource type: 'label' | 'estimated' | null

**New utilities:**
- `InfoTooltip.tsx` — reusable press-to-reveal floating tooltip with standard + citation variants
- `varietyPackDetector.ts` — variety pack detection (name keywords, count >80, duplicate ingredients)
- `calorieEstimation.ts` — Atwater ME fallback, resolveCalories() priority chain
- `formatters.ts` — toDisplayName() and shared formatting helpers
- `supplementalClassifier.ts` — expanded with isSupplementalByName() (9 product name patterns)

**Compliance audit:** 20/20 PASS (D-084, D-094, D-095, D-127, D-129, D-133, D-136)

**ResultScreen rendering order:**

Bypass checks (early returns, top to bottom):
1. No ingredient data → simplified "contribute" view
2. `is_vet_diet` → vet diet badge + ingredients only (D-135)
3. `bypass === 'species_mismatch'` → red badge + warning + ingredients (D-144)
4. `bypass === 'variety_pack'` → amber badge + "scan individual items" (D-145)

Full result view (when no bypass):

Above fold: ScoreRing (animated) → Verdict → Supplemental badge (if applicable) → MetadataBadgeStrip → BenchmarkBar → NursingAdvisoryCard (if under 4 weeks) → ConcernTags → BreedContraindicationCard (D-112) → SeverityBadgeStrip → Safe Swap → Share

Below fold: ScoreWaterfall → PositionMap → IngredientList → AafcoProgressBars → BonusNutrientGrid → SplittingDetectionCard → FlavorDeceptionCard → DcmAdvisoryCard → FormulaChangeTimeline → PortionCard (or supplemental guidance) → TreatBatteryGauge (with Atwater estimation) → WhatGoodLooksLike → Compare → Track → AAFCO statement

### M4.5: DCM Pulse Framework Patch
- Migration 009: is_pulse + is_pulse_protein columns
- Backfill script for pulse classification
- speciesRules.ts: D-137 three-rule positional detection replaces D-013
- DcmAdvisoryCard: shows which rules fired with mechanism explanations
- ConcernTags: Heart Risk tag updated (potatoes removed, fires on D-137 result)
- Pure Balance: 65 → 62
- Tests: 497 → 509

### UI Polish Pass (Sessions A–D)
- D-138: Score waterfall redesign — grouped ingredient penalties, severity progress bars, collapsed summaries, distributeRounded(), final score uses getScoreColor()
- D-139: Severity color unification — SEVERITY_COLORS map, all components import from constants.ts
- D-140: AAFCO statement copy standardization — AAFCO_STATEMENT_STATUS constants
- D-141: Supporting screen polish — ingredient list severity grouping, expandable raw GA, bonus nutrient present-first layout, composition bar tap-to-identify, carb "Est." format, modal citation demotion
- D-142: Artificial colorant severity escalation to danger (Temptations 44 → 9)
- D-143: "Danger" → "Severe" display label
- D-144: Species mismatch bypass
- D-145: Variety pack detection + bypass
- D-146: Expanded supplemental classifier (name-based detection)
- D-147: Display & presentation fixes (8 items)
- D-148: Composition bar PanResponder scrub interaction
- D-149: Atwater caloric estimation fallback
- Tests: 509 → 558

### Post-Handoff Cleanup (Rounds 1–5)

**Round 1 — 8 fixes (558 → ~570 tests):**
- DB severity verification: Blue 1 confirmed danger, copper sulfate species-specific split (dog=caution, cat=neutral) confirmed intentional
- ScoreRing pet name overflow fix — font reduction + truncation
- TreatBatteryGauge null calorie handling ("Calorie data not available")
- GATable.tsx deleted (dead code — no longer imported from ResultScreen)
- PetHubScreen severity hex unified to D-139 SEVERITY_COLORS
- `stripBrandFromName()` utility in formatters.ts — deduplicates brand from product title
- BenchmarkBar scale label cleanup (0/100 anchors only, centered delta)
- BenchmarkBar active tier glow (opacity 0.65/0.25)

**Round 2 — 8 fixes:**
- Brand dedup applied to normal result header (was only on bypass views)
- ScoreRing first-name-only strategy ("match for Buster" not "match for Buster The G...")
- 37 colorant aliases escalated to danger across all 7 D-142 colorants (Blue 1: 10 aliases, Blue 2: 13, etc.)
- PositionMap tap-to-identify fix (was always highlighting #1)
- PositionMap PanResponder removed — tap-only interaction (no gesture conflicts)
- PositionMap floating label moved below bar (no header overlap)
- BenchmarkBar opacity increased to 1.0/0.2 for device visibility
- Variety pack duplicate threshold raised from 1 to 4 (DUPLICATE_NAME_THRESHOLD)

**Round 3 — colorant alias normalization (48 new tests):**
- `ingredientNormalizer.ts`: pattern-based FD&C colorant canonical name normalizer
- Integrated at both ingestion paths: TS scoring pipeline + Python import scripts
- 57 alias entries deleted from ingredients_dict, 129 product_ingredients rows remapped
- Only 7 root colorant canonical names remain: blue_1, blue_2, red_3, red_40, yellow_5, yellow_6, titanium_dioxide

**Round 4 — 3 fixes:**
- IngredientList ordinal position display (fixes #905 → #35 for mixed tocopherols)
- Migration 010: product_form column added + backfilled (dataset + inference)
- `MetadataBadgeStrip` component: AAFCO status + category + product form + preservative type + life stage badges
- `resolveLifeStageLabel()` species-aware parser ("puppy/kitten" → "Puppy" for dogs, "Kitten" for cats)

**Round 5 — 5 fixes, 2 new decisions (D-150, D-151):**
- D-150: Life stage mismatch penalty moved from NP bucket to Layer 3 personalization. Category-scaled: daily food −15, supplemental −10, treat −5. Reverse case (adult + growth food) = −5 all categories. Suppressed for pets under 4 weeks.
- D-151: Under-4-weeks nursing advisory card (NursingAdvisoryCard.tsx). Informational only, no score modifier. D-095 compliant copy.
- Waterfall accordion animation (already implemented — LayoutAnimation was present, no-op fix)
- Brand dedup parent prefix handling: `stripBrandFromName("Cat Chow", "Purina Cat Chow Complete...")` → `"Complete with Real Chicken..."`. Pass-2 substring search within first 40 chars, word-boundary checked, brand ≥5 chars.
- AAFCO badge simplified to 2 states in MetadataBadgeStrip (green ✓ present / amber "No AAFCO"). Three-state constant remains in constants.ts for detailed views.
- Tests: 558 → 641

---

## Database State

### Migrations (001–010)
```
001_initial_schema.sql
002_m2_pet_profiles.sql
003_m2_health_reviewed.sql
004_m3_community_products.sql
005_m4_category_averages.sql     ← category_averages table, base_score, review_status
006_m4_ingredient_content.sql    ← ingredient content columns
007_m4_supplemental.sql          ← D-136: is_supplemental on products
008_m4_vet_diet.sql              ← D-135: therapeutic diet bypass
009_m45_pulse_flags.sql          ← D-137: is_pulse, is_pulse_protein on ingredients_dict
010_product_form.sql             ← product_form column (dry/wet/freeze_dried/raw/dehydrated/topper)
```

### Key Tables for M5
```
products          — 9,090 rows, is_supplemental, is_grain_free, is_vet_diet, base_score, formula_change_log, product_form
product_ingredients — ~175K+ junction rows (position, ingredient_id)
ingredients_dict  — ~3,600+ rows, is_pulse, is_pulse_protein, is_legume, severity flags
pets              — user profiles, allergens, conditions, weight, DOB
pet_allergens     — allergen declarations per pet
pet_conditions    — health conditions per pet
scans             — scan history per user (rolling 7-day window for paywall)
category_averages — 8 segments for BenchmarkBar
```

### Products Table — Key Columns for M5
```
is_supplemental BOOLEAN DEFAULT FALSE   ← D-136
is_recalled BOOLEAN DEFAULT false       ← for Recall Siren
formula_change_log JSONB                ← for re-scrape detection
ingredients_hash TEXT                   ← for formula change detection
last_verified_at TIMESTAMPTZ            ← staleness tracking
needs_review BOOLEAN DEFAULT false      ← community contributions
affiliate_links JSONB                   ← INVISIBLE to scoring engine
product_form TEXT                       ← 'dry' | 'wet' | 'freeze_dried' | 'raw' | 'dehydrated' | 'topper'
ga_kcal_per_cup INT                     ← for portion/pantry calculations
ga_kcal_per_kg INT
kcal_per_unit INT                       ← for single-serve items
unit_weight_g DECIMAL                   ← weight per unit
default_serving_format TEXT             ← 'bulk' | 'unit_count' | 'cans'
```

---

## M5 Scope (from ROADMAP.md)

### Pantry
- [ ] Add scanned products to pantry
- [ ] Me tab "Log a Treat" scan button under Treat Battery — auto-deducts kcal (D-124)
- [ ] Per-pet pantry assignment with multi-pet sharing (many-to-many)
- [ ] Pantry dashboard showing all products with scores
- [ ] Bag/pack countdown with days remaining (D-065) — 3 serving formats
- [ ] Shared pantry depletion: sum consumption rates across assigned pets
- [ ] User inputs bag size or pack quantity at add-to-pantry
- [ ] Low stock nudge at ≤5 days or ≤5 units — affiliate buy button surfaces here
- [ ] Staleness badge for products unverified >90 days
- [ ] Feeding schedule per pantry item: daily (1-3x/day with clock times) or as-needed (D-101)
- [ ] Push notifications on feeding schedule — grouped for multi-pet households
- [ ] Auto-depletion tied to feeding schedule — no manual logging for daily items (D-101)

### Pantry Diet Completeness (D-136 Part 5)
- [ ] Diet-level completeness check per pet on pantry composition changes
- [ ] Supplemental alongside ≥1 complete food → no warning, optional "Topper" tag
- [ ] 2+ supplementals with no complete food → amber warning banner
- [ ] Only supplementals, zero complete food → red diet health card
- [ ] Warnings per-pet, D-095 compliant, NOT a score modifier

### Pet Appointments (D-103)
- [ ] Schedule vet, grooming, medication, vaccination, custom appointments
- [ ] Per-pet or multi-pet assignment
- [ ] Optional reminders (1hr / 1 day / 3 days / 1 week before)
- [ ] Recurring appointments

### Recall Siren (Free Tier — D-125)
- [ ] FDA recall RSS feed monitoring
- [ ] Cross-reference recalled products against user pantry
- [ ] Push notification to affected users — NOT premium-gated
- [ ] Product score → 0 with recall banner on scan result
- [ ] Recall detail screen with FDA link
- [ ] Historical recall log per product

### Weekly Digest Push Notification (D-130)
- [ ] Supabase scheduled function: weekly scan summary + pantry state + recall alerts
- [ ] Expo push notification integration
- [ ] Adaptive content: activity summary if active, re-engagement nudge if inactive
- [ ] User preference: weekly (default) or daily frequency

---

## M5 Architecture Notes

### Pantry is the most complex M5 feature

The many-to-many relationship (one product shared by multiple pets) with per-pet consumption rates, combined with feeding schedules and auto-depletion, is architecturally non-trivial. Suggested schema approach:

```
pantry_items
├── id UUID PK
├── user_id UUID FK → auth.users(id)
├── product_id UUID FK → products(id)
├── quantity_remaining DECIMAL          ← cups, units, or cans remaining
├── quantity_unit TEXT                   ← 'cups' | 'units' | 'cans'
├── quantity_original DECIMAL           ← original bag/pack size
├── added_at TIMESTAMPTZ
├── is_active BOOLEAN DEFAULT true      ← false = removed but kept in history
├── last_deducted_at TIMESTAMPTZ

pantry_pet_assignments (many-to-many)
├── id UUID PK
├── pantry_item_id UUID FK → pantry_items(id)
├── pet_id UUID FK → pets(id)
├── feeding_frequency TEXT              ← 'daily_1x' | 'daily_2x' | 'daily_3x' | 'as_needed'
├── feeding_times JSONB                 ← clock times for push notifications
├── diet_proportion DECIMAL DEFAULT 1.0 ← % of DER from this product (for mixed feeding)
├── UNIQUE(pantry_item_id, pet_id)
```

**RLS critical:** pantry_items and pantry_pet_assignments must be user-scoped. User A cannot see User B's pantry.

### Diet Completeness Check (D-136 Part 5)

When pantry composition changes for a pet:
1. Query all active pantry items assigned to this pet
2. JOIN products to get `is_supplemental` for each
3. Count complete foods vs supplemental foods
4. Apply warning tier logic

This is a **read-time check**, not a stored value. Compute on pantry screen render and on add/remove events.

### Recall Siren Integration

- FDA recall RSS: https://www.fda.gov/about-fda/contact-fda/stay-informed — RSS feeds for animal food recalls
- Cross-reference: `SELECT p.* FROM pantry_items pi JOIN products p ON pi.product_id = p.id WHERE p.is_recalled = true AND pi.user_id = $1 AND pi.is_active = true`
- Push notification: Expo push tokens stored on user profile, Supabase Edge Function sends on recall detection
- **D-125:** Recall alerts are FREE — never paywall-gated. Safety-critical feature.

### Portion Calculator Connection

M2's `calculateDER()` and `calculateCupsPerDay()` are pure functions — M5 imports them directly for:
- Bag countdown: `days_remaining = quantity_remaining / cups_per_day`
- Shared depletion: sum each pet's `cups_per_day × diet_proportion` for combined rate
- Goal weight mode: uses goal weight DER, not current weight

### Calorie Estimation for Pantry

D-149's `resolveCalories()` provides Atwater ME estimation when products lack label calorie data. M5 pantry should use this for:
- Bag countdown when kcal_per_cup/kcal_per_kg missing but GA data exists
- Treat budget deduction from pantry quick-add
- Display `calorie_source: 'estimated'` indicator on pantry cards

---

## What M5 Inherits from M4 + Polish

| M4 Deliverable | M5 Usage |
|----------------|----------|
| category_averages table | Future benchmark updates (monthly re-score) |
| base_score on products | Pantry dashboard score display, comparison features |
| PetShareCard | Reusable for pantry share cards |
| Ingredient content pipeline | Reusable for future batch generation |
| D-129 allergen override | Personalized scoring in pantry context |
| is_supplemental flag (D-136) | Diet completeness warnings, "Topper" tag on pantry cards |
| D-146 name-based supplemental detection | Runtime classification for products not yet flagged in DB |
| getScoreColor() + SCORING_WEIGHTS | Shared source of truth for pantry score display |
| D-137 is_pulse/is_pulse_protein | Available for future Safe Swap filtering (M6) |
| D-144 species mismatch bypass | Pantry should prevent adding wrong-species products |
| D-145 variety pack bypass | Pantry should show "scan individual items" instead of add |
| D-149 resolveCalories() | Atwater estimation for products missing label calorie data |
| MetadataBadgeStrip | Reusable for pantry product cards |
| product_form column | Pantry card display, serving format auto-detection |
| resolveLifeStageLabel() | Species-aware life stage display |
| D-150 life stage mismatch | Pantry should warn if puppy/kitten is assigned adult-only food |
| D-151 nursing advisory | Pantry should suppress feeding calculations for under-4-week pets |
| ingredientNormalizer | Future imports normalized automatically — no new colorant aliases |
| stripBrandFromName() | Reusable for pantry cards, history cards |

---

## iOS Build — Dev Client Working

**Dev client is functional via tunnel mode.** Steven has tested on physical iOS device. Key findings from device testing informed the UI polish pass (D-138–D-149).

### Build Commands
```
# Development build (already created)
eas build --profile development --platform ios

# Run with tunnel (for dev testing without local network)
npx expo start --dev-client --tunnel
```

### Known Data Gaps
- **~165 products with marketing text instead of ingredients** (Muenster-type products where Chewy has promotional copy instead of actual ingredient lists). Unsolvable by scraping — requires bag photo OCR. Any vision LLM works (Claude, GPT-4o, Gemini all comparable). M5+ scope at earliest. These are a rounding error against 9,000 products but worth noting as a data quality ceiling.

### Known Build Concerns
- expo-av deprecated on SDK 55 — may need replacement or removal for build to succeed
- react-native-view-shot (PetShareCard) needs device testing — rendering varies
- RevenueCat paywall flow needs real device testing with sandbox account

---

## Key Decisions for M5 Prompt Guide

These need answers before or during M5 Session 1:

1. **Pantry schema:** Does the suggested schema above work, or does Steven want modifications?
2. **Feeding schedule granularity:** D-101 says "daily (1-3x/day with clock times) or as-needed" — is that sufficient or do we need weekly schedules?
3. **Auto-depletion timing:** Deduct on schedule time (requires background task) or deduct daily at midnight (simpler)?
4. **Mixed feeding proportion UI:** Slider? Percentage input? Per-pet or per-product?
5. **Recall data source:** FDA RSS only, or also AVMA/brand voluntary recalls?
6. **Push notification provider:** Expo Push directly, or a service like OneSignal?
7. **Severity audit timing:** Do the severity/data quality audit before or during M5? High-impact ingredients (chicken_byproduct_meal, animal_fat unnamed flag) affect scoring accuracy on many products.
8. **Ingredient content generation:** Batch generate ~648 missing tldr entries via Vertex credit before M5?

---

## Regression Targets

- **Pure Balance Wild & Free Salmon & Pea (Dog):** 62 (D-137 DCM: fires, mitigation applies)
- **Temptations Classic Tuna (Cat Treat):** 9 (D-142: IQ 19 after colorant danger escalation, taurine −10)
- **641 tests** must pass after any change

---

## Known Remaining Issues

**Pre-existing TypeScript errors (~15):**
- ScoreWaterfall.tsx: missing `ProductIngredient` import (referenced but not imported)
- CreatePetScreen.tsx: missing `health_reviewed_at` in pet creation object
- PetHubScreen.tsx: invalid Ionicons name `checkmark-shield-outline` (should be `shield-checkmark-outline`)
- pipeline.ts: `ingredientResults` missing on `ScoredResult` in `makeEmptyResult`
- Deno edge function types: `supabase/functions/` files reference Deno globals not in TS scope

**Data quality issues:**
- `aafco_statement` data quality: unknown number of products have bare `"yes"` string instead of actual AAFCO claim text. Badge shows green ✓ (correct from user perspective), but FC scoring flags it as unrecognized.
- `is_unnamed_species` data quality: `animal_fat_preserved_with_mixed_tocopherols` and `liver_flavor` marked `false` in ingredients_dict despite being generic unnamed sources. Affects IQ penalty accuracy.
- Severity audit needed: `chicken_byproduct_meal`=good, `menadione` (vitamin_k3)=neutral, `corn_protein_meal`=neutral may be incorrect — these are high-frequency ingredients affecting many product scores.
- ~648 ingredients lacking `tldr` content (batch generation planned with Vertex credit)

**Documentation drift:**
- `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` §5a: old −15 NP bucket penalty row struck through with D-150 note, but §8 worked example and §10 test list may still reference old behavior

**Known build concerns (unchanged):**
- expo-av deprecated on SDK 55 — may need replacement or removal
- react-native-view-shot rendering varies by device
- RevenueCat paywall needs real device testing with sandbox account

---

## Files to Reference

```
CLAUDE.md                              ← project context (updated March 17, D-150/D-151)
DECISIONS.md                           ← 151 decisions (D-001 through D-151)
ROADMAP.md                             ← milestone plan (M4.5 + polish + cleanup complete, M5 next)
NUTRITIONAL_PROFILE_BUCKET_SPEC.md     ← 30% NP bucket spec (§5a updated for D-150)
BREED_MODIFIERS_DOGS.md                ← 23 dog breeds
BREED_MODIFIERS_CATS.md                ← 21 cat breeds
PORTION_CALCULATOR_SPEC.md             ← RER/DER math (M5 imports these functions)
references/scoring-rules.md            ← consolidated scoring reference (updated for D-150/D-151)
PRE_M5_TODO.md                         ← outstanding tasks and data quality items
```

---

*M4.5 + UI polish + 5 cleanup rounds complete. 641 tests. Pure Balance = 62, Temptations = 9. 151 decisions. iOS dev client working. Pantry is the killer retention feature — build it right.*
