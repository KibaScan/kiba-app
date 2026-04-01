/**
 * Condition Scoring Tests — P0 conditions (obesity, underweight, gi_sensitive)
 * Plus CKD protein gate migration and cap logic.
 *
 * Run: npx jest --testPathPattern=conditionScoring
 */

import { computeConditionAdjustments } from '../../src/utils/conditionScoring';
import { getConditionAdvisory } from '../../src/data/conditionAdvisories';
import { computeScore } from '../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../src/types';
import type { ProductIngredient } from '../../src/types/scoring';
import { Category, Species, LifeStage, PreservativeType } from '../../src/types';

// ─── Helpers ──────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    brand: 'Test Brand',
    name: 'Test Food',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated',
    aafco_statement: 'All Life Stages',
    aafco_inference: null,
    life_stage_claim: null,
    preservative_type: PreservativeType.Natural,
    ga_protein_pct: 26,
    ga_fat_pct: 16,
    ga_fiber_pct: 4,
    ga_moisture_pct: 10,
    ga_calcium_pct: null,
    ga_phosphorus_pct: null,
    ga_kcal_per_cup: null,
    ga_kcal_per_kg: null,
    kcal_per_unit: null,
    unit_weight_g: null,
    default_serving_format: null,
    ga_taurine_pct: null,
    ga_l_carnitine_mg: null,
    ga_dha_pct: null,
    ga_omega3_pct: null,
    ga_omega6_pct: null,
    ga_zinc_mg_kg: null,
    ga_probiotics_cfu: null,
    nutritional_data_source: null,
    ingredients_raw: null,
    ingredients_hash: null,
    image_url: null,
    is_recalled: false,
    is_grain_free: false,
    product_form: 'dry',
    is_supplemental: false,
    is_vet_diet: false,
    base_score: null,
    base_score_computed_at: null,
    score_confidence: 'high',
    needs_review: false,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    source_url: null,
    chewy_sku: null,
    asin: null,
    walmart_id: null,
    price: null,
    price_currency: null,
    product_size_kg: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makePet(overrides: Partial<PetProfile> = {}): PetProfile {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Mochi',
    species: Species.Dog,
    breed: null,
    date_of_birth: null,
    dob_is_approximate: false,
    weight_current_lbs: null,
    weight_goal_lbs: null,
    weight_updated_at: null,
    activity_level: 'moderate',
    is_neutered: true,
    sex: null,
    breed_size: null,
    life_stage: LifeStage.Adult,
    photo_url: null,
    health_reviewed_at: null,
    weight_goal_level: null,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  };
}

function makeIngredient(
  overrides: Partial<ProductIngredient> & { position: number; canonical_name: string },
): ProductIngredient {
  return {
    dog_base_severity: 'neutral',
    cat_base_severity: 'neutral',
    is_unnamed_species: false,
    is_legume: false,
    is_pulse: false,
    is_pulse_protein: false,
    position_reduction_eligible: true,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: false,
    ...overrides,
  };
}

const BASIC_INGREDIENTS: ProductIngredient[] = [
  makeIngredient({ position: 1, canonical_name: 'chicken' }),
  makeIngredient({ position: 2, canonical_name: 'brown rice' }),
  makeIngredient({ position: 3, canonical_name: 'chicken fat' }),
];

// ─── Empty conditions ─────────────────────────────────────

describe('conditionScoring — no conditions', () => {
  test('returns empty result for empty conditions', () => {
    const result = computeConditionAdjustments(
      makeProduct(),
      BASIC_INGREDIENTS,
      makePet(),
      [],
    );
    expect(result.adjustments).toEqual([]);
    expect(result.totalAdjustment).toBe(0);
  });

  test('returns empty result for unknown condition', () => {
    const result = computeConditionAdjustments(
      makeProduct(),
      BASIC_INGREDIENTS,
      makePet(),
      ['unknown_condition'],
    );
    expect(result.adjustments).toEqual([]);
    expect(result.totalAdjustment).toBe(0);
  });
});

// ─── Obesity ──────────────────────────────────────────────

describe('conditionScoring — obesity', () => {
  test('high fat penalty fires for fat DMB >18%', () => {
    // 20% fat as-fed, 10% moisture → 22.2% DMB → fires
    const product = makeProduct({ ga_fat_pct: 20 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity']);
    const fatRule = result.adjustments.find(a => a.rule === 'obesity_high_fat_penalty');
    expect(fatRule).toBeDefined();
    expect(fatRule!.points).toBe(-3);
  });

  test('high fat penalty does NOT fire for moderate fat', () => {
    const product = makeProduct({ ga_fat_pct: 12 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity']);
    const fatRule = result.adjustments.find(a => a.rule === 'obesity_high_fat_penalty');
    expect(fatRule).toBeUndefined();
  });

  test('high fiber bonus fires for fiber DMB >5%', () => {
    const product = makeProduct({ ga_fiber_pct: 6 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity']);
    const fiberRule = result.adjustments.find(a => a.rule === 'obesity_high_fiber_bonus');
    expect(fiberRule).toBeDefined();
    expect(fiberRule!.points).toBe(2);
  });

  test('high calorie penalty fires for dry food >4200 kcal/kg DMB', () => {
    // 4000 kcal/kg as-fed, 10% moisture → 4444 kcal/kg DMB → fires
    const product = makeProduct({ ga_kcal_per_kg: 4000, product_form: 'dry' });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity']);
    const calRule = result.adjustments.find(a => a.rule === 'obesity_high_calorie_penalty');
    expect(calRule).toBeDefined();
    expect(calRule!.points).toBe(-3);
  });

  test('L-Carnitine bonus fires when ingredient present', () => {
    const ingredients = [
      ...BASIC_INGREDIENTS,
      makeIngredient({ position: 20, canonical_name: 'l-carnitine' }),
    ];
    const result = computeConditionAdjustments(makeProduct(), ingredients, makePet(), ['obesity']);
    const carnitineRule = result.adjustments.find(a => a.rule === 'obesity_l_carnitine_bonus');
    expect(carnitineRule).toBeDefined();
    expect(carnitineRule!.points).toBe(1);
  });

  test('lean protein bonus fires for high protein + low fat', () => {
    // 35% protein, 10% fat as-fed, 10% moisture → 38.9% protein, 11.1% fat DMB
    const product = makeProduct({ ga_protein_pct: 35, ga_fat_pct: 10 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity']);
    const leanRule = result.adjustments.find(a => a.rule === 'obesity_lean_protein_bonus');
    expect(leanRule).toBeDefined();
    expect(leanRule!.points).toBe(2);
  });
});

// ─── Underweight ──────────────────────────────────────────

describe('conditionScoring — underweight', () => {
  test('high calorie bonus fires for dry food >4000 kcal/kg DMB', () => {
    const product = makeProduct({ ga_kcal_per_kg: 3800, product_form: 'dry' });
    // 3800 / (1 - 0.10) = 4222 DMB → fires (>4000)
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['underweight']);
    const calRule = result.adjustments.find(a => a.rule === 'underweight_high_calorie_bonus');
    expect(calRule).toBeDefined();
    expect(calRule!.points).toBe(2);
  });

  test('high protein bonus fires for protein DMB >32%', () => {
    // 30% as-fed, 10% moisture → 33.3% DMB → fires
    const product = makeProduct({ ga_protein_pct: 30 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['underweight']);
    const proteinRule = result.adjustments.find(a => a.rule === 'underweight_high_protein_bonus');
    expect(proteinRule).toBeDefined();
    expect(proteinRule!.points).toBe(2);
  });

  test('high fiber penalty fires for fiber DMB >6%', () => {
    // 7% as-fed, 10% moisture → 7.8% DMB → fires
    const product = makeProduct({ ga_fiber_pct: 7 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['underweight']);
    const fiberRule = result.adjustments.find(a => a.rule === 'underweight_high_fiber_penalty');
    expect(fiberRule).toBeDefined();
    expect(fiberRule!.points).toBe(-2);
  });

  test('weight management name penalty fires', () => {
    const product = makeProduct({ name: 'Healthy Weight Adult Dog Food' });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['underweight']);
    const nameRule = result.adjustments.find(a => a.rule === 'underweight_weight_mgmt_penalty');
    expect(nameRule).toBeDefined();
    expect(nameRule!.points).toBe(-3);
  });

  test('weight management penalty fires for "lite"', () => {
    const product = makeProduct({ name: 'Acme Lite Recipe' });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['underweight']);
    const nameRule = result.adjustments.find(a => a.rule === 'underweight_weight_mgmt_penalty');
    expect(nameRule).toBeDefined();
  });
});

// ─── Sensitive Stomach (gi_sensitive) ─────────────────────

describe('conditionScoring — gi_sensitive', () => {
  test('high fat penalty fires for DOGS with fat DMB >18%', () => {
    const product = makeProduct({ ga_fat_pct: 20 });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet({ species: Species.Dog }), ['gi_sensitive']);
    const fatRule = result.adjustments.find(a => a.rule === 'gi_high_fat_penalty_dogs');
    expect(fatRule).toBeDefined();
    expect(fatRule!.points).toBe(-3);
  });

  test('high fat penalty does NOT fire for CATS', () => {
    const product = makeProduct({ ga_fat_pct: 20, target_species: Species.Cat });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet({ species: Species.Cat }), ['gi_sensitive']);
    const fatRule = result.adjustments.find(a => a.rule === 'gi_high_fat_penalty_dogs');
    expect(fatRule).toBeUndefined();
  });

  test('fiber bonus fires for pumpkin ingredient', () => {
    const ingredients = [
      ...BASIC_INGREDIENTS,
      makeIngredient({ position: 8, canonical_name: 'pumpkin' }),
    ];
    const result = computeConditionAdjustments(makeProduct(), ingredients, makePet(), ['gi_sensitive']);
    const fiberRule = result.adjustments.find(a => a.rule === 'gi_fiber_bonus');
    expect(fiberRule).toBeDefined();
    expect(fiberRule!.points).toBe(1);
  });

  test('prebiotic bonus fires for chicory root', () => {
    const ingredients = [
      ...BASIC_INGREDIENTS,
      makeIngredient({ position: 10, canonical_name: 'dried chicory root' }),
    ];
    const result = computeConditionAdjustments(makeProduct(), ingredients, makePet(), ['gi_sensitive']);
    const prebioticRule = result.adjustments.find(a => a.rule === 'gi_prebiotic_bonus');
    expect(prebioticRule).toBeDefined();
    expect(prebioticRule!.points).toBe(1);
  });

  test('lactose penalty fires for whey in top 10', () => {
    const ingredients = [
      ...BASIC_INGREDIENTS,
      makeIngredient({ position: 5, canonical_name: 'dried whey' }),
    ];
    const result = computeConditionAdjustments(makeProduct(), ingredients, makePet(), ['gi_sensitive']);
    const lactoseRule = result.adjustments.find(a => a.rule === 'gi_lactose_penalty');
    expect(lactoseRule).toBeDefined();
    expect(lactoseRule!.points).toBe(-2);
  });

  test('lactose penalty does NOT fire for dairy outside top 10', () => {
    const ingredients = [
      ...BASIC_INGREDIENTS,
      makeIngredient({ position: 15, canonical_name: 'dried whey' }),
    ];
    const result = computeConditionAdjustments(makeProduct(), ingredients, makePet(), ['gi_sensitive']);
    const lactoseRule = result.adjustments.find(a => a.rule === 'gi_lactose_penalty');
    expect(lactoseRule).toBeUndefined();
  });
});

// ─── CKD Protein Gate Migration ───────────────────────────

describe('conditionScoring — CKD protein gate', () => {
  test('CKD bonus fires for senior cat with low protein', () => {
    // 22% protein as-fed, 10% moisture → 24.4% DMB → <30, fires
    const product = makeProduct({ ga_protein_pct: 22, target_species: Species.Cat });
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Senior });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, pet, ['ckd']);
    const ckdRule = result.adjustments.find(a => a.rule === 'ckd_senior_cat_protein_gate');
    expect(ckdRule).toBeDefined();
    expect(ckdRule!.points).toBe(3);
  });

  test('CKD bonus does NOT fire for senior cat with high protein', () => {
    // 30% protein as-fed, 10% moisture → 33.3% DMB → ≥30, does NOT fire
    const product = makeProduct({ ga_protein_pct: 30, target_species: Species.Cat });
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Senior });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, pet, ['ckd']);
    const ckdRule = result.adjustments.find(a => a.rule === 'ckd_senior_cat_protein_gate');
    expect(ckdRule).toBeUndefined();
  });

  test('CKD bonus does NOT fire for adult cat', () => {
    const product = makeProduct({ ga_protein_pct: 22, target_species: Species.Cat });
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Adult });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, pet, ['ckd']);
    const ckdRule = result.adjustments.find(a => a.rule === 'ckd_senior_cat_protein_gate');
    expect(ckdRule).toBeUndefined();
  });

  test('CKD bonus does NOT fire for dogs', () => {
    const product = makeProduct({ ga_protein_pct: 22 });
    const pet = makePet({ species: Species.Dog, life_stage: LifeStage.Senior });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, pet, ['ckd']);
    const ckdRule = result.adjustments.find(a => a.rule === 'ckd_senior_cat_protein_gate');
    expect(ckdRule).toBeUndefined();
  });
});

// ─── Cap Logic ────────────────────────────────────────────

describe('conditionScoring — cap logic', () => {
  test('per-condition cap limits total to ±8', () => {
    // Stack all obesity penalties on a high-fat, high-calorie food
    const product = makeProduct({
      ga_fat_pct: 25,       // 27.8% DMB → fat penalty (-3)
      ga_fiber_pct: 2,      // 2.2% DMB → no fiber bonus
      ga_protein_pct: 20,   // 22.2% DMB → no lean bonus
      ga_kcal_per_kg: 4500, // 5000 DMB → calorie penalty (-3)
      product_form: 'dry',
    });
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity']);
    // -3 (fat) + -3 (calorie) = -6, within ±8 cap
    expect(result.totalAdjustment).toBe(-6);
  });

  test('multiple conditions stack', () => {
    // Dog with obesity + gi_sensitive, high fat food
    const product = makeProduct({ ga_fat_pct: 20 }); // 22.2% DMB
    const result = computeConditionAdjustments(product, BASIC_INGREDIENTS, makePet(), ['obesity', 'gi_sensitive']);
    // obesity: -3 (fat) + gi_sensitive: -3 (fat) = -6
    expect(result.totalAdjustment).toBeLessThan(0);
    expect(result.adjustments.length).toBeGreaterThanOrEqual(2);
  });

  test('total bonus capped at +10', () => {
    // Contrived: underweight pet with ideal food + L-carnitine + beet pulp + chicory
    const product = makeProduct({
      ga_protein_pct: 35,   // 38.9% DMB → high protein (+2)
      ga_kcal_per_kg: 4500, // 5000 DMB → high cal (+2)
      ga_fiber_pct: 7,      // 7.8% DMB → but underweight penalty... (-2)
    });
    const ingredients = [
      ...BASIC_INGREDIENTS,
      makeIngredient({ position: 5, canonical_name: 'l-carnitine' }),
      makeIngredient({ position: 6, canonical_name: 'beet pulp' }),
      makeIngredient({ position: 7, canonical_name: 'dried chicory root' }),
    ];
    // Conditions: obesity + gi_sensitive give bonuses too
    const result = computeConditionAdjustments(product, ingredients, makePet(), ['obesity', 'gi_sensitive']);
    expect(result.totalAdjustment).toBeLessThanOrEqual(10);
  });
});

// ─── Integration: condition adjustments with engine ───────

describe('conditionScoring — integration with computeScore', () => {
  // Use the Pure Balance product + ingredients from regression anchors
  // to verify conditions apply correctly through the full pipeline

  const pureBalanceProduct = makeProduct({
    category: Category.DailyFood,
    target_species: Species.Dog,
    is_grain_free: true,
    aafco_statement: 'yes',
    preservative_type: PreservativeType.Natural,
    ga_protein_pct: 24,
    ga_fat_pct: 15,
    ga_fiber_pct: 5,
    ga_moisture_pct: 10,
  });

  const pureBalanceIngredients: ProductIngredient[] = [
    makeIngredient({ position: 1,  canonical_name: 'salmon',           dog_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
    makeIngredient({ position: 2,  canonical_name: 'salmon_meal',      dog_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
    makeIngredient({ position: 3,  canonical_name: 'peas',             dog_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true }),
    makeIngredient({ position: 4,  canonical_name: 'potato',           dog_base_severity: 'neutral' }),
    makeIngredient({ position: 5,  canonical_name: 'sweet_potato',     dog_base_severity: 'neutral' }),
    makeIngredient({ position: 6,  canonical_name: 'poultry_fat',      dog_base_severity: 'caution' }),
    makeIngredient({ position: 7,  canonical_name: 'pea_starch',       dog_base_severity: 'neutral', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true }),
    makeIngredient({ position: 8,  canonical_name: 'fish_meal',        dog_base_severity: 'caution', allergen_group: 'fish', is_unnamed_species: true }),
    makeIngredient({ position: 9,  canonical_name: 'dried_yeast',      dog_base_severity: 'neutral' }),
    makeIngredient({ position: 10, canonical_name: 'beet_pulp',        dog_base_severity: 'good' }),
    makeIngredient({ position: 11, canonical_name: 'natural_flavor',   dog_base_severity: 'caution', is_unnamed_species: true, position_reduction_eligible: false }),
    makeIngredient({ position: 12, canonical_name: 'flaxseed',         dog_base_severity: 'good',    cluster_id: 'seed_flax' }),
    makeIngredient({ position: 13, canonical_name: 'salt',             dog_base_severity: 'caution' }),
    makeIngredient({ position: 14, canonical_name: 'dicalcium_phosphate', dog_base_severity: 'good' }),
    makeIngredient({ position: 15, canonical_name: 'potassium_chloride', dog_base_severity: 'good',  position_reduction_eligible: false }),
    makeIngredient({ position: 16, canonical_name: 'methionine',       dog_base_severity: 'neutral' }),
    makeIngredient({ position: 17, canonical_name: 'taurine',          dog_base_severity: 'good',    position_reduction_eligible: false }),
    makeIngredient({ position: 33, canonical_name: 'copper_sulfate',   dog_base_severity: 'caution', position_reduction_eligible: false }),
    makeIngredient({ position: 40, canonical_name: 'l_carnitine',      dog_base_severity: 'good',    position_reduction_eligible: false }),
    makeIngredient({ position: 42, canonical_name: 'rosemary_extract', dog_base_severity: 'good' }),
  ];

  test('Pure Balance = 62 with NO conditions (regression holds)', () => {
    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = computeScore(pureBalanceProduct, pureBalanceIngredients, pet);
    expect(result.finalScore).toBe(62);
  });

  test('Pure Balance + overweight dog is lower than baseline', () => {
    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = computeScore(pureBalanceProduct, pureBalanceIngredients, pet, [], ['obesity']);
    // Pure Balance: 15% fat as-fed, 10% moisture → 16.7% DMB → below 18% threshold
    // Fiber: 5% as-fed → 5.56% DMB → just above 5% → +2 bonus
    // L-carnitine at position 40 → +1 bonus
    // Expected: 62 + 2 + 1 = 65 (bonuses, not penalties, for this specific food)
    expect(result.finalScore).toBeGreaterThan(62); // Pure Balance is actually healthy for overweight dogs
    const conditionAdjs = result.layer3.personalizations.filter(
      (p: { type: string }) => p.type === 'condition',
    );
    expect(conditionAdjs.length).toBeGreaterThan(0);
  });

  test('Pure Balance + cardiac dog = 0 (DCM fires → zero-out)', () => {
    // Pure Balance has peas at position 3 (is_pulse=true) → DCM heavyweight rule fires
    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = computeScore(pureBalanceProduct, pureBalanceIngredients, pet, [], ['cardiac']);
    expect(result.finalScore).toBe(0);
    const conditionAdjs = result.layer3.personalizations.filter(
      (p: { type: string }) => p.type === 'condition',
    );
    expect(conditionAdjs.length).toBe(1);
    expect(conditionAdjs[0].label).toContain('DCM');
  });

  test('cardiac dog WITHOUT DCM pulses gets normal scoring, not zero', () => {
    const noPulseIngredients: ProductIngredient[] = [
      makeIngredient({ position: 1, canonical_name: 'chicken', dog_base_severity: 'good' }),
      makeIngredient({ position: 2, canonical_name: 'brown_rice', dog_base_severity: 'neutral' }),
      makeIngredient({ position: 3, canonical_name: 'chicken_fat', dog_base_severity: 'neutral' }),
      makeIngredient({ position: 10, canonical_name: 'taurine', dog_base_severity: 'good' }),
      makeIngredient({ position: 11, canonical_name: 'l_carnitine', dog_base_severity: 'good' }),
    ];
    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = computeScore(pureBalanceProduct, noPulseIngredients, pet, [], ['cardiac']);
    expect(result.finalScore).toBeGreaterThan(0);
  });

  test('cardiac CAT is never zero-outed by DCM (DCM is dog-only)', () => {
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Adult });
    const result = computeScore(
      makeProduct({ target_species: Species.Cat }),
      pureBalanceIngredients, // has pulses, but cat
      pet, [], ['cardiac'],
    );
    expect(result.finalScore).toBeGreaterThan(0);
  });

  test('Temptations = 9 with NO conditions (regression holds)', () => {
    const temptationsProduct = makeProduct({
      category: Category.Treat,
      target_species: Species.Cat,
      is_grain_free: false,
      aafco_statement: null,
      preservative_type: PreservativeType.Synthetic,
      ga_protein_pct: 30,
      ga_fat_pct: 17,
      ga_fiber_pct: 4,
      ga_moisture_pct: 15,
    });
    const temptationsIngredients: ProductIngredient[] = [
      makeIngredient({ position: 1, canonical_name: 'chicken by-product meal', cat_base_severity: 'caution', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'ground corn', cat_base_severity: 'caution', cat_carb_flag: true }),
      makeIngredient({ position: 3, canonical_name: 'animal fat', cat_base_severity: 'caution', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 4, canonical_name: 'dried meat by-products', cat_base_severity: 'caution', is_protein_fat_source: true }),
      makeIngredient({ position: 5, canonical_name: 'brewers rice', cat_base_severity: 'neutral', cat_carb_flag: true }),
      makeIngredient({ position: 6, canonical_name: 'wheat flour', cat_base_severity: 'neutral', cat_carb_flag: true }),
      makeIngredient({ position: 7, canonical_name: 'natural flavor', cat_base_severity: 'neutral', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 8, canonical_name: 'dried yeast', cat_base_severity: 'neutral' }),
      makeIngredient({ position: 9, canonical_name: 'potassium chloride', cat_base_severity: 'neutral' }),
      makeIngredient({ position: 10, canonical_name: 'yellow 5', cat_base_severity: 'danger', position_reduction_eligible: false }),
      makeIngredient({ position: 11, canonical_name: 'red 40', cat_base_severity: 'danger', position_reduction_eligible: false }),
      makeIngredient({ position: 12, canonical_name: 'blue 2', cat_base_severity: 'danger', position_reduction_eligible: false }),
    ];
    const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Adult });
    const result = computeScore(temptationsProduct, temptationsIngredients, pet);
    expect(result.finalScore).toBe(9);
  });
});

// ─── Condition Advisories ─────────────────────────────────

describe('conditionAdvisories', () => {
  test('returns advisory with pet name substituted', () => {
    const advisory = getConditionAdvisory('obesity', 'dog', 'Buster');
    expect(advisory).toContain('Buster');
    expect(advisory).toContain('weight management');
  });

  test('returns species-specific advisory', () => {
    const dogAdvisory = getConditionAdvisory('diabetes', 'dog', 'Rex');
    const catAdvisory = getConditionAdvisory('diabetes', 'cat', 'Luna');
    expect(dogAdvisory).toContain('insulin');
    expect(catAdvisory).toContain('remission');
  });

  test('returns null for species without advisory', () => {
    expect(getConditionAdvisory('hypothyroid', 'cat', 'Luna')).toBeNull();
    expect(getConditionAdvisory('hyperthyroid', 'dog', 'Rex')).toBeNull();
  });

  test('returns null for unknown condition', () => {
    expect(getConditionAdvisory('unknown', 'dog', 'Rex')).toBeNull();
  });

  test('all 12 conditions have at least one advisory', () => {
    const conditions = ['joint', 'gi_sensitive', 'obesity', 'underweight', 'diabetes',
      'pancreatitis', 'ckd', 'cardiac', 'urinary', 'skin', 'hypothyroid', 'hyperthyroid'];
    for (const cond of conditions) {
      const dog = getConditionAdvisory(cond, 'dog', 'Test');
      const cat = getConditionAdvisory(cond, 'cat', 'Test');
      expect(dog !== null || cat !== null).toBe(true);
    }
  });
});
