# Kiba M5 — Claude Code Prompt Guide (Part 1 of 2)

> **Purpose:** Step-by-step prompts for building Pantry core + Top Matches.
> Each prompt is copy-paste ready. `/plan` mode is used on every first prompt per session.
> **Phase 1 covers:** Pre-M5 cleanup, pantry schema + CRUD + UI, Top Matches, gram toggle.
> **Phase 2 (separate doc) covers:** Feeding schedule, auto-depletion, push notifications, Recall Siren, Pet Appointments, Weekly Digest, integration testing, compliance audit.
> **Updated:** March 19, 2026

---

## Pre-Session: Verify CLAUDE.md

Before starting any M5 work:

1. Confirm CLAUDE.md says `Current phase: M5 Pantry + Recall Siren`
2. Confirm decision count says D-001 through D-158 (D-152–D-157 are pantry decisions, D-158 is recalled product bypass — add before starting if not present)
3. Confirm regression targets: Pure Balance = 62, Temptations = 9
4. Confirm test count: 641 tests, 32 suites
5. Confirm migrations list includes 001–010
6. Confirm `product_form` column exists on products table (migration 010)
7. Confirm `is_supplemental` backfilled on products table (migration 007)
8. Confirm `resolveCalories()` exists in `src/services/scoring/calorieEstimation.ts`
9. Confirm `stripBrandFromName()` exists in `src/utils/formatters.ts`
10. Run: `npx jest --silent` — all 641 tests pass

If any of these are wrong, update CLAUDE.md before starting. Claude Code reads it at session start and builds against whatever it says.

**Files to have in project root before starting:**
- `PANTRY_SPEC.md` — the filled pantry spec
- `TOP_MATCHES_PLAN.md` — the Top Matches architecture plan
- Updated `DECISIONS.md` with D-152 through D-158

---

## Session Map — Quick Reference

| Session | Domain | Deliverables | Context Mgmt |
|---------|--------|-------------|--------------|
| 1 | Pre-M5 Cleanup + Pantry Foundation | TS error fixes, CLAUDE.md update, migration 011, types, pantry service | `/clear` after — cleanup/schema ≠ UI |
| 2 | Add-to-Pantry Flow | Bottom sheet, serving format selector, fractional input, dedup, species block | `/clear` after — add flow ≠ list UI |
| 3 | Pantry Screen | Pantry tab list, card component, product states, diet completeness, empty states | `/clear` after — pantry UI ≠ batch scoring |
| 4 | Top Matches Backend | Migration 012 (cache table), cache service, scoring engine copy + local regression verification | `/clear` after — copy verification ≠ Edge Function |
| 5 | Top Matches Edge Function | Batch-score Edge Function wrapping verified engine copy, bulk SQL, upsert | `/clear` after — backend ≠ frontend |
| 6 | Top Matches UI + Gram Toggle | SearchScreen rewrite, Zustand store, freshness checks, gram toggle on PortionCard, Phase 1 wrap | End of Phase 1 |

**Before Session 3:** Run Antigravity with prompts for EditPantryItemScreen and SharePantrySheet (see Notes for Steven at bottom). Claude Code needs visual targets for the edit and share flows.

---

## Session 1: Pre-M5 Cleanup + Pantry Foundation

**Context is fresh. Start with Plan Mode.**

---

### Prompt 1 — Pre-M5 TypeScript Cleanup

```
/plan

@CLAUDE.md

Starting M5 Phase 1, Session 1. First task: fix pre-existing TypeScript
errors so we start clean.

Run `npx tsc --noEmit` and fix ALL errors. Known issues from PRE_M5_TODO:

- ScoreWaterfall.tsx: missing `ProductIngredient` import
- CreatePetScreen.tsx: missing `health_reviewed_at` field
- PetHubScreen.tsx: wrong icon name (`checkmark-shield-outline` →
  `shield-checkmark-outline`)
- pipeline.ts: `ingredientResults` missing on `ScoredResult` in
  `makeEmptyResult`
- Deno edge function type errors in supabase/functions/

There may be others — `tsc --noEmit` is the source of truth.

Goal: `npx tsc --noEmit` returns 0 errors.
Do NOT change any scoring logic or test assertions.
Show me the plan before fixing anything.
```

**Review checkpoint:** Verify Claude isn't changing any scoring math or test expectations. These are import/type fixes only. If it proposes changes to `engine.ts` or any test file assertions, reject those.

```
/execute
```

After execution, verify:
```
npx tsc --noEmit    # should be 0 errors
npx jest --silent   # should still be 641 passing
```

---

### Prompt 2 — CLAUDE.md Update

```
Update CLAUDE.md for M5:

1. Change "Current phase" to "M5 Pantry + Recall Siren"
2. Update test count to whatever it is after Prompt 1
3. Update decisions to D-158 (add D-152 through D-158 summary — pantry
   depletion model, pantry paywall scope, sharing rules, empty item
   behavior, score source, mixed feeding removal, recalled product bypass)
4. Add to "Key code paths": pantry service, pantry store, pantry screen
5. Add PANTRY_SPEC.md and TOP_MATCHES_PLAN.md to the spec files table
6. Add to "Do NOT Build": variety pack scoring (D-145), compare flow (M6),
   Vet Report PDF (M6), score recalled products (D-158 — bypass, not score=0)
7. Update regression anchors: Pure Balance = 62, Temptations = 9
8. Add migration 011 (pantry tables) to the migrations list — it doesn't
   exist yet but we're about to create it

Keep everything else unchanged. This is a surgical edit, not a rewrite.
```

---

### Prompt 3 — Pantry Schema Migration

```
/plan

@CLAUDE.md @PANTRY_SPEC.md @supabase/migrations/010_product_form.sql

Create migration 011: Pantry tables.

Read PANTRY_SPEC.md Section 1 for the full schema. Two tables:

1. pantry_items
   - id UUID PK
   - user_id UUID FK → auth.users(id) ON DELETE CASCADE
   - product_id UUID FK → products(id) ON DELETE CASCADE
   - quantity_original DECIMAL(10,2) NOT NULL
   - quantity_remaining DECIMAL(10,2) NOT NULL
   - quantity_unit TEXT NOT NULL CHECK IN ('lbs','oz','kg','g','units')
   - serving_mode TEXT NOT NULL CHECK IN ('weight','unit')
   - unit_label TEXT DEFAULT 'units' CHECK IN ('cans','pouches','units')
   - added_at TIMESTAMPTZ DEFAULT NOW()
   - is_active BOOLEAN DEFAULT true
   - last_deducted_at TIMESTAMPTZ
   - created_at, updated_at TIMESTAMPTZ DEFAULT NOW()

2. pantry_pet_assignments
   - id UUID PK
   - pantry_item_id UUID FK → pantry_items(id) ON DELETE CASCADE
   - pet_id UUID FK → pets(id) ON DELETE CASCADE
   - serving_size DECIMAL(8,4) NOT NULL
   - serving_size_unit TEXT NOT NULL CHECK IN ('cups','scoops','units')
   - feedings_per_day SMALLINT NOT NULL DEFAULT 2
   - feeding_frequency TEXT NOT NULL DEFAULT 'daily' CHECK IN
     ('daily','as_needed')
   - feeding_times JSONB
   - notifications_on BOOLEAN DEFAULT true
   - UNIQUE(pantry_item_id, pet_id)
   - created_at, updated_at TIMESTAMPTZ DEFAULT NOW()

RLS policies (CRITICAL):
- pantry_items: `user_id = auth.uid()` for ALL operations
- pantry_pet_assignments: `pantry_item_id IN (SELECT id FROM
  pantry_items WHERE user_id = auth.uid())` for ALL operations

Indexes:
- idx_pantry_items_user_active ON pantry_items(user_id, is_active)
  WHERE is_active = true
- idx_pantry_assignments_pet ON pantry_pet_assignments(pet_id)
- idx_pantry_items_product ON pantry_items(product_id)
  WHERE is_active = true

File: supabase/migrations/011_pantry_tables.sql

Show me the plan. Pay attention to:
- CASCADE rules on FKs
- RLS uses WITH CHECK as well as USING
- Indexes are partial where noted
```

**Review checkpoint:** Verify RLS policy on `pantry_pet_assignments` correctly scopes through `pantry_items.user_id`. This is the trickiest RLS pattern — a JOIN-based policy. If Claude proposes a simpler `pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid())` approach, that's also valid and arguably cleaner. Either works as long as user isolation is complete.

```
/execute
```

---

### Prompt 4 — Pantry Types + Service Layer

```
/plan

@CLAUDE.md @PANTRY_SPEC.md @src/types/index.ts @src/services/scoring/calorieEstimation.ts

Create the pantry type definitions and service layer.

1. src/types/pantry.ts — TypeScript types:

   PantryItem interface matching migration 011 columns
   PantryPetAssignment interface matching migration 011 columns
   ServingMode = 'weight' | 'unit'
   QuantityUnit = 'lbs' | 'oz' | 'kg' | 'g' | 'units'
   ServingSizeUnit = 'cups' | 'scoops' | 'units'
   FeedingFrequency = 'daily' | 'as_needed'

   PantryItemWithProduct — PantryItem joined with product data:
     product name, brand, image_url, product_form, is_supplemental,
     is_recalled, is_vet_diet, target_species, category,
     base_score (from products table)

   PantryCardData — the shape a pantry card component receives:
     all PantryItemWithProduct fields plus:
     - assignments: PantryPetAssignment[] (all pets sharing this item)
     - days_remaining: number | null (computed)
     - is_low_stock: boolean (computed)
     - is_empty: boolean (computed)
     - calorie_context: { daily_kcal: number, target_kcal: number,
       source: CalorieSource } | null

   DietCompletenessResult = {
     status: 'complete' | 'amber_warning' | 'red_warning' | 'empty',
     message: string | null
   }

   AddToPantryInput — the shape from the add-to-pantry form:
     product_id, quantity_original, quantity_unit, serving_mode,
     unit_label, serving_size, serving_size_unit, feedings_per_day,
     feeding_frequency, feeding_times

2. src/services/pantryService.ts — Supabase CRUD:

   OFFLINE GUARD: All write functions (add, remove, restock, update,
   share) must check network connectivity first. If offline, throw
   a PantryOfflineError. The caller shows a toast:
   "Connect to the internet to update your pantry."
   Read functions (getPantryForPet, checkDuplicateUpc,
   evaluateDietCompleteness) fall back to Zustand cached data when
   offline. No sync queue — writes are blocked, reads are cached.
   This is a deliberate v1 simplification.

   Helper: src/utils/network.ts
   isOnline(): boolean — uses NetInfo from @react-native-community/netinfo

   addToPantry(input: AddToPantryInput, petId: string): Promise<PantryItem>
     - Checks isOnline() — throws PantryOfflineError if offline
     - Creates pantry_items row + pantry_pet_assignments row for petId
     - Sets quantity_remaining = quantity_original

   removePantryItem(itemId: string, petId?: string): Promise<void>
     - If petId provided: remove just that pet's assignment.
       If no assignments remain, soft-delete the item.
     - If petId not provided: soft-delete item (is_active = false).
       CASCADE handles assignment cleanup.

   restockPantryItem(itemId: string): Promise<PantryItem>
     - Sets quantity_remaining = quantity_original
     - Sets is_active = true (reactivate if empty)

   updatePantryItem(itemId: string, updates: Partial<PantryItem>):
     Promise<PantryItem>
     - Editable: quantity_remaining, quantity_unit, quantity_original,
       serving_mode

   updatePetAssignment(assignmentId: string,
     updates: Partial<PantryPetAssignment>): Promise<PantryPetAssignment>
     - Editable: serving_size, serving_size_unit, feedings_per_day,
       feeding_frequency, feeding_times, notifications_on

   sharePantryItem(itemId: string, petId: string,
     assignment: Partial<PantryPetAssignment>):
     Promise<PantryPetAssignment>
     - Creates new pantry_pet_assignments row
     - Caller must verify same-species before calling

   getPantryForPet(petId: string): Promise<PantryCardData[]>
     - Joins pantry_items → products → pantry_pet_assignments
     - Filters: is_active = true OR quantity_remaining = 0 (show empties)
     - Computes days_remaining, is_low_stock, is_empty
     - Sorts: recalled first → active → low stock → empty

   checkDuplicateUpc(productId: string, petId: string): Promise<boolean>
     - Returns true if this product is already in this pet's active pantry

   evaluateDietCompleteness(petId: string):
     Promise<DietCompletenessResult>
     - Queries all active pantry items for this pet
     - JOINs products for is_supplemental and category
     - Applies D-136 Part 5 three-tier warning logic
     - Returns status + message string (D-095 compliant copy)

3. src/utils/pantryHelpers.ts — pure computation functions:

   calculateDaysRemaining(quantityRemaining, assignments):
     number | null
     - Sums daily_consumption across all assignments where
       feeding_frequency = 'daily'
     - Returns quantityRemaining / totalDailyConsumption
     - Returns null if no daily assignments (all as_needed)

   isLowStock(daysRemaining, quantityRemaining, servingMode):
     boolean
     - Weight mode: daysRemaining ≤ 5
     - Unit mode: quantityRemaining ≤ 5 OR daysRemaining ≤ 5

   getCalorieContext(product, pet, servingSize, feedingsPerDay,
     servingSizeUnit): CalorieContext | null
     - Uses resolveCalories() for product calorie data
     - Uses calculateDER() for pet calorie target
     - Returns { daily_kcal, target_kcal, source } or null

   getSystemRecommendation(product, pet, isPremiumGoalWeight):
     { amount: number, unit: string } | null
     - Computes recommended serving from DER ÷ product calories
     - Uses goal weight DER if isPremiumGoalWeight and pet has
       goal weight set
     - Returns null if calorie data unavailable

   calculateDepletionBreakdown(
     servingSize, servingSizeUnit, feedingsPerDay, totalQuantity,
     quantityUnit, unitLabel, product
   ): DepletionBreakdown | null
     - Computes the user-facing math breakdown string
     - Return type: { rateText: string, daysText: string | null }
     - unitLabel param: 'cans' | 'pouches' | 'units' — from
       pantry_items.unit_label. Drives the display string.
     - UNIT MODE (cans/pouches/units):
       rateText: "½ can × 2 feedings = 1 can/day"
       daysText: "~24 days of food"
       Unit label is dynamic — "can", "pouch", or "unit" based on
       what the user selected in pack size picker. Never hardcode.
       Always computable (units in, units out, no conversion needed).
     - WEIGHT MODE (cups from a lb/oz/kg/g bag):
       When kcal_per_cup AND kcal_per_kg both available (label or
       D-149 Atwater): convert bag weight to total cups via calories,
       then: rateText: "1.5 cups × 2 feedings = 3 cups/day"
       daysText: "~42 days of food"
       When calorie data missing: rateText computed, daysText = null
       (cannot convert lbs to cups without density data).
     - TREATS: returns null — treats don't show depletion breakdown.
       Treat depletion is owned by Treat Battery (M5 polish scope).
     - The conversion math for weight mode:
       total_cups = (bag_weight_kg × kcal_per_kg) / kcal_per_cup
       days = total_cups / (servingSize × feedingsPerDay)

   defaultServingMode(productForm: string): ServingMode
     - 'dry' | 'freeze_dried' | 'dehydrated' | 'raw' → 'weight'
     - 'wet' | 'topper' → 'unit'
     - fallback → 'weight'

Tests for pantryHelpers.ts:
- calculateDaysRemaining with single pet, shared pets, as_needed only
- isLowStock edge cases (exactly 5, 4, 0)
- defaultServingMode for each product_form value
- getSystemRecommendation with/without calorie data, with/without
  goal weight
- calculateDepletionBreakdown unit mode: cans (24 pack, ½ can × 2)
- calculateDepletionBreakdown unit mode: pouches (label says "pouch")
- calculateDepletionBreakdown weight mode with calorie data
- calculateDepletionBreakdown weight mode without calorie data (null days)
- calculateDepletionBreakdown treats → returns null

Constraints:
- No `any` types
- Import CalorieSource from calorieEstimation.ts
- Import calculateDER from existing portion calculator
- All Supabase calls use typed client
- pantryService functions handle errors gracefully (try/catch,
  meaningful error messages)
- All write functions check isOnline() before executing
- PantryOfflineError is a typed error class in src/types/pantry.ts

Tests for pantryService.ts (offline guard):
- addToPantry throws PantryOfflineError when offline
- removePantryItem throws PantryOfflineError when offline
- restockPantryItem throws PantryOfflineError when offline
- getPantryForPet returns cached data when offline

Show me the plan before writing code.
```

**Review checkpoint:** Make sure `evaluateDietCompleteness()` does NOT modify any scores. It reads `is_supplemental` and `category` from products — nothing else. Verify the sort logic in `getPantryForPet()` matches the spec: recalled → active → low stock → empty.

```
/execute
```

After execution, verify:
```
npx jest --silent   # existing 641 + new pantryHelpers tests
npx tsc --noEmit    # 0 errors
```

---

### Prompt 5 — Pantry Zustand Store

```
@CLAUDE.md @src/stores/useActivePetStore.ts

Create src/stores/usePantryStore.ts — Zustand store for pantry state.

Shape:
  items: PantryCardData[]           // active pet's pantry items
  dietStatus: DietCompletenessResult | null
  loading: boolean
  error: string | null

Actions:
  loadPantry(petId: string)         // calls getPantryForPet + evaluateDietCompleteness
  addItem(input, petId)             // calls addToPantry, appends to items, re-evaluates diet
  removeItem(itemId, petId?)        // calls removePantryItem, filters items, re-evaluates diet
  restockItem(itemId)               // calls restockPantryItem, updates item in array
  updateItem(itemId, updates)       // calls updatePantryItem, patches item in array
  shareItem(itemId, petId, assignment) // calls sharePantryItem, updates item's assignments
  refreshDietStatus(petId)          // re-evaluates diet completeness

NOT persisted to AsyncStorage — pantry data is large and stales
quickly. Fetched from Supabase on each screen focus (~50ms).

Follow the same pattern as useActivePetStore.ts for error handling
and loading states.
```

**`/clear` after this prompt.** Session 1 is schema + service + store. Session 2 is UI. Clean break.

---

## Session 2: Add-to-Pantry Flow

**Context is fresh. Load Session 1 progress.**

---

### Prompt 1 — Add-to-Pantry Bottom Sheet

```
/plan

@CLAUDE.md @PANTRY_SPEC.md @src/types/pantry.ts @src/services/pantryService.ts

Starting M5 Session 2: Add-to-pantry UI flow.

Read PANTRY_SPEC.md Section 3a for the full add flow spec.

Build the AddToPantrySheet component — a bottom sheet that opens from
the ResultScreen "Add to Pantry" CTA.

Component: src/components/pantry/AddToPantrySheet.tsx

Props:
  product: Product (from ResultScreen)
  pet: Pet (active pet)
  visible: boolean
  onClose: () => void
  onAdded: (item: PantryItem) => void

Layout (top to bottom):
1. Header: product image (56×56) + brand + name (read-only, 2-line clamp)
2. Serving mode toggle: "Weight" | "Units" — auto-detected from
   product.product_form via defaultServingMode(), user can override
3. Quantity input section (changes based on serving mode):

   WEIGHT MODE:
   - "Bag size" — number input + unit selector (lbs / oz / kg / g)
   - "Amount per feeding" — number input + unit label ("cups")
   - "Feedings per day" — stepper (1, 2, 3)

   UNIT MODE:
   - "Total count" — number input + unit picker toggle:
     "cans" / "pouches" (dynamic label — user selects which unit
     type matches their product. This label carries through to the
     depletion breakdown and pantry card display.)
   - "Amount per feeding" — fractional chip selector:
     Tappable chips: ¼  ⅓  ½  ⅔  ¾  1  1½  2
     Plus "Custom" chip that opens a decimal input
   - "Feedings per day" — stepper (1, 2, 3)

   NOTE ON TREATS: When product.category === 'treat', the add sheet
   uses unit mode but does NOT show the depletion breakdown or
   calorie context. Treat tracking integrates with Treat Battery
   (deferred to M5 polish). The sheet collects: total count,
   feeding frequency (default: as_needed), and that's it — simpler
   form than daily food.

4. Depletion math breakdown (live-updating as user adjusts inputs):
   Displayed below serving inputs, above the system recommendation.
   Uses calculateDepletionBreakdown() from pantryHelpers.

   Unit mode examples:
   "½ can × 2 feedings = 1 can/day · ~24 days of food"
   "½ pouch × 2 feedings = 1 pouch/day · ~12 days of food"
   (unit label matches whatever the user selected — never hardcoded)

   Weight mode with calorie data:
   "1.5 cups × 2 feedings = 3 cups/day · ~42 days of food"

   Weight mode without calorie data:
   "1.5 cups × 2 feedings = 3 cups/day"
   (no days estimate — can't convert bag weight to cups without
   calorie density data)

   Treats: not shown (returns null from helper).

   Style: muted text (#A0A0A0), 12px, updates live on every input
   change. This line is the "show your math" moment that builds
   trust in the countdown system.

5. System recommendation (when calorie data available):
   Helper text below serving inputs:
   "Recommended: ~X cups/day based on [Pet Name]'s profile"
   Uses getSystemRecommendation() — goal weight DER for premium
   users via canUseGoalWeight() from permissions.ts.
   If no calorie data: omit this line entirely.

6. Calorie context (when calorie data available):
   "~[X] kcal/day of [Pet Name]'s [Y] kcal target"
   Updates live as user adjusts serving size and feedings.
   If Atwater estimated: append "(estimated)"
   Not shown for treats.

7. Confirm button: "Add to [Pet Name]'s Pantry"
   - Calls addToPantry() via usePantryStore
   - On success: close sheet, show toast confirmation
   - On error: show error inline

Pre-submit checks:
- Bag size / count required (>0)
- Serving size required (>0)
- Species mismatch: if product.target_species !== pet.species,
  sheet does NOT open — caller shows toast:
  "This is a [dog/cat] food — can't add to [Pet Name]'s pantry"
- Duplicate UPC: call checkDuplicateUpc() before opening sheet.
  If true, show "Already in pantry. Restock instead?" with
  Restock / Add New options.

Design:
- Dark theme (#1A1A2E background, #242424 card surfaces)
- D-084: no emoji — Ionicons only
- Fractional chips: pill-shaped, #242424 background, white text,
  selected state uses accent color
- System recommendation: muted text (#A0A0A0), not prominent
- Calorie context: small text, updates live

Tests: __tests__/components/pantry/AddToPantrySheet.test.tsx
- Renders weight mode for dry product
- Renders unit mode for wet product
- Serving mode toggle switches inputs
- Unit label picker: cans vs pouches selection stored correctly
- Fractional chip selection updates serving_size correctly
  (¼ = 0.25, ⅓ = 0.3333, ½ = 0.5, etc.)
- Depletion breakdown: unit mode shows rate + days (live update)
- Depletion breakdown: weight mode with calorie data shows rate + days
- Depletion breakdown: weight mode without calorie data shows rate only
- Depletion breakdown: treats → not shown
- System recommendation shows when calorie data available
- System recommendation hidden when calorie data unavailable
- Treats: simplified form (no depletion, no calorie context)
- Species mismatch blocked (test the caller logic, not the sheet)
- Confirm button calls addToPantry with correct AddToPantryInput shape
  (including unit_label)

Show me the plan before writing code.
```

**Review checkpoint:** Verify the fractional values map correctly: ¼ → 0.25, ⅓ → 0.3333, ½ → 0.5, ⅔ → 0.6667, ¾ → 0.75. These are stored as decimals in `serving_size`, not as fraction strings. Also verify the system recommendation uses `canUseGoalWeight()` from `permissions.ts` — not an inline premium check.

```
/execute
```

---

### Prompt 2 — ResultScreen Integration + Treat Logging Entry Point

```
@CLAUDE.md @src/screens/ResultScreen.tsx

Wire the "Add to Pantry" CTA into ResultScreen and add the treat
logging entry point.

Two changes:

1. ResultScreen — "Add to Pantry" button:
   - Position: in the actions section (near Share button)
   - Visible on ALL result views EXCEPT:
     * Species mismatch bypass (wrong species — blocked)
     * No ingredient data view (nothing to track)
   - Vet diet and variety pack: button visible (users buy these, need
     to track inventory)
   - On tap: check species match → check duplicate UPC → open
     AddToPantrySheet
   - Import AddToPantrySheet, render conditionally

2. Me tab treat logging (D-124):
   - On PetHubScreen, below the TreatBatteryGauge, add a button:
     "Log a Treat"
   - On tap: opens scanner (navigates to ScanScreen)
   - After scan, if product.category === 'treat':
     auto-open AddToPantrySheet with treat defaults
     (serving_mode: 'unit', feedings: 1, as_needed)
     NOTE: The treat-to-Treat-Battery integration (deducting logged
     treats from TreatBatteryGauge's daily kcal budget) is deferred
     to M5 polish. For now, treats are added to pantry for inventory
     tracking only — the battery gauge does not decrement.
   - If product.category !== 'treat':
     normal ResultScreen flow (user can still add to pantry manually)

Do NOT modify any scoring logic. Do NOT modify the scan flow itself.
These are UI integration points only.
```

After execution, verify on device:
- Scan a dry food → "Add to Pantry" visible → tapping opens sheet in weight mode
- Scan a wet food → sheet opens in unit mode with fractional chips
- Scan with species mismatch → "Add to Pantry" not visible (or shows toast if tapped)
- Me tab → "Log a Treat" button visible below TreatBatteryGauge

**`/clear` after this prompt.** Add flow is done. Session 3 is the pantry list screen — different domain.

---

## Session 3: Pantry Screen UI

**Context is fresh.**

---

### Prompt 1 — Pantry Card Component

```
/plan

@CLAUDE.md @PANTRY_SPEC.md @src/types/pantry.ts @src/utils/constants.ts @src/utils/formatters.ts

Starting M5 Session 3: Pantry screen UI.

Build the PantryCard component — the card that represents one pantry
item in the list.

Component: src/components/pantry/PantryCard.tsx

Props:
  item: PantryCardData
  activePet: Pet
  onTap: (itemId: string) => void        // navigate to edit
  onRestock: (itemId: string) => void
  onRemove: (itemId: string) => void

Card anatomy (left to right, top to bottom):

LEFT: Product image (56×56) with gradient edge fade for white
backgrounds (same pattern as ResultScreen product image)

CENTER:
- Brand label (small, #A0A0A0, 11px)
- Product name (white, 14px, 2 lines max) via stripBrandFromName()
- Metadata row: category/form badge + supplemental badge (if applicable)
- Feeding summary: "2× daily · 1.5 cups" or "As needed" (#A0A0A0, 12px)

RIGHT:
- Score badge: colored number + "% match" using
  getScoreColor(score, item.is_supplemental)
  OR bypass badge (recalled D-158 / vet diet / variety pack / no score)
- Days/units remaining: "~13 days" or "18 cans left" (white, 13px)

FULL WIDTH (below main row, conditional):
- Depletion progress bar: thin bar (3px height) showing
  quantity_remaining / quantity_original as a percentage.
  Color: green when >20%, amber when 5-20%, red when <5%.
  NOT shown for treats or as_needed items.
- Low stock: amber bar "Running low — ~3 days remaining"
- Recalled: red bar "Recalled — tap for details" (Ionicon alert icon)
- Shared indicator: "[Pet] + [Pet]" in muted text
- Calorie context: "~100 kcal/day of 200 kcal target" (muted, 11px)
  NOT shown for treats.

TREATS in pantry:
- Show: product image, name, score badge, "As needed", unit count
  ("6 units left")
- Do NOT show: depletion progress bar, calorie context, daily
  consumption breakdown, days remaining countdown
- Treat pantry items are inventory tracking only until Treat Battery
  integration ships (M5 polish)

STATES:
- Active: normal rendering
- Low stock: amber accent on remaining text + "Running low" bar
- Empty: entire card at 40% opacity, "Empty" label replaces
  remaining count, actions row: Restock | Edit | Remove
- Recalled: red left border or red badge, pushed to top by list sort
- Stale: muted "Score may be outdated" badge (>90 days unverified)

Score display: "[X]% match" — NEVER a naked number. If the pantry
item is for a specific pet, the score IS per-pet (from scan or cache).
If score is unavailable (bypassed product), show the bypass badge
instead.

Design system:
- Background: #242424 card surface
- Rounded corners: 12px
- D-084: Ionicons only, no emoji
- Severity colors from SEVERITY_COLORS in constants.ts
- Score colors from getScoreColor() in constants.ts

Show me the plan before writing code.
```

```
/execute
```

---

### Prompt 2 — Pantry Screen + Diet Completeness

```
/plan

@CLAUDE.md @PANTRY_SPEC.md @src/stores/usePantryStore.ts @src/stores/useActivePetStore.ts

Build the PantryScreen — the Pantry tab screen.

Screen: src/screens/PantryScreen.tsx

Layout:

HEADER:
- Active pet name + photo (from useActivePetStore)
- Pet switcher affordance (for premium multi-pet — tapping opens
  pet carousel or bottom sheet). Use canHaveMultiplePets() from
  permissions.ts.

DIET COMPLETENESS BANNER (conditional):
- Renders above the list when dietStatus !== 'complete' and
  dietStatus !== 'empty'
- Amber banner: "[Pet Name]'s diet may be missing essential
  nutrients. Consider adding a complete food."
- Red banner: "No complete meals found in [Pet Name]'s diet."
- Copy is D-095 compliant — already defined in PANTRY_SPEC.md §4a
- Ionicon warning icon, no emoji

FILTER / SORT BAR (horizontal ScrollView below header):
- Filter chips: All | Dry | Wet | Treats | Supplemental |
  Recalled | Running Low
- Default: "All" selected
- Chips use badge color conventions:
  * Supplemental chip: teal text/border
  * Recalled chip: red text/border (#EF4444)
  * Running Low chip: amber text/border (#F59E0B)
  * Others: neutral white/gray
- Selected chip: filled accent background, white text
- Chips filter the FlatList client-side from usePantryStore.items
- Recalled and Running Low are status filters, not category filters
  (they can show items from any category)
- Sort menu icon at right end of chip bar (Ionicon funnel or
  options icon). Sort options bottom sheet:
  * Default (state-based: recalled → active → low → empty)
  * Name (A→Z)
  * Score (high → low)
  * Days Remaining (low → high — urgency sort)

LIST:
- FlatList of PantryCard components
- Data from usePantryStore.items (already sorted: recalled →
  active → low stock → empty)
- Pull-to-refresh: calls loadPantry()
- Swipe actions: swipe left → Edit, swipe right → Remove
  (use Swipeable from react-native-gesture-handler or a simple
  custom implementation)

EMPTY STATES (two variants):
1. No pet profile exists (useActivePetStore.activePetId === null):
   "Create a pet profile to start building their pantry"
   CTA button → navigates to CreatePetScreen
2. Pet exists, no pantry items (items.length === 0):
   "Scan a product to add it to [Pet Name]'s pantry"
   CTA button → navigates to ScanScreen
   Use a simple pantry/bowl illustration or Ionicon

LOADING:
- Show loading spinner on first load
- Pull-to-refresh shows standard RefreshControl

Screen lifecycle:
- useFocusEffect: call loadPantry(activePetId) on every focus
  (pantry data refreshes each time user navigates to tab)
- Listen to useActivePetStore for pet switches → reload pantry
- Listen to usePantryStore.dietStatus for banner rendering

REMOVE FLOW:
When user taps Remove (swipe or from empty card actions):
- Single pet assignment: confirmation alert → removePantryItem(id)
- Shared item (multiple assignments): bottom sheet:
  "Remove for all pets" or "Remove for [Pet Name] only"
  → calls removePantryItem(id, petId) accordingly
- D-157 nudge: if the removed item was a daily food AND ≥1 other
  daily food remains for this pet, show a one-time toast/banner:
  "[Pet Name]'s daily intake from pantry items has changed."
  No auto-rebalance of remaining items' serving amounts.

RESTOCK FLOW:
When user taps Restock (from empty card actions):
- Calls restockItem(id) → quantity resets, card reactivates
- Toast: "[Product Name] restocked"

Navigation: PantryScreen is already in the tab navigator as the
Pantry tab. Wire it up if it's currently a placeholder.

Tests: __tests__/screens/PantryScreen.test.tsx
- Renders empty state when no pet
- Renders empty state when pet exists but no items
- Renders pantry cards when items exist
- Diet completeness amber banner shows when appropriate
- Diet completeness red banner shows when appropriate
- No banner when complete food present
- Filter chips filter list correctly (each chip type)
- Sort menu changes list order
- Remove flow triggers correct service call
- Remove daily food with remaining → D-157 nudge shown
- Restock flow resets quantity

Show me the plan before writing code.
```

**Review checkpoint:** Verify diet completeness banner copy is exactly D-095 compliant. No "you should," no "we recommend." Check that the screen reads from `usePantryStore` and does NOT call scoring functions. Pantry reads scores, never computes them.

```
/execute
```

---

### Prompt 3 — Share Flow + Edit Screen

```
@CLAUDE.md @PANTRY_SPEC.md @src/utils/permissions.ts

Two deliverables:

1. Share flow — src/components/pantry/SharePantrySheet.tsx

   Bottom sheet opened from PantryCard long-press or edit screen.
   
   - Gated by canSharePantryItem() — add this to permissions.ts
     (premium check, same pattern as existing permission functions)
   - Shows list of user's OTHER pets that are SAME SPECIES as the
     product's target_species
   - Pets already assigned show a checkmark (read from item.assignments)
   - Toggling a pet on: calls sharePantryItem() with default serving
     settings (copies from the original pet's assignment)
   - Toggling a pet off: calls removePantryItem(itemId, petId)
   - Each assigned pet shows editable serving_size + feedings_per_day
     inline

   Species filter: query pets WHERE species = product.target_species
   AND id !== current assignment's pet_id.

2. Edit screen — src/screens/EditPantryItemScreen.tsx

   Full-screen edit for a pantry item. Navigated from PantryCard tap.

   Editable fields:
   - Quantity remaining (number + unit selector matching original unit)
   - Original bag/pack size (for Restock target)
   - Serving size per feeding
   - Feedings per day (stepper)
   - Unit label (cans ↔ pouches — for unit mode items only)
   - Feeding schedule: Daily ↔ As needed toggle
   - Notification times (clock time pickers, only when daily)
   - Notifications on/off toggle

   NOT editable: product itself, product image, score.

   Actions at bottom:
   - "Restock" button (resets to original quantity)
   - "Share with other pets" (opens SharePantrySheet — premium gated)
   - "Remove from Pantry" (with single/shared removal flow)

   Save: auto-saves on field change (no explicit save button).
   Uses updatePantryItem() and updatePetAssignment() from pantryService.
```

After execution, verify:
- Share sheet only shows same-species pets
- Share option hidden for free users (or shows paywall on tap)
- Edit screen correctly updates pantry item and assignment independently
- `permissions.ts` has new `canSharePantryItem()` — no premium checks elsewhere

**`/clear` after this prompt.** Pantry UI complete. Session 4 is Top Matches — completely different system.

---

## Session 4: Top Matches Backend

**Context is fresh.**

---

### Prompt 1 — Top Matches Migration + Cache Service

```
/plan

@CLAUDE.md @TOP_MATCHES_PLAN.md @supabase/migrations/011_pantry_tables.sql

Starting M5 Session 4: Top Matches backend.

Read TOP_MATCHES_PLAN.md fully before planning.

Two deliverables:

1. Migration 012: pet_product_scores cache table

   File: supabase/migrations/012_pet_product_scores.sql

   Schema from TOP_MATCHES_PLAN.md Phase 1:
   - pet_id, product_id (UNIQUE constraint)
   - final_score SMALLINT
   - is_partial_score, is_supplemental BOOLEANs
   - category TEXT CHECK IN ('daily_food', 'treat')
   - Invalidation anchors: life_stage_at_scoring, pet_updated_at,
     pet_health_reviewed_at, product_updated_at
   - scored_at, scoring_version

   Index: idx_pps_pet_category_score ON (pet_id, category,
   final_score DESC)

   RLS: users see only their own pets' scores (through pets table
   user_id join)

2. Cache freshness service: src/services/topMatches.ts

   Functions:

   checkCacheFreshness(pet: Pet): Promise<boolean>
     - Sample one cached row for this pet
     - Four staleness checks from TOP_MATCHES_PLAN.md Phase 3:
       * No cache (COUNT = 0)
       * Life stage drift (deriveLifeStage() !== cached)
       * Profile edit (pet.updated_at > cached.pet_updated_at)
       * Health update (pet.health_reviewed_at >
         cached.pet_health_reviewed_at)
       * Engine version (cached.scoring_version !==
         CURRENT_SCORING_VERSION)
     - Returns false if any check fails (cache is stale)

   fetchTopMatches(petId: string, filters?: {
     category?: 'daily_food' | 'treat',
     searchQuery?: string
   }): Promise<CachedScore[]>
     - Queries pet_product_scores for this pet
     - Applies category filter
     - Client-side text search on joined product name/brand
     - Returns sorted by final_score DESC
     - Paginated: 25 per page

   triggerBatchScore(petId: string, petProfile: PetProfile):
     Promise<{ scored: number, duration_ms: number }>
     - Calls the batch-score Edge Function
     - Returns count and timing

   Add CURRENT_SCORING_VERSION = '1' to src/utils/constants.ts

   Type: CachedScore = {
     product_id: string, final_score: number,
     is_partial_score: boolean, is_supplemental: boolean,
     category: string, product_name: string, brand: string,
     image_url: string | null, product_form: string | null
   }

Tests: __tests__/services/topMatches.test.ts
- checkCacheFreshness returns false on empty cache
- checkCacheFreshness returns false on life stage drift
- checkCacheFreshness returns false on profile edit
- checkCacheFreshness returns false on health update
- checkCacheFreshness returns false on version mismatch
- checkCacheFreshness returns true when all checks pass

Show me the plan before writing code.
```

```
/execute
```

---

### Prompt 2 — Copy Scoring Engine + Local Regression Verification

```
/plan

@CLAUDE.md @TOP_MATCHES_PLAN.md @src/services/scoring/engine.ts @src/services/scoring/pipeline.ts

Before building the Edge Function, we need to verify the scoring
engine can run outside of React Native. This prompt isolates that
risk.

Two deliverables:

1. Copy scoring engine to supabase/functions/batch-score/scoring/

   Files to copy (from src/services/scoring/):
   - engine.ts
   - ingredientQuality.ts
   - nutritionalProfile.ts
   - formulationScore.ts
   - speciesRules.ts
   - personalization.ts
   - dmbConversion.ts
   - carbEstimate.ts
   - calorieEstimation.ts
   - supplementalClassifier.ts (for isSupplementalByName)
   - varietyPackDetector.ts (for detectVarietyPack)

   Also copy required utils:
   - constants.ts (SCORING_WEIGHTS, getScoreColor — only scoring-related constants)

   Adjust ALL import paths in the copies. Remove ANY React Native
   imports (Platform, AsyncStorage, etc.). These are pure math
   functions — if any file imports from 'react-native' or 'expo-*',
   strip that dependency from the COPY only. Do NOT modify originals.

2. Local verification script: scripts/verify-engine-copy.ts

   A standalone script (runnable with ts-node or Deno) that:
   a. Imports computeScore from the COPIED engine
   b. Loads Pure Balance product data + ingredients (hardcoded
      test fixture or loaded from a JSON fixture file)
   c. Runs computeScore() with a standard dog pet profile
   d. Asserts final_score === 62
   e. Prints PASS or FAIL with the actual score

   This script validates the copy is clean BEFORE we build the
   Edge Function around it. If Pure Balance ≠ 62, the problem is
   in the import adjustment, not in Edge Function plumbing.

DO NOT build the Edge Function yet. DO NOT write any Supabase
Edge Function boilerplate. This prompt is ONLY about copying
the engine and verifying the copy is correct.

Show me the plan. List every file you'll copy and every import
path you'll adjust.
```

**Review checkpoint:** This is the critical gate. If Pure Balance ≠ 62 from the copied engine, STOP. Debug the import/copy issue before proceeding. Common failure modes:
- Missing utility function that was imported from a shared file
- React Native `Platform.OS` check that doesn't exist in Deno
- Constants imported from a path that doesn't exist in the copy

```
/execute
```

After execution:
```
# Run the verification script
npx ts-node scripts/verify-engine-copy.ts
# OR if using Deno:
# deno run scripts/verify-engine-copy.ts

# Expected output: Pure Balance = 62 — PASS
# If FAIL: fix the copy, do NOT proceed to Session 5
```

**`/clear` after this prompt.** Engine copy is verified. Session 5 wraps it in the Edge Function.

---

## Session 5: Top Matches Edge Function

**Context is fresh. Engine copy is verified (Pure Balance = 62).**

---

### Prompt 1 — Batch Score Edge Function

```
/plan

@CLAUDE.md @TOP_MATCHES_PLAN.md @supabase/functions/batch-score/scoring/engine.ts

Starting M5 Session 5: Wrap the verified scoring engine copy in
a Supabase Edge Function.

PREREQUISITE: scripts/verify-engine-copy.ts produced Pure Balance = 62.
If it didn't, do NOT proceed — go back to Session 4 and fix the copy.

File: supabase/functions/batch-score/index.ts

The scoring engine files are already in
supabase/functions/batch-score/scoring/ — verified in Session 4.
This prompt wraps them in Edge Function infrastructure.

Input (POST body):
{
  pet_id: string,
  pet_profile: PetProfile,
  allergens: string[],
  conditions: string[]
}

Logic:
1. Fetch all products WHERE target_species = pet_profile.species
   AND is_vet_diet = false (D-135)
   AND is_recalled = false (D-158)
   Select: id, category, is_grain_free, is_supplemental,
   aafco_statement, preservative_type, ga_*, name,
   feeding_guidelines, life_stage_claim

2. Fetch ALL product_ingredients + ingredients_dict in ONE bulk query:
   SELECT pi.product_id, pi.position, id.*
   FROM product_ingredients pi
   JOIN ingredients_dict id ON pi.ingredient_id = id.id
   WHERE pi.product_id = ANY($productIds)

3. Group ingredients by product_id in memory (Map<string, ingredient[]>)

4. For each product:
   a. detectVarietyPack() — skip if detected
   b. isSupplementalByName() for runtime detection
   c. computeScore(product, ingredients, petProfile, allergens, conditions)
   d. Collect { product_id, final_score, is_partial, is_supplemental, category }

5. Bulk upsert into pet_product_scores:
   INSERT ... ON CONFLICT (pet_id, product_id) DO UPDATE SET ...

6. Return { scored: count, duration_ms: elapsed }

Performance target: 4-6 seconds for ~1,700 products.

Error handling:
- Individual product failures: skip, log, continue batch
- Auth: verify calling user owns the pet_id
- Rate limit: one batch per pet per 5 minutes

Verification after deployment:
- Call Edge Function with Pure Balance product → score must be 62
- If it's not 62 but verify-engine-copy.ts passed, the issue is
  in the Edge Function wrapper (data fetching, ingredient grouping),
  not the scoring engine itself.

Show me the plan. Focus on:
- The two bulk SQL queries (products + ingredients)
- Ingredient grouping into Map<product_id, ingredient[]>
- The upsert conflict resolution
```

**Review checkpoint:** Verify:
1. Engine files are imported from `./scoring/`, not from `src/services/`
2. Two bulk queries, not per-product queries
3. Pure Balance = 62 from the deployed Edge Function

```
/execute
```

After execution:
```
# Deploy and test
supabase functions deploy batch-score
# Then call via curl or Supabase client with test pet profile
# Verify Pure Balance = 62
```

**`/clear` after this prompt.** Backend is done. Session 6 is the UI layer.

---

## Session 6: Top Matches UI + Gram Toggle + Phase 1 Wrap

**Context is fresh.**

---

### Prompt 1 — Top Matches Zustand Store + SearchScreen

```
/plan

@CLAUDE.md @TOP_MATCHES_PLAN.md @src/services/topMatches.ts @src/screens/SearchScreen.tsx

Starting M5 Session 6: Top Matches UI + gram toggle.

Two deliverables:

1. Zustand store: src/stores/useTopMatchesStore.ts

   Shape:
     scores: CachedScore[]
     loading: boolean
     refreshing: boolean     // true during batch re-score
     error: string | null
     categoryFilter: 'daily_food' | 'treat' | 'all'
     searchQuery: string

   Actions:
     loadTopMatches(petId: string) — checks freshness, triggers
       batch score if stale, then fetches from cache
     refreshScores(petId: string) — force batch re-score
     setFilter(category) — updates filter, re-queries cache
     setSearch(query) — updates search, client-side filter

   NOT persisted to AsyncStorage.

2. SearchScreen rewrite: src/screens/SearchScreen.tsx

   Transform from placeholder to Top Matches screen.

   HEADER:
   - "Top Matches for [Pet Name]" with pet photo badge (32×32)
   - Pet switcher for multi-pet (same pattern as PantryScreen header)

   FILTER BAR (horizontal ScrollView):
   - Category chips: "Daily Food" | "Treats" | "All" (default: Daily Food)
   - Text search input: filters by brand/name (client-side)

   PRODUCT LIST (FlatList, paginated 25):
   - Each row: product image (56×56) + brand + name (2-line clamp)
     + score badge (colored number + "% match") using
     getScoreColor(score, isSupplemental)
   - Partial badge (amber) when is_partial_score
   - Supplemental teal badge when is_supplemental
   - NOTE: Recalled products are excluded from batch scoring (D-158)
     so they never appear in Top Matches results.
   - Tap → navigates to ResultScreen with { productId, petId }
     (existing nav — ResultScreen runs fresh score on load)

   LOADING STATES:
   - First-time scoring: "Scoring [n] products for [Pet Name]..."
     with activity indicator. This takes 4-6 seconds.
   - Stale cache refresh: "Updating matches for [Pet Name]..."
   - Error: retry button + error message

   PAYWALL: canSearch() already exists in permissions.ts and gates
   this screen. Free users see the search bar → type → paywall:
   "Search is a premium feature." Already wired from M3.

   EMPTY STATE: After scoring completes but no matches found for
   filter — "No [category] matches found. Try a different filter."

Design:
- Dark theme, #1A1A2E background, #242424 card surfaces
- Score badges use getScoreColor() — green family for daily,
  teal family for supplemental
- D-094: scores always "[X]% match"
- D-084: no emoji, Ionicons only
- Category chips: pill-shaped, selected = accent fill

Show me the plan before writing code.
```

```
/execute
```

---

### Prompt 2 — Gram Toggle on PortionCard

```
@CLAUDE.md @src/components/PortionCard.tsx @src/services/scoring/calorieEstimation.ts

Add a cups ↔ grams toggle to PortionCard.

Spec (from PANTRY_SPEC.md §9):

Math:
  grams_per_day = cups_per_day × grams_per_cup
  grams_per_cup = (kcal_per_cup / kcal_per_kg) × 1000

Toggle:
- Small segmented control: [Cups] [Grams]
- Only visible when BOTH kcal_per_cup AND kcal_per_kg resolve
  (from label or D-149 Atwater). If either is null → cups only,
  no toggle rendered.
- resolveCalories() from calorieEstimation.ts provides both values

Preference persistence:
- Store in AsyncStorage: 'portionUnit' = 'cups' | 'grams'
- Default: 'cups'
- Read on component mount, write on toggle change

Display:
- Cups mode: "2.3 cups/day" (existing behavior)
- Grams mode: "X g/day" (computed from cups × grams_per_cup)
- If D-149 Atwater estimated: "(estimated)" indicator persists
  in both modes

This is display-layer ONLY. No changes to:
- Scoring engine
- Depletion math (always in original quantity_unit)
- PortionCard's DER calculation logic

Tests: __tests__/components/PortionCard.test.tsx (add to existing)
- Toggle visible when both kcal values available
- Toggle hidden when kcal_per_kg missing
- Grams calculation correct (known kcal_per_cup and kcal_per_kg)
- Preference persisted and restored
```

---

### Prompt 3 — Phase 1 Integration + Regression

```
/plan

Phase 1 integration verification. Run all checks:

1. npx tsc --noEmit — 0 errors
2. npx jest --silent — all tests pass (count the total)
3. Verify Pure Balance regression = 62 (run the specific test)
4. Verify Temptations regression = 9

5. Manual verification checklist (list each as pass/fail):
   - Scan product → "Add to Pantry" button visible
   - Add-to-pantry sheet: weight mode for dry food
   - Add-to-pantry sheet: unit mode with fractions for wet food
   - Species mismatch blocks add-to-pantry
   - Duplicate UPC prompts restock
   - Pantry tab shows items for active pet
   - Pantry card displays score, countdown, feeding summary
   - Pantry card progress bar shows depletion percentage
   - Add-to-pantry sheet: depletion breakdown line updates live
   - Add-to-pantry sheet: dynamic unit label (cans vs pouches)
   - Treats in pantry: no depletion breakdown, no calorie context
   - Filter chip bar filters pantry list correctly
   - Sort menu changes list order
   - Empty item grayed out with Restock/Remove actions
   - Diet completeness amber warning (supplemental only)
   - Diet completeness red warning (treats only)
   - No warning when complete food present
   - Share flow shows same-species pets only (premium)
   - Share blocked for free users
   - Offline: write attempt shows toast, pantry reads from cache
   - Top Matches: first load triggers batch scoring
   - Top Matches: scores display sorted by match %
   - Top Matches: tap product → ResultScreen
   - Top Matches: category filter works
   - Top Matches: text search filters results
   - Gram toggle: visible when calorie data exists
   - Gram toggle: hidden when data missing
   - Gram toggle: preference persists

6. Document results in session6-m5p1-progress.md

Do NOT fix failures in this prompt — just document them.
Report the total test count and any regressions.
```

---

## Phase 1 Summary Checklist

After all 6 sessions, these should be true:

- [ ] `npx tsc --noEmit` = 0 errors
- [ ] All tests pass (641 + new pantry/topMatches/gramToggle tests)
- [ ] Pure Balance = 62, Temptations = 9
- [ ] Pure Balance = 62 from copied scoring engine (verify-engine-copy.ts)
- [ ] Pure Balance = 62 from deployed Edge Function
- [ ] Migration 011 (pantry tables) + 012 (pet_product_scores) created
- [ ] RLS on both new tables verified
- [ ] Pantry CRUD working: add, remove, restock, edit, share
- [ ] Pantry screen rendering: cards, states, diet completeness, empty states
- [ ] Add-to-pantry: weight mode, unit mode with fractions, system recommendation
- [ ] Species mismatch blocks add-to-pantry
- [ ] Duplicate UPC → restock prompt
- [ ] Offline write blocked with toast ("Connect to the internet...")
- [ ] Offline read shows cached pantry data
- [ ] Top Matches: batch scoring Edge Function produces correct scores
- [ ] Top Matches: SearchScreen with filters, pagination, score badges
- [ ] Gram toggle on PortionCard with preference persistence
- [ ] Goal weight DER is the only pantry paywall (via permissions.ts)
- [ ] Share is premium-gated (via permissions.ts)
- [ ] No scoring engine modifications (originals untouched)
- [ ] D-094, D-095, D-084 compliance in all new UI copy

---

## Phase 2 Preview (Separate Document)

Phase 2 covers everything that Phase 1 doesn't touch:

- **Feeding schedule UI** — clock time picker, notification preference per item
- **Auto-depletion cron** — Supabase scheduled function
- **Push notification infrastructure** — Expo Push setup, token storage, Edge Function
- **Recall Siren** — FDA RSS monitoring, pantry cross-reference, push alerts, recall bypass on ResultScreen (D-158)
- **Pet Appointments (D-103)** — schedule, reminders, recurring
- **Weekly Digest (D-130)** — Supabase scheduled function, adaptive content
- **Integration testing** — full end-to-end flows
- **Compliance audit** — D-094, D-095, D-084 grep across all M5 files
- **M5 summary document**

---

## Decision Reference — Which Prompts Use Which D-Numbers

| D-Number | Topic | Used In |
|----------|-------|---------|
| D-052 | Multi-pet premium gate | S2-P2 (treat logging), S3-P2 (pet switcher), S3-P3 (share) |
| D-065 | Bag countdown + low stock | S1-P4 (helpers), S3-P1 (card states) |
| D-084 | Zero emoji | S2-P1, S3-P1, S3-P2, S6-P1 |
| D-094 | Suitability framing | S3-P1 (card score display), S6-P1 (Top Matches scores) |
| D-095 | UPVM / Clinical Copy | S3-P2 (diet completeness copy) |
| D-101 | Feeding schedule + auto-depletion | S1-P3 (schema), S1-P4 (types) — execution in Phase 2 |
| D-124 | Treat logging entry point | S2-P2 |
| D-125 | Recalls free | S3-P1 (card state) |
| D-129 | Allergen override (per-pet scores) | S5-P1 (batch scoring) |
| D-135 | Vet diet bypass | S2-P2 (add-to-pantry allows vet diet), S5-P1 (batch skip) |
| D-136 | Supplemental classification + diet completeness | S1-P4 (diet eval), S3-P1 (badge), S3-P2 (banner) |
| D-144 | Species mismatch | S2-P1 (blocks add-to-pantry), S3-P3 (share filter) |
| D-145 | Variety pack | S2-P1 (allowed in pantry), S5-P1 (batch skip) |
| D-146 | Supplemental name detection | S5-P1 (runtime detection in batch) |
| D-149 | Atwater calorie estimation | S1-P4 (calorie context), S2-P1 (recommendation), S6-P2 (gram toggle) |
| D-150 | Life stage mismatch | S4-P1 (freshness check — life stage drift) |
| D-151 | Nursing advisory | S1-P4 (suppress recommendation under 4 weeks) |
| D-152 | Pantry depletion model | S1-P4 (getSystemRecommendation), S2-P1 (recommendation display) |
| D-153 | Pantry paywall scope | S2-P1 (goal weight DER gate), S3-P3 (share gate) |
| D-154 | Sharing rules | S3-P3 (same-species, premium, default active pet) |
| D-155 | Empty item behavior | S3-P1 (card empty state), S3-P2 (restock flow) |
| D-156 | Score source | S1-P4 (getPantryForPet reads current score) |
| D-157 | Mixed feeding removal | S3-P2 (no auto-rebalance on remove) |
| D-158 | Recalled product bypass (no score, like vet diet) | S5-P1 (batch exclusion) |

---

## M5 Polish (After Phase 2)

These items are explicitly deferred from the core sessions:

- **Per-product density data:** Replace the cups-to-lbs standard approximation with actual density values per product (if obtainable).
- **Timezone-aware notifications:** Weekly digest and feeding reminders use UTC in Phase 2. Local timezone support is a v2 improvement.
- **Loading screen polish:** Make terminal sequence feel data-driven rather than canned (discussed pre-M5, never implemented).

---

## Notes for Steven

**Before running any prompt:**
1. Add D-152 through D-158 to DECISIONS.md (D-152–D-157 from PANTRY_SPEC.md §13, D-158 = recalled product bypass — same pattern as vet diet, no score, warning + ingredients only)
2. Place PANTRY_SPEC.md and TOP_MATCHES_PLAN.md in the project root
3. Update CLAUDE.md to M5 (or let Prompt 2 handle it)
4. `npx jest --silent` — all 641 pass before starting

**During Session 1:**
- The migration is straightforward (new tables only, no column renames). Lower risk than M2's migration. But verify RLS policies carefully — the `pantry_pet_assignments` policy that scopes through `pantry_items.user_id` is the one to watch.
- If Claude proposes scoping assignments through `pets.user_id` instead, that's also valid. Either path works.

**During Session 2:**
- The fractional chip selector is the trickiest UI component. Verify the mapping: ¼ → 0.25, ⅓ → 0.3333, ½ → 0.5, ⅔ → 0.6667, ¾ → 0.75. If Claude rounds ⅓ to 0.33, that's close enough for depletion math but flag it.
- Verify the system recommendation uses `canUseGoalWeight()` from `permissions.ts`. If Claude puts an inline premium check, reject it.

**During Session 3:**
- Diet completeness copy must be D-095 compliant. Read every warning string. No "you should," no "we recommend," no "avoid."
- The card component has a lot of conditional rendering (empty, low stock, recalled, supplemental, stale). It will be tempting to let this get complex. If Claude's plan shows >200 lines for the card, suggest extracting state-specific sub-components.

**During Session 4:**
- This is the highest-risk session. The batch-score Edge Function copies the scoring engine into Deno. Pure Balance MUST equal 62 from the Edge Function. If it doesn't, do NOT adjust — find the divergence.
- The two bulk SQL queries (all products + all ingredients) are the performance key. If Claude proposes per-product queries, reject it — that's 1,700 round trips.
- Scoring engine files must be COPIED to `supabase/functions/batch-score/scoring/`, not imported via symlink or relative path. Edge Functions have isolated deployments.

**During Session 5:**
- The SearchScreen rewrite replaces a placeholder, so no existing behavior to break.
- Gram toggle is low-risk — it's a display-layer change with no scoring impact.
- The integration prompt (S5-P3) documents but does NOT fix issues. That's intentional — fix in a follow-up prompt with clear context, not in a bloated session.

**After Phase 1:**
- Run on iOS device. Pantry tab, add a product, verify the card renders correctly. Switch pets (premium), verify pantry swaps. Open Top Matches, verify batch scoring completes and scores display.
- Phase 2 builds on Phase 1's foundation. Do not start Phase 2 until all Phase 1 checklist items pass.
