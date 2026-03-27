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
3. **Variety pack** (D-145) → no score, bypass reason
4. **Recalled product** (D-158) → no score, warning + ingredients, `isRecalled` flag
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

---

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

## 12. Decision Reference

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
| D-150 | Life stage mismatch (Layer 3) | personalization.ts |
| D-151 | Nursing advisory (<4 weeks) | engine.ts |
| D-158 | Recalled product bypass | pipeline.ts |
