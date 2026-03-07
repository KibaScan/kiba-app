// PortionCard Helper Tests — M2 Session 4
// Tests exported pure helpers from PortionCard component.
// No render tests (no @testing-library/react-native installed).

// Mock React Native and expo modules so the .tsx import resolves cleanly.
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
jest.mock('../../src/services/supabase', () => ({
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
  formatCalories,
  formatCups,
  formatGrams,
  getAgeMonths,
  shouldShowGoalWeight,
} from '../../src/components/PortionCard';

// ─── formatCalories ─────────────────────────────────────

describe('formatCalories', () => {
  test('zero', () => {
    expect(formatCalories(0)).toBe('0');
  });

  test('under 1000 — no comma', () => {
    expect(formatCalories(102)).toBe('102');
    expect(formatCalories(900)).toBe('900');
    expect(formatCalories(234)).toBe('234');
  });

  test('1000+ — comma separated', () => {
    expect(formatCalories(1021)).toBe('1,021');
    expect(formatCalories(1400)).toBe('1,400');
    expect(formatCalories(2500)).toBe('2,500');
  });

  test('rounds fractional values', () => {
    expect(formatCalories(1020.6)).toBe('1,021');
    expect(formatCalories(899.4)).toBe('899');
    expect(formatCalories(999.5)).toBe('1,000');
  });

  test('small values', () => {
    expect(formatCalories(1)).toBe('1');
    expect(formatCalories(22)).toBe('22');
  });
});

// ─── formatCups ─────────────────────────────────────────

describe('formatCups', () => {
  test('one decimal place', () => {
    expect(formatCups(2.5)).toBe('2.5');
    expect(formatCups(1.0)).toBe('1.0');
    expect(formatCups(3.14159)).toBe('3.1');
  });

  test('rounds correctly', () => {
    expect(formatCups(2.75)).toBe('2.8');
    expect(formatCups(1.05)).toBe('1.1');
    expect(formatCups(1.04)).toBe('1.0');
  });
});

// ─── formatGrams ────────────────────────────────────────

describe('formatGrams', () => {
  test('rounds to integer', () => {
    expect(formatGrams(285.3)).toBe('285');
    expect(formatGrams(100.7)).toBe('101');
    expect(formatGrams(50)).toBe('50');
  });

  test('zero', () => {
    expect(formatGrams(0)).toBe('0');
  });
});

// ─── getAgeMonths ───────────────────────────────────────

describe('getAgeMonths', () => {
  test('null DOB returns undefined', () => {
    expect(getAgeMonths(null)).toBeUndefined();
  });

  test('invalid date string returns undefined', () => {
    expect(getAgeMonths('not-a-date')).toBeUndefined();
  });

  test('calculates months correctly', () => {
    const now = new Date(2026, 2, 1); // March 1, 2026
    // Born Jan 1, 2024 → 26 months
    expect(getAgeMonths('2024-01-01', now)).toBe(26);
    // Born March 1, 2025 → 12 months
    expect(getAgeMonths('2025-03-01', now)).toBe(12);
    // Born same month → 0 months
    expect(getAgeMonths('2026-03-15', now)).toBe(0);
  });

  test('puppy age: born Nov 2025 → 4 months at March 2026', () => {
    const now = new Date(2026, 2, 1);
    expect(getAgeMonths('2025-11-01', now)).toBe(4);
  });

  test('geriatric cat: born March 2012 → 168 months at March 2026', () => {
    const now = new Date(2026, 2, 1);
    expect(getAgeMonths('2012-03-01', now)).toBe(168);
  });
});

// ─── shouldShowGoalWeight ───────────────────────────────

describe('shouldShowGoalWeight', () => {
  test('all conditions met → true', () => {
    expect(shouldShowGoalWeight(42, 50, ['obesity'], true)).toBe(true);
    expect(shouldShowGoalWeight(15, 10, ['underweight'], true)).toBe(true);
  });

  test('not premium → false', () => {
    expect(shouldShowGoalWeight(42, 50, ['obesity'], false)).toBe(false);
  });

  test('no goal weight → false', () => {
    expect(shouldShowGoalWeight(null, 50, ['obesity'], true)).toBe(false);
  });

  test('no current weight → false', () => {
    expect(shouldShowGoalWeight(42, null, ['obesity'], true)).toBe(false);
  });

  test('no obesity/underweight condition → false', () => {
    expect(shouldShowGoalWeight(42, 50, ['diabetes', 'allergy'], true)).toBe(false);
    expect(shouldShowGoalWeight(42, 50, [], true)).toBe(false);
  });

  test('underweight condition works too', () => {
    expect(shouldShowGoalWeight(55, 50, ['underweight'], true)).toBe(true);
  });

  test('multiple conditions including obesity → true', () => {
    expect(shouldShowGoalWeight(42, 50, ['diabetes', 'obesity', 'allergy'], true)).toBe(true);
  });
});
