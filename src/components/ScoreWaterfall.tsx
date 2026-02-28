// ScoreWaterfall — Visual breakdown of score calculation, layer by layer (D-094).
// Shows how the final suitability score was derived from 100 down.
// D-094: pet-named layer labels. D-084: zero emoji. D-095: no editorial copy.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ScoredResult } from '../types/scoring';
import { Colors, FontSizes, Spacing } from '../utils/constants';

// ─── Props ──────────────────────────────────────────────

interface ScoreWaterfallProps {
  scoredResult: ScoredResult;
  petName: string;
  category: 'daily_food' | 'treat';
}

// ─── Weights (must match scoring engine) ────────────────

const WEIGHTS = {
  daily_food: { iq: 0.55, np: 0.30, fc: 0.15 },
  treat: { iq: 1.0, np: 0, fc: 0 },
} as const;

// ─── Helpers ────────────────────────────────────────────

interface WaterfallRow {
  label: string;
  points: number; // negative = deduction, positive = addition
}

function buildRows(
  scoredResult: ScoredResult,
  petName: string,
  category: 'daily_food' | 'treat',
): WaterfallRow[] {
  const w = WEIGHTS[category];
  const { layer1, layer2, layer3 } = scoredResult;
  const rows: WaterfallRow[] = [];

  // Layer 1a — Ingredient Quality
  const iqDeduction = -Math.round((100 - layer1.ingredientQuality) * w.iq);
  rows.push({ label: 'Ingredient Concerns', points: iqDeduction });

  // Layer 1b — Nutritional Profile (daily food only)
  if (category === 'daily_food') {
    const npDeduction = -Math.round((100 - layer1.nutritionalProfile) * w.np);
    rows.push({ label: `${petName}'s Nutritional Fit`, points: npDeduction });
  }

  // Layer 1c — Formulation (daily food only)
  if (category === 'daily_food') {
    const fcDeduction = -Math.round((100 - layer1.formulation) * w.fc);
    rows.push({ label: 'Formulation Quality', points: fcDeduction });
  }

  // Layer 2 — Species Rules
  const speciesLabel = scoredResult.category === 'treat' ? 'Safety Rules' : 'Safety Rules';
  rows.push({
    label: speciesLabel,
    points: layer2.speciesAdjustment,
  });

  // Layer 3 — Personalization
  const l3Total = layer3.personalizations.reduce(
    (sum, p) => sum + p.adjustment,
    0,
  );
  rows.push({ label: `${petName}'s Profile`, points: l3Total });

  return rows;
}

function formatPoints(points: number): string {
  if (points === 0) return '0 pts';
  const sign = points > 0 ? '+' : '';
  return `${sign}${points} pts`;
}

function getPointsColor(points: number): string {
  if (points < 0) return Colors.severityRed;
  if (points > 0) return Colors.severityGreen;
  return Colors.textTertiary;
}

// ─── Component ──────────────────────────────────────────

export function ScoreWaterfall({
  scoredResult,
  petName,
  category,
}: ScoreWaterfallProps) {
  const rows = buildRows(scoredResult, petName, category);
  const maxMagnitude = Math.max(
    ...rows.map((r) => Math.abs(r.points)),
    1, // avoid division by zero
  );

  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeader}>Score Breakdown</Text>

      {/* Baseline */}
      <View style={styles.baselineRow}>
        <Text style={styles.baselineLabel}>Starts at 100</Text>
        <View style={styles.baselineDot} />
      </View>

      {/* Layer rows */}
      {rows.map((row) => {
        const barWidth = Math.abs(row.points) / maxMagnitude;
        const barColor = getPointsColor(row.points);
        return (
          <View key={row.label} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {row.label}
              </Text>
              <Text style={[styles.rowPoints, { color: barColor }]}>
                {formatPoints(row.points)}
              </Text>
            </View>
            {row.points !== 0 && (
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.max(barWidth * 100, 4)}%`,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              </View>
            )}
          </View>
        );
      })}

      {/* Final score */}
      <View style={styles.finalRow}>
        <Text style={styles.finalLabel}>Final</Text>
        <Text style={styles.finalScore}>
          {scoredResult.finalScore}% match
        </Text>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  baselineLabel: {
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  baselineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  row: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.cardBorder,
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  rowLabel: {
    fontSize: FontSizes.md,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  rowPoints: {
    fontSize: FontSizes.md,
    fontWeight: '600',
  },
  barTrack: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  finalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
  },
  finalLabel: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  finalScore: {
    fontSize: FontSizes.lg,
    fontWeight: '700',
    color: Colors.accent,
  },
});
