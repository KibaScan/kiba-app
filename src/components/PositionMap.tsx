// Kiba — Position Map
// Horizontal strip of colored segments representing ingredient composition.
// First ingredient = widest segment, tapering right. Color = severity.
// Zero emoji (D-084).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface PositionMapProps {
  ingredients: Array<{
    canonical_name: string;
    position: number;
    severity: 'good' | 'neutral' | 'caution' | 'danger';
    allergenOverride?: boolean;
  }>;
  onSegmentPress?: (position: number) => void;
}

// ─── Severity → Color ──────────────────────────────────

const SEVERITY_COLORS: Record<string, string> = {
  good: '#34C759',
  neutral: '#8E8E93',
  caution: '#FF9500',
  danger: '#FF3B30',
};

const UNRATED_COLOR = '#C7C7CC';
const ALLERGEN_BORDER_COLOR = '#FF9500';

// ─── Position Weight ────────────────────────────────────

function getPositionWeight(pos: number): number {
  if (pos === 1) return 15;
  if (pos === 2) return 12;
  if (pos >= 3 && pos <= 5) return 10;
  if (pos >= 6 && pos <= 10) return 5;
  return 2;
}

// ─── Component ──────────────────────────────────────────

export function PositionMap({ ingredients, onSegmentPress }: PositionMapProps) {
  if (ingredients.length === 0) return null;

  const sorted = [...ingredients].sort((a, b) => a.position - b.position);

  // Compute raw weights and normalize to 100%
  const rawWeights = sorted.map((ing) => getPositionWeight(ing.position));
  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Ingredient Composition</Text>
      <View style={styles.bar}>
        {sorted.map((ing, idx) => {
          const widthPct = (rawWeights[idx] / totalWeight) * 100;
          const color = SEVERITY_COLORS[ing.severity] ?? UNRATED_COLOR;
          const hasAllergenBorder = ing.allergenOverride === true;

          return (
            <TouchableOpacity
              key={`${ing.position}-${ing.canonical_name}`}
              style={[
                styles.segment,
                {
                  width: `${widthPct}%`,
                  backgroundColor: color,
                },
                hasAllergenBorder && styles.allergenBorder,
                idx === 0 && styles.firstSegment,
                idx === sorted.length - 1 && styles.lastSegment,
              ]}
              activeOpacity={0.7}
              onPress={() => onSegmentPress?.(ing.position)}
            />
          );
        })}
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    height: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: {
    height: '100%',
  },
  firstSegment: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  lastSegment: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  allergenBorder: {
    borderWidth: 2,
    borderColor: ALLERGEN_BORDER_COLOR,
  },
});
