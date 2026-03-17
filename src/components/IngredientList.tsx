// IngredientList — Full ingredient list grouped by severity tier (D-031).
// All ingredients visible on scroll, NOT behind a toggle (D-108).
// Each row tappable for singleton modal detail (D-030).
// Ionicons only — zero emoji (D-084). D-095 compliant copy.

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ProductIngredient, IngredientSeverity } from '../types/scoring';
import { Colors, FontSizes, Spacing, SEVERITY_COLORS, SEVERITY_DISPLAY_LABELS } from '../utils/constants';
import { toDisplayName } from '../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface FlavorAnnotation {
  primaryProteinName: string;
  namedProtein: string;
}

interface IngredientListProps {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
  onIngredientPress: (ingredient: ProductIngredient) => void;
  flavorAnnotation?: FlavorAnnotation | null;
}

// ─── Helpers ────────────────────────────────────────────

const SEVERITY_ORDER: Record<IngredientSeverity, number> = {
  danger: 0,
  caution: 1,
  neutral: 2,
  good: 3,
};

// SEVERITY_COLORS + SEVERITY_DISPLAY_LABELS imported from constants.ts — single source of truth

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
  return toDisplayName(ingredient.canonical_name);
}

/** Split "Animal Fat (generic, preserved with BHA)" into primary + parenthetical */
function parseName(fullName: string): { primary: string; parenthetical: string | null } {
  const parenIdx = fullName.indexOf('(');
  if (parenIdx < 0) return { primary: fullName, parenthetical: null };
  const primary = fullName.substring(0, parenIdx).trim();
  const closeParen = fullName.lastIndexOf(')');
  const content = closeParen > parenIdx
    ? fullName.substring(parenIdx + 1, closeParen).trim()
    : fullName.substring(parenIdx + 1).trim();
  return { primary, parenthetical: content || null };
}

// ─── Component ──────────────────────────────────────────

export function IngredientList({
  ingredients,
  species,
  onIngredientPress,
  flavorAnnotation,
}: IngredientListProps) {
  // Sort by severity worst→best, then by position within same severity
  const sorted = [...ingredients].sort((a, b) => {
    const sevA = SEVERITY_ORDER[getSeverity(a, species)];
    const sevB = SEVERITY_ORDER[getSeverity(b, species)];
    if (sevA !== sevB) return sevA - sevB;
    return a.position - b.position;
  });

  // Pre-count per severity for section headers
  const severityCounts = new Map<IngredientSeverity, number>();
  for (const ing of sorted) {
    const sev = getSeverity(ing, species);
    severityCounts.set(sev, (severityCounts.get(sev) ?? 0) + 1);
  }

  // Build elements with section headers between severity groups
  const elements: React.ReactNode[] = [];
  let currentSeverity: IngredientSeverity | null = null;

  for (const ingredient of sorted) {
    const severity = getSeverity(ingredient, species);
    const color = SEVERITY_COLORS[severity];
    const label = SEVERITY_DISPLAY_LABELS[severity];
    const count = severityCounts.get(severity) ?? 0;

    // Insert section header when severity group changes
    if (severity !== currentSeverity) {
      currentSeverity = severity;
      elements.push(
        <View key={`section-${severity}`} style={styles.sectionDivider}>
          <Text style={[styles.sectionDividerLabel, { color }]}>
            {label} {'\u00B7'} {count}
          </Text>
        </View>,
      );
    }

    const fullName = formatName(ingredient);
    const { primary, parenthetical } = parseName(fullName);

    elements.push(
      <TouchableOpacity
        key={`${ingredient.canonical_name}-${ingredient.position}`}
        style={styles.row}
        onPress={() => onIngredientPress(ingredient)}
        activeOpacity={0.7}
      >
        <View style={styles.rowTop}>
          <Text style={styles.positionNumber}>#{ingredient.position}</Text>
          <View style={styles.nameBlock}>
            <Text style={styles.ingredientName}>{primary}</Text>
            {parenthetical && (
              <Text style={styles.parenthetical} numberOfLines={1}>
                {parenthetical}
              </Text>
            )}
          </View>
          <Text style={[styles.severityLabel, { color }]}>{label}</Text>
        </View>
        {ingredient.definition && (
          <Text style={styles.definition} numberOfLines={1}>
            {ingredient.definition}
          </Text>
        )}
        {flavorAnnotation &&
          fullName.toLowerCase() ===
            flavorAnnotation.primaryProteinName.toLowerCase() && (
          <Text style={styles.flavorAnnotation}>
            Primary protein (product named as {flavorAnnotation.namedProtein})
          </Text>
        )}
      </TouchableOpacity>,
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>
        All Ingredients ({ingredients.length})
      </Text>
      {elements}
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
  sectionDivider: {
    marginTop: 8,
    marginBottom: 6,
  },
  sectionDividerLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    alignItems: 'flex-start',
  },
  positionNumber: {
    fontSize: FontSizes.xs,
    color: '#737373',
    marginRight: 8,
    marginTop: 2,
    minWidth: 20,
  },
  nameBlock: {
    flex: 1,
    marginRight: 8,
  },
  ingredientName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  parenthetical: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  severityLabel: {
    fontSize: FontSizes.xs,
    fontWeight: '700',
    flexShrink: 0,
  },
  definition: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 4,
    marginLeft: 28,
  },
  flavorAnnotation: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    marginTop: 3,
    marginLeft: 28,
    fontStyle: 'italic',
  },
});
