# CLAUDE.md — Kiba Project Context

> This file is read automatically by Claude Code at the start of every session.
> It is the single source of context for all development work.
> Last updated: February 27, 2026

---

## What Is This Project?

Kiba (kibascan.com — domain registered) is a pet food scanner iOS app — "Yuka for pets." Users scan a barcode on any pet food, treat, or supplement and get an ingredient-level safety score from 0-100, with species-specific intelligence for dogs and cats.

**Owner:** Steven (product decisions, non-coder)
**Developer:** Claude Code (you)
**Current phase:** M1 Scan → Score Pipeline

## Tech Stack

- **Framework:** Expo (React Native) with TypeScript strict mode
- **State:** Zustand
- **Backend:** Supabase (Postgres + Auth + Storage + Row Level Security)
- **Navigation:** React Navigation (bottom tabs + stack navigators)
- **Barcode:** `expo-camera` built-in scanning (NOT `expo-barcode-scanner` — deprecated)
- **Payments:** RevenueCat — NOT installed until M3-M4
- **Testing:** Jest for scoring engine, reference product regression tests

## Project Structure

```
kiba-app/
├── CLAUDE.md              ← you are here
├── DECISIONS.md            ← canonical decision log (111 decisions)
├── ROADMAP.md              ← milestone-by-milestone plan
├── NUTRITIONAL_PROFILE_BUCKET_SPEC.md  ← 30% nutritional bucket: curves, thresholds, DMB
├── BREED_MODIFIERS_DOGS.md             ← 20 dog breed entries (scoring engine lookup table)
├── BREED_MODIFIERS_CATS.md             ← 18 cat breed entries (scoring engine lookup table)
├── app.json
├── tsconfig.json
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── src/
│   ├── types/              ← all TypeScript interfaces
│   │   └── index.ts
│   ├── components/         ← shared UI components
│   │   ├── ScoreGauge.tsx
│   │   ├── BenchmarkBar.tsx
│   │   ├── IngredientList.tsx
│   │   └── StatChips.tsx
│   ├── screens/
│   │   ├── OnboardingScreen.tsx    ← 2-screen intro + minimal pet profile (D-092)
│   │   ├── HomeScreen.tsx          ← dashboard: recent scans, weekly counter, alerts
│   │   ├── SearchScreen.tsx        ← premium-gated text search
│   │   ├── ScanScreen.tsx          ← camera + barcode (raised center tab)
│   │   ├── ResultScreen.tsx        ← "[X]% match for [Pet Name]" + waterfall
│   │   ├── PantryScreen.tsx
│   │   ├── MeScreen.tsx            ← pet profiles, settings, subscription
│   │   └── PetProfileScreen.tsx
│   ├── services/
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
│   │       ├── dogs.ts              ← 20 breed entries from BREED_MODIFIERS_DOGS.md
│   │       └── cats.ts              ← 18 breed entries from BREED_MODIFIERS_CATS.md
│   ├── stores/
│   │   ├── useAppStore.ts
│   │   ├── usePetStore.ts
│   │   └── useScanStore.ts
│   ├── utils/
│   │   ├── permissions.ts   ← ONLY location for paywall checks
│   │   └── constants.ts
│   └── navigation/
│       └── index.tsx
└── __tests__/
    ├── scoring/
    │   ├── engine.test.ts
    │   ├── ingredientQuality.test.ts
    │   ├── speciesRules.test.ts
    │   └── dmbConversion.test.ts
    └── referenceProducts.test.ts  ← regression tests
```

## Score Framing — Suitability Match (D-094)

All Kiba scores are **pet-specific suitability matches**, not universal product quality ratings.

- Display: `"[X]% match for [Pet Name]"` — NEVER `"This product scores [X]"`
- Pet name and photo always visible on scan result screen
- Same product can score differently for different pets
- No "naked" scores — pet profile required before any score displays
- All products start at 100; deductions are compatibility adjustments

**User-facing layer names in waterfall breakdown:**
- Layer 1: "Ingredient Concerns"
- Layer 2: "[Pet Name]'s Nutritional Fit"
- Layer 3: "[Pet Name]'s Breed & Age Adjustments"

## Scoring Engine Architecture

**Detailed specs (read these before implementing scoring):**
- `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` — Full 30% nutritional bucket: AAFCO thresholds, DMB conversion, trapezoidal scoring curves, life stage modifiers, sub-nutrient weights
- `BREED_MODIFIERS_DOGS.md` — 20 breed entries across 3 tiers (GA-actionable, ingredient-actionable, advisory-only)
- `BREED_MODIFIERS_CATS.md` — 18 breed entries across 3 tiers, plus 3 global findings (taurine ≠ HCM, fat > carbs for obesity, phosphorus source matters)

### Category-Adaptive Weighting
| Category | Ingredient Quality | Nutritional Profile | Formulation |
|----------|-------------------|--------------------:|------------:|
| Daily Food (kibble, wet, raw) | 55% | 30% | 15% |
| Treats | 100% | 0% | 0% |

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
- **Breed data:** `BREED_MODIFIERS_DOGS.md` (20 breeds) and `BREED_MODIFIERS_CATS.md` (18 breeds)
- **Breed runtime data:** Static JSON in `src/content/breedModifiers/` (D-109) — NOT in Supabase
- Three actionability tiers: GA-actionable, ingredient-list-actionable, advisory-only
- Breed modifiers capped at ±10 total within the nutritional bucket
- `no_modifier` breeds explicitly registered to prevent false penalties
- Neutral if no conflicts detected

### Reference Scores (Regression Tests)
- **Pure Balance Grain-Free Salmon & Pea (Dog):** 66/100
  - IQ: 60, NP: 82, FC: 78 → Base: 69.3 → DCM −8% → Mitigation +3% → 66
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
- `pets` — RLS enforced, includes `goal_weight`, `life_stage` (derived, never user-entered). Canonical name per D-110 (NOT `pet_profiles`)
- `pet_conditions` — D-097 many-to-many (pet → condition_tag). RLS via pets table join
- `pet_allergens` — D-097 many-to-many (pet → allergen). Only populated when `allergy` condition exists. RLS via pets table join
- `scans` — stores `score_breakdown` JSONB snapshot per scan

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
- Geriatric cats (12+): DER multiplier uses geriatric floor, never portioned below it
- ❌ No caloric density penalties, no fat/carb multipliers for weight — avoids bad food outscoring good food

## What NOT to Build

- ❌ Ask AI / AI chatbot (liability — permanently removed)
- ❌ Cosmetics/grooming (deferred to M16+)
- ❌ Supplement scoring engine (deferred to M16+, D-096 — supplements stockpiled in DB but not scored at launch)
- ❌ RevenueCat at M0 (install M3-M4 only)
- ❌ `expo-barcode-scanner` (deprecated — use `expo-camera`)
- ❌ Star ratings (replaced by Kiba Index: Taste Test + Tummy Check)
- ❌ OPFF as data source (using Apify scraping + curated + community)

## Commit Convention

Use descriptive commit messages referencing the milestone:
```
M0: initial Supabase schema with RLS policies
M1: Layer 1 ingredient quality scoring function
M1: DMB conversion for wet food nutritional profile
```

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
