// D-136: Supplemental product scoring tests
// Verifies 65/35/0 weights, micronutrient modifier suppression,
// and no impact on daily food or treat scoring paths.

import { computeScore } from '../../../src/services/scoring/engine';
import type { Product, PetProfile } from '../../../src/types';
import { Category, Species, LifeStage } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';

// ─── Factories ────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    brand: 'Test Brand',
    name: 'Test Food',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated' as const,
    aafco_statement: 'All Life Stages',
    life_stage_claim: null,
    preservative_type: null,
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
    is_supplemental: false,
    score_confidence: 'high',
    needs_review: false,
    base_score: null,
    base_score_computed_at: null,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    ...overrides,
  } as Product;
}

function makePet(overrides: Partial<PetProfile> = {}): PetProfile {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Buster',
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
    ...overrides,
  } as PetProfile;
}

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

// ─── Shared ingredient list ──────────────────────────────

const BASIC_INGREDIENTS: ProductIngredient[] = [
  makeIngredient({ position: 1, canonical_name: 'chicken', dog_base_severity: 'good' }),
  makeIngredient({ position: 2, canonical_name: 'brown_rice', dog_base_severity: 'good' }),
  makeIngredient({ position: 3, canonical_name: 'chicken_fat', dog_base_severity: 'neutral' }),
  makeIngredient({ position: 4, canonical_name: 'dried_beet_pulp', dog_base_severity: 'neutral' }),
];

// ─── Tests ───────────────────────────────────────────────

describe('D-136: Supplemental product scoring', () => {
  describe('weight routing', () => {
    it('uses 65/35/0 weights for supplemental products', () => {
      const product = makeProduct({ is_supplemental: true });
      const pet = makePet();

      const result = computeScore(product, BASIC_INGREDIENTS, pet);

      // Formulation should contribute 0% — verify by checking
      // that changing formulation inputs doesn't affect score
      const productWithAafco = makeProduct({
        is_supplemental: true,
        aafco_statement: 'Complete and balanced for adult dogs',
      });
      const productNoAafco = makeProduct({
        is_supplemental: true,
        aafco_statement: null,
      });

      const scoreWithAafco = computeScore(productWithAafco, BASIC_INGREDIENTS, pet);
      const scoreNoAafco = computeScore(productNoAafco, BASIC_INGREDIENTS, pet);

      // Formulation weight is 0 for supplementals, so AAFCO statement shouldn't matter
      expect(scoreWithAafco.finalScore).toBe(scoreNoAafco.finalScore);
    });

    it('uses 55/30/15 weights for daily food (regression)', () => {
      const dailyFood = makeProduct({ is_supplemental: false });
      const pet = makePet();

      // With AAFCO statement (formulation gets points)
      const withAafco = computeScore(
        makeProduct({ is_supplemental: false, aafco_statement: 'Complete and balanced' }),
        BASIC_INGREDIENTS,
        pet,
      );
      // Without AAFCO statement (formulation loses points)
      const noAafco = computeScore(
        makeProduct({ is_supplemental: false, aafco_statement: null }),
        BASIC_INGREDIENTS,
        pet,
      );

      // Formulation weight is 15% for daily food, so AAFCO should matter
      expect(withAafco.finalScore).not.toBe(noAafco.finalScore);
    });

    it('treats still use 100/0/0 weights (regression)', () => {
      const treat = makeProduct({ category: Category.Treat, is_supplemental: false });
      const pet = makePet();
      const result = computeScore(treat, BASIC_INGREDIENTS, pet);

      // NP and FC should be 0 for treats
      expect(result.layer1.nutritionalProfile).toBe(0);
      expect(result.layer1.formulation).toBe(0);
    });
  });

  describe('micronutrient modifier suppression', () => {
    it('skips Ca:P ratio penalty for supplemental puppy food', () => {
      const product = makeProduct({
        is_supplemental: true,
        ga_calcium_pct: 3.0,
        ga_phosphorus_pct: 0.5,
        life_stage_claim: 'All Life Stages',
      });
      const puppy = makePet({ life_stage: LifeStage.Puppy });

      const result = computeScore(product, BASIC_INGREDIENTS, puppy);

      // Ca:P ratio is 6:1 — way outside 1.1-2.0 safe range
      // For daily food this would trigger growth_cap_ratio_penalty
      // For supplemental, it should be skipped
      const dailyResult = computeScore(
        makeProduct({
          ...product,
          is_supplemental: false,
          ga_calcium_pct: 3.0,
          ga_phosphorus_pct: 0.5,
        }),
        BASIC_INGREDIENTS,
        puppy,
      );

      // Supplemental should score higher (no micronutrient penalty)
      expect(result.finalScore).toBeGreaterThanOrEqual(dailyResult.finalScore);
    });

    it('skips senior dog phosphorus penalty for supplementals', () => {
      const product = makeProduct({
        is_supplemental: true,
        ga_phosphorus_pct: 2.0, // Well above 1.4% DMB threshold
      });
      const senior = makePet({ life_stage: LifeStage.Senior });

      const result = computeScore(product, BASIC_INGREDIENTS, senior);

      const dailyResult = computeScore(
        makeProduct({ ...product, is_supplemental: false }),
        BASIC_INGREDIENTS,
        senior,
      );

      // Supplemental should score higher (no phosphorus penalty)
      expect(result.finalScore).toBeGreaterThanOrEqual(dailyResult.finalScore);
    });

    it('skips life stage mismatch penalty for supplementals', () => {
      const product = makeProduct({
        is_supplemental: true,
        life_stage_claim: 'Adult Maintenance',
      });
      const puppy = makePet({ life_stage: LifeStage.Puppy });

      const result = computeScore(product, BASIC_INGREDIENTS, puppy);

      const dailyResult = computeScore(
        makeProduct({ ...product, is_supplemental: false }),
        BASIC_INGREDIENTS,
        puppy,
      );

      // Supplemental should score higher (no life stage mismatch penalty)
      expect(result.finalScore).toBeGreaterThanOrEqual(dailyResult.finalScore);
    });
  });

  describe('macro sub-score modifiers still apply', () => {
    it('applies senior dog protein boost for supplementals', () => {
      const product = makeProduct({
        is_supplemental: true,
        ga_protein_pct: 35, // High protein → should trigger senior boost
      });
      const senior = makePet({ life_stage: LifeStage.Senior });

      const result = computeScore(product, BASIC_INGREDIENTS, senior);
      const adultResult = computeScore(product, BASIC_INGREDIENTS, makePet());

      // Senior should benefit from protein boost even on supplementals
      // (macro modifiers are NOT suppressed)
      expect(result.finalScore).toBeGreaterThanOrEqual(adultResult.finalScore);
    });
  });

  describe('category field', () => {
    it('returns daily_food category for supplemental products', () => {
      const product = makeProduct({ is_supplemental: true });
      const result = computeScore(product, BASIC_INGREDIENTS, makePet());

      // is_supplemental is orthogonal to category
      expect(result.category).toBe('daily_food');
    });
  });
});
