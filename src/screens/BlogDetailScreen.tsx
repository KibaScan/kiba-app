// Kiba — Blog Detail (placeholder)
// TBD: replaced by Task 27 implementation.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { CommunityStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<CommunityStackParamList, 'BlogDetail'>;

export default function BlogDetailScreen(_props: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>TBD: BlogDetail</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  label: { color: '#fff', padding: 24 },
});
