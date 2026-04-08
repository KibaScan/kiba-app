// Pantry Helpers Tests — Pure function tests, no Supabase mocking.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import {
  calculateDaysRemaining,
  isLowStock,
  defaultServingMode,
  getSystemRecommendation,
  calculateDepletionBreakdown,
  getCalorieContext,
  computePetDer,
  computeExistingPantryKcal,
  computeAutoServingSize,
  computeBudgetWarning,
  getSmartDefaultFeedingsPerDay,
  getConditionFeedingsPerDay,
  getConditionFeedingAdvisory,
  parseProductSize,
  convertToKg,
  convertFromKg,
  convertWeightToCups,
  convertWeightToServings,
  pickBaseForSwap,
  getTodayBounds,
  getWetFoodKcal,
  computeBehavioralServing,
  computeBehavioralBudgetWarning,
  computePerServingKcal,
} from '../../src/utils/pantryHelpers';
import type { PantryPetAssignment, PantryCardData, PantryAnchor } from '../../src/types/pantry';
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
    feeding_role: 'base',
    auto_deplete_enabled: false,
    calorie_share_pct: 100,
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
    aafco_inference: null,
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
    source_url: null,
    chewy_sku: null,
    asin: null,
    walmart_id: null,
    price: null,
    price_currency: null,
    product_size_kg: null,
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
    breed_size: 'medium',
    feeding_style: 'dry_only',
    wet_reserve_kcal: 0,
    wet_reserve_source: null,
    health_reviewed_at: null,
    weight_goal_level: null,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
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
  test('unit mode with cup data shows cups/day', () => {
    const product = makeProduct(); // has ga_kcal_per_cup: 400
    const result = calculateDepletionBreakdown(1, 'units', 2, 24, 'units', 'servings', product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toContain('cups/day');
    expect(result!.daysText).toBe('~12 days');
  });

  test('unit mode with cup data singular cup', () => {
    const product = makeProduct();
    const result = calculateDepletionBreakdown(1, 'units', 1, 10, 'units', 'servings', product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toContain('cup/day');
    expect(result!.daysText).toBe('~10 days');
  });

  test('unit mode without cup data shows servings/day', () => {
    const product = makeProduct({ ga_kcal_per_cup: null });
    const result = calculateDepletionBreakdown(1, 'units', 2, 24, 'units', 'servings', product);
    expect(result).not.toBeNull();
    expect(result!.rateText).toContain('servings/day');
    expect(result!.daysText).toBe('~12 days');
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
    expect(calculateDepletionBreakdown(1, 'units', 2, 24, 'units', 'servings', product)).toBeNull();
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

// ─── D-165 Helper Factories ─────────────────────────────

function makePantryCard(overrides: Partial<PantryCardData> = {}): PantryCardData {
  return {
    id: 'item-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity_original: 25,
    quantity_remaining: 20,
    quantity_unit: 'lbs',
    serving_mode: 'weight',
    unit_label: null,
    added_at: '2026-01-01T00:00:00Z',
    is_active: true,
    last_deducted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    product: {
      name: 'TestFood',
      brand: 'TestBrand',
      image_url: null,
      product_form: 'dry',
      is_supplemental: false,
      is_recalled: false,
      is_vet_diet: false,
      target_species: 'dog',
      category: 'daily_food',
      base_score: null,
      ga_kcal_per_cup: 400,
      ga_kcal_per_kg: 3500,
      kcal_per_unit: null,
      unit_weight_g: null,
      aafco_statement: null,
      life_stage_claim: null,
    },
    assignments: [makeAssignment({ pet_id: 'pet-1', serving_size: 2, feedings_per_day: 2, feeding_frequency: 'daily' })],
    days_remaining: 14,
    is_low_stock: false,
    is_empty: false,
    calorie_context: { daily_kcal: 1600, target_kcal: 1200, source: 'label' },
    resolved_score: 72,
    ...overrides,
  } as PantryCardData;
}

// ─── computePetDer ──────────────────────────────────────

describe('computePetDer', () => {
  test('returns DER for 50lb adult dog', () => {
    const pet = makePet({ weight_current_lbs: 50 });
    const der = computePetDer(pet, false);
    expect(der).not.toBeNull();
    expect(der!).toBeGreaterThan(500);
    expect(der!).toBeLessThan(2000);
  });

  test('returns null when weight is null', () => {
    const pet = makePet({ weight_current_lbs: null });
    expect(computePetDer(pet, false)).toBeNull();
  });

  test('uses goal weight when premium flag set', () => {
    const pet = makePet({ weight_current_lbs: 50, weight_goal_lbs: 40 });
    const derCurrent = computePetDer(pet, false)!;
    const derGoal = computePetDer(pet, true)!;
    expect(derGoal).toBeLessThan(derCurrent);
  });

  test('ignores goal weight when flag is false', () => {
    const pet = makePet({ weight_current_lbs: 50, weight_goal_lbs: 40 });
    const derNoGoal = computePetDer(pet, false)!;
    const petNoGoal = makePet({ weight_current_lbs: 50, weight_goal_lbs: null });
    const derNull = computePetDer(petNoGoal, false)!;
    expect(derNoGoal).toBe(derNull);
  });
});

// ─── computeExistingPantryKcal ──────────────────────────

describe('computeExistingPantryKcal', () => {
  test('sums daily items for correct pet', () => {
    const items = [
      makePantryCard({ calorie_context: { daily_kcal: 500, target_kcal: 1200, source: 'label' } }),
      makePantryCard({
        id: 'item-2',
        calorie_context: { daily_kcal: 300, target_kcal: 1200, source: 'label' },
        assignments: [makeAssignment({ id: 'a2', pet_id: 'pet-1', feeding_frequency: 'daily' })],
      }),
    ];
    expect(computeExistingPantryKcal(items, 'pet-1')).toBe(800);
  });

  test('ignores as_needed items', () => {
    const items = [
      makePantryCard({
        calorie_context: { daily_kcal: 500, target_kcal: 1200, source: 'label' },
        assignments: [makeAssignment({ feeding_frequency: 'as_needed' })],
      }),
    ];
    expect(computeExistingPantryKcal(items, 'pet-1')).toBe(0);
  });

  test('ignores treats', () => {
    const items = [
      makePantryCard({
        product: { ...makePantryCard().product, category: 'treat' },
        calorie_context: { daily_kcal: 50, target_kcal: 1200, source: 'label' },
      }),
    ];
    expect(computeExistingPantryKcal(items, 'pet-1')).toBe(0);
  });

  test('ignores empty items', () => {
    const items = [
      makePantryCard({
        is_empty: true,
        calorie_context: { daily_kcal: 500, target_kcal: 1200, source: 'label' },
      }),
    ];
    expect(computeExistingPantryKcal(items, 'pet-1')).toBe(0);
  });

  test('ignores items assigned to other pets', () => {
    const items = [
      makePantryCard({
        calorie_context: { daily_kcal: 500, target_kcal: 1200, source: 'label' },
        assignments: [makeAssignment({ pet_id: 'pet-2', feeding_frequency: 'daily' })],
      }),
    ];
    expect(computeExistingPantryKcal(items, 'pet-1')).toBe(0);
  });

  test('returns 0 for empty array', () => {
    expect(computeExistingPantryKcal([], 'pet-1')).toBe(0);
  });

  test('excludes item by ID', () => {
    const items = [
      makePantryCard({ calorie_context: { daily_kcal: 500, target_kcal: 1200, source: 'label' } }),
      makePantryCard({
        id: 'item-2',
        calorie_context: { daily_kcal: 300, target_kcal: 1200, source: 'label' },
        assignments: [makeAssignment({ id: 'a2', pet_id: 'pet-1', feeding_frequency: 'daily' })],
      }),
    ];
    expect(computeExistingPantryKcal(items, 'pet-1', 'item-2')).toBe(500);
  });
});

// ─── computeAutoServingSize ─────────────────────────────

describe('computeAutoServingSize', () => {
  test('full budget, 1 feeding, cups', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeAutoServingSize(1200, 1, product);
    expect(result).toEqual({ amount: 3, unit: 'cups' }); // 1200/1/400
  });

  test('splits budget across 2 feedings', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeAutoServingSize(1200, 2, product);
    expect(result).toEqual({ amount: 1.5, unit: 'cups' }); // 1200/2/400
  });

  test('uses kcalPerUnit fallback when no kcal_per_cup', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: 3500, kcal_per_unit: 200, unit_weight_g: 57 });
    const result = computeAutoServingSize(600, 2, product);
    expect(result).not.toBeNull();
    expect(result!.unit).toBe('units');
  });

  test('returns null when no calorie data', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: null, ga_protein_pct: null, ga_fat_pct: null });
    expect(computeAutoServingSize(1200, 2, product)).toBeNull();
  });

  test('zero budget returns 0 amount', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeAutoServingSize(0, 2, product);
    expect(result).toEqual({ amount: 0, unit: 'cups' });
  });
});

// ─── computeBudgetWarning ───────────────────────────────

describe('computeBudgetWarning', () => {
  const baseParams = {
    servingSize: 2,
    servingSizeUnit: 'cups' as const,
    feedingsPerDay: 2,
    product: makeProduct({ ga_kcal_per_cup: 400 }),
    maintenanceDer: 1200,
    adjustedDer: 1200,
    existingPantryKcal: 0,
    petName: 'Buddy',
    isTreat: false,
  };

  test('>120% of maintenance → significantly_over', () => {
    // 2 cups * 2 feedings * 400 = 1600 kcal, existing 0, total 1600/1200 = 133%
    const result = computeBudgetWarning(baseParams);
    expect(result).not.toBeNull();
    expect(result!.level).toBe('significantly_over');
    expect(result!.pct).toBe(133);
  });

  test('100-120% of maintenance → over', () => {
    // 1.5 cups * 2 feedings * 400 = 1200, existing 100 = 1300/1200 = 108%
    const result = computeBudgetWarning({ ...baseParams, servingSize: 1.5, existingPantryKcal: 100 });
    expect(result).not.toBeNull();
    expect(result!.level).toBe('over');
  });

  test('80-100% → null (no warning)', () => {
    // 1 cup * 2 feedings * 400 = 800, existing 200 = 1000/1200 = 83%
    const result = computeBudgetWarning({ ...baseParams, servingSize: 1, existingPantryKcal: 200 });
    expect(result).toBeNull();
  });

  test('<80% of adjusted → under', () => {
    // 0.5 cups * 2 feedings * 400 = 400, total = 400/1200 = 33%
    const result = computeBudgetWarning({ ...baseParams, servingSize: 0.5 });
    expect(result).not.toBeNull();
    expect(result!.level).toBe('under');
  });

  test('treats always null', () => {
    const result = computeBudgetWarning({ ...baseParams, isTreat: true });
    expect(result).toBeNull();
  });

  test('no calorie data → null', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, ga_kcal_per_kg: null, ga_protein_pct: null, ga_fat_pct: null });
    const result = computeBudgetWarning({ ...baseParams, product });
    expect(result).toBeNull();
  });
});

// ─── getSmartDefaultFeedingsPerDay ──────────────────────

describe('getSmartDefaultFeedingsPerDay', () => {
  test('treats always return 1', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.Treat, [], 'pet-1')).toBe(1);
  });

  test('no daily food in pantry → 2', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, [], 'pet-1')).toBe(2);
  });

  test('has daily food for this pet → 1', () => {
    const items = [makePantryCard()];
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, items, 'pet-1')).toBe(1);
  });

  test('empty food is ignored → 2', () => {
    const items = [makePantryCard({ is_empty: true })];
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, items, 'pet-1')).toBe(2);
  });

  test('food for other pet is ignored → 2', () => {
    const items = [makePantryCard({
      assignments: [makeAssignment({ pet_id: 'pet-2', feeding_frequency: 'daily' })],
    })];
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, items, 'pet-1')).toBe(2);
  });

  test('pancreatitis condition → 3', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, [], 'pet-1', ['pancreatitis'])).toBe(3);
  });

  test('liver condition → 4', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, [], 'pet-1', ['liver'])).toBe(4);
  });

  test('multiple conditions → highest wins', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, [], 'pet-1', ['obesity', 'liver'])).toBe(4);
  });

  test('conditions ignored for treats', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.Treat, [], 'pet-1', ['pancreatitis'])).toBe(1);
  });

  test('existing daily food overrides condition recommendation', () => {
    const items = [makePantryCard()];
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, items, 'pet-1', ['pancreatitis'])).toBe(1);
  });

  test('no matching conditions → default 2', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, [], 'pet-1', ['allergy', 'joint'])).toBe(2);
  });

  test('undefined conditions → default 2', () => {
    expect(getSmartDefaultFeedingsPerDay(Category.DailyFood, [], 'pet-1', undefined)).toBe(2);
  });
});

// ─── getConditionFeedingsPerDay ─────────────────────────

describe('getConditionFeedingsPerDay', () => {
  test('empty conditions → null', () => {
    expect(getConditionFeedingsPerDay([])).toBeNull();
  });

  test('non-feeding conditions → null', () => {
    expect(getConditionFeedingsPerDay(['allergy', 'joint', 'skin', 'cardiac'])).toBeNull();
  });

  test('single condition → its value', () => {
    expect(getConditionFeedingsPerDay(['pancreatitis'])).toBe(3);
    expect(getConditionFeedingsPerDay(['gi_sensitive'])).toBe(3);
    expect(getConditionFeedingsPerDay(['ckd'])).toBe(3);
    expect(getConditionFeedingsPerDay(['liver'])).toBe(4);
    expect(getConditionFeedingsPerDay(['diabetes'])).toBe(3);
    expect(getConditionFeedingsPerDay(['obesity'])).toBe(3);
    expect(getConditionFeedingsPerDay(['underweight'])).toBe(3);
  });

  test('multiple conditions → highest wins', () => {
    expect(getConditionFeedingsPerDay(['pancreatitis', 'liver'])).toBe(4);
    expect(getConditionFeedingsPerDay(['obesity', 'diabetes'])).toBe(3);
  });

  test('mix of feeding and non-feeding conditions', () => {
    expect(getConditionFeedingsPerDay(['allergy', 'pancreatitis', 'joint'])).toBe(3);
  });
});

// ─── getConditionFeedingAdvisory ────────────────────────

describe('getConditionFeedingAdvisory', () => {
  test('empty conditions → null', () => {
    expect(getConditionFeedingAdvisory([])).toBeNull();
  });

  test('non-feeding conditions → null', () => {
    expect(getConditionFeedingAdvisory(['allergy', 'cardiac'])).toBeNull();
  });

  test('pancreatitis → 3 meals, reason text', () => {
    const result = getConditionFeedingAdvisory(['pancreatitis']);
    expect(result).not.toBeNull();
    expect(result!.mealsPerDay).toBe(3);
    expect(result!.reason).toBe('pancreatitis');
  });

  test('obesity → 3 meals, weight management reason', () => {
    const result = getConditionFeedingAdvisory(['obesity']);
    expect(result).not.toBeNull();
    expect(result!.mealsPerDay).toBe(3);
    expect(result!.reason).toBe('weight management');
  });

  test('liver → 4 meals, liver health reason', () => {
    const result = getConditionFeedingAdvisory(['liver']);
    expect(result).not.toBeNull();
    expect(result!.mealsPerDay).toBe(4);
    expect(result!.reason).toBe('liver health');
  });

  test('multiple conditions → highest meals with its reason', () => {
    const result = getConditionFeedingAdvisory(['obesity', 'liver']);
    expect(result).not.toBeNull();
    expect(result!.mealsPerDay).toBe(4);
    expect(result!.reason).toBe('liver health');
  });
});

// ─── parseProductSize ───────────────────────────────────

describe('parseProductSize', () => {
  test('parses "15 lb Bag"', () => {
    expect(parseProductSize('Adult Chicken 15 lb Bag')).toEqual({ quantity: 15, unit: 'lbs' });
  });

  test('parses "44-lb bag"', () => {
    expect(parseProductSize('Pedigree Complete 44-lb bag')).toEqual({ quantity: 44, unit: 'lbs' });
  });

  test('parses "6.8 kg"', () => {
    expect(parseProductSize('Royal Canin 6.8 kg')).toEqual({ quantity: 6.8, unit: 'kg' });
  });

  test('parses "30-oz"', () => {
    expect(parseProductSize('Fancy Feast 30-oz can')).toEqual({ quantity: 30, unit: 'oz' });
  });

  test('parses "24 Pack"', () => {
    expect(parseProductSize('Purina Pro Plan 24 Pack')).toEqual({ quantity: 24, unit: 'units' });
  });

  test('parses "12-count"', () => {
    expect(parseProductSize('Greenies 12-count')).toEqual({ quantity: 12, unit: 'units' });
  });

  test('returns null for no pattern', () => {
    expect(parseProductSize('Chicken Recipe Adult Dog Food')).toBeNull();
  });

  test('does not match "g" in "dog"', () => {
    expect(parseProductSize('Adult Dog Food Chicken')).toBeNull();
  });
});

// ─── convertFromKg ─────────────────────────────────────

describe('convertFromKg', () => {
  test('kg → g', () => {
    expect(convertFromKg(1, 'g')).toBe(1000);
  });

  test('kg → lbs', () => {
    expect(convertFromKg(1, 'lbs')).toBeCloseTo(2.205, 2);
  });

  test('kg → oz', () => {
    expect(convertFromKg(1, 'oz')).toBeCloseTo(35.274, 2);
  });

  test('kg → kg (identity)', () => {
    expect(convertFromKg(5, 'kg')).toBe(5);
  });

  test('round-trip lbs → kg → lbs', () => {
    const original = 15;
    const kg = convertToKg(original, 'lbs');
    const back = convertFromKg(kg, 'lbs');
    expect(back).toBeCloseTo(original, 1);
  });

  test('round-trip oz → kg → oz', () => {
    const original = 240;
    const kg = convertToKg(original, 'oz');
    const back = convertFromKg(kg, 'oz');
    expect(back).toBeCloseTo(original, 1);
  });
});

// ─── convertWeightToCups ────────────────────────────────

describe('convertWeightToCups', () => {
  test('15 lbs with typical calorie values', () => {
    const cups = convertWeightToCups(15, 'lbs', 3700, 376);
    // 15 lbs = 6.8 kg → (6.8 * 3700) / 376 ≈ 66.9
    expect(cups).toBeGreaterThan(60);
    expect(cups).toBeLessThan(75);
  });

  test('returns null when kcalPerKg is null', () => {
    expect(convertWeightToCups(15, 'lbs', null, 400)).toBeNull();
  });

  test('returns null when kcalPerCup is null', () => {
    expect(convertWeightToCups(15, 'lbs', 3500, null)).toBeNull();
  });

  test('returns null when kcalPerKg is 0', () => {
    expect(convertWeightToCups(15, 'lbs', 0, 400)).toBeNull();
  });

  test('returns null when kcalPerCup is 0', () => {
    expect(convertWeightToCups(15, 'lbs', 3500, 0)).toBeNull();
  });

  test('works with kg input', () => {
    const cups = convertWeightToCups(6.8, 'kg', 3500, 400);
    // (6.8 * 3500) / 400 = 59.5
    expect(cups).toBeCloseTo(59.5, 0);
  });
});

// ─── convertWeightToServings ────────────────────────────

describe('convertWeightToServings', () => {
  test('15 lbs at 1.46 cups per serving', () => {
    // 15 lbs ≈ 66.9 cups (3700/376), / 1.46 ≈ 45.8 servings
    const servings = convertWeightToServings(15, 'lbs', 3700, 376, 1.46);
    expect(servings).toBeGreaterThan(40);
    expect(servings).toBeLessThan(50);
  });

  test('returns null when calorie data missing', () => {
    expect(convertWeightToServings(15, 'lbs', null, 376, 1.46)).toBeNull();
  });

  test('returns null when cupsPerFeeding is 0', () => {
    expect(convertWeightToServings(15, 'lbs', 3700, 376, 0)).toBeNull();
  });
});

// ─── pickBaseForSwap (M9 Phase D) ───────────────────────

describe('pickBaseForSwap', () => {
  function makeAnchor(overrides: Partial<PantryAnchor>): PantryAnchor {
    return {
      pantryItemId: 'pi-1',
      productId: 'prod-1',
      productForm: 'dry',
      feedingRole: 'base',
      resolvedScore: 60,
      ...overrides,
    };
  }

  test('returns null when there are no anchors', () => {
    expect(pickBaseForSwap([], 'dry')).toBeNull();
  });

  test('returns the sole anchor when only one exists', () => {
    const only = makeAnchor({ pantryItemId: 'pi-only', feedingRole: 'base' });
    expect(pickBaseForSwap([only], 'dry')).toBe(only);
  });

  test('prefers exact product_form match over score when forms differ', () => {
    const dry = makeAnchor({ pantryItemId: 'pi-dry', productForm: 'dry', feedingRole: 'base', resolvedScore: 85 });
    const wet = makeAnchor({ pantryItemId: 'pi-wet', productForm: 'wet', feedingRole: 'rotational', resolvedScore: 40 });
    // New product is dry, even though wet is lower-scoring
    expect(pickBaseForSwap([dry, wet], 'dry')?.pantryItemId).toBe('pi-dry');
  });

  test('falls back to lowest score when no form match exists', () => {
    const dryA = makeAnchor({ pantryItemId: 'pi-a', productForm: 'dry', feedingRole: 'base', resolvedScore: 82 });
    const dryB = makeAnchor({ pantryItemId: 'pi-b', productForm: 'dry', feedingRole: 'rotational', resolvedScore: 55 });
    // New product is wet, neither anchor matches → pick lower score
    expect(pickBaseForSwap([dryA, dryB], 'wet')?.pantryItemId).toBe('pi-b');
  });

  test('tie-breaks by score when multiple anchors match form', () => {
    const dryA = makeAnchor({ pantryItemId: 'pi-a', productForm: 'dry', feedingRole: 'base', resolvedScore: 80 });
    const dryB = makeAnchor({ pantryItemId: 'pi-b', productForm: 'dry', feedingRole: 'rotational', resolvedScore: 55 });
    expect(pickBaseForSwap([dryA, dryB], 'dry')?.pantryItemId).toBe('pi-b');
  });

  test('treats null product_form as no preference (score-based pick)', () => {
    const dryA = makeAnchor({ pantryItemId: 'pi-a', productForm: 'dry', feedingRole: 'base', resolvedScore: 75 });
    const wetB = makeAnchor({ pantryItemId: 'pi-b', productForm: 'wet', feedingRole: 'rotational', resolvedScore: 45 });
    expect(pickBaseForSwap([dryA, wetB], null)?.pantryItemId).toBe('pi-b');
  });

  test('handles null resolvedScore by treating it as 100 (unknown = not urgent)', () => {
    const unscored = makeAnchor({ pantryItemId: 'pi-a', productForm: 'dry', feedingRole: 'base', resolvedScore: null });
    const scored = makeAnchor({ pantryItemId: 'pi-b', productForm: 'dry', feedingRole: 'rotational', resolvedScore: 55 });
    expect(pickBaseForSwap([unscored, scored], 'dry')?.pantryItemId).toBe('pi-b');
  });
});

// ─── Behavioral Feeding Math (M9 Phase D) ───────────────

describe('getWetFoodKcal', () => {
  test('returns kcalPerUnit when available', () => {
    const product = makeProduct({ product_form: 'wet', kcal_per_unit: 85, ga_kcal_per_kg: null, unit_weight_g: null });
    expect(getWetFoodKcal(product)).toEqual({ kcal: 85, source: 'label' });
  });

  test('falls back to calculation when kcal_per_unit is null', () => {
    const product = makeProduct({ product_form: 'wet', kcal_per_unit: null, ga_kcal_per_kg: 1000, unit_weight_g: 85 });
    expect(getWetFoodKcal(product)).toEqual({ kcal: 85, source: 'label' });
  });

  test('uses size fallback when no calorie data exists', () => {
    const product = makeProduct({
      name: 'Wet food 3 oz can',
      product_form: 'wet',
      kcal_per_unit: null,
      ga_kcal_per_kg: null,
      unit_weight_g: null
    });
    // 3 oz = 3 * 28.3495 = 85.0485 => ~85 grams => ~85 kcal
    expect(getWetFoodKcal(product)).toEqual({ kcal: 85, source: 'size_fallback' });
  });

  test('returns null when no data and no size string', () => {
    const product = makeProduct({ name: 'Wet food can', product_form: 'wet', kcal_per_unit: null, ga_kcal_per_kg: null, unit_weight_g: null });
    expect(getWetFoodKcal(product)).toBeNull();
  });
});

describe('computeBehavioralServing', () => {
  const defaultPet = makePet(); // 50lbs dog -> ~1018 DER

  test('dry_only uses full budget', () => {
    const pet = { ...defaultPet, feeding_style: 'dry_only' as const };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    // 1018 / 400 = 2.545 cups
    expect(result?.amount).toBeCloseTo(2.545);
    expect(result?.unit).toBe('cups');
    expect(result?.basisKcal).toBe(1018);
  });

  test('dry_and_wet base deducts wet actual', () => {
    const pet = { ...defaultPet, feeding_style: 'dry_and_wet' as const, wet_reserve_kcal: 200 };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    // Wet actual is 300 (logs beat reserve) -> Budget 1018 - 300 = 718
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 300, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    expect(result?.basisKcal).toBe(718);
    expect(result?.amount).toBeCloseTo(718 / 400);
  });

  test('dry_and_wet base defaults to wet reserve when logs are 0', () => {
    const pet = { ...defaultPet, feeding_style: 'dry_and_wet' as const, wet_reserve_kcal: 200 };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    // 1018 - 200 = 818
    expect(result?.basisKcal).toBe(818);
    expect(result?.amount).toBeCloseTo(818 / 400);
  });

  test('dry_and_wet rotational uses wet reserve budget', () => {
    const pet = { ...defaultPet, feeding_style: 'dry_and_wet' as const, wet_reserve_kcal: 200 };
    const product = makeProduct({ product_form: 'wet', kcal_per_unit: 100 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'rotational', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    // Rotational budget = wet_reserve_kcal = 200, ga_kcal_per_cup = 400
    expect(result?.basisKcal).toBe(200);
    expect(result?.amount).toBeCloseTo(200 / 400);
  });

  test('wet_only uses remaining budget for all items', () => {
    const pet = { ...defaultPet, feeding_style: 'wet_only' as const };
    const product = makeProduct({ product_form: 'wet', kcal_per_unit: 100, ga_kcal_per_cup: null });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'rotational', dailyWetFedKcal: 300, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    // 1018 - 300 = 718
    expect(result?.basisKcal).toBe(718);
    expect(result?.amount).toBeCloseTo(718 / 100);
  });

  test('isInTransition still computes target serving', () => {
    const pet = { ...defaultPet, feeding_style: 'dry_only' as const };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false, isInTransition: true
    });
    // Target serving shown in Add Sheet even during transition — SS detail handles day-by-day
    expect(result).not.toBeNull();
    expect(result?.basisKcal).toBe(1018);
    expect(result?.amount).toBeCloseTo(1018 / 400);
  });

  test('custom mode uses full DER times calorie_share_pct', () => {
    const pet = { ...defaultPet, feeding_style: 'custom' as const };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    // 30% of 1018 DER = 305.4 kcal -> 305.4 / 400 = 0.7635 cups
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 30, isPremiumGoalWeight: false
    });
    expect(result?.basisKcal).toBeCloseTo(305.4);
    expect(result?.amount).toBeCloseTo(305.4 / 400);
    expect(result?.unit).toBe('cups');
  });

  test('custom mode with 100% share gets full DER', () => {
    const pet = { ...defaultPet, feeding_style: 'custom' as const };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false
    });
    expect(result?.basisKcal).toBe(1018);
    expect(result?.amount).toBeCloseTo(1018 / 400);
  });

  test('custom mode with 0% share returns 0 kcal', () => {
    const pet = { ...defaultPet, feeding_style: 'custom' as const };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 0, isPremiumGoalWeight: false
    });
    expect(result?.basisKcal).toBe(0);
    expect(result?.amount).toBe(0);
  });
});

describe('computeBehavioralBudgetWarning', () => {
  test('rotational items never warn', () => {
    const warning = computeBehavioralBudgetWarning({
      feedingRole: 'rotational', feedingStyle: 'dry_and_wet', totalBaseKcal: 2000, maintenanceDer: 1000, wetReserveKcal: 0, petName: 'Buddy'
    });
    expect(warning).toBeNull();
  });

  test('dry_only compares to full maintenance DER', () => {
    const warning = computeBehavioralBudgetWarning({
      feedingRole: 'base', feedingStyle: 'dry_only', totalBaseKcal: 1100, maintenanceDer: 1000, wetReserveKcal: 0, petName: 'Buddy'
    });
    expect(warning?.level).toBe('over');
  });

  test('dry_and_wet compares to maintenance minus reserve', () => {
    const warning = computeBehavioralBudgetWarning({
      feedingRole: 'base', feedingStyle: 'dry_and_wet', totalBaseKcal: 900, maintenanceDer: 1000, wetReserveKcal: 200, petName: 'Buddy'
    });
    // Target is 800. 900 / 800 = 112% => 'over'
    expect(warning?.level).toBe('over');
  });

  test('warns significantly_over when reserve takes whole budget', () => {
    const warning = computeBehavioralBudgetWarning({
      feedingRole: 'base', feedingStyle: 'dry_and_wet', totalBaseKcal: 100, maintenanceDer: 1000, wetReserveKcal: 1200, petName: 'Buddy'
    });
    expect(warning?.level).toBe('significantly_over');
  });
});

describe('getTodayBounds', () => {
  test('returns start at midnight and end exactly 24h later', () => {
    const bounds = getTodayBounds();
    expect(bounds.start).toBeInstanceOf(Date);
    expect(bounds.end).toBeInstanceOf(Date);
    expect(bounds.start.getHours()).toBe(0);
    expect(bounds.start.getMinutes()).toBe(0);
    expect(bounds.start.getSeconds()).toBe(0);
    expect(bounds.end.getTime() - bounds.start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

// ─── V2-4: computePerServingKcal ────────────────────────

describe('computePerServingKcal', () => {
  test('cups product uses ga_kcal_per_cup', () => {
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computePerServingKcal(product, 0.5, 'cups');
    expect(result).toEqual({ kcal: 200, source: 'label' });
  });

  test('scoops product uses ga_kcal_per_cup', () => {
    const product = makeProduct({ ga_kcal_per_cup: 300 });
    const result = computePerServingKcal(product, 2, 'scoops');
    expect(result).toEqual({ kcal: 600, source: 'label' });
  });

  test('units product with kcal_per_unit multiplies by serving_size', () => {
    const product = makeProduct({ ga_kcal_per_cup: null, kcal_per_unit: 85 });
    const result = computePerServingKcal(product, 2, 'units');
    expect(result).toEqual({ kcal: 170, source: 'label' });
  });

  test('units product derives kcal via ga_kcal_per_kg + unit_weight_g', () => {
    // No kcal_per_unit or ga_kcal_per_cup, but has ga_kcal_per_kg + unit_weight_g
    const product = makeProduct({
      ga_kcal_per_cup: null,
      kcal_per_unit: null,
      ga_kcal_per_kg: 3500,
      unit_weight_g: 85,
    });
    const result = computePerServingKcal(product, 1, 'units');
    // resolveCalories: Math.round(3500 * 85 / 1000) = 298 kcal_per_unit, source: 'label'
    expect(result).not.toBeNull();
    expect(result!.kcal).toBe(298);
    expect(result!.source).toBe('label');
  });

  test('units product falls back to size_fallback from product name', () => {
    const product = makeProduct({
      name: 'Fancy Feast 3 oz can',
      ga_kcal_per_cup: null,
      kcal_per_unit: null,
      ga_kcal_per_kg: null,
      unit_weight_g: null,
    });
    const result = computePerServingKcal(product, 1, 'units');
    // 3 oz * 28.3495 = 85 grams => ~85 kcal (1 kcal/gram wet average)
    expect(result).not.toBeNull();
    expect(result!.kcal).toBeCloseTo(85, 0);
    expect(result!.source).toBe('size_fallback');
  });

  test('returns null for zero or missing serving size', () => {
    const product = makeProduct();
    expect(computePerServingKcal(product, 0, 'cups')).toBeNull();
  });

  test('cups product with no ga_kcal_per_cup returns null', () => {
    const product = makeProduct({ ga_kcal_per_cup: null });
    expect(computePerServingKcal(product, 1, 'cups')).toBeNull();
  });

  test('bulk freeze-dried product with cups serving bypasses per-unit trap', () => {
    // Per-unit kcal would be 10000 (whole bag), but cups serving uses ga_kcal_per_cup
    const product = makeProduct({
      ga_kcal_per_cup: 300,
      kcal_per_unit: 10000,
      product_form: 'freeze_dried',
    });
    const result = computePerServingKcal(product, 0.5, 'cups');
    expect(result).toEqual({ kcal: 150, source: 'label' });
  });
});

// ─── V2-2: computeBehavioralServing custom + rotational ──

describe('computeBehavioralServing — custom mode', () => {
  const defaultPet = makePet({ weight_current_lbs: 50 }); // ~1018 DER

  test('custom base uses full DER with calorie_share_pct', () => {
    const pet = { ...defaultPet, feeding_style: 'custom' as const };
    const product = makeProduct({ ga_kcal_per_cup: 400 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'base', dailyWetFedKcal: 0, dryFoodSplitPct: 50, isPremiumGoalWeight: false,
    });
    // Custom: budgetedKcal = 1018, finalKcal = 1018 * 50/100 = 509
    expect(result).not.toBeNull();
    expect(result!.basisKcal).toBe(509);
    expect(result!.amount).toBeCloseTo(509 / 400);
  });

  test('custom rotational returns null (Fed This Today logging)', () => {
    const pet = { ...defaultPet, feeding_style: 'custom' as const };
    const product = makeProduct({ product_form: 'wet', kcal_per_unit: 100 });
    const result = computeBehavioralServing({
      pet, product, feedingRole: 'rotational', dailyWetFedKcal: 0, dryFoodSplitPct: 100, isPremiumGoalWeight: false,
    });
    expect(result).toBeNull();
  });
});


