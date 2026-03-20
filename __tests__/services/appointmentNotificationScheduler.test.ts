// Appointment Notification Scheduler Tests
// Mocks: expo-notifications, AsyncStorage, Supabase, pet store, push service.
// Pattern matches feedingNotificationScheduler.test.ts.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  rescheduleAllAppointments,
  cancelAllAppointmentReminders,
} from '../../src/services/appointmentNotificationScheduler';

// ─── Mocks ───────────────────────────────────────────────

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(undefined),
  SchedulableTriggerInputTypes: { DATE: 'date' },
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

jest.mock('../../src/utils/network', () => ({
  isOnline: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/supabase', () => ({
  supabase: {
    from: jest.fn(),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
      }),
    },
  },
}));

import { supabase } from '../../src/services/supabase';

// ─── Helpers ─────────────────────────────────────────────

function makeAppointment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'appt-1',
    user_id: 'user-1',
    type: 'vet_visit',
    custom_label: null,
    scheduled_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 2 days from now
    pet_ids: ['pet-1'],
    location: 'Paws & Claws',
    notes: null,
    reminder: '1_day',
    recurring: 'none',
    is_completed: false,
    completed_at: null,
    created_at: '2026-03-20T00:00:00Z',
    updated_at: '2026-03-20T00:00:00Z',
    ...overrides,
  };
}

function mockUpcomingQuery(appointments: Record<string, unknown>[]) {
  const result = { data: appointments, error: null };
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'contains', 'order']) {
    chain[m] = jest.fn(() => chain);
  }
  // Make chain thenable
  (chain as unknown as PromiseLike<unknown>).then = ((resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject)) as PromiseLike<unknown>['then'];
  (supabase.from as jest.Mock).mockReturnValue(chain);
}

function setupDefaultMocks(
  appointments: Record<string, unknown>[] = [makeAppointment()],
  prefs: Record<string, unknown> = { notifications_enabled: true, appointment_reminders_enabled: true },
  pets: { id: string; name: string }[] = [{ id: 'pet-1', name: 'Mochi' }],
) {
  mockGetPrefs.mockResolvedValue(prefs);
  mockGetState.mockReturnValue({ pets });
  mockUpcomingQuery(appointments);

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

describe('rescheduleAllAppointments', () => {
  it('schedules a reminder for an upcoming appointment', async () => {
    setupDefaultMocks();

    await rescheduleAllAppointments('user-1');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.title).toContain("Mochi's");
    expect(call.content.title).toContain('vet visit');
    expect(call.content.title).toContain('tomorrow');
    expect(call.content.body).toContain('Paws & Claws');
    expect(call.content.data.type).toBe('appointment');
    expect(call.content.data.appointmentId).toBe('appt-1');
    expect(call.trigger.type).toBe('date');
  });

  it('cancels old notification IDs before scheduling new', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(['old-1', 'old-2']),
    );
    setupDefaultMocks();

    await rescheduleAllAppointments('user-1');

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-1');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('old-2');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kiba_appointment_notif_ids');
  });

  it('stores new notification IDs in AsyncStorage', async () => {
    setupDefaultMocks();

    await rescheduleAllAppointments('user-1');

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@kiba_appointment_notif_ids',
      JSON.stringify(['notif-1']),
    );
  });

  it('skips appointments with reminder = off', async () => {
    setupDefaultMocks([makeAppointment({ reminder: 'off' })]);

    await rescheduleAllAppointments('user-1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips when notifications_enabled is false', async () => {
    setupDefaultMocks(
      [makeAppointment()],
      { notifications_enabled: false, appointment_reminders_enabled: true },
    );

    await rescheduleAllAppointments('user-1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips when appointment_reminders_enabled is false', async () => {
    setupDefaultMocks(
      [makeAppointment()],
      { notifications_enabled: true, appointment_reminders_enabled: false },
    );

    await rescheduleAllAppointments('user-1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('skips appointments where trigger time is in the past', async () => {
    // Appointment 10 minutes from now with 1_day reminder → trigger would be yesterday
    const soonAppt = makeAppointment({
      scheduled_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      reminder: '1_day',
    });
    setupDefaultMocks([soonAppt]);

    await rescheduleAllAppointments('user-1');

    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('formats multi-pet names correctly', async () => {
    const appt = makeAppointment({ pet_ids: ['pet-1', 'pet-2'] });
    setupDefaultMocks(
      [appt],
      undefined,
      [{ id: 'pet-1', name: 'Buster' }, { id: 'pet-2', name: 'Milo' }],
    );

    await rescheduleAllAppointments('user-1');

    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.title).toContain('Buster & Milo');
  });

  it('uses custom_label for "other" type', async () => {
    const appt = makeAppointment({ type: 'other', custom_label: 'Dental cleaning' });
    setupDefaultMocks([appt]);

    await rescheduleAllAppointments('user-1');

    const call = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls[0][0];
    expect(call.content.title).toContain('Dental cleaning');
  });

  it('schedules multiple appointment reminders', async () => {
    const appts = [
      makeAppointment({ id: 'appt-1', reminder: '1_day' }),
      makeAppointment({ id: 'appt-2', reminder: '3_days', scheduled_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString() }),
    ];
    setupDefaultMocks(appts);

    await rescheduleAllAppointments('user-1');

    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      '@kiba_appointment_notif_ids',
      JSON.stringify(['notif-1', 'notif-2']),
    );
  });
});

describe('cancelAllAppointmentReminders', () => {
  it('cancels stored IDs and clears storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(['id-a', 'id-b']),
    );

    await cancelAllAppointmentReminders();

    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-a');
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('id-b');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kiba_appointment_notif_ids');
  });

  it('handles empty storage gracefully', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await cancelAllAppointmentReminders();

    expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@kiba_appointment_notif_ids');
  });
});
