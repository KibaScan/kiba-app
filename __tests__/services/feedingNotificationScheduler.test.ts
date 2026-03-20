// Feeding Notification Scheduler Tests
// Mocks: expo-notifications, AsyncStorage, Supabase, pet store, push service.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { rescheduleAllFeeding, cancelAllFeedingNotifications } from '../../src/services/feedingNotificationScheduler';

// ─── Mocks ───────────────────────────────────────────────

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined),
}));

const mockGetPrefs = jest.fn();
jest.mock('../../src/services/pushService', () => ({
  getNotificationPreferences: (...args: unknown[]) => mockGetPrefs(...args),
}));

const mockGetState = jest.fn();
jest.mock('../../src/stores/useActivePetStore', () => ({
  useActivePetStore: { getState: () => mockGetState() },
}));

const mockFrom = jest.fn();
jest.mock('../../src/services/supabase', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

// ─── Helpers ─────────────────────────────────────────────

function makeAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    pet_id: 'pet-1',
    serving_size: 1.5,
    serving_size_unit: 'cups',
    feeding_times: ['07:00', '18:00'],
    pantry_items: {
      serving_mode: 'weight',
      unit_label: null,
      is_active: true,
      quantity_remaining: 10,
      products: { name: 'Purina Pro Plan Indoor Formula', brand: 'Purina' },
    },
    ...overrides,
  };
}

function makeUnitAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    pet_id: 'pet-1',
    serving_size: 0.5,
    serving_size_unit: 'units',
    feeding_times: ['07:00'],
    pantry_items: {
      serving_mode: 'unit',
      unit_label: 'cans',
      is_active: true,
      quantity_remaining: 6,
      products: { name: 'Fancy Feast Classic Pate', brand: 'Fancy Feast' },
    },
    ...overrides,
  };
}

function setupDefaultMocks(
  data: Record<string, unknown>[] = [makeAssignmentRow()],
  prefs: Record<string, unknown> = { notifications_enabled: true, feeding_reminders_enabled: true },
  pets: { id: string; name: string }[] = [{ id: 'pet-1', name: 'Buster' }],
) {
  mockGetPrefs.mockResolvedValue(prefs);
  mockGetState.mockReturnValue({ pets });

  const result = { data, error: null };
  mockFrom.mockReturnValue({
    select: jest.fn().mockReturnValue({
      in: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue(result),
        }),
      }),
    }),
  });

  let counter = 0;
  (Notifications.scheduleNotificationAsync as jest.Mock).mockImplementation(
    () => Promise.resolve(`notif-${++counter}`),
  );
}

// ─── Tests ───────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
});

describe('rescheduleAllFeeding', () => {
  it('schedules correct number of notifications for 2 daily feedings', async () => {
    setupDefaultMocks([makeAssignmentRow({ feeding_times: ['07:00', '18:00'] })]);

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);

    // Check morning notification content
    const call1 = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call1.content.title).toBe("Time for Buster's breakfast");
    expect(call1.content.body).toContain('1.5 cups');
    expect(call1.content.data.type).toBe('feeding_reminder');
    expect(call1.trigger.hour).toBe(7);
    expect(call1.trigger.minute).toBe(0);

    // Check evening notification content
    const call2 = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[1][0];
    expect(call2.content.title).toBe("Time for Buster's dinner");
    expect(call2.trigger.hour).toBe(18);
  });

  it('cancels old notification IDs before scheduling new', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(['old-1', 'old-2']),
    );
    setupDefaultMocks();

    await rescheduleAllFeeding();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-2');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kiba_feeding_notif_ids');
  });

  it('groups multi-pet same-time into 1 notification', async () => {
    const pets = [
      { id: 'pet-1', name: 'Buster' },
      { id: 'pet-2', name: 'Milo' },
    ];
    const rows = [
      makeAssignmentRow({ pet_id: 'pet-1', feeding_times: ['07:00'] }),
      makeAssignmentRow({ pet_id: 'pet-2', feeding_times: ['07:00'], serving_size: 2 }),
    ];
    setupDefaultMocks(rows, undefined, pets);

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.title).toBe('Morning feeding');
    expect(call.content.body).toContain('Buster');
    expect(call.content.body).toContain('Milo');
    expect(call.content.body).toContain('+');
  });

  it('skips scheduling when notifications_enabled is false', async () => {
    setupDefaultMocks(
      [makeAssignmentRow()],
      { notifications_enabled: false, feeding_reminders_enabled: true },
    );

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips scheduling when feeding_reminders_enabled is false', async () => {
    setupDefaultMocks(
      [makeAssignmentRow()],
      { notifications_enabled: true, feeding_reminders_enabled: false },
    );

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('uses unit_label for display — shows "can" not "units"', async () => {
    setupDefaultMocks([makeUnitAssignmentRow()]);

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.body).toContain('\u00BD can'); // ½ can
    expect(call.content.body).not.toContain('units');
  });

  it('stores new notification IDs in AsyncStorage after scheduling', async () => {
    setupDefaultMocks([makeAssignmentRow({ feeding_times: ['07:00', '18:00'] })]);

    await rescheduleAllFeeding();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@kiba_feeding_notif_ids',
      JSON.stringify(['notif-1', 'notif-2']),
    );
  });

  it('skips empty items (quantity_remaining = 0)', async () => {
    const row = makeAssignmentRow();
    (row.pantry_items as Record<string, unknown>).quantity_remaining = 0;
    setupDefaultMocks([row]);

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips assignments with feeding_times null', async () => {
    setupDefaultMocks([makeAssignmentRow({ feeding_times: null })]);

    await rescheduleAllFeeding();

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});

describe('cancelAllFeedingNotifications', () => {
  it('cancels stored IDs and clears storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(['id-a', 'id-b']),
    );

    await cancelAllFeedingNotifications();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-a');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-b');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kiba_feeding_notif_ids');
  });
});
