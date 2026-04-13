# Dry Food = Cups Everywhere — Per-Feeding Unit Normalization

**Date:** 2026-04-13
**Milestone:** M9 (UI Polish & Search)
**Status:** DESIGN — approved, ready for implementation plan
**Supersedes:** none. Complements D-166 (weight unit auto-conversion + cups helper).
**Branch:** `m9-dry-food-cups` (feature branch per session workflow)
**Related deferred spec:** `docs/superpowers/specs/2026-04-12-pantry-unit-model-gap-DEFERRED.md` — this spec addresses Symptom 1 (dry-food "lbs" display) only. Symptom 2 (wet-as-base 0 servings) stays deferred.

---

## Problem

Three UI surfaces currently leak `lbs` or `units` into per-feeding display for dry food, even though per-feeding measurement for dry is universally cups:

| # | Surface | Observed (bug) | Expected |
|---|---------|----------------|----------|
| 1 | AddToPantrySheet AUTO panel | `0.18 units / day` | `X.X cups / day` |
| 2 | PantryCard BASE DIET + ROTATIONAL rows | `0 cups` (stale data) · `4.5 lbs left` (inventory, correct) | `X.X cups / day` per feeding; inventory stays in lbs |
| 3 | FedThisTodaySheet "Amount Fed" stepper | `1 lb` | `1 cup` / `1.5 cups` |

User ask (verbatim): "we should just force cups/serving sizes for dry food it makes it less friction … we just need to convert serving sizes into cups and then make the pantry respect the said cups servings."

## Root cause analysis

### Bug 1: `computeBehavioralServing` has no cup-fallback for dry food

`src/utils/pantryHelpers.ts:369-384`:

```ts
if (product.ga_kcal_per_cup && product.ga_kcal_per_cup > 0) {
  return { amount: finalKcal / product.ga_kcal_per_cup, unit: 'cups', basisKcal: finalKcal };
}
const cal = resolveCalories(product);
if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
  return { amount: finalKcal / cal.kcalPerUnit, unit: 'units', basisKcal: finalKcal };
}
```

If a dry product is missing `ga_kcal_per_cup` but has `ga_kcal_per_kg`, this falls through to `kcalPerUnit` → returns `'units'`. AddToPantrySheet writes `serving_size_unit: 'units'`. That's the AUTO panel's "0.18 units / day".

### Bug 2: `FedThisTodaySheet` reads bag inventory unit, not per-feeding unit

`src/components/pantry/FedThisTodaySheet.tsx:84`:

```ts
const unitLabel = pantryItem?.quantity_unit === 'units' ? 'cans/pouches' : pantryItem?.quantity_unit || 'units';
```

`pantryItem.quantity_unit` is the **bag inventory unit** (`'lbs' | 'oz' | 'kg' | 'g' | 'units'`). For a dry kibble bag, that's `'lbs'`. The sheet was built for wet rotational (cans/pouches) but `PantryCard.tsx:324` surfaces "Log feeding" on **any rotational item** including dry, so dry rotational lands here and shows "1 lb".

Kcal resolution (`FedThisTodaySheet.tsx:44`) is also hardcoded to `getWetFoodKcal(product)` — wrong source for dry products.

### Not a bug (stale data):

The "0 cups" BASE DIET row in the user's PantryScreen screenshot has `serving_size = 0` — stored before the fix, likely from a failed back-calc path or a rebalance that cleared the value. New additions after this fix land clean. Existing rows self-heal on next EditPantryItem save or `updateCalorieShares` invocation. No backfill migration in scope.

## Design

### Part 1 — Derive `cups` for dry food when `ga_kcal_per_cup` is missing

**File:** `src/utils/pantryHelpers.ts`

Add a reusable helper `resolveKcalPerCup(product)`:

```ts
const DRY_KIBBLE_KG_PER_CUP = 0.1134;
// Matches supabase/functions/auto-deplete/index.ts:45 and D-166's reference density.
// Precedent: auto-deplete cron already uses this for cups→kg conversion.

export function resolveKcalPerCup(product: Product): number | null {
  if (product.ga_kcal_per_cup && product.ga_kcal_per_cup > 0) {
    return product.ga_kcal_per_cup;
  }
  if (
    product.product_form === 'dry' &&
    product.ga_kcal_per_kg &&
    product.ga_kcal_per_kg > 0
  ) {
    return product.ga_kcal_per_kg * DRY_KIBBLE_KG_PER_CUP;
  }
  return null;
}
```

Update `computeBehavioralServing` (lines 369-384) to use it:

```ts
const kcalPerCup = resolveKcalPerCup(product);
if (kcalPerCup != null) {
  return { amount: finalKcal / kcalPerCup, unit: 'cups', basisKcal: finalKcal };
}

const cal = resolveCalories(product);
if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
  return { amount: finalKcal / cal.kcalPerUnit, unit: 'units', basisKcal: finalKcal };
}

const wetCal = getWetFoodKcal(product);
if (wetCal && wetCal.kcal > 0) {
  return { amount: finalKcal / wetCal.kcal, unit: 'units', basisKcal: finalKcal };
}

return null;
```

**Scope gate:** the dry fallback only fires when `product_form === 'dry'`. Freeze-dried, raw, dehydrated keep current behavior — can widen in a later pass if users hit the same issue. User's explicit ask was "dry food".

### Part 2 — FedThisTodaySheet reads per-feeding unit from assignment

**File:** `src/components/pantry/FedThisTodaySheet.tsx`

**2a. Props change** — add `assignment`:

```ts
import type { PantryItem, PantryPetAssignment } from '../../types/pantry';

interface FedThisTodaySheetProps {
  isVisible: boolean;
  petId: string | null;
  pantryItem: PantryItem | null;
  assignment: PantryPetAssignment | null;  // NEW
  product: Product | null;
  onDismiss: () => void;
  onSuccess: () => void;
}
```

**2b. Unit display logic** — prefer the pet's saved `serving_size_unit`, fall back by `product_form`. Extract as an **exported pure helper** (new named export from `FedThisTodaySheet.tsx` or a sibling file) so it's unit-testable in isolation:

```ts
export function resolveDisplayUnit(
  assignment: PantryPetAssignment | null,
  pantryItem: PantryItem | null,
  product: Product | null
): string {
  if (assignment?.serving_size_unit === 'cups') return 'cups';
  if (assignment?.serving_size_unit === 'scoops') return 'scoops';
  if (assignment?.serving_size_unit === 'units') {
    return pantryItem?.unit_label ?? 'cans/pouches';
  }
  // No assignment match: derive by form
  if (product?.product_form === 'dry') return 'cups';
  return pantryItem?.unit_label ?? 'cans/pouches';
}

// In the component:
const displayUnitPlural = useMemo(
  () => resolveDisplayUnit(assignment, pantryItem, product),
  [assignment, pantryItem, product]
);

// Singular form for qty === 1
const displayUnit = qty === 1 ? singularize(displayUnitPlural) : displayUnitPlural;
```

Replaces the existing inline `unitLabel` computation at line 84.

**`singularize` helper** — today the logic is inline regex at line 107: `unitLabel.replace(/s\/?pouches$/, '/pouch').replace(/s$/, '')`. Extract into a local `singularize(plural: string)` helper (handles `'cups' → 'cup'`, `'scoops' → 'scoop'`, `'cans/pouches' → 'can/pouch'`, `'pouches' → 'pouch'`).

**2c. Kcal resolution** — branch by resolved unit:

```ts
import { resolveKcalPerCup } from '../../utils/pantryHelpers';  // from Part 1

const kcalPerQuantity = useMemo(() => {
  if (!product) return 0;
  if (displayUnitPlural === 'cups' || displayUnitPlural === 'scoops') {
    return resolveKcalPerCup(product) ?? 0;
  }
  const wet = getWetFoodKcal(product);
  return wet?.kcal ?? 0;
}, [product, displayUnitPlural]);

const totalKcal = Math.round(kcalPerQuantity * qty);
```

**2d. Zero-kcal safety** — block submit if `totalKcal === 0`:

```ts
if (qty <= 0 || totalKcal <= 0) {
  scanWarning();
  setError('Cannot log — kcal data missing for this product.');
  return;
}
```

No silent zero-kcal rows. User-facing message clarifies why.

**2e. Service call unchanged**:

`logWetFeeding({ petId, pantryItemId, kcalFed: totalKcal, quantityFed: qty })` — the underlying `log_wet_feeding_atomic` RPC takes generic `p_kcal_fed` + `p_quantity_fed` parameters. Name is misleading but parameter-agnostic. Cosmetic rename to `log_feeding_atomic` is deferred.

### Part 3 — Caller: pass assignment into sheet

**File:** `src/screens/PantryScreen.tsx:711` (FedThisTodaySheet invocation)

```tsx
<FedThisTodaySheet
  isVisible={!!logFeedingItem}
  petId={activePet?.id ?? null}
  pantryItem={logFeedingItem}
  assignment={
    logFeedingItem?.assignments.find(a => a.pet_id === activePet?.id) ?? null
  }
  product={logFeedingItem?.product ?? null}
  onDismiss={() => setLogFeedingItem(null)}
  onSuccess={/* existing handler */}
/>
```

## Files touched

1. `src/utils/pantryHelpers.ts` — `DRY_KIBBLE_KG_PER_CUP` constant, `resolveKcalPerCup` helper (new exported), `computeBehavioralServing` updated to use it
2. `src/components/pantry/FedThisTodaySheet.tsx` — `assignment` prop, `resolveDisplayUnit` + unit routing, `kcalPerQuantity` branching, zero-kcal guard
3. `src/screens/PantryScreen.tsx` — pass `assignment` to `<FedThisTodaySheet>` (~3 lines)
4. `__tests__/utils/pantryHelpers.test.ts` — `resolveKcalPerCup` + updated `computeBehavioralServing` cases
5. `__tests__/components/FedThisTodaySheet.test.tsx` — unit-routing tests (or extract `resolveDisplayUnit` as pure helper and test that)

No migrations. No DECISIONS changes (D-166 stands; this augments the primary serving calc without touching D-166's helper-text display rule). No scoring-engine changes. Regression anchors unchanged.

## Tests

### `resolveKcalPerCup` (new, pure)
- Returns scraped `ga_kcal_per_cup` when present regardless of `product_form`
- Dry product without `ga_kcal_per_cup` but with `ga_kcal_per_kg = 4000` → returns `4000 × 0.1134 = 453.6`
- Wet product without `ga_kcal_per_cup` but with `ga_kcal_per_kg` → returns `null` (no dry fallback)
- Both fields missing → returns `null`
- `ga_kcal_per_kg = 0` → returns `null` (guards against division by zero downstream)

### `computeBehavioralServing` (updated)
- Dry product missing `ga_kcal_per_cup`, has `ga_kcal_per_kg` → returns `unit: 'cups'` (new behavior, regression vs existing 'units' test)
- Wet product missing `ga_kcal_per_cup`, has `kcal_per_unit` → still returns `unit: 'units'` (regression guard)
- Existing scenarios (Pure Balance dry with scraped cup, treats, rotational wet) — unchanged

### `resolveDisplayUnit` pure helper (exported from FedThisTodaySheet.tsx)
- `assignment.serving_size_unit = 'cups'` → `'cups'`
- `assignment.serving_size_unit = 'units'`, `pantryItem.unit_label = 'pouches'` → `'pouches'`
- `assignment.serving_size_unit = 'units'`, no unit_label → `'cans/pouches'`
- No assignment, `product.product_form = 'dry'` → `'cups'`
- No assignment, `product.product_form = 'wet'` → `'cans/pouches'` (default)

### Regression
- Run `__tests__/services/scoring/regressionTrace.test.ts` — Pure Balance = 61, Temptations = 0 must hold.

## Observable outcomes

- **Image 9 (AddToPantrySheet AUTO panel):** dry food with only `ga_kcal_per_kg` now reads `X.X cups / day` instead of `0.18 units / day`.
- **Image 10 (PantryCard rows):** new dry additions write `serving_size_unit: 'cups'`. Existing rows with stale `'units'` or `0` values auto-correct on next EditPantryItem save / `updateCalorieShares`. "X.X lbs left" inventory display unchanged (correct, out of scope).
- **Image 11 (FedThisTodaySheet):** dry rotational items show `X cups` in the stepper; kcal is derived from `resolveKcalPerCup`. Wet rotational unchanged.

## Explicitly out of scope

- **Stale pantry rows with `serving_size = 0`**: no migration. Self-heal on next save. Noted as a known side effect.
- **Remaining-inventory display (lbs → cups).** Bag is sold by weight; "4.5 lbs left" is correct inventory. Separate UX question if the user wants to revisit.
- **D-166 helper text display rule** ("only show when both kcal_per_kg AND kcal_per_cup present"). Not flagged; different code path (AddToPantrySheet helper text, not serving calc).
- **`log_wet_feeding_atomic` rename.** Cosmetic; RPC already takes generic params.
- **Freeze-dried / raw / dehydrated** per-feeding units. User's ask was "dry food". Revisit if users hit equivalent bugs on other forms.
- **Deferred-spec Symptom 2** (wet-as-base 0 servings). Entirely separate architectural gap; stays in the 2026-04-12 deferred spec.

## Related DECISIONS

- **D-166** — AddToPantrySheet weight unit auto-conversion + cups helper text. This spec augments the primary serving calc (`computeBehavioralServing`) without touching D-166's helper-text display rule. `0.1134 kg/cup` density is reused consistently with D-166's formula.
- **D-152** — weight-based vs unit-based serving modes. Dry stays weight-based (bag in lbs) with per-feeding in cups.
- **D-164** — unit label simplification. `serving_size_unit` schema remains `'cups' | 'scoops' | 'units'`.
- **D-165** — budget-aware serving recommendations. `computeBehavioralServing` is the downstream math; this fix makes its output consistent for dry food.

## Open questions (resolved)

- ~~Should FedThisTodaySheet appear at all for dry rotational?~~ → **Yes (Option A).** Keep the CTA, fix the stepper to show cups. Confirmed in brainstorm.

## Implementation order (suggested for plan)

1. `pantryHelpers.ts` — constant + `resolveKcalPerCup` + `computeBehavioralServing` update. Tests first (TDD).
2. Extract `resolveDisplayUnit` as an exported pure helper alongside `FedThisTodaySheet`. Tests.
3. `FedThisTodaySheet.tsx` — wire prop, replace unit/kcal logic, add zero-kcal guard.
4. `PantryScreen.tsx` — pass `assignment` prop.
5. Run full test suite + regression anchors.
6. On-device verification: scan → add dry food without `ga_kcal_per_cup`, observe cups in AddToPantry AUTO panel + PantryCard. Tap "Log feeding" on a dry rotational, confirm cups stepper.

## Not doing (for completeness)

- No new DECISIONS entry. The user's ask is consistent with D-166's density precedent; this is a gap-fill, not a new policy.
- No Edge Function changes. `auto-deplete/index.ts:45` already uses `0.1134`; we're making the client-side code consistent with it.
