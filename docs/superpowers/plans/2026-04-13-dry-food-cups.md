# Dry Food = Cups Everywhere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize per-feeding unit to `cups` across AddToPantrySheet, PantryCard, and FedThisTodaySheet for dry food. Bag inventory stays in lbs; per-feeding is always cups.

**Architecture:** Two surgical fixes. (1) In `src/utils/pantryHelpers.ts`, extract a new `resolveDryKcalPerCup(product)` helper that returns `ga_kcal_per_cup` when present, else derives `ga_kcal_per_kg × 0.1134 kg/cup` for dry products (matches auto-deplete cron's precedent). Update `computeBehavioralServing` to prefer this, so new pantry additions write `serving_size_unit: 'cups'`. (2) In `src/components/pantry/FedThisTodaySheet.tsx`, stop reading the bag's `quantity_unit` (inventory unit, can be lbs) for the stepper label. Instead, read the pet's `serving_size_unit` from the assignment and fall back to `cups` for `product_form === 'dry'`. Branch kcal resolution by display unit.

**Tech Stack:** TypeScript 5.9 (strict), React Native 0.83, Expo SDK 55, Jest via jest-expo. No new deps.

**Spec:** `docs/superpowers/specs/2026-04-13-dry-food-cups-unit-fix-design.md` (branch `m9-dry-food-cups`, commit `70b6625`).

**Branch:** `m9-dry-food-cups` (already created, spec already committed).

**Regression anchors:** Pure Balance (Dog) = 61, Temptations (Cat) = 0 — must hold. Run `npx jest --testPathPattern=regressionTrace` after scoring-adjacent changes (this fix is not scoring-adjacent, but run as a cheap guard).

**Test totals before:** 1473 passing / 63 suites.

---

## File Structure (locked)

| File | Purpose | Action |
|------|---------|--------|
| `src/utils/pantryHelpers.ts` | Pure pantry math | Modify — add `DRY_KIBBLE_KG_PER_CUP` constant + `resolveDryKcalPerCup` helper; update `computeBehavioralServing` to use it |
| `src/components/pantry/FedThisTodaySheet.tsx` | Bottom sheet for manual feeding log | Modify — add `assignment` prop, export pure helpers `singularize` + `resolveDisplayUnit`, replace inline unit/kcal logic, add zero-kcal guard |
| `src/screens/PantryScreen.tsx` | Pantry list + sheet host | Modify — pass `assignment` prop into `<FedThisTodaySheet>` (~3 lines at line 711) |
| `__tests__/utils/pantryHelpers.test.ts` | Existing pure-helper tests | Modify — add `resolveDryKcalPerCup` describe block; extend `computeBehavioralServing` describe with 2 new cases |
| `__tests__/components/FedThisTodaySheet.test.ts` | New — pure helper tests for the sheet | Create — test `singularize` + `resolveDisplayUnit` |

**Helper location decision:** `singularize` and `resolveDisplayUnit` live **as named exports at the top of `src/components/pantry/FedThisTodaySheet.tsx`**. Precedent: `AddToPantrySheet.tsx` already does this pattern (see `isTreat`, `getDefaultFeedingsPerDay`, `isFormValid`, `buildAddToPantryInput` exported near the top of that file). Keeps the helpers co-located with the component they serve while remaining unit-testable.

---

## Task 1: Add `DRY_KIBBLE_KG_PER_CUP` constant and `resolveDryKcalPerCup` helper (TDD)

**Files:**
- Modify: `__tests__/utils/pantryHelpers.test.ts` (add tests for `resolveDryKcalPerCup`, add import)
- Modify: `src/utils/pantryHelpers.ts` (add constant + helper, export)

- [ ] **Step 1.1: Add `resolveDryKcalPerCup` to the import list in the test file**

Open `__tests__/utils/pantryHelpers.test.ts`. In the import block at lines 11-37, add `resolveDryKcalPerCup` alongside the other named imports:

```ts
import {
  calculateDaysRemaining,
  isLowStock,
  defaultServingMode,
  getSystemRecommendation,
  calculateDepletionBreakdown,
  getCalorieContext,
  computePetDer,
  computeExistingPantryKcal,
  computeAutoServingSize,
  computeBudgetWarning,
  getSmartDefaultFeedingsPerDay,
  getConditionFeedingsPerDay,
  getConditionFeedingAdvisory,
  parseProductSize,
  convertToKg,
  convertFromKg,
  convertWeightToCups,
  convertWeightToServings,
  pickBaseForSwap,
  getTodayBounds,
  getWetFoodKcal,
  computeBehavioralServing,
  computeBehavioralBudgetWarning,
  computePerServingKcal,
  shouldShowCalorieText,
  resolveDryKcalPerCup,
} from '../../src/utils/pantryHelpers';
```

- [ ] **Step 1.2: Write failing tests for `resolveDryKcalPerCup`**

Append this describe block to the end of `__tests__/utils/pantryHelpers.test.ts` (after the last existing describe block):

```ts
// ─── resolveDryKcalPerCup ──────────────────────────────────

describe('resolveDryKcalPerCup', () => {
  test('returns scraped ga_kcal_per_cup when present', () => {
    const product = makeProduct({ ga_kcal_per_cup: 420, ga_kcal_per_kg: 3500, product_form: 'dry' });
    expect(resolveDryKcalPerCup(product)).toBe(420);
  });

  test('returns scraped ga_kcal_per_cup even for non-dry products', () => {
    const product = makeProduct({ ga_kcal_per_cup: 180, ga_kcal_per_kg: 1200, product_form: 'wet' });
    expect(resolveDryKcalPerCup(product)).toBe(180);
  });

  test('derives from ga_kcal_per_kg × 0.1134 for dry product missing ga_kcal_per_cup', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: 4000, product_form: 'dry' });
    // 4000 × 0.1134 = 453.6
    expect(resolveDryKcalPerCup(product)).toBeCloseTo(453.6);
  });

  test('returns null for wet product missing ga_kcal_per_cup (no dry fallback)', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: 1200, product_form: 'wet' });
    expect(resolveDryKcalPerCup(product)).toBeNull();
  });

  test('returns null for freeze-dried product missing ga_kcal_per_cup (scope-gated to dry)', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: 4800, product_form: 'freeze-dried' });
    expect(resolveDryKcalPerCup(product)).toBeNull();
  });

  test('returns null when both ga_kcal_per_cup and ga_kcal_per_kg missing', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: null, product_form: 'dry' });
    expect(resolveDryKcalPerCup(product)).toBeNull();
  });

  test('returns null when ga_kcal_per_kg is 0 (guards against divide-by-zero downstream)', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: 0, product_form: 'dry' });
    expect(resolveDryKcalPerCup(product)).toBeNull();
  });
});
```

- [ ] **Step 1.3: Run the new tests and verify they fail**

Run:
```bash
npx jest --testPathPattern=pantryHelpers -t resolveDryKcalPerCup
```

Expected: **FAIL** with a message like `TypeError: resolveDryKcalPerCup is not a function` or import error `"resolveDryKcalPerCup" is not exported from "'../../src/utils/pantryHelpers'"`.

- [ ] **Step 1.4: Implement the constant and helper**

Open `src/utils/pantryHelpers.ts`. Just under the existing `convertFromKg` function (around line 45, before the `// ─── Weight Unit Preference ──────────────────────────────` section), add:

```ts
// ─── Density Constants ──────────────────────────────────

/**
 * Standard dry kibble density fallback: 1 cup ≈ 113.4 g.
 * Matches supabase/functions/auto-deplete/index.ts:45 and D-166's reference density.
 * Used only when a dry product has ga_kcal_per_kg but no scraped ga_kcal_per_cup.
 */
export const DRY_KIBBLE_KG_PER_CUP = 0.1134;

/**
 * Resolve kcal-per-cup for a product, preferring scraped label data.
 * For dry products missing ga_kcal_per_cup, derives from ga_kcal_per_kg × DRY_KIBBLE_KG_PER_CUP.
 * Returns null when no derivation is possible (wet/other forms without scraped cup, or no kcal data).
 */
export function resolveDryKcalPerCup(product: Product): number | null {
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

The `Product` type is already imported at line 18 (`import type { Product } from '../types';`). No new imports needed.

- [ ] **Step 1.5: Run the tests and verify they pass**

Run:
```bash
npx jest --testPathPattern=pantryHelpers -t resolveDryKcalPerCup
```

Expected: **PASS** — all 7 test cases green.

- [ ] **Step 1.6: Run the full pantryHelpers suite to verify no regressions**

Run:
```bash
npx jest --testPathPattern=pantryHelpers
```

Expected: all pre-existing tests still pass (should show +7 tests vs baseline).

- [ ] **Step 1.7: Commit**

```bash
git add src/utils/pantryHelpers.ts __tests__/utils/pantryHelpers.test.ts
git commit -m "$(cat <<'EOF'
M9: add resolveDryKcalPerCup helper with dry-food density fallback

Extracts kcal-per-cup resolution into a pure helper. For dry products
missing scraped ga_kcal_per_cup, derives from ga_kcal_per_kg × 0.1134
(matches supabase/functions/auto-deplete/index.ts:45 precedent).

Foundation for computeBehavioralServing cup-unit fallback.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update `computeBehavioralServing` to use `resolveDryKcalPerCup` (TDD)

**Files:**
- Modify: `__tests__/utils/pantryHelpers.test.ts` (extend existing `computeBehavioralServing` describe block)
- Modify: `src/utils/pantryHelpers.ts` (update `computeBehavioralServing` lines 369-384)

- [ ] **Step 2.1: Write two failing regression/expansion tests**

Append these two `test(...)` blocks inside the existing `describe('computeBehavioralServing', () => { ... })` block in `__tests__/utils/pantryHelpers.test.ts` (the block starts at line 953, add these just before its closing `})`):

```ts
  test('dry product missing ga_kcal_per_cup derives cups from ga_kcal_per_kg (new fallback)', () => {
    const pet = { ...defaultPet, feeding_style: 'dry_only' as const };
    const product = makeProduct({
      product_form: 'dry',
      ga_kcal_per_cup: null,
      ga_kcal_per_kg: 4000, // derived kcal/cup = 4000 × 0.1134 = 453.6
      kcal_per_unit: null,
    });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    // DER = 1018, derived kcal/cup = 453.6 → amount = 1018 / 453.6 ≈ 2.244
    expect(result?.unit).toBe('cups');
    expect(result?.amount).toBeCloseTo(1018 / 453.6);
    expect(result?.basisKcal).toBe(1018);
  });

  test('wet product missing ga_kcal_per_cup falls through to units (regression guard, no dry fallback)', () => {
    const pet = { ...defaultPet, feeding_style: 'wet_only' as const };
    const product = makeProduct({
      product_form: 'wet',
      ga_kcal_per_cup: null,
      ga_kcal_per_kg: 1200,
      kcal_per_unit: 100,
    });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'rotational', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    // DER = 1018, kcal_per_unit = 100 → amount = 10.18, unit = 'units'
    expect(result?.unit).toBe('units');
    expect(result?.amount).toBeCloseTo(1018 / 100);
  });
```

- [ ] **Step 2.2: Run the new tests and verify they fail**

Run:
```bash
npx jest --testPathPattern=pantryHelpers -t "computeBehavioralServing"
```

Expected: the two new tests **FAIL** with something like `Expected: "cups", Received: "units"` (the dry product currently falls through to `kcal_per_unit`/`null` path and returns `null` or `'units'`). The existing 7 `computeBehavioralServing` tests should still pass.

- [ ] **Step 2.3: Update `computeBehavioralServing` to use `resolveDryKcalPerCup`**

Open `src/utils/pantryHelpers.ts`. Find `computeBehavioralServing`. Locate the block at lines 369-384 (the "Convert to unit" section after `const finalKcal = budgetedKcal * (dryFoodSplitPct / 100);`):

```ts
  // Convert to unit
  if (product.ga_kcal_per_cup && product.ga_kcal_per_cup > 0) {
    return { amount: finalKcal / product.ga_kcal_per_cup, unit: 'cups', basisKcal: finalKcal };
  }

  const cal = resolveCalories(product);
  if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
    return { amount: finalKcal / cal.kcalPerUnit, unit: 'units', basisKcal: finalKcal };
  }

  // Final fallback to getWetFoodKcal for wet units
  const wetCal = getWetFoodKcal(product);
  if (wetCal && wetCal.kcal > 0) {
    return { amount: finalKcal / wetCal.kcal, unit: 'units', basisKcal: finalKcal };
  }

  return null;
}
```

Replace with:

```ts
  // Convert to unit — prefer cups (scraped, or derived for dry products)
  const kcalPerCup = resolveDryKcalPerCup(product);
  if (kcalPerCup != null) {
    return { amount: finalKcal / kcalPerCup, unit: 'cups', basisKcal: finalKcal };
  }

  const cal = resolveCalories(product);
  if (cal?.kcalPerUnit && cal.kcalPerUnit > 0) {
    return { amount: finalKcal / cal.kcalPerUnit, unit: 'units', basisKcal: finalKcal };
  }

  // Final fallback to getWetFoodKcal for wet units
  const wetCal = getWetFoodKcal(product);
  if (wetCal && wetCal.kcal > 0) {
    return { amount: finalKcal / wetCal.kcal, unit: 'units', basisKcal: finalKcal };
  }

  return null;
}
```

Only the first `if` block changed — inlined `ga_kcal_per_cup` check is replaced by the reusable helper. The units and wet-units fallbacks are untouched.

- [ ] **Step 2.4: Run the tests and verify they pass**

Run:
```bash
npx jest --testPathPattern=pantryHelpers -t "computeBehavioralServing"
```

Expected: **PASS** — both new tests green, all existing `computeBehavioralServing` tests still green (9 total in the describe block).

- [ ] **Step 2.5: Run the full pantryHelpers suite**

Run:
```bash
npx jest --testPathPattern=pantryHelpers
```

Expected: all tests in the file pass.

- [ ] **Step 2.6: Commit**

```bash
git add src/utils/pantryHelpers.ts __tests__/utils/pantryHelpers.test.ts
git commit -m "$(cat <<'EOF'
M9: computeBehavioralServing uses resolveDryKcalPerCup for dry-food cups

Dry products missing ga_kcal_per_cup now derive cups from ga_kcal_per_kg
× 0.1134 instead of falling through to kcal_per_unit and returning
'units'. Fixes AddToPantrySheet AUTO panel showing "X units/day" for
dry foods with only per-kg kcal data (Image 9 bug).

Wet and non-dry forms preserve existing behavior (regression guard
test added).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Extract and test `singularize` pure helper for FedThisTodaySheet (TDD)

**Files:**
- Create: `__tests__/components/FedThisTodaySheet.test.ts`
- Modify: `src/components/pantry/FedThisTodaySheet.tsx` (add export; do NOT yet wire into component body — that's Task 5)

- [ ] **Step 3.1: Create the new test file with failing `singularize` tests**

Create `__tests__/components/FedThisTodaySheet.test.ts` with:

```ts
// FedThisTodaySheet Pure Helpers — Unit tests for singularize + resolveDisplayUnit.
// Component-body rendering is not tested here; those helpers cover the logic the component wires in.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { singularize, resolveDisplayUnit } from '../../src/components/pantry/FedThisTodaySheet';
import type { PantryItem, PantryPetAssignment } from '../../src/types/pantry';
import type { Product } from '../../src/types';
import { Category, Species } from '../../src/types';

// ─── Factories (local, matching pantryHelpers.test.ts shape) ────────────

function makeAssignment(overrides: Partial<PantryPetAssignment> = {}): PantryPetAssignment {
  return {
    id: 'assign-1',
    pantry_item_id: 'item-1',
    pet_id: 'pet-1',
    serving_size: 1,
    serving_size_unit: 'cups',
    feedings_per_day: 2,
    feeding_frequency: 'daily',
    feeding_times: null,
    notifications_on: true,
    feeding_role: 'base',
    auto_deplete_enabled: false,
    calorie_share_pct: 100,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    brand: 'TestBrand',
    name: 'TestFood',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated',
    aafco_statement: null,
    aafco_inference: null,
    life_stage_claim: null,
    preservative_type: null,
    ga_protein_pct: 26,
    ga_fat_pct: 16,
    ga_fiber_pct: 4,
    ga_moisture_pct: 10,
    ga_calcium_pct: null,
    ga_phosphorus_pct: null,
    ga_kcal_per_cup: 400,
    ga_kcal_per_kg: 3500,
    kcal_per_unit: null,
    unit_weight_g: null,
    default_serving_format: null,
    ga_taurine_pct: null,
    ga_l_carnitine_mg: null,
    ga_dha_pct: null,
    ga_omega3_pct: null,
    ga_omega6_pct: null,
    ga_zinc_mg_kg: null,
    ga_probiotics_cfu: null,
    nutritional_data_source: null,
    ingredients_raw: null,
    ingredients_hash: null,
    image_url: null,
    product_form: 'dry',
    is_recalled: false,
    is_grain_free: false,
    is_supplemental: false,
    is_vet_diet: false,
    score_confidence: 'high',
    needs_review: false,
    base_score: null,
    base_score_computed_at: null,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    source_url: null,
    chewy_sku: null,
    asin: null,
    walmart_id: null,
    price: null,
    price_currency: null,
    product_size_kg: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity_original: 15,
    quantity_remaining: 15,
    quantity_unit: 'lbs',
    serving_mode: 'weight',
    unit_label: null,
    added_at: '2026-01-01T00:00:00Z',
    is_active: true,
    last_deducted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── singularize ────────────────────────────────────────

describe('singularize', () => {
  test('cups → cup', () => {
    expect(singularize('cups')).toBe('cup');
  });

  test('scoops → scoop', () => {
    expect(singularize('scoops')).toBe('scoop');
  });

  test('cans/pouches → can/pouch', () => {
    expect(singularize('cans/pouches')).toBe('can/pouch');
  });

  test('pouches → pouch', () => {
    expect(singularize('pouches')).toBe('pouch');
  });

  test('units → unit', () => {
    expect(singularize('units')).toBe('unit');
  });

  test('servings → serving', () => {
    expect(singularize('servings')).toBe('serving');
  });

  test('already singular → unchanged', () => {
    expect(singularize('cup')).toBe('cup');
    expect(singularize('can/pouch')).toBe('can/pouch');
  });
});
```

- [ ] **Step 3.2: Run the new test file and verify it fails on import**

Run:
```bash
npx jest --testPathPattern=FedThisTodaySheet
```

Expected: **FAIL** — the import of `{ singularize, resolveDisplayUnit }` from `FedThisTodaySheet` fails because they don't exist yet. (You'll see something like `"singularize" is not exported from "..."`.)

- [ ] **Step 3.3: Add `singularize` as a named export in `FedThisTodaySheet.tsx`**

Open `src/components/pantry/FedThisTodaySheet.tsx`. Just under the existing imports (after line 11 where `logWetFeeding` is imported), add:

```ts
// ─── Exported Pure Helpers ──────────────────────────────

/**
 * Convert a plural unit label to its singular form.
 * Handles special cases (cans/pouches → can/pouch) and trailing-s stripping.
 */
export function singularize(plural: string): string {
  if (plural === 'cans/pouches') return 'can/pouch';
  if (plural.endsWith('ches')) return plural.slice(0, -2); // pouches → pouch
  if (plural.endsWith('s')) return plural.slice(0, -1);
  return plural;
}
```

- [ ] **Step 3.4: Run the `singularize` tests and verify they pass**

Run:
```bash
npx jest --testPathPattern=FedThisTodaySheet -t singularize
```

Expected: **PASS** — all 7 test cases green. (`resolveDisplayUnit` tests will still fail until Task 4; that's expected.)

- [ ] **Step 3.5: Commit**

```bash
git add src/components/pantry/FedThisTodaySheet.tsx __tests__/components/FedThisTodaySheet.test.ts
git commit -m "$(cat <<'EOF'
M9: extract singularize pure helper from FedThisTodaySheet

Exports singularize(plural) from FedThisTodaySheet.tsx for unit testing.
Handles cans/pouches, pouches, and trailing-s stripping. Replaces the
inline regex at line 107 in a later task (Task 5).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extract and test `resolveDisplayUnit` pure helper (TDD)

**Files:**
- Modify: `__tests__/components/FedThisTodaySheet.test.ts` (append describe block)
- Modify: `src/components/pantry/FedThisTodaySheet.tsx` (add export; not yet wired)

- [ ] **Step 4.1: Append failing `resolveDisplayUnit` tests to the test file**

Append to `__tests__/components/FedThisTodaySheet.test.ts` (after the `singularize` describe):

```ts
// ─── resolveDisplayUnit ─────────────────────────────────

describe('resolveDisplayUnit', () => {
  test('assignment.serving_size_unit = cups → cups', () => {
    const assignment = makeAssignment({ serving_size_unit: 'cups' });
    const item = makePantryItem({ quantity_unit: 'lbs' });
    const product = makeProduct({ product_form: 'dry' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('cups');
  });

  test('assignment.serving_size_unit = scoops → scoops', () => {
    const assignment = makeAssignment({ serving_size_unit: 'scoops' });
    const item = makePantryItem({ quantity_unit: 'lbs' });
    const product = makeProduct({ product_form: 'dry' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('scoops');
  });

  test('assignment.serving_size_unit = units with unit_label = pouches → pouches', () => {
    const assignment = makeAssignment({ serving_size_unit: 'units' });
    const item = makePantryItem({ quantity_unit: 'units', unit_label: 'pouches' });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('pouches');
  });

  test('assignment.serving_size_unit = units, no unit_label → cans/pouches default', () => {
    const assignment = makeAssignment({ serving_size_unit: 'units' });
    const item = makePantryItem({ quantity_unit: 'units', unit_label: null });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('cans/pouches');
  });

  test('no assignment, dry product → cups fallback', () => {
    const item = makePantryItem({ quantity_unit: 'lbs' });
    const product = makeProduct({ product_form: 'dry' });
    expect(resolveDisplayUnit(null, item, product)).toBe('cups');
  });

  test('no assignment, wet product with unit_label = pouches → pouches', () => {
    const item = makePantryItem({ quantity_unit: 'units', unit_label: 'pouches' });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(null, item, product)).toBe('pouches');
  });

  test('no assignment, wet product without unit_label → cans/pouches default', () => {
    const item = makePantryItem({ quantity_unit: 'units', unit_label: null });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(null, item, product)).toBe('cans/pouches');
  });

  test('everything null → cans/pouches default (safe fallback)', () => {
    expect(resolveDisplayUnit(null, null, null)).toBe('cans/pouches');
  });
});
```

- [ ] **Step 4.2: Run the new tests and verify they fail**

Run:
```bash
npx jest --testPathPattern=FedThisTodaySheet -t resolveDisplayUnit
```

Expected: **FAIL** — import error on `resolveDisplayUnit`.

- [ ] **Step 4.3: Implement `resolveDisplayUnit` in `FedThisTodaySheet.tsx`**

Open `src/components/pantry/FedThisTodaySheet.tsx`. Just below the `singularize` export from Task 3, add:

```ts
/**
 * Resolve the per-feeding display unit for the stepper label.
 * Priority: assignment.serving_size_unit → fall back by product_form.
 * Never reads pantryItem.quantity_unit (that's bag inventory, often 'lbs' for dry).
 */
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
  // No assignment match: derive by product form
  if (product?.product_form === 'dry') return 'cups';
  return pantryItem?.unit_label ?? 'cans/pouches';
}
```

The `PantryItem` and `PantryPetAssignment` types need to be added to the existing import. Find line 7 of `FedThisTodaySheet.tsx`:

```ts
import type { PantryItem } from '../../types/pantry';
```

Update to:

```ts
import type { PantryItem, PantryPetAssignment } from '../../types/pantry';
```

`Product` is already imported at line 8 (`import type { Product } from '../../types';`).

- [ ] **Step 4.4: Run the tests and verify they pass**

Run:
```bash
npx jest --testPathPattern=FedThisTodaySheet
```

Expected: **PASS** — all `singularize` + `resolveDisplayUnit` tests green (7 + 8 = 15 total in the file).

- [ ] **Step 4.5: Commit**

```bash
git add src/components/pantry/FedThisTodaySheet.tsx __tests__/components/FedThisTodaySheet.test.ts
git commit -m "$(cat <<'EOF'
M9: extract resolveDisplayUnit pure helper

Exports resolveDisplayUnit(assignment, pantryItem, product) from
FedThisTodaySheet.tsx. Reads per-feeding unit from assignment.
serving_size_unit, falls back by product_form, never reads bag's
quantity_unit. Replaces buggy inline unitLabel computation in Task 5.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire `assignment` prop and replace unit + kcal logic in the sheet body

**Files:**
- Modify: `src/components/pantry/FedThisTodaySheet.tsx` (props, kcal memo, unit label, zero-kcal guard)

No new tests — behavior is covered by the Task 3+4 pure helpers. This task is pure wiring.

- [ ] **Step 5.1: Extend `FedThisTodaySheetProps`**

Open `src/components/pantry/FedThisTodaySheet.tsx`. Find the `FedThisTodaySheetProps` interface (around lines 13-20):

```ts
interface FedThisTodaySheetProps {
  isVisible: boolean;
  petId: string | null;
  pantryItem: PantryItem | null;
  product: Product | null;
  onDismiss: () => void;
  onSuccess: () => void;
}
```

Add an `assignment` prop:

```ts
interface FedThisTodaySheetProps {
  isVisible: boolean;
  petId: string | null;
  pantryItem: PantryItem | null;
  assignment: PantryPetAssignment | null;
  product: Product | null;
  onDismiss: () => void;
  onSuccess: () => void;
}
```

- [ ] **Step 5.2: Destructure `assignment` in the component signature**

Find the component function (around line 22-29):

```ts
export function FedThisTodaySheet({
  isVisible,
  petId,
  pantryItem,
  product,
  onDismiss,
  onSuccess,
}: FedThisTodaySheetProps) {
```

Add `assignment`:

```ts
export function FedThisTodaySheet({
  isVisible,
  petId,
  pantryItem,
  assignment,
  product,
  onDismiss,
  onSuccess,
}: FedThisTodaySheetProps) {
```

- [ ] **Step 5.3: Update kcal resolution to branch by display unit**

Find the `calories` useMemo block (around lines 42-46):

```ts
  const calories = useMemo(() => {
    if (!product) return 0;
    const resolved = getWetFoodKcal(product);
    return resolved?.kcal ?? 0;
  }, [product]);
```

Replace with a new `displayUnitPlural` and `kcalPerQuantity` computation. First, add the helper import at the top of the file (below the existing `getWetFoodKcal` import at line 9):

```ts
import { getWetFoodKcal, resolveDryKcalPerCup } from '../../utils/pantryHelpers';
```

Then replace the `calories` block with:

```ts
  const displayUnitPlural = useMemo(
    () => resolveDisplayUnit(assignment, pantryItem, product),
    [assignment, pantryItem, product]
  );

  const kcalPerQuantity = useMemo(() => {
    if (!product) return 0;
    if (displayUnitPlural === 'cups' || displayUnitPlural === 'scoops') {
      return resolveDryKcalPerCup(product) ?? 0;
    }
    const wet = getWetFoodKcal(product);
    return wet?.kcal ?? 0;
  }, [product, displayUnitPlural]);
```

- [ ] **Step 5.4: Update `totalKcal` to use `kcalPerQuantity`**

Find line 49 (approximately):

```ts
  const totalKcal = Math.round(calories * qty);
```

Change to:

```ts
  const totalKcal = Math.round(kcalPerQuantity * qty);
```

- [ ] **Step 5.5: Replace the inline `unitLabel` and JSX stepper label with the new helpers**

Find line 84 (approximately):

```ts
  const unitLabel = pantryItem?.quantity_unit === 'units' ? 'cans/pouches' : pantryItem?.quantity_unit || 'units';
```

Delete this line entirely.

Find the `<Text style={styles.unitText}>` block (around line 107):

```tsx
                    <Text style={styles.unitText}>{qty === 1 ? unitLabel.replace(/s\/?pouches$/, '/pouch').replace(/s$/, '') : unitLabel}</Text>
```

Replace with:

```tsx
                    <Text style={styles.unitText}>{qty === 1 ? singularize(displayUnitPlural) : displayUnitPlural}</Text>
```

- [ ] **Step 5.6: Add zero-kcal safety guard in `handleLog`**

Find the existing guard in `handleLog` (around line 54):

```ts
    if (qty <= 0) {
      scanWarning();
      return;
    }
```

Replace with:

```ts
    if (qty <= 0) {
      scanWarning();
      return;
    }

    if (totalKcal <= 0) {
      scanWarning();
      setError('Cannot log — kcal data missing for this product.');
      return;
    }
```

The existing file uses `setIsSubmitting(false)` but not `setError` — you need to add a local `error` state at the top of the component (around line 30, near `const [quantityStr, setQuantityStr] = useState('1');`):

```ts
  const [error, setError] = useState<string | null>(null);
```

And reset it when the sheet opens (inside the existing `useEffect` at line 34):

```ts
  React.useEffect(() => {
    if (isVisible) {
      setQuantityStr('1');
      setError(null);
    } else {
      setIsSubmitting(false);
    }
  }, [isVisible]);
```

Render the error text under the stepper. Find the `summaryBox` section (around lines 115-120) and add an error block just before it:

```tsx
              {error && (
                <Text style={styles.errorText}>{error}</Text>
              )}

              <View style={styles.summaryBox}>
```

Add an `errorText` style to the `StyleSheet.create({...})` block at the bottom of the file (after the existing styles, before the closing `});`):

```ts
  errorText: {
    fontSize: FontSizes.sm,
    color: Colors.severityRed,
    textAlign: 'center',
    marginVertical: Spacing.sm,
  },
```

If `Colors.severityRed` doesn't exist in the project, fall back to `Colors.severityRed ?? '#ef4444'` — but check first by grepping:

```bash
grep -n "severityRed" src/utils/constants.ts
```

If it doesn't exist, use whatever red/danger color is established in constants (likely `Colors.severityDanger` or `Colors.danger`). Match the existing palette.

- [ ] **Step 5.7: Run the FedThisTodaySheet pure helper tests to ensure no regressions**

Run:
```bash
npx jest --testPathPattern=FedThisTodaySheet
```

Expected: all 15 tests still pass (imports didn't break, exports still named correctly).

- [ ] **Step 5.8: TypeScript check**

Run:
```bash
npx tsc --noEmit
```

Expected: no new errors in `src/components/pantry/FedThisTodaySheet.tsx`. (79 pre-existing errors in `docs/plans/search-uiux/*` and Deno imports are expected per prior sessions — ignore those.)

If you see new errors, likely causes: missing prop in caller (Task 6 fixes this), missing type import, or typo in helper signature.

- [ ] **Step 5.9: Commit**

```bash
git add src/components/pantry/FedThisTodaySheet.tsx
git commit -m "$(cat <<'EOF'
M9: FedThisTodaySheet reads per-feeding unit from assignment, not bag

Replaces inline unitLabel (which read pantryItem.quantity_unit — bag
inventory unit, 'lbs' for dry kibble) with resolveDisplayUnit +
singularize. Kcal resolution now branches by display unit: cups/scoops
use resolveDryKcalPerCup (supports dry-food density fallback), units use
getWetFoodKcal.

Adds zero-kcal safety guard to handleLog with user-visible error text
when product has no derivable kcal data. Prevents silent
kcalFed=0 feeding log rows.

Fixes Image 11 bug (dry rotational food stepper showed "1 lb" instead
of "1 cup").

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Pass `assignment` prop from `PantryScreen`

**Files:**
- Modify: `src/screens/PantryScreen.tsx` (line ~711 `<FedThisTodaySheet>` invocation)

- [ ] **Step 6.1: Read the current invocation to confirm line numbers and surrounding state**

Run:
```bash
grep -n "FedThisTodaySheet" src/screens/PantryScreen.tsx
```

Expected: line showing `<FedThisTodaySheet` JSX and the `logFeedingItem` state variable.

Open `src/screens/PantryScreen.tsx` around line 711 and read the props currently being passed.

- [ ] **Step 6.2: Add the `assignment` prop to the invocation**

The existing invocation looks approximately like:

```tsx
<FedThisTodaySheet
  isVisible={!!logFeedingItem}
  petId={activePet?.id ?? null}
  pantryItem={logFeedingItem}
  product={logFeedingItem?.product ?? null}
  onDismiss={() => setLogFeedingItem(null)}
  onSuccess={/* existing handler */}
/>
```

(Actual wiring may differ — read it first and preserve existing handlers.)

Add the `assignment` prop by looking up the active pet's assignment on the item:

```tsx
<FedThisTodaySheet
  isVisible={!!logFeedingItem}
  petId={activePet?.id ?? null}
  pantryItem={logFeedingItem}
  assignment={
    logFeedingItem && activePet
      ? logFeedingItem.assignments.find(a => a.pet_id === activePet.id) ?? null
      : null
  }
  product={logFeedingItem?.product ?? null}
  onDismiss={() => setLogFeedingItem(null)}
  onSuccess={/* existing handler */}
/>
```

- [ ] **Step 6.3: TypeScript check**

Run:
```bash
npx tsc --noEmit
```

Expected: no new errors. If you see "`Property 'assignment' is missing in type...`" elsewhere, that means another caller of `FedThisTodaySheet` exists — grep and update all of them:

```bash
grep -rn "FedThisTodaySheet" src/ | grep -v "\.test\."
```

- [ ] **Step 6.4: Commit**

```bash
git add src/screens/PantryScreen.tsx
git commit -m "$(cat <<'EOF'
M9: pass active pet's assignment into FedThisTodaySheet

Wires the missing prop required by FedThisTodaySheet's new unit/kcal
routing logic. Looks up the assignment for the currently-active pet
on the tapped pantry item.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Full regression verification

**Files:** none — verification only.

- [ ] **Step 7.1: Run the full test suite**

Run:
```bash
npx jest
```

Expected: all tests pass. Test count should be **baseline 1473 + 22 new = 1495** (7 for `resolveDryKcalPerCup` + 2 for `computeBehavioralServing` + 7 for `singularize` + 8 for `resolveDisplayUnit`).

64 suites (baseline 63 + 1 new file `__tests__/components/FedThisTodaySheet.test.ts`).

- [ ] **Step 7.2: Regression anchor check**

Run:
```bash
npx jest --testPathPattern=regressionTrace
```

Expected: **Pure Balance (Dog) = 61 ✓, Temptations (Cat Treat) = 0 ✓**, Pure Balance + cardiac dog = 0, Pure Balance + pancreatitis dog = 53.

This fix doesn't touch the scoring engine, so these must hold. If they drift, you've accidentally touched something unrelated — revert and investigate.

- [ ] **Step 7.3: TypeScript check (full project)**

Run:
```bash
npx tsc --noEmit
```

Expected: pre-existing 79 errors confined to `docs/plans/search-uiux/*` prototype + Deno import-extension quirks in `supabase/functions/batch-score/scoring/*.ts`. No new errors in `src/` or `__tests__/`.

---

## Task 8: On-device QA checklist

**Files:** none — manual verification.

- [ ] **Step 8.1: Image 9 regression — AddToPantrySheet AUTO panel**

1. Start Expo: `npx expo start`
2. Open app on simulator, go to a pet's scan history or search
3. Scan/open a dry food product that has `ga_kcal_per_kg` but no `ga_kcal_per_cup` (the user's session showed Pedigree Roasted Chicken was such a product)
4. Tap "Add to pantry"
5. **Expected:** AUTO panel reads `X.X cups / day` (not `X.X units / day`)
6. **Pass criteria:** the number is sensible (e.g., 5-8 cups for a 50-lb dog on a ~400 kcal/cup food)

- [ ] **Step 8.2: Image 10 regression — new pantry item renders cups in feedingSummary**

1. Complete the "Add to Pantry" flow from Step 8.1
2. Go to Pantry tab
3. Look at the new item's card
4. **Expected:** the card shows `Nx daily · X.X cups` in the feeding summary row — not `units`, not `0 cups`
5. The "X lbs left" remaining inventory is correct and unchanged — that's bag weight, not per-feeding

- [ ] **Step 8.3: Image 11 regression — FedThisTodaySheet stepper on dry rotational**

1. Add a second dry food to pantry, this time rotational (pet must be `dry_and_wet` mode, OR manually configure via custom splits — rotational role)
2. On the pantry card, tap "Log feeding"
3. **Expected:** the "Amount Fed" stepper shows `1 cup` (singular) or `X cups` (plural), NOT `1 lb`
4. Tap +/− to change the quantity; confirm kcal updates correctly (should be kcal-per-cup × quantity, e.g., 400 kcal × 1.5 cups = 600 kcal)
5. Tap "Log It" — confirm it writes a feeding log (no error)

- [ ] **Step 8.4: Wet rotational regression check**

1. Add a wet rotational food (pouch/can product)
2. Tap "Log feeding"
3. **Expected:** stepper shows `1 can/pouch` (singular) or `X cans/pouches` (plural) — unchanged behavior from before the fix
4. Confirm kcal resolves correctly via `getWetFoodKcal`

- [ ] **Step 8.5: Zero-kcal safety guard check**

1. Find a dry product with no `ga_kcal_per_cup` AND no `ga_kcal_per_kg` (rare; may need to manually null one out in a dev DB or use a supplement product that doesn't have daily-food kcal data)
2. If such a product is a rotational item, tap "Log feeding"
3. **Expected:** stepper still renders, but on tapping "Log It" you see the error text "Cannot log — kcal data missing for this product." No DB write occurs
4. If no such product exists in your dev DB, skip this step and verify the guard is correctly coded by reading the diff

---

## Self-review (completed)

**Spec coverage:**
- ✅ Part 1 (`resolveDryKcalPerCup` + `computeBehavioralServing` update) → Tasks 1-2
- ✅ Part 2 (FedThisTodaySheet props + unit routing + kcal branching + zero-kcal guard) → Tasks 3-5
- ✅ Part 3 (caller update) → Task 6
- ✅ Tests for all helpers → Tasks 1, 2, 3, 4
- ✅ Regression anchors + TypeScript → Task 7
- ✅ On-device QA checklist per spec's "Observable outcomes" → Task 8

**Placeholder scan:** no TBD/TODO/similar-to-task-N. All code blocks are complete.

**Type consistency:**
- `resolveDryKcalPerCup: (product: Product) => number | null` — consistent across Tasks 1, 2, 5
- `resolveDisplayUnit: (assignment, pantryItem, product) => string` — consistent across Tasks 4, 5
- `singularize: (plural: string) => string` — consistent
- `DRY_KIBBLE_KG_PER_CUP = 0.1134` — consistent with `supabase/functions/auto-deplete/index.ts:45`

**Bite-size:** every step is 2-5 minutes. TDD rhythm: test → verify fail → implement → verify pass → commit.

**One open call-out:** Step 5.6 references `Colors.severityRed`. If the palette uses a different red token name, the engineer should grep + adjust. The step documents this.

---

## Final plan destination

**After plan mode exits,** save a copy of this plan to `docs/superpowers/plans/2026-04-13-dry-food-cups.md` and commit on the `m9-dry-food-cups` branch. The harness plan-file path (`/Users/stevendiaz/.claude/plans/smooth-plotting-prism.md`) is temporary — the canonical superpowers-workflow location is `docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.
