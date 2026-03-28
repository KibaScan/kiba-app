# M6 Spec: Vet Report — Diet-Centric PDF

> A shareable PDF summary of a pet's complete diet, health profile, and nutritional intake designed for veterinary consultations. The vet report contains NO Kiba scores — vets don't want proprietary app numbers. They want to know what the pet is eating, what the combined nutritional profile looks like, and what health factors are in play.
>
> Reference: M6_HANDOFF.md (vet report mock), D-094 (suitability framing — NOT used here), D-095 (UPVM compliance), D-103 (appointments), D-162 (BCS), D-163 (health records)
>
> Status: SPEC — ready for implementation

---

## 1. Design Philosophy

**Diet-centric, not product-centric.** The report answers "what is this pet's complete diet?" — not "how does this one product score." A vet seeing a patient wants the full picture in one glance: every food source, combined macros, health conditions, medications, body condition, and flags.

**No scores.** Kiba's scoring engine is a consumer tool. Vets have their own clinical framework. Showing "72% match" to a veterinary nutritionist is meaningless at best and undermines credibility at worst. The report presents raw nutritional data and lets the vet interpret it.

**Printable.** Single-purpose PDF, 2–4 pages. Clean layout with tables, not app-style cards. Black and white friendly (colors are accents, not information carriers). Standard US Letter size (8.5" × 11"). Page 4 (Owner Dietary Reference) only renders when health conditions are present.

---

## 2. Data Sources

Every field on the report maps to existing data. Nothing needs to be invented.

| Data | Source | Table/Field |
|---|---|---|
| Pet name, species, breed, age, weight | `pets` | Direct fields |
| Activity level, neutered status | `pets` | `activity_level`, `is_neutered` |
| Health conditions | `pets.health_conditions[]` + `pet_condition_details` | Condition names + sub-types (e.g., hyperthyroid: iodine-restricted) |
| BCS score + date | `pets` | `bcs_score`, `bcs_assessed_at` |
| Weight goal | `pets` | `weight_goal_level` → mapped to label ("Gradual loss", "Maintain", etc.) |
| Weight trend | `pets` | `caloric_accumulator` → estimated drift direction |
| Current diet | `pantry_items` → `pantry_pet_assignments` → `products` | All active items assigned to this pet |
| Per-product nutrition | `products` | GA as-fed + DMB columns |
| Per-product serving | `pantry_pet_assignments` | `serving_size`, `serving_size_kcal`, `feedings_per_day` |
| Combined daily intake | Computed | Sum of (serving_size_kcal × feedings_per_day) across all items |
| Combined GA (weighted) | Computed | Weighted average of each macro by caloric contribution |
| Supplement nutrients | `products` | `ga_omega3_pct`, `ga_taurine_pct`, `ga_dha_pct`, `ga_zinc_mg_kg`, `ga_omega6_pct` from any pantry product |
| Medications | `pet_medications` | Current + past, dosage, prescribed_for |
| Allergens | `pet_allergens` via `getPetAllergens()` | Allergen list |
| Ingredients per product | `product_ingredients` → `ingredients_dict` | Position-ordered, canonical names |
| AAFCO status per product | `products` | `aafco_statement`, `aafco_inference` |
| Recall status | `products` | `is_recalled` |
| Vaccination records | `pet_health_records` | `record_type = 'vaccination'`, most recent |
| Deworming records | `pet_health_records` | `record_type = 'deworming'`, most recent |
| Appointments | `pet_appointments` | Upcoming vet visits |

---

## 3. Report Layout

### Page 1: Pet Profile + Current Diet

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  KIBA — Diet Report for [Pet Name]                          │
│  Generated: [date]                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PET PROFILE                                        │    │
│  │                                                     │    │
│  │  Name: Buster              Species: Dog             │    │
│  │  Breed: Labrador Retriever  Age: 4 years 3 months  │    │
│  │  Weight: 72 lbs            Activity: Active         │    │
│  │  Neutered: Yes             BCS: 6/9 (assessed 3/15) │    │
│  │  Weight Goal: Gradual loss (-5%)                    │    │
│  │                                                     │    │
│  │  Health Conditions:                                 │    │
│  │  • Osteoarthritis                                   │    │
│  │  • Overweight                                       │    │
│  │                                                     │    │
│  │  Allergens:                                         │    │
│  │  • Chicken    • Wheat                               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  MEDICATIONS                                        │    │
│  │                                                     │    │
│  │  Current:                                           │    │
│  │  • Carprofen — 75mg twice daily (for: joint issues) │    │
│  │  • Dasuquin — 1 tablet daily (for: joint issues)    │    │
│  │                                                     │    │
│  │  Past:                                              │    │
│  │  • Amoxicillin — 250mg twice daily (ended 2/1/26)   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CURRENT DIET                                       │    │
│  │                                                     │    │
│  │  Daily Caloric Intake: ~1,420 kcal/day              │    │
│  │  Adjusted DER (gradual loss): ~1,350 kcal/day       │    │
│  │  Caloric Balance: +70 kcal/day over target          │    │
│  │                                                     │    │
│  │  ┌────────────────────────────────────────────────┐ │    │
│  │  │ Product          │ Form │ Serving │ kcal/day  │ │    │
│  │  ├──────────────────┼──────┼─────────┼───────────┤ │    │
│  │  │ Blue Buffalo LP  │ Dry  │ 1.5 cups│ 930       │ │    │
│  │  │   Chicken & Rice │      │ × 2/day │           │ │    │
│  │  ├──────────────────┼──────┼─────────┼───────────┤ │    │
│  │  │ Stella & Chewy's │ Top  │ 0.25 cup│ 180       │ │    │
│  │  │   Chicken Mixer  │      │ × 2/day │           │ │    │
│  │  ├──────────────────┼──────┼─────────┼───────────┤ │    │
│  │  │ Zesty Paws       │ Supp │ 1 chew  │ 10        │ │    │
│  │  │   Omega Bites    │      │ × 1/day │           │ │    │
│  │  ├──────────────────┼──────┼─────────┼───────────┤ │    │
│  │  │ Treats (avg)     │ Treat│ ~3/day  │ ~300      │ │    │
│  │  └──────────────────┴──────┴─────────┴───────────┘ │    │
│  │                                                     │    │
│  │  ⚠ Caloric intake exceeds adjusted target by ~5%   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Page 2: Combined Nutritional Profile + Flags

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  COMBINED NUTRITIONAL PROFILE                       │    │
│  │                                                     │    │
│  │  Weighted average across all daily foods,           │    │
│  │  by caloric contribution.                           │    │
│  │                                                     │    │
│  │  ┌──────────────┬────────┬────────┬───────────────┐ │    │
│  │  │ Nutrient     │ As-Fed │ DMB    │ AAFCO Adult   │ │    │
│  │  ├──────────────┼────────┼────────┼───────────────┤ │    │
│  │  │ Protein (min)│ 26.0%  │ 28.9%  │ ≥18.0% ✓     │ │    │
│  │  │ Fat (min)    │ 14.0%  │ 15.6%  │ ≥5.5%  ✓     │ │    │
│  │  │ Fiber (max)  │ 4.5%   │ 5.0%   │ —            │ │    │
│  │  │ Moisture     │ 10.0%  │ —      │ —            │ │    │
│  │  │ Calcium      │ 1.1%   │ 1.2%   │ ≥0.5%  ✓     │ │    │
│  │  │ Phosphorus   │ 0.9%   │ 1.0%   │ ≥0.4%  ✓     │ │    │
│  │  │ kcal/kg      │ 3,580  │ 3,978  │ —            │ │    │
│  │  └──────────────┴────────┴────────┴───────────────┘ │    │
│  │                                                     │    │
│  │  AAFCO thresholds shown are for adult dogs.         │    │
│  │  ✓ = meets or exceeds. ✗ = below threshold.         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  SUPPLEMENTAL NUTRIENTS (from all diet sources)     │    │
│  │                                                     │    │
│  │  These values are aggregated from all products in   │    │
│  │  the pet's pantry that report them.                 │    │
│  │                                                     │    │
│  │  Omega-3:        0.8%  (from: Blue Buffalo LP,      │    │
│  │                         Zesty Paws Omega Bites)     │    │
│  │  DHA:            0.05% (from: Zesty Paws Omega)     │    │
│  │  Omega-6:        2.1%  (from: Blue Buffalo LP)      │    │
│  │  Taurine:        0.12% (from: Blue Buffalo LP)      │    │
│  │  L-Carnitine:    present (from: Blue Buffalo LP)    │    │
│  │  Zinc:           120 mg/kg (from: Blue Buffalo LP)  │    │
│  │  Probiotics:     present (from: Stella & Chewy's)   │    │
│  │                                                     │    │
│  │  Note: Values are from manufacturer-reported GA.    │    │
│  │  Actual intake depends on serving size and          │    │
│  │  bioavailability.                                   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  FLAGS & OBSERVATIONS                               │    │
│  │                                                     │    │
│  │  ⚠ ALLERGEN: Blue Buffalo LP Chicken & Rice         │    │
│  │    contains chicken — listed allergen for Buster    │    │
│  │                                                     │    │
│  │  ⚠ AAFCO: Stella & Chewy's Chicken Mixer is        │    │
│  │    labeled for supplemental feeding only            │    │
│  │                                                     │    │
│  │  ℹ DCM: No pulse-heavy products in current diet    │    │
│  │                                                     │    │
│  │  ℹ Recalls: No active recalls on current diet      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  WEIGHT TRACKING                                    │    │
│  │                                                     │    │
│  │  Current: 72 lbs    BCS: 6/9 (overweight)          │    │
│  │  Goal: Gradual loss (-5%, ~1,350 kcal/day target)  │    │
│  │  Estimated drift: +0.3 lbs over past 45 days       │    │
│  │  (based on tracked feeding data)                    │    │
│  │                                                     │    │
│  │  Last weighed: March 15, 2026                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Page 3: Per-Product Detail + Health Records + Vet Notes

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  PER-PRODUCT DETAIL                                 │    │
│  │                                                     │    │
│  │  1. Blue Buffalo Life Protection Chicken & Rice      │    │
│  │     Category: Daily Food (Dry)                      │    │
│  │     AAFCO: Adult Maintenance — meets AAFCO          │    │
│  │     Protein: 26% | Fat: 15% | Fiber: 5% | M: 10%   │    │
│  │     kcal/kg: 3,646                                  │    │
│  │     ⚠ Contains chicken (allergen for Buster)        │    │
│  │                                                     │    │
│  │     Ingredients (first 10):                         │    │
│  │     Deboned Chicken, Chicken Meal, Brown Rice,      │    │
│  │     Barley, Oatmeal, Chicken Fat, Tomato Pomace,    │    │
│  │     Peas, Flaxseed, Natural Flavor                  │    │
│  │                                                     │    │
│  │  2. Stella & Chewy's Chicken Dinner Mixer           │    │
│  │     Category: Supplemental (Topper)                 │    │
│  │     AAFCO: Intermittent / supplemental feeding      │    │
│  │     Protein: 42% | Fat: 25% | Fiber: 4% | M: 5%    │    │
│  │     kcal/kg: 4,380                                  │    │
│  │                                                     │    │
│  │     Ingredients (first 10):                         │    │
│  │     Chicken, Chicken Meal, Chicken Liver, ...       │    │
│  │                                                     │    │
│  │  3. Zesty Paws Omega Bites (Supplement)             │    │
│  │     Not scored — supplement category                │    │
│  │     Omega-3: 0.8% | DHA: 0.05%                     │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  HEALTH RECORDS                                     │    │
│  │                                                     │    │
│  │  Vaccinations:                                      │    │
│  │  • DHPP — March 10, 2026 (Dr. Smith, Valley Vet)    │    │
│  │  • Rabies — Jan 5, 2026 (Dr. Smith, Valley Vet)     │    │
│  │                                                     │    │
│  │  Dewormings:                                        │    │
│  │  • Heartgard Plus — Monthly (last: March 1, 2026)   │    │
│  │                                                     │    │
│  │  Upcoming Appointments:                             │    │
│  │  • Vet Visit — April 15, 2026 (annual checkup)      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CONDITION MANAGEMENT NOTES                         │    │
│  │                                                     │    │
│  │  Osteoarthritis:                                    │    │
│  │  • Current diet provides omega-3 from 2 sources     │    │
│  │  • L-carnitine present in primary food              │    │
│  │  • Caloric intake slightly above target — weight    │    │
│  │    management is the primary intervention for OA    │    │
│  │                                                     │    │
│  │  Overweight:                                        │    │
│  │  • BCS 6/9 (assessed March 15)                      │    │
│  │  • Weight goal set to gradual loss (-5%)            │    │
│  │  • Current intake exceeds target by ~70 kcal/day    │    │
│  │  • Treat intake averaging ~300 kcal/day (21% of     │    │
│  │    total — above 10% guideline)                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  VET NOTES                                          │    │
│  │                                                     │    │
│  │  ________________________________________           │    │
│  │  ________________________________________           │    │
│  │  ________________________________________           │    │
│  │  ________________________________________           │    │
│  │  ________________________________________           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Generated by Kiba (kibascan.com)                   │    │
│  │  This report is informational. It does not          │    │
│  │  constitute veterinary advice, diagnosis, or        │    │
│  │  treatment recommendations.                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Page 4: Owner Dietary Reference (conditional — only renders when health conditions present)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  OWNER DIETARY REFERENCE                                    │
│                                                             │
│  These notes are general dietary guidance based on          │
│  published veterinary nutrition research for [Pet Name]'s   │
│  health profile. They do not replace individualized         │
│  veterinary dietary recommendations.                        │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  OSTEOARTHRITIS                                     │    │
│  │                                                     │    │
│  │  Goal: Reduce systemic inflammation, support        │    │
│  │  cartilage, and minimize joint stress through       │    │
│  │  weight management.                                 │    │
│  │                                                     │    │
│  │  Look for: Marine-sourced omega-3 (EPA/DHA).        │    │
│  │  Green-lipped mussel. Lean protein profiles.        │    │
│  │                                                     │    │
│  │  Avoid: High-calorie diets that promote weight      │    │
│  │  gain. Pro-inflammatory omega-6-heavy profiles.     │    │
│  │                                                     │    │
│  │  Caloric: Strictly controlled — lean body           │    │
│  │  condition is the most effective intervention.      │    │
│  │                                                     │    │
│  │  Roush et al. 2010, JAVMA; Kealy et al. 2002       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  OVERWEIGHT                                         │    │
│  │                                                     │    │
│  │  Goal: Safe, steady fat loss while preserving       │    │
│  │  lean muscle mass.                                  │    │
│  │                                                     │    │
│  │  Look for: High-fiber (>5% DMB). Lean protein      │    │
│  │  (>30% DMB, fat <14% DMB). L-Carnitine.            │    │
│  │                                                     │    │
│  │  Avoid: >4,200 kcal/kg dry. Free-feeding.          │    │
│  │  High-calorie treats. Portions based on current     │    │
│  │  weight rather than ideal weight.                   │    │
│  │                                                     │    │
│  │  Caloric: Base on ideal target weight.              │    │
│  │  Treats <10% of daily calories.                     │    │
│  │                                                     │    │
│  │  Brooks et al. 2014, JAAHA; APOP 2022              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Generated by Kiba (kibascan.com)                   │    │
│  │  This report is informational. It does not          │    │
│  │  constitute veterinary advice, diagnosis, or        │    │
│  │  treatment recommendations.                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Combined Nutritional Profile — Calculation

The combined GA is a **calorie-weighted average** across all daily food and supplemental products in the pantry. Treats and supplements are excluded from the combined macro calculation (but supplement nutrients are aggregated separately).

### Formula

For each macro (protein, fat, fiber, calcium, phosphorus):

```
combined_macro_pct = Σ (product_macro_pct × product_daily_kcal) / Σ (product_daily_kcal)
```

Where `product_daily_kcal = serving_size_kcal × feedings_per_day` from `pantry_pet_assignments`.

### DMB conversion

If any product in the diet is wet (moisture >12%), the combined as-fed values are misleading. Always compute combined DMB:

```
combined_macro_dmb_pct = Σ (product_macro_dmb_pct × product_daily_kcal) / Σ (product_daily_kcal)
```

If a product doesn't have pre-computed DMB values but has as-fed + moisture:
```
product_macro_dmb_pct = product_macro_pct / (100 - product_moisture_pct) × 100
```

### AAFCO pass/fail

Compare combined DMB values against AAFCO minimums/maximums for the pet's species + life stage. Show ✓ or ✗ per nutrient.

| Nutrient | Dog Adult Min | Cat Adult Min |
|---|---|---|
| Protein | 18.0% DMB | 26.0% DMB |
| Fat | 5.5% DMB | 9.0% DMB |
| Calcium | 0.5% DMB | 0.6% DMB |
| Phosphorus | 0.4% DMB | 0.5% DMB |

(Full thresholds in `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`)

### Products included in combined calculation

| Category | In Combined Macros | In Supplement Nutrients | In Diet Table |
|---|---|---|---|
| Daily food | ✓ | ✓ | ✓ |
| Supplemental (toppers) | ✓ | ✓ | ✓ |
| Treats | ✗ (too variable) | ✓ (if GA exists) | ✓ (aggregated as "Treats (avg)") |
| Supplements (vitamins) | ✗ (not food) | ✓ (this is their purpose) | ✓ |

---

## 5. Supplemental Nutrient Aggregation

Scan all pantry products (including supplements and treats) for these GA fields:

| Nutrient | Field | Unit | Display |
|---|---|---|---|
| Omega-3 | `ga_omega3_pct` | % | Value + source products |
| DHA | `ga_dha_pct` | % | Value + source products |
| EPA | `ga_epa_pct` | % | Value + source products |
| Omega-6 | `ga_omega6_pct` | % | Value + source products |
| Taurine | `ga_taurine_pct` | % | Value + source products |
| L-Carnitine | `ga_l_carnitine_mg` | mg | Value + source products |
| Zinc | `ga_zinc_mg_kg` | mg/kg | Value + source products |
| Probiotics | `ga_probiotics_cfu` | CFU text | "Present" + source products |

For nutrients with percentage values, show the **highest single-product value** (not a sum — percentages don't add across products). Note which product(s) provide it.

For probiotics and L-carnitine where presence matters more than quantity: show "Present" with source.

Disclaimer: "Values are from manufacturer-reported guaranteed analysis. Actual intake depends on serving size and bioavailability."

---

## 6. Condition Management Notes

For each active health condition, generate a factual summary of how the current diet relates to that condition. This is NOT advisory — it's observation.

### Data-driven observations per condition

| Observation | Source Data | Example |
|---|---|---|
| Omega-3 source count | Count pantry products with `ga_omega3_pct > 0` | "Current diet provides omega-3 from 2 sources" |
| Fat level vs condition threshold | Combined fat DMB vs condition-specific threshold from `conditionScoring.ts` | "Combined fat: 15.6% DMB (pancreatitis threshold: 12%)" |
| Caloric balance vs target | Total daily kcal vs adjusted DER | "Intake exceeds target by ~70 kcal/day" |
| Treat percentage | Treat kcal / total kcal | "Treats averaging 21% of total intake (guideline: <10%)" |
| Fiber content vs condition | Combined fiber DMB for obesity/diabetes | "Fiber at 5.0% DMB — above 5% threshold for weight management" |
| Wet food percentage | Count of wet products / total products for urinary/CKD | "Diet is 100% dry — moisture intake from food is minimal" |
| Allergen presence | Cross-reference pantry ingredients with pet allergens | "Blue Buffalo contains chicken (listed allergen)" |
| Protein level for CKD | Combined protein DMB vs CKD thresholds | "Protein at 28.9% DMB — within moderate range for CKD" |

These observations are generated programmatically from the condition rules in `conditionScoring.ts` and the diet data. Each observation is factual: "[metric] is [value] — [context]." No recommendations, no "you should," no "consider switching."

### D-095 compliance

| ✓ Safe | ✗ Unsafe |
|---|---|
| "Combined fat: 15.6% DMB" | "Fat is too high" |
| "Treats averaging 21% of total" | "Reduce treats immediately" |
| "Diet is 100% dry" | "You should switch to wet food" |
| "Contains chicken (listed allergen)" | "Remove this food" |
| "Fiber at 5.0% — above threshold" | "Good fiber level for weight loss" |

---

## 7. Flags & Observations

Auto-generated from diet data. Priority order:

| Priority | Flag | Condition | Display |
|---|---|---|---|
| 1 | Recall | Any pantry product `is_recalled = true` | "⚠ RECALL: [Product] has been recalled by the FDA" |
| 2 | Allergen conflict | Pantry product contains pet's allergen | "⚠ ALLERGEN: [Product] contains [allergen] — listed allergen for [Pet]" |
| 3 | AAFCO gap | Any daily food with `aafco_statement` null or unknown | "⚠ AAFCO: [Product] does not have verified AAFCO compliance" |
| 4 | Supplemental-only | All daily foods are supplemental | "⚠ DIET: No complete-and-balanced food in current diet" |
| 5 | Caloric excess | Total intake >120% of adjusted DER | "⚠ CALORIC: Intake exceeds target by [X]%" |
| 6 | Treat excess | Treat kcal >10% of total | "ℹ TREATS: Treat intake is [X]% of total calories (guideline: <10%)" |
| 7 | DCM | Any daily food triggers D-137 pulse advisory (dogs only) | "ℹ DCM: [Product] contains pulse-heavy ingredients linked to DCM investigation" |
| 8 | No recalls | No recalled products | "ℹ Recalls: No active recalls on current diet" |

---

## 8. Treat Aggregation

Treats are numerous and variable — showing each individual treat isn't useful for a vet. Aggregate:

```
Treats (avg) | Treat | ~3/day | ~300 kcal
```

Computed from:
- `useTreatBatteryStore` → `consumedByPet[petId].kcal` (today's tracked treats)
- Or from pantry: sum of treat items' `serving_size_kcal × feedings_per_day`
- Count: `consumedByPet[petId].count` or pantry treat item count

If no treat data exists, show "Treats: Not tracked" — don't show zero.

---

## 9. PDF Generation Approach

### Recommended: `expo-print` + HTML template

Generate an HTML string, render to PDF via `expo-print`, then share via `expo-sharing`.

```typescript
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const html = generateVetReportHTML(reportData);
const { uri } = await Print.printToFileAsync({ html, width: 612, height: 792 }); // US Letter
await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Vet Report' });
```

### Why HTML → PDF

- No native PDF library dependency (react-native-pdf-lib is unmaintained)
- Full control over layout via CSS
- Printable — CSS `@media print` rules
- Tables render cleanly
- Works on both iOS and Android
- `expo-print` is already in the Expo ecosystem

### HTML template structure

- Inline CSS (no external stylesheets in PDF context)
- CSS Grid or table-based layout for the data tables
- Page breaks via `page-break-before: always` between sections
- Monochrome-friendly: accent colors are supplemental, not information-carrying
- Kiba branding minimal: small logo + URL in footer

---

## 10. Entry Points

| Location | Trigger | Gate |
|---|---|---|
| PetHubScreen | "Generate Vet Report" button in pet actions section | Premium (`canExportVetReport()` already exists) |
| ResultScreen | Future — "Include in Vet Report" action (not M6) | — |

### PetHubScreen button

Below the existing settings rows, in the actions area:
- Icon: `document-text-outline`
- Label: "Generate Vet Report"
- Premium badge if free user → paywall on tap
- On tap (premium): generate report → loading spinner → share sheet

---

## 11. Report Data Assembly

### `src/services/vetReportService.ts` (NEW)

Single function that assembles all data for the report:

```typescript
interface VetReportData {
  pet: Pet;
  conditions: PetConditionDetail[];
  allergens: string[];
  medications: PetMedication[];
  dietItems: VetReportDietItem[];
  combinedNutrition: CombinedNutrition;
  supplementNutrients: SupplementNutrient[];
  flags: VetReportFlag[];
  conditionNotes: ConditionNote[];
  healthRecords: { vaccinations: PetHealthRecord[]; dewormings: PetHealthRecord[] };
  upcomingAppointments: Appointment[];
  treatSummary: { avgDailyKcal: number; avgDailyCount: number } | null;
  weightTracking: {
    currentLbs: number;
    bcsScore: number | null;
    bcsDate: string | null;
    goalLevel: number;
    goalLabel: string;
    estimatedDriftLbs: number | null;
    lastWeighed: string | null;
  };
  adjustedDER: number;
  caloricBalance: number; // actual intake - adjusted DER
  ownerDietaryCards: OwnerDietaryCard[];     // NEW — Page 4
  conditionConflicts: ConflictNote[];        // NEW — Page 4 conflict callouts
  generatedAt: string;
}

// NEW — Owner Dietary Reference card data
interface OwnerDietaryCard {
  conditionKey: string;       // e.g., 'kidney_disease'
  conditionLabel: string;     // e.g., 'Kidney Disease (CKD)'
  goal: string;
  lookFor: string;
  avoid: string;
  caloricNote: string | null;
  note: string | null;        // species-specific clinical note
  citation: string;
  speciesCallout: string | null;  // HTML for yellow/green callout boxes
}

// NEW — Conflict detection for contradictory condition pairs
interface ConflictNote {
  conditions: [string, string];
  note: string;
}

async function assembleVetReportData(petId: string): Promise<VetReportData>
```

This function makes all necessary DB queries (parallel where possible) and computes derived values. The HTML template function then receives this data object and renders it.

### `src/utils/vetReportHTML.ts` (NEW)

```typescript
function generateVetReportHTML(data: VetReportData): string
```

Pure function: data in, HTML string out. No side effects. Testable.

---

## 12. What's NOT on the Report

| Excluded | Reason |
|---|---|
| Kiba scores (IQ/NP/FC/final) | Proprietary, meaningless to vets |
| Score breakdown or waterfall | Same — internal scoring artifact |
| Ingredient severity ratings | Kiba-specific classification, not clinical |
| Good/caution/severe ingredient labels | Vets have their own assessment framework |
| Benchmark comparisons | Relative to Kiba's DB, not clinically meaningful |
| Brand recommendations | Brand-blind principle (D-094) |
| "Switch to X" suggestions | D-095 — no prescriptive language |
| Breed modifier details | Internal scoring mechanism |
| Kiba Index votes (M8) | Not built yet, and consumer-facing anyway |

---

## 13. D-095 Compliance

The report footer disclaimer:

> "This report is generated by Kiba (kibascan.com) from user-entered data and manufacturer-reported product information. It does not constitute veterinary advice, diagnosis, or treatment recommendations. Discuss all dietary decisions with your veterinarian."

All body copy follows the observational pattern: "[metric] is [value]" — never "[metric] should be [different value]."

---

## 14. Free vs Premium

| Feature | Free | Premium |
|---|---|---|
| Generate vet report | Paywall | ✓ |
| View report preview | Future (not M6) | — |

Gate via `canExportVetReport()` in `permissions.ts` (already exists).

---

## 15. Assumptions

1. `expo-print` and `expo-sharing` are already installed or easily addable to the Expo project.
2. Pantry data is populated — if a pet has no pantry items, the diet section shows "No foods tracked. Add products to [Pet Name]'s pantry for a complete diet report."
3. Health records (vaccinations/dewormings) may be empty — show "No records logged" per section.
4. Medications may be empty — show "No medications logged."
5. The report is a snapshot — generated at a point in time, not auto-updating.
6. PDF generation takes 1-3 seconds — show loading indicator during assembly + render.

---

## 16. Non-Goals (M6)

- ❌ Report history / saved reports (just regenerate when needed)
- ❌ Report customization (choose which sections to include)
- ❌ Multi-pet report (one pet at a time)
- ❌ Emailing directly to vet (share sheet handles this)
- ❌ QR code linking to live data (just a static PDF)
- ❌ Weight history graph (just current + drift estimate)
- ❌ Walk tracking integration (deferred to M10+)

---

## 17. Owner Dietary Reference — Page 4

Condensed, species-specific dietary guidance cards that render on the final page of the vet report for each active health condition. Complements the data-driven "Condition Management Notes" (Section 6) which show what the pet IS eating — these cards show what to look for generally.

### Rendering Rules

- Only renders when `pet.health_conditions.length > 0`
- "No Known Conditions" card renders only when no other conditions are present (D-119 "Perfectly Healthy")
- Cards render in clinical priority order (not alphabetical)
- Conflict callouts render between cards when contradictory condition pairs are detected
- 1–3 cards: one additional page. 4+ cards: overflow to second page with `page-break-inside: avoid` per card
- All copy is D-095 compliant — observational, no prohibited terms
- No brand names in any card

### Card Render Priority Order

```typescript
const CARD_RENDER_ORDER = [
  'kidney_disease',
  'heart_disease',
  'pancreatitis',
  'diabetes',
  'urinary_issues',
  'food_allergies',
  'overweight',
  'underweight',
  'sensitive_stomach',
  'skin_coat',
  'hyperthyroidism',
  'hypothyroidism',
  'joint_issues',
  'no_known_conditions',  // only renders alone
];
```

### Condition Conflict Detection

Some condition pairs produce contradictory dietary guidance. Render a yellow callout box between the relevant cards:

| Condition A | Condition B | Conflict |
|---|---|---|
| CKD (moderate protein) | Underweight (high protein) | Protein target conflict — vet guidance needed |
| Pancreatitis dog (ultra-low fat) | Underweight (calorie-dense) | Fat restriction limits calorie density |
| Diabetes cat (low carb) | Overweight cat (calorie restriction) | Compatible — low-carb wet food serves both |
| Heart disease (sodium restrict) | CKD (sodium restrict) | Compatible — both restrict sodium |

```typescript
function detectConflicts(conditions: string[], species: 'dog' | 'cat'): ConflictNote[] {
  const conflicts: ConflictNote[] = [];

  if (conditions.includes('kidney_disease') && conditions.includes('underweight')) {
    conflicts.push({
      conditions: ['kidney_disease', 'underweight'],
      note: 'CKD requires moderate protein restriction while underweight recovery benefits from high protein. Veterinary guidance on protein targets is recommended for this combination.',
    });
  }

  if (species === 'dog' && conditions.includes('pancreatitis') && conditions.includes('underweight')) {
    conflicts.push({
      conditions: ['pancreatitis', 'underweight'],
      note: 'Canine pancreatitis requires strict fat restriction, which limits calorie density. Multiple small meals of lean, calorie-dense-per-protein foods may help — discuss with a veterinarian.',
    });
  }

  return conflicts;
}
```

### HTML Template

```typescript
function renderOwnerDietaryPage(
  cards: OwnerDietaryCard[],
  conflicts: ConflictNote[],
  petName: string
): string {
  if (cards.length === 0) return '';

  let html = `
    <div style="page-break-before: always;">
      <div style="font-size: 16px; font-weight: bold; margin-bottom: 4px; color: #333;">
        OWNER DIETARY REFERENCE
      </div>
      <div style="font-size: 10px; color: #666; margin-bottom: 16px;">
        General dietary guidance based on published veterinary nutrition
        research for ${petName}'s health profile. These notes do not
        replace individualized veterinary dietary recommendations.
      </div>
  `;

  for (const card of cards) {
    for (const conflict of conflicts) {
      if (conflict.conditions[1] === card.conditionKey) {
        html += `
          <div style="background: #FFF8E1; border-left: 3px solid #F9A825;
                      padding: 8px; margin: 8px 0; font-size: 10px;">
            <strong>⚠️ Note:</strong> ${conflict.note}
          </div>`;
      }
    }

    html += `
      <div style="page-break-inside: avoid; margin-bottom: 14px;
                  padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px;">
        <div style="font-weight: bold; font-size: 12px; margin-bottom: 5px;
                    text-transform: uppercase; color: #333;
                    border-bottom: 1px solid #eee; padding-bottom: 4px;">
          ${card.conditionLabel}
        </div>
        <div style="font-size: 10px; color: #555; margin-bottom: 3px;">
          <strong>Goal:</strong> ${card.goal}
        </div>
        <div style="font-size: 10px; color: #555; margin-bottom: 3px;">
          <strong>Look for:</strong> ${card.lookFor}
        </div>
        <div style="font-size: 10px; color: #555; margin-bottom: 3px;">
          <strong>Avoid:</strong> ${card.avoid}
        </div>
        ${card.caloricNote ? `
        <div style="font-size: 10px; color: #555; margin-bottom: 3px;">
          <strong>Caloric:</strong> ${card.caloricNote}
        </div>` : ''}
        ${card.note ? `
        <div style="font-size: 9px; color: #666; margin-top: 3px; font-style: italic;">
          ${card.note}
        </div>` : ''}
        ${card.speciesCallout || ''}
        <div style="font-size: 8px; color: #999; margin-top: 5px;">
          ${card.citation}
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}
```

### Card Data Source: `src/data/ownerDietaryCards.ts` (NEW)

```typescript
function getOwnerDietaryCards(
  conditions: string[],
  species: 'dog' | 'cat'
): OwnerDietaryCard[] {
  if (conditions.length === 0) {
    return [OWNER_CARDS['no_known_conditions'][species]];
  }

  return CARD_RENDER_ORDER
    .filter(key => conditions.includes(key))
    .map(key => OWNER_CARDS[key]?.[species])
    .filter(Boolean);
}
```

---

### All 28 Cards

#### Card Registry

| # | Condition | Dog | Cat | Gate |
|---|-----------|-----|-----|------|
| 1 | No Known Conditions | ✅ | ✅ | Only when no conditions present |
| 2 | Joint Issues | ✅ | ✅ | — |
| 3 | Sensitive Stomach | ✅ | ✅ | — |
| 4 | Overweight | ✅ | ✅ | — |
| 5 | Underweight | ✅ | ✅ | — |
| 6 | Diabetes | ✅ | ✅ | Critical species split |
| 7 | Kidney Disease | ✅ | ✅ | — |
| 8 | Urinary Issues | ✅ | ✅ | — |
| 9 | Heart Disease | ✅ | ✅ | Different diseases (DCM vs HCM) |
| 10 | Pancreatitis | ✅ | ✅ | Critical species split |
| 11 | Skin & Coat | ✅ | ✅ | — |
| 12 | Hypothyroidism | ✅ | ✅ (rare) | Dog-primary |
| 13 | Hyperthyroidism | ✅ (rare) | ✅ | Cat-primary |
| 14 | Food Allergies | ✅ | ✅ | — |

---

#### 1. No Known Conditions (Healthy Maintenance)

**🐶 Dog**
- **Goal:** Maintain long-term vitality, lean body condition, and balanced nutrition through a complete and balanced commercial diet.
- **Look for:** Diets labeled "complete and balanced" meeting AAFCO or FEDIAF guidelines for the dog's life stage. For large breed puppies (>50 lbs expected adult weight), large breed-specific puppy formulas. Lean animal proteins, balanced omega-3/omega-6 ratios.
- **Avoid:** Unbalanced homemade or unregulated raw diets. Known canine toxins: grapes/raisins, onions/garlic/leeks, chocolate, macadamia nuts, xylitol.
- **Caloric:** RER × activity factor (typically 1.4–1.6 for neutered adults). Treats <10% of daily calories.
- **Citation:** AAFCO Official Publication (2016) — protein ≥18.0% DM, fat ≥5.5% DM. NRC 2006. Baldwin et al. 2010, JAAHA 46(4):285–296.

**🐱 Cat**
- **Goal:** Maintain long-term vitality with species-appropriate nutrition. Cats are obligate carnivores requiring animal-sourced protein, taurine, pre-formed vitamin A, and arachidonic acid.
- **Look for:** AAFCO/FEDIAF-compliant diets. Wet/canned food preferred to increase daily water intake. High animal-sourced protein. Taurine in the formula.
- **Avoid:** Dog food (inadequate taurine — can be fatal long-term). Vegan/vegetarian diets. Known feline toxins: lilies (pollen causes fatal kidney failure), onions, garlic, grapes, essential oils.
- **Caloric:** Standard indoor RER, typically 200–250 kcal/day. Treats <10%.
- **Citation:** AAFCO (2016) — protein ≥26.0% DM, fat ≥9.0% DM, taurine ≥0.10% DM (dry)/≥0.20% DM (wet). Pion et al. 1987, Science 237:764–768.

---

#### 2. Joint Issues (Osteoarthritis, Dysplasia)

**🐶 Dog**
- **Goal:** Reduce systemic inflammation, support cartilage, and minimize mechanical stress on joints through weight management.
- **Look for:** Marine-sourced omega-3 (EPA/DHA). Green-lipped mussel extract. Lean protein profiles. Glucosamine/chondroitin (evidence is mixed but widely used).
- **Avoid:** High-calorie diets that promote weight gain. Pro-inflammatory omega-6-heavy profiles.
- **Caloric:** Strictly controlled. The Purina lifetime study showed lean dogs lived 1.8 years longer with OA treatment delayed ~3 years.
- **Citation:** Roush et al. 2010, JAVMA 236(1):59–66. Kealy et al. 2002, JAVMA 220(9):1315–1320. ⚠️ Glucosamine: Vandeweerd et al. 2012, JVIM 26(3):448–456 (evidence "low and contradictory").

**🐱 Cat**
- **Goal:** Reduce joint inflammation and maintain lean weight. 90% of cats over 12 have radiographic DJD but only ~4% have clinical documentation — feline OA is massively underdiagnosed.
- **Look for:** Marine-sourced omega-3 (EPA/DHA) — cats cannot convert plant-based ALA to EPA/DHA. Wet food preferred. Feline-formulated glucosamine/chondroitin (liquids or powders in wet food).
- **Avoid:** High-calorie dry foods. Excess calories — obesity severely exacerbates feline arthritis.
- **Caloric:** Strict weight control.
- **Citation:** Hardie et al. 2002, JAVMA 220(5):628–632. Rivers et al. 1975, Nature 258:171–173 (cats cannot convert ALA to EPA/DHA).

---

#### 3. Sensitive Stomach (GI Issues)

**🐶 Dog**
- **Goal:** Highly digestible food that minimizes GI workload and promotes a healthy microbiome.
- **Look for:** Highly digestible GI or limited ingredient diets. Digestible proteins (fish, turkey, egg) in primary positions. Soluble fibers (psyllium, pumpkin, beet pulp). Prebiotics (chicory root, inulin, FOS). Clinically studied probiotics (E. faecium SF68).
- **Avoid:** High-fat foods (>18% fat DMB). Dairy/lactose. Constant protein rotation if intolerance is suspected.
- **Caloric:** Divide into 3–4 smaller meals.
- **Citation:** Washabau & Day 2012, Canine and Feline Gastroenterology (Elsevier). Bybee et al. 2011, JVIM 25(4):856–860. Mandigers et al. 2010, JVIM 24(6):1350–1357.

**🐱 Cat**
- **Goal:** Highly digestible food supporting the GI tract. Cats are prone to IBD and hairball-related GI issues.
- **Look for:** Novel protein diets (rabbit, venison, duck) or hydrolyzed protein diets. Soluble fiber (psyllium) for hairball passage. Feline-specific probiotics. B12 supplementation if chronic — cats with GI disease frequently deplete cobalamin.
- **Avoid:** Dairy products. Abrupt diet changes. Excessive plant matter. High-fat foods.
- **Caloric:** Small, frequent meals.
- **Citation:** Jergens 2012, JFMS 14(7):445–458. Simpson et al. 2001, JVIM 15(1):26–32 (B12 — 49/80 cats). Guilford et al. 2001, JVIM 15(1):7–13.

---

#### 4. Overweight / Obesity

**🐶 Dog**
- **Goal:** Safe, steady fat loss while preserving lean muscle mass.
- **Look for:** High-fiber (>5% DMB). Lean protein (>30% DMB with fat <14% DMB). L-Carnitine.
- **Avoid:** Calorie-dense foods (>4,200 kcal/kg dry). Puppy/performance formulas. Free-feeding. High-calorie treats. Drastically reduced portions of standard food (risks nutrient deficiency).
- **Caloric:** Base on ideal target weight. Safe loss: 1–2%/week. Treats <10%.
- **Citation:** Brooks et al. 2014, JAAHA 50(1):1–11. APOP 2022: 59% of dogs overweight/obese.

**🐱 Cat**
- **Goal:** Safe, gradual fat loss. Rapid weight loss in cats is associated with hepatic lipidosis (fatty liver disease), which can be fatal.
- **Look for:** High-protein, low-carbohydrate wet food. Veterinary metabolic/satiety formulas. L-Carnitine.
- **Avoid:** Severe caloric restriction or skipping meals. High-carbohydrate dry kibble free-choice. If the cat refuses food for >24 hours, veterinary consultation is recommended.
- **Caloric:** Base on ideal target weight. Safe loss: 0.5–2%/week.
- **Citation:** Center et al. 1993, JVIM 7(6):349–359 (hepatic lipidosis). Biourge et al. 1994, Am J Vet Res 55(9):1291–1302. Brooks et al. 2014, JAAHA.

---

#### 5. Underweight (Malnutrition, Recovery)

**🐶 Dog**
- **Goal:** Safely increase caloric intake with nutrient-dense foods without GI upset.
- **Look for:** Calorie-dense formulas (>4,000 kcal/kg dry). Puppy or performance formulas. High biological value animal proteins. Wet food for palatability.
- **Avoid:** "Lite"/weight management formulas. High-fiber foods. Large single meals.
- **Caloric:** Feed in 3+ small, frequent meals. Gradually increase — refeeding syndrome risk after prolonged restriction.
- **Citation:** Justin & Hohenhaus 1995, JVIM 9(4):228–233. Chan 2015, Wiley (chapter 16).

**🐱 Cat**
- **Goal:** Safely increase caloric intake. Palatability is critical — cats are sensitive to food aroma and texture.
- **Look for:** Kitten growth formulas. Clinical recovery wet diets. Highly aromatic, high-fat, high-protein meats/liver. Warming wet food slightly enhances aroma.
- **Avoid:** "Indoor cat"/weight management formulas. Bulky high-fiber carbohydrates. Foods associated with prior nausea — cats develop prolonged food aversions.
- **Caloric:** Feed in 3+ small meals. Refeeding syndrome risk applies.
- **Citation:** Michel 2001, JFMS 3(1):3–8 (food aversion). Justin & Hohenhaus 1995, JVIM 9(4):228–233.

---

#### 6. Diabetes

**🐶 Dog**
- **Goal:** Glycemic control — consistent, slow glucose release to minimize blood sugar spikes.
- **Look for:** High-fiber (>5% DMB). Complex low-glycemic carbs (barley, sorghum, oats). Consistent formulation.
- **Avoid:** Simple sugars (corn syrup, molasses, fructose, dextrose). Semi-moist foods. High-glycemic carbs (white rice, corn). Inconsistent feeding schedules.
- **Caloric:** Same measured amount, same times daily, coordinated with insulin (typically two meals 12 hours apart). Any food change may require insulin dose adjustment.
- **Note:** Canine diabetes is almost always insulin-dependent and does not typically achieve remission.
- **Citation:** Behrend et al. 2018, JAAHA 54(1):1–21. Graham et al. 2002, JSAP 43(2):67–73. Catchpole et al. 2005, Diabetologia 48(10):1948–1956.

**🐱 Cat**
- **Goal:** Glycemic control through strict carbohydrate restriction. A significant percentage of diabetic cats can achieve remission through dietary changes.
- **Look for:** Ultra-low carbohydrate diets (estimated carbs <10% of calories). High-protein formulas. Wet/canned/pâté foods (naturally lower carb than kibble).
- **Avoid:** Dry kibble as sole diet. Wet foods in "gravy" or "sauce" (thickened with cornstarch/flour). Simple sugars. Semi-moist foods.
- **Caloric:** Consistent schedule coordinated with insulin. If also overweight, gradual weight loss improves insulin sensitivity.
- **Note:** Published remission rates: 64–84% in cats started on low-carb diets within 6 months of diagnosis.
- **Citation:** Bennett et al. 2006, JFMS 8(2):73–84 (68% remission). Roomp & Rand 2009, JFMS 11(8):668–682 (84% remission within 6 months). Behrend et al. 2018, JAAHA.

---

#### 7. Kidney Disease (CKD)

**🐶 Dog**
- **Goal:** Slow progression by reducing phosphorus load, managing protein quality, and maintaining hydration and caloric intake.
- **Look for:** Low phosphorus (primary dietary priority). Moderate high-quality protein (20–28% DMB). Wet food or added water. Omega-3 (EPA/DHA).
- **Avoid:** High-phosphorus foods (bones, dairy, organ meats, jerky). High-protein "ancestral"/performance diets. High-sodium foods. Raw diets.
- **Caloric:** Maintain adequate intake — CKD dogs become nauseous and stop eating, creating a muscle-wasting spiral.
- **Citation:** Jacob et al. 2002, JAVMA 220(8):1163–1170 (~3× survival on renal diet). IRIS 2023. Polzin 2011, Vet Clin North Am. Brown et al. 1998, J Lab Clin Med 131(5):447–455.

**🐱 Cat**
- **Goal:** Slow progression through phosphorus restriction, maximize hydration, maintain food intake. CKD is the #1 cause of death in senior cats (30–40% of cats >10, up to 80% >15).
- **Look for:** Wet food (strongly preferred — cats' low thirst drive makes dry food inadequate for CKD). Low phosphorus. Moderate high-quality protein (28–35% DMB). Omega-3. Potassium supplementation may be needed (18–30% of CKD cats develop hypokalemia).
- **Avoid:** High-phosphorus foods (bone meal, jerky, fish with bones). High-protein dry kibble. High-sodium foods.
- **Caloric:** Palatability is the priority. Warming wet food enhances aroma. Any calories are better than no calories in a CKD cat that has stopped eating.
- **Citation:** Ross et al. 2006, JAVMA 229(6):949–957 (RCT — 0% renal deaths on renal diet vs 22%). Elliott et al. 2000, JSAP 41(6):235–242 (median survival 633 vs 264 days). IRIS 2023. Stockman 2024, JFMS.

---

#### 8. Urinary Issues (Stones, Crystals, FLUTD)

**🐶 Dog**
- **Goal:** Increase urine dilution through moisture intake. Stone type determines specific approach — veterinary diagnosis is required.
- **Look for:** Wet food or added water (most effective strategy for all stone types). Veterinary urinary diets for the specific stone type. Healthy weight.
- **Avoid:** Depends on stone type. Generally: dry kibble as sole diet, high-mineral foods. For CaOx: high-calcium, high-oxalate foods. For urate (Dalmatians): high-purine foods (organ meats, sardines).
- **Caloric:** Maintenance. Weight management is beneficial.
- **Note:** Struvite (alkaline urine) and calcium oxalate (acidic urine) require opposite approaches. CaOx cannot be dissolved medically.
- **Citation:** Lulich et al. 2016, JVIM 30(5):1564–1574 (ACVIM consensus). Bannasch et al. 2008, PLoS Genet 4(11):e1000246 (Dalmatian urate). Buckley et al. 2011, Br J Nutr 106(Suppl 1):S128–S130.

**🐱 Cat**
- **Goal:** Maximize urine dilution and address the stress/dehydration component. Male cats are at risk of fatal urethral blockages. The most common feline urinary issue is FIC, driven primarily by stress and dehydration.
- **Look for:** Wet food (highest-priority dietary intervention). Feline urinary diets. Calming ingredients in some diets (L-Tryptophan, alpha-casozepine). Environmental enrichment and stress reduction.
- **Avoid:** 100% dry kibble diets. High-magnesium/high-phosphorus ingredients. Obesity (major risk factor for blockages).
- **Caloric:** Calorie control — obesity increases blockage risk significantly.
- **Note:** Male cat urethral obstruction: ~8.5% mortality, 36% re-obstruction rate. Wet food associated with significantly lower FIC recurrence.
- **Citation:** Buffington et al. 2006, JFMS 8(4):261–268 (MEMO — FIC driven by stress). Segev et al. 2011, JFMS 13(2):101–108. Markwell et al. 1999, JAVMA 214(3):361–365. Beata et al. 2007, J Vet Behav 2(2):40–46.

---

#### 9. Heart Disease

**🐶 Dog (CHF, DCM)**
- **Goal:** Manage sodium to reduce fluid retention, support cardiac muscle, maintain lean body mass.
- **Look for:** Controlled sodium formulas. Taurine + L-Carnitine supplementation (especially DCM-prone breeds: Golden Retrievers, Dobermans, Cocker Spaniels, Boxers). Omega-3 (EPA/DHA). Adequate calories to prevent cardiac cachexia.
- **Avoid:** High-sodium foods/treats (jerky, cheese, lunch meats, hot dogs). Foods with peas/lentils/legumes in top positions (FDA investigated grain-free/legume-heavy diets and DCM — causality not established). Excessive sodium restriction (activates RAAS).
- **Caloric:** Prevent cardiac cachexia but avoid obesity.
- **Citation:** Keene et al. 2019, JVIM 33(3):1127–1140 (ACVIM MMVD consensus). Kittleson et al. 1997, JVIM 11(4):204–211. FDA CVM DCM Investigation 2018–2022.

**🐱 Cat (HCM)**
- **Goal:** Support cardiac function, manage blood pressure, ensure adequate taurine. HCM affects ~15% of apparently healthy cats.
- **Look for:** Taurine (non-negotiable — deficiency causes DCM and retinal degeneration in cats). High-quality animal proteins. Wet food (dehydration thickens blood, increases cardiac workload and clot risk). Omega-3. Moderate sodium levels.
- **Avoid:** Taurine-deficient foods. High-sodium treats (human tuna in brine). Unbalanced homemade diets.
- **Caloric:** Maintenance. Severe heart disease causes cachexia; mild heart disease is worsened by obesity.
- **Note:** Taurine-deficiency DCM (Pion et al. 1987) is reversible with supplementation. Rare since commercial cat foods were reformulated, but cats on homemade/vegan/dog food diets remain at risk.
- **Citation:** Pion et al. 1987, Science 237:764–768. Payne et al. 2015, J Vet Cardiol 17(Suppl 1):S244–S257 (HCM 14.7%). Luis Fuentes et al. 2020, JVIM 34(3):1062–1077.

---

#### 10. Pancreatitis

**🐶 Dog**
- **Goal:** Minimize pancreatic stimulation by strictly limiting dietary fat.
- **Look for:** Ultra-low-fat GI diets (<12% fat DMB). Highly digestible lean proteins (white fish, turkey, egg whites). Digestible carbohydrates. Digestive enzyme supplementation.
- **Avoid:** High-fat foods (>12% fat DMB). All high-fat treats (marrow bones, pig ears, peanut butter, cheese, salmon oil). Table scraps. Performance/puppy diets.
- **Caloric:** Divide into 3–4 smaller meals per day.
- **Note:** The <12% fat DMB threshold is more conservative than some published definitions (<20% ME per Cridge et al. 2022), reflecting the severity of potential flare-ups.
- **Citation:** Lem et al. 2008, JAVMA 233(9):1425–1431. Cridge et al. 2022, JVIM 36(3):847–864. Xenoulis et al. 2010, JAAHA 46(4):229–234.

**🐱 Cat**
- **Goal:** Support digestive function with highly digestible proteins. Feline pancreatitis is NOT triggered by dietary fat — it is typically chronic, low-grade, and associated with concurrent IBD and liver inflammation (triaditis).
- **Look for:** Novel proteins (rabbit, venison, duck) or hydrolyzed protein diets to address the IBD component. Moderate fat is well-tolerated. Highly aromatic wet food to encourage eating. B12 supplementation (77% of cats with EPI are B12 deficient).
- **Avoid:** Raw diets (immunosuppression risk). Foods triggering known allergies. Allowing the cat to go without food (>24 hours → hepatic lipidosis risk).
- **Caloric:** Maintaining food intake is the priority.
- **⚠️ Critical species difference:** Do NOT apply canine fat restrictions to cats.
- **Citation:** De Cock et al. 2007, Vet Pathol 44(1):39–49 (no link to fat). Weiss et al. 1996, JAVMA 209(6):1114–1116 (triaditis). Xenoulis et al. 2016, JVIM 30(6):1790–1797.

---

#### 11. Skin & Coat Issues (Atopy, Dermatitis)

**🐶 Dog**
- **Goal:** Reduce skin inflammation, rebuild the skin barrier, minimize allergen exposure.
- **Look for:** Omega-3 (EPA/DHA) — associated with reduced itching and inflammation. Omega-6 (linoleic acid) for skin barrier. Limited ingredient formulas (1–2 identified protein sources). Hydrolyzed protein diets if food allergy is suspected.
- **Avoid:** Unnamed protein sources ("meat meal," "animal fat"). Foods with >3–4 distinct animal proteins. If diagnosed: most common canine allergens are beef (34%), dairy (17%), chicken (15%), wheat (13%).
- **Caloric:** Maintenance. Elimination trial minimum: 8 weeks.
- **Note:** True grain allergies are rare. The immune response is almost always to the animal protein.
- **Citation:** Mueller et al. 2016, BMC Vet Res 12:9. Olivry et al. 2015, BMC Vet Res 11:210 (ICADA). Ricci et al. 2013, J Anim Physiol Anim Nutr 97(Suppl 1):32–38.

**🐱 Cat**
- **Goal:** Reduce skin inflammation and identify dietary allergens. Commonly presents as miliary dermatitis, overgrooming (bald belly), or eosinophilic granuloma complex.
- **Look for:** Marine-sourced omega-3 (EPA/DHA) — cats cannot convert plant-based ALA. Hydrolyzed or novel protein diets (rabbit, venison, duck). Single-source protein formulas.
- **Avoid:** Variety packs (constant protein rotation prevents allergen identification). Unnamed protein sources. If diagnosed: most common feline allergens are beef (18%), fish (17%), chicken (5%), dairy (4%). Fish is the #2 feline allergen despite popular belief.
- **Caloric:** Maintenance. 8-week minimum elimination trial.
- **Citation:** Mueller et al. 2016, BMC Vet Res 12:9. Rivers et al. 1975, Nature 258:171–173. Olivry & Bizikova 2010, Vet Dermatol 21(1):32–41.

---

#### 12. Hypothyroidism

**🐶 Dog** (most common endocrine disorder in dogs)
- **Goal:** Support weight management and skin/coat recovery while thyroid medication is being balanced.
- **Look for:** Lower-fat formulas (<16% fat DMB). High-fiber (>5% DMB) for satiety. Lean proteins. Marine-sourced omega-3 (EPA/DHA) for skin/coat recovery. L-Carnitine.
- **Avoid:** High-calorie, high-fat foods. Puppy/performance formulas. Free-feeding. Raw diets containing animal necks/gullets (contain thyroid gland tissue — documented cause of dietary thyrotoxicosis).
- **Caloric:** Strict portion control until medication is balanced. These dogs gain weight very easily.
- **Citation:** Scott-Moncrieff 2007, Vet Clin North Am 37(4):709–722. Broome et al. 2015, JAVMA 246(1):105–111 (dietary thyrotoxicosis). Kohler et al. 2012, JSAP 53(3):182–184.

**🐱 Cat** (rare — almost always iatrogenic post-hyperthyroid treatment)
- **Goal:** Monitor caloric intake during metabolic transition from hyperthyroid to hypothyroid state.
- **Look for:** Standard adult maintenance or weight-control diets. Balanced animal proteins.
- **Avoid:** Iodine-restricted diets (y/d) — if the cat has become hypothyroid, continuing iodine restriction worsens it. High-calorie kitten foods. High-carbohydrate fillers.
- **Caloric:** Closely monitored. The cat transitions from burning excess to burning fewer calories — same portions will cause rapid weight gain.
- **Citation:** Peterson 2013, Compendium 35(8):E1–E6. Fernandez et al. 2019, JFMS 21(12):1149–1156 (iatrogenic hypothyroidism in 20–50% post-radioiodine).

---

#### 13. Hyperthyroidism

**🐱 Cat** (most common feline endocrine disorder — >10% of senior cats, up to 21% over 10 years)
- **Goal:** Support elevated metabolic rate (medication pathway) OR maintain strict iodine restriction (dietary pathway).
- **Look for (medication/surgery):** High-calorie (>4,500 kcal/kg). High-protein (>40% DMB). Wet food. L-Carnitine and taurine (hyperthyroidism causes secondary heart disease — 87% of hyperthyroid cats show cardiac changes).
- **Look for (iodine-restricted):** The prescribed iodine-restricted food as the exclusive diet. Nothing else.
- **Avoid (medication/surgery):** Low-calorie/low-protein diets.
- **Avoid (iodine-restricted):** Any other food — if the cat eats a single normal treat, the restriction is broken. Fish, seafood, kelp, seaweed (high iodine). Dental powders (almost always kelp-based).
- **Caloric:** Medication pathway: caloric surplus until controlled. Iodine pathway: per veterinary guidance.
- **Citation:** Peterson 2012, JFMS 14(11):804–818. van der Kooij et al. 2014, JFMS 16(6):491–498. Hui et al. 2015, JVIM 29(4):1063–1068. Liu et al. 1984, JAVMA 185(1):52–57 (87% LV hypertrophy). Edinboro et al. 2010, JFMS 12(9):672–679.

**🐶 Dog** (extremely rare — dietary or tumor-related)
- **Goal:** If confirmed, support through elevated metabolic state.
- **Look for:** High-calorie, high-protein diets if losing weight. Lean proteins for muscle rebuilding.
- **Avoid:** Raw diets containing animal necks, gullets, or trachea (documented cause of dietary hyperthyroidism in dogs).
- **Caloric:** Per veterinary assessment.
- **Note:** If a dog has hyperthyroidism selected, the app prompts: "Hyperthyroidism is extremely rare in dogs. Did you mean Hypothyroidism?"
- **Citation:** Broome et al. 2015, JAVMA 246(1):105–111. Kohler et al. 2012, JSAP 53(3):182–184.

---

#### 14. Food Allergies (Diagnosed Immune Response)

**🐶 Dog**
- **Goal:** Identify and eliminate the offending protein through strict dietary control.
- **Look for:** Hydrolyzed protein diets (gold standard). Novel protein diets (venison, rabbit, kangaroo, duck). Single clearly identified protein source + single carbohydrate. Limited ingredient formulas with strict production controls.
- **Avoid:** Unnamed protein sources ("meat meal," "animal fat," "poultry by-product") — cross-contamination is widespread (2/12 diets matched labels in one study). >3–4 distinct protein sources. Flavored medications during elimination trials.
- **Caloric:** Maintenance. Minimum 8-week elimination trial.
- **Note:** Most common canine allergens: beef (34%), dairy (17%), chicken (15%), wheat (13%). True grain allergies are rare.
- **Citation:** Mueller et al. 2016, BMC Vet Res 12:9. Olivry et al. 2015, BMC Vet Res 11:225 (8-week minimum). Ricci et al. 2013, J Anim Physiol Anim Nutr 97(Suppl 1):32–38.

**🐱 Cat**
- **Goal:** Identify and eliminate the offending protein. Commonly manifests as miliary dermatitis, overgrooming, or chronic vomiting/diarrhea.
- **Look for:** Hydrolyzed protein diets or novel protein wet foods (rabbit, venison, duck). Single-source proteins. Wet food preferred. Feline-specific probiotics.
- **Avoid:** Variety packs (constant rotation prevents identification). Unnamed protein sources. Fish-based diets if fish hasn't been ruled out — fish is the #2 feline allergen (17%).
- **Caloric:** Maintenance. 8-week minimum elimination trial.
- **Note:** Most common feline allergens: beef (18%), fish (17%), chicken (5%), dairy (4%).
- **Citation:** Mueller et al. 2016, BMC Vet Res 12:9. Olivry et al. 2015, BMC Vet Res 11:225. Ricci et al. 2018, BMC Vet Res 14(1):209.
