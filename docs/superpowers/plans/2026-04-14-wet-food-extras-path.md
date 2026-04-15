# Wet Food Extras Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the silent-overfeed bug when adding non-dry food to `dry_only` pets, and repair topper (`is_supplemental = true`) usage tracking, by introducing a one-time intent intercept sheet and routing toppers/intent-sheet-topper-picks as `rotational + as_needed + auto_deplete=false`.

**Architecture:** Per-assignment `feeding_role + feeding_frequency + auto_deplete_enabled` are preserved as the single source of truth. A new `FeedingIntentSheet` component gates `FeedingStyleSetupSheet` for `dry_only` pets adding non-dry complete meals. Persistence via new `pets.wet_intent_resolved_at` column (migration 039). Decoupled role/schedule toggles in EditPantryItemScreen; schedule toggle drives `auto_deplete_enabled` as a side effect. `computeBehavioralServing` gets a single-line fix for the `dry_only + rotational` case. Toppers route through the existing rotational code path; existing `refreshWetReserve` filter at `pantryService.ts:876` already excludes them from `wet_reserve_kcal` averaging.

**Tech Stack:** React Native (Expo SDK 55), TypeScript 5.9 strict, Zustand 5, Supabase JS 2.98, Jest (jest-expo). All code follows `.agent/design.md` Matte Premium token system.

**Spec:** `docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md`

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `supabase/migrations/039_wet_intent_resolved_at.sql` | Adds `pets.wet_intent_resolved_at` column + backfill for existing pets |
| `src/components/pantry/FeedingIntentSheet.tsx` | Two-card modal: "Regular meal" vs "Just a topper" |
| `__tests__/components/pantry/FeedingIntentSheet.test.tsx` | Component render + callback tests |

### Modified files

| Path | Change |
|---|---|
| `src/types/pet.ts` | Add `wet_intent_resolved_at: string \| null` to `Pet` interface |
| `src/components/pantry/AddToPantrySheet.tsx` | Split `treat` conflation into `isTreat`/`isTopper`/`isSupplement`; wire `FeedingIntentSheet` in place of today's direct `FeedingStyleSetupSheet` trigger; force rotational assignment values on "Just a topper" path; persist `wet_intent_resolved_at` on both outcomes |
| `src/utils/pantryHelpers.ts` | `computeBehavioralServing` `dry_only` branch: early-return `null` for `rotational` role |
| `src/screens/EditPantryItemScreen.tsx` | `handleFrequencyToggle` also writes `auto_deplete_enabled`; remove read-only Auto-Deplete info row; add "Fed This Today" Featured Action Card with visibility matrix |
| `src/services/pantryService.ts` | `evaluateDietCompleteness` copy refinement for `dry_only` + rotational-only + zero-base edge case |
| `__tests__/components/pantry/AddToPantrySheet.test.ts` | New routing-matrix cases (treat/topper/complete-meal × feeding_style) + intercept integration tests |
| `__tests__/screens/EditPantryItemScreen.test.ts` | `handleFrequencyToggle` auto_deplete wiring + Featured Action Card visibility matrix |
| `__tests__/utils/pantryHelpers.test.ts` | New case: `dry_only` + `rotational` → `null` |
| `__tests__/services/pantryService.test.ts` | New case: `dry_only` + rotational-only + zero-base → topper-aware copy |

---

## Task 1: Migration 039 + Pet type

**Files:**
- Create: `supabase/migrations/039_wet_intent_resolved_at.sql`
- Modify: `src/types/pet.ts:30-66`

### Steps

- [ ] **Step 1: Create migration file**

```sql
-- Migration 039: wet_intent_resolved_at — tracks whether the user has
-- resolved the wet-food intent intercept on FeedingIntentSheet.
-- See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md

BEGIN;

ALTER TABLE pets
  ADD COLUMN wet_intent_resolved_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: existing pets skip the intercept on their next add.
-- Applies to: pets already on non-dry_only feeding_style, OR pets with
-- any active cross-format pantry assignment (wet item or topper).
UPDATE pets SET wet_intent_resolved_at = NOW()
WHERE feeding_style != 'dry_only'
   OR id IN (
     SELECT DISTINCT ppa.pet_id
     FROM pantry_pet_assignments ppa
     JOIN pantry_items pi ON pi.id = ppa.pantry_item_id
     JOIN products p ON p.id = pi.product_id
     WHERE pi.is_active = true
       AND (p.product_form != 'dry' OR p.is_supplemental = true)
   );

COMMIT;
```

- [ ] **Step 2: Verify migration file syntax**

Run: `cat supabase/migrations/039_wet_intent_resolved_at.sql | head -30`
Expected: File contents display with `BEGIN;` through `COMMIT;` block.

- [ ] **Step 3: Update `Pet` interface**

In `src/types/pet.ts`, insert a new field in the Behavioral Feeding block (after line 62, before `created_at`):

```typescript
  // Behavioral Feeding Base Setup
  feeding_style: FeedingStyle;
  wet_reserve_kcal: number;
  wet_reserve_source: string | null;

  // FeedingIntentSheet one-time resolution (migration 039)
  wet_intent_resolved_at: string | null;

  created_at: string;
  updated_at: string;
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Passes (or the same number of pre-existing errors unrelated to pet type).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/039_wet_intent_resolved_at.sql src/types/pet.ts
git commit -m "M9: migration 039 — pets.wet_intent_resolved_at + Pet type

Adds nullable TIMESTAMPTZ for FeedingIntentSheet one-time resolution.
Backfills existing non-dry_only pets and pets with cross-format pantry
history so the intercept only fires for net-new dry_only pets.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `computeBehavioralServing` rotational early-return

**Files:**
- Modify: `src/utils/pantryHelpers.ts:418-420`
- Test: `__tests__/utils/pantryHelpers.test.ts` (add new case in existing `describe('computeBehavioralServing')` block)

### Steps

- [ ] **Step 1: Read existing test context**

Run: `grep -n "describe('computeBehavioralServing'" __tests__/utils/pantryHelpers.test.ts`
Expected: Existing describe block at approx line 990.

- [ ] **Step 2: Write failing test**

Append inside the existing `describe('computeBehavioralServing', () => {` block in `__tests__/utils/pantryHelpers.test.ts`:

```typescript
  test('dry_only pet + rotational role returns null (topper path)', () => {
    // When a dry_only pet has a rotational item (topper or intent-sheet-
    // routed extras), the serving must be null so PantryCard surfaces the
    // "Log feeding" button instead of computing a full-DER meal.
    const pet = makePet({
      feeding_style: 'dry_only',
      weight_current_lbs: 50,
      is_neutered: true,
      activity_level: 'moderate',
      life_stage: 'adult',
      wet_reserve_kcal: 0,
    });
    const product = makeProduct({
      product_form: 'wet',
      ga_kcal_per_kg: 1000,
      is_supplemental: true,
    });

    const result = computeBehavioralServing({
      pet,
      product,
      feedingRole: 'rotational',
      dailyWetFedKcal: 0,
      dryFoodSplitPct: 100,
      isPremiumGoalWeight: false,
    });

    expect(result).toBeNull();
  });
```

Use the same `makePet` / `makeProduct` factory helpers the other tests in this file use. If this is the first test to reference a particular factory, mirror the setup pattern from the existing `describe('computeBehavioralServing')` tests (approx line 990-1120).

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest __tests__/utils/pantryHelpers.test.ts -t "dry_only pet \+ rotational role returns null" -v`
Expected: FAIL — the current `dry_only` branch returns a computed serving amount, not `null`.

- [ ] **Step 4: Implement the fix**

In `src/utils/pantryHelpers.ts`, modify the `dry_only` branch inside `computeBehavioralServing` (around line 418):

```typescript
  if (style === 'dry_only') {
    if (feedingRole === 'rotational') return null;
    budgetedKcal = der;
  } else if (style === 'dry_and_wet') {
```

- [ ] **Step 5: Run the new test**

Run: `npx jest __tests__/utils/pantryHelpers.test.ts -t "dry_only pet \+ rotational role returns null" -v`
Expected: PASS.

- [ ] **Step 6: Run full `pantryHelpers` suite for regression**

Run: `npx jest __tests__/utils/pantryHelpers.test.ts -v`
Expected: All tests pass (including the existing `computeBehavioralServing` cases — no regression).

- [ ] **Step 7: Commit**

```bash
git add src/utils/pantryHelpers.ts __tests__/utils/pantryHelpers.test.ts
git commit -m "M9: computeBehavioralServing — dry_only + rotational returns null

Mirrors the custom branch pattern: when a rotational item exists on a
dry_only pet (topper path or intent-sheet outcome), return null so
PantryCard surfaces the Log feeding button rather than computing a
full-DER serving.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `FeedingIntentSheet` component

**Files:**
- Create: `src/components/pantry/FeedingIntentSheet.tsx`
- Create: `__tests__/components/pantry/FeedingIntentSheet.test.tsx`

Mirror the structure of `src/components/pantry/FeedingStyleSetupSheet.tsx` (2 cards instead of 4, otherwise identical modal/sheet mechanics and styling).

### Steps

- [ ] **Step 1: Write failing tests first**

Create `__tests__/components/pantry/FeedingIntentSheet.test.tsx`:

```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { FeedingIntentSheet } from '../../../src/components/pantry/FeedingIntentSheet';

describe('FeedingIntentSheet', () => {
  const baseProps = {
    isVisible: true,
    petName: 'Buster',
    onRegularMeal: jest.fn(),
    onTopperExtras: jest.fn(),
    onDismiss: jest.fn(),
  };

  beforeEach(() => {
    baseProps.onRegularMeal.mockClear();
    baseProps.onTopperExtras.mockClear();
    baseProps.onDismiss.mockClear();
  });

  test('renders header with pet name', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    expect(getByText(/How will Buster eat this/i)).toBeTruthy();
  });

  test('renders both option cards', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    expect(getByText('Regular meal')).toBeTruthy();
    expect(getByText('Just a topper or extra')).toBeTruthy();
  });

  test('tapping "Regular meal" invokes onRegularMeal', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    fireEvent.press(getByText('Regular meal'));
    expect(baseProps.onRegularMeal).toHaveBeenCalledTimes(1);
    expect(baseProps.onTopperExtras).not.toHaveBeenCalled();
  });

  test('tapping "Just a topper or extra" invokes onTopperExtras', () => {
    const { getByText } = render(<FeedingIntentSheet {...baseProps} />);
    fireEvent.press(getByText('Just a topper or extra'));
    expect(baseProps.onTopperExtras).toHaveBeenCalledTimes(1);
    expect(baseProps.onRegularMeal).not.toHaveBeenCalled();
  });

  test('returns null when isVisible is false', () => {
    const { queryByText } = render(
      <FeedingIntentSheet {...baseProps} isVisible={false} />,
    );
    expect(queryByText('Regular meal')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/components/pantry/FeedingIntentSheet.test.tsx -v`
Expected: FAIL — module `FeedingIntentSheet` does not exist.

- [ ] **Step 3: Implement the component**

Create `src/components/pantry/FeedingIntentSheet.tsx`:

```typescript
import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ScrollView, Modal, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { chipToggle } from '../../utils/haptics';

interface FeedingIntentSheetProps {
  isVisible: boolean;
  petName: string;
  onRegularMeal: () => void;
  onTopperExtras: () => void;
  onDismiss: () => void;
}

export function FeedingIntentSheet({
  isVisible,
  petName,
  onRegularMeal,
  onTopperExtras,
  onDismiss,
}: FeedingIntentSheetProps) {
  if (!isVisible) return null;

  const handleRegularMeal = () => {
    chipToggle();
    onRegularMeal();
  };

  const handleTopperExtras = () => {
    chipToggle();
    onTopperExtras();
  };

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onDismiss}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.overlay} onPress={onDismiss}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.contentContainer}>
              <View style={styles.header}>
                <Text style={styles.title}>How will {petName} eat this?</Text>
                <Text style={styles.subtitle}>
                  This affects how we track feedings and portions.
                </Text>
              </View>

              <ScrollView contentContainerStyle={styles.scrollContent}>
                <Pressable style={styles.optionCard} onPress={handleRegularMeal}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <Ionicons name="restaurant-outline" size={28} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Regular meal</Text>
                    <Text style={styles.optionSubtitle}>
                      This is a main meal for {petName}. I'll feed it on a schedule.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>

                <Pressable style={styles.optionCard} onPress={handleTopperExtras}>
                  <View style={[styles.iconBox, { backgroundColor: Colors.chipSurface }]}>
                    <Ionicons name="add-circle-outline" size={28} color={Colors.accent} />
                  </View>
                  <View style={styles.optionTextContainer}>
                    <Text style={styles.optionTitle}>Just a topper or extra</Text>
                    <Text style={styles.optionSubtitle}>
                      I'll add it on top of {petName}'s dry food occasionally. I'll log when I feed it.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.textSecondary} />
                </Pressable>
              </ScrollView>
            </View>
            <View style={styles.bottomSpacer} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: '80%',
    paddingTop: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hairlineBorder,
  },
  bottomSpacer: {
    height: 40,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  scrollContent: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
    marginBottom: 4,
  },
  optionSubtitle: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/pantry/FeedingIntentSheet.test.tsx -v`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/pantry/FeedingIntentSheet.tsx __tests__/components/pantry/FeedingIntentSheet.test.tsx
git commit -m "M9: new FeedingIntentSheet component

Two-card modal gating FeedingStyleSetupSheet for dry_only pets adding
non-dry complete meals. 'Regular meal' opens feeding-style picker;
'Just a topper or extra' routes to rotational + as_needed extras path
without changing pet feeding_style.

Mirrors FeedingStyleSetupSheet styling per .agent/design.md Matte Premium.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4a: AddToPantrySheet — routing classification refactor

**Files:**
- Modify: `src/components/pantry/AddToPantrySheet.tsx:116, 196-204, handleCTA region`
- Test: `__tests__/components/pantry/AddToPantrySheet.test.ts`

### Steps

- [ ] **Step 1: Inspect existing test file to understand fixtures**

Run: `head -60 __tests__/components/pantry/AddToPantrySheet.test.ts`
Expected: Existing imports, fixtures, and test helpers for this component.

- [ ] **Step 2: Write failing test for topper routing**

Add inside the existing `describe` block in `__tests__/components/pantry/AddToPantrySheet.test.ts`. Use whatever factory pattern / mock harness the existing tests use (observe from the head output in Step 1). If the file tests a helper-extraction pattern (pure functions imported from AddToPantrySheet.tsx), add a test for the new classification helper; otherwise, add an integration-style render test.

Conceptual test (adapt to the file's actual pattern):

```typescript
  test('topper (is_supplemental=true, daily_food) routes as rotational + as_needed + auto_deplete=false', () => {
    const pet = makePet({ feeding_style: 'dry_only' });
    const product = makeProduct({
      category: 'daily_food',
      is_supplemental: true,
      product_form: 'wet',
    });

    const { inferredRole, inferredFreq, inferredAutoDeplete } = inferAssignmentDefaults(pet, product);

    expect(inferredRole).toBe('rotational');
    expect(inferredFreq).toBe('as_needed');
    expect(inferredAutoDeplete).toBe(false);
  });

  test('topper on dry_and_wet pet also routes as rotational + as_needed', () => {
    const pet = makePet({ feeding_style: 'dry_and_wet' });
    const product = makeProduct({
      category: 'daily_food',
      is_supplemental: true,
      product_form: 'freeze-dried',
    });

    const { inferredRole, inferredFreq, inferredAutoDeplete } = inferAssignmentDefaults(pet, product);

    expect(inferredRole).toBe('rotational');
    expect(inferredFreq).toBe('as_needed');
    expect(inferredAutoDeplete).toBe(false);
  });

  test('treat (category=treat) still routes with feeding_role=null', () => {
    const pet = makePet({ feeding_style: 'dry_only' });
    const product = makeProduct({ category: 'treat', is_supplemental: false });

    const { inferredRole, inferredFreq } = inferAssignmentDefaults(pet, product);

    expect(inferredRole).toBeNull();
    expect(inferredFreq).toBe('as_needed');
  });

  test('supplement (category=supplement) still routes with feeding_role=null (deferred scope)', () => {
    const pet = makePet({ feeding_style: 'dry_only' });
    const product = makeProduct({ category: 'supplement', is_supplemental: false });

    const { inferredRole, inferredFreq } = inferAssignmentDefaults(pet, product);

    expect(inferredRole).toBeNull();
    expect(inferredFreq).toBe('as_needed');
  });

  test('complete meal (non-dry, dry_and_wet pet) routes as rotational', () => {
    const pet = makePet({ feeding_style: 'dry_and_wet' });
    const product = makeProduct({
      category: 'daily_food',
      is_supplemental: false,
      product_form: 'wet',
    });

    const { inferredRole, inferredFreq } = inferAssignmentDefaults(pet, product);

    expect(inferredRole).toBe('rotational');
    expect(inferredFreq).toBe('as_needed');
  });

  test('complete meal (dry, any feeding_style) routes as base + daily', () => {
    const pet = makePet({ feeding_style: 'dry_only' });
    const product = makeProduct({
      category: 'daily_food',
      is_supplemental: false,
      product_form: 'dry',
    });

    const { inferredRole, inferredFreq, inferredAutoDeplete } = inferAssignmentDefaults(pet, product);

    expect(inferredRole).toBe('base');
    expect(inferredFreq).toBe('daily');
    expect(inferredAutoDeplete).toBe(true);
  });
```

- [ ] **Step 3: Extract the classification helper as a pure exported function**

In `src/components/pantry/AddToPantrySheet.tsx`, add near the existing `isTreat`, `getDefaultFeedingsPerDay`, etc. exports (around line 53):

```typescript
export interface InferredAssignmentDefaults {
  isSimpleAdd: boolean;           // treat/topper/supplement — simple add form layout
  inferredRole: FeedingRole;
  inferredFreq: FeedingFrequency;
  inferredAutoDeplete: boolean;
}

/**
 * Classifies a product + pet feeding style into assignment defaults.
 * Replaces the previous conflated `treat = isTreat || is_supplemental`
 * flag that broke topper and dry_only + wet routing.
 *
 * See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md §4b.
 */
export function inferAssignmentDefaults(
  pet: Pick<Pet, 'feeding_style'>,
  product: Pick<Product, 'category' | 'is_supplemental' | 'product_form'>,
): InferredAssignmentDefaults {
  const isTreat = product.category === 'treat';
  const isTopper = product.is_supplemental === true && !isTreat;
  const isSupplement = product.category === 'supplement';
  const isSimpleAdd = isTreat || isTopper || isSupplement;

  let inferredRole: FeedingRole;
  if (isTreat || isSupplement) {
    inferredRole = null;
  } else if (isTopper) {
    inferredRole = 'rotational';
  } else if (pet.feeding_style === 'wet_only') {
    inferredRole = 'base';
  } else if (pet.feeding_style === 'dry_and_wet' && product.product_form !== 'dry') {
    inferredRole = 'rotational';
  } else {
    inferredRole = 'base';
  }

  const inferredFreq: FeedingFrequency = inferredRole === 'base' ? 'daily' : 'as_needed';
  const inferredAutoDeplete = inferredFreq === 'daily';

  return { isSimpleAdd, inferredRole, inferredFreq, inferredAutoDeplete };
}
```

Ensure the imports at the top of the file include `FeedingRole`, `FeedingFrequency`, `Pet`, `Product` from their respective source modules (check existing imports — the component already imports most of these).

- [ ] **Step 4: Run the new tests**

Run: `npx jest __tests__/components/pantry/AddToPantrySheet.test.ts -v`
Expected: 6 new tests pass; all existing tests still pass.

- [ ] **Step 5: Rewire the component to use the new helper**

Replace the existing `treat`, `inferredRole`, `feedingFrequency` derivations in the component body (around lines 116 and 197-204) with:

```typescript
  const {
    isSimpleAdd: treat,       // preserve legacy variable name for downstream JSX
    inferredRole,
    inferredFreq: feedingFrequency,
    inferredAutoDeplete,
  } = useMemo(
    () => inferAssignmentDefaults(pet, product),
    [pet.feeding_style, product.category, product.is_supplemental, product.product_form],
  );
```

**Important:** keep the local variable named `treat` so that downstream JSX conditionals (which today branch on `treat`) continue to work without a cascading rename. This is intentional scope-discipline — renaming every `treat` reference belongs to a separate refactor.

Verify the `handleCTA` function (around line 272 area) still builds its input with the correct values. If it uses `feedingFrequency` (the local) as input, no change needed. If it hardcodes `'as_needed'` in the treat branch, the topper path will already inherit that — but for the complete-meal path (non-treat branch), `buildAddToPantryInput` should accept `feeding_role: inferredRole, feeding_frequency: feedingFrequency, auto_deplete_enabled: inferredAutoDeplete`. Inspect and align.

- [ ] **Step 6: Run full AddToPantrySheet suite**

Run: `npx jest __tests__/components/pantry/AddToPantrySheet.test.ts -v`
Expected: All tests pass, including existing.

- [ ] **Step 7: Commit**

```bash
git add src/components/pantry/AddToPantrySheet.tsx __tests__/components/pantry/AddToPantrySheet.test.ts
git commit -m "M9: AddToPantrySheet — split treat conflation into topper-aware routing

Extract inferAssignmentDefaults(pet, product) pure helper. Splits the
treat/topper/supplement conflation that caused toppers to route with
feeding_role=null and no PantryCard usage-tracking button. Toppers now
route as rotational + as_needed + auto_deplete=false.

Preserves isSimpleAdd (aliased to legacy 'treat' local) so downstream
form-layout JSX needs no changes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4b: AddToPantrySheet — wire FeedingIntentSheet

**Files:**
- Modify: `src/components/pantry/AddToPantrySheet.tsx` (state, effects, sheet rendering)
- Modify: `src/services/petService.ts` (verify `updatePet` accepts `wet_intent_resolved_at`)
- Test: `__tests__/components/pantry/AddToPantrySheet.test.ts`

### Steps

- [ ] **Step 1: Verify `petService.updatePet` accepts partial updates**

Run: `grep -n "export async function updatePet\|UpdatePetInput" src/services/petService.ts | head -20`
Expected: A function signature accepting a partial update object. `wet_intent_resolved_at` should flow through without explicit type changes because the service likely takes `Partial<Pet>` or similar. If it uses a restrictive `UpdatePetInput` type, add `wet_intent_resolved_at?: string | null` to that type.

- [ ] **Step 2: Write failing integration test for the intercept flow**

Add to `__tests__/components/pantry/AddToPantrySheet.test.ts`:

```typescript
  describe('FeedingIntentSheet intercept', () => {
    test('fires when dry_only pet adds non-dry complete meal with null wet_intent_resolved_at', () => {
      const pet = makePet({
        feeding_style: 'dry_only',
        wet_intent_resolved_at: null,
      });
      const product = makeProduct({
        category: 'daily_food',
        is_supplemental: false,
        product_form: 'wet',
        is_vet_diet: false,
      });

      const shouldFire = shouldShowFeedingIntentSheet(pet, product);

      expect(shouldFire).toBe(true);
    });

    test('does NOT fire when pet already resolved intent', () => {
      const pet = makePet({
        feeding_style: 'dry_only',
        wet_intent_resolved_at: '2026-04-01T00:00:00Z',
      });
      const product = makeProduct({
        category: 'daily_food',
        is_supplemental: false,
        product_form: 'wet',
      });

      expect(shouldShowFeedingIntentSheet(pet, product)).toBe(false);
    });

    test('does NOT fire for toppers (no ambiguity — always extras)', () => {
      const pet = makePet({
        feeding_style: 'dry_only',
        wet_intent_resolved_at: null,
      });
      const product = makeProduct({
        category: 'daily_food',
        is_supplemental: true,          // topper
        product_form: 'wet',
      });

      expect(shouldShowFeedingIntentSheet(pet, product)).toBe(false);
    });

    test('does NOT fire for dry products', () => {
      const pet = makePet({
        feeding_style: 'dry_only',
        wet_intent_resolved_at: null,
      });
      const product = makeProduct({
        category: 'daily_food',
        is_supplemental: false,
        product_form: 'dry',
      });

      expect(shouldShowFeedingIntentSheet(pet, product)).toBe(false);
    });

    test('does NOT fire for vet diets (existing bypass)', () => {
      const pet = makePet({
        feeding_style: 'dry_only',
        wet_intent_resolved_at: null,
      });
      const product = makeProduct({
        category: 'daily_food',
        is_supplemental: false,
        product_form: 'wet',
        is_vet_diet: true,
      });

      expect(shouldShowFeedingIntentSheet(pet, product)).toBe(false);
    });

    test('does NOT fire for non-dry_only pets', () => {
      const pet = makePet({
        feeding_style: 'dry_and_wet',
        wet_intent_resolved_at: null,
      });
      const product = makeProduct({
        category: 'daily_food',
        is_supplemental: false,
        product_form: 'wet',
      });

      expect(shouldShowFeedingIntentSheet(pet, product)).toBe(false);
    });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest __tests__/components/pantry/AddToPantrySheet.test.ts -t "FeedingIntentSheet intercept" -v`
Expected: FAIL — `shouldShowFeedingIntentSheet` is undefined.

- [ ] **Step 4: Extract and export the trigger predicate**

In `src/components/pantry/AddToPantrySheet.tsx`, add alongside `inferAssignmentDefaults`:

```typescript
/**
 * Returns true when FeedingIntentSheet should fire for this pet+product combo.
 * See spec §2 trigger conditions.
 */
export function shouldShowFeedingIntentSheet(
  pet: Pick<Pet, 'feeding_style' | 'wet_intent_resolved_at'>,
  product: Pick<Product, 'category' | 'is_supplemental' | 'product_form' | 'is_vet_diet'>,
): boolean {
  return (
    pet.feeding_style === 'dry_only' &&
    pet.wet_intent_resolved_at == null &&
    product.category === 'daily_food' &&
    product.is_supplemental === false &&
    product.is_vet_diet === false &&
    product.product_form !== 'dry'
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/components/pantry/AddToPantrySheet.test.ts -t "FeedingIntentSheet intercept" -v`
Expected: 6 tests pass.

- [ ] **Step 6: Replace in-component intercept wiring**

In the component body of `AddToPantrySheet.tsx`, locate the current mismatch check (around lines 140-168) and the showStyleSetup rendering branch (around line 350). Update:

```typescript
  // Component state (near line 130)
  const [showIntentSheet, setShowIntentSheet] = useState(false);
  const [showStyleSetup, setShowStyleSetup] = useState(false);
  // REMOVE: const [hasSeenStyleSetup, setHasSeenStyleSetup] = useState(false);

  // Intercept trigger effect (replaces the existing `isMismatch` useEffect)
  useEffect(() => {
    if (!visible || treat) return;
    if (shouldShowFeedingIntentSheet(pet, product)) {
      setShowIntentSheet(true);
    }
  }, [visible, treat, pet, product]);
```

Handler functions (add near other handlers):

```typescript
  const handleIntentRegularMeal = useCallback(() => {
    setShowIntentSheet(false);
    setShowStyleSetup(true);
    // Persistence write happens after user picks a feeding_style (or immediately
    // below — either is acceptable. Writing now is simpler.)
    persistWetIntentResolved();
  }, []);

  const handleIntentTopperExtras = useCallback(() => {
    setShowIntentSheet(false);
    setIntentForcedTopper(true);     // new local state flag
    persistWetIntentResolved();
  }, []);

  const handleIntentDismiss = useCallback(() => {
    // Treat dismiss as "Just a topper" per spec §2 — safer default
    handleIntentTopperExtras();
  }, [handleIntentTopperExtras]);

  const persistWetIntentResolved = useCallback(async () => {
    await updatePet(pet.id, { wet_intent_resolved_at: new Date().toISOString() });
    // Refresh active pet cache if needed
    await useActivePetStore.getState().refreshPet(pet.id);
  }, [pet.id]);
```

Add new state at the top:

```typescript
  const [intentForcedTopper, setIntentForcedTopper] = useState(false);

  // Reset on close
  useEffect(() => {
    if (!visible) {
      setShowIntentSheet(false);
      setShowStyleSetup(false);
      setIntentForcedTopper(false);
    }
  }, [visible]);
```

Override the inference in `handleCTA`:

```typescript
  // Inside handleCTA, before buildAddToPantryInput:
  const effectiveRole: FeedingRole = intentForcedTopper ? 'rotational' : inferredRole;
  const effectiveFreq: FeedingFrequency = intentForcedTopper ? 'as_needed' : feedingFrequency;
  const effectiveAutoDeplete = intentForcedTopper ? false : inferredAutoDeplete;

  // Then pass effective* values into the input builder.
```

Render the new sheet in the component's JSX (co-located with the existing `FeedingStyleSetupSheet` render around line 350):

```typescript
  if (showIntentSheet) {
    return (
      <FeedingIntentSheet
        isVisible={showIntentSheet}
        petName={pet.name}
        onRegularMeal={handleIntentRegularMeal}
        onTopperExtras={handleIntentTopperExtras}
        onDismiss={handleIntentDismiss}
      />
    );
  }

  if (showStyleSetup) {
    return (
      <FeedingStyleSetupSheet
        // ... existing props
      />
    );
  }
```

Add imports at top:

```typescript
import { FeedingIntentSheet } from './FeedingIntentSheet';
import { updatePet } from '../../services/petService';
```

Ensure `buildAddToPantryInput` (or whatever builds the assignment payload) receives `feeding_role`, `feeding_frequency`, `auto_deplete_enabled` from the `effective*` values when not on the treat path, and existing defaults when on the treat path.

- [ ] **Step 7: Run full AddToPantrySheet suite**

Run: `npx jest __tests__/components/pantry/AddToPantrySheet.test.ts -v`
Expected: All tests pass (existing + new routing + new intercept).

- [ ] **Step 8: Run full Jest suite to catch regressions**

Run: `npx jest`
Expected: 1508+ tests pass. Count should be higher than baseline by the number of new tests added (≈11 from Task 2 + 3 + 4a + 4b).

- [ ] **Step 9: Commit**

```bash
git add src/components/pantry/AddToPantrySheet.tsx __tests__/components/pantry/AddToPantrySheet.test.ts
git commit -m "M9: AddToPantrySheet — wire FeedingIntentSheet intercept

Replaces session-state hasSeenStyleSetup with persistent
wet_intent_resolved_at on the pets table. Intercept fires exactly once
per dry_only pet adding non-dry complete meal. 'Regular meal' forwards
to FeedingStyleSetupSheet (existing flow); 'Just a topper' forces
rotational + as_needed + auto_deplete=false without changing
feeding_style. Dismiss defaults to topper path (safer).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: EditPantryItemScreen — wire `auto_deplete_enabled` to schedule toggle

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx:203-212`
- Test: `__tests__/screens/EditPantryItemScreen.test.ts`

### Steps

- [ ] **Step 1: Inspect test harness**

Run: `head -80 __tests__/screens/EditPantryItemScreen.test.ts`
Expected: Existing test setup. Note whether the file tests component render or pure helpers.

- [ ] **Step 2: Write failing test for auto_deplete wiring**

Adapt this to the existing file pattern. If the file tests a pure helper, extract the toggle logic into a helper; if it tests component render, use the component-render approach.

Conceptual test (render-based):

```typescript
  test('toggling schedule to as_needed also disables auto_deplete and notifications', async () => {
    const updateSpy = jest.spyOn(pantryService, 'updatePetAssignment');
    const { getByText } = render(<EditPantryItemScreen ... />);

    fireEvent.press(getByText('As needed'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          feeding_frequency: 'as_needed',
          auto_deplete_enabled: false,
          notifications_on: false,
        }),
      );
    });
  });

  test('toggling schedule to daily re-enables auto_deplete', async () => {
    const updateSpy = jest.spyOn(pantryService, 'updatePetAssignment');
    const { getByText } = render(<EditPantryItemScreen initialFrequency="as_needed" ... />);

    fireEvent.press(getByText('Daily'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          feeding_frequency: 'daily',
          auto_deplete_enabled: true,
        }),
      );
    });
  });
```

Helper-based alternative: extract `buildFrequencyUpdate(freq: FeedingFrequency): Partial<PantryPetAssignment>` as a pure function inside EditPantryItemScreen.tsx and test that directly.

- [ ] **Step 3: Run tests to verify failure**

Run: `npx jest __tests__/screens/EditPantryItemScreen.test.ts -v`
Expected: FAIL — current `handleFrequencyToggle` doesn't write `auto_deplete_enabled`.

- [ ] **Step 4: Implement the wiring**

In `src/screens/EditPantryItemScreen.tsx:203`, replace the current `handleFrequencyToggle`:

```typescript
  const handleFrequencyToggle = useCallback((freq: FeedingFrequency) => {
    chipToggle();
    setFeedingFrequency(freq);
    const isDaily = freq === 'daily';
    const updates: Parameters<typeof updatePetAssignment>[1] = {
      feeding_frequency: freq,
      auto_deplete_enabled: isDaily,
    };
    if (!isDaily) {
      setNotificationsOn(false);
      updates.notifications_on = false;
    }
    saveAssignmentField(updates);
    rescheduleAllFeeding().catch(() => {});
  }, [saveAssignmentField]);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/screens/EditPantryItemScreen.test.ts -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx __tests__/screens/EditPantryItemScreen.test.ts
git commit -m "M9: EditPantryItem schedule toggle — wire auto_deplete_enabled

Toggling to 'Daily' also sets auto_deplete_enabled=true; toggling to
'As needed' also sets auto_deplete_enabled=false + notifications_on=false.
Closes the manual-only editability gap that previously required Custom
Splits for auto_deplete changes.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: EditPantryItemScreen — "Fed This Today" Featured Action Card

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx` (new JSX + state + handlers + styles)
- Test: `__tests__/screens/EditPantryItemScreen.test.ts`

### Steps

- [ ] **Step 1: Write failing visibility tests**

```typescript
  describe('Fed This Today Featured Action Card', () => {
    const renderEdit = (overrides: Partial<{ feedingFrequency, isEmpty, isRecalled, isActive }>) =>
      render(<EditPantryItemScreen {...defaultProps} {...overrides} />);

    test('visible when as_needed + not empty + active + not recalled', () => {
      const { getByText } = renderEdit({
        feedingFrequency: 'as_needed',
        isEmpty: false,
        isRecalled: false,
        isActive: true,
      });
      expect(getByText('Fed This Today')).toBeTruthy();
    });

    test('hidden when feeding_frequency is daily', () => {
      const { queryByText } = renderEdit({
        feedingFrequency: 'daily',
        isEmpty: false,
        isRecalled: false,
        isActive: true,
      });
      expect(queryByText('Fed This Today')).toBeNull();
    });

    test('hidden when item is empty', () => {
      const { queryByText } = renderEdit({
        feedingFrequency: 'as_needed',
        isEmpty: true,
        isRecalled: false,
        isActive: true,
      });
      expect(queryByText('Fed This Today')).toBeNull();
    });

    test('hidden when item is recalled', () => {
      const { queryByText } = renderEdit({
        feedingFrequency: 'as_needed',
        isEmpty: false,
        isRecalled: true,
        isActive: true,
      });
      expect(queryByText('Fed This Today')).toBeNull();
    });

    test('hidden when item is soft-deleted (is_active=false)', () => {
      const { queryByText } = renderEdit({
        feedingFrequency: 'as_needed',
        isEmpty: false,
        isRecalled: false,
        isActive: false,
      });
      expect(queryByText('Fed This Today')).toBeNull();
    });

    test('tapping opens FedThisTodaySheet', () => {
      const { getByText, queryByText } = renderEdit({
        feedingFrequency: 'as_needed',
        isEmpty: false,
        isRecalled: false,
        isActive: true,
      });

      expect(queryByText('Log Feeding')).toBeNull();  // sheet header not visible
      fireEvent.press(getByText('Fed This Today'));
      expect(getByText('Log Feeding')).toBeTruthy();  // sheet now visible
    });
  });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest __tests__/screens/EditPantryItemScreen.test.ts -t "Fed This Today Featured Action Card" -v`
Expected: FAIL — card not rendered.

- [ ] **Step 3: Add state and sheet handler**

In `src/screens/EditPantryItemScreen.tsx`, add near existing modal state (around line 108):

```typescript
  const [logFeedingSheetVisible, setLogFeedingSheetVisible] = useState(false);
```

Import at top:

```typescript
import { FedThisTodaySheet } from '../components/pantry/FedThisTodaySheet';
```

Derive visibility flag (near other derived values around line 130):

```typescript
  const showFedTodayCard =
    feedingFrequency === 'as_needed' &&
    !isEmpty &&
    !isRecalled &&
    (item?.is_active ?? false);
```

- [ ] **Step 4: Render the Featured Action Card**

Insert at the top of the main scroll content (above the Quantity card), with a conditional wrapper:

```typescript
          {showFedTodayCard && (
            <TouchableOpacity
              style={styles.fedTodayCard}
              onPress={() => setLogFeedingSheetVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.fedTodayIconBox}>
                <Ionicons name="restaurant-outline" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.fedTodayTextContainer}>
                <Text style={styles.fedTodayTitle}>Fed This Today</Text>
                <Text style={styles.fedTodaySubtitle}>
                  Log a feeding to deduct inventory
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          )}
```

Render the sheet at the bottom of the screen (near other modals):

```typescript
          <FedThisTodaySheet
            isVisible={logFeedingSheetVisible}
            petId={activePetId}
            pantryItem={item}
            assignment={myAssignment}
            product={product as unknown as Product}
            onDismiss={() => setLogFeedingSheetVisible(false)}
            onSuccess={() => {
              setLogFeedingSheetVisible(false);
              if (activePetId) loadPantry(activePetId);
            }}
          />
```

Add styles (at the end of the existing StyleSheet.create call):

```typescript
  fedTodayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 16,
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  fedTodayIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  fedTodayTextContainer: {
    flex: 1,
  },
  fedTodayTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  fedTodaySubtitle: {
    fontSize: FontSizes.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest __tests__/screens/EditPantryItemScreen.test.ts -t "Fed This Today Featured Action Card" -v`
Expected: 6 tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx __tests__/screens/EditPantryItemScreen.test.ts
git commit -m "M9: EditPantryItem — Fed This Today Featured Action Card

Prominent accent-color CTA at top of screen for as_needed + active +
non-recalled items. Taps open existing FedThisTodaySheet. Closes the
second-entry-point gap for topper / rotational items whose PantryCard
Log feeding button is one screen away.

Card hidden via visibility matrix when item can't be meaningfully
logged (daily frequency, empty, recalled, soft-deleted).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: EditPantryItemScreen — remove redundant Auto-Deplete info row

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx:421-424`

### Steps

- [ ] **Step 1: Locate the row**

Run: `grep -n "Auto-Deplete\|auto_deplete" src/screens/EditPantryItemScreen.tsx`
Expected: Lines around 421 showing a `<View>`/`<Text>` displaying "Enabled"/"Disabled" conditionally on `feedingFrequency !== 'daily'`.

- [ ] **Step 2: Remove the JSX block**

Delete lines 421-424 (the conditional info row for Auto-Deplete status). Also remove any related style keys that become orphaned (typically nothing — the row likely uses shared `infoRow` / `infoValue` styles).

- [ ] **Step 3: Run full EditPantryItemScreen suite for regression**

Run: `npx jest __tests__/screens/EditPantryItemScreen.test.ts -v`
Expected: All tests pass. No test depends on the Auto-Deplete row (it was a read-only display).

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx
git commit -m "M9: EditPantryItem — remove redundant Auto-Deplete info row

The schedule toggle now drives auto_deplete_enabled directly
(Task 5), so the read-only Enabled/Disabled label under as_needed
items just mirrors the toggle state. Removing reduces visual noise
without changing behavior.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Diet completeness copy — `dry_only` + rotational-only + zero-base

**Files:**
- Modify: `src/services/pantryService.ts:766` (`evaluateDietCompleteness`)
- Test: `__tests__/services/pantryService.test.ts`

### Steps

- [ ] **Step 1: Inspect the function**

Run: `grep -n "evaluateDietCompleteness\|function evaluateDiet" src/services/pantryService.ts | head -5`
Expected: Function declaration around line 766.

Run: `sed -n '766,860p' src/services/pantryService.ts`
Expected: Function body showing status tier logic and messaging.

- [ ] **Step 2: Identify the branch to edit**

Find the case in `evaluateDietCompleteness` that handles `dry_only` pet + rotational items present but zero `base` items. Today this likely falls through to the generic "no base food" branch. The copy tweak distinguishes "toppers are extras" from the meaningful absence of a dry main food.

- [ ] **Step 3: Write failing test**

Add to `__tests__/services/pantryService.test.ts`:

```typescript
  describe('evaluateDietCompleteness — dry_only + topper-only', () => {
    test('returns info status with topper-aware message when dry_only pet has only rotational items and no base', async () => {
      // Mock: pet is dry_only, has 1 rotational topper, no base food
      mockPantry([
        { feeding_role: 'rotational', category: 'daily_food', is_supplemental: true },
      ]);
      mockPet({ id: 'pet-1', feeding_style: 'dry_only', name: 'Rex' });

      const result = await evaluateDietCompleteness('pet-1', 'Rex');

      expect(result.status).toBe('info');
      expect(result.message).toContain('Toppers are extras');
      expect(result.message).toContain('Rex');
    });
  });
```

Adapt the mock pattern to match how the existing tests in this file mock Supabase. If there's no existing mock harness, ask to extract the dry_only + rotational-only branch into a pure helper and test that — typically `evaluateDietCompletenessStatus(items: PantrySummary): DietCompletenessResult`.

- [ ] **Step 4: Run test to verify failure**

Run: `npx jest __tests__/services/pantryService.test.ts -t "dry_only \+ topper-only" -v`
Expected: FAIL.

- [ ] **Step 5: Update the copy**

In `evaluateDietCompleteness` (inside `src/services/pantryService.ts`, around line 766), locate the branch that handles `dry_only` pet with only rotational/supplemental items. Update (or add) the case:

```typescript
  // dry_only pet has only rotational items (toppers) but no base food
  if (petFeedingStyle === 'dry_only' && baseCount === 0 && rotationalCount > 0) {
    return {
      status: 'info',
      message: `Toppers are extras — add a dry main food to complete ${petName}'s diet.`,
    };
  }
```

Exact branch location and variable names may differ — adapt to the function's existing structure. The key invariant: the message mentions "Toppers" and "main food" and includes `petName`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest __tests__/services/pantryService.test.ts -t "dry_only \+ topper-only" -v`
Expected: PASS. Run the full `pantryService` suite to confirm no regression on the other completeness branches:

Run: `npx jest __tests__/services/pantryService.test.ts -v`
Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/services/pantryService.ts __tests__/services/pantryService.test.ts
git commit -m "M9: evaluateDietCompleteness — topper-aware copy for dry_only + extras

When a dry_only pet has only rotational topper items and no base dry
food, return info status with a message that names toppers as extras
and points to adding a dry main food. Replaces the generic no-base
fallthrough copy.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Full regression + regression anchors

**Files:** none (verification only)

### Steps

- [ ] **Step 1: Run full Jest suite**

Run: `npx jest --silent 2>&1 | tail -20`
Expected: `Tests: N passed, N total` where N ≥ 1508 + (sum of new tests added across Tasks 2, 3, 4a, 4b, 5, 6, 8). Rough expectation: ≈1530 tests.

- [ ] **Step 2: Verify regression anchors**

Run: `npx jest __tests__/services/scoring/regressionTrace.test.ts -v`
Expected: Pure Balance Grain-Free Salmon (dog) = 61, Temptations Classic Tuna (cat) = 0. Both pass.

- [ ] **Step 3: TypeScript check**

Run: `npx tsc --noEmit --skipLibCheck`
Expected: Passes.

- [ ] **Step 4: Update CURRENT.md test count**

Open `docs/status/CURRENT.md` and update the Numbers block:

```markdown
- **Tests:** <N> passing / <M> suites
- **Decisions:** 129
- **Migrations:** 39 (001–039)
- **Products:** 19,058 (483 vet diets, 1716 supplemental-flagged)
```

Bump migration count from 38 to 39 (migration 039 is net-new).

- [ ] **Step 5: Commit the status update**

```bash
git add docs/status/CURRENT.md
git commit -m "M9: bump test count + migration count after wet-food-extras path

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: On-device smoke test

**Files:** none (manual verification)

### Steps

- [ ] **Step 1: Start the Expo dev server**

Run: `npm start`
Expected: Metro bundler starts on default port.

- [ ] **Step 2: Launch on iOS simulator or device**

Run: `npm run ios` (or scan QR code with Expo Go).
Expected: App launches to HomeScreen.

- [ ] **Step 3: Smoke test the intercept flow**

Manual checklist:

- [ ] Create or switch to a fresh `dry_only` pet with zero pantry items.
- [ ] Scan a wet food product (any non-dry, non-vet-diet, non-supplemental daily food).
- [ ] Tap "Add to Pantry" on ResultScreen.
- [ ] **Verify:** `FeedingIntentSheet` appears with the pet's name in the header.
- [ ] Tap "Just a topper or extra".
- [ ] **Verify:** sheet closes, AddToPantrySheet completes, item added.
- [ ] Navigate to Pantry tab.
- [ ] **Verify:** new pantry card shows "Log feeding" button (green accent).
- [ ] Tap card to open EditPantryItem.
- [ ] **Verify:** "Fed This Today" Featured Action Card renders at top (accent-color background).
- [ ] **Verify:** quantity inputs still visible without scrolling on target device size.
- [ ] Tap "Fed This Today".
- [ ] **Verify:** FedThisTodaySheet opens with stepper.
- [ ] Log a feeding (1 unit).
- [ ] **Verify:** sheet closes, pantry card shows "Fed today" lock badge, Log feeding button disappears.

- [ ] **Step 4: Smoke test persistence**

- [ ] Add a second wet product to the same pet.
- [ ] **Verify:** FeedingIntentSheet does NOT re-fire (`wet_intent_resolved_at` is now set).
- [ ] **Verify:** second item added directly with no intercept.

- [ ] **Step 5: Smoke test toppers**

- [ ] Switch to a different `dry_only` pet.
- [ ] Scan a topper product (`is_supplemental=true`).
- [ ] **Verify:** no intercept fires (toppers skip it).
- [ ] **Verify:** item added as rotational with Log feeding button.

- [ ] **Step 6: Regression — existing `dry_and_wet` flow**

- [ ] Switch to a `dry_and_wet` pet with existing pantry.
- [ ] Scan a wet food product.
- [ ] **Verify:** no intercept fires (pet is not dry_only).
- [ ] **Verify:** item added as rotational (existing behavior).
- [ ] **Verify:** existing base dry food serving size unchanged (wet_reserve_kcal still averaging correctly).

- [ ] **Step 7: Schedule toggle wiring**

- [ ] Open EditPantryItem on a base daily food item.
- [ ] Toggle to "As needed".
- [ ] **Verify:** notifications toggle disables.
- [ ] Close and reopen the item.
- [ ] **Verify:** state persists (feeding_frequency = as_needed, auto_deplete = false).
- [ ] Toggle back to "Daily".
- [ ] **Verify:** auto_deplete re-enables.

---

## Self-review

### Spec coverage

Walking through spec sections:

- Section 1 behavior matrix → covered by Task 4a (routing) + Task 4b (intercept wiring).
- Section 2 FeedingIntentSheet → Task 3 (component) + Task 4b (wiring).
- Section 3a schedule toggle wiring → Task 5.
- Section 3b Featured Action Card → Task 6.
- Section 4a migration → Task 1.
- Section 4b routing refactor → Task 4a + 4b.
- Section 4c computeBehavioralServing → Task 2.
- Section 4d PantryCard (verified no change) → not a task (nothing to do).
- Section 4e diet completeness copy → Task 8.
- Section 4f petService updatePet → verified in Task 4b Step 1 (typically no change needed).
- Section 5 non-goals → no tasks needed.
- Risks (Featured Action Card vertical space) → Task 10 manual check.

All spec requirements have a task. Task 7 (remove Auto-Deplete row) is implementation polish flowing from Section 3a's "Also remove" clause — explicit in the spec.

### Placeholder scan

- No "TBD" / "TODO" markers.
- Step 2 of Task 8 mentions "adapt to the function's existing structure" — this is acceptable because the exact branch structure of `evaluateDietCompleteness` wasn't fully read during planning. The invariant (message content + status='info') is explicit. The executor should read the function and place the branch accordingly.
- Step 2 of Task 4a and Step 2 of Task 5 say "adapt to the file's actual pattern" for test harness. This is because pantry test harnesses vary across files. The executor runs `head` to see the pattern and matches it. Not a placeholder — it's deferring a mechanical alignment, with clear invariants to preserve.

### Type consistency

- `FeedingRole`, `FeedingFrequency`, `Pet`, `Product`, `PantryPetAssignment` — names used consistently across tasks.
- `wet_intent_resolved_at: string | null` in Task 1 matches usage in Task 4b (`pet.wet_intent_resolved_at == null` check).
- `inferAssignmentDefaults` signature in Task 4a matches consumption in Task 4a Step 5.
- `shouldShowFeedingIntentSheet` predicate defined in Task 4b Step 4, consumed in Step 6.

All consistent.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-14-wet-food-extras-path.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because Tasks 4a/4b touch AddToPantrySheet heavily — isolated subagent context prevents accidental scope creep on adjacent code.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Lower ceremony but the session context is already substantial.

Which approach?
