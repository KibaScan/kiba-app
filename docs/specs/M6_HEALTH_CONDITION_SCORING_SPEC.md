# M6 Spec: Health Condition Scoring Influence

> Maps clinical veterinary nutritionist guidance to the scoring engine (Layer 3), UI advisories, and Safe Swap filtering. Each condition has macro-level score adjustments, ingredient-level flags, feeding advisories, and alternative filtering rules.
>
> Source: Clinical veterinary nutritionist consultation (12 conditions, species-specific)
> Reference: D-094 (suitability framing), D-095 (UPVM compliance), D-129 (allergen override pattern)
>
> Status: DRAFT — needs vet audit before any score-affecting rules go live

---

## Design Principle: D-129 Pattern

This follows the same architecture as allergen scoring (D-129):
- Adjustments are **runtime-only** — computed per-pet, never written to `ingredients_dict` or `products`
- The scoring engine stays condition-blind at Layer 1 and Layer 2 — conditions only affect **Layer 3 personalization**
- All adjustments are **deterministic** (same inputs → same score)
- Every adjustment has a `citation_source`
- Framing is always suitability: "72% match for Buster" — never "this food is bad for pancreatitis"

---

## Overview: Three Types of Influence

| Type | What It Does | Example |
|---|---|---|
| **Score Adjustment** | ±points on NP sub-score or IQ based on macro/ingredient fit for the condition | Pancreatitis dog + 22% fat food → −5 on NP |
| **UI Advisory** | Contextual note on ResultScreen, non-score-affecting | "Buster has a sensitive stomach. Consider 3-4 smaller meals per day." |
| **Safe Swap Filter** | Additional filter on alternatives query | Pancreatitis dog → Safe Swaps exclude products with >12% fat DMB |

---

## Per-Condition Rules

### 1. Joint Issues (Osteoarthritis, Dysplasia)

**Species:** Both (dogs more common, cats underdiagnosed)

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Omega-3 bonus | EPA + DHA present in GA or ingredients (fish oil, fish meal in top 10) | +2 NP | AAHA 2021 Mobility Guidelines |
| High-calorie penalty | `ga_kcal_per_kg_dmb > 4200` (dry) | −2 NP | BCS 4-5/9 is most effective treatment for OA |
| Glucosamine/chondroitin bonus | Present in ingredients | +1 FC | Vandeweerd et al. 2012, JAVMA |

**UI Advisory:**
> "Keeping [Pet Name] lean is the single most effective way to manage joint health. This product provides [X] kcal/cup."

**Safe Swap Filter:** Prefer products with omega-3 sources in top 10 ingredients. Exclude calorie-dense products (>4200 kcal/kg DMB for dry).

**Feeding Advisory:** None specific (standard portions).

---

### 2. Sensitive Stomach (GI Issues, Intolerances)

**Species:** Both

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-fat penalty (dogs) | `ga_fat_dmb_pct > 18%` for dogs | −3 NP | Fat delays gastric emptying, triggers diarrhea |
| High-fiber bonus | Fiber present (psyllium, pumpkin, beet pulp in ingredients) | +1 IQ | Soluble fiber firms stool |
| Prebiotic bonus | Chicory root, inulin, FOS in ingredients | +1 IQ | Supports microbiome |
| Lactose penalty | Dried whey, milk, cream in top 10 | −2 IQ | Most adult dogs/cats lactose intolerant |

**UI Advisory:**
> "[Pet Name] has a sensitive stomach. Feeding 3-4 smaller meals per day can reduce digestive workload."

**Auto-Populate Feeding Stepper:** When condition = sensitive_stomach AND product is daily_food, default feedings_per_day to 3 (instead of standard 2). User can override.

**Safe Swap Filter:** Exclude products with fat DMB >18% (dogs). Prefer products with digestible proteins (fish, turkey, egg) in top 5.

---

### 3. Overweight / Obesity

**Species:** Both (cat hepatic lipidosis guard remains — D-062/D-160)

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-fiber bonus | `ga_fiber_dmb_pct > 5%` | +2 NP | Fiber promotes satiety without adding calories |
| High-fat penalty | `ga_fat_dmb_pct > 18%` | −3 NP | Calorie-dense foods counteract weight loss |
| High-calorie penalty | `ga_kcal_per_kg_dmb > 4200` (dry) or `> 1200` (wet) | −3 NP | Energy density works against caloric restriction |
| L-Carnitine bonus | L-Carnitine in ingredients | +1 FC | Helps metabolize fat into energy |
| Lean protein bonus | Protein DMB >30% AND fat DMB <14% | +2 NP | Preserves muscle during weight loss |

**UI Advisory:**
> "For weight management, calculate portions based on [Pet Name]'s ideal target weight, not current weight. Treats should be <10% of daily calories."

**Auto-Populate:** Weight goal slider defaults to −1 (gradual loss) when overweight condition added (user can adjust). Already handled by slider health condition constraints.

**Safe Swap Filter:** Exclude products with kcal/kg DMB >4000 (dry). Prefer high-fiber, lean-protein options.

---

### 4. Underweight (Malnutrition, Recovery)

**Species:** Both

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-calorie bonus | `ga_kcal_per_kg_dmb > 4000` (dry) or `> 1100` (wet) | +2 NP | Energy-dense foods help safe weight gain |
| High-protein bonus | `ga_protein_dmb_pct > 32%` | +2 NP | Supports lean mass rebuilding |
| High-fiber penalty | `ga_fiber_dmb_pct > 6%` | −2 NP | Fiber fills stomach before enough calories consumed |
| Weight management penalty | Product name contains "lite", "healthy weight", "weight management" | −3 IQ | Directly counterproductive |

**UI Advisory:**
> "[Pet Name] is underweight. Feed multiple small meals throughout the day. Warming wet food slightly can increase aroma and encourage eating."

**Auto-Populate Feeding Stepper:** Default to 3 feedings/day.

**Safe Swap Filter:** Exclude "lite" / "weight management" products. Prefer calorie-dense options.

---

### 5. Diabetes

**Species:** CRITICAL DOG/CAT SPLIT

#### Dogs with Diabetes:

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-fiber bonus | `ga_fiber_dmb_pct > 5%` | +3 NP | Fiber slows glucose absorption — key for canine diabetes |
| Complex carb bonus | Barley, sorghum, oats in top 10 (low glycemic) | +2 IQ | Slow-release carbohydrates |
| Simple sugar penalty | Corn syrup, molasses, fructose, dextrose, sucrose in ingredients | −4 IQ | Spikes blood glucose dangerously |
| Semi-moist penalty | `product_form = 'semi-moist'` | −3 IQ | Often contain sugars/propylene glycol as humectants |

**UI Advisory:**
> "Diabetic dogs need strict feeding consistency. Feed the exact same amount at the exact same times daily, timed with insulin injections."

**Auto-Populate Feeding Stepper:** Default to 2 feedings/day (12-hour intervals to match insulin).

#### Cats with Diabetes:

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Ultra-low carb bonus | Estimated carb DMB <10% | +4 NP | Can push diabetic cats into remission |
| Low carb bonus | Estimated carb DMB 10-20% | +2 NP | Supports glycemic control |
| High carb penalty | Estimated carb DMB >30% | −5 NP | Directly worsens feline diabetes |
| Wet food bonus | `product_form = 'wet'` | +2 FC | Wet food is naturally lower carb than kibble |
| Dry kibble penalty | `product_form = 'dry'` | −2 FC | Kibble requires starch to form, always higher carb |
| Simple sugar penalty | Corn syrup, molasses, dextrose in ingredients | −4 IQ | Same as dogs |
| Gravy penalty | Product name contains "gravy" or "in sauce" | −1 IQ | Gravy thickened with cornstarch/flour |

**UI Advisory:**
> "Diabetic cats can potentially achieve remission through strict low-carbohydrate diets. Discuss wet food options with your veterinarian."

**Carb Estimation (already in engine via D-149):**
```
carb_est = 100 - protein_dmb - fat_dmb - fiber_dmb - ash_est(7%)
```

**Safe Swap Filter (cats):** Only show products with estimated carb DMB <15%. Strongly prefer wet food.

---

### 6. Kidney Disease (CKD)

**Species:** Both (leading cause of death in senior cats)

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-phosphorus penalty | `ga_phosphorus_dmb_pct > 1.2%` (dogs) or `> 1.0%` (cats) | −4 NP | Phosphorus restriction is #1 dietary intervention for CKD |
| Moderate protein bonus | Protein DMB 20-28% (dogs) or 28-35% (cats) | +2 NP | Moderate high-quality protein, not excess |
| High-protein penalty | Protein DMB >35% (dogs) or >42% (cats) | −3 NP | Excess protein increases kidney workload |
| Wet food bonus (cats) | `product_form = 'wet'` AND species = cat | +3 FC | Hydration is critical for CKD cats |
| Omega-3 bonus | EPA/DHA present | +1 NP | Reduces kidney inflammation |
| High-sodium penalty | Product contains significant salt (position <10) | −2 IQ | Worsens hypertension in CKD |

**UI Advisory:**
> "[Pet Name] has kidney disease. Hydration is critical — wet food and added water are strongly beneficial. Discuss a veterinary renal diet with your vet."

**Safe Swap Filter:** Exclude products with phosphorus DMB >1.0% (cats) or >1.2% (dogs). Strongly prefer wet food for cats.

---

### 7. Urinary Issues (Stones, Crystals, FLUTD)

**Species:** Both (male cats at highest risk for fatal blockages)

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Wet food bonus | `product_form = 'wet'` | +3 FC | Dilute urine = fewer crystals |
| Dry-only penalty | `product_form = 'dry'` AND no wet food in pantry | −3 FC | Chronic dehydration concentrates urine |
| High-moisture bonus | `ga_moisture_pct > 75%` | +1 NP | Extra hydration |
| High-mineral penalty | High ash/mineral content (position-based proxy) | −2 NP | Contributes to crystal formation |

**UI Advisory (cats):**
> "Male cats with urinary issues are at risk of life-threatening blockages. A wet-food-heavy diet dilutes urine and reduces crystal formation. Stress reduction also helps — consider environmental enrichment."

**UI Advisory (dogs):**
> "Urinary health benefits from increased moisture intake. Adding water to kibble or feeding wet food can help dilute urine."

**Safe Swap Filter:** Strongly prefer wet food. Exclude high-mineral products.

---

### 8. Heart Disease (CHF, DCM, HCM)

**Species:** Both (different diseases — DCM in dogs, HCM in cats)

#### Dogs with Heart Disease:

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Taurine/L-Carnitine bonus | Both supplemented | +3 FC | Supports cardiac contractility — even more critical with existing heart disease |
| Pulse/legume penalty | DCM advisory already fires (D-137) | — | Already handled, stacks with heart disease condition |
| High-sodium penalty | Salt in top 10 ingredients | −3 IQ | Worsens fluid retention / congestive failure |
| Omega-3 bonus | Fish oil / EPA / DHA present | +1 NP | Anti-inflammatory, reduces cardiac remodeling |

*Note: Taurine/L-Carnitine bonus here is intentionally additive with D-137 mitigation. A heart disease dog eating a taurine+carnitine supplemented food deserves the full benefit on both axes.*

**UI Advisory:**
> "[Pet Name] has heart disease. Avoid high-sodium foods and treats (jerky, cheese, lunch meats). The FDA has investigated grain-free diets high in legumes in connection with canine DCM."

#### Cats with Heart Disease (HCM):

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Taurine missing — critical | Taurine NOT in ingredients AND not in GA | −5 FC | Taurine deficiency in a cat with heart disease accelerates cardiac failure |
| Moderate sodium penalty | Salt in top 10 ingredients | −2 IQ | Worsens blood pressure |
| Omega-3 bonus | Fish oil / EPA / DHA present | +2 NP | May reduce clotting risk |
| Wet food bonus | `product_form = 'wet'` | +1 FC | Prevents dehydration that thickens blood |

*Note: This −5 stacks with the existing Layer 2 taurine check (×0.90). Intentional — a healthy cat missing taurine is bad, a cat with HCM missing taurine is dangerous. Double penalty is correct.*

**UI Advisory:**
> "⚠ [Pet Name] has heart disease. Taurine is critical — deficiency accelerates cardiac failure in cats. This product [does/does not] contain taurine. Wet food is preferred to maintain hydration."

---

### 9. Pancreatitis

**Species:** CRITICAL DOG/CAT SPLIT

#### Dogs with Pancreatitis:

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-fat penalty | `ga_fat_dmb_pct > 12%` | −5 NP | Fat is THE trigger for canine pancreatitis |
| Ultra-high-fat critical | `ga_fat_dmb_pct > 18%` | −8 NP (stacks with above for −13 total) | A single high-fat meal can trigger a deadly flare |
| Lean protein bonus | High protein (>25% DMB) with low fat (<10% DMB) | +3 NP | Digestible lean protein is ideal |
| Digestive enzyme bonus | Digestive enzymes in ingredients | +1 FC | Reduces pancreatic workload |

**UI Advisory:**
> "⚠ [Pet Name] has pancreatitis. High-fat foods can trigger life-threatening flare-ups in dogs. This product has [X]% fat on a dry matter basis. Strictly avoid high-fat treats (marrow bones, pig ears, peanut butter, cheese)."

**Auto-Populate Feeding Stepper:** Default to 3-4 feedings/day (smaller portions reduce pancreatic workload).

**Safe Swap Filter:** HARD FILTER — exclude products with fat DMB >12%. This is the strictest filter in the system.

#### Cats with Pancreatitis:

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Digestibility bonus | Highly digestible proteins (fish, rabbit, egg) in top 5 | +2 IQ | Feline pancreatitis = IBD connection, not fat-triggered |
| Novel protein bonus | Novel proteins (rabbit, venison, duck) in top 3 | +1 IQ | Treats underlying IBD |
| NO fat penalty | — | — | Unlike dogs, feline pancreatitis is NOT triggered by fat |

**UI Advisory:**
> "[Pet Name] has pancreatitis. Unlike in dogs, feline pancreatitis is typically not triggered by dietary fat. Highly digestible and novel protein diets are often recommended. If [Pet Name] stops eating for more than 24 hours, contact your vet immediately — cats are at risk of hepatic lipidosis."

---

### 10. Skin & Coat Issues (Atopy, Dermatitis)

**Species:** Both

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| Omega-3 bonus | Fish oil / EPA / DHA present | +3 NP | Reduces skin inflammation and itching |
| Omega-6 (linoleic acid) bonus | Linoleic acid present in GA | +1 NP | Rebuilds skin barrier |
| Unnamed protein penalty | `is_unnamed_species` proteins in ingredients | −3 IQ (stacks with existing penalty) | Can't verify allergen source |
| Multi-protein penalty | >3 distinct animal protein sources | −2 IQ | Increases allergen exposure surface |
| Single/limited protein bonus | ≤2 animal protein sources in top 10 | +2 IQ | Limits potential allergen triggers |

**UI Advisory:**
> "[Pet Name] has skin & coat issues. Diets with limited protein sources and high omega-3 content may help. If symptoms persist, discuss an elimination diet with your veterinarian."

**Safe Swap Filter:** Prefer limited-ingredient products. Prefer products with fish oil / omega-3 in top 10.

---

### 11. Hypothyroidism (Dogs primarily)

**Species:** Dogs (rare in cats — iatrogenic only)

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-fat penalty | `ga_fat_dmb_pct > 16%` | −3 NP | Sluggish metabolism = rapid fat storage |
| High-calorie penalty | `ga_kcal_per_kg_dmb > 4000` | −2 NP | Same reason — calorie surplus stores as fat |
| High-fiber bonus | `ga_fiber_dmb_pct > 5%` | +2 NP | Keeps dog satiated on restricted calories |
| Omega-3 bonus | Fish oil / EPA / DHA present | +2 NP | Combats severe skin/coat degradation |
| L-Carnitine bonus | L-Carnitine in ingredients | +1 FC | Kickstarts fat metabolism |

**UI Advisory:**
> "[Pet Name] has hypothyroidism. Dogs with this condition have a sluggish metabolism and gain weight easily. Strict portion control and a lower-fat diet are beneficial while medication is being balanced."

**Auto-Populate:** Weight goal slider suggests −1 (gradual loss) unless already underweight.

**Mutual Exclusion:** Selecting hypothyroidism grays out hyperthyroidism in the health conditions picker.

---

### 12. Hyperthyroidism (Cats primarily)

**Species:** Cats (extremely rare in dogs — usually tumor)

**Score Adjustments:**
| Rule | Condition | Adjustment | Citation |
|---|---|---|---|
| High-calorie bonus | `ga_kcal_per_kg_dmb > 4500` (any form) | +3 NP | Cat is burning calories at extreme rate |
| High-protein bonus | `ga_protein_dmb_pct > 40%` | +2 NP | Combats severe muscle wasting |
| Iodine-source penalty | Kelp, seaweed, fish meal in high positions for iodine-restricted cats | −3 IQ | Interferes with iodine restriction therapy |
| Wet food bonus | `product_form = 'wet'` | +1 FC | Hydration + higher calorie density per serving |

**UI Advisory:**
> "[Pet Name] has hyperthyroidism. This is common in senior cats. If managing with an iodine-restricted diet (e.g., Hill's y/d), [Pet Name] must eat ONLY that food — any other food breaks the restriction. If managing with medication, a high-calorie, high-protein diet helps combat muscle wasting."

**UI Logic:** Ask sub-question: "Is [Pet Name] on an iodine-restricted diet?" If yes → different scoring rules (iodine sources become critical penalties). If no (medication/surgery) → high-calorie scoring.

**Mutual Exclusion:** Selecting hyperthyroidism grays out hypothyroidism.

**Species Gate:** Only shows for cats in the health condition picker. If a dog user tries to select it, show: "Hyperthyroidism is extremely rare in dogs. Did you mean Hypothyroidism?"

---

## Score Adjustment Caps

To prevent condition stacking from producing absurd scores:

| Cap | Value | Rationale |
|---|---|---|
| Max condition bonus per product | +10 pts total | Same as breed modifier cap |
| Max condition penalty per product | −15 pts total | Conditions can be life-threatening — penalties should be meaningful |
| Max per-condition | ±8 pts | No single condition dominates the entire score |
| Stacking with allergens (D-129) | Both apply independently | Allergens are immune responses, conditions are metabolic — different axes |
| Stacking with DCM (D-137) | Both apply | Heart disease + DCM pulse advisory are additive (intentional) |

---

## Feeding Stepper Auto-Defaults

| Condition | Default Feedings/Day | Rationale |
|---|---|---|
| Sensitive stomach | 3 | Smaller portions reduce GI workload |
| Pancreatitis (dogs) | 3-4 | Reduce pancreatic load per meal |
| Underweight | 3 | Multiple small meals prevent refeeding issues |
| Diabetes | 2 (locked) | Must align with 12-hour insulin schedule |
| All others | Standard (2) | No feeding frequency modification |

"Locked" means the stepper shows a note: "Diabetic pets should be fed on a consistent schedule aligned with insulin timing. Discuss with your vet."

---

## Safe Swap Condition Filters (Summary)

These stack on top of the existing hard filters (no severe ingredients, no allergens):

| Condition | Additional Safe Swap Filter |
|---|---|
| Joint issues | Prefer omega-3 rich. Exclude kcal/kg DMB >4200 (dry). |
| Sensitive stomach | Dogs: exclude fat DMB >18%. Prefer digestible proteins. |
| Overweight | Exclude kcal/kg DMB >4000 (dry). Prefer high-fiber. |
| Underweight | Exclude "lite"/"weight management". Prefer calorie-dense. |
| Diabetes (dogs) | Exclude simple sugars. Prefer high-fiber, complex carbs. |
| Diabetes (cats) | HARD: exclude estimated carb DMB >15%. Prefer wet food. |
| Kidney disease | Exclude phosphorus DMB >1.0% (cats) / >1.2% (dogs). Prefer wet (cats). |
| Urinary issues | Strongly prefer wet food. |
| Heart disease (dogs) | Exclude salt in top 10. Prefer taurine + L-carnitine supplemented. |
| Heart disease (cats) | Exclude taurine-deficient. Prefer wet food. |
| Pancreatitis (dogs) | HARD: exclude fat DMB >12%. Strictest filter. |
| Pancreatitis (cats) | Prefer novel/digestible proteins. No fat restriction. |
| Skin & coat | Prefer limited-ingredient, omega-3 rich. |
| Hypothyroidism | Exclude fat DMB >16%, kcal/kg DMB >4000. Prefer high-fiber. |
| Hyperthyroidism (cats) | Prefer high-calorie, high-protein. Exclude iodine sources if on y/d. |

---

## Implementation Architecture

### Where It Lives

```typescript
// src/utils/conditionScoring.ts — NEW FILE

interface ConditionAdjustment {
  condition: string;
  rule: string;
  points: number;           // positive = bonus, negative = penalty
  bucket: 'IQ' | 'NP' | 'FC';
  citation: string;
  reason: string;           // human-readable for UI tooltip
}

function computeConditionAdjustments(
  product: Product,
  ingredients: ProductIngredient[],
  pet: Pet,
): ConditionAdjustment[] {
  const adjustments: ConditionAdjustment[] = [];
  const conditions = pet.health_conditions || [];

  for (const condition of conditions) {
    const rules = CONDITION_RULES[condition]?.[pet.species];
    if (!rules) continue;

    for (const rule of rules) {
      if (rule.check(product, ingredients, pet)) {
        adjustments.push({
          condition,
          rule: rule.id,
          points: rule.points,
          bucket: rule.bucket,
          citation: rule.citation,
          reason: rule.reason,
        });
      }
    }
  }

  // Apply caps
  return applyConditionCaps(adjustments);
}
```

### Integration with Scoring Engine

```typescript
// In scoringEngine.ts, Layer 3 (personalization):

// Existing: allergen adjustments (D-129)
const allergenAdj = computeAllergenOverride(product, ingredients, pet);

// NEW: condition adjustments
const conditionAdj = computeConditionAdjustments(product, ingredients, pet);

// Apply both to sub-scores
let adjustedIQ = baseIQ + allergenAdj.iq + conditionAdj.iq;
let adjustedNP = baseNP + conditionAdj.np;
let adjustedFC = baseFC + conditionAdj.fc;

// Cap total condition adjustment
adjustedIQ = Math.max(0, Math.min(55, adjustedIQ));
adjustedNP = Math.max(0, Math.min(30, adjustedNP));
adjustedFC = Math.max(0, Math.min(15, adjustedFC));
```

### ResultScreen Display

New section below ConcernTags when pet has health conditions:

```
┌─────────────────────────────────────────────────────┐
│  🩺 Health Profile Adjustments for Buster           │
│                                                     │
│  Pancreatitis:                                      │
│  ⚠ This product has 22% fat (DMB) — high-fat foods │
│    can trigger flare-ups in dogs. (−5 NP)           │
│                                                     │
│  ✓ Digestive enzymes present (+1 FC)                │
│                                                     │
│  Recommended: 3-4 smaller meals per day to reduce   │
│  pancreatic workload.                               │
│                                                     │
│  ℹ These adjustments are based on veterinary        │
│  nutrition guidelines. Discuss therapeutic diets     │
│  with your veterinarian.                            │
└─────────────────────────────────────────────────────┘
```

Shows each condition's adjustments transparently. The user sees WHY the score changed, not just the number.

---

## D-095 Compliance Checklist

| ✅ Safe | ❌ Unsafe |
|---|---|
| "This product has 22% fat (DMB)" | "This food is dangerous for pancreatitis" |
| "High-fat foods can trigger flare-ups in dogs" | "Don't feed this to your dog" |
| "Consider 3-4 smaller meals per day" | "You must feed 4 times per day" |
| "Discuss therapeutic diets with your vet" | "Switch to Hill's i/d Low Fat" |
| "72% match for Buster" (score reflects condition) | "This food scored poorly because of pancreatitis" |
| "Some veterinarians recommend lower-fat options" | "You should avoid this food" |
| "Based on veterinary nutrition guidelines" | "Clinically proven to help" |

---

## Vet Report Integration

Each active condition adds a section to the vet report:

```
CONDITION: Pancreatitis (Canine)
─────────────────────────────────
Management considerations:
• Ultra-low-fat diet recommended (<12% fat DMB)
• Current primary food: 22% fat DMB — above recommended threshold
• Feed 3-4 small meals per day to reduce pancreatic workload
• Avoid: marrow bones, pig ears, peanut butter, cheese
• Beneficial: digestive enzymes, lean proteins, easily digestible carbs
• Supplementation: lipase, protease, amylase enzymes; probiotics

Source: Clinical veterinary nutritionist guidelines
```

---

## Schema Changes

### Migration 024: Health condition metadata

```sql
-- Store condition-specific sub-selections (e.g., hyperthyroid cats: iodine-restricted vs medication)
CREATE TABLE IF NOT EXISTS pet_condition_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES pets(id) ON DELETE CASCADE,
  condition TEXT NOT NULL,
  sub_type TEXT,                    -- e.g., 'iodine_restricted', 'medication_managed'
  severity TEXT DEFAULT 'moderate', -- 'mild', 'moderate', 'severe'
  diagnosed_at DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pet_id, condition)
);

-- RLS
ALTER TABLE pet_condition_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own pet conditions" ON pet_condition_details
  USING (pet_id IN (SELECT id FROM pets WHERE user_id = auth.uid()));
```

This replaces the simple `health_conditions TEXT[]` array with structured data. The array stays for backward compatibility, but the detail table enables sub-type questions (iodine-restricted vs medication for hyperthyroid cats).

---

## Regression Impact

**Pure Balance = 60 must hold** for a pet with no health conditions. Condition adjustments are Layer 3 only — they don't fire when `health_conditions` is empty. Zero regression risk for the baseline.

New regression targets needed:
- Pure Balance + overweight dog = expected ~57 (high fat penalty)
- Pure Balance + pancreatitis dog = expected ~48 (severe fat penalty)
- Pure Balance + diabetic cat = expected ~55 (moderate carb penalty)
- Pure Balance + CKD cat = expected ~58 (phosphorus check)

Run these after implementation to establish condition-specific regression anchors.

---

## Implementation Priority

| Priority | Conditions | Rationale |
|---|---|---|
| P0 (ship first) | Overweight, Underweight, Sensitive Stomach | Most common, simplest rules, biggest user base |
| P1 | Diabetes, Pancreatitis | Critical species splits, high clinical impact |
| P2 | Kidney Disease, Heart Disease, Urinary Issues | Common in senior pets, moderate complexity |
| P3 | Skin & Coat, Hypothyroidism, Hyperthyroidism | Important but affect fewer users |

---

## Non-Goals

- ❌ Prescribing specific veterinary therapeutic diets ("switch to Hill's k/d")
- ❌ Diagnosing conditions based on symptoms
- ❌ Replacing veterinary nutritional consultation
- ❌ Scoring supplements based on conditions (D-096 — supplements not scored)
- ❌ Drug-nutrient interaction warnings (M10+ scope, needs pharmacology DB)
