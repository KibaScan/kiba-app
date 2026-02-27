# Kiba — Nutritional Profile Bucket Spec (30% Weight)

> **Status:** DRAFT — Requires vet auditor review before production use  
> **Applies to:** Daily food only. Treats = 100% Ingredient Quality (this bucket is 0%). Supplements = deferred to M16+ (D-096, not scored at launch).  
> **Prerequisite:** DMB conversion MUST run before this bucket. See §1.

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

If ash is unavailable, estimate by product category:

| Category | Default Ash (DMB) | Basis |
|---|---|---|
| Dry food (moisture ≤12%) | 7.0% | Industry average 5–8% |
| Wet food (moisture >12%) | 2.0% | Industry average 1.5–2.5% |
| Treats | 5.0% | High variability |

If calcium AND phosphorus are both available, tighten the estimate: `ash ≈ (calcium% + phosphorus%) × 2.5`.

```
estimated_carbs = Math.max(0, 100 - (protein_dmb + fat_dmb + fiber_dmb + ash_estimate))
```

**Floor note:** `Math.max(0)` required because GA legally uses minimums for protein/fat and maximums for fiber/moisture. Actual values in the bag are almost always higher than label minimums, so this formula yields maximum possible carbs — which can go negative for ultra-high-protein wet foods without the floor.

**Important:** This is an estimate. Ash values vary. Display with confidence badge (Exact/Estimated/Unknown) and species-specific qualitative labels (D-104). The qualitative labels are display-only and do NOT feed back into the scoring engine — the carb curves in §4b handle all scoring math.

---

## 3. Life Stage Mapping

Life stages drive which AAFCO thresholds apply. These are derived from the pet profile — **never user-entered.**

### 3a. Dogs

| Life Stage | Age Rule | AAFCO Profile | Notes |
|---|---|---|---|
| `puppy` | < 1yr (small/medium) or < 2yr (large/giant) | Growth & Reproduction | Higher protein, fat, Ca, P requirements |
| `junior` | 1-2yr (small/medium) or 2-3yr (large/giant) | Adult Maintenance | Transitional — still benefits from slightly higher protein |
| `adult` | 2-7yr (small/medium) or 3-5yr (large/giant) | Adult Maintenance | Standard |
| `senior` | 7+yr (small/medium) or 5+yr (large/giant) | Adult Maintenance | Increased protein need for sarcopenia prevention; lower phosphorus preferred for kidney health |

**Breed size classification:**
- Small: adult weight < 20 lbs
- Medium: 20-50 lbs
- Large: 50-90 lbs
- Giant: 90+ lbs

### 3b. Cats

| Life Stage | Age Rule | AAFCO Profile | Notes |
|---|---|---|---|
| `kitten` | < 1yr | Growth & Reproduction | Highest protein requirements; sensitive to protein quality |
| `junior` | 1-2yr | Adult Maintenance | Transitional |
| `adult` | 2-6yr | Adult Maintenance | Standard |
| `mature` | 7-11yr | Adult Maintenance | Standard multipliers; monitor weight |
| `senior` | 12-14yr | Adult Maintenance | **Needs MORE protein (≥ 30% DMB recommended) and MORE calories — sarcopenia risk** |
| `geriatric` | 15+yr | Adult Maintenance | **Do NOT reduce calories linearly.** Geriatric cats often need 1.4-1.6× RER. Protein ≥ 30% DMB |

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

Same trapezoidal curve shape as protein, with species-specific thresholds:

```
min = AAFCO minimum for species + life_stage
ideal_low = min × 1.2
ideal_high = min × 3.0     (fat has wider acceptable range)
excess = min × 4.5          (very high fat — obesity concern)

Scoring follows same linear interpolation pattern as protein.

if fat_dmb >= excess: score = 60  (high fat has real health risk — obesity, pancreatitis)
```

**Note:** Very high fat (>25% DMB for dogs, >22% DMB for cats in adult maintenance) carries a steeper penalty than very high protein, because excess dietary fat has stronger clinical links to pancreatitis and obesity.

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

**Exception:** Weight management formulas intentionally use higher fiber. If the product AAFCO statement includes "weight management" or "light," reduce the fiber penalty by 50% (multiply the delta from 100 by 0.5).

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

**Cat carb scoring is deliberately stricter.** Cats lack hepatic glucokinase (hexokinase IV) and have limited amylase activity. High-carb diets are epidemiologically associated with feline obesity and type 2 diabetes (Hoenig et al., 2007, *Domestic Animal Endocrinology*; Slingerland et al., 2009, *The Veterinary Journal*).

**Note:** This carb score within the nutritional bucket is separate from the Layer 2 cat carb penalty (which fires based on ingredient positions, not GA values). They assess different things — one is mathematical composition, the other is ingredient list analysis. Both can apply.

---

## 5. Life Stage Modifiers Within the Bucket

These adjust the sub-nutrient scores after the base calculation, based on the pet's derived `life_stage`.

### 5a. Puppy / Kitten Modifiers

| Condition | Effect | Rationale |
|---|---|---|
| Protein DMB ≥ Growth min × 1.3 | +5 to protein sub-score (cap at 100) | Growing animals benefit from higher protein for tissue development |
| Fat DMB ≥ Growth min × 1.5 | +3 to fat sub-score (cap at 100) | Energy-dense diets support rapid growth |
| Product labeled "Adult" or "Maintenance" | −15 from overall bucket score | Adult food doesn't meet growth nutritional demands; may be calcium/phosphorus inadequate |
| Ca:P ratio outside 1.1:1 to 2:1 | −10 from overall bucket score | Critical for skeletal development; source: AAFCO, NRC (2006) |

### 5b. Senior Dog Modifiers

| Condition | Effect | Rationale |
|---|---|---|
| Protein DMB ≥ 25% | +5 to protein sub-score (cap at 100) | Senior dogs need higher protein to counteract sarcopenia; Laflamme (2005) |
| Phosphorus DMB > 1.4% | −8 from overall bucket score | Elevated phosphorus accelerates CKD progression; IRIS staging guidelines |
| Contains glucosamine or omega-3 (detected in ingredients) | +3 to overall bucket score | Joint support; not a nutritional bucket concern per se, but clinically meaningful for seniors |

### 5c. Senior / Geriatric Cat Modifiers

| Condition | Effect | Rationale |
|---|---|---|
| Protein DMB ≥ 30% | +5 to protein sub-score (cap at 100) | Geriatric cats need ≥ 30% DMB protein to prevent muscle wasting; NRC (2006) |
| Protein DMB < 30% (cat aged 12+) | −10 from protein sub-score | Inadequate protein for geriatric obligate carnivore |
| Phosphorus DMB > 1.2% (cat aged 12+) | −8 from overall bucket score | Kidney disease is leading cause of death in senior cats; IRIS guidelines |
| Product labeled "Kitten" fed to senior cat | −5 from overall bucket score | Kitten food has excessive calories/minerals for seniors (though protein is adequate) |

### 5d. Large Breed Puppy Modifiers (Dogs Only)

| Condition | Effect | Rationale |
|---|---|---|
| Calcium DMB > 1.8% | −12 from overall bucket score | Excess calcium in large breed puppies causes developmental orthopedic disease (DOD); Hazewinkel et al. |
| Calcium DMB < 0.8% | −8 from overall bucket score | Insufficient calcium for large breed skeletal growth |
| Ca:P ratio outside 1.1:1 to 1.4:1 | −10 from overall bucket score | Narrower safe range for large breeds; VCA Hospitals, NRC (2006) |
| Product NOT labeled "large breed puppy" or equivalent | Advisory note only (no score modifier) | Recommend large-breed-specific formula; some non-LB foods still meet requirements |

**Sources:** VCA Animal Hospitals — "Nutritional Requirements of Large and Giant Breed Puppies"; Laflamme (2001), *Compendium on Continuing Education* — "Effect of breed size on calcium requirements for puppies"; Nap et al. (1993), *Journal of Nutrition* — "45Ca kinetics in growing miniature poodles"

---

## 6. Breed-Specific Nutritional Modifiers

These are **small** adjustments (±3 to ±5 points within the bucket) that make the score feel personalized without overstating breed-specific evidence. Every modifier must be citation-backed and vet-auditable.

### 6a. Dog Breeds

**Full reference:** `BREED_MODIFIERS_DOGS.md`

20 breeds/breed groups across three tiers:

- **Tier 1 — GA-Actionable** (8 entries): Miniature Schnauzer, Cocker Spaniel, Soft-Coated Wheaten Terrier, German Shepherd, Labrador Retriever, Brachycephalic Group, Yorkshire Terrier (puppy-only), Giant Breeds (calcium, puppy-only; GDV, all ages)
- **Tier 2 — Ingredient-List-Actionable** (6 entries): Golden Retriever, Newfoundland, Doberman Pinscher, Boxer, Irish Setter, Border Terrier — plus Dalmatian (hybrid: ingredient + GA)
- **Tier 3 — Advisory Only / Not Actionable From Label** (4 entries): Bedlington Terrier, West Highland White Terrier, Siberian Husky/Alaskan Malamute, Shetland Sheepdog

Each entry includes: trigger conditions, modifier points, modifier target, life stage applicability, evidence strength, mechanism summary, citations, UI callout text, and vet audit status. See the full file for implementation details.

### 6b. Cat Breeds

**Full reference:** `BREED_MODIFIERS_CATS.md`

18 breeds across three tiers, plus three global findings:

- **Global findings:** (1) Taurine does NOT modify genetic HCM — applies to all HCM breeds, (2) Fat — not carbohydrate — is the primary feline obesity driver, (3) Phosphorus source matters as much as amount (inorganic salts ~2× bioavailability)
- **Tier 1 — GA-Actionable with score modifiers** (3 groups): Burmese (carb −3/−5), Persian/Exotic Shorthair (phosphorus −2 + ingredient −1), British Shorthair (fat −2, carb −1)
- **Tier 2 — Soft Modifiers** (3 entries): Abyssinian/Somali (phosphorus −1), Tonkinese (carb −2), Sphynx (fat +1 bonus)
- **Tier 3 — Advisory Only / No Modifier** (11 entries): Maine Coon, Ragdoll, Bengal, Siamese, Oriental Shorthair, Scottish Fold, Birman, Norwegian Forest Cat, Russian Blue, Cornish Rex, Devon Rex — all explicitly documented as having NO food-composition-based dietary modifier to prevent the engine from inventing penalties

Only three breed groups (Burmese, Persian/Exotic, British Shorthair) have sufficient evidence for meaningful GA-based scoring adjustments. The cat breed file is intentionally smaller than the dog file — this reflects the state of the science, not incomplete research.

### 6c. Implementation Notes

- Breed modifiers are **cumulative** but **capped at ±10 total** within the bucket to prevent breed alone from dominating the score
- If breed is "Unknown" or "Mixed," no breed modifiers apply — only life stage and species rules
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
1. Convert all GA values to DMB (§1)
2. Determine life_stage from pet profile (§3)
3. Select AAFCO thresholds for species + life_stage (§2)
4. Score each sub-nutrient against thresholds (§4b)
5. Apply life stage modifiers (§5)
6. Apply breed-specific modifiers if breed is known (§6)
7. Clamp all sub-scores to [0, 100]
8. Compute weighted sum:

   bucket_score = (protein_score × protein_weight)
                + (fat_score × fat_weight)
                + (fiber_score × fiber_weight)
                + (carb_score × carb_weight)

   (weights from §4a, species-specific)

9. Apply life stage and breed modifiers to bucket_score
10. Clamp bucket_score to [0, 100]
11. This bucket_score is weighted at 30% in the final composite
```

### Worked Example: Adult Cat, Domestic Shorthair, No Breed Modifiers

**Product GA (as-fed):** Protein 10%, Fat 5%, Fiber 1%, Moisture 78%

**Step 1 — DMB conversion:**
- Protein DMB: 10 / (100-78) × 100 = 45.5%
- Fat DMB: 5 / 22 × 100 = 22.7%
- Fiber DMB: 1 / 22 × 100 = 4.5%
- Carb est: 100 - (45.5 + 22.7 + 4.5 + 7) = 20.3%

**Step 2 — Life stage:** Adult cat → AAFCO Adult Maintenance

**Step 3 — AAFCO thresholds:** Protein min 26%, Fat min 9%

**Step 4 — Sub-nutrient scores:**
- Protein: 45.5% DMB vs 26% min → well above ideal range → score ≈ 100
- Fat: 22.7% DMB vs 9% min → well above, but not excessive → score ≈ 95
- Fiber: 4.5% DMB → within acceptable range → score = 90
- Carbs: 20.3% DMB → cat curve, ≤ 25% → score = 80

**Step 5 — Life stage:** Adult, no modifiers fire

**Step 6 — Breed:** Domestic Shorthair, no breed modifiers

**Step 8 — Weighted sum (cat weights):**
```
= (100 × 0.45) + (95 × 0.20) + (90 × 0.10) + (80 × 0.25)
= 45 + 19 + 9 + 20
= 93
```

**Bucket score: 93/100** — this contributes 93 × 0.30 = 27.9 points to the final composite.

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
- [ ] Each sub-nutrient scoring curve hits expected values at threshold boundaries
- [ ] Cat and dog weights sum to 100% within the bucket
- [ ] Life stage correctly selects Growth vs Maintenance thresholds
- [ ] Senior cat modifier fires for protein < 30% DMB in cats aged 12+
- [ ] Large breed puppy calcium modifier fires for Ca DMB > 1.8%
- [ ] Breed modifiers are capped at ±10 total
- [ ] Missing GA fallback reweights to 78/22 and shows Partial badge
- [ ] Partially missing GA uses neutral scores with flags
- [ ] Deterministic: same inputs → same output, every time
- [ ] Weight management formula exception reduces fiber penalty by 50%
- [ ] Geriatric cat protein boost fires correctly at age 15+

---

## 11. Open Questions for Vet Auditor

1. **Senior protein thresholds:** Is ≥ 25% DMB the right threshold for senior dogs, and ≥ 30% DMB for senior/geriatric cats? Current veterinary literature supports these but they aren't AAFCO-mandated.

2. **Breed modifier magnitudes:** Are ±3 to ±5 point adjustments appropriate, or should some breed risks warrant larger modifiers (e.g., Dalmatian purine concern)?

3. **Carb curve strictness for cats:** The cat carb curve penalizes heavily above 35% DMB. Is this too aggressive for cats eating standard commercial dry food (which typically runs 35-50% carbs)?

4. **Fat excess threshold:** At what DMB% does fat become a pancreatitis concern worth penalizing? Currently set at AAFCO min × 4.5 for dogs and species-specific thresholds for breeds.

5. **Fiber exception for Rx diets:** Should we detect "veterinary" or "prescription" in the product name and suppress fiber penalties entirely? These products have intentional nutritional profiles.

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
