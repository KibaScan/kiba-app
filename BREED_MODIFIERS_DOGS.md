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
  trigger_type: 'ga_threshold' | 'ingredient_pattern' | 'combined' | 'advisory_only' | 'breed_contraindication';  // [DB] — breed_contraindication added per D-112
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
  actionability: 'ga_actionable' | 'ingredient_actionable' | 'not_actionable_from_label' | 'breed_contraindication';  // [DB] — breed_contraindication added per D-112
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

**UI callout:** `"Adjusted for Miniature Schnauzer: breed predisposition to hyperlipidemia and pancreatitis — lower-fat formulas align with clinical risk-reduction strategies."`

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

**UI callout:** `"Adjusted for Wheaten Terrier: breed predisposition to protein-losing conditions — lower-fat, moderate-protein formulas align with clinical management strategies."`

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

**UI callout:** `"Adjusted for German Shepherd: breed predisposition to exocrine pancreatic insufficiency — low-fiber, highly digestible formulas align with clinical management strategies."`

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
| fiber_dmb ≥ 10% | +1 | fiber_sub | Higher fiber improves satiety in POMC carriers. Note: base §4b fiber curve still applies — this +1 is a small signal, not a suppression. D-106 obesity condition provides 50% fiber suppression when applicable. Vet audit flag: consider breed-gated fiber suppression if auditor confirms preventive benefit for healthy-weight Labs. |
| protein_dmb ≥ 30% | +1 | protein_sub | Higher protein reduces short-term food intake |
| caloric_density > 4.0 kcal/g | Advisory only | — | **D-106 compliance:** caloric density is a portion calculator concern, not a score modifier. Surface as UI advisory card tied to portion calculator. |

**Ingredient conditions:** None required — this is a GA-driven concern.

**Mechanism:** 14-bp deletion in POMC gene disrupts β-MSH and β-endorphin production (satiety-signaling neuropeptides) while leaving α-MSH intact. This distinction is clinically significant — loss of β-MSH alone is sufficient to lower resting metabolic rate and increase hunger, even with normal α-MSH levels. ~25% of pet Labs carry the mutation. Per-allele effects: +1.90 kg body weight, +0.48 BCS points. Dual mechanism: increased hunger AND reduced resting metabolic rate.

**UI callout:** `"Adjusted for Labrador Retriever: breed predisposition to obesity (POMC gene) — higher fiber and protein formulas support satiety. See portion calculator for caloric density guidance."`

**Citations:**
- Raffan E et al., *Cell Metabolism*, 2016; DOI: 10.1016/j.cmet.2016.04.012
- Raffan E et al., *Science Advances*, 2024; DOI: 10.1126/sciadv.adj3823
- Weber M et al., *J Vet Intern Med*, 2007; DOI: 10.1892/07-016.1

**Clinical note:** Caloric density is managed via the portion calculator (D-106), not score penalties. D-106 obesity condition provides 50% fiber suppression for obese Labs — healthy-weight Labs get the +1 bonus only. L-carnitine ≥500 ppm in obesity management formulations aids fatty acid transport. Caloric density calculated from macronutrients using modified Atwater factors (protein 3.5, fat 8.5, carb 3.5 kcal/g DMB).

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
| caloric_density > 3.5 kcal/g | Advisory only | — | **D-106 compliance:** caloric density is a portion calculator concern, not a score modifier. Surface as UI advisory card: "Weight management has outsized health impact for brachycephalic breeds. See portion calculator." |
| carb_dmb > 45% | −2 | carb_sub | Obesity-prone breeds; high-carb diets compound reduced exercise tolerance |

**Ingredient conditions:** None required.

**Mechanism:** No breed-specific genetic obesity mutation identified (unlike POMC in Labs). Obesity risk derives from anatomical positive-feedback loop: BOAS → reduced exercise tolerance → reduced caloric expenditure → weight gain → increased pharyngeal fat deposition → worsened BOAS. Pugs have OR 3.12 for overweight — highest of all breeds studied.

**UI callout:** `"Adjusted for [breed_name]: brachycephalic breed — obesity directly worsens airway function. See portion calculator for caloric density guidance."`

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
| caloric_density_me < 3.2 kcal/g as-fed (puppy formula) | Advisory only | — | **D-106 compliance:** caloric density is a portion calculator concern, not a score modifier. Surface as UI advisory card. **NOTE:** Original threshold of 2.8 kcal/g on DMB basis was physically impossible (modified Atwater minimum is ~3.5 kcal/g DMB for any food composition). Threshold corrected to 3.2 kcal/g **as-fed** — the clinical concern is stomach volume (toy puppies fill up on water before getting enough calories), which is an as-fed issue. |
| fiber_dmb > 15% (puppy formula) | Advisory only | — | **D-106 compliance:** May limit caloric intake dangerously in toy puppies, but this is a portion/feeding management concern. Surface as UI advisory card. |

**Ingredient conditions:** None — meal frequency is the primary intervention, not food composition.

**Mechanism:** Transient juvenile hypoglycemia from limited hepatic glycogen stores, immature gluconeogenesis, and high metabolic rate. Yorkshire Terriers have ~36× greater risk of portosystemic liver shunts, which can cause hypoglycemia persisting into adulthood.

**UI callout:** `"Note for Yorkshire Terrier puppy: toy breeds benefit from adequate caloric density and steady, frequent caloric intake to support stable blood sugar."`

**Citations:**
- Idowu O & Heading K, *Can Vet J*, 2018; PMID: 29904216
- Carciofi AC et al., *J Anim Physiol Anim Nutr*, 2008; DOI: 10.1111/j.1439-0396.2007.00794.x

**Clinical note:** Primarily affects puppies <5 months; adults at minimal risk unless concurrent liver shunt. Scoring engine can flag caloric density and fiber as advisories but cannot enforce feeding frequency (D-106 compliance — caloric density is a portion calculator concern). Avoid "light" or weight management diets for Yorkie puppies. Complex carbohydrate sources (oats, brown rice, barley) preferred over refined starches.

---

### Large/Giant Breeds — Calcium (Puppy-Specific)

```
breed_name:            Large/Giant Breed Group (Calcium)
breed_aliases:         [Great Dane, Saint Bernard, Irish Wolfhound, Mastiff, Newfoundland, Bernese Mountain Dog, Great Pyrenees, Leonberger, Tibetan Mastiff, Cane Corso, Labrador Retriever, Golden Retriever, German Shepherd, Rottweiler, Doberman Pinscher, Boxer]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [puppy]  // growth phase ONLY — adult calcium concern is minimal
vet_audit_status:      pending
evidence_strength:     strong
```

**Scope note:** AAFCO defines "Large Breed" for calcium limits as any dog expected to reach ≥70 lbs adult weight. This group includes breeds that have their own independent primary entries (Labrador, Golden Retriever, German Shepherd, Doberman, Boxer). The calcium modifier fires **puppy-only** and stacks with the breed's existing modifiers (subject to ±10 cap). Without this, Kiba gives a perfect score to a 2.2% calcium DMB puppy food for a Golden Retriever — actively putting them at risk for osteochondrosis.

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

**UI callout:** `"Adjusted for [breed_name] puppy: large and giant breed puppies are sensitive to calcium levels — optimal range is 1.2–1.5% DMB with a Ca:P ratio of 1.1:1 to 1.3:1."`

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
| citric_acid_present | Advisory only | — | Glickman/Purdue found elevated GDV risk (OR 3.16, rising to 4.19 when moistened) specifically when dry food containing citric acid was moistened before feeding. Penalizing citric acid outright generates false positives on premium dry foods where the interaction doesn't apply. Surface as advisory: "Contains citric acid. For deep-chested breeds, research indicates elevated GDV risk when dry food containing citric acid is moistened before feeding." |
| rendered_meat_meal_with_bone_in_first_4 | +2 | ingredient_quality | Protective factor, OR 0.47 |

**Mechanism:** Fat in first 4 ingredients may slow gastric emptying; citric acid may promote gas production — both contributing to gastric distension. Glickman/Purdue prospective study of 1,637 dogs identified these as independent risk factors.

**UI callout:** `"Note for [breed_name]: large/deep-chested breeds have elevated GDV risk — [specific concern detected]."`

**Citations:**
- Raghavan M et al., *JAAHA*, 2004; DOI: 10.5326/0400192
- Glickman LT et al., *JAVMA*, 2000; DOI: 10.2460/javma.2000.217.1492

**Clinical note:** Raised food bowls (OR 2.18), fast eating speed, and once-daily feeding also increase GDV risk but are management factors, not food composition — surface as advisory text only.

---

### Calcium Oxalate (CaOx) Risk Group

```
breed_name:            Calcium Oxalate Risk Group
breed_aliases:         [Bichon Frise, Bichon, Shih Tzu, Lhasa Apso, Miniature Poodle, Toy Poodle, Pomeranian, Havanese, Papillon]
trigger_type:          combined
actionability:         ga_actionable + ingredient_actionable
applies_to:            [adult, senior]  // Uroliths are rare in puppies
vet_audit_status:      pending
evidence_strength:     strong (ACVIM Consensus)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| calcium_dmb < 0.6% | −2 | bucket_overall | Paradoxical risk: deficient dietary calcium increases intestinal absorption of unbound oxalates, fueling stone formation. Severe calcium restriction is contraindicated. |
| moisture_pct ≥ 65% | Advisory only | — | **D-106 principle:** High dietary moisture increases urine volume and decreases specific gravity, lowering relative supersaturation of calcium oxalate. This is the most effective non-pharmaceutical intervention (ACVIM Consensus), but it's a food form factor preference, not a nutritional quality signal. Surface as advisory: "High-moisture diets are clinically associated with reduced stone risk for predisposed breeds." |

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| high_oxalate_ingredients_in_top_10 (spinach, sweet potatoes, potatoes, beets, swiss chard, rhubarb) | −2 | ingredient_quality | Exogenous dietary oxalates are absorbed and excreted renally, contributing to urinary supersaturation. Dose-dependent (not binary like urate/SLC2A9), so a score modifier is appropriate rather than D-112 contraindication. |

**Mechanism:** Polygenic predisposition to hypercalciuria and hyperoxaluria. CaOx crystals precipitate when urine is highly concentrated. CaOx stones cannot be medically dissolved — they require surgical removal. Increasing dietary moisture (feeding canned/wet diets) is the most effective non-pharmaceutical intervention. Intestinal calcium binds dietary oxalate in the gut; without adequate dietary calcium, free oxalate is rapidly absorbed into the bloodstream and excreted renally.

**UI callout:** `"Adjusted for [breed_name]: breed predisposition to calcium oxalate urinary stones. High-moisture formulas and oxalate moderation align with clinical risk-reduction research."`

**Citations:**
- Lulich JP et al., *J Vet Intern Med*, 2016; DOI: 10.1111/jvim.14559 (ACVIM Consensus)
- Stevenson AE et al., *Vet Rec*, 2004; DOI: 10.1136/vr.154.4.107
- Dijcker JC et al., *Br J Nutr*, 2012; DOI: 10.1017/S0007114511007033

**Clinical note:** CaOx accounts for ~50% of all canine urinary stones. Unlike struvite stones, CaOx cannot be dissolved medically — surgical removal is required. The moisture advisory is high-value clinical information even without a score modifier. Calcium restriction below 0.6% DMB is paradoxically harmful and should be penalized, not rewarded.

---

### Chinese Shar-Pei (SPAID / Renal Amyloidosis)

```
breed_name:            Chinese Shar-Pei
breed_aliases:         [Shar-Pei, Shar Pei, Sharpei]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [adult, senior]  // amyloid deposition is progressive; kittens/puppies excluded for growth needs
vet_audit_status:      pending
evidence_strength:     strong (genetic), strong (CKD management)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| phosphorus_dmb > 1.8% | −3 | phosphorus_sub | Severely elevated phosphorus accelerates nephron destruction once amyloid deposits begin. |
| phosphorus_dmb > 1.5% AND ≤ 1.8% | −2 | phosphorus_sub | Prophylactic renal protection — above optimal for breeds predisposed to CKD. |

**NOTE:** Thresholds aligned with Persian/Exotic cat phosphorus logic rather than the reviewer's proposed 1.2% (which would flag most standard adult maintenance kibble at 0.8–1.5% DMB). The tiered approach provides progressive penalties without over-flagging normal foods.

**Mechanism:** A regulatory mutation upstream of the HAS2 (hyaluronan synthase 2) gene causes excessive hyaluronan production, leading to Shar-Pei Autoinflammatory Disease (SPAID) — periodic fever syndromes and chronic systemic inflammation. This drives hepatic overproduction of Serum Amyloid A (SAA), which deposits as amyloid fibrils in the renal medulla, eventually causing terminal kidney failure.

**UI callout:** `"Adjusted for Shar-Pei: breed predisposition to autoinflammatory renal amyloidosis (SPAID). Phosphorus moderation aligns with renal support research for breeds predisposed to amyloidosis."`

**Citations:**
- Olsson M et al., *PLoS Genet*, 2011; DOI: 10.1371/journal.pgen.1001332
- Segev G et al., *J Vet Intern Med*, 2012; DOI: 10.1111/j.1939-1676.2011.00843.x
- DiBartola SP et al., *JAVMA*, 1990

**Clinical note:** Direct canine parallel to Persian/Abyssinian cat amyloidosis logic. SPAID affects an estimated 20–25% of Shar-Peis. Renal amyloidosis is the leading cause of death in the breed. The phosphorus penalty is prophylactic — once CKD is clinically diagnosed, therapeutic renal diets are prescribed by veterinarians. Kiba's role is flagging sub-optimal phosphorus levels before diagnosis.

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

**UI callout:** `"Note for Doberman: DCM is primarily genetic in this breed (PDK4/TTN mutations). Dietary optimization (taurine, L-carnitine) is supportive only. Genetic screening (PDK4/TTN) provides definitive risk assessment."`

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
trigger_type:          breed_contraindication
actionability:         breed_contraindication
applies_to:            [all]  // clinical onset typically 4–7 months but lifelong sensitivity
vet_audit_status:      pending
evidence_strength:     strong (in documented lines)
```

**Ingredient conditions (BREED CONTRAINDICATION per D-112):**

| Condition | Effect | Rationale |
|---|---|---|
| any_gluten_grain_present (wheat, barley, rye, oats + derivatives) | **Breed contraindication card** (zero score impact, red warning card above fold) | Gluten-sensitive enteropathy — any amount can trigger partial villous atrophy. A −4 ingredient penalty produces only ~2.2 points on the final composite (−4 × 0.55 IQ weight) — "91% match" for a food causing intestinal damage. **NOTE:** Oats (avenin) are RETAINED in this trigger list despite not containing classical gluten — Hall & Batt (1991) demonstrated partial villous atrophy in Irish Setters exposed to avenin specifically. |

**Contraindication card text (D-112):** `"Contains gluten-containing grains. Irish Setters have documented gluten-sensitive enteropathy with partial villous atrophy. Clinical resolution occurs on gluten-free diets."`

**Mechanism:** Autosomal recessive single-locus inheritance causes cell-mediated immune response to prolamin fractions (gliadin, hordein, secalin, avenin). Partial villous atrophy in proximal small intestine. Complete resolution on gluten-free diet.

**UI callout:** `"Flagged for Irish Setter: documented gluten-sensitive enteropathy — formulas without gluten-containing grains are associated with complete clinical resolution."`

**Citations:**
- Garden OA et al., *Am J Vet Res*, 2000; DOI: 10.2460/ajvr.2000.61.462
- Hall EJ & Batt RM, *Res Vet Sci*, 1991; DOI: 10.1016/0034-5288(91)90036-N

**Clinical note:** Entirely ingredient-list concern — GA provides zero signal. Rice and corn are safe. Since not all Irish Setters carry the homozygous genotype (~0.8% prevalence in study populations), flag as breed-specific caution rather than absolute prohibition.

---

### Border Terrier

```
breed_name:            Border Terrier
breed_aliases:         [Border]
trigger_type:          breed_contraindication
actionability:         breed_contraindication
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**Ingredient conditions (BREED CONTRAINDICATION per D-112):**

| Condition | Effect | Rationale |
|---|---|---|
| any_gluten_grain_present (wheat, barley, rye) | **Breed contraindication card** (zero score impact, red warning card above fold) | Paroxysmal gluten-sensitive dyskinesia (PGSD). A −3 ingredient penalty produces only ~1.65 points on the final composite — insufficient to communicate binary neurological risk. **NOTE:** Oats are NOT included in this trigger (unlike Irish Setter) — Lowrie studies characterized PGSD with wheat-based triggers only. Oats (avenin) were not part of the documented PGSD profile. |

**Contraindication card text (D-112):** `"Contains gluten-containing grains. Border Terriers have documented paroxysmal gluten-sensitive dyskinesia (PGSD). Clinical resolution occurs on gluten-free diets."`

**Mechanism:** Immunologic response against transglutaminase-2 (TG2) and gliadin proteins produces elevated anti-gliadin IgG and anti-TG2 IgA. Triggers paroxysmal dyskinesia, GI signs, and dermatological signs. Complete resolution on gluten-free diet.

**UI callout:** `"Flagged for Border Terrier: documented gluten-sensitive dyskinesia — formulas without gluten-containing grains are associated with complete clinical resolution."`

**Citations:**
- Lowrie M et al., *J Vet Intern Med*, 2015; DOI: 10.1111/jvim.13643
- Lowrie M et al., *J Vet Intern Med*, 2018; DOI: 10.1111/jvim.15038

**Clinical note:** The ONLY breed with formally characterized PGSD. Any amount of gluten can trigger episodes. GA provides no signal.

---

### Cavalier King Charles Spaniel (MMVD / Cardiac)

```
breed_name:            Cavalier King Charles Spaniel
breed_aliases:         [Cavalier, CKCS, Cav, Cavie, King Charles]
trigger_type:          ingredient_pattern
actionability:         ingredient_actionable
applies_to:            [adult, senior]  // MMVD is progressive; near-universal by age 10
vet_audit_status:      pending
evidence_strength:     strong (disease penetrance), moderate (sodium timing)
```

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| salt_is_standalone_ingredient_in_top_10 | Advisory only | — | ACVIM 2019 guidelines indicate mild-to-moderate sodium restriction for progressive MMVD to delay volume overload. Advisory-only because salt position in ingredient list is an imperfect proxy for total sodium content. |
| omega_3_supplement_present (fish oil, salmon oil, marine microalgae, EPA, DHA) | +1 | bucket_overall | EPA/DHA provides myocardial metabolic support and reduces inflammatory cytokines. Low-risk positive signal. |

**Mechanism:** Polygenic inheritance leads to early-onset myxomatous degeneration of the mitral valve leaflets. By age 10, MMVD approaches 100% prevalence in CKCSs. As the disease progresses from Stage B1 → B2 → C, the Renin-Angiotensin-Aldosterone System (RAAS) activates, causing sodium and water retention, volume overload, and eventually congestive heart failure. The 2019 ACVIM consensus guidelines explicitly advise avoiding high-sodium diets in progressive stages.

**UI callout:** `"Note for Cavalier: near-universal breed prevalence of mitral valve disease (MMVD). Sodium moderation and marine omega-3s align with cardiac support research for this breed."`

**Citations:**
- Keene BW et al., *J Vet Intern Med*, 2019; DOI: 10.1111/jvim.15488 (ACVIM Consensus)
- Häggström J et al., *J Vet Intern Med*, 2004; DOI: 10.1111/j.1939-1676.2004.tb02612.x
- Freeman LM et al., *JAVMA*, 2006; DOI: 10.2460/javma.228.10.1546

**Clinical note:** MMVD is the leading cause of death in Cavaliers and one of the most common heart diseases in all dogs. Cavalier owners are a highly engaged demographic — not having this breed covered is a visible gap. Salt position in the ingredient list is an imperfect proxy (quantity matters more than position), so salt triggers advisory-only rather than a score penalty. Marine omega-3s (EPA/DHA specifically, not plant-based ALA) have the strongest evidence for cardiac support.

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
| Organ meats in top 10 (beef liver, lamb liver, venison liver) | Elevate advisory severity | High copper content sources — this is the meaningful signal |

**NOTE:** Copper supplement presence (copper_sulfate, copper_proteinate, copper_amino_acid_chelate) was **removed** as a trigger. AAFCO mandates minimum copper (7.3 mg/kg DM), so 99.9% of commercial foods contain these exact ingredients. Triggering on their presence fires the advisory on literally every scan a Bedlington owner performs, causing immediate alert fatigue and rendering the warning useless. The advisory now fires based on: (1) breed profile active → always show baseline advisory, (2) organ meats in top 10 → elevate severity.

**Modifier:** Advisory note only — no score change. `"Bedlington Terriers have a genetic copper storage defect (COMMD1). Copper levels cannot be assessed from this label. Consult your veterinarian regarding your dog's copper status."`

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

**Ingredient-level proxy flags:** Same as Bedlington Terrier (organ meats in top 10 only — copper supplement triggers removed due to alert fatigue, see Bedlington entry).

**Modifier:** Advisory note only — no score change. `"West Highland White Terriers have documented familial copper storage disease. Copper levels cannot be assessed from this label. Consult your veterinarian."`

**Mechanism:** Familial/hereditary copper storage with decreased biliary excretion. Causal gene UNKNOWN (COMMD1 and ATP7B excluded). Key difference from Bedlingtons: copper levels may plateau or decrease with age; rarely exceeds 2,000 µg/g DW.

**Citations:**
- Thornburg LP et al., *Vet Pathol*, 1986; DOI: 10.1177/030098588602300209
- Thornburg LP et al., *Vet Pathol*, 1996; DOI: 10.1177/030098589603300604
- Ullal TV et al., *J Vet Intern Med*, 2022; DOI: 10.1111/jvim.16580

**Clinical note:** Lower severity than Bedlington Terrier — copper accumulation is less extreme and may plateau.

---

### Siberian Husky / Alaskan Malamute / Samoyed

```
breed_name:            Northern Breed Group (Zinc)
breed_aliases:         [Siberian Husky, Husky, Alaskan Malamute, Malamute, Samoyed, Sammy]
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
| High-phytate ingredients in top 5 (soybean meal, soy flour, wheat bran, corn gluten meal, peas, chickpeas, lentils, pea protein, pea starch) | Flag as advisory | Phytate chelates zinc, reducing absorption by up to 35%. **NOTE:** Legumes added — they are among the highest phytate sources in modern grain-free pet foods and are heavily implicated in contemporary zinc-responsive dermatosis cases. |
| calcium_dmb > 2% (if available) | Flag as advisory | Excess calcium interferes with zinc absorption |

**Modifier:** Advisory note only — no score change. `"Northern breeds (Huskies, Malamutes, Samoyeds) have a hereditary zinc absorption defect. High-phytate ingredients may worsen zinc availability. Consult your veterinarian regarding your dog's zinc status."`

**Mechanism:** Suspected hereditary defect in intestinal zinc absorption — only 25% of zinc absorbed vs. normal controls. Deficiency → impaired keratinocyte differentiation → parakeratotic hyperkeratosis → crusting at mucocutaneous junctions.

**Citations:**
- White SD et al., *Vet Dermatol*, 2001; DOI: 10.1046/j.1365-3164.2001.00233.x
- Colombini S & Dunstan RW, *JAVMA*, 1997
- Boyanowski KJ, *Vet Clin North Am Small Anim Pract*, 1999; DOI: 10.1016/S0195-5616(99)50133-2

**Clinical note:** Even optimal food cannot replace zinc supplementation for Syndrome I dogs. Chelated zinc forms (zinc methionine, zinc proteinate) have better bioavailability than zinc oxide. Grain-free or low-grain formulations may reduce phytate interference.

---

### Shetland Sheepdog (UPGRADED to Tier 1 — Gallbladder Mucoceles)

```
breed_name:            Shetland Sheepdog
breed_aliases:         [Sheltie, Shetland]
trigger_type:          combined
actionability:         ga_actionable + advisory (copper)
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (GBM/dyslipidemia — OR 9.3), emerging (copper)
```

**GA conditions (PRIMARY — Gallbladder Mucoceles):**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 16% | −4 | fat_sub | Exacerbates underlying dyslipidemia and biliary sludging. Shelties have OR 9.3 for GBM vs other breeds. High dietary fat requires high bile secretion, severely exacerbating the ABCB4-driven pathological cascade. |
| fat_dmb > 12% AND ≤ 16% | −2 | fat_sub | Caution zone for susceptible dogs — intermediate biliary stress. |

**NOTE:** This is NOT a D-106 violation. Fat restriction here targets biliary pathology (gallbladder mucocele prevention), not weight management. Same distinction as Miniature Schnauzer fat/pancreatitis.

**Ingredient conditions (SECONDARY — Copper advisory, retained from original Tier 3):**

Advisory note only (no score change): `"Some reports of copper accumulation in Shetland Sheepdogs. Evidence is limited. General copper-conscious dietary choices may be beneficial."`

**Mechanism (GBM):** ABCB4 gene insertion causes a phospholipid flippase defect (highly prevalent in Shelties). Combined with breed-wide idiopathic hyperlipidemia, this results in toxic bile salt accumulation and biliary hypersecretion of mucus. High dietary fat increases bile secretion volume, directly exacerbating the pathological cascade. GBM rupture causes bile peritonitis — a surgical emergency with ~30% mortality.

**Mechanism (Copper):** No specific gene mutation identified. If copper accumulation occurs, likely secondary to excessive dietary intake rather than primary genetic defect. Monitor for future research.

**UI callout:** `"Adjusted for Shetland Sheepdog: strong breed predisposition to dyslipidemia and gallbladder mucoceles (OR 9.3). Lower-fat formulas reduce biliary stress."`

**Citations:**
- Cullen JM et al., *Vet Pathol*, 2006; DOI: 10.1354/vp.43-1-27
- Allerton F et al., *J Vet Intern Med*, 2022; DOI: 10.1111/jvim.16370
- Aguirre AL et al., *JAVMA*, 2007; DOI: 10.2460/javma.231.12.1868
- Strickland JM et al., *J Vet Intern Med*, 2018; DOI: 10.1111/jvim.15230 (copper)

**Clinical note:** GBM is the primary, high-confidence dietary concern for Shelties (OR 9.3, identified gene, clear dietary mechanism). The copper concern remains advisory-only with emerging evidence. Both can coexist in the same breed profile — the fat modifier fires as a score adjustment, the copper advisory surfaces as a UI note.

---

## Urate Risk Group — SLC2A9 (Contraindication + GA Hybrid — D-112)

```
breed_name:            Urate Risk Group (SLC2A9)
breed_aliases:         [Dalmatian, Dal, Dalmatian Dog, English Bulldog, British Bulldog, Black Russian Terrier, BRT]
trigger_type:          combined
actionability:         breed_contraindication (purine sources) + ga_actionable (protein % as secondary)
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong
```

**Scope note:** The same SLC2A9 missense mutation (C188F) causing impaired hepatic urate transport has been confirmed in Dalmatians, English Bulldogs, and Black Russian Terriers (Karmi N et al., *PLoS Genet*, 2010). All breeds in this group share identical contraindication logic.

**Ingredient conditions (primary — BREED CONTRAINDICATION per D-112):**

| Condition | Effect | Rationale |
|---|---|---|
| high_purine_ingredients_present (organ meats, sardines, anchovies, mackerel, brewer's yeast) | **Breed contraindication card** (zero score impact, red warning card above fold) | SLC2A9 mutation — 100% penetrance. A sub-score penalty of −5 produces only ~0.5 points on the final composite after weighting — displaying "94% match" for a food that causes urate urinary blockage. This is a binary medical risk, not a nutritional preference. |
| no_high_purine AND protein_dmb > 30% from meat/poultry/fish sources (EXCLUDING egg and dairy) | −2 | protein_sub | Cumulative purine load even from moderate-purine proteins. **NOTE:** Egg and dairy are explicitly excluded — they are virtually purine-free animal proteins and are the basis of most veterinary urological diets for SLC2A9-affected breeds. |

**Contraindication card text (D-112):** `"Contains high-purine protein sources. [breed_name] has a genetic uric acid metabolism defect (SLC2A9) that causes urate stone formation when fed high-purine proteins. Egg and dairy-based proteins are low-purine alternatives."`

**GA conditions (secondary):**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| protein_dmb > 35% AND high_purine_ingredient_detected | −3 | protein_sub | Compounds purine load |

**Mechanism:** SLC2A9 missense mutation (C188F) — impaired hepatic urate transport → 400–600 mg uric acid/day (vs. 10–60 mg normal). Precipitates as urate uroliths. Confirmed in Dalmatians (Bannasch 2008), English Bulldogs (Karmi 2010), and Black Russian Terriers (Karmi 2010).

**UI callout:** `"Adjusted for [breed_name]: genetic uric acid metabolism defect (SLC2A9) — high-purine protein sources are flagged as a breed contraindication (D-112). Low-purine proteins (egg, dairy) are not penalized."`

**Citations:**
- Bannasch D et al., *PLoS Genetics*, 2008; DOI: 10.1371/journal.pgen.1000246
- Karmi N et al., *PLoS Genetics*, 2010; DOI: 10.1371/journal.pgen.1001166
- Bartges JW et al., *Vet Clin North Am Small Anim Pract*, 1999; DOI: 10.1016/S0195-5616(99)50009-5
- Lulich JP et al., *J Vet Intern Med*, 2016; DOI: 10.1111/jvim.14559

**Clinical note:** GA alone CANNOT detect purine risk. Two foods with identical protein % can differ radically in purine content (egg = low; organ meat = very high). Wet/high-moisture foods are mildly protective (promote urine dilution). **D-112 rationale:** The original −5 protein_sub penalty produced only ~0.5 points on the final composite after weighting (−5 × 0.35 protein weight × 0.30 NP bucket = −0.525). A "94% match" for a food causing emergency urate blockage is a liability failure. Breed contraindication card (red, above fold, zero score impact) correctly communicates the binary risk. **Group note:** English Bulldogs may have incomplete penetrance compared to Dalmatians (not all carry the mutation homozygously). Vet audit should confirm whether contraindication vs. advisory is more appropriate for Bulldogs specifically.

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
- [ ] **D-112 Breed Contraindications** implemented for Urate Risk Group (Dalmatian, English Bulldog, BRT — purines), Irish Setter (gluten+oats), Border Terrier (gluten, no oats) — red warning card, zero score impact, same visual treatment as D-097 allergen `direct_match`
- [ ] Ingredient-pattern detection requires: grain-free flag, legume detection (peas, lentils, chickpeas, beans + derivatives), gluten grain detection (wheat, barley, rye, oats), taurine/L-carnitine in supplement list, organ meat detection, citric acid detection, fat source position detection, **high-purine source detection** (organ meats, sardines, anchovies, mackerel, brewer's yeast), **egg/dairy protein exclusion** for urate group purine trigger, **high-oxalate ingredient detection** (spinach, sweet potatoes, potatoes, beets, swiss chard, rhubarb), **salt position detection** for CKCS, **omega-3 supplement detection** (fish oil, salmon oil, marine microalgae, EPA, DHA)
- [ ] Life stage gating: Large/Giant breed calcium modifiers fire ONLY for puppies; Yorkshire Terrier fires ONLY for puppies; CaOx Group fires adult/senior only; Shar-Pei fires adult/senior only; CKCS fires adult/senior only; all others fire for `[all]`
- [ ] Modifier cap: sum of all breed modifiers within the nutritional bucket ≤ |10|
- [ ] Advisory-only entries (Tier 3) surface as UI callouts but produce zero score delta
- [ ] **D-106 compliance verified:** Zero caloric density score penalties anywhere (Lab, Brachy, Yorkie all converted to advisory cards). CaOx moisture bonus converted to advisory-only (food form factor, not nutritional quality). D-106 obesity fiber suppression covers obese Labs; healthy-weight Labs get +1 bonus only. **Vet audit flag:** consider breed-gated fiber suppression if auditor confirms preventive benefit.
- [ ] **GDV citric acid:** Advisory-only with moistening context (not a score penalty)
- [ ] **Bedlington/WHWT copper:** Advisory triggered by breed profile + organ meats only (copper supplement triggers removed — alert fatigue)
- [ ] **Northern breeds phytate list:** Includes legumes (peas, chickpeas, lentils, pea protein, pea starch) alongside legacy soy/wheat bran/corn gluten meal. **Samoyed added to group.**
- [ ] **Oat handling:** Included in Irish Setter trigger (avenin evidence), excluded from Border Terrier trigger (no PGSD evidence)
- [ ] Every entry has at least one citation in `citation_source`
- [ ] `vet_audit_status` must be `cleared` before any modifier reaches production
- [ ] Dual-constraint breeds (Cocker Spaniel, SCWT) can fire multiple modifiers simultaneously — cap still applies
- [ ] **D-095 UPVM compliance:** All UI callouts reviewed — no "recommended," "consult your veterinarian about [treatment]," or prescriptive feeding schedules
- [ ] **Urate Risk Group:** Dalmatian + English Bulldog + BRT share identical D-112 contraindication logic (SLC2A9). Egg/dairy protein exclusion applies to all.
- [ ] **Large/Giant Breed Calcium:** Now includes Lab, Golden, GSD, Rottweiler, Doberman, Boxer (AAFCO ≥70 lbs definition). These breeds have independent primary entries — calcium modifier stacks puppy-only.
- [ ] **CaOx Risk Group:** Calcium < 0.6% DMB is penalized (paradoxical oxalate risk). Moisture ≥65% is advisory-only. Oxalate ingredient flag at −2.
- [ ] **CKCS / MMVD:** Salt position is advisory-only (imperfect proxy). Omega-3 supplement is +1 bonus.
- [ ] **Shar-Pei / SPAID:** Phosphorus thresholds aligned with Persian cat approach (>1.5% → −2, >1.8% → −3). Adult/senior only.
- [ ] **Shetland Sheepdog UPGRADED:** Now Tier 1 GA-actionable for fat (GBM, OR 9.3). Copper advisory retained as secondary.
