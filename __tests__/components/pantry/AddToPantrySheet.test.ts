// AddToPantrySheet Helper Tests — M5 Session 2
// Tests exported pure helpers from AddToPantrySheet component.
// No render tests (no @testing-library/react-native installed).

jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
  },
}));
jest.mock('react-native-url-polyfill/auto', () => ({}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock('../../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: { getUser: jest.fn().mockResolvedValue({ data: null }) },
  },
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: 'Ionicons' }));

import {
  isTreat,
  getDefaultFeedingsPerDay,
  getDefaultFeedingFrequency,
  isFormValid,
  buildAddToPantryInput,
} from '../../../src/components/pantry/AddToPantrySheet';
import { Category } from '../../../src/types';

// ─── isTreat ────────────────────────────────────────────

describe('isTreat', () => {
  test('true for Treat', () => {
    expect(isTreat(Category.Treat)).toBe(true);
  });

  test('false for DailyFood', () => {
    expect(isTreat(Category.DailyFood)).toBe(false);
  });

  test('true for Supplement', () => {
    expect(isTreat(Category.Supplement)).toBe(true);
  });
});

// ─── getDefaultFeedingsPerDay ───────────────────────────

describe('getDefaultFeedingsPerDay', () => {
  test('returns 1 for daily food (legacy, unused in behavioral)', () => {
    expect(getDefaultFeedingsPerDay(Category.DailyFood)).toBe(1);
  });

  test('returns 1 for supplement', () => {
    expect(getDefaultFeedingsPerDay(Category.Supplement)).toBe(1);
  });

  test('returns 1 for treat', () => {
    expect(getDefaultFeedingsPerDay(Category.Treat)).toBe(1);
  });
});

// ─── getDefaultFeedingFrequency ─────────────────────────

describe('getDefaultFeedingFrequency', () => {
  test('returns daily for daily food', () => {
    expect(getDefaultFeedingFrequency(Category.DailyFood)).toBe('daily');
  });

  test('returns as_needed for supplement', () => {
    expect(getDefaultFeedingFrequency(Category.Supplement)).toBe('as_needed');
  });

  test('returns as_needed for treat', () => {
    expect(getDefaultFeedingFrequency(Category.Treat)).toBe('as_needed');
  });
});

// ─── isFormValid ────────────────────────────────────────

describe('isFormValid', () => {
  test('valid when quantity > 0 and serving > 0', () => {
    expect(isFormValid('10', 1.5)).toBe(true);
  });

  test('valid for decimal quantity', () => {
    expect(isFormValid('2.5', 0.5)).toBe(true);
  });

  test('false when quantity is 0', () => {
    expect(isFormValid('0', 1)).toBe(false);
  });

  test('false when quantity is empty string', () => {
    expect(isFormValid('', 1)).toBe(false);
  });

  test('false when quantity is NaN', () => {
    expect(isFormValid('abc', 1)).toBe(false);
  });

  test('false when serving is 0', () => {
    expect(isFormValid('10', 0)).toBe(false);
  });

  test('false when serving is negative', () => {
    expect(isFormValid('10', -1)).toBe(false);
  });
});

// ─── buildAddToPantryInput ──────────────────────────────

describe('buildAddToPantryInput', () => {
  test('weight mode — correct shape', () => {
    const input = buildAddToPantryInput({
      productId: 'prod-1',
      quantityValue: '25',
      quantityUnit: 'lbs',
      servingMode: 'weight',
      servingSize: 1.5,
      servingSizeUnit: 'cups',
      feedingsPerDay: 2,
      feedingFrequency: 'daily',
    });

    expect(input).toEqual({
      product_id: 'prod-1',
      quantity_original: 25,
      quantity_unit: 'lbs',
      serving_mode: 'weight',
      serving_size: 1.5,
      serving_size_unit: 'cups',
      feedings_per_day: 2,
      feeding_frequency: 'daily',
    });
    // unit_label should NOT be present in weight mode
    expect(input).not.toHaveProperty('unit_label');
  });

  test('unit mode — always uses servings (D-164)', () => {
    const input = buildAddToPantryInput({
      productId: 'prod-2',
      quantityValue: '24',
      quantityUnit: 'units',
      servingMode: 'unit',
      servingSize: 0.5,
      servingSizeUnit: 'units',
      feedingsPerDay: 2,
      feedingFrequency: 'daily',
    });

    expect(input).toEqual({
      product_id: 'prod-2',
      quantity_original: 24,
      quantity_unit: 'units',
      serving_mode: 'unit',
      unit_label: 'servings',
      serving_size: 0.5,
      serving_size_unit: 'units',
      feedings_per_day: 2,
      feeding_frequency: 'daily',
    });
  });

  test('treats set as_needed frequency', () => {
    const input = buildAddToPantryInput({
      productId: 'prod-4',
      quantityValue: '30',
      quantityUnit: 'units',
      servingMode: 'unit',
      servingSize: 1,
      servingSizeUnit: 'units',
      feedingsPerDay: 1,
      feedingFrequency: 'as_needed',
    });

    expect(input.feeding_frequency).toBe('as_needed');
    expect(input.feedings_per_day).toBe(1);
  });

  test('parses decimal quantity value', () => {
    const input = buildAddToPantryInput({
      productId: 'prod-5',
      quantityValue: '4.5',
      quantityUnit: 'kg',
      servingMode: 'weight',
      servingSize: 2,
      servingSizeUnit: 'cups',
      feedingsPerDay: 2,
      feedingFrequency: 'daily',
    });

    expect(input.quantity_original).toBe(4.5);
    expect(input.quantity_unit).toBe('kg');
  });
});
