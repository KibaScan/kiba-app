# M2 Session 4 — Portion Calculator + Treat Battery + UI Components

> Written: 2026-03-02
> Commits: e28d82e (math layer), a223096 (UI components)
> Tests: 425/425 passing (308 existing + 117 new)

---

## Files Created

| Path | Description |
|------|-------------|
| `src/services/portionCalculator.ts` | Pure calculation functions for daily energy requirements. 5 exported functions, 3 exported interfaces, 3 private helpers. No Supabase, no side effects. Imports `getDerLifeStage` from `utils/lifeStage`. Designed for M5 pantry import. |
| `src/services/treatBattery.ts` | Pure treat budget and per-day calculations. 2 exported functions, 1 exported interface. Consumes DER from portionCalculator. Separate file per spec §9. |
| `src/components/PortionCard.tsx` | Daily calorie display card for Pet Hub and scan result advisory. Computes DER from pet profile, shows product portions, goal weight mode (premium-gated), hepatic warning card. 5 exported pure helpers for testability. |
| `src/components/TreatBatteryGauge.tsx` | Visual horizontal bar gauge for daily treat budget consumption. Green/amber/red color transitions. 3 exported pure helpers. M2: consumed always 0. M5 pipes real data. |
| `__tests__/services/portionCalculator.test.ts` | 66 tests covering RER/DER math, all multiplier table rows, goal weight mode, hepatic guard, boundary tests, and 7 spec §12 regression cases. |
| `__tests__/services/treatBattery.test.ts` | 10 tests covering 10% budget rule, floor rounding, warning triggers, and zero/negative guards. |
| `__tests__/components/PortionCard.test.ts` | 21 tests covering formatCalories, formatCups, formatGrams, getAgeMonths (timezone-safe), and shouldShowGoalWeight (premium gate + condition matching). |
| `__tests__/components/TreatBatteryGauge.test.ts` | 20 tests covering getBarPercent, getBarColor (boundary precision at 80%/100%), and getStatusLabel. |

---

## Portion Calculator

### Functions

```typescript
lbsToKg(lbs: number): number
// lbs / 2.205 — raw float, no rounding

calculateRER(weightKg: number): number
// Math.round(70 * Math.pow(weightKg, 0.75))
// Guard: weightKg <= 0 → 0

getDerMultiplier(params: {
  species: Species;
  lifeStage: LifeStage | null;
  isNeutered: boolean;
  activityLevel: ActivityLevel;
  ageMonths?: number;
  conditions?: string[];
}): DerMultiplierResult
// Returns { multiplier, label, source }
// Maps 7-tier life stage → 4-bucket via getDerLifeStage()
// null life stage → adult fallback (spec §11)

calculateDailyPortion(
  derKcal: number,
  kcalPerCup: number | null,
  kcalPerKg: number | null,
): DailyPortionResult
// Returns { cups: number | null, grams: number | null }
// cups = derKcal / kcalPerCup, grams = (derKcal / kcalPerKg) * 1000

calculateGoalWeightPortion(params: {
  currentWeightLbs: number;
  goalWeightLbs: number;
  species: Species;
  lifeStage: LifeStage | null;
  isNeutered: boolean;
  activityLevel: ActivityLevel;
  ageMonths?: number;
  conditions?: string[];
}): GoalWeightResult
// Returns { derKcal, multiplier, weeklyLossPercent, hepaticWarning }
// DER at goal weight (D-061), hepatic guard (D-062)
```

### Dog Multiplier Table (12 rows, LOCKED)

| Bucket | Condition | Mult | Label | Source |
|--------|-----------|------|-------|--------|
| puppy | ageMonths < 4 | 3.0 | "Growing puppy (<4mo)" | NRC 2006 |
| puppy | ageMonths >= 4 or undefined | 2.0 | "Growing puppy" | NRC 2006 |
| adult | working (no obesity) | 3.0 | "Working dog" | NRC 2006 |
| adult | low, neutered | 1.2 | "Neutered, low activity" | AAHA 2021 |
| adult | low, intact | 1.4 | "Intact, low activity" | AAHA 2021 |
| adult | moderate, neutered | 1.4 | "Neutered adult" | AAHA 2021 |
| adult | moderate, intact | 1.6 | "Intact adult" | AAHA 2021 |
| adult | high, neutered | 1.6 | "Active neutered" | AAHA 2021 |
| adult | high, intact | 1.8 | "Active intact" | AAHA 2021 |
| senior | low or moderate | 1.2 | "Senior" | Laflamme 2005 |
| senior | high or working | 1.4 | "Active senior" | Laflamme 2005 |
| geriatric | any | 1.2 | "Geriatric" | Laflamme 2005 |

### Cat Multiplier Table (8 rows, LOCKED)

| Bucket | Condition | Mult | Label | Source |
|--------|-----------|------|-------|--------|
| kitten | any | 2.5 | "Growing kitten" | NRC 2006 |
| adult | low, neutered | 1.0 | "Indoor neutered" | NRC 2006 |
| adult | low, intact | 1.2 | "Intact, low activity" | NRC 2006 |
| adult | moderate, neutered | 1.2 | "Neutered adult" | NRC 2006 |
| adult | moderate, intact | 1.4 | "Intact adult" | NRC 2006 |
| adult | high, any | 1.6 | "Active cat" | NRC 2006 |
| senior | any | 1.1 | "Senior" | NRC 2006 |
| geriatric | any | **1.5** | "Geriatric" | NRC 2006, Ch. 15 |

### D-060: RER Formula Confirmed

`RER = 70 × (weight_kg)^0.75` — same formula for dogs and cats. Source: Merck Veterinary Manual, AAHA 2021. Guard: `weightKg <= 0` returns 0.

Note: Spec worked examples use hand-rounded kg intermediates (e.g., "22.7 kg" for 50 lbs). Implementation uses full precision (`50 / 2.205 = 22.6757...`), so final RER/DER values may differ by 1-3 kcal from spec's stated values. Tests use exact formula output.

### D-061: Goal Weight Uses Goal for RER

`calculateRER(lbsToKg(goalWeightLbs))` — RER is calculated at goal weight, not current weight. This creates an automatic caloric deficit (for obese pets) or surplus (for underweight pets). The multiplier remains the same for both current and goal weight DER.

### D-062: Hepatic Lipidosis Guard

**Trigger threshold:** `weeklyLossPercent > 1.0` — cats only. Exactly 1.0% does NOT trigger (strict `>`, not `>=`).

**Formula (PORTION_CALCULATOR_SPEC.md §5):**
```
dailyDeficit = DER_at_current - DER_at_goal
weeklyDeficit = dailyDeficit × 7
impliedWeeklyLossLbs = weeklyDeficit / 3500
weeklyLossPercent = (impliedWeeklyLossLbs / currentWeightLbs) × 100
hepaticWarning = species === 'cat' && weeklyLossPercent > 1.0
```

**Boundary behavior:** Dogs never trigger regardless of weight loss rate. Cats at exactly 1.0% do not trigger. Underweight cats with goal > current produce negative weeklyLossPercent (weight gain), no warning.

### D-063: Geriatric Cat Multiplier = 1.5 (UP from adult)

Geriatric cats (14+ years) get 1.5× multiplier — HIGHER than adult indoor neutered (1.0×). Sarcopenia + declining digestive efficiency require MORE calories, not fewer. Source: NRC 2006, Ch. 15.

**Senior→geriatric boundary test:** 167 months (13yr 11mo) → senior → 1.1×. 168 months (14yr 0mo) → geriatric → 1.5×. This is a 36% calorie increase at the boundary.

### Edge Cases

- **Working dog + obesity:** Activity overridden to `'moderate'` before multiplier lookup (spec §11). Working dog 3.0× drops to neutered-moderate 1.4× or intact-moderate 1.6×.
- **Cat + working activity:** Defensive fallback to `'high'` (1.6×). UI hides working for cats.
- **Null life stage:** Defaults to adult bucket (spec §11).
- **7-tier → 4-bucket mapping:** kitten→puppy, puppy→puppy, junior→adult, mature→adult, adult→adult, senior→senior, geriatric→geriatric. Via `getDerLifeStage()` at `utils/lifeStage.ts:104-110`.

---

## Treat Battery

### Functions

```typescript
calculateTreatBudget(derKcal: number): number
// Math.round(derKcal * 0.1) — 10% rule (D-060)

calculateTreatsPerDay(
  treatBudgetKcal: number,
  kcalPerTreat: number,
): TreatsPerDayResult
// Returns { count: number, warning: boolean }
// count = Math.floor(treatBudgetKcal / kcalPerTreat)
// warning = kcalPerTreat > treatBudgetKcal
// Guard: kcalPerTreat <= 0 → { count: 0, warning: false }
```

### 10% Rule Confirmed

Treat budget = 10% of DER, rounded to nearest integer. Buster 50lb dog DER 1018 → budget 102. Luna 10lb cat DER 218 → budget 22. Count uses floor rounding (never recommend more than budget allows).

---

## UI Components

### PortionCard

**Props:**
```typescript
interface PortionCardProps {
  pet: Pet;
  product: Product | null;  // null = generic daily summary
  conditions: string[];
}
```

**Render modes:**

1. **No weight:** `pet.weight_current_lbs == null` → "Add weight to see daily portions."
2. **Generic daily summary:** `product == null` → Shows DER + multiplier label only. `"{kcal} kcal/day for {petName}"`, `"Based on: {label} ({mult}× RER)"`.
3. **With product:** Shows DER + product portions. Cups preferred (`~{cups} cups/day of {productName}`), grams fallback (`~{grams}g/day of {productName}`). Cups shown when `product.ga_kcal_per_cup` available; grams only when cups unavailable but `product.ga_kcal_per_kg` exists.
4. **Goal weight mode:** Premium-gated via `isPremium()`. Visible when: `pet.weight_goal_lbs != null` AND `conditions` includes `'obesity'` or `'underweight'`. Shows `"Goal Weight Portions"` section with adjusted DER and product portions. Separated by `borderTop`.
5. **Hepatic warning:** Shown when `goalResult.hepaticWarning === true`. Amber card with `alert-circle` icon, left border accent. Fires `haptics.hepaticWarning()` via useEffect.

**Info tooltip:** Toggle via `information-circle-outline` icon. Shows formula: `"RER = 70 × (weight in kg)^0.75"` and `"DER = RER × {mult} ({source})"`.

**Exported helpers:**
- `formatCalories(kcal)` — comma-separated, manual (no `toLocaleString` for Hermes compatibility)
- `formatCups(cups)` — 1 decimal place via `toFixed(1)`
- `formatGrams(grams)` — nearest integer
- `getAgeMonths(dateOfBirth, now?)` — timezone-safe local parsing of YYYY-MM-DD strings
- `shouldShowGoalWeight(weightGoalLbs, weightCurrentLbs, conditions, premium)` — pure boolean gate

### TreatBatteryGauge

**Props:**
```typescript
interface TreatBatteryGaugeProps {
  treatBudgetKcal: number;
  consumedKcal: number;  // 0 for M2, M5 pipes real data
  petName: string;
}
```

**Color thresholds:**
- 0-80%: Green (`#34C759`)
- >80-100%: Amber (`#FF9500`)
- >100%: Red (`#FF3B30`) + "Over budget" label

**Layout:** Title (`"{petName}'s Treat Budget"`) → budget label (`"{consumed}/{budget} kcal"`) → horizontal bar with percentage overlay → status label (color-matched).

**Bar behavior:** Fill width capped at 100% visually (`Math.min(percent, 100)`). Percentage text centered via absolute positioning overlay. Zero budget → 0% (defensive guard).

**Exported helpers:**
- `getBarPercent(consumed, budget)` — uncapped for "over budget" math, 0 if budget <= 0
- `getBarColor(percent)` — green/amber/red at >80/>100 thresholds
- `getStatusLabel(percent)` — `"{N}% used"` or `"Over budget"`

### Hepatic Warning Card — Exact Copy

**Header:** `Gradual weight loss recommended`

**Body:** `Losing weight too quickly can strain the liver in cats. Consider discussing a weight loss plan with your veterinarian.`

D-095 audit: zero prohibited terms (prescribe, treat, cure, prevent, diagnose). "Consider discussing" is advisory redirect to veterinarian, not prescriptive. Amber card with `#FF950015` background, `#FF9500` left border (3px), `alert-circle` icon.

---

## Test Coverage

### `__tests__/services/portionCalculator.test.ts` — 66 tests

| Section | Count | What's Covered |
|---------|-------|----------------|
| lbsToKg | 3 | 50lb, 10lb, zero |
| calculateRER | 10 | D-060 formula, 7 spec weights via test.each (15/50/80/120/10/8/25 lbs), zero guard, negative guard |
| Dog adult multipliers | 6 | All 6 activity×neuter combos via test.each (low/mod/high × neutered/intact) |
| Dog life stages | 9 | Puppy <4mo (3.0×), puppy ≥4mo (2.0×), boundary at exactly 4mo, no ageMonths default, working dog (3.0×), senior low/mod/high, geriatric |
| Dog edge cases | 2 | Working+obesity→moderate (neutered 1.4×, intact 1.6×) |
| Cat multipliers | 10 | Kitten (2.5×), 6 adult combos via test.each, high activity neuter-irrelevant, senior (1.1×), CRITICAL geriatric (1.5× > adult 1.0×) |
| Cat edge cases | 1 | Working→high fallback |
| Life stage mapping | 4 | junior→adult (dog), mature→adult (dog), mature→adult (cat), null→adult |
| Cat senior→geriatric boundary | 3 | 167mo→senior→1.1×, 168mo→geriatric→1.5×, 36% calorie increase |
| calculateDailyPortion | 5 | Cups math, grams math, both formats, both null, zero kcalPerCup guard |
| calculateGoalWeightPortion | 6 | D-061 goal weight, D-062 hepatic trigger, dogs never trigger, boundary at exactly 1.0%, D-063 geriatric floor, underweight (goal > current) |
| Spec §12 regression | 7 | All 7 canonical cases: Buster 50lb (1018), Buster goal 42lb (893), Luna 10lb cat (218), geriatric cat 12lb (374), obese geri cat 15→12lb (374), puppy <4mo 8lb (552), puppy 6mo 25lb (866) |

### `__tests__/services/treatBattery.test.ts` — 10 tests

| Section | Count | What's Covered |
|---------|-------|----------------|
| calculateTreatBudget | 3 | 10% of DER (1018→102, 218→22), rounding (1015→102, 1014→101), zero DER |
| calculateTreatsPerDay | 7 | Floor rounding (22/7→3), budget 102 treat 15→6, single treat exceeds budget (warning), exact match (100/100→1), just under (99/100→0+warning), zero budget (warning), zero/negative kcalPerTreat (defensive) |

### `__tests__/components/PortionCard.test.ts` — 21 tests

| Section | Count | What's Covered |
|---------|-------|----------------|
| formatCalories | 5 | Zero, under 1000 (no comma), 1000+ (comma), fractional rounding (999.5→1,000), small values |
| formatCups | 2 | One decimal place (2.5, 1.0, 3.14→3.1), rounding (2.75→2.8, 1.05→1.1, 1.04→1.0) |
| formatGrams | 2 | Integer rounding (285.3→285, 100.7→101), zero |
| getAgeMonths | 5 | Null DOB→undefined, invalid string→undefined, correct month calculation (26mo, 12mo, 0mo), puppy 4mo, geriatric cat 168mo |
| shouldShowGoalWeight | 7 | All conditions met (obesity, underweight), not premium, no goal weight, no current weight, no obesity/underweight condition, underweight works, multiple conditions including obesity |

### `__tests__/components/TreatBatteryGauge.test.ts` — 20 tests

| Section | Count | What's Covered |
|---------|-------|----------------|
| getBarPercent | 6 | Zero consumed, half consumed, fully consumed, over budget (150%), zero budget (defensive), negative budget (defensive) |
| getBarColor | 8 | 0% green, 50% green, exactly 80% green (boundary), 81% amber, 99% amber, exactly 100% amber (boundary), 101% red, 150% red |
| getStatusLabel | 6 | 0% used, 50% used, 100% used, fractional rounding (33.3→33%, 66.7→67%), 101% "Over budget", 150% "Over budget" |

### Total: 425/425 passing

308 existing (Sessions 1-3) + 76 math layer + 41 UI component helpers = 425. Zero regressions.

---

## Decisions Applied

| Decision | Where Applied |
|----------|---------------|
| D-060 | RER formula `70 × kg^0.75` in `calculateRER()`. Treat budget = 10% of DER in `calculateTreatBudget()`. Both confirmed in 66 + 10 tests. |
| D-061 | Goal weight uses goal for RER: `calculateRER(lbsToKg(goalWeightLbs))`. DER at goal creates automatic caloric deficit (obese) or surplus (underweight). Tested in 6 goal weight tests + 2 spec regression cases. |
| D-062 | Hepatic lipidosis guard: `species === 'cat' && weeklyLossPercent > 1.0`. Exactly 1.0% does NOT trigger. Formula: `(dailyDeficit * 7 / 3500 / currentWeightLbs) * 100`. Dogs never trigger. Amber warning card with D-095 compliant copy. Fires `haptics.hepaticWarning()`. |
| D-063 | Geriatric cat multiplier = 1.5× (NRC 2006, Ch. 15). UP from adult 1.0×. Sarcopenia requires more calories. Boundary test: 167mo→1.1×, 168mo→1.5×, 36% calorie increase. |
| D-064 | Life stage derivation via `getDerLifeStage()` from `utils/lifeStage.ts`. 7-tier → 4-bucket mapping: kitten→puppy, junior/mature→adult, senior→senior, geriatric→geriatric. Null → adult fallback. |
| D-094 | Pet name in all portion display: `"{kcal} kcal/day for {petName}"`, `"{petName}'s Treat Budget"`. No naked calorie values. |
| D-095 | Hepatic warning copy: "Losing weight too quickly can strain the liver in cats. Consider discussing a weight loss plan with your veterinarian." Zero prohibited terms (prescribe, treat, cure, prevent, diagnose). Empty state: "Add weight to see daily portions." |
| D-106 | Weight management affects portions, not scores. PortionCard is display-only. No caloric density modifiers in scoring engine. Goal weight mode gated behind premium. |
| D-121 | `haptics.hepaticWarning()` fires via useEffect when hepatic warning becomes visible. Maps to `Haptics.notificationAsync(Error)`. |

---

## Session 5 Pickup

Session 5 builds the Pet Hub screen, multi-pet carousel, wires PortionCard and TreatBatteryGauge into ResultScreen, and runs integration tests across the full M2 flow.

Key references:
- D-120: Multi-pet carousel (useActivePetStore)
- D-117: Stale weight indicator
- D-094: Suitability framing on all pet-aware screens
- D-086: Colors
- D-084: Zero emoji
- D-121: Haptics

PortionCard and TreatBatteryGauge are built and tested — Session 5 only needs to import and wire them. portionCalculator.ts and treatBattery.ts are pure functions with zero Supabase dependency.
