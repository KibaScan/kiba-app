# Vet Report Implementation Plan — Review Feedback

## Verdict: Good architecture, 3 blockers + several gaps to fix before execution

The plan's component decomposition is sound (types → service → data → HTML → wiring), and it correctly identifies parallel query strategy and reuses existing functions. But it has factual errors about dependencies, a critical type mismatch it flags but doesn't resolve, and several spec sections it doesn't cover.

---

## Blockers (must fix)

### 1. `expo-print` is NOT in package.json

The plan states: "expo-print is already in package.json but not installed."

**Reality:** `expo-print` is not in `package.json` at all. Only `expo-sharing` is present (`~55.0.11`). Need `npx expo install expo-print` — this is a dependency addition, not just an `npm install`.

### 2. `ga_epa_pct` does not exist on Product type

The spec lists EPA as a supplemental nutrient to aggregate. The plan's `SupplementNutrient` types include EPA handling. But the `Product` type in `src/types/index.ts` has no `ga_epa_pct` field. Available fields:
- `ga_omega3_pct` ✓
- `ga_dha_pct` ✓
- `ga_omega6_pct` ✓
- `ga_taurine_pct` ✓
- `ga_l_carnitine_mg` ✓
- `ga_zinc_mg_kg` ✓
- `ga_probiotics_cfu` ✓
- `ga_epa_pct` ✗ **missing**

**Fix:** Drop EPA from supplemental nutrients, or add the column to the Product type + a migration. Probably drop it — EPA is rarely reported separately from combined omega-3 on pet food labels.

### 3. Condition tag mismatch is flagged but unresolved

The plan's Open Question #3 correctly identifies the mismatch between spec card keys and scoring tags. This needs a concrete mapping, not a deferred question:

| Spec card key | Scoring tag |
|---|---|
| `kidney_disease` | `ckd` |
| `heart_disease` | `cardiac` |
| `food_allergies` | *(not a condition — lives in `pet_allergens` table)* |
| `sensitive_stomach` | `gi_sensitive` |
| `skin_coat` | `skin` |
| `joint_issues` | `joint` |
| `urinary_issues` | `urinary` |
| `overweight` | `obesity` |
| `underweight` | `underweight` ✓ |
| `diabetes` | `diabetes` ✓ |
| `pancreatitis` | `pancreatitis` ✓ |
| `hypothyroidism` | `hypothyroid` |
| `hyperthyroidism` | `hyperthyroid` |

**Recommendation:** The card keys in `ownerDietaryCards.ts` should use the **scoring tags** (e.g., `ckd`, `cardiac`, `gi_sensitive`) since those are what `pet.health_conditions[]` contains. The display labels handle the human-readable names. No mapping layer needed — just name the cards to match the tags.

`food_allergies` is special — it's not a condition tag. It should render when `petAllergens.length > 0`, not from `health_conditions`.

---

## Gaps (should address)

### 4. Treat data completeness

The plan asks about treat aggregation source (Open Question #1). The spec (section 8) answers the structure: battery first, pantry fallback, "Not tracked" last.

But the **real issue** is data completeness: the treat battery may have count but not accurate kcal for unscanned treats. Research for filling calorie gaps (from `treat-battery-research.docx`) hasn't been implemented yet. The vet report should:
- Show count + kcal when available
- Show count-only when kcal is missing
- Show "Not tracked" when no data exists
- Note in caloric balance when treat kcal is estimated or unavailable

### 5. Conditions source is wrong

The plan says: "Query: Conditions | Table(s): `pet_conditions` + `pet_condition_details`"

**Reality:** Conditions are stored as `health_conditions TEXT[]` on the `pets` table. There is no `pet_conditions` table. `pet_condition_details` exists for sub-types/severity but the condition list itself comes from `pets.health_conditions`. Use `getPetConditions()` which reads from this.

### 6. Missing: BCS gauge rendering details

The spec has detailed rendering for the BCS gauge (9-segment horizontal bar, triangle marker, color zones, category labels). The plan's HTML template section doesn't address how to render this — it's non-trivial inline HTML/CSS.

### 7. Missing: Offline guard

The plan wires the button into PetHubScreen with a loading state and error handling, but doesn't mention checking `isOnline()` before starting data assembly. All the Supabase queries will fail offline. Should check network first and show an appropriate alert (same pattern as pantry writes).

### 8. Missing: Weight drift calculation

The plan includes `estimatedDriftLbs` in `WeightTrackingData` but doesn't specify the conversion formula. The caloric accumulator stores raw kcal surplus/deficit, not weight. Need: `driftLbs = accumulator_kcal / 3500` (rough rule: 3,500 kcal ~ 1 lb body weight change).

### 9. Missing: `aafco_inference` not on Product type

The spec references `aafco_inference` for AAFCO status display, but this field isn't on the client-side `Product` type (it exists in the DB from migration 020 but was never added to the TS type). The plan should note that AAFCO display uses `aafco_statement` only, or add the field.

### 10. Missing: Page overflow for Pages 1-3

The plan handles Page 4 overflow (cards with `page-break-inside: avoid`) but doesn't address what happens when a pet has 8+ pantry items (Page 1 diet table overflows) or many per-product details (Page 3). CSS `page-break-inside: avoid` should be applied to individual product detail blocks too.

---

## Strengths

- Component decomposition is clean and follows existing patterns
- Correctly identifies all existing service functions to reuse (`getPetAllergens`, `getMedications`, `getConditionDetails`, `getHealthRecords`, `getUpcomingAppointments`, `computePetDer`)
- Parallel Supabase query strategy is correct
- Empty pantry guard fires before async work — good UX
- Owner dietary cards with conflict detection is well-designed
- Verification plan is thorough (25+ tests, manual checks, regression)
- Correctly premium-gates via existing `canExportVetReport()`
- D-095 compliance is emphasized throughout

---

## Summary

| Category | Count | Items |
|---|---|---|
| Blockers | 3 | expo-print missing, ga_epa_pct missing, condition tag mismatch unresolved |
| Gaps | 7 | Treat data completeness, conditions source wrong, BCS gauge, offline guard, weight drift, aafco_inference, page overflow |
| Strengths | 8 | Architecture, reuse, queries, UX, cards, tests, paywall, compliance |

The plan is ~85% there. Fix the 3 blockers and the conditions source error, and it's ready to execute.
