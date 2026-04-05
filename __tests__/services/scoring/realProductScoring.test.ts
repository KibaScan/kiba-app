// Score 2 real products from Supabase DB through the full pipeline.
// P1: 360 Pet Nutrition Beef Grain-Free (dog, freeze-dried, high protein)
// P2: 9 Lives Meaty Favorites Variety Pack (cat, wet, 78% moisture)

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product } from '../../../src/types';
import { Category, Species, LifeStage } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';

function ing(
  position: number,
  canonical_name: string,
  overrides: Partial<ProductIngredient> = {},
): ProductIngredient {
  return {
    position,
    canonical_name,
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
  } as ProductIngredient;
}

// ─── Product 1: 360 Pet Nutrition Beef Grain-Free ─────────────
const P1: Product = {
  id: '63aa6dc3-2048-46ed-950b-c62cd5cc14ea',
  brand: '360 Pet Nutrition',
  name: '360 Pet Nutrition Beef Grain-Free Adult Freeze-Dried Dog Food, 48-oz bag',
  category: Category.DailyFood,
  target_species: Species.Dog,
  source: 'scraped' as const,
  aafco_statement: null,
  life_stage_claim: 'adult',
  preservative_type: 'natural',
  ga_protein_pct: 37.0,
  ga_fat_pct: 33.0,
  ga_fiber_pct: 2.5,
  ga_moisture_pct: 5.0,
  ga_kcal_per_cup: 230, ga_kcal_per_kg: 883, kcal_per_unit: null, unit_weight_g: null,
  default_serving_format: null,
  ga_taurine_pct: null, ga_l_carnitine_mg: null, ga_dha_pct: null,
  ga_omega3_pct: 0.5, ga_omega6_pct: null, ga_zinc_mg_kg: null, ga_probiotics_cfu: null,
  nutritional_data_source: 'manual',
  ingredients_raw: 'Beef, Beef Heart, Beef Liver, Beef Kidney, Flaxseed, Egg, Sweet Potato, Apples, Carrots, Spinach, Pumpkin Seed, Cranberry, Blueberry, Sunflower Seed, Broccoli, Kale, Dried Kelp, Ginger, Salt, Mixed Tocopherols (Preservative).',
  ingredients_hash: '6f00b8ab5d52252da0e154d5479cdc831cb4bae024b171ff931b9a5170e0103d',
  image_url: null,
  is_recalled: false,
  is_grain_free: true,
  is_supplemental: false,
  score_confidence: 'high',
  needs_review: false,
  base_score: null, base_score_computed_at: null,
  last_verified_at: null, formula_change_log: null, affiliate_links: null,
  price: null, price_currency: null, product_size_kg: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
} as Product;

const P1_INGREDIENTS: ProductIngredient[] = [
  ing(1, 'beef', { dog_base_severity: 'good', cluster_id: 'protein_beef', is_protein_fat_source: true }),
  ing(2, 'beef_heart', { cluster_id: 'protein_beef' }),
  ing(3, 'beef_liver', { cluster_id: 'protein_beef' }),
  ing(4, 'beef_kidney', { cluster_id: 'protein_beef' }),
  ing(5, 'flaxseed', { dog_base_severity: 'good', cluster_id: 'seed_flax' }),
  ing(6, 'egg', { dog_base_severity: 'good', cluster_id: 'protein_egg' }),
  ing(7, 'sweet_potatoes', { cluster_id: 'tuber_sweet_potato' }),
  ing(8, 'apples', { dog_base_severity: 'good' }),
  ing(9, 'carrots', { dog_base_severity: 'good' }),
  ing(10, 'spinach', {}),
  ing(11, 'pumpkin_seed', { dog_base_severity: 'good' }),
  ing(12, 'cranberry', {}),
  ing(13, 'blueberry', {}),
  ing(14, 'sunflower_seed', {}),
  ing(15, 'broccoli', {}),
  ing(16, 'kale', {}),
  ing(17, 'kelp', {}),
  ing(18, 'ginger', { dog_base_severity: 'good' }),
  ing(19, 'salt', { dog_base_severity: 'caution', position_reduction_eligible: true }),
  ing(20, 'mixed_tocopherols', { dog_base_severity: 'good' }),
];

// ─── Product 2: 9 Lives Meaty Favorites Variety Pack ──────────
// Using recipe 1 ingredients (positions 1-35 from first recipe)
const P2: Product = {
  id: '23a5f810-62a8-4ca8-be35-71bc94eb69b3',
  brand: '9 Lives',
  name: '9 Lives Meaty Favorites Variety Pack Canned Cat Food, 5.5-oz, case of 36',
  category: Category.DailyFood,
  target_species: Species.Cat,
  source: 'scraped' as const,
  aafco_statement: 'likely',
  life_stage_claim: 'adult',
  preservative_type: 'synthetic',
  ga_protein_pct: 9.0,
  ga_fat_pct: 4.5,
  ga_fiber_pct: 1.0,
  ga_moisture_pct: 78.0,
  ga_kcal_per_cup: null, ga_kcal_per_kg: 720, kcal_per_unit: null, unit_weight_g: null,
  default_serving_format: null,
  ga_taurine_pct: 0.05, ga_l_carnitine_mg: null, ga_dha_pct: null,
  ga_omega3_pct: null, ga_omega6_pct: null, ga_zinc_mg_kg: null, ga_probiotics_cfu: null,
  nutritional_data_source: 'manual',
  ingredients_raw: 'Water Sufficient for Processing, Meat By-Products, Chicken, Fish, Wheat Flour, Soy Protein Concentrate...',
  ingredients_hash: '8a9a8810c7a5f05eecd403b229fc7e671540d68d3ba57b5008cf3460f6fbcbd5',
  image_url: null,
  is_recalled: false,
  is_grain_free: false,
  is_supplemental: false,
  score_confidence: 'high',
  needs_review: false,
  base_score: null, base_score_computed_at: null,
  last_verified_at: null, formula_change_log: null, affiliate_links: null,
  price: null, price_currency: null, product_size_kg: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
} as Product;

// First recipe only (Hearty Cuts Chicken & Fish) — positions 1-35
const P2_INGREDIENTS: ProductIngredient[] = [
  ing(1, 'water', { cat_base_severity: 'neutral' }),
  ing(2, 'meat_by_products', { cat_base_severity: 'neutral' }),
  ing(3, 'chicken', { cat_base_severity: 'good', is_protein_fat_source: true }),
  ing(4, 'fish', { cat_base_severity: 'neutral' }),
  ing(5, 'wheat_flour', { cat_base_severity: 'caution', position_reduction_eligible: true }),
  ing(6, 'soy_protein', { cat_base_severity: 'caution', position_reduction_eligible: true }),
  ing(7, 'modified_corn_starch', { cat_base_severity: 'caution', position_reduction_eligible: true }),
  ing(8, 'steamed_bone_meal', { cat_base_severity: 'neutral' }),
  ing(9, 'natural_flavor', { cat_base_severity: 'caution', is_unnamed_species: true }),
  ing(10, 'sodium_tripolyphosphate', { cat_base_severity: 'caution', position_reduction_eligible: true }),
  ing(11, 'soy_flour', { cat_base_severity: 'caution', position_reduction_eligible: true }),
  ing(12, 'titanium_dioxide', { cat_base_severity: 'danger', position_reduction_eligible: false }),
  ing(13, 'glycine', { cat_base_severity: 'neutral' }),
  ing(14, 'potassium_chloride', { cat_base_severity: 'neutral' }),
  ing(15, 'salt', { cat_base_severity: 'caution', position_reduction_eligible: true }),
  ing(16, 'choline_chloride', { cat_base_severity: 'good' }),
  ing(17, 'taurine', { cat_base_severity: 'good' }),
];

// ─── Pets ─────────────────────────────────────────────────────

const DOG_PET = {
  id: 'pet-1', user_id: 'u1', name: 'Buster', species: Species.Dog,
  breed: 'Labrador Retriever', date_of_birth: '2021-04-10',
  dob_is_approximate: false, weight_current_lbs: 72, weight_goal_lbs: null,
  weight_updated_at: null, activity_level: 'moderate' as const,
  is_neutered: true, sex: 'male' as const, breed_size: 'large' as const,
  life_stage: LifeStage.Adult, photo_url: null,
  health_reviewed_at: null,
  weight_goal_level: null, caloric_accumulator: null,
  accumulator_last_reset_at: null, accumulator_notification_sent: null,
  bcs_score: null, bcs_assessed_at: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

const CAT_PET = {
  id: 'pet-2', user_id: 'u1', name: 'Mochi', species: Species.Cat,
  breed: 'Domestic Shorthair', date_of_birth: '2019-08-15',
  dob_is_approximate: true, weight_current_lbs: 11, weight_goal_lbs: null,
  weight_updated_at: null, activity_level: 'low' as const,
  is_neutered: true, sex: 'female' as const, breed_size: null,
  life_stage: LifeStage.Mature, photo_url: null,
  health_reviewed_at: null,
  weight_goal_level: null, caloric_accumulator: null,
  accumulator_last_reset_at: null, accumulator_notification_sent: null,
  bcs_score: null, bcs_assessed_at: null,
  created_at: '2026-01-01', updated_at: '2026-01-01',
};

// ─── Tests ────────────────────────────────────────────────────

describe('Real DB Product Scoring', () => {
  test('360 Pet Nutrition Beef Grain-Free — Buster (Lab, adult)', () => {
    const result = computeScore(P1, P1_INGREDIENTS, DOG_PET);

    console.log('\n═══ 360 Pet Nutrition Beef Grain-Free (Dog) ═══');
    console.log(`IQ: ${result.layer1.ingredientQuality}`);
    console.log(`NP: ${result.layer1.nutritionalProfile}`);
    console.log(`FC: ${result.layer1.formulation}`);
    console.log(`Base (55/30/15): IQ×.55=${(result.layer1.ingredientQuality * 0.55).toFixed(1)} + NP×.30=${(result.layer1.nutritionalProfile * 0.30).toFixed(1)} + FC×.15=${(result.layer1.formulation * 0.15).toFixed(1)}`);
    console.log(`L2 species: ${result.layer2.speciesAdjustment} (rules: ${result.layer2.appliedRules.filter(r => r.fired).map(r => r.ruleId).join(', ') || 'none'})`);
    console.log(`L3 personal: ${result.layer3.personalizations.map(p => `${p.label}: ${p.adjustment}`).join(', ') || 'none'}`);
    console.log(`Allergen delta: ${result.allergenDelta}`);
    console.log(`Flags: ${result.flags.join(', ') || 'none'}`);
    console.log(`\n  >>> FINAL SCORE: ${result.finalScore}% match for Buster <<<`);

    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });

  test('9 Lives Meaty Favorites Variety Pack — Mochi (DSH, mature cat)', () => {
    const result = computeScore(P2, P2_INGREDIENTS, CAT_PET);

    console.log('\n═══ 9 Lives Meaty Favorites Variety Pack (Cat) ═══');
    console.log(`IQ: ${result.layer1.ingredientQuality}`);
    console.log(`NP: ${result.layer1.nutritionalProfile}`);
    console.log(`FC: ${result.layer1.formulation}`);
    console.log(`Base (55/30/15): IQ×.55=${(result.layer1.ingredientQuality * 0.55).toFixed(1)} + NP×.30=${(result.layer1.nutritionalProfile * 0.30).toFixed(1)} + FC×.15=${(result.layer1.formulation * 0.15).toFixed(1)}`);
    console.log(`L2 species: ${result.layer2.speciesAdjustment} (rules: ${result.layer2.appliedRules.filter(r => r.fired).map(r => r.ruleId).join(', ') || 'none'})`);
    console.log(`L3 personal: ${result.layer3.personalizations.map(p => `${p.label}: ${p.adjustment}`).join(', ') || 'none'}`);
    console.log(`Allergen delta: ${result.allergenDelta}`);
    console.log(`Flags: ${result.flags.join(', ') || 'none'}`);
    console.log(`\n  >>> FINAL SCORE: ${result.finalScore}% match for Mochi <<<`);

    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.finalScore).toBeLessThanOrEqual(100);
  });
});
