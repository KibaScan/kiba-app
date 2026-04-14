// FedThisTodaySheet Pure Helpers — Unit tests for singularize + resolveDisplayUnit.
// Component-body rendering is not tested here; those helpers cover the logic the component wires in.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { singularize, resolveDisplayUnit } from '../../src/components/pantry/FedThisTodaySheet';
import type { PantryItem, PantryPetAssignment } from '../../src/types/pantry';
import type { Product } from '../../src/types';
import { Category, Species } from '../../src/types';

// ─── Factories (local, matching pantryHelpers.test.ts shape) ────────────

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

function makePantryItem(overrides: Partial<PantryItem> = {}): PantryItem {
  return {
    id: 'item-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity_original: 15,
    quantity_remaining: 15,
    quantity_unit: 'lbs',
    serving_mode: 'weight',
    unit_label: null,
    added_at: '2026-01-01T00:00:00Z',
    is_active: true,
    last_deducted_at: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── singularize ────────────────────────────────────────

describe('singularize', () => {
  test('cups → cup', () => {
    expect(singularize('cups')).toBe('cup');
  });

  test('scoops → scoop', () => {
    expect(singularize('scoops')).toBe('scoop');
  });

  test('cans/pouches → can/pouch', () => {
    expect(singularize('cans/pouches')).toBe('can/pouch');
  });

  test('pouches → pouch', () => {
    expect(singularize('pouches')).toBe('pouch');
  });

  test('units → unit', () => {
    expect(singularize('units')).toBe('unit');
  });

  test('servings → serving', () => {
    expect(singularize('servings')).toBe('serving');
  });

  test('already singular → unchanged', () => {
    expect(singularize('cup')).toBe('cup');
    expect(singularize('can/pouch')).toBe('can/pouch');
  });
});

// ─── resolveDisplayUnit ─────────────────────────────────

describe('resolveDisplayUnit', () => {
  test('assignment.serving_size_unit = cups → cups', () => {
    const assignment = makeAssignment({ serving_size_unit: 'cups' });
    const item = makePantryItem({ quantity_unit: 'lbs' });
    const product = makeProduct({ product_form: 'dry' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('cups');
  });

  test('assignment.serving_size_unit = scoops → scoops', () => {
    const assignment = makeAssignment({ serving_size_unit: 'scoops' });
    const item = makePantryItem({ quantity_unit: 'lbs' });
    const product = makeProduct({ product_form: 'dry' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('scoops');
  });

  test('assignment.serving_size_unit = units with unit_label = servings → servings', () => {
    const assignment = makeAssignment({ serving_size_unit: 'units' });
    const item = makePantryItem({ quantity_unit: 'units', unit_label: 'servings' });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('servings');
  });

  test('assignment.serving_size_unit = units, no unit_label → servings default', () => {
    const assignment = makeAssignment({ serving_size_unit: 'units' });
    const item = makePantryItem({ quantity_unit: 'units', unit_label: null });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(assignment, item, product)).toBe('servings');
  });

  test('no assignment, dry product → cups fallback', () => {
    const item = makePantryItem({ quantity_unit: 'lbs' });
    const product = makeProduct({ product_form: 'dry' });
    expect(resolveDisplayUnit(null, item, product)).toBe('cups');
  });

  test('no assignment, wet product with unit_label = servings → servings', () => {
    const item = makePantryItem({ quantity_unit: 'units', unit_label: 'servings' });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(null, item, product)).toBe('servings');
  });

  test('no assignment, wet product without unit_label → servings default', () => {
    const item = makePantryItem({ quantity_unit: 'units', unit_label: null });
    const product = makeProduct({ product_form: 'wet' });
    expect(resolveDisplayUnit(null, item, product)).toBe('servings');
  });

  test('everything null → servings default (safe fallback)', () => {
    expect(resolveDisplayUnit(null, null, null)).toBe('servings');
  });
});
