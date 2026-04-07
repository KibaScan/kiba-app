# Phase 3: Custom Feeding Style Setup

The goal of this phase is to unblock the deferred `'custom'` feeding style, allowing users to explicitely assign calorie amounts to individual foods in their pet's pantry using actual numerical text inputs, while allowing the app to dynamically scale those amounts up or down if the pet's weight goal (DER) ever changes.

## Proposed Changes

### `src/utils/pantryHelpers.ts`
Fully implement the `custom` logic branch in `computeBehavioralServing`. 
- Currently `custom` returns `null` (Deferred).
- Will update it to utilize the `calorie_share_pct` argument. 
- `budgetedKcal = der; finalKcal = budgetedKcal * (calorie_share_pct / 100);`
- Update `computeBehavioralServing` parameters to directly accept `itemCalorieSharePct` (drawn directly from `pantry_pet_assignments.calorie_share_pct`) rather than the broader `dryFoodSplitPct`. 

### `src/components/pantry/FeedingStyleSetupSheet.tsx`
- Add the 4th option for "Custom Split" (`custom`).
- Description: "Explicitly set calorie amounts per food."

### `src/screens/CustomFeedingStyleScreen.tsx` [NEW]
Create a brand new configuration screen (routed to when `custom` is selected).
- Displays the pet's total daily requirement (DER) at the top.
- Loads all active daily foods assigned to the pet.
- For each food, shows a `<TextInput>` for raw `kcal/day`.
- **Under the hood:** The typed raw kcal amount is dynamically converted back to a percentage of the pet's DER `(entered_kcal / DER) * 100`. This scales beautifully so if the pet later loses weight and their DER shrinks, their manual splits automatically shrink correctly without them having to reconfigure the Custom page.
- At the bottom, displays a visual sum: "Total: 450 / 500 kcal allocated". It will not enforce a 100% hard limit (users can overfeed or underfeed intentionally per the design doc's medical flexibility guideline), but will visually warn if significantly under or over.
- Tapping "Save" updates `pantry_pet_assignments.calorie_share_pct` for every item in the list, and flips `pets.feeding_style` to `'custom'`, then pops the screen.

### UX Integration Hooks
Update wherever `FeedingStyleSetupSheet` is invoked (like `AddToPantrySheet` and `EditPantryItemScreen`) to intercept `'custom'` selections and route seamlessly to the new `CustomFeedingStyleScreen` instead of immediately changing the database state. 

## Gaps Identified (Audit Review)

### Gap 1: Navigation registration
`CustomFeedingStyleScreen` is not mentioned in `src/types/navigation.ts`. It needs route params added to `MeStackParamList` and/or `PantryStackParamList` (reachable from both AddToPantrySheet in Pantry stack and EditPetScreen/PetHubScreen in Me stack), plus registration in the navigator.

### Gap 2: Adding NEW food in custom mode
When `feeding_style === 'custom'` and user adds a food via `AddToPantrySheet`, the plan doesn't specify:
- What `feeding_role` does the new item get? (Probably `'base'` since custom mode has no rotational concept.)
- What initial `calorie_share_pct`? (0? Equal split with existing? Remainder of unallocated DER?)
- Should the flow auto-navigate to `CustomFeedingStyleScreen` after adding so the user can set the kcal split?

### Gap 3: Mode transition behavior
- **Switching TO custom from `dry_and_wet`**: Existing rotational items have `calorie_share_pct: 100` (the default). Their kcal share needs initialization — probably from each item's `getWetFoodKcal()` result or from `wet_reserve_kcal`. Otherwise the config screen opens with meaningless 100% defaults on every item.
- **Switching AWAY from custom**: The custom `calorie_share_pct` values stay on assignments. Should they reset to 100? If not, switching to `dry_only` and back to `custom` resurrects stale splits.

### Gap 4: `computeBehavioralServing` parameter rename is incomplete
The plan says replace `dryFoodSplitPct` with `itemCalorieSharePct`. But `dryFoodSplitPct` is used by the non-custom branches too (line 329: `budgetedKcal * (dryFoodSplitPct / 100)`). The rename must preserve existing behavior for `dry_only`/`dry_and_wet`/`wet_only` or their call sites break.

### Gap 5: Downstream systems not addressed
- **`computeBehavioralBudgetWarning`**: Currently returns null for rotational. What does it do in custom mode? Warn per-item if kcal exceeds the item's allocated share?
- **Auto-deplete cron** (`supabase/functions/auto-deplete/index.ts`): Custom items are all effectively "base" — does the cron treat them as daily depletions? The cron currently filters by `feeding_role !== 'rotational'` for the accumulator.
- **Vet report** (`vetReportService.ts`): Currently distinguishes base vs rotational display. Custom mode needs its own display — probably "Custom split: X kcal/day (Y% of DER)" per item.
- **`FedThisTodaySheet`**: Irrelevant if no rotational items in custom mode. But should custom users still be able to log ad-hoc feedings?
- **`refreshWetReserve`**: Guards on `feeding_style !== 'dry_and_wet'` and returns early. Correct for custom mode (user manually sets kcal), but should be documented.

### Gap 6: Test plan missing
Need tests for:
- `computeBehavioralServing` custom branch (`budgetedKcal = der * (calorie_share_pct / 100)` → convert to serving units)
- kcal-to-pct conversion math (`entered_kcal / DER * 100`)
- Round-trip scaling: set 300 kcal on a 1000 DER pet → `calorie_share_pct = 30` → DER changes to 800 → serving auto-adjusts to 240 kcal
- Edge cases: 0% share, share sum > 100%, share sum < 50%

### Dependency: Phase 1 inference widening
`docs/specs/FEEDING_STYLE_EXPANSION_SPEC.md` Phase 1 (widen role inference to `product_form !== 'dry'` instead of `=== 'wet'`) should ship before Phase 3. It's a one-line change that covers 80% of freeze-dried/raw/fresh edge cases without the full custom mode complexity.

## Open Questions

1. **Diet Completeness Rules in Custom Mode:** Currently, in `custom` mode, the engine evaluates completion simply as: `hasAnyDaily` (1 or more daily foods = Complete). **Recommendation:** Keep `hasAnyDaily` as complete. Don't enforce 80% — users in custom mode are explicitly choosing their allocation. Warn visually on the config screen, don't gate completeness.
2. **Accessing the Screen:** Aside from the setup sheet, should users be able to reopen `CustomFeedingStyleScreen` via a button on the `PantryScreen` header when they are already in custom mode to quickly tweak their numbers? **Recommendation:** Yes — add a "Configure splits" button to PantryScreen header when `feeding_style === 'custom'`. Otherwise there's no way back to the config screen without going through EditPetScreen → FeedingStyleSetupSheet → re-select custom.
