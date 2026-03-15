# CLAUDE.md — Kiba Project Context

> This file is read automatically by Claude Code at the start of every session.
> It is the single source of context for all development work.
> Last updated: March 15, 2026 (M4 Complete — 501 tests, compliance audit 20/20, D-136 supplemental classification)

---

## What Is This Project?

Kiba (kibascan.com — domain registered) is a pet food scanner iOS app — "Yuka for pets." Users scan a barcode on any pet food, treat, or supplement and get an ingredient-level safety score from 0-100, with species-specific intelligence for dogs and cats.

**Owner:** Steven (product decisions, non-coder)
**Developer:** Claude Code (you)
**Current phase:** M4 Product Detail + Education (M0–M4 Complete)

## Tech Stack

- **Framework:** Expo (React Native) with TypeScript strict mode
- **State:** Zustand
- **Backend:** Supabase (Postgres + Auth + Storage + Row Level Security)
- **Navigation:** React Navigation (bottom tabs + stack navigators)
- **Barcode:** `expo-camera` built-in scanning (NOT `expo-barcode-scanner` — deprecated)
- **Payments:** RevenueCat (installed M3 Session 5)
- **Audio:** `expo-av` for scan confirmation tone
- **Testing:** Jest for scoring engine, reference product regression tests (501 tests passing)
- **SVG:** `react-native-svg` for score ring (270° open arc for supplementals)

## Project Structure

```
kiba-app/
├── CLAUDE.md              ← you are here
├── DECISIONS.md            ← canonical decision log (136 decisions, D-001 through D-136)
├── ROADMAP.md              ← milestone-by-milestone plan
├── NUTRITIONAL_PROFILE_BUCKET_SPEC.md  ← 30% nutritional bucket: curves, thresholds, DMB
├── BREED_MODIFIERS_DOGS.md             ← 23 dog breed entries (scoring engine lookup table)
├── BREED_MODIFIERS_CATS.md             ← 21 cat breed entries (scoring engine lookup table)
├── PET_PROFILE_SPEC.md                 ← M2 canonical: profile fields, conditions, allergens, breed modifiers
├── PORTION_CALCULATOR_SPEC.md          ← M2 canonical: RER/DER math, goal weight, cat safety guards
├── app.json
├── tsconfig.json
├── assets/
│   └── sounds/
│       └── scan-confirm.mp3       ← barcode detection confirmation tone
├── scripts/
│   ├── pipeline/                  ← M3 data ingestion (Apify import, staging)
│   ├── refinery/                  ← M3 GA extraction (Haiku + validator)
│   │   ├── extract_ga.py          ← batch Haiku GA extraction
│   │   └── validator.py           ← D-043 range validation before DB insert
│   └── scoring/                   ← M4 batch scoring (batch_score.ts)
│   └── data/
│       └── backfill_supplemental.ts ← D-136: classify existing products via aafco_statement keyword match
├── supabase/
│   ├── functions/
│   │   └── parse-ingredients/     ← Edge Function: OCR text → Haiku → parsed ingredients + D-128 classification
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_m2_pet_profiles.sql   ← renames, new columns, constraint updates
│       ├── 003_m2_health_reviewed.sql ← health_reviewed_at column
│       ├── 004_m3_community_products.sql ← M3 community contribution columns
│       ├── 005_m4_category_averages.sql  ← category_averages table, base_score, review_status
│       ├── 006_ingredient_content_columns.sql ← ingredient content: primary_concern_basis, context columns
│       └── 007_m4_supplemental.sql       ← D-136: is_supplemental column on products
├── src/
│   ├── types/              ← all TypeScript interfaces
│   │   └── index.ts
│   ├── components/         ← shared UI components
│   │   ├── ScoreGauge.tsx
│   │   ├── ScoreRing.tsx          ← SVG score ring: 360° daily food, 270° open arc supplementals (react-native-svg)
│   │   ├── ScannerOverlay.tsx     ← animated viewfinder: corner brackets + scan line + lock animation
│   │   ├── LoadingTerminal.tsx    ← 6-step terminal message sequence
│   │   ├── ConcernTags.tsx        ← D-107 consumer-facing badges
│   │   ├── SeverityBadgeStrip.tsx ← worst 4-5 ingredients as color-coded chips
│   │   ├── ScoreWaterfall.tsx     ← tappable breakdown showing Layer 1/2/3 math
│   │   ├── GATable.tsx            ← GA panel with dual display (as-fed + DMB for wet food)
│   │   ├── IngredientList.tsx
│   │   ├── IngredientDetailModal.tsx ← D-105 singleton modal with TL;DR, citations
│   │   ├── BreedContraindicationCard.tsx ← D-112 red warning cards
│   │   ├── PortionCard.tsx        ← DER-based daily portion display
│   │   ├── TreatBatteryGauge.tsx  ← visual treat budget gauge
│   │   ├── DevMenu.tsx            ← __DEV__ only: premium toggle, scan window management
│   │   ├── BenchmarkBar.tsx
│   │   ├── PetPhotoSelector.tsx ← 96px circle, paw silhouette, ImagePicker (square crop, quality 0.7)
│   │   └── StatChips.tsx
│   ├── screens/
│   │   ├── OnboardingScreen.tsx    ← 2-screen intro + minimal pet profile (D-092), creates pet via petService
│   │   ├── HomeScreen.tsx          ← dashboard: recent scans, weekly counter, alerts
│   │   ├── SearchScreen.tsx        ← premium-gated text search
│   │   ├── ScanScreen.tsx          ← camera + barcode (raised center tab)
│   │   ├── ResultScreen.tsx        ← "[X]% match for [Pet Name]" + waterfall
│   │   ├── PetHubScreen.tsx        ← Me tab: pet carousel, score accuracy, DER, treat battery, health conditions
│   │   ├── SpeciesSelectScreen.tsx ← D-122: species selection pre-create (dog/cat cards)
│   │   ├── CreatePetScreen.tsx     ← 3-card form: Identity/Details/Settings
│   │   ├── EditPetScreen.tsx       ← same 3-card layout, species immutable
│   │   ├── HealthConditionsScreen.tsx ← D-097/D-119: condition multi-select + allergen picker
│   │   ├── PantryScreen.tsx
│   │   ├── TermsScreen.tsx        ← clickwrap TOS with active checkbox, version-aware
│   │   ├── PaywallScreen.tsx      ← D-126 psychology patterns, annual-first, identity framing
│   │   ├── ProductConfirmScreen.tsx ← D-091 step 2: external UPC match confirmation
│   │   ├── IngredientCaptureScreen.tsx ← D-091 OCR + D-128 Haiku classification
│   │   └── CommunityContributionScreen.tsx ← community product submission
│   ├── services/
│   │   ├── auth.ts              ← ensureAuth(): anonymous sign-in on app mount
│   │   ├── petService.ts        ← CRUD: createPet, updatePet, deletePet, getPetsForUser, photo upload
│   │   ├── scanner.ts           ← UPC lookup + external UPC + community product save
│   │   ├── scoring/
│   │   │   ├── engine.ts           ← main scoring orchestrator
│   │   │   ├── ingredientQuality.ts ← Layer 1: 55% bucket
│   │   │   ├── nutritionalProfile.ts ← Layer 1: 30% bucket (GA vs AAFCO)
│   │   │   ├── formulationScore.ts  ← Layer 1: 15% bucket
│   │   │   ├── speciesRules.ts      ← Layer 2: dog/cat modifiers
│   │   │   ├── personalization.ts   ← Layer 3: pet-specific
│   │   │   ├── dmbConversion.ts     ← Dry Matter Basis for wet food
│   │   │   └── carbEstimate.ts      ← NFE calculation + ash estimation + confidence (D-104)
│   │   ├── supabase.ts
│   │   └── recallCheck.ts
│   ├── content/
│   │   ├── explainers/              ← static educational modals, shipped with app (D-104)
│   │   │   ├── index.ts
│   │   │   ├── carbEstimate.ts      ← "How we calculate carbohydrates"
│   │   │   ├── dmbConversion.ts     ← "What is Dry Matter Basis?"
│   │   │   ├── ingredientSplitting.ts ← "What is ingredient splitting?"
│   │   │   ├── ashExplainer.ts      ← "What is ash?"
│   │   │   └── byProductMeal.ts     ← "What is by-product meal?"
│   │   └── breedModifiers/          ← static typed breed data, shipped with app (D-109)
│   │       ├── index.ts
│   │       ├── dogs.ts              ← 23 breed entries from BREED_MODIFIERS_DOGS.md
│   │       └── cats.ts              ← 21 breed entries from BREED_MODIFIERS_CATS.md
│   ├── stores/
│   │   ├── useAppStore.ts        ← hasAcceptedTos, hasCompletedOnboarding, tosVersion
│   │   ├── useActivePetStore.ts  ← D-120: canonical pet store, global active pet context
│   │   └── useScanStore.ts       ← scan cache, weekly count
│   ├── utils/
│   │   ├── permissions.ts   ← ONLY location for paywall checks
│   │   ├── supplementalClassifier.ts ← D-136: AAFCO feeding guide keyword parser
│   │   ├── benchmarkData.ts ← Zustand-cached category average fetcher
│   │   ├── bonusNutrients.ts ← boolean nutrient derivation from product_ingredients
│   │   ├── flavorDeception.ts ← label vs ingredients detection logic
│   │   ├── haptics.ts       ← D-121: named haptic functions wrapping expo-haptics
│   │   ├── lifeStage.ts     ← deriveLifeStage, synthesizeDob, formatLocalDate, parseDateString
│   │   └── constants.ts
│   └── navigation/
│       └── index.tsx
└── __tests__/
    ├── scoring/
    │   ├── engine.test.ts
    │   ├── ingredientQuality.test.ts
    │   ├── speciesRules.test.ts
    │   └── dmbConversion.test.ts
    ├── services/
    │   ├── petService.test.ts    ← 25 tests: CRUD, validation, auth, photo upload
    │   └── scoring/
    │       └── supplementalScoring.test.ts ← 8 tests: D-136 weight routing, modifier suppression
    ├── utils/
    │   └── supplementalClassifier.test.ts ← 16 tests: AAFCO keyword matching, D-096/D-136 separation
    └── referenceProducts.test.ts  ← regression tests
```

## Score Framing — Suitability Match (D-094)

All Kiba scores are **pet-specific suitability matches**, not universal product quality ratings.

- Display: `"[X]% match for [Pet Name]"` — NEVER `"This product scores [X]"`
- Pet name and photo always visible on scan result screen
- Same product can score differently for different pets
- No "naked" scores — pet profile required before any score displays
- All products start at 100; deductions are compatibility adjustments

**User-facing layer names in waterfall breakdown (5 rows):**
- Row 1: "Ingredient Concerns" (Layer 1 ingredient quality)
- Row 2: "[Pet Name]'s Nutritional Fit" (Layer 1 nutritional profile)
- Row 3: "Formulation Quality" (Layer 1 formulation completeness)
- Row 4: "[Species] Safety Checks" — "Canine Safety Checks" or "Feline Safety Checks" (Layer 2)
- Row 5: "[Pet Name]'s Breed & Age Adjustments" (Layer 3)

**Score ring color breakpoints + verdict (D-136 — supersedes D-113):**

Two parallel color scales. Daily food uses green family. Supplemental uses teal/cyan family. Both converge at yellow/amber/red. All labels use D-094 suitability framing.

**Daily Food + Treats:**

| Score | Ring Color | Verdict |
|-------|-----------|---------|
| 85–100 | Dark Green #22C55E | "Excellent match for [Pet Name]" |
| 70–84 | Light Green #86EFAC | "Good match for [Pet Name]" |
| 65–69 | Yellow #FACC15 | "Fair match for [Pet Name]" |
| 51–64 | Amber #F59E0B | "Low match for [Pet Name]" |
| 0–50 | Red #EF4444 | "Poor match for [Pet Name]" |

**Supplemental (is_supplemental = true):**

| Score | Ring Color | Ring Shape | Verdict |
|-------|-----------|-----------|---------|
| 85–100 | Teal #14B8A6 | 270° open arc | "Excellent match for [Pet Name]" |
| 70–84 | Cyan #22D3EE | 270° open arc | "Good match for [Pet Name]" |
| 65–69 | Yellow #FACC15 | 270° open arc | "Fair match for [Pet Name]" |
| 51–64 | Amber #F59E0B | 270° open arc | "Low match for [Pet Name]" |
| 0–50 | Red #EF4444 | 270° open arc | "Poor match for [Pet Name]" |

**Hard rules:** Green NEVER appears on supplemental products. Teal/cyan NEVER appears on daily food/treats. Open arc (270°) = supplemental only. Full circle (360°) = daily food + treats.

Supplemental products also display: "Supplemental" badge (teal background), contextual line "Best paired with a complete meal" below score ring.

Ring color and verdict text always share the same tier. Verdict renders below the ring, 16pt semibold, color-matched.

## Scoring Engine Architecture

**Detailed specs (read these before implementing scoring):**
- `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` — Full 30% nutritional bucket: AAFCO thresholds, DMB conversion, trapezoidal scoring curves, life stage modifiers, sub-nutrient weights
- `BREED_MODIFIERS_DOGS.md` — 23 breed entries across 3 tiers (GA-actionable, ingredient-actionable, advisory-only)
- `BREED_MODIFIERS_CATS.md` — 21 breed entries across 3 tiers, plus 3 global findings (taurine ≠ HCM, fat > carbs for obesity, phosphorus source matters)

### Category-Adaptive Weighting
| Category | Ingredient Quality | Nutritional Profile | Formulation |
|----------|-------------------|--------------------:|------------:|
| Daily Food (kibble, wet, raw) | 55% | 30% | 15% |
| Supplemental (is_supplemental = true) | 65% | 35% (macro-only) | 0% |
| Treats | 100% | 0% | 0% |

**Supplemental classification (D-136):** Products with AAFCO "intermittent or supplemental feeding" language in their feeding guide are classified via `is_supplemental BOOLEAN` on the products table. Detected at import time via keyword match in `supplementalClassifier.ts`. The 35% NP bucket for supplementals evaluates **macros only** (protein, fat, fiber, moisture) — micronutrient AAFCO checks (calcium, phosphorus, Ca:P, omega ratios, life stage matching) are skipped. This is orthogonal to `haiku_suggested_category = 'supplement'` (D-096 vitamin/mineral supplements) — different classification axes entirely.

### Three Layers (each independently testable)

**Layer 1 — Base Score (weighted by category):**
- Ingredient Quality (0-100): Position-weighted severity scores
  - Check `position_reduction_eligible` flag before discounting
  - Proportion-based concerns: full penalty pos 1-5, −30% pos 6-10, −60% pos 11+
  - Presence-based concerns (BHA, BHT, artificial colorants): full penalty regardless of position
  - Unnamed species penalty: −2 per unnamed fat/protein
- Nutritional Profile (0-100): GA values vs AAFCO thresholds by life stage
  - **Full spec:** `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` (trapezoidal curves, not binary pass/fail)
  - 4 sub-nutrients: Protein Adequacy, Fat Adequacy, Fiber Reasonableness, Carb Estimate
  - Dog weights: 35% protein / 25% fat / 15% fiber / 25% carbs
  - Cat weights: 45% protein / 20% fat / 10% fiber / 25% carbs
  - DMB conversion REQUIRED for wet food (moisture >12%)
  - Formula: `Dry Matter % = (Guaranteed % / (100 - Moisture %)) × 100`
  - Bonus nutrients: DHA, Omega-3, Taurine, L-Carnitine, Zinc, Probiotics
- Formulation (0-100): AAFCO statement, preservative type, protein naming

**Layer 2 — Species Rules:**
- Dog: DCM advisory −8% (grain-free + 3+ legumes in top 7), +3% mitigation (taurine + L-carnitine)
- Cat: Carb overload −15% (3+ high-glycemic carbs in top 5), mandatory taurine check, UGT1A6 warnings

**Layer 3 — Personalization:**
- Allergy cross-reference, life stage matching, breed-specific modifiers
- **Breed data:** `BREED_MODIFIERS_DOGS.md` (23 breeds) and `BREED_MODIFIERS_CATS.md` (21 breeds)
- **Breed runtime data:** Static JSON in `src/content/breedModifiers/` (D-109) — NOT in Supabase
- Three actionability tiers: GA-actionable, ingredient-list-actionable, advisory-only
- **D-112 breed contraindications:** Binary medical incompatibilities (e.g. Dalmatian/purines, Irish Setter/gluten) use `breed_contraindication` type — red warning card above fold, zero score impact, same visual treatment as D-097 allergen `direct_match`. These are NOT score modifiers.
- Breed modifiers capped at ±10 total within the nutritional bucket
- `no_modifier` breeds explicitly registered to prevent false penalties
- Neutral if no conflicts detected

### Reference Scores (Regression Tests)
- **Pure Balance Wild & Free Salmon & Pea (Dog):** 65/100
  - IQ: 58, NP: 79, FC: 63 → Base: 65 → DCM: not fired (only 2 legumes in top 7) → **65**
  - Source: Walmart bag data (not on Chewy). Manually inserted + scored against v6 pipeline.
- **Temptations Classic Tuna (Cat Treat):** 44/100
  - IQ: 52 → Cat carb penalty −8 → 44

### Ingredient Splitting Detection
Use `cluster_id` field in `ingredients_dict` table. Both "Dried Peas" and "Pea Starch" get `cluster_id = 'legume_pea'`. Detect via `GROUP BY cluster_id HAVING count >= 2`. NEVER use string matching — prevents false positives.

### Missing GA Fallback
When GA panel unavailable: reweight to ~78% ingredient / 22% formulation. Show "Partial" badge. Prompt user photo contribution.

### Carbohydrate Estimation Display (D-104)
AAFCO doesn't require carb disclosure. Kiba calculates it: `carbs = Math.max(0, 100 - protein - fat - fiber - moisture - ash)`. Ash defaults: dry 7%, wet 2%, treats 5%. If Ca + P both available: `ash ≈ (Ca% + P%) × 2.5`. Floor required because GA min/max asymmetry can produce negative values in ultra-high-protein wet foods. Display as calculated row with confidence badge (Exact/Estimated/Unknown) and species-specific qualitative label:
- **Cat:** Low ≤15% / Moderate 16–25% / High >25%
- **Dog:** Low ≤25% / Moderate 26–40% / High >40%

Labels are display-only — do NOT feed back into scoring engine (avoids double-counting with §4b carb curves). Tap-to-expand shows the math + explainer. All explainer content lives in `src/content/explainers/` as static typed objects — no Supabase dependency.

## Concern Tags (D-107)

Five consumer-facing badges displayed above the fold on scan results. Tags answer "what kind of problem?" — distinct from severity badges which answer "which ingredients?"

| Tag | Emoji | Fires when product contains... |
|-----|-------|-------------------------------|
| Artificial Color | 🎨 | Red 40, Yellow 5, Yellow 6, Blue 2, Titanium Dioxide, etc. (7 members) |
| Added Sugar | 🍬 | Sugar, Cane Molasses (2 members) |
| Unnamed Source | ❓ | Meat Meal, Animal Fat, Animal Digest, Natural Flavor, etc. (7 members) |
| Synthetic Additive | 🧪 | BHA, BHT, TBHQ, Propylene Glycol, etc. (9 members) |
| Heart Risk | 🫘 | Peas, Lentils, Chickpeas, Pea Protein, Pea Starch, Potatoes, Sweet Potatoes, Potato Starch (8 members, dogs only, gated to D-013: renders only when 3+ legume/potato in top 7) |

Tags are informational only — they do NOT modify scores. Derived at render time from a static tag membership map in app code. Max 3 displayed above fold. "Filler" tag explicitly rejected (see D-107 rationale). Emoji in the table above are documentation identifiers only — the app UI renders SF Symbols per D-084/D-111.

## Scan Result Layout (D-108)

Single scrollable screen, progressive disclosure. No separate simple/detailed views.

**Above fold:** Score gauge → concern tags → severity badge strip (worst 4-5 ingredients) → Safe Swap CTA (M6+)
**Below fold:** Kiba Index (M8+) → waterfall breakdown → full ingredient list (ALL, sorted worst→best) → "Track this food" CTA (M5+)

Poop Check / Symptom Tracker → Me tab, NOT scan result screen.

## Key Schema Tables

See `supabase/migrations/001_initial_schema.sql` for full schema. Critical tables:

- `products` — includes all GA columns, `ingredients_hash` for formula change detection, `affiliate_links` JSONB (invisible to scoring)
- `product_upcs` — junction table (UPC → product_id), NOT TEXT[] array
- `ingredients_dict` — canonical ingredients with `cluster_id`, severity per species, `position_reduction_eligible` flag, `allergen_group` + `allergen_group_possible` (D-098), display content columns (D-105: `display_name`, `tldr`, `detail_body`, `citations_display`, `position_context`)
- `product_ingredients` — junction linking products to ingredients with `position`
- `pets` — RLS enforced, canonical name per D-110 (NOT `pet_profiles`). Key columns: `weight_current_lbs` (not `weight_lbs`), `weight_goal_lbs`, `date_of_birth` (not `birth_date`), `is_neutered` (not `is_spayed_neutered`), `activity_level` ('low'|'moderate'|'high'|'working'), `sex` ('male'|'female'|null, D-118), `dob_is_approximate` (D-116), `weight_updated_at` (D-117), `life_stage` (derived, never user-entered)
- `pet_conditions` — D-097 many-to-many (pet → condition_tag). RLS via pets table join
- `pet_allergens` — D-097 many-to-many (pet → allergen). Only populated when `allergy` condition exists. RLS via pets table join
- `scans` — stores `score_breakdown` JSONB snapshot per scan

## Supabase Auth & Storage

**Auth:** Anonymous sign-in enabled. `ensureAuth()` in `src/services/auth.ts` runs on app mount (App.tsx useEffect), guarantees `auth.uid()` before any screen renders. Session persists via AsyncStorage.

**Storage bucket:** `pet-photos` (public). RLS policies:
- INSERT: authenticated users can upload to `{auth.uid()}/` folder prefix
- UPDATE: authenticated users can update their own folder
- SELECT: public read access
- Photo path convention: `{userId}/{petId}.jpg` — deterministic, upsert on re-upload

**`health_reviewed_at`:** TIMESTAMPTZ column on `pets` table. Distinguishes "Perfectly Healthy" (0 condition rows + `health_reviewed_at` set) from "never visited HealthConditionsScreen" (0 rows + null). Used by PetHubScreen score accuracy calculation (15% of total).

## Non-Negotiable Rules

1. **Scoring engine is brand-blind.** Zero awareness of brand names. No brand-specific modifiers.
2. **Affiliate logic is completely isolated from scoring.** `affiliate_links` column is invisible to scoring functions. Hard architectural separation.
3. **Paywall checks ONLY in `src/utils/permissions.ts`.** Never scatter `if (isPremium)` throughout the codebase.
4. **Refuse to score unsupported species.** Dogs and cats only. Don't guess for birds, fish, reptiles, etc.
5. **Clinical Copy Rule.** All risk/warning text is objective, citation-backed, never editorial. No "terrible" or "avoid at all costs."
6. **Every ingredient penalty includes `citation_source`.** No unattributed claims.
7. **Supabase RLS on every user-data table.** Test by verifying user A cannot access user B's data.
8. **No `any` types** in TypeScript for core entities.
9. **Frequency advisories are NOT score modifiers.** Mercury, Vitamin A, etc. are UI notes only.
10. **Suitability framing (D-094).** Scores are always "[X]% match for [Pet Name]." Never display a score without pet context. No "naked" scores exist.
11. **UPVM compliance (D-095).** Never use these terms in user-facing copy: "prescribe," "treat," "cure," "prevent," "diagnose." Map label data → published literature → compatibility deduction. Kiba is a data-mapping tool, not a digital veterinarian.
12. **Breed modifier cap.** Total breed modifiers within the nutritional bucket capped at ±10 points. Every modifier requires `citation_source` and `vet_audit_status = 'cleared'` before production.

## Weight Management (D-106)

Weight status affects **portions, not scores.** No caloric density modifiers in the scoring engine.

- `obesity` and `underweight` are health conditions in D-097 (mutually exclusive)
- Portion calculator uses RER at `goal_weight` (down for obese, up for underweight)
- Fiber penalty suppressed 50% when pet has `obesity` condition (same as "light/weight management" label logic)
- UI advisory card shows goal-weight portions on scan result screen — not a score modifier
- Cat hepatic lipidosis guard: warn if weight loss rate >1% body weight/week
- Geriatric cats (14+): DER multiplier uses 1.5× floor (D-063), never portioned below it — they need MORE calories, not fewer
- Puppy/kitten goal weight: disabled. Growing animals should not restrict calories.
- Cat default activity: `low` (most pet cats are indoor)
- DER multiplier tables: LOCKED in PORTION_CALCULATOR_SPEC.md §3
- ❌ No caloric density penalties, no fat/carb multipliers for weight — avoids bad food outscoring good food

## What NOT to Build

- ❌ Ask AI / AI chatbot (liability — permanently removed)
- ❌ Cosmetics/grooming (deferred to M16+)
- ❌ Supplement scoring engine (deferred to M16+, D-096 — supplements stockpiled in DB but not scored at launch)
- ❌ RevenueCat at M0 (install M3-M4 only)
- ❌ `expo-barcode-scanner` (deprecated — use `expo-camera`)
- ❌ Star ratings (replaced by Kiba Index: Taste Test + Tummy Check)
- ❌ OPFF as data source (using Apify scraping + curated + community)
- ❌ "Dislikes / Won't Eat" system (rejected M2 — scope creep, worse failure mode than allergen data pollution, revisit post-launch if measurable)
- ❌ Breed-specific avatar silhouettes (rejected M2 — asset pipeline doesn't exist, use generic species silhouette)
- ❌ Score supplements (M16+, D-096 — store only). NOTE: `haiku_suggested_category = 'supplement'` (D-096) ≠ `is_supplemental = true` (D-136). Different classification axes.
- ❌ Score grooming products (M16+, D-083 — store only)
- ❌ API keys in app binary (D-127 — all external calls via Edge Functions)
- ❌ Paywall on recall alerts (D-125 — free tier, safety-critical)
- ❌ Compare flow (deferred M6 — button + paywall gate already exist)
- ❌ Vet Report PDF (deferred M5-M6 — based on soft launch feedback)

## M2 Profile Design (D-116 through D-121)

### 6-Tier Life Stages (D-064)

Life stage is auto-derived, never user-entered. Six tiers across both species — `junior` and `mature` added beyond the traditional 4-tier model. For DER calculation, these collapse to 4 metabolic buckets: junior/mature → `adult`. See PET_PROFILE_SPEC.md §2 for full age boundary tables per breed size.

| Tier | Dogs | Cats | DER Bucket |
|------|------|------|-----------|
| Puppy/Kitten | 0–12mo (0–18mo giant) | 0–12mo | puppy |
| Junior | 12–24mo | 1–2yr | adult |
| Adult | 2–7yr (2–5yr giant) | 2–7yr | adult |
| Mature | 7–10yr (5–8yr giant) | 7–11yr | adult |
| Senior | 10–13yr (8–10yr giant) | 11–14yr | senior |
| Geriatric | 13+yr (10+yr giant) | 14+yr | geriatric |

### Profile Validation Rules

- **Species:** locked after creation. Delete pet + create new as escape hatch.
- **Name:** 1–20 chars, trimmed
- **Breed:** default 'Mixed Breed' (not 'mixed'). Searchable dropdown per D-102.
- **is_neutered:** default `true` (majority of pets are neutered)
- **Breed size for mixed dogs:** derived from weight if available (<25 lbs=small, 25–55=medium, 55–90=large, >90=giant). Fallback: 'medium'.

**Rescue pets (D-116):** Birthday field has `[Exact Date] | [Approximate Age]` toggle. Approximate mode takes years + months, backend synthesizes a DOB. `dob_is_approximate BOOLEAN` on `pets` table tracks provenance. Life stage derivation works identically.

**Stale weight guard (D-117):** `weight_updated_at TIMESTAMPTZ` on `pets` table. If >6 months stale, amber prompt on Pet Hub: "Weight last updated [N] months ago — still accurate?" Tappable → edit screen.

**Sex field (D-118):** `sex TEXT CHECK ('male'|'female')` on `pets` table. Optional (null valid). Primary driver: D-099 vet report clinical credibility. Secondary: pronoun personalization in D-094 copy. Zero scoring impact.

**"Perfectly Healthy" chip (D-119):** Green (#34C759) chip in condition grid, mutual exclusion with all condition chips. Stores zero `pet_conditions` rows — same as skip, better emotional framing.

**Multi-pet carousel (D-120):** Horizontal pet avatar row on Pet Hub. `useActivePetStore` in Zustand holds `activePetId`, consumed globally. Teal border on active, dimmed inactive. Free tier = no carousel (1 pet). "+ Add Pet" triggers D-052 gate.

**Haptics (D-121):** `utils/haptics.ts` wraps `expo-haptics` behind named functions. Light for chip toggles, medium for species/scan, success for save/barcode, error for hepatic lipidosis warning, heavy for delete. No-op on unsupported platforms.

**Species selection pre-screen (D-122):** Species captured on dedicated `SpeciesSelectScreen` before create form — two large tappable cards: Dog / Cat. Species passed as route param to `CreatePetScreen`. Sex promoted from Card 3 → Card 1. Card layout: Card 1 = Photo/Name/Sex, Card 2 = Breed/DOB/Weight, Card 3 = Activity/Neutered. Edit screen: species not shown (immutable).

**Species-specific activity labels (D-123):** Dogs: Low/Moderate/High/Working (default: Moderate). Cats: Indoor/Indoor-Outdoor/Outdoor (default: Indoor). UI labels map to DB: Indoor='low', Indoor/Outdoor='moderate', Outdoor='high'. "Working" hidden for cats. DB column unchanged.

**Treat logging entry points (D-124):** Three entry points for treat consumption: (1) Me tab "Log a Treat" scan button under Treat Battery — auto-deducts kcal immediately, (2) Scan Result "Track this food" CTA — adds to pantry, no deduction, (3) Pantry quick-add (M5) — one-tap deduction. Central scan button behavior deferred to M5+.

## Commit Convention

Use descriptive commit messages referencing the milestone:
```
M0: initial Supabase schema with RLS policies
M1: Layer 1 ingredient quality scoring function
M1: DMB conversion for wet food nutritional profile
M2: pet profile CRUD with Supabase auth integration
```

## Known Issues / Web Testing Notes

- **Zustand `import.meta` on Expo Web:** Metro bundles Zustand devtools as a regular script, breaking `import.meta.env`. Temporary fix: `sed -i 's/import\.meta\.env/process.env/g' node_modules/zustand/esm/middleware.mjs`. Wiped on `npm install`. Use `patch-package` for persistence.
- **Haptics:** `expo-haptics` is no-op on web. Must test on physical iOS device.
- **Score accuracy:** 6 fields × weighted points = 100%. Name (20) + Species (20) + Breed (15) + DOB (15) + Weight (15) + Health Reviewed (15). `health_reviewed_at` must be set for the last 15%.
- **`checkmark-shield-outline` icon:** Invalid Ionicons name. Should be `shield-checkmark-outline` for "Perfectly Healthy" chip. Fix in ConditionChip.tsx.

## When You're Unsure

1. Check DECISIONS.md — if the answer is there, follow it
2. Check ROADMAP.md — if it's out of scope for the current milestone, say so
3. For scoring math/thresholds: check `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`
4. For breed-specific logic: check `BREED_MODIFIERS_DOGS.md` or `BREED_MODIFIERS_CATS.md`
5. If genuinely ambiguous, ask ONE focused question
6. If a request contradicts a locked decision, flag the conflict explicitly

## Self-Check (Run Before Every Deliverable)

□ Scoring engine deterministic and testable?
□ All three layers independently verifiable?
□ Species safety checks exhaustive and source-cited?
□ Paywall boundary clean and centralized in permissions.ts?
□ No unverified safety data reaching users as fact?
□ Supabase RLS isolates user data?
□ Scan → score flow ≤2 seconds perceived?
□ Frequency advisories separate from score calculations?
□ Affiliate logic completely isolated from scoring?
□ Refused to score unsupported species?
□ Clinical Copy Rule followed?
□ Every penalty has citation_source?
□ Scoring engine brand-blind?
□ Checked position_reduction_eligible before position discounts?
□ Applied DMB conversion for wet food (moisture >12%)?
□ Used cluster_id (not string matching) for splitting detection?
□ Aligns with DECISIONS.md? Conflicts flagged?
□ Stayed in scope for current milestone?
□ Complete deliverable, not half-finished?
□ Score displayed as "[X]% match for [Pet Name]" — never naked?
□ No UPVM-prohibited terms in UI copy (prescribe, treat, cure, prevent, diagnose)?
□ Breed modifiers capped at ±10 and all have citations?
□ Paywall logic ONLY in permissions.ts? (D-051)
□ LLM-extracted GA validated before DB insertion? (D-043)
□ API keys server-side only, never in app binary? (D-127)
□ Hash normalization applied before ingredients_hash? (D-044)
□ Recall alerts free — no paywall gate? (D-125)
□ Supplement/grooming exit paths store-only, no scoring? (D-096, D-083)
□ Haiku classification stored with user corrections? (D-128)
□ Scan sound respects mute toggle? (AsyncStorage preference)
□ Pure Balance regression = 65 after any scoring change?
□ D-129 allergen override is per-pet-per-score only — base severity unchanged?
□ Benchmark bar excludes partial-score products from averages?
□ All Haiku-generated ingredient content has review_status = 'llm_generated'?
□ Flavor deception card uses D-095 factual language — no "misleading" or "deceptive"?
□ Share card includes Kiba branding + kibascan.com CTA?
□ D-136: Supplemental products use 65/35/0 weights, NOT 55/30/15?
□ D-136: NP bucket for supplementals evaluates macros only — no micronutrient penalties?
□ D-136: Green NEVER on supplementals, teal/cyan NEVER on daily food?
□ D-136: Open arc ring (270°) for supplementals, full circle for daily food?
□ D-136: is_supplemental is orthogonal to haiku_suggested_category — not confused?
□ D-136: Score color uses getScoreColor() with correct product type — no hardcoded D-113 values?
