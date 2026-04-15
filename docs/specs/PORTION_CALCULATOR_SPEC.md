# Portion Calculator Spec — M2

> Canonical reference for DER/RER math, portion display, goal weight logic, and species-specific safety guards.
> Read this before implementing any portion-related work.
> Updated: March 1, 2026 — DER multiplier tables locked, NEEDS DECISION flags resolved, 6-tier life stage mapping added.
> Depends on: D-060, D-061, D-062, D-063, D-064, D-106

---

## 1. Core Formula: RER

**Resting Energy Requirement** — the baseline caloric need at rest.

```
RER = 70 × (weight_kg) ^ 0.75
```

- Both dogs and cats use the same formula (D-060)
- Weight in kg: `weight_kg = weight_lbs / 2.205`
- Source: Merck Veterinary Manual, AAHA Nutritional Assessment Guidelines

### Worked Examples

| Pet | Weight (lbs) | Weight (kg) | RER (kcal/day) |
|-----|-------------|-------------|----------------|
| Small dog | 15 | 6.8 | 70 × 6.8^0.75 = 70 × 4.47 = **313** |
| Medium dog (Buster) | 50 | 22.7 | 70 × 22.7^0.75 = 70 × 10.42 = **729** |
| Large dog | 80 | 36.3 | 70 × 36.3^0.75 = 70 × 14.88 = **1,042** |
| Giant dog | 120 | 54.4 | 70 × 54.4^0.75 = 70 × 20.19 = **1,413** |
| Cat | 10 | 4.5 | 70 × 4.5^0.75 = 70 × 3.34 = **234** |
| Large cat | 15 | 6.8 | 70 × 6.8^0.75 = 70 × 4.47 = **313** |

---

## 2. 6-Tier → DER Mapping

The app uses 6 life stage tiers (see PET_PROFILE_SPEC.md §2). DER multipliers are defined for 4 metabolic buckets. The mapping:

| 6-Tier Stage | DER Bucket | Rationale |
|---|---|---|
| Puppy / Kitten | `puppy` | Growth multipliers |
| Junior | `adult` | Growth complete, standard energy needs |
| Adult | `adult` | Standard |
| Mature | `adult` | No metabolic decline yet — senior multipliers would underfeed |
| Senior | `senior` | Reduced activity, moderate decline |
| Geriatric | `geriatric` | Dogs: further reduced. Cats: INCREASED (D-063) |

```typescript
type LifeStage = 'puppy' | 'kitten' | 'junior' | 'adult' | 'mature' | 'senior' | 'geriatric';
type DerBucket = 'puppy' | 'adult' | 'senior' | 'geriatric';

function getDerBucket(lifeStage: LifeStage): DerBucket {
  if (lifeStage === 'junior' || lifeStage === 'mature') return 'adult';
  if (lifeStage === 'puppy' || lifeStage === 'kitten') return 'puppy';
  return lifeStage; // 'senior' | 'geriatric' pass through
}
```

---

## 3. DER Multipliers — LOCKED

**Daily Energy Requirement** = RER × multiplier.

```
DER = RER × multiplier
```

### Dog DER Multipliers

| DER Bucket | Activity | Neutered | Multiplier | Source |
|------------|----------|----------|------------|--------|
| Puppy (0–4 mo) | — | — | 3.0 | NRC 2006 |
| Puppy (4+ mo) | — | — | 2.0 | NRC 2006 |
| Adult | Low | Yes | 1.2 | AAHA 2021 |
| Adult | Low | No | 1.4 | AAHA 2021 |
| Adult | Moderate | Yes | 1.4 | AAHA 2021 |
| Adult | Moderate | No | 1.6 | AAHA 2021 |
| Adult | High | Yes | 1.6 | AAHA 2021 |
| Adult | High | No | 1.8 | AAHA 2021 |
| Adult | Working | — | 3.0 | NRC 2006 (fixed default, not 2.0–5.0 range) |
| Senior | Low–Moderate | — | 1.2 | Laflamme 2005 |
| Senior | High | — | 1.4 | Laflamme 2005 |
| Geriatric | — | — | 1.2 | Laflamme 2005 |

**Puppy age split:** Use 3.0× for puppies under 4 months, 2.0× for 4+ months. `deriveLifeStage()` returns `puppy` for both — the DER function checks age in months directly for the 4-month threshold.

**Working dog simplification:** Fixed 3.0× default. True working dogs (sled dogs, SAR) need 4–5× but that's a veterinary nutrition plan, not an app feature.

### Cat DER Multipliers

| DER Bucket | Activity | Neutered | Multiplier | Source |
|------------|----------|----------|------------|--------|
| Kitten | — | — | 2.5 | NRC 2006 |
| Adult | Low | Yes | 1.0 | NRC 2006 |
| Adult | Low | No | 1.2 | NRC 2006 |
| Adult | Moderate | Yes | 1.2 | NRC 2006 |
| Adult | Moderate | No | 1.4 | NRC 2006 |
| Adult | High | — | 1.6 | NRC 2006 |
| Senior | — | — | 1.1 | NRC 2006 |
| **Geriatric** | — | — | **1.5** | **NRC 2006, Ch. 15** |

**CRITICAL — Geriatric cats (D-063):** The 1.5× multiplier is HIGHER than adult indoor cats (1.0×). This is counterintuitive and MUST be handled correctly. Geriatric cats lose muscle mass (sarcopenia) and have declining digestive efficiency. They need MORE calories, not fewer. Do NOT linearly reduce with age.

**Cat default activity:** `low` for all cats unless user changes it. Most pet cats are indoor/low-activity.

### Multiplier Lookup Implementation

```typescript
interface MultiplierKey {
  species: 'dog' | 'cat';
  derBucket: DerBucket;
  activity: 'low' | 'moderate' | 'high' | 'working';
  isNeutered: boolean;
  ageMonths?: number; // only needed for puppy 4-month split
}

function getDERMultiplier(key: MultiplierKey): number {
  // Geriatric cat floor — D-063
  if (key.species === 'cat' && key.derBucket === 'geriatric') {
    return 1.5;
  }
  
  // Puppy age split (dogs only — kittens don't split)
  if (key.species === 'dog' && key.derBucket === 'puppy') {
    return (key.ageMonths !== undefined && key.ageMonths < 4) ? 3.0 : 2.0;
  }
  
  // ... table lookup for remaining combinations
}
```

---

## 4. Goal Weight Mode (D-061)

When a pet has `obesity` or `underweight` condition AND `weight_goal_lbs` is set:

```
DER is calculated using GOAL weight, not current weight.
```

This creates the caloric deficit (for obesity) or surplus (for underweight) automatically.

### Examples

**Obese dog (Buster):**
- Current: 50 lbs (22.7 kg) → RER = 729
- Goal: 42 lbs (19.1 kg) → RER = 643
- DER at goal = 643 × 1.4 (moderate, neutered) = **900 kcal/day**
- vs DER at current = 729 × 1.4 = 1,021 kcal/day
- Deficit: ~121 kcal/day (11.8% reduction)

**Underweight cat:**
- Current: 7 lbs (3.2 kg) → RER = 189
- Goal: 9 lbs (4.1 kg) → RER = 226
- DER at goal = 226 × 1.2 = **271 kcal/day**
- Surplus drives gradual weight gain

### Validation

- Obesity: `weight_goal_lbs < weight_current_lbs` (goal must be lower)
- Underweight: `weight_goal_lbs > weight_current_lbs` (goal must be higher)
- Reject if direction is wrong (UI prevents saving)
- `weight_goal_lbs` field only editable when obesity OR underweight condition is active
- **Puppies/kittens:** Goal weight disabled for puppy/kitten life stage. Growing animals should not restrict calories. UI hides goal weight field when life_stage is puppy or kitten.

---

## 5. Cat Hepatic Lipidosis Guard (D-062)

**CRITICAL SAFETY — This is a liability shield. Must ship before any weight features.**

When a cat has `obesity` condition + `weight_goal_lbs` set, calculate implied weekly loss rate:

```
caloric_deficit_per_day = DER_at_current - DER_at_goal
weekly_deficit = caloric_deficit_per_day × 7
implied_weekly_loss_lbs = weekly_deficit / 3500  // ~3500 kcal per lb of body weight
weekly_loss_percent = (implied_weekly_loss_lbs / weight_current_lbs) × 100
```

**Guard trigger:** If weekly_loss_percent > 1.0% → **RED WARNING before save:**

> "Projected weight loss rate exceeds safe limits for cats. Rapid weight loss in cats can cause hepatic lipidosis (fatty liver disease), a potentially fatal condition. Consult your veterinarian before starting a weight loss plan."

Fires `haptics.hepaticWarning()` (D-121).

### Why This Matters

Cat hepatic lipidosis (fatty liver disease) is triggered by rapid fat mobilization during caloric restriction. Cats are uniquely susceptible due to their hepatic lipid metabolism. Even 2-3 days of complete anorexia can trigger it in obese cats. The guard prevents well-meaning owners from setting aggressive weight goals that could hospitalize their cat.

### Implementation

```typescript
function checkCatHepaticLipidosisRisk(
  currentWeightLbs: number,
  goalWeightLbs: number,
  currentDER: number,
  goalDER: number
): { isRisky: boolean; weeklyLossPercent: number } {
  const dailyDeficit = currentDER - goalDER;
  const weeklyDeficit = dailyDeficit * 7;
  const impliedWeeklyLossLbs = weeklyDeficit / 3500;
  const weeklyLossPercent = (impliedWeeklyLossLbs / currentWeightLbs) * 100;
  return {
    isRisky: weeklyLossPercent > 1.0,
    weeklyLossPercent
  };
}
```

- Check runs on save, not on every keystroke
- Warning is advisory, not blocking — user can acknowledge and save
- Applies to ANY cat with a weight loss goal, not just those with obesity condition
- Source: Center SA, Veterinary Clinics of North America, 2005

---

## 6. Geriatric Cat Calorie Protection (D-063)

Separate from hepatic lipidosis guard. This prevents under-feeding elderly cats.

**Rule:** If cat is geriatric (14+) AND has obesity condition, the DER multiplier uses the geriatric value (1.5×) NOT the standard adult range. The system does not allow geriatric cats to be portioned below the geriatric floor.

```typescript
function getEffectiveDERMultiplier(pet: PetProfile): number {
  const derBucket = getDerBucket(pet.life_stage);
  const standard = getDERMultiplier({
    species: pet.species,
    derBucket,
    activity: pet.activity_level,
    isNeutered: pet.is_neutered
  });
  
  if (pet.species === 'cat' && derBucket === 'geriatric') {
    // Geriatric cats ALWAYS get at least 1.5×, even if obese
    // D-063: they need MORE calories, not fewer
    return Math.max(1.5, standard);
  }
  return standard;
}
```

**Why:** A 15-year-old obese cat needs to lose weight SLOWLY while maintaining muscle mass. The geriatric floor prevents the goal-weight DER from dropping below safe caloric intake for an elderly cat with declining digestive efficiency.

**Geriatric dogs:** Standard age reduction applies. Dogs don't have the same caloric inflection as cats at advanced age.

---

## 7. Portion Display (D-106)

### When to Show

Show portion context card on scan result screen when ALL of these are true:
- Pet has `weight_current_lbs` set
- Scanned product has `ga_kcal_per_cup` (or equivalent caloric data)

If either condition is false → card does not render. No guessing.

### Copy Templates

**Standard (no goal weight):**
> "[Pet Name]'s daily portion: [X] cups/day ([Y] kcal/day)"

**With goal weight (obesity):**
> "At [Pet Name]'s goal weight portions: [X] cups/day ([Y] kcal/day)"

**With goal weight (underweight):**
> "At [Pet Name]'s goal weight portions: [X] cups/day ([Y] kcal/day)"

### Impractical Portion Guard (D-106 §3)

If calculated portions are unreasonably small:
- Cats: < 1/4 cup per meal (assuming 2 meals/day)
- Dogs: < 1/3 cup per meal (assuming 2 meals/day)

Add note: "Portions are very small at this caloric density — a lower-calorie food may be easier to manage."

This is an **observation about practicality**, NOT a feeding directive or score modifier. D-095 compliant.

### Fiber Penalty Suppression (D-106 §4)

When pet has `obesity` condition:
- Reduce fiber penalty by 50% in the nutritional profile bucket
- This is IN ADDITION to the existing AAFCO "weight management"/"light" label check
- Higher fiber is clinically beneficial for obese pets (satiety, gastric emptying)
- Implementation: one additional condition in the fiber scoring function

```typescript
// In nutritionalProfile.ts fiber scoring:
const fiberPenaltyReduction = 
  product.aafco_statement_includes_weight_management || 
  pet.conditions?.includes('obesity')
    ? 0.5   // 50% reduction
    : 1.0;  // full penalty
```

---

## 8. Cups/Day Calculation

This is the bridge between DER and portion display.

```
cups_per_day = DER / kcal_per_cup
```

### Worked Example (Buster at goal weight)

```
Goal weight: 42 lbs → 19.1 kg
RER = 70 × 19.1^0.75 = 643 kcal/day
DER = 643 × 1.4 (moderate, neutered) = 900 kcal/day
Pure Balance kcal_per_cup = 399 (from GA data)
Cups/day = 900 / 399 = 2.26 cups/day

Display: "At Buster's goal weight portions: 2.3 cups/day (900 kcal/day)"
```

### Display Formatting

- Round to nearest 0.1 (one decimal place)
- Show both cups and kcal: "[X] cups/day ([Y] kcal/day)"
- If cups < 0.5, show in fractions: "~1/4 cup" rather than "0.3 cups"

### Missing kcal Data

If `ga_kcal_per_cup` is null → don't display cups/day. Show kcal/day only:
> "[Pet Name]'s daily energy need: [Y] kcal/day (cup measurement unavailable for this product)"

---

## 9. Treat Budget Connection (Forward Reference)

D-060: Treat budget = 10% of DER.

```
treat_budget_kcal = DER × 0.10
```

The Treat Battery is part of M2 scope (see ROADMAP.md). The DER function should be designed so the Treat Battery can call it directly. Don't bake treat logic into the portion calculator — keep them separate consumers of the same DER.

```typescript
// Treat Battery calls:
const der = calculateDER(pet);
const treatBudget = der.der * 0.10;
const treatsPerDay = Math.floor(treatBudget / treatKcalPerUnit);
```

---

## 10. Connection to M5 Pantry (Forward Reference)

The portion calculator builds the DER/cups-per-day foundation that M5's pantry system consumes. Key connections:

- **Bag countdown:** `days_remaining = total_cups_in_bag / cups_per_day` — uses this spec's cups_per_day
- **Shared pantry:** Sum each pet's cups_per_day for combined depletion rate
- **Mixed feeding (D-065):** `cups_per_day = (DER × diet_proportion) / kcal_per_cup` — diet_proportion slider is M5 scope
- **Goal weight in pantry:** Pet on a diet → pantry uses goal weight DER, not current weight DER

M2 builds the calculator. M5 wires it into the pantry depletion system. Keep the DER calculation as a **pure function** that M5 can import directly.

```typescript
// This function should be importable by pantry code in M5
export function calculateDER(pet: PetProfile): {
  rer: number;
  multiplier: number;
  der: number;
  usingGoalWeight: boolean;
} 

export function calculateCupsPerDay(
  der: number, 
  kcalPerCup: number | null
): number | null
```

---

## 11. Edge Cases

| Scenario | Behavior |
|----------|----------|
| No weight entered | Skip all portion calculations, hide portion card |
| No kcal_per_cup | Show kcal/day only, suppress cups display |
| Weight = 0 or negative | Validation rejects on save |
| Puppy/kitten with goal weight | Disabled. Growing animals should not restrict calories. UI hides goal weight field. |
| Geriatric cat + obesity | DER multiplier uses geriatric floor (1.5×), not standard adult. Hepatic lipidosis guard still applies. |
| Geriatric dog | Standard geriatric multiplier (1.2×). No special floor like cats. |
| Working dog + obesity | Use moderate multiplier (1.4× neutered, 1.6× intact). Working + obesity is contradictory — the moderate multiplier creates a reasonable deficit without the extreme working dog energy budget. |
| Cat with no activity level set | Default to 'low' (indoor). Most pet cats are indoor. |
| No life stage (DOB unknown) | Use adult multipliers as fallback. Show "Add [Pet Name]'s birthday for more accurate portions" prompt. |
| Multiple daily foods | M5 handles via diet_proportion. In M2, portion card assumes single-food (100% of DER). |

---

## 12. Testing Strategy

### Unit Tests (Pure Functions)

```
calculateRER(weight_kg) → exact values for reference weights
getDerBucket(lifeStage) → correct mapping for all 6 tiers
getDERMultiplier(key) → correct multiplier for each species/bucket/activity/neuter combo
calculateDER(petProfile) → end-to-end: profile → RER → multiplier → DER
calculateCupsPerDay(der, kcalPerCup) → basic division + null handling
checkCatHepaticLipidosisRisk(...) → trigger at exactly >1.0%
getEffectiveDERMultiplier(pet) → geriatric cat floor enforcement
```

### Regression Tests (7 reference cases)

| # | Pet | Weight | Life Stage | Activity | Neutered | Goal Wt | Expected DER |
|---|-----|--------|-----------|----------|----------|---------|-------------|
| 1 | Buster (dog) | 50 lbs | Adult | Moderate | Yes | — | 729 × 1.4 = **1,021** |
| 2 | Buster (dog) | 50 lbs | Adult | Moderate | Yes | 42 lbs | 643 × 1.4 = **900** |
| 3 | Luna (cat) | 10 lbs | Adult | Low | Yes | — | 234 × 1.0 = **234** |
| 4 | Senior cat | 12 lbs | Geriatric | Low | Yes | — | 281 × 1.5 = **422** |
| 5 | Obese geriatric cat | 15 lbs | Geriatric | Low | Yes | 12 lbs | RER@12lbs × 1.5 = **352** |
| 6 | Puppy (<4mo dog) | 8 lbs | Puppy | — | — | — | 165 × 3.0 = **495** |
| 7 | Puppy (6mo dog) | 25 lbs | Puppy | — | — | — | 440 × 2.0 = **880** |

### Boundary Tests

- Dog at exactly 4 months → switches from 3.0× to 2.0×
- Cat at exactly 14 years → geriatric bucket activates
- Cat at exactly 1.0% weekly loss → does NOT trigger (trigger is >1.0%)
- Cat at 1.01% weekly loss → DOES trigger
- DER for geriatric obese cat → must be ≥ RER × 1.5
- Puppy/kitten → goal weight field disabled

### Integration Tests

- Full profile → DER → cups/day for Buster (50lb dog) and Luna (10lb cat)
- Goal weight mode → verify DER uses goal, not current
- Missing fields → verify graceful degradation (no crash, partial display)
- Profile change → portion card updates on next view
