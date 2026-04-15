import { scoreIngredients } from '../../../src/services/scoring/ingredientQuality';
import type { ProductIngredient } from '../../../src/types/scoring';

// ─── Helpers ───────────────────────────────────────────────

/** Build a minimal ingredient with sensible defaults */
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

// ─── Tests ─────────────────────────────────────────────────

describe('scoreIngredients — Layer 1a', () => {

  test('empty ingredients array → score: 100, no penalties, no flags', () => {
    const result = scoreIngredients([], 'dog');
    expect(result.ingredientScore).toBe(100);
    expect(result.penalties).toHaveLength(0);
    expect(result.flags).toHaveLength(0);
    expect(result.unnamedSpeciesCount).toBe(0);
  });

  test('all neutral/good ingredients → score: 100', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 1, canonical_name: 'Chicken', dog_base_severity: 'good' }),
      makeIngredient({ position: 2, canonical_name: 'Brown Rice', dog_base_severity: 'neutral' }),
      makeIngredient({ position: 3, canonical_name: 'Oatmeal', dog_base_severity: 'good' }),
      makeIngredient({ position: 4, canonical_name: 'Barley', dog_base_severity: 'neutral' }),
      makeIngredient({ position: 5, canonical_name: 'Salmon Oil', dog_base_severity: 'good' }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.ingredientScore).toBe(100);
    expect(result.penalties).toHaveLength(0);
  });

  test('single danger at position 1 (proportion-based) → score: 80', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 1,
        canonical_name: 'BHA',
        dog_base_severity: 'danger',
        position_reduction_eligible: true,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.ingredientScore).toBe(80);
    expect(result.penalties).toHaveLength(1);
    expect(result.penalties[0].rawPenalty).toBe(20);
    expect(result.penalties[0].positionAdjustedPenalty).toBe(20);
  });

  test('single danger at position 8 (proportion-based) → 30% reduction', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 8,
        canonical_name: 'Corn Gluten Meal',
        dog_base_severity: 'danger',
        position_reduction_eligible: true,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.penalties[0].rawPenalty).toBe(20);
    expect(result.penalties[0].positionAdjustedPenalty).toBe(20 * 0.7);
    expect(result.ingredientScore).toBe(100 - 20 * 0.7);
  });

  test('single danger at position 12 (proportion-based) → 60% reduction', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 12,
        canonical_name: 'Corn Gluten Meal',
        dog_base_severity: 'danger',
        position_reduction_eligible: true,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.penalties[0].rawPenalty).toBe(20);
    expect(result.penalties[0].positionAdjustedPenalty).toBe(20 * 0.4);
    expect(result.ingredientScore).toBe(100 - 20 * 0.4);
  });

  test('presence-based danger at position 15 → full penalty, no reduction (D-018)', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 15,
        canonical_name: 'BHT',
        dog_base_severity: 'danger',
        position_reduction_eligible: false,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.penalties[0].rawPenalty).toBe(20);
    expect(result.penalties[0].positionAdjustedPenalty).toBe(20); // no discount
    expect(result.ingredientScore).toBe(80);
  });

  test('caution at position 1 → score: 90', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 1,
        canonical_name: 'Corn',
        dog_base_severity: 'caution',
        position_reduction_eligible: true,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.ingredientScore).toBe(90);
    expect(result.penalties[0].rawPenalty).toBe(10);
    expect(result.penalties[0].positionAdjustedPenalty).toBe(10);
  });

  test('unnamed species penalty — 2 occurrences (D-012)', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 3, canonical_name: 'Animal Fat', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 9, canonical_name: 'Natural Flavor', is_unnamed_species: true, is_protein_fat_source: true }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.unnamedSpeciesCount).toBe(2);
    // 2 × −2 = −4 (no severity penalty since both are neutral)
    expect(result.ingredientScore).toBe(96);
    // Should have 2 unnamed penalties
    const unnamedPenalties = result.penalties.filter(p => p.reason.includes('Unnamed species'));
    expect(unnamedPenalties).toHaveLength(2);
    expect(unnamedPenalties[0].citationSource).toContain('AAFCO');
  });

  test('three unnamed species — penalties stack with severity (D-012)', () => {
    const ingredients: ProductIngredient[] = [
      // caution + unnamed at pos 2 (eligible): −10 + −2
      makeIngredient({
        position: 2,
        canonical_name: 'Meat Meal',
        dog_base_severity: 'caution',
        is_unnamed_species: true,
        is_protein_fat_source: true,
        position_reduction_eligible: true,
      }),
      // neutral + unnamed at pos 7 (eligible): −0 + −2
      makeIngredient({
        position: 7,
        canonical_name: 'Animal Digest',
        dog_base_severity: 'neutral',
        is_unnamed_species: true,
        is_protein_fat_source: true,
        position_reduction_eligible: true,
      }),
      // danger + unnamed at pos 12 (NOT eligible): −20 + −2
      makeIngredient({
        position: 12,
        canonical_name: 'Animal Fat',
        dog_base_severity: 'danger',
        is_unnamed_species: true,
        is_protein_fat_source: true,
        position_reduction_eligible: false,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.unnamedSpeciesCount).toBe(3);
    // Severity: −10 (pos 2) + −20 (pos 12, presence) = −30
    // Unnamed: 3 × −2 = −6
    // Total: −36, score = 64
    expect(result.ingredientScore).toBe(64);
    // 2 severity penalties + 3 unnamed penalties = 5 total
    expect(result.penalties).toHaveLength(5);
    const unnamedPenalties = result.penalties.filter(p => p.reason.includes('Unnamed species'));
    expect(unnamedPenalties).toHaveLength(3);
    unnamedPenalties.forEach(p => {
      expect(p.rawPenalty).toBe(2);
      expect(p.positionAdjustedPenalty).toBe(2);
      expect(p.citationSource).toContain('AAFCO');
    });
  });

  test('unnamed species stacks with severity penalty on same ingredient', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 4,
        canonical_name: 'Animal Fat',
        dog_base_severity: 'caution',
        is_unnamed_species: true,
        is_protein_fat_source: true,
        position_reduction_eligible: false,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    // caution: −10 (presence-based) + unnamed: −2 = −12 total
    expect(result.ingredientScore).toBe(88);
    expect(result.penalties).toHaveLength(2);
    expect(result.unnamedSpeciesCount).toBe(1);
  });

  test('artificial colorants at high positions get full penalty — no position discount (presence-based)', () => {
    const colorants: ProductIngredient[] = [
      makeIngredient({ position: 18, canonical_name: 'red_40', dog_base_severity: 'danger', cat_base_severity: 'danger', position_reduction_eligible: false }),
      makeIngredient({ position: 22, canonical_name: 'yellow_5', dog_base_severity: 'danger', cat_base_severity: 'danger', position_reduction_eligible: false }),
      makeIngredient({ position: 25, canonical_name: 'blue_2', dog_base_severity: 'danger', cat_base_severity: 'danger', position_reduction_eligible: false }),
    ];
    const result = scoreIngredients(colorants, 'dog');
    // All 3 colorants at positions 18, 22, 25 — well past position 10.
    // Danger severity (−20) with position_reduction_eligible: false → full penalty each.
    expect(result.penalties).toHaveLength(3);
    result.penalties.forEach(p => {
      expect(p.rawPenalty).toBe(20);
      expect(p.positionAdjustedPenalty).toBe(20); // no discount
    });
    expect(result.ingredientScore).toBe(100 - 60); // 3 × 20 = 60
  });

  test('ingredient splitting detected — flag only, no score penalty (D-015)', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 3, canonical_name: 'Peas', cluster_id: 'legume_pea' }),
      makeIngredient({ position: 8, canonical_name: 'Pea Starch', cluster_id: 'legume_pea' }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.flags).toContain('ingredient_splitting_detected');
    expect(result.ingredientScore).toBe(100); // NO score penalty
  });

  test('splitting not flagged when cluster_id entries are unique', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 3, canonical_name: 'Peas', cluster_id: 'legume_pea' }),
      makeIngredient({ position: 8, canonical_name: 'Corn Starch', cluster_id: 'corn' }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.flags).not.toContain('ingredient_splitting_detected');
  });

  test('splitting ignores null cluster_id entries', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 1, canonical_name: 'Chicken', cluster_id: null }),
      makeIngredient({ position: 2, canonical_name: 'Salmon', cluster_id: null }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.flags).not.toContain('ingredient_splitting_detected');
  });

  test('floor at 0 — never negative', () => {
    // 8 danger ingredients at positions 1-5 (all full penalty): 8 × 20 = 160
    const ingredients: ProductIngredient[] = Array.from({ length: 8 }, (_, i) =>
      makeIngredient({
        position: i + 1,
        canonical_name: `Bad Ingredient ${i + 1}`,
        dog_base_severity: 'danger',
        position_reduction_eligible: true,
      }),
    );
    const result = scoreIngredients(ingredients, 'dog');
    expect(result.ingredientScore).toBe(0);
  });

  test('species-specific severity — danger for dog, neutral for cat', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 1,
        canonical_name: 'Propylene Glycol',
        dog_base_severity: 'neutral',
        cat_base_severity: 'danger',
        position_reduction_eligible: false,
      }),
    ];
    const dogResult = scoreIngredients(ingredients, 'dog');
    const catResult = scoreIngredients(ingredients, 'cat');
    expect(dogResult.ingredientScore).toBe(100);
    expect(catResult.ingredientScore).toBe(80);
  });

  test('mixed penalties stack correctly', () => {
    const ingredients: ProductIngredient[] = [
      // danger at pos 1 (eligible): −15
      makeIngredient({
        position: 1,
        canonical_name: 'Meat Meal',
        dog_base_severity: 'danger',
        position_reduction_eligible: true,
        is_unnamed_species: true, // +unnamed −2
        is_protein_fat_source: true,
      }),
      // caution at pos 6 (eligible): −8 × 0.7 = −5.6
      makeIngredient({
        position: 6,
        canonical_name: 'Corn Gluten',
        dog_base_severity: 'caution',
        position_reduction_eligible: true,
      }),
      // neutral at pos 3: no penalty
      makeIngredient({ position: 3, canonical_name: 'Chicken' }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    // −20 (danger) −2 (unnamed) −7 (caution at pos 6: 10×0.7) = −29
    expect(result.ingredientScore).toBe(100 - 20 - 2 - 7);
    expect(result.unnamedSpeciesCount).toBe(1);
    expect(result.penalties).toHaveLength(3); // danger + unnamed + caution
  });

  test('every penalty has a citationSource', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({
        position: 1,
        canonical_name: 'BHA',
        dog_base_severity: 'danger',
        position_reduction_eligible: false,
      }),
      makeIngredient({
        position: 5,
        canonical_name: 'Animal Fat',
        dog_base_severity: 'caution',
        is_unnamed_species: true,
        is_protein_fat_source: true,
        position_reduction_eligible: false,
      }),
    ];
    const result = scoreIngredients(ingredients, 'dog');
    for (const penalty of result.penalties) {
      expect(penalty.citationSource).toBeTruthy();
      expect(penalty.citationSource.length).toBeGreaterThan(0);
    }
  });

  // ─── Reference Product Regression ──────────────────────────
  // Real data pulled from Supabase (product_id: afd04040-425b-5742-9100-9e370c1c3cc9)

  test('Pure Balance Grain-Free Salmon & Pea (Dog) — real DB data → IQ = 54', () => {
    const ingredients: ProductIngredient[] = [
      makeIngredient({ position: 1,  canonical_name: 'salmon',           dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish',    position_reduction_eligible: true }),
      makeIngredient({ position: 2,  canonical_name: 'salmon_meal',      dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_salmon', allergen_group: 'fish',    position_reduction_eligible: true }),
      makeIngredient({ position: 3,  canonical_name: 'peas',             dog_base_severity: 'caution', cat_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',     is_legume: true, position_reduction_eligible: true }),
      makeIngredient({ position: 4,  canonical_name: 'dried_peas',       dog_base_severity: 'caution', cat_base_severity: 'caution', cluster_id: 'legume_pea',     allergen_group: 'pea',     is_legume: true, position_reduction_eligible: true }),
      makeIngredient({ position: 5,  canonical_name: 'pea_protein',      dog_base_severity: 'caution', cat_base_severity: 'danger',  cluster_id: 'legume_pea',     allergen_group: 'pea',     is_legume: true, position_reduction_eligible: true }),
      makeIngredient({ position: 6,  canonical_name: 'canola_oil',       dog_base_severity: 'neutral', cat_base_severity: 'caution', position_reduction_eligible: true }),
      makeIngredient({ position: 7,  canonical_name: 'chicken_fat',      dog_base_severity: 'good',    cat_base_severity: 'good',    cluster_id: 'protein_chicken', allergen_group: 'chicken', position_reduction_eligible: true }),
      makeIngredient({ position: 8,  canonical_name: 'beet_pulp',        dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: true }),
      makeIngredient({ position: 9,  canonical_name: 'natural_flavor',   dog_base_severity: 'caution', cat_base_severity: 'caution', is_unnamed_species: true, is_protein_fat_source: true, position_reduction_eligible: false, allergen_group_possible: ['chicken', 'beef', 'pork', 'lamb', 'fish'] }),
      makeIngredient({ position: 10, canonical_name: 'flaxseed',         dog_base_severity: 'good',    cat_base_severity: 'neutral', cluster_id: 'seed_flax', position_reduction_eligible: true }),
      makeIngredient({ position: 11, canonical_name: 'salt',             dog_base_severity: 'caution', cat_base_severity: 'caution', position_reduction_eligible: true }),
      makeIngredient({ position: 12, canonical_name: 'potassium_chloride', dog_base_severity: 'good',  cat_base_severity: 'good',    position_reduction_eligible: false }),
      makeIngredient({ position: 13, canonical_name: 'taurine',          dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: false }),
      makeIngredient({ position: 14, canonical_name: 'l_carnitine',      dog_base_severity: 'good',    cat_base_severity: 'good',    position_reduction_eligible: false }),
      makeIngredient({ position: 15, canonical_name: 'mixed_tocopherols', dog_base_severity: 'good',   cat_base_severity: 'good',    position_reduction_eligible: false }),
    ];

    const result = scoreIngredients(ingredients, 'dog');

    // Severity deductions (dog):
    //   peas (pos 3, eligible):           −10 × 1.0 = −10
    //   dried_peas (pos 4, eligible):     −10 × 1.0 = −10
    //   pea_protein (pos 5, eligible):    −10 × 1.0 = −10
    //   natural_flavor (pos 9, NOT eligible): −10 × 1.0 = −10
    //   salt (pos 11, eligible):          −10 × 0.4 = −4
    // Unnamed: 1 × −2 = −2  (only natural_flavor)
    // Total: −10 − 10 − 10 − 10 − 4 − 2 = −46
    // Score: 100 − 46 = 54
    expect(result.ingredientScore).toBeCloseTo(54, 1);
    expect(result.unnamedSpeciesCount).toBe(1);
    expect(result.penalties).toHaveLength(6); // 5 severity + 1 unnamed

    // Splitting: legume_pea appears 3× (peas, dried_peas, pea_protein)
    // Also protein_salmon appears 2× (salmon, salmon_meal)
    expect(result.flags).toContain('ingredient_splitting_detected');

    // Every penalty has citation
    result.penalties.forEach(p => expect(p.citationSource).toBeTruthy());
  });
});
