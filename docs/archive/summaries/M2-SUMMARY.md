# M2 Milestone Summary — Pet Profiles + Vet Audit

> Completed: 2026-03-02
> Sessions: 5 (across 2 days)
> Commits: 18 (717f025..1638218)
> Tests: 447/447 passing, zero regressions

---

## M2 Completion Status

| Metric | Value |
|--------|-------|
| Files created | 28 |
| Files modified | 18 |
| Total M2-specific test files | 11 |
| Total M2-specific tests | 313 |
| Total project tests | 447/447 passing |
| Schema migrations | 2 (002, 003) |
| Screens created | 5 |
| Components created | 6 |
| Service functions created | 24 |
| Utility functions created | 21 |

---

## Schema Changes

### `002_m2_pet_profiles.sql` (Session 1)

**Renames (4):**
- `weight_lbs` → `weight_current_lbs` (NUMERIC(5,1))
- `birth_date` → `date_of_birth` (DATE)
- `is_spayed_neutered` → `is_neutered` (BOOLEAN)
- `activity_level` constraint updated: `'low'|'moderate'|'high'|'working'`

**Adds (5):**
- `weight_goal_lbs NUMERIC(5,1)` — target weight for obese/underweight pets
- `sex TEXT CHECK ('male'|'female')` — optional, null valid (D-118)
- `dob_is_approximate BOOLEAN DEFAULT false` — rescue pet DOB provenance (D-116)
- `weight_updated_at TIMESTAMPTZ` — stale weight detection (D-117)
- `breed_size TEXT CHECK ('small'|'medium'|'large'|'giant')` — derived, never user-entered

**Modifies (2):**
- `life_stage` constraint expanded: 6-tier `'puppy'|'kitten'|'junior'|'adult'|'mature'|'senior'|'geriatric'`
- `breed` default set to `'Mixed Breed'`

**Drops (3):**
- `age_years` (replaced by date_of_birth derivation)
- `age_months` (replaced by date_of_birth derivation)
- `health_notes` (replaced by pet_conditions/pet_allergens tables)

### `003_m2_health_reviewed.sql` (Session 5)

- `health_reviewed_at TIMESTAMPTZ` — distinguishes "Perfectly Healthy" (reviewed, 0 rows) from "never visited" (null)

---

## Screen Inventory

### PetHubScreen (Session 5)

- **Route:** `MeStack > MeMain`
- **Replaces:** M1 MeScreen (dead code, no longer in nav graph)
- **Key features:** Multi-pet carousel, score accuracy bar, stale weight indicator, quick stats, PortionCard + TreatBatteryGauge, health conditions summary, settings, delete with confirmation
- **Decisions:** D-084, D-086, D-094, D-095, D-106, D-117, D-119, D-120, D-121

### SpeciesSelectScreen (Session 2)

- **Route:** `MeStack > SpeciesSelect`
- **Key features:** Full-screen "I have a..." species picker with dog/cat cards. Ionicons paw-outline, not emoji. speciesToggle haptic on selection.
- **Decisions:** D-084, D-121

### CreatePetScreen (Session 2)

- **Route:** `MeStack > CreatePet { species: 'dog' | 'cat' }`
- **Key features:** 3-card form (Identity, Physical, Details). PetPhotoSelector, BreedSelector, weight/DOB validation, approximate DOB toggle, species-specific activity labels. "Continue to Health" → HealthConditionsScreen.
- **Decisions:** D-084, D-102, D-116, D-117, D-118, D-121, D-123

### EditPetScreen (Session 2)

- **Route:** `MeStack > EditPet { petId: string }`
- **Key features:** Pre-populated edit form. Species locked (immutable). Delete with name-match confirmation modal. "Health & Diet" link → HealthConditionsScreen.
- **Decisions:** D-084, D-102, D-116, D-117, D-118, D-121

### HealthConditionsScreen (Session 3)

- **Route:** `MeStack > HealthConditions { petId: string, fromCreate?: boolean }`
- **Key features:** Species-filtered condition grid, "Perfectly Healthy" mutual exclusion, conditional allergen picker, "Other" searchable modal, D-095 compliant subtext, profile completeness toast, sets health_reviewed_at on save.
- **Decisions:** D-084, D-095, D-097, D-098, D-106, D-119, D-121

---

## Service Layer

### petService.ts (Sessions 1-3)

```typescript
petPhotoPath(userId: string, petId: string): string
createPet(input: Omit<Pet, 'id' | 'created_at' | 'updated_at'>): Promise<Pet>
updatePet(petId: string, updates: Partial<Pet>): Promise<Pet>
deletePet(petId: string): Promise<void>
getPetsForUser(): Promise<Pet[]>
getPetConditions(petId: string): Promise<PetCondition[]>
getPetAllergens(petId: string): Promise<PetAllergen[]>
savePetConditions(petId: string, conditions: string[]): Promise<void>
savePetAllergens(petId: string, allergens: { name: string; isCustom: boolean }[]): Promise<void>
```

Key behaviors:
- `createPet`: auto-derives breed_size + life_stage, sets weight_updated_at, handles photo upload
- `updatePet`: D-117 weight_updated_at on weight change, re-derives breed_size/life_stage on breed/weight/DOB change, strips species (immutable)
- `deletePet`: cascades to pet_allergens, pet_conditions, then pets row
- `savePetConditions`: D-119 empty array stores zero rows (Perfectly Healthy)

### portionCalculator.ts (Session 4)

```typescript
lbsToKg(lbs: number): number
calculateRER(weightKg: number): number
getDerMultiplier(params: {
  species: Species; lifeStage: LifeStage | null;
  isNeutered: boolean; activityLevel: ActivityLevel;
  ageMonths?: number; conditions?: string[];
}): DerMultiplierResult
calculateDailyPortion(derKcal: number, kcalPerCup: number | null, kcalPerKg: number | null): DailyPortionResult
calculateGoalWeightPortion(params: {
  currentWeightLbs: number; goalWeightLbs: number;
  species: Species; lifeStage: LifeStage | null;
  isNeutered: boolean; activityLevel: ActivityLevel;
  ageMonths?: number; conditions?: string[];
}): GoalWeightResult
```

Key behaviors:
- RER = `70 * kg^0.75` (D-060)
- 7-tier life stage → 4-bucket mapping via getDerLifeStage()
- Dog: 12 multiplier rows. Cat: 8 multiplier rows. All LOCKED.
- Goal weight: RER at goal weight, not current (D-061)
- Hepatic guard: cats only, weeklyLossPercent > 1.0% (D-062)
- Geriatric cat: 1.5x multiplier (UP from adult 1.0x) (D-063)

### treatBattery.ts (Session 4)

```typescript
calculateTreatBudget(derKcal: number): number
calculateTreatsPerDay(treatBudgetKcal: number, kcalPerTreat: number): TreatsPerDayResult
```

Key behaviors:
- Budget = 10% of DER, rounded (D-060 veterinary standard)
- Count = floor(budget / kcalPerTreat)
- Warning when single treat exceeds budget

---

## Component Library (M2 Additions)

### ConditionChip (Session 3)

```typescript
{ label: string; isSelected: boolean; isSpecial?: boolean;
  onToggle: () => void; disabled?: boolean; icon?: string }
```

Four visual states: unselected, selected (teal), special (green for "Perfectly Healthy"), disabled (50% opacity). Fires chipToggle haptic. flexBasis '48%' for 2-per-row grid.

### BreedSelector (Session 2)

```typescript
{ species: 'dog' | 'cat'; value: string | null;
  onChange: (breed: string) => void; visible: boolean; onClose: () => void }
```

Modal searchable dropdown. Pinned entries: "Mixed Breed", "Unknown / Other" at bottom. 58 dog breeds, 32 cat breeds. chipToggle haptic on selection.

### PetPhotoSelector (Session 2)

```typescript
{ photoUrl: string | null; species: 'dog' | 'cat';
  onPhotoSelected: (uri: string) => void }
```

96px circular photo with paw-outline placeholder. Camera badge overlay. Taps launch expo-image-picker (library mode).

### AllergenSelector (Session 3)

```typescript
{ selectedNames: string[]; onSelect: (name: string) => void;
  visible: boolean; onClose: () => void }
```

Modal searchable dropdown for "Other" allergens. Hardcoded 10-item extended protein list (NOT free text, D-097 safety). Mirrors BreedSelector pattern.

### PortionCard (Session 4)

```typescript
{ pet: Pet; product: Product | null; conditions: string[] }
```

5 render modes: no weight, generic DER summary (product=null), with product portions, goal weight (premium-gated), hepatic warning. Exported helpers: formatCalories, formatCups, formatGrams, getAgeMonths, shouldShowGoalWeight.

### TreatBatteryGauge (Session 4)

```typescript
{ treatBudgetKcal: number; consumedKcal: number; petName: string }
```

Horizontal bar gauge with green/amber/red transitions at >80%/>100%. consumedKcal=0 for M2 (M5 pipes real data). Exported helpers: getBarPercent, getBarColor, getStatusLabel.

---

## Store Changes

### useActivePetStore (Session 1)

```typescript
interface ActivePetState {
  activePetId: string | null;  // persisted to AsyncStorage
  pets: Pet[];                 // fetched from Supabase, not persisted
  setActivePet: (petId: string) => void;
  loadPets: () => Promise<void>;
  addPet: (pet: Pet) => void;
  removePet: (petId: string) => void;
  updatePet: (petId: string, updates: Partial<Pet>) => void;
}
```

**Persistence:** Only `activePetId` persisted via Zustand `persist` middleware with AsyncStorage. Key: `'kiba-active-pet'`.

**Auto-selection:** addPet auto-activates if first pet. removePet auto-selects first remaining pet if removed pet was active.

**Consumers (after Session 5 wiring):**
- PetHubScreen — full store (pets, activePetId, setActivePet, removePet)
- ScanScreen — activePetId, pets, addPet
- ResultScreen — pets (for pet lookup by petId)
- HomeScreen — activePetId, pets (for "Scanning for [Pet Name]")
- OnboardingScreen — addPet
- HealthConditionsScreen — pets (for pet lookup)
- CreatePetScreen — (uses petService.createPet which calls addPet internally)
- EditPetScreen — pets (for pre-population), updatePet (via petService)

---

## Safety Features

### Cat Hepatic Lipidosis Guard (D-062)

- **Threshold:** `weeklyLossPercent > 1.0%` (strict >, not >=)
- **Formula:** `(dailyDeficit * 7 / 3500 / currentWeightLbs) * 100`
- **Species gate:** Cats only. Dogs never trigger regardless of loss rate.
- **UI:** Amber card in PortionCard with alert-circle icon. Copy: "Gradual weight loss is important. Losing weight too quickly can strain the liver in cats. Consider discussing a weight loss plan with your veterinarian."
- **D-095 compliance:** Zero prohibited terms. "Consider discussing" is advisory redirect, not prescriptive.
- **Haptic:** `hepaticWarning()` fires via useEffect when warning becomes visible.

### Geriatric Cat Calorie Inflection (D-063)

- **Multiplier:** 1.5x (NRC 2006, Ch. 15) — UP from adult indoor neutered 1.0x
- **Rationale:** Sarcopenia + declining digestive efficiency require MORE calories
- **Boundary:** 167 months (13yr 11mo) → senior → 1.1x. 168 months (14yr 0mo) → geriatric → 1.5x. 36% calorie increase at boundary.
- **Confirmed:** Geriatric cat floor applies even in goal weight mode.

### Obesity/Underweight Mutual Exclusion (D-106)

- **UI:** isConditionDisabled() grays out obesity when underweight selected and vice versa
- **Logic:** toggleCondition() enforces at selection time
- **Working dog override:** Working + obesity → activity overridden to moderate before multiplier lookup (spec §11)
- **Weight management affects portions only, NEVER scores.** Zero portionCalculator/treatBattery imports in scoring directory.

---

## Regression Tests

### Portion Calculator — Spec §12 Regression Cases

| # | Case | Expected DER | Result |
|---|------|-------------|--------|
| 1 | Buster, 50lb dog, adult, moderate, neutered | 1018 kcal | 1018 |
| 2 | Buster, goal 42lb | 893 kcal | 893 |
| 3 | Luna, 10lb cat, adult, low, neutered | 218 kcal | 218 |
| 4 | Geriatric cat, 12lb | 374 kcal | 374 |
| 5 | Obese geriatric cat, 15lb → 12lb goal | 374 kcal | 374 |
| 6 | Puppy <4mo, 8lb | 552 kcal | 552 |
| 7 | Puppy 6mo, 25lb | 866 kcal | 866 |

### Life Stage Derivation — Key Cases

| Age | Species | Breed Size | Expected | Result |
|-----|---------|-----------|----------|--------|
| 6mo | Dog | medium | puppy | puppy |
| 14mo | Dog | medium | junior | junior |
| 36mo | Dog | medium | adult | adult |
| 96mo (8yr) | Dog | medium | mature | mature |
| 132mo (11yr) | Dog | medium | senior | senior |
| 168mo (14yr) | Dog | medium | geriatric | geriatric |
| 6mo | Cat | n/a | kitten | kitten |
| 18mo | Cat | n/a | junior | junior |
| 144mo (12yr) | Cat | n/a | senior | senior |
| 180mo (15yr) | Cat | n/a | geriatric | geriatric |
| 18mo | Dog | giant | puppy | puppy (giant threshold is 18mo) |
| 120mo (10yr) | Dog | giant | geriatric | geriatric (giant starts earlier) |

### Service Layer — CRUD Tests (25 tests)

- createPet: 11 tests (name validation, breed_size derivation, life_stage derivation, weight_updated_at, cat breed_size=null)
- updatePet: 5 tests (D-117 weight_updated_at, re-derive breed_size/life_stage, species immutable)
- deletePet: 1 test (cascading delete)
- savePetConditions: 2 tests (D-119 empty array = zero rows)
- savePetAllergens: 2 tests (is_custom flags preserved)
- getPetConditions/getPetAllergens: 4 tests

---

## Compliance Audit (Session 5)

| D-# | Name | Status | Notes |
|-----|------|--------|-------|
| D-084 | Zero emoji | PASS | 3 violations fixed (Home/Onboarding/Search). All M2 screens clean. |
| D-086 | Color palette | PASS | All colors on-palette or alpha variants. |
| D-094 | Suitability framing | PASS | Pet name on every pet-aware screen. No naked scores. |
| D-095 | UPVM compliance | PASS | 1 violation fixed ("recommended" → "is important"). Zero prohibited terms. |
| D-097 | Conditions/allergens | PASS | Species-filtered, "Other" is hardcoded list not free text. |
| D-098 | Allergen groups | PASS | allergen_group + allergen_group_possible in schema, consumed by scoring. |
| D-106 | Weight isolation | PASS | Zero portionCalculator/treatBattery imports in scoring/. Display-only. |
| D-116 | Rescue pets | PASS | dob_is_approximate toggle, synthesizeDob utility. |
| D-117 | Stale weight | PASS | weight_updated_at set in createPet/updatePet. Amber card >6 months. |
| D-118 | Sex field | PASS | Optional (null valid). Not used in scoring. |
| D-119 | Perfectly Healthy | PASS | Zero rows stored. Mutual exclusion via toggleCondition. Green badge. |
| D-120 | Carousel | PASS | isPremium() + canAddPet() from permissions.ts. No inline checks. |
| D-121 | Haptics | PASS | 5 violations fixed. All interactive elements use named wrappers. |

---

## Decisions Applied (Full List)

Every D-number referenced across all 5 sessions:

| D-# | Name | Sessions |
|-----|------|----------|
| D-013 | DCM legume threshold | (Referenced in D-107 concern tags, not M2-specific) |
| D-052 | Multi-pet paywall | 5 (canAddPet gate on "+ Add Pet") |
| D-060 | RER formula + 10% treat rule | 4 |
| D-061 | Goal weight uses goal for RER | 4 |
| D-062 | Hepatic lipidosis guard | 4 |
| D-063 | Geriatric cat 1.5x multiplier | 4 |
| D-064 | 6-tier life stages | 1, 4 |
| D-084 | Zero emoji | 2, 3, 4, 5 |
| D-086 | Dark theme colors | 1, 2, 3, 4, 5 |
| D-094 | Suitability framing | 4, 5 |
| D-095 | UPVM compliance | 3, 4, 5 |
| D-097 | Conditions & allergens | 3 |
| D-098 | Allergen groups | 3 |
| D-102 | Searchable breed dropdown | 2 |
| D-106 | Weight management = portions not scores | 3, 4, 5 |
| D-107 | Concern tags | (Referenced in audit, not M2-specific) |
| D-109 | Breed runtime data | (Static JSON in src/content/, referenced in breeds.ts) |
| D-110 | Pets table canonical name | 1 |
| D-116 | Rescue pets / approximate DOB | 1, 2 |
| D-117 | Stale weight guard | 1, 2, 5 |
| D-118 | Sex field | 1, 2, 5 |
| D-119 | Perfectly Healthy | 3, 5 |
| D-120 | Multi-pet carousel | 1, 5 |
| D-121 | Haptics | 1, 2, 3, 4, 5 |
| D-123 | Species-specific activity labels | 2 |

---

## M3 Dependencies

What M3 (Subscription + Auth) needs from M2:

| M2 Deliverable | M3 Consumer |
|---------------|-------------|
| Pet profiles in Supabase (`pets` table with RLS) | Auth flow creates Supabase user, loadPets() fetches real data |
| `useActivePetStore` consumed by scan flow | Active pet context available app-wide for personalized scoring |
| `isPremium()` / `canAddPet()` in permissions.ts | RevenueCat integration plugs into these functions |
| portionCalculator.ts | M5 pantry integration (daily calorie tracking) |
| treatBattery.ts | M5 pantry (consumed treats piped into TreatBatteryGauge) |
| Allergen profile in pet_allergens | Already wired in M1 scoring pipeline (Layer 3 personalization) |
| Condition profile in pet_conditions | Scoring cross-reference for breed modifiers + life stage matching |
| `health_reviewed_at` | Score accuracy bar shows profile completeness |
| Photo upload to Supabase Storage | Auth session required for storage RLS — currently uses 'local' user_id |

---

## Known Limitations

| Limitation | Impact | Resolution |
|-----------|--------|------------|
| Hard delete only (no soft delete) | Deleted pets are permanently gone | M3+ adds `deleted_at` column and recovery flow |
| Breed list static (58 dogs, 32 cats) | Missing uncommon breeds | M4 expands via community contribution |
| Treat battery always shows 0 consumed | No real consumption tracking | M5 pantry feature pipes real data |
| No pet photo compression/optimization | Large photos stored as-is | M4 adds resize before upload |
| Score Accuracy bar is cosmetic | Doesn't block functionality or gate features | Intentional — encouragement, not enforcement |
| `usePetStore` (M1) still exists | Dead code, not imported anywhere | Remove in M3 cleanup |
| MeScreen.tsx still exists with emoji | Dead code, not in nav graph | Remove in M3 cleanup |
| OnboardingScreen creates local-only pets | No Supabase persistence until auth | M3 auth flow syncs local pets to Supabase |
| PortionCard conditions prop empty on ResultScreen | No conditions fetched during scan | M3+ fetches conditions for active pet |
| Goal weight portions premium-gated but RevenueCat not installed | `isPremium()` always returns false | M3 RevenueCat integration |

---

## Commit History

| Hash | Message |
|------|---------|
| 717f025 | M2: Session 1 — schema migration, pet types, life stage utils, active pet store |
| 94e2270 | M2: add petService CRUD layer with breed-size map and validation |
| 4ab361f | M2: add static breed lists and consolidate BREED_SIZE_MAP |
| 1a9bee9 | M2: add session 1 progress doc |
| 480f100 | M2: add pet profile Create/Edit screens with species-specific activity labels (D-123) |
| c670db1 | M2: add inline form validation and edge case tests |
| bf4d558 | M2: extract PetPhotoSelector component and add Supabase Storage photo upload |
| c4f2903 | M2: Session 2 — Create/Edit pet screens, breed selector, photo upload |
| 9d1415a | M2: add condition/allergen data, ConditionChip component, and fetch functions |
| e578606 | M2: add HealthConditionsScreen with chip logic, allergen picker, and tests |
| e8b6fb3 | M2: wire HealthConditionsScreen to CreatePet and EditPet navigation |
| e28d82e | M2: add portion calculator and treat battery with 76 tests |
| a223096 | M2: add PortionCard and TreatBatteryGauge components with 41 tests |
| cd312ec | M2: add Session 4 progress notes |
| dfe91aa | M2: add PetHubScreen with multi-pet carousel, score accuracy, and 22 tests |
| aa9a67f | M2: wire useActivePetStore into M1 screens |
| 921d472 | M2: wire PortionCard and TreatBatteryGauge into PetHubScreen and ResultScreen |
| 1638218 | M2: compliance audit fixes — D-084 emoji, D-095 UPVM, D-121 haptics |

---

## Test File Index

| File | Tests | Session |
|------|-------|---------|
| `__tests__/utils/lifeStage.test.ts` | 28 | 1 |
| `__tests__/services/petService.test.ts` | 25 | 1, 2, 3 |
| `__tests__/data/breeds.test.ts` | 13 | 1 |
| `__tests__/screens/CreatePetScreen.test.ts` | 28 | 2 |
| `__tests__/data/conditions.test.ts` | 21 | 3 |
| `__tests__/utils/conditionLogic.test.ts` | 38 | 3 |
| `__tests__/services/portionCalculator.test.ts` | 47 | 4 |
| `__tests__/services/treatBattery.test.ts` | 10 | 4 |
| `__tests__/components/PortionCard.test.ts` | 21 | 4 |
| `__tests__/components/TreatBatteryGauge.test.ts` | 20 | 4 |
| `__tests__/screens/PetHubScreen.test.ts` | 22 | 5 |
| **M2 subtotal** | **273** | |
| M1 tests (unchanged) | 174 | |
| **Project total** | **447** | |
