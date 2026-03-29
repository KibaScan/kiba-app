import { applySpeciesRules, evaluateDcmRisk } from '../../../src/services/scoring/speciesRules';
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
    price: null,
    price_currency: null,
    product_size_kg: null,
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

// ─── D-137 DCM Pulse Detection ───────────────────────────────

describe('evaluateDcmRisk — D-137 three-rule OR', () => {
  test('Rule 1 (Heavyweight): 1 pulse at position 2 → fires', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 3, canonical_name: 'rice' }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(true);
    expect(result.triggeredRules).toContain('heavyweight');
  });

  test('1 pulse at position 4 only → no rules fire', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
      makeIngredient({ position: 3, canonical_name: 'corn' }),
      makeIngredient({ position: 4, canonical_name: 'peas', is_pulse: true }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(false);
    expect(result.triggeredRules).toEqual([]);
  });

  test('Rule 2 (Density): 2 pulses at positions 5 and 8 → fires', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 5, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 8, canonical_name: 'lentils', is_pulse: true }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(true);
    expect(result.triggeredRules).toContain('density');
    expect(result.triggeredRules).not.toContain('heavyweight');
  });

  test('Rule 3 (Substitution): pea_protein at position 6, no other pulses → fires', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 6, canonical_name: 'pea_protein', is_pulse: true, is_pulse_protein: true }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(true);
    expect(result.triggeredRules).toContain('substitution');
  });

  test('pea_starch at position 6, no other pulses → NO rules fire (not pulse protein)', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 6, canonical_name: 'pea_starch', is_pulse: true, is_pulse_protein: false }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(false);
    expect(result.triggeredRules).toEqual([]);
  });

  test('potatoes at positions 3, 5, 7 → NO rules fire (potatoes excluded from pulse)', () => {
    const ingredients = [
      makeIngredient({ position: 3, canonical_name: 'potato', is_pulse: false }),
      makeIngredient({ position: 5, canonical_name: 'sweet_potato', is_pulse: false }),
      makeIngredient({ position: 7, canonical_name: 'potato_starch', is_pulse: false }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(false);
    expect(result.triggeredRules).toEqual([]);
  });

  test('soy at position 2 → NO rules fire (soy excluded from pulse)', () => {
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'soybean_meal', is_pulse: false }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(false);
  });

  test('pulse + taurine + L-carnitine → mitigation applies', () => {
    const ingredients = [
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
      makeIngredient({ position: 11, canonical_name: 'l-carnitine' }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(true);
    expect(result.hasMitigation).toBe(true);
  });

  test('pulse + taurine only (no L-carnitine) → mitigation does NOT apply', () => {
    const ingredients = [
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 10, canonical_name: 'taurine' }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(true);
    expect(result.hasMitigation).toBe(false);
  });

  test('grain-inclusive product with 2 pulses in top 10 → Rule 2 fires (no grain-free gate)', () => {
    // This product is NOT grain-free — D-137 removed the grain-free gate
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 3, canonical_name: 'brown_rice' }),  // grain present
      makeIngredient({ position: 5, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 8, canonical_name: 'lentils', is_pulse: true }),
    ];
    const result = evaluateDcmRisk(ingredients);
    expect(result.fires).toBe(true);
    expect(result.triggeredRules).toContain('density');
  });

  test('Pure Balance: Rule 1 + Rule 2 fire, Rule 3 does not, mitigation fires → 62', () => {
    // Peas at pos 3 (Rule 1: heavyweight), Pea starch at pos 7 (Rule 2: density = 2 pulses in top 10)
    // No pulse protein isolate (Rule 3 does not fire)
    // Taurine + L-carnitine present → mitigation
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'salmon_meal' }),
      makeIngredient({ position: 3, canonical_name: 'peas', is_legume: true, is_pulse: true }),
      makeIngredient({ position: 4, canonical_name: 'potato' }),
      makeIngredient({ position: 5, canonical_name: 'sweet_potato' }),
      makeIngredient({ position: 6, canonical_name: 'poultry_fat' }),
      makeIngredient({ position: 7, canonical_name: 'pea_starch', is_legume: true, is_pulse: true }),
      makeIngredient({ position: 17, canonical_name: 'taurine' }),
      makeIngredient({ position: 40, canonical_name: 'l_carnitine' }),
    ];
    const dcm = evaluateDcmRisk(ingredients);
    expect(dcm.fires).toBe(true);
    expect(dcm.triggeredRules).toContain('heavyweight');
    expect(dcm.triggeredRules).toContain('density');
    expect(dcm.triggeredRules).not.toContain('substitution');
    expect(dcm.hasMitigation).toBe(true);
    expect(dcm.pulseIngredients).toHaveLength(2);
    expect(dcm.pulseIngredients.every(p => !p.isPulseProtein)).toBe(true);

    // Verify score via applySpeciesRules: base 65 → DCM −5, mitigation +2 → 62
    const product = makeProduct({ is_grain_free: true });
    const result = applySpeciesRules(product, 'dog', ingredients, 65);
    expect(result.adjustedScore).toBe(62);
  });
});

// ─── Dog Rules (via applySpeciesRules) ──────────────────────

describe('applySpeciesRules — Dog rules', () => {
  const BASE = 69.3;

  test('DCM fires with pulse load, no mitigation → −8%', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_pulse: true }),
      makeIngredient({ position: 5, canonical_name: 'chickpeas', is_pulse: true }),
      makeIngredient({ position: 6, canonical_name: 'canola_oil' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm!.fired).toBe(true);
    expect(dcm!.adjustment).toBe(-Math.round(BASE * 0.08));

    const mitigation = result.rules.find(r => r.ruleId === 'TAURINE_MITIGATION');
    expect(mitigation!.fired).toBe(false);
  });

  test('DCM + mitigation: pulse load + taurine + l-carnitine → net −5%', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_pulse: true }),
      makeIngredient({ position: 5, canonical_name: 'pea_protein', is_pulse: true, is_pulse_protein: true }),
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
    const net = dcm!.adjustment + mit!.adjustment;
    expect(result.adjustedScore).toBe(BASE + net);
  });

  test('no pulses → DCM does not fire', () => {
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'chicken' }),
      makeIngredient({ position: 2, canonical_name: 'rice' }),
      makeIngredient({ position: 3, canonical_name: 'corn' }),
    ];
    const result = applySpeciesRules(product, 'dog', ingredients, BASE);
    const dcm = result.rules.find(r => r.ruleId === 'DCM_ADVISORY');
    expect(dcm!.fired).toBe(false);
    expect(dcm!.adjustment).toBe(0);
    expect(result.adjustedScore).toBe(BASE);
  });

  test('mitigation does NOT fire without DCM', () => {
    const product = makeProduct();
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
    const product = makeProduct();
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
    const product = makeProduct();
    const ingredients = [
      makeIngredient({ position: 1, canonical_name: 'salmon' }),
      makeIngredient({ position: 2, canonical_name: 'peas', is_pulse: true }),
      makeIngredient({ position: 3, canonical_name: 'lentils', is_pulse: true }),
      makeIngredient({ position: 5, canonical_name: 'chickpeas', is_pulse: true }),
    ];
    const a = applySpeciesRules(product, 'dog', ingredients, 80);
    const b = applySpeciesRules(product, 'dog', ingredients, 80);
    expect(a).toEqual(b);
  });
});
