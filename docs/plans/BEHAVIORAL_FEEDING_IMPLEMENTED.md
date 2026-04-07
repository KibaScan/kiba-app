# Behavioral Feeding Architecture — Implementation State

> **Status:** Implemented (Phases 1 & 2 Complete)
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
Replaces `computeMealBasedServing`. It generates the actual serving sizes (e.g., "1.2 cups") by analyzing the `pet`, the `feeding_role`, and the food itself, utilizing the `wet_reserve_kcal` to seamlessly scale back base foods if rotational food exists.

### `evaluateDietCompleteness(petId, petName)`
Instead of a rigid `> 2 daily foods` guard generating a false red-warning alarm, diet completeness now counts the number of `base` foods vs `rotational` foods dynamically against the pet's explicit `feeding_style`. 

---

## 4. Edge Functions / Cron

### `auto-deplete` (Daily Auto-Deductions)
- **Role Awareness:** The cron script explicitly ignores `rotational` items from its static Caloric Accumulator math. 
- **Auto-deplete Flag:** Queries by `auto_deplete_enabled = true` OR `feeding_frequency = 'daily'`.
- **Caloric Accuracy:** Because rotational foods aren't automatically deducted daily, the cron actively queries the new `feeding_log` for the exact timeline bounds (`getTodayBounds`) to add exactly how many rotational calories the pet truly ate that day before adjusting their weight drift accumulator.

---

## 5. UI Architecture & Features

### Setup & Interaction Sheets
- **Feeding Style Picker (`FeedingStyleSetupSheet`):** Shown at cold start / onboarding (first daily food add) to determine the pet's model. Also accessible from PetHubScreen (tappable chip in stats row) and EditPetScreen (tappable row in Card 3) for changing feeding style at any time.
- **"Fed This Today" (`FedThisTodaySheet`):** The primary mechanism for users to fire the `log_wet_feeding_atomic` RPC for their rotational items.

### Pantry Display (`PantryScreen` & `PantryCard`)
- `PantryScreen` visually groups active foods by `feeding_role` (e.g., "Base Diet" vs. "Rotational / Toppers").
- `PantryCard` visually displays a "Fed" checkmark or usage indicator if queried from the `feeding_log` bounds.

### Safe Switch / Vet Reports
- **Safe Switch (`SafeSwitchSetupScreen`):** Transitions now explicitly target a `base` food replacement instead of arbitrary structural slots. 
- **Vet Report (`vetReportService.ts`):** Suppresses artificial static daily kcal counting for `rotational` items, explicitly displaying `"~kcal per unit, rotational"` on the printed PDF while adding the derived `wetReserveKcal` variable to the header for veterinary context. 

---

*This document confirms the Phase 1 & 2 integration and should be referenced to ensure any incoming features map correctly to `feeding_role` or the `feeding_log` tables without regressing to slot fractions.*
