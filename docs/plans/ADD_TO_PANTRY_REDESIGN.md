# Add to Pantry Redesign — Phase C

> Designed April 5, 2026 (session 24). Not yet implemented.
> Prerequisite: Phase B (pantry two-slot model + Safe Switch coupling) is shipped.

---

## Problem

The current AddToPantrySheet asks 5+ inputs (Weight/Units toggle, bag size, unit selector, feedings per day, amount per feeding) when most pet owners just want to tap "add" and go. It feels like calculus. The serving math is already computable from the pet's DER and the product's calorie density — the user shouldn't have to do it.

## Design Principle

**Frame everything in meals, not percentages or cups.** Pet owners think "Stain eats breakfast and dinner." They don't think "50% DER allocation at 431 kcal." The sheet should auto-compute and present the answer in terms the user already understands.

---

## New Sheet Layout

```
┌─────────────────────────────────────────┐
│ [Product image]  Brand                  │
│                  Product Name...    ✕    │
│                  Score badge             │
├─────────────────────────────────────────┤
│                                         │
│ Is this new to Stain's diet?            │
│ ┌──────────┐ ┌──────────┐              │
│ │   Yes    │ │    No    │              │
│ └──────────┘ └──────────┘              │
│ (cyan fill on active, default: No)      │
│                                         │
│ ┌─ If Yes + has daily food in pantry ──┐│
│ │ New foods should be introduced       ││
│ │ gradually to avoid digestive upset.  ││
│ │                                      ││
│ │ [Start Safe Switch →]                ││
│ └──────────────────────────────────────┘│
│                                         │
│ ┌─ If Yes + NO daily food in pantry ───┐│
│ │ New foods should be introduced       ││
│ │ gradually to avoid digestive upset.  ││
│ │ (no CTA — nothing to switch from)    ││
│ └──────────────────────────────────────┘│
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ Stain eats 2 meals a day.              │
│ This food covers:  [- 1 +] meal        │
│                                         │
│ = 1.2 cups per meal                     │
│   (auto-computed from DER, tappable     │
│    to manually override)                │
│                                         │
│ See in oz · g ▸  (dry food only,        │
│                   expandable row)        │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ Bag size  [20] lbs                      │
│ (collapsed by default, pre-filled       │
│  from product name regex via            │
│  parseProductSize)                      │
│                                         │
├─────────────────────────────────────────┤
│                                         │
│ ┌───────────────────────────────────┐   │
│ │     Add to Stain's Pantry         │   │
│ └───────────────────────────────────┘   │
│                                         │
└─────────────────────────────────────────┘
```

---

## Behavior Rules

### 1. "Is this new to Stain's diet?"

| Scenario | Response |
|----------|----------|
| Yes + pet has daily food in pantry | Advisory text + "Start Safe Switch" CTA. Tapping CTA: add to pantry first, then navigate to SafeSwitchSetupScreen with `pantryItemId` = existing daily food, `newProductId` = just-added product. |
| Yes + no daily food in pantry | Advisory text only (nothing to switch from). |
| No (default) | No advisory, straight to serving info. |

Advisory copy (D-095 compliant): "New foods should be introduced gradually over 7-10 days to avoid digestive upset."

If the user has an existing daily food in pantry but it's NOT tracked in Kiba (i.e., pantry is empty but they do feed something), the "No daily food in pantry" branch handles it gracefully — advisory but no Safe Switch. The solid-fill daily food asset can serve as a placeholder icon in the advisory card.

### 2. "This food covers N meals" — Smart Defaults

| Pantry state | Default meals covered | Why |
|---|---|---|
| 0 daily foods in pantry | All meals (e.g., 2) | This is the only food — it covers everything. |
| 1 daily food in pantry | 1 meal | They're adding a second food — split. |
| Safe Switch in progress for this pet | Don't show meal stepper | Safe Switch owns the allocation via its own transition ratios. |

The total "meals per day" comes from the pet's existing feedings config. If the pet has health conditions that recommend more meals (pancreatitis → 3-4x, via `getConditionFeedingsPerDay`), use that. Otherwise default 2.

### 3. Auto-Computed Serving Size

**Formula:**
```
mealsThisFoodCovers = user selection (default per table above)
totalMealsPerDay = pet's feedings (2 default, condition-aware)
derAllocation = mealsThisFoodCovers / totalMealsPerDay
dailyKcalForThisFood = pet DER × derAllocation
```

**For dry food (weight-based):**
```
cupsPerDay = dailyKcalForThisFood / product.ga_kcal_per_cup
cupsPerMeal = cupsPerDay / mealsThisFoodCovers
Display: "= {cupsPerMeal} cups per meal"
```

**For wet food (unit-based):**
```
unitsPerDay = dailyKcalForThisFood / product.kcal_per_unit
unitsPerMeal = unitsPerDay / mealsThisFoodCovers
Display: "= {unitsPerMeal} cans per meal"  (or "pouches" etc.)
```

**Missing calorie data fallback:** If kcal data is unavailable, hide the auto-computation and show a manual input field (current behavior). Show a muted note: "Calorie data unavailable — enter your usual serving size."

**Manual override:** The auto-computed line is tappable. Tapping opens an inline edit field where the user can type a custom amount. A "Reset to auto" link restores the computed value.

### 4. "See conversions" (dry food only)

Expandable row below the serving size. Shows the per-meal amount in alternative units:

```
See in oz · g ▸

Expanded:
  = 5.4 oz per meal
  = 153 g per meal
```

Conversions use the existing `convertFromKg` and `convertToKg` helpers in `pantryHelpers.ts`. Not shown for wet food (a can is a can).

### 5. Auto-Rebalancing When Adding a Second Daily Food

When the user adds a second daily food with "covers 1 meal" (the default):
1. The existing daily food's `feedings_per_day` is auto-adjusted: if it was 2, it becomes 1.
2. The existing food's `serving_size` is recalculated for the reduced meal count.
3. A brief inline note appears on the sheet: "Adjusted Pedigree to 1 meal."
4. The rebalancing updates `pantry_pet_assignments` for the existing item via `updatePetAssignment`.

**Edge case — 3-meal pet adding a second food:**
- Existing food: 3 meals → adjusted to 2 meals
- New food: 1 meal
- Total: 3 meals covered. Clean split.

**Edge case — user manually sets "covers 2 meals" for the new food on a 2-meal pet:**
- Existing food: 2 meals → adjusted to 0 meals... that's wrong.
- Guard: cap "covers" at `totalMeals - 1` when another daily food exists. The stepper's max becomes `totalMeals - 1`.
- If they want to fully replace, that's a Safe Switch, not an add.

### 6. Bag Size (Collapsed)

- Pre-filled from product name via existing `parseProductSize(name)` helper.
- Collapsed by default — most users don't care about tracking depletion precisely on first add.
- Tappable to expand and edit. Unit chips: lbs / oz / kg / g (existing pattern).

---

## Safe Switch Handoff Flow

When user taps "Yes, this is new" + "Start Safe Switch":

1. **Add to pantry** — the product is added with the auto-computed serving, bag size, etc. Returns the new `pantry_items` row.
2. **Assign slot** — the new item gets `slot_index` via `pickNextSlotForPet` (Phase B).
3. **Navigate** — close the sheet, cross-navigate to `SafeSwitchSetupScreen` with:
   - `pantryItemId` = the EXISTING daily food's pantry_item_id (the one being replaced)
   - `newProductId` = the just-added product's ID
   - `petId` = active pet

The existing daily food is identified via `getPantryAnchor(petId)` — if there's exactly 1 anchor, use it. If there are 2 (two-slot pet), use `pickSlotForSwap` to auto-pick (prefer form match, then lower score). The user can override in SafeSwitchSetupScreen's slot picker.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/pantry/AddToPantrySheet.tsx` | Full rewrite of the sheet body. Keep the bottom sheet shell, replace internals. |
| `src/utils/pantryHelpers.ts` | New helper: `computeMealBasedServing(pet, product, mealsThisFoodCovers, totalMealsPerDay)` — returns `{ amount, unit, dailyKcal }`. Reuses existing `computePetDer`, `resolveCalories`. |
| `src/services/pantryService.ts` | `addToPantry` may need to accept a `rebalancePetId` flag that triggers the existing food's assignment update in the same flow. Or handle rebalancing in the store layer. |
| `src/stores/usePantryStore.ts` | `addItem` action extended: after add, if rebalancing needed, call `updatePetAssignment` on the existing item. |
| `__tests__/utils/pantryHelpers.test.ts` | Tests for `computeMealBasedServing`. |
| `__tests__/components/pantry/AddToPantrySheet.test.ts` | Update sheet tests for new layout. |

### Existing code to reuse

- `computePetDer(pet, isPremiumGoalWeight, weightGoalLevel)` — `src/utils/pantryHelpers.ts`
- `resolveCalories(product)` — `src/utils/calorieEstimation.ts` (returns kcal/cup, kcal/kg, kcal/unit)
- `getConditionFeedingsPerDay(conditions)` — `src/utils/pantryHelpers.ts`
- `getSmartDefaultFeedingsPerDay(category, pantryItems, petId, conditions)` — `src/utils/pantryHelpers.ts`
- `parseProductSize(name)` — `src/utils/pantryHelpers.ts`
- `convertToKg` / `convertFromKg` — `src/utils/pantryHelpers.ts`
- `getPantryAnchor(petId)` — `src/services/pantryService.ts` (Phase B)
- `pickSlotForSwap(anchors, newProductForm)` — `src/utils/pantryHelpers.ts` (Phase B)
- `formatFraction(n)` — `src/utils/pantryHelpers.ts` (for "1 1/2 cups" display)
- `defaultServingMode(productForm)` — `src/utils/pantryHelpers.ts`

---

## What This Replaces

The current AddToPantrySheet (D-165) has:
- Auto/Manual toggle (Auto default)
- Weight/Units segmented control
- Bag size with unit chips (lbs/oz/kg/g)
- Feedings per day stepper
- Amount per feeding input
- Budget warnings (>120% amber, >100% inline, <80% muted)

Phase C replaces this with:
- "New to diet?" yes/no (new)
- Meal count stepper replacing feedings + allocation (simpler)
- Auto-computed serving with manual override (smarter default)
- Conversions expandable (replaces unit chips on the serving)
- Bag size collapsed (same, just hidden by default)
- Budget warnings still fire, but the user rarely sees them because the auto-computation is DER-aware

---

## Copy (D-095 Compliant)

- Advisory: "New foods should be introduced gradually over 7-10 days to avoid digestive upset."
- Safe Switch CTA: "Start Safe Switch"
- Rebalance note: "Adjusted {existingProductName} to {N} meal{s}."
- Fallback: "Calorie data unavailable — enter your usual serving size."
- Conversion header: "See in oz / g"

No "prescribe," "treat," "cure," "prevent," or "diagnose."

---

## Open Questions for Implementation Session

1. **Should the "new to diet" default be Yes or No?** Current plan says No. But if we default to Yes, more users see the Safe Switch advisory. Risk: alert fatigue if they're re-adding a food they already feed.

2. **Rebalancing UX when adjusting meals later (EditPantryItem):** If the user later changes "covers 1 meal" → "covers 2 meals" on the edit screen, should we auto-rebalance the other food again? Or only on initial add? (Recommend: only on add, to avoid surprise edits to other items.)

3. **Treats and supplements:** These skip the "new to diet?" question entirely (no Safe Switch for treats). The meal stepper doesn't apply — treats use the existing "as needed" frequency. Phase C only redesigns the daily food add flow; treat/supplement add stays as-is or gets a minimal trim.
