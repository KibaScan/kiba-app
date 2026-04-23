// Kiba — PantryFilterChips
// Horizontal filter chip row + sort button for the pantry list.
// Extracted from PantryScreen.tsx — zero behavior change.

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes } from '../../../utils/constants';
import type { FilterChip, SortOption } from '../../../utils/pantryScreenHelpers';

// ─── Constants ──────────────────────────────────────────

export const FILTER_CHIPS: { key: FilterChip; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dry', label: 'Dry' },
  { key: 'wet', label: 'Wet' },
  { key: 'treats', label: 'Treats' },
  { key: 'supplemental', label: 'Toppers' },
  { key: 'recalled', label: 'Recalled' },
  { key: 'running_low', label: 'Running Low' },
];

function getChipAccentColor(chip: FilterChip): string {
  switch (chip) {
    case 'supplemental': return '#14B8A6';
    case 'recalled': return Colors.severityRed;
    case 'running_low': return Colors.severityAmber;
    default: return Colors.accent;
  }
}

// ─── Component ──────────────────────────────────────────

type Props = {
  activeFilter: FilterChip;
  onFilterChange: (filter: FilterChip) => void;
  activeSort: SortOption;
  onOpenSort: () => void;
};

export function PantryFilterChips({ activeFilter, onFilterChange, activeSort, onOpenSort }: Props) {
  return (
    <View style={styles.filterRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterChipsContent}
        style={styles.filterChips}
      >
        {FILTER_CHIPS.map(chip => {
          const selected = activeFilter === chip.key;
          const accentColor = getChipAccentColor(chip.key);
          return (
            <TouchableOpacity
              key={chip.key}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: accentColor }
                  : { backgroundColor: Colors.hairlineBorder },
              ]}
              onPress={() => onFilterChange(chip.key)}
              activeOpacity={0.7}
            >
              <Text style={[
                styles.chipText,
                selected
                  ? { color: '#FFFFFF' }
                  : { color: Colors.textSecondary },
              ]}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TouchableOpacity
        style={styles.sortButton}
        onPress={onOpenSort}
        activeOpacity={0.7}
      >
        <Ionicons
          name="swap-vertical-outline"
          size={20}
          color={activeSort !== 'default' ? Colors.accent : Colors.textSecondary}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 0,
    marginBottom: 2,
  },
  filterChips: {
    flex: 1,
  },
  filterChipsContent: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '500',
  },
  sortButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Colors.hairlineBorder,
  },
});
