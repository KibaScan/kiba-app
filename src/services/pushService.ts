// Kiba — Push Token & Notification Preferences Service (M5 Phase 2)
// Manages Expo push token registration and user_settings CRUD.

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { isOnline } from '../utils/network';
import type {
  UserSettings,
  NotificationPreferenceKey,
  Platform as DevicePlatform,
} from '../types/notifications';

// ─── Device ID ───────────────────────────────────────────

const DEVICE_ID_KEY = '@kiba_device_id';

/**
 * Returns a stable device identifier persisted in AsyncStorage.
 * Uses a random UUID generated once per install.
 */
async function getDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

// ─── Write Functions ─────────────────────────────────────

/**
 * Upserts the Expo push token for the current user + device.
 * Also ensures a user_settings row exists (insert-if-missing).
 * Called on app launch after auth — skips silently if offline.
 */
export async function registerPushToken(expoPushToken: string): Promise<void> {
  try {
    if (!(await isOnline())) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const userId = session.user.id;
    const deviceId = await getDeviceId();
    const platform: DevicePlatform = Platform.OS === 'android' ? 'android' : 'ios';

    // Upsert push token (idempotent on user_id + device_id)
    await supabase.from('push_tokens').upsert(
      {
        user_id: userId,
        expo_push_token: expoPushToken,
        device_id: deviceId,
        platform,
        is_active: true,
      },
      { onConflict: 'user_id,device_id' },
    );

    // Ensure user_settings row exists (defaults applied by DB)
    await supabase.from('user_settings').upsert(
      { user_id: userId },
      { onConflict: 'user_id', ignoreDuplicates: true },
    );
  } catch (err) {
    console.warn('[Kiba Push] Token registration failed:', err);
  }
}

/**
 * Deactivates the push token for the current device.
 * Called on logout (future).
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (!(await isOnline())) return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return;

    const deviceId = await getDeviceId();

    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', session.user.id)
      .eq('device_id', deviceId);
  } catch (err) {
    console.warn('[Kiba Push] Token unregister failed:', err);
  }
}

/**
 * Updates a single notification preference in user_settings.
 * Throws on offline — callers should catch and show toast.
 */
export async function updateNotificationPreference(
  key: NotificationPreferenceKey,
  value: boolean | string,
): Promise<void> {
  if (!(await isOnline())) {
    throw new Error('Connect to the internet to update notification settings.');
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) return;

  const { error } = await supabase
    .from('user_settings')
    .update({ [key]: value })
    .eq('user_id', session.user.id);

  if (error) throw error;
}

// ─── Read Functions ──────────────────────────────────────

/**
 * Returns the current user's notification preferences.
 * Returns null gracefully on failure (read function pattern).
 */
export async function getNotificationPreferences(): Promise<UserSettings | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) return null;

    const { data } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', session.user.id)
      .single();

    return (data as UserSettings) ?? null;
  } catch {
    return null;
  }
}
