# Kiba — Pantry Spec

> **Status:** LOCKED v4
> **Applies to:** M5 Pantry feature — product management, bag/pack countdown, feeding schedules, diet completeness, recall surfacing. Excludes: Safe Swap recommendations (M6), Kiba Index voting (M8), Symptom Detective (M9), Elimination Diet (M16+), D-159 low-score feeding context line (M5+ polish — not in core M5 sessions).
> **Prerequisite:** M4.5 complete (641 tests, 32 suites), pet profiles exist, `is_supplemental` backfilled (D-136), `product_form` column populated (migration 010), `resolveCalories()` available (D-149), `stripBrandFromName()` available, MetadataBadgeStrip component exists.
>
> **Changelog:**
> - March 19, 2026 v1: Initial spec from design discussions.
> - March 19, 2026 v2: D-152–D-158, depletion breakdown, filter bar, progress bar, dynamic unit labels, treats excluded, D-157 nudge, D-158 bypass.
> - March 19, 2026 v3: Local notifications for feeding/appointment reminders (not server cron). Offline writes blocked (no sync queue). Treat Battery moved from polish to Phase 2. Migrations split: 013 push_tokens, 014 user_settings. Low stock notification uses unit_label for unit-mode.
> - March 19, 2026 v4: Mockup review patches — §3b expanded with recalled/empty edit states, §7 share gating changed from explicit premium check to natural D-052 pet limit, per-pet scores in share picker, D-159 excluded from core M5 scope.

---

## 0. Context: Where This Fits

Pantry is M5's anchor feature and Kiba's #1 retention mechanism. Feeding notifications create 730+ annual lock-screen touchpoints. Every "Running low" nudge is a natural re-engagement moment. Combined with pet appointments (D-103) and recall alerts (D-125), M5 transforms Kiba from a scanner opened at the store into daily-use pet care infrastructure.

Pantry unlocks downstream features: Safe Swap recommendations (M6) query the pantry to suggest replacements for low-scoring items. Diet completeness warnings (D-136 Part 5) require knowing what's in the pantry. Weekly digest (D-130) summarizes pantry state.

| System | Relationship to Pantry |
|---|---|
| Scan → Score flow | "Add to Pantry" CTA on ResultScreen. Product defaults to active pet. |
| Pet Profiles | Pantry is per-pet. Switching active pet switches pantry view. Multi-pet sharing requires 2+ pets (D-052 pet limit gates naturally). Uses `pantry_pet_assignments`. |
| Scoring Engine | Pantry does NOT re-score. Reads score from `pet_product_scores` cache (Top Matches) or `scans.final_score` fallback. |
| Portion Calculator | M2's `calculateDER()` provides calorie target for system recommendation. `resolveCalories()` (D-149) provides per-product calorie data. System recommends; user adjusts. |
| Recall Siren | Recall Siren pipeline writes `is_recalled = true` on products. Recalled products are a pipeline bypass (D-158) — no score computed. Pantry surfaces recall badge and links to RecallDetailScreen. |
| Safe Swap (M6) | Future — pantry feeds "what the pet currently eats" to the recommendations engine. |
| Top Matches | `pet_product_scores` cache provides per-pet score data for pantry display. If cache miss, falls back to most recent scan score. |
| Weekly Digest (D-130) | Reads pantry state for "Running low" and "Empty" items in weekly summary push. |

---

## 1. Data Model

### 1a. Tables

```sql
-- Migration 011: Pantry tables
CREATE TABLE pantry_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity_original   DECIMAL(10,2) NOT NULL,
  quantity_remaining  DECIMAL(10,2) NOT NULL,
  quantity_unit       TEXT NOT NULL CHECK (quantity_unit IN ('lbs', 'oz', 'kg', 'g', 'units')),
  serving_mode        TEXT NOT NULL CHECK (serving_mode IN ('weight', 'unit')),
  unit_label          TEXT DEFAULT 'units' CHECK (unit_label IN ('cans', 'pouches', 'units')),
  added_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active           BOOLEAN NOT NULL DEFAULT true,
  last_deducted_at    TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE pantry_pet_assignments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pantry_item_id      UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  pet_id              UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  serving_size        DECIMAL(8,4) NOT NULL,
  serving_size_unit   TEXT NOT NULL CHECK (serving_size_unit IN ('cups', 'scoops', 'units')),
  feedings_per_day    SMALLINT NOT NULL DEFAULT 2,
  feeding_frequency   TEXT NOT NULL DEFAULT 'daily' CHECK (feeding_frequency IN ('daily', 'as_needed')),
  feeding_times       JSONB,
  notifications_on    BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pantry_item_id, pet_id)
);
```

**`unit_label`** (D-152): User-selected in add-to-pantry sheet ("cans" or "pouches"). Carries through to depletion breakdown, pantry card display, and notifications. Never hardcoded to "units."

**Computed values (not stored):**
- `daily_consumption = serving_size × feedings_per_day` (per pet per item)
- `total_daily_consumption = SUM(daily_consumption)` across all assigned pets
- `days_remaining = quantity_remaining / total_daily_consumption` (daily items only)
- `calorie_context = daily_consumption × kcal_per_serving` (informational only)

### 1b. Relationships

```
auth.users ──< pantry_items ──< pantry_pet_assignments >── pets
                    │
                    └── products (FK: product_id)
```

- Pet deletion cascades through assignments but does NOT delete the pantry_item (other pets may share it)

### 1c. RLS Rules

```sql
-- pantry_items: user_id = auth.uid()
-- pantry_pet_assignments: scoped through pantry_items.user_id
```

### 1d. Indexes

- `idx_pantry_items_user_active` ON (user_id, is_active) WHERE is_active = true
- `idx_pantry_assignments_pet` ON (pet_id)
- `idx_pantry_items_product` ON (product_id) WHERE is_active = true

---

## 2. Product States in Pantry

| State | Condition | UI Treatment | Sort |
|---|---|---|---|
| **Recalled** | `is_recalled = true` | Red badge, no score (D-158 bypass), tap → RecallDetailScreen | 1 (top) |
| **Active** | Default, above low stock threshold | Normal card, progress bar | 2 |
| **Low stock** | ≤5 days or ≤5 units | Amber "Running low" + affiliate buy button | 3 |
| **Empty** | `quantity_remaining = 0` | 40% opacity, "Empty", Restock/Edit/Remove (D-155) | 4 (bottom) |
| **Bypassed** | Vet diet / variety pack / recalled | Bypass badge, no score. Countdown still works. | Per state |
| **Stale** | `last_verified_at` > 90 days | Muted "Score may be outdated" | Normal |

### Pipeline Bypass Chain (D-158)

```
vet diet (D-135) → species mismatch (D-144) → recalled (D-158) → variety pack (D-145) → supplemental (D-146, scored) → normal
```

---

## 3. Core Operations

### 3a. Add to Pantry

**Entry points:** ResultScreen CTA, Me tab "Log a Treat" (D-124)

**Add-to-pantry sheet (bottom sheet):**
1. Product image + brand + name (read-only)
2. Serving mode toggle — auto-detected from `product_form`, user can override
3. **Weight-based inputs:** Bag size (lbs/oz/kg/g), cups per feeding, feedings/day stepper
4. **Unit-based inputs:** Total count + unit picker (**cans / pouches** — dynamic label stored in `unit_label`), fractional chips (¼ ⅓ ½ ⅔ ¾ 1 1½ 2 + custom), feedings/day stepper
5. **Treats:** Simplified — unit mode, total count, default "As needed", no depletion breakdown, no calorie context. Treat Battery integration in Phase 2 (Session 10).
6. **Depletion math breakdown** (D-152, live-updating):
   - Unit: "½ can × 2 feedings = 1 can/day · ~24 days" (label from `unit_label`)
   - Weight with calories: "1.5 cups × 2 = 3 cups/day · ~42 days" (via `kcal_per_cup` + `kcal_per_kg`)
   - Weight without calories: "1.5 cups × 2 = 3 cups/day" (no days)
   - Treats: not shown
7. System recommendation (when calorie data available): "Recommended: ~X cups/day based on [Pet Name]'s profile" — goal weight DER for premium (D-153)
8. Calorie context: "~X kcal/day of [Pet Name]'s Y kcal target" — not shown for treats
9. Confirm: "Add to [Pet Name]'s Pantry"

**Defaults:** Active pet only (D-154). Bag size required. Serving pre-filled from recommendation if available. Feedings: 2 for food, 1 for treats.

**Deduplication:** Same UPC → "Already in pantry. Restock instead?"

**Blocked:** Species mismatch → toast. Variety pack → allowed (tracking only).

### 3b. Edit

**Screen:** `EditPantryItemScreen` — full-screen edit, navigated from PantryCard tap.

**Editable fields:**
- Quantity remaining (number + unit selector matching original unit)
- Original bag/pack size (for Restock target)
- Serving size per feeding
- Feedings per day (stepper: 1, 2, 3)
- Unit label (cans ↔ pouches — unit mode items only)
- Feeding schedule: Daily ↔ As needed toggle
- Notification times (clock time pickers, only when daily)
- Notifications on/off toggle

**NOT editable:** product itself, product image, score.

**Auto-save:** saves on field change (no explicit save button). Uses `updatePantryItem()` and `updatePetAssignment()`.

**Depletion summary:** live-updating breakdown line matching add-to-pantry sheet format.

**Actions at bottom:**
- "Restock" button (resets to original quantity)
- "Share with other pets" (opens SharePantrySheet — no premium badge)
- "Remove from Pantry" (with single/shared removal flow per §3d)

**Recalled item edit behavior (D-158):**
- Quantity section: editable (user may need to track amount for return/refund)
- Feeding section: disabled, muted at 40% opacity, not interactive
- Schedule section: disabled, muted at 40% opacity, not interactive
- Depletion breakdown: not shown
- "View Recall Details" link shown above actions → navigates to RecallDetailScreen
- Actions: Remove from Pantry only. Restock and Share hidden.

**Empty item edit behavior (D-155):**
- Quantity section: editable (user can manually enter remaining if bag isn't truly empty)
- Feeding section: muted at 60% opacity (editable but de-emphasized — settings preserved for restock)
- Schedule section: muted at 60% opacity (same — preserved for restock)
- Depletion breakdown: shows "Empty" instead of days remaining
- Actions: Restock is primary (accent fill, not outlined). Share and Remove shown normally.

### 3c. Restock

Resets `quantity_remaining` to `quantity_original`. Reactivates empty items. Preserves settings.

### 3d. Remove

Single-pet: confirm → soft delete. Shared: "Remove for all" or "Remove for [Pet Name] only."

**Mixed feeding removal (D-157):** When removing a daily food with ≥1 other daily food remaining, show nudge: "[Pet Name]'s daily intake from pantry items has changed." No auto-rebalance. Calorie context on remaining cards shows the gap.

### 3e. View Pantry

**Filter chip bar:** All | Dry | Wet | Treats | Supplemental | Recalled | Running Low. Color conventions: Supplemental = teal, Recalled = red, Running Low = amber. Sort menu: Default (state-based) | Name | Score | Days Remaining.

**Default sort:** Recalled → Active → Low stock → Empty. Within groups: newest first.

---

## 4. Diet Completeness

Computed at read-time. Per-pet. NOT stored. NOT a score modifier.

| Situation | Severity | Banner |
|---|---|---|
| ≥1 complete food | None | "Topper" tag on supplementals |
| 2+ supplemental, no complete food | Amber | "[Pet Name]'s diet may be missing essential nutrients..." |
| Only supplementals, zero complete | Red | "No complete meals found in [Pet Name]'s diet..." |
| Only treats, no food | Red | "No meals found in [Pet Name]'s pantry..." |

All copy D-095 compliant. Does NOT do: nutrient gap analysis, caloric adequacy, portion recommendations, product recommendations.

---

## 5. Feeding Schedule & Auto-Depletion

### 5a. Defaults

Daily food: daily, 2×/day, 7:00 AM + 6:00 PM, notifications on. Treats/supplements: as_needed, no auto-depletion, notifications off.

### 5b. Auto-Depletion

Daily items: cron deducts `serving_size` at each feeding time. Shared items: each pet's serving deducted independently. Empty → push notification (D-155).

As-needed items: no automatic depletion. Manual "Used one" / "Gave a treat" optional.

### 5c. Notifications (D-101)

**Feeding reminders (LOCAL — scheduled on device):**
- Scheduled via `Notifications.scheduleNotificationAsync()` with daily repeating trigger
- "Time for [Pet Name]'s breakfast — [Product] ([size] [unit_label])" — multi-pet grouped
- Works offline, zero server infrastructure
- Rescheduled on: pantry add/remove, feeding time edit, notification toggle, app launch

**Low stock alert (SERVER — via auto-deplete cron):**
- Weight mode: "Running low — ~[X] days of [Product Name] remaining"
- Unit mode: "Running low — [X] [unit_label] of [Product Name] remaining" (e.g., "3 cans" not "3 units")
- Sent once per threshold crossing, not repeatedly

**Empty alert (SERVER — via auto-deplete cron):**
- "[Pet Name]'s [Product Name] is empty" — Restock / Remove actions

**Appointment reminders (LOCAL — scheduled on device):**
- Scheduled via `Notifications.scheduleNotificationAsync()` with one-shot trigger
- "[Pet Name]'s [type] [time_label] at [time]" — multi-pet grouped
- Works offline, zero server infrastructure

All notification copy: D-084 + D-095 compliant. Unit labels use `unit_label` column.

### 5d. Infrastructure

**Server-side (3 cron Edge Functions):**
- `auto-deplete`: 30-min cron, deducts quantities + sends low stock / empty push notifications
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

### 6a. System Recommendation (D-152)

Free: current weight DER. Premium with goal weight: goal weight DER (D-153). Pre-fills serving. Fully editable.

### 6b. Depletion Breakdown (D-152)

Live-updating on add sheet. Uses `calculateDepletionBreakdown()`.

| Mode | With Calories | Without Calories |
|---|---|---|
| Unit (cans/pouches) | "½ can × 2 = 1 can/day · ~24 days" | Always computable |
| Weight (cups) | "1.5 cups × 2 = 3 cups/day · ~42 days" | Rate only, no days |
| Treats | Not shown | Not shown |

Weight mode days: `total_cups = (bag_kg × kcal_per_kg) / kcal_per_cup`. Requires both kcal values.

### 6c. Calorie Context Line on Card

"~X kcal/day of [Pet Name]'s Y kcal target" + "(estimated)" if Atwater. Not shown for treats.

### 6d. Paywall (D-153)

Only gate: `canUseGoalWeight()` in `permissions.ts`. Everything else free.

---

## 7. Multi-Pet Behavior (D-154)

Default: active pet. Share: same-species only. Sharing is naturally gated — requires 2+ pets of the same species. Free users have 1 pet (D-052), so sharing is unreachable without premium. No explicit premium check in code. No `canSharePantryItem()`.

Each pet gets independent serving settings. Depletion sums all assigned pets. Display: "Shared by Buster & Milo · ~13 days remaining."

**Share picker per-pet scores:** SharePantrySheet shows each pet's per-pet score for the shared product next to their name (colored badge via `getScoreColor()`). Score resolved from `pet_product_scores` cache or most recent scan. If no score available for that pet, show "Not scored" in muted text. Different pets may have different scores due to D-129 allergen overrides, breed modifiers, and life stage.

**No eligible pets:** If no same-species pets exist, sheet opens and shows: "No other [dogs/cats] to share with. Sharing requires 2 or more pets of the same species — dog and cat nutritional needs are fundamentally different."

---

## 8. UI States

### 8a–8b. Empty States

No pet: CTA → CreatePetScreen. Pet, no items: "Scan a product to add it to [Pet Name]'s pantry" + scan CTA.

### 8c. Populated State

Filter chip bar → diet completeness banner (conditional) → FlatList of PantryCards.

**Card anatomy:**
- Product image (56×56) + brand + name (`stripBrandFromName()`)
- Score badge via `getScoreColor()` — or bypass badge (recalled D-158, vet diet, variety pack)
- Category/form badge + supplemental teal badge
- Feeding summary using `unit_label` ("2× daily · ½ can" or "As needed")
- **Depletion progress bar:** 3px, green (>20%) / amber (5–20%) / red (<5%). Not shown for treats or as-needed items.
- Days/units remaining. Low stock amber indicator. Recalled red badge. Shared indicator.
- Calorie context (muted, 11px). Not shown for treats.
- Tap → EditPantryItemScreen. Recalled items → RecallDetailScreen.

### 8d. Treats in Pantry

Simplified: image, name, score, "As needed", unit count. NO: progress bar, calorie context, depletion breakdown, days countdown. Treat Battery integration in Phase 2 (Session 10) — wires "Gave a treat" to deduct quantity + kcal from TreatBatteryGauge. Phase 2 adds a "Gave a treat" button on treat pantry cards (small, below unit count).

### 8e. Error States

Offline: writes blocked with toast ("Connect to the internet to update your pantry"). Reads cached from Zustand. No sync queue — v1 simplification. Score missing: card without badge. Product removed from DB: "Product no longer available."

---

## 9. Gram Toggle (D-149 Extension)

Cups ↔ grams on PortionCard. Math: `grams = cups × (kcal_per_cup / kcal_per_kg) × 1000`. Available only when both kcal values resolve. Preference persisted. Display-layer only.

---

## 10. Edge Cases

| Scenario | Behavior |
|---|---|
| Duplicate UPC | "Already in pantry. Restock instead?" |
| Score changes | Live read on render (D-156), no snapshot |
| Pet deleted | CASCADE assignments. No-assignment items soft-deleted. |
| Product recalled in pantry | Red badge, no score (D-158), top of list, push notification |
| 50+ items | FlatList pagination (25/page) |
| Bypassed product in pantry | Badge, no score, countdown works |
| Supplemental-only pantry | Diet completeness warning fires |
| Weight change → DER change | Recommendation updates; serving amounts unchanged |
| Remove one of two daily foods | No auto-rebalance (D-157). Nudge shown. |
| Atwater-estimated calories | "(estimated)" indicator. Math unchanged. |
| Quantity race condition | Floor at 0. `MAX(0, remaining - deduction)` |
| Offline write | Blocked with toast: "Connect to the internet to update your pantry." Reads from Zustand cache. No sync queue (v1). |
| Nursing pet <4 weeks (D-151) | Suppress recommendation, breakdown, schedule |
| Treats | No progress bar, calorie context, depletion breakdown, or days |
| Recalled product scanned | D-158 bypass on ResultScreen. Add-to-pantry still available. |
| Product recalled while in pantry | Recall Siren flips `is_recalled = true` → pantry card updates on next render (live read per D-156) → push notification sent to affected users. No manual action needed. |

---

## 11. Boundary Clarification

| Concern | Owner | Not Pantry |
|---|---|---|
| Scoring | engine.ts | ✓ reads, never computes |
| Recalled bypass | pipeline.ts (D-158) | ✓ reads flag |
| Scan history | scans table | ✓ remove ≠ delete scan |
| Safe Swap | M6 | ✓ feeds data, doesn't recommend |
| Portion recommendation | calculateDER() | ✓ displays at add-time, stores user's actual |
| Treat Battery kcal | Phase 2 (Session 10) | ✓ tracks inventory; Battery tracks budget |
| Recall detection | Recall Siren pipeline | ✓ surfaces, doesn't detect |
| Push delivery | Edge Functions (deplete/recall/digest) + local schedulers (feeding/appointment) | ✓ stores schedule, infrastructure sends |
| Diet completeness | pantry service | ✓ owned, but NOT a score modifier |

---

## 12. Test Requirements

- [ ] Add product — stored with pet assignment and quantity
- [ ] Auto-detect serving mode from `product_form`
- [ ] Unit label picker (cans/pouches) stores and propagates correctly
- [ ] System recommendation with/without calorie data, with/without goal weight
- [ ] Fractional serving: ¼=0.25, ⅓=0.3333, ½=0.5, ⅔=0.6667, ¾=0.75
- [ ] Depletion breakdown: unit mode cans, pouches (correct label)
- [ ] Depletion breakdown: weight mode with/without calorie data
- [ ] Depletion breakdown: treats → null (not shown)
- [ ] Depletion breakdown: live updates on input change
- [ ] Remove: soft delete, scan history preserved
- [ ] Remove shared: "all pets" vs "one pet"
- [ ] Remove daily food with remaining → D-157 nudge shown
- [ ] Restock: resets quantity, reactivates empty
- [ ] Duplicate UPC → restock prompt
- [ ] Species mismatch blocks add (D-144)
- [ ] Per-pet isolation on pet switch
- [ ] RLS: user A ≠ user B
- [ ] RLS: assignments scoped through pantry_items.user_id
- [ ] Bypassed products: badge, no score, countdown works
- [ ] Recalled: no score, red badge, top of list, tap → RecallDetailScreen (D-158)
- [ ] Supplemental badge on is_supplemental items
- [ ] Filter chips filter correctly
- [ ] Sort menu changes order
- [ ] Progress bar: correct color thresholds, hidden for treats/as-needed
- [ ] Diet completeness: no warning / amber / red (three tiers correct)
- [ ] Low stock at ≤5 days/units
- [ ] Empty at 0: grayed, bottom, notification sent (D-155)
- [ ] Edit screen recalled state: feeding/schedule disabled (40%), restock/share hidden, "View Recall Details" shown
- [ ] Edit screen empty state: feeding/schedule muted (60%), restock primary action, depletion shows "Empty"
- [ ] Auto-depletion: daily ticks, as-needed doesn't
- [ ] Shared depletion sums all pets
- [ ] Sharing: same-species only, naturally gated by D-052 pet limit (no explicit premium check)
- [ ] Share picker shows per-pet scores next to pet names
- [ ] Share sheet shows species message when no eligible pets exist
- [ ] Paywall: only canUseGoalWeight() in permissions.ts (D-153)
- [ ] Empty states: no pet, no items (two variants)
- [ ] Offline: writes blocked with toast, reads cached from Zustand
- [ ] Pet deletion cascades correctly
- [ ] Gram toggle: visible/hidden, preference persisted
- [ ] Nursing <4 weeks: suppress recommendation + breakdown + schedule (D-151)
- [ ] Score = live read, not snapshot (D-156)
- [ ] Quantity floors at 0
- [ ] Treats: no progress bar, calorie context, depletion breakdown, or days
- [ ] Treat Battery: "Gave a treat" deducts quantity + kcal from gauge (Phase 2)
- [ ] Local feeding notifications: schedule, cancel, reschedule on changes
- [ ] Local appointment notifications: schedule at correct reminder interval

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
