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

## What Was Done (Session 27)

### 1. EditPantryItemScreen migrated to meal-based model -- DONE
- Replaced `computeAutoServingSize(remainingBudget, ...)` with `computeMealBasedServing(pet, product, feedingsPerDay, totalMealsPerDay, ...)`
- `totalMealsPerDay` is reactive: `feedingsPerDay + siblingFeedings` (useMemo, not frozen useState)
- Math line: "X kcal daily allocation (N%)" pattern
- Daily total line: "X cups/day (N feedings)" when feedings > 1
- AUTO/MANUAL badge preserved, references updated to `autoServingResult`

### 2. Auto-rebalance sibling on feedings change -- DONE
- `handleFeedingsChange` calls `rebalanceExistingFood()` on sibling after saving this item
- Inline amber note: "Updated {sibling} to N% allocation" (3s auto-dismiss)
- Sibling feedings_per_day stays unchanged — only serving_size recalculated
- Only fires for daily food, not treats/supplements
- Non-critical failure: if rebalance fails (offline), primary save already succeeded

### 3. Stepper max unlocked -- DONE
- EditPantryItemScreen: max 5 for all food types
- AddToPantrySheet: max 5 for first/only food (`totalMealsPerDay` tracks stepper). With existing foods, max stays `totalMealsPerDay - 1`.

## What Remains

- **EditPantryItemScreen visual polish** — card anatomy doesn't fully match AddToPantrySheet's matte premium styling (Phase C styles in `AddToPantryStyles.ts` are more polished than EditPantryItem's inline `StyleSheet.create`)
- **`computeAutoServingSize` cleanup** — no longer imported by EditPantryItemScreen. Grep for remaining imports; if zero, safe to delete.
- **17 non-border `Colors.cardBorder` uses** — token decision pending
- **Stale browse scores** — form-aware cache maturity check
