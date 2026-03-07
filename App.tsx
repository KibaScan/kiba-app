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

export default function App() {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function init() {
      await ensureAuth();
      await configureRevenueCat();
      await useActivePetStore.getState().loadPets();
    }
    init().finally(() => setAuthReady(true));
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
