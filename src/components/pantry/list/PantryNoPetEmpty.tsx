// Kiba — PantryNoPetEmpty
// Full-screen empty state shown when no pet profile exists yet.
// Extracted from PantryScreen.tsx — zero behavior change.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../../utils/constants';

type Props = {
  onAddPet: () => void;
};

export function PantryNoPetEmpty({ onAddPet }: Props) {
  return (
    <View style={styles.emptyCenter}>
      <View style={styles.emptyIconPlatter}>
        <Ionicons name="paw-outline" size={40} color={Colors.accent} />
      </View>
      <Text style={styles.emptyTitle}>No pet profile yet</Text>
      <Text style={styles.emptySubtitle}>
        Create a pet profile to start{'\n'}building their pantry
      </Text>
      <TouchableOpacity
        style={styles.ctaButton}
        onPress={onAddPet}
        activeOpacity={0.7}
      >
        <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
        <Text style={styles.ctaText}>Add Your Pet</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  emptyIconPlatter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: `${Colors.accent}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${Colors.accent}15`,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  ctaText: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.accent,
  },
});
