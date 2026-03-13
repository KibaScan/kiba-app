# M4 Session 2 — D-129 Allergen Severity Override

## Commit
`bf0587b` — M4: Session 2 — D-129 allergen severity override, regression verified

## Files Modified

| File | Changes |
|------|---------|
| `src/services/scoring/personalization.ts` | Added `buildAllergenOverrideMap()` — maps ingredient canonical_name to escalated severity |
| `src/services/scoring/ingredientQuality.ts` | Accepts optional `allergenOverrideMap`, applies severity floor during IQ scoring |
| `src/services/scoring/engine.ts` | Dual-IQ scoring: computes IQ with and without allergen overrides, wires override map |
| `src/types/scoring.ts` | Added `allergenWarnings` to Layer 3, `IngredientSeverity` export |
| `src/components/ScoreWaterfall.tsx` | Updated to display allergen-specific deduction in Layer 3 row |
| `src/screens/ResultScreen.tsx` | Fetches `pet_allergens` + `pet_conditions` before scoring via `getPetAllergens`/`getPetConditions` |
| `src/services/scoring/pipeline.ts` | Updated `scoreProduct` signature to accept `petAllergens` and `petConditions` arrays |

## File Created

| File | Purpose |
|------|---------|
| `__tests__/scoring/allergenOverride.test.ts` | 18 tests covering D-129 allergen override mechanics |

## D-129 Mechanism: Allergen Severity Override

**Core concept:** When a pet has a known allergen, ingredients matching that allergen group get their severity escalated for that specific pet's score only. Base severities in `ingredients_dict` are never modified.

### `buildAllergenOverrideMap(petAllergens, ingredients)`

1. For each ingredient, checks `allergen_group` and `allergen_group_possible`
2. If `allergen_group` matches a pet allergen → `direct_match` → severity escalated to **danger**
3. If `allergen_group_possible` matches → `possible_match` → severity escalated to **caution**
4. Severity floor rule: never downgrades (a `danger` ingredient stays `danger`)

### Dual-IQ Scoring

The engine computes IQ twice:
- **Base IQ:** Standard severity-based scoring (no allergen awareness)
- **Allergen IQ:** Same scoring with overridden severities via `allergenOverrideMap`

The difference (`baseIQ - allergenIQ`) becomes the Layer 3 allergen deduction, keeping Layers 1-2 clean and independently testable.

### D-129 Amendment

- `direct_match` (allergen_group match): escalated to **danger** — these are confirmed allergens
- `possible_match` (allergen_group_possible match): escalated to **caution** — cross-reactivity risk

### Production Wiring

ResultScreen now calls `getPetAllergens(pet.id)` and `getPetConditions(pet.id)` before invoking `scoreProduct()`. Both are passed through to the engine.

## Allergen Delta Example

Nature's Logic Chicken (dog with chicken allergy):
- Without allergen override: **92/100**
- With chicken allergen override: **67/100** (−25 points from chicken ingredients escalated to danger)

## Tests
- **465 total tests passing** (447 existing + 18 new allergen override tests)
- Pure Balance Grain-Free Salmon & Pea (Dog): **69** — regression locked

## Session 3 Pickup
- AafcoProgressBars component (nutritional bucket transparency)
- BonusNutrientGrid component (supplemental nutrient indicators)
- Read-only UI — scoring engine LOCKED
