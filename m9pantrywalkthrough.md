# Phase C: Add to Pantry UI & Auto-Math Redesign
_Detailed File-by-File Walkthrough_

### 1. Database & Schema
- **[NEW] Migration `032_safe_switch_serving_size.sql`**
  - **Purpose:** Added two new columns to the `safe_switches` table: `new_serving_size` (numeric) and `new_feedings_per_day` (integer). 
  - **Impact:** Eliminates the need for the user to manually re-enter their feeding math when transitioning from the Pantry to the Safe Switch concierge.

### 2. Types & Interfaces
- **[MODIFY] `src/types/safeSwitch.ts`**
  - Expanded `SafeSwitch` and `CreateSafeSwitchInput` types to strictly type the two new serving size columns, ensuring parity between backend and frontend.
- **[MODIFY] `src/types/navigation.ts`**
  - Updated `SafeSwitchSetup` route params to receive `newServingSize` and `newFeedingsPerDay` seamlessly from the pantry sheet.

### 3. Business Logic & Helpers
- **[MODIFY] `src/utils/pantryHelpers.ts`**
  - Integrated 4 new pure functions: `computeMealBasedServing` (calculates per-meal cup allowance using DER), `getDefaultMealsCovered` (determines how many meals a new food covers), `computeRebalancedMeals`, and `computeServingConversions`.
- **[MODIFY] `src/services/pantryService.ts`**
  - Built out the `rebalanceExistingFood` service function. This handles automatically dropping conflicting existing foods in the database to accommodate a new food addition without overflowing a pet's daily caloric limit.
- **[MODIFY] `src/services/safeSwitchService.ts`**
  - Refactored `createSafeSwitch` and `completeSafeSwitch` (RPC calls) to pass the new serving size metadata up to Supabase.
- **[MODIFY] `src/stores/usePantryStore.ts`**
  - Hooked up `rebalanceExistingFood` to run immediately post-add when the user hits "Save" and transitions.

### 4. User Interface & Components
- **[MODIFY] `src/components/pantry/AddToPantrySheet.tsx`**
  - **Massive Rewrite:** Transformed from a raw manual entry layout into a sophisticated 4-step stepper.
  - Implemented an elegant "New to Diet" vs "Replacement" pill toggle.
  - Built an auto-computing `meal based` sizing card using `cardSurface` layout.
  - Pre-routed Safe Switch handoff conditions properly via `navigation.replace`.
- **[MODIFY] `src/components/pantry/AddToPantryStyles.ts`**
  - Introduced Matte Premium standard (`cardSurface`, `hairlineBorder`) specifically for the pantry integration, matching modern application aesthetics.
- **[MODIFY] `src/screens/SafeSwitchSetupScreen.tsx`**
  - Intercepted the new route payload `newServingSize` and `newFeedingsPerDay` and persisted it through the flow's internal state.
- **[MODIFY] `src/screens/SafeSwitchDetailScreen.tsx`**
  - Resolved strict TypeScript compilation errors duplicate styling configurations affecting builds (cleaned up rogue `doneButton` occurrences).

### 5. Testing & Quality Assurance
- **[MODIFY] `__tests__/utils/pantryHelpers.test.ts`**
  - Wrote robust new Jest constraints for `computeMealBasedServing` verifying exact cup scaling precision matching and standardizing rounding errors.
- **[MODIFY] `__tests__/components/pantry/AddToPantrySheet.test.ts`**
  - Migrated outdated "Supplement" tests. Assured supplements natively map to the frictionless 1-serving / "as_needed" structure rather than complicated caloric tracking.
- **[MODIFY] `__tests__/services/safeSwitchService.test.ts`**
  - Stabilized tests by explicitly mocking `new_serving_size: null` in core MOCK_INPUT fixtures so regressions stay green across all 1395 cases.

## Results
- Full migration to Phase C completed.
- Type errors completely resolved mapping.
- All 1395 unit tests pass confidently.
