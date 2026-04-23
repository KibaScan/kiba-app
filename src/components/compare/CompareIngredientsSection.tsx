// CompareIngredientsSection — Expandable side-by-side ingredient lists with severity dots.
// Bundles renderIngredientList helper + IngredientsFooter sub-component.
// Pure presentational component. Props provided by CompareScreen (state stays in parent).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';
import type { ProductIngredient } from '../../types/scoring';

// ─── Constants ────────────────────────────────────────────

const SEVERITY_DOT: Record<string, string> = {
  danger: Colors.severityRed,
  caution: Colors.severityAmber,
  neutral: Colors.textTertiary,
  good: Colors.severityGreen,
};

// ─── Helpers ──────────────────────────────────────────────

function renderIngredientList(ingredients: ProductIngredient[], species: 'dog' | 'cat') {
  const sevKey = species === 'dog' ? 'dog_base_severity' : 'cat_base_severity';
  const display = ingredients.slice(0, 10);

  return display.map((ing, i) => (
    <View key={`${ing.canonical_name}-${i}`} style={ss.ingredientItem}>
      <View style={[ss.severityDot, { backgroundColor: SEVERITY_DOT[ing[sevKey]] ?? Colors.textTertiary }]} />
      <Text style={ss.ingredientName} numberOfLines={1}>
        {toDisplayName(ing.canonical_name)}
      </Text>
    </View>
  ));
}

// ─── IngredientsFooter ────────────────────────────────────
// Mini composition bar + severity tally for ingredients beyond position 10.
// Top 10 are already listed above, so this surfaces hidden red/amber items.
// Tally row shows [dot + count] per non-zero severity in good→danger order.
function IngredientsFooter({
  ingredients,
  species,
}: {
  ingredients: ProductIngredient[];
  species: 'dog' | 'cat';
}) {
  const beyond = ingredients
    .filter((i) => i.position > 10)
    .sort((a, b) => a.position - b.position);
  if (beyond.length === 0) return null;

  const sevKey = species === 'dog' ? 'dog_base_severity' : 'cat_base_severity';
  const widthPct = 100 / beyond.length;

  // Severity counts — iterate in good→neutral→caution→danger order
  const counts: Record<string, number> = { good: 0, neutral: 0, caution: 0, danger: 0 };
  for (const ing of beyond) {
    const sev = ing[sevKey] ?? 'neutral';
    counts[sev] = (counts[sev] ?? 0) + 1;
  }
  const tallyOrder: Array<'good' | 'neutral' | 'caution' | 'danger'> = [
    'good',
    'neutral',
    'caution',
    'danger',
  ];

  return (
    <View style={ss.ingredientsFooter}>
      <View style={ss.miniBar}>
        {beyond.map((ing, idx) => {
          const color = SEVERITY_DOT[ing[sevKey]] ?? Colors.textTertiary;
          return (
            <View
              key={`${ing.position}-${idx}`}
              style={{ width: `${widthPct}%`, height: '100%', backgroundColor: color }}
            />
          );
        })}
      </View>
      <View style={ss.ingredientsTally}>
        {tallyOrder.map((sev) =>
          counts[sev] > 0 ? (
            <View key={sev} style={ss.ingredientsTallyItem}>
              <View style={[ss.severityDot, { backgroundColor: SEVERITY_DOT[sev] }]} />
              <Text style={ss.ingredientsTallyCount}>{counts[sev]}</Text>
            </View>
          ) : null,
        )}
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────

type Props = {
  ingredientsA: ProductIngredient[];
  ingredientsB: ProductIngredient[];
  species: 'dog' | 'cat';
  expanded: boolean;
  onToggle: () => void;
};

export function CompareIngredientsSection({ ingredientsA, ingredientsB, species, expanded, onToggle }: Props) {
  return (
    <View style={ss.section}>
      <TouchableOpacity
        style={ss.sectionHeader}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <Text style={ss.sectionTitle}>Ingredients</Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={Colors.textSecondary}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={ss.ingredientColumns}>
          <View style={ss.ingredientCol}>
            {renderIngredientList(ingredientsA, species)}
            <IngredientsFooter ingredients={ingredientsA} species={species} />
          </View>
          <View style={ss.ingredientDivider} />
          <View style={ss.ingredientCol}>
            {renderIngredientList(ingredientsB, species)}
            <IngredientsFooter ingredients={ingredientsB} species={species} />
          </View>
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  section: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.hairlineBorder,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  ingredientColumns: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  ingredientCol: {
    flex: 1,
  },
  ingredientDivider: {
    width: Spacing.sm,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
  },
  severityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  ingredientName: {
    flex: 1,
    fontSize: FontSizes.xs,
    color: Colors.textPrimary,
  },
  // Ingredients footer — mini severity bar + tally for ingredients beyond top 10
  ingredientsFooter: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.hairlineBorder,
  },
  miniBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  ingredientsTally: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs + 2,
  },
  ingredientsTallyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ingredientsTallyCount: {
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
