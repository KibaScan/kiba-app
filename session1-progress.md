# M1 Session 1 — Progress Report

> Generated: 2026-02-27
> Branch: `master`
> Milestone: M1 — Scan → Score Pipeline

---

## Commits

| Hash | Message |
|------|---------|
| `8d53c5a` | M1: scan → UPC lookup pipeline |
| `c3f7a58` | M1: QA review — D-090 rejected, D-098 fats→amber, D-107 Heart Risk gated, Math.max(0) floor, free-text allergen removed |
| `70fe24f` | M1: gitignore .env, settings update, schema sync |

---

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `src/services/scanner.ts` | 51 | UPC lookup service — 2-step Supabase query with discriminated union return |
| `src/screens/CommunityContributionScreen.tsx` | 145 | Placeholder for unrecognized UPCs (full Level 4 flow deferred to M3) |
| `src/types/navigation.ts` | 47 | Typed React Navigation param lists for all stacks |
| `M1_PROMPT_GUIDE.md` | 1278 | Session notes and decision rationale |

## Files Modified

| File | Lines | Changes |
|------|-------|---------|
| `src/screens/ScanScreen.tsx` | 563 | Rewritten: live camera, barcode handler, pet modal, result routing |
| `src/screens/ResultScreen.tsx` | 71 | Score display skeleton with suitability framing ("--% match for [Pet]") |
| `src/types/index.ts` | 251 | All TypeScript interfaces expanded to match Supabase schema |
| `src/navigation/index.tsx` | 225 | Raised scan button (D-088), tab structure, stack navigators |
| `supabase/migrations/001_initial_schema.sql` | 308 | Full schema: 11 tables, RLS policies, indexes |
| `src/stores/usePetStore.ts` | 67 | `addPet()` with client-side ID generation for M1 demo mode |
| `.gitignore` | +1 | Added `.env` |

---

## Types Defined (`src/types/index.ts`)

### Enums

```
Species        Dog | Cat
LifeStage      Puppy | Kitten | Adult | Senior
Category       DailyFood | Treat | Supplement
Severity       None | Low | Moderate | High | Critical
ConfidenceLevel  Exact | Estimated | Unknown
SymptomType    Vomiting | Diarrhea | Itching | Lethargy | Refusal
PreservativeType  Natural | Synthetic | Mixed | Unknown
```

### Core Interfaces

| Interface | Key Fields |
|-----------|-----------|
| `Product` | brand, name, category, target_species, all GA columns (protein/fat/fiber/moisture + bonus nutrients + kcal), formulation fields, `ingredients_raw`, `ingredients_hash`, `affiliate_links` (invisible to scoring) |
| `PetProfile` | name, species (required); breed, age, weight, goal_weight, photo_url (nullable for M1 scan-first) |
| `IngredientDict` | canonical_name, cluster_id, allergen_group, allergen_group_possible, dog_base_severity, cat_base_severity, position_reduction_eligible, is_legume, cat_carb_flag, display content columns (D-105) |
| `ProductUpc` | upc (PK) → product_id (FK) |
| `ProductIngredient` | product_id + ingredient_id + position |
| `PetCondition` | pet_id + condition_tag (D-097 many-to-many) |
| `PetAllergen` | pet_id + allergen_group (D-097 many-to-many) |

### Score Breakdown Types

| Interface | Fields |
|-----------|--------|
| `LayerOneBreakdown` | ingredient_quality_score, nutritional_profile_score, formulation_score (with weights) |
| `LayerTwoBreakdown` | species_rules_applied[], total_adjustment |
| `LayerThreeBreakdown` | allergy_flags[], breed_modifiers[], total_adjustment |
| `ScoreBreakdown` | final_score, layers 1-3, ga_available, dmb_applied, confidence |

### Navigation Param Lists (`src/types/navigation.ts`)

```
ScanStackParamList     ScanMain | Result { product, petId } | CommunityContribution { scannedUpc }
HomeStackParamList     HomeMain | Result { product, petId }
SearchStackParamList   SearchMain | Result { product, petId }
PantryStackParamList   PantryMain | Result { product, petId }
MeStackParamList       MeMain | PetProfile { petId }
RootStackParamList     Onboarding | Main
TabParamList           Home | Search | Scan | Pantry | Me
```

---

## Scanner Service API (`src/services/scanner.ts`)

### Return Type

```typescript
type LookupResult =
  | { status: 'found'; product: Product }
  | { status: 'not_found' }
  | { status: 'error'; message: string };
```

### Function

```typescript
async function lookupByUpc(upc: string): Promise<LookupResult>
```

### Implementation

1. Query `product_upcs` by UPC (btree-indexed)
2. Fetch full `products` row by FK `product_id`
3. Haptic feedback on success (`expo-haptics`)
4. Discriminated union error handling — no thrown exceptions

---

## Navigation Structure (`src/navigation/index.tsx`)

```
RootStack (onboarding gate via useAppStore.hasCompletedOnboarding)
├── OnboardingScreen
└── Main
    └── TabNavigator (bottom tabs, dark theme)
        ├── Home   → HomeStack   (HomeMain → Result)
        ├── Search → SearchStack (SearchMain → Result)
        ├── Scan   → ScanStack   (ScanMain → Result → CommunityContribution)
        ├── Pantry → PantryStack (PantryMain → Result)
        └── Me     → MeStack     (MeMain → PetProfile)
```

### Tab Bar

- Dark background (`#1A1A1A`), 88px height, 1px top border
- Icons: all Ionicons (home, search, scan, basket, person) — no emoji (D-084)
- Raised scan button: 64px circle, `top: -20`, accent background, white icon, shadow/elevation

### Theme

- `KibaDarkTheme` extends `DefaultTheme`
- Primary: `#00B4D8` (accent cyan)
- Background: `#1A1A1A`

---

## ScanScreen Flow (`src/screens/ScanScreen.tsx`)

```
┌─────────────────┐
│ Permission check │
│ useCameraPerms() │
└────────┬────────┘
         │
    ┌────▼────┐    denied    ┌──────────────────────────┐
    │ granted?├─────────────►│ Permission request card   │
    └────┬────┘              │ "Kiba needs your camera…" │
         │ yes               └──────────────────────────┘
         ▼
┌─────────────────────┐
│ CameraView (live)   │
│ expo-camera          │
│ ean13/upc_a/upc_e   │
│ 260px reticle overlay│
│ Only when tab focused│
└────────┬────────────┘
         │ onBarcodeScanned
         ▼
┌─────────────────────┐
│ Debounce (2s lock)  │
│ isLocked state gate │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ lookupByUpc(upc)    │
│ Loading overlay:     │
│ "Looking up product…"│
└────────┬────────────┘
         │
    ┌────▼──────────────────┐
    │ LookupResult.status?  │
    └───┬──────┬────────┬───┘
        │      │        │
   found  not_found   error
        │      │        │
        ▼      │        ▼
┌──────────┐   │  Alert.alert()
│ has pet? │   │  + haptic error
└──┬───┬───┘   │
   │   │       ▼
  yes  no   navigate('CommunityContribution', { scannedUpc })
   │   │
   │   ▼
   │  ┌──────────────────┐
   │  │ Pet Profile Modal │
   │  │ Species toggle    │
   │  │ Name input        │
   │  │ → addPet()        │
   │  │ → set activePetId │
   │  └────────┬──────────┘
   │           │
   ▼           ▼
  navigate('Result', { product, petId })
```

### Key Implementation Details

- Camera only renders when tab is focused (`useIsFocused()`) — prevents background camera drain
- Barcode types: `ean13`, `upc_a`, `upc_e`
- Pet modal triggered inline when product found but `activePetId === null`
- Modal uses `KeyboardAvoidingView` for name input
- Species toggle uses `paw-outline` Ionicon (D-084, not emoji)

---

## Zustand Stores

### `useAppStore` — App-level state
- `hasCompletedOnboarding` — gates RootStack navigation
- `isLoading`, `activeModal` — global UI state
- `completeOnboarding()` — called after pet creation in onboarding

### `usePetStore` — Pet profiles
- `activePetId` — current pet for scoring context
- `pets[]` — local array, client-side IDs (`local_${n}`) for M1 demo mode
- `addPet()` — creates with name + species, defaults life_stage to Adult, auto-activates first pet
- `removePet()` — reassigns activePetId to first remaining pet or null

### `useScanStore` — Scan history
- `currentScan` — active scan for ResultScreen
- `recentScans[]` — capped at 50 entries
- `weeklyCount` — freemium limit enforcement

---

## Supabase Schema (11 tables)

| Table | RLS | Purpose |
|-------|-----|---------|
| `products` | public read | Product catalog with all GA columns |
| `product_upcs` | public read | Junction: UPC → product_id (btree indexed) |
| `ingredients_dict` | public read | Canonical ingredients with severity, cluster_id, display content |
| `product_ingredients` | public read | Junction: product → ingredient + position (unique constraint) |
| `pets` | user_id | Pet profiles (D-110 canonical name) |
| `pet_conditions` | via pets FK | D-097 many-to-many conditions |
| `pet_allergens` | via pets FK | D-097 many-to-many allergens |
| `scans` | user_id | Scan history + `score_breakdown` JSONB snapshot |
| `pantry_items` | user_id | Food tracking |
| `symptom_logs` | user_id | Health tracking |
| `kiba_index_votes` | user_id | Taste Test + Tummy Check |

---

## Test Product Seeded

**Pure Balance Grain-Free Salmon & Pea Formula** (UPC `035883053508`)
- product_id: `afd04040-425b-5742-9100-9e370c1c3cc9`
- 15 ingredients linked, positions 1–15
- 3 legume_pea cluster entries in top 5 (peas, dried_peas, pea_protein) — DCM advisory fires
- Reference score target: 66/100

---

## Not Built (Deferred)

- Scoring engine (Layers 1/2/3) — ResultScreen shows "--" placeholders
- UI scoring components (ScoreGauge, BenchmarkBar, IngredientList, StatChips)
- Concern tags (D-107)
- Content explainers (`src/content/explainers/`)
- Breed modifiers (`src/content/breedModifiers/`)
- Supabase Auth / login flow
- RevenueCat (M3-M4)
- Community contribution workflow (M3)
- Jest tests / reference product regression tests
