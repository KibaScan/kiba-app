// PantryScreen Helper Tests — M5
// Tests exported pure helpers from PantryScreen.
// No render tests (no @testing-library/react-native installed).

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  Image: 'Image',
  Modal: 'Modal',
  Pressable: 'Pressable',
  Alert: { alert: jest.fn() },
  StyleSheet: { create: (s: Record<string, unknown>) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  SafeAreaView: 'SafeAreaView',
  ActivityIndicator: 'ActivityIndicator',
  RefreshControl: 'RefreshControl',
  Platform: { OS: 'ios' },
}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));
jest.mock('@react-navigation/native', () => ({ useFocusEffect: jest.fn() }));
jest.mock('@react-navigation/native-stack', () => ({}));
jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({ entitlements: { active: {} } }),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

import {
  filterItems,
  sortItems,
  shouldShowD157Nudge,
  getDietBannerConfig,
} from '../../src/screens/PantryScreen';
import type { PantryCardData, DietCompletenessResult } from '../../src/types/pantry';

// ─── Test Fixture ───────────────────────────────────────

function makeItem(overrides: Record<string, unknown> = {}): PantryCardData {
  const { product: productOverrides, ...rest } = overrides as { product?: Record<string, unknown> };
  return {
    id: 'item-1',
    user_id: 'user-1',
    product_id: 'prod-1',
    quantity_original: 25,
    quantity_remaining: 20,
    quantity_unit: 'lbs',
    serving_mode: 'weight',
    unit_label: null,
    added_at: '2026-03-01T00:00:00Z',
    is_active: true,
    last_deducted_at: null,
    created_at: '2026-03-01T00:00:00Z',
    updated_at: '2026-03-01T00:00:00Z',
    product: {
      name: 'Adult Chicken & Rice',
      brand: 'Pure Balance',
      image_url: null,
      product_form: 'dry',
      is_supplemental: false,
      is_recalled: false,
      is_vet_diet: false,
      target_species: 'dog',
      category: 'daily_food',
      base_score: 62,
      ga_kcal_per_cup: 350,
      ga_kcal_per_kg: null,
      kcal_per_unit: null,
      unit_weight_g: null,
      aafco_statement: 'Complete and balanced',
      life_stage_claim: 'adult',
      ...productOverrides,
    },
    assignments: [{
      id: 'assign-1',
      pantry_item_id: 'item-1',
      pet_id: 'pet-1',
      serving_size: 1.5,
      serving_size_unit: 'cups',
      feedings_per_day: 2,
      feeding_frequency: 'daily',
      feeding_times: null,
      notifications_on: false,
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-01T00:00:00Z',
    }],
    days_remaining: 15,
    is_low_stock: false,
    is_empty: false,
    calorie_context: null,
    ...rest,
  } as PantryCardData;
}

// ─── filterItems ────────────────────────────────────────

describe('filterItems', () => {
  const dryFood = makeItem({ id: 'dry-1', product: { product_form: 'dry', category: 'daily_food' } });
  const wetFood = makeItem({ id: 'wet-1', product: { product_form: 'wet', category: 'daily_food' } });
  const treat = makeItem({ id: 'treat-1', product: { category: 'treat', product_form: null } });
  const supplement = makeItem({ id: 'supp-1', product: { is_supplemental: true, category: 'daily_food', product_form: null } });
  const recalled = makeItem({ id: 'recall-1', product: { is_recalled: true, product_form: 'dry' } });
  const lowStock = makeItem({ id: 'low-1', is_low_stock: true, is_empty: false });
  const emptyItem = makeItem({ id: 'empty-1', is_low_stock: true, is_empty: true });
  const all = [dryFood, wetFood, treat, supplement, recalled, lowStock, emptyItem];

  test('"all" returns all items', () => {
    expect(filterItems(all, 'all')).toEqual(all);
  });

  test('"dry" returns only dry items', () => {
    const result = filterItems(all, 'dry');
    expect(result.map(i => i.id)).toEqual(['dry-1', 'recall-1', 'low-1', 'empty-1']);
  });

  test('"wet" returns only wet items', () => {
    const result = filterItems(all, 'wet');
    expect(result.map(i => i.id)).toEqual(['wet-1']);
  });

  test('"treats" returns only treat items', () => {
    const result = filterItems(all, 'treats');
    expect(result.map(i => i.id)).toEqual(['treat-1']);
  });

  test('"supplemental" returns only supplemental items', () => {
    const result = filterItems(all, 'supplemental');
    expect(result.map(i => i.id)).toEqual(['supp-1']);
  });

  test('"recalled" returns only recalled items', () => {
    const result = filterItems(all, 'recalled');
    expect(result.map(i => i.id)).toEqual(['recall-1']);
  });

  test('"running_low" returns low stock non-empty items', () => {
    const result = filterItems(all, 'running_low');
    expect(result.map(i => i.id)).toEqual(['low-1']);
  });

  test('"running_low" excludes empty items', () => {
    const result = filterItems([emptyItem], 'running_low');
    expect(result).toEqual([]);
  });

  test('empty input returns empty array', () => {
    expect(filterItems([], 'dry')).toEqual([]);
  });

  test('recalled dry food appears under "recalled" (cross-category)', () => {
    const result = filterItems([recalled], 'recalled');
    expect(result).toHaveLength(1);
    expect(result[0].product.product_form).toBe('dry');
  });
});

// ─── sortItems ──────────────────────────────────────────

describe('sortItems', () => {
  const itemA = makeItem({ id: 'a', product: { name: 'Alpha', base_score: 80 }, days_remaining: 10 });
  const itemB = makeItem({ id: 'b', product: { name: 'Bravo', base_score: 50 }, days_remaining: 3 });
  const itemC = makeItem({ id: 'c', product: { name: 'Charlie', base_score: null }, days_remaining: null });

  test('"default" preserves original order', () => {
    const input = [itemB, itemA, itemC];
    expect(sortItems(input, 'default')).toBe(input);
  });

  test('"name" sorts alphabetically', () => {
    const result = sortItems([itemC, itemA, itemB], 'name');
    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('"score" sorts descending, null scores last', () => {
    const result = sortItems([itemC, itemB, itemA], 'score');
    expect(result.map(i => i.id)).toEqual(['a', 'b', 'c']);
  });

  test('"days_remaining" sorts ascending, null last', () => {
    const result = sortItems([itemA, itemC, itemB], 'days_remaining');
    expect(result.map(i => i.id)).toEqual(['b', 'a', 'c']);
  });

  test('does not mutate original array', () => {
    const input = [itemB, itemA];
    const result = sortItems(input, 'name');
    expect(result).not.toBe(input);
    expect(input.map(i => i.id)).toEqual(['b', 'a']);
  });

  test('single item returns unchanged', () => {
    const result = sortItems([itemA], 'score');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  test('empty array returns empty', () => {
    expect(sortItems([], 'name')).toEqual([]);
  });

  test('equal scores maintain relative order', () => {
    const x = makeItem({ id: 'x', product: { name: 'X', base_score: 70 } });
    const y = makeItem({ id: 'y', product: { name: 'Y', base_score: 70 } });
    const result = sortItems([x, y], 'score');
    expect(result.map(i => i.id)).toEqual(['x', 'y']);
  });
});

// ─── shouldShowD157Nudge ────────────────────────────────

describe('shouldShowD157Nudge', () => {
  const petId = 'pet-1';

  const dailyFood = makeItem({
    id: 'daily-1',
    product: { category: 'daily_food' },
    assignments: [{
      id: 'a1', pantry_item_id: 'daily-1', pet_id: petId,
      serving_size: 1.5, serving_size_unit: 'cups', feedings_per_day: 2,
      feeding_frequency: 'daily', feeding_times: null, notifications_on: false,
      created_at: '', updated_at: '',
    }],
  });

  const otherDailyFood = makeItem({
    id: 'daily-2',
    product: { category: 'daily_food', name: 'Other Food' },
    assignments: [{
      id: 'a2', pantry_item_id: 'daily-2', pet_id: petId,
      serving_size: 1, serving_size_unit: 'cups', feedings_per_day: 2,
      feeding_frequency: 'daily', feeding_times: null, notifications_on: false,
      created_at: '', updated_at: '',
    }],
  });

  test('true: daily food removed with remaining daily food for same pet', () => {
    expect(shouldShowD157Nudge(dailyFood, [otherDailyFood], petId)).toBe(true);
  });

  test('false: removed item is a treat', () => {
    const treat = makeItem({ product: { category: 'treat' } });
    expect(shouldShowD157Nudge(treat, [otherDailyFood], petId)).toBe(false);
  });

  test('false: removed item is supplemental category', () => {
    const supp = makeItem({ product: { category: 'supplement' } });
    expect(shouldShowD157Nudge(supp, [otherDailyFood], petId)).toBe(false);
  });

  test('false: no remaining daily food for this pet', () => {
    expect(shouldShowD157Nudge(dailyFood, [], petId)).toBe(false);
  });

  test('false: removed assignment was as_needed', () => {
    const asNeeded = makeItem({
      product: { category: 'daily_food' },
      assignments: [{
        id: 'an1', pantry_item_id: 'x', pet_id: petId,
        serving_size: 1, serving_size_unit: 'cups', feedings_per_day: 1,
        feeding_frequency: 'as_needed', feeding_times: null, notifications_on: false,
        created_at: '', updated_at: '',
      }],
    });
    expect(shouldShowD157Nudge(asNeeded, [otherDailyFood], petId)).toBe(false);
  });

  test('false: remaining daily food belongs to different pet', () => {
    const otherPetFood = makeItem({
      id: 'other-pet',
      product: { category: 'daily_food' },
      assignments: [{
        id: 'op1', pantry_item_id: 'other-pet', pet_id: 'pet-2',
        serving_size: 1, serving_size_unit: 'cups', feedings_per_day: 2,
        feeding_frequency: 'daily', feeding_times: null, notifications_on: false,
        created_at: '', updated_at: '',
      }],
    });
    expect(shouldShowD157Nudge(dailyFood, [otherPetFood], petId)).toBe(false);
  });

  test('false: empty remaining items', () => {
    expect(shouldShowD157Nudge(dailyFood, [], petId)).toBe(false);
  });
});

// ─── getDietBannerConfig ────────────────────────────────

describe('getDietBannerConfig', () => {
  test('null input returns null', () => {
    expect(getDietBannerConfig(null)).toBeNull();
  });

  test('"complete" returns null', () => {
    expect(getDietBannerConfig({ status: 'complete', message: null })).toBeNull();
  });

  test('"empty" returns null', () => {
    expect(getDietBannerConfig({ status: 'empty', message: null })).toBeNull();
  });

  test('"amber_warning" returns amber config', () => {
    const msg = "Luna's diet may be missing essential nutrients.";
    const result = getDietBannerConfig({ status: 'amber_warning', message: msg });
    expect(result).not.toBeNull();
    expect(result!.show).toBe(true);
    expect(result!.message).toBe(msg);
    // Amber color = #F59E0B (Colors.severityAmber)
    expect(result!.color).toBe('#F59E0B');
  });

  test('"red_warning" returns red config', () => {
    const msg = "No complete meals found in Luna's diet.";
    const result = getDietBannerConfig({ status: 'red_warning', message: msg });
    expect(result).not.toBeNull();
    expect(result!.show).toBe(true);
    expect(result!.message).toBe(msg);
    // Red color = #EF4444 (Colors.severityRed)
    expect(result!.color).toBe('#EF4444');
  });
});
