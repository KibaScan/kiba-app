// M6 Key Differences Engine — Test Suite
// 13 test cases covering all 9 rules + edge cases.

import { computeKeyDifferences, KeyDifference } from '../../src/utils/keyDifferences';
import type { Product } from '../../src/types';
import type { ProductIngredient } from '../../src/types/scoring';
import { Category, Species, PreservativeType } from '../../src/types';

// ─── Fixtures ───────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'test-id',
    brand: 'TestBrand',
    name: 'TestBrand Test Product',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'scraped',
    aafco_statement: null,
    life_stage_claim: null,
    preservative_type: null,
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
    image_url: null,
    product_form: null,
    is_recalled: false,
    is_grain_free: false,
    is_supplemental: false,
    is_vet_diet: false,
    score_confidence: 'full',
    needs_review: false,
    base_score: null,
    base_score_computed_at: null,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    price: null,
    price_currency: null,
    product_size_kg: null,
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z',
    ...overrides,
  } as Product;
}

function makeIngredient(overrides: Partial<ProductIngredient> = {}): ProductIngredient {
  return {
    position: 1,
    canonical_name: 'chicken',
    dog_base_severity: 'good',
    cat_base_severity: 'good',
    is_unnamed_species: false,
    is_legume: false,
    is_pulse: false,
    is_pulse_protein: false,
    position_reduction_eligible: false,
    cluster_id: null,
    cat_carb_flag: false,
    allergen_group: null,
    allergen_group_possible: [],
    is_protein_fat_source: false,
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────

describe('computeKeyDifferences', () => {
  // Test 1: Pet allergen matches (highest priority)
  it('fires allergen difference when Product A contains pet allergen and B does not', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Chicken Recipe Food' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Lamb Recipe Food Here' });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'chicken_meal', allergen_group: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'lamb_meal', allergen_group: 'lamb' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const result = computeKeyDifferences(
      productA, productB, ingredientsA, ingredientsB, 'dog',
      ['chicken'], 'Buster',
    );
    const allergen = result.find((d) => d.id === 'allergen_a');
    expect(allergen).toBeDefined();
    expect(allergen!.severity).toBe('negative');
    expect(allergen!.text).toContain("Buster's allergen");
    expect(allergen!.text).toContain('Chicken');
    // Should be the first difference (highest priority)
    expect(result[0].id).toBe('allergen_a');
  });

  // Test 1b: Allergen with possible matches
  it('fires allergen difference for allergen_group_possible matches', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Natural Flavor Food' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Plain Rice Formula' });

    const ingredientsA = [
      makeIngredient({
        position: 1, canonical_name: 'natural_flavors',
        allergen_group: null, allergen_group_possible: ['chicken', 'beef'],
      }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'rice', allergen_group: null }),
    ];

    const result = computeKeyDifferences(
      productA, productB, ingredientsA, ingredientsB, 'dog',
      ['chicken'], 'Buster',
    );
    const allergen = result.find((d) => d.id === 'allergen_a');
    expect(allergen).toBeDefined();
    expect(allergen!.text).toContain('Chicken');
  });

  // Test 2: Artificial colorants
  it('fires colorant difference when Product A has Red 40 and B does not', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Food With Colors' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Clean Food Here' });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'red_40', dog_base_severity: 'danger', cat_base_severity: 'danger' }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const result = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'dog');
    const colorant = result.find((d) => d.id === 'colorant_a');
    expect(colorant).toBeDefined();
    expect(colorant!.severity).toBe('negative');
    expect(colorant!.text).toContain('Red 40');
    expect(colorant!.text).toContain('rated Severe');
  });

  // Test 3: Unnamed proteins (includes natural_flavor)
  it('fires unnamed protein difference when counts differ in top 5', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Mystery Meat Select' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Named Meat Select' });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'meat_meal', is_unnamed_species: true }),
      makeIngredient({ position: 2, canonical_name: 'natural_flavor' }), // also counts as unnamed risk
      makeIngredient({ position: 3, canonical_name: 'corn' }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const result = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'dog');
    const unnamed = result.find((d) => d.id === 'unnamed_a');
    expect(unnamed).toBeDefined();
    expect(unnamed!.severity).toBe('negative');
    expect(unnamed!.text).toContain('2 unnamed protein sources');
  });

  // Test 3b: natural_flavor alone triggers unnamed protein rule
  it('counts natural_flavor as unnamed protein risk even without is_unnamed_species', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Flavor Added Product' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB No Flavor Product' });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'natural_flavors', is_unnamed_species: false }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const result = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'dog');
    const unnamed = result.find((d) => d.id === 'unnamed_a');
    expect(unnamed).toBeDefined();
    expect(unnamed!.text).toContain('1 unnamed protein source');
  });

  // Test 3: Named meat at position 1
  it('fires named meat difference when one leads with named protein', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Chicken Recipe Plus' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Corn Based Formula' });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'deboned_chicken', allergen_group: 'chicken' }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'corn', allergen_group: null }),
    ];

    const result = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'dog');
    const named = result.find((d) => d.id === 'named_meat_a');
    expect(named).toBeDefined();
    expect(named!.severity).toBe('positive');
    expect(named!.text).toContain('named protein source');
  });

  // Test 4: DCM fires for dogs only
  it('fires DCM advisory for dogs but not cats', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Pulse Heavy Formula' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB No Pulse Formula' });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'lentils', is_pulse: true }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 3, canonical_name: 'chickpeas', is_pulse: true }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const dogResult = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'dog');
    expect(dogResult.some((d) => d.id === 'dcm_a')).toBe(true);

    const catResult = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'cat');
    expect(catResult.some((d) => d.id === 'dcm_a')).toBe(false);
  });

  // Test 5: AAFCO status
  it('fires AAFCO difference when one has it and other does not', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Certified Compliant', aafco_statement: 'yes' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Unknown Compliance', aafco_statement: null });

    const result = computeKeyDifferences(productA, productB, [], [], 'dog');
    const aafco = result.find((d) => d.id === 'aafco_a');
    expect(aafco).toBeDefined();
    expect(aafco!.severity).toBe('positive');
    expect(aafco!.text).toContain('AAFCO compliance');
  });

  // Test 6: GA completeness
  it('fires GA completeness when one has full data and other is partial', () => {
    const productA = makeProduct({
      brand: 'BrandA', name: 'BrandA Full Data Product',
      ga_protein_pct: 26, ga_fat_pct: 14, ga_fiber_pct: 4,
    });
    const productB = makeProduct({
      brand: 'BrandB', name: 'BrandB Partial Data Product',
      ga_protein_pct: 26, ga_fat_pct: null, ga_fiber_pct: null,
    });

    const result = computeKeyDifferences(productA, productB, [], [], 'dog');
    const ga = result.find((d) => d.id === 'ga_a');
    expect(ga).toBeDefined();
    expect(ga!.severity).toBe('positive');
    expect(ga!.text).toContain('complete nutritional data');
  });

  // Test 7: Protein delta
  it('fires protein difference when DMB delta > 5%, does not fire when <= 5%', () => {
    // > 5% delta
    const productA = makeProduct({
      brand: 'BrandA', name: 'BrandA High Protein Formula',
      ga_protein_pct: 26, ga_moisture_pct: 10,
    });
    const productB = makeProduct({
      brand: 'BrandB', name: 'BrandB Low Protein Formula',
      ga_protein_pct: 34, ga_moisture_pct: 10,
    });

    const result = computeKeyDifferences(productA, productB, [], [], 'dog');
    const protein = result.find((d) => d.id === 'protein_b');
    expect(protein).toBeDefined();
    expect(protein!.severity).toBe('neutral');
    expect(protein!.text).toContain('more protein (DMB)');

    // <= 5% delta — should NOT fire
    const productC = makeProduct({
      brand: 'BrandC', name: 'BrandC Similar Protein Level',
      ga_protein_pct: 28, ga_moisture_pct: 10,
    });
    const result2 = computeKeyDifferences(productA, productC, [], [], 'dog');
    expect(result2.some((d) => d.id.startsWith('protein_'))).toBe(false);
  });

  // Test 8: Preservative type
  it('fires preservative difference when natural vs synthetic', () => {
    const productA = makeProduct({
      brand: 'BrandA', name: 'BrandA Natural Preserved Food',
      preservative_type: PreservativeType.Natural,
    });
    const productB = makeProduct({
      brand: 'BrandB', name: 'BrandB Synthetic Preserved Food',
      preservative_type: PreservativeType.Synthetic,
    });

    const result = computeKeyDifferences(productA, productB, [], [], 'dog');
    const pres = result.find((d) => d.id === 'preservative_a');
    expect(pres).toBeDefined();
    expect(pres!.severity).toBe('positive');
    expect(pres!.text).toContain('natural preservatives');
  });

  // Test 9: Max 4 returned when all rules fire
  it('returns max 4 differences even when more rules fire', () => {
    const productA = makeProduct({
      brand: 'BrandA', name: 'BrandA Problem Product Here',
      aafco_statement: null,
      ga_protein_pct: null, ga_fat_pct: null, ga_fiber_pct: null,
      preservative_type: PreservativeType.Synthetic,
    });
    const productB = makeProduct({
      brand: 'BrandB', name: 'BrandB Clean Product Here',
      aafco_statement: 'yes',
      ga_protein_pct: 30, ga_fat_pct: 15, ga_fiber_pct: 4, ga_moisture_pct: 10,
      preservative_type: PreservativeType.Natural,
    });

    const ingredientsA = [
      makeIngredient({ position: 1, canonical_name: 'corn', allergen_group: null }),
      makeIngredient({ position: 2, canonical_name: 'red_40', dog_base_severity: 'danger' }),
      makeIngredient({ position: 3, canonical_name: 'meat_meal', is_unnamed_species: true }),
      makeIngredient({ position: 4, canonical_name: 'lentils', is_pulse: true }),
      makeIngredient({ position: 5, canonical_name: 'peas', is_pulse: true }),
    ];
    const ingredientsB = [
      makeIngredient({ position: 1, canonical_name: 'deboned_chicken', allergen_group: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const result = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'dog');
    expect(result.length).toBeLessThanOrEqual(4);
    // Negative severity should come first
    expect(result[0].severity).toBe('negative');
  });

  // Test 10: Identical products produce empty array
  it('returns empty array for identical products', () => {
    const product = makeProduct({
      brand: 'Same', name: 'Same Product Exact Match',
      aafco_statement: 'yes',
      ga_protein_pct: 26, ga_fat_pct: 14, ga_fiber_pct: 4, ga_moisture_pct: 10,
      preservative_type: PreservativeType.Natural,
    });

    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken', allergen_group: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];

    const result = computeKeyDifferences(product, product, ingredients, ingredients, 'dog');
    expect(result).toEqual([]);
  });

  // Test 11: Structured fields — subject is a short conversational name
  it('returns structured diffs with short subject (not SEO-bloated full name)', () => {
    const productA = makeProduct({
      brand: 'Feline Natural',
      name: 'Feline Natural Chicken & Venison Feast Grain-Free Canned Cat Food, 6-oz, case of 12',
    });
    const productB = makeProduct({
      brand: '9 Lives',
      name: '9 Lives Corn Based Filler Formula',
    });

    const ingredientsA = [makeIngredient({ position: 1, canonical_name: 'chicken', allergen_group: 'chicken' })];
    const ingredientsB = [makeIngredient({ position: 1, canonical_name: 'corn' })];

    const result = computeKeyDifferences(productA, productB, ingredientsA, ingredientsB, 'cat');
    const named = result.find((d) => d.id === 'named_meat_a');
    expect(named).toBeDefined();
    expect(named!.subject).toBe('Feline Natural Chicken & Venison');
    expect(named!.verb).toBe('leads with');
    expect(named!.claim).toBe('a named protein source');
    expect(named!.trailing).toBeUndefined();
    // text field is still the joined form for legacy consumers
    expect(named!.text).toBe('Feline Natural Chicken & Venison leads with a named protein source');
  });

  // Test 12: Protein delta carries trailing "(DMB)" qualifier
  it('protein delta diffs have "(DMB)" in trailing field, not claim', () => {
    const productA = makeProduct({
      brand: 'BrandA', name: 'BrandA Low Protein Formula',
      ga_protein_pct: 22, ga_moisture_pct: 10,
    });
    const productB = makeProduct({
      brand: 'BrandB', name: 'BrandB High Protein Formula',
      ga_protein_pct: 34, ga_moisture_pct: 10,
    });

    const result = computeKeyDifferences(productA, productB, [], [], 'dog');
    const protein = result.find((d) => d.id === 'protein_b');
    expect(protein).toBeDefined();
    expect(protein!.verb).toBe('has');
    expect(protein!.claim).toMatch(/% more protein/);
    expect(protein!.claim).not.toContain('(DMB)');
    expect(protein!.trailing).toBe('(DMB)');
  });

  // Test 13: Missing data handled gracefully
  it('handles null ingredients and null GA values without crashing', () => {
    const productA = makeProduct({ brand: 'BrandA', name: 'BrandA Minimal Data Product' });
    const productB = makeProduct({ brand: 'BrandB', name: 'BrandB Minimal Data Product' });

    // Empty ingredients
    expect(() => computeKeyDifferences(productA, productB, [], [], 'dog')).not.toThrow();

    // Null GA values (all null by default in fixture)
    const result = computeKeyDifferences(productA, productB, [], [], 'cat');
    expect(Array.isArray(result)).toBe(true);
  });
});
