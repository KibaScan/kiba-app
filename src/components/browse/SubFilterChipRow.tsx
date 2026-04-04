// SubFilterChipRow — horizontal scrollable filter chips for category browse.
// Pattern follows PantryScreen chip row. Tap to toggle, tap again to deselect.

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import type { SubFilterDef } from '../../types/categoryBrowse';

interface Props {
  filters: SubFilterDef[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  counts?: Record<string, number>;
}

export function SubFilterChipRow({ filters, activeKey, onSelect, counts }: Props) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.filterIcon}>
          <Ionicons name="options-outline" size={18} color={Colors.textSecondary} />
        </View>
        {filters.map((f) => {
          const selected = activeKey === f.key;
          const count = counts?.[f.key];
          return (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, selected ? styles.chipActive : styles.chipInactive]}
              onPress={() => onSelect(selected ? null : f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, selected ? styles.chipTextActive : styles.chipTextInactive]}>
                {f.label}
              </Text>
              {count !== undefined && (
                <Text style={[styles.chipCount, selected ? styles.chipCountActive : styles.chipCountInactive]}>
                  {count >= 1000 ? `${(count / 1000).toFixed(1)}k` : String(count)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: 8,
    alignItems: 'center',
  },
  filterIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
  },
  chipActive: {
    backgroundColor: Colors.accent,
  },
  chipInactive: {
    backgroundColor: Colors.cardSurface,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  chipTextInactive: {
    color: Colors.textSecondary,
  },
  chipCount: {
    fontSize: FontSizes.xs,
    fontWeight: '500',
  },
  chipCountActive: {
    color: 'rgba(255,255,255,0.7)',
  },
  chipCountInactive: {
    color: Colors.textTertiary,
  },
});
