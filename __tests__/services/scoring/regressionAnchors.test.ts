/**
 * Regression Anchor Tests — Golden-File Snapshots
 *
 * These tests hard-assert the exact scores for known products and snapshot
 * the full ScoredResult shape. Any change to anchor scores or result shape
 * requires explicit review.
 *
 * Run: npx jest --testPathPattern=regressionAnchors
 * Update snapshots: npx jest --testPathPattern=regressionAnchors -u
 */

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category, Species, LifeStage, PreservativeType } from '../../../src/types';

// ─── Helpers (same pattern as engine.test.ts) ─────────────

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

// ─── Anchor 1: Pure Balance Wild & Free Salmon & Pea (Dog) = 62 ───

describe('Regression Anchor: Pure Balance (Dog) = 62', () => {
  const product = makeProduct({
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

  const ingredients: ProductIngredient[] = [
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

  const pet = makePet({ life_stage: LifeStage.Adult });

  test('finalScore === 62', () => {
    const result = computeScore(product, ingredients, pet);
    expect(result.finalScore).toBe(62);
  });

  test('full result shape snapshot', () => {
    const result = computeScore(product, ingredients, pet);
    expect(result).toMatchSnapshot();
  });
});

// ─── Anchor 2: Temptations Classic Tuna (Cat Treat) = 9 ──────────

describe('Regression Anchor: Temptations (Cat Treat) = 9', () => {
  const product = makeProduct({
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

  const ingredients: ProductIngredient[] = [
    makeIngredient({ position: 1, canonical_name: 'chicken by-product meal', cat_base_severity: 'caution', cat_carb_flag: false, is_protein_fat_source: true }),
    makeIngredient({ position: 2, canonical_name: 'ground corn', cat_base_severity: 'caution', cat_carb_flag: true }),
    makeIngredient({ position: 3, canonical_name: 'animal fat', cat_base_severity: 'caution', is_unnamed_species: true, cat_carb_flag: false, is_protein_fat_source: true }),
    makeIngredient({ position: 4, canonical_name: 'dried meat by-products', cat_base_severity: 'caution', cat_carb_flag: false, is_protein_fat_source: true }),
    makeIngredient({ position: 5, canonical_name: 'brewers rice', cat_base_severity: 'neutral', cat_carb_flag: true }),
    makeIngredient({ position: 6, canonical_name: 'wheat flour', cat_base_severity: 'neutral', cat_carb_flag: true }),
    makeIngredient({ position: 7, canonical_name: 'natural flavor', cat_base_severity: 'neutral', is_unnamed_species: true, is_protein_fat_source: true }),
    makeIngredient({ position: 8, canonical_name: 'dried yeast', cat_base_severity: 'neutral' }),
    makeIngredient({ position: 9, canonical_name: 'potassium chloride', cat_base_severity: 'neutral' }),
    makeIngredient({ position: 10, canonical_name: 'yellow 5', dog_base_severity: 'danger', cat_base_severity: 'danger', position_reduction_eligible: false }),
    makeIngredient({ position: 11, canonical_name: 'red 40', dog_base_severity: 'danger', cat_base_severity: 'danger', position_reduction_eligible: false }),
    makeIngredient({ position: 12, canonical_name: 'blue 2', dog_base_severity: 'danger', cat_base_severity: 'danger', position_reduction_eligible: false }),
  ];

  const pet = makePet({ species: Species.Cat, life_stage: LifeStage.Adult });

  test('finalScore === 9', () => {
    const result = computeScore(product, ingredients, pet);
    expect(result.finalScore).toBe(9);
  });

  test('full result shape snapshot', () => {
    const result = computeScore(product, ingredients, pet);
    expect(result).toMatchSnapshot();
  });
});
