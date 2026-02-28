import { applySpeciesRules } from '../../../src/services/scoring/speciesRules';
import type { Product } from '../../../src/types';
import type { ProductIngredient } from '../../../src/types/scoring';
import { Category } from '../../../src/types';

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

// ─── Dog Rules ─────────────────────────────────────────────

describe('applySpeciesRules — Dog rules', () => {
  const BASE = 69.3; // Pure Balance reference baseScore

  test('DCM fires: grain-free + 4 legumes in top 7, no mitigation → −8%', () => {
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 4, canonical_name: 'chickpeas', is_legume: true }),
      makeIngredient({ position: 5, canonical_name: 'pea_starch', is_legume: true }),
      makeIngredient({ position: 6, canonical_name: 'canola_oil' }),
      makeIngredient({ position: 7, canonical_name: 'flaxseed' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm!.fired).toBe(true);
    expect(dcm!.adjustment).toBe(-Math.round(BASE * 0.08));
    expect(result.adjustedScore).toBe(BASE + dcm!.adjustment);

    const mitigation = result.rules.find(r => r.ruleId === 'TAURINE_MITIGATION');
    expect(mitigation!.fired).toBe(false);
  });

  test('DCM + mitigation: grain-free + 4 legumes + taurine + l-carnitine → net −5%', () => {
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 4, canonical_name: 'chickpeas', is_legume: true }),
      makeIngredient({ position: 5, canonical_name: 'pea_protein', is_legume: true }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
      makeIngredient({ position: 11, canonical_name: 'l-carnitine' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    const mit = result.rules.find(r => r.ruleId === 'TAURINE_MITIGATION');
    expect(dcm!.fired).toBe(true);
    expect(mit!.fired).toBe(true);
    expect(dcm!.adjustment).toBe(-Math.round(BASE * 0.08));
    expect(mit!.adjustment).toBe(Math.round(BASE * 0.03));
    // Net: −8% + 3% = −5% of baseScore
    const net = dcm!.adjustment + mit!.adjustment;
    expect(result.adjustedScore).toBe(BASE + net);
  });

  test('DCM does NOT fire: only 2 legumes in top 7', () => {
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'sweet_potatoes' }),
      makeIngredient({ position: 4, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 5, canonical_name: 'chicken_fat' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm!.fired).toBe(false);
    expect(dcm!.adjustment).toBe(0);
    expect(result.adjustedScore).toBe(BASE);
  });

  test('DCM does NOT fire: not grain-free regardless of legume count', () => {
    const product = makeProduct({ is_grain_free: false });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 2, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'chickpeas', is_legume: true }),
      makeIngredient({ position: 4, canonical_name: 'pea_starch', is_legume: true }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm!.fired).toBe(false);
    expect(result.adjustedScore).toBe(BASE);
  });

  test('mitigation does NOT fire without DCM', () => {
    const product = makeProduct({ is_grain_free: false });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
      makeIngredient({ position: 11, canonical_name: 'l-carnitine' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const mit = result.rules.find(r => r.ruleId === 'TAURINE_MITIGATION');
    expect(mit!.fired).toBe(false);
    expect(mit!.adjustment).toBe(0);
  });

  test('legumes at position 8+ do not count toward DCM threshold', () => {
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 8, canonical_name: 'chickpeas', is_legume: true }),
      makeIngredient({ position: 9, canonical_name: 'pea_starch', is_legume: true }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm!.fired).toBe(false);
  });
});

// ─── Cat Rules ─────────────────────────────────────────────

describe('applySpeciesRules — Cat rules', () => {
  const BASE = 80;

  test('carb overload fires: 3 cat_carb_flag in positions 1-5 → −15%', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'corn', cat_carb_flag: true }),
      makeIngredient({ position: 3, canonical_name: 'wheat', cat_carb_flag: true }),
      makeIngredient({ position: 5, canonical_name: 'rice', cat_carb_flag: true }),
      makeIngredient({ position: 6, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const carb = result.rules.find(r => r.ruleId === 'CAT_CARB_OVERLOAD');
    expect(carb!.fired).toBe(true);
    expect(carb!.adjustment).toBe(-Math.round(BASE * 0.15));
  });

  test('carb overload does NOT fire: only 2 cat_carb_flag in top 5', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'corn', cat_carb_flag: true }),
      makeIngredient({ position: 3, canonical_name: 'wheat', cat_carb_flag: true }),
      makeIngredient({ position: 5, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const carb = result.rules.find(r => r.ruleId === 'CAT_CARB_OVERLOAD');
    expect(carb!.fired).toBe(false);
    expect(carb!.adjustment).toBe(0);
  });

  test('taurine missing: no taurine ingredient → −10 flat points', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const taurine = result.rules.find(r => r.ruleId === 'CAT_TAURINE_MISSING');
    expect(taurine!.fired).toBe(true);
    expect(taurine!.adjustment).toBe(-10);
    expect(result.adjustedScore).toBe(BASE - 10);
  });

  test('taurine present: no penalty', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const taurine = result.rules.find(r => r.ruleId === 'CAT_TAURINE_MISSING');
    expect(taurine!.fired).toBe(false);
    expect(taurine!.adjustment).toBe(0);
  });

  test('UGT1A6 fires for propylene glycol → flag only, no score change', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 5, canonical_name: 'propylene glycol' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const ugt = result.rules.find(r => r.ruleId === 'UGT1A6_WARNING');
    expect(ugt!.fired).toBe(true);
    expect(ugt!.adjustment).toBe(0);
    expect(result.adjustedScore).toBe(BASE);
  });

  test('UGT1A6 does not fire when no concerning ingredients', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const ugt = result.rules.find(r => r.ruleId === 'UGT1A6_WARNING');
    expect(ugt!.fired).toBe(false);
  });

  test('cat_carb_flag at position 6+ does not count', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'corn', cat_carb_flag: true }),
      makeIngredient({ position: 2, canonical_name: 'wheat', cat_carb_flag: true }),
      makeIngredient({ position: 6, canonical_name: 'rice', cat_carb_flag: true }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, BASE);
    const carb = result.rules.find(r => r.ruleId === 'CAT_CARB_OVERLOAD');
    expect(carb!.fired).toBe(false);
  });
});

// ─── Species Isolation (D-011) ─────────────────────────────

describe('applySpeciesRules — species isolation', () => {
  test('dog product → no cat rules present', () => {
    const product = makeProduct({ is_grain_free: false });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, 80);
    const ruleIds = result.rules.map(r => r.ruleId);
    expect(ruleIds).toContain('DCM_ADVISORY');
    expect(ruleIds).toContain('TAURINE_MITIGATION');
    expect(ruleIds).not.toContain('CAT_CARB_OVERLOAD');
    expect(ruleIds).not.toContain('CAT_TAURINE_MISSING');
    expect(ruleIds).not.toContain('UGT1A6_WARNING');
  });

  test('cat product → no dog rules present', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, 80);
    const ruleIds = result.rules.map(r => r.ruleId);
    expect(ruleIds).toContain('CAT_CARB_OVERLOAD');
    expect(ruleIds).toContain('CAT_TAURINE_MISSING');
    expect(ruleIds).toContain('UGT1A6_WARNING');
    expect(ruleIds).not.toContain('DCM_ADVISORY');
    expect(ruleIds).not.toContain('TAURINE_MITIGATION');
  });
});

// ─── Reference Score (D-013) ───────────────────────────────

describe('applySpeciesRules — reference scores', () => {
  test('Pure Balance reference: 69.3 → DCM −8% + mitigation +3% → 66 (rounded)', () => {
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'pea_starch', is_legume: true }),
      makeIngredient({ position: 4, canonical_name: 'canola_oil' }),
      makeIngredient({ position: 5, canonical_name: 'pea_protein', is_legume: true }),
      makeIngredient({ position: 6, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
      makeIngredient({ position: 11, canonical_name: 'l-carnitine' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, 69.3);
    // DCM: -round(69.3 * 0.08) = -round(5.544) = -6
    // Mitigation: +round(69.3 * 0.03) = +round(2.079) = +2
    // Net: 69.3 - 6 + 2 = 65.3
    expect(result.adjustedScore).toBeCloseTo(65.3, 0);
  });
});

// ─── Edge Cases ────────────────────────────────────────────

describe('applySpeciesRules — edge cases', () => {
  test('adjustedScore floors at 0', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'corn', cat_carb_flag: true }),
      makeIngredient({ position: 2, canonical_name: 'wheat', cat_carb_flag: true }),
      makeIngredient({ position: 3, canonical_name: 'rice', cat_carb_flag: true }),
    ];
    // baseScore 5, carb −15% = −1, taurine −10 → would be −6 → floors at 0
    const result = applySpeciesRules(product, 'cat', ingredients, 5);
    expect(result.adjustedScore).toBe(0);
  });

  test('adjustedScore caps at 100', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = applySpeciesRules(product, 'cat', ingredients, 100);
    expect(result.adjustedScore).toBeLessThanOrEqual(100);
  });

  test('deterministic: same inputs → identical output', () => {
    const product = makeProduct({ is_grain_free: true });
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_legume: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_legume: true }),
      makeIngredient({ position: 4, canonical_name: 'chickpeas', is_legume: true }),
    ];
    const a = applySpeciesRules(product, 'dog', ingredients, 80);
    const b = applySpeciesRules(product, 'dog', ingredients, 80);
    expect(a).toEqual(b);
  });
});
