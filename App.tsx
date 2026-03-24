// Kiba — Root Entry Point
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Navigation from './src/navigation';
import { ensureAuth } from './src/services/auth';
import { useActivePetStore } from './src/stores/useActivePetStore';
import { configureRevenueCat } from './src/utils/permissions';
import { Colors } from './src/utils/constants';
import { registerForPushNotificationsAsync, setupNotificationHandlers, cleanupNotificationHandlers } from './src/utils/notifications';
import { registerPushToken, ensureUserSettings } from './src/services/pushService';
import { rescheduleAllFeeding } from './src/services/feedingNotificationScheduler';
import { rescheduleAllAppointments } from './src/services/appointmentNotificationScheduler';
import { supabase } from './src/services/supabase';
import { navigationRef } from './src/navigation';

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function init() {
      await ensureAuth();
      await configureRevenueCat();
      await useActivePetStore.getState().loadPets();

      // Ensure user_settings row exists (local notification schedulers depend on it)
      await ensureUserSettings();

      // Push notification registration (may return null on simulator — that's fine)
      const token = await registerForPushNotificationsAsync();
      if (token) await registerPushToken(token);

      // Re-sync local notifications on launch
      rescheduleAllFeeding().catch(() => {});
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        rescheduleAllAppointments(session.user.id).catch(() => {});
      }
    }
    init().finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    const navigate = (tab: string) => {
      if (navigationRef.isReady()) {
        navigationRef.navigate('Main' as never);
        // Small delay to ensure Main is mounted before tab switch
        setTimeout(() => {
          navigationRef.navigate(tab as never);
        }, 100);
      }
    };
    setupNotificationHandlers(navigate);
    return () => cleanupNotificationHandlers();
  }, []);

  if (!authReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <Navigation />
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
