# Behavioral Feeding Architecture — Implementation State

> **Status:** Implemented (Phases 1, 2 & 3 Complete + Phase 1 Expansion)
> **Goal:** This document serves as the master source of truth for the implemented Behavioral Feeding Architecture, replacing the legacy slot-based meal fraction model. If picking up this session or onboarding, read this to understand how feeding routing, calorie math, and the database behave.

---

## 1. Core Paradigm Shift

We completely stripped out the legacy `slot_index` array system and `rebalanceExistingFood` fraction logic. The system has moved from **predictive rigid slots** to **behavioral roles**. 

Instead of dividing DER (Daily Energy Requirement) equally across an arbitrary number of slots, the system now asserts:
**Dry food is the anchor. Wet food is the rotational variable.**

### The Feeding Styles (`pets` table)
Every pet has a strictly typed `feeding_style` which dictates the application's math:
- `dry_only`: 100% DER → base dry food.
- `dry_and_wet`: (DER − Wet Reserve Kcal) → base dry food scoop. Wet food is rotational.
- `wet_only`: Dynamic remaining budget — `serving = Math.max(0, DER - daily_wet_fed_kcal) / food_kcal_density`. Base food is optional in this mode.
- `custom`: Opt-in manual splits (deferred — spec at `docs/plans/PHASE_3_CUSTOM_FEEDING_PLAN.md`).

---

## 2. Database Schema Details (Migration 034)

### `pets` Enhancements
- `feeding_style` (enum: `dry_only`, `dry_and_wet`, etc.)
- `wet_reserve_kcal` (integer) — Tracks the aggregate average kcal of a pet's active rotational wet foods.
- `wet_reserve_source` (varchar) — Tracks the confidence tier (e.g., `label`, `blended`, `estimated`).

### `pantry_pet_assignments` Refactoring
- **Dropped:** The `slot_index` column and its associated partial unique indexes.
- **Added:** `feeding_role` (`base` | `rotational`).
- **Added:** `auto_deplete_enabled` (boolean) — Coexists with `feeding_frequency`. Rotational items get `feeding_frequency: 'as_needed'` (skips notifications) AND `auto_deplete_enabled: false` (skips cron). Users can opt rotational items into auto-depletion by flipping `auto_deplete_enabled: true`.
- **Added:** `calorie_share_pct` (integer) — For breaking ties in multi-base distributions.

### `feeding_log` Table 
Since rotational foods don't have predictable daily occurrences, their usage is logged directly:
- Schema: `id`, `pet_id`, `pantry_item_id`, `user_id`, `kcal_fed`, `fed_at`.
- RLS enforced.
- **RPCs:** `log_wet_feeding_atomic()` and `undo_wet_feeding_atomic()` natively increment/decrement `quantity_remaining` on the `pantry_items` table atomically while logging the event.

---

## 3. Math & Service Layer (`pantryHelpers.ts` & `pantryService.ts`)

### `refreshWetReserve(petId)`
When a user adds, removes, updates, or unshares a wet food to/from a pet's pantry, this service runs a **weighted average** of all the pet's active rotational wet foods multiplied by their inventory. It then sets `wet_reserve_kcal` and `wet_reserve_source` on the `pets` row.

### `getWetFoodKcal(product)`
Extracts raw caloric value via a 4-tier resolution chain (delegates to `resolveCalories` for tiers 1-3, adds tier 4):
1. **Tier 1:** Scraped `kcal_per_kg` (label) → derive `kcal_per_unit` via `unit_weight_g`.
2. **Tier 2:** Scraped `kcal_per_cup` (label) → use `product.kcal_per_unit` directly.
3. **Tier 3:** Atwater estimation from GA macros (Modified NRC factors) → derive `kcal_per_unit` via `unit_weight_g`.
4. **Tier 4:** Size-based fallback — parse product name for weight ("3 oz", "5.5 oz"), apply ~1 kcal/gram generic wet food average. Source: `'size_fallback'`.
Returns `null` if all 4 tiers fail (UI falls back to manual serving input in AddToPantrySheet).

### `computeBehavioralServing()`
Replaces `computeMealBasedServing`. It generates the actual serving sizes (e.g., "1.2 cups") by analyzing the `pet`, the `feeding_role`, and the food itself, utilizing the `wet_reserve_kcal` to seamlessly scale back base foods if rotational food exists. For `custom` mode, uses full DER as budget with `calorie_share_pct` applied via the `dryFoodSplitPct` parameter.

### `rebalanceBaseShares(petId)` *(pantryService.ts)*
Auto-splits `calorie_share_pct` evenly across all base-role assignments for a pet (e.g., 2 bases → 50/50, 3 → 33/33/34). Also scales `serving_size` proportionally so the displayed amount matches the new share. Called after `addToPantry`, `removePantryItem`, and `sharePantryItem`. **Skipped when `feeding_style === 'custom'`** — user controls splits manually via `CustomFeedingStyleScreen`.

### `evaluateDietCompleteness(petId, petName)`
Instead of a rigid `> 2 daily foods` guard generating a false red-warning alarm, diet completeness now counts the number of `base` foods vs `rotational` foods dynamically against the pet's explicit `feeding_style`. For `custom` mode: `hasAnyDaily` = complete (no further enforcement — users explicitly control allocation). 

---

## 4. Edge Functions / Cron

### `auto-deplete` (Daily Auto-Deductions)
- **Role Awareness:** The cron script explicitly ignores `rotational` items from its static Caloric Accumulator math. 
- **Auto-deplete Flag:** Queries by `auto_deplete_enabled = true` OR `feeding_frequency = 'daily'`.
- **Caloric Accuracy:** Because rotational foods aren't automatically deducted daily, the cron actively queries the new `feeding_log` for the exact timeline bounds (`getTodayBounds`) to add exactly how many rotational calories the pet truly ate that day before adjusting their weight drift accumulator.

---

## 5. UI Architecture & Features

### Setup & Interaction Sheets
- **Feeding Style Picker (`FeedingStyleSetupSheet`):** Shown at cold start / onboarding (first daily food add) to determine the pet's model. Also accessible from PetHubScreen (tappable chip in stats row) and EditPetScreen (tappable row in Card 3) for changing feeding style at any time. **4 options:** Dry food only, Mixed feeding, Wet food only, Custom split.
- **Mismatch Detection (AddToPantrySheet):** When a user adds a non-dry food to a `dry_only` pet (or dry to `wet_only`), the `FeedingStyleSetupSheet` re-appears to prompt for a style change. Prevents silently misclassifying foods.
- **"Fed This Today" (`FedThisTodaySheet`):** The primary mechanism for users to fire the `log_wet_feeding_atomic` RPC for their rotational items.

### Custom Feeding Configuration (`CustomFeedingStyleScreen`)
- Full-screen configuration for manual calorie splits when `feeding_style === 'custom'`.
- Shows pet's DER at top, lists all daily foods with `<TextInput>` for raw kcal/day per food.
- Each input has a computed % badge. Visual sum bar at bottom warns if significantly over/under DER (no hard enforcement).
- On save: converts each kcal to `calorie_share_pct = Math.round((kcal / DER) * 100)`, calls `updateCalorieShares()`.
- Scale-invariant: stores percentages, not raw kcal. If DER changes (weight goal adjustment), allocations auto-adjust.
- **Entry points:** PetHubScreen (auto-navigates on custom select), EditPetScreen (auto-navigates on save), PantryScreen header icon ("Configure splits" button, visible when `feeding_style === 'custom'`).
- Registered in both `PantryStackParamList` and `MeStackParamList`. Tab bar hidden on this screen.

### Pantry Display (`PantryScreen` & `PantryCard`)
- `PantryScreen` visually groups active foods by `feeding_role` (e.g., "Base Diet" vs. "Rotational / Toppers").
- `PantryCard` visually displays a "Fed" checkmark or usage indicator if queried from the `feeding_log` bounds.
- `PantryCard` shows calorie context line (e.g., "33% of daily target (~143 kcal)") derived from `getCalorieContext()`. Depends on product having resolvable calorie data.

### Safe Switch / Vet Reports
- **Safe Switch (`SafeSwitchSetupScreen`):** Transitions now explicitly target a `base` food replacement instead of arbitrary structural slots. **Disabled for `custom` mode** — users explicitly control their diet splits.
- **Vet Report (`vetReportService.ts`):** Suppresses artificial static daily kcal counting for `rotational` items, explicitly displaying `"~kcal per unit, rotational"` on the printed PDF while adding the derived `wetReserveKcal` variable to the header for veterinary context. 

---

---

## 6. Custom Feeding Mode (Phase 3)

Unblocks the `'custom'` feeding style for users who need manual control over calorie splits (e.g., raw + freeze-dried, two kibbles at specific ratios).

### Database
- **No new columns or migrations.** `custom` already exists in the `FeedingStyle` type union and DB CHECK constraint. `calorie_share_pct` column already exists on `pantry_pet_assignments`.

### Service Layer (`pantryService.ts`)
- **`updateCalorieShares(petId, shares[])`** — batch updates `calorie_share_pct` for multiple assignments. Used by `CustomFeedingStyleScreen` to save user-defined splits.
- **`transitionToCustomMode(petId)`** — sets `feeding_style: 'custom'`, converts all daily food assignments to `feeding_role: 'base'`, `feeding_frequency: 'daily'`, `auto_deplete_enabled: true`, with equal `calorie_share_pct` split.
- **`transitionFromCustomMode(petId, newStyle)`** — sets new feeding style, resets all `calorie_share_pct` to 100, re-infers `feeding_role` per new style (requires join to `products.product_form`), calls `rebalanceBaseShares` + `refreshWetReserve`.

### Math
- `computeBehavioralServing`: custom branch uses `budgetedKcal = der` (full DER), then the existing `dryFoodSplitPct / 100` multiplier applies the per-item `calorie_share_pct`.
- `rebalanceBaseShares`: **skipped** for custom (guard at top of function checks `feeding_style`).
- `refreshWetReserve`: correctly no-ops (guards `!== 'dry_and_wet'`).
- `evaluateDietCompleteness`: custom branch already exists (`hasAnyDaily` = complete).

### Downstream Systems (No Changes)
- **Auto-deplete cron:** custom items are all `base` → included in daily depletion (filter is `!== 'rotational'`).
- **Vet report:** custom items are `base` → show full `dailyKcal`.
- **`FedThisTodaySheet`:** irrelevant (no rotational items in custom mode).
- **`computeBehavioralBudgetWarning`:** works (warns based on total base kcal vs DER).

### Adding Food in Custom Mode
- Role inference falls through to `'base'` (correct — custom has no rotational concept).
- New food gets `calorie_share_pct: 100` (default). Total allocation temporarily >100%.
- `rebalanceBaseShares` is skipped. User adjusts via "Configure splits" on PantryScreen.
- Safe Switch is **disabled** for custom mode (`pet.feeding_style !== 'custom'` guard in AddToPantrySheet).

---

## 7. Phase 1 Expansion — Widened Inference

### Problem
Role inference in `AddToPantrySheet` only assigned `rotational` to `product_form === 'wet'`. Freeze-dried, raw, dehydrated, air-dried, and fresh foods all fell through to `base` even when used rotationally.

### Fix
Changed inference from `product.product_form === 'wet'` to `product.product_form !== 'dry'` — anything non-kibble becomes the rotational variable in mixed-feeding mode.

### UI Labels
- `dry_and_wet` renamed to **"Mixed feeding"** in UI only (DB enum unchanged).
- Labels updated in `FeedingStyleSetupSheet` ("Mixed feeding"), `PetHubScreen` ("Mixed"), `EditPetScreen` ("Mixed feeding").

### Mismatch Detection
Added form-mismatch guard in `AddToPantrySheet`: when adding a non-dry food to a `dry_only` pet (or dry to `wet_only`), the `FeedingStyleSetupSheet` re-appears to prompt for a style change. Previously only fired on first-ever daily food add.

---

---

## 8. Known Edge Cases & Pre-Launch Fixes

Five edge cases identified during implementation review. Ordered by severity.

### EC-1: Custom Mode "100% Default" Overfeeding Spike (**FIXED — session 30**)

**Problem:** When a user adds a new food in custom mode, it defaults to `calorie_share_pct: 100` and `rebalanceBaseShares` is skipped. If a pet has 400 kcal DER split 50/50 between two foods and the user adds a third, the system computes servings for 250% of DER. If the user closes the app without configuring splits, auto-deplete and serving displays instruct double-feeding.

**Root cause:** `addToPantry()` inserts `calorie_share_pct: input.calorie_share_pct ?? 100`. Custom mode skips `rebalanceBaseShares`, so the 100% default sticks.

**Fix:** `addToPantry()` now queries `pets.feeding_style`. When `custom`, defaults `calorie_share_pct` to 0 instead of 100. PantryCard shows "0 cups — configure splits" which is safe. User allocates via `CustomFeedingStyleScreen`.

**Files:** `pantryService.ts:91-92` (`addToPantry` — queries feeding_style, conditional default).

### EC-2: Bulk vs. Discrete Averaging Trap (**FIXED — session 30**)

**Problem:** `refreshWetReserve()` uses `getWetFoodKcal()` which returns **kcal per unit** (per package). For discrete items (cans/pouches), 1 unit ≈ 1 serving ≈ 80–150 kcal — the weighted average is sensible. But Phase 1 Expansion made freeze-dried, raw, and fresh foods rotational. A 5lb freeze-dried bag has `kcal_per_unit` of ~10,000 kcal. If this enters the average, the reserve spikes massively, forcing `computeBehavioralServing` to compute `Math.max(0, DER - 10000) = 0` → dry food serving becomes 0 cups.

**Root cause:** `getWetFoodKcal` Tier 1 derives kcal from `kcal_per_kg * unit_weight_g / 1000`. For a 5lb bag, `unit_weight_g = 2268`, so the result is the entire bag's calories.

**Fix:** `refreshWetReserve` now caps per-unit kcal at `MAX_SERVING_KCAL = 500` before entering the weighted average. A single wet/rotational serving is never 500+ kcal — anything above is clearly per-package (bulk freeze-dried, raw bags). The cap is applied at the reserve calculation level, not in `getWetFoodKcal` itself, preserving the helper's accuracy for other callers.

**Files:** `pantryService.ts:761-762` (`refreshWetReserve` — `MAX_SERVING_KCAL` constant + `Math.min` clamp).

### EC-3: Mismatch Detection False Positive on Supplements (**FIXED — session 30**)

**Problem:** The mismatch detection in `AddToPantrySheet` fires when `product_form !== 'dry'` and `feeding_style === 'dry_only'`. A salmon oil supplement or liquid probiotic is non-dry but should NOT trigger "Change your feeding style?" — it's a supplement, not a diet change.

**Root cause:** The mismatch guard checks `if (!visible || treat) return;` — treats are excluded. But supplements go through the daily food path if `product.category === 'daily_food'` or `is_supplemental === true`. The `is_supplemental` flag is not checked in the mismatch condition.

**Fix:** Added `!product.is_supplemental` guard to the `isMismatch` condition. Supplements now bypass mismatch detection entirely.

**File:** `AddToPantrySheet.tsx:161` — `!product.is_supplemental &&` prepended to the mismatch check.

### EC-4: Divide-by-Zero in refreshWetReserve (**LOW — partially mitigated**)

**Problem:** When all rotational items have `quantity_remaining = 0` (user fed the last unit), the weighted average denominator could be 0.

**Current mitigation:** Line 764: `const qtyContext = item.quantity_remaining && item.quantity_remaining > 0 ? item.quantity_remaining : 1`. Falls back to 1, preventing true division by zero. The try-catch at the function level also prevents crashes.

**Residual issue:** Falling back to `1` when inventory is empty means the reserve holds at the per-unit kcal, which is incorrect (especially for bulk items per EC-2). A better fallback: use simple unweighted average `SUM(kcal) / COUNT(*)` when total inventory is 0.

**File:** `pantryService.ts` (`refreshWetReserve`, line 764 and 773).

### EC-5: Custom Mode "Zero-Sum" Limitation (**ACCEPTED — document only**)

**Problem:** `transitionToCustomMode` converts all daily foods to `feeding_role: 'base'`, eliminating the "Fed This Today" rotational button. A user wanting 60% Kibble A / 40% Kibble B + a rotational wet topper cannot express this. They must choose between:
- `dry_and_wet` — auto-splits kibble 50/50 (wrong ratio), wet food is rotational (correct)
- `custom` — allows 60/40 kibble split (correct), but wet food becomes base (loses Fed This Today UX)

**Status:** Accepted MVP limitation. No fix needed for V1.

**V2 path:** Custom mode should allow per-item `feeding_role` override, letting users mark specific foods as rotational within custom mode. Logged rotational kcal would subtract from the custom kibble budgets instead of being excluded from serving math entirely.

---

*This document confirms the full behavioral feeding integration (Phases 1–3 + Expansion) and should be referenced to ensure any incoming features map correctly to `feeding_role`, `calorie_share_pct`, or the `feeding_log` tables without regressing to slot fractions.*
