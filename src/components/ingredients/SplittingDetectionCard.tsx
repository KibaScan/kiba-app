// Kiba — Splitting Detection Card
// Educational callout when ingredient splitting is detected.
// Uses cluster_id matching, never string matching (D-044 rule 8).
// Zero emoji (D-084). Factual language (D-095): "may represent" not "is."

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontSizes, Spacing } from '../../utils/constants';
import { toDisplayName } from '../../utils/formatters';

// ─── Props ──────────────────────────────────────────────

interface SplittingDetectionCardProps {
  clusters: Array<{
    clusterName: string;
    ingredients: string[];
    positions: number[];
  }>;
}

// ─── Utility: Build Clusters from Hydrated Ingredients ──

import type { ProductIngredient } from '../../types/scoring';

export function buildSplittingClusters(
  ingredients: ProductIngredient[],
): SplittingDetectionCardProps['clusters'] {
  const clusterMap = new Map<
    string,
    { ingredients: string[]; positions: number[] }
  >();

  for (const ing of ingredients) {
    if (ing.cluster_id == null) continue;
    const entry = clusterMap.get(ing.cluster_id);
    if (entry) {
      entry.ingredients.push(toDisplayName(ing.canonical_name));
      entry.positions.push(ing.position);
    } else {
      clusterMap.set(ing.cluster_id, {
        ingredients: [toDisplayName(ing.canonical_name)],
        positions: [ing.position],
      });
    }
  }

  const clusters: SplittingDetectionCardProps['clusters'] = [];
  for (const [clusterId, data] of clusterMap) {
    if (data.ingredients.length >= 2) {
      // Use cluster_id as human-readable name (capitalize first letter of each word)
      const clusterName = clusterId
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      clusters.push({
        clusterName,
        ingredients: data.ingredients,
        positions: data.positions,
      });
    }
  }

  return clusters;
}

// ─── Component ──────────────────────────────────────────

export function SplittingDetectionCard({ clusters }: SplittingDetectionCardProps) {
  if (clusters.length === 0) return null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name="information-circle-outline"
          size={20}
          color={Colors.severityAmber}
        />
        <Text style={styles.title}>Ingredient Splitting Detected</Text>
      </View>

      {clusters.map((cluster, idx) => {
        const listText = formatIngredientList(cluster.ingredients);
        return (
          <Text key={idx} style={styles.body}>
            This product lists {listText} as separate ingredients. Combined,{' '}
            {cluster.clusterName.toLowerCase()} may represent a larger portion
            of the recipe than any single listing suggests.
          </Text>
        );
      })}

      <Text style={styles.footnote}>
        Why this matters: AAFCO requires ingredients in descending order by
        weight. Listing related ingredients separately can make each appear
        lower on the list.
      </Text>
    </View>
  );
}

// ─── Helpers ────────────────────────────────────────────

function formatIngredientList(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.cardSurface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: Colors.severityAmber,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    flex: 1,
  },
  body: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.sm,
  },
  footnote: {
    fontSize: FontSizes.xs,
    color: Colors.textTertiary,
    lineHeight: 16,
    marginTop: 2,
  },
});
