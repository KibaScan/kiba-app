import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { CATEGORY_ICONS, CATEGORY_ICONS_FILLED } from '../../constants/iconMaps';
import type { BrowseCategory } from '../../types/categoryBrowse';

// ─── Constants ──────────────────────────────────────────

export const BROWSE_CATEGORIES: readonly {
  key: BrowseCategory;
  label: string;
  tint: string;
}[] = [
  { key: 'daily_food', label: 'Daily Food', tint: Colors.accent },
  { key: 'toppers_mixers', label: 'Toppers & Mixers', tint: '#14B8A6' },
  { key: 'treat', label: 'Treats', tint: Colors.severityAmber },
  { key: 'supplement', label: 'Supplements', tint: '#A78BFA' },
] as const;

// ─── Component ──────────────────────────────────────────

interface CategoryGridProps {
  activeCategory: BrowseCategory | null;
  onCategoryTap: (category: BrowseCategory) => void;
}

export function CategoryGrid({ activeCategory, onCategoryTap }: CategoryGridProps) {
  return (
    <View style={styles.categoryGrid}>
      {BROWSE_CATEGORIES.map((cat) => {
        const selected = activeCategory === cat.key;
        return (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.categoryCard,
              selected && {
                borderColor: cat.tint,
                borderWidth: 2,
                backgroundColor: `${cat.tint}26`,
              },
            ]}
            onPress={() => onCategoryTap(cat.key)}
            activeOpacity={0.7}
          >
            <Image
              source={selected ? CATEGORY_ICONS_FILLED[cat.key] : CATEGORY_ICONS[cat.key]}
              style={{ width: 56, height: 56, tintColor: selected ? cat.tint : Colors.textTertiary }}
              resizeMode="contain"
            />
            <Text style={[styles.categoryLabel, selected && { color: cat.tint }]}>{cat.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryCard: {
    width: '48%' as unknown as number,
    flexGrow: 1,
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
  },
  categoryLabel: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
});
