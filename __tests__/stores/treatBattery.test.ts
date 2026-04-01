// Kiba — Treat Battery Store + Helper Tests (M5)
// Tests: resolveTreatKcal, daily reset, addTreatConsumption, logTreat integration.

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn() } },
}));
jest.mock('../../src/services/pantryService', () => ({
  getPantryForPet: jest.fn().mockResolvedValue([]),
  addToPantry: jest.fn().mockResolvedValue(undefined),
  removePantryItem: jest.fn().mockResolvedValue(undefined),
  restockPantryItem: jest.fn().mockResolvedValue(undefined),
  updatePantryItem: jest.fn().mockResolvedValue(undefined),
  sharePantryItem: jest.fn().mockResolvedValue(undefined),
  evaluateDietCompleteness: jest.fn().mockResolvedValue({ status: 'empty', message: null }),
}));
jest.mock('../../src/services/feedingNotificationScheduler', () => ({
  rescheduleAllFeeding: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

import { resolveTreatKcal, getTodayStr } from '../../src/stores/useTreatBatteryStore';
import type { PantryCardData } from '../../src/types/pantry';

// ─── resolveTreatKcal ──────────────────────────────────

describe('resolveTreatKcal', () => {
  test('returns kcal_per_unit when available', () => {
    expect(resolveTreatKcal({
      kcal_per_unit: 25,
      ga_kcal_per_kg: 3500,
      unit_weight_g: 10,
    })).toBe(25);
  });

  test('derives from kcal_per_kg + unit_weight_g when kcal_per_unit is null', () => {
    expect(resolveTreatKcal({
      kcal_per_unit: null,
      ga_kcal_per_kg: 3500,
      unit_weight_g: 10,
    })).toBe(35);
  });

  test('returns null when no calorie data available', () => {
    expect(resolveTreatKcal({
      kcal_per_unit: null,
      ga_kcal_per_kg: null,
      unit_weight_g: null,
    })).toBeNull();
  });

  test('returns null when kcal_per_unit is 0', () => {
    expect(resolveTreatKcal({
      kcal_per_unit: 0,
      ga_kcal_per_kg: null,
      unit_weight_g: null,
    })).toBeNull();
  });

  test('returns null when unit_weight_g is missing for derivation', () => {
    expect(resolveTreatKcal({
      kcal_per_unit: null,
      ga_kcal_per_kg: 3500,
      unit_weight_g: null,
    })).toBeNull();
  });

  test('rounds derived value', () => {
    // 3333 * 7 / 1000 = 23.331 → 23
    expect(resolveTreatKcal({
      kcal_per_unit: null,
      ga_kcal_per_kg: 3333,
      unit_weight_g: 7,
    })).toBe(23);
  });
});

// ─── getTodayStr ────────────────────────────────────────

describe('getTodayStr', () => {
  test('returns YYYY-MM-DD format', () => {
    const today = getTodayStr();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ─── useTreatBatteryStore (in-memory via Zustand) ───────

describe('useTreatBatteryStore', () => {
  // Import dynamically to use the mocked AsyncStorage
  let useTreatBatteryStore: typeof import('../../src/stores/useTreatBatteryStore').useTreatBatteryStore;

  beforeAll(() => {
    useTreatBatteryStore = require('../../src/stores/useTreatBatteryStore').useTreatBatteryStore;
  });

  beforeEach(() => {
    // Reset store state directly via internal API (skips persist)
    useTreatBatteryStore.setState(
      { consumedByPet: {}, lastResetDate: getTodayStr() },
    );
  });

  test('addTreatConsumption tracks kcal and count', () => {
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 25);
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 25);

    const state = useTreatBatteryStore.getState();
    expect(state.consumedByPet['pet-1']).toEqual({ kcal: 50, count: 2 });
  });

  test('addTreatConsumption with null kcal increments count only', () => {
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', null);

    const state = useTreatBatteryStore.getState();
    expect(state.consumedByPet['pet-1']).toEqual({ kcal: 0, count: 1 });
  });

  test('addTreatConsumption tracks multiple pets independently', () => {
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 25);
    useTreatBatteryStore.getState().addTreatConsumption('pet-2', 40);

    const state = useTreatBatteryStore.getState();
    expect(state.consumedByPet['pet-1']).toEqual({ kcal: 25, count: 1 });
    expect(state.consumedByPet['pet-2']).toEqual({ kcal: 40, count: 1 });
  });

  test('resetIfNewDay clears consumption when date changes', () => {
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 50);

    // Simulate yesterday
    useTreatBatteryStore.setState({ lastResetDate: '2020-01-01' });

    useTreatBatteryStore.getState().resetIfNewDay();
    const state = useTreatBatteryStore.getState();
    expect(state.consumedByPet).toEqual({});
    expect(state.lastResetDate).toBe(getTodayStr());
  });

  test('resetIfNewDay does nothing when same day', () => {
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 50);

    useTreatBatteryStore.getState().resetIfNewDay();
    const state = useTreatBatteryStore.getState();
    expect(state.consumedByPet['pet-1']).toEqual({ kcal: 50, count: 1 });
  });

  test('addTreatConsumption auto-resets if date changed', () => {
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 100);

    // Simulate yesterday
    useTreatBatteryStore.setState({ lastResetDate: '2020-01-01' });

    // New treat today should reset old data
    useTreatBatteryStore.getState().addTreatConsumption('pet-1', 25);
    const state = useTreatBatteryStore.getState();
    expect(state.consumedByPet['pet-1']).toEqual({ kcal: 25, count: 1 });
  });
});

// ─── logTreat (usePantryStore integration) ──────────────

function makeTreatItem(overrides: Partial<PantryCardData> = {}): PantryCardData {
  return {
    id: 'item-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity_original: 20,
    quantity_remaining: 10,
    quantity_unit: 'units',
    serving_mode: 'unit',
    unit_label: 'servings',
    added_at: '2026-01-01',
    is_active: true,
    last_deducted_at: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    product: {
      name: 'Greenies Dental Treats',
      brand: 'Greenies',
      image_url: null,
      product_form: null,
      is_supplemental: false,
      is_recalled: false,
      is_vet_diet: false,
      target_species: 'dog',
      category: 'treat',
      base_score: 45,
      ga_kcal_per_cup: null,
      ga_kcal_per_kg: 3200,
      kcal_per_unit: 25,
      unit_weight_g: 8,
      aafco_statement: null,
      life_stage_claim: null,
      source_url: null,
      chewy_sku: null,
      asin: null,
      affiliate_links: null,
      price: null,
    },
    assignments: [{
      id: 'assign-1',
      pantry_item_id: 'item-1',
      pet_id: 'pet-1',
      serving_size: 1,
      serving_size_unit: 'units',
      feedings_per_day: 1,
      feeding_frequency: 'as_needed',
      feeding_times: null,
      notifications_on: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    }],
    days_remaining: null,
    is_low_stock: false,
    is_empty: false,
    calorie_context: null,
    resolved_score: null,
    ...overrides,
  };
}

describe('logTreat (pantry store)', () => {
  let usePantryStore: typeof import('../../src/stores/usePantryStore').usePantryStore;
  let useTreatBatteryStore: typeof import('../../src/stores/useTreatBatteryStore').useTreatBatteryStore;

  beforeAll(() => {
    usePantryStore = require('../../src/stores/usePantryStore').usePantryStore;
    useTreatBatteryStore = require('../../src/stores/useTreatBatteryStore').useTreatBatteryStore;
  });

  beforeEach(() => {
    useTreatBatteryStore.setState(
      { consumedByPet: {}, lastResetDate: getTodayStr() },
    );
    usePantryStore.setState({
      items: [makeTreatItem()],
      dietStatus: null,
      loading: false,
      error: null,
      _petId: 'pet-1',
    });
  });

  test('deducts 1 from quantity_remaining', async () => {
    await usePantryStore.getState().logTreat('item-1', 'pet-1');

    const item = usePantryStore.getState().items[0];
    expect(item.quantity_remaining).toBe(9);
    expect(item.is_empty).toBe(false);
  });

  test('resolves kcal and updates treat battery', async () => {
    await usePantryStore.getState().logTreat('item-1', 'pet-1');

    const battery = useTreatBatteryStore.getState();
    expect(battery.consumedByPet['pet-1']).toEqual({ kcal: 25, count: 1 });
  });

  test('sets is_empty when quantity reaches 0', async () => {
    usePantryStore.setState({
      items: [makeTreatItem({ quantity_remaining: 1 })],
    });

    await usePantryStore.getState().logTreat('item-1', 'pet-1');

    const item = usePantryStore.getState().items[0];
    expect(item.quantity_remaining).toBe(0);
    expect(item.is_empty).toBe(true);
  });

  test('sets is_low_stock when quantity <= 5', async () => {
    usePantryStore.setState({
      items: [makeTreatItem({ quantity_remaining: 6 })],
    });

    await usePantryStore.getState().logTreat('item-1', 'pet-1');

    const item = usePantryStore.getState().items[0];
    expect(item.quantity_remaining).toBe(5);
    expect(item.is_low_stock).toBe(true);
  });

  test('skips kcal when product has no calorie data', async () => {
    usePantryStore.setState({
      items: [makeTreatItem({
        product: {
          ...makeTreatItem().product,
          kcal_per_unit: null,
          ga_kcal_per_kg: null,
          unit_weight_g: null,
        },
      })],
    });

    await usePantryStore.getState().logTreat('item-1', 'pet-1');

    const battery = useTreatBatteryStore.getState();
    expect(battery.consumedByPet['pet-1']).toEqual({ kcal: 0, count: 1 });
  });

  test('does nothing for empty items', async () => {
    usePantryStore.setState({
      items: [makeTreatItem({ quantity_remaining: 0, is_empty: true })],
    });

    await usePantryStore.getState().logTreat('item-1', 'pet-1');

    const item = usePantryStore.getState().items[0];
    expect(item.quantity_remaining).toBe(0);
    expect(useTreatBatteryStore.getState().consumedByPet).toEqual({});
  });

  test('does nothing for non-existent item', async () => {
    await usePantryStore.getState().logTreat('nonexistent', 'pet-1');
    expect(useTreatBatteryStore.getState().consumedByPet).toEqual({});
  });
});
