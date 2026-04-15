/**
 * Owner Dietary Reference cards for the Vet Report PDF (Page 4).
 *
 * 14 conditions x 2 species = 28 cards, plus conflict detection.
 * All content transcribed from M6_VET_REPORT_SPEC_v2.md Section 17.
 * All copy is D-095 UPVM compliant — observational, never prescriptive.
 *
 * Card keys use scoring tags from conditionScoring.ts (e.g. 'ckd' not 'kidney_disease').
 */

import type { OwnerDietaryCard, ConflictNote } from '../types/vetReport';

// ─── Render Order (clinical priority) ───────────────────────

export const CARD_RENDER_ORDER: string[] = [
  'ckd',
  'cardiac',
  'pancreatitis',
  'diabetes',
  'urinary',
  'allergy',
  'obesity',
  'underweight',
  'gi_sensitive',
  'skin',
  'hyperthyroid',
  'hypothyroid',
  'joint',
  'no_known_conditions',
];

// ─── Card Data ──────────────────────────────────────────────

export const OWNER_CARDS: Record<string, Record<'dog' | 'cat', OwnerDietaryCard>> = {

  // ── 1. No Known Conditions ────────────────────────────────

  no_known_conditions: {
    dog: {
      conditionKey: 'no_known_conditions',
      conditionLabel: 'Healthy Maintenance',
      goal: 'Maintain long-term vitality, lean body condition, and balanced nutrition through a complete and balanced commercial diet.',
      lookFor: 'Diets labeled "complete and balanced" meeting AAFCO or FEDIAF guidelines for the dog\'s life stage. For large breed puppies (>50 lbs expected adult weight), large breed-specific puppy formulas. Lean animal proteins, balanced omega-3/omega-6 ratios.',
      avoid: 'Unbalanced homemade or unregulated raw diets. Known canine toxins: grapes/raisins, onions/garlic/leeks, chocolate, macadamia nuts, xylitol.',
      caloricNote: 'RER x activity factor (typically 1.4-1.6 for neutered adults). Treats <10% of daily calories.',
      note: null,
      citation: 'AAFCO Official Publication (2016) — protein >=18.0% DM, fat >=5.5% DM. NRC 2006. Baldwin et al. 2010, JAAHA 46(4):285-296.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'no_known_conditions',
      conditionLabel: 'Healthy Maintenance',
      goal: 'Maintain long-term vitality with species-appropriate nutrition. Cats are obligate carnivores requiring animal-sourced protein, taurine, pre-formed vitamin A, and arachidonic acid.',
      lookFor: 'AAFCO/FEDIAF-compliant diets. Wet/canned food preferred to increase daily water intake. High animal-sourced protein. Taurine in the formula.',
      avoid: 'Dog food (inadequate taurine — can be fatal long-term). Vegan/vegetarian diets. Known feline toxins: lilies (pollen causes fatal kidney failure), onions, garlic, grapes, essential oils.',
      caloricNote: 'Standard indoor RER, typically 200-250 kcal/day. Treats <10%.',
      note: null,
      citation: 'AAFCO (2016) — protein >=26.0% DM, fat >=9.0% DM, taurine >=0.10% DM (dry)/>=0.20% DM (wet). Pion et al. 1987, Science 237:764-768.',
      speciesCallout: null,
    },
  },

  // ── 2. Joint Issues ───────────────────────────────────────

  joint: {
    dog: {
      conditionKey: 'joint',
      conditionLabel: 'Joint Issues',
      goal: 'Reduce systemic inflammation, support cartilage, and minimize mechanical stress on joints through weight management.',
      lookFor: 'Marine-sourced omega-3 (EPA/DHA). Green-lipped mussel extract. Lean protein profiles. Glucosamine/chondroitin (evidence is mixed but widely used).',
      avoid: 'High-calorie diets that promote weight gain. Pro-inflammatory omega-6-heavy profiles.',
      caloricNote: 'Strictly controlled. The Purina lifetime study showed lean dogs lived 1.8 years longer with OA treatment delayed ~3 years.',
      note: null,
      citation: 'Roush et al. 2010, JAVMA 236(1):59-66. Kealy et al. 2002, JAVMA 220(9):1315-1320. Glucosamine: Vandeweerd et al. 2012, JVIM 26(3):448-456 (evidence "low and contradictory").',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'joint',
      conditionLabel: 'Joint Issues',
      goal: 'Reduce joint inflammation and maintain lean weight. 90% of cats over 12 have radiographic DJD but only ~4% have clinical documentation — feline OA is massively underdiagnosed.',
      lookFor: 'Marine-sourced omega-3 (EPA/DHA) — cats cannot convert plant-based ALA to EPA/DHA. Wet food preferred. Feline-formulated glucosamine/chondroitin (liquids or powders in wet food).',
      avoid: 'High-calorie dry foods. Excess calories — obesity severely exacerbates feline arthritis.',
      caloricNote: 'Strict weight control.',
      note: null,
      citation: 'Hardie et al. 2002, JAVMA 220(5):628-632. Rivers et al. 1975, Nature 258:171-173 (cats cannot convert ALA to EPA/DHA).',
      speciesCallout: null,
    },
  },

  // ── 3. Sensitive Stomach ──────────────────────────────────

  gi_sensitive: {
    dog: {
      conditionKey: 'gi_sensitive',
      conditionLabel: 'Sensitive Stomach',
      goal: 'Highly digestible food that minimizes GI workload and promotes a healthy microbiome.',
      lookFor: 'Highly digestible GI or limited ingredient diets. Digestible proteins (fish, turkey, egg) in primary positions. Soluble fibers (psyllium, pumpkin, beet pulp). Prebiotics (chicory root, inulin, FOS). Clinically studied probiotics (E. faecium SF68).',
      avoid: 'High-fat foods (>18% fat DMB). Dairy/lactose. Constant protein rotation if intolerance is suspected.',
      caloricNote: 'Divide into 3-4 smaller meals.',
      note: null,
      citation: 'Washabau & Day 2012, Canine and Feline Gastroenterology (Elsevier). Bybee et al. 2011, JVIM 25(4):856-860. Mandigers et al. 2010, JVIM 24(6):1350-1357.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'gi_sensitive',
      conditionLabel: 'Sensitive Stomach',
      goal: 'Highly digestible food supporting the GI tract. Cats are prone to IBD and hairball-related GI issues.',
      lookFor: 'Novel protein diets (rabbit, venison, duck) or hydrolyzed protein diets. Soluble fiber (psyllium) for hairball passage. Feline-specific probiotics. B12 supplementation if chronic — cats with GI disease frequently deplete cobalamin.',
      avoid: 'Dairy products. Abrupt diet changes. Excessive plant matter. High-fat foods.',
      caloricNote: 'Small, frequent meals.',
      note: null,
      citation: 'Jergens 2012, JFMS 14(7):445-458. Simpson et al. 2001, JVIM 15(1):26-32 (B12 — 49/80 cats). Guilford et al. 2001, JVIM 15(1):7-13.',
      speciesCallout: null,
    },
  },

  // ── 4. Overweight / Obesity ───────────────────────────────

  obesity: {
    dog: {
      conditionKey: 'obesity',
      conditionLabel: 'Overweight / Obesity',
      goal: 'Safe, steady fat loss while preserving lean muscle mass.',
      lookFor: 'High-fiber (>5% DMB). Lean protein (>30% DMB with fat <14% DMB). L-Carnitine.',
      avoid: 'Calorie-dense foods (>4,200 kcal/kg dry). Puppy/performance formulas. Free-feeding. High-calorie treats. Drastically reduced portions of standard food (risks nutrient deficiency).',
      caloricNote: 'Base on ideal target weight. Safe loss: 1-2%/week. Treats <10%.',
      note: null,
      citation: 'Brooks et al. 2014, JAAHA 50(1):1-11. APOP 2022: 59% of dogs overweight/obese.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'obesity',
      conditionLabel: 'Overweight / Obesity',
      goal: 'Safe, gradual fat loss. Rapid weight loss in cats is associated with hepatic lipidosis (fatty liver disease), which can be fatal.',
      lookFor: 'High-protein, low-carbohydrate wet food. Veterinary metabolic/satiety formulas. L-Carnitine.',
      avoid: 'Severe caloric restriction or skipping meals. High-carbohydrate dry kibble free-choice. If the cat refuses food for >24 hours, veterinary consultation is recommended.',
      caloricNote: 'Base on ideal target weight. Safe loss: 0.5-2%/week.',
      note: null,
      citation: 'Center et al. 1993, JVIM 7(6):349-359 (hepatic lipidosis). Biourge et al. 1994, Am J Vet Res 55(9):1291-1302. Brooks et al. 2014, JAAHA.',
      speciesCallout: null,
    },
  },

  // ── 5. Underweight ────────────────────────────────────────

  underweight: {
    dog: {
      conditionKey: 'underweight',
      conditionLabel: 'Underweight',
      goal: 'Safely increase caloric intake with nutrient-dense foods without GI upset.',
      lookFor: 'Calorie-dense formulas (>4,000 kcal/kg dry). Puppy or performance formulas. High biological value animal proteins. Wet food for palatability.',
      avoid: '"Lite"/weight management formulas. High-fiber foods. Large single meals.',
      caloricNote: 'Feed in 3+ small, frequent meals. Gradually increase — refeeding syndrome risk after prolonged restriction.',
      note: null,
      citation: 'Justin & Hohenhaus 1995, JVIM 9(4):228-233. Chan 2015, Wiley (chapter 16).',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'underweight',
      conditionLabel: 'Underweight',
      goal: 'Safely increase caloric intake. Palatability is critical — cats are sensitive to food aroma and texture.',
      lookFor: 'Kitten growth formulas. Clinical recovery wet diets. Highly aromatic, high-fat, high-protein meats/liver. Warming wet food slightly enhances aroma.',
      avoid: '"Indoor cat"/weight management formulas. Bulky high-fiber carbohydrates. Foods associated with prior nausea — cats develop prolonged food aversions.',
      caloricNote: 'Feed in 3+ small meals. Refeeding syndrome risk applies.',
      note: null,
      citation: 'Michel 2001, JFMS 3(1):3-8 (food aversion). Justin & Hohenhaus 1995, JVIM 9(4):228-233.',
      speciesCallout: null,
    },
  },

  // ── 6. Diabetes ───────────────────────────────────────────

  diabetes: {
    dog: {
      conditionKey: 'diabetes',
      conditionLabel: 'Diabetes',
      goal: 'Glycemic control — consistent, slow glucose release to minimize blood sugar spikes.',
      lookFor: 'High-fiber (>5% DMB). Complex low-glycemic carbs (barley, sorghum, oats). Consistent formulation.',
      avoid: 'Simple sugars (corn syrup, molasses, fructose, dextrose). Semi-moist foods. High-glycemic carbs (white rice, corn). Inconsistent feeding schedules.',
      caloricNote: 'Same measured amount, same times daily, coordinated with insulin (typically two meals 12 hours apart). Any food change may require insulin dose adjustment.',
      note: 'Canine diabetes is almost always insulin-dependent and does not typically achieve remission.',
      citation: 'Behrend et al. 2018, JAAHA 54(1):1-21. Graham et al. 2002, JSAP 43(2):67-73. Catchpole et al. 2005, Diabetologia 48(10):1948-1956.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'diabetes',
      conditionLabel: 'Diabetes',
      goal: 'Glycemic control through strict carbohydrate restriction. A significant percentage of diabetic cats can achieve remission through dietary changes.',
      lookFor: 'Ultra-low carbohydrate diets (estimated carbs <10% of calories). High-protein formulas. Wet/canned/pate foods (naturally lower carb than kibble).',
      avoid: 'Dry kibble as sole diet. Wet foods in "gravy" or "sauce" (thickened with cornstarch/flour). Simple sugars. Semi-moist foods.',
      caloricNote: 'Consistent schedule coordinated with insulin. If also overweight, gradual weight loss improves insulin sensitivity.',
      note: 'Published remission rates: 64-84% in cats started on low-carb diets within 6 months of diagnosis.',
      citation: 'Bennett et al. 2006, JFMS 8(2):73-84 (68% remission). Roomp & Rand 2009, JFMS 11(8):668-682 (84% remission within 6 months). Behrend et al. 2018, JAAHA.',
      speciesCallout: null,
    },
  },

  // ── 7. Kidney Disease (CKD) ───────────────────────────────

  ckd: {
    dog: {
      conditionKey: 'ckd',
      conditionLabel: 'Kidney Disease (CKD)',
      goal: 'Slow progression by reducing phosphorus load, managing protein quality, and maintaining hydration and caloric intake.',
      lookFor: 'Low phosphorus (primary dietary priority). Moderate high-quality protein (20-28% DMB). Wet food or added water. Omega-3 (EPA/DHA).',
      avoid: 'High-phosphorus foods (bones, dairy, organ meats, jerky). High-protein "ancestral"/performance diets. High-sodium foods. Raw diets.',
      caloricNote: 'Maintain adequate intake — CKD dogs become nauseous and stop eating, creating a muscle-wasting spiral.',
      note: null,
      citation: 'Jacob et al. 2002, JAVMA 220(8):1163-1170 (~3x survival on renal diet). IRIS 2023. Polzin 2011, Vet Clin North Am. Brown et al. 1998, J Lab Clin Med 131(5):447-455.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'ckd',
      conditionLabel: 'Kidney Disease (CKD)',
      goal: 'Slow progression through phosphorus restriction, maximize hydration, maintain food intake. CKD is the #1 cause of death in senior cats (30-40% of cats >10, up to 80% >15).',
      lookFor: 'Wet food (strongly preferred — cats\' low thirst drive makes dry food inadequate for CKD). Low phosphorus. Moderate high-quality protein (28-35% DMB). Omega-3. Potassium supplementation may be needed (18-30% of CKD cats develop hypokalemia).',
      avoid: 'High-phosphorus foods (bone meal, jerky, fish with bones). High-protein dry kibble. High-sodium foods.',
      caloricNote: 'Palatability is the priority. Warming wet food enhances aroma. Any calories are better than no calories in a CKD cat that has stopped eating.',
      note: null,
      citation: 'Ross et al. 2006, JAVMA 229(6):949-957 (RCT — 0% renal deaths on renal diet vs 22%). Elliott et al. 2000, JSAP 41(6):235-242 (median survival 633 vs 264 days). IRIS 2023. Stockman 2024, JFMS.',
      speciesCallout: null,
    },
  },

  // ── 8. Urinary Issues ─────────────────────────────────────

  urinary: {
    dog: {
      conditionKey: 'urinary',
      conditionLabel: 'Urinary Issues',
      goal: 'Increase urine dilution through moisture intake. Stone type determines specific approach — veterinary diagnosis is required.',
      lookFor: 'Wet food or added water (most effective strategy for all stone types). Veterinary urinary diets for the specific stone type. Healthy weight.',
      avoid: 'Depends on stone type. Generally: dry kibble as sole diet, high-mineral foods. For CaOx: high-calcium, high-oxalate foods. For urate (Dalmatians): high-purine foods (organ meats, sardines).',
      caloricNote: 'Maintenance. Weight management is beneficial.',
      note: 'Struvite (alkaline urine) and calcium oxalate (acidic urine) require opposite approaches. CaOx cannot be dissolved medically.',
      citation: 'Lulich et al. 2016, JVIM 30(5):1564-1574 (ACVIM consensus). Bannasch et al. 2008, PLoS Genet 4(11):e1000246 (Dalmatian urate). Buckley et al. 2011, Br J Nutr 106(Suppl 1):S128-S130.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'urinary',
      conditionLabel: 'Urinary Issues',
      goal: 'Maximize urine dilution and address the stress/dehydration component. Male cats are at risk of fatal urethral blockages. The most common feline urinary issue is FIC, driven primarily by stress and dehydration.',
      lookFor: 'Wet food (highest-priority dietary intervention). Feline urinary diets. Calming ingredients in some diets (L-Tryptophan, alpha-casozepine). Environmental enrichment and stress reduction.',
      avoid: '100% dry kibble diets. High-magnesium/high-phosphorus ingredients. Obesity (major risk factor for blockages).',
      caloricNote: 'Calorie control — obesity increases blockage risk significantly.',
      note: 'Male cat urethral obstruction: ~8.5% mortality, 36% re-obstruction rate. Wet food associated with significantly lower FIC recurrence.',
      citation: 'Buffington et al. 2006, JFMS 8(4):261-268 (MEMO — FIC driven by stress). Segev et al. 2011, JFMS 13(2):101-108. Markwell et al. 1999, JAVMA 214(3):361-365. Beata et al. 2007, J Vet Behav 2(2):40-46.',
      speciesCallout: null,
    },
  },

  // ── 9. Heart Disease ──────────────────────────────────────

  cardiac: {
    dog: {
      conditionKey: 'cardiac',
      conditionLabel: 'Heart Disease',
      goal: 'Manage sodium to reduce fluid retention, support cardiac muscle, maintain lean body mass.',
      lookFor: 'Controlled sodium formulas. Taurine + L-Carnitine supplementation (especially DCM-prone breeds: Golden Retrievers, Dobermans, Cocker Spaniels, Boxers). Omega-3 (EPA/DHA). Adequate calories to prevent cardiac cachexia.',
      avoid: 'High-sodium foods/treats (jerky, cheese, lunch meats, hot dogs). Foods with peas/lentils/legumes in top positions (FDA investigated grain-free/legume-heavy diets and DCM — causality not established). Excessive sodium restriction (activates RAAS).',
      caloricNote: 'Prevent cardiac cachexia but avoid obesity.',
      note: null,
      citation: 'Keene et al. 2019, JVIM 33(3):1127-1140 (ACVIM MMVD consensus). Kittleson et al. 1997, JVIM 11(4):204-211. FDA CVM DCM Investigation 2018-2022.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'cardiac',
      conditionLabel: 'Heart Disease',
      goal: 'Support cardiac function, manage blood pressure, ensure adequate taurine. HCM affects ~15% of apparently healthy cats.',
      lookFor: 'Taurine (non-negotiable — deficiency causes DCM and retinal degeneration in cats). High-quality animal proteins. Wet food (dehydration thickens blood, increases cardiac workload and clot risk). Omega-3. Moderate sodium levels.',
      avoid: 'Taurine-deficient foods. High-sodium treats (human tuna in brine). Unbalanced homemade diets.',
      caloricNote: 'Maintenance. Severe heart disease causes cachexia; mild heart disease is worsened by obesity.',
      note: 'Taurine-deficiency DCM (Pion et al. 1987) is reversible with supplementation. Rare since commercial cat foods were reformulated, but cats on homemade/vegan/dog food diets remain at risk.',
      citation: 'Pion et al. 1987, Science 237:764-768. Payne et al. 2015, J Vet Cardiol 17(Suppl 1):S244-S257 (HCM 14.7%). Luis Fuentes et al. 2020, JVIM 34(3):1062-1077.',
      speciesCallout: null,
    },
  },

  // ── 10. Pancreatitis ──────────────────────────────────────

  pancreatitis: {
    dog: {
      conditionKey: 'pancreatitis',
      conditionLabel: 'Pancreatitis',
      goal: 'Minimize pancreatic stimulation by strictly limiting dietary fat.',
      lookFor: 'Ultra-low-fat GI diets (<12% fat DMB). Highly digestible lean proteins (white fish, turkey, egg whites). Digestible carbohydrates. Digestive enzyme supplementation.',
      avoid: 'High-fat foods (>12% fat DMB). All high-fat treats (marrow bones, pig ears, peanut butter, cheese, salmon oil). Table scraps. Performance/puppy diets.',
      caloricNote: 'Divide into 3-4 smaller meals per day.',
      note: 'The <12% fat DMB threshold is more conservative than some published definitions (<20% ME per Cridge et al. 2022), reflecting the severity of potential flare-ups.',
      citation: 'Lem et al. 2008, JAVMA 233(9):1425-1431. Cridge et al. 2022, JVIM 36(3):847-864. Xenoulis et al. 2010, JAAHA 46(4):229-234.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'pancreatitis',
      conditionLabel: 'Pancreatitis',
      goal: 'Support digestive function with highly digestible proteins. Feline pancreatitis is NOT triggered by dietary fat — it is typically chronic, low-grade, and associated with concurrent IBD and liver inflammation (triaditis).',
      lookFor: 'Novel proteins (rabbit, venison, duck) or hydrolyzed protein diets to address the IBD component. Moderate fat is well-tolerated. Highly aromatic wet food to encourage eating. B12 supplementation (77% of cats with EPI are B12 deficient).',
      avoid: 'Raw diets (immunosuppression risk). Foods triggering known allergies. Allowing the cat to go without food (>24 hours — hepatic lipidosis risk).',
      caloricNote: 'Maintaining food intake is the priority.',
      note: null,
      citation: 'De Cock et al. 2007, Vet Pathol 44(1):39-49 (no link to fat). Weiss et al. 1996, JAVMA 209(6):1114-1116 (triaditis). Xenoulis et al. 2016, JVIM 30(6):1790-1797.',
      speciesCallout: 'Critical species difference: Do NOT apply canine fat restrictions to cats.',
    },
  },

  // ── 11. Skin & Coat ───────────────────────────────────────

  skin: {
    dog: {
      conditionKey: 'skin',
      conditionLabel: 'Skin & Coat Issues',
      goal: 'Reduce skin inflammation, rebuild the skin barrier, minimize allergen exposure.',
      lookFor: 'Omega-3 (EPA/DHA) — associated with reduced itching and inflammation. Omega-6 (linoleic acid) for skin barrier. Limited ingredient formulas (1-2 identified protein sources). Hydrolyzed protein diets if food allergy is suspected.',
      avoid: 'Unnamed protein sources ("meat meal," "animal fat"). Foods with >3-4 distinct animal proteins. If diagnosed: most common canine allergens are beef (34%), dairy (17%), chicken (15%), wheat (13%).',
      caloricNote: 'Maintenance. Elimination trial minimum: 8 weeks.',
      note: 'True grain allergies are rare. The immune response is almost always to the animal protein.',
      citation: 'Mueller et al. 2016, BMC Vet Res 12:9. Olivry et al. 2015, BMC Vet Res 11:210 (ICADA). Ricci et al. 2013, J Anim Physiol Anim Nutr 97(Suppl 1):32-38.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'skin',
      conditionLabel: 'Skin & Coat Issues',
      goal: 'Reduce skin inflammation and identify dietary allergens. Commonly presents as miliary dermatitis, overgrooming (bald belly), or eosinophilic granuloma complex.',
      lookFor: 'Marine-sourced omega-3 (EPA/DHA) — cats cannot convert plant-based ALA. Hydrolyzed or novel protein diets (rabbit, venison, duck). Single-source protein formulas.',
      avoid: 'Variety packs (constant protein rotation prevents allergen identification). Unnamed protein sources. If diagnosed: most common feline allergens are beef (18%), fish (17%), chicken (5%), dairy (4%). Fish is the #2 feline allergen despite popular belief.',
      caloricNote: 'Maintenance. 8-week minimum elimination trial.',
      note: null,
      citation: 'Mueller et al. 2016, BMC Vet Res 12:9. Rivers et al. 1975, Nature 258:171-173. Olivry & Bizikova 2010, Vet Dermatol 21(1):32-41.',
      speciesCallout: null,
    },
  },

  // ── 12. Hypothyroidism ────────────────────────────────────

  hypothyroid: {
    dog: {
      conditionKey: 'hypothyroid',
      conditionLabel: 'Hypothyroidism',
      goal: 'Support weight management and skin/coat recovery while thyroid medication is being balanced.',
      lookFor: 'Lower-fat formulas (<16% fat DMB). High-fiber (>5% DMB) for satiety. Lean proteins. Marine-sourced omega-3 (EPA/DHA) for skin/coat recovery. L-Carnitine.',
      avoid: 'High-calorie, high-fat foods. Puppy/performance formulas. Free-feeding. Raw diets containing animal necks/gullets (contain thyroid gland tissue — documented cause of dietary thyrotoxicosis).',
      caloricNote: 'Strict portion control until medication is balanced. These dogs gain weight very easily.',
      note: null,
      citation: 'Scott-Moncrieff 2007, Vet Clin North Am 37(4):709-722. Broome et al. 2015, JAVMA 246(1):105-111 (dietary thyrotoxicosis). Kohler et al. 2012, JSAP 53(3):182-184.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'hypothyroid',
      conditionLabel: 'Hypothyroidism',
      goal: 'Monitor caloric intake during metabolic transition from hyperthyroid to hypothyroid state. Almost always iatrogenic post-hyperthyroid treatment.',
      lookFor: 'Standard adult maintenance or weight-control diets. Balanced animal proteins.',
      avoid: 'Iodine-restricted diets (y/d) — if the cat has become hypothyroid, continuing iodine restriction worsens it. High-calorie kitten foods. High-carbohydrate fillers.',
      caloricNote: 'Closely monitored. The cat transitions from burning excess to burning fewer calories — same portions will cause rapid weight gain.',
      note: null,
      citation: 'Peterson 2013, Compendium 35(8):E1-E6. Fernandez et al. 2019, JFMS 21(12):1149-1156 (iatrogenic hypothyroidism in 20-50% post-radioiodine).',
      speciesCallout: null,
    },
  },

  // ── 13. Hyperthyroidism ───────────────────────────────────

  hyperthyroid: {
    cat: {
      conditionKey: 'hyperthyroid',
      conditionLabel: 'Hyperthyroidism',
      goal: 'Support elevated metabolic rate (medication pathway) OR maintain strict iodine restriction (dietary pathway). Most common feline endocrine disorder — >10% of senior cats.',
      lookFor: 'Medication/surgery pathway: High-calorie (>4,500 kcal/kg). High-protein (>40% DMB). Wet food. L-Carnitine and taurine. Iodine-restricted pathway: The prescribed iodine-restricted food as the exclusive diet. Nothing else.',
      avoid: 'Medication/surgery pathway: Low-calorie/low-protein diets. Iodine-restricted pathway: Any other food — if the cat eats a single normal treat, the restriction is broken. Fish, seafood, kelp, seaweed (high iodine). Dental powders (almost always kelp-based).',
      caloricNote: 'Medication pathway: caloric surplus until controlled. Iodine pathway: per veterinary guidance.',
      note: '87% of hyperthyroid cats show cardiac changes (LV hypertrophy).',
      citation: 'Peterson 2012, JFMS 14(11):804-818. van der Kooij et al. 2014, JFMS 16(6):491-498. Hui et al. 2015, JVIM 29(4):1063-1068. Liu et al. 1984, JAVMA 185(1):52-57. Edinboro et al. 2010, JFMS 12(9):672-679.',
      speciesCallout: null,
    },
    dog: {
      conditionKey: 'hyperthyroid',
      conditionLabel: 'Hyperthyroidism',
      goal: 'If confirmed, support through elevated metabolic state. Extremely rare in dogs — dietary or tumor-related.',
      lookFor: 'High-calorie, high-protein diets if losing weight. Lean proteins for muscle rebuilding.',
      avoid: 'Raw diets containing animal necks, gullets, or trachea (documented cause of dietary hyperthyroidism in dogs).',
      caloricNote: 'Per veterinary assessment.',
      note: 'If a dog has hyperthyroidism selected, the app prompts: "Hyperthyroidism is extremely rare in dogs. Did you mean Hypothyroidism?"',
      citation: 'Broome et al. 2015, JAVMA 246(1):105-111. Kohler et al. 2012, JSAP 53(3):182-184.',
      speciesCallout: null,
    },
  },

  // ── 14. Food Allergies ────────────────────────────────────

  allergy: {
    dog: {
      conditionKey: 'allergy',
      conditionLabel: 'Food Allergies',
      goal: 'Identify and eliminate the offending protein through strict dietary control.',
      lookFor: 'Hydrolyzed protein diets (gold standard). Novel protein diets (venison, rabbit, kangaroo, duck). Single clearly identified protein source + single carbohydrate. Limited ingredient formulas with strict production controls.',
      avoid: 'Unnamed protein sources ("meat meal," "animal fat," "poultry by-product") — cross-contamination is widespread (2/12 diets matched labels in one study). >3-4 distinct protein sources. Flavored medications during elimination trials.',
      caloricNote: 'Maintenance. Minimum 8-week elimination trial.',
      note: 'Most common canine allergens: beef (34%), dairy (17%), chicken (15%), wheat (13%). True grain allergies are rare.',
      citation: 'Mueller et al. 2016, BMC Vet Res 12:9. Olivry et al. 2015, BMC Vet Res 11:225 (8-week minimum). Ricci et al. 2013, J Anim Physiol Anim Nutr 97(Suppl 1):32-38.',
      speciesCallout: null,
    },
    cat: {
      conditionKey: 'allergy',
      conditionLabel: 'Food Allergies',
      goal: 'Identify and eliminate the offending protein. Commonly manifests as miliary dermatitis, overgrooming, or chronic vomiting/diarrhea.',
      lookFor: 'Hydrolyzed protein diets or novel protein wet foods (rabbit, venison, duck). Single-source proteins. Wet food preferred. Feline-specific probiotics.',
      avoid: 'Variety packs (constant rotation prevents identification). Unnamed protein sources. Fish-based diets if fish hasn\'t been ruled out — fish is the #2 feline allergen (17%).',
      caloricNote: 'Maintenance. 8-week minimum elimination trial.',
      note: 'Most common feline allergens: beef (18%), fish (17%), chicken (5%), dairy (4%).',
      citation: 'Mueller et al. 2016, BMC Vet Res 12:9. Olivry et al. 2015, BMC Vet Res 11:225. Ricci et al. 2018, BMC Vet Res 14(1):209.',
      speciesCallout: null,
    },
  },
};

// ─── Card Selection ─────────────────────────────────────────

/**
 * Returns owner dietary cards filtered by the pet's conditions and species.
 * `allergy` card triggers on allergenCount > 0 (from pet_allergens table, not pet_conditions).
 */
export function getOwnerDietaryCards(
  conditionTags: string[],
  allergenCount: number,
  species: 'dog' | 'cat',
): OwnerDietaryCard[] {
  const activeKeys = new Set(conditionTags);
  if (allergenCount > 0) activeKeys.add('allergy');

  if (activeKeys.size === 0) {
    return [OWNER_CARDS.no_known_conditions[species]];
  }

  return CARD_RENDER_ORDER
    .filter(key => key !== 'no_known_conditions' && activeKeys.has(key))
    .map(key => OWNER_CARDS[key]?.[species])
    .filter((card): card is OwnerDietaryCard => card != null);
}

// ─── Conflict Detection ─────────────────────────────────────

/**
 * Detects contradictory condition pairs that produce conflicting dietary guidance.
 * Returns callout notes to render between the relevant cards.
 */
export function detectConflicts(
  conditionTags: string[],
  species: 'dog' | 'cat',
): ConflictNote[] {
  const conflicts: ConflictNote[] = [];
  const has = (tag: string) => conditionTags.includes(tag);

  if (has('ckd') && has('underweight')) {
    conflicts.push({
      conditions: ['ckd', 'underweight'],
      note: 'CKD requires moderate protein restriction while underweight recovery benefits from high protein. Veterinary guidance on protein targets is recommended for this combination.',
    });
  }

  if (species === 'dog' && has('pancreatitis') && has('underweight')) {
    conflicts.push({
      conditions: ['pancreatitis', 'underweight'],
      note: 'Canine pancreatitis requires strict fat restriction, which limits calorie density. Multiple small meals of lean, calorie-dense-per-protein foods may help — discuss with a veterinarian.',
    });
  }

  return conflicts;
}
