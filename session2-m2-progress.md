# M2 Session 2 Progress — Pet Profile Create & Edit Screens

> Written at end of Session 2. Provides full context for Session 3 pickup.
> 245/245 tests passing. 0 TypeScript errors.

---

## Files Created

| File | Description |
|------|-------------|
| `src/screens/SpeciesSelectScreen.tsx` | Full-screen "I have a..." species picker — navigates to CreatePet with species route param |
| `src/screens/CreatePetScreen.tsx` | 3-card pet creation form (Identity, Physical, Details) with validation and photo upload |
| `src/screens/EditPetScreen.tsx` | Pre-populated edit form with delete modal and "Health & Diet" placeholder link |
| `src/components/BreedSelector.tsx` | Modal breed picker with search, pinned entries, species-filtered breed list |
| `src/components/PetPhotoSelector.tsx` | Reusable 96px circular photo selector with paw-outline placeholder and camera badge |
| `src/utils/petFormValidation.ts` | Pure validation functions for pet form fields and delete confirmation |
| `__tests__/utils/petFormValidation.test.ts` | 28 tests covering all validation rules, edge cases, delete confirmation |
| `__tests__/services/petService.test.ts` | 2 new tests added for `petPhotoPath` (total file: existing + 2 new) |

## Files Modified

| File | Change |
|------|--------|
| `src/types/navigation.ts` | Added `SpeciesSelect`, `CreatePet`, `EditPet` routes to `MeStackParamList` |
| `src/navigation/index.tsx` | Registered 3 new screens in MeStack, added imports |
| `src/services/petService.ts` | Added photo upload flow: `petPhotoPath()`, `isLocalFileUri()`, `uploadPetPhoto()`, `getAuthUserId()`. Modified `createPet` and `updatePet` to handle local photo URIs with graceful fallback. |
| `src/screens/CreatePetScreen.tsx` | Replaced inline photo picker with `PetPhotoSelector` component |
| `src/screens/EditPetScreen.tsx` | Replaced inline photo picker with `PetPhotoSelector` component |

---

## Screen Inventory

### SpeciesSelectScreen
- **Purpose:** Pre-create species selection. Enforces species-lock rule (D-122).
- **Navigation:** MeMain → SpeciesSelect → CreatePet `{ species: 'dog' | 'cat' }`
- **Layout:** Dark background, "I have a..." header, two side-by-side cards (paw icon + label)
- **Haptic:** `speciesToggle()` on card tap

### CreatePetScreen
- **Purpose:** Full pet profile creation form
- **Route param:** `{ species: 'dog' | 'cat' }` — species locked from SpeciesSelect
- **Three cards:**
  - **Card 1 (Identity):** PetPhotoSelector → Name (TextInput, 20 char max) → Sex (Male/Female segmented, deselectable)
  - **Card 2 (Physical):** Breed (opens BreedSelector modal) → Date of Birth (Exact Date/Approximate Age toggle with steppers) → Weight (decimal-pad, lbs suffix)
  - **Card 3 (Details):** Activity Level (species-specific segmented) → Spayed/Neutered (Switch, default true)
- **Footer:** "Continue to Health" primary button + "Skip for now" text link
- **Activity labels (D-123):** Dogs: Low/Moderate/High/Working. Cats: Indoor/Indoor-Outdoor/Outdoor (maps to low/moderate/high)
- **Default activity:** Cat → `'low'`, Dog → `'moderate'`

### EditPetScreen
- **Purpose:** Edit existing pet profile
- **Route param:** `{ petId: string }` — loads pet from `useActivePetStore`
- **Differences from Create:**
  - Species not shown (read from `pet.species` for BreedSelector)
  - All fields pre-populated from store on mount
  - DOB pre-population: if `dob_is_approximate`, reverse-calculates years/months; else parses exact month/year
  - "Save Changes" button (not "Continue to Health")
  - No "Skip for now" link
  - Calls `updatePet(petId, updates)` instead of `createPet`
  - "Health & Diet" tappable row between Card 3 and Save (placeholder for Session 3)
  - "Delete [PetName]" red destructive button with typed-name confirmation modal
  - Post-delete: navigates to SpeciesSelect if no remaining pets, MeMain otherwise
  - Guard: renders "Pet not found" if petId not in store
- **Header title:** "Edit Profile"

### BreedSelector
- **Consumed by:** CreatePetScreen and EditPetScreen (via `breedSelectorVisible` state)
- **Data source:** Static `DOG_BREEDS` / `CAT_BREEDS` arrays from `src/data/breeds.ts`
- **Pinned entries:** `['Mixed Breed', 'Unknown / Other']` — always visible at bottom with divider
- **Search:** Case-insensitive substring filter on alphabetical breeds only
- **Selection:** Teal background highlight + checkmark on selected breed

---

## Component Props

### PetPhotoSelector
```typescript
interface PetPhotoSelectorProps {
  photoUrl: string | null;        // Current photo URI (local or https)
  species: 'dog' | 'cat';        // Accepted but uses generic paw-outline for both
  onPhotoSelected: (uri: string) => void;  // Called with local file URI
}
```

### BreedSelector
```typescript
interface BreedSelectorProps {
  species: 'dog' | 'cat';        // Determines breed list
  value: string | null;          // Currently selected breed
  onChange: (breed: string) => void;  // Called on breed selection
  visible: boolean;              // Modal visibility
  onClose: () => void;           // Close handler
}
```

---

## Form State Management

**Approach:** Pure `useState` hooks — no form library, no Zustand for form state.

**Form state fields (CreatePetScreen):**
| State | Type | Default |
|-------|------|---------|
| `name` | `string` | `''` |
| `sex` | `Sex \| null` | `null` |
| `breed` | `string \| null` | `null` |
| `dobMode` | `'exact' \| 'approximate'` | `'exact'` |
| `dobMonth` | `number` | current month |
| `dobYear` | `number` | current year |
| `approxYears` | `number` | `0` |
| `approxMonths` | `number` | `0` |
| `dobSet` | `boolean` | `false` |
| `weight` | `string` | `''` |
| `activityLevel` | `ActivityLevel` | `'low'` (cat) / `'moderate'` (dog) |
| `isNeutered` | `boolean` | `true` |
| `photoUri` | `string \| null` | `null` |
| `breedSelectorVisible` | `boolean` | `false` |
| `saving` | `boolean` | `false` |
| `errors` | `PetFormErrors` | `{}` |

EditPetScreen adds: `deleteModalVisible`, `deleteInput`, `deleting`.

### Validation Rules (petFormValidation.ts)

```typescript
export interface PetFormErrors {
  name?: string;
  weight?: string;
  dob?: string;
}

export function validatePetForm(fields: PetFormFields): PetFormErrors
export function canDeletePet(inputName: string, petName: string): boolean
export function isFormValid(errors: PetFormErrors): boolean
```

| Field | Rule | Error Message |
|-------|------|---------------|
| Name | Required, non-empty after trim | `'Pet name is required'` |
| Weight | Optional; if entered, 0.5–300 range | `'Weight must be between 0.5 and 300 lbs'` |
| DOB (exact) | If `dobSet`, year/month can't be future | `'Birth date cannot be in the future'` |
| DOB (approx) | If `dobSet`, years+months can't both be 0 | `'Please enter an approximate age'` |

### Inline Error Display
- Red border (`inputError` style) on the offending input
- `<Text style={styles.errorText}>` rendered immediately below
- Errors clear inline during `onChangeText`: `setErrors((e) => ({ ...e, fieldName: undefined }))`

### Save Button Disabled States
- `canSave = name.trim().length > 0 && !saving`
- Disabled state: reduced opacity + non-pressable

---

## Navigation

- **CreatePetScreen reached:** MeMain → "Add Pet" → SpeciesSelectScreen → tap Dog/Cat → CreatePet `{ species }`
- **EditPetScreen reached:** MeMain → tap pet card edit icon → EditPet `{ petId }`
- **"Continue to Health" navigates to:** `MeMain` (temporary — HealthConditionsScreen is Session 3 target)
- **Post-delete navigation:**
  - If remaining pets > 0 → `MeMain`
  - If no remaining pets → `SpeciesSelect` (so user can add a new pet)

### Navigation Types (MeStackParamList)
```typescript
export type MeStackParamList = {
  MeMain: undefined;
  PetProfile: { petId: string };      // pre-existing
  SpeciesSelect: undefined;            // Session 2
  CreatePet: { species: 'dog' | 'cat' }; // Session 2
  EditPet: { petId: string };          // Session 2
};
```

---

## Photo Upload Flow

1. **Selection:** PetPhotoSelector → `expo-image-picker` (allowsEditing, 1:1 aspect, 0.7 quality) → returns local file URI
2. **Storage:** URI stored in component state as `photoUri` — NO upload at selection time
3. **Upload at save:** `petService.createPet` / `updatePet` detects local URI via `isLocalFileUri()`
4. **createPet flow:** Insert pet with `photo_url: null` → get pet ID → upload to `{userId}/{petId}.jpg` → update record with public URL
5. **updatePet flow:** If photo_url is local URI → upload → set patch.photo_url to public URL. On failure → `delete patch.photo_url` (keeps existing photo)
6. **Graceful fallback:** Upload failure → pet saves with `photo_url: null` + toast: "Photo couldn't be saved — you can try again later."
7. **Deterministic path:** `{userId}/{petId}.jpg` with `upsert: true` — overwrite on re-upload, no orphaned files
8. **Auth:** `getAuthUserId()` reads from `supabase.auth.getSession()` (not from input.user_id)

### Exported for testing
```typescript
export function petPhotoPath(userId: string, petId: string): string
// Returns `${userId}/${petId}.jpg`
```

---

## Haptics Integration (D-121)

| Interaction | Haptic Function | Type |
|-------------|----------------|------|
| Species card tap (SpeciesSelect) | `speciesToggle()` | Medium impact |
| Sex toggle (Create/Edit) | `chipToggle()` | Light impact |
| DOB mode toggle | `chipToggle()` | Light impact |
| DOB stepper +/- | `chipToggle()` | Light impact |
| Activity level select | `chipToggle()` | Light impact |
| Breed selection (BreedSelector) | `chipToggle()` | Light impact |
| Successful pet save | `saveSuccess()` | Success notification |
| Delete confirmation | `deleteConfirm()` | Heavy impact |

**All 8 D-121 functions defined in haptics.ts:**
`chipToggle`, `speciesToggle`, `scanButton`, `saveSuccess`, `barcodeRecognized`, `profileComplete`, `hepaticWarning`, `deleteConfirm`

Platform guard: no-ops on web (`Platform.OS !== 'web'`).

---

## Decisions Applied

| Decision | Status | Where Applied |
|----------|--------|---------------|
| D-084 | Confirmed | Ionicons used everywhere, no emoji in UI |
| D-086 | Confirmed | Dark theme (`#1A1A1A` bg, `#242424` cards) across all screens |
| D-092 | Confirmed | Onboarding unchanged — captures only name + species |
| D-094 | Confirmed | Suitability framing — no scoring changes in Session 2 |
| D-102 | Confirmed | Searchable breed dropdown via BreedSelector modal |
| D-116 | Confirmed | DOB exact/approximate toggle with `synthesizeDob()`, `dob_is_approximate` flag |
| D-117 | Confirmed | `weight_updated_at` set in petService when weight changes |
| D-118 | Confirmed | Sex field in Card 1, neither pre-selected (null default) |
| D-119 | Confirmed | "Perfectly Healthy" chip ready for Session 3 (zero rows = healthy) |
| D-120 | Confirmed | `useActivePetStore` consumed in EditPetScreen for pet data |
| D-121 | Confirmed | All 8 haptic functions defined and wired to interactions |
| D-122 | Confirmed | Species selected on SpeciesSelectScreen, passed as route param, locked after creation |
| D-123 | Confirmed | Cat activity: Indoor/Indoor-Outdoor/Outdoor → low/moderate/high |

---

## Key Decisions Detail

- **D-122 (Species pre-create):** Species is selected on SpeciesSelectScreen BEFORE the form. Passed as `CreatePet { species }` route param. Never changeable after creation — EditPetScreen doesn't show species field. Delete + re-create is the escape hatch.

- **D-123 (Cat activity labels):** Cats get 3 options with user-friendly labels that map to the same DB values: Indoor → `'low'`, Indoor-Outdoor → `'moderate'`, Outdoor → `'high'`. Dogs get 4 options: Low/Moderate/High/Working. Default: cats `'low'`, dogs `'moderate'`.

- **D-118 (Sex field):** In Card 1 (Identity), rendered as Male/Female segmented toggle. Neither pre-selected (null default). Tapping selected value deselects it (back to null). Zero scoring impact — used for vet report credibility and pronoun personalization.

- **D-116 (DOB toggle):** `[Exact Date] | [Approximate Age]` segmented toggle. Exact: month/year steppers. Approximate: years (0–30) + months (0–11) steppers, calls `synthesizeDob()` on save. `dob_is_approximate` boolean stored on pet record. Life stage derivation works identically for both.

- **D-117 (Weight timestamp):** `weight_updated_at` set to `new Date().toISOString()` in petService whenever `weight_current_lbs` changes (both create and update). Set to null if weight is cleared.

---

## Test Count

- **Total:** 245 passing
- **New this session:** 30 tests
  - 28 in `__tests__/utils/petFormValidation.test.ts` (validation rules, edge cases, delete confirmation)
  - 2 in `__tests__/services/petService.test.ts` (petPhotoPath generation)
- **Pure Balance regression:** 69/100 (correct, unchanged)

---

## Commits This Session

| Hash | Message |
|------|---------|
| `480f100` | M2: add SpeciesSelectScreen, CreatePetScreen, EditPetScreen, BreedSelector, and navigation routes |
| `c670db1` | M2: add petFormValidation with inline errors, KeyboardAvoidingView, save spinner, and delete modal |
| `bf4d558` | M2: extract PetPhotoSelector component and add Supabase Storage photo upload |

---

## Session 3 Pickup

Session 3 builds the Health Conditions and Allergen picker screens.

**Key references:**
- **D-097:** Health conditions multi-select, species-filtered
- **D-098:** Cross-reactivity expansion (`allergen_group` and `allergen_group_possible` fields in `ingredients_dict`)
- **D-119:** "Perfectly Healthy" chip — green (#34C759), mutual exclusion with all condition chips, stores zero `pet_conditions` rows
- **D-095:** UPVM compliance — no prescriptive language in condition descriptions
- **D-121:** Haptics — `chipToggle()` for condition/allergen selection

**Types already defined in `src/types/pet.ts`:**
```typescript
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

**Service functions already in `src/services/petService.ts`:**
```typescript
export async function savePetConditions(
  petId: string,
  conditions: string[],
): Promise<void>
// Delete-and-reinsert pattern. Empty array = "Perfectly Healthy" (zero rows).

export async function savePetAllergens(
  petId: string,
  allergens: { name: string; isCustom: boolean }[],
): Promise<void>
// Delete-and-reinsert pattern. Only populated when 'allergy' condition selected.
```

**Navigation:** "Continue to Health" button on CreatePetScreen currently navigates to MeMain. Session 3 should add `HealthConditions` route and update navigation target.

**EditPetScreen:** "Health & Diet" tappable row is a placeholder — Session 3 should wire it to the conditions/allergens screen.
