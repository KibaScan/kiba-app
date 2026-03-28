// D-129: Allergen Severity Override Tests
// Verifies: runtime-only override, position weighting, cross-reactivity,
// backward compatibility, determinism, and Pure Balance regression.

import { computeScore } from '../../../src/services/scoring/engine';
import { scoreIngredients } from '../../../src/services/scoring/ingredientQuality';
import { buildAllergenOverrideMap } from '../../../src/services/scoring/personalization';
import type { Product, PetProfile } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category, Species, LifeStage, PreservativeType } from '../../../src/types';

// ─── Helpers ───────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    brand: 'Test Brand',
    name: 'Test Food',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated',
    aafco_statement: 'All Life Stages',
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

// ─── buildAllergenOverrideMap unit tests ───────────────────

describe('buildAllergenOverrideMap', () => {
  test('direct match: allergen_group = pet allergen', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', allergen_group: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice', allergen_group: 'rice' }),
    ];
    const map = buildAllergenOverrideMap(['chicken'], ingredients);
    expect(map.get('chicken')).toBe('danger');
    expect(map.has('rice')).toBe(false);
  });

  test('possible match: allergen_group_possible contains pet allergen', () => {
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'poultry_byproduct_meal',
        allergen_group: null,
        allergen_group_possible: ['chicken', 'turkey'],
      }),
    ];
    const map = buildAllergenOverrideMap(['chicken'], ingredients);
    expect(map.get('poultry_byproduct_meal')).toBe('caution');
  });

  test('no match: returns empty map', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon', allergen_group: 'fish' }),
    ];
    const map = buildAllergenOverrideMap(['chicken'], ingredients);
    expect(map.size).toBe(0);
  });

  test('empty allergens: returns empty map', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', allergen_group: 'chicken' }),
    ];
    const map = buildAllergenOverrideMap([], ingredients);
    expect(map.size).toBe(0);
  });

  test('direct match takes priority over possible match (no duplicate)', () => {
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        allergen_group: 'chicken',
        allergen_group_possible: ['chicken'],
      }),
    ];
    const map = buildAllergenOverrideMap(['chicken'], ingredients);
    expect(map.get('chicken')).toBe('danger');
    expect(map.size).toBe(1);
  });
});

// ─── scoreIngredients with allergen overrides ─────────────

describe('scoreIngredients — D-129 allergen overrides', () => {
  test('neutral ingredient overridden to danger gets penalty', () => {
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        dog_base_severity: 'neutral',
        allergen_group: 'chicken',
      }),
    ];
    const overrides = new Map([['chicken', 'danger' as const]]);

    const withoutOverride = scoreIngredients(ingredients, 'dog');
    const withOverride = scoreIngredients(ingredients, 'dog', overrides);

    expect(withoutOverride.ingredientScore).toBe(100); // neutral = no penalty
    expect(withOverride.ingredientScore).toBe(85); // danger at pos 1 = -15
  });

  test('good ingredient overridden to danger gets penalty', () => {
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        dog_base_severity: 'good',
        allergen_group: 'chicken',
      }),
    ];
    const overrides = new Map([['chicken', 'danger' as const]]);

    const withOverride = scoreIngredients(ingredients, 'dog', overrides);
    expect(withOverride.ingredientScore).toBe(85); // danger at pos 1 = -15
  });

  test('danger ingredient stays danger (max rule — no change)', () => {
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'bha',
        dog_base_severity: 'danger',
        position_reduction_eligible: false,
        allergen_group: 'chicken', // hypothetical
      }),
    ];
    const overrides = new Map([['bha', 'danger' as const]]);

    const withoutOverride = scoreIngredients(ingredients, 'dog');
    const withOverride = scoreIngredients(ingredients, 'dog', overrides);

    // Both danger — no change
    expect(withoutOverride.ingredientScore).toBe(85);
    expect(withOverride.ingredientScore).toBe(85); // unchanged — same severity
  });

  test('caution ingredient escalated to danger by direct match', () => {
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'corn',
        dog_base_severity: 'caution',
        allergen_group: 'corn',
      }),
    ];
    const overrides = new Map([['corn', 'danger' as const]]);

    const withoutOverride = scoreIngredients(ingredients, 'dog');
    const withOverride = scoreIngredients(ingredients, 'dog', overrides);

    expect(withoutOverride.ingredientScore).toBe(92); // caution = -8
    expect(withOverride.ingredientScore).toBe(85); // danger = -15
  });

  test('undefined overrides = identical to no overrides', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', dog_base_severity: 'neutral' }),
      makeIngredient({ position: 2, canonical_name: 'rice', dog_base_severity: 'neutral' }),
    ];

    const result1 = scoreIngredients(ingredients, 'dog');
    const result2 = scoreIngredients(ingredients, 'dog', undefined);

    expect(result1.ingredientScore).toBe(result2.ingredientScore);
    expect(result1.penalties).toEqual(result2.penalties);
  });
});

// ─── computeScore integration — allergen delta ────────────

describe('computeScore — D-129 allergen delta', () => {
  test('chicken at position 1, pet allergic to chicken — score drops', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        dog_base_severity: 'neutral',
        allergen_group: 'chicken',
        is_protein_fat_source: true,
      }),
      makeIngredient({ position: 2, canonical_name: 'rice', is_protein_fat_source: false }),
    ];
    const pet = makePet();

    const noAllergen = computeScore(product, ingredients, pet, undefined);
    const withAllergen = computeScore(product, ingredients, pet, ['chicken']);

    expect(withAllergen.finalScore).toBeLessThan(noAllergen.finalScore);
    expect(withAllergen.allergenDelta).toBeGreaterThan(0);
  });

  test('chicken broth at position 12, pet allergic — smaller delta than position 1', () => {
    const product = makeProduct();
    const fillers = Array.from({ length: 11 }, (_, i) =>
      makeIngredient({ position: i + 1, canonical_name: `filler_${i}` }),
    );
    const chickenBroth = makeIngredient({
      position: 12,
      canonical_name: 'chicken_broth',
      dog_base_severity: 'neutral',
      allergen_group: 'chicken',
    });
    const ingredients = [...fillers, chickenBroth];
    const pet = makePet();

    // Score with chicken at position 1
    const pos1Ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        dog_base_severity: 'neutral',
        allergen_group: 'chicken',
        is_protein_fat_source: true,
      }),
    ];
    const pos1Result = computeScore(product, pos1Ingredients, pet, ['chicken']);
    const pos12Result = computeScore(product, ingredients, pet, ['chicken']);

    // Position 12 delta should be smaller than position 1 delta
    expect(pos12Result.allergenDelta).toBeLessThan(pos1Result.allergenDelta);
    expect(pos12Result.allergenDelta).toBeGreaterThan(0);
  });

  test('D-098 cross-reactivity: poultry byproduct meal + chicken-allergic pet', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'poultry_byproduct_meal',
        dog_base_severity: 'caution',
        allergen_group: null,
        allergen_group_possible: ['chicken', 'turkey'],
        is_protein_fat_source: true,
        is_unnamed_species: true,
      }),
    ];
    const pet = makePet();

    const noAllergen = computeScore(product, ingredients, pet, undefined);
    const withAllergen = computeScore(product, ingredients, pet, ['chicken']);

    // Poultry byproduct meal is already 'caution' base severity.
    // Override to 'caution' = no change. IQ delta should be 0.
    expect(withAllergen.allergenDelta).toBe(0);
    // D-167: even though IQ didn't change, possible_match allergen flag
    // triggers score cap at 50 ("Explore alternatives" UI threshold).
    expect(withAllergen.finalScore).toBe(50);
    expect(withAllergen.finalScore).toBeLessThan(noAllergen.finalScore);
  });

  test('no allergen-matching ingredients — zero delta, identical score', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'salmon',
        dog_base_severity: 'neutral',
        allergen_group: 'fish',
        is_protein_fat_source: true,
      }),
    ];
    const pet = makePet();

    const noAllergen = computeScore(product, ingredients, pet, undefined);
    const withAllergen = computeScore(product, ingredients, pet, ['chicken']);

    expect(withAllergen.allergenDelta).toBe(0);
    expect(withAllergen.finalScore).toBe(noAllergen.finalScore);
  });

  test('deterministic: same inputs, same score twice', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        dog_base_severity: 'neutral',
        allergen_group: 'chicken',
        is_protein_fat_source: true,
      }),
    ];
    const pet = makePet();

    const result1 = computeScore(product, ingredients, pet, ['chicken']);
    const result2 = computeScore(product, ingredients, pet, ['chicken']);

    expect(result1.finalScore).toBe(result2.finalScore);
    expect(result1.allergenDelta).toBe(result2.allergenDelta);
  });

  test('ingredients_dict base severity unchanged after override scoring', () => {
    const ingredient = makeIngredient({
      position: 1,
      canonical_name: 'chicken',
      dog_base_severity: 'neutral',
      cat_base_severity: 'neutral',
      allergen_group: 'chicken',
      is_protein_fat_source: true,
    });
    const ingredients = [ingredient];
    const product = makeProduct();
    const pet = makePet();

    computeScore(product, ingredients, pet, ['chicken']);

    // Base severity must be unchanged — D-129 runtime-only override
    expect(ingredient.dog_base_severity).toBe('neutral');
    expect(ingredient.cat_base_severity).toBe('neutral');
  });

  test('no pet allergens — allergenDelta is 0', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({
        position: 1,
        canonical_name: 'chicken',
        dog_base_severity: 'neutral',
        allergen_group: 'chicken',
        is_protein_fat_source: true,
      }),
    ];
    const pet = makePet();

    const result = computeScore(product, ingredients, pet, undefined);
    expect(result.allergenDelta).toBe(0);

    const result2 = computeScore(product, ingredients, pet, []);
    expect(result2.allergenDelta).toBe(0);
  });
});

// ─── Pure Balance regression ──────────────────────────────
// The full Pure Balance = 69 regression lives in engine.test.ts (337-418).
// Here we only verify D-129 adds zero delta when the exact same fixture
// is scored without allergens — the engine.test.ts assertion still passing
// (checked by the full test suite) is the primary guard.

describe('Pure Balance regression — D-129 zero delta', () => {
  test('exact Pure Balance fixture with no allergens → allergenDelta = 0', () => {
    const product = makeProduct({
      category: Category.DailyFood,
      target_species: Species.Dog,
      is_grain_free: true,
      aafco_statement: 'All Life Stages',
      preservative_type: PreservativeType.Natural,
      ga_protein_pct: 26,
      ga_fat_pct: 16,
      ga_fiber_pct: 4,
      ga_moisture_pct: 10,
    });

    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 1,  canonical_name: 'salmon',           dog_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
      makeIngredient({ position: 2,  canonical_name: 'salmon_meal',      dog_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish' }),
      makeIngredient({ position: 3,  canonical_name: 'peas',             dog_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true }),
      makeIngredient({ position: 4,  canonical_name: 'dried_peas',       dog_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true }),
      makeIngredient({ position: 5,  canonical_name: 'pea_protein',      dog_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',  is_legume: true, is_pulse: true, is_pulse_protein: true }),
      makeIngredient({ position: 6,  canonical_name: 'canola_oil',       dog_base_severity: 'neutral' }),
      makeIngredient({ position: 7,  canonical_name: 'chicken_fat',      dog_base_severity: 'good',    cluster_id: 'protein_chicken', allergen_group: 'chicken' }),
      makeIngredient({ position: 8,  canonical_name: 'beet_pulp',        dog_base_severity: 'good' }),
      makeIngredient({ position: 9,  canonical_name: 'natural_flavor',   dog_base_severity: 'caution', is_unnamed_species: true, position_reduction_eligible: false, allergen_group_possible: ['chicken', 'beef', 'pork', 'lamb', 'fish'] }),
      makeIngredient({ position: 10, canonical_name: 'flaxseed',         dog_base_severity: 'good',    cluster_id: 'seed_flax' }),
      makeIngredient({ position: 11, canonical_name: 'salt',             dog_base_severity: 'caution' }),
      makeIngredient({ position: 12, canonical_name: 'potassium_chloride', dog_base_severity: 'good',  position_reduction_eligible: false }),
      makeIngredient({ position: 13, canonical_name: 'taurine',          dog_base_severity: 'good',    position_reduction_eligible: false }),
      makeIngredient({ position: 14, canonical_name: 'l_carnitine',      dog_base_severity: 'good',    position_reduction_eligible: false }),
      makeIngredient({ position: 15, canonical_name: 'mixed_tocopherols', dog_base_severity: 'good',   position_reduction_eligible: false }),
    ];

    const pet = makePet({ life_stage: LifeStage.Adult });
    const result = computeScore(product, ingredients, pet);

    expect(result.finalScore).toBe(69);
    expect(result.allergenDelta).toBe(0);
  });
});
