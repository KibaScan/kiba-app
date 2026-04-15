# D-166: AddToPantrySheet — Weight Unit Auto-Conversion + Cups/Servings Context

**Status:** LOCKED
**Date:** March 21, 2026
**Milestone:** M5 (polish)
**Depends on:** D-152 (depletion model), D-164 (servings label), D-165 (budget-aware recommendations)

**Problem:** The add-to-pantry sheet's bag size input had multiple issues:
1. Switching between lbs/oz/kg/g did not convert the number — user had to re-type.
2. No way to understand bag size in cups or servings, even though feedings are measured in cups.
3. The cups conversion chip was placed inline with unit chips — looked like a unit selector, not a conversion action.
4. The cups conversion formula was inverted, producing wildly wrong values (12 cups instead of ~61 for a 15 lb bag).
5. User had to mentally calculate total servings from bag weight — lazy design.

---

## Decision — 4 changes to AddToPantrySheet:

### 1. Auto-convert weight units on tap

Tapping a weight unit chip (lbs/oz/kg/g) converts the current value in the input box. Example: 15 lbs → tap "oz" → 240 oz → tap "kg" → 6.8 kg → tap "g" → 6804 g.

Rounding rules: grams round to whole numbers, kg to 2 decimals, lbs and oz to 1 decimal. Conversions go through kg as the intermediate unit.

### 2. Cups + servings helper text (NOT a chip)

Below the bag size input, muted helper text shows the cup equivalent and total servings:

```
Bag size
[15] [lbs] [oz] [kg] [g]
≈ 61 cups · ~42 servings at 1.46 cups each
```

**Only visible when** the product has both `ga_kcal_per_kg` and `ga_kcal_per_cup` data. Servings count only visible when a serving size has been calculated (auto mode) or entered (manual mode).

**Formula (CRITICAL — verify this is correct):**
```
weight_kg = convertToKg(inputValue, selectedUnit)
total_cups = (weight_kg × kcal_per_kg) / kcal_per_cup
total_servings = total_cups / cups_per_feeding
```

**Example verification for Blue Buffalo Small Breed 15 lb bag:**
- weight_kg = 15 × 0.4536 = 6.804 kg
- kcal_per_kg ≈ 3,585 (from product data)
- kcal_per_cup ≈ 398 (from product data)
- total_cups = (6.804 × 3,585) / 398 = **~61 cups** (NOT 12)
- cups_per_feeding = 1.46 (from auto calculation)
- total_servings = 61 / 1.46 = **~42 servings**
- At 2.9 cups/day → **~21 days** (NOT 3)

This is helper text — informational context, not an interactive chip. It lives below the input row, not inline with the unit chips.

### 3. "Enter as servings instead" action link

Below the helper text, a small tappable link: **"Enter as servings instead"**

On tap:
- Switches to Unit serving mode
- Sets `quantity_original` = calculated total servings (rounded to nearest whole number)
- Sets `quantity_unit` = 'units'
- Sets `unit_label` = 'servings'
- Depletion math now uses servings in / servings out — simpler and more intuitive than weight-to-cups conversion

This is optional — user can stay in weight mode if they prefer. The link offers a simpler mental model: "I have ~42 servings, I use 2 per day, that's ~21 days."

### 4. Live-updating on all inputs

The helper text updates when:
- Bag size value changes
- Weight unit changes (auto-conversion)
- Serving size changes (auto or manual)
- Feedings per day changes

---

## Full layout (weight mode):

```
Bag size
[15    ] [lbs] [oz] [kg] [g]
≈ 61 cups · ~42 servings at 1.46 cups each
Enter as servings instead

Feedings per day
[−] 2 [+]

Serving calculation
[Auto] [Manual]

Amount per feeding
1.46 cups per feeding
1163 kcal daily budget ÷ 2 feedings

⏱ 2.9 cups/day · ~21 days
⊙ Buster's daily target: 1163 kcal

[Add to Buster's Pantry]
```

---

## Implementation

**Fix formula in `pantryHelpers.ts`:**
`convertWeightToCups()` — verify it uses `(weight_kg × kcal_per_kg) / kcal_per_cup`, NOT the inverse. The bug that produced 12 instead of 61 was almost certainly `(weight_kg × kcal_per_cup) / kcal_per_kg` or a unit conversion error in `convertToKg()`.

**New helper: `convertWeightToServings()` in `pantryHelpers.ts`:**
```typescript
convertWeightToServings(
  weightKg: number,
  kcalPerKg: number,
  kcalPerCup: number,
  cupsPerFeeding: number
): number | null
// Returns null if any input is missing
// Math: ((weightKg × kcalPerKg) / kcalPerCup) / cupsPerFeeding
```

**AddToPantrySheet.tsx changes:**
- Remove `= X cups` chip from the unit chip row
- Add muted helper text below bag size input with cups + servings
- Add "Enter as servings instead" link below helper text
- Link handler: switch to unit mode, set quantity from calculation
- All helper text live-updates on input changes

**Tests:**
- `convertWeightToCups()`: 15 lbs Blue Buffalo = ~61 cups (regression test)
- `convertWeightToServings()`: 61 cups / 1.46 per feeding = ~42 servings
- "Enter as servings" conversion sets correct quantity and mode

---

## What this does NOT change

- Serving mode toggle (Weight/Units) — still exists, still user-controllable
- Auto/Manual calculation (D-165) — unchanged
- Budget logic (D-165) — unchanged
- Unit labels (D-164) — "servings" everywhere, unchanged
- Depletion math — unchanged, just gets correct inputs now
- Database schema — no changes

## Rejected

- ❌ Cups as an inline chip next to lbs/oz/kg/g — cups is a derived value, not a unit of bag measurement. Bags are sold by weight. Cups is context, not input.
- ❌ Cups conversion chip as action button — confusing placement, looked like a unit selector. Helper text is clearer.
- ❌ Auto-switch to servings mode — too aggressive. User entered weight because that's what's on the bag. Offer the option, don't force it.
