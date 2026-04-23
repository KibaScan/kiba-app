import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, SEVERITY_COLORS } from '../../utils/constants';

interface RecallBannerProps {
  count: number;
  petName: string;
  onPress: () => void;
}

export function RecallBanner({ count, petName, onPress }: RecallBannerProps) {
  return (
    <TouchableOpacity
      style={styles.recallCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Ionicons
        name="warning-outline"
        size={20}
        color={SEVERITY_COLORS.danger}
      />
      <Text style={styles.recallCardBody} numberOfLines={2}>
        {count} recalled product
        {count !== 1 ? 's' : ''} in{' '}
        {petName}&apos;s pantry
      </Text>
      <Ionicons
        name="chevron-forward"
        size={16}
        color={Colors.textTertiary}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  recallCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: `${SEVERITY_COLORS.danger}15`,
    borderLeftWidth: 3,
    borderLeftColor: SEVERITY_COLORS.danger,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  recallCardBody: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: SEVERITY_COLORS.danger,
    lineHeight: 18,
  },
});
