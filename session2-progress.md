# Session 2 Progress — M1 Scoring Engine Complete

**Date:** February 27, 2026
**Commits:** `121f605`, `28c603e`
**Tests:** 126 passing, 7 suites, zero failures

---

## What Was Built

All five scoring layer functions + orchestrator. The M1 scoring engine is complete.

### Layer 1c — Formulation Completeness (15% weight)
**File:** `src/services/scoring/formulationScore.ts`
**Tests:** `__tests__/services/scoring/formulationScore.test.ts` (21 tests)

Three sub-checks weighted 50/25/25:
- **AAFCO Statement (50%):** "All Life Stages" → 100, "Growth/Reproduction" → 100, "Adult/Maintenance" → 90, missing → 30, unrecognized → 50 + flag
- **Preservative Quality (25%):** natural → 100, mixed → 65, synthetic → 25, unknown/null → 45 + flag
- **Protein Naming (25%):** Filters `is_protein_fat_source` ingredients, computes unnamed ratio → `Math.round(100 * (1 - ratio))`. Default 50 if no ingredient data.

### Layer 2 — Species Rules
**File:** `src/services/scoring/speciesRules.ts`
**Tests:** `__tests__/services/scoring/speciesRules.test.ts` (19 tests)

Dog rules:
- DCM Advisory: −8% of baseScore when grain-free + 3+ legumes in top 7
- Taurine + L-Carnitine Mitigation: +3% of baseScore, only fires if DCM fired

Cat rules:
- Carb Overload: −15% of baseScore when 3+ cat_carb_flag in positions 1-5
- Taurine Missing: −10 flat if no taurine ingredient detected
- UGT1A6 Warning: flag only, zero score impact

### Layer 3 — Personalization
**File:** `src/services/scoring/personalization.ts`
**Tests:** `__tests__/services/scoring/personalization.test.ts` (19 tests)

- **Allergen cross-reference (D-097 + D-098):** Direct match on `allergen_group`, possible match on `allergen_group_possible`. Both are UI flags only (adjustment: 0).
- **Life stage matching:** −10 flat if product claim doesn't cover pet's life stage. "All Life Stages" covers everything. Growth claims cover adults.
- **Breed modifiers:** M1 stub (adjustment: 0, framework in place for M2)
- **Health conditions:** M1 stub (flags presence, adjustment: 0)

### Orchestrator
**File:** `src/services/scoring/engine.ts`
**Tests:** `__tests__/services/scoring/engine.test.ts` (20 tests)

`computeScore(product, ingredients, petProfile?, petAllergens?, petConditions?) → ScoredResult`

Orchestration sequence:
1. Determine category → daily food or treat
2. Run Layer 1a (ingredient quality) — always
3. Run Layer 1b (nutritional profile) — daily food with GA data only
4. Run Layer 1c (formulation) — daily food only
5. Apply category-adaptive weights (D-010): 55/30/15 or 100/0/0 or 78/22
6. Run Layer 2 (species rules) on weighted composite
7. Run Layer 3 (personalization) if petProfile provided
8. Calculate carb estimate (D-104 display only — does NOT modify score)
9. Clamp [0, 100], merge flags, filter allergen warnings

### Types Updated
**File:** `src/types/scoring.ts`

- `ScoredResult` — full orchestrator output contract (finalScore, displayScore, petName, layer breakdowns, flags, carbEstimate, category)
- `CarbEstimate` — D-104 display type (valueDmb, confidence, qualitativeLabel, species)
- `PersonalizationDetail.type` — added `'breed_contraindication'` for D-112 (M2 logic, type in place now)
- `ProductIngredient` — added `is_protein_fat_source: boolean` for protein naming denominator

---

## Compliance Audit (Post-Build)

| Decision | Status | Detail |
|----------|--------|--------|
| D-012 Unnamed species | PASS | Exactly −2 per occurrence, position-independent |
| D-015 Ingredient splitting | PASS | Flag only via cluster_id, zero score penalty |
| D-018 Position reduction | PASS | `position_reduction_eligible` checked before discount |
| D-019 Brand-blind | PASS | Zero references to `.brand` in scoring files |
| D-020 Affiliate isolation | PASS | Zero imports/references to `affiliate_links` |
| D-094 Score framing | PASS | `displayScore` + `petName` in ScoredResult |
| D-095 UPVM compliance | FIXED | "prevents" → "supports" in senior cat modifier reason |
| D-106 Fiber suppression | PASS | petConditions passed through; obesity OR weight management triggers 50% suppression |

---

## Regression Breakdowns

### Pure Balance Grain-Free Salmon & Pea (Dog)
```
IQ:  76.8   (canola oil −8, animal fat −5.6 + unnamed −2, animal digest −5.6 + unnamed −2)
NP:  85     (protein 28.89% DMB, fat 17.78% DMB)
FC:  90     (AAFCO 100, preservative 100, naming 60)
Weighted: 81.2  = (76.8 × 0.55) + (85 × 0.30) + (90 × 0.15)
DCM: −6    (−8% of 81.2 = −6.5 → rounded −6)
Mitigation: +2  (+3% of 81.2 = +2.4 → rounded +2)
L3: 0      (neutral adult dog)
Final: 77
```

### Temptations Classic Tuna (Cat Treat)
```
IQ:  23.5   (4 caution + 2 unnamed + 3 danger at full penalty)
Weighted: 23.5  (100% IQ for treats)
Carb overload: did not fire (only 2 cat_carb_flag in top 5)
Taurine missing: −10
Final: 14
```

Note: Original estimates (66 and 44) used different ingredient compositions. The math traces correctly through all layers with the actual test ingredients built here.

---

## File Inventory

| File | Action | Tests |
|------|--------|------:|
| `src/types/scoring.ts` | Updated | — |
| `src/services/scoring/formulationScore.ts` | Created | 21 |
| `src/services/scoring/speciesRules.ts` | Created | 19 |
| `src/services/scoring/personalization.ts` | Created | 19 |
| `src/services/scoring/engine.ts` | Created | 20 |
| `src/services/scoring/nutritionalProfile.ts` | Patched (D-095) | 28 |
| `src/services/scoring/ingredientQuality.ts` | Patched (is_protein_fat_source) | 18 |
| `__tests__/services/scoring/regressionTrace.test.ts` | Unchanged | 1 |

**Total: 126 tests, 7 suites, all passing.**

---

## What's Next (Not Started)

- Scoring orchestrator is wired but not yet called from scan flow
- Breed modifier data (`src/content/breedModifiers/`) not yet created — M2
- D-112 breed contraindications — type in place, logic is M2
- Health condition scoring multipliers — M2 (M1 stubs flag only)
- Scan → Result screen integration — needs orchestrator call site
