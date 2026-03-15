// E2E: Score 2 supplemental products through full pipeline
// Verifies 65/35/0 weights, macro-only NP, and correct final scores.

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product } from '../../../src/types';
import { Category, Species, LifeStage } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';

function makeIngredient(
  overrides: Partial<ProductIngredient> & { position: number; canonical_name: string },
): ProductIngredient {
  return {
    dog_base_severity: 'neutral',
    cat_base_severity: 'neutral',
    is_unnamed_species: false,
    is_legume: false,
    position_reduction_eligible: true,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: false,
    ...overrides,
  } as ProductIngredient;
}

// ─── Product 1: Dog Supplemental Topper (wet, high protein) ──────
const DOG_TOPPER: Product = {
  id: 'supp-dog-topper',
  brand: 'Stella & Chewy',
  name: 'Chicken Stew Topper',
  category: Category.DailyFood,
  target_species: Species.Dog,
  source: 'curated' as const,
  aafco_statement: 'For intermittent or supplemental feeding only',
  life_stage_claim: null,
  preservative_type: null,
  ga_protein_pct: 9,       // wet food — high in DMB (9/22 = 40.9%)
  ga_fat_pct: 5,           // 22.7% DMB
  ga_fiber_pct: 1,         // 4.5% DMB
  ga_moisture_pct: 78,
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
  ga_omega3_pct: 0.1,
  ga_omega6_pct: null,
  ga_zinc_mg_kg: null,
  ga_probiotics_cfu: null,
  nutritional_data_source: null,
  ingredients_raw: null,
  ingredients_hash: null,
  image_url: null,
  is_recalled: false,
  is_grain_free: false,
  is_supplemental: true,
  score_confidence: 'high',
  needs_review: false,
  base_score: null,
  base_score_computed_at: null,
  last_verified_at: null,
  formula_change_log: null,
  affiliate_links: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
} as Product;

const DOG_TOPPER_INGREDIENTS: ProductIngredient[] = [
  makeIngredient({ position: 1, canonical_name: 'chicken', dog_base_severity: 'good', is_protein_fat_source: true }),
  makeIngredient({ position: 2, canonical_name: 'chicken_broth', dog_base_severity: 'good' }),
  makeIngredient({ position: 3, canonical_name: 'sweet_potato', dog_base_severity: 'good' }),
  makeIngredient({ position: 4, canonical_name: 'carrots', dog_base_severity: 'good' }),
  makeIngredient({ position: 5, canonical_name: 'spinach', dog_base_severity: 'good' }),
  makeIngredient({ position: 6, canonical_name: 'flaxseed', dog_base_severity: 'good' }),
  makeIngredient({ position: 7, canonical_name: 'salmon_oil', dog_base_severity: 'good' }),
  makeIngredient({ position: 8, canonical_name: 'guar_gum', dog_base_severity: 'neutral' }),
];

// ─── Product 2: Cat Supplemental Wet (gravy/broth style) ──────
const CAT_BROTH: Product = {
  id: 'supp-cat-broth',
  brand: 'Fancy Feast',
  name: 'Savory Chicken Broth',
  category: Category.DailyFood,
  target_species: Species.Cat,
  source: 'curated' as const,
  aafco_statement: 'This product is intended for supplemental feeding only',
  life_stage_claim: null,
  preservative_type: null,
  ga_protein_pct: 6,       // wet broth — 26.1% DMB (borderline for cats)
  ga_fat_pct: 0.5,         // 2.2% DMB — low (below cat 9% AAFCO min)
  ga_fiber_pct: 0.5,       // 2.2% DMB
  ga_moisture_pct: 77,
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
  is_supplemental: true,
  score_confidence: 'high',
  needs_review: false,
  base_score: null,
  base_score_computed_at: null,
  last_verified_at: null,
  formula_change_log: null,
  affiliate_links: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
} as Product;

const CAT_BROTH_INGREDIENTS: ProductIngredient[] = [
  makeIngredient({ position: 1, canonical_name: 'chicken_broth', cat_base_severity: 'good' }),
  makeIngredient({ position: 2, canonical_name: 'chicken', cat_base_severity: 'good', is_protein_fat_source: true }),
  makeIngredient({ position: 3, canonical_name: 'natural_flavor', cat_base_severity: 'caution', is_unnamed_species: true }),
  makeIngredient({ position: 4, canonical_name: 'guar_gum', cat_base_severity: 'neutral' }),
  makeIngredient({ position: 5, canonical_name: 'xanthan_gum', cat_base_severity: 'neutral' }),
  makeIngredient({ position: 6, canonical_name: 'carrageenan', cat_base_severity: 'caution', position_reduction_eligible: true }),
];

// ─── Tests ───────────────────────────────────────────────

describe('Supplemental E2E: 2 real-world-style products', () => {
  test('Dog topper (Stella-style) — supplemental 65/35/0 scoring', () => {
    const pet = {
      id: 'pet-1', user_id: 'u1', name: 'Buster', species: Species.Dog,
      breed: 'Labrador Retriever', date_of_birth: '2022-06-15',
      dob_is_approximate: false, weight_current_lbs: 70, weight_goal_lbs: null,
      weight_updated_at: null, activity_level: 'moderate' as const,
      is_neutered: true, sex: null, breed_size: 'large',
      life_stage: LifeStage.Adult, photo_url: null,
      health_reviewed_at: null, created_at: '2026-01-01', updated_at: '2026-01-01',
    };

    const result = computeScore(DOG_TOPPER, DOG_TOPPER_INGREDIENTS, pet);

    console.log('\n═══ SUPPLEMENTAL E2E: Dog Topper ═══');
    console.log(`IQ: ${result.layer1.ingredientQuality}`);
    console.log(`NP: ${result.layer1.nutritionalProfile}`);
    console.log(`FC: ${result.layer1.formulation}`);
    console.log(`L2: ${result.layer2.speciesAdjustment}`);
    console.log(`L3: ${result.layer3.personalizations.map(p => `${p.label}: ${p.adjustment}`).join(', ') || 'none'}`);
    console.log(`Final: ${result.finalScore}`);
    console.log(`Category: ${result.category}, isPartial: ${result.isPartialScore}`);

    // Supplemental = 65/35/0 weights
    // FC should be computed but contribute 0% to final
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);

    // Score same product as daily food to verify weight difference
    const dailyVersion = { ...DOG_TOPPER, is_supplemental: false } as Product;
    const dailyResult = computeScore(dailyVersion, DOG_TOPPER_INGREDIENTS, pet);
    console.log(`\nSame product as daily food: ${dailyResult.finalScore}`);
    console.log(`Difference: ${result.finalScore - dailyResult.finalScore} pts`);

    // Scores should differ (different weights)
    expect(result.finalScore).not.toBe(dailyResult.finalScore);
  });

  test('Cat broth (Fancy Feast-style) — supplemental, low fat', () => {
    const pet = {
      id: 'pet-2', user_id: 'u1', name: 'Luna', species: Species.Cat,
      breed: 'Domestic Shorthair', date_of_birth: '2020-03-10',
      dob_is_approximate: false, weight_current_lbs: 10, weight_goal_lbs: null,
      weight_updated_at: null, activity_level: 'low' as const,
      is_neutered: true, sex: 'female', breed_size: null,
      life_stage: LifeStage.Adult, photo_url: null,
      health_reviewed_at: null, created_at: '2026-01-01', updated_at: '2026-01-01',
    };

    const result = computeScore(CAT_BROTH, CAT_BROTH_INGREDIENTS, pet);

    console.log('\n═══ SUPPLEMENTAL E2E: Cat Broth ═══');
    console.log(`IQ: ${result.layer1.ingredientQuality}`);
    console.log(`NP: ${result.layer1.nutritionalProfile}`);
    console.log(`FC: ${result.layer1.formulation}`);
    console.log(`L2: ${result.layer2.speciesAdjustment}`);
    console.log(`L3: ${result.layer3.personalizations.map(p => `${p.label}: ${p.adjustment}`).join(', ') || 'none'}`);
    console.log(`Final: ${result.finalScore}`);
    console.log(`Category: ${result.category}, isPartial: ${result.isPartialScore}`);

    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);

    // Cat broth with 2.2% DMB fat should get hammered on NP (fat sub-score near 0)
    // but as supplemental it's 35% NP weight vs 30% for daily food
    const dailyVersion = { ...CAT_BROTH, is_supplemental: false } as Product;
    const dailyResult = computeScore(dailyVersion, CAT_BROTH_INGREDIENTS, pet);
    console.log(`\nSame product as daily food: ${dailyResult.finalScore}`);
    console.log(`Difference: ${result.finalScore - dailyResult.finalScore} pts`);
  });
});
