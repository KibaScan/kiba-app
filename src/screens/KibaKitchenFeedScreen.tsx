// Kiba — Kiba Kitchen Feed (placeholder)
// TBD: replaced by Task 24 implementation.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<CommunityStackParamList, 'KibaKitchenFeed'>;

export default function KibaKitchenFeedScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>TBD: KibaKitchenFeed</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  label: { color: '#fff', padding: 24 },
});
