# M6 Vet Report PDF — Implementation Plan

## Goal

Build a shareable PDF diet report for veterinary consultations. The report is **diet-centric** (not product-centric), contains **no Kiba scores**, and presents raw nutritional data for vet interpretation. 2–4 pages, US Letter (8.5" × 11"), printable in black & white.

> [!IMPORTANT]
> All copy is D-095 UPVM compliant — observational only ("metric is value"), never prescriptive. No scores appear anywhere in the report (D-094 suitability framing is NOT used here).

## Visual Mocks

````carousel
![Page 1 — Pet Profile + BCS Gauge + Current Diet](/Users/stevendiaz/.gemini/antigravity/brain/048d97d2-c41d-4d55-af1e-f8ffacd2f8b4/vet_report_page1_v2_1774716694435.png)
<!-- slide -->
![Page 2 — Combined Nutrition + Flags + Weight Tracking](/Users/stevendiaz/.gemini/antigravity/brain/048d97d2-c41d-4d55-af1e-f8ffacd2f8b4/vet_report_page2_1774715854783.png)
<!-- slide -->
![Page 3 — Per-Product Detail + Health Records + Condition Notes + Vet Notes](/Users/stevendiaz/.gemini/antigravity/brain/048d97d2-c41d-4d55-af1e-f8ffacd2f8b4/vet_report_page3_1774716144951.png)
<!-- slide -->
![Page 4 — Owner Dietary Reference (conditional)](/Users/stevendiaz/.gemini/antigravity/brain/048d97d2-c41d-4d55-af1e-f8ffacd2f8b4/vet_report_page4_1774716161940.png)
````

---

## Review Reconciliation

All 3 blockers and 7 gaps from [vet_report_plan_review.md](file:///Users/stevendiaz/kiba-antigravity/docs/plans/vet_report_plan_review.md) have been addressed:

| # | Issue | Resolution |
|---|-------|------------|
| 1 | `expo-print` not in package.json | Fixed — `npx expo install expo-print` (not `npm install`) |
| 2 | `ga_epa_pct` doesn't exist on Product | Dropped EPA from supplemental nutrients |
| 3 | Condition tag mismatch unresolved | Resolved — cards keyed to scoring tags (`ckd`, `cardiac`, etc.) |
| 4 | Treat data completeness | Added waterfall: battery → pantry → "Not tracked" with kcal gap handling |
| 5 | Conditions source wrong | Fixed — `pet_conditions` table via `getPetConditions()`, `pet_condition_details` for sub-types only |
| 6 | BCS gauge rendering missing | Added full HTML/CSS spec for 9-segment gauge |
| 7 | Offline guard missing | Added `isOnline()` check before async work |
| 8 | Weight drift formula missing | Added: `driftLbs = caloric_accumulator / 3500` |
| 9 | `aafco_inference` missing from type | Use `aafco_statement` only — no migration needed |
| 10 | Page overflow for pages 1-3 | Added `page-break-inside: avoid` on all content blocks |

---

## Proposed Changes

### Component 1: Dependencies

#### [MODIFY] [package.json](file:///Users/stevendiaz/kiba-antigravity/package.json)

- **`expo-print` is NOT in package.json** — needs `npx expo install expo-print` (adds dep + installs)
- `expo-sharing` is already present (`~55.0.11`) ✓
- No new native modules — both work with Expo managed workflow

---

### Component 2: Types

#### [NEW] `src/types/vetReport.ts`

Define all interfaces for vet report data assembly:

```typescript
interface VetReportData {
  pet: Pet;
  conditionTags: string[];               // from pet_conditions table (condition_tag field)
  conditionDetails: PetConditionDetail[]; // from pet_condition_details (sub-type/severity)
  allergens: string[];
  medications: PetMedication[];
  dietItems: VetReportDietItem[];
  combinedNutrition: CombinedNutrition;
  supplementNutrients: SupplementNutrient[];
  flags: VetReportFlag[];
  conditionNotes: ConditionNote[];
  healthRecords: { vaccinations: PetHealthRecord[]; dewormings: PetHealthRecord[] };
  upcomingAppointments: Appointment[];
  treatSummary: TreatSummary | null;
  weightTracking: WeightTrackingData;
  adjustedDER: number;
  caloricBalance: number;
  ownerDietaryCards: OwnerDietaryCard[];
  conditionConflicts: ConflictNote[];
  generatedAt: string;
}

interface VetReportDietItem {
  productName: string;
  brand: string;
  form: string;           // 'Dry' | 'Wet' | 'Top' | 'Supp' | 'Treat'
  servingDisplay: string;  // "1.5 cups × 2/day"
  dailyKcal: number;
  category: string;
  isSupplemental: boolean;
  isRecalled: boolean;
  aafcoStatement: string | null;  // aafco_statement only — aafco_inference not on client type
  gaProtein: number | null;
  gaFat: number | null;
  gaFiber: number | null;
  gaMoisture: number | null;
  gaKcalPerKg: number | null;
  ingredients: string[];   // first 10 canonical names
  allergenFlags: string[]; // allergens found in this product
}

interface CombinedNutrition {
  proteinAsFed: number | null;
  proteinDmb: number | null;
  fatAsFed: number | null;
  fatDmb: number | null;
  fiberAsFed: number | null;
  fiberDmb: number | null;
  moistureAsFed: number | null;
  calciumDmb: number | null;
  phosphorusDmb: number | null;
  kcalPerKg: number | null;
  kcalPerKgDmb: number | null;
  aafcoChecks: AafcoCheck[];
}

interface AafcoCheck {
  nutrient: string;
  dmbValue: number | null;
  threshold: number;
  passes: boolean;
  label: string;     // "≥18.0%"
}

// EPA intentionally excluded — ga_epa_pct does not exist on Product type.
// EPA is rarely reported separately from combined omega-3 on pet food labels.
interface SupplementNutrient {
  name: string;      // "Omega-3", "DHA", "Omega-6", "Taurine", "L-Carnitine", "Zinc", "Probiotics"
  value: string;     // "0.8%" or "present"
  unit: string;      // "%" or "mg/kg" or ""
  sources: string[]; // product names providing this nutrient
}

interface VetReportFlag {
  priority: number;
  type: 'recall' | 'allergen' | 'aafco' | 'supplemental_only' | 'caloric' | 'treat' | 'dcm' | 'no_recall';
  icon: string;      // "⚠" or "ℹ"
  label: string;     // "ALLERGEN"
  message: string;
}

interface ConditionNote {
  condition: string;
  observations: string[];
}

interface WeightTrackingData {
  currentLbs: number;
  bcsScore: number | null;
  bcsDate: string | null;
  goalLevel: number;
  goalLabel: string;
  estimatedDriftLbs: number | null;  // = caloric_accumulator / 3500
  lastWeighed: string | null;
}

// Treat summary with kcal gap awareness
interface TreatSummary {
  avgDailyCount: number;
  avgDailyKcal: number | null;        // null when count is known but kcal is not
  source: 'battery' | 'pantry';       // which fallback was used
  kcalIsEstimated: boolean;           // true when kcal data is incomplete
}

interface OwnerDietaryCard {
  conditionKey: string;     // uses scoring tags: 'ckd', 'cardiac', 'gi_sensitive', etc.
  conditionLabel: string;
  goal: string;
  lookFor: string;
  avoid: string;
  caloricNote: string | null;
  note: string | null;
  citation: string;
  speciesCallout: string | null;
}

interface ConflictNote {
  conditions: [string, string];
  note: string;
}
```

---

### Component 3: Data Assembly Service

#### [NEW] `src/services/vetReportService.ts`

Main function: `assembleVetReportData(petId: string): Promise<VetReportData>`

**Offline guard** — first line of `assembleVetReportData()`:

```typescript
import { isOnline } from '../utils/network';

if (!(await isOnline())) {
  throw new Error('Connect to the internet to generate a vet report.');
}
```

Follows the same pattern as `pantryService.ts`, `petService.ts`, and `appointmentService.ts`.

**Query strategy** — Parallel Supabase calls:

| Query | Source | Function |
|-------|--------|----------|
| Pet profile | `pets` table | Direct Supabase lookup |
| Condition tags | `pet_conditions` table | `getPetConditions(petId)` → returns `PetCondition[]` with `condition_tag` field |
| Condition details | `pet_condition_details` table | `getConditionDetails(petId)` → sub-types/severity only |
| Allergens | `pet_allergens` table | `getPetAllergens(petId)` |
| Medications | `pet_medications` table | `getMedications(petId)` |
| Diet items | `pantry_items` → `pantry_pet_assignments` → `products` → `product_ingredients` | Complex join — active pantry items for this pet + first 10 ingredients |
| Health records | `pet_health_records` table | `getHealthRecords(petId)` |
| Appointments | `pet_appointments` table | `getUpcomingAppointments(userId, petId)` |
| Treat data | Client-side Zustand | `useTreatBatteryStore` |

**Computed values:**

1. **Combined nutrition** (Spec §4): Calorie-weighted average across daily food + supplemental products
   - `combined_macro_pct = Σ(product_macro × product_daily_kcal) / Σ(product_daily_kcal)`
   - DMB conversion: `macro_dmb = macro_asfed / (100 - moisture) × 100`
   - Treats and pure supplements excluded from combined macros (Spec §4 inclusion table)

2. **Supplemental nutrients** (Spec §5): Scan all pantry products for: `ga_omega3_pct`, `ga_dha_pct`, `ga_omega6_pct`, `ga_taurine_pct`, `ga_l_carnitine_mg`, `ga_zinc_mg_kg`, `ga_probiotics_cfu`
   - **EPA intentionally excluded** — `ga_epa_pct` does not exist on the `Product` type. EPA is rarely reported separately from combined omega-3 on pet food labels.
   - For percentage values: show highest single-product value (not sum)
   - For presence values (probiotics, L-carnitine): show "Present" with sources

3. **Flags** (Spec §7): Auto-generated in priority order (recall > allergen > AAFCO > supplemental-only > caloric > treat > DCM > no-recalls)
   - AAFCO display uses `aafco_statement` only — `aafco_inference` is not on the client-side `Product` type

4. **Condition management notes** (Spec §6): Programmatic observations per condition from diet data
   - Uses thresholds from existing `conditionScoring.ts` rules
   - Observations are factual: "[metric] is [value] — [context]"

5. **Owner dietary cards** (Spec §17): From static card data, filtered by pet's conditions + species

6. **Treat summary** (Spec §8): Waterfall logic:
   - **Battery first:** `useTreatBatteryStore.consumedByPet[petId]` — has count + kcal from today
   - **Pantry fallback:** Sum of treat-category pantry items' `serving_size_kcal × feedings_per_day`
   - **No data:** `treatSummary = null` → renders "Treats: Not tracked"
   - **Kcal gap:** When count is known but kcal is missing/estimated, set `kcalIsEstimated: true`. Caloric balance section notes: "Treat calorie data is estimated or unavailable"

7. **Adjusted DER + caloric balance**: From `computePetDer()` with `weight_goal_level`

8. **Weight drift**: `estimatedDriftLbs = (caloric_accumulator ?? 0) / 3500`
   - Rough conversion: 3,500 kcal surplus/deficit ≈ 1 lb body weight change
   - Only shown when accumulator is non-null and non-zero

---

### Component 4: Owner Dietary Card Data

#### [NEW] `src/data/ownerDietaryCards.ts`

Static data file containing all 26 cards (13 conditions × 2 species, plus `food_allergies` which is handled separately). Content from Spec §17 sections 1–14.

**Card keys use scoring tags** — not spec-style names. Mapping:

| Spec card key | Card key (= scoring tag) |
|---|---|
| `kidney_disease` | `ckd` |
| `heart_disease` | `cardiac` |
| `sensitive_stomach` | `gi_sensitive` |
| `skin_coat` | `skin` |
| `joint_issues` | `joint` |
| `urinary_issues` | `urinary` |
| `overweight` | `obesity` |
| `hypothyroidism` | `hypothyroid` |
| `hyperthyroidism` | `hyperthyroid` |
| `underweight` | `underweight` ✓ |
| `diabetes` | `diabetes` ✓ |
| `pancreatitis` | `pancreatitis` ✓ |
| `food_allergies` | `allergy` (special — triggers on `petAllergens.length > 0`, not from `pet_conditions`) |
| `no_known_conditions` | `no_known_conditions` (renders when conditions list is empty) |

```typescript
const CARD_RENDER_ORDER: string[] = [
  'ckd', 'cardiac', 'pancreatitis', 'diabetes',
  'urinary', 'allergy', 'obesity', 'underweight',
  'gi_sensitive', 'skin', 'hyperthyroid', 'hypothyroid',
  'joint', 'no_known_conditions',
];

const OWNER_CARDS: Record<string, Record<'dog' | 'cat', OwnerDietaryCard>> = { ... };

function getOwnerDietaryCards(
  conditionTags: string[],
  allergenCount: number,
  species: 'dog' | 'cat',
): OwnerDietaryCard[]

function detectConflicts(conditionTags: string[], species: 'dog' | 'cat'): ConflictNote[]
```

`food_allergies` / `allergy` card rendering logic:
- Does NOT come from `pet_conditions` tags
- Renders when `petAllergens.length > 0` (from `pet_allergens` table)
- Injected into the render order at the correct priority position

All card content is taken verbatim from the spec — goals, look-for, avoid, caloric notes, citations, species-specific callouts.

---

### Component 5: HTML Template

#### [NEW] `src/utils/vetReportHTML.ts`

Pure function: `generateVetReportHTML(data: VetReportData): string`

**Architecture:**
- Full inline CSS (no external stylesheets in PDF context)
- CSS `page-break-before: always` for page boundaries
- **`page-break-inside: avoid` on all content blocks** (diet table rows, per-product detail blocks, condition note blocks, owner dietary cards) — handles overflow when pets have 8+ pantry items or many products
- Table-based layout for data tables
- Monochrome-friendly: colors are accents, not information carriers
- Kiba branding minimal: small text logo + URL in footer only

**Pages:**

| Page | Sections | Always renders |
|------|----------|----------------|
| 1 | Pet Profile, **BCS Gauge**, Medications, Current Diet table | Yes |
| 2 | Combined Nutritional Profile, Supplemental Nutrients, Flags & Observations, Weight Tracking | Yes |
| 3 | Per-Product Detail, Health Records, Condition Management Notes, Vet Notes (blank lines), Footer | Yes |
| 4 | Owner Dietary Reference cards + conflict callouts + footer | Only if `conditionTags.length > 0` or `allergens.length > 0` |

**BCS Gauge (Page 1):**

A 9-segment horizontal bar rendered inside the Pet Profile section:

```html
<!-- 9 equal-width cells in a flex row -->
<div style="display: flex; width: 100%; position: relative; margin: 8px 0;">
  <!-- Triangle marker positioned absolutely above the active segment -->
  <div style="position: absolute; top: -12px; left: calc((BCS - 0.5) / 9 * 100%);
              transform: translateX(-50%); font-size: 14px;">▼</div>
  <!-- Segments 1-3: Underweight (amber tint) -->
  <div style="flex: 3; background: #FFF8E1; border: 1px solid #ddd; text-align: center;
              padding: 4px 0; font-size: 9px;">1 | 2 | 3</div>
  <!-- Segments 4-5: Ideal (green tint) -->
  <div style="flex: 2; background: #E8F5E9; border: 1px solid #ddd; text-align: center;
              padding: 4px 0; font-size: 9px;">4 | 5</div>
  <!-- Segments 6-7: Overweight (orange tint) -->
  <div style="flex: 2; background: #FFF3E0; border: 1px solid #ddd; text-align: center;
              padding: 4px 0; font-size: 9px;">6 | 7</div>
  <!-- Segments 8-9: Obese (red tint) -->
  <div style="flex: 2; background: #FFEBEE; border: 1px solid #ddd; text-align: center;
              padding: 4px 0; font-size: 9px;">8 | 9</div>
</div>
<!-- Labels row -->
<div style="display: flex; font-size: 8px; color: #666;">
  <div style="flex: 3; text-align: center;">Underweight</div>
  <div style="flex: 2; text-align: center;">Ideal</div>
  <div style="flex: 2; text-align: center;">Overweight</div>
  <div style="flex: 2; text-align: center;">Obese</div>
</div>
<div style="font-size: 10px; margin-top: 4px;">
  BCS: 6/9 — Overweight (assessed March 15, 2026)
</div>
```

| Segments | Range | Background | Label |
|----------|-------|------------|-------|
| 1–3 | Underweight | `#FFF8E1` (amber tint) | "Underweight" |
| 4–5 | Ideal | `#E8F5E9` (green tint) | "Ideal" |
| 6–7 | Overweight | `#FFF3E0` (orange tint) | "Overweight" |
| 8–9 | Obese | `#FFEBEE` (red tint) | "Obese" |

- Black triangle marker (▼) positioned above the pet's current BCS segment
- Below gauge: "BCS: X/9 — [Category] (assessed [date])"
- If no BCS score: gauge hidden, text shows "BCS: Not assessed"
- Monochrome-friendly: even without color, segment labels + marker are readable

**Key rendering details:**

- Product form labels: dry → "Dry", wet → "Wet", supplemental → "Top", supplement → "Supp", treat → "Treat"
- AAFCO check marks: ✓ for pass, ✗ for fail (uses `aafco_statement` only — `aafco_inference` not on client type)
- Flag icons: ⚠ for warnings (priority 1-5), ℹ for informational (priority 6-8)
- Vet Notes: 5 blank ruled lines for handwritten notes
- Footer disclaimer on pages 3 and 4: "This report is generated by Kiba (kibascan.com)..."
- Condition management notes: Purely observational — "[metric] is [value]", never "[you should]"
- Owner dietary cards: `page-break-inside: avoid` per card, conflict callout boxes between relevant cards
- Treat display with kcal gap: when `kcalIsEstimated`, caloric balance shows "† treat calorie data estimated"
- Weight drift: Only shown when `estimatedDriftLbs` is non-null, formula: `caloric_accumulator / 3500`

---

### Component 6: PetHubScreen Wiring

#### [MODIFY] [PetHubScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx)

Add "Generate Vet Report" button in the settings/actions area (before the Settings nav row, after the health disclaimer):

```
Icon: document-text-outline (Ionicons)
Label: "Generate Vet Report"  
Premium badge: shown if free user
On tap (free): navigate to PaywallScreen with trigger 'vet_report'
On tap (premium): offline guard → empty pantry guard → show loading → assembleVetReportData → generateVetReportHTML → expo-print → expo-sharing
```

**Offline Guard (fires first, before pantry check):**

```typescript
import { isOnline } from '../utils/network';

if (!(await isOnline())) {
  Alert.alert(
    'No Connection',
    'Connect to the internet to generate a vet report.',
  );
  return;
}
```

**Empty Pantry Guard (fires before any Supabase work):**

```typescript
// Check pantry items assigned to this pet before assembling report
const assignedItems = pantryItems.filter(item => 
  item.assignments?.some(a => a.pet_id === activePet.id) && item.is_active
);

if (assignedItems.length === 0) {
  Alert.alert(
    'No Foods Tracked',
    `Add products to ${activePet.name}'s pantry for a complete diet report.`,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Go to Pantry', 
        onPress: () => navigation.navigate('MainTabs', { screen: 'Pantry' })
      },
    ]
  );
  return; // bail out — no spinner, no Supabase calls
}
```

- Fires **before** any async work (no spinner, no Supabase calls)
- Two-button Alert: Cancel (dismiss) or Go to Pantry (navigates to Pantry tab)
- Early return prevents `assembleVetReportData()` from running with empty data
- Pantry data is already loaded on PetHubScreen via the existing pantry store

**Loading state:** `ActivityIndicator` overlay with "Generating report..." text. Disable button during generation to prevent double-tap.

**Error handling:** 
- Offline → Alert (caught by offline guard)
- Network error during assembly → show Alert with retry
- PDF generation failure → generic error alert

**Imports needed:**
- `expo-print` (`printToFileAsync`)
- `expo-sharing` (`shareAsync`)
- `isOnline` from `../utils/network`
- `assembleVetReportData` from `vetReportService`
- `generateVetReportHTML` from `vetReportHTML`
- `canExportVetReport` from `permissions` (already imported via `isPremium`)

---

## User Review Required

> [!IMPORTANT]
> **Gotchas deferred per your instruction** — `liver` and `seizures` condition tags (display-only, no scoring rules), `pantryHelpers.ts:385` missing param, `canCompare()` stub, and other M6-end gotchas will be addressed after the vet report work.

> [!IMPORTANT]
> **Owner Dietary Cards are 26 static cards of clinical content** (13 conditions × 2 species). The spec provides all text (§17, cards 1-14 × dog/cat). This is the largest single file by line count (~800+ lines). All copy is D-095 compliant with real citations. Card content will be transcribed verbatim from the spec.

## Open Questions

None — all questions from the initial plan and review have been resolved:

| Question | Resolution |
|----------|------------|
| Treat aggregation source | Waterfall: battery → pantry → "Not tracked", with kcal gap marking |
| Empty pantry guard | Two-button Alert guard before async work (Cancel / Go to Pantry) |
| Condition tag mapping | Cards keyed to scoring tags; `allergy` card triggers on `petAllergens.length > 0` |

## Verification Plan

### Automated Tests

New test file: `__tests__/services/vetReportService.test.ts` (25+ tests)

| Test Group | What it covers |
|-----------|----------------|
| Combined nutrition math | Calorie-weighted averaging with 1, 2, 3 products; DMB conversion; treat/supplement exclusion |
| AAFCO checks | Dog adult, cat adult thresholds; pass/fail for each nutrient |
| Flag generation | All 8 flag types with priority ordering; allergen cross-reference; DCM detection |
| Condition management notes | Observation generation for each condition with diet data mocks |
| Owner dietary cards | Card selection by condition tag + species; allergy card via allergen count; conflict detection for ckd+underweight, pancreatitis+underweight |
| Supplemental nutrients | Highest-value selection across 7 nutrients (no EPA); source attribution; "Present" for probiotics |
| Treat aggregation | Battery → pantry → null waterfall; kcal gap detection |
| Weight drift | `accumulator / 3500` conversion; null/zero handling |
| Offline guard | `isOnline()` check in `assembleVetReportData` |
| HTML generation | Snapshot test that `generateVetReportHTML()` returns valid HTML string with all sections; BCS gauge rendering |

### Manual Verification

- Run on iOS simulator → PetHubScreen → tap "Generate Vet Report" → PDF opens in share sheet
- Print PDF → verify B&W readability
- Test with pet with 0 conditions (no Page 4), with 2 conditions (Page 4 renders), with 5+ conditions (overflow to second Owner Reference page)
- Test with empty pantry → verify two-button Alert fires
- Test offline → verify "No Connection" alert fires
- Test with 8+ pantry items → verify page 1 diet table overflows gracefully
- Test with treats only, with mixed diet
- Test with recalled product in pantry
- Test with allergen-containing product in pantry
- Test with pet missing BCS → gauge hidden, "Not assessed" text shown

### Regression

- Run full test suite (`npm test`) — expect 1075+ passing
- Verify Pure Balance = 60, Temptations = 0 anchors unchanged
