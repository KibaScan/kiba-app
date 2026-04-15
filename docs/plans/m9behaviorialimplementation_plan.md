# Behavioral Feeding Overhaul — Technical Review & Implementation Plan

The current pantry model assumes a predictable, slot-based feeding schedule that doesn't reflect how most owners actually feed. This review evaluates the proposed Behavioral Feeding V2 design against the **current codebase**, identifies risks and gaps, and proposes a phased implementation path.

> **Design doc:** `docs/plans/BEHAVIORAL_FEEDING_DESIGN-2.md`
> **Last updated:** 2026-04-06 (session 28 — gap analysis + design decisions resolved)

## Design Mockups

````carousel
![Pantry Hierarchy - Dark Mode](/Users/stevendiaz/.gemini/antigravity/brain/3dfbedf8-391b-4579-a678-21a783b534d2/behavioral_pantry_hierarchy_1775509469760.png)
<!-- slide -->
![Fed This Today Bottom Sheet](/Users/stevendiaz/.gemini/antigravity/brain/3dfbedf8-391b-4579-a678-21a783b534d2/fed_this_today_sheet_1775509488308.png)
<!-- slide -->
![Feeding Style Setup](/Users/stevendiaz/.gemini/antigravity/brain/3dfbedf8-391b-4579-a678-21a783b534d2/feeding_style_setup_1775509506162.png)
````

---

## 1. What the Design Gets Right

The core thesis is sound — **dry food is the anchor, wet food is the variable**. Specific strengths:

- **Opt-in precision.** The "Fed This Today" model gracefully degrades: if a user never taps it, the estimate-based scoop still works. This is the right default for a consumer app.
- **`feeding_role` on assignment, not product.** This lets the same wet food product be `base` for one pet (wet-only feeder) and `rotational` for another. Good normalization.
- **4-tier kcal resolution chain.** `getWetFoodKcal()` with label → Atwater → size → unknown is robust and mirrors how `resolveCalories()` already works for other contexts.
- **`feeding_log` persistence.** Surviving app restart, enabling vet reports, and keeping schema lightweight (`uuid, uuid, uuid, smallint, timestamp`) is the right call vs. an in-memory accumulator.
- **Scoring engine isolation.** Explicitly stating zero scoring changes de-risks the highest-value system.

---

## 2. Code Blast Radius — What Actually Gets Touched

Every file that currently participates in the meal-fraction model:

| File | Current Role | Change Required |
|---|---|---|
| `src/utils/pantryHelpers.ts` | `computeMealBasedServing`, `computeRebalancedMeals`, `getDefaultMealsCovered`, `computeAutoServingSize`, `computeBudgetWarning`, `pickSlotForSwap` | **Heavy.** Replace meal math with behavioral math. `pickSlotForSwap` → `pickBaseForSwap`. `computeBudgetWarning` → role-aware replacement. |
| `src/services/pantryService.ts` | `addToPantry` (auto `slot_index`), `rebalanceExistingFood`, `pickNextSlotForPet`, `getPantryForPet`, `getPantryAnchor`, `evaluateDietCompleteness` | **Heavy.** `pickNextSlotForPet` → dead. `rebalanceExistingFood` → dead. `getPantryAnchor` returns `feeding_role` instead of `slot_index`. `evaluateDietCompleteness` → feeding-style-aware rewrite. New: `logFedToday` RPC, `refreshWetReserve`. |
| `src/screens/EditPantryItemScreen.tsx` | 1332 lines. `computeMealBasedServing` calls, sibling rebalance, slot badges, meal stepper. | **Heavy.** Rewrite the Feeding card. Remove slot badges. Add role-aware display (base shows scoop, rotational shows "Fed This Today"). |
| `src/components/pantry/AddToPantrySheet.tsx` | 554 lines. Meal-based UX with `totalMealsPerDay`, `mealsCovered`, rebalance target logic. | **Heavy.** Replace meal-based flow with role-assignment flow. First-time trigger for `FeedingStyleSetupSheet`. |
| `src/components/pantry/PantryCard.tsx` | Slot badges (Primary/Secondary/Legacy), calorie context display | **Medium.** Replace slot badges with role badges. Add "Fed" indicator for rotational items. |
| `src/screens/PantryScreen.tsx` | Flat list, diet completeness | **Medium.** Restructure into sectioned list by role. |
| `src/types/pantry.ts` | `PantryPetAssignment` with `slot_index` | **Medium.** Add `feeding_role`, `auto_deplete_enabled`, `calorie_share_pct`. Remove `slot_index`. |
| `supabase/functions/auto-deplete/index.ts` | 826 lines. Cron deducts all daily assignments uniformly. | **Medium.** Add `feeding_role` + `auto_deplete_enabled` filter. Query `feeding_log` for caloric accumulator. |
| `src/services/safeSwitchService.ts` | Uses `pantry_item_id`, `slot_index` for slot-anchored swaps | **Medium.** Resolve to `feeding_role = 'base'` anchors instead of slot-indexed anchors. |
| `src/services/feedingNotificationScheduler.ts` | Schedules local notifications for all `daily` assignments | **Small.** Rotational items set to `feeding_frequency = 'as_needed'` → scheduler skips them automatically. |
| `src/services/vetReportService.ts` | `buildDietItems`, `formatServing` for vet PDF | **Medium.** Rotational items need "~X kcal per [unit], rotational" display. Caloric summary uses DER, notes wet reserve separately. |
| `__tests__/utils/pantryHelpers.test.ts` | 1002 lines. Tests for `computeMealBasedServing`, `computeRebalancedMeals`, `computeAutoServingSize` | **Heavy.** ~100 lines of meal-fraction tests become dead. New behavioral tests needed. |

> [!WARNING]
> **Total blast radius: 12 files, ~6000 lines touched.** The design doc's "~1 sprint" estimate is reasonable for the *new* code but underestimates cleanup of the *existing* meal-fraction code woven through every pantry surface.

---

## 3. Identified Design Gaps

### 3a. `slot_index` → `feeding_role` Migration (Safe Switch)

> [!IMPORTANT]
> The design says "drop `slot_index`" but `slot_index` is used by **Safe Switch** (`safe_switches.pantry_item_id` + slot-based anchor resolution in `getPantryAnchor`, `pickSlotForSwap`, `SafeSwitchSetupScreen`). The design doc doesn't mention Safe Switch at all.

**Impact:** If we drop `slot_index` without updating Safe Switch, `pickSlotForSwap` returns null and the "Switch to this" CTA disappears from ResultScreen.

**Resolution:** `slot_index` gets replaced by `feeding_role = 'base'` as the anchor signal. `pickSlotForSwap` becomes `pickBaseForSwap` and filters by `feeding_role = 'base'`. The slot-based partial unique index can be dropped since `feeding_role` serves the same purpose without the 2-slot cap. ~50 lines across 3 files.

### 3b. `wet_reserve_kcal` Staleness + Trigger List

The design states the reserve recalculates when a wet food is added/removed. But the trigger list is incomplete.

**Resolution:** Service-layer hook `refreshWetReserve(petId)` in `pantryService.ts`. Must fire on **all 5 triggers:**
1. `addToPantry` — new wet food added
2. `removePantryItem` — wet food removed
3. `updatePetAssignment` — when `feeding_role` changes (rotational ↔ base)
4. Manual kcal correction — Tier 4 → user enters kcal
5. `sharePantryItem` / remove-pet-assignment — unsharing a rotational wet food

### 3c. Auto-Deplete Cron Missing `feeding_role`

The cron queries `pantry_pet_assignments` but doesn't select `feeding_role` or `auto_deplete_enabled`. The current query filter at line 368 is `.eq('feeding_frequency', 'daily')`.

**Resolution:** Two changes needed:
1. Add `feeding_role, auto_deplete_enabled` to the select.
2. Change filter from `.eq('feeding_frequency', 'daily')` to `.or('feeding_frequency.eq.daily,auto_deplete_enabled.eq.true')` — ensures opt-in auto-deplete works for rotational items.

### 3d. `wet_only` Multi-Food Semantics — RESOLVED

**Decision: Dynamic Remaining Budget.** Each food card shows: `serving = Math.max(0, DER - daily_wet_fed_kcal) / food_kcal_density`

Each card starts showing full-DER amount. As the user taps "Fed This Today" on any food, ALL cards dynamically recalculate to show the remaining budget. This reuses the exact same `daily_wet_fed_kcal` accumulator pattern from `dry_and_wet` mode.

Example (cat, 200 kcal DER, Chicken 100 kcal/can, Beef 100 kcal/can):
- Morning: Both cards show "2 cans/day"
- User feeds 1 can Chicken → `daily_wet_fed_kcal = 100`
- Evening: Both cards show "1 can remaining"

The design doc's pseudocode at line 282-284 needs updating (see Section 7).

### 3e. `custom` Mode UX — DEFERRED

**Decision:** Defer `custom` mode UI to follow-up. Ship `dry_only`, `dry_and_wet`, and `wet_only` first. Include `'custom'` in the CHECK constraint day-1 so no future ALTER TABLE needed. The `calorie_share_pct` column is already proposed and ships with the migration.

### 3f. "Fed This Today" Undo Mechanism

The `log_wet_feeding_atomic` RPC inserts to `feeding_log` AND decrements inventory atomically.

**Resolution:** Two RPCs needed:
- `log_wet_feeding_atomic(...)` → must `RETURN UUID` (not VOID) so the client gets the `log_id` for undo.
- `undo_wet_feeding_atomic(log_id UUID)` → deletes the feeding_log row and re-increments inventory.

The undo Toast stores the returned UUID and passes it to the undo RPC within 5 seconds.

### 3g. Feeding Notification Scheduler [NEW — HIGH]

`rescheduleAllFeeding()` at `feedingNotificationScheduler.ts:147` queries all `daily` assignments and schedules local push notifications for each `feeding_times` entry. It has no concept of `feeding_role`. Rotational wet foods would get daily feeding reminders for food the user may or may not feed today.

**Resolution:** Set rotational items to `feeding_frequency = 'as_needed'` during add-to-pantry. The scheduler's existing `.eq('feeding_frequency', 'daily')` filter skips them automatically. Zero scheduler code changes needed.

### 3h. Diet Completeness Evaluation [NEW — MEDIUM]

`evaluateDietCompleteness()` fires `red_warning` when `completeFoods.length > 2`. A `dry_and_wet` pet with 1 dry + 5 rotational wet = 6 daily foods → false alarm. A `dry_and_wet` pet with only rotational wet (no dry base) shows `complete` → wrong.

**Resolution:** Rewrite to be feeding-style-aware:
- `dry_only`: complete if ≥1 base dry food
- `dry_and_wet`: complete if ≥1 base food (dry)
- `wet_only`: complete if ≥1 rotational OR base wet food (base is optional in `wet_only`)
- Count `base` roles, not raw daily food count. "Too many" check applies to base roles only.

### 3i. Vet Report PDF [NEW — MEDIUM]

`buildDietItems()` sums every food's `daily_kcal` for the caloric summary. Rotational wet foods have no fixed daily kcal — they'd either show 0 or full DER (double-counted). `formatServing()` shows "1 can x 2/day" for rotational food with no fixed schedule.

**Resolution:** Rotational items display "~X kcal per [unit], rotational" instead of a daily serving. Caloric summary uses DER as total, noting wet reserve separately. Optionally include average weekly wet food kcal from `feeding_log` history.

### 3j. Caloric Accumulator in Auto-Deplete Cron [NEW — HIGH]

D-161 accumulator at `auto-deplete/index.ts:457-485` sums `serving_size × feedings_per_day × kcal_per_cup` for every `daily` assignment. Rotational wet foods set to `as_needed` are invisible to this sum. The accumulator would underestimate daily intake whenever wet food is actually fed.

**Resolution:** The cron's accumulator section must query `feeding_log` for today's entries per pet:
```sql
SELECT SUM(kcal_fed) FROM feeding_log
WHERE pet_id = $1 AND fed_at >= today_start_utc AND fed_at < today_end_utc
```
Then: `dailyKcal = cron_dry_kcal + feeding_log_wet_kcal`. If no feeding_log entries exist, use `wet_reserve_kcal` as estimate (matching client-side behavior). Requires cron to read `pets.feeding_style` and `pets.wet_reserve_kcal`.

### 3k. `computeBudgetWarning` Obsolescence [NEW — LOW]

Current overbudget warnings are meal-fraction-based. Under behavioral feeding, rotational items can't push over budget (their kcal IS the reserve).

**Resolution:** Replace with `computeBehavioralBudgetWarning()`:
- For `base` items: warns if total base kcal > `DER - wet_reserve_kcal`
- For `rotational` items: never warns
- For `dry_only`: warns if total base kcal > DER

### 3l. Safe Switch + Behavioral Serving Coexistence [NEW — LOW]

During a 7-day transition, `computeBehavioralServing()` would show the steady-state scoop, but the transition has mix ratios (75/25, etc.). `SafeSwitchDetailScreen` owns display during transitions, so this is manageable.

**Resolution:** Add `isInTransition` guard to `computeBehavioralServing()` output so callers know to defer to transition display.

### 3m. Midnight Reset Helper [NEW — SMALL]

The design says "device timezone" for "Fed" badge reset and `feeding_log` daily aggregation, but no helper function is specified.

**Resolution:** Add `getTodayBounds(timezone: string): { start: Date, end: Date }` to `pantryHelpers.ts`. Converts local midnight boundaries to UTC for `feeding_log` queries. Pure, tested function. Prevents inconsistent timezone math.

---

## 4. Safe Switch Compatibility

| Safe Switch Surface | Current Behavior | Post-Behavioral Behavior |
|---|---|---|
| `pickSlotForSwap` | Picks lowest-score slot (0 or 1) | Picks lowest-score `feeding_role = 'base'` item |
| `getPantryAnchor` | Filters `daily_food` + `!supplemental` + `!vet_diet`, returns `slot_index` | Same filter but returns `feeding_role` instead of `slot_index` |
| `SafeSwitchSetupScreen` | Shows slot 0 vs slot 1 picker | Shows base food picker (or auto-selects if only one base) |
| `complete_safe_switch_with_pantry_swap` RPC | Swaps `pantry_items.product_id` + applies serving size (migrations 032-033) | Same — this RPC is slot-agnostic, already applies serving size |
| Result Screen "Switch to this" CTA | Checks `getPantryAnchor` returns ≥ 1 anchor | Same check, different column |

**Net Safe Switch work:** ~3 files, ~50 lines. Merged into Phase 2 (not a separate phase).

---

## 5. Design Decisions — RESOLVED

### Q-1: `wet_only` Multi-Food → Dynamic Remaining Budget
`serving = Math.max(0, DER - daily_wet_fed_kcal) / food_kcal_density`. No divide-by-count. Same pattern as `dry_and_wet` dry food adjustment.

### Q-2: `feeding_role` in `wet_only` → Base Is Optional
Leave wet foods as `rotational` when switching to `wet_only`. If no base foods exist, hide "Daily Base" section — "Wet Food Rotation" becomes primary. No auto-flip on style change.

### Q-3: Treat Battery → Leave As-Is
Treat budget derives from pet DER (unchanged). Out of scope.

### Q-4: Notifications → Skip Rotational
Rotational items get `feeding_frequency = 'as_needed'` → no feeding-time reminders. Low-stock/empty push notifications continue through cron path.

### Q-5: `custom` Mode → Deferred
Include ENUM value in schema, don't build UI. Ships without future migration.

---

## 6. Recommended Phased Implementation

### Phase 1: Schema + Math Engine (No UI changes)

- **Migration 034:** Add `feeding_style`, `wet_reserve_kcal`, `wet_reserve_source` to `pets`. Add `feeding_role`, `auto_deplete_enabled`, `calorie_share_pct` to `pantry_pet_assignments`. Create `feeding_log` table + RLS + index `(pet_id, fed_at)`. Create `log_wet_feeding_atomic` RPC (`RETURNS UUID`). Create `undo_wet_feeding_atomic` RPC. Drop `slot_index` partial unique index, add `feeding_role` to schema.
- Implement `computeBehavioralServing()` in `pantryHelpers.ts` alongside existing functions (no deletion yet).
- Implement `getWetFoodKcal()` — 4-tier resolution chain.
- Implement `getTodayBounds(timezone)` — midnight reset helper.
- Implement `computeBehavioralBudgetWarning()` — role-aware replacement.
- Full test suite for all new functions.
- **Ship criteria:** All new tests green, all existing tests untouched.

### Phase 2: UI + Cron + Safe Switch Adaptation

- `FeedingStyleSetupSheet` (new component).
- `FedThisTodaySheet` (new component).
- Rewire `PantryScreen` to section by role.
- Rewire `PantryCard` — role badges + "Fed" indicator.
- Rewire `AddToPantrySheet` — role-based flow, set rotational to `feeding_frequency = 'as_needed'`.
- Rewire `EditPantryItemScreen` — behavioral serving display.
- Rewrite `evaluateDietCompleteness` — feeding-style-aware.
- Update `vetReportService.ts` — rotational display format.
- Update auto-deplete cron — `feeding_role`/`auto_deplete_enabled` filter + `feeding_log` query for caloric accumulator.
- Replace `slot_index` with `feeding_role` in Safe Switch (`getPantryAnchor`, `pickSlotForSwap` → `pickBaseForSwap`, `SafeSwitchSetupScreen`).
- Add `refreshWetReserve(petId)` to all 5 trigger callsites.
- Delete old meal-fraction functions + tests.
- **Ship criteria:** End-to-end manual test of `dry_only`, `dry_and_wet`, `wet_only`. Cron respects roles. Safe Switch works with base anchors. Vet report shows rotational items correctly.

---

## 7. Corrected `computeBehavioralServing` Pseudocode

The design doc's pseudocode needs these corrections based on resolved design decisions:

```
dry_only:
  dry_budget = DER
  serving = (dry_budget × dry_food_split_pct) / food_kcal_density

dry_and_wet (base food):
  wet_actual = daily_wet_fed_kcal > 0 ? daily_wet_fed_kcal : wet_reserve_kcal
  dry_budget = Math.max(0, DER - wet_actual)
  serving = (dry_budget × dry_food_split_pct) / food_kcal_density

dry_and_wet (rotational food):
  // No serving calc — display "~[kcal] per [unit]", "Fed This Today" button

wet_only (ALL foods, regardless of role):              ← CHANGED
  remaining = Math.max(0, DER - daily_wet_fed_kcal)   ← CHANGED
  serving = remaining / food_kcal_density              ← CHANGED
  // Dynamic: recalculates as user logs "Fed This Today"

custom:
  serving = user_entered_kcal / food_kcal_density
```

Key change: `wet_only` uses the same dynamic remaining budget pattern as `dry_and_wet`'s base food, applied to every food. No static `DER / kcal` — always `(DER - logged_today) / kcal`.

---

## 8. Gap Summary Scorecard

| Gap | Severity | Effort | Phase |
|-----|----------|--------|-------|
| 3a: `slot_index` → Safe Switch | HIGH | Small (~50 lines) | Phase 2 |
| 3b: `wet_reserve_kcal` triggers | MEDIUM | Small (5 callsites) | Phase 2 |
| 3c: Cron missing `feeding_role` | MEDIUM | Small (2-line query) | Phase 2 |
| 3d: `wet_only` semantics | HIGH | Resolved → dynamic budget | Phase 1 |
| 3e: `custom` mode | LOW | Deferred | N/A |
| 3f: Undo RPC return type | MEDIUM | Small (1 line) | Phase 1 |
| 3g: Feeding notifications | HIGH | Small (0 code — role sets frequency) | Phase 2 |
| 3h: Diet completeness | MEDIUM | Medium (rewrite) | Phase 2 |
| 3i: Vet report PDF | MEDIUM | Medium (new format) | Phase 2 |
| 3j: Caloric accumulator | HIGH | Medium (cron query + logic) | Phase 2 |
| 3k: Budget warning obsolescence | LOW | Small (replace) | Phase 1 |
| 3l: Safe Switch + behavioral coexist | LOW | Small (guard) | Phase 2 |
| 3m: Midnight reset helper | LOW | Small (1 function) | Phase 1 |

---

## 9. Verification Plan

### Automated Tests
- `computeBehavioralServing` — all 3 feeding styles × edge cases (zero DER, missing kcal, wet exceeds DER, active Safe Switch).
- `getWetFoodKcal` — all 4 tiers.
- `getTodayBounds` — timezone boundary correctness, DST transitions.
- `refreshWetReserve` — weighted average with mixed inventory counts.
- `computeBehavioralBudgetWarning` — role-aware logic for each feeding style.
- Regression: `realDataTrace.test.ts` and scoring tests pass unchanged.

### Manual Verification
- iOS Simulator: Create pet → first pantry add triggers `FeedingStyleSetupSheet` → select `dry_and_wet` → add dry food (base) → add wet food (rotational) → verify dry scoop accounts for wet reserve → tap "Fed This Today" → verify dry scoop recalculates.
- `wet_only` mode: Add 2 wet foods → both show full DER → log one → both recalculate to remaining budget.
- Verify auto-deplete cron skips rotational wet foods with `auto_deplete_enabled = false`.
- Verify cron accumulator includes `feeding_log` entries in daily kcal sum.
- Verify Safe Switch works with a `feeding_role = 'base'` anchor.
- Verify feeding notifications skip rotational items.
- Verify diet completeness banner is correct for each feeding style.
- Verify vet report shows rotational items as "~X kcal per [unit], rotational."
