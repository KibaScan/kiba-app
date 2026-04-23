import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

export function HomeEmptyState() {
  return (
    <View style={styles.emptyState}>
      <Ionicons
        name="camera-outline"
        size={48}
        color={Colors.textTertiary}
        style={{ marginBottom: Spacing.md }}
      />
      <Text style={styles.emptyTitle}>Scan your first product</Text>
      <Text style={styles.emptySubtitle}>
        Tap the scan button below to check{'\n'}a pet food, treat, or
        supplement.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: FontSizes.xl,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
