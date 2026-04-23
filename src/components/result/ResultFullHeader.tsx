// ResultFullHeader — ready-state header bar for ResultScreen.
// Shows brand + name center, back chevron left, bookmark + overflow menu right.
// No score bearing — safe to extract per spec §4.4 Rule 7.
// accessibilityLabel on bookmark and menu preserved verbatim from parent.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

interface Props {
  productBrand: string;
  productName: string;
  isBookmarked: boolean;
  onBack: () => void;
  onToggleBookmark: () => void;
  onOpenMenu: () => void;
}

export function ResultFullHeader({
  productBrand,
  productName,
  isBookmarked,
  onBack,
  onToggleBookmark,
  onOpenMenu,
}: Props) {
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.headerIconButton}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={12}
      >
        <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        <Text style={styles.productBrand} numberOfLines={1}>
          {productBrand}
        </Text>
        <Text style={styles.productName} numberOfLines={2}>
          {productName}
        </Text>
      </View>
      <View style={styles.headerActions}>
        <TouchableOpacity
          onPress={onToggleBookmark}
          style={styles.headerIconButton}
          accessibilityRole="button"
          accessibilityLabel={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
        >
          <Ionicons
            name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={isBookmarked ? Colors.accent : Colors.textSecondary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onOpenMenu}
          style={styles.headerIconButton}
          accessibilityRole="button"
          accessibilityLabel="More actions"
        >
          <Ionicons name="ellipsis-horizontal-circle" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIconButton: {
    padding: Spacing.xs,
  },
  productBrand: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  productName: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
