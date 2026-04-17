# Kiba — AI Assistant Instructions

> Universal project context for any AI coding assistant.
> For Claude Code specifics, see CLAUDE.md.
> Last synced: March 19, 2026 — M4.5 complete, 641 tests/32 suites.

---

## What Is This

Kiba (kibascan.com) — iOS pet food scanner app. Scan barcode, get a 0-100 suitability score personalized to the user's dog or cat. Think "Yuka for pets."

- **Stack:** Expo (React Native) + TypeScript strict | Zustand | Supabase (Postgres + Auth + Storage + RLS) | React Navigation 7 | RevenueCat | Jest
- **Owner:** Steven (product decisions, non-coder)
- **Current phase:** M5 Pantry + Recall Siren (M0-M4.5 complete)
- **Dogs and cats only** — refuse any other species

---

## Architecture

```
src/
  services/scoring/        # 3-layer scoring engine (the core product)
    engine.ts              # Orchestrator: computeScore(product, petProfile) -> ScoredResult
    ingredientQuality.ts   # Layer 1a: position-weighted ingredient penalties
    nutritionalProfile.ts  # Layer 1b: AAFCO threshold checks with DMB conversion
    formulationScore.ts    # Layer 1c: AAFCO statement + preservative + protein naming
    speciesRules.ts        # Layer 2: dog DCM (D-137 pulse framework), cat carb overload
    personalization.ts     # Layer 3: allergen overrides, life stage, breed modifiers
    pipeline.ts            # DB bridge: hydrates ingredients, handles bypasses
  services/
    auth.ts                # ensureAuth() — anonymous sign-in
    petService.ts          # Pet CRUD + photo upload to Supabase Storage
    supabase.ts            # Single Supabase client
    portionCalculator.ts   # RER/DER math
    treatBattery.ts        # 10% of DER treat budget
    scanner.ts             # UPC lookup + Edge Function calls
  utils/
    constants.ts           # Colors, SCORING_WEIGHTS, SEVERITY_COLORS, getScoreColor()
    permissions.ts         # THE ONLY paywall location — all canX() checks live here
    lifeStage.ts           # deriveLifeStage(), deriveBreedSize(), isUnder4Weeks()
    supplementalClassifier.ts  # AAFCO intermittent/supplemental keyword detection
    varietyPackDetector.ts # D-145 variety pack bypass
    calorieEstimation.ts   # Atwater fallback (D-149)
    conditionLogic.ts      # Health condition scoring rules
    flavorDeception.ts     # Name vs ingredient mismatch detection
    ingredientNormalizer.ts # Canonical name normalization
    haptics.ts             # expo-haptics wrapper (D-121)
  stores/
    useAppStore.ts         # Onboarding, TOS state (persisted)
    useActivePetStore.ts   # Active pet + pet list (D-120)
    useScanStore.ts        # Current scan, cache (in-memory)
  types/
    index.ts               # Core entities: Pet, Product, IngredientDict, ScanRecord
    scoring.ts             # ProductIngredient, ScoredResult, DcmResult, all layer results
    pet.ts                 # Pet interface matching DB schema
    navigation.ts          # Stack param lists, PaywallTrigger enum
  screens/                 # 16 screens
    ResultScreen.tsx       # Shared result view (most complex screen)
    ScanScreen.tsx         # Camera + barcode scanning
    PetHubScreen.tsx       # Pet management hub with carousel
    CreatePetScreen.tsx    # Pet creation form
    EditPetScreen.tsx      # Pet editing form
    HealthConditionsScreen.tsx  # D-097 conditions + allergen picker
    HomeScreen.tsx         # Dashboard
    PantryScreen.tsx       # Pantry view (M5)
    PaywallScreen.tsx      # RevenueCat paywall (D-126)
    SearchScreen.tsx       # Premium text search
    OnboardingScreen.tsx   # Scan-first onboarding (D-092)
    TermsScreen.tsx        # TOS clickwrap
    SpeciesSelectScreen.tsx    # Dog/cat pre-screen (D-122)
    ProductConfirmScreen.tsx   # DB miss confirmation
    IngredientCaptureScreen.tsx # OCR ingredient capture
    CommunityContributionScreen.tsx # User-submitted products
  components/
    scoring/               # ScoreRing, ScoreWaterfall, AafcoProgressBars, BenchmarkBar,
                           # ConcernTags, SeverityBadgeStrip, BonusNutrientGrid, PositionMap
    ingredients/           # IngredientList, IngredientDetailModal, DcmAdvisoryCard,
                           # FlavorDeceptionCard, SplittingDetectionCard
    pet/                   # BreedSelector, AllergenSelector, ConditionChip, PetPhotoSelector,
                           # BreedContraindicationCard, NursingAdvisoryCard, PetShareCard
    ui/                    # CollapsibleSection, InfoTooltip, LoadingTerminal, MetadataBadgeStrip,
                           # ScannerOverlay, DevMenu, FormulaChangeTimeline
    PortionCard.tsx
    TreatBatteryGauge.tsx
  content/explainers/      # Static educational content
  data/
    breeds.ts              # 23 dogs + 21 cats with modifiers
    conditions.ts          # Health condition definitions
  navigation/index.tsx     # Tab navigator: Home | Search | (SCAN) | Pantry | Me
```

**Supabase migrations:** `supabase/migrations/001-010`
**Tests:** `__tests__/{category}/{file}.test.ts` — 641 tests, 32 suites
**Scripts:** `scripts/{content,data,import,pipeline,refinery,scoring}/`
**Data files:** `data/dataset_kiba_v6_merged.json`, `data/kiba_cleaned.json`

---

## Scoring Engine — The Core Product

Read `docs/references/scoring-rules.md` before ANY scoring changes.

### Category Weights

| Category | IQ (Layer 1a) | NP (Layer 1b) | FC (Layer 1c) |
|----------|---------------|---------------|---------------|
| Daily Food | 55% | 30% | 15% |
| Supplemental | 65% | 35% (macro-only) | 0% |
| Treats | 100% | 0% | 0% |

Weights defined in `src/utils/constants.ts` → `SCORING_WEIGHTS`.

### Layer 1a — Ingredient Quality (ingredientQuality.ts)
- Severity penalties: danger = -15, caution = -8 per ingredient
- Position multiplier: positions 1-5 = 1.0, 6-10 = 0.7, 11+ = 0.4
- Only `position_reduction_eligible = true` ingredients get position reduction
- Unnamed species penalty: -2 per unnamed fat/protein

### Layer 1b — Nutritional Profile (nutritionalProfile.ts)
- Compares GA values to AAFCO thresholds using trapezoidal scoring curves
- **MUST convert wet food to DMB** when moisture > 12%
- Sub-nutrient weights — Dog: 35/25/15/25, Cat: 45/20/10/25
- Supplementals: macro-only (skip micronutrient AAFCO checks)
- Full spec: `docs/specs/NUTRITIONAL_PROFILE_BUCKET_SPEC.md`

### Layer 1c — Formulation Score (formulationScore.ts)
- AAFCO statement (50%), preservative quality (25%), protein naming (25%)

### Layer 2 — Species Rules (speciesRules.ts)
- **Dog DCM (D-137):** 3-rule OR on pulses in top 10 ingredients. Penalty: x0.92. Mitigation: x1.03 when taurine + L-carnitine both present. Uses `is_pulse`/`is_pulse_protein` flags (NOT `is_legume`).
- **Cat carb overload:** -15% for 3+ high-glycemic carbs in top 5
- **Cat taurine:** mandatory check
- Species rules never cross between dogs and cats

### Layer 3 — Personalization (personalization.ts)
- Allergen overrides (D-129): direct match → danger, possible match → caution
- Life stage mismatch (D-150): puppy eating adult food = -15 (daily), -10 (supplemental), -5 (treat)
- Breed modifiers: data in `src/data/breeds.ts`, cap +/-10
- Under-4-weeks nursing advisory (D-151): suppress life stage penalty, show advisory card

### Bypass Chain (pipeline.ts — no scoring runs)
```
vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → scoring
```

### Regression Anchors (MUST verify after scoring changes)
- **Pure Balance Grain-Free Salmon (Dog)** = 61
- **Temptations Classic Tuna (Cat Treat)** = 0

---

## Schema — Critical Traps

These are the most common mistakes. Memorize these.

### Table Names
- `pets` (NOT `pet_profiles`)
- `product_upcs` — junction table UPC → product_id (NOT a TEXT[] array)
- `scans` (NOT `scan_history`)
- `pet_conditions` — many-to-many (pet_id, condition_tag)
- `pet_allergens` — many-to-many (pet_id, allergen)
- `pantry_items` + `pantry_pet_assignments` — M5 pantry

### Column Names on `pets`
- `weight_current_lbs` (NOT `weight_lbs`)
- `date_of_birth` (NOT `birth_date`)
- `is_neutered` (NOT `is_spayed_neutered`)
- `life_stage` — derived, NEVER user-entered (D-064)
- `health_reviewed_at` — null = never visited health screen

### Column Names on `products`
- `is_supplemental` — AAFCO intermittent/supplemental (65/35/0 scoring)
- `is_vet_diet` — bypass, no scoring (D-135)
- `is_recalled` — bypass, no scoring (D-158)
- `affiliate_links` JSONB — INVISIBLE to scoring engine
- `product_form` — 'dry' | 'wet' | 'raw' | 'freeze-dried' | etc.

### Column Names on `ingredients_dict`
- `is_pulse` / `is_pulse_protein` for DCM detection (NOT `is_legume`)
- `position_reduction_eligible` — controls whether position weighting applies
- `cluster_id` for splitting detection (NEVER use string matching)
- `allergen_group` — maps to protein family for cross-reactivity (D-098)
- `allergen_group_possible TEXT[]` — unnamed terms that COULD contain allergens

### Auth
- Anonymous sign-in via `ensureAuth()` in `src/services/auth.ts`
- Storage bucket `pet-photos` (public), path: `{userId}/{petId}.jpg`
- RLS on every user-data table — `auth.uid() = user_id`

---

## Non-Negotiable Rules

1. **Brand-blind scoring** — no brand-specific modifiers, ever
2. **Affiliate isolated** — `affiliate_links` invisible to scoring engine
3. **Paywall ONLY in `permissions.ts`** — no scattered `if (isPremium)` anywhere
4. **Dogs and cats only** — refuse unsupported species
5. **Clinical copy** — objective, citation-backed, never editorial
6. **Every penalty has `citation_source`** — no unattributed claims
7. **RLS on every user-data table** — enforced via Supabase policies
8. **No `any` types** in TypeScript — project is `strict: true`
9. **Score framing (D-168, supersedes D-094)** — `{score}% match for {petName}` only on outbound share (`PetShareCard`); `{score}% match` on in-app list rows; `{score}%` on dense surfaces incl. `ScoreRing`. All in-app surfaces need explicit `accessibilityLabel` with the full phrase
10. **UPVM compliance (D-095)** — NEVER use: "prescribe," "treat," "cure," "prevent," "diagnose"
11. **Bypasses skip scoring entirely** — vet diet, species mismatch, variety pack, recalled product
12. **API keys server-side only (D-127)** — all external calls via Supabase Edge Functions
13. **Recall alerts are free (D-125)** — never paywalled

---

## Score Display Rules

### Color System (D-136) — `getScoreColor(score, isSupplemental)` in constants.ts
Two color families that NEVER cross:

**Daily food/treats (green family):**
85-100 = Dark Green #22C55E | 70-84 = Light Green #86EFAC | 65-69 = Yellow #FACC15 | 51-64 = Amber #F59E0B | 0-50 = Red #EF4444

**Supplemental (teal/cyan family):**
85-100 = Teal #14B8A6 | 70-84 = Cyan #22D3EE | 65-69 = Yellow #FACC15 | 51-64 = Amber #F59E0B | 0-50 = Red #EF4444

- 360 degree ring = daily food + treats
- 270 degree open arc = supplemental ("not complete on its own")
- Green NEVER on supplementals. Teal/cyan NEVER on daily food.

### Severity Colors — `SEVERITY_COLORS` in constants.ts
Danger: #EF4444 | Caution: #F59E0B | Good: #4ADE80 | Neutral: #6B7280
Display label for `danger` is "Severe" (not "Danger") per D-143.

---

## Spec Files — Read Before Changing

| File | When to read |
|------|-------------|
| `DECISIONS.md` | Before implementing anything — 159 decisions (D-001-D-159) |
| `ROADMAP.md` | To check milestone scope |
| `docs/references/scoring-rules.md` | Before ANY scoring changes |
| `docs/specs/NUTRITIONAL_PROFILE_BUCKET_SPEC.md` | AAFCO thresholds, DMB, trapezoidal curves |
| `docs/specs/BREED_MODIFIERS_DOGS.md` / `_CATS.md` | Breed-specific modifiers |
| `docs/specs/PET_PROFILE_SPEC.md` | Profile fields, conditions, allergens |
| `docs/specs/PORTION_CALCULATOR_SPEC.md` | RER/DER math, goal weight |
| `docs/references/dataset-field-mapping.md` | Apify to Supabase field mapping |

---

## Do NOT Build

- Ask AI / chatbot (liability — permanently removed, D-034)
- Score supplements (M16+, D-096) or grooming/cosmetics (D-083)
- Score vet diets (D-135 bypass) or variety packs (D-145 bypass)
- `expo-barcode-scanner` (deprecated — use `expo-camera`)
- Star ratings (replaced by Kiba Index, M8+)
- Compare flow or Vet Report PDF (M6, not current milestone)

---

## Testing

- **Run:** `npx jest` or `npx jest --onlyChanged`
- **Location:** `__tests__/{category}/{file}.test.ts`
- **Preset:** `jest-expo`
- **Current count:** 641 tests across 32 suites
- After scoring changes: verify Pure Balance = 61, Temptations = 0

---

## Common Tasks

### Adding a new screen
1. Create screen in `src/screens/`
2. Add to appropriate stack in `src/navigation/index.tsx`
3. Add type to `src/types/navigation.ts` param list

### Modifying scoring
1. Read `docs/references/scoring-rules.md` first
2. Make changes in `src/services/scoring/`
3. Run `npx jest __tests__/scoring/` — all must pass
4. Verify regression anchors: Pure Balance = 61, Temptations = 0
5. Update `docs/references/scoring-rules.md` if rules changed

### Adding a paywall gate
1. Add `canX()` function to `src/utils/permissions.ts` — this is the ONLY location
2. Call `canX()` from the feature — never inline `if (isPremium)` checks

### Adding a new ingredient flag
1. Add column to `ingredients_dict` via migration in `supabase/migrations/`
2. Add to `ProductIngredient` type in `src/types/scoring.ts`
3. Add to hydration query in `src/services/scoring/pipeline.ts`
4. Write backfill script in `scripts/data/`

### Working with pet profiles
- Species is immutable after creation (D-122) — delete + recreate to change
- `life_stage` and `breed_size` are derived — never ask the user
- Health conditions: `pet_conditions` table, allergens: `pet_allergens` table
- Photo path: `pet-photos/{userId}/{petId}.jpg` in Supabase Storage

---

## Style & Conventions

- **TypeScript strict** — no `any`, no implicit returns, no untyped imports
- **Dark theme only** (D-086) — background #1A1A1A, cards #242424, text #FFFFFF
- **Zero emoji in UI** (D-084) — use SF Symbols / Ionicons
- **Commit format:** `M5: description of change`
- **Severity enum:** `'danger' | 'caution' | 'neutral' | 'good'` (DB/code). Display: "Severe" for danger (D-143)
- **Score framing:** Always `"[X]% match for [Pet Name]"` — never "scores X" or "rated X"
- Prefer editing existing files over creating new ones
- Keep components in their subdirectory (`scoring/`, `ingredients/`, `pet/`, `ui/`)

---

## When Unsure

1. Check `DECISIONS.md` — if answered there, follow it
2. Check `ROADMAP.md` — if out of scope for current milestone, flag it
3. Scoring math → `docs/references/scoring-rules.md`
4. Breed logic → `docs/specs/BREED_MODIFIERS_DOGS.md` / `BREED_MODIFIERS_CATS.md`
5. If ambiguous, ask one focused question
