// Kiba — M9 Community ToxicEntryRow
// One row in the ToxicDatabaseScreen SectionList. Shows entry name, a small
// category chip, and a severity dot keyed off SEVERITY_COLORS for the active
// species. Tapping opens the ToxicEntrySheet.
// D-084: Ionicons only. Matte Premium: cardSurface, hairlineBorder, 16-radius.

import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

import { Colors, FontSizes, Spacing, SEVERITY_COLORS } from '../../utils/constants';
import type { ToxicEntry, ToxicSeverity } from '../../types/toxic';

const CATEGORY_LABELS: Record<ToxicEntry['category'], string> = {
  food: 'Food',
  plant: 'Plant',
  medication: 'Medication',
  household: 'Household',
};

function severityToColorKey(s: ToxicSeverity): keyof typeof SEVERITY_COLORS {
  if (s === 'toxic') return 'danger';
  if (s === 'caution') return 'caution';
  return 'good';
}

interface Props {
  entry: ToxicEntry;
  species: 'dog' | 'cat';
  onPress: () => void;
}

export function ToxicEntryRow({ entry, species, onPress }: Props) {
  const severity = entry.species_severity[species];
  const dotColor = SEVERITY_COLORS[severityToColorKey(severity)];
  const a11y = `${entry.name}, ${severity} for ${species === 'dog' ? 'dogs' : 'cats'}`;

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={a11y}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={styles.name} numberOfLines={1}>
        {entry.name}
      </Text>
      <View style={styles.categoryChip}>
        <Text style={styles.categoryText}>{CATEGORY_LABELS[entry.category]}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  name: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  categoryChip: {
    backgroundColor: Colors.chipSurface,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
