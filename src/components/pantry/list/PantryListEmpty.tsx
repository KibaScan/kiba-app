// Kiba — PantryListEmpty
// Empty state for the pantry SectionList (two variants: no items, or filter match).
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
import type { FilterChip } from '../../../utils/pantryScreenHelpers';

// ─── Filter label map ────────────────────────────────────

const FILTER_LABEL_MAP: Record<FilterChip, string> = {
  all: '', dry: 'dry', wet: 'wet', treats: 'treat',
  supplemental: 'topper', recalled: 'recalled', running_low: 'low stock',
};

// ─── Component ──────────────────────────────────────────

type Props = {
  /** Whether any items exist at all (pre-filter). */
  hasItems: boolean;
  activeFilter: FilterChip;
  petName: string;
  onScanPress: () => void;
};

export function PantryListEmpty({ hasItems, activeFilter, petName, onScanPress }: Props) {
  if (!hasItems) {
    return (
      <View style={styles.emptyCenter}>
        <View style={styles.emptyIconPlatter}>
          <Ionicons name="scan-outline" size={40} color={Colors.accent} />
        </View>
        <Text style={styles.emptyTitle}>Pantry is empty</Text>
        <Text style={styles.emptySubtitle}>
          Scan a product to add it to{'\n'}{petName}'s pantry
        </Text>
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={onScanPress}
          activeOpacity={0.7}
        >
          <Ionicons name="scan-outline" size={18} color={Colors.accent} />
          <Text style={styles.ctaText}>Scan a Product</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.emptyFilter}>
      <View style={styles.emptyIconPlatter}>
        <Ionicons name="filter-outline" size={40} color={Colors.accent} />
      </View>
      <Text style={styles.emptyFilterText}>
        No {FILTER_LABEL_MAP[activeFilter]} items in pantry
      </Text>
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
  emptyFilter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
    gap: Spacing.sm,
  },
  emptyFilterText: {
    fontSize: FontSizes.md,
    color: Colors.textSecondary,
  },
});
