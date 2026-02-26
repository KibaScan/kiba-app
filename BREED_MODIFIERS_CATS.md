# Kiba — Cat Breed Nutritional Modifiers

> **Status:** DRAFT — Requires vet auditor review before production use
> **Referenced by:** `NUTRITIONAL_PROFILE_BUCKET_SPEC.md` §6b
> **Purpose:** Structured breed-specific modifier data for the scoring engine. Each entry maps to a row in the `breed_modifiers` table.
> **Cap rule:** Total breed modifiers within the nutritional bucket are capped at ±10 points (see spec §6c).
> **Critical context:** Feline breed-specific nutrition research has enormous evidence gaps compared to canine research. Most cat breed health conditions are purely genetic and not modifiable by food composition. This file explicitly documents breeds with NO dietary modifier to prevent the scoring engine from inventing penalties where the science doesn't support them.

---

## Schema

Identical to `BREED_MODIFIERS_DOGS.md`. Fields marked `[DB]` are stored in Supabase and consumed by the scoring engine at runtime. Fields marked `[AUDIT]` are for vet review tracking only.

```typescript
interface BreedModifier {
  breed_name: string;                    // [DB]
  breed_aliases: string[];               // [DB]
  trigger_type: 'ga_threshold' | 'ingredient_pattern' | 'combined' | 'advisory_only' | 'no_modifier';  // [DB]
  ga_conditions: GaCondition[] | null;   // [DB]
  ingredient_conditions: IngredientCondition[] | null;  // [DB]
  modifier_points: number;               // [DB]
  modifier_target: 'protein_sub' | 'fat_sub' | 'fiber_sub' | 'carb_sub' | 'phosphorus_sub' | 'bucket_overall' | 'advisory_only' | 'none';  // [DB]
  applies_to: LifeStage[];              // [DB]
  species: 'cat';                        // [DB]
  evidence_strength: 'strong' | 'moderate' | 'emerging' | 'none';  // [AUDIT]
  mechanism_summary: string;             // [AUDIT]
  citations: Citation[];                 // [DB]
  ui_callout: string;                    // [DB]
  clinical_note: string;                 // [AUDIT]
  vet_audit_status: 'cleared' | 'pending' | 'blocked' | 'not_started';  // [AUDIT]
  actionability: 'ga_actionable' | 'ingredient_actionable' | 'not_actionable_from_label' | 'no_dietary_modifier';  // [DB]
}
```

---

## Global Finding: Taurine Does NOT Modify Genetic HCM

This applies to Maine Coon, Ragdoll, Sphynx, British Shorthair, and any other HCM-predisposed breed. The scoring engine MUST NOT apply a taurine modifier for HCM breeds.

**Rationale:** Taurine deficiency causes dilated cardiomyopathy (DCM) — thin, poorly contracting ventricles. Genetic HCM produces thickened walls with impaired relaxation. These are fundamentally different diseases. AAFCO mandates taurine at ≥0.10% DM (dry) and ≥0.20% DM (wet), which effectively eliminated taurine-deficiency DCM. No study has demonstrated that above-minimum taurine levels affect genetic HCM. The ACVIM consensus statement (Luis Fuentes et al., 2020) does not recommend taurine supplementation for HCM unless concurrent systolic dysfunction suggests DCM overlap.

Two small dietary trials (Freeman et al., 2014, n=29; van Hoek et al., 2020, n=44) found no significant between-group differences in ventricular wall thickness.

**Citation:** Luis Fuentes V et al., ACVIM consensus, *J Vet Intern Med*, 2020;34(3):1062–1077, DOI: 10.1111/jvim.15745

---

## Global Finding: Fat — Not Carbohydrate — Is the Primary Feline Obesity Driver

This is counterintuitive but consistently supported by the literature. It affects how obesity-related breed modifiers target sub-scores.

Backus et al. (2007) demonstrated that gonadectomy plus high dietary fat, not high dietary carbohydrate, induced body fat gains. A 2025 meta-analysis confirmed carbohydrates (2.8–57% ME) are not a risk factor for body fat mass in cats. Carbohydrate restriction remains well-supported specifically for diabetes management (reducing postprandial glucose spikes in insulin-resistant cats) but not for general obesity prevention.

**Implication for scoring:** Obesity-predisposed breeds should penalize fat DMB as the primary macronutrient concern. Carb penalties for obesity should be secondary.

**Citations:**
- Backus RC et al., *Br J Nutr*, 2007;98:641–650, DOI: 10.1017/S0007114507750869
- Saavedra et al., *J Feline Med Surg*, 2024, DOI: 10.1177/1098612X241285519
- Godfrey H, Ellis JL, Verbrugghe A, *J Anim Sci*, 2025, DOI: 10.1093/jas/skaf071 (meta-analysis confirming dietary carbohydrates do not increase body fat or fasted insulin/glucose in cats)

---

## Global Finding: Phosphorus Source Matters as Much as Amount

Inorganic phosphate salts (sodium tripolyphosphate, dicalcium phosphate, monocalcium phosphate) are more bioavailable and potentially more nephrotoxic than organic phosphorus bound in meat protein. Alexander et al. (2019) showed diets with soluble phosphorus >3.0 g/1000 kcal at low Ca:P ratios (0.6–0.9) damaged kidneys in healthy cats within weeks.

**Implication for scoring:** Phosphorus-sensitive breed modifiers should include an ingredient-level flag for inorganic phosphate salts, not just total phosphorus percentage.

**Citation:** Alexander J et al., *Br J Nutr*, 2019;121(3):249–69, DOI: 10.1017/S0007114518002751

---

## Tier 1 — GA-Actionable Breeds (Score Modifiers)

Only **three breed groups** have sufficient evidence for GA-based scoring adjustments: Burmese (carbohydrate), Persian/Exotic (phosphorus), and British Shorthair (fat/caloric density).

---

### Burmese

```
breed_name:            Burmese
breed_aliases:         [Burmese Cat, Australian Burmese, European Burmese, American Burmese]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // diabetes risk peaks at age 13.6yr but metabolic vulnerability is lifelong
vet_audit_status:      pending
evidence_strength:     strong (diabetes predisposition), strong (general feline low-carb DM management), none (Burmese-specific dietary prevention)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| carb_dmb > 30% | −5 | carb_sub | High risk — 3–4× diabetes prevalence; intrinsically higher insulin, lower adiponectin |
| carb_dmb > 20% AND ≤ 30% | −3 | carb_sub | Concern threshold — above low-carb therapeutic target |
| carb_dmb ≤ 20% | 0 | — | Within acceptable range |

**Ingredient conditions:** None required — this is a GA-driven carbohydrate concern.

**Stacking rule:** This modifier SHOULD stack with the general feline carb penalty (spec §4b cat carb curve). Burmese predisposition compounds the species-level concern.

**Mechanism:** Burmese diabetes is polygenic (Samaha et al., 2020 GWAS: associated haplotypes on chromosomes A3, B1, E1) with 3–4× increased prevalence vs. other breeds (Lederer et al., 2009: 22.4/1,000 Burmese vs. 7.6/1,000 domestic cats in Brisbane). Öhlund et al. (2021) demonstrated intrinsically higher insulin and lower adiponectin concentrations in Burmese vs. Maine Coons even after adjusting for body weight — indicating metabolic differences independent of obesity. Low-carb diets (≤12% ME from carbohydrate, ~12–15% carb DMB) improve glycemic control and increase remission rates in diabetic cats generally (Bennett et al., 2006: 68% insulin discontinuation on low-carb vs. 41% on moderate-carb).

**Critical geographic note:** American Burmese (genetically divergent population) do NOT show elevated diabetes risk (Panciera et al., 1990; Prahl et al., 2003). The scoring engine cannot distinguish geographic lineage from breed name alone. **Decision needed:** Apply modifier conservatively to all Burmese, or require lineage specification in pet profile. Recommend: apply to all with advisory note acknowledging the distinction.

**UI callout:** `"Adjusted for Burmese: breed predisposition to diabetes mellitus — lower-carbohydrate formulas preferred."`

**Advisory note (WNK4 — not a score modifier):** Burmese lineage cats with hypokalemic episodes (WNK4 c.2899C>T, autosomal recessive) require pharmaceutical potassium supplementation — standard dietary potassium (AAFCO min 0.6% K DMB) is insufficient. This is NOT a food-composition scoring issue. Affected breeds: Burmese, Bombay, Tonkinese, Burmilla, Australian Mist, Singapura.

**Citations:**
- Samaha G et al., *Sci Rep*, 2020;10:19194, DOI: 10.1038/s41598-020-76166-3
- Lederer R et al., *Vet J*, 2009;179(2):254–258, DOI: 10.1016/j.tvjl.2007.09.019
- Öhlund M et al., *PLoS One*, 2021, PMID: 33886598
- Bennett N et al., *J Feline Med Surg*, 2006;8(2):73–84
- Gandolfi B et al., *PLoS One*, 2012;7(12):e53173, DOI: 10.1371/journal.pone.0053173

**Clinical note:** No Burmese-specific carb restriction trial exists — all evidence is extrapolated from general feline diabetes studies. This is an evidence gap, not a reason to withhold the modifier, given the strong metabolic predisposition data. The potassium concern (WNK4) requires pharmaceutical supplementation and is explicitly NOT a food-scoring issue.

---

### Persian / Exotic Shorthair (PKD Phosphorus Group)

```
breed_name:            PKD Phosphorus Group
breed_aliases:         [Persian, Persian Cat, Exotic Shorthair, Exotic, Exotic Cat]
trigger_type:          combined
actionability:         ga_actionable + ingredient_actionable
applies_to:            [all]  // cysts present from birth; CKD typically by age 7
vet_audit_status:      pending
evidence_strength:     strong (CKD phosphorus management), emerging (PKD-specific cyst reduction — mouse model only), moderate (prophylactic P avoidance)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| phosphorus_dmb > 1.8% | −2 | phosphorus_sub | Accelerates CKD progression; 38% of Persians / 41% of Exotics carry PKD1 |
| phosphorus_dmb ≤ 1.8% AND ca_p_ratio ≥ 1.0 | 0 | — | Acceptable range |
| phosphorus_dmb ≤ 1.8% AND ca_p_ratio < 1.0 | −1 | phosphorus_sub | Low Ca:P ratio increases nephrotoxicity even at moderate P levels |

**Ingredient conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| inorganic_phosphate_salts_present (sodium tripolyphosphate, dicalcium phosphate, monocalcium phosphate) | −1 | ingredient_quality | ~2× bioavailability vs. organic phosphorus from meat; Alexander et al. (2019) demonstrated renal damage from soluble P at low Ca:P |

**Stacking rule:** This modifier should NOT stack with a general "cat renal" penalty if one exists — this IS the renal concern for these breeds. The ingredient-level phosphate salt flag CAN stack with the GA phosphorus condition (both can fire).

**Mechanism:** PKD1 c.10063 C>A mutation (autosomal dominant) produces truncated polycystin-1 protein → progressive renal cyst development from birth → CKD (typically by age 7). High dietary phosphorus (especially from inorganic sources) accelerates CKD progression via FGF-23 elevation, secondary hyperparathyroidism, and renal mineralization. In a mouse PKD model, Omede et al. (2019) showed phosphate restriction reduced cyst number by 25% and upregulated renal Klotho expression. Exotic Shorthairs carry the identical PKD1 mutation at equivalent prevalence (~41%) — the scoring engine should apply identical rules.

**UI callout:** `"Adjusted for [breed_name]: high PKD prevalence (~38–41%) — lower phosphorus, especially from non-inorganic sources, is prudent."`

**Citations:**
- Lyons LA et al., *J Am Soc Nephrol*, 2004;15(10):2548–55, DOI: 10.1097/01.ASN.0000141776.38527.BB
- Ross SJ et al., *JAVMA*, 2006;229(6):949–57
- Geddes RF et al., *J Vet Intern Med*, 2013;27(6):1354–61, DOI: 10.1111/jvim.12187
- Alexander J et al., *Br J Nutr*, 2019;121(3):249–69, DOI: 10.1017/S0007114518002751
- Omede F et al., *Am J Physiol Renal Physiol*, 2019;318(1):F35–F42, DOI: 10.1152/ajprenal.00282.2019

**Clinical note:** Phosphorus restriction does not prevent PKD (cysts are present from birth) but may slow CKD progression once kidney function declines. Formal renal diet phosphorus restriction (0.3–0.6% P DMB) applies at IRIS CKD Stage 2+. Protein restriction is controversial — avoid severe restriction (<26% DMB, causes sarcopenia); moderate protein (30–40% DMB) with high biological value preferred. Ca:P ratio ≥1.0 is important.

---

### British Shorthair

```
breed_name:            British Shorthair
breed_aliases:         [BSH, British Blue, British Shorthair Cat]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // highest risk post-neutering; BSH males are highest-risk demographic
vet_audit_status:      pending
evidence_strength:     strong (obesity predisposition), moderate (fat as primary driver), weak (specific DMB thresholds)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb > 20% | −2 | fat_sub | 48% classified overweight; fat is primary feline obesity macronutrient driver |
| carb_dmb > 25% | −1 | carb_sub | Compounds obesity risk in already-predisposed breed |

**Ingredient conditions:** None required.

**Stacking rule:** This modifier SHOULD stack with the general cat species-level carb penalty. BSH obesity risk compounds the general feline metabolic mismatch with high-carb diets.

**Mechanism:** Murphy et al. (2023) found 48% of BSH cats overweight (BCS >5/9, mean BCS 5.8/9). BSH cats exceeding 3.3 kg before 12 months had dramatically shortened lifespan (median 6.6 years to 20% mortality vs. 12.3 years for cats staying under 3.3 kg). Corbee (2014) confirmed significantly higher BCS in BSH vs. lean breeds at cat shows.

**UI callout:** `"Adjusted for British Shorthair: strong obesity predisposition — lower-fat formulas preferred. Weight management has outsized health impact for this breed."`

**Citations:**
- Murphy BJ et al., *Front Vet Sci*, 2023;10:1241080, DOI: 10.3389/fvets.2023.1241080
- Corbee RJ, *J Anim Physiol Anim Nutr*, 2014;98(2):227–232
- Backus RC et al., *Br J Nutr*, 2007;98:641–650, DOI: 10.1017/S0007114507750869

**Clinical note:** BSH also carries familial HCM risk (unknown mutation — Meurs et al. 2009 screened 8 sarcomeric genes with no variants found). NO dietary modifier for BSH HCM. Neutering is a stronger obesity risk factor than breed — BSH neutered males are the highest-risk demographic.

---

## Tier 2 — Soft Modifiers (Weaker Evidence, Smaller Adjustments)

These breeds have real but less well-documented dietary vulnerabilities. Modifiers are smaller and more conservative.

---

### Abyssinian / Somali (Renal Amyloidosis Phosphorus Group)

```
breed_name:            Renal Amyloidosis Phosphorus Group
breed_aliases:         [Abyssinian, Aby, Somali, Somali Cat]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // amyloidosis onset varies widely
vet_audit_status:      pending
evidence_strength:     strong (familial amyloidosis), strong (CKD phosphorus management), none (dietary prevention of amyloid deposition)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| phosphorus_dmb > 1.8% | −1 | phosphorus_sub | Prophylactic renal protection; softer than Persian because penetrance is lower and unpredictable |

**Ingredient conditions:** Same inorganic phosphate salt flag as Persian, but advisory only (no score change) given weaker justification.

**Stacking rule:** Should NOT stack aggressively — this is a softer prophylactic concern. Many Abyssinians/Somalis never develop clinical amyloidosis.

**Mechanism:** Familial AA amyloidosis involves chronic overproduction of SAA protein, which misfolds into β-sheet fibrils depositing in renal medulla and glomeruli. Giordano et al. (2021) confirmed this is polygenic with wild-type (non-mutated) proteins. The condition is biochemically driven by chronic inflammation, not diet. Once sufficient amyloid accumulates, CKD develops and standard phosphorus restriction applies (IRIS guidelines).

**UI callout:** `"Note for [breed_name]: familial renal amyloidosis risk — moderate phosphorus levels are prudent. Amyloid deposition is not modifiable by diet composition."`

**Citations:**
- DiBartola SP et al., *Am J Vet Res*, 1986;47:2666–68
- Boyce JT et al., *Vet Pathol*, 1984;21:33–38, DOI: 10.1177/030098588402100106
- Giordano et al., *Sci Rep*, 2021;11:7044, DOI: 10.1038/s41598-021-87168-0
- Sparkes AH et al., ISFM CKD guidelines, *J Feline Med Surg*, 2016;18:219–239

**Clinical note:** Unlike Persian PKD where ~38% carry the mutation, amyloidosis penetrance in Abyssinians is lower and unpredictable. Anti-inflammatory dietary strategies (omega-3 EPA/DHA) are theoretically beneficial for reducing SAA production but have NOT been validated in cats for this purpose. Somali is the longhaired variant of Abyssinian, sharing identical genetic background and amyloidosis risk — apply identical rules. Somalis also carry pyruvate kinase deficiency at high allele frequency (10–28%) causing hemolytic anemia — this is NOT modifiable by food composition.

---

### Tonkinese

```
breed_name:            Tonkinese
breed_aliases:         [Tonk, Tonkinese Cat]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     moderate (epidemiological DM association; no Tonkinese-specific metabolic studies)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| carb_dmb > 25% | −2 | carb_sub | DM predisposition inherited from Burmese lineage; less aggressive than Burmese given weaker evidence |

**Ingredient conditions:** None.

**Stacking rule:** Stacks with general feline carb penalty but at lower magnitude than Burmese.

**Mechanism:** Tonkinese (Burmese × Siamese cross) inherits Burmese metabolic vulnerability. Epidemiological data (Forcada et al., 2021) notes increased DM odds ratio. WNK4 mutation documented in breeds with Burmese lineage (same advisory-only potassium note as Burmese applies).

**UI callout:** `"Note for Tonkinese: moderate diabetes predisposition via Burmese lineage — lower-carbohydrate formulas may be beneficial."`

**Citations:**
- Forcada Y et al., *PLoS One*, 2021, DOI: 10.1371/journal.pone.0259939
- Gandolfi B et al., *PLoS One*, 2012;7(12):e53173

**Clinical note:** Weaker modifier than Burmese. No Tonkinese-specific metabolic study exists.

---

### Sphynx (Conservative Bonus)

```
breed_name:            Sphynx
breed_aliases:         [Sphynx Cat, Canadian Sphynx, Hairless Cat]
trigger_type:          ga_threshold
actionability:         ga_actionable
applies_to:            [all]  // may be more relevant in cooler climates
vet_audit_status:      pending
evidence_strength:     weak (physiological inference only; no peer-reviewed calorimetry)
```

**GA conditions:**

| Condition | Modifier | Target | Rationale |
|---|---|---|---|
| fat_dmb ≥ 18% | +1 | fat_sub | Rewarding higher caloric density for thermoregulatory demands |

**Ingredient conditions:** None.

**Mechanism:** Sphynx lack guard hairs, awn hairs, and most down coat → higher transdermal heat loss. Industry sources estimate 20–30% higher caloric needs, but this figure has no peer-reviewed measurement basis — no published indirect calorimetry exists comparing Sphynx to furred breeds. Commercial Sphynx-specific foods (Royal Canin) formulate with ~20–22% fat DMB.

**UI callout:** `"Note for Sphynx: hairless breeds may have higher caloric demands for thermoregulation — adequate fat content is beneficial. This is physiologically plausible but not yet validated by published research."`

**HCM note:** Sphynx HCM (~40% prevalence) has NO dietary modifier. ALMS1 G3376R association is weakening (not replicated in New Zealand cohort, Seo et al., 2024). Same taurine ≠ HCM logic applies — do NOT apply a taurine modifier.

**Citations:**
- Meurs KM et al., *Orphanet J Rare Dis*, 2021;16(1):108, DOI: 10.1186/s13023-021-01740-5
- Seo J et al., *Animals*, 2024;14(18):2629, DOI: 10.3390/ani14182629

**Clinical note:** Apply conservatively. The +1 bonus is intentionally small given weak evidence. Cornish Rex and Devon Rex do NOT qualify for this bonus — they retain their down coat unlike the fully hairless Sphynx.

---

## Tier 3 — Advisory Only (No Score Modifier)

These breeds have documented health conditions but NO food-composition variable modifies the outcome. They surface as informational callouts in the UI with zero score delta. Including them explicitly prevents the scoring engine from inventing penalties.

---

### Maine Coon

```
breed_name:            Maine Coon
breed_aliases:         [Maine Coon Cat, MC]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (HCM genetics), emerging (obesity–HCM interaction), none (dietary modifier)
modifier_points:       0
```

**Why no modifier:** MYBPC3 A31P HCM (autosomal dominant, ~34% allele frequency) is a structural sarcomeric protein defect, not metabolic or nutritional. van Hoek et al. (2020) found correlations between BCS ≥6/9 and ventricular hypertrophy markers, suggesting weight management may limit disease expression — but this is general weight management, not a food-composition modifier.

**UI callout:** `"Maine Coon: HCM is genetic and not modifiable by diet composition. Maintaining ideal body condition is generally recommended."`

**Explicitly NOT applied:** Taurine modifier, protein modifier, sodium modifier, omega-3 modifier. No evidence Maine Coons need higher protein percentage despite large body mass — they need more total food, not different food.

**Citations:**
- Meurs KM et al., *Hum Mol Genet*, 2005;14(23):3587–93, DOI: 10.1093/hmg/ddi386
- van Hoek I et al., *J Vet Intern Med*, 2020;34(2):591–599, DOI: 10.1111/jvim.15730

---

### Ragdoll

```
breed_name:            Ragdoll
breed_aliases:         [Ragdoll Cat]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (HCM genetics), none (dietary modifier)
modifier_points:       0
```

**Why no modifier:** MYBPC3 R820W HCM (autosomal dominant) — identical non-responsiveness to dietary modification as Maine Coon.

**UI callout:** `"Ragdoll: HCM is genetic and not modifiable by diet composition. Maintaining ideal body condition is generally recommended."`

**Explicitly NOT applied:** Taurine, sodium, omega-3 modifiers.

**Citations:**
- Meurs KM et al., *Genomics*, 2007;90(2):261–264
- Boeykens F et al., *Front Vet Sci*, 2024;11:1327081, DOI: 10.3389/fvets.2024.1327081

---

### Bengal

```
breed_name:            Bengal
breed_aliases:         [Bengal Cat]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     anecdotal (IBD), none (breed-specific dietary requirements)
modifier_points:       0
```

**Why no modifier:** Bengal IBD predisposition is NOT documented in peer-reviewed breed-predisposition studies. GI issues in the literature are infectious (T. foetus, H. canis, C. perfringens) in cattery settings, not idiopathic IBD. Claims of higher protein requirements from Asian Leopard Cat ancestry are unsubstantiated — SBT (F4+) Bengals are >93.75% domestic cat genetically.

**UI callout:** `"Bengal: GI issues are primarily infectious/cattery-related. No breed-specific dietary adjustment warranted. General feline high-protein recommendations apply."`

**Explicitly NOT applied:** High-protein modifier. This is breeder lore without scientific basis. Species-level feline protein recommendations (≥40% DMB) already provide adequate coverage.

**Citations:**
- Gunn-Moore DA et al., *J Feline Med Surg*, 2007;9(3):214–218, DOI: 10.1016/j.jfms.2007.01.003

---

### Siamese / Oriental Shorthair

```
breed_name:            Siamese Group
breed_aliases:         [Siamese, Siamese Cat, Oriental Shorthair, Oriental, OSH]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (amyloidosis genetics), none (dietary modifier)
modifier_points:       0
```

**Why no modifier:** Siamese hepatic AA amyloidosis is genetically driven (GWAS: 8 SNPs including SAA1 locus). SAA production is driven by chronic inflammation, not diet composition. No dietary factor prevents or modifies amyloid deposition. Siamese lean body type benefits from adequate protein (≥38% DMB) for muscle maintenance, but this is covered by species-level feline recommendations.

**UI callout:** `"Siamese: hepatic amyloidosis is genetic with no dietary modifier. Lean body type benefits from adequate protein — standard feline recommendations apply."`

**Explicitly NOT applied:** Phosphorus modifier (irrelevant — Siamese amyloidosis is hepatic, not renal), amyloidosis dietary penalty.

**Citations:**
- Niewold TA et al., *Amyloid*, 1999;6:205–209, DOI: 10.3109/13506129909007328
- Van der Linde-Sipman JS et al., *Vet Immunol Immunopathol*, 1997;56:1–10

---

### Scottish Fold

```
breed_name:            Scottish Fold
breed_aliases:         [Scottish Fold Cat, Fold]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (genetic etiology), none (dietary modifier)
modifier_points:       0
```

**Why no modifier:** Osteochondrodysplasia is caused by TRPV4 c.1024G>T (autosomal dominant with incomplete dominance) — a dysfunctional calcium-permeable mechanosensory ion channel in chondrocytes. This is a cell-signaling defect in cartilage development, not a mineral metabolism disorder. No study has demonstrated that dietary calcium, phosphorus, vitamin D, or their ratios affect the condition.

**UI callout:** `"Scottish Fold: osteochondrodysplasia is a genetic cartilage defect — not modifiable by calcium, phosphorus, or vitamin D levels in food."`

**Explicitly NOT applied:** Calcium modifier, phosphorus modifier, vitamin D modifier, Ca:P ratio modifier, glucosamine/chondroitin modifier (these are not GA-measurable).

**Citations:**
- Gandolfi B et al., *Osteoarthritis Cartilage*, 2016;24(8):1441–50, DOI: 10.1016/j.joca.2016.03.019

---

### Birman

```
breed_name:            Birman
breed_aliases:         [Birman Cat, Sacred Cat of Burma]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     none (for any dietary modifier)
modifier_points:       0
```

**Why no modifier:** All Birman health conditions (neutrophil granulation anomaly, neonatal isoerythrolysis, HCM, thymic aplasia) are purely genetic/immunologic with no dietary component. Öhlund et al. (2018) found Birmans had decreased obesity risk.

**UI callout:** `"Birman: no documented breed-specific dietary vulnerability. Standard feline nutrition rules apply."`

**Citations:**
- Hirsch VM, Cunningham TA, *Am J Vet Res*, 1984;45(10):2170–74
- Öhlund M et al., 2018, PMC5775588

---

### Norwegian Forest Cat

```
breed_name:            Norwegian Forest Cat
breed_aliases:         [NFC, Norwegian, Wegie, Skogkatt]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (GSD IV genetics), none (dietary management)
modifier_points:       0
```

**Why no modifier:** GSD IV (GBE1 complex rearrangement, autosomal recessive) is invariably fatal — dietary carbohydrate type or level cannot bypass the absence of glycogen branching enzyme. NFC also appears in obesity-predisposition studies (Corbee 2014: higher BCS at cat shows) but evidence is weaker than for BSH.

**UI callout:** `"Norwegian Forest Cat: GSD IV is a genetic enzyme deficiency with no dietary management. Standard feline nutrition rules apply."`

**Citations:**
- Fyfe JC et al., *Mol Genet Metab*, 2007;90(4):383–92, DOI: 10.1016/j.ymgme.2006.10.002

---

### Russian Blue

```
breed_name:            Russian Blue
breed_aliases:         [Russian Blue Cat]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     moderate (DM predisposition), none (specific dietary thresholds)
modifier_points:       0
```

**Why no modifier:** DM predisposition noted in UK epidemiological data (Forcada et al., 2021) but without established dietary thresholds and without the metabolic mechanism data that Burmese have. General feline weight management and carb moderation rules provide sufficient coverage.

**UI callout:** `"Russian Blue: moderate diabetes predisposition documented. No breed-specific dietary thresholds established — standard feline recommendations apply."`

**Citations:**
- Forcada Y et al., *PLoS One*, 2021, DOI: 10.1371/journal.pone.0259939

---

### Cornish Rex

```
breed_name:            Cornish Rex
breed_aliases:         [Cornish Rex Cat]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     anecdotal (higher metabolic rate claim)
modifier_points:       0
```

**Why no modifier:** "Higher metabolic rate" claim is based on physiological inference (single-layer down coat) but no peer-reviewed calorimetry data exists. Cornish Rex retains their down coat, unlike the fully hairless Sphynx — does NOT qualify for the Sphynx fat bonus.

**UI callout:** None — no breed-specific callout warranted.

**Citations:** No breed-specific metabolic study identified.

---

### Devon Rex

```
breed_name:            Devon Rex
breed_aliases:         [Devon Rex Cat]
trigger_type:          no_modifier
actionability:         no_dietary_modifier
applies_to:            [all]
vet_audit_status:      pending
evidence_strength:     strong (CMS genetics — no dietary modifier), strong (historical vitamin K coagulopathy — now eradicated)
modifier_points:       0
```

**Why no modifier:** CMS (COLQ c.1190G>A) is a neuromuscular junction defect, not responsive to taurine, selenium, or vitamin E. Historical vitamin K-dependent coagulopathy (GGCX deficiency) was treatable with vitamin K₁ but is considered eradicated from current breeding lines.

**UI callout:** None — no breed-specific callout warranted for current populations.

**Citations:**
- Gandolfi B et al., *Anim Genet*, 2015;46(6):711–715, DOI: 10.1111/age.12350
- Abitbol M et al., *PLoS One*, 2015;10(9):e0137019, DOI: 10.1371/journal.pone.0137019

---

## Summary: Scoring Engine Implementation

### Breeds WITH score modifiers (implement in `breed_modifiers` table):

| Breed | Tier | Primary Target | Max Penalty | Stacks with species-level? |
|---|---|---|---|---|
| Burmese | 1 | carb_sub | −5 | YES — compounds feline carb penalty |
| Persian | 1 | phosphorus_sub + ingredient | −3 (−2 GA + −1 ingredient) | NO — this IS the renal concern |
| Exotic Shorthair | 1 | (inherits Persian) | −3 | NO |
| British Shorthair | 1 | fat_sub + carb_sub | −3 (−2 fat + −1 carb) | YES — compounds feline carb penalty |
| Abyssinian | 2 | phosphorus_sub | −1 | NO (softer than Persian) |
| Somali | 2 | (inherits Abyssinian) | −1 | NO |
| Tonkinese | 2 | carb_sub | −2 | YES (lower than Burmese) |
| Sphynx | 2 | fat_sub | +1 (bonus) | N/A |

### Breeds with NO score modifier (implement as `no_modifier` to prevent false penalties):

Maine Coon, Ragdoll, Bengal, Siamese, Oriental Shorthair, Scottish Fold, Birman, Norwegian Forest Cat, Russian Blue, Cornish Rex, Devon Rex

### Key implementation rules:

- [ ] Global taurine-HCM block: scoring engine MUST NOT apply taurine modifiers for any HCM breed
- [ ] Persian and Exotic Shorthair share identical rules — Exotic inherits Persian profile completely
- [ ] Abyssinian and Somali share identical rules — Somali inherits Abyssinian profile completely
- [ ] Siamese and Oriental Shorthair share identical rules (both: no modifier)
- [ ] Burmese carb penalty stacks with species-level feline carb curve
- [ ] BSH obesity penalty targets fat_sub primarily, carb_sub secondarily (per research: fat > carb for feline obesity)
- [ ] Inorganic phosphate salt detection needed for ingredient parsing: sodium tripolyphosphate, dicalcium phosphate, monocalcium phosphate
- [ ] `no_modifier` breeds must be explicitly registered to prevent the engine from applying default/generic penalties
- [ ] Every modifier entry has at least one citation
- [ ] `vet_audit_status` must be `cleared` before any modifier reaches production
- [ ] Modifier cap: sum of all breed modifiers within the nutritional bucket ≤ |10|
