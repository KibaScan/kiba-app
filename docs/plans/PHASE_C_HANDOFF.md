# Phase C — Add to Pantry Redesign: Implementation Status

> Written: 2026-04-06 (session 26). For next session to pick up where we left off.
> Spec: `docs/plans/ADD_TO_PANTRY_REDESIGN.md`
> Gemini's implementation: `m9implementation_plan.md`, `m9pantrywalkthrough.md`
> Claude's review + fixes: session 26

---

## What Works (Add Flow)

The `AddToPantrySheet.tsx` rewrite is functional:

- **"Is this new to diet?"** Yes/No pill toggle (daily food only, hidden for treats/supplements)
- **Meal stepper** with smart defaults: 0 foods → all meals, 1+ food → 1 meal
- **Stepper max guard**: `totalMeals - 1` when sibling exists (full replacement = Safe Switch)
- **Stepper ceiling hint**: 3s auto-dismiss when tapping disabled [+]
- **Auto-computed serving** via `computeMealBasedServing(pet, product, mealsCovered, totalMealsPerDay)` — DER allocation model, not remaining budget
- **AUTO/MANUAL badge** with "Reset to Auto Math" link
- **Math line**: "X kcal daily allocation (N%)" framing
- **Conversions** (oz/g) expandable for dry food only
- **Rebalance at add-time**: when adding a second daily food, `rebalanceExistingFood` adjusts the sibling's `serving_size` + `feedings_per_day` via `computeRebalancedMeals` + `computeMealBasedServing`
- **Safe Switch handoff**: CTA morphs to "Continue to Safe Switch" when Yes + `onStartSafeSwitch` available. Does NOT call `addToPantry` — passes computed serving through navigation params to `SafeSwitchSetupScreen`
- **Serving size pipeline**: migration 033 added `new_serving_size_unit` to `safe_switches`. RPC `complete_safe_switch_with_pantry_swap` applies `serving_size`, `serving_size_unit`, and `feedings_per_day` atomically at completion
- **Treat/supplement path**: preserved — simple bag size + confirm, no meal stepper

## What's Broken (Edit Flow)

`EditPantryItemScreen.tsx` still uses the **D-165 remaining-budget model**, which conflicts with Phase C's DER-allocation model:

### Problem 1: Auto-serve shows wrong values
- EditPantryItem calls `computeAutoServingSize(remainingBudgetKcal, feedingsPerDay, product)`
- `remainingBudgetKcal = petDer - computeExistingPantryKcal(items, petId, thisItemId)`
- When 2 foods each have 50% DER, the sibling claims 50% → remaining = 50% → auto-serve is correct
- BUT if the user edits the sibling's feedings first (e.g., 1→2), the sibling's kcal jumps → remaining for this item drops → auto-serve collapses

### Problem 2: No sibling rebalance on edit
- Changing one food's `feedings_per_day` on EditPantryItem does NOT adjust the other food
- User adds 2 foods with 50/50 split → edits Food A to 2 meals → Food B is still 1 meal → total is 3 meals of a 2-meal pet
- The calorie budget immediately breaks

### Problem 3: Wrong math framing
- EditPantryItem shows "X kcal remaining of Y budget ÷ N feedings" (D-165 pattern)
- Should show "X kcal daily allocation (N%)" matching the AddToPantrySheet pattern

## Root Cause

Two different mental models for the same data:

| | AddToPantrySheet (Phase C) | EditPantryItemScreen (D-165) |
|---|---|---|
| **Model** | DER allocation: `mealsThisFood / totalMeals` | Remaining budget: `DER - otherFoodsKcal` |
| **Helper** | `computeMealBasedServing` | `computeAutoServingSize` |
| **Rebalance** | Yes (at add-time) | No |
| **Math display** | "daily allocation (N%)" | "X kcal remaining of Y budget" |

The D-165 model works fine for a single food. It breaks with 2+ foods because it treats the sibling's allocation as fixed, creating a zero-sum competition for the "remaining" budget.

## What Needs to Happen (Next Session)

### 1. Migrate EditPantryItemScreen to meal-based model
- Replace `computeAutoServingSize(remainingBudget, ...)` with `computeMealBasedServing(pet, product, feedingsPerDay, totalMealsForPet, ...)`
- `totalMealsForPet` = sum of `feedings_per_day` across all daily food assignments for the pet
- Replace math line: "daily allocation (N%)" pattern
- Keep manual override path (AUTO/MANUAL badge pattern from AddToPantrySheet)

### 2. Auto-rebalance sibling on feedings change
- When user changes `feedings_per_day` on EditPantryItem → rebalance the sibling food(s)
- Call `rebalanceExistingFood` (already exists in `pantryService.ts`) or a similar function
- Show inline note: "Adjusted {sibling} to {N} meals." (same pattern as AddToPantrySheet rebalance note)
- Only fires for daily food, not treats/supplements

### 3. User expectation (from session 26)
> "this should be automatic the system needs to be smart"

Phase C spec Q2 originally said "rebalance on add only." User has overridden this — rebalance on edit is now required.

## Key Files

| File | Role |
|------|------|
| `src/screens/EditPantryItemScreen.tsx` | Main target — needs meal-based migration |
| `src/utils/pantryHelpers.ts` | `computeMealBasedServing` (reuse), `computeAutoServingSize` (keep alive) |
| `src/services/pantryService.ts` | `rebalanceExistingFood` (reuse or extend) |
| `src/stores/usePantryStore.ts` | Edit action needs rebalance hook |
| `src/components/pantry/AddToPantrySheet.tsx` | Reference implementation for meal-based model |

## Existing Helpers to Reuse

- `computeMealBasedServing(pet, product, mealsThisFoodCovers, totalMealsPerDay, isPremiumGoalWeight, weightGoalLevel)` — `pantryHelpers.ts:581`
- `computeRebalancedMeals(totalMealsPerDay, newFoodMeals)` — `pantryHelpers.ts:618`
- `rebalanceExistingFood(pantryItemId, pet, newMealsCovered, totalMealsPerDay, product, isPremiumGoalWeight)` — `pantryService.ts:244`
- `getConditionFeedingsPerDay(conditions)` — `pantryHelpers.ts:279`

## Gotchas

- `getSmartDefaultFeedingsPerDay` returns 1 for second daily food — correct for "feedings for this item" but NOT for "total meals." Use `existingDailyFeedings` sum pattern from AddToPantrySheet instead.
- `computeAutoServingSize` must stay alive — other code paths may use it. Don't delete.
- `PantryCardData.product` includes `ga_kcal_per_cup` (verified in type at `pantry.ts:76`) — the `as unknown as Product` cast in the store is safe for `computeMealBasedServing`.
