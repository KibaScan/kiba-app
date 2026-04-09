// Kiba — Health Condition Scoring (Layer 3)
// Pure function. No Supabase, no side effects, no brand awareness (D-019).
// All labels follow D-094 suitability framing and D-095 UPVM compliance.
//
// Condition adjustments are flat points applied to the final composite score.
// The bucket label (IQ/NP/FC) is for display categorization — it indicates
// which nutritional axis the rule evaluates, not a weighted sub-score target.
//
// Cap logic:
//   - Per-condition: ±8 points total across all rules for that condition
//   - Total bonus: +10 max
//   - Total penalty: -15 max
//
// 12 conditions: obesity, underweight, gi_sensitive, diabetes, pancreatitis,
// ckd, cardiac, urinary, joint, skin, hypothyroid, hyperthyroid

import type { Product, PetProfile } from '../types';
import type { ProductIngredient } from '../types/scoring';

// ─── Types ────────────────────────────────────────────────

export interface ConditionAdjustment {
  condition: string;
  rule: string;
  points: number;
  bucket: 'IQ' | 'NP' | 'FC';
  citation: string;
  reason: string;
}

export interface ConditionScoringResult {
  adjustments: ConditionAdjustment[];
  totalAdjustment: number;
  /** When true, score must be set to 0 — a critical safety override (e.g., cardiac + DCM). */
  zeroOut: boolean;
  zeroOutReason: string | null;
}

// ─── Helpers ──────────────────────────────────────────────

function toDMB(asFed: number, moisture: number): number {
  return (asFed / (100 - moisture)) * 100;
}

function inferMoisture(product: Product): number {
  if (product.ga_moisture_pct !== null) return product.ga_moisture_pct;
  switch (product.product_form) {
    case 'wet': return 78;
    case 'raw': return 70;
    case 'freeze_dried': return 7;
    case 'dehydrated': return 8;
    case 'dry': return 10;
    default: return 10;
  }
}

/** Normalize keyword to match canonical_name format (underscored, lowercase). */
const norm = (s: string): string => s.toLowerCase().replace(/[-\s]+/g, '_');

/** Check if any ingredient's canonical_name includes one of the given keywords. */
function hasIngredient(ingredients: ProductIngredient[], keywords: string[]): boolean {
  const normed = keywords.map(norm);
  return ingredients.some(i => {
    const name = norm(i.canonical_name);
    return normed.some(k => name.includes(k));
  });
}

/** Check if any ingredient in the top N positions matches keywords. */
function hasIngredientInTop(ingredients: ProductIngredient[], keywords: string[], topN: number): boolean {
  const normed = keywords.map(norm);
  return ingredients
    .filter(i => i.position <= topN)
    .some(i => {
      const name = norm(i.canonical_name);
      return normed.some(k => name.includes(k));
    });
}

/** D-137 DCM pulse detection — mirrors speciesRules.ts evaluateDcmRisk() logic. */
function dcmFires(ingredients: ProductIngredient[]): boolean {
  const pulses = ingredients.filter(i => i.is_pulse);
  const heavyweight = pulses.some(p => p.position <= 3);
  const density = pulses.filter(p => p.position <= 10).length >= 2;
  const substitution = pulses.some(p => p.position <= 10 && p.is_pulse_protein);
  return heavyweight || density || substitution;
}

/** Count distinct allergen_group values (proxy for distinct animal protein sources). */
function countDistinctProteinSources(ingredients: ProductIngredient[]): number {
  const groups = new Set<string>();
  for (const i of ingredients) {
    if (i.allergen_group && i.is_protein_fat_source) groups.add(i.allergen_group);
  }
  return groups.size;
}

// ─── DMB Context (computed once per scoring call) ─────────

interface DmbContext {
  moisture: number;
  proteinDmb: number | null;
  fatDmb: number | null;
  fiberDmb: number | null;
  carbDmb: number | null;       // D-149: 100 - protein - fat - fiber - ash(7%)
  phosphorusDmb: number | null;
  kcalPerKgDmb: number | null;
  isDry: boolean;
  isWet: boolean;
}

function buildDmbContext(product: Product): DmbContext {
  const moisture = inferMoisture(product);
  const proteinDmb = product.ga_protein_pct !== null ? toDMB(product.ga_protein_pct, moisture) : null;
  const fatDmb = product.ga_fat_pct !== null ? toDMB(product.ga_fat_pct, moisture) : null;
  const fiberDmb = product.ga_fiber_pct !== null ? toDMB(product.ga_fiber_pct, moisture) : null;
  const phosphorusDmb = product.ga_phosphorus_pct !== null ? toDMB(product.ga_phosphorus_pct, moisture) : null;
  const kcalPerKgDmb = product.ga_kcal_per_kg !== null ? product.ga_kcal_per_kg / (1 - moisture / 100) : null;
  const isDry = (product.product_form === 'dry') || moisture <= 12;
  const isWet = (product.product_form === 'wet') || moisture > 50;

  // D-149 carb estimation for diabetic cat rules
  let carbDmb: number | null = null;
  if (proteinDmb !== null && fatDmb !== null && fiberDmb !== null) {
    carbDmb = Math.max(0, 100 - proteinDmb - fatDmb - fiberDmb - 7);
  }

  return { moisture, proteinDmb, fatDmb, fiberDmb, carbDmb, phosphorusDmb, kcalPerKgDmb, isDry, isWet };
}

// ─── Rule Definitions ─────────────────────────────────────

type RuleCheck = (
  product: Product,
  ingredients: ProductIngredient[],
  pet: PetProfile,
  dmb: DmbContext,
) => ConditionAdjustment | null;

interface ConditionRule {
  id: string;
  species: 'both' | 'dog' | 'cat';
  check: RuleCheck;
}

function adj(condition: string, rule: string, points: number, bucket: 'IQ' | 'NP' | 'FC', citation: string, reason: string): ConditionAdjustment {
  return { condition, rule, points, bucket, citation, reason };
}

// ═══════════════════════════════════════════════════════════
// P0: Obesity
// ═══════════════════════════════════════════════════════════

const OBESITY_RULES: ConditionRule[] = [
  { id: 'obesity_high_fiber_bonus', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.fiberDmb !== null && dmb.fiberDmb > 5
        ? adj('obesity', 'obesity_high_fiber_bonus', 2, 'NP', 'Fiber promotes satiety without adding calories', 'High fiber content supports weight management')
        : null },
  { id: 'obesity_high_fat_penalty', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.fatDmb !== null && dmb.fatDmb > 18
        ? adj('obesity', 'obesity_high_fat_penalty', -3, 'NP', 'Calorie-dense fats counteract weight management goals', 'High fat content may hinder weight management')
        : null },
  { id: 'obesity_high_calorie_penalty', species: 'both',
    check: (_p, _i, _pet, dmb) => {
      if (dmb.kcalPerKgDmb === null) return null;
      return dmb.kcalPerKgDmb > (dmb.isDry ? 4200 : 1200)
        ? adj('obesity', 'obesity_high_calorie_penalty', -3, 'NP', 'Energy density works against caloric restriction', 'High calorie density may work against weight management')
        : null;
    }},
  { id: 'obesity_l_carnitine_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['l-carnitine', 'l carnitine'])
        ? adj('obesity', 'obesity_l_carnitine_bonus', 1, 'FC', 'Vandeweerd et al. 2012, JAVMA', 'L-Carnitine supports fat metabolism')
        : null },
  { id: 'obesity_lean_protein_bonus', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.proteinDmb !== null && dmb.fatDmb !== null && dmb.proteinDmb > 30 && dmb.fatDmb < 14
        ? adj('obesity', 'obesity_lean_protein_bonus', 2, 'NP', 'Lean protein preserves muscle during weight loss', 'High protein with low fat supports lean mass preservation')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P0: Underweight
// ═══════════════════════════════════════════════════════════

const UNDERWEIGHT_RULES: ConditionRule[] = [
  { id: 'underweight_high_calorie_bonus', species: 'both',
    check: (_p, _i, _pet, dmb) => {
      if (dmb.kcalPerKgDmb === null) return null;
      return dmb.kcalPerKgDmb > (dmb.isDry ? 4000 : 1100)
        ? adj('underweight', 'underweight_high_calorie_bonus', 2, 'NP', 'Energy-dense foods help safe weight gain', 'Calorie-dense food supports healthy weight gain')
        : null;
    }},
  { id: 'underweight_high_protein_bonus', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.proteinDmb !== null && dmb.proteinDmb > 32
        ? adj('underweight', 'underweight_high_protein_bonus', 2, 'NP', 'High protein supports lean mass rebuilding', 'High protein content supports muscle recovery')
        : null },
  { id: 'underweight_high_fiber_penalty', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.fiberDmb !== null && dmb.fiberDmb > 6
        ? adj('underweight', 'underweight_high_fiber_penalty', -2, 'NP', 'Excess fiber fills stomach before sufficient calories are consumed', 'High fiber may limit caloric intake for underweight pets')
        : null },
  { id: 'underweight_weight_mgmt_penalty', species: 'both',
    check: (product, _i, _pet, _dmb) => {
      const name = product.name.toLowerCase();
      return (name.includes('lite') || name.includes('light') || name.includes('healthy weight') || name.includes('weight management'))
        ? adj('underweight', 'underweight_weight_mgmt_penalty', -3, 'IQ', 'Weight management products are directly counterproductive for underweight pets', 'Weight management formula is not appropriate for underweight pets')
        : null;
    }},
];

// ═══════════════════════════════════════════════════════════
// P0: Sensitive Stomach (gi_sensitive)
// ═══════════════════════════════════════════════════════════

const GI_SENSITIVE_RULES: ConditionRule[] = [
  { id: 'gi_high_fat_penalty_dogs', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.fatDmb !== null && dmb.fatDmb > 18
        ? adj('gi_sensitive', 'gi_high_fat_penalty_dogs', -3, 'NP', 'Fat delays gastric emptying, may trigger diarrhea', 'High fat content can be hard on sensitive stomachs')
        : null },
  { id: 'gi_fiber_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['psyllium', 'pumpkin', 'beet pulp', 'dried beet pulp'])
        ? adj('gi_sensitive', 'gi_fiber_bonus', 1, 'IQ', 'Soluble fiber supports stool quality', 'Contains digestive-friendly fiber sources')
        : null },
  { id: 'gi_prebiotic_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['chicory root', 'dried chicory root', 'inulin', 'fructooligosaccharides', 'fos'])
        ? adj('gi_sensitive', 'gi_prebiotic_bonus', 1, 'IQ', 'Prebiotics support healthy gut microbiome', 'Contains prebiotic ingredients that support gut health')
        : null },
  { id: 'gi_lactose_penalty', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['dried whey', 'whey', 'milk', 'cream', 'whole milk', 'skim milk'], 10)
        ? adj('gi_sensitive', 'gi_lactose_penalty', -2, 'IQ', 'Most adult dogs and cats are lactose intolerant', 'Contains dairy ingredients that may cause digestive upset')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P1: Diabetes — CRITICAL DOG/CAT SPLIT
// ═══════════════════════════════════════════════════════════

const DIABETES_RULES: ConditionRule[] = [
  // ─── Dogs ───
  { id: 'diabetes_dog_high_fiber_bonus', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.fiberDmb !== null && dmb.fiberDmb > 5
        ? adj('diabetes', 'diabetes_dog_high_fiber_bonus', 3, 'NP', 'Fiber slows glucose absorption — key for canine diabetes', 'High fiber supports blood sugar regulation')
        : null },
  { id: 'diabetes_dog_complex_carb_bonus', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['barley', 'sorghum', 'oats', 'oatmeal'], 10)
        ? adj('diabetes', 'diabetes_dog_complex_carb_bonus', 2, 'IQ', 'Low-glycemic complex carbohydrates provide slow-release energy', 'Contains complex carbs that support steady blood sugar')
        : null },
  { id: 'diabetes_simple_sugar_penalty', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['corn syrup', 'molasses', 'fructose', 'dextrose', 'sucrose', 'cane sugar'])
        ? adj('diabetes', 'diabetes_simple_sugar_penalty', -4, 'IQ', 'Simple sugars cause dangerous blood glucose spikes', 'Contains simple sugars that may spike blood glucose')
        : null },
  { id: 'diabetes_dog_semi_moist_penalty', species: 'dog',
    check: (product, _i, _pet, _dmb) =>
      product.product_form === 'semi_moist' || product.product_form === 'semi-moist'
        ? adj('diabetes', 'diabetes_dog_semi_moist_penalty', -3, 'IQ', 'Semi-moist foods often contain sugars/propylene glycol as humectants', 'Semi-moist format often contains added sugars')
        : null },
  // ─── Cats (D-149 carb estimation) ───
  { id: 'diabetes_cat_ultra_low_carb_bonus', species: 'cat',
    check: (_p, _i, _pet, dmb) =>
      dmb.carbDmb !== null && dmb.carbDmb < 10
        ? adj('diabetes', 'diabetes_cat_ultra_low_carb_bonus', 4, 'NP', 'Ultra-low carb diets can support diabetic remission in cats', 'Very low carb content supports feline diabetic management')
        : null },
  { id: 'diabetes_cat_low_carb_bonus', species: 'cat',
    check: (_p, _i, _pet, dmb) =>
      dmb.carbDmb !== null && dmb.carbDmb >= 10 && dmb.carbDmb <= 20
        ? adj('diabetes', 'diabetes_cat_low_carb_bonus', 2, 'NP', 'Low carb supports glycemic control in cats', 'Low carb content supports blood sugar management')
        : null },
  { id: 'diabetes_cat_high_carb_penalty', species: 'cat',
    check: (_p, _i, _pet, dmb) =>
      dmb.carbDmb !== null && dmb.carbDmb > 30
        ? adj('diabetes', 'diabetes_cat_high_carb_penalty', -5, 'NP', 'High carbohydrates directly worsen feline diabetes', 'High carb content is not suitable for diabetic cats')
        : null },
  { id: 'diabetes_cat_wet_food_bonus', species: 'cat',
    check: (product, _i, _pet, dmb) =>
      dmb.isWet || product.product_form === 'wet'
        ? adj('diabetes', 'diabetes_cat_wet_food_bonus', 2, 'FC', 'Wet food is naturally lower in carbohydrates than kibble', 'Wet food format supports lower carb intake')
        : null },
  { id: 'diabetes_cat_dry_kibble_penalty', species: 'cat',
    check: (product, _i, _pet, dmb) =>
      dmb.isDry && product.product_form === 'dry'
        ? adj('diabetes', 'diabetes_cat_dry_kibble_penalty', -2, 'FC', 'Kibble requires starch to form, resulting in higher carb content', 'Dry kibble tends to be higher in carbohydrates')
        : null },
  { id: 'diabetes_cat_gravy_penalty', species: 'cat',
    check: (product, _i, _pet, _dmb) => {
      const name = product.name.toLowerCase();
      return (name.includes('gravy') || name.includes('in sauce'))
        ? adj('diabetes', 'diabetes_cat_gravy_penalty', -1, 'IQ', 'Gravy is typically thickened with cornstarch or flour', 'Gravy formulas may contain added starch')
        : null;
    }},
];

// ═══════════════════════════════════════════════════════════
// P1: Pancreatitis — CRITICAL DOG/CAT SPLIT
// ═══════════════════════════════════════════════════════════

const PANCREATITIS_RULES: ConditionRule[] = [
  // ─── Dogs: fat is THE trigger ───
  { id: 'pancreatitis_dog_high_fat_penalty', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.fatDmb !== null && dmb.fatDmb > 12
        ? adj('pancreatitis', 'pancreatitis_dog_high_fat_penalty', -8, 'NP', 'Fat is the primary dietary trigger for canine pancreatitis', 'Fat content above 12% DMB may trigger flare-ups')
        : null },
  { id: 'pancreatitis_dog_ultra_high_fat', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.fatDmb !== null && dmb.fatDmb > 18
        ? adj('pancreatitis', 'pancreatitis_dog_ultra_high_fat', -7, 'NP', 'A single high-fat meal can trigger a life-threatening flare', 'Very high fat content is a significant concern for pancreatitis')
        : null },
  { id: 'pancreatitis_dog_lean_protein_bonus', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.proteinDmb !== null && dmb.fatDmb !== null && dmb.proteinDmb > 25 && dmb.fatDmb < 10
        ? adj('pancreatitis', 'pancreatitis_dog_lean_protein_bonus', 3, 'NP', 'Lean digestible protein is ideal for pancreatitis management', 'High protein with very low fat is well-suited for pancreatitis')
        : null },
  { id: 'pancreatitis_dog_digestive_enzyme_bonus', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['digestive enzymes', 'protease', 'lipase', 'amylase'])
        ? adj('pancreatitis', 'pancreatitis_dog_digestive_enzyme_bonus', 1, 'FC', 'Digestive enzymes reduce pancreatic workload', 'Contains digestive enzymes that support pancreatic function')
        : null },
  // ─── Cats: NOT fat-triggered — IBD connection ───
  { id: 'pancreatitis_cat_digestible_protein_bonus', species: 'cat',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['fish', 'rabbit', 'egg', 'turkey', 'salmon', 'whitefish', 'trout'], 5)
        ? adj('pancreatitis', 'pancreatitis_cat_digestible_protein_bonus', 2, 'IQ', 'Highly digestible proteins support feline GI/pancreatic health', 'Contains easily digestible protein sources')
        : null },
  { id: 'pancreatitis_cat_novel_protein_bonus', species: 'cat',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['rabbit', 'venison', 'duck', 'quail', 'kangaroo'], 3)
        ? adj('pancreatitis', 'pancreatitis_cat_novel_protein_bonus', 1, 'IQ', 'Novel proteins may reduce underlying IBD-driven inflammation', 'Contains novel protein that may support GI health')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P2: Kidney Disease (CKD) — expanded from migration rule
// ═══════════════════════════════════════════════════════════

const CKD_RULES: ConditionRule[] = [
  // Migrated from nutritionalProfile.ts — compensates for unguarded senior cat protein penalty
  { id: 'ckd_senior_cat_protein_gate', species: 'cat',
    check: (_p, _i, pet, dmb) => {
      const isSenior = pet.life_stage === 'senior' || pet.life_stage === 'geriatric';
      if (!isSenior || dmb.proteinDmb === null) return null;
      return dmb.proteinDmb < 30
        ? adj('ckd', 'ckd_senior_cat_protein_gate', 3, 'NP', 'IRIS CKD staging guidelines — moderate protein preferred for CKD', 'Moderate protein is appropriate for cats with kidney disease')
        : null;
    }},
  { id: 'ckd_high_phosphorus_penalty', species: 'both',
    check: (_p, _i, pet, dmb) => {
      if (dmb.phosphorusDmb === null) return null;
      const threshold = pet.species === 'cat' ? 1.0 : 1.2;
      return dmb.phosphorusDmb > threshold
        ? adj('ckd', 'ckd_high_phosphorus_penalty', -4, 'NP', 'Phosphorus restriction is the #1 dietary intervention for CKD (IRIS)', 'Elevated phosphorus may accelerate kidney disease progression')
        : null;
    }},
  { id: 'ckd_moderate_protein_bonus', species: 'both',
    check: (_p, _i, pet, dmb) => {
      if (dmb.proteinDmb === null) return null;
      const [lo, hi] = pet.species === 'cat' ? [28, 35] : [20, 28];
      return dmb.proteinDmb >= lo && dmb.proteinDmb <= hi
        ? adj('ckd', 'ckd_moderate_protein_bonus', 2, 'NP', 'Moderate high-quality protein supports kidney function without excess workload', 'Protein level is in the moderate range preferred for kidney health')
        : null;
    }},
  { id: 'ckd_high_protein_penalty', species: 'both',
    check: (_p, _i, pet, dmb) => {
      if (dmb.proteinDmb === null) return null;
      const threshold = pet.species === 'cat' ? 42 : 35;
      return dmb.proteinDmb > threshold
        ? adj('ckd', 'ckd_high_protein_penalty', -3, 'NP', 'Excess protein increases kidney workload (NRC-2006)', 'Very high protein may place additional burden on kidneys')
        : null;
    }},
  { id: 'ckd_cat_wet_food_bonus', species: 'cat',
    check: (product, _i, _pet, dmb) =>
      dmb.isWet || product.product_form === 'wet'
        ? adj('ckd', 'ckd_cat_wet_food_bonus', 3, 'FC', 'Hydration is critical for CKD cats — wet food supports fluid intake', 'Wet food supports hydration for kidney health')
        : null },
  { id: 'ckd_omega3_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['fish oil', 'epa', 'dha', 'omega-3', 'salmon oil'])
        ? adj('ckd', 'ckd_omega3_bonus', 1, 'NP', 'Omega-3 fatty acids reduce kidney inflammation (Laflamme)', 'Contains omega-3 that may support kidney health')
        : null },
  { id: 'ckd_high_sodium_penalty', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['salt', 'sodium'], 10)
        ? adj('ckd', 'ckd_high_sodium_penalty', -2, 'IQ', 'Excess sodium worsens hypertension in CKD (IRIS)', 'High sodium content may worsen blood pressure in kidney disease')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P2: Heart Disease (cardiac) — DOG/CAT SPLIT
// ═══════════════════════════════════════════════════════════

const CARDIAC_RULES: ConditionRule[] = [
  // ─── Dogs ───
  { id: 'cardiac_dog_taurine_carnitine_bonus', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['taurine']) && hasIngredient(ingredients, ['l-carnitine', 'l carnitine'])
        ? adj('cardiac', 'cardiac_dog_taurine_carnitine_bonus', 3, 'FC',
            'Taurine + L-Carnitine support cardiac contractility (intentionally additive with D-137 DCM mitigation)',
            'Contains both taurine and L-Carnitine for cardiac support')
        : null },
  { id: 'cardiac_dog_high_sodium_penalty', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['salt', 'sodium'], 10)
        ? adj('cardiac', 'cardiac_dog_high_sodium_penalty', -3, 'IQ', 'Sodium worsens fluid retention in congestive heart failure', 'High sodium content may worsen heart disease symptoms')
        : null },
  { id: 'cardiac_dog_omega3_bonus', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['fish oil', 'epa', 'dha', 'omega-3', 'salmon oil'])
        ? adj('cardiac', 'cardiac_dog_omega3_bonus', 1, 'NP', 'Omega-3 reduces cardiac inflammation and remodeling', 'Contains omega-3 that may support heart health')
        : null },
  // ─── Cats (HCM) ───
  // -5 intentionally stacks with Layer 2 taurine check (×0.90) — documented as intended
  { id: 'cardiac_cat_taurine_missing_penalty', species: 'cat',
    check: (_p, ingredients, _pet, _dmb) =>
      !hasIngredient(ingredients, ['taurine'])
        ? adj('cardiac', 'cardiac_cat_taurine_missing_penalty', -5, 'FC',
            'Taurine deficiency accelerates cardiac failure in cats with HCM (stacks with Layer 2 taurine check)',
            'Missing taurine is a significant concern for cats with heart disease')
        : null },
  { id: 'cardiac_cat_sodium_penalty', species: 'cat',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredientInTop(ingredients, ['salt', 'sodium'], 10)
        ? adj('cardiac', 'cardiac_cat_sodium_penalty', -2, 'IQ', 'Sodium worsens blood pressure in cats with heart disease', 'Sodium content may affect blood pressure management')
        : null },
  { id: 'cardiac_cat_omega3_bonus', species: 'cat',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['fish oil', 'epa', 'dha', 'omega-3', 'salmon oil'])
        ? adj('cardiac', 'cardiac_cat_omega3_bonus', 2, 'NP', 'Omega-3 may reduce clotting risk in HCM cats', 'Contains omega-3 that may support cardiovascular health')
        : null },
  { id: 'cardiac_cat_wet_food_bonus', species: 'cat',
    check: (product, _i, _pet, dmb) =>
      dmb.isWet || product.product_form === 'wet'
        ? adj('cardiac', 'cardiac_cat_wet_food_bonus', 1, 'FC', 'Hydration prevents blood thickening in HCM cats', 'Wet food supports hydration for heart health')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P2: Urinary Issues
// ═══════════════════════════════════════════════════════════

const URINARY_RULES: ConditionRule[] = [
  { id: 'urinary_wet_food_bonus', species: 'both',
    check: (product, _i, _pet, dmb) =>
      dmb.isWet || product.product_form === 'wet'
        ? adj('urinary', 'urinary_wet_food_bonus', 3, 'FC', 'Dilute urine from wet food reduces crystal formation', 'Wet food supports urinary health through hydration')
        : null },
  { id: 'urinary_dry_only_penalty', species: 'both',
    check: (product, _i, _pet, dmb) =>
      dmb.isDry && product.product_form === 'dry'
        ? adj('urinary', 'urinary_dry_only_penalty', -3, 'FC', 'Chronic dehydration from dry-only diets concentrates urine', 'Dry-only diet may concentrate urine')
        : null },
  { id: 'urinary_high_moisture_bonus', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.moisture > 75
        ? adj('urinary', 'urinary_high_moisture_bonus', 1, 'NP', 'Extra moisture further dilutes urine', 'High moisture content supports urinary tract health')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P2: Joint Issues
// ═══════════════════════════════════════════════════════════

const JOINT_RULES: ConditionRule[] = [
  { id: 'joint_omega3_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['fish oil', 'epa', 'dha', 'omega-3', 'salmon oil', 'fish meal'])
        ? adj('joint', 'joint_omega3_bonus', 2, 'NP', 'AAHA 2021 Mobility Guidelines — omega-3 supports joint health', 'Contains omega-3 sources that support joint mobility')
        : null },
  { id: 'joint_high_calorie_penalty', species: 'both',
    check: (_p, _i, _pet, dmb) =>
      dmb.kcalPerKgDmb !== null && dmb.isDry && dmb.kcalPerKgDmb > 4200
        ? adj('joint', 'joint_high_calorie_penalty', -2, 'NP', 'Maintaining lean weight (BCS 4-5/9) is the most effective OA treatment', 'High calorie density may contribute to excess weight that stresses joints')
        : null },
  { id: 'joint_glucosamine_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['glucosamine', 'chondroitin'])
        ? adj('joint', 'joint_glucosamine_bonus', 1, 'FC', 'Vandeweerd et al. 2012, JAVMA — joint supplement support', 'Contains joint-supporting supplements')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P3: Skin & Coat Issues
// ═══════════════════════════════════════════════════════════

const SKIN_RULES: ConditionRule[] = [
  { id: 'skin_omega3_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['fish oil', 'epa', 'dha', 'omega-3', 'salmon oil'])
        ? adj('skin', 'skin_omega3_bonus', 3, 'NP', 'Omega-3 reduces skin inflammation and itching', 'Contains omega-3 that supports skin health')
        : null },
  { id: 'skin_omega6_bonus', species: 'both',
    check: (product, _i, _pet, _dmb) =>
      product.ga_omega6_pct !== null && product.ga_omega6_pct > 0
        ? adj('skin', 'skin_omega6_bonus', 1, 'NP', 'Linoleic acid rebuilds the skin barrier', 'Contains omega-6 for skin barrier support')
        : null },
  { id: 'skin_unnamed_protein_penalty', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      ingredients.some(i => i.is_unnamed_species && i.is_protein_fat_source)
        ? adj('skin', 'skin_unnamed_protein_penalty', -3, 'IQ', 'Unnamed protein sources prevent allergen source verification', 'Contains unnamed protein sources that cannot be verified for allergens')
        : null },
  { id: 'skin_multi_protein_penalty', species: 'both',
    check: (_p, ingredients, _pet, _dmb) =>
      countDistinctProteinSources(ingredients) > 3
        ? adj('skin', 'skin_multi_protein_penalty', -2, 'IQ', 'Multiple protein sources increase allergen exposure surface', 'Contains many protein sources that may increase allergen exposure')
        : null },
  { id: 'skin_limited_protein_bonus', species: 'both',
    check: (_p, ingredients, _pet, _dmb) => {
      const count = countDistinctProteinSources(ingredients);
      return count >= 1 && count <= 2
        ? adj('skin', 'skin_limited_protein_bonus', 2, 'IQ', 'Limited protein sources reduce potential allergen triggers', 'Limited ingredient formula may reduce allergen exposure')
        : null;
    }},
];

// ═══════════════════════════════════════════════════════════
// P3: Hypothyroidism (dogs primarily)
// ═══════════════════════════════════════════════════════════

const HYPOTHYROID_RULES: ConditionRule[] = [
  { id: 'hypothyroid_high_fat_penalty', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.fatDmb !== null && dmb.fatDmb > 16
        ? adj('hypothyroid', 'hypothyroid_high_fat_penalty', -3, 'NP', 'Sluggish metabolism leads to rapid fat storage', 'High fat content may lead to weight gain with hypothyroidism')
        : null },
  { id: 'hypothyroid_high_calorie_penalty', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.kcalPerKgDmb !== null && dmb.kcalPerKgDmb > 4000
        ? adj('hypothyroid', 'hypothyroid_high_calorie_penalty', -2, 'NP', 'Calorie surplus stores as fat with reduced metabolism', 'High calorie density may cause weight gain with hypothyroidism')
        : null },
  { id: 'hypothyroid_high_fiber_bonus', species: 'dog',
    check: (_p, _i, _pet, dmb) =>
      dmb.fiberDmb !== null && dmb.fiberDmb > 5
        ? adj('hypothyroid', 'hypothyroid_high_fiber_bonus', 2, 'NP', 'Fiber keeps dog satiated on restricted calories', 'High fiber supports satiety during caloric restriction')
        : null },
  { id: 'hypothyroid_omega3_bonus', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['fish oil', 'epa', 'dha', 'omega-3', 'salmon oil'])
        ? adj('hypothyroid', 'hypothyroid_omega3_bonus', 2, 'NP', 'Omega-3 combats severe skin/coat degradation from hypothyroidism', 'Contains omega-3 that supports skin health affected by thyroid function')
        : null },
  { id: 'hypothyroid_l_carnitine_bonus', species: 'dog',
    check: (_p, ingredients, _pet, _dmb) =>
      hasIngredient(ingredients, ['l-carnitine', 'l carnitine'])
        ? adj('hypothyroid', 'hypothyroid_l_carnitine_bonus', 1, 'FC', 'L-Carnitine supports fat metabolism with sluggish thyroid', 'L-Carnitine supports fat metabolism')
        : null },
];

// ═══════════════════════════════════════════════════════════
// P3: Hyperthyroidism (cats primarily)
// NOTE: Iodine-restricted sub-type rules need pet_condition_details table (M6 migration).
// Current rules assume medication/surgery management, not iodine-restricted diet.
// ═══════════════════════════════════════════════════════════

const HYPERTHYROID_RULES: ConditionRule[] = [
  { id: 'hyperthyroid_high_calorie_bonus', species: 'cat',
    check: (_p, _i, _pet, dmb) =>
      dmb.kcalPerKgDmb !== null && dmb.kcalPerKgDmb > 4500
        ? adj('hyperthyroid', 'hyperthyroid_high_calorie_bonus', 3, 'NP', 'Hyperthyroid cats burn calories at an extreme rate', 'High calorie density helps compensate for accelerated metabolism')
        : null },
  { id: 'hyperthyroid_high_protein_bonus', species: 'cat',
    check: (_p, _i, _pet, dmb) =>
      dmb.proteinDmb !== null && dmb.proteinDmb > 40
        ? adj('hyperthyroid', 'hyperthyroid_high_protein_bonus', 2, 'NP', 'High protein combats severe muscle wasting from hyperthyroidism', 'High protein supports muscle preservation')
        : null },
  { id: 'hyperthyroid_wet_food_bonus', species: 'cat',
    check: (product, _i, _pet, dmb) =>
      dmb.isWet || product.product_form === 'wet'
        ? adj('hyperthyroid', 'hyperthyroid_wet_food_bonus', 1, 'FC', 'Hydration + higher calorie density per serving', 'Wet food supports hydration and calorie intake')
        : null },
];

// ═══════════════════════════════════════════════════════════
// Condition Registry
// ═══════════════════════════════════════════════════════════

const CONDITION_RULES: Record<string, ConditionRule[]> = {
  // P0
  obesity: OBESITY_RULES,
  underweight: UNDERWEIGHT_RULES,
  gi_sensitive: GI_SENSITIVE_RULES,
  // P1
  diabetes: DIABETES_RULES,
  pancreatitis: PANCREATITIS_RULES,
  // P2
  ckd: CKD_RULES,
  cardiac: CARDIAC_RULES,
  urinary: URINARY_RULES,
  joint: JOINT_RULES,
  // P3
  skin: SKIN_RULES,
  hypothyroid: HYPOTHYROID_RULES,
  hyperthyroid: HYPERTHYROID_RULES,
};

// ─── Cap Logic ────────────────────────────────────────────

const PER_CONDITION_CAP = 8;
const TOTAL_BONUS_CAP = 10;
const TOTAL_PENALTY_CAP = -25;

function applyConditionCaps(adjustments: ConditionAdjustment[]): { capped: ConditionAdjustment[]; total: number } {
  const byCondition = new Map<string, ConditionAdjustment[]>();
  for (const a of adjustments) {
    const existing = byCondition.get(a.condition) ?? [];
    existing.push(a);
    byCondition.set(a.condition, existing);
  }

  const capped: ConditionAdjustment[] = [];

  for (const [conditionName, condAdjs] of byCondition) {
    const condTotal = condAdjs.reduce((s, a) => s + a.points, 0);
    const effectiveCap = conditionName === 'pancreatitis' ? 15 : PER_CONDITION_CAP;
    if (Math.abs(condTotal) <= effectiveCap) {
      capped.push(...condAdjs);
    } else {
      const capValue = condTotal > 0 ? effectiveCap : -effectiveCap;
      const scale = capValue / condTotal;
      for (const a of condAdjs) {
        capped.push({ ...a, points: Math.round(a.points * scale) });
      }
    }
  }

  let bonusTotal = 0;
  let penaltyTotal = 0;
  for (const a of capped) {
    if (a.points > 0) bonusTotal += a.points;
    else penaltyTotal += a.points;
  }

  let total = bonusTotal + penaltyTotal;
  if (bonusTotal > TOTAL_BONUS_CAP) total = TOTAL_BONUS_CAP + penaltyTotal;
  if (penaltyTotal < TOTAL_PENALTY_CAP) total = bonusTotal + TOTAL_PENALTY_CAP;
  if (bonusTotal > TOTAL_BONUS_CAP && penaltyTotal < TOTAL_PENALTY_CAP) {
    total = TOTAL_BONUS_CAP + TOTAL_PENALTY_CAP;
  }

  return { capped, total };
}

// ─── Main Function ────────────────────────────────────────

export function computeConditionAdjustments(
  product: Product,
  ingredients: ProductIngredient[],
  petProfile: PetProfile,
  conditions: string[],
): ConditionScoringResult {
  if (conditions.length === 0) {
    return { adjustments: [], totalAdjustment: 0, zeroOut: false, zeroOutReason: null };
  }

  // ─── Critical safety override: cardiac + DCM = score 0 ──
  // A dog with heart disease eating a food that triggers DCM advisory
  // is a serious health concern. Score is zeroed, not just penalized.
  if (
    petProfile.species === 'dog' &&
    conditions.includes('cardiac') &&
    dcmFires(ingredients)
  ) {
    return {
      adjustments: [adj('cardiac', 'cardiac_dcm_zero_out', 0, 'IQ',
        'FDA DCM investigation — grain-free/pulse-heavy diets linked to dilated cardiomyopathy in dogs',
        'This food triggers a DCM pulse advisory and is not suitable for dogs with heart disease')],
      totalAdjustment: 0,
      zeroOut: true,
      zeroOutReason: 'Food triggers DCM pulse advisory — not suitable for dogs with heart disease',
    };
  }

  const dmb = buildDmbContext(product);
  const allAdjustments: ConditionAdjustment[] = [];

  for (const condition of conditions) {
    const rules = CONDITION_RULES[condition];
    if (!rules) continue;

    for (const rule of rules) {
      if (rule.species !== 'both' && rule.species !== petProfile.species) continue;
      const result = rule.check(product, ingredients, petProfile, dmb);
      if (result) allAdjustments.push(result);
    }
  }

  const { capped, total } = applyConditionCaps(allAdjustments);
  return { adjustments: capped, totalAdjustment: total, zeroOut: false, zeroOutReason: null };
}
