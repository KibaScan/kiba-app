# Pantry Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish PantryScreen, PantryCard, and EditPantryItemScreen per the consolidated Gemini + Grok teardown — role-aware calorie rendering, decimal-clamped serving sizes, clean action hierarchy, honest read-only UI, tab bar hide, and a semantically correct header icon.

**Architecture:** Two new pure helpers (`formatServing` in formatters, `shouldShowCalorieText` in pantryHelpers) drive the conditional rendering. Visual changes are scoped to three screens; no DB, no scoring, no navigation stack changes. Custom Splits entry stays in PantryScreen top-right for this pass (relocation to section header captured as follow-up).

**Tech Stack:** React Native 0.83, TypeScript 5.9 (strict), Expo SDK 55, Jest via jest-expo, existing `Colors` + `SEVERITY_COLORS` + `Spacing` + `FontSizes` tokens, `Ionicons`.

**Spec:** `docs/superpowers/specs/2026-04-12-pantry-polish-design.md` (commit `08dd369`).

---

## File Structure

**New code (pure helpers):**
- `src/utils/formatters.ts` — MODIFY: append `formatServing` export
- `src/utils/pantryHelpers.ts` — MODIFY: append `shouldShowCalorieText` export

**Screens / components touched:**
- `src/components/pantry/PantryCard.tsx` — role-aware calorie, delete Running Low block, decimal formatter, conversational name
- `src/screens/PantryScreen.tsx` — pie-chart icon, Toppers label
- `src/screens/EditPantryItemScreen.tsx` — dim role pill + Edit link, action hierarchy, solid Add-Time pill, hide tab bar, decimal input blur

**Tests:**
- `__tests__/utils/formatters.test.ts` — MODIFY: extend for `formatServing`
- `__tests__/utils/pantryHelpers.test.ts` — MODIFY: extend for `shouldShowCalorieText`

No new test files. Kiba's test convention is pure-helper coverage (no render tests — `@testing-library/react-native` is not installed; see `__tests__/components/pantry/AddToPantrySheet.test.ts:3` comment). Component behavior is enforced via the exported helpers the components consume.

---

## Task 1: Add `formatServing` helper (TDD)

**Files:**
- Modify: `__tests__/utils/formatters.test.ts`
- Modify: `src/utils/formatters.ts`

- [ ] **Step 1: Add failing test block at the bottom of `__tests__/utils/formatters.test.ts`**

First, update the import at the top of the file:

```ts
import {
  toDisplayName,
  stripBrandFromName,
  resolveLifeStageLabel,
  formatRelativeTime,
  getConversationalName,
  formatServing,
} from '../../src/utils/formatters';
```

Then append this describe block at the end of the file:

```ts
// ─── formatServing ────────────────────────────────────────

describe('formatServing', () => {
  test('returns "0" for null', () => {
    expect(formatServing(null)).toBe('0');
  });

  test('returns "0" for undefined', () => {
    expect(formatServing(undefined)).toBe('0');
  });

  test('returns "0" for NaN', () => {
    expect(formatServing(NaN)).toBe('0');
  });

  test('returns "0" for 0', () => {
    expect(formatServing(0)).toBe('0');
  });

  test('drops trailing zero for whole numbers', () => {
    expect(formatServing(1)).toBe('1');
    expect(formatServing(1.0)).toBe('1');
    expect(formatServing(4)).toBe('4');
  });

  test('clamps to 1 decimal place', () => {
    expect(formatServing(6.4485)).toBe('6.4');
    expect(formatServing(6.449999)).toBe('6.4');
    expect(formatServing(6.45)).toBe('6.5');
  });

  test('rounds 0.04 down to 0', () => {
    expect(formatServing(0.04)).toBe('0');
  });

  test('rounds 0.05 up to 0.1', () => {
    expect(formatServing(0.05)).toBe('0.1');
  });

  test('preserves negative values (caller responsible for validation)', () => {
    expect(formatServing(-1)).toBe('-1');
    expect(formatServing(-1.5)).toBe('-1.5');
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```bash
npx jest __tests__/utils/formatters.test.ts -t "formatServing"
```

Expected: FAIL. Error mentions `formatServing is not exported` or similar TypeScript error.

- [ ] **Step 3: Append the implementation to `src/utils/formatters.ts`**

Add at the end of the file, after the existing exports:

```ts
/**
 * Clamp a serving/cup value to 1 decimal place for display.
 * Returns '0' for null/undefined/NaN/0. Trailing zeros are not rendered
 * (so 1.0 prints as '1'). Negative values are preserved — caller is
 * responsible for semantic validation.
 */
export function formatServing(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0';
  return String(Math.round(value * 10) / 10);
}
```

- [ ] **Step 4: Run test and verify it passes**

```bash
npx jest __tests__/utils/formatters.test.ts -t "formatServing"
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/formatters.ts __tests__/utils/formatters.test.ts
git commit -m "M9: formatServing helper for 1-decimal cup/serving display

Source of the 6.4485-cups display bug. Clamps to 1 decimal, drops
trailing zeros, returns '0' for null/undefined/NaN. 9 unit tests."
```

---

## Task 2: Add `shouldShowCalorieText` helper (TDD)

**Files:**
- Modify: `__tests__/utils/pantryHelpers.test.ts`
- Modify: `src/utils/pantryHelpers.ts`

- [ ] **Step 1: Add failing test block at the bottom of `__tests__/utils/pantryHelpers.test.ts`**

First, check the existing imports at the top of the file and add `shouldShowCalorieText` to the import list from `pantryHelpers`. If the imports currently look like:

```ts
import { computeAutoServingSize, computePetDer, ... } from '../../src/utils/pantryHelpers';
```

extend to:

```ts
import {
  computeAutoServingSize,
  computePetDer,
  shouldShowCalorieText,
  // (keep the rest of the existing imports here)
} from '../../src/utils/pantryHelpers';
```

(Match the existing style — wrap or keep inline as the file already does.)

Then append this describe block at the end of the file:

```ts
// ─── shouldShowCalorieText ────────────────────────────────

describe('shouldShowCalorieText', () => {
  test('shows for base role with positive share', () => {
    expect(shouldShowCalorieText('base', 15)).toBe(true);
    expect(shouldShowCalorieText('base', 100)).toBe(true);
    expect(shouldShowCalorieText('base', 0.5)).toBe(true);
  });

  test('suppresses for base role with zero share (ghost-text case)', () => {
    expect(shouldShowCalorieText('base', 0)).toBe(false);
  });

  test('suppresses for base role with null/undefined share', () => {
    expect(shouldShowCalorieText('base', null)).toBe(false);
    expect(shouldShowCalorieText('base', undefined)).toBe(false);
  });

  test('suppresses for base role with negative share', () => {
    expect(shouldShowCalorieText('base', -1)).toBe(false);
  });

  test('suppresses for rotational role regardless of share', () => {
    expect(shouldShowCalorieText('rotational', 0)).toBe(false);
    expect(shouldShowCalorieText('rotational', 15)).toBe(false);
    expect(shouldShowCalorieText('rotational', null)).toBe(false);
  });

  test('suppresses for null role (legacy/treat/supplement data)', () => {
    expect(shouldShowCalorieText(null, 15)).toBe(false);
    expect(shouldShowCalorieText(null, null)).toBe(false);
  });

  test('suppresses for undefined role', () => {
    expect(shouldShowCalorieText(undefined, 15)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test and verify it fails**

```bash
npx jest __tests__/utils/pantryHelpers.test.ts -t "shouldShowCalorieText"
```

Expected: FAIL. Error mentions `shouldShowCalorieText is not exported`.

- [ ] **Step 3: Append the implementation to `src/utils/pantryHelpers.ts`**

First, make sure `FeedingRole` is imported at the top of the file. Check for an existing `import type { ... } from '../types/pantry';` line and add `FeedingRole` if not present. If no such import exists, add:

```ts
import type { FeedingRole } from '../types/pantry';
```

Then add this export at the end of the file:

```ts
/**
 * Decides whether PantryCard should render calorie-context text for an item.
 *
 * Rules:
 *   - Only base-role items show calorie text (rotational contributes via Wet Reserve).
 *   - Base items with 0 / null / negative share are ambiguous (data gap or
 *     unsaved); suppress to avoid the "0% of daily target (~0 kcal)" ghost text.
 *   - Null/undefined role (legacy data, treats, supplements) always suppress.
 */
export function shouldShowCalorieText(
  feedingRole: FeedingRole | undefined,
  allocationPct: number | null | undefined,
): boolean {
  if (feedingRole !== 'base') return false;
  if (allocationPct == null || allocationPct <= 0) return false;
  return true;
}
```

- [ ] **Step 4: Run test and verify it passes**

```bash
npx jest __tests__/utils/pantryHelpers.test.ts -t "shouldShowCalorieText"
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/pantryHelpers.ts __tests__/utils/pantryHelpers.test.ts
git commit -m "M9: shouldShowCalorieText helper for role-aware rendering

Suppresses calorie text on rotational foods (handled via Wet Reserve)
and on base foods with 0/null share (ghost-text bug). 7 unit tests."
```

---

## Task 3: Role-aware calorie + formatServing + conversational name in PantryCard

**Files:**
- Modify: `src/components/pantry/PantryCard.tsx`

- [ ] **Step 1: Update imports in `PantryCard.tsx`**

At the top of the file, find the existing imports. Add `formatServing` and `getConversationalName`, and add the new helper import. Replace the existing `stripBrandFromName` import line (line ~25):

```tsx
import { stripBrandFromName } from '../../utils/formatters';
```

with:

```tsx
import { formatServing, getConversationalName } from '../../utils/formatters';
import { shouldShowCalorieText } from '../../utils/pantryHelpers';
```

- [ ] **Step 2: Swap to `getConversationalName` at the displayName line**

Find (around line 118):

```tsx
const displayName = stripBrandFromName(product.brand, product.name);
```

Replace with:

```tsx
const displayName = getConversationalName({ brand: product.brand, name: product.name });
```

- [ ] **Step 3: Apply `formatServing` in `feedingSummary`**

Find (around line 131-136):

```tsx
  // Feeding summary
  let feedingSummary: string;
  if (!myAssignment || myAssignment.feeding_frequency === 'as_needed') {
    feedingSummary = 'As needed';
  } else {
    const unit = myAssignment.serving_size_unit === 'units'
      ? (product.ga_kcal_per_cup != null && product.ga_kcal_per_cup > 0 ? 'cups' : (item.unit_label ?? 'units'))
      : myAssignment.serving_size_unit;
    feedingSummary = `${myAssignment.feedings_per_day}x daily \u00B7 ${myAssignment.serving_size} ${unit}`;
  }
```

Replace the `feedingSummary = ...` template-literal line with:

```tsx
    feedingSummary = `${myAssignment.feedings_per_day}x daily \u00B7 ${formatServing(myAssignment.serving_size)} ${unit}`;
```

(Only the template-literal line changes. Keep the surrounding `if/else` structure.)

- [ ] **Step 4: Make calorie text role-aware**

Find (around line 299-307):

```tsx
        {/* Calorie context */}
        {!isTreat && item.calorie_context && (
          <Text style={styles.calorieText}>
            {item.calorie_context.allocation_pct != null
              ? `${item.calorie_context.allocation_pct}% of daily target (~${item.calorie_context.daily_kcal} kcal)`
              : `~${item.calorie_context.daily_kcal} kcal/day of ${item.calorie_context.target_kcal} kcal target`}
          </Text>
        )}
```

Replace with:

```tsx
        {/* Calorie context — role-aware per 2026-04-12 polish spec.
            Rotational items contribute via Wet Reserve (suppress).
            Base items with 0/null share are ambiguous (suppress). */}
        {!isTreat && item.calorie_context && shouldShowCalorieText(myAssignment?.feeding_role, item.calorie_context.allocation_pct) && (
          <Text style={styles.calorieText}>
            {`${item.calorie_context.allocation_pct}% of daily target (~${item.calorie_context.daily_kcal} kcal)`}
          </Text>
        )}
```

(Note: the `allocation_pct != null` ternary fallback is removed because `shouldShowCalorieText` already rejects null/0/negative — so the fallback branch is unreachable. Keeping the single positive-branch string keeps the JSX tight.)

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors in `src/components/pantry/PantryCard.tsx`. Pre-existing errors in `docs/plans/search-uiux/*` and `supabase/functions/batch-score/scoring/*` may still appear — those are known per CURRENT.md and are out of scope.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass. No regressions.

- [ ] **Step 7: Commit**

```bash
git add src/components/pantry/PantryCard.tsx
git commit -m "M9: PantryCard role-aware calorie + formatServing + conversational name

- Rotational items no longer render '0% of daily target' (Wet Reserve
  handles their math).
- Base items with 0/null share also suppressed (ghost-text bug).
- serving_size clamped to 1 decimal via formatServing (6.4485 → 6.4).
- displayName uses getConversationalName for tighter names; brand row
  preserves identity."
```

---

## Task 4: Delete Running Low block from PantryCard

**Files:**
- Modify: `src/components/pantry/PantryCard.tsx`

- [ ] **Step 1: Remove the `alertLowStock` JSX**

Find (around line 236-242):

```tsx
        {item.is_low_stock && !item.is_empty && !isTreat && (
          <View style={styles.alertLowStock}>
            <Text style={styles.alertLowStockText}>
              Running low{item.days_remaining != null ? ` — ~${Math.ceil(item.days_remaining)} days remaining` : ''}
            </Text>
          </View>
        )}
```

Delete this entire block. The top-right `remainingText` at line 201-210 already amber-tints via `SEVERITY_COLORS.caution` from `getRemainingText`, and the depletion bar at line 215-227 already ramps via `getDepletionBarColor`. The brown block is redundant.

- [ ] **Step 2: Remove the unused style keys**

Find in the StyleSheet (around line 591-601):

```tsx
  alertLowStock: {
    backgroundColor: `${SEVERITY_COLORS.caution}1F`,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertLowStockText: {
    fontSize: FontSizes.xs,
    color: Colors.severityAmber,
    fontWeight: '500',
  },
```

Delete both keys.

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/pantry/PantryCard.tsx
git commit -m "M9: delete redundant Running Low block from PantryCard

Top-right '~N days' already amber-tints via SEVERITY_COLORS.caution;
depletion bar already ramps. Brown block repeated the signal a third
time. Removes alertLowStock + alertLowStockText style keys."
```

---

## Task 5: PantryScreen — pie-chart icon + Toppers rename

**Files:**
- Modify: `src/screens/PantryScreen.tsx`

- [ ] **Step 1: Swap the header icon**

Find (around line 375):

```tsx
              <Ionicons name="options-outline" size={22} color={Colors.accent} />
```

Replace with:

```tsx
              <Ionicons name="pie-chart-outline" size={22} color={Colors.accent} />
```

- [ ] **Step 2: Rename the filter chip label**

Find (around line 110-116) the `FILTER_CHIPS` array. Replace this entry:

```tsx
  { key: 'supplemental', label: 'Supplemental' },
```

with:

```tsx
  { key: 'supplemental', label: 'Toppers' },
```

- [ ] **Step 3: Rename the filter empty-state label**

Find (around line 136-139) the `FILTER_LABEL_MAP`:

```tsx
const FILTER_LABEL_MAP: Record<FilterChip, string> = {
  all: '', dry: 'dry food', wet: 'wet food', treats: 'treat',
  supplemental: 'supplemental', recalled: 'recalled', running_low: 'low stock',
};
```

Change `supplemental: 'supplemental'` to `supplemental: 'topper'` (singular, matching the existing `treat` / `dry food` pattern):

```tsx
const FILTER_LABEL_MAP: Record<FilterChip, string> = {
  all: '', dry: 'dry food', wet: 'wet food', treats: 'treat',
  supplemental: 'topper', recalled: 'recalled', running_low: 'low stock',
};
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/PantryScreen.tsx
git commit -m "M9: PantryScreen pie-chart icon + Toppers rename

- options-outline → pie-chart-outline for the Custom Splits entry
  (sliders read as 'Filter' on iOS).
- 'Supplemental' filter chip → 'Toppers' to match HomeScreen's
  'Toppers & Mixers' convention and avoid D-096 collision.
- Empty-state copy follows existing singular pattern:
  'No topper items in pantry'.

Filter key stays 'supplemental' (still maps to is_supplemental column;
no DB changes)."
```

---

## Task 6: EditPantryItem — dim role pill + Edit in Custom Splits link

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx`

- [ ] **Step 1: Replace the Feeding Configuration card body**

Find (around line 375-403):

```tsx
          {/* ── Feeding Details ── */}
          <View style={[styles.card, { opacity: feedingOpacity }]} pointerEvents={feedingDisabled ? 'none' : 'auto'}>
            <Text style={styles.cardTitle}>Feeding Configuration</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {myAssignment.feeding_role === 'base' ? 'Base Diet' : myAssignment.feeding_role === 'rotational' ? 'Rotational Food' : 'Treat / Supplement'}
                </Text>
              </View>
            </View>

            {myAssignment.feeding_role === 'base' && myAssignment.calorie_share_pct != null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Calorie Share</Text>
                <Text style={styles.infoValue}>{myAssignment.calorie_share_pct}%</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Auto-Deplete</Text>
              <Text style={styles.infoValue}>{myAssignment.auto_deplete_enabled ? 'Enabled' : 'Disabled'}</Text>
            </View>
            
            <Text style={styles.infoSubtext}>
               To update roles and behavioral settings, remove this item and add it again.
            </Text>
          </View>
```

Replace with:

```tsx
          {/* ── Feeding Details ── */}
          <View style={[styles.card, { opacity: feedingOpacity }]} pointerEvents={feedingDisabled ? 'none' : 'auto'}>
            <Text style={styles.cardTitle}>Feeding Configuration</Text>
            
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>
                  {myAssignment.feeding_role === 'base' ? 'Base Diet' : myAssignment.feeding_role === 'rotational' ? 'Rotational Food' : 'Treat / Supplement'}
                </Text>
              </View>
            </View>

            {myAssignment.feeding_role === 'base' && myAssignment.calorie_share_pct != null && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Calorie Share</Text>
                <Text style={styles.infoValue}>{myAssignment.calorie_share_pct}%</Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Auto-Deplete</Text>
              <Text style={styles.infoValue}>{myAssignment.auto_deplete_enabled ? 'Enabled' : 'Disabled'}</Text>
            </View>

            <TouchableOpacity
              style={styles.editSplitsLink}
              onPress={() => navigation.navigate('CustomFeedingStyle', { petId: activePetId! })}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Edit splits in Custom Splits screen"
            >
              <Text style={styles.editSplitsText}>Edit in Custom Splits</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
            </TouchableOpacity>
          </View>
```

(Two renames: `styles.badge` → `styles.rolePill`, `styles.badgeText` → `styles.rolePillText`. New `styles.editSplitsLink` + `styles.editSplitsText`. `infoSubtext` usage removed — the style key can stay for now; it may be used elsewhere.)

- [ ] **Step 2: Replace the old `badge` / `badgeText` styles with dimmed `rolePill` + add the link styles**

Find in the StyleSheet (around line 715-725):

```tsx
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: `${Colors.accent}1A`,
  },
  badgeText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
```

Replace with:

```tsx
  // Dimmed role pill — read-only indicator, not a tappable chip.
  // Editing lives in Custom Splits; linked via editSplitsLink below.
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.chipSurface,
  },
  rolePillText: {
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  editSplitsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  editSplitsText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. (If `infoSubtext` is now unused, TypeScript won't flag it — StyleSheet keys don't produce unused-import warnings.)

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx
git commit -m "M9: dim role pill + Edit in Custom Splits link on EditPantryItem

Kills the 'remove this item and add it again' delete-to-edit trap.
Role pill now reads as a static chipSurface/textTertiary label (not a
clickable chip). 'Edit in Custom Splits →' link navigates to the
existing editor. Single source of truth for splits remains
CustomFeedingStyle."
```

---

## Task 7: EditPantryItem — action hierarchy (Restock / Share / Remove)

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx`

- [ ] **Step 1: Rewrite the actions block**

Find (around line 493-537):

```tsx
          {/* ── Actions ── */}
          <View style={styles.actions}>
            {!isRecalled && (
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  isEmpty ? styles.actionBtnPrimary : styles.actionBtnOutline,
                ]}
                onPress={handleRestock}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color={isEmpty ? '#FFFFFF' : Colors.accent}
                />
                <Text style={[
                  styles.actionBtnText,
                  isEmpty ? styles.actionBtnTextPrimary : styles.actionBtnTextOutline,
                ]}>
                  Restock
                </Text>
              </TouchableOpacity>
            )}

            {!isRecalled && (
              <TouchableOpacity
                style={styles.actionBtnOutline}
                onPress={() => setShareSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={18} color={Colors.accent} />
                <Text style={styles.actionBtnTextOutline}>Share with other pets</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionBtnDanger}
              onPress={handleRemovePress}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={18} color={SEVERITY_COLORS.danger} />
              <Text style={styles.actionBtnTextDanger}>Remove from Pantry</Text>
            </TouchableOpacity>
          </View>
```

Replace with:

```tsx
          {/* ── Actions ──
              Adaptive hierarchy per 2026-04-12 polish spec:
              - Restock: primary cyan fill when empty/low, chipSurface secondary otherwise.
              - Share: always chipSurface secondary.
              - Remove: red text-link (no background, no border). */}
          <View style={styles.actions}>
            {!isRecalled && (() => {
              const restockIsPrimary = isEmpty || item.is_low_stock;
              return (
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    restockIsPrimary ? styles.actionBtnPrimary : styles.actionBtnSecondary,
                  ]}
                  onPress={handleRestock}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="refresh-outline"
                    size={18}
                    color={restockIsPrimary ? '#FFFFFF' : Colors.accent}
                  />
                  <Text style={[
                    styles.actionBtnText,
                    restockIsPrimary ? styles.actionBtnTextPrimary : styles.actionBtnTextSecondary,
                  ]}>
                    Restock
                  </Text>
                </TouchableOpacity>
              );
            })()}

            {!isRecalled && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={() => setShareSheetVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={18} color={Colors.accent} />
                <Text style={[styles.actionBtnText, styles.actionBtnTextSecondary]}>
                  Share with other pets
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.actionBtnLink}
              onPress={handleRemovePress}
              activeOpacity={0.7}
            >
              <Ionicons name="trash-outline" size={16} color={SEVERITY_COLORS.danger} />
              <Text style={styles.actionBtnTextLink}>Remove from Pantry</Text>
            </TouchableOpacity>
          </View>
```

- [ ] **Step 2: Update the StyleSheet — swap outline/danger styles for secondary/link styles**

Find (around line 936-983):

```tsx
  // Actions
  actions: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.accent,
  },
  actionBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  actionBtnDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: SEVERITY_COLORS.danger,
  },
  actionBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
  },
  actionBtnTextOutline: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  actionBtnTextDanger: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
  },
```

Replace with:

```tsx
  // Actions — adaptive hierarchy (2026-04-12 polish spec)
  actions: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnPrimary: {
    backgroundColor: Colors.accent,
  },
  actionBtnSecondary: {
    backgroundColor: Colors.chipSurface,
  },
  actionBtnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
  },
  actionBtnText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  actionBtnTextPrimary: {
    color: '#FFFFFF',
  },
  actionBtnTextSecondary: {
    color: Colors.accent,
  },
  actionBtnTextLink: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
    textAlign: 'center',
  },
```

(Keys removed: `actionBtnOutline`, `actionBtnTextOutline`, `actionBtnDanger`, `actionBtnTextDanger`. Keys added: `actionBtnSecondary`, `actionBtnLink`, `actionBtnTextSecondary`, `actionBtnTextLink`.)

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. Any references to the removed style keys (`actionBtnOutline`, `actionBtnDanger`, `actionBtnTextOutline`, `actionBtnTextDanger`) would surface here — if TypeScript flags any, they're in the same file we just edited and should already have been replaced in Step 1.

- [ ] **Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx
git commit -m "M9: adaptive action hierarchy on EditPantryItem

- Restock: primary cyan fill when empty or low stock, chipSurface
  secondary with cyan text otherwise.
- Share: always chipSurface secondary.
- Remove: red text-link (no background, no border) centered at the
  bottom.

Drops actionBtnOutline/actionBtnDanger in favor of
actionBtnSecondary/actionBtnLink. Keeps the recalled-item gating
(both Restock and Share hidden when recalled)."
```

---

## Task 8: EditPantryItem — solid Add-Time pill

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx`

- [ ] **Step 1: Remove the dashed border, add chipSurface fill**

Find the `addTimeBtn` style (around line 882-896):

```tsx
  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderStyle: 'dashed',
  },
  addTimeText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
  },
```

Replace with:

```tsx
  addTimeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.chipSurface,
  },
  addTimeText: {
    fontSize: FontSizes.sm,
    color: Colors.accent,
    fontWeight: '600',
  },
```

(Removed: `borderWidth`, `borderColor`, `borderStyle`. Added: `backgroundColor`, `fontWeight` on the text to match other accent-colored CTAs.)

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx
git commit -m "M9: solid Add-Time pill (chipSurface fill, drop dashed border)

Dashed borders read as 'drop target' on iOS. Matches other accent
text + chipSurface CTAs in the app."
```

---

## Task 9: EditPantryItem — hide tab bar

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx`

- [ ] **Step 1: Add the tab-hide useEffect**

Find the block of hooks in the component body (right after the local state declarations, around line 114-120 — after `setPickerTime` and before `const product = item?.product ?? null;`). Add this `useEffect`:

```tsx
  // Hide global tab bar on this screen (matches CustomFeedingStyle + CompareScreen).
  useEffect(() => {
    const parent = (navigation as any).getParent?.();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => { parent?.setOptions({ tabBarStyle: undefined }); };
  }, [navigation]);
```

Verify `useEffect` is already in the React import block at the top of the file. Current import (line ~6):

```tsx
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
```

`useEffect` is already there — no import change needed.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors. The `(navigation as any).getParent?.()` cast is the established pattern per `CustomFeedingStyleScreen:70-71`.

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx
git commit -m "M9: hide global tab bar on EditPantryItemScreen

Matches CustomFeedingStyle + CompareScreen pattern. Returns more
vertical space to the settings cards on the edit screen."
```

---

## Task 10: EditPantryItem — decimal-format quantity inputs

**Files:**
- Modify: `src/screens/EditPantryItemScreen.tsx`

- [ ] **Step 1: Import `formatServing`**

Find the formatters import block. If there's already an import from `'../utils/formatters'`, extend it. If not, find:

```tsx
import { stripBrandFromName } from '../utils/formatters';
```

(around line 42) and extend to:

```tsx
import { stripBrandFromName, formatServing } from '../utils/formatters';
```

- [ ] **Step 2: Update `handleQtyRemainingBlur`**

Find (around line 170-173):

```tsx
  const handleQtyRemainingBlur = useCallback(() => {
    const val = parseFloat(qtyRemaining);
    if (!isNaN(val) && val >= 0) saveItemField('quantity_remaining', val);
  }, [qtyRemaining, saveItemField]);
```

Replace with:

```tsx
  const handleQtyRemainingBlur = useCallback(() => {
    const val = parseFloat(qtyRemaining);
    if (!isNaN(val) && val >= 0) {
      const clamped = Math.round(val * 10) / 10;
      setQtyRemaining(formatServing(clamped));
      saveItemField('quantity_remaining', clamped);
    }
  }, [qtyRemaining, saveItemField]);
```

- [ ] **Step 3: Update `handleQtyOriginalBlur`**

Find (around line 175-178):

```tsx
  const handleQtyOriginalBlur = useCallback(() => {
    const val = parseFloat(qtyOriginal);
    if (!isNaN(val) && val > 0) saveItemField('quantity_original', val);
  }, [qtyOriginal, saveItemField]);
```

Replace with:

```tsx
  const handleQtyOriginalBlur = useCallback(() => {
    const val = parseFloat(qtyOriginal);
    if (!isNaN(val) && val > 0) {
      const clamped = Math.round(val * 10) / 10;
      setQtyOriginal(formatServing(clamped));
      saveItemField('quantity_original', clamped);
    }
  }, [qtyOriginal, saveItemField]);
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/screens/EditPantryItemScreen.tsx
git commit -m "M9: clamp EditPantryItem quantity inputs to 1 decimal on blur

On blur, both quantity_remaining and quantity_original round to 1
decimal place in both the persisted value AND the displayed state.
6.4485 → 6.4 in the input field."
```

---

## Task 11: Full suite + regression anchors

**Files:**
- No new changes. Verification only.

- [ ] **Step 1: Run the full test suite**

```bash
npm test
```

Expected:
- All suites pass.
- Test count is **1457 + 9 (formatServing) + 7 (shouldShowCalorieText) = 1473**. If higher, that's fine — other tests may have been added. If lower, investigate.
- 63 suites (or 64+ if any new suites crept in).

- [ ] **Step 2: Verify regression anchors**

Scan the test output for the anchor assertions. They're in the scoring test suites:

```bash
npm test -- --testPathPattern='scoring'
```

Expected (in output):
- Pure Balance (Dog, daily food) = **61**
- Temptations (Cat, treat) = **0**
- Pure Balance + cardiac dog = **0**
- Pure Balance + pancreatitis dog = **53**

If any of these drift, stop and debug — no scoring changes were intended by this plan.

- [ ] **Step 3: Confirm git log is clean and sequential**

```bash
git log --oneline -12
```

Expected: 10 commits on top of `08dd369` (spec commit), one per task:
- M9: clamp EditPantryItem quantity inputs to 1 decimal on blur
- M9: hide global tab bar on EditPantryItemScreen
- M9: solid Add-Time pill (chipSurface fill, drop dashed border)
- M9: adaptive action hierarchy on EditPantryItem
- M9: dim role pill + Edit in Custom Splits link on EditPantryItem
- M9: PantryScreen pie-chart icon + Toppers rename
- M9: delete redundant Running Low block from PantryCard
- M9: PantryCard role-aware calorie + formatServing + conversational name
- M9: shouldShowCalorieText helper for role-aware rendering
- M9: formatServing helper for 1-decimal cup/serving display
- M9: pantry polish design spec

(No commit needed for this task unless verification surfaces a fix.)

- [ ] **Step 4: On-device QA handoff**

The following checks require the simulator / device and are noted for the human QA pass — they are NOT part of this automated plan:

- Pantry with mixed base + rotational + treat + low-stock + empty items — calorie text visibility matches role-aware rule.
- Header pie-chart icon only visible when `activePet.feeding_style === 'custom'`.
- Tap into EditPantryItem → tab bar hides; Restock switches secondary↔primary as empty/low status changes; Share reads as secondary; Remove reads as red text link.
- "Edit in Custom Splits →" link navigates correctly and returns cleanly.
- "Toppers" chip fits on one line at 375pt-width devices; empty-state reads "No topper items in pantry".
- Add-Time pill reads as solid chipSurface (not dashed).
- Quantity input snaps from `6.4485` to `6.4` after blur.

---

## Self-Review Checklist

**Spec coverage** — every numbered section of the spec has a task:

| Spec section | Task(s) |
|---|---|
| 1.1 Role-aware calorie text | Task 2 (helper) + Task 3 Step 4 (application) |
| 1.2 Delete Running Low block | Task 4 |
| 1.3 Decimal formatter in feedingSummary | Task 1 (helper) + Task 3 Step 3 (application) |
| 1.4 Conversational product name | Task 3 Step 2 |
| 2.1 Header icon swap | Task 5 Step 1 |
| 2.2 Filter chip rename | Task 5 Steps 2 + 3 |
| 3.1 Dim role pill + Edit link | Task 6 |
| 3.2 Action hierarchy | Task 7 |
| 3.3 Solid Add-Time pill | Task 8 |
| 3.4 Hide tab bar | Task 9 |
| 3.5 Decimal-format quantity inputs | Task 10 (uses Task 1 helper) |
| 4 CustomFeedingStyle (no change) | N/A — spec is explicit |
| 5.1 `formatServing` helper | Task 1 |
| 5.2 No new color tokens | N/A — enforced by not adding any |
| 6 Testing | Tasks 1 + 2 (unit); Task 11 (regression); Step 4 (on-device) |
| Out of scope | All non-listed items untouched |

**No placeholders** — every code step has concrete code. No "TBD" / "add appropriate error handling" / "similar to Task N" references. Verified by reading each task end-to-end.

**Type consistency** — names used consistently across tasks:
- `formatServing` (formatters) → used in Task 3 and Task 10.
- `shouldShowCalorieText` (pantryHelpers) → used in Task 3.
- `FeedingRole` type imported in Task 2 implementation.
- `styles.actionBtnSecondary`, `styles.actionBtnTextSecondary`, `styles.actionBtnLink`, `styles.actionBtnTextLink` — defined and referenced only in Task 7.
- `styles.rolePill` / `styles.rolePillText` / `styles.editSplitsLink` / `styles.editSplitsText` — defined and referenced only in Task 6.
- `styles.actionBtnOutline` / `actionBtnDanger` / `actionBtnTextOutline` / `actionBtnTextDanger` — both removed AND dereferenced in Task 7. The step also warns the typecheck is what will catch any dangling reference.

No inconsistencies found.
