# Kiba — Pantry Spec

> **Status:** LOCKED v5
> **Applies to:** M5 Pantry feature — product management, bag/pack countdown, feeding schedules, diet completeness, recall surfacing. Extended through M9 to cover Behavioral Feeding (migration 034) and the Wet Food Extras Path (migration 039). Excludes: Safe Swap recommendations (M6), Kiba Index voting (M8), Symptom Detective (M11), Elimination Diet (M16+).
> **Prerequisite:** M4.5 complete (641 tests, 32 suites), pet profiles exist, `is_supplemental` backfilled (D-136), `product_form` column populated (migration 010), `resolveCalories()` available (D-149), `stripBrandFromName()` available, MetadataBadgeStrip component exists, `@testing-library/react-native` installed (2026-04-14 for render tests).
>
> **Changelog:**
> - March 19, 2026 v1: Initial spec from design discussions.
> - March 19, 2026 v2: D-152–D-158, depletion breakdown, filter bar, progress bar, dynamic unit labels, treats excluded, D-157 nudge, D-158 bypass.
> - March 19, 2026 v3: Local notifications for feeding/appointment reminders (not server cron). Offline writes blocked (no sync queue). Treat Battery moved from polish to Phase 2. Migrations split: 013 push_tokens, 014 user_settings. Low stock notification uses unit_label for unit-mode.
> - March 19, 2026 v4: Mockup review patches — §3b expanded with recalled/empty edit states, §7 share gating changed from explicit premium check to natural D-052 pet limit, per-pet scores in share picker, D-159 excluded from core M5 scope.
> - April 15, 2026 v5: **Behavioral Feeding** (migration 034) — replaces rigid slot/meal-fraction model. Adds `feeding_style` (pets) + `feeding_role` / `auto_deplete_enabled` / `calorie_share_pct` (pantry_pet_assignments) + `feeding_log` table + `log_wet_feeding_atomic` / `undo_wet_feeding_atomic` RPCs + `wet_reserve_kcal` / `wet_reserve_source` (pets). Introduces Wet Reserve Engine (`refreshWetReserve`), `computeBehavioralServing`, `rebalanceBaseShares`. **Wet Food Extras Path** (migration 039) — adds `wet_intent_resolved_at` (pets) + `FeedingIntentSheet` intercept for `dry_only` pets adding non-dry complete meals. Toppers (`is_supplemental=true`) route through a dedicated rotational + log-driven path. **D-164** collapses `unit_label` to the single value `'servings'` (cans/pouches semantics moved to UI). **EditPantryItem** gains the "Fed This Today" Featured Action Card; schedule toggle now wires `auto_deplete_enabled` as a side effect. **PantryCard** Log feeding button is now role-agnostic (fires on any `as_needed` item), Topper badge extended to intent-routed rotational items. **Diet completeness** is feeding-style-aware with topper-aware copy for `dry_only` + zero-base + rotational-only state.

---

## 0. Context: Where This Fits

Pantry is M5's anchor feature and Kiba's #1 retention mechanism. Feeding notifications create 730+ annual lock-screen touchpoints. Every "Running low" nudge is a natural re-engagement moment. Combined with pet appointments (D-103) and recall alerts (D-125), M5 transforms Kiba from a scanner opened at the store into daily-use pet care infrastructure.

Pantry unlocks downstream features: Safe Swap recommendations (M6) query the pantry to suggest replacements for low-scoring items. Diet completeness warnings (D-136 Part 5) require knowing what's in the pantry. Weekly digest (D-130) summarizes pantry state. Safe Switch (M7/M9) uses `pantry_item_id` to anchor its 7/10-day transitions and atomic swap-on-completion.

| System | Relationship to Pantry |
|---|---|
| Scan → Score flow | "Add to Pantry" CTA on ResultScreen. Product defaults to active pet. `FeedingIntentSheet` may intercept for `dry_only` pets adding non-dry complete meals. |
| Pet Profiles | Pantry is per-pet via `pantry_pet_assignments`. Switching active pet switches pantry view. Multi-pet sharing requires 2+ pets (D-052 pet limit gates naturally). `pet.feeding_style` determines base/rotational routing on add. |
| Scoring Engine | Pantry does NOT re-score. Reads score from `pet_product_scores` cache (Top Matches) or `scans.final_score` fallback. |
| Portion Calculator | M2's `computePetDer()` provides calorie target for `computeBehavioralServing`. `resolveCalories()` (D-149) provides per-product calorie data. System recommends; user adjusts. |
| Recall Siren | Recall Siren pipeline writes `is_recalled = true` on products. Recalled products are a pipeline bypass (D-158) — no score computed. Pantry surfaces recall badge and links to RecallDetailScreen. |
| Safe Swap (M6) | Future — pantry feeds "what the pet currently eats" to the recommendations engine. Excludes rotational items from Safe Swap candidate pool (they're already extras, not meals). |
| Safe Switch (M7 / M9 Phase B) | `safe_switches.pantry_item_id` anchors transitions to a specific pantry item. Atomic `complete_safe_switch_with_pantry_swap` RPC swaps `pantry_items.product_id` + zeroes quantity in one transaction. Only `feeding_role = 'base'` items are swap-eligible. |
| Top Matches | `pet_product_scores` cache provides per-pet score data for pantry display. If cache miss, falls back to most recent scan score. |
| Weekly Digest (D-130) | Reads pantry state for "Running low" and "Empty" items in weekly summary push. |
| Treat Battery | `useTreatBatteryStore` — per-pet daily kcal/count tracking for `category = 'treat'` items. Midnight auto-reset. Separate from `feeding_log` (which handles non-treat `as_needed` items). |

---

## 1. Data Model

### 1a. Tables

```sql
-- Migration 011: Pantry tables (v1)
CREATE TABLE pantry_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_original   DECIMAL(10,2) NOT NULL,
  quantity_remaining  DECIMAL(10,2) NOT NULL,
  quantity_unit       TEXT NOT NULL CHECK (quantity_unit IN ('lbs', 'oz', 'kg', 'g', 'units')),
  serving_mode        TEXT NOT NULL CHECK (serving_mode IN ('weight', 'unit')),
  unit_label          TEXT DEFAULT 'servings',   -- D-164 (migration 019): collapsed from cans/pouches/units
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_deducted_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pantry_pet_assignments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pantry_item_id       UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  pet_id               UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  serving_size         DECIMAL(8,4) NOT NULL,
  serving_size_unit    TEXT NOT NULL CHECK (serving_size_unit IN ('cups', 'scoops', 'units')),
  feedings_per_day     SMALLINT NOT NULL DEFAULT 2,
  feeding_frequency    TEXT NOT NULL DEFAULT 'daily' CHECK (feeding_frequency IN ('daily', 'as_needed')),
  feeding_times        JSONB,
  notifications_on     BOOLEAN NOT NULL DEFAULT true,
  -- Migration 034 (Behavioral Feeding)
  feeding_role         TEXT CHECK (feeding_role IN ('base', 'rotational') OR feeding_role IS NULL),
  auto_deplete_enabled BOOLEAN DEFAULT FALSE,
  calorie_share_pct    INTEGER DEFAULT 100 CHECK (calorie_share_pct >= 0 AND calorie_share_pct <= 100),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pantry_item_id, pet_id)
);

-- Migration 034: feeding_log — per-event record for log-driven items
CREATE TABLE feeding_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id          UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  pantry_item_id  UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kcal_fed        SMALLINT NOT NULL CHECK (kcal_fed >= 0),
  quantity_fed    NUMERIC NOT NULL CHECK (quantity_fed > 0),
  fed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_feeding_log_pet_fed_at ON feeding_log (pet_id, fed_at);
ALTER TABLE feeding_log ENABLE ROW LEVEL SECURITY;
-- RLS: auth.uid() = user_id
```

**`pets` table additions** (migration 034 + 039):

```sql
ALTER TABLE pets
  ADD COLUMN feeding_style            TEXT DEFAULT 'dry_only'
    CHECK (feeding_style IN ('dry_only', 'dry_and_wet', 'wet_only', 'custom')),
  ADD COLUMN wet_reserve_kcal         INTEGER DEFAULT 0,
  ADD COLUMN wet_reserve_source       TEXT,
  ADD COLUMN wet_intent_resolved_at   TIMESTAMPTZ DEFAULT NULL;  -- migration 039
```

**`unit_label`** (D-164): Collapsed to the single value `'servings'` in migration 019. The cans/pouches/units distinction is a UI concern — resolved at render time from `serving_size_unit` on the assignment, not stored on the item. Simplifies the data model.

**`feeding_role`** (migration 034): `'base'` = main meal, counts toward DER budget, typically scheduled with auto-deplete. `'rotational'` = extras / toppers / wet rotation, log-driven, does not shrink dry anchor on `dry_only` pets. `NULL` = treat (`category = 'treat'`) or deferred-scope supplement (`category = 'supplement'`).

**`auto_deplete_enabled`** (migration 034): Controls whether the auto-deplete cron processes this assignment. Decoupled from `feeding_frequency` at the schema level, but the EditPantryItem schedule toggle wires them together (`daily` → `true`, `as_needed` → `false`). Cron query filter: `.or('feeding_frequency.eq.daily,auto_deplete_enabled.eq.true')`.

**`calorie_share_pct`** (migration 034): For multi-base assignments on the same pet (e.g., wet_only pet with 2 wet bases). `rebalanceBaseShares` auto-splits evenly (2 → 50/50, 3 → 33/33/34). Also used by `custom` feeding style where user manually configures splits via `CustomFeedingStyleScreen`.

**`wet_reserve_kcal` / `wet_reserve_source`** (migration 034): Cached weighted-average of rotational wet item kcal, recomputed by `refreshWetReserve` after add/remove/share/share-update. Source values: `'label'`, `'blended'`, `'estimated'`, or a specific calorie resolution key. Only populated for `feeding_style = 'dry_and_wet'` (early-returns for other styles).

**`wet_intent_resolved_at`** (migration 039): Timestamp when the user explicitly resolved the `FeedingIntentSheet` for this pet. Null means the intercept hasn't fired yet (or was just reset by a feeding_style change). Migration 039 backfill marks existing non-dry_only pets and pets with active cross-format pantry items as already-resolved so the intercept only fires for genuinely new dry_only state.

**Computed values (not stored):**
- `daily_consumption = serving_size × feedings_per_day` (per base pet per item)
- `total_daily_consumption = SUM(daily_consumption)` across all base-role pets
- `days_remaining = quantity_remaining / total_daily_consumption` (base items only; rotational items are log-driven)
- `calorie_context = daily_consumption × kcal_per_serving` (informational only)
- `isFedToday = last_deducted_at in today's UTC range` (drives PantryCard's "Fed today" badge)

### 1b. RPCs

**`log_wet_feeding_atomic(p_pet_id, p_pantry_item_id, p_kcal_fed, p_quantity_fed) RETURNS UUID`** (migration 034):
Inserts a `feeding_log` row AND decrements `pantry_items.quantity_remaining` in a single transaction. Sets `last_deducted_at = NOW()` (drives isFedToday). Floors quantity at 0 via `GREATEST(0, ...)`. `SECURITY INVOKER` — RLS enforces ownership.

**`undo_wet_feeding_atomic(p_log_id) RETURNS VOID`** (migration 034):
Reverses a log entry. Re-increments inventory, deletes the row. Ownership verified before acting.

### 1c. Relationships

```
auth.users ──< pantry_items ──< pantry_pet_assignments >── pets
                    │                                        │
                    ├── products (FK: product_id)             └── feeding_style (pet-level)
                    │
                    └── feeding_log (per-event)

pets.wet_reserve_kcal / wet_reserve_source ← refreshWetReserve (on add/remove/share)
pets.wet_intent_resolved_at ← AddToPantrySheet intent handlers (set)
                                ← petService.updatePet (auto-reset on feeding_style change)
```

- Pet deletion cascades through assignments but does NOT delete `pantry_items` (other pets may share it).
- `feeding_log` rows cascade on pet OR pantry_item deletion.

### 1d. RLS Rules

```sql
-- pantry_items: user_id = auth.uid()
-- pantry_pet_assignments: scoped through pantry_items.user_id (inherited)
-- feeding_log: user_id = auth.uid() (explicit policy in migration 034)
```

### 1e. Indexes

- `idx_pantry_items_user_active` ON (user_id, is_active) WHERE is_active = true
- `idx_pantry_assignments_pet` ON (pet_id)
- `idx_pantry_items_product` ON (product_id) WHERE is_active = true
- `idx_feeding_log_pet_fed_at` ON (pet_id, fed_at)

---

## 2. Product States in Pantry

| State | Condition | UI Treatment | Sort |
|---|---|---|---|
| **Recalled** | `is_recalled = true` | Red badge, no score (D-158 bypass), tap → RecallDetailScreen | 1 (top) |
| **Active Base** | `feeding_role = 'base'`, above low stock threshold | Normal card, progress bar, Replace this food button | 2 |
| **Active Rotational (Topper)** | `feeding_role = 'rotational'` + `feeding_frequency = 'as_needed'` | Topper badge, Log feeding button, no progress bar, `is_supplemental`-aware | 2 |
| **Low stock** | ≤5 days or ≤5 units | Amber "Running low" + affiliate buy button | 3 |
| **Empty** | `quantity_remaining = 0` | 40% opacity, "Empty", Restock/Edit/Remove (D-155) | 4 (bottom) |
| **Bypassed** | Vet diet / variety pack / recalled | Bypass badge, no score. Countdown still works on base items. | Per state |
| **In Safe Switch** | Item is anchor of active Safe Switch | Locked badge, swipe disabled, Log feeding hidden | Per active state |

### Pipeline Bypass Chain (D-158)

```
vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → supplemental topper (D-146, scored) → normal
```

Toppers are scored (65/35/0 weights, macro-only NP per D-136). They skip the intercept because their extras intent is unambiguous (§3a).

---

## 3. Core Operations

### 3a. Add to Pantry

**Entry points:** ResultScreen CTA, HomeScreen category browse tap, Me tab "Log a Treat" (D-124)

**Routing classification** — `inferAssignmentDefaults(pet, product)` pure helper (exported from `AddToPantrySheet.tsx`). Output: `{ isSimpleAdd, inferredRole, inferredFreq, inferredAutoDeplete }`.

| Product classification | `inferredRole` | `inferredFreq` | `inferredAutoDeplete` | Form layout |
|---|---|---|---|---|
| `category = 'treat'` | `null` | `as_needed` | `false` | Simple |
| `category = 'supplement'` | `null` | `as_needed` | `false` | Simple (deferred scope — post-MVP) |
| `is_supplemental = true` (topper, any product_form) | `'rotational'` | `as_needed` | `false` | Simple |
| `feeding_style = 'wet_only'` + non-treat / non-topper | `'base'` | `daily` | `true` | Full |
| `feeding_style = 'dry_and_wet'` + `product_form != 'dry'` + non-treat / non-topper | `'rotational'` | `as_needed` | `false` | Full |
| `feeding_style = 'dry_only'` + `wet_intent_resolved_at != null` + `product_form != 'dry'` + non-treat / non-topper | `'rotational'` | `as_needed` | `false` | Full (honors prior topper intent) |
| All other (defaults to main meal) | `'base'` | `daily` | `true` | Full |

**FeedingIntentSheet intercept** (migration 039 + new component `src/components/pantry/FeedingIntentSheet.tsx`):

Fires inside `AddToPantrySheet`, before completing the add, when ALL of:
- `pet.feeding_style === 'dry_only'`
- `pet.wet_intent_resolved_at == null`
- `product.category === 'daily_food'`
- `product.is_supplemental === false`
- `product.is_vet_diet === false`
- `product.product_form !== 'dry'`

Two cards:
- **"Regular meal"** — opens existing `FeedingStyleSetupSheet` for the user to pick `dry_and_wet` / `wet_only` / `custom`. Persists `wet_intent_resolved_at = NOW()`. Future wet adds inherit the new style's routing (rotational for `dry_and_wet`, etc).
- **"Just a topper or extra"** — sets `intentForcedTopper = true` locally, persists `wet_intent_resolved_at = NOW()`. Assignment is forced to `rotational + as_needed + auto_deplete=false` regardless of what `inferAssignmentDefaults` returned. Pet's `feeding_style` stays `dry_only`.

**Dismissal** (tap-outside / Android back): Cancels the entire `AddToPantrySheet` (closes parent). Does NOT persist `wet_intent_resolved_at`. Does NOT force topper. User can restart the add to see the intercept again. This prevents accidental-dismiss → permanent-intercept-disable (which was the original spec v1 behavior; reversed 2026-04-15 after on-device feedback). The intent here is: ambiguous input preserves the user's ability to clarify later rather than silently committing a default.

**Second direction (preserved, not behind FeedingIntentSheet):** `wet_only` pet adding dry product → opens `FeedingStyleSetupSheet` directly (session-scoped via `hasShownWetOnlyDryPrompt`). Not converted to the new intercept because this is a diet shift, not a topper decision.

**Intent persistence lifecycle:**
- Set: Both `FeedingIntentSheet` card taps (Regular meal or Just a topper).
- Reset: `petService.updatePet` automatically nulls `wet_intent_resolved_at` whenever `feeding_style` changes (dry_only → dry_and_wet → back covers the edge case). Skipped if the caller explicitly includes `wet_intent_resolved_at` in the same patch.

**Add-to-pantry sheet (bottom sheet) fields:**

For `isSimpleAdd` path (treats, toppers, supplements):
1. Product image + brand + name (read-only)
2. Quantity + unit stepper
3. Role label (if `feeding_role !== null`) — "Rotational Food — Logged manually as fed via 'Fed This Today'" helper copy
4. Feedings/day stepper (defaults to 1)
5. No depletion breakdown, no calorie context
6. "Add to [Pet Name]'s Pantry" CTA

For full (base meal) path:
1. Product image + brand + name (read-only)
2. Serving mode toggle — auto-detected from `product_form`, user can override
3. **Weight-based inputs:** Bag size (lbs/oz/kg/g), cups per feeding, feedings/day stepper
4. **Unit-based inputs:** Total count, fractional chips (¼ ⅓ ½ ⅔ ¾ 1 1½ 2 + custom), feedings/day stepper
5. **Depletion math breakdown** (D-152, live-updating): "½ serving × 2 feedings = 1 serving/day · ~24 days" (using unit_label = 'servings')
6. System recommendation (when calorie data available): "Recommended: ~X cups/day based on [Pet Name]'s profile" — goal weight DER for premium (D-153, D-160)
7. Calorie context: "~X kcal/day of [Pet Name]'s Y kcal target" — not shown for simple-add items
8. `intentForcedTopper` override: when set, the `autoServingResult` (base-DER computed) is bypassed — `effectiveServingSize` falls back to `manualServingSize` (default 1) + `effectiveServingUnit` to `manualServingUnit`. Prevents persisting a misleading multi-unit serving on a rotational item (EditPantryItem depletion row would read "3 units/day · ~7 days" otherwise, for what's actually an extras item).
9. Confirm: "Add to [Pet Name]'s Pantry"

**Defaults:** Active pet only (D-154). Bag size required. Serving pre-filled from recommendation if available. Feedings: 2 for base food, 1 for simple-add items.

**Deduplication:** Same UPC → "Already in pantry. Restock instead?"

**Blocked:** Species mismatch → toast. Variety pack → allowed (tracking only).

**Post-add side effects** (service layer, via `addItemWithRebalance`):
- `rebalanceBaseShares(petId)` — auto-splits `calorie_share_pct` evenly across base-role assignments for this pet, and scales `serving_size` proportionally. Skipped when `feeding_style === 'custom'`.
- `refreshWetReserve(petId)` — recomputes `wet_reserve_kcal` + `wet_reserve_source` from rotational items. Early-returns unless `feeding_style === 'dry_and_wet'`. Filters `is_supplemental = false` at the query level, so toppers never leak into the reserve average.

### 3b. Edit

**Screen:** `EditPantryItemScreen` — full-screen edit, navigated from PantryCard tap.

**"Fed This Today" Featured Action Card** (M9 Phase D): Prominent accent-color CTA at the top of the screen (above the Quantity card) per `.agent/design.md:172-188` Featured Action Card pattern. Visible when ALL of:
- `feedingFrequency === 'as_needed'`
- `!isEmpty`
- `item.is_active`
- `!isRecalled`

Tap opens `FedThisTodaySheet` (shared with PantryCard entry point). On success, closes sheet + refreshes via `loadPantry(activePetId)`. Visibility helper `shouldShowFedTodayCard(state)` exported for testability.

**Editable fields:**
- Quantity remaining (number + unit selector matching original unit)
- Original bag/pack size (for Restock target)
- Serving size per feeding (per-pet)
- Feedings per day (stepper: 1, 2, 3)
- Feeding schedule: Daily ↔ As needed toggle — `handleFrequencyToggle` also writes `auto_deplete_enabled` (daily → true, as_needed → false) + `notifications_on: false` when toggling to as_needed. Single `saveAssignmentField` call.
- Notification times (clock time pickers, only when daily)
- Notifications on/off toggle

**NOT editable:** product itself, product image, score, role pill (read-only; "Edit in Custom Splits →" link for role changes), calorie share pct (displayed, read-only; editable via `CustomFeedingStyleScreen` only).

**Auto-save:** saves on field change (no explicit save button). Uses `updatePantryItem()` and `updatePetAssignment()`. `updatePetAssignment`'s Pick type includes `auto_deplete_enabled` so the toggle-wired update is type-safe.

**Depletion summary:** live-updating breakdown line matching add-to-pantry sheet format. Shown for base items with calorie data.

**Actions at bottom:**
- "Restock" button (resets to original quantity — primary for empty items, secondary otherwise)
- "Share with other pets" (opens SharePantrySheet — no premium badge)
- "Remove from Pantry" (with single/shared removal flow per §3d)

**Recalled item edit behavior (D-158):**
- Quantity section: editable (user may need to track amount for return/refund)
- Feeding section: disabled, muted at 40% opacity, not interactive
- Schedule section: disabled, muted at 40% opacity, not interactive
- "Fed This Today" card: hidden (fails `!isRecalled` gate)
- Depletion breakdown: not shown
- "View Recall Details" link shown above actions → navigates to RecallDetailScreen
- Actions: Remove from Pantry only. Restock and Share hidden.

**Empty item edit behavior (D-155):**
- Quantity section: editable (user can manually enter remaining if bag isn't truly empty)
- Feeding section: muted at 60% opacity (editable but de-emphasized — settings preserved for restock)
- Schedule section: muted at 60% opacity (same — preserved for restock)
- "Fed This Today" card: hidden (fails `!isEmpty` gate)
- Depletion breakdown: shows "Empty" instead of days remaining
- Actions: Restock is primary (accent fill, not outlined). Share and Remove shown normally.

**Note:** The read-only "Auto-Deplete: Enabled/Disabled" info row that existed in v4 was removed in v5 — it redundantly mirrored the schedule toggle state once the toggle drives `auto_deplete_enabled` directly.

### 3c. Restock

Resets `quantity_remaining` to `quantity_original`. Reactivates empty items. Preserves settings.

### 3d. Remove

Single-pet: confirm → soft delete. Shared: "Remove for all" or "Remove for [Pet Name] only."

**Mixed feeding removal (D-157):** When removing a daily food with ≥1 other daily food remaining, show nudge: "[Pet Name]'s daily intake from pantry items has changed." No auto-rebalance. Calorie context on remaining cards shows the gap.

**Active Safe Switch guard:** `removePantryItem` refuses to remove items that are anchoring an active Safe Switch. User must cancel the Safe Switch first.

**Post-remove side effects:** `rebalanceBaseShares(petId)` + `refreshWetReserve(petId)` fire after removal.

### 3e. View Pantry

**Pet carousel** (top): active pet highlighted with accent ring. Tap to switch. Loading via `usePantryStore._petCache` (stale-while-revalidate per session 43).

**Diet completeness banner** (conditional, per §4).

**Filter chip bar:** All | Dry | Wet | Treats | Toppers | Recalled | Running Low. Color conventions: Toppers = teal, Recalled = red, Running Low = amber. Sort menu: Default (state-based) | Name | Score | Days Remaining.

**Section headers** (session 46 naming):
- **BASE DIET** — items where `feeding_role = 'base'`
- **ROTATIONAL FOODS** — items where `feeding_role = 'rotational'`
- **TREATS** — items where `category = 'treat'`

**Default sort:** Recalled → Active → Low stock → Empty. Within groups: newest first.

### 3f. Feeding Style Transitions

User changes `pet.feeding_style` via EditPet or PetHub's `FeedingStyleSetupSheet`:
- `updatePet(petId, { feeding_style: newStyle })` fires
- `petService.updatePet` detects the change AND nulls `wet_intent_resolved_at` unless caller explicitly provided it — ensures the intercept can re-fire for a future dry_only state
- Transition-to-custom: `transitionToCustomMode(petId)` populates `calorie_share_pct` per assignment from existing kcal density. `rebalanceBaseShares` is skipped for custom mode.
- Transition-from-custom: `transitionFromCustomMode(petId, newStyle)` reverts to auto-splitting via `rebalanceBaseShares`.
- Wet reserve: recomputed only if new style is `dry_and_wet`; cleared to 0 otherwise (via `refreshWetReserve` early-return semantics).

---

## 4. Diet Completeness

Computed at read-time via `evaluateDietCompleteness(petId, petName)`. Per-pet. NOT stored. NOT a score modifier. Feeding-style-aware.

| Situation | Status | Banner Copy |
|---|---|---|
| ≥1 base food present (any feeding_style) | `complete` | — |
| `feeding_style = 'dry_only'` + only rotational items + zero base | `info` | "Toppers are extras — add a dry main food to complete [Pet Name]'s diet." |
| `feeding_style = 'dry_and_wet'` + no base | `info` | "[Pet Name] is set to mixed feeding but has no base dry food." |
| 2+ supplemental items, no complete food (legacy is_supplemental-heavy pantry) | `amber_warning` | "[Pet Name]'s diet may be missing essential nutrients..." |
| Only treats, no food | `red_warning` | "No meals found in [Pet Name]'s pantry..." |

All copy D-095 compliant. Does NOT do: nutrient gap analysis, caloric adequacy, portion recommendations, product recommendations.

The generic catch-all fallthrough is `amber_warning` — red is reserved for truly empty or treat-only states. The `info` tier is dismissible; `amber_warning` and `red_warning` persist until resolved.

---

## 5. Feeding Schedule & Auto-Depletion

### 5a. Defaults

**Base items (daily food with `feeding_role = 'base'`):** `feeding_frequency = 'daily'`, 2×/day, 7:00 AM + 6:00 PM, notifications on, `auto_deplete_enabled = true`.

**Rotational items (wet rotation or intent-sheet-routed toppers):** `feeding_frequency = 'as_needed'`, notifications off, `auto_deplete_enabled = false`. Log-driven via `FedThisTodaySheet`.

**True toppers (`is_supplemental = true` products):** Same as rotational — `as_needed + auto_deplete=false`.

**Treats / supplements:** `feeding_frequency = 'as_needed'`, no auto-depletion, notifications off. `feeding_role = null`.

### 5b. Auto-Depletion Cron

`supabase/functions/auto-deplete/index.ts` — 30-min pg_cron schedule.

**Query filter:** `.or('feeding_frequency.eq.daily,auto_deplete_enabled.eq.true')`. So the cron processes:
- Any `daily` item (regardless of `auto_deplete_enabled`)
- Any item with `auto_deplete_enabled = true` (regardless of `feeding_frequency`)

**Rotational items are skipped unless `auto_deplete_enabled = true`** (rare — edge case where user manually opts a rotational item into auto-deduction).

**Per-assignment deduction:** `serving_size × feedings_per_day` converted through the unit pipeline (cups → kg → quantity_unit, with calorie-based or 0.1134 fallback density).

**Idempotency:** `last_deducted_at < todayStartUTC` guard (timezone-agnostic at the day boundary).

**D-161 accumulator integration:** Cron skips rotational items in the per-pet `dailyKcal` accumulation (they're tracked separately via `feeding_log`). After the deduction pass, cron additionally queries `feeding_log` for today's bounds and adds logged kcal to the accumulator — so rotational feedings are reflected in weight-drift tracking.

**Empty/low-stock transitions:** Detected per-item; push notifications sent via Expo Push API. Dead-token cleanup on permanent failures.

### 5c. Log-Driven Feeding (Rotational + As-Needed)

**`FedThisTodaySheet`** (component `src/components/pantry/FedThisTodaySheet.tsx`) — shared bottom sheet. Two entry points:
- **PantryCard "Log feeding" button** — visible when `feeding_frequency === 'as_needed' && !is_empty && !isFedToday && is_active`. Role-agnostic (fires on any as_needed item, not just rotational).
- **EditPantryItemScreen "Fed This Today" Featured Action Card** — same visibility gate (§3b).

Sheet contents: product name + stepper (0.5-unit increments, min 0.5) + computed total kcal + "Log It" CTA. Resolves kcal via `resolveDryKcalPerCup` (for dry/cups/scoops units) or `getWetFoodKcal` (for wet/units). Falls back to `scanWarning()` haptic + error message if kcal can't be computed.

**On submit:** `logWetFeeding({petId, pantryItemId, kcalFed, quantityFed})` in `pantryService` — calls `log_wet_feeding_atomic` RPC. The RPC inserts the feeding_log row AND decrements inventory AND sets `last_deducted_at = NOW()` atomically. On success: `saveSuccess()` haptic + `onSuccess` callback (parent reloads pantry).

**`isFedToday`** signal: derived from `pantry_items.last_deducted_at` being within today's UTC range. Drives PantryCard's green "Fed today" badge (replaces "Log feeding" button) and suppresses re-logging.

**Undo:** `undoWetFeeding(logId)` RPC-backed. Not currently surfaced in UI; available for future retroactive-edit flows.

### 5d. Notifications (D-101)

**Feeding reminders (LOCAL — scheduled on device):**
- Scheduled via `Notifications.scheduleNotificationAsync()` with daily repeating trigger
- Only fires for `feeding_frequency = 'daily' && notifications_on = true`
- "Time for [Pet Name]'s breakfast — [Product] ([size] [unit_label])" — multi-pet grouped
- Works offline, zero server infrastructure
- Rescheduled on: pantry add/remove, feeding time edit, notification toggle, app launch, schedule toggle

**Low stock alert (SERVER — via auto-deplete cron):**
- Weight mode: "Running low — ~[X] days of [Product Name] remaining"
- Unit mode: "Running low — [X] servings of [Product Name] remaining" (unit_label collapsed to 'servings' per D-164)
- Sent once per threshold crossing, not repeatedly

**Empty alert (SERVER — via auto-deplete cron):**
- "[Pet Name]'s [Product Name] is empty" — Restock / Remove actions

**Appointment reminders (LOCAL — scheduled on device):**
- Scheduled via `Notifications.scheduleNotificationAsync()` with one-shot trigger
- "[Pet Name]'s [type] [time_label] at [time]" — multi-pet grouped

All notification copy: D-084 + D-095 compliant.

### 5e. Infrastructure

**Server-side (3 cron Edge Functions):**
- `auto-deplete`: 30-min cron, deducts quantities + sends low stock / empty push notifications + runs caloric accumulator (D-161) + reads `feeding_log` for rotational kcal
- `recall-check`: daily cron, FDA RSS + matching + pantry cross-reference push
- `weekly-digest`: weekly cron, adaptive summary push

**Client-side (2 local notification schedulers):**
- `feedingNotificationScheduler.ts`: daily repeating, multi-pet grouped
- `appointmentNotificationScheduler.ts`: one-shot per reminder interval

**Storage:**
- Push tokens: `push_tokens` table (migration 013)
- Notification preferences: `user_settings` table (migration 014) — per-category boolean toggles + global kill switch
- Local notification IDs: AsyncStorage keyed by assignment/appointment ID

Per-item toggle (`notifications_on` on pantry_pet_assignments) + global toggles (user_settings) + per-category toggles (user_settings).

---

## 6. Calorie Context

### 6a. System Recommendation (D-152, D-160)

Free: current weight DER at maintenance (level 0). Premium: adjusted DER based on `weight_goal_level` (D-160 — 7 levels, -3 to +3). Cat profiles capped at -2 (no -3 option). Pre-fills serving. Fully editable.

### 6b. Behavioral Serving Calculation (`computeBehavioralServing`)

File: `src/utils/pantryHelpers.ts`. Replaces the legacy `computeMealBasedServing` (deleted session 34+).

**Signature:**
```typescript
computeBehavioralServing({
  pet, product, feedingRole, dailyWetFedKcal, dryFoodSplitPct, isPremiumGoalWeight, isInTransition?
}): { amount: number; unit: ServingSizeUnit; basisKcal: number } | null
```

**Branches by feeding_style:**
- `dry_only` + `base` → `budgetedKcal = DER`
- `dry_only` + `rotational` → returns `null` (triggers PantryCard's Log feeding button path — no computed serving, log-driven)
- `dry_and_wet` + `base` → `budgetedKcal = max(0, DER - (dailyWetFedKcal || wet_reserve_kcal))`
- `dry_and_wet` + `rotational` → `budgetedKcal = wet_reserve_kcal || round(DER * 0.25)`
- `wet_only` + `base` → `budgetedKcal = max(0, DER - dailyWetFedKcal)`
- `custom` + `rotational` → returns `null` (Fed This Today logging, no computed serving)
- `custom` + `base` → `budgetedKcal = DER`, then `calorie_share_pct` multiplier applies via `dryFoodSplitPct`

Unit resolution: prefers cups via `resolveDryKcalPerCup` (scraped or derived for dry products), falls back to `kcalPerUnit` (via `resolveCalories`), then `getWetFoodKcal`. Returns `null` if no tier resolves.

### 6c. Depletion Breakdown (D-152)

Live-updating on add sheet. Uses `calculateDepletionBreakdown()` for base items only. Rotational items show no depletion (log-driven).

### 6d. Calorie Context Line on Card

"~X kcal/day of [Pet Name]'s Y kcal target" + "(estimated)" if Atwater. When weight_goal_level != 0 (D-160): append goal label, e.g., "~X kcal/day of [Pet Name]'s Y kcal target (moderate loss)". Not shown for treats/rotational items (they participate via log or reserve, not scheduled share).

### 6e. Paywall (D-153)

Only gate: `canUseGoalWeight()` in `permissions.ts` (gates non-zero weight_goal_level, D-160). Everything else free.

### 6f. Wet Reserve Engine (`refreshWetReserve`)

File: `src/services/pantryService.ts`. Called from 6 sites: addToPantry, removePantryItem, sharePantryItem (twice — add + remove directions), updateCalorieShares, transitionToCustomMode, transitionFromCustomMode.

**Behavior:**
1. Early-return unless `pet.feeding_style === 'dry_and_wet'`.
2. Query all rotational assignments for this pet (filter `is_active = true`, `category = 'daily_food'`, `is_supplemental = false`, `is_vet_diet = false`).
3. For each assignment, compute per-serving kcal: prefer `computePerServingKcal(product, serving_size, serving_size_unit)`; fallback to raw `getWetFoodKcal` with 500 kcal/unit cap (prevents 5-lb freeze-dried bags from skewing the average).
4. Dual-track accumulation (EC-4): weighted by `quantity_remaining` when stocked, unweighted average when all depleted.
5. Source attribution: single source → specific key; multiple → `'blended'`.
6. Write `pets.wet_reserve_kcal` + `wet_reserve_source`.

Non-blocking: failures logged but don't interrupt the calling flow.

### 6g. Base Share Rebalancing (`rebalanceBaseShares`)

File: `src/services/pantryService.ts`. Auto-splits `calorie_share_pct` evenly across all base-role assignments for a pet (2 bases → 50/50, 3 → 33/33/34, last item gets remainder to sum to 100). Also scales `serving_size` proportionally so displayed amounts match new shares.

Called from: addToPantry, removePantryItem, sharePantryItem (both directions).

**Skipped when `feeding_style === 'custom'`** — custom users manage splits manually via `CustomFeedingStyleScreen`.

---

## 7. Multi-Pet Behavior (D-154)

Default: active pet. Share: same-species only. Sharing is naturally gated — requires 2+ pets of the same species. Free users have 1 pet (D-052), so sharing is unreachable without premium. No explicit premium check in code. No `canSharePantryItem()`.

Each pet gets independent serving settings (per-pet `pantry_pet_assignments` row). Depletion sums all base-role pets. Display: "Shared by Buster & Milo · ~13 days remaining."

**Share picker per-pet scores:** SharePantrySheet shows each pet's per-pet score for the shared product next to their name (colored badge via `getScoreColor()`). Score resolved from `pet_product_scores` cache or most recent scan. If no score available for that pet, show "Not scored" in muted text. Different pets may have different scores due to D-129 allergen overrides, breed modifiers, and life stage.

**Share side effects:** On share, `rebalanceBaseShares` + `refreshWetReserve` fire for the target pet (usePantryStore invalidates target's `_petCache` entry in the same transaction that writes the active pet's fresh data).

**No eligible pets:** If no same-species pets exist, sheet opens and shows: "No other [dogs/cats] to share with. Sharing requires 2 or more pets of the same species — dog and cat nutritional needs are fundamentally different."

---

## 8. UI States

### 8a–8b. Empty States

No pet: CTA → CreatePetScreen. Pet, no items: "Scan a product to add it to [Pet Name]'s pantry" + scan CTA.

### 8c. Populated State

Pet carousel → diet completeness banner (conditional) → filter chip bar → sort control → sectioned FlatList (BASE DIET / ROTATIONAL FOODS / TREATS).

**Card anatomy:**
- Product image (56×56) + brand + name (`stripBrandFromName()`)
- Score badge via `getScoreColor()` — or bypass badge (recalled D-158, vet diet, variety pack)
- Metadata row: form+category badge (e.g., "Wet Food") + **Topper badge** when `product.is_supplemental || (isRotational && isAsNeeded && !isTreat)` — teal chip
- Feeding summary using role-aware copy ("2× daily · ½ cup" or "As needed")
- **Depletion progress bar:** 3px, green (>20%) / amber (5–20%) / red (<5%). Not shown for treats, rotational items, or as-needed items.
- Days/units remaining (base items only). Low stock amber indicator. Recalled red badge. Shared indicator.
- Calorie context (muted, 11px). Role-aware per `shouldShowCalorieText` — rotational items contribute via Wet Reserve, so suppress. Base items with 0/null share are ambiguous, also suppress.
- **Horizontal action row** (new in v5): Replace this food + Log feeding coexist side-by-side via `actionButtonsRow` style (flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm). Base+as_needed items surface both (e.g., wet-only pet with single wet food manually toggled off schedule).
- **Fed today badge:** Replaces Log feeding button when `isAsNeeded && !is_empty && isFedToday`. Green `checkmark-circle` + "Fed today" label.
- In Safe Switch locked badge (M9 Phase B): shown when item is anchoring an active Safe Switch. Disables swipe actions.
- Tap → EditPantryItemScreen. Recalled items → RecallDetailScreen.

**Swipe actions** (via SwipeableRow): left swipe reveals Remove (with single/shared flow per §3d). Right swipe reveals Edit. Disabled for In-Safe-Switch locked items.

### 8d. Treats in Pantry

Simplified: image, name, score, "As needed", unit count. NO: progress bar, calorie context, depletion breakdown, days countdown. Treat Battery integration wires "Gave a treat" to deduct quantity + kcal from TreatBatteryGauge (separate from `feeding_log`). `category === 'treat'` shows the "Gave a treat" button; is_supplemental toppers now show "Log feeding" instead (routed through feeding_log, not treat battery).

### 8e. Error States

Offline: writes blocked with toast ("Connect to the internet to update your pantry"). Reads cached from Zustand + SWR pattern (`_petCache`). No sync queue — v1 simplification. Score missing: card without badge. Product removed from DB: "Product no longer available."

### 8f. FeedingIntentSheet UI

New component `src/components/pantry/FeedingIntentSheet.tsx` (migration 039 companion). Mirrors `FeedingStyleSetupSheet` anatomy:

- Full-screen Modal with slide animation
- Overlay pressable (tap to dismiss — but dismiss cancels the entire add flow, see §3a)
- Header: "How will {petName} eat this?" + subtitle "This affects how we track feedings and portions."
- Two option cards (Matte Premium `cardSurface` + `hairlineBorder` + `chipSurface` icon box):
  - **Regular meal** — `restaurant-outline` icon, subtitle "This is a main meal for {petName}. I'll feed it on a schedule."
  - **Just a topper or extra** — `add-circle-outline` icon, subtitle "I'll add it on top of {petName}'s dry food occasionally. I'll log when I feed it."
- `chipToggle()` haptic on press

### 8g. FedThisTodaySheet UI

Shared sheet used by PantryCard "Log feeding" button and EditPantryItem "Fed This Today" Featured Action Card.

- Product name + stepper (0.5-unit increments, min 0.5, max unbounded)
- Amount Fed display (singularized unit label — "serving" vs "servings", "can/pouch" vs "cans/pouches")
- Computed total kcal preview ("This will log X kcal for today.")
- "Log It" primary CTA
- On success: `saveSuccess()` haptic + parent's `onSuccess` callback (closes sheet, reloads pantry)

---

## 9. Gram Toggle (D-149 Extension)

Cups ↔ grams on PortionCard. Math: `grams = cups × (kcal_per_cup / kcal_per_kg) × 1000`. Available only when both kcal values resolve. Preference persisted. Display-layer only.

---

## 10. Edge Cases

| Scenario | Behavior |
|---|---|
| Duplicate UPC | "Already in pantry. Restock instead?" |
| Score changes | Live read on render (D-156), no snapshot |
| Pet deleted | CASCADE assignments + feeding_log rows. No-assignment items soft-deleted. |
| Product recalled in pantry | Red badge, no score (D-158), top of list, push notification |
| 50+ items | FlatList pagination (25/page) |
| Bypassed product in pantry | Badge, no score, countdown works for base items |
| Supplemental-only pantry (legacy is_supplemental=true without matching intent) | Amber warning banner |
| Weight change → DER change | Recommendation updates; serving amounts unchanged; accumulator resets (D-161) |
| Remove one of two daily foods | `rebalanceBaseShares` re-splits remaining bases. D-157 nudge also shown. |
| Atwater-estimated calories | "(estimated)" indicator. Math unchanged. |
| Quantity race condition | Floor at 0. `MAX(0, remaining - deduction)` in cron, `GREATEST(0, ...)` in log_wet_feeding_atomic RPC |
| Offline write | Blocked with toast: "Connect to the internet to update your pantry." Reads from Zustand cache. No sync queue (v1). |
| Nursing pet <4 weeks (D-151) | Suppress recommendation, breakdown, schedule |
| Treats | No progress bar, calorie context, depletion breakdown, or days |
| Recalled product scanned | D-158 bypass on ResultScreen. Add-to-pantry still available. |
| Product recalled while in pantry | Recall Siren flips `is_recalled = true` → pantry card updates on next render (live read per D-156) → push notification sent to affected users. No manual action needed. |
| FeedingIntentSheet dismissed (tap-outside or back) | Closes the entire AddToPantrySheet. Does NOT persist `wet_intent_resolved_at`. Next add attempt re-fires the intercept. |
| Contradictory "Regular meal" → picked dry_only in FeedingStyleSetupSheet | `wet_intent_resolved_at` already set by the Regular meal handler. `feeding_style` stays `dry_only`. Subsequent wet adds route as `rotational` (honors the persisted intent via `inferAssignmentDefaults` dry_only+resolved branch). |
| feeding_style change while toppers exist | `petService.updatePet` nulls `wet_intent_resolved_at`. Existing rotational items stay rotational (their feeding_role is independent of pet.feeding_style). Next wet add re-fires the intercept. |
| dry_only pet with only toppers + no base | Diet completeness returns `info` status with topper-aware copy (§4). User must add a dry base to reach `complete`. |
| Multiple rotational items on dry_only pet | Unlimited — no cap. Each topper is log-driven and doesn't shrink dry anchor (refreshWetReserve early-returns for dry_only). |
| Custom mode + rotational item added | Defaults to `rotational + as_needed + auto_deplete=false`; user can tweak via `CustomFeedingStyleScreen`. `rebalanceBaseShares` skipped (custom mode owns splits). |
| intentForcedTopper + computed base serving | Persist-time override: `effectiveServingSize` falls back to `manualServingSize` (default 1) so the topper doesn't persist a misleading multi-unit "serving" from the base-DER autoServingResult. |
| Migration 039 backfill edge case | Pets with only soft-deleted (`is_active = false`) cross-format items are NOT marked resolved by the backfill. Intercept fires on their next add. Intentional. |
| Topper on dry_and_wet pet | Routes as rotational + as_needed. `refreshWetReserve`'s query filter (`is_supplemental = false`) excludes it from the wet reserve average — topper doesn't shrink the dry base. Topper badge still renders on the card. |
| wet_only pet adds dry product | `FeedingStyleSetupSheet` opens directly (legacy flow, preserved). Session-scoped via `hasShownWetOnlyDryPrompt`. Not converted to the new intercept — this is a diet shift, not a topper decision. |

---

## 11. Boundary Clarification

| Concern | Owner | Not Pantry |
|---|---|---|
| Scoring | engine.ts | ✓ reads, never computes |
| Recalled bypass | pipeline.ts (D-158) | ✓ reads flag |
| Scan history | scans table | ✓ remove ≠ delete scan |
| Safe Swap | M6 | ✓ feeds data, doesn't recommend |
| Safe Switch anchoring | safeSwitchService, safe_switches.pantry_item_id | ✓ provides anchor, atomic swap via RPC |
| Portion recommendation | computePetDer + computeBehavioralServing | ✓ displays at add-time, stores user's actual |
| Treat Battery kcal | useTreatBatteryStore | ✓ tracks inventory; Battery tracks budget |
| Recall detection | Recall Siren pipeline | ✓ surfaces, doesn't detect |
| Push delivery | Edge Functions (deplete/recall/digest) + local schedulers (feeding/appointment) | ✓ stores schedule, infrastructure sends |
| Diet completeness | pantryService.evaluateDietCompleteness | ✓ owned, but NOT a score modifier |
| Wet intent persistence | pets.wet_intent_resolved_at + AddToPantrySheet handlers | ✓ owned; petService.updatePet auto-resets on feeding_style change |
| Wet Reserve computation | pantryService.refreshWetReserve | ✓ owned; called from 6 lifecycle sites |
| Base share rebalancing | pantryService.rebalanceBaseShares | ✓ owned; skipped in custom mode |
| Feeding log | feeding_log + log_wet_feeding_atomic RPC | ✓ owned; read by auto-deplete cron for D-161 accumulator |

---

## 12. Test Requirements

**Core operations (v1–v4 — all still passing):**
- [x] Add product — stored with pet assignment and quantity
- [x] Auto-detect serving mode from `product_form`
- [x] System recommendation with/without calorie data, with/without goal weight
- [x] Fractional serving: ¼=0.25, ⅓=0.3333, ½=0.5, ⅔=0.6667, ¾=0.75
- [x] Depletion breakdown: weight mode with/without calorie data
- [x] Depletion breakdown: rotational → null (not shown)
- [x] Depletion breakdown: live updates on input change
- [x] Remove: soft delete, scan history preserved
- [x] Remove shared: "all pets" vs "one pet"
- [x] Remove daily food with remaining → D-157 nudge shown + rebalanceBaseShares fires
- [x] Restock: resets quantity, reactivates empty
- [x] Duplicate UPC → restock prompt
- [x] Species mismatch blocks add (D-144)
- [x] Per-pet isolation on pet switch
- [x] RLS: user A ≠ user B
- [x] RLS: assignments scoped through pantry_items.user_id
- [x] RLS: feeding_log scoped via user_id
- [x] Bypassed products: badge, no score, countdown works
- [x] Recalled: no score, red badge, top of list, tap → RecallDetailScreen (D-158)
- [x] Topper badge on `is_supplemental` items
- [x] Topper badge on rotational + as_needed + non-treat items (intent-routed)
- [x] Filter chips filter correctly
- [x] Sort menu changes order
- [x] Progress bar: correct color thresholds, hidden for treats/rotational/as-needed
- [x] Diet completeness: complete / info / amber_warning / red_warning (four tiers correct)
- [x] Diet completeness: dry_only + rotational-only + zero base → info with topper-aware copy
- [x] Low stock at ≤5 days/units
- [x] Empty at 0: grayed, bottom, notification sent (D-155)
- [x] Edit screen recalled state: feeding/schedule disabled (40%), restock/share hidden, "View Recall Details" shown
- [x] Edit screen empty state: feeding/schedule muted (60%), restock primary action, depletion shows "Empty"
- [x] Auto-depletion: daily ticks (via feeding_frequency OR auto_deplete_enabled)
- [x] Auto-depletion: rotational skipped unless auto_deplete_enabled
- [x] Auto-depletion: D-161 accumulator reads feeding_log for rotational kcal
- [x] Shared depletion sums all base-role pets
- [x] Sharing: same-species only, naturally gated by D-052 pet limit (no explicit premium check)
- [x] Share picker shows per-pet scores next to pet names
- [x] Share sheet shows species message when no eligible pets exist
- [x] Paywall: only canUseGoalWeight() in permissions.ts (D-153)
- [x] Empty states: no pet, no items (two variants)
- [x] Offline: writes blocked with toast, reads cached from Zustand
- [x] Pet deletion cascades correctly (assignments + feeding_log)
- [x] Gram toggle: visible/hidden, preference persisted
- [x] Nursing <4 weeks: suppress recommendation + breakdown + schedule (D-151)
- [x] Score = live read, not snapshot (D-156)
- [x] Quantity floors at 0 (both cron and RPC)
- [x] Treats: no progress bar, calorie context, depletion breakdown, or days
- [x] Local feeding notifications: schedule, cancel, reschedule on changes
- [x] Local appointment notifications: schedule at correct reminder interval

**Behavioral Feeding additions (v5):**
- [x] `feeding_style` default on new pets = 'dry_only'
- [x] `feeding_role` routing: inferAssignmentDefaults matrix (treat/topper/supplement × feeding_style)
- [x] `auto_deplete_enabled` driven by schedule toggle (daily → true, as_needed → false)
- [x] `refreshWetReserve` computes weighted average for dry_and_wet pets
- [x] `refreshWetReserve` early-returns for non-dry_and_wet styles
- [x] `refreshWetReserve` excludes is_supplemental items (toppers don't shrink dry base on mixed pets)
- [x] `rebalanceBaseShares` splits calorie_share_pct evenly + scales serving_size
- [x] `rebalanceBaseShares` skipped in custom mode
- [x] `computeBehavioralServing` for all 4 feeding_styles + both roles + edge cases
- [x] `computeBehavioralServing` returns null for dry_only + rotational (Log feeding path)
- [x] `computeBehavioralServing` returns null for custom + rotational
- [x] `log_wet_feeding_atomic` RPC inserts + decrements atomically, sets last_deducted_at
- [x] `undo_wet_feeding_atomic` RPC re-increments + deletes log row

**Wet Food Extras Path additions (v5):**
- [x] Migration 039 applies cleanly with IF NOT EXISTS
- [x] Migration 039 backfill marks pre-existing non-dry_only pets as resolved
- [x] Migration 039 backfill marks pets with active cross-format pantry items as resolved
- [x] `shouldShowFeedingIntentSheet` predicate matrix (6 conjunction tests)
- [x] FeedingIntentSheet renders 2 cards with pet name in header
- [x] FeedingIntentSheet tap "Regular meal" invokes onRegularMeal only
- [x] FeedingIntentSheet tap "Just a topper or extra" invokes onTopperExtras only
- [x] FeedingIntentSheet dismiss closes entire AddToPantrySheet (no persistence)
- [x] `intentForcedTopper` overrides inferAssignmentDefaults for the current add
- [x] `intentForcedTopper` bypasses autoServingResult (defaults to manualServingSize)
- [x] `inferAssignmentDefaults` honors prior topper intent (dry_only + resolved → rotational)
- [x] `inferAssignmentDefaults` null-intent falls back to base (intercept is the guard)
- [x] `petService.updatePet` resets wet_intent_resolved_at on feeding_style change
- [x] `petService.updatePet` skips reset when caller explicitly includes wet_intent_resolved_at
- [x] `petService.updatePet` skips reset when feeding_style isn't actually changing
- [x] wet_only + dry direction still opens FeedingStyleSetupSheet directly (legacy preserved)

**EditPantryItem v5 additions:**
- [x] `handleFrequencyToggle` wires auto_deplete_enabled
- [x] `handleFrequencyToggle` sets notifications_on to false when toggling to as_needed
- [x] `handleFrequencyToggle` leaves notifications_on untouched when toggling to daily
- [x] `shouldShowFedTodayCard` visibility matrix (frequency × isEmpty × isActive × isRecalled)
- [x] Fed This Today Featured Action Card taps open FedThisTodaySheet
- [x] FedThisTodaySheet onSuccess triggers loadPantry refresh

**PantryCard v5 additions:**
- [x] Log feeding button visible for as_needed items (role-agnostic, not just rotational)
- [x] Topper badge renders for is_supplemental products
- [x] Topper badge renders for rotational + as_needed + non-treat items
- [x] Replace this food + Log feeding render in horizontal row when both visible

---

## 13. Decision Dependencies

| Decision | Summary | Status |
|---|---|---|
| D-052 | Multi-pet premium gate | Locked |
| D-065 | Bag/pack countdown + low stock nudge | Locked |
| D-084 | Zero emoji policy | Locked |
| D-094 | Score framing — "[X]% match for [Pet Name]" | Locked |
| D-095 | UPVM compliance / Clinical Copy Rule | Locked |
| D-101 | Feeding schedule + auto-depletion + notifications | Locked |
| D-103 | Pet appointments (bundled in M5, separate spec) | Locked |
| D-124 | Treat logging entry points | Locked |
| D-125 | Recalls not paywalled | Locked |
| D-129 | Allergen severity override (per-pet scores) | Locked |
| D-130 | Weekly digest (reads pantry state) | Locked |
| D-135 | Vet diet bypass — no score, can exist in pantry | Locked |
| D-136 | Supplemental classification + diet completeness | Locked |
| D-144 | Species mismatch bypass — blocks add-to-pantry | Locked |
| D-145 | Variety pack bypass — can exist in pantry | Locked |
| D-146 | Supplemental name detection (runtime) | Locked |
| D-149 | Atwater calorie estimation fallback | Locked |
| D-150 | Life stage mismatch warning | Locked |
| D-151 | Nursing advisory — suppress feeding calcs | Locked |
| D-152 | Depletion model — system recommends, user adjusts, breakdown line | Locked |
| D-153 | Paywall scope — goal weight DER only | Locked |
| D-154 | Sharing rules — active pet default, same-species, naturally gated by D-052 pet limit | Locked |
| D-155 | Empty behavior — gray, sink, Restock/Edit/Remove, notification | Locked |
| D-156 | Score source — live read, not snapshot | Locked |
| D-157 | Mixed feeding removal — no auto-rebalance, contextual nudge | Locked |
| D-158 | Recalled product bypass — no score, same pattern as vet diet | Locked |
| D-160 | Weight goal slider — replaces raw goal weight (D-061), 7 levels, cat cap at -2, pantry DER integration | Locked |
| D-161 | Caloric accumulator — estimated weight tracking via auto-deplete cron, notify-and-confirm. Reads feeding_log for rotational kcal. | Locked |
| D-164 | Unit label simplification — collapsed cans/pouches/units to single 'servings' value | Locked |
| D-165 | Calorie-budget-aware serving recommendations — auto/manual toggle in AddToPantrySheet | Locked |
| D-166 | Weight unit auto-conversion + cups conversion helper | Locked |
| D-167 | Condition-aware feeding frequency | Locked |
