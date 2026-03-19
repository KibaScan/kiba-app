// Pantry Helpers Tests — Pure function tests, no Supabase mocking.

import {
  calculateDaysRemaining,
  isLowStock,
  defaultServingMode,
  getSystemRecommendation,
  calculateDepletionBreakdown,
  getCalorieContext,
} from '../../src/utils/pantryHelpers';
import type { PantryPetAssignment } from '../../src/types/pantry';
import type { Product } from '../../src/types';
import type { Pet } from '../../src/types/pet';
import { Category, Species } from '../../src/types';

// ─── Factories ──────────────────────────────────────────

function makeAssignment(overrides: Partial<PantryPetAssignment> = {}): PantryPetAssignment {
  return {
    id: 'assign-1',
    pantry_item_id: 'item-1',
    pet_id: 'pet-1',
    serving_size: 1,
    serving_size_unit: 'cups',
    feedings_per_day: 2,
    feeding_frequency: 'daily',
    feeding_times: null,
    notifications_on: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    brand: 'TestBrand',
    name: 'TestFood',
    category: Category.DailyFood,
    target_species: Species.Dog,
    source: 'curated',
    aafco_statement: null,
    life_stage_claim: null,
    preservative_type: null,
    ga_protein_pct: 26,
    ga_fat_pct: 16,
    ga_fiber_pct: 4,
    ga_moisture_pct: 10,
    ga_calcium_pct: null,
    ga_phosphorus_pct: null,
    ga_kcal_per_cup: 400,
    ga_kcal_per_kg: 3500,
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
    product_form: 'dry',
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

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Buddy',
    species: 'dog',
    breed: null,
    weight_current_lbs: 50,
    weight_goal_lbs: null,
    weight_updated_at: null,
    date_of_birth: null,
    dob_is_approximate: false,
    activity_level: 'moderate',
    is_neutered: true,
    sex: null,
    photo_url: null,
    life_stage: 'adult',
    breed_size: null,
    health_reviewed_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── calculateDaysRemaining ─────────────────────────────

describe('calculateDaysRemaining', () => {
  test('single pet unit mode', () => {
    const assignments = [makeAssignment({ serving_size: 1, feedings_per_day: 2, serving_size_unit: 'units' })];
    // 24 units / (1 * 2) = 12 days
    expect(calculateDaysRemaining(24, 'units', 'unit', assignments)).toBe(12);
  });

  test('shared pets unit mode', () => {
    const assignments = [
      makeAssignment({ id: 'a1', pet_id: 'pet-1', serving_size: 1, feedings_per_day: 2, serving_size_unit: 'units' }),
      makeAssignment({ id: 'a2', pet_id: 'pet-2', serving_size: 0.5, feedings_per_day: 2, serving_size_unit: 'units' }),
    ];
    // 24 / (2 + 1) = 8
    expect(calculateDaysRemaining(24, 'units', 'unit', assignments)).toBe(8);
  });

  test('as_needed only returns null', () => {
    const assignments = [makeAssignment({ feeding_frequency: 'as_needed' })];
    expect(calculateDaysRemaining(24, 'units', 'unit', assignments)).toBeNull();
  });

  test('weight mode with calorie data', () => {
    const assignments = [makeAssignment({ serving_size: 2, feedings_per_day: 2 })]; // 4 cups/day
    // 10 lbs / 2.205 = 4.535 kg
    // totalCups = (4.535 * 3500) / 400 ≈ 39.68
    // 39.68 / 4 ≈ 9.92
    const result = calculateDaysRemaining(10, 'lbs', 'weight', assignments, 400, 3500);
    expect(result).toBeCloseTo(9.92, 1);
  });

  test('weight mode without calorie data returns null', () => {
    const assignments = [makeAssignment()];
    expect(calculateDaysRemaining(10, 'lbs', 'weight', assignments)).toBeNull();
  });
});

// ─── isLowStock ─────────────────────────────────────────

describe('isLowStock', () => {
  test('weight mode: exactly 5 days → true', () => {
    expect(isLowStock(5, 10, 'weight')).toBe(true);
  });

  test('weight mode: 6 days → false', () => {
    expect(isLowStock(6, 10, 'weight')).toBe(false);
  });

  test('weight mode: 0 days → true', () => {
    expect(isLowStock(0, 0, 'weight')).toBe(true);
  });

  test('weight mode: null days → false', () => {
    expect(isLowStock(null, 10, 'weight')).toBe(false);
  });

  test('unit mode: quantity <= 5 → true', () => {
    expect(isLowStock(null, 5, 'unit')).toBe(true);
  });

  test('unit mode: quantity > 5 but days <= 5 → true', () => {
    expect(isLowStock(3, 10, 'unit')).toBe(true);
  });
});

// ─── defaultServingMode ─────────────────────────────────

describe('defaultServingMode', () => {
  test.each([
    ['dry', 'weight'],
    ['freeze_dried', 'weight'],
    ['raw', 'weight'],
    ['dehydrated', 'weight'],
    ['wet', 'unit'],
    [null, 'weight'],
  ] as const)('%s → %s', (form, expected) => {
    expect(defaultServingMode(form)).toBe(expected);
  });
});

// ─── getSystemRecommendation ────────────────────────────

describe('getSystemRecommendation', () => {
  test('with kcal_per_cup returns cups', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const pet = makePet({ weight_current_lbs: 50 });
    const result = getSystemRecommendation(product, pet, false);
    expect(result).not.toBeNull();
    expect(result!.unit).toBe('cups');
    expect(result!.amount).toBeGreaterThan(0);
  });

  test('no calorie data → null', () => {
    const product = makeProduct({
      ga_kcal_per_cup: null,
      ga_kcal_per_kg: null,
      ga_protein_pct: null,
      ga_fat_pct: null,
    });
    const pet = makePet({ weight_current_lbs: 50 });
    expect(getSystemRecommendation(product, pet, false)).toBeNull();
  });

  test('no pet weight → null', () => {
    const product = makeProduct();
    const pet = makePet({ weight_current_lbs: null });
    expect(getSystemRecommendation(product, pet, false)).toBeNull();
  });

  test('goal weight yields less food than current weight', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const pet = makePet({ weight_current_lbs: 50, weight_goal_lbs: 40 });
    const withGoal = getSystemRecommendation(product, pet, true);
    const withoutGoal = getSystemRecommendation(product, pet, false);
    expect(withGoal).not.toBeNull();
    expect(withoutGoal).not.toBeNull();
    expect(withGoal!.amount).toBeLessThan(withoutGoal!.amount);
  });
});

// ─── calculateDepletionBreakdown ────────────────────────

describe('calculateDepletionBreakdown', () => {
  test('unit mode cans', () => {
    const product = makeProduct();
    const result = calculateDepletionBreakdown(1, 'units', 2, 24, 'units', 'cans', product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toContain('cans/day');
    expect(result!.daysText).toBe('~12 days');
  });

  test('unit mode pouches (singular)', () => {
    const product = makeProduct();
    const result = calculateDepletionBreakdown(1, 'units', 1, 10, 'units', 'pouches', product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toContain('pouch/day');
    expect(result!.daysText).toBe('~10 days');
  });

  test('weight mode with calorie data', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400, ga_kcal_per_kg: 3500 });
    const result = calculateDepletionBreakdown(2, 'cups', 2, 10, 'lbs', null, product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toBe('4 cups/day');
    expect(result!.daysText).not.toBeNull();
  });

  test('weight mode without calorie data → null daysText', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: null });
    const result = calculateDepletionBreakdown(2, 'cups', 2, 10, 'lbs', null, product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toBe('4 cups/day');
    expect(result!.daysText).toBeNull();
  });

  test('treat → null', () => {
    const product = makeProduct({ category: Category.Treat });
    expect(calculateDepletionBreakdown(1, 'units', 2, 24, 'units', 'cans', product)).toBeNull();
  });
});

// ─── getCalorieContext ──────────────────────────────────

describe('getCalorieContext', () => {
  test('with kcal_per_cup', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400, ga_kcal_per_kg: 3500 });
    const pet = makePet({ weight_current_lbs: 50 });
    const result = getCalorieContext(product, pet, 2, 'cups', 2);
    expect(result).not.toBeNull();
    expect(result!.daily_kcal).toBe(1600); // 2 cups * 2x/day * 400
    expect(result!.target_kcal).toBeGreaterThan(0);
    expect(result!.source).toBe('label');
  });

  test('no calorie data → null', () => {
    const product = makeProduct({
      ga_kcal_per_cup: null,
      ga_kcal_per_kg: null,
      ga_protein_pct: null,
      ga_fat_pct: null,
    });
    const pet = makePet();
    expect(getCalorieContext(product, pet, 2, 'cups', 2)).toBeNull();
  });

  test('no pet weight → null', () => {
    const product = makeProduct();
    const pet = makePet({ weight_current_lbs: null });
    expect(getCalorieContext(product, pet, 2, 'cups', 2)).toBeNull();
  });
});
