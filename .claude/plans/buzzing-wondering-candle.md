# Plan: Layer 1c — Formulation Completeness Scoring

## Context

Layers 1a (55%) and 1b (30%) complete with 47 passing tests. Layer 1c implements the 15% Formulation Completeness bucket per D-010. Pure function, no Supabase, no brand awareness.

D-010: Daily food = 55/30/15. Treats = 100/0/0.
D-017: Missing GA fallback reweights to ~78% IQ / 22% FC (handled by orchestrator, not this function).

---

## Changes

### 1. `src/types/scoring.ts` — Fill `FormulationScoreResult`

Replace empty stub at line 75:

```ts
export interface FormulationScoreResult {
  formulationScore: number;      // 0-100 weighted composite
  breakdown: {
    aafcoScore: number;          // 0-100
    preservativeScore: number;   // 0-100
    proteinNamingScore: number;  // 0-100
  };
  flags: string[];
}
```

### 2. `src/services/scoring/formulationScore.ts` — Create

**Signature:**
```ts
import type { Product } from '../../types';
import type { ProductIngredient, FormulationScoreResult } from '../../types/scoring';

export function scoreFormulation(
  product: Product,
  ingredients?: ProductIngredient[],
): FormulationScoreResult
```

**Sub-layer weights:** AAFCO 50% / Preservative 25% / Protein Naming 25%

#### AAFCO Statement (50%)

Case-insensitive substring matching on `product.aafco_statement`:

| Match | Score |
|-------|-------|
| Contains "all life stages" | 100 |
| Contains "growth" or "reproduction" | 100 |
| Contains "adult" or "maintenance" | 90 |
| `null` or empty string | 30 |
| Non-null but no match | 50 + flag `aafco_statement_unrecognized` |

Substring matching handles verbose real-world AAFCO text like "...provides complete and balanced nutrition for adult maintenance."

#### Preservative Quality (25%)

| `product.preservative_type` | Score |
|-----------------------------|-------|
| `'natural'` | 100 |
| `'mixed'` | 65 |
| `'unknown'` | 45 + flag `preservative_type_unknown` |
| `'synthetic'` | 25 |
| `null` | 45 + flag `preservative_type_unknown` |

#### Protein Naming Specificity (25%)

**Denominator problem:** The user wants ratio of unnamed protein/fat sources vs total protein/fat sources. `is_unnamed_species` identifies unnamed ones, but there's no field to identify *all* protein/fat source ingredients (named ones have `is_unnamed_species=false`, same as vitamins/minerals).

**Solution:** Add `is_protein_fat_source: boolean` to `ProductIngredient` in `src/types/scoring.ts`. This field already conceptually exists in the ingredients_dict design (it's the set of ingredients where `is_unnamed_species` *could* be true). Corresponding DB column can be added later; for now it's a type-level addition that the hydration layer will populate.

With this field:
- Denominator: `ingredients.filter(i => i.is_protein_fat_source).length`
- Numerator: `ingredients.filter(i => i.is_unnamed_species).length`
- `unnamedRatio = numerator / denominator`
- `score = Math.round(100 * (1 - unnamedRatio))`
- If no ingredients provided OR no protein/fat sources found: score 50 (neutral)

#### Composite

```ts
formulationScore = Math.round(
  aafcoScore * 0.50 + preservativeScore * 0.25 + proteinNamingScore * 0.25
);
```

### 3. `__tests__/services/scoring/formulationScore.test.ts` — Create

Uses `makeProduct()` helper with sensible defaults and `makeIngredient()` helper.

| Test | Expected |
|------|----------|
| Perfect: "all life stages" + natural + 0/5 unnamed | 100 |
| Worst: null AAFCO + synthetic + 3/3 unnamed | 21 (30×.5 + 25×.25 + 0×.25) |
| Adult maintenance AAFCO | aafcoScore=90 |
| Growth AAFCO | aafcoScore=100 |
| Unrecognized AAFCO text | aafcoScore=50, flag `aafco_statement_unrecognized` |
| Null AAFCO | aafcoScore=30 |
| Natural preservative | preservativeScore=100 |
| Mixed preservative | preservativeScore=65 |
| Unknown preservative | preservativeScore=45, flag present |
| Null preservative_type | preservativeScore=45, flag present |
| Synthetic preservative | preservativeScore=25 |
| No ingredients param | proteinNamingScore=50 |
| Empty ingredients array | proteinNamingScore=50 |
| 1 unnamed / 4 protein-fat sources | proteinNamingScore=75 |
| All named protein sources | proteinNamingScore=100 |
| Real-world verbose AAFCO text | aafcoScore=90 (substring) |
| Determinism | same input × 2 → identical |

## Files Touched

| File | Action |
|------|--------|
| `src/types/scoring.ts` | Edit — fill `FormulationScoreResult`, add `is_protein_fat_source` to `ProductIngredient` |
| `src/services/scoring/formulationScore.ts` | Create |
| `__tests__/services/scoring/formulationScore.test.ts` | Create |

## Verification

1. `npx tsc --noEmit` — zero type errors
2. `npm test` — all tests pass (1a + 1b + 1c)
3. Perfect formulation → 100, worst → 21
4. Flags fire for unknown preservative and unrecognized AAFCO
