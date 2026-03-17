// Kiba — Calorie Estimation Tests
// Covers: Atwater ME estimation, resolveCalories fallback chain, kcal_per_unit derivation

import { estimateKcalPerKg, resolveCalories } from '../../src/utils/calorieEstimation';
import type { Product } from '../../src/types';
import { Category, Species } from '../../src/types';

// ─── Fixtures ───────────────────────────────────────────

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-001',
    brand: 'TestBrand',
    name: 'TestFood',
    category: Category.Treat,
    target_species: Species.Dog,
    source: 'curated',
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
    is_recalled: false,
    is_grain_free: false,
    is_supplemental: false,
    is_vet_diet: false,
    score_confidence: 'high',
    needs_review: false,
    base_score: null,
    base_score_computed_at: null,
    last_verified_at: null,
    formula_change_log: null,
    affiliate_links: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── estimateKcalPerKg ─────────────────────────────────

describe('estimateKcalPerKg', () => {
  it('computes Modified Atwater ME correctly', () => {
    // Example: 30% protein, 15% fat, 25% carbs
    // = (30*3.5 + 15*8.5 + 25*3.5) * 10
    // = (105 + 127.5 + 87.5) * 10 = 3200
    expect(estimateKcalPerKg(30, 15, 25)).toBe(3200);
  });

  it('handles low-calorie wet food correctly', () => {
    // 9% protein, 2% fat, 3% carbs (as-fed, high moisture)
    // = (9*3.5 + 2*8.5 + 3*3.5) * 10
    // = (31.5 + 17 + 10.5) * 10 = 590
    expect(estimateKcalPerKg(9, 2, 3)).toBe(590);
  });

  it('returns 0 for all zeros', () => {
    expect(estimateKcalPerKg(0, 0, 0)).toBe(0);
  });
});

// ─── resolveCalories ───────────────────────────────────

describe('resolveCalories', () => {
  it('returns label source when kcal_per_kg is available', () => {
    const product = makeProduct({ ga_kcal_per_kg: 3500 });
    const result = resolveCalories(product);

    expect(result).not.toBeNull();
    expect(result!.kcalPerKg).toBe(3500);
    expect(result!.source).toBe('label');
  });

  it('uses existing kcal_per_unit when kcal_per_kg available', () => {
    const product = makeProduct({ ga_kcal_per_kg: 3500, kcal_per_unit: 25 });
    const result = resolveCalories(product);

    expect(result!.kcalPerUnit).toBe(25);
    expect(result!.source).toBe('label');
  });

  it('derives kcal_per_unit from kcal_per_kg + unit_weight_g', () => {
    const product = makeProduct({ ga_kcal_per_kg: 4000, unit_weight_g: 10 });
    const result = resolveCalories(product);

    // 4000 * 10 / 1000 = 40
    expect(result!.kcalPerUnit).toBe(40);
    expect(result!.source).toBe('label');
  });

  it('returns label source when only kcal_per_cup available', () => {
    const product = makeProduct({ ga_kcal_per_cup: 350 });
    const result = resolveCalories(product);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('label');
  });

  it('returns estimated source from Atwater when no kcal data but GA exists', () => {
    const product = makeProduct({
      ga_protein_pct: 28,
      ga_fat_pct: 16,
      ga_fiber_pct: 4,
      ga_moisture_pct: 10,
    });
    const result = resolveCalories(product);

    expect(result).not.toBeNull();
    expect(result!.source).toBe('estimated');
    expect(result!.kcalPerKg).toBeGreaterThan(0);
  });

  it('derives kcal_per_unit from Atwater estimate + unit_weight_g', () => {
    const product = makeProduct({
      ga_protein_pct: 30,
      ga_fat_pct: 15,
      ga_fiber_pct: 5,
      ga_moisture_pct: 10,
      unit_weight_g: 5,
    });
    const result = resolveCalories(product);

    expect(result!.source).toBe('estimated');
    expect(result!.kcalPerUnit).toBeGreaterThan(0);
  });

  it('returns null when no calorie data and no GA data', () => {
    const product = makeProduct();
    const result = resolveCalories(product);

    expect(result).toBeNull();
  });

  it('prefers label over Atwater estimate', () => {
    const product = makeProduct({
      ga_kcal_per_kg: 3500,
      ga_protein_pct: 28,
      ga_fat_pct: 16,
      ga_fiber_pct: 4,
      ga_moisture_pct: 10,
    });
    const result = resolveCalories(product);

    expect(result!.source).toBe('label');
    expect(result!.kcalPerKg).toBe(3500);
  });

  it('uses treat ash default (5%) for treat carb estimation', () => {
    const treatProduct = makeProduct({
      category: Category.Treat,
      ga_protein_pct: 20,
      ga_fat_pct: 10,
      ga_fiber_pct: 3,
      ga_moisture_pct: 10,
    });
    const dailyProduct = makeProduct({
      category: Category.DailyFood,
      ga_protein_pct: 20,
      ga_fat_pct: 10,
      ga_fiber_pct: 3,
      ga_moisture_pct: 10,
    });

    const treatResult = resolveCalories(treatProduct);
    const dailyResult = resolveCalories(dailyProduct);

    // Treat uses 5% ash, daily food (dry) uses 7% ash → different carb → different kcal
    expect(treatResult!.kcalPerKg).not.toBe(dailyResult!.kcalPerKg);
  });
});
