# Kiba — Scoring Rules Reference

> **Read this before implementing ANY scoring logic.**
> **Last updated:** March 26, 2026 (M5 complete. D-150 life stage mismatch in Layer 3; D-151 nursing advisory. Current test count in `docs/status/CURRENT.md`.)
> **Canonical sources:** This file consolidates rules from DECISIONS.md, NUTRITIONAL_PROFILE_BUCKET_SPEC.md, BREED_MODIFIERS_DOGS.md, BREED_MODIFIERS_CATS.md, and PORTION_CALCULATOR_SPEC.md. If this file conflicts with DECISIONS.md, DECISIONS.md wins.

---

## 1. Category-Adaptive Weighting (D-010, D-136)

| Category | IQ | NP | FC | Trigger |
|----------|---:|---:|---:|---------|
| Daily Food | 55% | 30% | 15% | Default for all non-treat, non-supplemental products |
| Supplemental | 65% | 35% (macro-only) | 0% | `is_supplemental = true` on products table |
| Treats | 100% | 0% | 0% | `category = 'treat'` |

**Routing priority:** Treat > Supplemental > Daily Food. A treat is always 100/0/0 regardless of `is_supplemental`.

**Missing GA fallback (D-017):** When GA panel unavailable, reweight to ~78% IQ / 22% FC. Show "Partial" badge. NP bucket skipped entirely.

### Supplemental Classification (D-136)

Products with AAFCO "intermittent or supplemental feeding" language in their feeding guide. Detected at import time by `supplementalClassifier.ts` keyword matching against `aafco_statement` and `feeding_guidelines` (Migration 008). Stored as `is_supplemental BOOLEAN DEFAULT FALSE` on products table.

**Match patterns:** "intermittent", "supplemental feeding", "not intended as a sole diet", "for supplemental feeding only", "intended for intermittent or supplemental feeding", "mix with [brand]", "serve alongside", "not complete and balanced", "not a complete".

**CRITICAL DISTINCTION:** `is_supplemental = true` (D-136) ≠ `haiku_suggested_category = 'supplement'` (D-096). A fish oil capsule is category `'supplement'`. Against the Grain Nothing Else Duck is `category = 'daily_food'` with `is_supplemental = true`. Completely different axes.

---

## 2. Three-Layer Architecture (D-011)

All three layers are independently testable. Same inputs → same score, every time.

### Layer 1 — Base Score

Weighted composite of three sub-buckets (or two for supplemental, or one for treats):

**Ingredient Quality (55% / 65% / 100%):**
- Start at 100, deduct per ingredient based on severity × position weight
- Severity enum: `good` (+0), `neutral` (+0), `caution` (−8), `danger` (−15)
- Position weighting (D-018): proportion-based concerns get reduced penalty at lower positions (1–5 = full, 6–10 = −30%, 11+ = −60%). Presence-based concerns (BHA, BHT, artificial colorants) = full penalty regardless of position
- Check `position_reduction_eligible` flag before applying any position discount
- Unnamed species penalty: −2 per unnamed fat/protein source (D-012)
- D-129 allergen override: when pet has allergens, engine scores IQ twice — `baseIqResult` (for waterfall display) and `iqResult` (with allergen overrides applied). Direct allergen match → `danger` (15pts). Possible match → `caution` (8pts). Override is a floor: `max(baseSeverity, override)`.

**Nutritional Profile (30% / 35% / 0%):**
- Full spec: `NUTRITIONAL_PROFILE_BUCKET_SPEC.md`
- For supplemental products: **macro evaluation only** — protein, fat, fiber, moisture vs AAFCO ranges. Skip calcium, phosphorus, Ca:P, omega ratios, life stage matching. Pass `isSupplemental: true` on `NutritionalProfileInput`.
- DMB conversion mandatory for wet food (moisture >12%) — see §3 below
- 4 sub-nutrients with species-specific weights:
  - **Dog:** Protein 35% / Fat 25% / Fiber 15% / Carbs 25%
  - **Cat:** Protein 45% / Fat 20% / Fiber 10% / Carbs 25%
- Trapezoidal scoring curves per sub-nutrient (not binary pass/fail) — see §4 below
- Life stage determines which AAFCO thresholds apply — see §5 below
- Breed modifiers apply within this bucket, capped at ±10 — see §7 below

**Formulation Completeness (15% / 0% / 0%):**
- AAFCO statement compliance
- Preservative quality assessment (natural vs synthetic vs mixed)
- Protein naming specificity
- Skipped entirely for treats and supplemental products

### Layer 2 — Species Rules

Applied as percentage multipliers to the composite score:

**Dogs:**
- DCM advisory (D-137): ×0.92 (−8%) via positional pulse load detection — three-rule OR:
  - Rule 1 (Heavyweight): 1+ pulse in positions 1–3
  - Rule 2 (Density): 2+ pulses in positions 1–10
  - Rule 3 (Substitution): 1+ pulse protein isolate in positions 1–10
- DCM mitigation: ×1.03 (+3%) when taurine + L-carnitine both supplemented
- Detection uses `is_pulse` + `is_pulse_protein` flags on `ingredients_dict`. No grain-free gate. `is_legume` is NOT used for DCM.
- Pulse scope: peas, lentils, chickpeas, fava/dry beans + all derivatives. Excludes potatoes, sweet potatoes, soy, tapioca.

**Cats:**
- Carb overload: ×0.85 (−15%) when 3+ high-glycemic carbs in top 5 (uses `cat_carb_flag`)
- Mandatory taurine check: ×0.90 (−10%) if taurine not found in ingredient list
- UGT1A6 warnings: advisory only (no score impact)

### Layer 3 — Personalization

- Allergy cross-reference (D-097, D-098, D-129)
- **Life stage mismatch (category-scaled, moved from NP bucket):**
  - Puppy/kitten eating "Adult"/"Maintenance" food: daily food −15, supplemental −10, treat −5
  - Adult/junior/mature/senior/geriatric eating "Growth"/"Puppy"/"Kitten" food: −5 (all categories)
  - "All Life Stages" or null claim → no penalty
  - **Suppressed for pets under 4 weeks** — nursing advisory flag takes precedence
  - Citation: AAFCO Official Publication, Nutritional Adequacy — Growth & Reproduction vs Adult Maintenance profiles
- Breed-specific modifiers from `BREED_MODIFIERS_DOGS.md` / `BREED_MODIFIERS_CATS.md`
- Breed modifier cap: ±10 total within the nutritional bucket
- Neutral (zero effect) if no conflicts detected

---

## 3. DMB Conversion (Mandatory)

```
DMB_value = (as_fed_value / (100 - moisture_pct)) × 100
```

- If `moisture_pct > 12%` → conversion is **mandatory** before NP bucket
- If `moisture_pct <= 12%` → still apply, delta is negligible
- If `moisture_pct` is null → assume 10% (dry default), flag as estimate
- **Without this, every wet food scores catastrophically wrong**

Example: Wet food with 78% moisture, 10% protein as-fed → 10 / (100 - 78) × 100 = **45.5% protein DMB**

---

## 4. Trapezoidal Scoring Curves

Each sub-nutrient uses a trapezoidal curve, not binary pass/fail. Full details in `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` §4.

### Shape

```
Score
100 |         ___________
    |        /           \
 70 |       /             \
    |      /               \
 40 |     /                 \
    |    /                   \
  0 |___/                     \___
    |   |    |         |    |
    0  crit  ideal    ideal excess
         low  low     high
```

### Key Thresholds

**Protein (dogs, adult maintenance):**
- AAFCO min: 18% DMB
- Critical low: 14.4% (min × 0.8)
- Ideal low: 20.7% (min × 1.15)
- Ideal high: 36% (min × 2.0)
- Excess: 45% (min × 2.5)

**Protein (cats, adult maintenance):**
- AAFCO min: 26% DMB
- Critical low: 20.8%
- Ideal low: 29.9%
- Ideal high: 52%
- Excess: 65%

**Fat (dogs):**
- AAFCO min: 5.5% DMB (adult)
- Ideal high: 18% DMB
- Excess: 25% DMB

**Fat (cats — decoupled from dogs):**
- AAFCO min: 9% DMB (adult)
- Ideal low: 12%
- Ideal high: 20%
- Excess: 25%

**Fiber:** Step curve, not trapezoidal. ≤5% DMB → 90. >5% to ≤10% → 70. >10% → 50.

**Carbs (estimated via NFE):**
- Dog: ≤40% → 80, 40–55% → linear 80→40, >55% → 40
- Cat: ≤25% → 80, 25–35% → linear 80→40, >35% → 40

### Carbohydrate Estimation (D-104)

```
NFE = Math.max(0, 100 - (protein_dmb + fat_dmb + fiber_dmb + ash_dmb))
```

Ash defaults (AS-FED — must convert to DMB before use):
- Dry food: 7.0%
- Wet food: 2.0%
- Treats: 5.0%

If Ca + P both available: `ash_af = (calcium_pct + phosphorus_pct) × 2.5`

`Math.max(0)` floor required — GA min/max asymmetry can produce negative values.

---

## 5. Life Stage Mapping

Six tiers collapse to four DER buckets. Life stage determines AAFCO threshold selection.

| 6-Tier | DER Bucket | AAFCO Profile |
|--------|-----------|---------------|
| Puppy/Kitten | puppy | Growth & Reproduction |
| Junior | adult | Adult Maintenance |
| Adult | adult | Adult Maintenance |
| Mature | adult | Adult Maintenance |
| Senior | senior | Adult Maintenance + senior modifiers |
| Geriatric | geriatric | Adult Maintenance + geriatric modifiers |

### Senior/Geriatric Modifiers (within NP bucket)

- Senior dogs: protein < 25% DMB → −5 sub-score penalty
- Senior/geriatric cats: protein < 30% DMB → −5 sub-score penalty — **unless** pet has CKD condition (CKD requires protein restriction)
- Geriatric cats: +3 protein sub-score bonus (higher protein supports muscle mass — D-063)
- Kitten food fed to senior cat: −5 bucket-level penalty (mismatched life stage claim)

**NOTE:** The general life stage mismatch penalty (puppy/kitten eating adult food, adult eating growth food) was **moved from the NP bucket to Layer 3 personalization** to ensure it applies equally across all product categories. See §2 Layer 3. The NP bucket retains only the senior-specific modifiers listed above.

### Large/Giant Breed Puppies (Dogs)

- Ca DMB > 1.8% → −3 calcium sub-score penalty
- Ca:P ratio outside 1.1:1 – 2:1 → −2 penalty
- Applies to breeds ≥70 lbs adult weight (AAFCO definition)
- Fires ONLY for puppy life stage

---

## 6. Score Color System (D-136 — supersedes D-113)

Two parallel five-tier scales. Use `getScoreColor(score, isSupplemental)` from `src/utils/constants.ts` — never hardcode. Score ring rendered via `react-native-svg` (`Circle` with `strokeDasharray`/`strokeDashoffset`).

**Daily Food + Treats:**

| Range | Color | Hex | Verdict |
|-------|-------|-----|---------|
| 85–100 | Dark Green | #22C55E | Excellent match |
| 70–84 | Light Green | #86EFAC | Good match |
| 65–69 | Yellow | #FACC15 | Fair match |
| 51–64 | Amber | #F59E0B | Low match |
| 0–50 | Red | #EF4444 | Poor match |

**Supplemental:**

| Range | Color | Hex | Ring Shape | Verdict |
|-------|-------|-----|-----------|---------|
| 85–100 | Teal | #14B8A6 | 270° open arc | Excellent match |
| 70–84 | Cyan | #22D3EE | 270° open arc | Good match |
| 65–69 | Yellow | #FACC15 | 270° open arc | Fair match |
| 51–64 | Amber | #F59E0B | 270° open arc | Low match |
| 0–50 | Red | #EF4444 | 270° open arc | Poor match |

**Hard rules:**
- Green NEVER on supplementals. Teal/cyan NEVER on daily food/treats.
- Open arc (270°) = supplemental only. Full circle (360°) = daily food + treats.
- All labels use D-094 suitability framing — "match" spectrum only, no clinical language.
- Supplemental products also display: "Supplemental" badge (teal), contextual line "Best paired with a complete meal".

---

## 7. Breed Modifiers

Full specs: `BREED_MODIFIERS_DOGS.md` (23 breeds), `BREED_MODIFIERS_CATS.md` (21 breeds).

### Key Rules

- **Cap:** ±10 total within the nutritional bucket (D-010)
- **Three tiers:** GA-actionable (score modifiers), ingredient-actionable (score modifiers), advisory-only (UI notes, zero score impact)
- **`no_modifier` breeds** must be explicitly registered to prevent false penalties
- **D-112 breed contraindications:** Binary medical incompatibilities (Dalmatian/purines, Irish Setter/gluten) → red warning card above fold, zero score impact. These are NOT score modifiers.
- **`vet_audit_status` must be `cleared`** before any modifier reaches production
- Every modifier entry requires at least one `citation_source`

### High-Impact Dog Breeds

| Breed | Primary Concern | Max Penalty | Key Threshold |
|-------|----------------|-------------|---------------|
| Miniature Schnauzer | Pancreatitis (fat) | −6 | fat_dmb > 18% |
| Cocker Spaniel | Pancreatitis + DCM | −5 (fat) + −2 (DCM) | fat_dmb > 18%, D-137 pulse load |
| Dalmatian / English Bulldog / BRT | Urate stones (SLC2A9) | D-112 contraindication card | High-purine ingredients |
| German Shepherd | EPI (fat) | −4 | fat_dmb > 18% |
| Labrador Retriever | Calcium (puppy) | −3 | Ca_dmb > 1.8% (puppy only) |
| Shetland Sheepdog | GBM (fat) | −4 | fat_dmb > 18% |

### High-Impact Cat Breeds

| Breed | Primary Concern | Max Penalty | Key Threshold |
|-------|----------------|-------------|---------------|
| Burmese | Diabetes (carbs) + CaOx | −5 (carb) + −2 (oxalate) | carb_dmb > 30% |
| Persian / Himalayan / Exotic | PKD (phosphorus) + CaOx | −3 (phosphorus) + −2 (oxalate) | P_dmb > 1.5% |
| Egyptian Mau | Purines | −2 | High-purine ingredients |

### Global Blocks

- **Taurine does NOT modify genetic HCM** — applies to Maine Coon, Ragdoll, Sphynx, British Shorthair, all HCM breeds
- **Fat, not carbs, is the primary feline obesity driver** — obesity breed modifiers target fat, not carbs
- **Phosphorus source matters** — inorganic phosphate salts (sodium tripolyphosphate, dicalcium phosphate, monocalcium phosphate) are more nephrotoxic than organic phosphorus in meat

---

## 8. Splitting Detection

Uses `cluster_id` in `ingredients_dict`. Detection: `GROUP BY cluster_id HAVING count >= 2`.

**NEVER** use string matching. The parser created variant names (e.g., `pea_protein`, `pea_starch`) that share a `cluster_id` but have different canonical names.

Example: "Dried Peas" and "Pea Starch" both have `cluster_id = 'legume_pea'`. Combined, peas may be a larger portion than the label suggests.

---

## 9. Allergen Override (D-129)

When a pet has declared allergens, the scoring engine overrides ingredient severities for that pet's scoring run only.

| Match Type | Source Field | Override Severity | Points |
|------------|-------------|------------------|--------|
| Direct match | `allergen_group` | `danger` | 15 |
| Possible match | `allergen_group_possible` | `caution` | 8 |

- Override is a **floor:** `max(baseSeverity, override)` — danger stays danger, never reduced
- Base severity in `ingredients_dict` is **NEVER written** — override is per-pet, per-score only
- Engine scores IQ twice: `baseIqResult` (waterfall) and `iqResult` (composite)
- `allergenDelta` = weighted difference between the two
- Waterfall shows "[Pet Name]'s Allergen Sensitivity: −[X] pts" row when delta > 0
- Real-world impact: chicken-heavy product 92 → 67 (amber) for chicken-allergic dog

---

## 10. Frequency Advisories (NOT Score Modifiers)

These are UI notes only — they never affect the score:

- Mercury warnings (tuna, swordfish — daily feeding concern)
- Vitamin A accumulation (liver-heavy products)
- CaOx moisture advisory (high moisture → reduced stone risk for predisposed breeds)
- Breed-specific advisory-only modifiers (Tier 3 breeds)

---

## 11. Regression Targets

### Pure Balance Wild & Free Salmon & Pea (Dog)

**Expected:** final_score = **62** (non-negotiable)

Breakdown:
- IQ: 58, NP: 79, FC: 63
- Base: (58 × 0.55) + (79 × 0.30) + (63 × 0.15) = 31.9 + 23.7 + 9.45 = 65.05 → 65
- Layer 2 (D-137): DCM fires — Rule 1 (Dried Peas at pos 3) + Rule 2 (2 pulses in top 10)
  - ×0.92 → 59.8
  - Mitigation (taurine + L-carnitine) → ×1.03 → 61.6
- Rounded: **62**

### Temptations Classic Tuna (Cat Treat)

**Expected:** final_score = **9**

Breakdown:
- IQ: 19 (treat = 100% IQ, so base = 19). Three artificial colorants at danger severity (yellow 5, red 40, blue 2 — D-142 escalation, 15 pts each, no position reduction) + chicken by-product meal, animal fat (unnamed), dried meat by-products at caution.
- Layer 2: Taurine missing −10 → 9. Carb overload does NOT fire (only 2 carb flags in top 5, needs 3).

### Test Count

Current test count in `docs/status/CURRENT.md`. All tests must pass after any change.

---

## 12. Scoring Engine Constants

```typescript
export const SCORING_WEIGHTS = {
  daily_food: { iq: 0.55, np: 0.30, fc: 0.15 },
  daily_food_partial: { iq: 0.78, np: 0, fc: 0.22 },
  supplemental: { iq: 0.65, np: 0.35, fc: 0 },
  treat: { iq: 1.0, np: 0, fc: 0 },
} as const;

// Sub-nutrient weights within the NP bucket
export const NP_SUB_WEIGHTS = {
  dog: { protein: 0.35, fat: 0.25, fiber: 0.15, carbs: 0.25 },
  cat: { protein: 0.45, fat: 0.20, fiber: 0.10, carbs: 0.25 },
} as const;
```

---

## 13. Order of Operations

1. **Classify product:** treat → 100/0/0. Supplemental → 65/35/0. Daily food → 55/30/15.
2. **DMB conversion** if moisture > 12%
3. **Layer 1 — Ingredient Quality:** position-weighted severity deductions. If pet has allergens: score twice (baseIqResult + overrideIqResult).
4. **Layer 1 — Nutritional Profile (if applicable):** DMB values → sub-nutrient trapezoidal curves → sub-score modifiers (life stage, breed) → clamp [0,100] → weighted sum → bucket-level modifiers (senior/geriatric, large breed puppy Ca) → clamp [0,100]. For supplementals: macro-only (skip micronutrients). **Note:** general life stage mismatch penalty is no longer in this step — moved to step 8.
5. **Layer 1 — Formulation (if applicable):** AAFCO statement + preservative + naming.
6. **Composite:** weighted sum of applicable buckets.
7. **Layer 2 — Species Rules:** percentage multipliers (DCM, carb overload, taurine check).
8. **Layer 3 — Personalization:** allergen delta applied, **category-scaled life stage mismatch** (daily −15, supplemental −10, treat −5 for puppy/kitten+adult food; −5 all categories for adult+growth food; suppressed for pets under 4 weeks), breed modifiers (already applied within NP in step 4 — don't double-count).
9. **Nursing advisory flag** added if pet is under 4 weeks old (informational, no score impact).
10. **Final clamp** [0, 100], round to integer.

---

## 14. Non-Negotiable Rules

1. **Deterministic** — same inputs → same score, every time
2. **Brand-blind** (D-019) — zero awareness of brand names
3. **Affiliate-blind** (D-020) — zero awareness of `affiliate_links`
4. **Citation required** — every penalty has `citation_source`
5. **Clinical Copy Rule** (D-095) — factual, never editorial. No "terrible," "avoid at all costs"
6. **Suitability framing** (D-094) — "[X]% match for [Pet Name]", never naked scores
7. **Species-specific** — dog and cat rules never share. Refuse unsupported species.
8. **Position check** — always verify `position_reduction_eligible` before discounting
9. **DMB mandatory** — wet food without DMB conversion is a scoring engine bug
10. **Kiba Index isolation** — Taste Test + Tummy Check is a parallel signal, NEVER blended into the % score

---

## 15. File Map

| File | What It Contains |
|------|-----------------|
| `src/services/scoring/engine.ts` | Orchestrator — weight selection, Layer 1/2/3 coordination, D-129 dual-IQ, D-136 supplemental routing |
| `src/services/scoring/ingredientQuality.ts` | IQ bucket — severity × position, allergen overrides |
| `src/services/scoring/nutritionalProfile.ts` | NP bucket — AAFCO curves, sub-nutrients, skipMicronutrients flag |
| `src/services/scoring/formulationScore.ts` | FC bucket — AAFCO statement, preservatives, naming |
| `src/services/scoring/speciesRules.ts` | Layer 2 — DCM, carb overload, taurine |
| `src/services/scoring/personalization.ts` | Layer 3 — allergens, category-scaled life stage mismatch, breed modifiers, under-4-weeks nursing advisory suppression |
| `src/utils/lifeStage.ts` | Life stage derivation, `isUnder4Weeks()` for nursing advisory |
| `src/utils/supplementalClassifier.ts` | D-136 feeding guide keyword parser |
| `src/utils/constants.ts` | SCORING_WEIGHTS, SCORE_COLORS, SEVERITY_COLORS, AAFCO_STATEMENT_STATUS, getScoreColor(), getVerdictLabel() |
| `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` | Full NP bucket spec (trapezoidal curves, worked examples) |
| `BREED_MODIFIERS_DOGS.md` | 23 dog breeds with full citations |
| `BREED_MODIFIERS_CATS.md` | 21 cat breeds with full citations |
| `PORTION_CALCULATOR_SPEC.md` | RER/DER math, portion display, treat budget |
