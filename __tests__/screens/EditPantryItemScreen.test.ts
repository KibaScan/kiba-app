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
jest.mock('expo-linear-gradient', () => ({ LinearGradient: 'LinearGradient' }));
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: jest.fn() },
}));
jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

import { formatTime, buildPresetTimes } from '../../src/screens/EditPantryItemScreen';

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

// ─── buildPresetTimes ──────────────────────────────────

describe('buildPresetTimes', () => {
  const presets = buildPresetTimes();

  test('starts at 5:00 AM', () => {
    expect(presets[0]).toEqual({ value: '05:00', label: '5:00 AM' });
  });

  test('ends at 9:30 PM', () => {
    expect(presets[presets.length - 1]).toEqual({ value: '21:30', label: '9:30 PM' });
  });

  test('generates 30-minute intervals', () => {
    // 5:00 to 21:30 = 17 hours * 2 slots = 34
    expect(presets).toHaveLength(34);
  });

  test('noon is 12:00 PM', () => {
    const noon = presets.find(t => t.value === '12:00');
    expect(noon).toEqual({ value: '12:00', label: '12:00 PM' });
  });

  test('all values are HH:MM format', () => {
    presets.forEach(t => {
      expect(t.value).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  test('all labels include AM or PM', () => {
    presets.forEach(t => {
      expect(t.label).toMatch(/(AM|PM)$/);
    });
  });
});
