// Kiba — Safe Switch Notification Scheduler (M7)
// Daily morning reminders + evening tummy check nudges for active safe switches.
// Full-resync approach (cancel all + rebuild) — same pattern as feedingNotificationScheduler.
// D-084: Zero emoji. D-095: Observational copy only.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getNotificationPreferences } from './pushService';
import { useActivePetStore } from '../stores/useActivePetStore';
import { getCurrentDay, getMixForDay } from '../utils/safeSwitchHelpers';
import { stripBrandFromName } from '../utils/formatters';

const STORAGE_KEY = '@kiba_safe_switch_notif_ids';

// ─── Public API ──────────────────────────────────────────

/**
 * Cancels all scheduled safe switch notifications and clears stored IDs.
 */
export async function cancelAllSafeSwitchNotifications(): Promise<void> {
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
 * Full cancel + rebuild of all safe switch notifications for the current user.
 * Schedules:
 *   1. Daily 9 AM morning reminder: "Day X of Y: Mix Z% old / W% new for [Pet Name]"
 *   2. Daily 7 PM evening nudge: "How was [Pet Name]'s digestion today?"
 *
 * Called on: switch create, complete, cancel, pause, resume, app launch.
 */
export async function rescheduleAllSafeSwitchNotifications(): Promise<void> {
  try {
    // 1. Cancel existing
    await cancelAllSafeSwitchNotifications();

    // 2. Check preferences
    const prefs = await getNotificationPreferences();
    if (!prefs?.notifications_enabled || !prefs?.feeding_reminders_enabled) return;

    // 3. Get pets
    const pets = useActivePetStore.getState().pets;
    if (pets.length === 0) return;
    const petIds = pets.map((p) => p.id);
    const petNameMap = new Map(pets.map((p) => [p.id, p.name]));

    // 4. Query active switches with product info
    const { data, error } = await supabase
      .from('safe_switches')
      .select(`
        id, pet_id, total_days, started_at, status,
        old_product:products!safe_switches_old_product_id_fkey(name, brand),
        new_product:products!safe_switches_new_product_id_fkey(name, brand)
      `)
      .in('pet_id', petIds)
      .eq('status', 'active');

    if (error || !data || data.length === 0) return;

    // 5. Schedule notifications
    const scheduledIds: string[] = [];

    for (const row of data as unknown as {
      id: string;
      pet_id: string;
      total_days: number;
      started_at: string;
      old_product: { name: string; brand: string };
      new_product: { name: string; brand: string };
    }[]) {
      const petName = petNameMap.get(row.pet_id) ?? 'Your pet';
      const currentDay = getCurrentDay(row.started_at, row.total_days);
      const newProductName = stripBrandFromName(row.new_product.brand, row.new_product.name);
      const now = new Date();

      // Parse start date for date arithmetic
      const startDate = new Date(row.started_at + 'T00:00:00');

      // Schedule DATE triggers for each remaining day (finite, not perpetual)
      for (let day = currentDay; day <= row.total_days; day++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(startDate.getDate() + (day - 1));

        const mix = getMixForDay(day, row.total_days);

        // Morning reminder (9 AM local)
        const morningDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 9, 0, 0);
        if (morningDate > now) {
          const morningTitle = `Day ${day} of ${row.total_days} — Safe Switch`;
          const morningBody = mix.newPct === 100
            ? `${petName} is ready for 100% ${truncate(newProductName, 25)}`
            : `Mix ${mix.oldPct}% old / ${mix.newPct}% new for ${petName}`;

          const morningId = await Notifications.scheduleNotificationAsync({
            content: {
              title: morningTitle,
              body: morningBody,
              data: { type: 'safe_switch_reminder' as const, switchId: row.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: morningDate,
            },
          });
          scheduledIds.push(morningId);
        }

        // Evening tummy check nudge (7 PM local)
        const eveningDate = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), 19, 0, 0);
        if (eveningDate > now) {
          const eveningId = await Notifications.scheduleNotificationAsync({
            content: {
              title: `Tummy Check — ${petName}`,
              body: `How was ${petName}'s digestion today? Tap to log.`,
              data: { type: 'safe_switch_tummy_check' as const, switchId: row.id },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: eveningDate,
            },
          });
          scheduledIds.push(eveningId);
        }
      }
    }

    // 6. Store IDs for future cancellation
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(scheduledIds));
  } catch {
    // Silent — notification scheduling is best-effort
  }
}

// ─── Internal Helpers ────────────────────────────────────

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}
