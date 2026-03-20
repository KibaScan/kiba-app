// Verification script — validates the scoring engine copy produces correct results.
// Run: npx ts-node scripts/verify-engine-copy.ts
// Expected: Pure Balance Wild & Free Salmon & Pea (Dog) → finalScore = 62

import { computeScore } from '../supabase/functions/batch-score/scoring/engine';
import type { Product, PetProfile } from '../supabase/functions/batch-score/types';
import { Category, Species, LifeStage, PreservativeType } from '../supabase/functions/batch-score/types';
import type { ProductIngredient } from '../supabase/functions/batch-score/types/scoring';

// ─── Fixtures (from __tests__/services/scoring/engine.test.ts:349-431) ───

const product: Product = {
  id: 'test-product',
  brand: 'Pure Balance',
  name: 'Wild & Free Salmon & Pea Recipe',
  category: Category.DailyFood,
  target_species: Species.Dog,
  source: 'curated',
  aafco_statement: 'yes',
  life_stage_claim: null,
  preservative_type: PreservativeType.Natural,
  ga_protein_pct: 24,
  ga_fat_pct: 15,
  ga_fiber_pct: 5,
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
  product_form: null,
  is_recalled: false,
  is_grain_free: true,
  is_supplemental: false,
  is_vet_diet: false,
  base_score: null,
  base_score_computed_at: null,
  score_confidence: 'high',
  needs_review: false,
  last_verified_at: null,
  formula_change_log: null,
  affiliate_links: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const pet: PetProfile = {
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
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

function makeIngredient(overrides: Partial<ProductIngredient> & { position: number; canonical_name: string }): ProductIngredient {
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

// ─── Run ──────────────────────────────────────────────────

const result = computeScore(product, ingredients, pet);

if (result.finalScore === 62) {
  console.log(`PASS — Pure Balance scored ${result.finalScore}`);
  console.log(`  IQ=${result.layer1.ingredientQuality}, NP=${result.layer1.nutritionalProfile}, FC=${result.layer1.formulation}`);
  console.log(`  Weighted=${result.layer1.weightedComposite}, L2=${result.layer2.speciesAdjustment}`);
  process.exit(0);
} else {
  console.error(`FAIL — Pure Balance scored ${result.finalScore}, expected 62`);
  console.error(`  IQ=${result.layer1.ingredientQuality}, NP=${result.layer1.nutritionalProfile}, FC=${result.layer1.formulation}`);
  console.error(`  Weighted=${result.layer1.weightedComposite}, L2=${result.layer2.speciesAdjustment}`);
  process.exit(1);
}
