# Behavioral Feeding Architecture Update

This walkthrough covers the technical execution for the transition from the legacy meal-based fraction system to the new **Behavioral Feeding Architecture** (Phase 1 and the first half of Phase 2).

## 1. Schema & Math Engine Fundamentals (Phase 1)
We overhauled the foundational schema and computational logic to treat dry food as a flexible calorie anchor and wet food as a daily rotational variable.

### Database Updates (Migration 034)
* **Pets Table**: Added `feeding_style` (`dry_only`, `dry_and_wet`, `wet_only`), `wet_reserve_kcal`, and `wet_reserve_source`.
* **Pantry Assignments**: Replaced the rigid `slot_index` model with semantic `feeding_role` ('base', 'rotational', 'treat'). Added `auto_deplete_enabled` and `calorie_share_pct`.
* **Feeding Log**: Introduced atomic tracking for rotational feeding via a new `feeding_log` table, equipped with RPCs (`log_wet_feeding_atomic`, `undo_wet_feeding_atomic`) to synchronize feeding events directly with inventory depletion.

### Core Calculations (`pantryHelpers.ts`)
* **`computeBehavioralServing`**: The new math engine dynamically computes daily dry food serving size by subtracting daily wet-food caloric intake from the pet's Daily Energy Requirement (DER).
* **`getWetFoodKcal`**: Added a robust 4-tier resolution chain to parse and normalize calories for wet foods (from `kcal_per_unit` straight down to a product size fallback).
* **`computeBehavioralBudgetWarning`**: Modernized budget alerts to only warn if the *base* food calories exceed the pet’s total budget (factoring in any wet-reserve).

## 2. Refactored User Interfaces (Phase 2)
The legacy "fractional" serving inputs were entirely replaced with the new automated behavioral system.

### `PantryScreen`
* Split the pantry view into distinct structural sections based on `feeding_role`: **Base Diet**, **Rotational Foods**, and **Treats & Supplements**.

### `EditPantryItemScreen` & `SharePantrySheet`
* Stripped away manual "feedings per day" stepper variables and inline serving size inputs. 
* Refined to act purely as a "Read-Only Configuration Overview" that outlines how the system automatically adapts portions based off the assigned role. 

### Rotational UI 
* Introduced a brand new `FedThisTodaySheet` to enable easy, rapid logging of rotational variables.
* Wired up "Fed" visual indicators on base `PantryCard` components to offer immediate, tangible feedback for users actively using rotational items.

## 3. Legacy Teardown
All previous codebase artifacts tying us to slot-index rebalancing have been completely removed securely.

* **Extracted Legacy Math**: Removed `computeMealBasedServing`, `rebalanceExistingFood`, `computeRebalancedMeals`, and their dependencies.
* **Store & Service Housekeeping**: `usePantryStore` and `safeSwitchService` no longer intercept addition/removal events to fire rigid fraction rebalancing queries.
* **Test Suite Verification**: Discarded over 100 lines of obsolete, fraction-based Jest tests. The Kiba app’s global suite stands intact with **1395/1395 tests passing**.

> [!TIP]  
> Up Next: **Wet Reserve Aggregation**  
> We're ready to integrate `refreshWetReserve(petId)` into all 5 insertion/deletion trigger paths and rewrite the `evaluateDietCompleteness` logic.
