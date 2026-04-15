# Wet Food Extras Path — Design Spec

**Date:** 2026-04-14
**Milestone:** M9 (UI Polish & Search)
**Status:** Design — awaiting user review before implementation plan

---

## Problem

When a user adds non-dry daily food to a `dry_only` pet, the current code silently routes it as `feeding_role = 'base'` + `feeding_frequency = 'daily'` + `auto_deplete_enabled = true` — treating the wet food as a scheduled main meal that auto-deducts inventory and counts toward DER. For the common case (a pouch fed occasionally as a topper), this is a calorie overfeed bug: the dry anchor still covers 100% of DER, and the wet adds on top.

A separate but adjacent bug affects toppers (`is_supplemental = true`, `category = 'daily_food'`). Today they're routed through `AddToPantrySheet`'s "treat path" (line 116: `treat = isTreat(category) || is_supplemental`), which yields `feeding_role = null`, `feeding_frequency = 'as_needed'`, `auto_deplete_enabled = false`. No usage-tracking button appears on `PantryCard` (condition requires `feeding_role === 'rotational'`) and no "Gave a treat" button appears either (condition requires `category === 'treat'`). Topper inventory is essentially un-deductable without manually editing `quantity_remaining`.

The shared root cause: the app conflates **meal type** (main food vs extras) with **feeding cadence** (scheduled vs log-driven) into a single implicit default that doesn't match real-world feeding patterns for toppers or for dry-first owners who occasionally feed wet.

## Goals

1. When a user adds non-dry food to a `dry_only` pet, prompt the user once to clarify intent (regular meal vs. topper), and route assignment fields accordingly.
2. Route toppers (`is_supplemental = true`) into a log-driven extras path with a working "Fed This Today" entry point on both PantryCard and EditPantryItem.
3. Keep role and schedule decoupled in EditPantryItem so unusual-but-valid combos (e.g., rotational + daily) remain accessible — but wire `auto_deplete_enabled` to follow the schedule toggle so the common case is correct.
4. Respect existing infrastructure — no duplicate implementations of `rebalanceBaseShares`, no changes to `FedThisTodaySheet`, `log_wet_feeding_atomic`, or the auto-deplete cron beyond what the data model changes imply.

## Non-goals

- New `feeding_style` value (e.g., `dry_with_extras`). Per-assignment fields carry the signal.
- Fixing the `wet_only` + dry cross-format direction. That's a diet shift, not a topper decision — separate design.
- Supplements (`category = 'supplement'`) usage-tracking. Deferred post-MVP; framework in place, research ongoing. Today's treat-path behavior for supplements is preserved unchanged.
- Surfacing `wet_reserve_kcal` / `wet_reserve_source` in UI — already deferred in `docs/superpowers/specs/2026-04-12-pantry-unit-model-gap-DEFERRED.md` (Direction E).
- Optimistic-update pattern for `logWetFeeding` — parallel to `logTreat`'s store-based pattern. Full-reload via `loadPantry` remains acceptable for this scope.
- In-place role editing in EditPantryItem. Role changes stay routed through Custom Splits.
- Changes to `FedThisTodaySheet`, `log_wet_feeding_atomic`, `undo_wet_feeding_atomic`, `refreshWetReserve`, or the auto-deplete cron logic.

## Terminology

To avoid the conflation that caused the original bug, this spec distinguishes:

- **`is_supplemental`** (boolean column on `products`) — true when the product is NOT a complete meal. Applies to toppers, mixers, lickables, sprinkles. Independent of `category`.
- **`category = 'supplement'`** (string value) — true when the product is an actual supplement (pills, oils, probiotics, joint aids). NOT food. Out of scope for this design.
- **Topper** — shorthand for `is_supplemental = true` + `category = 'daily_food'`. Any `product_form` (wet, dry, freeze-dried, dehydrated).
- **Complete meal** — `is_supplemental = false` + `category = 'daily_food'`. The main-food intercept fires on these when pet is `dry_only` and `product_form != 'dry'`.

---

## Section 1 — On-add behavior matrix

`AddToPantrySheet` routing, partitioned by pet's current `feeding_style` and the product's classification.

| Pet `feeding_style` | Dry complete meal | Non-dry complete meal (`is_supplemental = false`) | Topper (`is_supplemental = true`) | Treat (`category = 'treat'`) | Supplement (`category = 'supplement'`) |
|---|---|---|---|---|---|
| `dry_only` | `base + daily + auto_deplete=true` | **Intercept fires** (see Section 2). User picks "Regular meal" → `FeedingStyleSetupSheet`, or "Just a topper" → `rotational + as_needed + auto_deplete=false`, `feeding_style` unchanged | `rotational + as_needed + auto_deplete=false`. No intercept. | Treat path — unchanged (`feeding_role=null`, `as_needed`, `feedings_per_day=1`) | Treat path — unchanged (deferred) |
| `dry_and_wet` | `base + daily + auto_deplete=true` | `rotational + as_needed + auto_deplete=false` (unchanged from today) | `rotational + as_needed + auto_deplete=false`. `refreshWetReserve` filter at `pantryService.ts:876` already excludes `is_supplemental = true` from reserve averaging — toppers don't shrink dry anchor. | Unchanged | Unchanged |
| `wet_only` (adding 1st) | Rare — `base + daily + auto_deplete=true` | `base + daily + auto_deplete=true` | `rotational + as_needed + auto_deplete=false`. No intercept. | Unchanged | Unchanged |
| `wet_only` (adding 2nd+ wet) | Rare — falls through to base | `base + daily`. Existing `rebalanceBaseShares` (`pantryService.ts:41`) splits `calorie_share_pct` evenly and scales `serving_size`. | `rotational + as_needed + auto_deplete=false`. No intercept. | Unchanged | Unchanged |
| `custom` | User-configured | User-configured | Defaults to `rotational + as_needed + auto_deplete=false`; user can tweak via `CustomFeedingStyleScreen` | Unchanged | Unchanged |

### What this replaces

- Today's mismatch check at `AddToPantrySheet.tsx:160-167` (fires `FeedingStyleSetupSheet` directly on `dry_only` + non-dry). Intercept now gates that sheet.
- Today's conflation at `AddToPantrySheet.tsx:116` (`treat = isTreat(category) || is_supplemental`) splits into three routing concerns — see Section 4.

---

## Section 2 — `FeedingIntentSheet`

New component at `src/components/pantry/FeedingIntentSheet.tsx`. Naming follows the existing `FeedingStyleSetupSheet` / `FedThisTodaySheet` / `AddToPantrySheet` convention.

### Trigger conditions (all must be true)

- Pet `feeding_style === 'dry_only'`
- Product `product_form !== 'dry'`
- Product `category === 'daily_food'`
- Product `is_supplemental === false`
- Product `is_vet_diet === false` (existing bypass)
- Pet `wet_intent_resolved_at IS NULL`

### Props

```typescript
interface FeedingIntentSheetProps {
  isVisible: boolean;
  petName: string;
  onRegularMeal: () => void;    // opens FeedingStyleSetupSheet
  onTopperExtras: () => void;   // routes to rotational + as_needed path
  onDismiss: () => void;        // treats as onTopperExtras (safer default)
}
```

### UI

- **Header:** `"How will {petName} eat this?"` (title), `"This affects how we track feedings and portions."` (subtitle)
- **Card 1** — `"Regular meal"`
  - Body: `"This is a main meal for {petName}. I'll feed it on a schedule."`
  - Icon: `restaurant-outline` (Ionicons)
  - Tap → `onRegularMeal()` (opens `FeedingStyleSetupSheet`)
- **Card 2** — `"Just a topper or extra"`
  - Body: `"I'll add it on top of {petName}'s dry food occasionally. I'll log when I feed it."`
  - Icon: `add-circle-outline` (Ionicons)
  - Tap → `onTopperExtras()` (routes extras path)

### Dismissal behavior

- Tap outside modal OR close button → behaves as `onTopperExtras` (safer default — does not silently trigger meal-level defaults that could overfeed).
- Both outcomes write `pet.wet_intent_resolved_at = NOW()` so the sheet does not fire again for this pet.

### Visual spec

- Matches `FeedingStyleSetupSheet` card anatomy: `Colors.cardSurface` bg, `Colors.hairlineBorder`, `borderRadius: 16`, `padding: Spacing.md`, chevron-right affordance.
- Icon box: `Colors.chipSurface` background, 48×48, accent-color icon.
- Sheet container: rounded-top 32, `Colors.background`, `hairlineWidth` border, slide animation. Mirrors `FeedingStyleSetupSheet` styles exactly.

### Integration

- Rendered conditionally inside `AddToPantrySheet` when trigger conditions met, gating the CTA. Replaces today's direct-to-`FeedingStyleSetupSheet` branch at lines 160-167.
- On `onRegularMeal`: opens `FeedingStyleSetupSheet` (same sheet used today). User's chosen feeding_style persists to `pets.feeding_style` via existing flow; `wet_intent_resolved_at` is also set.
- On `onTopperExtras` or dismiss: `feeding_style` stays `dry_only`, `wet_intent_resolved_at` is set, assignment is built with `feeding_role: 'rotational'`, `feeding_frequency: 'as_needed'`, `auto_deplete_enabled: false`.

---

## Section 3 — `EditPantryItemScreen` changes

### 3a. Wire `auto_deplete_enabled` to the schedule toggle

Current `handleFrequencyToggle` at `src/screens/EditPantryItemScreen.tsx:203` only writes `feeding_frequency`. Extend it:

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

**Also remove** the read-only "Auto-Deplete: Enabled/Disabled" info row at lines 421-424. It now redundantly mirrors the toggle state.

### 3b. "Fed This Today" Featured Action Card

New Featured Action Card rendered at the top of `EditPantryItemScreen` (above Quantity / Feeding / Schedule cards), per `.agent/design.md:172-188` pattern.

**Visibility conditions (all must be true):**

- `feedingFrequency === 'as_needed'`
- `!isEmpty`
- `item.is_active`
- `!isRecalled`

**Visual:**

- Featured Action Card styling per design system (accent-color background, strong CTA)
- Icon: `restaurant-outline`
- Primary text: `"Fed This Today"`
- Subtitle: `"Log a feeding to deduct inventory"`

**Behavior:**

- Tap opens `FedThisTodaySheet` with props `{ petId: activePetId, pantryItem: item, assignment: myAssignment, product }`.
- On `onSuccess`: close sheet, call `loadPantry(activePetId)` to refresh screen state. Matches PantryScreen's pattern (`PantryScreen.tsx:722-727`).

### What stays unchanged

- Role pill read-only with "Edit in Custom Splits →" link (session 46 pattern, commit `5d1c57d`)
- Schedule card structure (Daily/As-needed toggle, feeding times, notifications)
- Quantity inputs, action buttons (Restock / Share / Remove)
- `FedThisTodaySheet` component itself

---

## Section 4 — Supporting code changes

### 4a. Migration (new file)

Path: `supabase/migrations/039_wet_intent_resolved_at.sql`

```sql
ALTER TABLE pets
  ADD COLUMN wet_intent_resolved_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: existing pets skip the intercept on next add
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
```

**Rationale:** existing pets have already taken some path through the old mismatch flow or chose a non-default feeding_style. Only net-new `dry_only` pets with no cross-format pantry history see the intercept.

**QA note:** pets with only soft-deleted (`is_active = false`) cross-format items will trigger the intercept on their next add. This is acceptable — it's effectively a re-clarification after a clean pantry.

### 4b. Routing refactor — `AddToPantrySheet`

Replace the current conflated `treat` flag (line 116) with three distinct classifications:

```typescript
const isTreat = product.category === 'treat';
const isTopper = product.is_supplemental === true && !isTreat;
const isSupplement = product.category === 'supplement';
const isSimpleAdd = isTreat || isTopper || isSupplement;  // form-layout concern

const inferredRole: FeedingRole =
  isTreat || isSupplement ? null :
  isTopper ? 'rotational' :
  pet.feeding_style === 'wet_only' ? 'base' :
  pet.feeding_style === 'dry_and_wet' && product.product_form !== 'dry' ? 'rotational' :
  'base';

const inferredFreq: FeedingFrequency =
  inferredRole === 'base' ? 'daily' : 'as_needed';

const inferredAutoDeplete = inferredFreq === 'daily';
```

**Preserves** today's form-layout behavior via `isSimpleAdd` (no scoop math, simpler UI for treats / toppers / supplements).

**Changes** role/frequency/auto_deplete for toppers specifically — they get rotational + as_needed + Log feeding button.

**Intent sheet override:** when the user picks "Just a topper" in `FeedingIntentSheet`, the assignment is built with `feeding_role: 'rotational'`, `feeding_frequency: 'as_needed'`, `auto_deplete_enabled: false` regardless of what the inference above would produce. The intent sheet output wins.

### 4c. `computeBehavioralServing` — `dry_only` + rotational early-return

File: `src/utils/pantryHelpers.ts:418`. Add rotational early-return to the `dry_only` branch, mirroring the `custom` branch at line 432:

```typescript
if (style === 'dry_only') {
  if (feedingRole === 'rotational') return null;   // NEW
  budgetedKcal = der;
}
```

**Effect:** a topper (or intent-sheet-routed rotational wet) on a `dry_only` pet returns `null` — PantryCard's Log feeding button path activates (`PantryCard.tsx:324`). Without this, the function computes a full-DER "serving" for the topper, which is wrong.

### 4d. `PantryCard` — no changes (verified)

Existing condition at `src/components/pantry/PantryCard.tsx:324` (`isRotational && !item.is_empty && onLogFeeding && !isFedToday`) already surfaces the Log feeding button for any `feeding_role === 'rotational'` item. Toppers get it for free once routed as rotational.

`refreshWetReserve` already filters `is_supplemental = false` at `pantryService.ts:876` — toppers never leak into `wet_reserve_kcal` averaging on `dry_and_wet` pets. No change needed.

### 4e. Diet completeness copy refinement

File: `src/services/pantryService.ts:766` (`evaluateDietCompleteness`).

For `dry_only` pets with rotational items but zero `base` food, the empty-state message should distinguish extras from meals. Proposed copy:

> `"Toppers are extras — add a dry main food to complete {petName}'s diet."`

Exact string and integration point to be locked in the implementation plan. Minor copy change; no logic change.

### 4f. Service layer — `updatePet` accepts `wet_intent_resolved_at`

Confirm `src/services/petService.ts` `updatePet` function accepts the new column in its `UpdatePetInput` type. Migration adds the column; service type must follow.

---

## Section 5 — Explicitly out of scope

1. New `feeding_style` value — unnecessary; per-assignment fields carry the signal.
2. `rebalanceBaseShares` rewrite — already exists and works. Gemini's "Change 4" proposed re-implementing a built function.
3. Editable role pill in EditPantryItem — stays read-only; changes route through Custom Splits.
4. `wet_only` + dry cross-format intercept — keep today's direct-to-`FeedingStyleSetupSheet` flow.
5. Supplements (`category = 'supplement'`) usage-tracking — deferred post-MVP.
6. `wet_reserve_kcal` UI surface — separately deferred.
7. Optimistic-update pattern for `logWetFeeding` — acceptable gap; parallel to treat-battery pattern is separate polish.
8. `FedThisTodaySheet` internals — no changes.
9. Auto-deplete cron, Wet Reserve Engine, `log_wet_feeding_atomic` RPC — no changes.

---

## Risks

- **Persistence ratchet:** `wet_intent_resolved_at` is one-way. If a user picks "topper" but later wants to upgrade their pet to `dry_and_wet`, they must go through the EditPet feeding_style selector — not the intercept. Acceptable (fewer surprise prompts) but worth calling out in QA review.
- **Featured Action Card vertical space:** adds ~80px at top of EditPantryItem. Need on-device check on smaller devices (iPhone SE, small Android) that quantity inputs don't fall below the fold.
- **Backfill edge case:** pets with only soft-deleted cross-format pantry items will still trigger the intercept on next add. Intentional but flag for QA.
- **Copy testing:** "Just a topper or extra" vs. "Regular meal" copy needs verification on device — specifically whether owners self-identify their wet feeding as one or the other. If ambiguous, iterate copy post-launch. Not blocking.
- **Custom mode topper routing:** `custom` pets adding toppers default to `rotational + as_needed + auto_deplete=false`. User can reconfigure via `CustomFeedingStyleScreen`. Confirm `rebalanceBaseShares` skip at `pantryService.ts:~757` still excludes the topper from share-splitting (existing behavior).

---

## Testing strategy

### Unit tests

- **`AddToPantrySheet` routing matrix** — `__tests__/components/AddToPantrySheet.test.tsx`. Coverage: 3 product types × 4 feeding_styles = 12 cases + 4 intent-sheet outcomes (Card 1 / Card 2 on dry_only for both complete-meal and topper paths).
- **`FeedingIntentSheet`** — `__tests__/components/FeedingIntentSheet.test.tsx`. Renders 2 cards, invokes correct callbacks, persistence write fires on both outcomes and on dismiss.
- **`computeBehavioralServing`** — `__tests__/utils/pantryHelpers.test.ts`. New case: `dry_only` + `rotational` → `null`. Regression: existing `dry_only` + `base` still returns positive amount.
- **`handleFrequencyToggle`** — `__tests__/screens/EditPantryItemScreen.test.tsx`. Toggling schedule to `daily` writes `auto_deplete_enabled: true`; toggling to `as_needed` writes `auto_deplete_enabled: false` + `notifications_on: false`.
- **`EditPantryItemScreen` Featured Action Card visibility** — 4-dim matrix: `feedingFrequency` × `isEmpty` × `isRecalled` × `item.is_active`.
- **Backfill SQL** — manual verification in staging DB. Confirm count of pets marked vs unmarked matches expected.

### Integration tests

- **Intercept persistence** — adding first wet food to fresh dry_only pet opens sheet; picking either option writes `wet_intent_resolved_at`; adding second wet food does NOT re-open sheet.
- **Toppers across styles** — adding topper to `dry_only`, `dry_and_wet`, `wet_only`, `custom` produces `rotational + as_needed + auto_deplete=false` in all four cases (no intercept).
- **Regression: `dry_and_wet` flow** — adding non-dry complete meal still goes rotational + as_needed with `wet_reserve_kcal` averaging intact.
- **Regression: `wet_only` rebalance** — adding 2nd wet still splits `calorie_share_pct` via `rebalanceBaseShares`.

### No new RPC tests needed

`log_wet_feeding_atomic`, `undo_wet_feeding_atomic`, and `refreshWetReserve` are unchanged.

---

## Files touched

### New files

- `src/components/pantry/FeedingIntentSheet.tsx`
- `supabase/migrations/039_wet_intent_resolved_at.sql`
- `__tests__/components/FeedingIntentSheet.test.tsx`

### Modified files

- `src/components/pantry/AddToPantrySheet.tsx` (routing refactor + FeedingIntentSheet wiring)
- `src/screens/EditPantryItemScreen.tsx` (`handleFrequencyToggle` + Featured Action Card + remove Auto-Deplete info row)
- `src/utils/pantryHelpers.ts` (`computeBehavioralServing` `dry_only` + rotational early-return)
- `src/services/pantryService.ts` (`evaluateDietCompleteness` copy — `dry_only` + only rotational messaging)
- `src/services/petService.ts` (`updatePet` accepts `wet_intent_resolved_at`)
- `src/types/pet.ts` (`Pet` interface adds `wet_intent_resolved_at: string | null`)
- `__tests__/components/AddToPantrySheet.test.tsx`
- `__tests__/screens/EditPantryItemScreen.test.tsx`
- `__tests__/utils/pantryHelpers.test.ts`

### Not touched (verified)

- `supabase/functions/auto-deplete/index.ts`
- `supabase/migrations/034_behavioral_feeding.sql` (migration 039 adds the new column)
- `src/components/pantry/FedThisTodaySheet.tsx`
- `src/components/pantry/FeedingStyleSetupSheet.tsx`
- `src/components/pantry/PantryCard.tsx`
- `src/stores/usePantryStore.ts`
- RPC functions `log_wet_feeding_atomic`, `undo_wet_feeding_atomic`

---

## Rollout / verification

Single PR, single migration. No feature flag — this is a correctness fix on top of existing infrastructure, not a user-facing feature ramp.

**Pre-merge checks:**

- Full Jest suite passes (1508+ tests)
- Migration 039 runs cleanly on staging
- Pure Balance regression = 61, Temptations regression = 0 (scoring engine untouched but verify anyway)
- On-device smoke test: add wet food to fresh `dry_only` pet → intercept fires → Topper path → Log feeding button visible on both PantryCard and EditPantryItem → Fed This Today logs successfully → inventory decrements → second add does not re-trigger intercept
