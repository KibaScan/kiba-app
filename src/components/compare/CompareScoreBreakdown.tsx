// CompareScoreBreakdown — Two-column score bucket comparison (IQ / NP / FC).
// Pure presentational component. Props provided by CompareScreen (state stays in parent).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, FontSizes, Spacing, SCORING_WEIGHTS } from '../../utils/constants';
import type { ScoredResult } from '../../types/scoring';

// ─── Constants ────────────────────────────────────────────

const BUCKET_LABELS = [
  { key: 'ingredientQuality' as const, label: 'Ingredient Quality', maxKey: 'iq' as const },
  { key: 'nutritionalProfile' as const, label: 'Nutritional Profile', maxKey: 'np' as const },
  { key: 'formulation' as const, label: 'Formulation', maxKey: 'fc' as const },
];

// ─── Helpers ──────────────────────────────────────────────

function getMaxBucket(cat: string) {
  const w = cat === 'treat' ? SCORING_WEIGHTS.treat : SCORING_WEIGHTS.daily_food;
  return {
    iq: Math.round(w.iq * 100),
    np: Math.round(w.np * 100),
    fc: Math.round(w.fc * 100),
  };
}

// ─── Component ────────────────────────────────────────────

type Props = {
  layer1A: ScoredResult['layer1'];
  layer1B: ScoredResult['layer1'];
  category: string;
};

export function CompareScoreBreakdown({ layer1A, layer1B, category }: Props) {
  const bucketMax = getMaxBucket(category);

  return (
    <View style={ss.section}>
      <Text style={ss.sectionTitle}>Score Breakdown</Text>
      {BUCKET_LABELS.map(({ key, label, maxKey }) => {
        const rawA = layer1A[key];
        const rawB = layer1B[key];
        const max = bucketMax[maxKey];
        if (max === 0) return null; // treat: skip NP/FC

        // Convert raw 0-100 bucket score → weighted contribution out of max
        const valA = Math.round((rawA / 100) * max);
        const valB = Math.round((rawB / 100) * max);
        const highlightA = valA > valB;
        const highlightB = valB > valA;

        return (
          <View key={key} style={ss.bucketRow}>
            <Text style={[
              ss.bucketValue,
              highlightA && ss.bucketValueWinner,
              highlightB && ss.bucketValueLoser,
            ]}>
              {valA}/{max}
            </Text>
            <Text style={ss.bucketLabel}>{label}</Text>
            <Text style={[
              ss.bucketValue,
              highlightB && ss.bucketValueWinner,
              highlightA && ss.bucketValueLoser,
            ]}>
              {valB}/{max}
            </Text>
          </View>
        );
      })}
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
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  bucketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.hairlineBorder,
  },
  bucketLabel: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  bucketValue: {
    width: 60,
    fontSize: FontSizes.sm,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  bucketValueWinner: {
    color: Colors.accent,
  },
  bucketValueLoser: {
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
