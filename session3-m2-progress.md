# M2 Session 3 — Health Conditions & Allergen Picker

> Written: 2026-03-02
> Commits: 9d1415a, e578606, e8b6fb3
> Tests: 308/308 passing (63 new)
> Pure Balance regression: 69/100 unchanged

---

## Files Created

| Path | Description |
|------|-------------|
| `src/data/conditions.ts` | Static species-filtered condition and allergen lists. DOG_CONDITIONS (14), CAT_CONDITIONS (13), DOG_ALLERGENS (12), CAT_ALLERGENS (6), OTHER_ALLERGENS (10). Helper functions: `getConditionsForSpecies()`, `getAllergensForSpecies()`. HEALTHY_TAG sentinel (`__healthy__`) never stored in DB. |
| `src/components/ConditionChip.tsx` | Reusable chip component. Props: label, isSelected, isSpecial, onToggle, disabled, icon. Four visual states: unselected, selected teal, special green (Perfectly Healthy), disabled (50% opacity). Fires `chipToggle()` haptic on press. `flexBasis: '48%'` for 2-per-row grid. |
| `src/components/AllergenSelector.tsx` | Modal searchable dropdown for "Other" allergens. Hardcoded 10-item extended protein list — NOT free text (D-097 safety). TextInput is search filter only. Mirrors BreedSelector pattern. |
| `src/utils/conditionLogic.ts` | Pure functions for chip interaction logic. `toggleCondition()` with Perfectly Healthy mutual exclusion and D-106 logic-layer obesity/underweight guard. `isConditionDisabled()`, `isAllergenSectionVisible()`, `toggleAllergen()`, `removeAllergen()`, `conditionsToSavePayload()`, `allergensToSavePayload()`, `isProfileComplete()`. |
| `src/screens/HealthConditionsScreen.tsx` | Main screen. Route params: `{ petId, fromCreate? }`. Loads existing data on mount. Two sections: conditions grid + conditional allergen picker. Save button calls `savePetConditions` then `savePetAllergens`. Profile completeness toast on save. |
| `__tests__/data/conditions.test.ts` | 17 tests for static condition/allergen data: counts, species filtering, no duplicates, no overlap between standard and extended allergens. |
| `__tests__/utils/conditionLogic.test.ts` | 38 tests for pure chip logic: toggleCondition, isConditionDisabled (including full re-enable flow), isAllergenSectionVisible, toggleAllergen, removeAllergen, conditionsToSavePayload, allergensToSavePayload, isProfileComplete. |

## Files Modified

| Path | Change |
|------|--------|
| `src/services/petService.ts` | Added `getPetConditions(petId)` and `getPetAllergens(petId)` fetch functions. |
| `src/types/navigation.ts` | Added `HealthConditions: { petId: string; fromCreate?: boolean }` to MeStackParamList. |
| `src/navigation/index.tsx` | Imported and registered HealthConditionsScreen in MeStack. |
| `src/screens/CreatePetScreen.tsx` | "Continue to Health" now navigates to `HealthConditions` with `fromCreate: true` instead of `MeMain`. |
| `src/screens/EditPetScreen.tsx` | "Health & Diet" link wired with `onPress={() => navigation.navigate('HealthConditions', { petId })}`. |
| `__tests__/services/petService.test.ts` | 4 new tests for `getPetConditions` and `getPetAllergens` (happy path + error handling). |
| `package.json` | Added `@expo/metro-config`, `babel-plugin-transform-import-meta`, `babel-preset-expo`, `patch-package`. |
| `babel.config.js` | Created for `babel-plugin-transform-import-meta` (resolves import.meta build error). |
| `metro.config.js` | Created with Expo default config. |

---

## Screen Inventory

### HealthConditionsScreen

**Layout:** SafeAreaView → back-arrow header ("Health & Diet") → ScrollView

**Section 1: "Health Conditions"**
- Section header: "Health Conditions"
- Subtitle: "Select any that apply to {petName}"
- Chip grid (2 per row, flexWrap) with ConditionChip components
- D-095 subtext below grid: "Tell us about {petName}'s health so we can check food ingredients against published guidelines."

**Dog conditions (14):** Perfectly Healthy, Joint issues, Food allergies, Sensitive stomach, Overweight, Underweight, Diabetes, Kidney disease, Urinary issues, Heart disease, Pancreatitis, Skin & coat issues, Liver disease, Seizures / Epilepsy

**Cat conditions (13):** Same minus Seizures/Liver, plus Hyperthyroidism

**Section 2: "Known Food Allergens" (conditional)**
- Visible only when `allergy` in selectedConditions
- Animated via LayoutAnimation
- Species-filtered allergen chips (Dog: 12, Cat: 6)
- "Other" chip opens AllergenSelector modal (10-item hardcoded list)
- Custom allergens appear as removable chips below the grid

**Save button:** "Save & Continue" — saves conditions, then allergens (or clears orphans), checks profile completeness, navigates (fromCreate → MeMain, else → goBack).

**"Skip for now":** Shown only in create flow, navigates to MeMain without saving.

### ConditionChip

```typescript
interface ConditionChipProps {
  label: string;
  isSelected: boolean;
  isSpecial?: boolean;    // true for "Perfectly Healthy"
  onToggle: () => void;
  disabled?: boolean;
  icon?: string;          // Ionicons name
}
```

**Visual states:**
- Unselected: `#1A1A1A` bg, `#333333` border, secondary text
- Selected: `#00B4D8` at 20% opacity bg, accent border, accent text
- Special (Perfectly Healthy): `#34C759` bg, white text, checkmark-shield icon
- Disabled: 50% opacity, non-tappable

---

## Mutual Exclusion Logic

### "Perfectly Healthy" ↔ All Conditions
- Tapping "Perfectly Healthy" → clears ALL selected conditions, selects only `__healthy__`
- Tapping any condition → deselects "Perfectly Healthy" first
- Deselecting "Perfectly Healthy" → back to empty (not auto-select anything)
- "Perfectly Healthy" also clears allergen state (full reset)
- Sentinel tag `__healthy__` never reaches DB — `conditionsToSavePayload()` filters it out
- Empty `pet_conditions` rows = "Perfectly Healthy" in DB

### Obesity ↔ Underweight (D-106)
- Selecting `obesity` → `underweight` chip renders `disabled={true}` (50% opacity, non-tappable)
- Selecting `underweight` → `obesity` chip renders `disabled={true}`
- **Logic-layer enforcement:** `toggleCondition()` calls `isConditionDisabled()` and returns `current` unchanged if tag is disabled — prevents programmatic bypass
- **UI-layer enforcement:** ConditionChip `disabled` prop prevents touch events
- User must manually deselect one before tapping the other — no auto-deselect
- A pet can have neither, but never both

### Allergen Section Visibility
- `isAllergenSectionVisible()` returns `true` when `selectedConditions.includes('allergy')`
- Section 2 renders conditionally: `{showAllergens && (<View>...</View>)}`
- **Allergen state preserved in memory on allergy deselect** — only section visibility toggles
- On save: if allergy NOT selected, `savePetAllergens(petId, [])` clears orphaned allergens
- "Perfectly Healthy" is the only action that clears allergen state in memory

---

## Allergen Data Flow

1. User taps "Food allergies" condition → allergen section appears
2. User taps standard allergen chips (multi-select) → `toggleAllergen()` updates local state
3. User taps "Other" chip → AllergenSelector modal opens
4. User searches and selects from hardcoded 10-item list (venison, rabbit, duck, bison, kangaroo, quail, goat, pheasant, alligator, salmon)
5. Custom allergens appear as removable chips below the grid with `isCustom: true`
6. On save:
   - `conditionsToSavePayload()` filters out `__healthy__` sentinel
   - `savePetConditions(petId, conditionTags)` — delete-and-reinsert pattern
   - If allergy selected + allergens exist: `savePetAllergens(petId, allergens)` with `{ name, isCustom }` objects
   - If allergy NOT selected: `savePetAllergens(petId, [])` clears orphans
7. DB tables: `pet_conditions` (condition_tag), `pet_allergens` (allergen, is_custom)

**Cross-reactivity (D-098):** NOT handled in this screen. `allergen_group` and `allergen_group_possible` fields on `ingredients_dict` are consumed at scoring time by the personalization layer. This screen only captures user-facing allergen names.

---

## D-095 Compliance Audit

Grep of all 4 Session 3 UI files for prohibited terms returned **zero matches**:
```
grep -rn 'prescribe|treat|cure|prevent|diagnose|toxic|dangerous|harmful|avoid|terrible|monitor|recommend' \
  src/screens/HealthConditionsScreen.tsx \
  src/components/ConditionChip.tsx \
  src/components/AllergenSelector.tsx \
  src/data/conditions.ts
```

**All UI copy audited:**

| Copy | Status |
|------|--------|
| "Health Conditions" | Neutral section header (NOT "Medical Conditions") |
| "Select any that apply to {petName}" | Neutral prompt |
| "Perfectly Healthy" | Positive framing, no clinical claim |
| "Joint issues" / "Sensitive stomach" / etc. | Descriptive labels, no treatment claims |
| "Known Food Allergens" | Factual |
| "Select allergens {petName} reacts to" | Observational |
| "Tell us about {petName}'s health so we can check food ingredients against published guidelines." | D-095 compliant — data mapping, not medical advice |
| "Profile complete! {petName}'s scores are now fully personalized." | No treatment claim |
| "Other Allergens" / "Search proteins..." | Neutral |

Zero forbidden terms: prescribe, treat, cure, prevent, diagnose.

---

## Decisions Applied

| Decision | Where Applied |
|----------|---------------|
| D-095 | UPVM compliance — all UI copy uses neutral data-mapping language. Subtext: "check food ingredients against published guidelines." |
| D-097 | Health conditions multi-select with species filtering. Allergen sub-picker. "Other" is hardcoded dropdown (NOT free text) to preserve D-098 cross-reactivity detection. Custom allergens stored with `is_custom: true`. |
| D-098 | Cross-reactivity NOT exposed in UI — `allergen_group` fields consumed at scoring time only. This screen captures user-facing allergen names. |
| D-106 | Obesity/underweight mutual exclusion via disabled-state pattern. Logic-layer guard in `toggleCondition()`. UI-layer 50% opacity on ConditionChip. No auto-deselect. Weight affects portions, not scores. |
| D-110 | Table name `pets` (not `pet_profiles`). Column names match schema: `condition_tag`, `allergen`, `is_custom`. |
| D-119 | "Perfectly Healthy" chip — green #34C759, mutual exclusion with all conditions, stores zero `pet_conditions` rows. Sentinel tag `__healthy__` filtered by `conditionsToSavePayload()`. |
| D-121 | Haptics — `chipToggle()` on every chip press, `saveSuccess()` on save, `profileComplete()` when all profile fields present. |

---

## Session 4 Pickup

Session 4 builds the Portion Calculator and Treat Battery.

Key references:
- D-060: RER = 70 × (kg)^0.75
- D-061: Goal weight logic — RER at goal weight, not current
- D-062: Cat hepatic lipidosis guard — warn if >1% body weight/week
- D-063: Geriatric cat calorie inflection — 14+ cats need MORE calories
- D-064: life_stage derivation (already implemented in utils/lifeStage.ts)
- D-106: Weight management — obesity/underweight are conditions, portions affected not scores

PORTION_CALCULATOR_SPEC.md is the authoritative reference for DER multiplier tables and safety guard thresholds. Read it in full.

Pet type and petService are unchanged from Session 1. HealthConditionsScreen stores conditions/allergens to Supabase.
