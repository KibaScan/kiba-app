# Kiba — Dog Breed Nutritional Modifiers

> **Status:** DRAFT — Requires vet auditor review before production use
> **Referenced by:** `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` §6a
> **Purpose:** Structured breed-specific modifier data for the scoring engine. Each entry maps to a row in the `breed_modifiers` table.
> **Cap rule:** Total breed modifiers within the nutritional bucket are capped at ±10 points (see spec §6c).

---

## Schema

Each breed entry uses this structure. Fields marked `[DB]` are stored in Supabase and consumed by the scoring engine at runtime. Fields marked `[AUDIT]` are for vet review tracking only.

```typescript
interface BreedModifier {
  breed_name: string;                    // [DB] Canonical breed name
  breed_aliases: string[];               // [DB] AKC variants, common misspellings
  trigger_type: 'ga_threshold' | 'ingredient_pattern' | 'combined' | 'advisory_only';  // [DB]
  ga_conditions: GaCondition[] | null;   // [DB] Guaranteed analysis triggers
  ingredient_conditions: IngredientCondition[] | null;  // [DB] Ingredient list triggers
  modifier_points: number;               // [DB] Score adjustment (negative = penalty, positive = bonus)
  modifier_target: 'protein_sub' | 'fat_sub' | 'fiber_sub' | 'carb_sub' | 'bucket_overall' | 'ingredient_quality' | 'advisory_only';  // [DB]
  applies_to: LifeStage[];              // [DB] Which life stages this modifier fires for
  species: 'dog';                        // [DB]
  evidence_strength: 'strong' | 'moderate' | 'emerging';  // [AUDIT]
  mechanism_summary: string;             // [AUDIT] One-line clinical explanation
  citations: Citation[];                 // [DB] Required — every modifier must have at least one
  ui_callout: string;                    // [DB] User-facing explanation shown in score breakdown
  clinical_note: string;                 // [AUDIT] Extended explanation for vet auditor
  vet_audit_status: 'cleared' | 'pending' | 'blocked' | 'not_started';  // [AUDIT]
  actionability: 'ga_actionable' | 'ingredient_actionable' | 'not_actionable_from_label';  // [DB]
}
```

---

## Tier 1 — GA-Actionable Breeds

These breeds have modifiers that fire based on guaranteed analysis values (protein %, fat %, fiber %, calcium %, caloric density). The scoring engine can evaluate these from structured GA data alone.

---

### Miniature Schnauzer

```
breed_name:            Miniature Schnauzer
breed_aliases:         [Mini Schnauzer, Miniature Schnauzer]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // worsens with age; highest risk >5yr
vet_audit_status:      pending
evidence_strength:     strong
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 18% | −6 | fat_sub | High risk — pancreatitis trigger zone |
| fat_dmb > 15% AND ≤ 18% | −4 | fat_sub | Moderate risk |
| fat_dmb > 10% AND ≤ 15% | −2 | fat_sub | Caution threshold |
| fat_dmb ≤ 10% | 0 | — | Therapeutic range; no penalty |

**Ingredient conditions:** None required — GA fat % is sufficient.

**Mechanism:** Idiopathic hypertriglyceridemia affects 32.8% of healthy Miniature Schnauzers (75%+ by age 9). Reduced lipoprotein lipase (LPL) activity causes impaired clearance of triglyceride-rich lipoproteins. SPINK1 gene mutations confer independent pancreatitis risk. Hypertriglyceridemia >800 mg/dL triggers pancreatitis, proteinuria, gallbladder mucoceles. Dietary fat restriction resolves hyperlipidemia in ~50% of affected dogs.

**UI callout:** `"Adjusted for Miniature Schnauzer: breed predisposition to hyperlipidemia and pancreatitis — lower-fat formulas preferred."`

**Citations:**
- Xenoulis PG et al., *J Vet Intern Med*, 2007; DOI: 10.1111/j.1939-1676.2007.tb01939.x
- Xenoulis PG et al., *J Vet Intern Med*, 2020; DOI: 10.1111/jvim.15880
- Furrow E et al., *Vet J*, 2016; DOI: 10.1016/j.tvjl.2016.04.009
- Xenoulis PG et al., *J Vet Intern Med*, 2022; DOI: 10.1111/jvim.16418

**Clinical note:** This is the breed with the strongest, most direct GA-to-pathology link. Fat DMB is the single most impactful parameter. Moderate fiber (10–15% DMB) and omega-3 supplementation (EPA+DHA at 120 mg/kg^0.75) are beneficial but not GA-scorable. All life stages affected; worsening with age.

---

### Cocker Spaniel (Dual Constraint)

```
breed_name:            Cocker Spaniel
breed_aliases:         [American Cocker Spaniel, English Cocker Spaniel, Cocker]
trigger_type:          combined
actionability:         ga_actionable + ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**GA conditions (pancreatitis):**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 18% | −5 | fat_sub | Strongly contraindicated — 2.8× pancreatitis rate |
| fat_dmb > 15% AND ≤ 18% | −3 | fat_sub | Moderate risk |
| fat_dmb ≤ 15% | 0 | — | Acceptable range |

**Ingredient conditions (DCM/taurine):**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| grain_free AND legumes_in_top_5 AND no_supplemental_taurine | −2 | ingredient_quality | Taurine depletion risk; CURE project confirmed AAFCO-compliant diets insufficient |
| supplemental_taurine_present | +1 | bucket_overall | Positive signal for breed with reduced CSAD activity |

**Mechanism (pancreatitis):** English Cockers have chronic pancreatitis at 2.8× the population rate with T-lymphocyte infiltration resembling autoimmune pancreatitis. American Cockers have idiopathic hypertriglyceridemia. High dietary fat increases postprandial lipemia → pancreatic autodigestion.

**Mechanism (DCM):** The MUST trial (Kittleson et al., 1997) demonstrated taurine-deficient DCM in American Cockers with reduced cysteine sulfinic acid decarboxylase activity. The CURE project (Kriström et al., 2024) found >90% of English Cockers with low blood taurine were eating diets meeting NRC SAA minimums — confirming AAFCO compliance is insufficient for this breed.

**UI callout:** `"Adjusted for Cocker Spaniel: dual sensitivity to dietary fat (pancreatitis risk) and taurine adequacy (DCM risk)."`

**Citations:**
- Watson PJ et al., *J Small Anim Pract*, 2007; DOI: 10.1111/j.1748-5827.2007.00448.x
- Kittleson MD et al., *J Vet Intern Med*, 1997; DOI: 10.1111/j.1939-1676.1997.tb00092.x
- Kriström K et al., *J Vet Intern Med*, 2024; DOI: 10.1111/jvim.17150

**Clinical note:** Most complex food-scoring breed. Requires BOTH low fat AND adequate taurine — these constraints can conflict in formulation. High-quality animal protein as first ingredient is critical to meet both needs. Added taurine is a strong positive signal.

---

### Soft-Coated Wheaten Terrier (Dual Constraint)

```
breed_name:            Soft-Coated Wheaten Terrier
breed_aliases:         [Wheaten Terrier, SCWT, Soft Coated Wheaten]
trigger_type:          combined
actionability:         ga_actionable + ingredient_actionable
applies_to:            [all]  // PLE onset ~4.7yr, PLN onset ~6.3yr
vet_audit_status:      pending
evidence_strength:     strong (predisposition), moderate (dietary thresholds)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 15% | −3 | fat_sub | PLE with lymphangiectasia — high fat stimulates lymph flow, worsening lacteal dilation |
| fat_dmb > 10% AND ≤ 15% | −2 | fat_sub | Caution zone |
| protein_dmb > 30% | −1 | protein_sub | PLN concern — glomerular stress from high protein |
| protein_dmb < 18% | −2 | protein_sub | Insufficient to offset PLE protein losses |

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| primary_allergens_in_top_3 (corn, wheat, dairy, lamb, chicken, soy) | Advisory only | — | Food hypersensitivity documented in 6/6 tested affected SCWTs |

**Mechanism:** NPHS1/KIRREL2 mutations on chromosome 1 → protein-losing nephropathy (PLN). Inflammatory bowel disease with intestinal lymphangiectasia → protein-losing enteropathy (PLE). 28% of affected dogs have both simultaneously, creating conflicting dietary demands: PLE needs adequate protein, PLN may benefit from moderation. High long-chain triglycerides stimulate lymph flow, worsening intestinal protein loss.

**UI callout:** `"Adjusted for Wheaten Terrier: breed predisposition to protein-losing conditions — lower-fat, moderate-protein formulas preferred."`

**Citations:**
- Littman MP et al., *J Vet Intern Med*, 2000; DOI: 10.1892/0891-6640(2000)014<0068:fpleap>2.3.co;2
- Littman MP et al., *Mamm Genome*, 2013; DOI: 10.1007/s00335-012-9445-8
- Vaden SL et al., *J Vet Intern Med*, 2000; DOI: 10.1892/0891-6640(2000)014<0060:fhrisc>2.3.co;2

**Clinical note:** Fat DMB is the most GA-actionable parameter. Novel or hydrolyzed protein sources preferred. MCTs (coconut oil) bypass intestinal lymphatics and are safer fat sources. Low crude fiber (<2% DMB) recommended for PLE to maximize digestibility.

---

### German Shepherd

```
breed_name:            German Shepherd
breed_aliases:         [German Shepherd Dog, GSD, Alsatian]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (predisposition), moderate (dietary thresholds)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fiber_dmb > 6% | −4 | fiber_sub | High risk — fiber decreases digestibility in EPI dogs |
| fiber_dmb > 4% AND ≤ 6% | −2 | fiber_sub | Caution — GSDs comprise ~70% of all EPI cases |
| fat_dmb > 20% | −2 | fat_sub | May worsen steatorrhea |
| fiber_dmb ≤ 4% AND fat_dmb 10–15% | 0 | — | Optimal range for breed |

**Ingredient conditions:** None required from GA — but highly digestible protein sources (egg, muscle meats, rice) are preferred over rendered meals or plant protein concentrates. This is an ingredient quality concern already handled by Layer 1.

**Mechanism:** Pancreatic acinar atrophy (PAA) is immune-mediated destruction of acinar cells by CD4+/CD8+ T-lymphocytes. Heritable with estimated heritability of 0.51, now considered polygenic. Clinical EPI appears when >90% of acinar cells are destroyed. Fiber decreases dry matter digestibility, increases fecal volume, and may decrease nutrient absorption.

**UI callout:** `"Adjusted for German Shepherd: breed predisposition to exocrine pancreatic insufficiency — low-fiber, highly digestible formulas preferred."`

**Citations:**
- Westermarck E & Wiberg ME, *JAVMA*, 2006; DOI: 10.2460/javma.228.2.225
- Westermarck E et al., *J Vet Intern Med*, 2010; DOI: 10.1111/j.1939-1676.2009.0461.x
- Wiberg ME et al., *Vet Pathol*, 1999; DOI: 10.1354/vp.36-6-530

**Clinical note:** Diet alone does NOT manage EPI — enzyme supplementation (PERT) is mandatory. Crude fiber in GA underestimates total dietary fiber by ~50%; research thresholds of "low TDF" correspond to ~<2% crude fiber. Individual variation is high.

---

### Labrador Retriever

```
breed_name:            Labrador Retriever
breed_aliases:         [Lab, Labrador, Yellow Lab, Chocolate Lab, Black Lab]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // highest risk post-neutering
vet_audit_status:      pending
evidence_strength:     strong (POMC mutation), moderate (compositional thresholds)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 18% | −2 | fat_sub | Obesity risk — POMC mutation in ~25% of pet Labs |
| fiber_dmb ≥ 10% | +1 | fiber_sub | Higher fiber improves satiety in POMC carriers |
| protein_dmb ≥ 30% | +1 | protein_sub | Higher protein reduces short-term food intake |
| caloric_density > 4.0 kcal/g | −1 | bucket_overall | High caloric density compounds POMC-driven overeating |

**Ingredient conditions:** None required — this is a GA-driven concern.

**Mechanism:** 14-bp deletion in POMC gene disrupts β-MSH and β-endorphin production (satiety-signaling neuropeptides) while leaving α-MSH intact. This distinction is clinically significant — loss of β-MSH alone is sufficient to lower resting metabolic rate and increase hunger, even with normal α-MSH levels. ~25% of pet Labs carry the mutation. Per-allele effects: +1.90 kg body weight, +0.48 BCS points. Dual mechanism: increased hunger AND reduced resting metabolic rate.

**UI callout:** `"Adjusted for Labrador Retriever: breed predisposition to obesity (POMC gene) — lower caloric density with higher fiber and protein preferred."`

**Citations:**
- Raffan E et al., *Cell Metabolism*, 2016; DOI: 10.1016/j.cmet.2016.04.012
- Raffan E et al., *Science Advances*, 2024; DOI: 10.1126/sciadv.adj3823
- Weber M et al., *J Vet Intern Med*, 2007; DOI: 10.1892/07-016.1

**Clinical note:** Caloric density and satiety management are more important than any single nutrient threshold. L-carnitine ≥500 ppm in obesity management formulations aids fatty acid transport. Caloric density calculated from macronutrients using modified Atwater factors (protein 3.5, fat 8.5, carb 3.5 kcal/g DMB).

---

### Bulldogs / French Bulldogs / Pugs (Brachycephalic Group)

```
breed_name:            Brachycephalic Group
breed_aliases:         [Bulldog, English Bulldog, French Bulldog, Frenchie, Pug]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // highest risk post-neutering
vet_audit_status:      pending
evidence_strength:     strong (obesity-BOAS link), moderate (compositional thresholds)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 18% | −2 | fat_sub | Obesity directly worsens BOAS |
| caloric_density > 3.5 kcal/g | −1 | bucket_overall | Weight management has outsized health impact |
| carb_dmb > 45% | −2 | carb_sub | Obesity-prone breeds; high-carb diets compound reduced exercise tolerance |

**Ingredient conditions:** None required.

**Mechanism:** No breed-specific genetic obesity mutation identified (unlike POMC in Labs). Obesity risk derives from anatomical positive-feedback loop: BOAS → reduced exercise tolerance → reduced caloric expenditure → weight gain → increased pharyngeal fat deposition → worsened BOAS. Pugs have OR 3.12 for overweight — highest of all breeds studied.

**UI callout:** `"Adjusted for [breed_name]: brachycephalic breed — obesity directly worsens airway function. Lower caloric density preferred."`

**Citations:**
- Pegram C et al., *J Small Anim Pract*, 2021; DOI: 10.1111/jsap.13325
- Packer RMA et al., *PLoS One*, 2015; DOI: 10.1371/journal.pone.0137496
- O'Neill DG et al., *Canine Med Genet*, 2022; DOI: 10.1186/s40575-022-00117-6

**Clinical note:** Key concern is caloric density rather than any single macronutrient. Even modest excess weight directly increases respiratory compromise — weight management has disproportionate health impact compared to mesocephalic breeds.

---

### Yorkshire Terrier (Puppy-Specific)

```
breed_name:            Yorkshire Terrier
breed_aliases:         [Yorkie, Yorkshire]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [puppy]  // primarily <5 months; adults at minimal risk unless liver shunt
vet_audit_status:      pending
evidence_strength:     strong (condition), weak (compositional thresholds)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| caloric_density_me < 2.8 kcal/g on ME basis (puppy formula) | −1 | bucket_overall | Insufficient caloric density for toy breed puppies. IMPORTANT: calculate on ME/DMB basis — most wet foods fall below 2.8 kcal/g as-fed due to moisture; this flag must not penalize high-quality wet food. Use modified Atwater on DMB values. |
| fiber_dmb > 15% (puppy formula) | −1 | fiber_sub | May limit caloric intake dangerously in toy puppies |

**Ingredient conditions:** None — meal frequency is the primary intervention, not food composition.

**Mechanism:** Transient juvenile hypoglycemia from limited hepatic glycogen stores, immature gluconeogenesis, and high metabolic rate. Yorkshire Terriers have ~36× greater risk of portosystemic liver shunts, which can cause hypoglycemia persisting into adulthood.

**UI callout:** `"Note for Yorkshire Terrier puppy: toy breeds benefit from adequate caloric density and frequent meals (3–4×/day) to support stable blood sugar."`

**Citations:**
- Idowu O & Heading K, *Can Vet J*, 2018; PMID: 29904216
- Carciofi AC et al., *J Anim Physiol Anim Nutr*, 2008; DOI: 10.1111/j.1439-0396.2007.00794.x

**Clinical note:** Primarily affects puppies <5 months; adults at minimal risk unless concurrent liver shunt. Scoring engine can flag caloric density and fiber but cannot enforce feeding frequency. Avoid "light" or weight management diets for Yorkie puppies. Complex carbohydrate sources (oats, brown rice, barley) preferred over refined starches.

---

### Giant Breeds — Calcium (Puppy-Specific)

```
breed_name:            Giant Breed Group (Calcium)
breed_aliases:         [Great Dane, Saint Bernard, Irish Wolfhound, Mastiff, Newfoundland, Bernese Mountain Dog, Great Pyrenees, Leonberger, Tibetan Mastiff, Cane Corso]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [puppy]  // growth phase ONLY — adult calcium concern is minimal
vet_audit_status:      pending
evidence_strength:     strong
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| calcium_dmb > 1.8% | −5 | bucket_overall | Exceeds AAFCO max for large breed growth; causes DOD |
| calcium_dmb > 1.5% AND ≤ 1.8% | −3 | bucket_overall | Above optimal for giant breed puppies |
| calcium_dmb < 0.8% | −3 | bucket_overall | Insufficient for skeletal growth |
| ca_p_ratio > 2:1 | −3 | bucket_overall | Wide ratio causes secondary phosphorus deficiency |
| ca_p_ratio < 1.1:1 | −2 | bucket_overall | Below safe minimum |

**Ingredient conditions:** None — this is purely a mineral threshold concern.

**Mechanism:** Giant breed puppies cannot regulate intestinal calcium absorption — excess is absorbed and causes osteochondrosis, disturbed endochondral ossification, and chronic hypercalcitoninism. Hazewinkel et al. showed 3.3% calcium DMB caused skeletal abnormalities in Great Dane puppies but NOT in Miniature Poodles. Excess calcium suppresses osteoclast activity → retained cartilage cores → OCD, HOD, wobbler syndrome. A wide Ca:P ratio is MORE damaging than proportional excess.

**UI callout:** `"Adjusted for [breed_name] puppy: giant breed puppies are sensitive to calcium levels — optimal range is 1.2–1.5% DMB with a Ca:P ratio of 1.1:1 to 1.3:1."`

**Citations:**
- Hazewinkel HAW et al., *JAAHA*, 1985
- Goedegebuure SA & Hazewinkel HAW, *Vet Pathol*, 1986; DOI: 10.1177/030098588602300508
- Schoenmakers I et al., *Vet Rec*, 2000
- Nap RC et al., *J Nutr*, 1991; DOI: 10.1093/jn/121.suppl_11.S107

**Clinical note:** AAFCO now requires "All Life Stages" foods to state "including growth of large size dogs (70 lbs or more)" ONLY if calcium ≤1.8% DM. Protein does NOT cause DOD — Nap et al. (1991) demonstrated no difference in skeletal development across 14.6%, 23.1%, and 31.6% protein DMB.

---

### Giant Breeds — GDV Risk (All Ages)

```
breed_name:            Giant Breed Group (GDV)
breed_aliases:         [Great Dane, Saint Bernard, Irish Wolfhound, Mastiff, Weimaraner, Standard Poodle, German Shepherd, Gordon Setter, Irish Setter]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     moderate-strong (observational)
```

**GA conditions:** None — GDV risk is ingredient-pattern based.

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_source_in_first_4_ingredients | −2 | ingredient_quality | OR 2.59 for GDV; slows gastric emptying |
| citric_acid_present | −2 | ingredient_quality | OR 3.16 for GDV (4.19 if food moistened) |
| rendered_meat_meal_with_bone_in_first_4 | +2 | ingredient_quality | Protective factor, OR 0.47 |

**Mechanism:** Fat in first 4 ingredients may slow gastric emptying; citric acid may promote gas production — both contributing to gastric distension. Glickman/Purdue prospective study of 1,637 dogs identified these as independent risk factors.

**UI callout:** `"Note for [breed_name]: large/deep-chested breeds have elevated GDV risk — [specific concern detected]."`

**Citations:**
- Raghavan M et al., *JAAHA*, 2004; DOI: 10.5326/0400192
- Glickman LT et al., *JAVMA*, 2000; DOI: 10.2460/javma.2000.217.1492

**Clinical note:** Raised food bowls (OR 2.18), fast eating speed, and once-daily feeding also increase GDV risk but are management factors, not food composition — surface as advisory text only.

---

## Tier 2 — Ingredient-List-Actionable Breeds

These breeds have modifiers that fire based on ingredient list parsing (grain-free status, legume presence/position, gluten-containing grains, taurine supplementation). GA values alone are insufficient.

---

### Golden Retriever

```
breed_name:            Golden Retriever
breed_aliases:         [Golden, Goldie]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     moderate-strong
```

**GA conditions:** None directly actionable. Crude fiber DMB >5% combined with grain-free/legume-heavy formulation may increase fecal bile acid taurine losses — but fiber alone is not the trigger.

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| grain_free AND legumes_in_top_5 AND no_supplemental_taurine | −3 | ingredient_quality | 93% of FDA-implicated DCM diets contained peas/lentils |
| grain_free AND legumes_in_top_5 AND supplemental_taurine_present | −1 | ingredient_quality | Taurine mitigates but doesn't eliminate concern |
| supplemental_taurine_present (any formula) | +1 | bucket_overall | Positive signal for breed with reduced CSAD activity |
| lamb_and_rice AND no_supplemental_taurine | Advisory only | — | Lamb-based diets associated with lower taurine status |

**Mechanism:** Breed-specific lower taurine synthesis capacity (reduced CSAD activity). Obligate bile acid conjugation with taurine; high-fiber legume-rich diets increase fecal taurine losses. FDA analysis found peas most distinguishing ingredient in DCM-associated diets.

**UI callout:** `"Adjusted for Golden Retriever: breed sensitivity to grain-free/legume-heavy diets — taurine adequacy is a concern."`

**Citations:**
- Kaplan JL et al., *PLoS ONE*, 2018; DOI: 10.1371/journal.pone.0209112
- Freeman LM et al., *JAVMA*, 2018; DOI: 10.2460/javma.253.11.1390
- FDA Investigation into Potential Link between Certain Diets and Canine DCM, 2019

**Clinical note:** No AAFCO-required GA value directly measures taurine or sulfur amino acid content. Meeting AAFCO/NRC SAA minimums does NOT guarantee adequate taurine status in this breed. Causation not definitively proven (FDA December 2022 statement).

---

### Newfoundland

```
breed_name:            Newfoundland
breed_aliases:         [Newfie, Newf]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| grain_free AND legumes_in_top_5 AND no_supplemental_taurine | −2 | ingredient_quality | Lower taurine synthesis rates; 8% of breed has low plasma taurine |
| lamb_and_rice AND no_supplemental_taurine | −1 | ingredient_quality | Lamb base associated with lower taurine status |
| supplemental_taurine_present | +1 | bucket_overall | Positive signal |

**Mechanism:** Lower taurine synthesis rates associated with lower plasma methionine and cysteine concentrations. 3 of 9 clinically evaluated taurine-deficient Newfoundlands had DCM reversed by taurine supplementation.

**UI callout:** `"Adjusted for Newfoundland: breed sensitivity to taurine-depleting diets — supplemental taurine is beneficial."`

**Citations:**
- Backus RC et al., *JAVMA*, 2003; DOI: 10.2460/javma.2003.223.1130
- Backus RC et al., *J Nutr*, 2006; DOI: 10.1093/jn/136.10.2525S

**Clinical note:** Same ingredient-pattern logic as Golden Retriever. Also predisposed to Type I cystinuria (SLC3A1 mutation), but cystinuria management is medical, not general food-scoring.

---

### Doberman Pinscher (Advisory-Weighted)

```
breed_name:            Doberman Pinscher
breed_aliases:         [Doberman, Dobie, Dobermann]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (genetic), weak-moderate (dietary)
```

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| grain_free AND legumes_in_top_5 AND no_supplemental_taurine | −1 | ingredient_quality | Precautionary only — DCM is primarily genetic (PDK4/TTN) |
| supplemental_taurine_present | +1 | bucket_overall | Low-risk adjunctive benefit |
| supplemental_l_carnitine_present | +1 | bucket_overall | Low-risk adjunctive benefit |

**Mechanism:** DCM prevalence ~50% males, ~33% females. Primary drivers are genetic: PDK4 (16-bp deletion) and TTN (titin missense variant). Taurine deficiency is NOT the primary driver — most Dobermans with DCM have normal taurine levels.

**UI callout:** `"Note for Doberman: DCM is primarily genetic in this breed (PDK4/TTN mutations). Dietary optimization (taurine, L-carnitine) is supportive only. Genetic screening recommended."`

**Citations:**
- Meurs KM et al., *Human Genetics*, 2012; DOI: 10.1007/s00439-012-1158-2
- Wess G et al., *J Vet Intern Med*, 2010; DOI: 10.1111/j.1939-1676.2010.0495.x

**Clinical note:** DO NOT heavily penalize foods for Dobermans based on dietary composition alone. Genetic screening is far more impactful. Flag grain-free/legume diets at LOWER severity than Golden Retrievers or Cocker Spaniels.

---

### Boxer (Advisory-Weighted)

```
breed_name:            Boxer
breed_aliases:         [Boxer Dog]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (genetic ARVC), weak (dietary L-carnitine)
```

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| grain_free AND legumes_in_top_5 AND no_supplemental_taurine | −1 | ingredient_quality | Precautionary only |
| supplemental_l_carnitine_present | +1 | bucket_overall | Low-risk; commonly recommended by cardiologists |

**Mechanism:** Boxer cardiomyopathy (ARVC) is caused by STRN gene deletion (8-bp, ~82% penetrance in heterozygotes). L-carnitine deficiency was documented in only one Boxer family (Keene et al., 1991) — the defect was a membrane transport defect, not dietary deficiency.

**UI callout:** `"Note for Boxer: cardiomyopathy is primarily genetic (STRN mutation). L-carnitine supplementation in food is a low-risk positive."`

**Citations:**
- Meurs KM et al., *Human Genetics*, 2010; DOI: 10.1007/s00439-010-0855-y
- Keene BW et al., *JAVMA*, 1991; PMID: 2019534

**Clinical note:** Minimal diet-based penalization warranted. Genetic screening is the primary intervention.

---

### Irish Setter

```
breed_name:            Irish Setter
breed_aliases:         [Irish Red Setter, Red Setter]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]  // clinical onset typically 4–7 months but lifelong sensitivity
vet_audit_status:      pending
evidence_strength:     strong (in documented lines)
```

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| any_gluten_grain_present (wheat, barley, rye, oats + derivatives) | −4 | ingredient_quality | Gluten-sensitive enteropathy — any amount can trigger |

**Mechanism:** Autosomal recessive single-locus inheritance causes cell-mediated immune response to prolamin fractions (gliadin, hordein, secalin, avenin). Partial villous atrophy in proximal small intestine. Complete resolution on gluten-free diet.

**UI callout:** `"Adjusted for Irish Setter: documented gluten-sensitive enteropathy — gluten-free formulas recommended."`

**Citations:**
- Garden OA et al., *Am J Vet Res*, 2000; DOI: 10.2460/ajvr.2000.61.462
- Hall EJ & Batt RM, *Res Vet Sci*, 1991; DOI: 10.1016/0034-5288(91)90036-N

**Clinical note:** Entirely ingredient-list concern — GA provides zero signal. Rice and corn are safe. Since not all Irish Setters carry the homozygous genotype (~0.8% prevalence in study populations), flag as breed-specific caution rather than absolute prohibition.

---

### Border Terrier

```
breed_name:            Border Terrier
breed_aliases:         [Border]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| any_gluten_grain_present (wheat, barley, rye) | −3 | ingredient_quality | Paroxysmal gluten-sensitive dyskinesia (PGSD) |

**Mechanism:** Immunologic response against transglutaminase-2 (TG2) and gliadin proteins produces elevated anti-gliadin IgG and anti-TG2 IgA. Triggers paroxysmal dyskinesia, GI signs, and dermatological signs. Complete resolution on gluten-free diet.

**UI callout:** `"Adjusted for Border Terrier: documented gluten-sensitive dyskinesia — gluten-free formulas recommended."`

**Citations:**
- Lowrie M et al., *J Vet Intern Med*, 2015; DOI: 10.1111/jvim.13643
- Lowrie M et al., *J Vet Intern Med*, 2018; DOI: 10.1111/jvim.15038

**Clinical note:** The ONLY breed with formally characterized PGSD. Any amount of gluten can trigger episodes. GA provides no signal.

---

## Tier 3 — Not Actionable From Label Data (Advisory Only)

These breeds have strong genetic evidence for dietary vulnerabilities, but the relevant nutrients (copper mg/kg, zinc mg/kg) are NOT reported on standard guaranteed analysis labels. The scoring engine cannot calculate a modifier — these surface as advisory callouts with ingredient-level flags as a proxy.

---

### Bedlington Terrier

```
breed_name:            Bedlington Terrier
breed_aliases:         [Bedlington]
trigger_type:          advisory_only
actionability:         not_actionable_from_label
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**GA conditions:** Not actionable — copper mg/kg is not on standard GA labels.

**Ingredient-level proxy flags:**

| Condition | Effect | Rationale |
|---|---|---|
| Organ meats in top 10 (beef liver, lamb liver, venison liver) | Flag as advisory | High copper content sources |
| copper_sulfate OR copper_proteinate OR copper_amino_acid_chelate in supplement list | Flag as advisory | Copper chelates have ~2.3× bioavailability of copper sulfate |

**Modifier:** Advisory note only — no score change. `"Bedlington Terriers have a genetic copper storage defect (COMMD1). Copper levels cannot be assessed from this label. Consult your veterinarian about dietary copper management."`

**Mechanism:** COMMD1 gene — 39.7 kb genomic deletion, autosomal recessive. Impaired biliary copper excretion → progressive hepatic copper accumulation reaching 2,000–15,000 µg/g DW. Clinical hepatitis at 2–5 years.

**Citations:**
- van De Sluis B et al., *Hum Mol Genet*, 2002; DOI: 10.1093/hmg/11.2.165
- Brewer GJ et al., *JAVMA*, 1992; DOI: 10.2460/javma.1992.201.04.564
- Fieten H et al., *Mamm Genome*, 2012; DOI: 10.1007/s00335-011-9378-7

**Clinical note:** Most commercial dog foods contain 12–16 mg copper/kg DM — well above safe levels for affected Bedlingtons. AAFCO minimum is 7.3 mg/kg DM; there is NO AAFCO maximum (removed in 2007). DNA testing available.

---

### West Highland White Terrier

```
breed_name:            West Highland White Terrier
breed_aliases:         [Westie, WHWT, West Highland]
trigger_type:          advisory_only
actionability:         not_actionable_from_label
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (predisposition), moderate (mechanism — causal gene unknown)
```

**Ingredient-level proxy flags:** Same as Bedlington Terrier.

**Modifier:** Advisory note only — no score change. `"West Highland White Terriers have documented familial copper storage disease. Copper levels cannot be assessed from this label. Consult your veterinarian."`

**Mechanism:** Familial/hereditary copper storage with decreased biliary excretion. Causal gene UNKNOWN (COMMD1 and ATP7B excluded). Key difference from Bedlingtons: copper levels may plateau or decrease with age; rarely exceeds 2,000 µg/g DW.

**Citations:**
- Thornburg LP et al., *Vet Pathol*, 1986; DOI: 10.1177/030098588602300209
- Thornburg LP et al., *Vet Pathol*, 1996; DOI: 10.1177/030098589603300604
- Ullal TV et al., *J Vet Intern Med*, 2022; DOI: 10.1111/jvim.16580

**Clinical note:** Lower severity than Bedlington Terrier — copper accumulation is less extreme and may plateau.

---

### Siberian Husky / Alaskan Malamute

```
breed_name:            Northern Breed Group (Zinc)
breed_aliases:         [Siberian Husky, Husky, Alaskan Malamute, Malamute]
trigger_type:          advisory_only
actionability:         not_actionable_from_label
applies_to:            [all]  // onset 6mo–10yr; 41% develop lesions before age 2
vet_audit_status:      pending
evidence_strength:     strong
```

**GA conditions:** Not actionable — zinc mg/kg is not on standard GA labels.

**Ingredient-level proxy flags:**

| Condition | Effect | Rationale |
|---|---|---|
| High-phytate ingredients in top 5 (soybean meal, soy flour, wheat bran, corn gluten meal) | Flag as advisory | Phytate chelates zinc, reducing absorption by up to 35% |
| calcium_dmb > 2% (if available) | Flag as advisory | Excess calcium interferes with zinc absorption |

**Modifier:** Advisory note only — no score change. `"Northern breeds (Huskies, Malamutes) have a hereditary zinc absorption defect. High-phytate ingredients may worsen zinc availability. Consult your veterinarian about zinc supplementation."`

**Mechanism:** Suspected hereditary defect in intestinal zinc absorption — only 25% of zinc absorbed vs. normal controls. Deficiency → impaired keratinocyte differentiation → parakeratotic hyperkeratosis → crusting at mucocutaneous junctions.

**Citations:**
- White SD et al., *Vet Dermatol*, 2001; DOI: 10.1046/j.1365-3164.2001.00233.x
- Colombini S & Dunstan RW, *JAVMA*, 1997
- Boyanowski KJ, *Vet Clin North Am Small Anim Pract*, 1999; DOI: 10.1016/S0195-5616(99)50133-2

**Clinical note:** Even optimal food cannot replace zinc supplementation for Syndrome I dogs. Chelated zinc forms (zinc methionine, zinc proteinate) have better bioavailability than zinc oxide. Grain-free or low-grain formulations may reduce phytate interference.

---

### Shetland Sheepdog

```
breed_name:            Shetland Sheepdog
breed_aliases:         [Sheltie, Shetland]
trigger_type:          advisory_only
actionability:         not_actionable_from_label
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     emerging
```

**Modifier:** Advisory note only. `"Some reports of copper accumulation in Shetland Sheepdogs. Evidence is limited. General copper-conscious dietary choices may be beneficial."`

**Mechanism:** No specific gene mutation identified. Not listed among classically predisposed breeds. If copper accumulation occurs, likely secondary to excessive dietary intake rather than primary genetic defect.

**Citations:**
- Strickland JM et al., *J Vet Intern Med*, 2018; DOI: 10.1111/jvim.15230

**Clinical note:** Apply general copper-conscious awareness rather than breed-specific penalization. Monitor for future research. The broader trend of rising copper levels in commercial foods (Center et al., 2021) is relevant to all breeds.

---

## Dalmatian (Hybrid — Ingredient + Advisory)

```
breed_name:            Dalmatian
breed_aliases:         [Dal, Dalmatian Dog]
trigger_type:          combined
actionability:         ingredient_actionable (purine sources) + ga_actionable (protein % as secondary)
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**Ingredient conditions (primary):**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| high_purine_ingredients_in_top_10 (organ meats, sardines, anchovies, mackerel, brewer's yeast) | −5 | protein_sub | SLC2A9 mutation — 100% penetrance in standard Dalmatians |
| no_high_purine AND protein_dmb > 30% from animal sources | −2 | protein_sub | Cumulative purine load even from moderate-purine proteins |

**GA conditions (secondary):**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| protein_dmb > 35% AND high_purine_ingredient_detected | −3 | protein_sub | Compounds purine load |

**Mechanism:** SLC2A9 missense mutation (C188F) — impaired hepatic urate transport → 400–600 mg uric acid/day (vs. 10–60 mg normal). Precipitates as urate uroliths.

**UI callout:** `"Adjusted for Dalmatian: genetic uric acid metabolism defect — high-purine protein sources are a concern. Low-purine proteins (egg, dairy) preferred."`

**Citations:**
- Bannasch D et al., *PLoS Genetics*, 2008; DOI: 10.1371/journal.pgen.1000246
- Bartges JW et al., *Vet Clin North Am Small Anim Pract*, 1999; DOI: 10.1016/S0195-5616(99)50009-5
- Lulich JP et al., *J Vet Intern Med*, 2016; DOI: 10.1111/jvim.14559

**Clinical note:** GA alone CANNOT detect purine risk. Two foods with identical protein % can differ radically in purine content (egg = low; organ meat = very high). Wet/high-moisture foods are mildly protective (promote urine dilution).

---

## Cross-Breed Concern: Rising Copper in Commercial Foods

This is NOT breed-specific but affects scoring for all dogs, with heightened relevance for Bedlington Terriers, WHWTs, and potentially Shelties.

**Background:** Mean hepatic copper in dogs increased dramatically over the past century. A 1997 AAFCO change replacing copper oxide (~5% bioavailability) with copper sulfate (~60–100% bioavailability) increased bioavailable copper delivery. The 2007 removal of the AAFCO maximum for copper compounded this. Currently, most commercial foods contain 12–16 mg copper/kg DM — well above the NRC recommended allowance of ~6 mg/kg DM.

**Scoring implication:** Not actionable as a breed modifier (copper mg/kg not on GA), but relevant context for the vet auditor and for future data enrichment. If Kiba later ingests supplemental mineral data from manufacturer websites, this becomes scorable for all breeds.

**Citations:**
- Center SA et al., *JAVMA*, 2021; DOI: 10.2460/javma.258.4.357
- Strickland JM et al., *J Vet Intern Med*, 2018; DOI: 10.1111/jvim.15230

---

## Implementation Checklist

- [ ] Each breed entry maps to a `breed_modifiers` row with all `[DB]` fields populated
- [ ] Ingredient-pattern detection requires: grain-free flag, legume detection (peas, lentils, chickpeas, beans + derivatives), gluten grain detection (wheat, barley, rye, oats), taurine/L-carnitine in supplement list, organ meat detection, citric acid detection, fat source position detection
- [ ] Life stage gating: Giant breed calcium modifiers fire ONLY for puppies; Yorkshire Terrier fires ONLY for puppies; all others fire for `[all]`
- [ ] Modifier cap: sum of all breed modifiers within the nutritional bucket ≤ |10|
- [ ] Advisory-only entries (Tier 3) surface as UI callouts but produce zero score delta
- [ ] Every entry has at least one citation in `citation_source`
- [ ] `vet_audit_status` must be `cleared` before any modifier reaches production
- [ ] Dual-constraint breeds (Cocker Spaniel, SCWT) can fire multiple modifiers simultaneously — cap still applies
