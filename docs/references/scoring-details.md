# Scoring Engine — Implementation Details

> On-demand reference for scoring internals. Read before modifying any file in `src/services/scoring/`.
> For AAFCO thresholds, trapezoidal curves, and sub-nutrient weights see `scoring-rules.md`.
> Test count and regression status in `docs/status/CURRENT.md`.

---

## 1. Category-Adaptive Weights (D-010, D-136)

| Category | IQ | NP | FC | Trigger |
|---|---|---|---|---|
| Daily Food | 55% | 30% | 15% | Default |
| Daily Food (missing GA) | 78% | 0% | 22% | No guaranteed analysis data (D-017) |
| Supplemental | 65% | 35% | 0% | D-136 classification |
| Treats | 100% | 0% | 0% | `category = 'treat'` |

Source: `engine.ts` + `constants.ts` SCORING_WEIGHTS

---

## 2. Pipeline Bypass Order (`pipeline.ts`)

Checked sequentially before scoring runs. If any fires, scoring engine is skipped.

1. **Vet diet** (D-135) → no score, return ingredients only
2. **Species mismatch** (D-144) → no score, bypass reason
3. **Recalled product** (D-158) → no score, warning + ingredients, `isRecalled` flag
4. **Variety pack** (D-145) → no score, bypass reason
5. **Supplemental detection** (D-136/D-146) → runtime reclassification, then score with 65/35/0
6. **Normal** → score with standard weights

---

## 3. Layer 1a: Ingredient Quality (`ingredientQuality.ts`)

**Starting score:** 100

**Severity penalties (raw, before position adjustment):**
| Severity | Penalty |
|---|---|
| Danger | −15 |
| Caution | −8 |
| Neutral | 0 |
| Good | 0 |

**Position reduction multipliers** (only if `position_reduction_eligible = true`):
| Positions | Multiplier | Effect |
|---|---|---|
| 1–5 | 1.0x | Full penalty |
| 6–10 | 0.7x | 30% reduction |
| 11+ | 0.4x | 60% reduction |

**Unnamed species penalty (D-012):** −2 points per unnamed fat/protein (position-independent)

**Splitting detection (D-015):** Flag if 2+ ingredients share same `cluster_id`. Flag only — no score penalty.

**Grouping:** Penalties grouped by ingredient. Severity = 'danger' if maxRawPenalty ≥ 15, else 'caution'.

---

## 4. Layer 1b: Nutritional Profile (`nutritionalProfile.ts`)

**Nutrient weights:**
| Species | Protein | Fat | Fiber | Carbs |
|---|---|---|---|---|
| Dogs | 35% | 25% | 15% | 25% |
| Cats | 45% | 20% | 10% | 25% |

**AAFCO minimums (DMB):**
| Species | Life Stage | Protein | Fat |
|---|---|---|---|
| Dog | Puppy | ≥22.5% | ≥8.5% |
| Dog | Adult | ≥18.0% | ≥5.5% |
| Cat | Kitten | ≥30.0% | ≥9.0% |
| Cat | Adult | ≥26.0% | ≥9.0% |

**DMB conversion:** `nutrient_dmb = nutrient_af / (1 − moisture/100)`

**Carb estimation (D-104):** `carbs = 100 − protein − fat − fiber − moisture − ash`

**Ash estimation (as-fed):**
- Ca & P available: `(Ca + P) × 2.5`
- Treat: 5.0%
- Moisture >12%: 2.0%
- Else: 7.0%

**Growth/Senior modifiers:**
| Modifier | Condition | Points |
|---|---|---|
| Growth protein boost | protein ≥ min×1.3 | +5 |
| Growth fat boost | fat ≥ min×1.5 | +3 |
| Senior dog protein boost | protein ≥25% DMB | +5 |
| Senior dog phosphorus penalty | P >1.4% DMB | −8 |
| Senior dog joint bonus | omega-3 present | +3 |
| Senior cat protein boost | protein ≥30% DMB | +5 |
| Senior cat protein penalty | protein <30% and not CKD | −10 |
| Senior cat phosphorus penalty | P >1.2% DMB | −8 |
| Senior cat eating kitten food | — | −5 |
| Large breed puppy Ca excess | Ca >1.8% DMB | −12 |
| Large breed puppy Ca deficiency | Ca <0.8% DMB | −8 |
| Large breed puppy Ca:P ratio | outside 1.1:1–1.4:1 | −10 |
| General puppy/kitten Ca:P ratio | outside 1.1:1–2.0:1 | −10 |

**Fiber suppression:** If obesity/weight condition, fiber penalty reduced 50%: `100 − (100 − raw) × 0.5`

---

## 5. Layer 1c: Formulation Score (`formulationScore.ts`)

**Sub-scores:** AAFCO (50%) + Preservative (25%) + Protein Naming (25%)

**AAFCO statement lookup:**
| Pattern | Score |
|---|---|
| "all life stages" | 100 |
| "growth" / "reproduction" | 100 |
| "feeding test" / "feeding trial" | 100 |
| "adult" / "maintenance" | 90 |
| "complete and balanced" / "formulated to meet" | 90 |
| "supplemental" / "intermittent" | 70 |
| Unrecognized text | 50 |
| Missing/null | 30 |

**Preservative quality:**
| Type | Score |
|---|---|
| Natural | 100 |
| Mixed | 65 |
| Synthetic | 25 |
| Unknown/null | 45 |

**Protein naming specificity:** `100 × (1 − unnamed_count / total_protein_fat_sources)`. No sources: 50.

---

## 6. Layer 2: Species Rules (`speciesRules.ts`)

### DCM Risk — Dogs Only (D-137)

Three-rule OR — any rule fires the advisory:
1. **Heavyweight:** 1+ pulse in positions 1–3
2. **Density:** 2+ pulses in positions 1–10
3. **Substitution:** 1+ pulse protein isolate in positions 1–10

**Penalty:** −8% of baseScore (`baseScore × 0.92`)
**Mitigation:** taurine AND L-carnitine both present → +3% of baseScore (`baseScore × 1.03`)
**Net with mitigation:** approximately −5%

Uses `is_pulse` / `is_pulse_protein` fields — NEVER `is_legume`.

### Cat Carb Overload (D-014)

3+ ingredients with `cat_carb_flag = true` in top 5 positions.
**Penalty:** −15% of baseScore (`baseScore × 0.85`)

### Cat Taurine Missing

No taurine ingredient detected.
**Penalty:** −10 flat points (not percentage)

### UGT1A6 Warning (flag only)

Ingredients: propylene glycol, onion powder, garlic powder.
**Adjustment:** 0 (flag for UI display only)

---

## 7. Layer 3: Personalization (`personalization.ts`)

### Allergen Override (D-129)

If pet has allergens, IQ scored twice:
- `baseIQ` — without allergen severity overrides (for display breakdown)
- `overrideIQ` — with allergen groups elevated to danger/caution (used in composite)

Allergen delta = `overrideIQ − baseIQ` (weighted into final score)

### Life Stage Mismatch (D-150, category-scaled)

Puppy/kitten eating adult food:
| Category | Penalty |
|---|---|
| Treat | −5 |
| Supplemental | −10 |
| Daily food | −15 |

Adult+ eating growth food: −5 flat.

**Nursing advisory (D-151):** Pets <4 weeks → suppress life stage penalty, show advisory.

### Breed Modifiers

Cap: ±10 total (D-109). Applied from breed-specific modifier tables.

### Allergen Score Cap (D-167)

After all Layer 3 adjustments (allergen flags, life stage, breed, conditions), if the product contains any of the pet's declared allergens, the score is hard-capped at 50.

- **Trigger:** `personalizations.some(p => p.type === 'allergen')` — fires when the product actually contains allergen-matching ingredients (direct OR possible match)
- **Cap value:** 50 — the threshold at which ResultScreen switches from "Consider for occasional use" to "Explore higher-scoring alternatives for [Pet]"
- **Mechanism:** Early return from `applyPersonalization()` with `finalScore: 50`, following the cardiac/DCM zero-out pattern
- **Cap entry:** Added to personalizations array with `adjustment: 50 - uncappedScore` for waterfall transparency
- **No-op when:** Score is already at or below 50 (other penalties were sufficient)
- **Applies to:** All categories (daily food, supplemental, treats)

---

## 7.5. Layer 3: Condition Scoring (`conditionScoring.ts`)

File: `src/utils/conditionScoring.ts`

**12 conditions** across 4 priority tiers. Applied as flat point adjustments to the final composite score.

### Architecture

- **Input:** Product, ingredients, pet profile, conditions list
- **Output:** `ConditionScoringResult` — adjustments array, total adjustment, zeroOut flag
- Each adjustment has: condition, rule ID, points (±), bucket label (IQ/NP/FC), citation, reason
- Bucket label is for **display categorization** only — not a weighted sub-score target

### Cap Logic

| Cap | Value |
|-----|-------|
| Per-condition total | ±8 points |
| Total bonus cap | +10 max |
| Total penalty cap | −15 max |

When a per-condition total exceeds ±8, all rules for that condition are proportionally scaled.

### Critical Safety Override: cardiac + DCM = 0

If a **dog** has `cardiac` condition AND the food triggers DCM pulse advisory (`evaluateDcmRisk()`):
- Score is set to **0** (not just penalized)
- `zeroOut = true`, no other condition rules evaluated
- Regression anchor: Pure Balance + cardiac dog = 0

### P0 Conditions

#### Obesity (5 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High fiber bonus | Both | fiber DMB > 5% | +2 |
| High fat penalty | Both | fat DMB > 18% | −3 |
| High calorie penalty | Both | kcal/kg DMB > 4200 (dry) / 1200 (wet) | −3 |
| L-Carnitine bonus | Both | L-carnitine present | +1 |
| Lean protein bonus | Both | protein DMB > 30% AND fat DMB < 14% | +2 |

#### Underweight (4 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High calorie bonus | Both | kcal/kg DMB > 4000 (dry) / 1100 (wet) | +2 |
| High protein bonus | Both | protein DMB > 32% | +2 |
| High fiber penalty | Both | fiber DMB > 6% | −2 |
| Weight mgmt formula penalty | Both | Name contains "lite/light/healthy weight" | −3 |

#### GI Sensitive (4 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High fat penalty | Dogs | fat DMB > 18% | −3 |
| Digestive fiber bonus | Both | psyllium/pumpkin/beet pulp present | +1 |
| Prebiotic bonus | Both | chicory root/inulin/FOS present | +1 |
| Lactose penalty | Both | dairy in top 10 | −2 |

### P1 Conditions

#### Diabetes — Critical Dog/Cat Split (9 rules)

**Dogs** — fiber-based management:
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High fiber bonus | Dogs | fiber DMB > 5% | +3 |
| Complex carb bonus | Dogs | barley/sorghum/oats in top 10 | +2 |
| Simple sugar penalty | Both | corn syrup/molasses/fructose/etc | −4 |
| Semi-moist penalty | Dogs | product_form = semi_moist | −3 |

**Cats** — carb-based management (D-149 estimation):
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| Ultra-low carb bonus | Cats | carb DMB < 10% | +4 |
| Low carb bonus | Cats | carb DMB 10-20% | +2 |
| High carb penalty | Cats | carb DMB > 30% | −5 |
| Wet food bonus | Cats | wet format | +2 |
| Dry kibble penalty | Cats | dry format | −2 |
| Gravy penalty | Cats | name contains "gravy"/"in sauce" | −1 |

#### Pancreatitis — Critical Dog/Cat Split (6 rules)

**Dogs** — fat is THE trigger:
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High fat penalty | Dogs | fat DMB > 12% | −5 |
| Ultra high fat penalty | Dogs | fat DMB > 18% | −3 (stacks) |
| Lean protein bonus | Dogs | protein DMB > 25% AND fat DMB < 10% | +3 |
| Digestive enzyme bonus | Dogs | enzymes present | +1 |

**Cats** — NOT fat-triggered (IBD connection):
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| Digestible protein bonus | Cats | fish/rabbit/egg/turkey in top 5 | +2 |
| Novel protein bonus | Cats | rabbit/venison/duck in top 3 | +1 |

### P2 Conditions

#### CKD — Kidney Disease (7 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| Senior cat protein gate | Cats | senior + protein DMB < 30% | +3 |
| High phosphorus penalty | Both | P DMB > 1.0 (cat) / 1.2 (dog) | −4 |
| Moderate protein bonus | Both | protein in range (cat 28-35, dog 20-28) | +2 |
| High protein penalty | Both | protein DMB > 42 (cat) / 35 (dog) | −3 |
| Cat wet food bonus | Cats | wet format | +3 |
| Omega-3 bonus | Both | fish oil/EPA/DHA present | +1 |
| High sodium penalty | Both | salt/sodium in top 10 | −2 |

#### Cardiac — Heart Disease (8 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| DCM zero-out | Dogs | cardiac + DCM fires | **Score = 0** |
| Taurine + L-Carnitine bonus | Dogs | both present | +3 |
| High sodium penalty | Dogs | salt/sodium in top 10 | −3 |
| Omega-3 bonus | Dogs | fish oil/EPA/DHA present | +1 |
| Cat taurine missing penalty | Cats | no taurine | −5 |
| Cat sodium penalty | Cats | salt/sodium in top 10 | −2 |
| Cat omega-3 bonus | Cats | fish oil/EPA/DHA present | +2 |
| Cat wet food bonus | Cats | wet format | +1 |

#### Urinary (3 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| Wet food bonus | Both | wet format | +3 |
| Dry-only penalty | Both | dry format | −3 |
| High moisture bonus | Both | moisture > 75% | +1 |

#### Joint (3 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| Omega-3 bonus | Both | fish oil/EPA/DHA present | +2 |
| High calorie penalty | Both | dry + kcal/kg DMB > 4200 | −2 |
| Glucosamine/chondroitin bonus | Both | present | +1 |

### P3 Conditions

#### Skin & Coat (5 rules)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| Omega-3 bonus | Both | fish oil/EPA/DHA present | +3 |
| Omega-6 bonus | Both | ga_omega6_pct > 0 | +1 |
| Unnamed protein penalty | Both | unnamed protein sources | −3 |
| Multi-protein penalty | Both | > 3 distinct allergen groups | −2 |
| Limited protein bonus | Both | 1-2 distinct allergen groups | +2 |

#### Hypothyroidism (5 rules, dogs only)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High fat penalty | Dogs | fat DMB > 16% | −3 |
| High calorie penalty | Dogs | kcal/kg DMB > 4000 | −2 |
| High fiber bonus | Dogs | fiber DMB > 5% | +2 |
| Omega-3 bonus | Dogs | fish oil/EPA/DHA present | +2 |
| L-Carnitine bonus | Dogs | L-carnitine present | +1 |

#### Hyperthyroidism (3 rules, cats only)
| Rule | Species | Trigger | Points |
|------|---------|---------|--------|
| High calorie bonus | Cats | kcal/kg DMB > 4500 | +3 |
| High protein bonus | Cats | protein DMB > 40% | +2 |
| Wet food bonus | Cats | wet format | +1 |

### Not Implemented

`liver` and `seizures` tags exist in DOG_CONDITIONS but have **no scoring rules** — display-only for now.

---

## 13. Weight Management (D-160, D-161, D-162)

Not part of the scoring engine — these affect calorie calculations only.

### Weight Goal Slider (D-160)

File: `src/utils/weightGoal.ts`

7-position discrete slider (-3 to +3), stored as `weight_goal_level` on pets table.

| Level | Multiplier | Label |
|-------|-----------|-------|
| -3 | 0.80 | Aggressive loss (cats: absent) |
| -2 | 0.85 | Moderate loss |
| -1 | 0.90 | Mild loss |
| 0 | 1.00 | Maintain |
| +1 | 1.10 | Mild gain |
| +2 | 1.15 | Moderate gain |
| +3 | 1.20 | Aggressive gain |

**DER adjustment:** `adjustedDER = baseDER × multiplier`

**Blocked positions:** Conditions auto-block contradictory positions (e.g., obesity blocks +1/+2/+3).

**Single source of truth:** `computePetDer()` in `pantryHelpers.ts` — used by ResultScreen, AddToPantrySheet, PortionCard, pantry budget.

### Caloric Accumulator (D-161)

Server-side in auto-deplete cron (`supabase/functions/auto-deplete/`). Tracks daily caloric delta between food consumed and DER target. Triggers weight estimate push notifications.

### BCS Reference (D-162)

Educational-only. 9-point scale, species-specific cards. Owner-reported BCS saves to `bcs_score` on pets table. No impact on scoring.

## 8. Supplemental Classification (D-136, D-146)

File: `src/utils/supplementalClassifier.ts`

**AAFCO statement patterns** (regex, case-insensitive):
`intermittent`, `supplemental feeding`, `not intended as a sole diet`, `for supplemental feeding only`, `mix with`, `serve alongside`, `not complete and balanced`, `not a complete`

**Product name patterns:**
`topper`, `meal topper`, `food topper`, `mixer`, `meal mixer`, `meal enhancer`, `meal booster`, `sprinkle`, `dinner dust`

"supplement" alone does NOT match — avoids misclassifying vitamin supplements (D-096).

---

## 9. Score Color System (D-136)

### Daily Food (360° ring) — Green family
| Tier | Threshold | Hex | Name |
|---|---|---|---|
| Excellent | ≥85 | `#22C55E` | green-600 |
| Good | ≥70 | `#86EFAC` | green-300 |
| Fair | ≥65 | `#FACC15` | yellow-400 |
| Low | ≥51 | `#F59E0B` | amber-500 |
| Poor | <51 | `#EF4444` | red-500 |

### Supplemental (270° arc) — Teal/Cyan family
| Tier | Threshold | Hex | Name |
|---|---|---|---|
| Excellent | ≥85 | `#14B8A6` | teal-600 |
| Good | ≥70 | `#22D3EE` | cyan-400 |
| Fair | ≥65 | `#FACC15` | yellow-400 |
| Low | ≥51 | `#F59E0B` | amber-500 |
| Poor | <51 | `#EF4444` | red-500 |

Both converge at yellow/amber/red for lower scores.

Source: `constants.ts` `getScoreColor()`

---

## 10. Severity Colors

| Severity | Hex | Tailwind |
|---|---|---|
| Danger | `#EF4444` | red-500 |
| Caution | `#F59E0B` | amber-500 |
| Good | `#4ADE80` | green-400 |
| Neutral | `#6B7280` | gray-500 |

Display label: "Danger" → "Severe" in UI (D-143). Internal enum unchanged.

Source: `constants.ts` SEVERITY_COLORS

---

## 11. Regression Targets

| Product | Species | Category | Score | Test File |
|---|---|---|---|---|
| Pure Balance Wild & Free Salmon & Pea | Dog | Daily food | **62** | `regressionAnchors.test.ts` |
| Temptations Classic Tuna | Cat | Treat | **9** | `regressionAnchors.test.ts` |

Verify after ANY scoring change. Run: `npx jest --testPathPattern=regressionAnchors`

---

## 14. Decision Reference

| Decision | Scope | File |
|---|---|---|
| D-010 | Category-adaptive weights | engine.ts, constants.ts |
| D-012 | Unnamed species penalty | ingredientQuality.ts |
| D-014 | Cat carb overload | speciesRules.ts |
| D-015 | Ingredient splitting | ingredientQuality.ts |
| D-017 | Missing GA fallback weights | engine.ts, constants.ts |
| D-018 | Position-weighted scoring | ingredientQuality.ts |
| D-019 | Brand-blind scoring | engine.ts |
| D-094 | Suitability framing | personalization.ts |
| D-104 | Carb estimation display | engine.ts |
| D-109 | Breed modifier cap ±10 | constants.ts |
| D-129 | Allergen override (dual-IQ) | engine.ts, personalization.ts |
| D-135 | Vet diet bypass | pipeline.ts |
| D-136 | Supplemental classification | src/utils/supplementalClassifier.ts |
| D-137 | DCM positional pulse load | speciesRules.ts |
| D-143 | "Danger" → "Severe" display | constants.ts |
| D-144 | Species mismatch bypass | pipeline.ts |
| D-145 | Variety pack bypass | pipeline.ts |
| D-149 | Feline carb estimation (diabetes) | conditionScoring.ts |
| D-150 | Life stage mismatch (Layer 3) | personalization.ts |
| D-151 | Nursing advisory (<4 weeks) | engine.ts |
| D-158 | Recalled product bypass | pipeline.ts |
| D-160 | Weight goal slider (±3 levels) | weightGoal.ts, pantryHelpers.ts |
| D-161 | Caloric accumulator | auto-deplete Edge Function |
| D-162 | BCS reference (educational) | BCSReferenceScreen.tsx |
| D-167 | Allergen score cap (hard ceiling 50) | personalization.ts |
