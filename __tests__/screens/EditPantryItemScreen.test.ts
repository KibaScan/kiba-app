// EditPantryItemScreen Helper Tests — M5
// Tests exported pure helpers from EditPantryItemScreen.
// No render tests (no @testing-library/react-native installed).

jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  TextInput: 'TextInput',
  Image: 'Image',
  Modal: 'Modal',
  Pressable: 'Pressable',
  Alert: { alert: jest.fn() },
  Switch: 'Switch',
  SafeAreaView: 'SafeAreaView',
  ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: (s: Record<string, unknown>) => s, absoluteFill: {}, absoluteFillObject: {}, hairlineWidth: 1 },
  KeyboardAvoidingView: 'KeyboardAvoidingView',
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: 'SafeAreaProvider',
}));
jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

import { formatTime, buildFrequencyUpdate, shouldShowFedTodayCard } from '../../src/screens/EditPantryItemScreen';

// ─── formatTime ────────────────────────────────────────

describe('formatTime', () => {
  test('6:00 AM', () => {
    expect(formatTime('06:00')).toBe('6:00 AM');
  });

  test('12:00 PM (noon)', () => {
    expect(formatTime('12:00')).toBe('12:00 PM');
  });

  test('12:30 PM', () => {
    expect(formatTime('12:30')).toBe('12:30 PM');
  });

  test('1:00 PM (13:00)', () => {
    expect(formatTime('13:00')).toBe('1:00 PM');
  });

  test('9:30 PM (21:30)', () => {
    expect(formatTime('21:30')).toBe('9:30 PM');
  });

  test('5:00 AM', () => {
    expect(formatTime('05:00')).toBe('5:00 AM');
  });

  test('11:30 AM', () => {
    expect(formatTime('11:30')).toBe('11:30 AM');
  });

  test('midnight 0:00 AM', () => {
    expect(formatTime('00:00')).toBe('12:00 AM');
  });
});

// ─── buildFrequencyUpdate ──────────────────────────────
// Schedule toggle is the single source of truth for both feeding_frequency
// AND auto_deplete_enabled. Daily leaves notifications_on untouched;
// as_needed forces notifications_on=false alongside the flip.

describe('buildFrequencyUpdate', () => {
  test('daily → auto_deplete_enabled=true and does not touch notifications_on', () => {
    const result = buildFrequencyUpdate('daily');
    expect(result).toEqual({
      feeding_frequency: 'daily',
      auto_deplete_enabled: true,
    });
    expect(result).not.toHaveProperty('notifications_on');
  });

  test('as_needed → auto_deplete_enabled=false and notifications_on=false', () => {
    const result = buildFrequencyUpdate('as_needed');
    expect(result).toEqual({
      feeding_frequency: 'as_needed',
      auto_deplete_enabled: false,
      notifications_on: false,
    });
  });
});

// ─── shouldShowFedTodayCard ────────────────────────────
// Featured Action Card visibility on EditPantryItemScreen.
// Visible ONLY when: feedingFrequency='as_needed' AND !isEmpty AND isActive AND !isRecalled.
// See docs/superpowers/specs/2026-04-14-wet-food-extras-path-design.md §3b.

describe('shouldShowFedTodayCard', () => {
  test('visible when as_needed + not empty + active + not recalled', () => {
    expect(shouldShowFedTodayCard({
      feedingFrequency: 'as_needed',
      isEmpty: false,
      isActive: true,
      isRecalled: false,
    })).toBe(true);
  });

  test('hidden when feedingFrequency is daily', () => {
    expect(shouldShowFedTodayCard({
      feedingFrequency: 'daily',
      isEmpty: false,
      isActive: true,
      isRecalled: false,
    })).toBe(false);
  });

  test('hidden when item is empty', () => {
    expect(shouldShowFedTodayCard({
      feedingFrequency: 'as_needed',
      isEmpty: true,
      isActive: true,
      isRecalled: false,
    })).toBe(false);
  });

  test('hidden when item is recalled', () => {
    expect(shouldShowFedTodayCard({
      feedingFrequency: 'as_needed',
      isEmpty: false,
      isActive: true,
      isRecalled: true,
    })).toBe(false);
  });

  test('hidden when item is soft-deleted (is_active=false)', () => {
    expect(shouldShowFedTodayCard({
      feedingFrequency: 'as_needed',
      isEmpty: false,
      isActive: false,
      isRecalled: false,
    })).toBe(false);
  });
});

