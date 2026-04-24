// Kiba — Kiba Kitchen Submit (placeholder)
// TBD: replaced by Task 25 implementation.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<CommunityStackParamList, 'KibaKitchenSubmit'>;

export default function KibaKitchenSubmitScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>TBD: KibaKitchenSubmit</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  label: { color: '#fff', padding: 24 },
});
