# Pantry Polish Design — M9

**Date:** 2026-04-12
**Milestone:** M9 (UI Polish & Search)
**Scope:** `PantryScreen`, `PantryCard`, `EditPantryItemScreen`. `CustomFeedingStyleScreen` is reviewed and left unchanged.
**Status:** Approved — ready for implementation plan.

## Context

Gemini and Grok reviewed current screenshots of the Pantry tab and Custom Splits screen and produced a consolidated execution list. This spec is the validated, de-duplicated subset after verification against the codebase. Several feedback items were dropped or corrected based on reading the actual source:

- **Product titles already cap at `numberOfLines={2}`** on PantryCard (`:174`). Fix is name-shortening via `getConversationalName`, not a line-count enforcement.
- **"Log feeding" / "Gave a treat" / "Reorder" buttons are already tinted pills**, not hollow borders. No change needed.
- **Custom Splits already allows Base/Rotational role editing** via `toggleRole` at `CustomFeedingStyle:260-275`. The "delete-to-edit" trap is specifically in EditPantryItemScreen, not Custom Splits.
- **"Secondary fill `#1C1C1E`" proposed by Gemini is the pre-session-20 `cardSurface` hex.** Current `cardSurface` is `#242424`; using `#1C1C1E` inverts the tone. We use the existing `chipSurface` token (`rgba(255,255,255,0.08)`) instead.
- **The "floating 100%/0% of daily target" text is not a rogue un-wrapped node.** It is `calorieText` in `PantryCard.tsx:301-306` rendering for items whose `calorie_share_pct` equals 0 or null. Suppressed via role-aware rendering (1.1 below).

The real constraining decisions taken in brainstorming:

- **Q1 (Role editability in EditPantryItem) → Option B** — read-only but honest: dim the role pill + add a tappable "Edit in Custom Splits →" link. Keeps Custom Splits as the single source of truth for splits.
- **Q2 (Calorie text placement) → Option D** — role-aware rendering: show `X% of daily target` only on base items with meaningful share, suppress on rotational and on base items with share ≤ 0.
- **Q3 (Running Low block) → Option A** — delete it entirely. Top-right "~N days" text already amber-tints; depletion bar color already ramps.
- **Q4 (Action hierarchy) → Option B** — adaptive Restock (primary cyan when empty/low, secondary `chipSurface` otherwise), Share always secondary, Remove red text link.
- **Q5 (Header icon) → Option A** — `pie-chart-outline` replaces `options-outline`. Option D (move out of header to section link) is captured as follow-up.
- **Q6 (Supplemental rename) → Option A** — `Toppers`, not `Supplements`, to match HomeScreen's "Toppers & Mixers" convention and avoid D-096 collision.

## Non-goals

- No DB or migration changes.
- No scoring changes (regression anchors unchanged: Pure Balance = 61, Temptations = 0).
- No changes to `AddToPantrySheet`, `SharePantrySheet`, Safe Switch flows.
- No rename of the `supplemental` filter key (`FilterChip` string literal stays `'supplemental'` — only the label text changes).
- No changes to "Log feeding" / "Gave a treat" / "Reorder on Chewy" / "Replace this food" buttons on PantryCard.
- No new color tokens.

## Design

### Section 1 — PantryCard (`src/components/pantry/PantryCard.tsx`)

**1.1 Role-aware calorie text** — replace the unconditional render at `:300-306` with conditional logic:

- If `feeding_role === 'base'` AND `allocation_pct != null` AND `allocation_pct > 0` → render `"X% of daily target (~Y kcal)"`.
- If `feeding_role === 'rotational'` → suppress. Wet Reserve handles the math; showing `0%` here is misleading.
- If `feeding_role === 'base'` AND `allocation_pct` is 0 or null → suppress. This closes the ghost-text bug (Gemini's "un-wrapped node" under the BASE DIET header).
- Treats → unchanged (treats don't render calorie text today; leave as-is).

`myAssignment.feeding_role` is already in scope via the existing `myAssignment` lookup at `:112-113`.

**1.2 Delete the Running Low block** — remove the `alertLowStock` `<View>` and the corresponding condition at `:236-242`. The top-right "~N days" text already amber-tints via `SEVERITY_COLORS.caution` in `getRemainingText`. The depletion bar already ramps green → amber → red via `getDepletionBarColor`. The brown block is redundant signal. Style keys `alertLowStock` and `alertLowStockText` can be removed from the StyleSheet.

**1.3 Decimal formatter in feedingSummary** — at `:135` change:
```tsx
feedingSummary = `${myAssignment.feedings_per_day}x daily \u00B7 ${myAssignment.serving_size} ${unit}`;
```
to:
```tsx
feedingSummary = `${myAssignment.feedings_per_day}x daily \u00B7 ${formatServing(myAssignment.serving_size)} ${unit}`;
```
Example: `6.4485 cups` → `6.4 cups`. `formatServing` is defined in Section 5.

**1.4 Conversational product name** — at `:118` change:
```tsx
const displayName = stripBrandFromName(product.brand, product.name);
```
to:
```tsx
const displayName = getConversationalName({ brand: product.brand, name: product.name });
```
Safety: `numberOfLines={2}` stays on the `productName` Text. Trade-off: users relying on full-name recognition may initially see a shorter reference, but the `brand` row above it preserves identity.

### Section 2 — PantryScreen (`src/screens/PantryScreen.tsx`)

**2.1 Header icon swap** — at `:375` change:
```tsx
<Ionicons name="options-outline" size={22} color={Colors.accent} />
```
to:
```tsx
<Ionicons name="pie-chart-outline" size={22} color={Colors.accent} />
```
Tap behavior (navigate to `CustomFeedingStyle`) is unchanged.

**2.2 Filter chip rename** — at `:115`:
```tsx
{ key: 'supplemental', label: 'Supplemental' },
```
becomes:
```tsx
{ key: 'supplemental', label: 'Toppers' },
```

And at `:138` in `FILTER_LABEL_MAP`:
```tsx
supplemental: 'supplemental',
```
becomes:
```tsx
supplemental: 'topper',
```
Singular to match the existing pattern (`treat`, `dry food`) used in the empty-state copy `"No {label} items in pantry"`. Result: `"No topper items in pantry"`. No string-literal changes to the `FilterChip` union; the key stays `'supplemental'` and still maps to `is_supplemental`.

### Section 3 — EditPantryItemScreen (`src/screens/EditPantryItemScreen.tsx`)

**3.1 Role pill — dim + link to Custom Splits** — rewrite the "Feeding Configuration" card body at `:376-403`:

- Role row: the `.badge` keeps layout but its style changes. Swap `backgroundColor: ${Colors.accent}1A` → `backgroundColor: Colors.chipSurface`, and `badgeText.color: Colors.accent` → `Colors.textTertiary`. This makes the pill read as a static label rather than a tappable chip.
- Calorie Share row: unchanged (static value, already correct).
- Auto-Deplete row: unchanged.
- Delete the `infoSubtext` italic line at `:400-402` ("To update roles and behavioral settings, remove this item and add it again.").
- Append a new `TouchableOpacity` row below Auto-Deplete:
  ```tsx
  <TouchableOpacity
    style={styles.editSplitsLink}
    onPress={() => navigation.navigate('CustomFeedingStyle', { petId: activePetId! })}
    activeOpacity={0.7}
  >
    <Text style={styles.editSplitsText}>Edit in Custom Splits</Text>
    <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
  </TouchableOpacity>
  ```
  Style: `flexDirection: 'row'`, right-aligned, no background, `Colors.accent` text.

Note on navigation: `CustomFeedingStyle` is registered on `PantryStackParamList` (verified at `src/types/navigation.ts:50` — `CustomFeedingStyle: { petId: string }`). `activePetId` is typed `string | null` on `useActivePetStore`; use the `!` non-null assertion consistent with the existing pattern at `EditPantryItem:274`. By the time this screen is mounted, an active pet always exists (PantryScreen requires it upstream), so the assertion is safe.

**3.2 Action hierarchy (adaptive Restock)** — rewrite the `<View style={styles.actions}>` block at `:493-537`:

Restock button:
- When `isEmpty || item.is_low_stock` → primary cyan fill (`Colors.accent` background, `#FFFFFF` text).
- Otherwise → secondary `chipSurface` fill (`Colors.chipSurface` background, `Colors.accent` text).
- No border in either state.

Share button:
- Always secondary: `Colors.chipSurface` background, `Colors.accent` text, no border.

Remove button:
- Pure red text link: no background, no border, centered text. `SEVERITY_COLORS.danger` text color. `paddingVertical: Spacing.md` for tap-area. Icon stays (trash-outline).

New style keys needed:
```tsx
actionBtnSecondary: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  paddingVertical: 14,
  borderRadius: 12,
  backgroundColor: Colors.chipSurface,
},
actionBtnTextSecondary: {
  fontSize: FontSizes.md,
  fontWeight: '600',
  color: Colors.accent,
},
actionBtnTextLink: {
  fontSize: FontSizes.md,
  fontWeight: '600',
  color: SEVERITY_COLORS.danger,
  textAlign: 'center',
},
actionBtnLink: {
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  paddingVertical: Spacing.md,
},
```

Delete the obsolete style keys: `actionBtnOutline`, `actionBtnTextOutline`, `actionBtnDanger`, `actionBtnTextDanger`. Keep `actionBtn`, `actionBtnPrimary`, `actionBtnText`, `actionBtnTextPrimary`.

**3.3 Solid Add-Time pill** — at `:882-896` change `addTimeBtn`:
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
```
to:
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
```
(Remove the three border-* properties; add `backgroundColor`.) `addTimeText` stays — `Colors.accent`.

**3.4 Hide tab bar on this screen** — add a `useEffect` mirroring `CustomFeedingStyleScreen:69-73`. Place it right after the existing hooks block (after the `myAssignment` `useMemo`). Typing via `(navigation as any).getParent?.()` matches the established pattern in CustomFeedingStyle.

**3.5 Decimal-format the quantity inputs** — in `handleQtyRemainingBlur` and `handleQtyOriginalBlur` (at `:170-178`), after validating `val`, also rewrite local state:
```tsx
const handleQtyRemainingBlur = useCallback(() => {
  const val = parseFloat(qtyRemaining);
  if (!isNaN(val) && val >= 0) {
    const clamped = Math.round(val * 10) / 10;
    setQtyRemaining(String(clamped));
    saveItemField('quantity_remaining', clamped);
  }
}, [qtyRemaining, saveItemField]);
```
Same pattern for `handleQtyOriginalBlur`. The displayed value snaps to 1 decimal after blur.

### Section 4 — CustomFeedingStyleScreen

No changes. The screen was reviewed and is compliant with the decisions in this spec:

- Base/Rotational role toggles are editable (`:260-275`).
- Tab bar hide pattern present (`:69-73`).
- BlurView backdrop + drag handle + safe-area-aware padding present on the product detail modal.
- Matte Premium tokens already used (`cardSurface`, `chipSurface`, `hairlineBorder`, `accentTint`, `productStage`).

### Section 5 — Cross-cutting

**5.1 New helper: `formatServing`**

Add to `src/utils/formatters.ts`:
```ts
/**
 * Clamp a serving/cup value to 1 decimal place for display.
 * Returns '0' for null/undefined/NaN. Trailing zeros are not rendered
 * (so 1.0 prints as '1').
 */
export function formatServing(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0';
  return String(Math.round(value * 10) / 10);
}
```

**5.2 No new color tokens.** All styling uses existing `chipSurface`, `cardSurface`, `hairlineBorder`, `accent`, `textPrimary`, `textSecondary`, `textTertiary`, and `SEVERITY_COLORS.danger`.

### Section 6 — Testing

**Unit tests (new)**

`__tests__/utils/formatters.test.ts` — extend existing file if present, else create:
- `formatServing(null)` → `'0'`
- `formatServing(undefined)` → `'0'`
- `formatServing(NaN)` → `'0'`
- `formatServing(0)` → `'0'`
- `formatServing(1)` → `'1'` (no trailing zero)
- `formatServing(1.0)` → `'1'`
- `formatServing(6.4485)` → `'6.4'`
- `formatServing(6.449999)` → `'6.4'`
- `formatServing(6.45)` → `'6.5'`
- `formatServing(0.04)` → `'0'` (rounds down)
- `formatServing(0.05)` → `'0.1'` (rounds up)
- `formatServing(-1)` → `'-1'` (negative values preserved; caller is responsible for semantic validation)

**Component tests**

`__tests__/components/pantry/PantryCard.test.tsx` — if this file exists, extend; else a small new suite:
- Base item with `allocation_pct: 15`, `feeding_role: 'base'` → renders calorie text.
- Base item with `allocation_pct: 0`, `feeding_role: 'base'` → suppresses calorie text.
- Base item with `allocation_pct: null`, `feeding_role: 'base'` → suppresses calorie text.
- Rotational item with `feeding_role: 'rotational'` and any `allocation_pct` → suppresses calorie text.
- Low-stock base item → no `alertLowStock` block rendered; top-right "~N days" is amber.
- `serving_size: 6.4485` renders in feedingSummary as `6.4`.

**Regression**

No scoring engine changes. Run full suite. Pure Balance (Dog) must remain 61. Temptations (Cat Treat) must remain 0.

**On-device QA**

After implementation, validate on simulator + real device:
- Pantry with mixed base + rotational + treat + low-stock + empty items.
- Header pie-chart icon only appears when `activePet.feeding_style === 'custom'`.
- Tap into EditPantryItem from a base item → tab bar hides.
- Restock button switches from secondary to primary fill when toggling an item to empty.
- Share button reads as secondary (dark-ish fill, cyan text, no border).
- Remove button reads as a red text link at the bottom.
- "Edit in Custom Splits →" link navigates correctly.
- Filter chip reads "Toppers" and fits on one line on a 375pt-width device.
- Empty state copy for the toppers filter reads `"No toppers items in pantry"`.

## Files touched

- `src/components/pantry/PantryCard.tsx` — 1.1, 1.2, 1.3, 1.4 + StyleSheet cleanup.
- `src/screens/PantryScreen.tsx` — 2.1, 2.2.
- `src/screens/EditPantryItemScreen.tsx` — 3.1, 3.2, 3.3, 3.4, 3.5 + StyleSheet add/remove.
- `src/utils/formatters.ts` — new `formatServing` helper.
- `__tests__/utils/formatters.test.ts` — new/extended test block for `formatServing`.
- `__tests__/components/pantry/PantryCard.test.tsx` — new/extended component tests.

## Out of scope — captured as follow-ups

- **Move Custom Splits entry out of PantryScreen top-right** into the "BASE DIET" section header as a trailing "Custom Splits →" link. Removes any remaining icon-semantic ambiguity and only surfaces the action where meaningful. Requires section-header layout work on PantryScreen.
- **Consolidate feeding-summary + calorie text + inventory** into a single semantic row per item state (dry anchor / rotational / treat), instead of stacking three signals.
- **Same-brand disambiguation in `getConversationalName`** — deferred from session 19. Two products sharing brand + identical first-2 descriptor words render identical short names. Flag-later if users hit it.

## Risks and trade-offs

- **Name-shortening may hurt recognition on first run.** The brand row above the name stays full, so identity is preserved. If user feedback shows confusion, trivial to revert `getConversationalName` → `stripBrandFromName` on PantryCard alone.
- **Role-aware suppression may mask a real bug.** If a base item legitimately has `allocation_pct: 0` because of a calorie-share save failure, the user won't see the 0% cue. Mitigation: the "Edit in Custom Splits →" link from EditPantryItem lets them fix it. If a user reports "my food isn't counting toward my pet's diet," the fix path is clear.
- **Adaptive Restock prominence changes on state transitions.** A user who just let a bag run empty will see Restock suddenly promote from secondary to primary. That is the intended behavior — it's a prompt at the moment it matters. Should feel correct, but watch during on-device QA.
- **Tab bar hide affects navigation behavior.** Users who expect the tab bar on EditPantryItem will briefly lose their bearing. Mirrors CustomFeedingStyle and CompareScreen patterns, so consistent within the app.
