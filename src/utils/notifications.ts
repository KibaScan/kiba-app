// Kiba — Expo Notifications Setup & Routing (M5 Phase 2)
// Handles permission requests, token retrieval, foreground display, and tap routing.
// D-084: Zero emoji in all notification content.
// D-095: No health claims — routing only, content set by schedulers/server.

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import type { NotificationType } from '../types/notifications';

// ─── Listener subscriptions (for cleanup) ────────────────

let responseSubscription: Notifications.Subscription | null = null;

// ─── Permission & Token ──────────────────────────────────

/**
 * Requests notification permissions and returns the Expo push token.
 * Returns null on simulator or if permission denied.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  // Push tokens only work on physical devices
  if (!Device.isDevice) {
    console.warn('[Kiba Notifications] Push tokens require a physical device.');
    return null;
  }

  // Android notification channel (required for Android 8+)
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Kiba',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4ECDC4',
    });
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Get Expo push token
  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

// ─── Notification Handlers ───────────────────────────────

/**
 * Configures foreground display and tap-to-navigate routing.
 * Call once after NavigationContainer mounts.
 *
 * @param navigate - Function that navigates to a tab by name.
 *   Accepts tab names from TabParamList: 'Home', 'Pantry', 'Me'.
 */
export function setupNotificationHandlers(
  navigate: (tab: string) => void,
): void {
  // Foreground: show alert + play sound, no badge
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Tap routing: extract type from notification data and navigate
  responseSubscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = response.notification.request.content.data as
        | { type?: NotificationType }
        | undefined;

      if (!data?.type) return;

      switch (data.type) {
        case 'feeding_reminder':
        case 'low_stock':
        case 'empty':
        case 'recall':
          navigate('Pantry');
          break;
        case 'appointment':
        case 'medication_reminder':
          navigate('Me');
          break;
        case 'weekly_digest':
          navigate('Home');
          break;
      }
    },
  );
}

/**
 * Removes notification listeners. Call on unmount.
 */
export function cleanupNotificationHandlers(): void {
  if (responseSubscription) {
    responseSubscription.remove();
    responseSubscription = null;
  }
}
