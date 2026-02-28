# Kiba M1 — Claude Code Prompt Guide

> **Purpose:** Step-by-step prompts for building the Scan → Score pipeline in Claude Code.
> Each prompt is copy-paste ready. Session boundaries, `/compact`, and `/clear` points are marked.
> **Updated:** February 27, 2026 — incorporates D-092 (locked), D-109, D-110, D-111.

---

## Pre-Session: CLAUDE.md

Your actual `CLAUDE.md` (updated Feb 27, 2026) is the session context file. Claude Code reads it automatically at session start. **Do not replace it with a simplified version** — the real file has the correct project structure (including `src/content/breedModifiers/`), all 111 decisions referenced, the updated schema with D-098/D-105 columns, and the `pets` table name (D-110).

The only thing to verify before starting: CLAUDE.md says `Current phase: M0 Foundation — project initialization`. Once M0 is complete and you're starting M1, update that line to:

```
**Current phase:** M1 Scan → Score Pipeline
```

Everything else in CLAUDE.md is accurate and ready.

---

## Session 1: Camera + UPC Lookup

**Context is fresh. Start with Plan Mode immediately.**

---

### Prompt 1 — Plan Mode + Camera Spec

```
/plan

@src/services/supabase.ts @src/types/product.ts @src/stores/index.ts

Starting M1 Session 1: Camera and UPC lookup pipeline.

Before planning, read DECISIONS.md sections relevant to this work:
- D-040 (UPC schema — junction table, btree index)
- D-041 (product images named by product_id, not UPC)
- D-091 (database miss handling — Level 4 Hybrid flow)
- D-092 (onboarding — LOCKED: scan-first with light profile capture)

Scope for this session — three deliverables only:

1. src/services/scanner.ts
   - UPC lookup: scanned UPC → product_upcs (btree) → product_id →
     full products record joined
   - Returns: full Product type or null
   - Haptic feedback trigger point (success only) — expo-haptics
   - This file contains ZERO scoring logic

2. src/screens/ScanScreen.tsx
   - expo-camera barcode scanning (SDK 51+ built-in, NOT deprecated
     expo-barcode-scanner)
   - On successful decode: call scanner.ts lookup
   - If product found AND no pet profile exists:
     → route to light profile capture (name + species, one screen,
       two fields) per D-092 locked flow, then to ResultScreen
   - If product found AND pet profile exists:
     → route directly to ResultScreen
   - If product not found:
     → navigate to CommunityContributionScreen placeholder
   - Camera opens immediately on mount per D-092 scan-first flow
   - Tab bar visible, raised SCAN button per D-085 navigation spec
   - Zero scoring logic here — this screen only scans and routes

3. src/screens/CommunityContributionScreen.tsx
   - Placeholder ONLY — a screen that renders "Coming in M3"
   - No OCR, no external UPC lookup — those are M3 per D-091 and ROADMAP.md
   - Do not build the Level 4 Hybrid flow yet

Constraints:
- D-084: No emoji anywhere — SF Symbols for all iconography
- D-086: Background #1A1A1A, cards #242424
- TypeScript strict mode, no `any`

Do not build result UI. Do not build scoring. Do not reference affiliate_links.
Show me the plan before writing a single line of code.
```

**Review checkpoint:** Two things to check in the plan: (1) it isn't reaching into M3 scope for the community contribution flow, and (2) it's using `expo-camera` built-in scanning not the deprecated package. If either is wrong, edit the plan directly before executing.

```
/execute
```

---

### Prompt 2 — Error Handling Pass

```
Scanner.ts is working. Now harden the error handling before we move on.

Three specific cases to handle in the UPC lookup:

1. Network timeout (Supabase call exceeds 5000ms)
   → Return null with error code 'NETWORK_TIMEOUT'
   → ScanScreen shows toast: "Connection error — check your network"
   → Camera resumes scanning immediately after toast

2. Supabase error (non-timeout DB error)
   → Log raw Supabase error to console with full context
   → Return null with error code 'DB_ERROR'
   → ScanScreen shows toast: "Something went wrong — try again"
   → Camera resumes

3. Orphaned UPC (product_upcs row exists but products JOIN returns null)
   → This is a data integrity issue, not a user error
   → Log to console: "Orphaned UPC detected: [upc]" for future cleanup
   → Treat same as "not found" → navigate to CommunityContributionScreen
   → Do NOT expose "orphaned" language to user

Write unit tests for all three cases using a mocked Supabase client.
Mock setup goes in __tests__/services/scanner.test.ts.
No changes to CommunityContributionScreen.
```

---

### Prompt 3 — Zustand Integration

```
Now wire the scan result into the Zustand store.

@src/stores/index.ts

When a successful UPC lookup returns a product:
- Store the product in the active scan cache (scanCache in the store)
- scanCache should hold the last 10 scanned products (FIFO, drop oldest)
- This cache feeds the scan history section on HomeScreen later (M4)

When "not found" → do NOT store anything in scanCache

TypeScript: scanCache type should be Product[] from src/types/product.ts

Write one test: scan a product → scan the same product again → confirm
it appears once in cache (deduplication by product_id), position updated
to front of array.

No UI changes. Store layer only.
```

---

### 🔴 CONTEXT CHECK — `/clear`

Session 1 is complete. Camera works, UPC lookup works, error handling is solid, Zustand is wired, tests pass. You're about to shift to the scoring engine — a completely different domain.

**This is a `/clear` moment.** The camera implementation details, the Supabase query structure, the haptic feedback wiring — none of this helps you build scoring math. Carrying it forward burns tokens on irrelevant context.

But first, document everything:

---

### Prompt 4 — Document Before Clear

```
Write session1-progress.md to the project root with the following:

## Files Created
- List each file, its path, and a one-line description of what it does

## Key Implementation Details
- The exact Supabase query used for UPC → product lookup (paste the
  full query)
- The Zustand scanCache shape (paste the type)
- Haptic feedback: which expo-haptics call, exactly where it fires
- D-092 scan-first routing logic: what happens when no pet profile
  exists vs when one does

## Test Coverage
- List each test file and what it covers
- Confirm all tests are passing

## Decisions Applied
- List each D-number referenced and confirm implementation matches spec

## Open Items
- Any implementation detail that deviated from DECISIONS.md (note the
  D-number)
- Any TypeScript issues left as TODOs

## Session 2 Pickup
- "Session 2 builds the scoring engine. Start with Layer 1a. Read
  DECISIONS.md D-010 through D-020 before implementing. Reference
  NUTRITIONAL_PROFILE_BUCKET_SPEC.md for Layer 1b — it is the
  authoritative spec. Do not implement Layer 1b from memory."
```

Verify the document looks complete and accurate. Then:

```
/clear
```

Commit to git. Session 1 is boxed.

---

## Session 2: Scoring Engine

**Fresh context. This session carries the most complexity and will be the longest.**

---

### Prompt 1 — Load Context + Define Shared Types

```
/plan

@session1-progress.md @src/types/product.ts @NUTRITIONAL_PROFILE_BUCKET_SPEC.md

Read session1-progress.md first so you know what's been built.
Read NUTRITIONAL_PROFILE_BUCKET_SPEC.md in full — this is the authoritative
spec for Layer 1b. Do not implement Layer 1b from anything other than this doc.

Before planning, also read from DECISIONS.md:
- D-010 (category-adaptive weighting: 55/30/15 daily food, 100/0/0 treats)
- D-011 (three-layer architecture — all layers independently testable)
- D-012 (unnamed species penalty: −2 per unnamed fat/protein)
- D-015 (ingredient splitting: UI flag only, NO score penalty — read carefully)
- D-016 (DMB conversion — mandatory before nutritional bucket)
- D-017 (missing GA fallback: reweight to 78/22)
- D-018 (position-weighted scoring: proportion vs presence classes)
- D-019 (brand-blind — zero brand awareness)
- D-020 (affiliate_links invisible — never imported or queried)

First deliverable before any scoring code: define the shared types that all
scoring layers will use. These go in src/types/scoring.ts.

ProductIngredient type (input to all layers that handle ingredients):
- position: number
- canonical_name: string
- dog_base_severity: 'danger' | 'caution' | 'neutral' | 'good'
- cat_base_severity: 'danger' | 'caution' | 'neutral' | 'good'
- is_unnamed_species: boolean
- is_legume: boolean
- position_reduction_eligible: boolean
- cluster_id: string | null
- cat_carb_flag: boolean
- allergen_group: string | null           // D-098 cross-reactivity
- allergen_group_possible: string[]       // D-098 unnamed terms

Define these output types as well (I'll specify the shapes in subsequent
prompts, but establish the empty interfaces now so we have type-safe
contracts between layers):
- IngredientScoreResult (Layer 1a output)
- NutritionScoreResult (Layer 1b output)
- FormulationScoreResult (Layer 1c output)
- SpeciesRuleResult (Layer 2 output)
- PersonalizationResult (Layer 3 output)
- ScoredResult (orchestrator final output)

Show me the plan. Do not write scoring logic yet — types only.
```

```
/execute
```

---

### Prompt 2 — Layer 1a: Ingredient Quality

```
Types are defined. Now Layer 1a.

Deliverable:
src/services/scoring/ingredientQuality.ts

Function signature:
scoreIngredients(
  ingredients: ProductIngredient[],
  species: 'dog' | 'cat'
) => IngredientScoreResult

Fill in the IngredientScoreResult type:
{
  ingredientScore: number        // 0-100
  penalties: Penalty[]           // each deduction with reason and amount
  flags: string[]               // non-scoring signals
  unnamedSpeciesCount: number   // for UI display
}

Where Penalty:
{
  ingredientName: string
  reason: string
  rawPenalty: number
  positionAdjustedPenalty: number
  position: number
  citationSource: string        // D-012 rule 14: every penalty needs citation
}

Scoring rules from D-018:
- Proportion-based ingredients (position_reduction_eligible = true):
    positions 1-5: full penalty
    positions 6-10: 30% reduction
    positions 11+: 60% reduction
- Presence-based (position_reduction_eligible = false):
    full penalty regardless of position
- CRITICAL: check position_reduction_eligible BEFORE applying any position
  discount. If the flag is false, position is irrelevant.

Severity to raw penalty mapping:
- 'danger': −15 points
- 'caution': −8 points
- 'neutral': 0
- 'good': 0 (no bonus — products start at 100, deductions only)

Unnamed species (D-012):
- −2 points per occurrence where is_unnamed_species = true
- Regardless of position
- Counted separately in unnamedSpeciesCount

Ingredient splitting (D-015 — READ CAREFULLY):
- Detect via: GROUP BY cluster_id WHERE cluster_id is not null,
  count >= 2 for same cluster_id
- Add 'ingredient_splitting_detected' to flags array
- DO NOT apply any score penalty — flag only
- This is a UI concern, not a scoring concern

Products start at 100. All penalties are deductions. Floor at 0.

Pure function — no Supabase calls, no side effects, no brand awareness.

Tests: __tests__/services/scoring/ingredientQuality.test.ts

Show me the full plan before writing code.
```

**Review the plan.** Specifically confirm Claude understands D-015 (flag, not penalty) and D-018 (position_reduction_eligible check) before executing.

```
/execute
```

---

### Prompt 3 — Layer 1a Edge Case Tests

```
Layer 1a implementation looks correct. Add these edge case tests
to ingredientQuality.test.ts before we move on:

1. Empty ingredients array → score: 100, no penalties, no flags

2. All ingredients are 'good' severity → score: 100, no penalties

3. Single 'danger' presence-based ingredient at position 15
   (position_reduction_eligible = false)
   → full penalty (−15) still applied, position does NOT reduce it
   → confirm this matches D-018 exactly

4. Two ingredients with same cluster_id 'legume_pea'
   (e.g. Dried Peas at pos 3 + Pea Starch at pos 8)
   → flags must include 'ingredient_splitting_detected'
   → score must NOT be affected by splitting detection
   → confirm this matches D-015: "UI flag, no direct score penalty"

5. Three unnamed species ingredients (is_unnamed_species = true)
   → unnamedSpeciesCount = 3
   → total unnamed penalty = −6 (3 × −2 per D-012)
   → these stack with any severity penalties on the same ingredients

Run all tests and confirm passing before responding.
```

---

### Prompt 4 — Layer 1b: Nutritional Profile

```
Layer 1a complete and tested. Now Layer 1b.

READ NUTRITIONAL_PROFILE_BUCKET_SPEC.md FULLY before writing any code.
This is the authoritative spec. Do not deviate from it.

Deliverable:
src/services/scoring/nutritionalProfile.ts

Function signature:
scoreNutritionalProfile(
  product: Product,
  species: 'dog' | 'cat',
  lifeStage: LifeStage,
  breedSize?: BreedSize,
  petConditions?: string[]       // D-106: needed for fiber penalty suppression
) => NutritionScoreResult

Output type:
{
  bucketScore: number              // 0-100, the 30% bucket output
  subScores: {
    protein: number
    fat: number
    fiber: number
    carbs: number
  }
  modifiersApplied: Modifier[]     // life stage and breed modifiers with reason
  dataQuality: 'full' | 'partial' | 'missing'
  missingFields: string[]          // which GA fields were null/assumed
  llmExtracted: boolean            // true if nutritional_data_source = 'llm_extracted'
}

Implementation must follow spec exactly:

§1 — DMB conversion
  - Mandatory when moisture_pct > 12%
  - Apply to all GA values: protein, fat, fiber
  - Carb derived via NFE (§2c): Math.max(0, 100 - (protein_dmb + fat_dmb + fiber_dmb + ash_dmb))
  - Floor required — GA min/max asymmetry can produce negative values
  - Ash defaults: dry food 7.0%, wet food 2.0%, treats 5.0%
  - If calcium AND phosphorus both present: ash ≈ (ca% + p%) × 2.5

§2 — AAFCO thresholds
  - Tables from spec §2a (dogs) and §2b (cats)
  - Apply correct profile by lifeStage: 'growth_reproduction' or
    'adult_maintenance'

§4a — Sub-nutrient weights
  - Dog: protein 35%, fat 25%, fiber 15%, carbs 25%
  - Cat: protein 45%, fat 20%, fiber 10%, carbs 25%

§4b — Trapezoidal scoring curves
  - Implement as a pure helper: trapScore(value, min, idealLow,
    idealHigh, excess, excessScore) => 0-100
  - Protein curve from spec:
    < min×0.8 → 0
    min×0.8 to min → linear 0 to 40
    min to min×1.15 → linear 40 to 70
    min×1.15 to min×2.0 → linear 70 to 100
    min×2.0 to min×2.5 → 100 (plateau)
    >= min×2.5 → 90 (slight reduction for excess)
  - Fat curve: same shape but excess score = 60 (real health risk)
  - Fiber curve (inverted — spec §4b):
    ≤1.0% → 80, ≤3.0% → 100, ≤5.0% → 90, ≤7.0% → 70,
    ≤10.0% → 50, >10.0% → 25
  - Carb curve: DIFFERENT for dogs vs cats (cats far stricter per spec §4b)
    Dogs: ≤30% → 100, ≤40% → 85, ≤50% → 65, ≤60% → 40, >60% → 20
    Cats: ≤15% → 100, ≤25% → 80, ≤35% → 55, ≤45% → 30, >45% → 10

§4b Fiber penalty suppression (D-106):
  - If product AAFCO statement includes "weight management" or "light":
    reduce fiber penalty by 50%
  - ALSO if petConditions includes 'obesity': reduce fiber penalty by 50%
  - Same 50% reduction, same math. One additional condition check.

§5 — Life stage modifiers
  - §5a puppy/kitten: protein bonus +5, fat bonus +3, adult-food
    penalty −15, Ca:P penalty −10
  - §5b senior dog: protein bonus +5 (≥25% DMB), phosphorus penalty
    −8 (>1.4% DMB), glucosamine/omega-3 bonus +3
  - §5c senior/geriatric cat: protein bonus +5 (≥30% DMB), protein
    penalty −10 (<30% DMB at age 12+), phosphorus penalty −8
    (>1.2% DMB at 12+), kitten-food penalty −5
  - §5d large breed puppy: calcium excess −12 (>1.8% DMB), calcium
    deficiency −8 (<0.8% DMB), narrow Ca:P −10 (outside 1.1:1 to 1.4:1)

§6 — Breed modifiers
  - At this stage, implement the modifier application framework only
  - Accept breedModifier?: BreedModifierResult as optional parameter
  - Cap: total breed modifier contribution ±10 within bucket (§6c)
  - Actual breed data comes from BREED_MODIFIERS files and
    src/content/breedModifiers/ (D-109) — populated in M2

§7 — Missing GA fallback
  - Fully missing: skip bucket, return dataQuality 'missing', caller
    reweights to 78/22 per D-017
  - Partially missing: neutral score (50) per field with flag (§7b):
    protein null → 50, fat null → 50, fiber null → assume 3%,
    moisture null → assume 10% dry / 78% wet
  - LLM-extracted flag if nutritional_data_source = 'llm_extracted'

§8 — Composite calculation
  - Follow step-by-step from spec exactly
  - Clamp all sub-scores [0, 100] before weighted sum
  - Clamp final bucket_score [0, 100]

File: src/services/scoring/nutritionalProfile.ts
Tests: __tests__/services/scoring/nutritionalProfile.test.ts

Required regression test from spec §8 worked example:
Adult cat, Domestic Shorthair, no breed modifiers
GA (as-fed): Protein 10%, Fat 5%, Fiber 1%, Moisture 78%
Expected bucket score: 93/100

Also test:
- DMB conversion: wet food 78% moisture → correct DMB values
  (protein 45.5%, fat 22.7%, fiber 4.5%)
- Missing GA fallback: all GA null → dataQuality 'missing'
- Senior geriatric cat (age 15+): protein < 30% DMB → −10 modifier fires
- Large breed puppy: Ca DMB > 1.8% → −12 modifier fires
- Fiber suppression: product with "weight management" in AAFCO statement
  → fiber penalty reduced 50%
- Fiber suppression via condition: pet has 'obesity' condition →
  fiber penalty reduced 50% regardless of product label

Show me the plan. Do not start implementing until I approve.
```

**This is the longest review pause in the entire M1 build.** Read the plan against the spec carefully. The trapezoidal curves and the life stage modifiers are the most likely places Claude will simplify or flatten. If anything looks wrong, edit the plan before executing.

```
/execute
```

---

### Prompt 5 — Verify Regression Test

```
Before we go any further — run the spec §8 worked example regression test.

Expected:
  Adult cat, Domestic Shorthair, Moisture 78%, Protein 10%, Fat 5%, Fiber 1%
  → bucket score: 93/100

Show me the actual output broken down by:
1. DMB values after conversion (expected: protein 45.5%, fat 22.7%,
   fiber 4.5%, carbs ~20.3%)
2. Each sub-nutrient score before weighting
3. Weighted sum calculation with actual numbers (cat weights:
   45/20/10/25)
4. Final clamped bucket score

If it does not produce 93, debug against the spec before continuing.
Do not move to Layer 1c until this passes.
```

Wait for confirmation. If it fails, stay in the debug loop here. This is your quality gate for the entire 30% bucket.

---

### ⚠️ COMPACT MOMENT

After Layer 1b you've had substantial back and forth — the type definitions, Layer 1a implementation, edge case tests, Layer 1b plan review, implementation, and the worked example debugging. You're probably at 55-65% context. Layer 1c, Layer 2, and Layer 3 are still ahead. You need continuity — Claude must remember the exact function signatures it built for Layer 1a and 1b because Layer 1c and the orchestrator must be consistent.

This is a `/compact` moment, not `/clear`.

```
/compact
```

After compact, orient Claude immediately:

```
Continuing M1 scoring engine. Context was just compacted.

Confirm you have in memory:
- src/types/scoring.ts: ProductIngredient type (includes allergen_group,
  allergen_group_possible)
- ingredientQuality.ts: scoreIngredients() function signature and output type
- nutritionalProfile.ts: scoreNutritionalProfile() function signature
  and output type (includes petConditions parameter for D-106)
- Both files in src/services/scoring/
- Regression test passing: 93/100 for adult cat worked example

If any of these are unclear, say so before I give the next prompt.
```

Wait for confirmation before continuing.

---

### Prompt 6 — Layer 1c: Formulation Completeness

```
Layer 1a and 1b complete and tested. Now Layer 1c.

Read DECISIONS.md before implementing:
- D-010 (formulation completeness = 15% of daily food score, 0% for treats)
- D-017 (missing GA fallback: this layer reweights to 22% if GA missing)

Deliverable:
src/services/scoring/formulationScore.ts

Function signature:
scoreFormulation(product: Product) => FormulationScoreResult

Output type:
{
  formulationScore: number     // 0-100
  breakdown: {
    aafcoScore: number         // 0-100
    preservativeScore: number  // 0-100
    proteinNamingScore: number // 0-100
  }
  flags: string[]
}

Sub-layer weights within this bucket:
  AAFCO Statement:        50%
  Preservative Quality:   25%
  Protein Naming:         25%

formulationScore = (aafcoScore × 0.50) + (preservativeScore × 0.25)
                 + (proteinNamingScore × 0.25)

Three checks:

1. AAFCO Statement (50% of formulation score)
   product.aafco_statement values:
   'All Life Stages': score 100
   'Adult Maintenance': score 90 (appropriate but less flexible)
   'Growth' or 'Reproduction': score 100 (specific and appropriate)
   null/missing: score 30 (significant penalty — no compliance claim)
   Unrecognized text: score 50 + flag 'aafco_statement_unrecognized'

2. Preservative Quality (25% of formulation score)
   product.preservative_type values from schema:
   'natural': score 100
   'mixed': score 65
   'synthetic': score 25
   'unknown': score 45 + flag 'preservative_type_unknown'

3. Protein Naming Specificity (25% of formulation score)
   Use the is_unnamed_species flag on ProductIngredient — do NOT
   reinvent string matching. Count ingredients where
   is_unnamed_species = true vs total protein/fat ingredients.

   Accept ingredients as optional parameter for this check:
   scoreFormulation(product: Product, ingredients?: ProductIngredient[])

   If ingredients provided:
     unnamedRatio = unnamed count / total protein+fat ingredient count
     score = 100 × (1 - unnamedRatio)
   If no ingredients provided: score 50 (neutral, no data)

   Note: This overlaps conceptually with D-012 unnamed species penalty
   in Layer 1a, but they measure different things. Layer 1a penalizes
   individual ingredient quality. This measures overall formulation
   transparency. Different concerns, both valid.

Pure function — no Supabase calls, no brand references.
File: src/services/scoring/formulationScore.ts
Tests: __tests__/services/scoring/formulationScore.test.ts

Test cases required:
- Product with 'All Life Stages' + natural preservatives + all named
  proteins → score near 100
- Product with null AAFCO statement + synthetic preservatives + all
  unnamed proteins → very low score (calculate expected from weights)
- Product with preservative_type 'unknown' → flag
  'preservative_type_unknown' present
- Product with aafco_statement 'some random text' → flag
  'aafco_statement_unrecognized' present, score = 50 for that sub-check
- No ingredients provided → protein naming sub-score defaults to 50
```

---

### Prompt 7 — Layer 2: Species Rules

```
Layer 1 complete (all three sub-layers). Now Layer 2.

Read DECISIONS.md before implementing:
- D-013 (DCM advisory — dogs only)
- D-014 (feline carb overload penalty — cats only)

Also reference NUTRITIONAL_PROFILE_BUCKET_SPEC.md §9 (Relationship to
Other Scoring Layers) — specifically the "No double-counting" note at
the bottom. The cat carb penalty here (Layer 2) checks INGREDIENT
POSITIONS. The carb sub-score in Layer 1b checks MATHEMATICAL
COMPOSITION. They are independent. Both can apply. This is intentional
per spec.

Deliverable:
src/services/scoring/speciesRules.ts

Function signature:
applySpeciesRules(
  product: Product,
  species: 'dog' | 'cat',
  ingredients: ProductIngredient[],
  baseScore: number                // weighted Layer 1 composite AFTER
                                   // 55/30/15 or 100/0/0 weighting
) => SpeciesRuleResult

IMPORTANT: baseScore is the output of the category-adaptive weighting
(D-010), not just Layer 1a. The DCM −8% and cat carb −15% are
percentages of this weighted composite. This matches the reference
scores in DECISIONS.md §11 where DCM fires after the 69.3 base.

Output type:
{
  adjustedScore: number
  rules: AppliedRule[]
}

Where AppliedRule:
{
  ruleId: string          // e.g. 'DCM_ADVISORY', 'TAURINE_MITIGATION'
  label: string           // consumer-facing label for waterfall UI
  adjustment: number      // actual points added/subtracted
  fired: boolean
  citation?: string
}

Dog rules (D-013):
  DCM_ADVISORY:
    Condition: product.is_grain_free = true AND count of ingredients
    where is_legume = true in positions 1-7 >= 3
    Effect: −8% of baseScore (percentage, not flat points)
    Citation: "FDA CVM DCM Investigation, 2019 (updated 2024)"

  TAURINE_MITIGATION:
    Condition: DCM_ADVISORY fired AND taurine present in ingredients
    (canonical_name contains 'taurine') AND l-carnitine present in
    ingredients (canonical_name contains 'l-carnitine')
    Effect: +3% of baseScore (original baseScore, not the post-DCM value)
    Net when both fire: −5% of baseScore
    IMPORTANT: mitigation ONLY fires if DCM_ADVISORY fired. Cannot
    get +3% without the −8% applying first.

Cat rules:
  CAT_CARB_OVERLOAD (D-014):
    Condition: species = 'cat' AND count of ingredients where
    cat_carb_flag = true in positions 1-5 >= 3
    Effect: −15% of baseScore (percentage, not flat points)
    Citation: "Journal of Animal Physiology, 2012"

  CAT_TAURINE_MISSING:
    Condition: species = 'cat' AND no ingredient with canonical_name
    containing 'taurine' anywhere in the ingredient list
    Effect: −10 points (flat, not percentage)
    Flag: 'taurine_missing'

  UGT1A6_WARNING:
    Condition: species = 'cat' AND any ingredient flagged for UGT1A6
    concern (propylene glycol, onion powder, garlic powder)
    Effect: flag ONLY — no score change
    Flag: 'ugt1a6_warning'
    Note: This is a UI advisory per D-095 clinical copy standards

Species rules NEVER share between dogs and cats (D-011).
All rules must be independently testable.
File: src/services/scoring/speciesRules.ts
Tests: __tests__/services/scoring/speciesRules.test.ts

Required tests:
- Dog grain-free with 4 legumes in top 7, no taurine, no l-carnitine
  → baseScore × 0.92 (−8%)
- Dog grain-free with 4 legumes in top 7, taurine + l-carnitine present
  → baseScore × 0.95 (−8% + 3% = net −5%)
- Dog grain-free with only 2 legumes in top 7 → DCM does NOT fire
- Dog NOT grain-free (is_grain_free = false) → DCM does NOT fire
  regardless of legume count
- Cat with 3 cat_carb_flag ingredients in positions 1, 3, 5
  → baseScore × 0.85 (−15%)
- Cat with no taurine in ingredient list → −10 points + 'taurine_missing'
  flag
- Cat with only 2 cat_carb_flag ingredients in top 5 → carb penalty
  does NOT fire
- UGT1A6 rule fires for propylene glycol → flag present, score unchanged
- Dog product → no cat rules fire (species isolation per D-011)
- Cat product → no dog rules fire (species isolation per D-011)
```

---

### Prompt 8 — Layer 3: Personalization

```
Now Layer 3.

Read DECISIONS.md before implementing:
- D-097 (health conditions + allergen profile — conditions feed Layer 3)
- D-098 (cross-reactivity expansion — allergen_group field)
- D-094 (suitability framing — every personalization must include pet name)
- D-095 (UPVM — no prescriptive language in any label)

Layer 3 is optional — only runs when petProfile is provided.
If petProfile is null or undefined, return the score unchanged with
empty personalizations array.

Deliverable:
src/services/scoring/personalization.ts

Function signature:
applyPersonalization(
  score: number,
  product: Product,
  ingredients: ProductIngredient[],
  petProfile: PetProfile | null
) => PersonalizationResult

Output type:
{
  finalScore: number
  personalizations: PersonalizationDetail[]
}

Where PersonalizationDetail:
{
  type: 'allergen' | 'life_stage' | 'breed' | 'condition'
  label: string          // waterfall label — MUST follow D-094 framing
  adjustment: number     // can be 0 for flags that don't affect score
  petName: string        // always included — D-094 requires pet name context
  severity?: 'direct_match' | 'possible_match'  // allergens only
}

Four checks:

1. Allergen Cross-Reference (D-097 + D-098)
   - Check each ingredient's allergen_group against petProfile.allergens
   - Direct match (allergen_group === pet's allergen): add to
     personalizations with severity 'direct_match'
   - Check each ingredient's allergen_group_possible — if any entry
     matches pet's allergen: add with severity 'possible_match'
   - Both are UI warning cards, NOT score penalties (D-097 scoring
     integration note: "Allergen matches are UI warning cards, not
     score penalties")
   - adjustment: 0 for all allergen personalizations
   - type: 'allergen'
   - Label format: "Contains [ingredient] — [allergen] is a known
     allergen for [Pet Name]" (direct match)
   - Label format: "Contains [ingredient] — may include [allergen].
     Verify with manufacturer." (possible match)
   - D-094 compliant, D-095 compliant (no "avoid this product")

2. Life Stage Matching
   - If product.life_stage_claim exists AND does not cover
     petProfile.life_stage:
     → −10 points
   - Example: product says 'Adult Maintenance', pet life_stage = 'puppy'
     → −10
   - 'All Life Stages' covers everything — never penalize
   - If no life_stage_claim on product: no penalty (benefit of the doubt)
   - Label: "[Pet Name]'s Life Stage Compatibility"

3. Breed-Specific Modifiers
   - Accept breedModifierResult from src/content/breedModifiers/ lookup
   - For M1: if no breed modifier data available, return adjustment: 0
   - When available (M2+): apply modifier, cap at ±10 total
     (NUTRITIONAL_PROFILE_BUCKET_SPEC §6c)
   - Register 'no_modifier' breeds explicitly to prevent false penalties
   - Label: "[Pet Name]'s Breed & Age Adjustments" (exact D-094
     waterfall label)

4. Health Conditions (D-097)
   - Conditions from petProfile.conditions
   - For M1: implement the framework, flag conditions present, but
     return adjustment: 0 for all condition personalizations
   - Full condition scoring multipliers (e.g. ckd increases phosphorus
     sensitivity, pancreatitis increases fat sensitivity) come in M2
   - Label: "[Pet Name]'s Health Profile"

Floor: finalScore cannot go below 0 after all adjustments.

Compliance checkpoints:
- D-094: Every PersonalizationDetail MUST include petName
- D-095: Grep all label strings — no "prescribe/treat/cure/prevent/
  diagnose" anywhere
- D-019: No brand references anywhere

File: src/services/scoring/personalization.ts
Tests: __tests__/services/scoring/personalization.test.ts

Required tests:
- petProfile = null → score unchanged, personalizations = []
- Pet with chicken allergen, ingredient has allergen_group = 'chicken'
  (e.g. chicken meal) → allergen flag, severity 'direct_match',
  adjustment 0, score unchanged
- Pet with chicken allergen, ingredient has allergen_group_possible
  = ['chicken', 'turkey'] (e.g. poultry fat) → allergen flag,
  severity 'possible_match', adjustment 0, score unchanged
- Puppy pet, product with life_stage_claim = 'Adult Maintenance'
  → −10 points
- Puppy pet, product with life_stage_claim = 'All Life Stages'
  → no penalty
- Product with null life_stage_claim → no penalty
- Breed with no modifier data → adjustment: 0, no error thrown
- Every PersonalizationDetail in output has petName set (loop check)
- No label string contains UPVM prohibited terms (grep check)
```

---

### ⚠️ SECOND COMPACT MOMENT

After Layer 3 you're deep. Probably 70%+ context. The orchestrator still needs to be built and must be consistent with all four layer functions plus the type definitions. This is another `/compact` moment.

```
/compact
```

Then orient:

```
Context compacted. Confirm the five function signatures in memory:

- src/types/scoring.ts: ProductIngredient type includes allergen_group
  and allergen_group_possible
- ingredientQuality.ts: scoreIngredients(ingredients, species)
  → IngredientScoreResult
- nutritionalProfile.ts: scoreNutritionalProfile(product, species,
  lifeStage, breedSize?, petConditions?) → NutritionScoreResult
- formulationScore.ts: scoreFormulation(product, ingredients?)
  → FormulationScoreResult
- speciesRules.ts: applySpeciesRules(product, species, ingredients,
  baseScore) → SpeciesRuleResult
- personalization.ts: applyPersonalization(score, product, ingredients,
  petProfile) → PersonalizationResult

All in src/services/scoring/.
Confirm before I continue.
```

---

### Prompt 9 — Orchestrator

```
All five layer functions built. Now wire them into the orchestrator.

Read DECISIONS.md:
- D-010 (category-adaptive weights: 55/30/15 daily food, 100/0/0 treats)
- D-016 (DMB must run BEFORE nutritionalProfile — orchestrator enforces order)
- D-017 (missing GA fallback: reweight to ~78/22 if GA missing)
- D-104 (carb estimation display — orchestrator includes estimated carbs
  in output for UI, but they do NOT re-enter scoring per D-104)
- D-094 (output must include petName for all score display)
- D-106 (pass pet conditions to nutritionalProfile for fiber suppression)

Deliverable:
src/services/scoring/engine.ts

Function signature:
computeScore(
  product: Product,
  ingredients: ProductIngredient[],
  petProfile?: PetProfile
) => ScoredResult

Output type ScoredResult:
{
  // Core score
  finalScore: number              // 0-100, clamped
  displayScore: number            // same as finalScore — for D-094
                                  // "[X]% match" rendering
  petName: string | null          // null if no petProfile

  // Layer breakdowns (for waterfall UI per D-094)
  layer1: {
    ingredientQuality: number     // ingredientQuality.ts output
    nutritionalProfile: number    // nutritionalProfile.ts bucket output
                                  // (0 if treat or missing GA)
    formulation: number           // formulationScore.ts output (0 if treat)
    weightedComposite: number     // after 55/30/15 or 100/0/0 or 78/22
  }
  layer2: {
    speciesAdjustment: number     // net adjustment from speciesRules.ts
    appliedRules: AppliedRule[]   // from speciesRules.ts output
  }
  layer3: {
    personalizations: PersonalizationDetail[]  // from personalization.ts
    allergenWarnings: PersonalizationDetail[]   // filtered for UI prominence
  }

  // Flags for UI (merged from all layers)
  flags: string[]

  // Data quality signals
  isPartialScore: boolean         // true if GA missing, reweighted per D-017
  isRecalled: boolean             // product.is_recalled boolean
  llmExtracted: boolean           // for UI disclaimer per D-043

  // Carb estimation (D-104 — display only, does NOT re-enter scoring)
  carbEstimate: {
    valueDmb: number | null
    confidence: 'exact' | 'estimated' | 'unknown'
    qualitativeLabel: string | null  // 'Low'|'Moderate'|'High' species-specific
    species: 'dog' | 'cat'
  } | null

  // Category
  category: 'daily_food' | 'treat'
}

Orchestration sequence — follow this exact order:

1.  Determine category from product.category
      'daily_food' → daily weights
      'treat' → treat weights

2.  Run scoreIngredients(ingredients, species) → always runs

3.  If daily food AND GA data available (protein, fat, fiber not all null):
      Extract petConditions from petProfile?.conditions for D-106
      Run scoreNutritionalProfile(product, species, lifeStage,
        breedSize, petConditions) → bucketScore

4.  If daily food AND GA all missing:
      Set bucketScore to null
      Mark isPartialScore = true

5.  Run scoreFormulation(product, ingredients) → for daily food only,
      output 0 for treats

6.  Apply category-adaptive weights per D-010:
      Daily (full GA):   (IQ × 0.55) + (NP × 0.30) + (FC × 0.15)
      Daily (no GA):     (IQ × 0.7857) + (FC × 0.2143)
                         (normalized from 55/(55+15) and 15/(55+15))
      Treat:             IQ × 1.00

7.  Run applySpeciesRules(product, species, ingredients,
      weightedComposite) → percentage adjustments on composite

8.  Run applyPersonalization(adjustedScore, product, ingredients,
      petProfile) → only if petProfile provided

9.  Calculate carb estimate for D-104 display output:
      - Use DMB values if available
      - Apply species-specific qualitative thresholds from D-104
      - This runs independently and does NOT modify finalScore

10. Clamp finalScore to [0, 100]

11. Set isRecalled from product.is_recalled

12. Merge flags from all layers into single array (deduplicated)

13. Filter allergen warnings from personalizations for UI prominence

14. Assemble full ScoredResult

Affiliate isolation (D-020):
  computeScore must NEVER import, reference, or receive affiliate_links.
  Add a lint-visible comment above the function:
  // D-020: affiliate_links is architecturally excluded from scoring.

Brand-blind (D-019):
  No reference to product.brand anywhere in this file.

File: src/services/scoring/engine.ts
Tests: __tests__/services/scoring/engine.test.ts

Regression tests — these must pass:

Test 1: Pure Balance Grain-Free Salmon & Pea (Dog, default pet profile)
  Inputs:
    category: 'daily_food'
    species: 'dog'
    is_grain_free: true
    4+ legumes in top 7 (is_legume = true)
    2 unnamed species ingredients (is_unnamed_species = true)
    taurine present, l_carnitine present
    GA: protein 26%, fat 16%, fiber 4%, moisture 10%
  Expected:
    Layer 1a (IQ): 62.8 (after severity penalties + unnamed −2)
    Layer 1b (NP): 85
    Layer 1c (FC): 88
    Weighted composite: (62.8×0.55)+(85×0.30)+(88×0.15) = 34.54+25.5+13.2 = 73.24 → 73.2
    Layer 2 DCM: −round(73.2×0.08) = −6 → 67.2
    Layer 2 Mitigation: +round(73.2×0.03) = +2 → 69.2
    Layer 3: neutral
    Final: 69 (rounded)

Test 2: Temptations Classic Tuna (Cat Treat, default pet profile)
  Inputs:
    category: 'treat'
    species: 'cat'
    cat_carb_flag ingredients in top 5 (enough to trigger D-014)
  Expected:
    Layer 1a (IQ): treats use 100% IQ weighting
    Layer 2: cat carb penalty fires (−15% of IQ score)
    Layer 3: neutral
    Final: verify the math produces the score, show full breakdown

Show me both test outputs with full breakdown before declaring success.
Debug against DECISIONS.md §11 reference scores if Test 1 doesn't
produce 69.
```

---

### Prompt 10 — Compliance Audit

```
Scoring engine is complete. Before we close Session 2, run a compliance
audit across all scoring files.

Check every file in src/services/scoring/ for the following:

D-012 Unnamed species penalty:
  Confirm the penalty is exactly −2 per occurrence. Not −1, not −3.
  Show the line of code.

D-015 Ingredient splitting:
  Confirm 'ingredient_splitting_detected' is added to flags array.
  Confirm NO score penalty exists anywhere for splitting.
  Grep for 'cluster_id' — it should appear in ingredientQuality.ts
  for flag detection only.

D-018 Position reduction:
  Confirm position_reduction_eligible is checked BEFORE any position
  discount is applied. Show the conditional logic. This is the most
  common implementation bug — position reduction applied universally
  instead of checking the flag first.

D-019 Brand-blind:
  Grep for any reference to product.brand, brand name strings, or
  brand comparisons across all scoring files. Must be zero results.

D-020 Affiliate isolation:
  Grep for any import or reference to affiliate_links across all
  scoring files. Must be zero results.

D-094 Score framing:
  Confirm ScoredResult type includes petName and displayScore.
  Confirm displayScore is documented for "[X]% match for [Pet Name]"
  rendering.

D-095 UPVM compliance:
  Grep ALL string literals in scoring files for:
  'prescribe', 'treat', 'cure', 'prevent', 'diagnose',
  'toxic nightmare', 'avoid', 'terrible', 'cheap', 'filler'
  Must be zero results. Note: 'treat' as in 'cat treat' product
  category is fine — grep for 'treat' in the context of prohibited
  medical language only.

D-106 Fiber suppression:
  Confirm nutritionalProfile.ts accepts petConditions parameter.
  Confirm fiber penalty is reduced 50% when conditions includes
  'obesity' OR when AAFCO statement contains weight management terms.

After audit, report:
- Any violations found and the fix applied
- Confirmation of zero violations for each D-number checked
- Exact grep commands used for verification
```

---

### Prompt 11 — Document Before Clear

```
Scoring engine complete and audit-clean. Document before we close.

Write session2-progress.md to project root:

## Files Created
List each file in src/services/scoring/ and src/types/scoring.ts
with its function signature (full signature, not just the name)

## ScoredResult Type
Paste the full ScoredResult interface exactly as implemented

## Regression Test Results
Show actual vs expected for both reference products:
- Pure Balance Grain-Free Salmon: expected 69, actual [X]
- Temptations Classic Tuna: expected [X], actual [X]
Include full score breakdown for each showing every layer's contribution

## Compliance Audit Results
For each D-number audited, report pass/fail:
- D-012: [result]
- D-015: [result]
- D-018: [result]
- D-019: [result]
- D-020: [result]
- D-094: [result]
- D-095: [result]
- D-106: [result]

## Test Coverage
List every test file, count of tests, all passing

## Decisions Applied
Every D-number referenced in this session with confirmation
implementation matches spec

## Open Items / Deviations
Any place implementation deviated from DECISIONS.md or
NUTRITIONAL_PROFILE_BUCKET_SPEC.md — note D-number and what changed

## Session 3 Pickup
"Session 3 builds the Result Screen UI. It renders ScoredResult
output from src/services/scoring/engine.ts.

Key references:
- D-094: Score framing — '[X]% match for [Pet Name]', pet name and
  photo always visible, waterfall labels
- D-037: 6-step loading terminal sequence
- D-086: Colors — #1A1A1A background, #242424 cards
- D-084: SF Symbols — zero emoji anywhere
- D-107: Concern tags — 5 tags, max 3 above fold, SF Symbols not
  emoji (D-111), informational only. Heart Risk tag now has 8 members
  (added Potatoes, Sweet Potatoes, Potato Starch) and is gated to
  D-013 rule (renders only when 3+ legume/potato in top 7, NOT on
  simple presence)
- D-108: Single scrollable screen, progressive disclosure, above/below
  fold structure
- D-105: Ingredient detail modal — singleton pattern (D-030), severity
  badges, TL;DR + clinical body + citations

ScoredResult type is in src/types/scoring.ts.
Full type definition is in session2-progress.md."
```

Verify document accuracy. Then:

```
/clear
```

Commit to git. Session 2 is boxed.

---

## Session Map — Quick Reference

| Point | Command | Reason |
|-------|---------|--------|
| Session 1 start | — | CLAUDE.md loads automatically |
| End Session 1 (camera done) | `/clear` | Camera ≠ scoring domain |
| Session 2 start | Load session1-progress.md | Fresh context + continuity |
| After Layer 1b verified | `/compact` | Same domain, preserve signatures, cut debug chatter |
| After Layer 3 done | `/compact` | Need all signatures for orchestrator, cut layer details |
| End Session 2 (scoring done) | `/clear` | Logic layer ≠ UI layer |
| Session 3 start | Load session2-progress.md | Fresh context + ScoredResult type |

---

## Decision Reference — Which Prompts Use Which D-Numbers

| D-Number | Topic | Used In |
|----------|-------|---------|
| D-010 | Category-adaptive weights (55/30/15) | S2-P1, S2-P6, S2-P9 |
| D-011 | Three-layer architecture | S2-P1, S2-P7 |
| D-012 | Unnamed species penalty (−2) | S2-P1, S2-P2, S2-P10 |
| D-013 | DCM advisory (dogs) | S2-P7 |
| D-014 | Cat carb overload (−15%) | S2-P7 |
| D-015 | Ingredient splitting (flag only) | S2-P1, S2-P2, S2-P3, S2-P10 |
| D-016 | DMB conversion | S2-P1, S2-P4, S2-P9 |
| D-017 | Missing GA fallback (78/22) | S2-P1, S2-P4, S2-P6, S2-P9 |
| D-018 | Position-weighted scoring | S2-P1, S2-P2, S2-P10 |
| D-019 | Brand-blind | S2-P1, S2-P8, S2-P9, S2-P10 |
| D-020 | Affiliate isolation | S2-P1, S2-P9, S2-P10 |
| D-040 | UPC junction table | S1-P1 |
| D-084 | Zero emoji / SF Symbols | S1-P1 |
| D-085 | Tab bar structure | S1-P1 |
| D-086 | Color scheme | S1-P1 |
| D-091 | Database miss handling | S1-P1 |
| D-092 | Onboarding (scan-first, locked) | S1-P1 |
| D-094 | Suitability framing | S2-P8, S2-P9, S2-P10 |
| D-095 | UPVM compliance | S2-P8, S2-P10 |
| D-097 | Health conditions / allergens | S2-P8 |
| D-098 | Cross-reactivity expansion | S2-P1, S2-P8 |
| D-104 | Carb estimation display | S2-P9 |
| D-106 | Weight/fiber suppression | S2-P4, S2-P9, S2-P10 |
| D-107 | Concern tags | Session 3 |
| D-108 | Scan result layout | Session 3 |
| D-109 | Breed modifiers as static JSON | S2-P8 |
| D-111 | SF Symbols for concern tags | Session 3 |

---

## Notes for Steven

**Before running any prompt:**
1. Verify M0 is actually complete (schema migrated, navigation shell working, types defined)
2. Update CLAUDE.md current phase to M1
3. Have at least one test product seeded in Supabase (products + product_upcs + product_ingredients rows) so the camera → lookup pipeline has something to find

**During Session 2:**
- The Layer 1b plan review is your most important quality gate. If Claude flattens the trapezoidal curves (e.g., turns them into if/else tiers instead of linear interpolation between boundaries), catch it in the plan before execution
- The 93/100 regression test (Prompt 5) is your second gate. Don't proceed until it passes with the correct sub-score breakdown
- If context runs higher than expected after Layer 1b (check with Claude or note response quality degrading), compact earlier

**After Session 2:**
- Session 3 (Result Screen UI) is not included here yet. It needs the same level of structure — D-094 framing, D-107 concern tags with D-111 SF Symbols, D-108 progressive disclosure, D-105 ingredient modals, D-030 singleton pattern, D-037 loading terminal, D-086 colors. If you want me to draft Session 3 prompts, say the word.

**The Temptations reference score:**
- The original mock used base 52, cat carb penalty −8, final 44. The actual scoring engine may produce a slightly different number depending on exact ingredient severity assignments and whether −15% (percentage per D-014) lands differently than the original flat −8 mock. The Pure Balance test at 69 is the more important regression gate because it exercises all three layers plus DCM math.
