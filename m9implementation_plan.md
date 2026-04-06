# Phase C — Add to Pantry Redesign

Transform the AddToPantrySheet from a calculator-style form (5+ inputs) into a meals-based, auto-computing sheet that feels like "tap and go." The spec lives at `docs/plans/ADD_TO_PANTRY_REDESIGN.md`. This plan resolves the 3 open questions and details the implementation.

## Mockups

All 4 key states are rendered as interactive HTML with Matte Premium tokens at [add_to_pantry_mockup.html](file:///Users/stevendiaz/kiba-antigravity/docs/plans/add_to_pantry_mockup.html).

````carousel
![State 1 & 2 — Default + Safe Switch handoff](/Users/stevendiaz/.gemini/antigravity/brain/13bc6770-033c-4a2f-87b1-8095f5a6ff9c/mockup_top_1775456084177.png)
<!-- slide -->
![State 3 & 4 — First food + Manual fallback](/Users/stevendiaz/.gemini/antigravity/brain/13bc6770-033c-4a2f-87b1-8095f5a6ff9c/mockup_middle_1775456090416.png)
````

> **State 1**: Adding a second daily food — auto-computed 1-meal serving, bag size collapsed
> **State 2**: New food with "Yes" selected — amber advisory card + "Start Safe Switch →" CTA + rebalance note
> **State 3**: First food (cold pantry) — covers all meals, expanded conversions
> **State 4**: Missing calorie data — manual input fallback with pack size

---

## Open Questions — Resolved

> [!IMPORTANT]
> ### Q1: "New to diet?" default → **No**
> Keeps the default as "No" per the spec. Rationale: most adds are restocking or adding a second food they already feed. Defaulting "Yes" would create alert fatigue and show the Safe Switch advisory on every restock. The user who IS switching will know to tap "Yes."

> [!IMPORTANT]
> ### Q2: Rebalancing on later edits → **Only on initial add**
> Auto-rebalancing only fires when adding a new food (Phase C scope). Editing meal counts later on `EditPantryItemScreen` does NOT auto-adjust the other food. Rationale: surprise edits to other pantry items are confusing. The user should manually adjust the other food if they change the split later. We can add a "Rebalance" button to EditPantryItem in a future pass if users request it.

> [!IMPORTANT]
> ### Q3: Treats & supplements → **Skip Phase C redesign**
> Treats and supplements bypass the "new to diet?" question, meal stepper, and auto-computation entirely. They use a stripped-down version: just bag/pack size + confirm. The meal-based framing doesn't apply to treats (no DER allocation) or supplements (as-needed frequency). The current treat add flow is already simple enough. Phase C only rewrites the **daily food** add path.

---

## Proposed Changes

### Helpers & Logic

#### [MODIFY] [pantryHelpers.ts](file:///Users/stevendiaz/kiba-antigravity/src/utils/pantryHelpers.ts)

New pure helper function:

```typescript
export function computeMealBasedServing(
  pet: Pet,
  product: Product,
  mealsThisFoodCovers: number,
  totalMealsPerDay: number,
  isPremiumGoalWeight: boolean,
  weightGoalLevel: number,
  existingPantryKcal: number,
): { amount: number; unit: ServingSizeUnit; dailyKcal: number } | null
```

- Computes DER allocation: `mealsThisFoodCovers / totalMealsPerDay`
- Computes `dailyKcalForThisFood = petDER × derAllocation`
- For weight-based (dry): `cupsPerMeal = dailyKcal / kcal_per_cup / mealsThisFoodCovers`
- For unit-based (wet): `unitsPerMeal = dailyKcal / kcal_per_unit / mealsThisFoodCovers`
- Returns null if kcal data is unavailable (fallback to manual)
- Reuses existing `computePetDer`, `resolveCalories`

New helper for default meals covered:

```typescript
export function getDefaultMealsCovered(
  dailyFoodCount: number,
  totalMealsPerDay: number,
): number
```

- 0 daily foods → all meals
- 1+ daily foods → 1 meal
- Capped at `totalMealsPerDay`

New helper for rebalancing:

```typescript
export function computeRebalancedMeals(
  totalMealsPerDay: number,
  newFoodMeals: number,
  existingFoodMeals: number,
): number
```

- Returns adjusted meals for existing food: `totalMealsPerDay - newFoodMeals`
- Guards: never returns 0 (minimum 1), never exceeds total

New helper for unit conversions display:

```typescript
export function computeServingConversions(
  cupsPerMeal: number,
): { oz: number; g: number }
```

- 1 cup ≈ 4 oz (dry food volume conversion)
- 1 cup ≈ 113.4 g (dry food weight conversion using existing `0.1134` constant)

---

#### [MODIFY] [pantryService.ts](file:///Users/stevendiaz/kiba-antigravity/src/services/pantryService.ts)

- Add `rebalanceExistingFood(pantryItemId, petId, newMealsCovered, totalMealsPerDay, product)` — updates the existing food's `serving_size` and `feedings_per_day` in `pantry_pet_assignments` after adding a second food.
- Called from the store layer after `addToPantry` succeeds.

---

#### [MODIFY] [usePantryStore.ts](file:///Users/stevendiaz/kiba-antigravity/src/stores/usePantryStore.ts)

- Extend `addItem` action: after successful add, if `rebalanceTarget` is provided (existing pantry item ID + new meal count), call `rebalanceExistingFood`.
- Emit a brief inline feedback message (returned to the UI for the rebalance note).

---

### UI Component

#### [MODIFY] [AddToPantrySheet.tsx](file:///Users/stevendiaz/kiba-antigravity/src/components/pantry/AddToPantrySheet.tsx)

**Full rewrite of the sheet body.** Keep the `Modal` + `KeyboardAvoidingView` + `ScrollView` shell. Replace internals with the new layout:

**New state variables:**
- `isNewToDiet: boolean` (default: `false`)
- `mealsCovered: number` (default: computed from `getDefaultMealsCovered`)
- `showConversions: boolean` (default: `false`)
- `isManualOverride: boolean` (default: `false`)
- `manualServingText: string`

**Remove state variables:**
- `autoMode` / `customServing` / `customServingText` / `servingMode` toggle
- `servingSizeUnit` chips (the unit is auto-determined from product form)

**New sections (top-to-bottom):**

1. **Header** — keep existing (product image + brand + name + score badge + close)
2. **"Is this new to {petName}'s diet?"** — Yes/No pill toggle (daily food only, hidden for treats/supplements)
   - Yes + has pantry anchor → amber advisory card + "Start Safe Switch →" CTA
   - Yes + no pantry anchor → advisory card only (no CTA)
   - No → nothing extra
3. **Meal allocation section**
   - Sentence: "{petName} eats {N} meals a day."
   - Stepper: "This food covers: [−] {M} [+] meal(s)"
   - Auto-computed result: "= {X} cups/cans per meal" with AUTO badge
   - Math line: "{remaining} kcal of {DER} budget ÷ {M} meal(s)"
   - Tap to override → inline input replaces the auto line, "Reset to auto" link
   - "See in oz · g ▸" expandable (dry food only)
   - Rebalance note (if applicable): "Adjusted {existingProduct} to {M} meal."
4. **Bag/Pack size** — collapsed by default, pre-filled from `parseProductSize`
5. **CTA** — "Add to {petName}'s Pantry"

**Safe Switch handoff flow:**
- When user taps "Start Safe Switch →":
  1. Call `addToPantry` with computed serving
  2. Assign slot via `pickNextSlotForPet`
  3. Close sheet
  4. Navigate to `SafeSwitchSetupScreen` with `pantryItemId` (existing anchor) + `newProductId`
  5. Uses `getPantryAnchor` to identify the anchor; if 2 anchors, uses `pickSlotForSwap`

**Treat/Supplement path:** Skip "new to diet?" and meal stepper. Show only bag/pack size input + confirm button. Minimal trim of existing layout.

---

#### [MODIFY] [AddToPantryStyles.ts](file:///Users/stevendiaz/kiba-antigravity/src/components/pantry/AddToPantryStyles.ts)

New styles for:
- `advisoryCard` — amber-tinted left border, subtle background
- `advisoryCta` — cyan text link
- `mealSentence` — sentence-style text with bold pet name
- `autoResult` — large amount + unit + AUTO badge
- `autoMath` — muted kcal math line
- `conversionLink` / `conversionExpanded` — expandable row
- `rebalanceNote` — amber pill with rotate icon
- `bagSizeCollapsed` — tappable row with chevron

Remove legacy styles: `toggleRow` (serving mode), `chipRow` (fractional chips), etc.

---

### Tests

#### [MODIFY] [pantryHelpers.test.ts](file:///Users/stevendiaz/kiba-antigravity/__tests__/utils/pantryHelpers.test.ts)

New test suite: `computeMealBasedServing`:
- Dry food: 2-meal pet, covers 1 → half DER allocation
- Dry food: 2-meal pet, covers 2 → full DER
- Wet food: correct unit-based output
- Missing kcal → returns null
- 3-meal pet with pancreatitis, covers 1 → correct 1/3 allocation
- Weight goal level applied to DER

New test suite: `getDefaultMealsCovered`:
- 0 daily foods → all meals
- 1 daily food → 1 meal

New test suite: `computeRebalancedMeals`:
- 2-meal pet, new covers 1 → existing gets 1
- 3-meal pet, new covers 1 → existing gets 2
- Guard: never returns 0

---

## Verification Plan

### Automated Tests
```bash
npx jest __tests__/utils/pantryHelpers.test.ts --verbose
npx tsc --noEmit   # TypeScript check
```

### Manual Verification (iOS Simulator)
1. **Cold pantry** — scan a daily food, tap "Add to Pantry" → sheet shows all meals covered, auto-computed serving, bag size pre-filled
2. **Second food** — add another daily food → defaults to 1 meal, rebalance note appears
3. **"Yes" + anchor** — toggle "Yes" → advisory card + "Start Safe Switch →" CTA visible
4. **"Yes" + no anchor** — first food with "Yes" → advisory only, no CTA
5. **Manual override** — tap the auto-computed line → turns into input, "Reset to auto" link works
6. **Missing kcal** — find a product with no calorie data → fallback manual input shown
7. **Treat add** — add a treat → no "new to diet?", no meal stepper, simple flow
8. **Conversions** — tap "See in oz · g" → expanded row shows correct values

---

## Scope Boundary

> [!WARNING]
> ### NOT in Phase C scope:
> - EditPantryItemScreen auto-rebalancing (Q2 resolved: add-only)
> - Treat/supplement flow redesign (Q3 resolved: skip)
> - Safe Switch navigation flow changes (reuses Phase B infra as-is)
> - New migrations or schema changes (none needed — uses existing `pantry_pet_assignments` columns)
