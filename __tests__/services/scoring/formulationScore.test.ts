import { scoreFormulation } from '../../../src/services/scoring/formulationScore';
import type { Product } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category, PreservativeType } from '../../../src/types';

// ─── Helpers ───────────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-product',
    brand: 'Test Brand',
    name: 'Test Food',
    category: Category.DailyFood,
    target_species: 'dog' as any,
    source: 'curated',
    aafco_statement: 'All Life Stages',
    life_stage_claim: null,
    preservative_type: PreservativeType.Natural,
    ga_protein_pct: null,
    ga_fat_pct: null,
    ga_fiber_pct: null,
    ga_moisture_pct: null,
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
    is_recalled: false,
    is_grain_free: false,
    score_confidence: 'high',
    needs_review: false,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
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

describe('scoreFormulation — Layer 1c', () => {
  // ─── Composite ────────────────────────────────────────

  test('perfect formulation → 100', () => {
    const product = makeProduct({
      aafco_statement: 'All Life Stages',
      preservative_type: PreservativeType.Natural,
    });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'salmon', is_protein_fat_source: true }),
      makeIngredient({ position: 3, canonical_name: 'chicken_fat', is_protein_fat_source: true }),
      makeIngredient({ position: 4, canonical_name: 'brown_rice' }),
      makeIngredient({ position: 5, canonical_name: 'vitamin_e' }),
    ];
    const result = scoreFormulation(product, ingredients);
    // 100×0.50 + 100×0.25 + 100×0.25 = 100
    expect(result.formulationScore).toBe(100);
    expect(result.flags).toHaveLength(0);
  });

  test('worst formulation → 21', () => {
    const product = makeProduct({
      aafco_statement: null,
      preservative_type: PreservativeType.Synthetic,
    });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'meat_meal', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'animal_fat', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 3, canonical_name: 'animal_digest', is_unnamed_species: true, is_protein_fat_source: true }),
    ];
    const result = scoreFormulation(product, ingredients);
    // 30×0.50 + 25×0.25 + 0×0.25 = 15 + 6.25 + 0 = 21.25 → 21
    expect(result.formulationScore).toBe(21);
  });

  // ─── AAFCO Statement ─────────────────────────────────

  test('AAFCO: "All Life Stages" → 100', () => {
    const result = scoreFormulation(makeProduct({ aafco_statement: 'All Life Stages' }));
    expect(result.breakdown.aafcoScore).toBe(100);
  });

  test('AAFCO: "Adult Maintenance" → 90', () => {
    const result = scoreFormulation(makeProduct({ aafco_statement: 'Adult Maintenance' }));
    expect(result.breakdown.aafcoScore).toBe(90);
  });

  test('AAFCO: "Growth" → 100', () => {
    const result = scoreFormulation(makeProduct({ aafco_statement: 'Growth' }));
    expect(result.breakdown.aafcoScore).toBe(100);
  });

  test('AAFCO: "Reproduction" → 100', () => {
    const result = scoreFormulation(makeProduct({ aafco_statement: 'Reproduction' }));
    expect(result.breakdown.aafcoScore).toBe(100);
  });

  test('AAFCO: null → 30', () => {
    const result = scoreFormulation(makeProduct({ aafco_statement: null }));
    expect(result.breakdown.aafcoScore).toBe(30);
  });

  test('AAFCO: unrecognized text → 50 + flag', () => {
    const result = scoreFormulation(makeProduct({ aafco_statement: 'some random text' }));
    expect(result.breakdown.aafcoScore).toBe(50);
    expect(result.flags).toContain('aafco_statement_unrecognized');
  });

  test('AAFCO: real-world verbose text with "adult maintenance" → 90', () => {
    const result = scoreFormulation(makeProduct({
      aafco_statement: 'Animal feeding tests using AAFCO procedures substantiate that X provides complete and balanced nutrition for adult maintenance',
    }));
    expect(result.breakdown.aafcoScore).toBe(90);
  });

  // ─── Preservative Quality ─────────────────────────────

  test('preservative: natural → 100', () => {
    const result = scoreFormulation(makeProduct({ preservative_type: PreservativeType.Natural }));
    expect(result.breakdown.preservativeScore).toBe(100);
  });

  test('preservative: mixed → 65', () => {
    const result = scoreFormulation(makeProduct({ preservative_type: PreservativeType.Mixed }));
    expect(result.breakdown.preservativeScore).toBe(65);
  });

  test('preservative: unknown → 45 + flag', () => {
    const result = scoreFormulation(makeProduct({ preservative_type: PreservativeType.Unknown }));
    expect(result.breakdown.preservativeScore).toBe(45);
    expect(result.flags).toContain('preservative_type_unknown');
  });

  test('preservative: null → 45 + flag', () => {
    const result = scoreFormulation(makeProduct({ preservative_type: null }));
    expect(result.breakdown.preservativeScore).toBe(45);
    expect(result.flags).toContain('preservative_type_unknown');
  });

  test('preservative: synthetic → 25', () => {
    const result = scoreFormulation(makeProduct({ preservative_type: PreservativeType.Synthetic }));
    expect(result.breakdown.preservativeScore).toBe(25);
  });

  // ─── Protein Naming ───────────────────────────────────

  test('protein naming: no ingredients provided → 50', () => {
    const result = scoreFormulation(makeProduct());
    expect(result.breakdown.proteinNamingScore).toBe(50);
  });

  test('protein naming: empty ingredients array → 50', () => {
    const result = scoreFormulation(makeProduct(), []);
    expect(result.breakdown.proteinNamingScore).toBe(50);
  });

  test('protein naming: no protein/fat sources in list → 50', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'brown_rice' }),
      makeIngredient({ position: 2, canonical_name: 'vitamin_e' }),
    ];
    const result = scoreFormulation(makeProduct(), ingredients);
    expect(result.breakdown.proteinNamingScore).toBe(50);
  });

  test('protein naming: 1 unnamed / 4 protein-fat sources → 75', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'salmon', is_protein_fat_source: true }),
      makeIngredient({ position: 3, canonical_name: 'chicken_fat', is_protein_fat_source: true }),
      makeIngredient({ position: 4, canonical_name: 'animal_fat', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 5, canonical_name: 'brown_rice' }),
    ];
    const result = scoreFormulation(makeProduct(), ingredients);
    expect(result.breakdown.proteinNamingScore).toBe(75);
  });

  test('protein naming: all named → 100', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'salmon', is_protein_fat_source: true }),
      makeIngredient({ position: 3, canonical_name: 'chicken_fat', is_protein_fat_source: true }),
      makeIngredient({ position: 4, canonical_name: 'vitamin_e' }),
    ];
    const result = scoreFormulation(makeProduct(), ingredients);
    expect(result.breakdown.proteinNamingScore).toBe(100);
  });

  test('protein naming: all unnamed → 0', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'meat_meal', is_unnamed_species: true, is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'animal_fat', is_unnamed_species: true, is_protein_fat_source: true }),
    ];
    const result = scoreFormulation(makeProduct(), ingredients);
    expect(result.breakdown.proteinNamingScore).toBe(0);
  });

  // ─── Determinism ──────────────────────────────────────

  test('deterministic: same inputs → identical output', () => {
    const product = makeProduct({
      aafco_statement: 'Adult Maintenance',
      preservative_type: PreservativeType.Mixed,
    });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', is_protein_fat_source: true }),
      makeIngredient({ position: 2, canonical_name: 'animal_fat', is_unnamed_species: true, is_protein_fat_source: true }),
    ];
    const a = scoreFormulation(product, ingredients);
    const b = scoreFormulation(product, ingredients);
    expect(a).toEqual(b);
  });
});
