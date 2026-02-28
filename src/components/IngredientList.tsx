// IngredientList — Full ingredient list sorted worst-to-best (D-031).
// All ingredients visible on scroll, NOT behind a toggle (D-108).
// Each row tappable for singleton modal detail (D-030).
// Ionicons only — zero emoji (D-084). D-095 compliant copy.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ProductIngredient, IngredientSeverity } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface IngredientListProps {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
  onIngredientPress: (ingredient: ProductIngredient) => void;
}

// ─── Helpers ────────────────────────────────────────────

const SEVERITY_ORDER: Record<IngredientSeverity, number> = {
  danger: 0,
  caution: 1,
  neutral: 2,
  good: 3,
};

const SEVERITY_COLORS: Record<IngredientSeverity, string> = {
  danger: Colors.severityRed,
  caution: Colors.severityAmber,
  neutral: Colors.severityNone,
  good: Colors.severityGreen,
};

const SEVERITY_LABELS: Record<IngredientSeverity, string> = {
  danger: 'Danger',
  caution: 'Caution',
  neutral: 'Neutral',
  good: 'Good',
};

function getSeverity(
  ingredient: ProductIngredient,
  species: 'dog' | 'cat',
): IngredientSeverity {
  return species === 'cat'
    ? ingredient.cat_base_severity
    : ingredient.dog_base_severity;
}

function formatName(ingredient: ProductIngredient): string {
  if (ingredient.display_name) return ingredient.display_name;
  return ingredient.canonical_name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Component ──────────────────────────────────────────

export function IngredientList({
  ingredients,
  species,
  onIngredientPress,
}: IngredientListProps) {
  // D-031: sort by severity worst→best, then by position within same severity
  const sorted = [...ingredients].sort((a, b) => {
    const sevA = SEVERITY_ORDER[getSeverity(a, species)];
    const sevB = SEVERITY_ORDER[getSeverity(b, species)];
    if (sevA !== sevB) return sevA - sevB;
    return a.position - b.position;
  });

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>
        All Ingredients ({ingredients.length})
      </Text>

      {sorted.map((ingredient) => {
        const severity = getSeverity(ingredient, species);
        const color = SEVERITY_COLORS[severity];
        const label = SEVERITY_LABELS[severity];

        return (
          <TouchableOpacity
            key={`${ingredient.canonical_name}-${ingredient.position}`}
            style={styles.row}
            onPress={() => onIngredientPress(ingredient)}
            activeOpacity={0.7}
          >
            <View style={styles.rowTop}>
              <View style={styles.rowLeft}>
                <View style={[styles.dot, { backgroundColor: color }]} />
                <Text style={styles.ingredientName} numberOfLines={1}>
                  {formatName(ingredient)}
                </Text>
              </View>
              <View style={styles.rowRight}>
                <Text style={styles.positionBadge}>#{ingredient.position}</Text>
                <Text style={[styles.severityLabel, { color }]}>{label}</Text>
              </View>
            </View>
            {ingredient.definition && (
              <Text style={styles.definition} numberOfLines={1}>
                {ingredient.definition}
              </Text>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  row: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: FontSizes.md,
    fontWeight: '600',
    color: Colors.textPrimary,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  positionBadge: {
    fontSize: FontSizes.xs,
    fontWeight: '600',
    color: Colors.textTertiary,
    backgroundColor: Colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  severityLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
  },
  definition: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginLeft: 16, // align with name after dot
  },
});
