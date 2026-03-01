# Kiba — Nutritional Profile Bucket Spec (30% Weight)

> **Status:** DRAFT — Requires vet auditor review before production use  
> **Applies to:** Daily food only. Treats = 100% Ingredient Quality (this bucket is 0%). Supplements = deferred to M16+ (D-096, not scored at launch).  
> **Prerequisite:** DMB conversion MUST run before this bucket. See §1.
>
> **Changelog:**
> - Mar 1, 2026: §3 life stage tables aligned to PET_PROFILE_SPEC 6-tier system; breed size thresholds updated; §5c modifier triggers use life_stage enum; breed counts corrected (23 dog, 21 cat); geriatric cat DER locked at 1.5×
> - Feb 27, 2026 (evening): Math.max(0) floor on NFE formulas (D-104)
> - Feb 27, 2026 (night): §2c ash defaults corrected (As-Fed, not DMB — must convert before NFE); §4b fat curve decoupled by species (dog vs cat thresholds — cat excess at 25% DMB, not 40.5%); §4b fiber exception updated for D-106 pet conditions; §5c CKD gate on senior cat protein penalty; §5d advisory text D-095 compliant; §8 order of operations clarified (sub-score vs bucket-level modifiers); §8 worked example recalculated with corrected ash, exact trapezoidal math, and decoupled cat fat curve (regression target 93 → 90); §10 CKD gate test added; §11 Q4/Q5 updated

---

## 0. Context: Where This Fits

The Kiba scoring engine uses category-adaptive weighting:

| Product Category | Ingredient Quality | Nutritional Profile | Formulation Completeness |
|---|---|---|---|
| Daily food | 55% | **30% ← this spec** | 15% |
| Treats | 100% | 0% | 0% |
| Supplements | — | — | — | *(D-096: deferred to M16+, uses separate 50/50 Ingredient Safety / Dose Validation architecture)* |

This document defines exactly how the 30% Nutritional Profile bucket computes its sub-score, including AAFCO thresholds, life stage adaptation, species differences, breed-specific modifiers, and the DMB conversion that must precede it.

---

## 1. Dry Matter Basis (DMB) Conversion — MANDATORY

GA values on pet food labels are reported "as fed," which includes moisture. A wet food with 75% moisture and 10% protein as-fed actually contains 40% protein on a dry matter basis. **Without this conversion, every wet food scores catastrophically wrong.**

### Formula

```
DMB_value = (as_fed_value / (100 - moisture_pct)) × 100
```

### Examples

| Product | Moisture | Protein (AF) | Protein (DMB) |
|---|---|---|---|
| Dry kibble | 10% | 26% | 28.9% |
| Wet food | 78% | 10% | 45.5% |
| Semi-moist | 35% | 18% | 27.7% |

### Implementation Rules

- If `moisture_pct > 12%`, DMB conversion is **mandatory** before scoring
- If `moisture_pct <= 12%` (standard dry food), DMB conversion is still applied but the delta is negligible
- If `moisture_pct` is null/missing, assume 10% (dry food default) and flag `"Moisture data unavailable — assuming dry food"`
- **Citation:** AAFCO Official Publication (2023), "Comparing Label Guarantees with AAFCO Nutrient Profiles"

---

## 2. AAFCO Threshold Tables

All values are on a **Dry Matter Basis** at a presumed caloric density of **4000 kcal ME/kg**.

### 2a. Dogs

| Nutrient | Growth & Repro (Min) | Growth & Repro (Max) | Adult Maintenance (Min) | Adult Maintenance (Max) |
|---|---|---|---|---|
| Crude Protein | 22.5% | — | 18.0% | — |
| Crude Fat | 8.5% | — | 5.5% | — |
| Crude Fiber | — | ~5% (guideline) | — | ~5% (guideline) |
| Calcium | 1.2% | 1.8% (large breed: 1.2-1.8%) | 0.5% | 2.5% |
| Phosphorus | 1.0% | 1.6% | 0.4% | 1.6% |
| Ca:P Ratio | 1.1:1 | 2:1 | 1.1:1 | 2:1 |

**Sources:** AAFCO Dog Food Nutrient Profiles (2016 revision, published in 2023 OP); Merck Veterinary Manual — Nutritional Requirements of Small Animals; NRC Nutrient Requirements of Dogs and Cats (2006)

### 2b. Cats

| Nutrient | Growth & Repro (Min) | Growth & Repro (Max) | Adult Maintenance (Min) | Adult Maintenance (Max) |
|---|---|---|---|---|
| Crude Protein | 30.0% | — | 26.0% | — |
| Crude Fat | 9.0% | — | 9.0% | — |
| Crude Fiber | — | ~5% (guideline) | — | ~5% (guideline) |
| Taurine (extruded) | 0.10% | — | 0.10% | — |
| Taurine (canned) | 0.17% | — | 0.17% | — |
| Calcium | 1.0% | — | 0.6% | — |
| Phosphorus | 0.8% | — | 0.5% | — |

**Sources:** AAFCO Cat Food Nutrient Profiles (2016 revision, published in 2023 OP); Merck Veterinary Manual; NRC (2006)

### 2c. Carbohydrate (Derived — Not Listed on Labels)

Carbs are estimated via Nitrogen-Free Extract:

```
NFE = Math.max(0, 100 - (protein_dmb + fat_dmb + fiber_dmb + ash_dmb))
```

If ash is unavailable, estimate by product category.

**Important:** These defaults are **as-fed** values. They MUST be converted to DMB using the §1 formula before use in the NFE calculation, just like all other GA values. Using as-fed ash directly in the DMB-based NFE formula will underestimate ash by 3-7 percentage points for wet food, producing inflated carb estimates.

| Category | Default Ash (As-Fed) | Typical DMB* | Basis |
|---|---|---|---|
| Dry food (moisture ≤12%) | 7.0% | ~7.8% | Industry average 5–8% AF |
| Wet food (moisture >12%) | 2.0% | ~9.1% | Industry average 1.5–2.5% AF |
| Treats | 5.0% | ~5.6% | High variability |

*DMB column shown for reference only at typical moisture (dry=10%, wet=78%, treat=10%). The engine MUST calculate DMB from the actual product moisture using the §1 formula, not use these reference DMB values.

```
// Implementation:
ash_af = default from table above (or from product data if available)
ash_dmb = ash_af / (100 - moisture_pct) × 100

estimated_carbs = Math.max(0, 100 - (protein_dmb + fat_dmb + fiber_dmb + ash_dmb))
```

If calcium AND phosphorus are both available, tighten the estimate:
```
ash_af = (calcium_pct + phosphorus_pct) × 2.5
ash_dmb = ash_af / (100 - moisture_pct) × 100
```

**Floor note:** `Math.max(0)` required because GA legally uses minimums for protein/fat and maximums for fiber/moisture. Actual values in the bag are almost always higher than label minimums, so this formula yields maximum possible carbs — which can go negative for ultra-high-protein wet foods without the floor.

**Important:** This is an estimate. Ash values vary. Display with confidence badge (Exact/Estimated/Unknown) and species-specific qualitative labels (D-104). The qualitative labels are display-only and do NOT feed back into the scoring engine — the carb curves in §4b handle all scoring math.

---

## 3. Life Stage Mapping

Life stages drive which AAFCO thresholds apply. These are derived from the pet profile — **never user-entered.**

### 3a. Dogs

| Life Stage | Age Rule | AAFCO Profile | Notes |
|---|---|---|---|
| `puppy` | 0–12mo (0–18mo giant) | Growth & Reproduction | Higher protein, fat, Ca, P requirements |
| `junior` | 12–24mo (18–24mo giant) | Adult Maintenance | Transitional — still benefits from slightly higher protein |
| `adult` | 2–7yr (2–5yr giant) | Adult Maintenance | Standard |
| `mature` | 7–10yr (5–8yr giant) | Adult Maintenance | Standard multipliers; monitor weight trends |
| `senior` | 10–13yr (8–10yr giant) | Adult Maintenance | Increased protein for sarcopenia prevention; lower phosphorus preferred |
| `geriatric` | 13+yr (10+yr giant) | Adult Maintenance | Further reduced activity; monitor closely |

**Breed size classification:**
- Small: adult weight < 25 lbs
- Medium: 25–55 lbs
- Large: 55–90 lbs
- Giant: > 90 lbs

**M1→M2 note:** If M1 scoring engine hardcoded age checks (e.g. `ageMonths >= 144`), M2 Session 4 replaces them with `lifeStage === 'senior' || lifeStage === 'geriatric'` checks. The modifier conditions in §5 use life_stage labels, not raw ages.

### 3b. Cats

| Life Stage | Age Rule | AAFCO Profile | Notes |
|---|---|---|---|
| `kitten` | 0–12mo | Growth & Reproduction | Highest protein requirements; sensitive to protein quality |
| `junior` | 1–2yr | Adult Maintenance | Transitional |
| `adult` | 2–7yr | Adult Maintenance | Standard |
| `mature` | 7–11yr | Adult Maintenance | Standard multipliers; monitor weight |
| `senior` | 11–14yr | Adult Maintenance | **Needs MORE protein (≥ 30% DMB recommended) and MORE calories — sarcopenia risk** |
| `geriatric` | 14+yr | Adult Maintenance | **Do NOT reduce calories linearly.** Geriatric cats need 1.5× RER (locked). Protein ≥ 30% DMB |

**Critical:** AAFCO does not publish separate senior/geriatric profiles for cats or dogs. Our senior adjustments are based on veterinary nutrition research (see citations below), not AAFCO mandates. The UI must reflect this: `"Based on veterinary research for [life_stage] [species]"` not `"AAFCO requirement"`.

**Sources:** 
- Laflamme (2005), *JAVMA* — "Nutrition for aging cats and dogs and the importance of body condition"  
- Cupp et al. (2007), *Animal Feed Science and Technology* — "Effect of nutritional interventions on longevity of senior cats"  
- NRC (2006), Ch. 15 — "Feeding of Normal Dogs and Cats"

---

## 4. Sub-Nutrient Scoring — How the 30% Bucket Works

The Nutritional Profile bucket scores **four sub-nutrients**, each weighted differently depending on species. Each sub-nutrient produces a 0–100 score based on how the product's DMB value compares to the AAFCO threshold for the active life stage.

### 4a. Sub-Nutrient Weights

| Sub-Nutrient | Dog Weight | Cat Weight | Rationale |
|---|---|---|---|
| Protein Adequacy | 35% | 45% | Cats are obligate carnivores — protein is their primary metabolic fuel |
| Fat Adequacy | 25% | 20% | Important for both; dogs have wider tolerance range |
| Fiber Reasonableness | 15% | 10% | Excessive fiber = filler flag; cats have lower fiber tolerance |
| Carbohydrate Estimate | 25% | 25% | Derived value; high carbs are concerning for both, critical for cats |

**These weights sum to 100% within the bucket.** The bucket's output (0–100) is then weighted at 30% in the final composite score.

### 4b. Scoring Curves

Each sub-nutrient uses a **trapezoidal scoring curve** — not binary pass/fail. This produces a gradient rather than a cliff edge.

#### Protein Adequacy Score (0–100)

```
Let min = AAFCO minimum for species + life_stage (DMB)
Let ideal_low = min × 1.15    (15% above AAFCO minimum)
Let ideal_high = min × 2.0     (twice the minimum — diminishing returns above this)
Let excess = min × 2.5          (excessive protein — minor concern for senior/kidney)

if protein_dmb < min × 0.8:     score = 0   (critically deficient)
if protein_dmb < min:            score = linear(protein_dmb, min×0.8, min, 0, 40)
if protein_dmb < ideal_low:      score = linear(protein_dmb, min, ideal_low, 40, 70)
if protein_dmb < ideal_high:     score = linear(protein_dmb, ideal_low, ideal_high, 70, 100)
if protein_dmb < excess:         score = 100  (plateau — more protein is fine)
if protein_dmb >= excess:        score = 90   (slight reduction — excess not harmful but unnecessary)
```

**Dog example (adult):** AAFCO min = 18% DMB. A product at 28% DMB scores ~95 (well in ideal range). A product at 15% DMB scores ~25 (below minimum, steep penalty).

**Cat example (adult):** AAFCO min = 26% DMB. A product at 38% DMB scores ~100. A product at 22% DMB scores ~20 (critically low for obligate carnivore).

#### Fat Adequacy Score (0–100)

Fat curve is **fully decoupled by species** to reflect different metabolic tolerances. Dogs have a wider acceptable fat range; cats as obligate carnivores are more sensitive to excess dietary fat (obesity, hepatic lipidosis). Same trapezoidal curve shape as protein, but with species-specific thresholds at every point.

```
--- Dogs ---
min        = AAFCO fat minimum for life_stage    (5.5% adult, 8.5% growth)
ideal_low  = min × 1.25                          (6.9% adult, 10.6% growth)
ideal_high = 18.0%                               (generous — dogs tolerate moderate fat well)
excess     = 25.0%                               (pancreatitis/obesity risk threshold)

--- Cats ---
min        = AAFCO fat minimum for life_stage    (9.0% both adult & growth)
ideal_low  = 12.0%                               (obligate carnivore sweet spot)
ideal_high = 20.0%                               (premium cat foods rarely exceed this in maintenance)
excess     = 25.0%                               (obesity/hepatic lipidosis threshold)

--- Scoring curve (same shape, species-specific points) ---
if fat_dmb < min × 0.8:      score = 0    (critically deficient)
if fat_dmb < min:             score = linear(fat_dmb, min×0.8, min, 0, 40)
if fat_dmb < ideal_low:       score = linear(fat_dmb, min, ideal_low, 40, 70)
if fat_dmb < ideal_high:      score = linear(fat_dmb, ideal_low, ideal_high, 70, 100)
if fat_dmb < excess:          score = 100  (plateau — healthy fat range)
if fat_dmb >= excess:         score = 60   (high fat has real health risk — obesity, pancreatitis)
```

**Curve invariant verification (min < ideal_low < ideal_high < excess):**
- Dog adult: 5.5 < 6.9 < 18.0 < 25.0 ✓
- Dog growth: 8.5 < 10.6 < 18.0 < 25.0 ✓
- Cat adult: 9.0 < 12.0 < 20.0 < 25.0 ✓
- Cat growth: 9.0 < 12.0 < 20.0 < 25.0 ✓

**Why decoupled:** A unified `min × 4.5` excess multiplier produced 24.75% for dogs (appropriate) but 40.5% for cats (dangerous — a 38% fat cat food scored perfectly). The decoupled curve implements the clinical reality already noted in the original spec: >25% DMB for dogs and >22% DMB for cats carries elevated risk. The excess threshold at 25% for both species is slightly above the cat concern note (22%) to keep the plateau window usable; the vet auditor may tighten to 22% based on clinical judgment.

**Note:** Excess dietary fat has stronger clinical links to pancreatitis and obesity than excess protein. This is why the fat excess score (60) is more aggressive than the protein excess score (90).

#### Fiber Reasonableness Score (0–100)

Fiber scoring is **inverted** — lower is generally better, with a sweet spot in the middle:

```
if fiber_dmb <= 1.0%:     score = 80   (very low — fine for most, slightly suboptimal)
if fiber_dmb <= 3.0%:     score = 100  (ideal range)
if fiber_dmb <= 5.0%:     score = 90   (acceptable)
if fiber_dmb <= 7.0%:     score = 70   (above typical — may indicate filler)
if fiber_dmb <= 10.0%:    score = 50   (high — suggests substantial filler content)
if fiber_dmb > 10.0%:     score = 25   (excessive — likely heavy filler or weight mgmt formula)
```

**Exception:** Weight management formulas intentionally use higher fiber. Reduce the fiber penalty by 50% (multiply the delta from 100 by 0.5) if **either** condition is true:
- The product AAFCO statement includes "weight management" or "light", OR
- `petConditions` includes `'obesity'` (D-106: obesity condition triggers the same suppression regardless of product label)

**⚠️ Vet audit flag:** Cats are obligate carnivores — their natural prey contains virtually zero crude fiber. Many high-quality wet cat foods have 0.0–0.5% fiber. The 80/100 score for ≤1.0% fiber may unfairly penalize species-appropriate feline diets. Consider forking the fiber curve for cats (≤3.0% = 100 for cats). Impact is small (~2 points on bucket, ~0.6 on final composite). See §11 Q6.

#### Carbohydrate Estimate Score (0–100)

```
Let carb_dmb = estimated NFE (see §2c)

--- Dogs ---
if carb_dmb <= 30%:       score = 100  (low carb — excellent)
if carb_dmb <= 40%:       score = 85   (moderate — typical for quality kibble)
if carb_dmb <= 50%:       score = 65   (high — common in budget kibble)
if carb_dmb <= 60%:       score = 40   (very high — predominantly starch-based)
if carb_dmb > 60%:        score = 20   (excessive)

--- Cats ---
if carb_dmb <= 15%:       score = 100  (excellent — close to natural prey ratio)
if carb_dmb <= 25%:       score = 80   (acceptable)
if carb_dmb <= 35%:       score = 55   (concerning for obligate carnivore)
if carb_dmb <= 45%:       score = 30   (poor — high carb diet for a cat)
if carb_dmb > 45%:        score = 10   (very poor)
```

**Cat carb scoring is deliberately stricter.** Cats lack hepatic glucokinase (hexokinase IV) and have limited amylase activity. High-carb diets are epidemiologically associated with feline type 2 diabetes (Hoenig et al., 2007, *Domestic Animal Endocrinology*; Slingerland et al., 2009, *The Veterinary Journal*).

**Note:** This carb score within the nutritional bucket is separate from the Layer 2 cat carb penalty (which fires based on ingredient positions, not GA values). They assess different things — one is mathematical composition, the other is ingredient list analysis. Both can apply.

---

## 5. Life Stage Modifiers Within the Bucket

These modifiers come in two types — **sub-score modifiers** (adjust individual nutrient scores before the weighted sum) and **bucket-level modifiers** (adjust the overall bucket score after the weighted sum). The distinction matters for the order of operations in §8.

### 5a. Puppy / Kitten Modifiers

| Condition | Effect | Type | Rationale |
|---|---|---|---|
| Protein DMB ≥ Growth min × 1.3 | +5 to protein sub-score (cap at 100) | Sub-score | Growing animals benefit from higher protein for tissue development |
| Fat DMB ≥ Growth min × 1.5 | +3 to fat sub-score (cap at 100) | Sub-score | Energy-dense diets support rapid growth |
| Product labeled "Adult" or "Maintenance" | −15 from overall bucket score | Bucket-level | Adult food doesn't meet growth nutritional demands; may be calcium/phosphorus inadequate |
| Ca:P ratio outside 1.1:1 to 2:1 | −10 from overall bucket score | Bucket-level | Critical for skeletal development; source: AAFCO, NRC (2006) |

### 5b. Senior Dog Modifiers

| Condition | Effect | Type | Rationale |
|---|---|---|---|
| Protein DMB ≥ 25% | +5 to protein sub-score (cap at 100) | Sub-score | Senior dogs need higher protein to counteract sarcopenia; Laflamme (2005) |
| Phosphorus DMB > 1.4% | −8 from overall bucket score | Bucket-level | Elevated phosphorus accelerates CKD progression; IRIS staging guidelines |
| Contains glucosamine or omega-3 (detected in ingredients) | +3 to overall bucket score | Bucket-level | Joint support; not a nutritional bucket concern per se, but clinically meaningful for seniors |

### 5c. Senior / Geriatric Cat Modifiers

| Condition | Effect | Type | Rationale |
|---|---|---|---|
| Protein DMB ≥ 30% | +5 to protein sub-score (cap at 100) | Sub-score | Geriatric cats need ≥ 30% DMB protein to prevent muscle wasting; NRC (2006) |
| Protein DMB < 30% (life_stage is `senior` or `geriatric` AND `petConditions` does NOT include `'ckd'`) | −10 from protein sub-score | Sub-score | Inadequate protein for geriatric obligate carnivore; **suppressed for CKD cats** where protein moderation (26–28% DMB) is the gold-standard veterinary treatment (IRIS guidelines). Without this gate, the engine penalizes cats for following their vet's dietary prescription. |
| Phosphorus DMB > 1.2% (life_stage is `senior` or `geriatric`) | −8 from overall bucket score | Bucket-level | Kidney disease is leading cause of death in senior cats; IRIS guidelines |
| Product labeled "Kitten" fed to senior cat | −5 from overall bucket score | Bucket-level | Kitten food has excessive calories/minerals for seniors (though protein is adequate) |

**⚠️ Vet audit flag:** Feline specialists sometimes recommend kitten food for underweight geriatric cats (15+) because it is highly palatable, calorie-dense, and protein-dense. Consider gating the −5 kitten food penalty: suppress if `petConditions` includes `'underweight'` OR `lifeStage === 'geriatric'`. Impact is small (−5 on bucket = −1.5 on final composite). See §11 Q7.

### 5d. Large Breed Puppy Modifiers (Dogs Only)

| Condition | Effect | Type | Rationale |
|---|---|---|---|
| Calcium DMB > 1.8% | −12 from overall bucket score | Bucket-level | Excess calcium in large breed puppies causes developmental orthopedic disease (DOD); Hazewinkel et al. |
| Calcium DMB < 0.8% | −8 from overall bucket score | Bucket-level | Insufficient calcium for large breed skeletal growth |
| Ca:P ratio outside 1.1:1 to 1.4:1 | −10 from overall bucket score | Bucket-level | Narrower safe range for large breeds; VCA Hospitals, NRC (2006) |
| Product NOT labeled "large breed puppy" or equivalent | Advisory note only (no score modifier) | N/A | Advisory: Large breed puppies have narrower safe ranges for calcium; verify this formula meets large-breed growth requirements. |

**Sources:** VCA Animal Hospitals — "Nutritional Requirements of Large and Giant Breed Puppies"; Laflamme (2001), *Compendium on Continuing Education* — "Effect of breed size on calcium requirements for puppies"; Nap et al. (1993), *Journal of Nutrition* — "45Ca kinetics in growing miniature poodles"

---

## 6. Breed-Specific Nutritional Modifiers

These are **small** adjustments (±3 to ±5 points within the bucket) that make the score feel personalized without overstating breed-specific evidence. Every modifier must be citation-backed and vet-auditable.

### 6a. Dog Breeds

**Full reference:** `BREED_MODIFIERS_DOGS.md`

23 breeds/breed groups across three tiers:

- **Tier 1 — GA-Actionable** (8 entries): Miniature Schnauzer, Cocker Spaniel, Soft-Coated Wheaten Terrier, German Shepherd, Labrador Retriever, Brachycephalic Group, Yorkshire Terrier (puppy-only), Giant Breeds (calcium, puppy-only; GDV, all ages)
- **Tier 2 — Ingredient-List-Actionable** (6 entries): Golden Retriever, Newfoundland, Doberman Pinscher, Boxer, Irish Setter, Border Terrier — plus Dalmatian (hybrid: ingredient + GA)
- **Tier 3 — Advisory Only / Not Actionable From Label** (4 entries): Bedlington Terrier, West Highland White Terrier, Siberian Husky/Alaskan Malamute, Shetland Sheepdog

Each entry includes: trigger conditions, modifier points, modifier target, life stage applicability, evidence strength, mechanism summary, citations, UI callout text, and vet audit status. See the full file for implementation details.

### 6b. Cat Breeds

**Full reference:** `BREED_MODIFIERS_CATS.md`

21 breeds across three tiers, plus three global findings:

- **Global findings:** (1) Taurine does NOT modify genetic HCM — applies to all HCM breeds, (2) Fat — not carbohydrate — is the primary feline obesity driver, (3) Phosphorus source matters as much as amount (inorganic salts ~2× bioavailability)
- **Tier 1 — GA-Actionable with score modifiers** (3 groups): Burmese (carb −3/−5), Persian/Exotic Shorthair (phosphorus −2 + ingredient −1), British Shorthair (fat −2, carb −1)
- **Tier 2 — Soft Modifiers** (3 entries): Abyssinian/Somali (phosphorus −1), Tonkinese (carb −2), Sphynx (fat +1 bonus)
- **Tier 3 — Advisory Only / No Modifier** (11 entries): Maine Coon, Ragdoll, Bengal, Siamese, Oriental Shorthair, Scottish Fold, Birman, Norwegian Forest Cat, Russian Blue, Cornish Rex, Devon Rex — all explicitly documented as having NO food-composition-based dietary modifier to prevent the engine from inventing penalties

Only three breed groups (Burmese, Persian/Exotic, British Shorthair) have sufficient evidence for meaningful GA-based scoring adjustments. The cat breed file is intentionally smaller than the dog file — this reflects the state of the science, not incomplete research.

### 6c. Implementation Notes

- Breed modifiers are **cumulative** but **capped at ±10 total** within the bucket to prevent breed alone from dominating the score
- If breed is "Unknown / Other" or "Mixed Breed," no breed modifiers apply — only life stage and species rules
- Every breed modifier entry must include `citation_source` and `vet_audit_status`
- Breed modifiers surface as a named callout in the UI: `"Adjusted for [breed_name]: [reason]"` — this is the personalization users feel

---

## 7. Missing GA Data Fallback

When guaranteed analysis data is partially or fully missing, the scoring engine must handle it gracefully.

### 7a. Fully Missing GA

If `protein_pct`, `fat_pct`, `fiber_pct`, and `moisture_pct` are all null:

- **Skip the entire 30% Nutritional Profile bucket**
- Reweight to: **~78% Ingredient Quality / ~22% Formulation Completeness** (normalized from 55/15)
- Show `"Partial Score"` badge in UI
- Show explanatory note: `"Nutritional data unavailable for this product — score is based on ingredients and formulation only."`

### 7b. Partially Missing GA

If some GA fields are present but others null:

| Missing Field | Handling |
|---|---|
| `protein_pct` null | Score protein sub-nutrient at 50 (neutral); flag `"Protein data unavailable"` |
| `fat_pct` null | Score fat sub-nutrient at 50 (neutral); flag `"Fat data unavailable"` |
| `fiber_pct` null | Assume 3% (typical); flag `"Fiber data estimated"` |
| `moisture_pct` null | Assume 10% for dry, 78% for wet (based on `product_form`); flag |

### 7c. LLM-Extracted Data Disclaimer

If `nutritional_data_source = 'llm_extracted'`, always display:

> "Nutritional data extracted from label — verify with manufacturer for precision use."

This is **non-negotiable.** LLM-extracted GA data is useful but not authoritative.

---

## 8. Composite Calculation — Putting It All Together

### Step-by-step for daily food:

```
1.  Convert all GA values to DMB (§1)
    — Including ash defaults: convert as-fed ash to DMB before NFE calculation (§2c)

2.  Determine life_stage from pet profile (§3)

3.  Select AAFCO thresholds for species + life_stage (§2)

4.  Score each sub-nutrient against base curves (§4b)

5.  Apply SUB-SCORE modifiers from §5 and §6:
    These target individual sub-nutrient scores BEFORE the weighted sum:
    — "+5 to protein sub-score" (§5a puppy protein bonus)
    — "+3 to fat sub-score" (§5a puppy fat bonus)
    — "+5 to protein sub-score" (§5b senior dog protein ≥25%)
    — "+5 to protein sub-score" (§5c senior cat protein ≥30%)
    — "−10 from protein sub-score" (§5c geriatric cat low protein, CKD-gated)
    — Breed-specific sub-score modifiers from §6

6.  Clamp all sub-scores to [0, 100]

7.  Compute weighted sum:

    bucket_score = (protein_score × protein_weight)
                 + (fat_score × fat_weight)
                 + (fiber_score × fiber_weight)
                 + (carb_score × carb_weight)

    (weights from §4a, species-specific)

8.  Apply BUCKET-LEVEL modifiers from §5 and §6:
    These target the overall bucket score AFTER the weighted sum:
    — "−15 from overall bucket" (§5a adult food for puppy/kitten)
    — "−10 from overall bucket" (§5a Ca:P ratio for puppy)
    — "−8 from overall bucket" (§5b senior dog phosphorus >1.4%)
    — "+3 to overall bucket" (§5b senior dog glucosamine/omega-3)
    — "−8 from overall bucket" (§5c senior cat phosphorus >1.2%)
    — "−5 from overall bucket" (§5c kitten food for senior cat)
    — "−12 from overall bucket" (§5d large breed puppy Ca excess)
    — "−8 from overall bucket" (§5d large breed puppy Ca deficiency)
    — "−10 from overall bucket" (§5d large breed puppy Ca:P ratio)
    — Breed-specific bucket modifiers from §6 (capped ±10 total)

9.  Clamp bucket_score to [0, 100]

10. This bucket_score is weighted at 30% in the final composite
```

**Why the order matters:** Sub-score modifiers (step 5) shift individual nutrients before weighting — a +5 to protein at 45% weight has different impact than +5 at 35% weight. Bucket-level modifiers (step 8) adjust the composite after weighting — these represent whole-formula concerns (wrong life stage, mineral imbalances) rather than individual nutrient adjustments. Mixing them produces incorrect results.

### Worked Example: Adult Cat, Domestic Shorthair, No Breed Modifiers

**Product GA (as-fed):** Protein 10%, Fat 5%, Fiber 1%, Moisture 78%

**Step 1 — DMB conversion:**
```
Protein DMB: 10 / (100 − 78) × 100 = 45.45%
Fat DMB:      5 / (100 − 78) × 100 = 22.73%
Fiber DMB:    1 / (100 − 78) × 100 =  4.55%
Ash:          No Ca/P available → wet food default: 2.0% AF
              Ash DMB: 2.0 / (100 − 78) × 100 = 9.09%
Carb est:     Math.max(0, 100 − (45.45 + 22.73 + 4.55 + 9.09)) = 18.18%
```

**Step 2 — Life stage:** Adult cat → AAFCO Adult Maintenance

**Step 3 — AAFCO thresholds:** Protein min 26%, Fat min 9%

**Step 4 — Sub-nutrient scores (trapezoidal curves):**

```
Protein: 45.45% DMB, min = 26%
  min × 0.8 = 20.8%
  ideal_low  = 26 × 1.15 = 29.9%
  ideal_high = 26 × 2.0  = 52.0%
  excess     = 26 × 2.5  = 65.0%

  45.45 is in [ideal_low, ideal_high) → linear interpolation 70 → 100
  score = 70 + ((45.45 − 29.9) / (52.0 − 29.9)) × 30
        = 70 + (15.55 / 22.1) × 30
        = 70 + 21.1
        = 91

Fat: 22.73% DMB, min = 9% (cat)
  min × 0.8  = 7.2%
  ideal_low  = 12.0%    (cat-specific)
  ideal_high = 20.0%    (cat-specific)
  excess     = 25.0%    (cat-specific)

  22.73 is in [ideal_high, excess) → score = 100 (plateau)

Fiber: 4.55% DMB → step curve: ≤5.0% → score = 90

Carbs: 18.18% DMB → cat curve: ≤25% → score = 80
```

**Step 5 — Sub-score modifiers:** Adult cat, no modifiers fire

**Step 6 — Clamp:** All sub-scores already in [0, 100]

**Step 7 — Weighted sum (cat weights: 45/20/10/25):**
```
= (91 × 0.45) + (100 × 0.20) + (90 × 0.10) + (80 × 0.25)
= 40.95 + 20.0 + 9.0 + 20.0
= 89.95
= 90 (rounded)
```

**Step 8 — Bucket-level modifiers:** None fire

**Step 9 — Clamp:** 90 is in [0, 100]

**Bucket score: 90/100** — this contributes 90 × 0.30 = 27.0 points to the final composite.

**Note on score change from previous version:** The original worked example produced 93/100. The difference is due to three corrections: (1) ash is now correctly converted to DMB (9.09% instead of using 7.0% raw), reducing carb estimate from 20.3% to 18.18%; (2) sub-nutrient scores now use exact trapezoidal curve math instead of hand-waved approximations — the protein score dropped from "≈ 100" to 91 because 45.45% DMB is still climbing in the ideal range (29.9–52.0%), not yet at the plateau; (3) the fat curve is now decoupled by species — with cat-specific thresholds, 22.73% DMB falls in the plateau (20.0–25.0%) scoring 100, whereas the old unified curve had it still climbing in the [10.8, 27.0) range scoring 92. These are corrections to the scoring rules and example math, not cosmetic changes.

---

## 9. Relationship to Other Scoring Layers

| Concern | Where It Lives | NOT Here |
|---|---|---|
| Ingredient-list carb positions (#1-3) | Layer 2 — Cat carb penalty (×0.85) | ✓ Separate from this bucket |
| Taurine presence/absence | Layer 2 — Cat taurine check (×0.90) | ✓ Separate (checks ingredient list, not GA) |
| Moisture bonus for wet cat food | Layer 2 — Cat moisture bonus (×1.05) | ✓ Separate |
| Mercury/Vitamin A advisories | Frequency-sensitive advisories (no score impact) | ✓ Separate |
| GA-based protein/fat/fiber/carb scoring | **§4 of this spec** | — |
| Breed DCM risk (dogs) | **§6a of this spec** (within bucket) AND Layer 2 DCM advisory | Both can apply |
| AAFCO compliance statement | Penalty Modifier — ×0.80 (applied after all layers) | ✓ Separate |

**No double-counting:** The cat carb penalty in Layer 2 and the carb sub-score in this bucket assess different things. Layer 2 checks whether carb-category *ingredients* dominate positions 1-3 (an ingredient list concern). This bucket checks the *mathematical carbohydrate percentage* of the total formula. A product could have corn at position #4 (no Layer 2 penalty) but still have 45% carb DMB (this bucket penalizes). Both are valid, independent signals.

---

## 10. Test Requirements

Each of these must be independently verifiable in `nutritionalBucket.test.ts`:

- [ ] DMB conversion produces correct values for dry, wet, and semi-moist
- [ ] Ash defaults are converted from as-fed to DMB before NFE calculation
- [ ] Each sub-nutrient scoring curve hits expected values at threshold boundaries
- [ ] Cat and dog weights sum to 100% within the bucket
- [ ] Life stage correctly selects Growth vs Maintenance thresholds
- [ ] Senior cat modifier fires for protein < 30% DMB when life_stage is `senior` or `geriatric` (without CKD)
- [ ] Senior cat modifier does NOT fire for protein < 30% DMB when pet has CKD condition
- [ ] Large breed puppy calcium modifier fires for Ca DMB > 1.8%
- [ ] Breed modifiers are capped at ±10 total
- [ ] Missing GA fallback reweights to 78/22 and shows Partial badge
- [ ] Partially missing GA uses neutral scores with flags
- [ ] Deterministic: same inputs → same output, every time
- [ ] Weight management formula exception reduces fiber penalty by 50%
- [ ] Obesity pet condition reduces fiber penalty by 50% (D-106)
- [ ] Geriatric cat protein boost fires correctly when life_stage is `geriatric`
- [ ] Sub-score modifiers apply before weighted sum, bucket-level modifiers apply after
- [ ] Worked example produces bucket score of 90/100 for adult cat wet food
- [ ] Fat curve uses species-specific thresholds (dog vs cat decoupled)

---

## 11. Open Questions for Vet Auditor

1. **Senior protein thresholds:** Is ≥ 25% DMB the right threshold for senior dogs, and ≥ 30% DMB for senior/geriatric cats? Current veterinary literature supports these but they aren't AAFCO-mandated.

2. **Breed modifier magnitudes:** Are ±3 to ±5 point adjustments appropriate, or should some breed risks warrant larger modifiers (e.g., Dalmatian purine concern)?

3. **Carb curve strictness for cats:** The cat carb curve penalizes heavily above 35% DMB. Is this too aggressive for cats eating standard commercial dry food (which typically runs 35-50% carbs)?

4. **Fat curve thresholds for cats (now decoupled — validate numbers):** The fat curve is now fully decoupled by species. Cat-specific thresholds: ideal_low = 12.0%, ideal_high = 20.0%, excess = 25.0% (vs dog: ideal_low = min×1.25, ideal_high = 18.0%, excess = 25.0%). Are 20% and 25% DMB the right ideal_high and excess boundaries for adult cats? The original spec note flagged >22% as concerning — the current excess at 25% gives a narrow plateau (20–25%) before the 60-score penalty. Should excess be tightened to 22%? Should growth cats have a higher ideal_high (e.g., 22%) to account for energy demands?

5. **Therapeutic (Rx) diet handling:** Prescription diets (renal, gastrointestinal, hepatic) intentionally violate AAFCO healthy-pet baselines to manage disease. These will score catastrophically in the nutritional bucket. The engine needs a bypass mechanism — but brand-string detection (scanning for "k/d," "Prescription Diet," etc.) violates D-019 (brand-blind). Proposed solution: `is_therapeutic BOOLEAN` flag on the products table, set during data curation by human reviewers. When true, skip the 30% nutritional bucket and render: "Therapeutic Diet — Nutritional profile intentionally modified for medical management. Not scored against standard baselines. Consult your veterinarian." Does this approach adequately protect both the user and Kiba's credibility?

6. **Cat fiber curve:** Should cats score 100/100 (not 80/100) for fiber ≤1.0% DMB? Obligate carnivores consuming high-quality, species-appropriate wet food often have near-zero fiber. The current curve penalizes this. Impact is small (~2 points on bucket, ~0.6 on final composite).

7. **Kitten food for geriatric cats:** Should the −5 "kitten food for senior cat" penalty be suppressed when the cat has the `'underweight'` condition or is `'geriatric'` (15+)? Feline specialists sometimes recommend kitten food for underweight geriatric cats for its caloric density and palatability. Impact is small (−5 on bucket = −1.5 on final composite).

---

## 12. Citation Index

| Ref | Source |
|---|---|
| AAFCO-2023 | AAFCO Official Publication (2023), Dog and Cat Food Nutrient Profiles |
| NRC-2006 | National Research Council, Nutrient Requirements of Dogs and Cats (2006) |
| Merck-Vet | Merck Veterinary Manual — Nutritional Requirements of Small Animals |
| Laflamme-2005 | Laflamme DP. Nutrition for aging cats and dogs. *JAVMA* 226(3):332-339, 2005 |
| Hoenig-2007 | Hoenig M et al. A feline model of experimentally induced islet amyloidosis. *Domestic Animal Endocrinology* 32(1):1-13, 2007 |
| Slingerland-2009 | Slingerland LI et al. Indoor confinement and physical inactivity rather than the proportion of dry food are risk factors in the development of feline type 2 diabetes. *The Veterinary Journal* 179(2):247-253, 2009 |
| FDA-2018 | FDA Investigation into Potential Link between Certain Diets and DCM (2018-2019) |
| Kaplan-2018 | Kaplan JL et al. Taurine deficiency and dilated cardiomyopathy in golden retrievers. *PLOS ONE* 13(12), 2018 |
| Bannasch-2008 | Bannasch DL et al. Mutations in the SLC2A9 gene cause hyperuricosuria and hyperuricemia in the dog. *PLoS Genetics* 4(11), 2008 |
| Xenoulis-2010 | Xenoulis PG, Steiner JM. Lipid metabolism and hyperlipidemia in dogs. *The Veterinary Journal* 183(1):12-21, 2010 |
| Glickman-2000 | Glickman LT et al. Non-dietary risk factors for gastric dilatation-volvulus in large and giant breed dogs. *JAVMA* 217(10):1492-1499, 2000 |
| German-2006 | German AJ. The growing problem of obesity in dogs and cats. *Journal of Nutrition* 136(7):1940S-1946S, 2006 |
| Hazewinkel | Hazewinkel HA et al. Influences of chronic calcium excess on the skeletal development of growing Great Danes. *JAAHA* 21:377-391, 1985 |
| VCA-LBP | VCA Animal Hospitals — Nutritional Requirements of Large and Giant Breed Puppies |
| IRIS | International Renal Interest Society — Staging of CKD |
