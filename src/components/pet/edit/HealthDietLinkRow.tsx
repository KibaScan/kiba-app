// HealthDietLinkRow — navigation row to Health & Diet / Conditions screen.
// Parent owns conditionCount, allergenCount, health_reviewed_at, and navigation callback.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';

interface Props {
  healthReviewedAt: string | null | undefined;
  conditionCount: number;
  allergenCount: number;
  onPress: () => void;
}

export function HealthDietLinkRow({
  healthReviewedAt,
  conditionCount,
  allergenCount,
  onPress,
}: Props) {
  const subtext =
    healthReviewedAt === null || healthReviewedAt === undefined
      ? 'Not set'
      : [
          conditionCount > 0 &&
            `${conditionCount} condition${conditionCount !== 1 ? 's' : ''}`,
          allergenCount > 0 &&
            `${allergenCount} allergen${allergenCount !== 1 ? 's' : ''}`,
        ]
          .filter(Boolean)
          .join(' · ') || 'No conditions';

  const subtextMuted = healthReviewedAt === null || healthReviewedAt === undefined;

  return (
    <TouchableOpacity
      style={styles.linkRow}
      activeOpacity={0.6}
      onPress={onPress}
    >
      <Ionicons name="heart-outline" size={22} color={Colors.textSecondary} />
      <View style={styles.linkContent}>
        <Text style={styles.linkText}>Health & Diet</Text>
        <Text style={[styles.linkSubtext, subtextMuted && styles.linkSubtextMuted]}>
          {subtext}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    gap: Spacing.md,
  },
  linkContent: {
    flex: 1,
  },
  linkText: {
    fontSize: FontSizes.md,
    color: Colors.textPrimary,
  },
  linkSubtext: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  linkSubtextMuted: {
    color: Colors.textTertiary,
  },
});
