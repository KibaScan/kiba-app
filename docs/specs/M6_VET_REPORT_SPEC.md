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

**Printable.** Single-purpose PDF, 2–3 pages. Clean layout with tables, not app-style cards. Black and white friendly (colors are accents, not information carriers). Standard US Letter size (8.5" × 11").

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
  generatedAt: string;
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
