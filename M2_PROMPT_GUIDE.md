# Kiba M2 — Claude Code Prompt Guide

> **Purpose:** Step-by-step prompts for building Pet Profiles + Portion Calculator in Claude Code.
> Each prompt is copy-paste ready. Session boundaries, `/compact`, and `/clear` points are marked.
> **Updated:** March 1, 2026 — incorporates D-116 through D-121 (M2 design decisions).

---

## Pre-Session: Verify CLAUDE.md

Before starting any M2 work:

1. Confirm CLAUDE.md says `Current phase: M2 Pet Profiles + Vet Audit`
2. Confirm decision count says 121 (D-001 through D-121)
3. Confirm `pets` table description uses PET_PROFILE_SPEC column names: `weight_current_lbs` (not `weight_lbs`), `date_of_birth` (not `birth_date`), `is_neutered` (not `is_spayed_neutered`), activity levels `'low'|'moderate'|'high'|'working'` (not `'sedentary'|'active'`)
4. Confirm project structure includes `useActivePetStore.ts` and `haptics.ts`
5. Confirm M1 scoring engine tests still pass: `npx jest --passWithNoTests`

If any of these are wrong, update CLAUDE.md before starting. Claude Code reads it at session start and will build against whatever it says.

---

## Session Map — Quick Reference

| Session | Domain | Deliverables | Context Mgmt |
|---------|--------|-------------|--------------|
| 1 | Foundation | Schema migration, types, haptics utility, active pet store | `/clear` after — foundation ≠ UI |
| 2 | Profile CRUD | Create/edit pet screens, breed selector, DOB toggle, photo | `/compact` midway, `/clear` after |
| 3 | Health System | Conditions grid, allergen picker, cross-reactivity, "Perfectly Healthy" | `/clear` after — health ≠ math |
| 4 | Calorie Math | Portion calculator, treat battery, safety guards, goal weight | `/compact` midway, `/clear` after |
| 5 | Hub + Polish | Pet Hub screen, multi-pet carousel, stale weight, integration tests | Final session |

---

## Session 1: Schema Migration + Foundation

**Context is fresh. Start with Plan Mode immediately.**

---

### Prompt 1 — Plan Mode + Schema Migration

```
/plan

@CLAUDE.md @PET_PROFILE_SPEC.md @supabase/migrations/001_initial_schema.sql

Starting M2 Session 1: Schema migration and foundation layer.

Before planning, read DECISIONS.md sections relevant to this work:
- D-097 (health conditions + allergen profile — pet_conditions and
  pet_allergens tables)
- D-098 (cross-reactivity — allergen_group field on ingredients_dict)
- D-102 (breed selector — alphabetical, searchable, Mixed/Other pinned)
- D-110 (table name: `pets`, NOT `pet_profiles`)
- D-116 (approximate age mode — dob_is_approximate column)
- D-117 (stale weight indicator — weight_updated_at column)
- D-118 (sex field — optional, for vet report + pronouns)
- D-120 (multi-pet switching — useActivePetStore)
- D-121 (haptic feedback map — utils/haptics.ts)

Also read PET_PROFILE_SPEC.md fully — it is the canonical reference for
column names, types, and constraints. The ROADMAP.md schema was updated
to match it on March 1, 2026.

Scope for this session — five deliverables:

1. supabase/migrations/002_m2_pet_profiles.sql
   Migration that:
   - Adds columns to `pets` table per PET_PROFILE_SPEC.md:
     * Rename weight_lbs → weight_current_lbs (DECIMAL 5,1)
     * Rename goal_weight_lbs → weight_goal_lbs (DECIMAL 5,1)
     * Rename birth_date → date_of_birth
     * Rename is_spayed_neutered → is_neutered
     * Add sex TEXT CHECK (sex IN ('male', 'female')) — D-118
     * Add dob_is_approximate BOOLEAN DEFAULT false — D-116
     * Add weight_updated_at TIMESTAMPTZ — D-117
     * Add breed_size TEXT — derived from breed lookup
     * Add photo_url TEXT — Supabase storage path
     * Update activity_level CHECK to ('low'|'moderate'|'high'|'working')
     * Drop is_indoor column (redundant — cats use 'low' activity)
     * Drop allergies TEXT[] column (superseded by pet_allergens)
     * Drop weight_loss_target_rate (calculated at runtime, not stored)
   - Creates pet_conditions table (D-097) with RLS
   - Creates pet_allergens table (D-097) with RLS
   - All RLS policies: pet_conditions and pet_allergens use
     `pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())`

   CRITICAL: Use PET_PROFILE_SPEC.md column names exactly. Do NOT use
   the old ROADMAP names. The following mappings are intentional:
     weight_lbs → weight_current_lbs
     birth_date → date_of_birth
     is_spayed_neutered → is_neutered
     'sedentary' → 'low'
     'active' → 'high'

2. src/types/pet.ts
   Full TypeScript types matching the updated schema:
   - Pet interface with ALL columns from migration
   - PetCondition type
   - PetAllergen type
   - LifeStage union: 'puppy' | 'kitten' | 'junior' | 'adult' |
     'mature' | 'senior' | 'geriatric'
   - BreedSize union: 'small' | 'medium' | 'large' | 'giant'
   - ActivityLevel union: 'low' | 'moderate' | 'high' | 'working'
   - Sex union: 'male' | 'female'
   - Species union: 'dog' | 'cat'

3. src/utils/haptics.ts — D-121
   Wrapper around expo-haptics with named functions:
   - chipToggle() → Haptics.impactAsync(ImpactFeedbackStyle.Light)
   - speciesToggle() → Haptics.impactAsync(ImpactFeedbackStyle.Medium)
   - scanButton() → Haptics.impactAsync(ImpactFeedbackStyle.Medium)
   - saveSuccess() → Haptics.notificationAsync(NotificationFeedbackType.Success)
   - barcodeRecognized() → Haptics.notificationAsync(NotificationFeedbackType.Success)
   - profileComplete() → Haptics.notificationAsync(NotificationFeedbackType.Success)
   - hepaticWarning() → Haptics.notificationAsync(NotificationFeedbackType.Error)
   - deleteConfirm() → Haptics.impactAsync(ImpactFeedbackStyle.Heavy)
   - Platform check: no-op on unsupported platforms (Platform.OS check)
   - Single import everywhere: `import { saveSuccess, chipToggle } from '@/utils/haptics'`

4. src/stores/useActivePetStore.ts — D-120
   Zustand store managing global active pet context:
   - State: activePetId: string | null, pets: Pet[]
   - Actions:
     * setActivePet(petId: string)
     * loadPets() — fetches from Supabase, sets first pet as active
       if no active pet set
     * addPet(pet: Pet) — adds to local array
     * removePet(petId: string) — removes from array, selects next
       pet if removed was active
     * updatePet(petId: string, updates: Partial<Pet>) — patches
       local state
   - Persisted via AsyncStorage (activePetId only, not full pets array)
   - This store is consumed by ScanScreen (needs active pet for scoring),
     ResultScreen (needs pet name for D-094), and the new Pet Hub

5. src/utils/lifeStage.ts — D-064
   Pure function to derive life stage from date_of_birth + species +
   breed_size. No Supabase calls.

   deriveLifeStage(
     dateOfBirth: Date | null,
     species: 'dog' | 'cat',
     breedSize?: BreedSize
   ) => LifeStage | null

   Dog thresholds (breed-size-adjusted):
     Small/Medium: puppy <1yr, junior 1-2yr, adult 2-7yr, mature 7-10yr,
       senior 10-13yr, geriatric 13+
     Large: puppy <1yr, junior 1-2yr, adult 2-6yr, mature 6-8yr,
       senior 8-11yr, geriatric 11+
     Giant: puppy <1.5yr, junior 1.5-2yr, adult 2-5yr, mature 5-8yr,
       senior 8-10yr, geriatric 10+

   Cat thresholds:
     kitten <1yr, junior 1-2yr, adult 2-7yr, mature 7-11yr,
     senior 11-14yr, geriatric 14+

   If dateOfBirth is null → return null (age unknown)
   If breedSize is null for dogs → default to 'medium' thresholds

   Tests: __tests__/utils/lifeStage.test.ts
   Test cases:
   - 6-month-old dog, medium → 'puppy'
   - 6-month-old cat → 'kitten'
   - 15-year-old cat → 'geriatric'
   - 9-year-old dog, giant → 'senior' (giant ages faster)
   - 9-year-old dog, small → 'mature' (small ages slower)
   - null date_of_birth → null
   - null breed_size for dog → uses 'medium' default

Constraints:
- D-084: No emoji
- TypeScript strict mode, no `any`
- All new files must be consistent with existing codebase style
- Migration must be idempotent where possible (IF NOT EXISTS)

Do not build UI screens. Do not build the portion calculator.
Show me the plan before writing a single line of code.
```

**Review checkpoint:** Check the migration carefully — column renames are destructive operations. Verify Claude is using `ALTER TABLE ... RENAME COLUMN` syntax and not dropping/recreating columns (which loses data). If M1 had test data in the pets table, the migration must preserve it.

```
/execute
```

---

### Prompt 2 — Pet Service Layer

```
Migration, types, haptics, store, and life stage are done.
Now build the service layer for pet CRUD operations.

Deliverable:
src/services/petService.ts

Functions:
  createPet(pet: Omit<Pet, 'id' | 'created_at' | 'updated_at'>)
    → Pet
    - Validates required fields: name, species
    - Derives life_stage via lifeStage.ts before insert
    - Derives breed_size from breed lookup before insert
    - Sets weight_updated_at = now() if weight_current_lbs provided
    - Inserts into Supabase `pets` table
    - Returns full row with generated id
    - D-094: pet name is required — cannot create without it

  updatePet(petId: string, updates: Partial<Pet>)
    → Pet
    - If weight_current_lbs changed: set weight_updated_at = now() (D-117)
    - If date_of_birth or breed changed: re-derive life_stage
    - If breed changed: re-derive breed_size
    - Returns updated full row
    - Patches useActivePetStore local state

  deletePet(petId: string)
    → void
    - D-110: 30-day soft delete not yet implemented (M3+) — for now,
      hard delete with cascading to pet_conditions and pet_allergens
    - Removes from useActivePetStore
    - If deleted pet was active, selects next available pet

  getPetsForUser()
    → Pet[]
    - Fetches all pets for auth.uid()
    - Includes derived fields (life_stage, breed_size)
    - Ordered by created_at asc (oldest pet first — likely primary)

  savePetConditions(petId: string, conditions: string[])
    → void
    - Deletes all existing pet_conditions for petId
    - Inserts new rows — one per condition_tag
    - If "Perfectly Healthy" chip selected (D-119): conditions array
      is empty → stores zero rows
    - Mutually exclusive: "Perfectly Healthy" or condition chips, never both

  savePetAllergens(petId: string, allergens: { name: string, isCustom: boolean }[])
    → void
    - Deletes all existing pet_allergens for petId
    - Inserts new rows
    - Only meaningful when 'allergy' exists in pet_conditions
    - Custom allergens (from "Other" dropdown) have is_custom = true

Breed size lookup — hardcoded map for now:
  Small: <25 lbs (Chihuahua, Pomeranian, Dachshund, etc.)
  Medium: 25-55 lbs (Beagle, Bulldog, Cocker Spaniel, etc.)
  Large: 55-90 lbs (Lab, Golden, German Shepherd, etc.)
  Giant: >90 lbs (Great Dane, Saint Bernard, Mastiff, etc.)
  Cats: always null for breed_size (cats don't have size-based
  life stage variation in our model)

Create a static breed → size map from the breed list in
BREED_MODIFIERS_DOGS.md for the 23 documented breeds.
For unrecognized breeds, derive from weight_current_lbs using the
threshold ranges above. For "Mixed Breed": derive from weight.

Tests: __tests__/services/petService.test.ts
Required tests:
- createPet with name + species only → succeeds, life_stage null (no DOB)
- createPet with full profile → life_stage derived correctly
- updatePet changing weight → weight_updated_at is fresh timestamp
- updatePet changing DOB → life_stage re-derived
- savePetConditions with empty array → zero rows in pet_conditions
- savePetAllergens → correct rows inserted with is_custom flags
- getPetsForUser → ordered by created_at asc

Mock Supabase client for all tests. No network calls.
```

---

### Prompt 3 — Breed Data + Approximate Age Helper

```
Two small but important utilities before we close Session 1.

Deliverable 1:
src/data/breeds.ts

Static breed lists for the breed selector (D-102):
- Export DOG_BREEDS: string[] — alphabetical, "Mixed Breed" and
  "Unknown / Other" pinned at the end
- Export CAT_BREEDS: string[] — alphabetical, "Mixed Breed" and
  "Unknown / Other" pinned at the end
- Source: Pull from BREED_MODIFIERS_DOGS.md (23 breeds) and
  BREED_MODIFIERS_CATS.md (21 breeds) as the starting set
- Also add the 20 most common breeds NOT already in the modifier
  files (AKC top 20 for dogs, CFA top 20 for cats) — these breeds
  won't have modifiers but need to appear in the selector
- Export BREED_SIZE_MAP: Record<string, BreedSize> — maps breed
  name to size category for dogs

Deliverable 2:
src/utils/approximateAge.ts — D-116

synthesizeDob(years: number, months: number): Date
  - Returns: today - (years × 12 + months) months, pinned to 1st of month
  - years range: 0-30, months range: 0-11
  - If both 0: returns today (newborn)
  - Pure function, no side effects

Tests: __tests__/utils/approximateAge.test.ts
- 2 years, 6 months → date is approximately 30 months ago
- 0 years, 0 months → today
- 15 years, 0 months → date is 15 years ago (elderly pet)
- Pinned to 1st of month (day === 1)
```

---

### 🔴 CONTEXT CHECK — `/clear`

Session 1 is complete. Schema is migrated, types are defined, utilities are built, the pet store is wired. You're about to shift to UI screens — a completely different domain. The migration SQL, Supabase query structures, and breed data loading are irrelevant to building React Native screens.

**This is a `/clear` moment.**

---

### Prompt 4 — Document Before Clear

```
Write session1-m2-progress.md to the project root with the following:

## Files Created
- List each file, its path, and a one-line description

## Schema Changes
- Paste the full migration SQL (002_m2_pet_profiles.sql)
- Note which columns were renamed vs added vs dropped

## Type Definitions
- Paste the full Pet interface from src/types/pet.ts
- Paste PetCondition and PetAllergen types
- Paste all union types (LifeStage, BreedSize, etc.)

## Store Shape
- Paste the useActivePetStore interface (state + actions)
- Note: activePetId persisted via AsyncStorage

## Service Layer
- List all petService.ts functions with their full signatures
- Note the breed_size derivation logic (map vs weight fallback)

## Test Coverage
- List each test file and what it covers
- Confirm all tests passing

## Decisions Applied
- List each D-number referenced and confirm implementation matches

## Session 2 Pickup
"Session 2 builds the pet profile Create and Edit screens.

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
useActivePetStore manages global pet state."
```

Verify the document looks complete. Then:

```
/clear
```

Commit to git: `M2: Session 1 — schema migration, types, services, stores`

---

## Session 2: Pet Profile Create + Edit Screens

**Fresh context. UI-focused session — React Native components.**

---

### Prompt 1 — Load Context + Plan Create Profile Screen

```
/plan

@session1-m2-progress.md @PET_PROFILE_SPEC.md @src/types/pet.ts
@src/services/petService.ts @src/utils/haptics.ts

Read session1-m2-progress.md first — it has the full Pet type,
service layer signatures, and store shape from Session 1.

Read PET_PROFILE_SPEC.md for the canonical field definitions and
UI requirements.

Starting M2 Session 2: Pet profile Create and Edit screens.

Before planning, read DECISIONS.md:
- D-086 (colors: #1A1A1A background, #242424 card surfaces, teal #00B4D8)
- D-084 (zero emoji — SF Symbols via @expo/vector-icons)
- D-092 (onboarding: light profile from M1 captures name + species only)
- D-094 (pet name always visible — all screens that display pet info)
- D-102 (breed selector: A→Z, searchable, Mixed/Other pinned last)
- D-116 (DOB: Exact Date | Approximate Age toggle)
- D-118 (sex: segmented control, optional, neither selected by default)
- D-121 (haptics: import chipToggle, speciesToggle, saveSuccess)

Session scope — two screens, one component:

1. src/screens/CreatePetScreen.tsx
   The FULL profile creation form. This is NOT the onboarding light
   capture (which already exists from M1 with just name + species).
   This is accessed from the Me tab → "Add Pet" or from the Pet Hub
   "+ Add Pet" button.

   Field order (top to bottom, matching PET_PROFILE_SPEC.md):

   a. Pet Photo — circular frame, tap to select from gallery
      (Expo ImagePicker). Default: species silhouette icon.
      Photo selection is optional — skip stores null photo_url.

   b. Pet Name — text input, required. 20 char max.
      Placeholder: "What's your pet's name?"

   c. Species — segmented control: [ 🐕 Dog ] [ 🐈 Cat ]
      Wait — D-084 says no emoji. Use SF Symbol equivalents.
      Actually, use small text labels: [ Dog ] [ Cat ] with a
      subtle species icon from @expo/vector-icons (Ionicons:
      'paw' for dog, 'paw' for cat — or just text labels).
      Species selection triggers haptics.speciesToggle().
      Species change resets breed field and filters condition list.

   d. Breed — searchable dropdown per D-102.
      "Mixed Breed" and "Unknown / Other" always pinned at bottom.
      Alphabetical otherwise. Search filters as user types.
      Data source: src/data/breeds.ts (dog or cat list based on
      species selection).

   e. Date of Birth — D-116 toggle:
      [ Exact Date ] | [ Approximate Age ]
      Exact: date picker (month/year only — day not needed)
      Approximate: two inputs side by side —
        Years [0-30 stepper] Months [0-11 stepper]
      Toggle fires haptics.chipToggle()
      Approximate mode stores dob_is_approximate = true and
      calls synthesizeDob() from utils/approximateAge.ts

   f. Weight — numeric input with "lbs" suffix label.
      One decimal place allowed. Placeholder: "Current weight"
      Stores as weight_current_lbs.

   g. Sex — D-118 segmented control: [ Male ] [ Female ]
      Neither selected by default (null is valid).
      Optional — no validation required.
      Fires haptics.chipToggle() on selection.

   h. Activity Level — segmented control:
      [ Low ] [ Moderate ] [ High ] [ Working ]
      Default: Moderate (pre-selected).
      Fires haptics.chipToggle() on change.

   i. Neutered — toggle switch: "Spayed / Neutered"
      Default: on (true) — majority of pets are.

   j. "Continue to Health" button — saves basic profile via
      petService.createPet(), navigates to HealthConditionsScreen.
      Fires haptics.saveSuccess() on save.
      Minimum required: name + species. All other fields optional.

   Visual design:
   - Background: #1A1A1A
   - Card surfaces for field groups: #242424 with 12px border radius
   - Teal accent (#00B4D8) for active segmented controls and buttons
   - Group related fields: Photo+Name+Species in one card,
     Breed+DOB+Weight in second card, Sex+Activity+Neutered in third
   - Scroll view — form is longer than one screen
   - "Skip for now" link at bottom → saves with just name+species,
     navigates to Hub. Score shows Layer 1+2 only until profile
     completed.

2. src/screens/EditPetScreen.tsx
   Same form as CreatePetScreen but:
   - Pre-populated with existing pet data from useActivePetStore
   - "Save Changes" replaces "Continue to Health"
   - Calls petService.updatePet() instead of createPet()
   - Delete button at bottom (red, text-only): "Delete [Pet Name]"
     → confirmation modal requiring typed pet name (D-110)
     → Fires haptics.deleteConfirm() on confirm tap
   - "Health & Diet" navigation link → HealthConditionsScreen
   - Accessed from Pet Hub → edit icon on active pet card

3. src/components/BreedSelector.tsx
   Reusable component consumed by both screens:
   - Props: species ('dog' | 'cat'), value: string, onChange: (breed) => void
   - Bottom sheet or modal with search bar
   - Filters breed list from src/data/breeds.ts as user types
   - "Mixed Breed" and "Unknown / Other" always visible at bottom
   - Selected breed highlighted with teal background
   - Tap fires haptics.chipToggle()

Do not build the Health Conditions screen — that's Session 3.
Do not build the Portion Calculator — that's Session 4.
Show me the plan before writing code.
```

**Review checkpoint:** Three things to check in the plan:
1. The field order matches PET_PROFILE_SPEC.md exactly
2. The DOB toggle (D-116) has both modes implemented with synthesizeDob()
3. No emoji anywhere — SF Symbols or text labels only per D-084

```
/execute
```

---

### Prompt 2 — Photo Upload + Species Silhouettes

```
Create and Edit screens are rendering. Now add the photo
upload flow and species silhouette defaults.

Deliverable:
src/components/PetPhotoSelector.tsx

Reusable component:
- Props: photoUrl: string | null, species: 'dog' | 'cat',
  onPhotoSelected: (uri: string) => void
- Displays circular frame (96px diameter, #242424 background)
- If photoUrl exists: renders the photo
- If null: renders a generic species silhouette
  (use Ionicons: 'paw-outline' for both dog and cat as placeholder
  — actual breed silhouettes are deferred per M2 design review)
- Tap → Expo ImagePicker (launchImageLibraryAsync):
  * allowsEditing: true (forces square crop)
  * aspect: [1, 1]
  * quality: 0.7
  * mediaTypes: Images only
- After selection: call onPhotoSelected with local URI
- Supabase Storage upload happens in petService.ts at save time,
  NOT during selection (avoid uploading photos for unsaved profiles)

Update petService.ts:
  - In createPet: if photo URI is a local file, upload to Supabase
    Storage bucket 'pet-photos', path: `{user_id}/{pet_id}.jpg`
    Set photo_url to the public URL
  - In updatePet: if photo changed (new local URI), re-upload
  - Storage bucket 'pet-photos' must have RLS: objects owned by
    user_id path prefix

No tests needed for the component (visual), but add a test for
the upload path generation logic in petService.test.ts.
```

---

### Prompt 3 — Form Validation + Edge Cases

```
Both screens render and photos work. Now add validation and
edge cases before we move on.

Required validations on CreatePetScreen / EditPetScreen:

1. Name: required, 1-20 characters, trimmed
   Error: "Pet name is required" (shown inline, red text below field)

2. Species: required
   Error: "Please select a species" (should be impossible to miss
   but handle defensively)

3. Weight: optional but if entered, must be 0.5-300 lbs
   Error: "Weight must be between 0.5 and 300 lbs"

4. Date of Birth — Exact mode: cannot be in the future
   Error: "Birth date cannot be in the future"

5. Date of Birth — Approximate mode:
   - Years + Months cannot both be 0 if age is provided
   - Years max 30 (no pet lives longer)
   - Months max 11

6. Breed change resets breed_size derivation → re-derives life_stage

7. Species change:
   - Resets breed to null (dog breeds ≠ cat breeds)
   - Resets conditions and allergens (species-filtered lists differ)
   - Shows brief toast: "Breed and health info reset for [species]"

8. Delete confirmation modal:
   - User must type exact pet name to confirm (case-insensitive)
   - Delete button disabled until name matches
   - "This will permanently delete [Name] and all associated scan
     history. This cannot be undone."
   - After delete: navigate to Pet Hub or create screen if no pets remain

9. Keyboard avoidance: form must scroll properly when keyboard is open.
   Use KeyboardAvoidingView or similar.

10. Save button disabled while saving (prevent double-tap).
    Show loading spinner during save. On error: toast with message,
    re-enable button.

Edge case tests (__tests__/screens/CreatePetScreen.test.ts):
- Submit with empty name → error shown, save blocked
- Submit with name only → succeeds (species has default)
- Weight 0.3 → error shown
- Weight 301 → error shown
- Future date of birth → error shown
- Delete with wrong name typed → button stays disabled
- Delete with correct name (case-insensitive) → button enables
```

---

### ⚠️ COMPACT MOMENT

After building two full screens with validation, form state management, photo upload, and breed selection, you're deep. The keyboard handling and validation debugging probably added significant back-and-forth. But you're about to move to Session 3 (a different domain — health conditions), so this is actually a `/clear` rather than `/compact`.

---

### Prompt 4 — Document Before Clear

```
Write session2-m2-progress.md to the project root:

## Files Created
- List every file with path and description

## Screen Inventory
- CreatePetScreen: field order, which fields required vs optional
- EditPetScreen: how it differs from Create (pre-population, delete)
- BreedSelector: how it's consumed, data source

## Component Props
- PetPhotoSelector: full props interface
- BreedSelector: full props interface

## Form State Management
- How form state is handled (useState, Zustand, or form library)
- Validation rules per field

## Navigation
- How CreatePetScreen is reached (Me tab, Hub "+ Add Pet")
- How EditPetScreen is reached (Hub edit icon)
- Where "Continue to Health" navigates to (HealthConditionsScreen)
- Post-delete navigation logic

## Haptics Integration
- Which haptic function fires on which interaction
- Confirm D-121 map is fully implemented

## Decisions Applied
- Every D-number referenced with confirmation

## Session 3 Pickup
"Session 3 builds the Health Conditions and Allergen picker screens.

Key references:
- D-097: Health conditions multi-select, species-filtered
- D-098: Cross-reactivity expansion (allergen_group fields)
- D-119: 'Perfectly Healthy' chip — green, mutual exclusion
- D-095: UPVM compliance — no prescriptive language in condition
  descriptions
- D-121: Haptics — chipToggle for condition/allergen selection

PetCondition type and PetAllergen type are in src/types/pet.ts.
savePetConditions() and savePetAllergens() are in petService.ts.
Full signatures in session1-m2-progress.md."
```

Verify document accuracy. Then:

```
/clear
```

Commit: `M2: Session 2 — Create/Edit pet screens, breed selector, photo upload`

---

## Session 3: Health Conditions + Allergens

**Fresh context. This session handles the D-097 health system — the most clinically sensitive UI in the entire app.**

---

### Prompt 1 — Load Context + Plan Conditions Screen

```
/plan

@session2-m2-progress.md @session1-m2-progress.md @src/types/pet.ts
@src/services/petService.ts @src/utils/haptics.ts

Read both progress docs. Session 1 has the types and service layer.
Session 2 has the form screens that navigate here.

Starting M2 Session 3: Health conditions and allergen picker.

Before planning, read DECISIONS.md:
- D-097 (health conditions: 13 species-filtered conditions for dogs,
  12 for cats. Multi-select chips. Allergen sub-picker when 'allergy'
  selected. pet_conditions and pet_allergens tables.)
- D-098 (cross-reactivity: allergen_group and allergen_group_possible
  fields on ingredients_dict. Turkey → chicken cross-reactivity.
  Poultry fat → possible chicken/turkey.)
- D-119 ("Perfectly Healthy" chip: green #34C759 with checkmark icon.
  Mutual exclusion with all condition chips. Stores zero rows.)
- D-095 (UPVM: no "prescribe/treat/cure/prevent/diagnose" in any
  condition description or UI copy)
- D-106 (weight management: obesity and underweight are conditions
  in D-097, mutually exclusive)
- D-084 (zero emoji, SF Symbols only)
- D-086 (colors: #1A1A1A, #242424 cards, teal accent)
- D-121 (haptics: chipToggle for chip selection)

Scope for this session — two screens:

1. src/screens/HealthConditionsScreen.tsx
   Reached from CreatePetScreen "Continue to Health" button or from
   EditPetScreen "Health & Diet" link.

   Receives petId as route param (pet already saved in Session 2).
   Loads existing conditions from petService on mount.

   Section 1: "Health Conditions"
   Species-filtered chip grid. Two columns of chips.

   Dog conditions (13):
   - Perfectly Healthy (D-119 — special green chip, top of list)
   - Joint issues (joint)
   - Food allergies (allergy)
   - Sensitive stomach (gi_sensitive)
   - Overweight (obesity)
   - Underweight (underweight)
   - Diabetes (diabetes)
   - Kidney disease (ckd)
   - Urinary issues (urinary)
   - Heart disease (cardiac)
   - Pancreatitis (pancreatitis)
   - Skin & coat issues (skin)
   - Liver disease (liver)
   - Seizures / Epilepsy (seizures)

   Cat conditions (12):
   - Perfectly Healthy (D-119 — same special chip)
   - Joint issues (joint)
   - Food allergies (allergy)
   - Sensitive stomach (gi_sensitive)
   - Overweight (obesity)
   - Underweight (underweight)
   - Diabetes (diabetes)
   - Kidney disease (ckd)
   - Urinary issues (urinary)
   - Heart disease (cardiac)
   - Pancreatitis (pancreatitis)
   - Skin & coat issues (skin)
   - Hyperthyroidism (hyperthyroid)

   Chip behavior:
   - Tap "Perfectly Healthy" → deselects ALL condition chips, selects
     only "Perfectly Healthy". Green (#34C759) with checkmark icon.
     Fires haptics.chipToggle().
   - Tap any condition chip → deselects "Perfectly Healthy" if it was
     selected. Fires haptics.chipToggle().
   - Multi-select allowed for conditions (a pet can have joint + allergy).
   - EXCEPT: obesity and underweight are mutually exclusive (D-106).
     Selecting one deselects the other.
   - Default state on fresh profile: nothing selected (no pre-selection).

   When 'allergy' chip is selected → Section 2 slides in below.

   Section 2: "Known Food Allergens" (only visible when allergy selected)
   Species-filtered allergen chips:

   Dog allergens (13 + Other):
   Beef, Chicken, Dairy, Wheat, Fish, Lamb, Soy, Egg, Corn, Pork,
   Turkey, Rice, Other (searchable dropdown)

   Cat allergens (7 + Other):
   Beef, Chicken, Dairy, Fish, Lamb, Turkey, Other (searchable dropdown)

   Multi-select. "Other" opens a search input for custom allergen
   entry (is_custom = true). Custom allergens are free text, stored
   in pet_allergens.

   Important D-098 context (for the user, not displayed in UI):
   When user selects "Chicken", the scoring engine will also flag
   products containing turkey (cross-reactive via allergen_group).
   This is handled at SCORING TIME by the allergen_group and
   allergen_group_possible fields on ingredients_dict — NOT in this
   screen's UI. This screen just captures user allergen selections.

   The screen does NOT explain cross-reactivity to the user during
   selection. It happens transparently at scan time with appropriate
   severity labels ('possible_match' vs 'direct_match').

   Bottom: "Save & Continue" button.
   - Calls petService.savePetConditions(petId, selectedConditions)
   - If allergens selected: calls petService.savePetAllergens(petId, allergens)
   - If allergy deselected after previously having allergens:
     clears pet_allergens table (allergens are orphaned)
   - Fires haptics.saveSuccess()
   - Navigates to Pet Hub (if from Create flow) or back (if from Edit)

   Score Accuracy badge update:
   After save, if profile is now "complete" (name + species + breed +
   DOB + weight + conditions), show a brief toast or celebration:
   "Profile complete! [Pet Name]'s scores are now fully personalized."
   Fire haptics.profileComplete().

2. src/components/ConditionChip.tsx
   Reusable chip component:
   - Props: label, tag, isSelected, isSpecial (for Perfectly Healthy),
     onToggle, disabled
   - Normal chip: #242424 background, white text. Selected: teal
     background (#00B4D8), white text.
   - Special "Perfectly Healthy" chip: selected = green (#34C759)
     background + checkmark icon. Unselected = same as normal.
   - Disabled state (for obesity when underweight selected, vice versa):
     50% opacity, non-tappable.
   - Compact size: fits 2 per row with 8px gap.

Show me the plan. Specifically confirm:
1. "Perfectly Healthy" mutual exclusion logic is correct
2. Allergen section visibility is tied to 'allergy' chip state
3. Obesity/underweight mutual exclusion works
4. No UPVM-prohibited terms appear in any label or description
```

**Review checkpoint:** The "Perfectly Healthy" mutual exclusion is the trickiest UI logic in this session. Verify Claude's plan handles: (a) tapping a condition after "Perfectly Healthy" deselects it, (b) deselecting all conditions doesn't auto-select "Perfectly Healthy" (user must explicitly tap it), (c) saving with "Perfectly Healthy" selected stores zero rows.

```
/execute
```

---

### Prompt 2 — Allergen Picker Polish + "Other" Dropdown

```
Conditions screen is working. Now polish the allergen picker section.

The "Other protein (searchable)" dropdown needs implementation:

When user taps "Other" allergen chip:
- A text input appears below the chip grid
- Placeholder: "Search or enter allergen (e.g., venison, rabbit)"
- As user types, show suggestions from a static list of less-common
  protein sources: venison, rabbit, duck, bison, kangaroo, quail,
  goat, pheasant, alligator, salmon (if not already in main list)
- User can select a suggestion OR type custom text and press "Add"
- Added custom allergens appear as chips below the main allergen grid
  with an "×" button to remove
- Custom chips visually distinct: outline style instead of filled
- Each custom allergen saved with is_custom = true in pet_allergens

Edge cases to handle:
- Duplicate prevention: user cannot add an allergen that matches an
  existing chip label (case-insensitive)
- Empty string: "Add" button disabled when input is empty
- Max custom allergens: 10 (prevent abuse / accidental data issues)
- When 'allergy' condition is deselected: allergen section hides,
  but data is NOT immediately deleted — only cleared on next save
  (allows user to re-select 'allergy' without losing their list)
```

---

### Prompt 3 — Condition Copy Audit + Empathy Microcopy Stubs

```
Before we close the health conditions screen, audit all user-facing
text for D-095 compliance.

Grep all string literals in HealthConditionsScreen.tsx and
ConditionChip.tsx for:
'prescribe', 'treat' (medical context), 'cure', 'prevent', 'diagnose',
'toxic', 'dangerous', 'harmful', 'avoid', 'terrible'

Must be zero results for prohibited terms.

Also verify:
- No condition chip label implies Kiba provides medical advice
- No text says "Kiba will monitor..." (D-095 violation per earlier
  review — implies clinical surveillance)
- Section header says "Health Conditions" not "Medical Conditions"
  or "Diagnoses"

Add brief, D-095-compliant subtext below the conditions section:
"Tell us about [Pet Name]'s health so we can check food ingredients
against published guidelines."

NOT: "Tell us about [Pet Name]'s health so we can recommend the
right food" (implies prescription).

After audit, report:
- Any violations found and fix applied
- Confirmation of zero violations
- Exact grep commands used
```

---

### Prompt 4 — Document Before Clear

```
Write session3-m2-progress.md to project root:

## Files Created
- List every file with path and description

## Screen Inventory
- HealthConditionsScreen: section structure, chip lists by species
- ConditionChip: props interface, visual states

## Mutual Exclusion Logic
- "Perfectly Healthy" ↔ all conditions
- Obesity ↔ underweight
- How allergen section visibility ties to 'allergy' chip

## Allergen Data Flow
- User selects allergen chips → savePetAllergens() → pet_allergens table
- Custom allergens via "Other" dropdown → is_custom = true
- Cross-reactivity (D-098) NOT in this screen — handled at scoring time

## D-095 Compliance Audit
- Report from Prompt 3

## Decisions Applied
- Every D-number referenced

## Session 4 Pickup
"Session 4 builds the Portion Calculator and Treat Battery.

Key references:
- D-060: RER = 70 × (kg)^0.75
- D-061: Goal weight logic — RER at goal weight, not current
- D-062: Cat hepatic lipidosis guard — warn if >1% body weight/week
- D-063: Geriatric cat calorie inflection — 14+ cats need MORE calories
- D-064: life_stage derivation (already implemented in utils/lifeStage.ts)
- D-106: Weight management — obesity/underweight are conditions,
  portions affected not scores

PORTION_CALCULATOR_SPEC.md is the authoritative reference for DER
multiplier tables and safety guard thresholds. Read it in full.

Pet type and petService are unchanged from Session 1.
HealthConditionsScreen stores conditions/allergens to Supabase."
```

Verify document. Then:

```
/clear
```

Commit: `M2: Session 3 — health conditions, allergen picker, condition chips`

---

## Session 4: Portion Calculator + Treat Battery

**Fresh context. This session is pure math — similar to the M1 scoring engine in complexity. DER multiplier tables, safety guards, and calorie arithmetic.**

---

### Prompt 1 — Load Context + Plan Portion Calculator

```
/plan

@session1-m2-progress.md @PORTION_CALCULATOR_SPEC.md @src/types/pet.ts
@src/utils/lifeStage.ts

Read session1-m2-progress.md for the Pet type.
Read PORTION_CALCULATOR_SPEC.md in FULL — it is the authoritative
spec for all calorie math. Do not deviate from it.

Starting M2 Session 4: Portion Calculator and Treat Battery.

Before planning, read DECISIONS.md:
- D-060 (RER: 70 × (kg)^0.75 — dogs and cats)
- D-061 (goal weight: RER at goal weight, premium-gated)
- D-062 (cat hepatic lipidosis guard: warn if >1% body weight/week)
- D-063 (geriatric cat inflection: 14+ cats need MORE calories)
- D-064 (life_stage derivation — already in utils/lifeStage.ts)
- D-106 (weight ≠ score modifier: weight status affects portions only)

Scope — four deliverables:

1. src/services/portionCalculator.ts
   Pure calculation functions. No Supabase calls, no UI.

   calculateRER(weightKg: number): number
     RER = 70 × (weightKg) ^ 0.75
     Returns kcal/day

   getDerMultiplier(
     species: 'dog' | 'cat',
     lifeStage: LifeStage,
     isNeutered: boolean,
     activityLevel: ActivityLevel,
     conditions: string[]  // from pet_conditions
   ): { multiplier: number, label: string, source: string }

   DER multiplier tables from PORTION_CALCULATOR_SPEC.md:

   DOG multipliers (LOCKED — from PORTION_CALCULATOR_SPEC.md §3):
   | Condition | Multiplier | Label |
   |-----------|-----------|-------|
   | Puppy (<4mo) | 3.0 | "Growing puppy (<4mo)" |
   | Puppy (4+ mo) | 2.0 | "Growing puppy" |
   | Adult, low, neutered | 1.2 | "Neutered, low activity" |
   | Adult, low, intact | 1.4 | "Intact, low activity" |
   | Adult, moderate, neutered | 1.4 | "Neutered adult" |
   | Adult, moderate, intact | 1.6 | "Intact adult" |
   | Adult, high, neutered | 1.6 | "Active neutered" |
   | Adult, high, intact | 1.8 | "Active intact" |
   | Working dog | 3.0 | "Working dog" (fixed, not a range) |
   | Senior, low-moderate | 1.2 | "Senior" |
   | Senior, high | 1.4 | "Active senior" |
   | Geriatric | 1.2 | "Geriatric" |

   Note: Obesity/underweight are NOT separate multiplier rows.
   They use goal-weight mode (DER calculated at goal weight)
   with the pet's normal activity/neuter multiplier.

   CAT multipliers (LOCKED — from PORTION_CALCULATOR_SPEC.md §3):
   | Condition | Multiplier | Label |
   |-----------|-----------|-------|
   | Kitten | 2.5 | "Growing kitten" |
   | Intact adult | 1.4 | "Intact adult" |
   | Neutered adult, indoor/low | 1.0 | "Indoor neutered" |
   | Neutered adult, moderate | 1.2 | "Neutered adult" |
   | Neutered adult, high | 1.6 | "Active neutered" |
   | Senior | 1.1 | "Senior" |
   | Geriatric (14+) | 1.5 | "Geriatric" (LOCKED) |

   Note: Mature cats (7-11yr) map to adult bucket — use adult
   multipliers, not senior. See PORTION_CALCULATOR_SPEC §2.

   CRITICAL — D-063 geriatric cat rule:
   Cats 14+ (geriatric) need MORE calories due to sarcopenia. The
   multiplier goes UP to 1.5 at geriatric, not down. This is
   counterintuitive and must be handled correctly. Check the spec.

   calculateDailyPortion(
     derKcal: number,
     kcalPerCup: number | null,
     kcalPerKg: number | null
   ): { cups: number | null, grams: number | null }
     cups = derKcal / kcalPerCup (if product has kcal_per_cup)
     grams = (derKcal / kcalPerKg) × 1000 (if product has kcal_per_kg)
     Return both — UI picks which to display

   calculateGoalWeightPortion(
     currentWeightLbs: number,
     goalWeightLbs: number,
     species: 'dog' | 'cat',
     lifeStage: LifeStage,
     isNeutered: boolean,
     activityLevel: ActivityLevel,
     conditions: string[]
   ): { derKcal: number, multiplier: number, weeklyLossRate: number,
        hepaticWarning: boolean }

     CRITICAL safety check — D-062:
     For cats: calculate implied weekly loss rate
     weeklyLossRate = (currentWeightLbs - goalWeightLbs) / estimatedWeeksToGoal
     If weeklyLossRate > 1% of currentWeightLbs → hepaticWarning = true
     estimatedWeeksToGoal: assume safe rate of 0.5% body weight/week
     → weeks = (currentWeight - goalWeight) / (currentWeight × 0.005)

     This is a UI flag — the function returns the data, the UI decides
     how to warn (see Prompt 3).

2. src/services/treatBattery.ts
   Pure calculation functions.

   calculateTreatBudget(derKcal: number): number
     return derKcal × 0.10 (10% rule — veterinary standard)

   calculateTreatsPerDay(
     treatBudgetKcal: number,
     kcalPerTreat: number
   ): { count: number, warning: boolean }
     count = Math.floor(treatBudgetKcal / kcalPerTreat)
     warning = kcalPerTreat > treatBudgetKcal (single treat exceeds budget)
     Floor, not round — never recommend more treats than the budget allows

3. Tests: __tests__/services/portionCalculator.test.ts

   Required regression tests from PORTION_CALCULATOR_SPEC.md:

   Test 1: 40lb (18.1kg) neutered adult dog, moderate activity
     RER = 70 × 18.1^0.75 = ~674 kcal
     DER = 674 × 1.4 = ~944 kcal (neutered moderate per locked table)
     Treat budget = ~94 kcal

   Test 2: 10lb (4.5kg) neutered indoor cat, low activity (cat default)
     RER = 70 × 4.5^0.75 = ~234 kcal
     DER = 234 × 1.0 = ~234 kcal (neutered, low)
     Treat budget = ~23 kcal

   Test 3: Goal weight — 40lb dog targeting 30lb, obesity condition
     RER at 30lb (13.6kg) = 70 × 13.6^0.75 = ~505 kcal
     DER = 505 × 1.4 = ~707 kcal (neutered moderate, at GOAL weight)
     NOT: DER at 40lb (which would be higher)

   Test 4: CRITICAL — Cat hepatic lipidosis guard
     15lb cat, goal weight 10lb, obesity condition
     Current DER (at 15lb): RER_15 × multiplier
     Goal DER (at 10lb): RER_10 × multiplier
     Daily deficit = current DER − goal DER
     Weekly deficit = daily deficit × 7
     Implied weekly loss (lbs) = weekly deficit / 3500
     Weekly loss % = (implied weekly loss / current weight) × 100
     If weekly loss % > 1.0 → hepaticWarning = true
     Use exact formula from PORTION_CALCULATOR_SPEC.md §5.

   Test 5: Geriatric cat (15 years old)
     DER multiplier must be exactly 1.5 (locked, D-063)
     NOT lower than adult. NOT a range.

   Test 6: Puppy (<4 months)
     DER multiplier = 3.0

   Test 7: Treat exceeds budget
     DER = 200 kcal, treat budget = 20 kcal, treat = 25 kcal/treat
     → count = 0, warning = true

4. Tests: __tests__/services/treatBattery.test.ts
   - Budget = 10% of DER exactly
   - Zero treats if single treat exceeds budget
   - Floor rounding (budget 22 kcal, treat 7 kcal → 3 not 3.14)

Show me the plan. Specifically confirm:
1. RER formula matches D-060 exactly
2. Geriatric cat multiplier goes UP not down (D-063)
3. Goal weight uses goal weight for RER, not current (D-061)
4. Hepatic lipidosis guard threshold matches spec (D-062)
```

**This is the most important review in Session 4.** The geriatric cat inflection (D-063) and the hepatic lipidosis guard (D-062) are the two calculations most likely to be implemented incorrectly. Check them carefully.

```
/execute
```

---

### Prompt 2 — Verify Regression Tests

```
Before building UI, run all portion calculator regression tests.

Confirm these exact outputs (allow ±5 kcal tolerance for rounding):

Test 1: 40lb neutered adult dog
  RER: ~674 kcal → DER: ~1079 kcal → Treat budget: ~108 kcal

Test 2: 10lb neutered indoor cat
  RER: ~234 kcal → DER: ~281 kcal → Treat budget: ~28 kcal

Test 3: 40lb→30lb goal weight dog
  RER at goal: ~505 kcal → DER: ~505 kcal (1.0× for weight loss)

Test 4: 15lb→10lb cat → hepaticWarning: true

Test 5: 15yr geriatric cat → multiplier ≥ 1.4

Show me actual vs expected for each test.
If any fail, debug against PORTION_CALCULATOR_SPEC.md before continuing.
```

---

### ⚠️ COMPACT MOMENT

Math is verified. Now you're building UI for the portion display. Same domain (portions), but the implementation details of the calculator internals can be compacted away — you only need the function signatures.

```
/compact
```

Orient after compact:

```
Context compacted. Confirm you have in memory:

- portionCalculator.ts: calculateRER, getDerMultiplier,
  calculateDailyPortion, calculateGoalWeightPortion
- treatBattery.ts: calculateTreatBudget, calculateTreatsPerDay
- All regression tests passing
- Pet type from src/types/pet.ts

Confirm before I continue.
```

---

### Prompt 3 — Portion Display UI

```
Calculator math is verified. Now build the UI components that
display portion and treat data.

Two components, one screen section:

1. src/components/PortionCard.tsx
   Displayed on the Pet Hub screen (Session 5) and optionally on
   the scan result screen as an advisory card.

   Props:
   - pet: Pet
   - product: Product | null (null = generic daily summary)
   - conditions: string[]

   Renders:
   - Daily calorie target: "[DER] kcal/day for [Pet Name]"
   - If product provided AND has kcal_per_cup:
     "~[cups] cups/day of [product name]"
   - If product provided AND has kcal_per_kg but no kcal_per_cup:
     "~[grams]g/day of [product name]"
   - DER multiplier label: "Based on: [label] ([multiplier]× RER)"
   - Small info icon → tooltip explaining the calculation

   Goal weight mode (premium — check permissions.ts):
   - If pet has weight_goal_lbs AND conditions includes
     'obesity' or 'underweight':
     Show adjusted portion at goal weight
     "Goal weight portions: [kcal] kcal/day → ~[cups] cups/day"
   - D-062 cat hepatic lipidosis guard:
     If hepaticWarning = true, show amber warning card:
     "Gradual weight loss recommended for cats. Losing weight too
     quickly can strain the liver. Consider discussing a weight loss
     plan with your veterinarian."
     Fire haptics.hepaticWarning()
     D-095 compliant: factual, no prescriptive terms

   Visual: #242424 card, 12px radius, teal accent for calorie number

2. src/components/TreatBatteryGauge.tsx
   Visual battery gauge showing daily treat budget consumption.

   Props:
   - treatBudgetKcal: number
   - consumedKcal: number (0 for now — pantry tracking in M5)
   - petName: string

   Renders:
   - Horizontal bar: green fill from left
   - Label: "[petName]'s Treat Budget: [consumed]/[budget] kcal"
   - Percentage text inside bar
   - If consumed > 80%: bar turns amber
   - If consumed > 100%: bar turns red with "Over budget" label

   For M2: consumedKcal will always be 0 (no pantry tracking yet).
   The component must work correctly when M5 pipes in real data.
   Show the full budget bar as "available."

3. Integration into scan result screen:
   On ResultScreen.tsx (built in M1), add a section below the fold:
   "[Pet Name]'s Daily Portion" card — only renders when:
   - Active pet has weight_current_lbs
   - Scanned product has kcal_per_cup or kcal_per_kg
   - Product category is 'daily_food' (no portions for treats)

   For treats: show treat battery instead:
   "[Pet Name]'s Treat Budget" with per-treat count:
   "[Pet Name] can have [count] of these per day"
   Warning if single treat exceeds budget.

Visual design:
- Match existing M1 ResultScreen style (#1A1A1A, #242424 cards)
- Portion card: teal accent for the calorie number
- Treat battery: green/amber/red gradient bar
- All text follows D-094: pet name always in context
- All advisory text follows D-095: factual, no prescriptive terms

No changes to scoring engine. Portions are display-only, never
modify scores (D-106).
```

---

### Prompt 4 — Document Before Clear

```
Write session4-m2-progress.md to project root:

## Files Created
- List every file with path and description

## Calculator Functions
- Paste full function signatures for portionCalculator.ts
  and treatBattery.ts
- DER multiplier table summary (species × condition → multiplier)

## Regression Test Results
Show actual vs expected for all 7 tests:
- Test 1 (dog DER): expected ~1079, actual [X]
- Test 2 (cat DER): expected ~281, actual [X]
- Test 3 (goal weight): expected ~505, actual [X]
- Test 4 (hepatic guard): expected warning=true, actual [X]
- Test 5 (geriatric cat): expected multiplier ≥1.4, actual [X]
- Test 6 (puppy): expected 3.0, actual [X]
- Test 7 (treat exceeds): expected count=0 warning=true, actual [X]

## UI Components
- PortionCard props and rendering conditions
- TreatBatteryGauge props and color thresholds
- Where they render on ResultScreen

## Safety Guards
- Cat hepatic lipidosis: threshold, warning text, D-095 compliance
- Geriatric cat: confirm multiplier goes UP not down

## Decisions Applied
- Every D-number referenced

## Session 5 Pickup
"Session 5 builds the Pet Hub screen with multi-pet carousel (D-120),
stale weight indicator (D-117), and Score Accuracy progress bar.

Key references:
- D-120: Multi-pet carousel — horizontal avatar row, teal border
  on active, dimmed inactive. useActivePetStore.
- D-117: Stale weight — amber prompt if weight >6 months old
- D-086: Colors
- D-121: Haptics

useActivePetStore is in src/stores/useActivePetStore.ts.
Pet type and petService unchanged.
All session progress docs have cumulative file lists."
```

Verify document. Then:

```
/clear
```

Commit: `M2: Session 4 — portion calculator, treat battery, safety guards`

---

## Session 5: Pet Hub + Multi-Pet Carousel + Integration

**Final M2 session. Ties everything together.**

---

### Prompt 1 — Load Context + Plan Pet Hub

```
/plan

@session4-m2-progress.md @session2-m2-progress.md
@src/stores/useActivePetStore.ts @src/types/pet.ts
@src/utils/haptics.ts

Read session4-m2-progress.md (has portion components) and
session2-m2-progress.md (has form screens for navigation targets).

Starting M2 Session 5: Pet Hub screen and multi-pet integration.

Before planning, read DECISIONS.md:
- D-120 (multi-pet carousel: horizontal avatar row, teal border
  active, dimmed inactive, 48px active / 36px inactive, "+ Add Pet"
  triggers D-052 paywall gate. Free tier: 1 pet, no carousel.)
- D-117 (stale weight: amber prompt if weight_updated_at > 6 months.
  "Weight last updated [N] months ago — still accurate?")
- D-086 (colors)
- D-094 (pet name always in context)
- D-121 (haptics)

Scope — two deliverables + integration testing:

1. src/screens/PetHubScreen.tsx
   The central pet management screen, replacing PetProfileScreen
   from M1 placeholder. Accessed from "Me" tab.

   Layout (top to bottom):

   a. Multi-pet carousel (D-120) — only visible when 2+ pets exist
      AND user is premium
      - Horizontal ScrollView of pet avatars
      - Active pet: 48px, full opacity, teal border (#00B4D8), 2px
      - Inactive pets: 36px, 50% opacity, no border
      - Tap inactive pet → setActivePet(), all cards below update
      - Rightmost: "+ Add Pet" circle with plus icon
        * Free tier: triggers paywall (check permissions.ts)
        * Premium: navigates to CreatePetScreen
      - Single pet (free tier): just show the pet's avatar + name
        centered, no carousel

   b. Pet summary card — main card for active pet
      - Pet photo (or species silhouette), name, species, breed
      - Life stage badge (e.g., "Adult" / "Senior" / "Kitten")
      - "Edit" icon (top right) → navigates to EditPetScreen
      - Score Accuracy progress bar:
        Calculated from profile completeness:
        name (20%) + species (20%) + breed (15%) + DOB (15%) +
        weight (15%) + conditions (15%) = 100%
        Display: "Score Accuracy: [X]%" with fill bar
        Teal fill (#00B4D8)
        If <100%: "Complete [Pet Name]'s profile for better scores"
        Tap → navigates to EditPetScreen

   c. Stale weight indicator (D-117)
      - Only visible when weight_updated_at is >6 months ago
      - Amber (#FF9500) card or inline prompt:
        "Weight last updated [N] months ago — still accurate?"
      - Tappable → navigates to EditPetScreen with weight field focused
      - "N months" calculated from weight_updated_at to now

   d. Quick stats row
      - Daily calories: "[DER] kcal/day" (from portionCalculator)
      - Activity level badge
      - Neutered status icon
      - Weight: "[X] lbs" (or "Not set" if null)

   e. Health conditions summary
      - If "Perfectly Healthy": green badge
      - If conditions exist: chip row showing active conditions
      - If allergens exist: "[N] food allergens tracked"
      - "Edit Health" link → HealthConditionsScreen

   f. Recent scans (placeholder)
      - "No scans yet — try scanning a product!" with scan icon
      - In M4+, this will show last 3-5 scan results with scores

   g. Pet deletion (at very bottom, de-emphasized)
      - "Delete [Pet Name]" red text link
      - Tapping → same confirmation modal as EditPetScreen

2. Update navigation:
   - Me tab now routes to PetHubScreen (replacing M1 placeholder)
   - PetHubScreen → EditPetScreen (edit icon)
   - PetHubScreen → HealthConditionsScreen (edit health link)
   - PetHubScreen → CreatePetScreen (add pet button)
   - EditPetScreen → HealthConditionsScreen (health & diet link)
   - CreatePetScreen → HealthConditionsScreen → PetHubScreen
     (create flow chain)
   - All navigation uses React Navigation stack within Me tab

3. Integration testing (manual checklist — not automated):
   Walk through complete flows:

   Flow A — New user, first pet:
   1. App opens → Onboarding → Scan → Light profile (M1, name+species)
   2. Navigate to Me tab → PetHubScreen shows basic profile
   3. Score Accuracy: ~40% (name + species only)
   4. Tap "Complete profile" → EditPetScreen
   5. Fill breed, DOB, weight → Save
   6. Score Accuracy: ~85%
   7. Tap "Health & Diet" → HealthConditionsScreen
   8. Select conditions + allergens → Save
   9. Return to Hub → Score Accuracy: 100% 🎉

   Flow B — Add second pet (premium):
   1. Hub → "+ Add Pet" → CreatePetScreen
   2. Fill full profile → Continue to Health → Save
   3. Return to Hub → carousel now visible with 2 avatars
   4. Tap inactive pet → all cards update to new pet

   Flow C — Stale weight:
   1. Set a pet's weight_updated_at to 7 months ago (in Supabase)
   2. Hub shows amber "Weight last updated 7 months ago" prompt
   3. Tap → EditPetScreen with weight field

   Flow D — Delete:
   1. Hub → "Delete [Pet Name]" → modal
   2. Type wrong name → button disabled
   3. Type correct name → delete → if last pet, show create screen

Show me the plan. Pay special attention to:
1. Carousel only renders for premium with 2+ pets
2. Score Accuracy percentages match the field completeness formula
3. Stale weight calculation uses weight_updated_at correctly
4. Navigation graph is complete — no dead ends
```

```
/execute
```

---

### Prompt 2 — Active Pet Context Wiring

```
Hub screen is rendering. Now wire the active pet context into
existing M1 screens.

The useActivePetStore.activePetId must now be consumed by:

1. ScanScreen.tsx (M1)
   - On successful scan: pass activePetId to scoring engine
   - If no active pet (null): the M1 D-092 flow already handles this
     (light profile capture). No changes needed.
   - If active pet exists: skip D-092 light capture, go directly
     to ResultScreen with active pet's profile

2. ResultScreen.tsx (M1)
   - Pet name in score display must come from active pet store
   - Pet photo (or silhouette) in result header from active pet
   - Portion card uses active pet for calorie calculations
   - If active pet changes while on result screen (unlikely but
     possible via deep link): re-score with new pet profile

3. HomeScreen.tsx (M1)
   - Show active pet name: "Scanning for [Pet Name]"
   - Pet avatar in header area

Changes should be minimal — the M1 screens already accept a
petProfile parameter. The wiring connects useActivePetStore to
those parameters.

After wiring, verify:
- Scan → score flow still works end-to-end
- Pet name appears in D-094 suitability framing
- Score changes when switching active pet (same product, different
  pet = different score — this is the core promise)
- M1 scoring engine tests still pass (npx jest)
```

---

### Prompt 3 — Compliance + Final Audit

```
M2 is functionally complete. Run the full compliance audit across
all M2 files before we close.

Check every file in src/screens/, src/services/petService.ts,
src/services/portionCalculator.ts, src/services/treatBattery.ts,
and src/components/ for the following:

D-084 — Zero emoji audit:
  Grep for emoji unicode ranges across all M2 files.
  Must be zero results.

D-086 — Color consistency:
  Grep for hex color codes. Confirm only these appear:
  #1A1A1A (background), #242424 (cards), #00B4D8 (teal accent),
  #34C759 (green — Perfectly Healthy, good scores),
  #FF9500 (amber — stale weight, warnings),
  #FF3B30 (red — errors, delete)
  Flag any off-palette colors.

D-094 — Suitability framing:
  Confirm pet name appears on every screen that displays pet info.
  Confirm no "naked" scores without pet context.

D-095 — UPVM compliance:
  Grep all string literals for prohibited terms:
  'prescribe', 'treat' (medical), 'cure', 'prevent', 'diagnose',
  'recommend' (in medical context), 'monitor' (implies clinical),
  'toxic', 'dangerous'
  Must be zero results.

D-106 — Weight isolation:
  Confirm portionCalculator.ts and treatBattery.ts are NEVER
  imported by any file in src/services/scoring/.
  Portions affect display only — never scoring.

D-117 — Stale weight:
  Confirm weight_updated_at is set whenever weight_current_lbs
  is modified (in petService.ts updatePet function).

D-118 — Sex field:
  Confirm sex is optional (null valid) and never used in scoring.

D-119 — Perfectly Healthy:
  Confirm zero pet_conditions rows stored when selected.
  Confirm mutual exclusion with all other conditions.

D-120 — Carousel:
  Confirm free tier shows no carousel (1 pet max).
  Confirm paywall check uses permissions.ts (not inline isPremium).

D-121 — Haptics:
  Confirm ALL interactive elements in M2 screens fire the correct
  haptic function per the D-121 map.
  List each haptic call site with the function used.

After audit, report:
- Violations found and fixes applied
- Confirmation per D-number
- Exact grep commands used
```

---

### Prompt 4 — Document Final Session + M2 Summary

```
M2 is complete and audit-clean. Write two documents:

1. session5-m2-progress.md — same format as previous sessions

2. M2-SUMMARY.md — comprehensive milestone summary:

## M2 Completion Status
- Total files created/modified
- Total test count across all M2 test files
- All tests passing: yes/no

## Schema Changes
- 002_m2_pet_profiles.sql: summary of adds, renames, drops

## Screen Inventory
- PetHubScreen
- CreatePetScreen
- EditPetScreen
- HealthConditionsScreen
And for each: route, key features, which decisions it implements

## Service Layer
- petService.ts: all functions with signatures
- portionCalculator.ts: all functions with signatures
- treatBattery.ts: all functions with signatures

## Component Library (M2 additions)
- ConditionChip
- BreedSelector
- PetPhotoSelector
- PortionCard
- TreatBatteryGauge
Each with props interface summary

## Store Changes
- useActivePetStore: shape, persistence, consumers

## Safety Features
- Cat hepatic lipidosis guard: threshold, warning, D-095 compliance
- Geriatric cat calorie inflection: confirmed multiplier rises
- Obesity/underweight mutual exclusion

## Regression Tests
- Portion calculator: all 7 tests with actual results
- Life stage derivation: all test cases
- Service layer: all CRUD tests

## Compliance Audit
- D-084: [pass/fail]
- D-086: [pass/fail]
- D-094: [pass/fail]
- D-095: [pass/fail]
- D-097: [pass/fail]
- D-098: [pass/fail]
- D-106: [pass/fail]
- D-116: [pass/fail]
- D-117: [pass/fail]
- D-118: [pass/fail]
- D-119: [pass/fail]
- D-120: [pass/fail]
- D-121: [pass/fail]

## Decisions Applied (Full List)
Every D-number referenced across all 5 sessions

## M3 Dependencies
What M3 needs from M2:
- Pet profiles stored in Supabase (schema complete)
- Active pet store consumed by scan flow
- Portion calculator ready for pantry integration (M5)
- Allergen profile ready for scoring cross-reference (already wired in M1)

## Known Limitations
- Soft delete not implemented (hard delete only) — M3+
- Breed list static, not comprehensive — expand in M4
- Treat battery always shows 0 consumed — needs M5 pantry
- No pet photo compression/optimization
- Score Accuracy bar is cosmetic — doesn't block functionality
```

Verify both documents. Then:

```
/clear
```

Final commit: `M2: Session 5 — Pet Hub, multi-pet carousel, integration, compliance audit`

Tag: `m2-complete`

---

## Session Map — Full M2 Reference

| Point | Command | Reason |
|-------|---------|--------|
| Session 1 start | — | CLAUDE.md loads automatically |
| End Session 1 (foundation) | `/clear` | Schema/types ≠ UI screens |
| Session 2 start | Load session1-m2-progress.md | Fresh context + types |
| End Session 2 (screens) | `/clear` | Form UI ≠ health system |
| Session 3 start | Load session2 + session1 progress | Need form navigation + types |
| End Session 3 (health) | `/clear` | Health conditions ≠ calorie math |
| Session 4 start | Load session1-m2-progress.md | Need Pet type for calculator |
| After calculator verified | `/compact` | Same domain, cut debug chatter |
| End Session 4 (portions) | `/clear` | Math ≠ Hub UI |
| Session 5 start | Load session4 + session2 progress | Need portions + screens |
| End Session 5 (complete) | Final commit + tag | M2 boxed |

---

## Decision Reference — Which Prompts Use Which D-Numbers

| D-Number | Topic | Used In |
|----------|-------|---------|
| D-060 | RER formula | S4-P1 |
| D-061 | Goal weight logic | S4-P1 |
| D-062 | Cat hepatic lipidosis guard | S4-P1, S4-P2, S4-P3 |
| D-063 | Geriatric cat inflection | S4-P1, S4-P2 |
| D-064 | life_stage derivation | S1-P1 |
| D-084 | Zero emoji / SF Symbols | S1-P1, S2-P1, S3-P1, S5-P3 |
| D-086 | Color scheme | S2-P1, S3-P1, S5-P1, S5-P3 |
| D-092 | Onboarding (scan-first) | S2-P1, S5-P2 |
| D-094 | Suitability framing | S2-P1, S5-P2, S5-P3 |
| D-095 | UPVM compliance | S3-P1, S3-P3, S4-P3, S5-P3 |
| D-097 | Health conditions / allergens | S1-P1, S3-P1 |
| D-098 | Cross-reactivity | S1-P1, S3-P1 |
| D-102 | Breed selector | S1-P1, S2-P1 |
| D-106 | Weight ≠ scoring | S3-P1, S4-P1, S5-P3 |
| D-110 | Table name: pets | S1-P1 |
| D-116 | Approximate age mode | S1-P1, S1-P3, S2-P1 |
| D-117 | Stale weight indicator | S1-P1, S5-P1, S5-P3 |
| D-118 | Sex field | S1-P1, S2-P1, S5-P3 |
| D-119 | "Perfectly Healthy" chip | S3-P1, S5-P3 |
| D-120 | Multi-pet carousel | S1-P1, S5-P1, S5-P3 |
| D-121 | Haptic feedback map | S1-P1, S2-P1, S3-P1, S4-P3, S5-P3 |

---

## Notes for Steven

**Before running any prompt:**
1. Verify M1 is complete and tests pass (`npx jest`)
2. Verify CLAUDE.md is updated to M2 with correct column names
3. Have PET_PROFILE_SPEC.md and PORTION_CALCULATOR_SPEC.md in the project root — Claude Code reads them via `@` references
4. Seed at least one product in Supabase so the scan flow integration test (Session 5) has something to score against

**During Session 1:**
- The migration is your biggest risk. Column renames are destructive. If you have real data in the pets table, back it up before running 002_m2_pet_profiles.sql
- Verify the migration runs without errors before proceeding to Prompt 2
- If Claude tries to DROP and recreate instead of ALTER...RENAME, catch it in plan review

**During Session 3:**
- The "Perfectly Healthy" mutual exclusion is the trickiest UI logic. Test manually: tap conditions → tap "Perfectly Healthy" → conditions should deselect. Tap a condition → "Perfectly Healthy" should deselect. Neither direction should be automatic without user tap.
- Watch for D-095 violations in condition labels and descriptions. Any text that sounds like medical advice needs to be rewritten.

**During Session 4:**
- The geriatric cat inflection (D-063) is the #1 implementation bug risk. Multiplier goes UP at 14+, not down. If Claude's plan shows a decreasing multiplier curve for old cats, stop and correct immediately.
- The hepatic lipidosis guard (D-062) must use the spec's threshold, not a guess. Verify against PORTION_CALCULATOR_SPEC.md before approving the plan.

**During Session 5:**
- The integration test flows (A through D) should be walked through manually on a device. Claude Code can build and run the app. Don't skip this — it's where navigation dead-ends and missing data scenarios surface.
- If the scan → score flow breaks after wiring the active pet store, the issue is almost certainly the petProfile parameter shape changing. Compare the M1 PetProfile interface with the M2 Pet type.

**After M2:**
- Run `npx jest` one final time to confirm M1 scoring tests still pass alongside M2 tests
- M2 does NOT touch the scoring engine. If any scoring test fails, something was accidentally imported or modified. Investigate immediately.
- The vet audit (also in M2 scope per ROADMAP) is a parallel workstream — not blocked by code. Start outreach to DACVIM nutritionists while building.
