/**
 * Contract Tests — Scoring Engine Output Shape Validation
 *
 * Validates that each scoring layer returns the expected interface shape.
 * Catches interface drift without being brittle on exact values.
 *
 * Run: npx jest --testPathPattern=contracts
 */

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../../src/types';
import type { ProductIngredient, ScoredResult } from '../../../src/types/scoring';
import { Category, Species, LifeStage, PreservativeType } from '../../../src/types';

// ─── Minimal fixtures (just enough to exercise all layers) ────

const product: Product = {
  id: 'contract-test',
  brand: 'Contract Brand',
  name: 'Contract Food',
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
  product_form: null,
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
};

const ingredients: ProductIngredient[] = [
  {
    position: 1,
    canonical_name: 'chicken',
    dog_base_severity: 'good',
    cat_base_severity: 'good',
    is_unnamed_species: false,
    is_legume: false,
    is_pulse: false,
    is_pulse_protein: false,
    position_reduction_eligible: true,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: true,
  },
];

const pet: PetProfile = {
  id: 'pet-1',
  user_id: 'user-1',
  name: 'TestDog',
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
  feeding_style: 'dry_only',
  wet_reserve_kcal: 0,
  wet_reserve_source: null,
  wet_intent_resolved_at: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

// ─── Contract: ScoredResult shape ─────────────────────────

describe('ScoredResult contract', () => {
  let result: ScoredResult;

  beforeAll(() => {
    result = computeScore(product, ingredients, pet);
  });

  test('core score fields', () => {
    expect(typeof result.finalScore).toBe('number');
    expect(result.finalScore).toBeGreaterThanOrEqual(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
    expect(typeof result.displayScore).toBe('number');
  });

  test('petName field', () => {
    expect(result.petName).toBe('TestDog');
  });

  test('layer1 breakdown', () => {
    expect(typeof result.layer1.ingredientQuality).toBe('number');
    expect(typeof result.layer1.nutritionalProfile).toBe('number');
    expect(typeof result.layer1.formulation).toBe('number');
    expect(typeof result.layer1.weightedComposite).toBe('number');
  });

  test('layer2 breakdown', () => {
    expect(typeof result.layer2.speciesAdjustment).toBe('number');
    expect(Array.isArray(result.layer2.appliedRules)).toBe(true);
    for (const rule of result.layer2.appliedRules) {
      expect(typeof rule.ruleId).toBe('string');
      expect(typeof rule.fired).toBe('boolean');
      expect(typeof rule.adjustment).toBe('number');
    }
  });

  test('layer3 breakdown', () => {
    expect(Array.isArray(result.layer3.personalizations)).toBe(true);
    expect(Array.isArray(result.layer3.allergenWarnings)).toBe(true);
  });

  test('ingredient penalties array', () => {
    expect(Array.isArray(result.ingredientPenalties)).toBe(true);
    expect(Array.isArray(result.ingredientResults)).toBe(true);
  });

  test('flags array', () => {
    expect(Array.isArray(result.flags)).toBe(true);
  });

  test('data quality signals', () => {
    expect(typeof result.isPartialScore).toBe('boolean');
    expect(typeof result.isRecalled).toBe('boolean');
    expect(typeof result.llmExtracted).toBe('boolean');
  });

  test('allergen delta', () => {
    expect(typeof result.allergenDelta).toBe('number');
  });

  test('category field', () => {
    expect(['daily_food', 'treat']).toContain(result.category);
  });
});
