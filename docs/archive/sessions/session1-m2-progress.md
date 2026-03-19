# M2 Session 1 Progress

## Files Created

| File | Description |
|------|-------------|
| `supabase/migrations/002_m2_pet_profiles.sql` | Schema migration aligning `pets` table with PET_PROFILE_SPEC.md |
| `src/types/pet.ts` | Canonical M2 types: Pet, PetCondition, PetAllergen, union types |
| `src/utils/lifeStage.ts` | Pure functions: deriveLifeStage, deriveBreedSize, synthesizeDob, getDerLifeStage |
| `src/utils/haptics.ts` | D-121 haptic feedback map wrapping expo-haptics (8 named functions) |
| `src/stores/useActivePetStore.ts` | D-120 global active pet Zustand store with AsyncStorage persistence |
| `src/services/petService.ts` | CRUD service layer: 6 functions, breed-size derivation, validation |
| `src/data/breeds.ts` | Static breed lists (DOG_BREEDS, CAT_BREEDS) + BREED_SIZE_MAP for selector UI |
| `__tests__/utils/lifeStage.test.ts` | 24 tests for life stage derivation, breed size, synthesizeDob, getDerLifeStage |
| `__tests__/services/petService.test.ts` | 19 tests for CRUD, validation, derived fields, cascading deletes |
| `__tests__/data/breeds.test.ts` | 13 tests for breed list sorting, uniqueness, size map coverage |

---

## Schema Changes

### Full Migration SQL (`supabase/migrations/002_m2_pet_profiles.sql`)

```sql
-- Kiba — M2 Pet Profiles Schema Migration
-- Aligns `pets` table with PET_PROFILE_SPEC.md
-- Renames, precision changes, constraint updates, new columns, dropped columns
-- Does NOT touch pet_conditions or pet_allergens (already exist in 001)

BEGIN;

-- ─── 1. Rename Columns (data-preserving) ──────────────────

ALTER TABLE pets RENAME COLUMN weight_lbs TO weight_current_lbs;
ALTER TABLE pets RENAME COLUMN goal_weight_lbs TO weight_goal_lbs;
ALTER TABLE pets RENAME COLUMN birth_date TO date_of_birth;
ALTER TABLE pets RENAME COLUMN is_spayed_neutered TO is_neutered;

-- ─── 2. Precision Changes ─────────────────────────────────
-- DECIMAL(5,2) → DECIMAL(5,1) for weight columns

ALTER TABLE pets ALTER COLUMN weight_current_lbs TYPE DECIMAL(5,1);
ALTER TABLE pets ALTER COLUMN weight_goal_lbs TYPE DECIMAL(5,1);

-- ─── 3. Activity Level Constraint Update ──────────────────
-- Migrate 'sedentary' → 'low' before swapping constraints

UPDATE pets SET activity_level = 'low' WHERE activity_level = 'sedentary';

ALTER TABLE pets DROP CONSTRAINT IF EXISTS pets_activity_level_check;
ALTER TABLE pets ADD CONSTRAINT pets_activity_level_check
  CHECK (activity_level IN ('low', 'moderate', 'high', 'working'));

-- ─── 4. New Columns ───────────────────────────────────────

ALTER TABLE pets ADD COLUMN sex TEXT CHECK (sex IN ('male', 'female'));
ALTER TABLE pets ADD COLUMN dob_is_approximate BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pets ADD COLUMN weight_updated_at TIMESTAMPTZ;
ALTER TABLE pets ADD COLUMN breed_size TEXT CHECK (breed_size IN ('small', 'medium', 'large', 'giant'));

-- ─── 5. Life Stage Constraint ─────────────────────────────
-- Add CHECK for the 7-value life stage system (D-064)

ALTER TABLE pets ADD CONSTRAINT pets_life_stage_check
  CHECK (life_stage IN ('puppy', 'kitten', 'junior', 'adult', 'mature', 'senior', 'geriatric'));

-- ─── 6. Breed Default ─────────────────────────────────────

ALTER TABLE pets ALTER COLUMN breed SET DEFAULT 'Mixed Breed';

-- ─── 7. Drop Obsolete Columns ─────────────────────────────

ALTER TABLE pets DROP COLUMN IF EXISTS is_indoor;
ALTER TABLE pets DROP COLUMN IF EXISTS allergies;
ALTER TABLE pets DROP COLUMN IF EXISTS weight_loss_target_rate;

COMMIT;
```

### Column Change Summary

**Renamed (data-preserving):**
- `weight_lbs` → `weight_current_lbs`
- `goal_weight_lbs` → `weight_goal_lbs`
- `birth_date` → `date_of_birth`
- `is_spayed_neutered` → `is_neutered`

**Added:**
- `sex TEXT CHECK ('male','female')` — nullable
- `dob_is_approximate BOOLEAN NOT NULL DEFAULT false`
- `weight_updated_at TIMESTAMPTZ`
- `breed_size TEXT CHECK ('small','medium','large','giant')`

**Dropped:**
- `is_indoor`
- `allergies`
- `weight_loss_target_rate`

**Precision changed:**
- `weight_current_lbs` DECIMAL(5,2) → DECIMAL(5,1)
- `weight_goal_lbs` DECIMAL(5,2) → DECIMAL(5,1)

**Constraint updated:**
- `activity_level`: `'sedentary'` → `'low'`, new CHECK `('low','moderate','high','working')`
- `life_stage`: new CHECK for 7 values
- `breed`: default set to `'Mixed Breed'`

---

## Type Definitions

### Full `src/types/pet.ts`

```typescript
// Kiba — M2 Pet Profile Types
// Canonical types matching the updated `pets` table schema.
// See PET_PROFILE_SPEC.md for field semantics.

// ─── Union Types ──────────────────────────────────────────

/** 7-value life stage system (D-064). Auto-derived, never user-entered. */
export type LifeStage =
  | 'puppy'
  | 'kitten'
  | 'junior'
  | 'adult'
  | 'mature'
  | 'senior'
  | 'geriatric';

export type BreedSize = 'small' | 'medium' | 'large' | 'giant';

export type ActivityLevel = 'low' | 'moderate' | 'high' | 'working';

export type Sex = 'male' | 'female';

export type Species = 'dog' | 'cat';

// ─── Pet Entity ───────────────────────────────────────────

/** Matches `pets` table after migration 002. */
export interface Pet {
  id: string;
  user_id: string;
  name: string;
  species: Species;
  breed: string | null;
  weight_current_lbs: number | null;
  weight_goal_lbs: number | null;
  weight_updated_at: string | null;
  date_of_birth: string | null;
  dob_is_approximate: boolean;
  activity_level: ActivityLevel;
  is_neutered: boolean;
  sex: Sex | null;
  photo_url: string | null;
  life_stage: LifeStage | null;
  breed_size: BreedSize | null;

  created_at: string;
  updated_at: string;
}

// ─── Related Entities ─────────────────────────────────────

export interface PetCondition {
  id: string;
  pet_id: string;
  condition_tag: string;
  created_at: string;
}

export interface PetAllergen {
  id: string;
  pet_id: string;
  allergen: string;
  is_custom: boolean;
  created_at: string;
}
```

---

## Store Shape

### `src/stores/useActivePetStore.ts` Interface

```typescript
interface ActivePetState {
  activePetId: string | null;    // persisted to AsyncStorage
  pets: Pet[];                    // NOT persisted — fetched from Supabase on load
  setActivePet: (petId: string) => void;
  loadPets: () => Promise<void>; // fetches from Supabase, auto-selects first if current invalid
  addPet: (pet: Pet) => void;    // adds to local array, sets as active if first pet
  removePet: (petId: string) => void;   // removes, selects next if was active
  updatePet: (petId: string, updates: Partial<Pet>) => void; // patches local state
}
```

**Note:** Only `activePetId` is persisted via AsyncStorage (key: `'kiba-active-pet'`). The full `pets` array is fetched from Supabase on each `loadPets()` call.

---

## Service Layer

### `src/services/petService.ts` — All Functions

```typescript
// Creates a pet. Validates name (1-20 chars, trimmed), species required.
// Derives breed_size (map lookup → weight fallback) and life_stage (from DOB).
// Sets weight_updated_at if weight provided. Syncs to useActivePetStore.
export async function createPet(
  input: Omit<Pet, 'id' | 'created_at' | 'updated_at'>,
): Promise<Pet>

// Updates a pet. Species is stripped (immutable after creation).
// Re-derives breed_size when breed or weight changes.
// Re-derives life_stage when DOB, breed, or weight changes.
// Updates weight_updated_at when weight changes (D-117).
export async function updatePet(
  petId: string,
  updates: Partial<Pet>,
): Promise<Pet>

// Deletes a pet and cascading related rows (allergens → conditions → pet).
// Hard delete — D-110 soft delete is M3+.
export async function deletePet(petId: string): Promise<void>

// Fetches all pets for the authenticated user, ordered by created_at ASC.
export async function getPetsForUser(): Promise<Pet[]>

// Replaces all conditions for a pet. Empty array = zero rows (D-119 "Perfectly Healthy").
export async function savePetConditions(
  petId: string,
  conditions: string[],
): Promise<void>

// Replaces all allergens for a pet. Each allergen has name + isCustom flag.
export async function savePetAllergens(
  petId: string,
  allergens: { name: string; isCustom: boolean }[],
): Promise<void>
```

### Breed Size Derivation Logic

Internal `lookupBreedSize(breed, species, weightLbs)`:
1. **Cat** → always returns `null` (cats don't use breed size for life stage)
2. **Known dog breed** (not "Mixed Breed") → lookup in `BREED_SIZE_MAP` from `src/data/breeds.ts`
3. **Mixed/unknown breed with weight** → `deriveBreedSize(weight)`: <25=small, 25-55=medium, 55-90=large, >90=giant
4. **Mixed/unknown breed without weight** → returns `null`

---

## Test Coverage

| Test File | Tests | Covers |
|-----------|-------|--------|
| `__tests__/utils/lifeStage.test.ts` | 24 | 7-tier life stages (dogs + cats), breed-size thresholds, edge cases, synthesizeDob, getDerLifeStage |
| `__tests__/services/petService.test.ts` | 19 | createPet validation, derived fields, updatePet re-derivation, species immutability, deletePet cascade, getPetsForUser, savePetConditions (D-119), savePetAllergens |
| `__tests__/data/breeds.test.ts` | 13 | DOG_BREEDS/CAT_BREEDS alphabetical sorting, no duplicates, pinned entries, BREED_SIZE_MAP coverage, no cat breeds in size map |
| `__tests__/services/scoring/engine.test.ts` | 36 | Scoring engine with updated makePet factory (M2 fields) |
| `__tests__/services/scoring/personalization.test.ts` | 34 | Personalization with 7-tier life stage support |
| `__tests__/services/scoring/pipeline.test.ts` | 11 | Full pipeline with updated MOCK_PET |
| `__tests__/services/scoring/realDataTrace.test.ts` | 1 | Pure Balance regression = 69 (unchanged) |
| `__tests__/services/scoring/regressionTrace.test.ts` | 9 | NP bucket regression |
| `__tests__/services/scoring/nutritionalProfile.test.ts` | 43 | NP scoring (unchanged) |
| `__tests__/services/scoring/formulationScore.test.ts` | 15 | Formulation scoring (unchanged) |
| `__tests__/services/scoring/ingredientQuality.test.ts` | 8 | IQ scoring (unchanged) |
| `__tests__/services/scoring/speciesRules.test.ts` | 16 | Species rules (unchanged) |
| `__tests__/stores/scanCache.test.ts` | 3 | Scan cache store (unchanged) |
| `__tests__/services/scanner.test.ts` | 3 | Scanner service (unchanged) |

**Total: 215/215 passing. Pure Balance regression = 69 (correct).**

---

## Decisions Applied

| Decision | Description | Implementation |
|----------|-------------|----------------|
| D-064 | 7-tier life stages | `LifeStage` union type, `deriveLifeStage()` with breed-size-adjusted thresholds, `getDerLifeStage()` for 4-bucket DER mapping |
| D-097 | Conditions & allergens | `pet_conditions` / `pet_allergens` tables (from 001), `savePetConditions()` / `savePetAllergens()` in petService |
| D-102 | Breed selector | `DOG_BREEDS` / `CAT_BREEDS` arrays in `src/data/breeds.ts`, alphabetical, "Mixed Breed" and "Unknown / Other" pinned at end |
| D-106 | Weight management | `weight_goal_lbs` on Pet, obesity/underweight as conditions not score modifiers |
| D-109 | Breed runtime data | `BREED_SIZE_MAP` in `src/data/breeds.ts` (static, not Supabase) |
| D-110 | Pet deletion | Hard delete with cascade (allergens → conditions → pet). Soft delete deferred to M3+ |
| D-112 | Breed contraindications | Dalmatian, English Bulldog, Black Russian Terrier in breed lists (Urate Risk Group) |
| D-116 | Approximate age | `synthesizeDob(years, months)` in lifeStage.ts, `dob_is_approximate` boolean on Pet |
| D-117 | Weight timestamp | `weight_updated_at` auto-set in createPet/updatePet when weight changes |
| D-118 | Sex field | `sex: Sex | null` on Pet, `CHECK ('male','female')` in migration |
| D-119 | "Perfectly Healthy" | Empty conditions array stores zero rows in pet_conditions |
| D-120 | Active pet store | `useActivePetStore` with Zustand persist, `activePetId` in AsyncStorage |
| D-121 | Haptics | 8 named functions in `src/utils/haptics.ts`, no-op on web |

---

## Session 2 Pickup

Session 2 builds the pet profile Create and Edit screens.

Key references:
- D-092: Onboarding flow — light profile capture already exists
  from M1 (name + species). M2 adds the full profile form.
- D-102: Breed selector — alphabetical, searchable, Mixed/Other pinned
- D-116: Approximate age toggle — Exact Date | Approximate Age
- D-118: Sex field — segmented control, optional
- D-086: Colors — #1A1A1A background, #242424 cards, teal accents
- D-084: SF Symbols, zero emoji
- D-121: Haptics — import from utils/haptics.ts

Pet type is in src/types/pet.ts.
Full type definition is in session1-m2-progress.md.
petService.ts functions handle all Supabase interactions.
useActivePetStore manages global pet state.
