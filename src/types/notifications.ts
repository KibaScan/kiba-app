// Kiba — M5 Notification Types
// Matches push_tokens (migration 013) + user_settings (migration 014) tables.

// ─── Union Types ─────────────────────────────────────────

export type Platform = 'ios' | 'android';
export type DigestFrequency = 'weekly' | 'daily' | 'off';

/** Notification categories used in push payload `data.type` field. */
export type NotificationType =
  | 'feeding_reminder'
  | 'low_stock'
  | 'empty'
  | 'recall'
  | 'appointment'
  | 'medication_reminder'
  | 'weight_estimate'
  | 'weekly_digest';

// ─── DB Interfaces ───────────────────────────────────────

/** Matches push_tokens table exactly (8 columns). */
interface PushToken {
  id: string;
  user_id: string;
  expo_push_token: string;
  device_id: string;
  platform: Platform;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Matches user_settings table exactly (12 columns after migration 022). */
export interface UserSettings {
  id: string;
  user_id: string;
  notifications_enabled: boolean;
  feeding_reminders_enabled: boolean;
  low_stock_alerts_enabled: boolean;
  empty_alerts_enabled: boolean;
  recall_alerts_enabled: boolean;
  appointment_reminders_enabled: boolean;
  medication_reminders_enabled: boolean;
  weight_estimate_alerts_enabled: boolean;
  digest_frequency: DigestFrequency;
  created_at: string;
  updated_at: string;
}

// ─── Preference Update Key ───────────────────────────────

/** Keys that can be updated via updateNotificationPreference(). */
export type NotificationPreferenceKey = keyof Omit<
  UserSettings,
  'id' | 'user_id' | 'created_at' | 'updated_at'
>;
