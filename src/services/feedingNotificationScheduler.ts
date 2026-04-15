// Kiba — Feeding Notification Scheduler (M5 Phase 2)
// Schedules daily repeating local notifications for feeding reminders.
// Multi-pet grouping: same-time feedings across pets → single notification.
// Full-resync approach: rescheduleAllFeeding() cancels all + rebuilds from scratch.
// D-084: Zero emoji. D-095: No health claims — content is time/product/serving only.

import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getNotificationPreferences } from './pushService';
import { useActivePetStore } from '../stores/useActivePetStore';
import { stripBrandFromName } from '../utils/formatters';
import type { ServingMode, ServingSizeUnit, UnitLabel } from '../types/pantry';

const STORAGE_KEY = '@kiba_feeding_notif_ids';

// ─── Query Result Shape ──────────────────────────────────

interface AssignmentRow {
  pet_id: string;
  serving_size: number;
  serving_size_unit: ServingSizeUnit;
  feeding_times: string[] | null;
  pantry_items: {
    serving_mode: ServingMode;
    unit_label: UnitLabel | null;
    is_active: boolean;
    quantity_remaining: number;
    products: {
      name: string;
      brand: string;
    };
  };
}

interface FeedingRecord {
  time: string;
  petName: string;
  productName: string;
  servingDisplay: string;
}

// ─── Internal Helpers ────────────────────────────────────

function getMealLabel(hour: number): string {
  if (hour >= 5 && hour <= 10) return 'breakfast';
  if (hour >= 11 && hour <= 13) return 'lunch';
  if (hour >= 14 && hour <= 20) return 'dinner';
  return 'evening meal';
}

function getGroupMealLabel(hour: number): string {
  if (hour >= 5 && hour <= 10) return 'Morning feeding';
  if (hour >= 11 && hour <= 13) return 'Midday feeding';
  if (hour >= 14 && hour <= 20) return 'Evening feeding';
  return 'Late feeding';
}

function toUnicodeFraction(n: number): string {
  if (n === Math.floor(n)) return String(n);
  const whole = Math.floor(n);
  const frac = n - whole;
  let fracStr = '';
  if (Math.abs(frac - 0.25) < 0.05) fracStr = '\u00BC';
  else if (Math.abs(frac - 0.5) < 0.05) fracStr = '\u00BD';
  else if (Math.abs(frac - 0.75) < 0.05) fracStr = '\u00BE';
  else if (Math.abs(frac - 0.333) < 0.05) fracStr = '\u2153';
  else if (Math.abs(frac - 0.667) < 0.05) fracStr = '\u2154';
  else return n.toFixed(1);
  return whole > 0 ? `${whole}${fracStr}` : fracStr;
}

function singularize(unit: string): string {
  if (unit.endsWith('ches')) return unit.slice(0, -2);
  if (unit.endsWith('s')) return unit.slice(0, -1);
  return unit;
}

function formatServingDisplay(
  size: number,
  servingMode: ServingMode,
  servingSizeUnit: ServingSizeUnit,
  unitLabel: UnitLabel | null,
): string {
  if (servingMode === 'unit') {
    let label: string;
    if (unitLabel) {
      label = unitLabel;
    } else {
      label = servingSizeUnit === 'cups' || servingSizeUnit === 'scoops' ? servingSizeUnit : 'servings';
    }
    const displayUnit = size <= 1 ? singularize(label) : label;
    return `${toUnicodeFraction(size)} ${displayUnit}`;
  }
  const sizeStr = size === Math.floor(size) ? String(size) : size.toFixed(1);
  const displayUnit = size <= 1 ? singularize(servingSizeUnit) : servingSizeUnit;
  return `${sizeStr} ${displayUnit}`;
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + '\u2026';
}

// ─── Public API ──────────────────────────────────────────

/**
 * Cancels all scheduled feeding notifications and clears stored IDs.
 * Called internally by rescheduleAllFeeding() and on logout/prefs-off.
 */
export async function cancelAllFeedingNotifications(): Promise<void> {
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
 * Full cancel + rebuild of all feeding notifications for the current user.
 * Groups same-time feedings across pets into a single notification.
 * Called on: pantry add/remove/share, feeding time edit, notification toggle, app launch.
 */
export async function rescheduleAllFeeding(): Promise<void> {
  try {
    // 1. Cancel existing
    await cancelAllFeedingNotifications();

    // 2. Check preferences
    const prefs = await getNotificationPreferences();
    if (!prefs?.notifications_enabled || !prefs?.feeding_reminders_enabled) return;

    // 3. Get pets
    const pets = useActivePetStore.getState().pets;
    if (pets.length === 0) return;
    const petIds = pets.map((p) => p.id);
    const petNameMap = new Map(pets.map((p) => [p.id, p.name]));

    // 4. Query all active daily assignments with product info
    const { data, error } = await supabase
      .from('pantry_pet_assignments')
      .select(
        'pet_id, serving_size, serving_size_unit, feeding_times, ' +
        'pantry_items!inner(serving_mode, unit_label, is_active, quantity_remaining, products(name, brand))',
      )
      .in('pet_id', petIds)
      .eq('feeding_frequency', 'daily')
      .eq('notifications_on', true);
    if (error || !data) return;

    // 5. Filter & flatten
    const records: FeedingRecord[] = [];
    for (const row of data as unknown as AssignmentRow[]) {
      const item = row.pantry_items;
      if (!item.is_active || item.quantity_remaining <= 0) continue;
      if (!row.feeding_times || row.feeding_times.length === 0) continue;

      const petName = petNameMap.get(row.pet_id) ?? 'Your pet';
      const rawName = stripBrandFromName(item.products.brand, item.products.name);
      const productName = truncate(rawName, 30);
      const servingDisplay = formatServingDisplay(
        row.serving_size,
        item.serving_mode,
        row.serving_size_unit,
        item.unit_label,
      );

      for (const time of row.feeding_times) {
        records.push({ time, petName, productName, servingDisplay });
      }
    }

    if (records.length === 0) return;

    // 6. Group by time
    const groups = new Map<string, FeedingRecord[]>();
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
        const { petName, productName, servingDisplay } = group[0];
        title = `Time for ${petName}'s ${getMealLabel(hour)}`;
        body = `${productName} (${servingDisplay})`;
      } else {
        title = getGroupMealLabel(hour);
        body = group
          .map((r) => `${r.petName} (${r.servingDisplay} ${r.productName})`)
          .join(' + ');
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data: { type: 'feeding_reminder' as const },
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
