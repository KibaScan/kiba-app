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

## Proposed Changes

### Component 1: Dependencies

#### [MODIFY] [package.json](file:///Users/stevendiaz/kiba-antigravity/package.json)

- `expo-print` is already in `package.json` but **not installed**. Run `npm install`.
- Verify `expo-sharing` is also present. If not, `npx expo install expo-sharing`.
- No new native modules — both work with Expo managed workflow.

---

### Component 2: Types

#### [NEW] `src/types/vetReport.ts`

Define all interfaces for vet report data assembly:

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
  aafcoStatement: string | null;
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

interface SupplementNutrient {
  name: string;      // "Omega-3"
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
  estimatedDriftLbs: number | null;
  lastWeighed: string | null;
}

interface OwnerDietaryCard {
  conditionKey: string;
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

**Query strategy** — Parallel Supabase calls:

| Query | Table(s) | Notes |
|-------|----------|-------|
| Pet profile | `pets` | Direct lookup |
| Conditions | `pet_conditions` + `pet_condition_details` | Via existing `getPetConditions()` + `getConditionDetails()` |
| Allergens | `pet_allergens` | Via existing `getPetAllergens()` |
| Medications | `pet_medications` | Via existing `getMedications()` |
| Diet items | `pantry_items` → `pantry_pet_assignments` → `products` → `product_ingredients` → `ingredients_dict` | Complex join — fetch active pantry items for this pet, then product details + first 10 ingredients |
| Health records | `pet_health_records` | Via existing `getHealthRecords()` |
| Appointments | `pet_appointments` | Via existing `getUpcomingAppointments()` |
| Treat data | `useTreatBatteryStore` | Client-side Zustand store |

**Computed values:**

1. **Combined nutrition** (Spec §4): Calorie-weighted average across daily food + supplemental products
   - `combined_macro_pct = Σ(product_macro × product_daily_kcal) / Σ(product_daily_kcal)`
   - DMB conversion: `macro_dmb = macro_asfed / (100 - moisture) × 100`
   - Treats and pure supplements excluded from combined macros (Spec §4 inclusion table)

2. **Supplemental nutrients** (Spec §5): Scan all pantry products for omega-3/DHA/EPA/omega-6/taurine/L-carnitine/zinc/probiotics
   - For percentage values: show highest single-product value (not sum)
   - For presence values (probiotics, L-carnitine): show "Present" with sources

3. **Flags** (Spec §7): Auto-generated in priority order (recall > allergen > AAFCO > supplemental-only > caloric > treat > DCM > no-recalls)

4. **Condition management notes** (Spec §6): Programmatic observations per condition from diet data
   - Uses thresholds from existing `conditionScoring.ts` rules
   - Observations are factual: "[metric] is [value] — [context]"

5. **Owner dietary cards** (Spec §17): From static card data, filtered by pet's conditions + species

6. **Treat summary** (Spec §8): From treat battery store or pantry treat items

7. **Adjusted DER + caloric balance**: From `computePetDer()` with weight_goal_level

---

### Component 4: Owner Dietary Card Data

#### [NEW] `src/data/ownerDietaryCards.ts`

Static data file containing all 28 cards (14 conditions × 2 species). Content from Spec §17 sections 1–14.

```typescript
const CARD_RENDER_ORDER: string[] = [
  'kidney_disease', 'heart_disease', 'pancreatitis', 'diabetes',
  'urinary_issues', 'food_allergies', 'overweight', 'underweight',
  'sensitive_stomach', 'skin_coat', 'hyperthyroidism', 'hypothyroidism',
  'joint_issues', 'no_known_conditions',
];

const OWNER_CARDS: Record<string, Record<'dog' | 'cat', OwnerDietaryCard>> = { ... };

function getOwnerDietaryCards(conditions: string[], species: 'dog' | 'cat'): OwnerDietaryCard[]
function detectConflicts(conditions: string[], species: 'dog' | 'cat'): ConflictNote[]
```

All card content is taken verbatim from the spec — goals, look-for, avoid, caloric notes, citations, species-specific callouts.

---

### Component 5: HTML Template

#### [NEW] `src/utils/vetReportHTML.ts`

Pure function: `generateVetReportHTML(data: VetReportData): string`

**Architecture:**
- Full inline CSS (no external stylesheets in PDF context)
- CSS `page-break-before: always` for page boundaries
- Table-based layout for data tables
- Monochrome-friendly: colors are accents, not information carriers
- Kiba branding minimal: small text logo + URL in footer only

**Pages:**

| Page | Sections | Always renders |
|------|----------|----------------|
| 1 | Pet Profile, **BCS Gauge**, Medications, Current Diet table | Yes |
| 2 | Combined Nutritional Profile, Supplemental Nutrients, Flags & Observations, Weight Tracking | Yes |
| 3 | Per-Product Detail, Health Records, Condition Management Notes, Vet Notes (blank lines), Footer | Yes |
| 4 | Owner Dietary Reference cards + conflict callouts + footer | Only if `conditions.length > 0` |

**BCS Gauge (Page 1):**

A 9-segment horizontal bar rendered inside the Pet Profile section:

| Segments | Range | Background | Label |
|----------|-------|------------|-------|
| 1–3 | Underweight | `#FFF8E1` (amber tint) | "Underweight" |
| 4–5 | Ideal | `#E8F5E9` (green tint) | "Ideal" |
| 6–7 | Overweight | `#FFF3E0` (orange tint) | "Overweight" |
| 8–9 | Obese | `#FFEBEE` (red tint) | "Obese" |

- Black triangle marker (▼) above the pet's current BCS segment
- Below gauge: "BCS: X/9 — [Category] (assessed [date])"
- If no BCS score: gauge hidden, text shows "BCS: Not assessed"
- Monochrome-friendly: even without color, segment labels + marker are readable

**Key rendering details:**

- Product form labels: dry → "Dry", wet → "Wet", supplemental → "Top", supplement → "Supp", treat → "Treat"
- AAFCO check marks: ✓ for pass, ✗ for fail
- Flag icons: ⚠ for warnings (priority 1-5), ℹ for informational (priority 6-8)
- Vet Notes: 5 blank ruled lines for handwritten notes
- Footer disclaimer on pages 3 and 4: "This report is generated by Kiba (kibascan.com)..."
- Condition management notes: Purely observational — "[metric] is [value]", never "[you should]"
- Owner dietary cards: `page-break-inside: avoid` per card, conflict callout boxes between relevant cards

---

### Component 6: PetHubScreen Wiring

#### [MODIFY] [PetHubScreen.tsx](file:///Users/stevendiaz/kiba-antigravity/src/screens/PetHubScreen.tsx)

Add "Generate Vet Report" button in the settings/actions area (before the Settings nav row, after the health disclaimer):

```
Icon: document-text-outline (Ionicons)
Label: "Generate Vet Report"  
Premium badge: shown if free user
On tap (free): navigate to PaywallScreen with trigger 'vet_report'
On tap (premium): empty pantry guard → show loading → assembleVetReportData → generateVetReportHTML → expo-print → expo-sharing
```

**Empty Pantry Guard (fires before any async work):**

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
- Network error → show Alert with retry
- PDF generation failure → generic error alert

**Imports needed:**
- `expo-print` (`printToFileAsync`)
- `expo-sharing` (`shareAsync`)
- `assembleVetReportData` from `vetReportService`
- `generateVetReportHTML` from `vetReportHTML`
- `canExportVetReport` from `permissions` (already imported via `isPremium`)

---

## User Review Required

> [!IMPORTANT]
> **Gotchas deferred per your instruction** — `liver` and `seizures` condition tags (display-only, no scoring rules), `pantryHelpers.ts:385` missing param, `canCompare()` stub, and other M6-end gotchas will be addressed after the vet report work.

> [!WARNING]
> **`expo-print` needs `npm install`** — the dependency is declared in `package.json` but not installed. This is the first step before any code can be written.

> [!IMPORTANT]
> **Owner Dietary Cards are 28 static cards of clinical content.** The spec provides all text (§17, cards 1-14 × dog/cat). This is the largest single file by line count (~800+ lines). All copy is D-095 compliant with real citations. Should I include the full card content from the spec verbatim, or do you want to review/edit the card content before it goes in?

## Open Questions

1. **Treat aggregation source:** The spec mentions two sources for treat data — `useTreatBatteryStore` (today's tracked treats) or pantry treat items. If no treats were logged today, should the report show treat data from pantry assignments instead (which represents the _planned_ treats), or "Treats: Not tracked"?

3. **Page 4 condition mapping:** The spec maps condition tags to card keys differently than the condition tags in `conditionScoring.ts` (e.g., spec uses `kidney_disease` but scoring uses `ckd`, spec uses `food_allergies` but scoring uses `allergy`). Should I create a mapping layer, or rename the card keys to match the existing tags?

## Verification Plan

### Automated Tests

New test file: `__tests__/services/vetReportService.test.ts` (25+ tests)

| Test Group | What it covers |
|-----------|----------------|
| Combined nutrition math | Calorie-weighted averaging with 1, 2, 3 products; DMB conversion; treat/supplement exclusion |
| AAFCO checks | Dog adult, cat adult, puppy thresholds; pass/fail for each nutrient |
| Flag generation | All 8 flag types with priority ordering; allergen cross-reference; DCM detection |
| Condition management notes | Observation generation for each condition with diet data mocks |
| Owner dietary cards | Card selection by condition + species; conflict detection for CKD+underweight, pancreatitis+underweight |
| Supplemental nutrients | Highest-value selection; source attribution; "Present" for probiotics |
| Treat aggregation | From battery store; from pantry; no data case |
| HTML generation | Snapshot test that `generateVetReportHTML()` returns valid HTML string with all sections |

### Manual Verification

- Run on iOS simulator → PetHubScreen → tap "Generate Vet Report" → PDF opens in share sheet
- Print PDF → verify B&W readability
- Test with pet with 0 conditions (no Page 4), with 2 conditions (Page 4 renders), with 5+ conditions (overflow to second Owner Reference page)
- Test with empty pantry, with treats only, with mixed diet
- Test with recalled product in pantry
- Test with allergen-containing product in pantry

### Regression

- Run full test suite (`npm test`) — expect 1075+ passing
- Verify Pure Balance = 62, Temptations = 9 anchors unchanged
