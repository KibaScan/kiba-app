// TreatQuickPickerSheet — D-124 Revised: Pure helper tests.
// No render tests (@testing-library/react-native not installed).

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

import { servingsLabel } from '../../../src/components/treats/TreatQuickPickerSheet';

// ─── servingsLabel ──────────────────────────────────────

describe('servingsLabel', () => {
  test('returns "Empty" with tertiary color for 0', () => {
    const result = servingsLabel(0);
    expect(result.text).toBe('Empty');
  });

  test('returns "Empty" for negative quantity', () => {
    const result = servingsLabel(-1);
    expect(result.text).toBe('Empty');
  });

  test('returns amber color for low stock (1-3)', () => {
    const r1 = servingsLabel(1);
    expect(r1.text).toBe('1 servings left');
    expect(r1.color).toBe('#F59E0B');

    const r3 = servingsLabel(3);
    expect(r3.text).toBe('3 servings left');
    expect(r3.color).toBe('#F59E0B');
  });

  test('returns normal color for adequate stock (>3)', () => {
    const r4 = servingsLabel(4);
    expect(r4.text).toBe('4 servings left');
    expect(r4.color).not.toBe('#F59E0B');

    const r12 = servingsLabel(12);
    expect(r12.text).toBe('12 servings left');
  });
});
