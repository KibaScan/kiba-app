// ResultActionButtons — Compare / Add to Pantry / Start Safe Switch row.
// Pure presentational: all paywall checks and Safe Switch predicate logic
// live in the parent (ResultScreen). Props carry pre-evaluated callbacks
// and booleans so this file has NO permissions.ts dependency.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';

interface Props {
  /** Label for the "Add to Pantry" button — includes pet name. */
  petDisplayName: string;
  /** True when the Safe Switch button should be shown. Parent evaluates all 7 predicates. */
  showSafeSwitch: boolean;
  /** True when canUseSafeSwaps() returned false — show lock icon. */
  safeSwitchLocked: boolean;
  /** True when Add to Pantry should be shown (product + pet both available). */
  showAddToPantry: boolean;
  onCompare: () => void;
  onAddToPantry: () => void;
  onStartSafeSwitch: () => void;
}

export function ResultActionButtons({
  petDisplayName,
  showSafeSwitch,
  safeSwitchLocked,
  showAddToPantry,
  onCompare,
  onAddToPantry,
  onStartSafeSwitch,
}: Props) {
  return (
    <>
      {/* Compare button (D-052: premium gate handled by parent) */}
      <TouchableOpacity
        style={styles.compareButton}
        activeOpacity={0.7}
        onPress={onCompare}
      >
        <Ionicons name="git-compare-outline" size={18} color={Colors.accent} />
        <Text style={styles.compareButtonText}>Compare with another product</Text>
      </TouchableOpacity>

      {/* Add to Pantry */}
      {showAddToPantry && (
        <TouchableOpacity
          style={styles.trackButton}
          onPress={onAddToPantry}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
          <Text style={[styles.trackButtonText, { color: Colors.accent }]}>
            Add to {petDisplayName}'s Pantry
          </Text>
        </TouchableOpacity>
      )}

      {/* V2-1: Start Safe Switch */}
      {showSafeSwitch && (
        <TouchableOpacity
          style={styles.trackButton}
          onPress={onStartSafeSwitch}
          activeOpacity={0.7}
        >
          <Ionicons
            name={safeSwitchLocked ? 'lock-closed-outline' : 'swap-horizontal-outline'}
            size={18}
            color={Colors.accent}
          />
          <Text style={[styles.trackButtonText, { color: Colors.accent }]}>
            Start Safe Switch
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  compareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: Spacing.sm,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  compareButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
  trackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: Spacing.lg,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  trackButtonText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textTertiary,
  },
});
