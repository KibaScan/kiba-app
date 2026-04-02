// Kiba — Medication Notification Scheduler (M9)
// Schedules daily repeating local notifications for medication reminders.
// Full-resync approach: rescheduleAllMedications() cancels all + rebuilds from scratch.
// D-084: Zero emoji. D-095: No health claims — content is pet name, med name, dosage only.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getNotificationPreferences } from './pushService';
import { useActivePetStore } from '../stores/useActivePetStore';

const STORAGE_KEY = '@kiba_medication_notif_ids';

// ─── Types ──────────────────────────────────────────────

interface MedicationRow {
  id: string;
  pet_id: string;
  medication_name: string;
  dosage: string | null;
  reminder_times: string[];
  duration_days: number | null;
  started_at: string | null;
  status: string;
}

interface ReminderRecord {
  time: string;
  petName: string;
  medName: string;
  dosage: string | null;
}

// ─── Helpers ────────────────────────────────────────────

function isMedicationExpired(row: MedicationRow): boolean {
  if (row.duration_days == null || !row.started_at) return false;
  const start = new Date(row.started_at + 'T00:00:00');
  const end = new Date(start.getTime() + row.duration_days * 86400000);
  return new Date() > end;
}

// ─── Public API ─────────────────────────────────────────

export async function cancelAllMedicationNotifications(): Promise<void> {
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

/**
 * Full cancel + rebuild of all medication notifications for the current user.
 * Groups same-time reminders across pets into a single notification.
 * Called on: medication save/delete, notification toggle, app launch.
 */
export async function rescheduleAllMedications(): Promise<void> {
  try {
    // 1. Cancel existing
    await cancelAllMedicationNotifications();

    // 2. Check preferences
    const prefs = await getNotificationPreferences();
    if (!prefs?.notifications_enabled || !prefs?.medication_reminders_enabled) return;

    // 3. Get pets
    const pets = useActivePetStore.getState().pets;
    if (pets.length === 0) return;
    const petIds = pets.map((p) => p.id);
    const petNameMap = new Map(pets.map((p) => [p.id, p.name]));

    // 4. Query all current/as_needed medications with reminder_times
    const { data, error } = await supabase
      .from('pet_medications')
      .select('id, pet_id, medication_name, dosage, reminder_times, duration_days, started_at, status')
      .in('pet_id', petIds)
      .in('status', ['current', 'as_needed']);
    if (error || !data) return;

    // 5. Filter & flatten
    const records: ReminderRecord[] = [];
    for (const row of data as MedicationRow[]) {
      if (!row.reminder_times || row.reminder_times.length === 0) continue;
      if (isMedicationExpired(row)) continue;

      const petName = petNameMap.get(row.pet_id) ?? 'Your pet';
      for (const time of row.reminder_times) {
        records.push({
          time,
          petName,
          medName: row.medication_name,
          dosage: row.dosage,
        });
      }
    }

    if (records.length === 0) return;

    // 6. Group by time
    const groups = new Map<string, ReminderRecord[]>();
    for (const rec of records) {
      const existing = groups.get(rec.time) ?? [];
      existing.push(rec);
      groups.set(rec.time, existing);
    }

    // 7. Schedule notifications
    const scheduledIds: string[] = [];
    for (const [time, group] of groups) {
      const [hourStr, minuteStr] = time.split(':');
      const hour = parseInt(hourStr, 10);
      const minute = parseInt(minuteStr, 10);

      let title: string;
      let body: string;

      if (group.length === 1) {
        const { petName, medName, dosage } = group[0];
        title = 'Medication Reminder';
        body = `Time for ${petName}'s ${medName}${dosage ? ` (${dosage})` : ''}`;
      } else {
        title = 'Medication Reminder';
        body = group
          .map((r) => `${r.petName}: ${r.medName}`)
          .join(', ');
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'medication_reminder' as const },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
      scheduledIds.push(id);
    }

    // 8. Store IDs for future cancellation
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(scheduledIds));
  } catch {
    // Silent — notification scheduling is best-effort
  }
}
