// Kiba — Appointment Reminder Notification Scheduler (M5 D-103)
// Schedules one-shot local notifications for appointment reminders.
// Full-resync approach: rescheduleAllAppointments() cancels all + rebuilds from scratch.
// D-084: Zero emoji. D-095: No health claims — content is time/type/location only.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotificationPreferences } from './pushService';
import { getUpcomingAppointments } from './appointmentService';
import { useActivePetStore } from '../stores/useActivePetStore';
import type { Appointment, AppointmentType } from '../types/appointment';

const STORAGE_KEY = '@kiba_appointment_notif_ids';

// ─── Internal Helpers ────────────────────────────────────

const REMINDER_OFFSETS: Record<string, number> = {
  '1_hour': 60 * 60 * 1000,
  '1_day': 24 * 60 * 60 * 1000,
  '3_days': 3 * 24 * 60 * 60 * 1000,
  '1_week': 7 * 24 * 60 * 60 * 1000,
};

const TIME_LABELS: Record<string, string> = {
  '1_hour': 'in 1 hour',
  '1_day': 'tomorrow',
  '3_days': 'in 3 days',
  '1_week': 'next week',
};

const TYPE_LABELS: Record<AppointmentType, string> = {
  vet_visit: 'vet visit',
  grooming: 'grooming',
  medication: 'medication',
  vaccination: 'vaccination',
  deworming: 'deworming',
  other: 'appointment',
};

function getTypeLabel(appt: Appointment): string {
  if (appt.type === 'other' && appt.custom_label) return appt.custom_label;
  return TYPE_LABELS[appt.type];
}

function formatPetNames(names: string[]): string {
  if (names.length === 0) return 'Your pet';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

function formatTime12(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? `0${m}` : String(m);
  return `${hour12}:${minStr} ${ampm}`;
}

function formatDateLong(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// ─── Public API ──────────────────────────────────────────

export async function cancelAllAppointmentReminders(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      const ids: string[] = JSON.parse(stored);
      await Promise.all(
        ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)),
      );
    }
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Silent — best-effort cleanup
  }
}

export async function rescheduleAllAppointments(userId: string): Promise<void> {
  try {
    // 1. Cancel existing
    await cancelAllAppointmentReminders();

    // 2. Check preferences
    const prefs = await getNotificationPreferences();
    if (!prefs?.notifications_enabled || !prefs?.appointment_reminders_enabled) return;

    // 3. Get upcoming appointments
    const appointments = await getUpcomingAppointments(userId);
    if (appointments.length === 0) return;

    // 4. Resolve pet names
    const pets = useActivePetStore.getState().pets;
    const petNameMap = new Map(pets.map((p) => [p.id, p.name]));

    // 5. Schedule reminders
    const now = Date.now();
    const scheduledIds: string[] = [];

    for (const appt of appointments) {
      if (appt.reminder === 'off') continue;

      const offset = REMINDER_OFFSETS[appt.reminder];
      if (!offset) continue;

      const scheduledAt = new Date(appt.scheduled_at);
      const triggerDate = new Date(scheduledAt.getTime() - offset);

      // Skip if trigger time is in the past
      if (triggerDate.getTime() <= now) continue;

      const petNames = appt.pet_ids
        .map((id) => petNameMap.get(id))
        .filter((n): n is string => !!n);
      const petStr = formatPetNames(petNames);
      const typeLabel = getTypeLabel(appt);
      const timeLabel = TIME_LABELS[appt.reminder] ?? '';

      const title = `${petStr}'s ${typeLabel} ${timeLabel}`;
      let body = `${formatDateLong(scheduledAt)} at ${formatTime12(scheduledAt)}`;
      if (appt.location) body += ` \u2014 ${appt.location}`;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'appointment' as const, appointmentId: appt.id },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
      });
      scheduledIds.push(id);
    }

    // 6. Store IDs for future cancellation
    if (scheduledIds.length > 0) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(scheduledIds));
    }
  } catch {
    // Silent — notification scheduling is best-effort
  }
}
