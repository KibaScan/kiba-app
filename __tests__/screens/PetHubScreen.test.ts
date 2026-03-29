// PetHubScreen Helper Tests — M2 Session 5
// Tests exported pure helpers from PetHubScreen.
// No render tests (no @testing-library/react-native installed).

// Mock React Native, expo, navigation, and Supabase modules so the .tsx import resolves.
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  Image: 'Image',
  Modal: 'Modal',
  TextInput: 'TextInput',
  Alert: { alert: jest.fn() },
  StyleSheet: { create: (s: Record<string, unknown>) => s },
  SafeAreaView: 'SafeAreaView',
  ActivityIndicator: 'ActivityIndicator',
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
jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));
jest.mock('@react-navigation/native-stack', () => ({}));
jest.mock('react-native-purchases', () => ({
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn().mockResolvedValue({
      entitlements: { active: {} },
    }),
  },
}));
jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));
jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(false),
  shareAsync: jest.fn(),
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn(), auth: { getSession: jest.fn().mockResolvedValue({ data: { session: null } }) } },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));
jest.mock('../../src/services/petService', () => ({
  getPetConditions: jest.fn(),
  getPetAllergens: jest.fn(),
}));
jest.mock('../../src/services/appointmentService', () => ({
  getHealthRecords: jest.fn().mockResolvedValue([]),
}));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelAllScheduledNotificationsAsync: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

import {
  calculateScoreAccuracy,
  getStaleWeightMonths,
  formatStaleWeightMessage,
} from '../../src/screens/pethub/petHubHelpers';
import type { Pet } from '../../src/types/pet';

// ─── Test Fixtures ──────────────────────────────────────

function makePet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: 'pet-1',
    user_id: 'user-1',
    name: 'Buster',
    species: 'dog',
    breed: 'Labrador Retriever',
    weight_current_lbs: 50,
    weight_goal_lbs: null,
    weight_updated_at: '2025-12-01T00:00:00Z',
    date_of_birth: '2022-06-15',
    dob_is_approximate: false,
    activity_level: 'moderate',
    is_neutered: true,
    sex: 'male',
    photo_url: null,
    life_stage: 'adult',
    breed_size: 'medium',
    health_reviewed_at: '2026-01-01T00:00:00Z',
    weight_goal_level: null,
    caloric_accumulator: null,
    accumulator_last_reset_at: null,
    accumulator_notification_sent: null,
    bcs_score: null,
    bcs_assessed_at: null,
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

// ─── calculateScoreAccuracy ─────────────────────────────

describe('calculateScoreAccuracy', () => {
  test('all fields complete + health reviewed → 100%', () => {
    expect(calculateScoreAccuracy(makePet(), true)).toBe(100);
  });

  test('name + species only → 40%', () => {
    expect(
      calculateScoreAccuracy(
        makePet({
          breed: null,
          date_of_birth: null,
          weight_current_lbs: null,
        }),
        false,
      ),
    ).toBe(40);
  });

  test('missing breed → 85%', () => {
    expect(calculateScoreAccuracy(makePet({ breed: null }), true)).toBe(85);
  });

  test('missing DOB → 85%', () => {
    expect(
      calculateScoreAccuracy(makePet({ date_of_birth: null }), true),
    ).toBe(85);
  });

  test('missing weight → 85%', () => {
    expect(
      calculateScoreAccuracy(makePet({ weight_current_lbs: null }), true),
    ).toBe(85);
  });

  test('health not reviewed → 85%', () => {
    expect(calculateScoreAccuracy(makePet(), false)).toBe(85);
  });

  test('bare minimum — name + species, nothing else → 40%', () => {
    expect(
      calculateScoreAccuracy(
        makePet({
          breed: null,
          date_of_birth: null,
          weight_current_lbs: null,
        }),
        false,
      ),
    ).toBe(40);
  });

  test('all fields except conditions → 85%', () => {
    expect(calculateScoreAccuracy(makePet(), false)).toBe(85);
  });

  test('health reviewed but 0 condition rows → still 100% (Perfectly Healthy)', () => {
    // healthReviewed = true even if 0 rows stored
    expect(calculateScoreAccuracy(makePet(), true)).toBe(100);
  });

  test('missing breed + DOB → 70%', () => {
    expect(
      calculateScoreAccuracy(
        makePet({ breed: null, date_of_birth: null }),
        true,
      ),
    ).toBe(70);
  });

  test('cat with all fields → 100%', () => {
    expect(
      calculateScoreAccuracy(makePet({ species: 'cat' }), true),
    ).toBe(100);
  });

  test('only breed + weight missing from full profile → 70%', () => {
    expect(
      calculateScoreAccuracy(
        makePet({ breed: null, weight_current_lbs: null }),
        true,
      ),
    ).toBe(70);
  });
});

// ─── getStaleWeightMonths ───────────────────────────────

describe('getStaleWeightMonths', () => {
  // Use mid-month ref date to avoid timezone boundary issues
  const refDate = new Date(2026, 2, 15); // March 15, 2026 local time

  test('null → null (no weight timestamp)', () => {
    expect(getStaleWeightMonths(null, refDate)).toBeNull();
  });

  test('3 months ago → 3', () => {
    // December 15 → March 15 = 3 months
    const dec = new Date(2025, 11, 15).toISOString();
    expect(getStaleWeightMonths(dec, refDate)).toBe(3);
  });

  test('7 months ago → 7', () => {
    // August 15 → March 15 = 7 months
    const aug = new Date(2025, 7, 15).toISOString();
    expect(getStaleWeightMonths(aug, refDate)).toBe(7);
  });

  test('exactly 6 months ago → 6', () => {
    // September 15 → March 15 = 6 months
    const sep = new Date(2025, 8, 15).toISOString();
    expect(getStaleWeightMonths(sep, refDate)).toBe(6);
  });

  test('same month → 0', () => {
    const march = new Date(2026, 2, 1).toISOString();
    expect(getStaleWeightMonths(march, refDate)).toBe(0);
  });

  test('future date (defensive) → 0', () => {
    const future = new Date(2026, 5, 15).toISOString();
    expect(getStaleWeightMonths(future, refDate)).toBe(0);
  });

  test('invalid date string → null', () => {
    expect(getStaleWeightMonths('not-a-date', refDate)).toBeNull();
  });
});

// ─── formatStaleWeightMessage ───────────────────────────

describe('formatStaleWeightMessage', () => {
  test('7 months — plural', () => {
    expect(formatStaleWeightMessage(7)).toBe(
      'Weight last updated 7 months ago \u2014 still accurate?',
    );
  });

  test('1 month — singular', () => {
    expect(formatStaleWeightMessage(1)).toBe(
      'Weight last updated 1 month ago \u2014 still accurate?',
    );
  });

  test('12 months — plural', () => {
    expect(formatStaleWeightMessage(12)).toBe(
      'Weight last updated 12 months ago \u2014 still accurate?',
    );
  });
});
