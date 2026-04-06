# Behavioral Feeding Architecture — Design Doc

> **Status:** Draft — awaiting Steven's approval before any code
> **Scope:** Post-M6 (no user data to migrate, clean break)
> **Replaces:** Meal-based allocation model (`computeMealBasedServing`, `slot_index` math)

---

## The Problem

The current pantry system assumes a predictable, repeating feeding schedule: "I feed Food A once and Food B three times, every day." It divides DER into rigid meal fractions.

This doesn't match real behavior. Most cat owners (and many dog owners) do this:

- Dry food is the constant — same bag, same scoop, for weeks
- Wet food is rotational — grab a random can from whatever's in the cabinet
- The schedule isn't fixed — sometimes they give wet food, sometimes they skip it

When the system forces 5 wet food varieties into permanent calorie slots, every fraction is wrong, overbudget warnings fire incorrectly, and the app fights the user instead of helping them.

## The Solution

**Dry food is the anchor. Wet food is the variable.**

Instead of dividing DER equally across all foods, the system:

1. Asks a one-time feeding style question per pet
2. Reserves a calorie budget for wet food based on actual product data (or a size-based estimate)
3. Calculates the dry food scoop from what's left
4. Lets the user optionally log which wet food they actually fed today ("Fed This Today"), which recalculates the dry food scoop with real calories instead of the estimate

If they never tap "Fed This Today," nothing breaks — the scoop uses the estimate and inventory doesn't move. Precision is opt-in.

---

## New Decisions Required

### D-XXX: Feeding Style Model

**Decision:** Replace meal-fraction allocation with a behavioral feeding style model.

The `feeding_style` ENUM on `pets` table encodes the feeding *pattern*, not calorie amounts:

| Value | Meaning | DER Math |
|---|---|---|
| `dry_only` | No wet food in the routine | 100% DER → dry food scoop |
| `dry_and_wet` | Dry food base + some wet food daily | (DER − wet reserve) → dry food scoop |
| `wet_only` | Only wet food, no kibble | DER ÷ wet food servings per day |
| `custom` | User manually sets the calorie split | User-entered kcal per food role |

**Locked behaviors:**
- Feeding style is set **per pet**, not per food
- `feeding_style` defaults to `dry_only` until explicitly set
- The setup prompt appears when a user adds their first pantry item for a pet
- Changing feeding style recalculates all serving displays immediately
- Scoring is completely unaffected — this only changes calorie/serving math

### D-XXX: Wet Food Calorie Reserve

**Decision:** The wet food calorie reserve is derived from actual product data when available, with a size-based fallback.

**Resolution order (per product, then averaged across pantry):**

| Tier | Source | Condition | Confidence |
|---|---|---|---|
| 1 | Label kcal | `kcal_per_unit` exists on product | High — "from label" |
| 2 | Atwater estimate | GA data (protein, fat, fiber, moisture, ash) sufficient for modified Atwater (D-149) | Medium — "estimated from nutrition data" |
| 3 | Size-based estimate | No kcal and no usable GA data, but can/pouch size known | Low — "based on typical [size] can" |
| 4 | Unknown | No kcal, no GA, no size info | None — "calories unknown, enter manually" |

**Size-based fallback values (Tier 3):**

| Can/Pouch Size | Cat Estimate | Dog Estimate |
|---|---|---|
| Small (2.8–3.5 oz) | 80 kcal | 90 kcal |
| Medium (5–6 oz) | 150 kcal | 170 kcal |
| Large (12–13 oz) | — | 350 kcal |

**Averaging across multiple wet foods:** If the pet has multiple wet foods in their pantry, the reserve uses a **weighted average** based on inventory count (`SUM(kcal * quantity) / SUM(quantity)`). This prevents a single outlier large can from skewing the daily math. If inventory hits 0 across the board, it falls back to the simple average or Tier 3 size estimate.

**Tier 4 handling:** The product card shows "Calories unknown — scan label or enter manually" with an inline kcal input field. The system falls back to the Tier 3 size-based estimate for the dry food scoop but labels it with lower confidence. If the user manually enters kcal, it becomes the source of truth (`wet_reserve_source = 'manual'`).

**Helper function:** `getWetFoodKcal(product): { kcal: number | null, tier: 1 | 2 | 3 | 4, label: string }` walks the resolution chain and returns both the value and the confidence tier so the UI knows what to display.

**When a new wet food is scanned and added to pantry:** The reserve recalculates (new average across all wet foods) and the dry food scoop updates silently. Subtle note on the dry food card: "Serving updated based on [product name]."

### D-XXX: Wet Food Depletion Model

**Decision:** Wet food uses "Fed This Today" tap as the default depletion method. Auto-deplete is opt-in per item.

| Food type | Default depletion | Optional |
|---|---|---|
| Dry food | Auto-deplete (cron, daily) | User can manually adjust |
| Wet food | "Fed This Today" manual tap | Toggle auto-deplete ON per item |
| Treats | "Gave a Treat" manual tap (existing) | Unchanged |
| Supplements | "Took Today" manual tap | Toggle auto-deplete ON per item |

**"Fed This Today" behavior:**
- Tapping logs which specific product was fed
- Decrements that product's inventory by 1 unit (or fractional amount if configured)
- Pushes that product's **real kcal** into a `daily_wet_fed` accumulator for that pet
- Dry food card recalculates: `(DER − daily_wet_fed) / dry_kcal_density`
- Accumulator resets at midnight (local time, using device timezone)
- Multiple taps allowed (fed two different cans = both logged)
- If user never taps, nothing breaks — dry food shows estimate-based scoop, wet inventory stays static

**Auto-deplete opt-in for wet food:**
- Per-item toggle: "Auto-deduct 1 [can/pouch] daily"
- Useful for people who feed the same wet food every day (more common with dogs)
- When enabled, behaves exactly like dry food auto-deplete via cron

### D-XXX: Multiple Dry Foods

**Decision:** When multiple dry foods are assigned to a pet, the remaining dry-food calories split evenly by default. User can adjust the ratio.

Example: 240 kcal DER, 80 kcal wet reserve = 160 kcal for dry food. Two kibbles → 80 kcal each by default. User can drag a slider to 60/40, 70/30, etc.

This is an uncommon case. The UI should handle it gracefully but not optimize for it.

### D-XXX: Feeding Style Setup Flow

**Decision:** Feeding style is prompted during first pantry add for a pet, not during pet profile creation.

**Trigger:** User taps "Add to Pantry" for a pet that has `feeding_style = NULL`.

**Flow:**
1. Bottom sheet appears: "How do you feed [Pet Name]?"
2. Four tappable options (with icons):
   - "Dry food only"
   - "Dry food + wet food" → follow-up: "What size cans/pouches?" (small / medium / large) — only shown if no wet food scanned yet
   - "Wet food only"
   - "Custom split"
3. One tap completes it. No multi-step wizard.
4. Saved to `pets.feeding_style`. Editable anytime in pet profile settings.

---

## Schema Changes

### `pets` table — add column

```sql
ALTER TABLE pets
ADD COLUMN feeding_style TEXT CHECK (feeding_style IN ('dry_only', 'dry_and_wet', 'wet_only', 'custom'))
DEFAULT NULL;
```

`NULL` = not yet configured (triggers setup prompt on first pantry add).

### `pets` table — add wet reserve config

```sql
ALTER TABLE pets
ADD COLUMN wet_reserve_kcal SMALLINT DEFAULT NULL,
ADD COLUMN wet_reserve_source TEXT CHECK (wet_reserve_source IN ('product', 'estimate', 'manual'))
DEFAULT NULL;
```

- `wet_reserve_kcal`: the calorie budget reserved for wet food
- `wet_reserve_source`: where the number came from (`product` = derived from scanned wet food, `estimate` = size-based fallback, `manual` = user entered a custom value)
- Both NULL when `feeding_style` is `dry_only` or `wet_only`

### `pets` table — The Recalculation Trigger
We must explicitly define the lifecycle of `wet_reserve_kcal`. Whenever a user adds or deletes a wet food from their pantry, a database function or service layer hook (e.g., `refresh_wet_reserve(pet_id)`) must instantly average the remaining wet foods and write the new baseline to `pets.wet_reserve_kcal`. This guarantees that the client's `computeBehavioralServing` operates purely synchronously with the correct base.

### `pantry_pet_assignments` table — add column

```sql
ALTER TABLE pantry_pet_assignments
ADD COLUMN feeding_role TEXT CHECK (feeding_role IN ('base', 'rotational', 'treat', 'supplement'))
DEFAULT NULL;
```

- `base` = dry food anchor (or primary wet food in `wet_only` mode)
- `rotational` = wet food variety (not allocated a fixed calorie fraction)
- `treat` = existing treat behavior
- `supplement` = existing supplement behavior

Auto-assigned based on product category at add-to-pantry time. User can override.

### `pantry_pet_assignments` table — add daily log tracking & custom split

```sql
ALTER TABLE pantry_pet_assignments
ADD COLUMN auto_deplete_enabled BOOLEAN DEFAULT NULL,
ADD COLUMN calorie_share_pct SMALLINT DEFAULT NULL;
```

- `NULL` = use default for role (`TRUE` for base, `FALSE` for rotational/treat/supplement)
- Explicit `TRUE`/`FALSE` = user override
- `calorie_share_pct`: Stores user's custom dry food mathematical allocation ratios.

### New table: `feeding_log`

```sql
CREATE TABLE feeding_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  pantry_item_id UUID NOT NULL REFERENCES pantry_items(id) ON DELETE CASCADE,
  kcal_fed SMALLINT NOT NULL,
  quantity_fed NUMERIC(6,2) NOT NULL DEFAULT 1,
  fed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE feeding_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own feeding log"
  ON feeding_log FOR ALL
  USING (auth.uid() = user_id);

-- Index for daily aggregation
CREATE INDEX idx_feeding_log_pet_date
  ON feeding_log (pet_id, fed_at);
```

This replaces the in-memory `daily_wet_fed` accumulator with a persistent log. Benefits: survives app restart, enables historical feeding data, works across devices.

**Daily aggregation query:**
```sql
SELECT SUM(kcal_fed) as total_wet_kcal_today
FROM feeding_log
WHERE pet_id = $1
  AND fed_at >= $2 -- Start of user's local day in UTC
  AND fed_at < $3; -- End of user's local day in UTC
```
*(Note: Never use DB `CURRENT_DATE` for aggregations, as it relies on server UTC boundaries and will break timezone logic.)*

---

## Math Engine Changes

### What Gets Removed

- `computeMealBasedServing()` — the entire meal-fraction allocation function
- `slot_index` logic — any code that counts meals across foods and divides the pie
- Overbudget warnings based on meal fractions summing past 100%

### What Replaces It

New function: `computeBehavioralServing()`

```typescript
interface BehavioralServingInput {
  der_kcal: number;                    // pet's Daily Energy Requirement
  feeding_style: FeedingStyle;         // from pets table
  wet_reserve_kcal: number | null;     // from pets table (null for dry_only/wet_only)
  daily_wet_fed_kcal: number;          // sum from feeding_log today (0 if nothing logged)
  food_kcal_density: number;           // kcal per serving unit (cup, can, etc.)
  food_role: FeedingRole;              // 'base' | 'rotational'
  dry_food_count: number;              // how many base dry foods this pet has
  dry_food_split_pct: number;          // this food's share of dry budget (default: 1/dry_food_count)
}

interface BehavioralServingOutput {
  recommended_amount: number;          // in serving units (cups, cans)
  recommended_kcal: number;            // calorie value of that amount
  is_adjusted: boolean;                // true if daily_wet_fed_kcal > 0 (user logged today)
  adjustment_note: string | null;      // e.g. "Adjusted for 1 can of Fancy Feast (78 kcal)"
  budget_remaining_kcal: number;       // DER minus all allocated/logged calories
}
```

**Core logic by feeding style:**

```
dry_only:
  dry_budget = DER
  serving = (dry_budget × dry_food_split_pct) / food_kcal_density

dry_and_wet (base food):
  wet_actual = daily_wet_fed_kcal > 0 ? daily_wet_fed_kcal : wet_reserve_kcal
  dry_budget = Math.max(0, DER - wet_actual)
  serving = (dry_budget × dry_food_split_pct) / food_kcal_density

dry_and_wet (rotational food):
  // No serving calc — display product info, score, "Fed This Today" button
  // Optionally show: "~[kcal] per [unit]" from product data

wet_only:
  // Divide DER across wet food servings per day
  serving = DER / food_kcal_density  // total daily amount
  // No percentage splitting for wet foods. If they have Chicken and Beef, the Chicken says "Feed 3 cans" and Beef says "Feed 2 cans" so they easily swap 100% diets.

custom:
  // User-entered kcal per food, system just converts to serving units
  serving = user_entered_kcal / food_kcal_density
```

### Dry Food Card Display

**Before user logs wet food today:**
```
Hill's Science Diet Adult
Recommended: 1/2 cup per day
(Accounts for ~80 kcal daily wet food)
```

**After user taps "Fed This Today" on a wet food:**
```
Hill's Science Diet Adult
Recommended: 1/3 cup per day  ← updated
(Adjusted for Fancy Feast Classic — 78 kcal)
```

**No wet food in pantry yet (dry_and_wet style, Tier 3 estimate):**
```
Hill's Science Diet Adult
Recommended: 1/3 cup per day
(Based on typical small can. Scan a wet food for exact serving.)
```

**Wet food in pantry with Atwater estimate (Tier 2):**
```
Hill's Science Diet Adult
Recommended: 1/3 cup per day
(Accounts for ~82 kcal estimated from nutrition data)
```

---

## UI Changes

### Pantry Card Restructuring

**Current:** All foods shown equally with meal fractions and calorie percentages.

**New:** Visual hierarchy by feeding role.

```
[Pet Name]'s Pantry
━━━━━━━━━━━━━━━━━━━━━━━━

🥣 Daily Base
┌─────────────────────────────────────┐
│ Hill's Science Diet Adult        82 │
│ 1/2 cup per day · 14 days left     │
│ (Accounts for ~80 kcal wet food)   │
└─────────────────────────────────────┘

🥫 Wet Food Rotation
┌─────────────────────────────────────┐
│ Fancy Feast Classic Paté      [Fed] │
│ 78 kcal per can · 8 cans left      │
├─────────────────────────────────────┤
│ Sheba Perfect Portions             │
│ 72 kcal per container · 6 left     │
├─────────────────────────────────────┤
│ Tiki Cat Puka Puka Chicken         │
│ 90 kcal per can · 4 cans left      │
└─────────────────────────────────────┘

🦴 Treats
┌─────────────────────────────────────┐
│ Temptations Classic              44 │
│ Budget: 3 treats/day (47 kcal)     │
└─────────────────────────────────────┘
```

The "[Fed]" badge appears on any wet food logged today and clears at midnight.

### "Fed This Today" Interaction

- Tap the wet food card → bottom sheet slides up
- Shows: product name, kcal per unit, current inventory count
- Primary action: "Fed 1 [can/pouch]" (large tap target)
- Secondary: stepper for fractional amounts (1/4, 1/2, 3/4, 1, 1.5, 2)
- On confirm: inventory decrements, feeding_log entry created, dry food card recalculates
- Haptic feedback + subtle animation on the dry food card showing the scoop change
- An "Undo" Toast persists for 5 seconds to rollback accidental entries.

### Feeding Style Setup (Bottom Sheet)

Triggered on first pantry add for a pet with `feeding_style = NULL`.

```
How do you feed [Pet Name]?
━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────┐
│  Dry food only          │
│  Same kibble every day  │
└─────────────────────────┘

┌─────────────────────────┐
│  Dry food + wet food    │
│  Kibble base + cans     │
└─────────────────────────┘

┌─────────────────────────┐
│  Wet food only          │
│  Cans or pouches only   │
└─────────────────────────┘

┌─────────────────────────┐
│  Custom split           │
│  I'll set the amounts   │
└─────────────────────────┘
```

If "Dry food + wet food" selected and no wet food is in the pantry yet:

```
What size wet food do you usually get?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌────────────┐  ┌────────────┐
│ Small can  │  │ Medium can │
│ 2.8-3.5 oz │  │ 5-6 oz     │
└────────────┘  └────────────┘

┌────────────┐
│ Large can  │  ← dogs only
│ 12-13 oz   │
└────────────┘
```

This sets `wet_reserve_kcal` to the estimate and `wet_reserve_source = 'estimate'`. Replaced automatically when a real wet food product is scanned.

---

## Auto-Deplete Cron Changes

The existing cron Edge Function needs minor adjustments:

**Dry food (base role):** Unchanged — auto-deplete by default using scoop size.

**Wet food (rotational role):** Cron skips items where `auto_deplete_enabled` is NULL or FALSE (the default). Only auto-depletes if user explicitly toggled it on.

**Treat / supplement:** Unchanged — manual depletion by default.

The "Fed This Today" button must be a synchronous Supabase RPC (e.g., `log_wet_feeding_atomic`) that instantly `INSERT`s into the feeding log and `UPDATE`s the inventory synchronously. The nightly cron job absolutely **ignores** manual logs, serving strictly to process items explicitly marked with `auto_deplete_enabled = true` to avoid double-deduction.

---

## What Does NOT Change

- **Scoring engine** — zero changes. Scoring is per-product, not per-feeding-pattern.
- **Treat battery** — unchanged, already uses the right model.
- **Recall alerts** — unchanged, still monitors all pantry items regardless of role.
- **Auto-deplete cron infrastructure** — same cron, same Edge Function, just different filtering logic.
- **Pantry ownership model** — items still user-owned, pets link via `pantry_pet_assignments`.
- **Product data** — no changes to `products` table or scraping pipeline.
- **DER calculation** — same RER × multiplier × goal weight adjustment.

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| User has `dry_and_wet` style but no wet food scanned | Use size-based estimate, show "Scan a wet food for exact serving" |
| User logs more wet food kcal than DER | Dry food card shows "0 cups" with note: "Today's wet food exceeds daily target" |
| User has 2 dry foods + wet rotation | Dry budget split evenly (or user-adjusted), each dry card shows its portion |
| User switches feeding style mid-use | All servings recalculate immediately. feeding_log history preserved. |
| Product has no `kcal_per_unit` data | Falls through to Atwater (Tier 2) → size estimate (Tier 3) → "Calories unknown" (Tier 4) with manual entry option. Reserve uses best available tier. |
| User feeds wet food but never taps "Fed This Today" | Nothing breaks. Dry food shows estimate-based scoop. Wet inventory static. |
| User wants to auto-deplete a specific wet food | Toggle available per-item in edit screen. Cron handles it like dry food. |
| `wet_only` user with 5 different wet foods | DER ÷ servings per day. Multiple foods = rotation tracking only, not calorie splitting. Scoop = "feed [X] cans/pouches per day total." |
| Dog with large can (350 kcal) exceeds 50% of DER | Valid. Some small dogs on wet-heavy diets. System allows it, no warning. |
| User hasn't opened app in 3 days | No "Fed This Today" entries for those days. Wet inventory stays where it was. Dry auto-deplete continues normally. No phantom deductions. |
| Weight Goal Adjustment (Dieting) | A negative weight goal shrinks the DER (e.g. 240 → 216). Because `wet_reserve_kcal` is a fixed constant, the calorie deficit is completely absorbed by reducing the Dry Budget, perfectly mirroring human logic of keeping the wet proportion the same but pouring less kibble. |
| Sharing Pantry Items (Multi-Pet) | Since slots are removed, sharing a food skips fractional math. Kibble Shared: naturally scales to `(Pet A DER - Pet A Wet Reserve)` and `(Pet B DER)` based on each dog's unique `feeding_style`. Wet Food Shared: assigns the `rotational` role, instantly folding it into Pet B's average wet reserve pool safely. |

---

## Migration Plan

Since no users exist in beta, this is a clean-break migration:

1. **Add new columns** to `pets` and `pantry_pet_assignments`
2. **Create `feeding_log` table** with RLS
3. **Drop `slot_index`** and any meal-fraction columns from `pantry_pet_assignments`
4. **Replace `computeMealBasedServing()`** with `computeBehavioralServing()` in `pantryHelpers.ts`
5. **Update auto-deplete cron** to respect `feeding_role` and `auto_deplete_enabled`
6. **Update pantry UI** — new card hierarchy, "Fed This Today" button, feeding style setup flow
7. **Update tests** — new unit tests for `computeBehavioralServing()`, remove meal-fraction tests

No backward compatibility needed. No data migration script.

---

## Resolved Design Decisions

Based on initial review, the following open questions have been locked:

1. **Daily Total Display:** We *will* show a daily total, but keep it highly subtle. It will be injected directly into the Daily Base card's helper text: `(Adjusted for 156 kcal of wet food today)`.
2. **Notifications:** No push notifications for "Fed This Today". The system is explicitly opt-in to avoid creating a stressful micromanagement sink. If users want precision, they log it; otherwise, the estimate serves them perfectly.
3. **Data Retention:** We will keep `feeding_log` history forever. The `(uuid, uuid, uuid, smallint, timestamp)` schema is practically weightless in Postgres. This unblocks future velocity mapping and vet reporting ("Owner rotates wet food an average of 4x per week").
4. **Custom Split UX:** We will use a simple numeric text input for custom kcal rather than a slider. Sliders force a zero-sum 100% split, which fights users who intentionally underfeed or overfeed for medical reasons.

---

## Estimated Scope

| Task | Effort |
|---|---|
| Schema migration (new columns + feeding_log table) | Small |
| `computeBehavioralServing()` + unit tests | Medium |
| Feeding style setup bottom sheet | Small |
| Pantry card restructure (role-based hierarchy) | Medium |
| "Fed This Today" interaction + feeding_log writes | Medium |
| Auto-deplete cron updates | Small |
| Dry food card dynamic recalculation | Small |
| Wet reserve auto-update on new product scan | Small |
| **Total** | **~1 sprint** |
