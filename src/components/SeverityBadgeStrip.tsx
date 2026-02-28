// SeverityBadgeStrip — 4-5 worst-scoring ingredients as tappable color-coded chips (D-108).
// Only shows danger + caution severity ingredients. Sorted worst-first, then by position.
// Ionicons only — zero emoji (D-084).

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import type { ProductIngredient } from '../types/scoring';
import type { IngredientSeverity } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface SeverityBadgeStripProps {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
  onIngredientPress: (ingredient: ProductIngredient) => void;
}

// ─── Helpers ────────────────────────────────────────────

const MAX_BADGES = 5;

const SEVERITY_ORDER: Record<string, number> = {
  danger: 0,
  caution: 1,
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
  // Format canonical_name: replace underscores, capitalize each word
  return ingredient.canonical_name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ─── Component ──────────────────────────────────────────

export function SeverityBadgeStrip({
  ingredients,
  species,
  onIngredientPress,
}: SeverityBadgeStripProps) {
  // Filter to danger/caution only
  const concerning = ingredients.filter((i) => {
    const sev = getSeverity(i, species);
    return sev === 'danger' || sev === 'caution';
  });

  if (concerning.length === 0) return null;

  // Sort: danger first, then caution, then by position
  const sorted = [...concerning].sort((a, b) => {
    const sevA = SEVERITY_ORDER[getSeverity(a, species)] ?? 2;
    const sevB = SEVERITY_ORDER[getSeverity(b, species)] ?? 2;
    if (sevA !== sevB) return sevA - sevB;
    return a.position - b.position;
  });

  const visible = sorted.slice(0, MAX_BADGES);

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {visible.map((ingredient) => {
          const severity = getSeverity(ingredient, species);
          const isDanger = severity === 'danger';
          return (
            <TouchableOpacity
              key={`${ingredient.canonical_name}-${ingredient.position}`}
              style={[
                styles.chip,
                isDanger ? styles.chipDanger : styles.chipCaution,
              ]}
              onPress={() => onIngredientPress(ingredient)}
              activeOpacity={0.7}
            >
              {isDanger && (
                <View style={styles.dangerDot} />
              )}
              <Text
                style={[
                  styles.chipText,
                  { color: isDanger ? Colors.severityRed : Colors.severityAmber },
                ]}
                numberOfLines={1}
              >
                {formatName(ingredient)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  scrollContent: {
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  chipDanger: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  chipCaution: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
  },
  chipText: {
    fontSize: FontSizes.sm,
    fontWeight: '600',
  },
  dangerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.severityRed,
  },
});
